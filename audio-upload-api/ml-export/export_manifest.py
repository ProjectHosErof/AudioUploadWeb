#!/usr/bin/env python3
"""
Phase 3 / Pillar D — training-manifest export for Project Hos Erof.

Emits the approved corpus (`review_status='ready'`) as a versioned, immutable
dataset under R2 `datasets/`. Per ADR-011 this is a MANIFEST ONLY: audio keys,
labels, and metadata. It deliberately does NOT compute mel-spectrograms or
fingerprints — those depend on a model architecture that hasn't been chosen,
and baking the wrong window size into thousands of artifacts is expensive to
undo. When that decision is made, feature extraction becomes a second job
reading this manifest.

Each run writes a new version directory; nothing is ever overwritten, so a
training run can always be traced back to the exact bytes it saw:

    datasets/<version>/manifest.parquet   columnar, for the training pipeline
    datasets/<version>/manifest.csv       same rows, for eyeballing
    datasets/<version>/dataset_card.json  provenance + label distributions
    datasets/latest.json                  pointer to the newest version

Version ids are UTC timestamps (20260822T174500Z), so lexical order is
chronological order.

PRIVACY: the manifest carries no contributor email and no submitter email —
only the opaque contributor_id. A dataset is the artifact most likely to be
copied onto a laptop or shared with a collaborator, so personal data should
never be in it in the first place.

Config comes from ../.env (the audio-upload-api credentials).

Usage:
    python export_manifest.py                 # export + upload to R2
    python export_manifest.py --dry-run       # query + summarise, write nothing
    python export_manifest.py --no-upload     # write locally only
    python export_manifest.py --out-dir ./out # where local copies land
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import boto3
import psycopg2
import psycopg2.extras
import pyarrow as pa
import pyarrow.csv as pa_csv
import pyarrow.parquet as pq
from botocore.config import Config
from dotenv import load_dotenv

# --- config -----------------------------------------------------------------

ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ENV_PATH)

# MIGRATE_URL is the IPv4 session pooler. db.<ref>.supabase.co (DIRECT_URL) is
# IPv6-only, so on a network without IPv6 it is simply unreachable — see
# DEPLOY.md. Prefer the pooler when it is configured.
DB_URL = os.environ.get("MIGRATE_URL") or os.environ.get("DIRECT_URL")
R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.environ.get("R2_BUCKET_NAME")

DATASET_PREFIX = "datasets"

# Bump when the column set changes in a way a consumer must notice. Recorded in
# the dataset card so a training run can assert on what it was built against.
MANIFEST_SCHEMA_VERSION = 1


def require_config() -> None:
    missing = [
        name
        for name, val in {
            "MIGRATE_URL or DIRECT_URL": DB_URL,
            "R2_ACCOUNT_ID": R2_ACCOUNT_ID,
            "R2_ACCESS_KEY_ID": R2_ACCESS_KEY_ID,
            "R2_SECRET_ACCESS_KEY": R2_SECRET_ACCESS_KEY,
            "R2_BUCKET_NAME": R2_BUCKET_NAME,
        }.items()
        if not val
    ]
    if missing:
        sys.exit(f"Missing required config in {ENV_PATH}: {', '.join(missing)}")


# --- clients ----------------------------------------------------------------

def make_s3():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
        region_name="auto",
        config=Config(signature_version="s3v4", retries={"max_attempts": 3}),
    )


def connect_db():
    return psycopg2.connect(DB_URL, sslmode="require")


# --- query ------------------------------------------------------------------

# Ordered by id so two exports of the same corpus produce byte-comparable row
# order; created_at would reorder rows whose timestamps collide.
SELECT_READY = """
    SELECT
        r.id::text                AS recording_id,
        r.r2_key,
        r.content_hash,
        r.content_type,
        r.file_size_bytes,
        r.duration_seconds,
        r.sample_rate_hz,
        r.channels,
        r.codec,
        r.hymn_slug,
        r.hymn_label,
        h.rhythm                  AS hymn_rhythm,
        r.service_slug,
        s.label                   AS service_label,
        r.season_slug,
        sn.label                  AS season_label,
        r.languages,
        r.created_at              AS uploaded_at,
        r.reviewed_at,
        r.contributor_id::text    AS contributor_id
    FROM recordings r
    LEFT JOIN hymns    h  ON h.slug  = r.hymn_slug
    LEFT JOIN services s  ON s.slug  = r.service_slug
    LEFT JOIN seasons  sn ON sn.slug = r.season_slug
    WHERE r.review_status = 'ready'
    ORDER BY r.id
