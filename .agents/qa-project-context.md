# QA Project Context

Read by the QA skills in `.claude/skills/` before they ask anything. Values below were
detected from the repository on 2026-10-22 (source in parentheses); anything not
evidenced is marked **Unknown**. Update this file when the stack, CI or goals change.

## Product

- **Name:** Project Hos Erof — AudioUploadWeb (`README.md`, `audio-upload-api/package.json`)
- **What it does:** A community site for collecting hymn audio recordings. Visitors upload
  audio anonymously; signed-in contributors see their submissions; admins moderate them.
- **Type:** Public website + API service.
- **URLs:**
  - Production frontend: `https://app.projecthoserof.org` (`audio-upload-api/DEPLOY.md`)
  - Deployed Worker: `https://audio-upload-api.dev-anthonyriad.workers.dev` (`phe-landing-page/.env.example`)
  - Local: frontend `http://localhost:5173` (Vite), preview `:4173`, API via `wrangler dev` (`wrangler.jsonc`)
  - Staging: **Unknown — none found.**
- **Critical user journeys** (from routes in `audio-upload-api/src/routes/` and `phe-landing-page/src/App.tsx`):
  1. Anonymous upload: Turnstile check → `POST /uploads/initiate` → browser `PUT` to the presigned R2 URL → `POST /uploads/:id/complete`.
  2. Sign in (Supabase magic link or Google OAuth) → `/dashboard` shows the contributor's own recordings → `POST /me/link`.
  3. Admin moderation: `/admin` → `GET /admin/queue` → play audio → `POST /admin/recordings/:id/review`.
  4. Mailing list: `POST /subscribe` → `GET /subscribe/confirm/:token` → one-click unsubscribe `POST /subscribe/unsubscribe/:token` (RFC 8058).
  5. Community stats counter: `GET /stats/community`.
  6. Scheduled jobs: every 15 min janitor (reaps stale `pending` rows, orphaned R2 objects); daily 16:00 UTC moderation digest email (`src/scheduled.ts`).

## Tech Stack

Monorepo-style layout without a workspace tool — two independent npm projects.

### Frontend — `phe-landing-page/`
- React 19.2.0, React Router 7.18.2, TypeScript 5.9.3, Vite 7.2.4, Tailwind 3 (lockfile)
- Supabase JS (auth + direct reads under RLS), `@marsidev/react-turnstile`
- ESLint 9.39.1, flat config (`eslint.config.js`)

### Backend — `audio-upload-api/`
- Hono 4.11.3 on Cloudflare Workers, Wrangler 4.54.0 (lockfile, `wrangler.jsonc`)
- Validation: Zod 3.25.76
- Database: Supabase Postgres; schema/migrations with Drizzle ORM 0.45.2 / drizzle-kit (`src/db/schema.ts`, `drizzle/migrations/`)
- Auth: Supabase access tokens verified server-side (`src/lib/auth.ts`); admin gate in `src/lib/admin.ts`
- Storage: Cloudflare R2 through the S3 API with presigned URLs (`aws4fetch`), not a native binding
- Abuse controls: Cloudflare Turnstile (`src/middleware/turnstile.ts`), Workers rate-limit bindings — uploads 20/min, subscribe 3/min per IP (`wrangler.jsonc`)
- Email: Resend HTTP API (`src/lib/email.ts`); sending is skipped when `RESEND_API_KEY` is unset
- Hosting: Cloudflare Workers (API), frontend host **Unknown**; Terraform for Cloudflare lives on branch `infra/cloudflare-terraform`

## Test Stack

- **E2E:** None selected yet — Playwright recommended (see `playwright-automation`).
- **Unit / component:** None selected yet — Vitest recommended (see `unit-testing`). For the
  Worker, consider `@cloudflare/vitest-pool-workers` so tests run in the Workers runtime.
- **API:** None.
- **Accessibility:** None.
- **Security scanning:** None.
- **Static checks that exist today:** `npm run lint` and `tsc -b` in `phe-landing-page`;
  `npm run check:vocab` in `audio-upload-api`.

