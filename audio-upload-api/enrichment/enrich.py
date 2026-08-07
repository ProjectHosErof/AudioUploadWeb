#!/usr/bin/env python3
"""
Phase 2 — offline enrichment / dedup job for Project Hos Erof.

Runs OUTSIDE the Cloudflare Worker (the Worker only signs URLs + writes
metadata). This job picks up recordings whose bytes have landed in R2 but
haven't been technically inspected yet, and:

  1. downloads the object from R2 (S3-compatible API),
  2. computes a BLAKE3 content hash (for dedup),
  3. runs `ffprobe` to fill duration / sample_rate / channels / codec,
  4. dedups against previously-seen hashes,
  5. advances the review lifecycle.

Selection (the guard that prevents reprocessing):

    upload_status = 'completed'      -- object confirmed in R2
    AND sample_rate_hz IS NULL       -- not yet enriched
    AND review_status = 'processing' -- not already rejected

Because a successful run sets sample_rate_hz and a rejection moves
review_status off 'processing', neither success nor failure is ever
re-selected — no infinite retry on corrupt/garbage objects.

Outcomes per row:
  - ffprobe fails (unreadable/corrupt/not audio) -> review_status='rejected',
    error_message set. (The two random-byte smoke-test rows land here.)
  - content_hash already seen on a non-rejected row -> review_status='rejected',
    error_message='duplicate of <id>'. NOTE: dedup linkage is recorded in
    error_message for now; a dedicated `duplicate_of_id` column is a clean
    future migration once the moderation dashboard needs to surface it.
  - unique + readable -> enrichment fields set; review_status stays
    'processing' (awaiting Phase 3 moderation) unless ENRICH_AUTO_APPROVE=1,
    in which case it advances to 'ready'.

Config comes from ../.env (the audio-upload-api DIRECT_URL + R2_* creds).

Usage:
    python enrich.py                 # process one batch (default 50) and exit
    python enrich.py --limit 200
    python enrich.py --loop 30       # poll every 30s until interrupted
    python enrich.py --dry-run       # inspect + probe, write nothing
"""
from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import boto3
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError
from blake3 import blake3
from dotenv import load_dotenv
import psycopg2
import psycopg2.errors
import psycopg2.extras

# --- config -----------------------------------------------------------------

# audio-upload-api/.env sits one directory up from enrichment/.
ENV_PATH = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(ENV_PATH)