"""

# Column order of the emitted manifest. Explicit so a schema change is a
# deliberate edit here (and a MANIFEST_SCHEMA_VERSION bump), not a side effect
# of editing the query.
COLUMNS = [
    "recording_id",
    "r2_key",
    "content_hash",
    "content_type",
    "file_size_bytes",
    "duration_seconds",
    "sample_rate_hz",
    "channels",
    "codec",
    "hymn_slug",
    "hymn_label",
    "hymn_rhythm",
    "service_slug",
    "service_label",
    "season_slug",
    "season_label",
    "languages",
    "uploaded_at",
    "reviewed_at",
    "contributor_id",
]

# Fixed schema rather than inferred: an all-null column in a small export would
# otherwise be typed as null and change type once real data arrives, which
# breaks consumers reading several versions.
ARROW_SCHEMA = pa.schema([
    ("recording_id", pa.string()),
    ("r2_key", pa.string()),
    ("content_hash", pa.string()),
    ("content_type", pa.string()),
    ("file_size_bytes", pa.int64()),
    ("duration_seconds", pa.float64()),
    ("sample_rate_hz", pa.int32()),
    ("channels", pa.int32()),
    ("codec", pa.string()),
    ("hymn_slug", pa.string()),
    ("hymn_label", pa.string()),
    ("hymn_rhythm", pa.string()),
    ("service_slug", pa.string()),
    ("service_label", pa.string()),
    ("season_slug", pa.string()),
    ("season_label", pa.string()),
    # Pipe-joined slugs ("lang-coptic|lang-english") so parquet and CSV carry
    # exactly the same value; a real list type would have no CSV equivalent.
    ("languages", pa.string()),
    ("uploaded_at", pa.string()),
    ("reviewed_at", pa.string()),
    ("contributor_id", pa.string()),
])


def fetch_rows(conn) -> list:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(SELECT_READY)
        return [normalise(dict(r)) for r in cur.fetchall()]


def normalise(row: dict) -> dict:
    """Coerce driver types into the flat, JSON-friendly shapes the schema wants."""
    langs = row.get("languages") or []
    if isinstance(langs, str):  # jsonb can arrive pre-decoded or as text
        langs = json.loads(langs)
    row["languages"] = "|".join(sorted(langs))

    for key in ("uploaded_at", "reviewed_at"):
        val = row.get(key)
        row[key] = val.astimezone(timezone.utc).isoformat() if val else None

    # numeric -> Decimal from psycopg2; parquet wants a plain float.
    if row.get("duration_seconds") is not None:
        row["duration_seconds"] = float(row["duration_seconds"])
    if row.get("file_size_bytes") is not None:
        row["file_size_bytes"] = int(row["file_size_bytes"])

    return {col: row.get(col) for col in COLUMNS}


# --- dataset card -----------------------------------------------------------

def git_commit() -> str:
    """Which code produced this export. 'unknown' outside a git checkout."""
    try:
        out = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=Path(__file__).resolve().parent,
            capture_output=True, text=True, timeout=5,
        )
        return out.stdout.strip() or "unknown"
    except Exception:
        return "unknown"


def build_card(version: str, rows: list) -> dict:
    durations = [r["duration_seconds"] for r in rows if r["duration_seconds"] is not None]
    languages = Counter(l for r in rows for l in (r["languages"].split("|") if r["languages"] else []))

    return {
        "dataset": "project-hos-erof-hymns",
        "version": version,
        "schema_version": MANIFEST_SCHEMA_VERSION,
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source_commit": git_commit(),
        "bucket": R2_BUCKET_NAME,
        "audio_key_column": "r2_key",
        "selection": "review_status = 'ready' (human-approved; see ADR-008)",
        "contains_personal_data": False,
        "row_count": len(rows),
        "total_duration_seconds": round(sum(durations), 2),
        # A moderator can approve a row the enrichment job hasn't reached yet;
        # such rows have no duration/codec and a trainer should skip them.
        "rows_missing_audio_metadata": sum(1 for r in rows if r["duration_seconds"] is None),
        "distinct_hymns": len({r["hymn_slug"] for r in rows}),
        "distinct_contributors": len({r["contributor_id"] for r in rows if r["contributor_id"]}),
        # Class balance is the first thing that goes wrong in a recognition
        # corpus, so make it visible in the artifact rather than a later query.
        "counts_by_hymn": dict(Counter(r["hymn_slug"] for r in rows).most_common()),
        "counts_by_service": dict(Counter(r["service_slug"] for r in rows).most_common()),
        "counts_by_season": dict(Counter(r["season_slug"] for r in rows).most_common()),
        "counts_by_language": dict(languages.most_common()),
        "columns": COLUMNS,
    }


# --- output -----------------------------------------------------------------

def write_local(out_dir: Path, version: str, rows: list, card: dict) -> dict:
    target = out_dir / version
    target.mkdir(parents=True, exist_ok=True)

    table = pa.Table.from_pylist(rows, schema=ARROW_SCHEMA) if rows else ARROW_SCHEMA.empty_table()

    paths = {
        "manifest.parquet": target / "manifest.parquet",
        "manifest.csv": target / "manifest.csv",
        "dataset_card.json": target / "dataset_card.json",
    }
    pq.write_table(table, paths["manifest.parquet"], compression="snappy")
    pa_csv.write_csv(table, paths["manifest.csv"])
    paths["dataset_card.json"].write_text(json.dumps(card, indent=2) + "\n")
    return paths


CONTENT_TYPES = {
    ".parquet": "application/vnd.apache.parquet",
    ".csv": "text/csv",
    ".json": "application/json",
}


def upload(s3, version: str, paths: dict, card: dict) -> None:
    for name, path in paths.items():
        key = f"{DATASET_PREFIX}/{version}/{name}"
        s3.put_object(
            Bucket=R2_BUCKET_NAME,
            Key=key,
            Body=path.read_bytes(),
            ContentType=CONTENT_TYPES.get(path.suffix, "application/octet-stream"),
        )
        print(f"  uploaded {key}")

    # Written last: until this flips, `latest` still names a complete version,
    # so a partially-uploaded export can never be picked up as current.
    pointer = {
        "version": version,
        "generated_at": card["generated_at"],
        "row_count": card["row_count"],
        "schema_version": card["schema_version"],
        "manifest_parquet": f"{DATASET_PREFIX}/{version}/manifest.parquet",
        "manifest_csv": f"{DATASET_PREFIX}/{version}/manifest.csv",
        "dataset_card": f"{DATASET_PREFIX}/{version}/dataset_card.json",
    }
    s3.put_object(
        Bucket=R2_BUCKET_NAME,
        Key=f"{DATASET_PREFIX}/latest.json",
        Body=(json.dumps(pointer, indent=2) + "\n").encode(),
        ContentType="application/json",
    )
    print(f"  uploaded {DATASET_PREFIX}/latest.json -> {version}")


# --- main -------------------------------------------------------------------

def summarise(card: dict) -> None:
    print(f"  rows                {card['row_count']}")
    print(f"  total duration      {card['total_duration_seconds']}s")
    print(f"  distinct hymns      {card['distinct_hymns']}")
    print(f"  contributors        {card['distinct_contributors']}")
    if card["rows_missing_audio_metadata"]:
        print(f"  ⚠ unenriched rows   {card['rows_missing_audio_metadata']} (no duration/codec)")


def main() -> int:
    parser = argparse.ArgumentParser(description="Export the approved corpus as a versioned manifest.")
    parser.add_argument("--dry-run", action="store_true", help="query and summarise, write nothing")
    parser.add_argument("--no-upload", action="store_true", help="write local files but skip R2")
    parser.add_argument("--out-dir", default="./out", help="where local copies are written (default ./out)")
    args = parser.parse_args()

    require_config()
    version = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    conn = connect_db()
    try:
        rows = fetch_rows(conn)
    finally:
        conn.close()

    card = build_card(version, rows)
    print(f"Manifest export {version}")
    summarise(card)

    if not rows:
        # Not an error: it just means nothing has been approved yet. Emitting an
        # empty dataset would put a misleading artifact in the versioned history.
        print("\nNothing is approved yet — no dataset written.")
        return 0

    if args.dry_run:
        print("\nDry run — nothing written.")
        return 0

    paths = write_local(Path(args.out_dir), version, rows, card)
    print(f"\nWrote {len(paths)} files to {Path(args.out_dir) / version}")

    if args.no_upload:
        print("Skipping upload (--no-upload).")
        return 0

    upload(make_s3(), version, paths, card)
    print(f"\nDone. datasets/{version} is now the latest dataset.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
