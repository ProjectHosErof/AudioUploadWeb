# QA skills — source and review notes

These seven skills are vendored from <https://github.com/petrkindlmann/qa-skills>
(MIT, see `QA-SKILLS-LICENSE`) at commit `62434253c2592f27b494609c27f224939c86346d`
(v3.5.0, 2026-10-22). Files are copied unmodified.

| Skill | Why it is here |
|-------|----------------|
| `qa-project-context` | Maintains `.agents/qa-project-context.md`, which every other skill reads first |
| `security-testing` | OWASP Top 10 negative-path tests, dependency/SAST/secret scanning in CI |
| `api-testing` | Tests for the Hono Worker endpoints (`/uploads`, `/subscribe`, `/admin`, `/me`, `/stats`) |
| `unit-testing` | Vitest for `audio-upload-api/src/lib/*` and email templates |
| `playwright-automation` | E2E for the landing page upload flow, login, dashboard and admin |
| `accessibility-testing` | WCAG 2.2 AA checks for the public landing page |
| `ci-cd-integration` | GitHub Actions workflows (the repo has no CI yet) |

## Review before vendoring

All files were scanned for hidden/bidi Unicode, prompt-injection phrasing,
pipe-to-shell installs, encoded payloads and unexpected network endpoints — none
found. The skills are Markdown only (no scripts). They reference mainstream tools
only (Playwright, Vitest/Jest, axe-core, OSV-Scanner, Semgrep, ZAP, TruffleHog).
`security-testing` is defensive: it writes tests that run against *your own*
local or staging app.

Deliberately **not** vendored:

- `email-testing` — built around SMTP capture (Mailpit); this API sends through
  Resend's HTTP API, so it does not apply. It also promotes an unvetted hosted
  inbox service.
- `qa-do` — a skill router that duplicates Claude's own skill selection.
- The repo's `npm run qa` runner CLI and its `AGENTS.md` hook.

## Updating

Do not `npx skills add` or track upstream `main`. To update, diff a new pinned
commit against these folders, re-run the same review, and bump the hash above.
