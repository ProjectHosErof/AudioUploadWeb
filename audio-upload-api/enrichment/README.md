# Enrichment / dedup job (Phase 2)

Offline batch job that inspects recordings after their bytes land in R2. It runs
**outside** the Cloudflare Worker — the Worker only signs upload URLs and writes
metadata; this job does the heavy, stateful work (download, probe, hash, dedup).

## What it does

For each recording that is `upload_status='completed'` but not yet enriched
(`sample_rate_hz IS NULL AND review_status='processing'`):

1. Download the object from R2 (S3-compatible API).
2. Compute a **BLAKE3** content hash.
3. Run **`ffprobe`** → `duration_seconds`, `sample_rate_hz`, `channels`, `codec`.
4. **Dedup**: if the hash already belongs to a non-rejected recording, mark this
   one `review_status='rejected'` with `error_message='duplicate of <id>'`.
5. Otherwise write the enrichment fields. Review status stays `processing`
   (awaiting Phase 3 moderation) unless `ENRICH_AUTO_APPROVE=1`, which promotes
   it to `ready`.

Unreadable / non-audio objects (e.g. corrupt uploads) → `review_status='rejected'`
with the ffprobe error. The selection query excludes both enriched and rejected
rows, so nothing is ever reprocessed — no retry loops.

## Prerequisites

- **ffmpeg** (provides `ffprobe`): `brew install ffmpeg`
- Python 3.9+
- Credentials in `../.env` (the audio-upload-api file): `DIRECT_URL`,
  `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`.

## Setup

```bash
cd audio-upload-api/enrichment
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

## Run

```bash
python enrich.py                 # process one batch (default 50) and exit
python enrich.py --limit 200     # bigger batch
python enrich.py --dry-run       # download + probe, write nothing
python enrich.py --loop 30       # poll every 30s (Ctrl-C to stop)
```

Enable auto-approval (no human moderation gate yet):

```bash
ENRICH_AUTO_APPROVE=1 python enrich.py
```

## Notes / future work

- **Dedup linkage** is stored in `error_message` for now. When the moderation
  dashboard needs it, add a `duplicate_of_id uuid` column (migration) and set it
  alongside the rejection.
- **Scaling**: this is intentionally poll-based to start. The upgrade path is R2
  event notifications → Cloudflare Queue → a consumer that calls the same logic,
  eliminating the poll.
- Runs safely concurrently-ish, but it is designed as a single scheduled worker
  (e.g. cron). It commits per row, so a crash mid-batch just leaves the
  unprocessed rows for the next run.