## CI/CD

- **Platform:** None — no `.github/workflows/`.
- **Deploy:** manual `wrangler deploy --minify` with a Cloudflare API token (`DEPLOY.md`).
- **What blocks a deploy:** nothing automated.

## Environments

- **Local:** `wrangler dev` uses the real R2 bucket and Supabase project over HTTPS
  (`wrangler.jsonc` comment) — there is no local stand-in for either, so "local" tests can
  touch shared data. Secrets come from `.dev.vars` (git-ignored). Dev Turnstile uses the
  always-pass test secret.
- **Production:** Cloudflare Workers + Supabase + R2 + Resend.
- **Staging:** Unknown — none found. Several skills assume one; create it (separate Supabase
  project and R2 bucket) before running destructive or scanning tests.

## Quality Goals

No agreed targets. Proposed starting point (early-stage, solo team) — **proposals, not agreed**:
- Unit: 60% line coverage on `audio-upload-api/src/lib/` business logic.
- E2E: the top 3 journeys above (upload, sign-in/dashboard, admin review) on Chromium.
- Flake rate < 2%; unit suite < 3 min, E2E < 15 min.
- CI: lint + typecheck + unit on every PR; dependency scan (OSV-Scanner) as a gate.

## Risk Areas

No incident history recorded. Areas below are **proposals** from reading the code; scores unvalidated.

| Area | Risk Level | Business Impact | Notes |
|------|-----------|-----------------|-------|
| Admin authorization (`/admin/*`) | Critical (proposed) | Non-admins could read or moderate recordings | Test every admin route as anonymous, signed-in non-admin, and admin |
| Upload pipeline (initiate → R2 PUT → complete) | Critical (proposed) | Core purpose of the site | Size cap `MAX_UPLOAD_BYTES` 200 MB, presign TTL 900 s, CORS must be set in two places (`DEPLOY.md`) |
| Supabase RLS on contributor data | Critical (proposed) | Contributors could see each other's rows | Frontend reads directly under RLS; service key must never reach the browser |
| Subscribe / unsubscribe tokens | Important (proposed) | Mail sent to addresses people did not confirm; reputation | Tokens must be unguessable; rate limit 3/min |
| Janitor cron | Important (proposed) | Could delete completed uploads if the stale check is wrong | Only `pending` rows past the cutoff should go |
| Email templates / digest | Monitor (proposed) | Wrong or broken mail to contributors | Assert `List-Unsubscribe` headers; stub Resend in tests |

## Team

Unknown headcount; appears to be a solo developer → developers own all tests
(`qa-project-context` ownership table, "Solo / zero QA").

`team_maturity: startup`

## Conventions

- **Branching:** feature branches (`backend/*`, `feature/*`, `infra/*`) → `development` → `main` via PRs.
- **Test file location:** none yet. Proposal: co-located `*.test.ts` for unit tests; `e2e/` in `phe-landing-page` for Playwright.
- **Selectors:** none yet. Proposal: `getByRole` / `getByLabel` first, `data-testid` (kebab-case) only where no accessible name exists.
- **Test data:** `npm run seed` loads reference vocab; no factories yet.

### Safety rules for test and security work (project-specific)

- **Never** point ZAP active scans, rate-limit bursts, SSRF/injection payloads or load tests at
  production (`app.projecthoserof.org`, the `workers.dev` Worker, the prod Supabase project or
  R2 bucket). Use a local or dedicated staging stack only.
- Keep `RESEND_API_KEY` unset in tests and CI so no real email is sent; assert on the request
  that would have been sent instead.
- Never commit `.dev.vars`, `.env`, Supabase service keys or R2 credentials. Test fixtures use
  dedicated test accounts from CI secrets.
- In GitHub Actions, pin third-party actions to a full commit SHA, use `npm ci`, and give
  workflows least-privilege `permissions:`.
