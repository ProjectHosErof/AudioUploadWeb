# ADR-012: Corpus backup — a second Cloudflare account, append-only, safe to restore

## Status
Accepted (2026-10-22)

(ADRs 001–011 are the Phase 3 decisions, recorded in the Phase 3 plan. This is the first ADR committed to the repo.)

## Context

The corpus is the project's one irreplaceable asset. Code can be rewritten and a deploy re-run, but a recording a cantor made of a hymn sung once a year can't be recreated.

| Asset | Where it lives | Recreatable? |
|---|---|---|
| Audio, `raw/YYYY/MM/<id>.<ext>` | R2 bucket `audio-uploads-dev` | **No** |
| Recording metadata, moderation decisions, contributor links | Supabase Postgres, schema `public` | **No.** The labels are the training targets. |
| Identities | Supabase `auth.users` / `auth.identities` | Partly. People can sign in again (see Restore). |
| Dataset manifests, `datasets/<version>/` | R2 | Not exactly. A rerun reflects today's DB, not the snapshot a model was trained on. |
| Vocab (hymns, seasons, services, languages) | Seeded from `src/data/options.ts` | Yes, from git. |

**Supabase Pro** keeps 7 days of daily backups, which covers most database mistakes noticed within a week. But those backups live inside the same project, are deleted along with it, and don't cover R2 at all. **The audio itself had no second copy.**

**Threats, most likely first:**
1. **Our own code or operator error:** a bad migration, a wrong `SUPABASE_URL`, a script run against the wrong project.
2. **Credential leak.** The Worker's R2 key can delete, because the janitor needs to.
3. **Account loss:** the main Cloudflare or Supabase account locked, suspended or taken over.

### The janitor turned a database problem into audio loss
`sweepOrphanObjects` deleted every `raw/` object with no `recordings` row. So restoring an older dump, or a Worker pointed at an empty or wrong project, would have deleted real recordings within 15 minutes. **Fixed first and separately in PR #41**, with a kill switch (`JANITOR_SWEEP_ENABLED`), an abort when the DB reports zero completed uploads, and a cap of `max(5, 2%)` deletions per run.

## Decision

### 1. Destination: R2 in a separate Cloudflare account
- A bucket `phe-corpus-backup` in a **second, free Cloudflare account** with its own login and 2FA. Everything stays on one vendor and one toolset, and it's free under 10 GB. Losing, suspending or compromising the main account doesn't reach the backup.
- **Bucket lock rules:**
  - `raw/` and `datasets/`: 30 days. Nothing there can be deleted or overwritten in that window, even with a leaked backup key.
  - `db/` and `runs/`: 7 days.
- **Lifecycle rule:** `db/` expires after **35 days**.

### 2. Audio: copy, never sync
- `rclone copy` of `raw/` and `datasets/`, using `--immutable --checksum`. A deletion in the live bucket never deletes the backup. That's safe because `raw/` objects are write-once (the key is the recording ID).
- `datasets/latest.json` is excluded. It's a pointer the export rewrites; the versioned directories it points into are copied.
- Dataset manifests stay indefinitely. They contain no personal data (ADR-011), and they're the long-term record of which labels each model saw.

### 3. Database: encrypted nightly dump of `public`
- `pg_dump --format=custom --schema=public --enable-row-security`, run as **`backup_reader`** (migration 0008), encrypted with **`age`** before it's written anywhere. Only the public key is in CI. The private key is kept offline (password manager plus a printed copy).
- **Row access is through per-table policies, not `BYPASSRLS`.** Every `public` table has RLS on, and creating a `BYPASSRLS` role needs superuser before PG16. A read-all policy per table is narrower and works on any version.
  - The catch: a new RLS table without a `backup_reader` policy would be backed up empty. **The backup checks for this and fails the run**, naming the table.
- **The `auth` schema isn't dumped.** It belongs to Supabase's auth service, and Supabase's own backups cover it. The restore handles identity links whose auth user is gone (§6).
- **35-day retention.** Deletion requests (withdrawals, unsubscribes, privacy requests) clear out of backups within a period the privacy policy can state. Longer label history lives in the `datasets/` manifests.

