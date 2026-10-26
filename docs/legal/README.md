# Legal pages: cover note and review checklist

Drafts for hoserof.org. They're written from a scan of the code as of `development` @ 7cd986e, so they describe what the system actually does. **Nothing here is final until the operator decides on the open items below and approves the wording.**

| Document | Draft | Site route |
|---|---|---|
| Privacy Policy | [privacy-policy.md](../../phe-landing-page/src/legal/privacy-policy.md) | `/privacy` |
| Terms of Service, including the Contributor License | [terms-of-service.md](../../phe-landing-page/src/legal/terms-of-service.md) | `/terms` |
| Copyright / DMCA Policy | [dmca-policy.md](../../phe-landing-page/src/legal/dmca-policy.md) | `/dmca` |

## Track
**Non-commercial.** There are no payment SDKs, ads, paid tiers or data sales (`audio-upload-api/package.json`, `phe-landing-page/package.json`). The Terms use a plain-language, no-fee structure with a $100 liability cap.

## Risk Level Matrix

| # | Area | Gap | Risk | Evidence | Fix |
|---|------|-----|------|----------|-----|
| 1 | DMCA safe harbor | No designated agent registered with the U.S. Copyright Office, so no §512(c) safe harbor for user uploads | 🔴 High | Uploads are hosted in R2 (`src/routes/uploads.ts`); no agent on file | Register an agent (copyright.gov/dmca-directory, $6, renew every 3 years). This needs the operator's **legal name**: see open item A |
| 2 | Operator identity | No legal entity; documents can't name an operator without naming the founder personally | 🔴 High | Open item A | Form an Ohio LLC with a commercial registered agent, or a nonprofit corporation |
| 3 | Consent record | Uploads don't record agreement to the Terms or Contributor License, so the project can't show *what* each contributor licensed | 🔴 High | `src/lib/validation.ts:29-41` has no consent field | Required checkbox, plus `accepted_terms_version` stored on `recordings` (migration 0010, planned) |
| 4 | Children | No age gate; contributors include youth; recordings contain voices, which count as "personal information" under COPPA when collected from a child | 🟠 Medium | `phe-landing-page/src/components/UploadForm.tsx` has no age field | Terms require 13+ and allow parents to submit for minors; the checkbox affirms it; delete on discovery of an under-13 contributor |
| 5 | Embedded file metadata | Audio is stored exactly as uploaded; phone recordings can carry device and location tags | 🟠 Medium | Nothing strips metadata (`enrichment/enrich.py` only probes) | Disclosed in the Privacy Policy. **Strip metadata before any recording leaves the project** (follow-up; the dataset is internal-only today, so no current exposure) |
| 6 | Removing a published recording | Admins can review only `processing` recordings; there's no tool to take down a `ready` one (needed for DMCA and withdrawals) | 🟠 Medium | `src/routes/admin.ts`: review is conditioned on `review_status='processing'` | Document a manual SQL takedown procedure in `DEPLOY.md` before launch; add an admin "remove" action as a follow-up |
| 7 | Backup purge | Withdrawn or removed audio stays in the locked backup for its 30-day lock; there's no purge step yet | 🟠 Medium | ADR-012 follow-up | The policy promises removal from backups **within 45 days**; build the purge before that promise is due |
| 8 | Ohio cybersecurity safe harbor | No **written** cybersecurity program (ORC 1354), even though the technical controls largely exist (RLS, rate limits, encrypted backups, least-privilege keys) | 🟠 Medium | No document in the repo | Write a short program mapped to CIS Controls IG1; ADR-012 and DEPLOY.md cover much of it already |
| 9 | Voice and biometrics | Raw recordings, with no voiceprint extraction or speaker identification | 🟢 Low | The model is hymn recognition (`ml-export/`) | The Contributor License explicitly **excludes speaker identification**, which keeps BIPA/CUBI out of play |
| 10 | IP addresses | Used only transiently: rate limiting and Turnstile; not stored in the database | 🟢 Low | `src/middleware/rateLimit.ts:3-44`, `src/middleware/turnstile.ts:17`; Workers logs enabled (`wrangler.jsonc` `observability`) | Disclosed |

## Which laws apply

| Regime | Status | Why |
|---|---|---|
| DMCA §512 | **Applies** | Users upload content we host |
| COPPA | **Applies if we collect from under-13s** | Not child-directed, but youth chant; the 13+ rule plus parental submission keeps collection out of COPPA's scope |
| Ohio breach notice (ORC 1349.19) | **Applies, but narrowly** | We hold no SSNs, driver's license or financial account numbers, so most breaches wouldn't trigger it. Emails alone aren't covered. |
| Ohio Data Protection Act (ORC 1354) | **Optional defense** | Available only with a written program (row 8) |
| GDPR / UK GDPR | **Unknown, likely not** | The site doesn't target the EU (English only, no EU offering), but the Coptic diaspora is global. The policy offers access and deletion to everyone anyway, which costs nothing and covers the edge case |
| CCPA/CPRA | **Doesn't apply** | Non-commercial, far below the thresholds |
| HIPAA | **Doesn't apply** | No health data |
| BIPA / CUBI / WA biometric laws | **Doesn't apply as built** | No voiceprints; the license forbids speaker identification |
| CAN-SPAM | **Applies to the mailing list** | Already met: double opt-in, one-click unsubscribe (RFC 8058); a postal address is still needed in email footers once the entity exists |

## Open items for the operator
- **A. Legal operator.** `[OPERATOR LEGAL NAME]` and `[MAILING ADDRESS]` appear in all three documents. The DMCA agent registration and CAN-SPAM footer also need them. A registered agent's address works.
- **B. Contact addresses.** The drafts use `hello@hoserof.org` (general and privacy) and `copyright@hoserof.org` (DMCA). Both need Cloudflare Email Routing rules.
- **C. Effective date.** Set it on launch day.
- **D. Attorney review.** Recommended before launch, given the children's voices and the perpetual license on recordings. Bring these three drafts, this matrix, and the entity decision.

*Disclaimer: I am an AI, not your attorney. This output constitutes legal information and architectural guidance, not formal legal representation or advice under Ohio law or otherwise.*
