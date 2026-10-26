# Deploy runbook — audio-upload-api

The Worker is deployed with a Cloudflare **API token** in the environment (not
Wrangler's OAuth, which tends to expire):

```bash
export CLOUDFLARE_API_TOKEN=<token>          # Workers Scripts: Edit + Account Settings: Read
export CLOUDFLARE_ACCOUNT_ID=85925e2217223efcd7f07a3c93437ceb
```

R2 is reached over its S3 API (no `r2_buckets` binding), so **Workers R2
Storage: Edit is not needed to deploy the Worker** — but it *is* needed to set
the bucket CORS policy (below).

## ⚠️ Origins live in TWO places — miss either and browser uploads break

A browser upload fails unless the frontend's origin is allowed in **both**:

1. **Worker CORS** — `ALLOWED_ORIGINS` in `wrangler.jsonc` (the API responses).
2. **R2 bucket CORS** — the direct browser `PUT` to `*.r2.cloudflarestorage.com`.
   R2 has **no CORS by default**; this only surfaces in a real browser (curl is
   exempt). Set it with:

   ```bash
   CLOUDFLARE_API_TOKEN=<token w/ R2 Storage: Edit> \
     npm run cors:set -- "https://app.projecthoserof.org,http://localhost:5173"
   ```

   The setter **replaces** the whole policy — pass every origin (prod + dev) in
   one call.

## First-time / environment setup

1. **Secrets** (`wrangler secret bulk` from a JSON file, or `wrangler secret put`):
   `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`,
   `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `TURNSTILE_SECRET`.
2. **Turnstile (prod):** create a widget; put the **secret** in `TURNSTILE_SECRET`
   and the **site key** in the frontend (`VITE_TURNSTILE_SITE_KEY`). Add the prod
   hostname to the widget's allowlist. (Dev uses the always-pass test secret.)
3. **Origins:** add the prod origin to `ALLOWED_ORIGINS` *and* run `cors:set`
   (see above).
4. **Database:** `npm run db:migrate` (applies all migrations, incl. the dedup
   unique index) then `npm run seed` (reference vocabulary).
5. **Admins:** `npm run admins -- add <email> "who they are"`. Nothing reaches
   `ready` without one — see below.

## Moderation admins

Recordings wait at `processing` until an admin promotes them (ADR-008), so an
empty `admins` table means an empty corpus.

```bash
npm run admins                                   # list
npm run admins -- add someone@example.com "role" # invite (they need not have an account yet)
npm run admins -- remove someone@example.com
```

Invitations are keyed on **email**, so you can add someone before they have ever
signed in; their `auth_user_id` resolves on their first request. Grants and
revocations take effect within ~60s (the admin cache TTL). No deploy required.

## Hymn vocabulary (hazzat.com)

Seasons, services, hymns, hymn types, tunes and which hymns belong to which
season + service all come from `data/hazzat/`:

- `Coptic_Hymns_hazzat.xlsx`: the source catalogue (sheet "Hymns by Season").
- `mappings.json`: hand-kept rules (hazzat season/service → app slugs,
  occasions, existing-hymn crosswalk, retired duplicates, needs-review list).
- `legacy-vocab.json`: the vocabulary before the import. Its slugs are
  permanent, since recordings reference them.

To change the vocabulary, edit those files (never `vocab.generated.json`), then:

```bash
pip install -r scripts/requirements.txt   # once
npm run import:hazzat     # writes src/data/ + phe-landing-page/src/vocab.generated.json and data/hazzat/import-report.md
npm run check:vocab       # links, drift between the two copies, mappings
npm run check:placement   # the upload rule, and that form and API agree
npm run seed              # upserts vocabulary, rebuilds the link tables
```

The import fails on any hazzat season or service with no mapping. Review
`import-report.md` before seeding. The seed never deletes a hymn, season or
service; drop one from the form by listing it under `retired` instead.

## ⚠️ `db:migrate` on an IPv4-only network

`DIRECT_URL` (`db.<ref>.supabase.co`) is **IPv6-only**. On a network without
IPv6 the connection is unreachable and `drizzle-kit migrate` reports this by
**exiting 0 having applied nothing** — silent, and easy to mistake for success.

Set **`MIGRATE_URL`** in `.env` to the Supabase **session pooler** (port `5432`,
user `postgres.<project-ref>`); `drizzle.config.ts` prefers it when present. Use
session mode, not the transaction pooler on `6543` — migrations need real
transactions and advisory locks. Always confirm a migration actually landed
rather than trusting the exit code.

## ⚠️ Before restoring or repointing the database: turn the sweep off

Every 15 minutes the janitor deletes R2 audio that has no `recordings` row.
Restore an older dump, or point `SUPABASE_URL` at a different project, and
real recordings look orphaned. Audio can't be recreated, so **first**:

```bash
# wrangler.jsonc → "JANITOR_SWEEP_ENABLED": "false"
npm run deploy
```

Do the database work, reconcile any objects that have no row (keep them, don't
delete them), then set it back to `"true"` and deploy again.

The sweep also refuses on its own (`janitor: sweep aborted` in the logs) when
the DB reports zero completed uploads, or when one run would delete more than
`max(5, 2%)` of the bucket. Treat that log line as an incident: find out why
the DB and the bucket disagree before re-enabling anything.

## Every deploy

```bash
npm run check:vocab       # fail fast on bad vocabulary
npm run check:placement   # upload rule matches the form
npm run deploy            # uploads the Worker; registers the cron trigger + rate-limit binding
```

`wrangler.jsonc` already declares the **cron trigger** (janitor, every 15 min)
and the **rate-limit binding** — both take effect automatically on deploy.

## Deployed resources (current)

- Worker: `https://audio-upload-api.dev-anthonyriad.workers.dev`
- R2 bucket: `audio-uploads-dev`
- Supabase project: `rnlxoisifqsfcralgarb`
- Backup bucket: `phe-corpus-backup` in the **separate backup Cloudflare account** (ADR-012)

## Corpus backup

Nightly at 07:00 UTC, `.github/workflows/corpus-backup.yml` runs
`scripts/backup/run-backup.sh`:

- It **copies** `raw/` and `datasets/` to the backup bucket. It never syncs, so deletions never propagate.
- It dumps the `public` schema as `backup_reader`, encrypted with `age`.
- It checks that every completed recording is in the backup, then writes `runs/<stamp>.json`.

A failed run emails the repo owner. **The repo is public, so its logs are
public:** the scripts print counts only. Keep it that way.

### One-time setup

1. **Backup account.** Create a second Cloudflare account (free), with its own
   login and 2FA. In it:
   ```bash
   npx wrangler r2 bucket create phe-corpus-backup
   npx wrangler r2 bucket lock add phe-corpus-backup audio raw/ --retention-days 30
   npx wrangler r2 bucket lock add phe-corpus-backup datasets datasets/ --retention-days 30
   npx wrangler r2 bucket lock add phe-corpus-backup db db/ --retention-days 7
   npx wrangler r2 bucket lock add phe-corpus-backup runs runs/ --retention-days 7
   npx wrangler r2 bucket lifecycle add phe-corpus-backup db-expiry db/ --expire-days 35
   ```
   You can also do all of this in the dashboard: R2 → bucket → Settings.
2. **R2 API tokens:**
   - **Main account:** **Object Read only**, applied to `audio-uploads-dev` only.
   - **Backup account:** Object Read & Write, applied to `phe-corpus-backup` only.
   - While you're in the main account, confirm the **Worker's** R2 token is also scoped to `audio-uploads-dev` alone.
3. **Encryption key**, on your own machine and never in the repo:
   ```bash
   age-keygen -o phe-backup.key     # prints the public key
   ```
   Store `phe-backup.key` in a password manager, plus a printed copy somewhere
   safe. **Without it, every database dump is unreadable.**
4. **Database role:** run `npm run db:migrate` (applies 0009, and 0008 too if the hymn catalogue isn't migrated yet). Then, in the Supabase SQL editor:
   ```sql
   ALTER ROLE backup_reader PASSWORD '<long random password>';
   ```
   The connection string is the **session pooler** (port 5432) with user
   `backup_reader.<project-ref>`.
5. **GitHub secrets.** Run each of these yourself, so the values never pass through anyone else:
   ```bash
   gh secret set SRC_R2_ACCOUNT_ID         # main account id
   gh secret set SRC_R2_ACCESS_KEY_ID
   gh secret set SRC_R2_SECRET_ACCESS_KEY
   gh secret set DST_R2_ACCOUNT_ID         # backup account id
   gh secret set DST_R2_ACCESS_KEY_ID
   gh secret set DST_R2_SECRET_ACCESS_KEY
   gh secret set BACKUP_DB_URL             # postgresql://backup_reader.<ref>:<pw>@<pooler-host>:5432/postgres
   gh secret set AGE_RECIPIENT             # the age1… public key
   ```
6. **First run:** `gh workflow run corpus-backup.yml`, then check that it's green and
   the bucket has `raw/`, `db/` and `runs/`.

### New tables

Every table in `public` has RLS on, so the backup role reads through a policy.
**A migration that adds a table must also add:**
```sql
CREATE POLICY backup_reader_read_all ON public.<table>
  FOR SELECT TO backup_reader USING (true);
```
Without it, the next backup fails and names the table. That's deliberate: the
alternative is quietly backing it up empty.

### Quarterly restore drill

This touches nothing live. It needs Postgres 17 locally (`brew install postgresql@17`)
and the backup-account token in the environment:
```bash
export PATH="$(brew --prefix postgresql@17)/bin:$PATH"
export DST_R2_ACCOUNT_ID=… DST_R2_ACCESS_KEY_ID=… DST_R2_SECRET_ACCESS_KEY=…
scripts/backup/restore-drill.sh --identity ~/path/to/phe-backup.key
```
It should end with `drill ok — N tables match the run record`. A difference of
1–2 in `recordings` means an upload landed during the dump; rerun it.

## Restore runbook

Supabase Pro's own daily backups (7 days, Dashboard → Database → Backups) are
the first choice for a recent database mistake. Use the corpus backup when
those can't help: older than 7 days, the project is gone, or R2 lost audio.

1. **Switch the sweep off first.** Set `"JANITOR_SWEEP_ENABLED": "false"` in
   `wrangler.jsonc`, run `npm run deploy`, then `wrangler tail` and wait for
   `janitor: sweep disabled`.
2. **Get the dump:** download `db/<stamp>.dump.age` from the backup bucket, then
   `age -d -i phe-backup.key -o db.dump db.dump.age`. Keep `db.dump` off shared disks and delete it afterwards.
3. **Restore in sections**, into the target project (restored or new):
   ```bash
   pg_restore -d "$TARGET_URL" --no-owner --section=pre-data db.dump
   pg_restore -d "$TARGET_URL" --no-owner --section=data db.dump
   ```
   Then clear identity links whose auth user doesn't exist in the target. People
   re-link by verified email on their next sign-in (`/me/link`):
   ```sql
   UPDATE public.contributors SET auth_user_id = NULL
     WHERE auth_user_id IS NOT NULL AND auth_user_id NOT IN (SELECT id FROM auth.users);
   UPDATE public.admins SET auth_user_id = NULL
     WHERE auth_user_id IS NOT NULL AND auth_user_id NOT IN (SELECT id FROM auth.users);
   UPDATE public.recordings SET reviewed_by = NULL
     WHERE reviewed_by IS NOT NULL AND reviewed_by NOT IN (SELECT id FROM auth.users);
   ```
   ```bash
   pg_restore -d "$TARGET_URL" --no-owner --section=post-data db.dump
   ```
   `restore-drill.sh` performs exactly these steps; read it if anything here is unclear.
4. **Reconcile.** List `raw/` objects with no `recordings` row. These are
   uploads newer than the dump. **Keep them**, and record the keys for
   relabelling.
5. **If audio was lost**, copy it back from the backup account (`rclone copy dst:phe-corpus-backup/raw src:audio-uploads-dev/raw`, using a
   main-account token that can write).
6. **Switch the sweep back on** only once reconciliation shows no unexplained
   orphans. Set it back to `"true"` and deploy.
