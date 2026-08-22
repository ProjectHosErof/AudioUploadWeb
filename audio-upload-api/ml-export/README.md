# Training-manifest export (Phase 3 / Pillar D)

Emits the approved corpus as a versioned, immutable dataset under R2
`datasets/`. Like the enrichment job, this runs **outside** the Cloudflare
Worker — it needs pyarrow, which Workers can't host.

## What it produces

Every run writes a new version directory. Nothing is ever overwritten, so a
training run can always be traced back to the exact rows it saw.

```
datasets/<version>/manifest.parquet    columnar, for the training pipeline
datasets/<version>/manifest.csv        same rows, for eyeballing
datasets/<version>/dataset_card.json   provenance + label distributions
datasets/latest.json                   pointer to the newest version
```

Version ids are UTC timestamps (`20260822T174706Z`), so lexical order is
chronological order. `latest.json` is written **last**, so a partially uploaded
export can never be picked up as current.

## Manifest only — on purpose

Per **ADR-011** this exports audio keys, labels, and metadata; it does *not*
compute mel-spectrograms or fingerprints. Those depend on a model architecture
that hasn't been chosen, and baking the wrong window size into thousands of
artifacts is expensive to undo. Feature extraction becomes a second job reading
this manifest once that decision is made — `ml_feature_artifacts` is already in
the schema waiting for it.

## Selection

```sql
review_status = 'ready'
```

That is the human-approved set and nothing else (ADR-008). Rejected rows,
duplicates, and anything still awaiting moderation are excluded — a recording
reaches the corpus only because a moderator put it there.

A moderator *can* approve a row the enrichment job hasn't reached yet. Those
rows have no `duration_seconds`/`codec`; they are still exported, and the card's
`rows_missing_audio_metadata` counts them so a trainer can skip them knowingly.

## No personal data

The manifest carries `contributor_id` (an opaque uuid) and no email addresses of
any kind. A dataset is the artifact most likely to be copied onto a laptop or
handed to a collaborator, so personal data should never be in it to begin with.
`dataset_card.json` asserts this as `contains_personal_data: false`.

## Schema

`MANIFEST_SCHEMA_VERSION` (in `export_manifest.py`) is recorded in every card;
bump it whenever the column set changes so a consumer can assert on what it was
built against. The Arrow schema is **fixed, not inferred** — with an inferred
schema an all-null column in a small export types as `null` and silently changes
type once real data arrives, which breaks anyone reading several versions.

`languages` is pipe-joined (`lang-coptic|lang-english`) so parquet and CSV carry
identical values; a real list type would have no CSV equivalent.

Rows are ordered by `recording_id` so two exports of the same corpus produce the
same row order.

## Prerequisites

- Python 3.9+
- Credentials in `../.env`: `MIGRATE_URL` (or `DIRECT_URL`), `R2_ACCOUNT_ID`,
  `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`

`MIGRATE_URL` is preferred because `db.<ref>.supabase.co` is IPv6-only — see
the note in `DEPLOY.md`.

## Setup

```bash
cd audio-upload-api/ml-export
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Usage

```bash
python export_manifest.py              # export + upload to R2
python export_manifest.py --dry-run    # query + summarise, write nothing
python export_manifest.py --no-upload  # write locally only
python export_manifest.py --out-dir ./out
```

An empty approved set writes nothing at all and exits 0 — that isn't an error,
it just means nothing has been approved yet, and an empty artifact in the
versioned history would be misleading.

## Scheduling

Run by hand for now. The Cron Trigger in `wrangler.jsonc` is Workers-native and
handles the janitor only; this job and the enrichment job both need a real
Python host. Revisit when uploads arrive faster than someone will run this.

## Safety note

The janitor's orphan sweep lists the `raw/` prefix only, so it can never reach
`datasets/`. Keep it that way if the sweep is ever generalised.
