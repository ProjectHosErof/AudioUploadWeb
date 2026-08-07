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

## Every deploy

```bash
npm run check:vocab   # fail fast on bad vocabulary
npm run deploy        # uploads the Worker; registers the cron trigger + rate-limit binding
```

`wrangler.jsonc` already declares the **cron trigger** (janitor, every 15 min)
and the **rate-limit binding** — both take effect automatically on deploy.

## Deployed resources (current)

- Worker: `https://audio-upload-api.dev-anthonyriad.workers.dev`
- R2 bucket: `audio-uploads-dev`
- Supabase project: `rnlxoisifqsfcralgarb`