DIRECT_URL = os.environ.get("DIRECT_URL")
R2_ACCOUNT_ID = os.environ.get("R2_ACCOUNT_ID")
R2_ACCESS_KEY_ID = os.environ.get("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.environ.get("R2_SECRET_ACCESS_KEY")
R2_BUCKET_NAME = os.environ.get("R2_BUCKET_NAME")
AUTO_APPROVE = os.environ.get("ENRICH_AUTO_APPROVE", "").lower() in ("1", "true", "yes")

DEFAULT_BATCH = 50


def require_config() -> None:
    missing = [
        name
        for name, val in {
            "DIRECT_URL": DIRECT_URL,
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
    # Supabase requires SSL; DIRECT_URL (port 5432) is the direct connection.
    dsn = DIRECT_URL
    if "sslmode=" not in dsn:
        dsn += ("&" if "?" in dsn else "?") + "sslmode=require"
    conn = psycopg2.connect(dsn)
    conn.autocommit = False
    return conn


# --- ffprobe ----------------------------------------------------------------

class ProbeError(Exception):
    pass


def ffprobe(path: str) -> dict:
    """Return {duration_seconds, sample_rate_hz, channels, codec} or raise ProbeError."""
    try:
        out = subprocess.run(
            [
                "ffprobe", "-v", "quiet",
                "-print_format", "json",
                "-show_format", "-show_streams",
                path,
            ],
            capture_output=True,
            text=True,
            timeout=60,
        )
    except FileNotFoundError:
        sys.exit("ffprobe not found on PATH. Install ffmpeg (brew install ffmpeg).")
    except subprocess.TimeoutExpired:
        raise ProbeError("ffprobe timed out")

    if out.returncode != 0:
        raise ProbeError((out.stderr or "ffprobe failed").strip()[:300])

    try:
        data = json.loads(out.stdout)
    except json.JSONDecodeError:
        raise ProbeError("ffprobe returned no parseable output")

    audio = next(
        (s for s in data.get("streams", []) if s.get("codec_type") == "audio"),
        None,
    )
    if audio is None:
        raise ProbeError("no audio stream found")

    # Duration can live on the stream or the container format.
    duration = audio.get("duration") or data.get("format", {}).get("duration")
    sample_rate = audio.get("sample_rate")
    channels = audio.get("channels")
    codec = audio.get("codec_name")

    return {
        "duration_seconds": round(float(duration), 2) if duration else None,
        "sample_rate_hz": int(sample_rate) if sample_rate else None,
        "channels": int(channels) if channels is not None else None,
        "codec": codec,
    }


# --- core -------------------------------------------------------------------

SELECT_BATCH = """
    SELECT id, r2_key, file_size_bytes
    FROM recordings
    WHERE upload_status = 'completed'
      AND sample_rate_hz IS NULL
      AND review_status = 'processing'
    ORDER BY created_at ASC
    LIMIT %s
"""

FIND_DUPLICATE = """
    SELECT id
    FROM recordings
    WHERE content_hash = %s
      AND id <> %s
      AND review_status <> 'rejected'
    ORDER BY created_at ASC
    LIMIT 1
"""


def download_to_temp(s3, r2_key: str) -> str:
    fd, tmp = tempfile.mkstemp(prefix="enrich_", suffix=Path(r2_key).suffix)
    os.close(fd)
    s3.download_file(R2_BUCKET_NAME, r2_key, tmp)
    return tmp


def hash_file(path: str) -> str:
    h = blake3()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def process_row(conn, s3, row: dict, dry_run: bool) -> str:
    """Process a single recording. Returns a short outcome label for logging."""
    rec_id = row["id"]
    r2_key = row["r2_key"]
    tmp = None
    try:
        try:
            tmp = download_to_temp(s3, r2_key)
        except (ClientError, BotoCoreError) as e:
            # Object missing/unreadable in R2 — leave for a later run rather than
            # rejecting (could be eventual-consistency or a transient error).
            print(f"  {rec_id}  SKIP (download failed: {e})")
            return "skipped"

        content_hash = hash_file(tmp)

        try:
            meta = ffprobe(tmp)
        except ProbeError as e:
            reason = f"enrichment failed: {e}"
            if not dry_run:
                _update_rejected(conn, rec_id, content_hash, reason)
            print(f"  {rec_id}  REJECTED (unreadable: {e})")
            return "rejected"

        # Dedup: has a non-rejected row already claimed this hash?
        with conn.cursor() as cur:
            cur.execute(FIND_DUPLICATE, (content_hash, rec_id))
            dup = cur.fetchone()

        if dup:
            original_id = dup[0]
            reason = f"duplicate of {original_id}"
            if not dry_run:
                _update_rejected(conn, rec_id, content_hash, reason, meta=meta)
            print(f"  {rec_id}  REJECTED ({reason})")
            return "duplicate"

        # Unique + readable.
        target_status = "ready" if AUTO_APPROVE else "processing"
        if not dry_run:
            try:
                _update_enriched(conn, rec_id, content_hash, meta, target_status)
            except psycopg2.errors.UniqueViolation:
                # Race backstop: another worker set this hash active between our
                # FIND_DUPLICATE check and the update. The DB's partial unique
                # index (recordings_unique_active_hash) rejected us -> we're the
                # duplicate. Roll back and mark rejected.
                conn.rollback()
                reason = "duplicate (hash already active)"
                _update_rejected(conn, rec_id, content_hash, reason, meta=meta)
                print(f"  {rec_id}  REJECTED ({reason}) [index race]")
                return "duplicate"
        print(
            f"  {rec_id}  OK  "
            f"dur={meta['duration_seconds']}s sr={meta['sample_rate_hz']} "
            f"ch={meta['channels']} codec={meta['codec']} -> {target_status}"
        )
        return "enriched"
    finally:
        if tmp and os.path.exists(tmp):
            os.remove(tmp)


def _update_enriched(conn, rec_id, content_hash, meta, review_status):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE recordings SET
                content_hash = %s,
                duration_seconds = %s,
                sample_rate_hz = %s,
                channels = %s,
                codec = %s,
                review_status = %s,
                error_message = NULL,
                updated_at = now()
            WHERE id = %s
            """,
            (
                content_hash,
                meta["duration_seconds"],
                meta["sample_rate_hz"],
                meta["channels"],
                meta["codec"],
                review_status,
                rec_id,
            ),
        )
    conn.commit()


def _update_rejected(conn, rec_id, content_hash, reason, meta=None):
    # Record technical fields when we have them (dup case), but for an
    # unreadable object leave sample_rate_hz NULL — the review_status='rejected'
    # move is what keeps it out of the next batch.
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE recordings SET
                content_hash = %s,
                duration_seconds = %s,
                sample_rate_hz = %s,
                channels = %s,
                codec = %s,
                review_status = 'rejected',
                error_message = %s,
                updated_at = now()
            WHERE id = %s
            """,
            (
                content_hash,
                (meta or {}).get("duration_seconds"),
                (meta or {}).get("sample_rate_hz"),
                (meta or {}).get("channels"),
                (meta or {}).get("codec"),
                reason,
                rec_id,
            ),
        )
    conn.commit()


def run_once(conn, s3, limit: int, dry_run: bool) -> int:
    with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        cur.execute(SELECT_BATCH, (limit,))
        rows = cur.fetchall()

    if not rows:
        print("No recordings awaiting enrichment.")
        return 0

    print(f"Processing {len(rows)} recording(s){' (dry-run)' if dry_run else ''}...")
    counts: dict[str, int] = {}
    for row in rows:
        outcome = process_row(conn, s3, row, dry_run)
        counts[outcome] = counts.get(outcome, 0) + 1
    summary = ", ".join(f"{k}={v}" for k, v in sorted(counts.items()))
    print(f"Batch complete: {summary}")
    return len(rows)


def main():
    ap = argparse.ArgumentParser(description="Enrich + dedup completed recordings.")
    ap.add_argument("--limit", type=int, default=DEFAULT_BATCH, help="max rows per batch")
    ap.add_argument("--loop", type=int, metavar="SECONDS",
                    help="poll every N seconds instead of exiting after one batch")
    ap.add_argument("--dry-run", action="store_true", help="probe but write nothing")
    args = ap.parse_args()

    require_config()
    s3 = make_s3()
    conn = connect_db()
    print(
        f"Enrichment job: bucket={R2_BUCKET_NAME} auto_approve={AUTO_APPROVE} "
        f"limit={args.limit}"
    )
    try:
        if args.loop:
            print(f"Polling every {args.loop}s (Ctrl-C to stop).")
            while True:
                run_once(conn, s3, args.limit, args.dry_run)
                time.sleep(args.loop)
        else:
            run_once(conn, s3, args.limit, args.dry_run)
    except KeyboardInterrupt:
        print("\nInterrupted.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