### 4. Runner: GitHub Actions, nightly
- `.github/workflows/corpus-backup.yml` at 07:00 UTC, also runnable on demand. The repo is public, so Actions minutes are free.
- It connects through the **Supavisor session pooler** (runners are IPv4-only).
- **The logs are public.** The scripts print counts and bytes only.
- Credentials:

  | Secret | Scope |
  |---|---|
  | Main-account R2 token | **Object Read**, `audio-uploads-dev` only |
  | Backup-account R2 token | Object Read & Write, `phe-corpus-backup` only. R2 has no write-only scope, so the bucket lock stops deletes. |
  | `BACKUP_DB_URL` | `backup_reader`: `SELECT` only, no auth schema |
  | `AGE_RECIPIENT` | A public key |

### 5. Verify every run; drill a restore every quarter
- **`verify.sh`** checks that every `completed` recording older than an hour is in the backup at the size the DB recorded. Any gap fails the workflow, and GitHub emails the owner.
- **`runs/<stamp>.json`** records status, object and byte counts, the dump's sha256 and per-table row counts.
- **`restore-drill.sh`** downloads the newest dump, checks its checksum, decrypts it with the offline key, restores it into a throwaway local Postgres and compares row counts with the run record. Run it quarterly.

### 6. Restore order
The runbook is in `audio-upload-api/DEPLOY.md`:
1. Switch the sweep off.
2. Restore the database (pre-data, then data).
3. Null identity links with no auth user.
4. Run post-data.
5. Reconcile objects that have no row; keep them, don't delete them.
6. If the audio was lost, copy it back from the backup.
7. Re-enable the sweep.

### Alternatives considered

| Option | Why not |
|---|---|
| Backblaze B2 + Object Lock | Fully off-vendor, but adds a second vendor. Rejected to keep everything on Cloudflare. |
| Second bucket in the same Cloudflare account | Free and simplest, but losing the account would take both copies. |
| Supabase Pro backups only | Database only, 7 days, gone if the project is deleted. Kept as a complement. |
| Worker cron doing the copy | Can't run `pg_dump`. It would need a second mechanism for the DB anyway. |
| S3 Glacier Deep Archive | Saves cents, adds IAM, and restores take 12 hours. |

## Consequences

### Positive
- No single account, leaked key or bad deploy can destroy both the corpus and its backup.
- A database restore can no longer delete audio (PR #41).
- Recovery points are about 24 hours for both audio and database; Supabase Pro covers finer database recovery inside 7 days. Recovery time is a few hours.
- Restores are tested on every drill, not assumed. The whole pipeline was exercised locally against a Postgres 17 built from the real migrations, including a full restore.
- A GitHub Actions runner now exists. It's a candidate host for the Python enrichment and export jobs, to be decided in its own ADR.

### Negative
- Losing the `age` private key makes every database dump unreadable.
- Uploads in the last 24 hours before a database loss lose their metadata. The audio survives, but needs relabelling.
- Takedowns and withdrawals reach backed-up audio only after the 30-day lock. The privacy and DMCA policies must say so, and a purge step for backed-up audio is still to be written.
- A Cloudflare-wide failure takes out both copies. That's the accepted cost of staying on one vendor.
- Every new RLS table needs a `backup_reader` policy. It's enforced by the backup failing, which is loud but still a chore.

### Neutral
- Migration 0008 adds the `backup_reader` role; its password is set by hand.
- Bucket names and the Supabase project come from secrets, so the custom-domain move doesn't touch the code.

## Quality attributes
- **Recovery point:** 24 hours. It can drop to about 1 hour by running the audio copy hourly, which is cheap because the copy is incremental.
- **Recovery time:** under 4 hours at the current size.
- **Security:** least-privilege credentials, locked objects, encrypted dumps with an offline key, and no personal data in public logs.
- **Cost:** $0 under 10 GB, then about $15 per TB per month for R2 storage.
