# Regulation applicability reference

These are working summaries as of the skill's writing. Verify anything time-sensitive.

## Contents
- Ohio Data Protection Act (cyber safe harbor)
- Ohio breach notification
- Ohio consumer privacy legislation
- DMCA §512
- COPPA
- GDPR / UK GDPR
- CCPA / CPRA and other state privacy laws
- HIPAA and the FTC Act
- Biometric and voice data
- ML training data and user contributions

## Ohio Data Protection Act — ORC 1354.01–1354.05 (SB 220, 2018)
- **What it is:** an *affirmative defense* to tort claims under Ohio law (or brought in Ohio courts) alleging that a failure to implement reasonable security controls caused a data breach. It isn't immunity from regulators or contract claims.
- **What qualifies:** a **written** cybersecurity program that contains administrative, technical and physical safeguards for personal (and optionally restricted) information, and that *reasonably conforms* to an industry framework. Listed frameworks include NIST CSF, NIST SP 800-171, NIST SP 800-53/53a, FedRAMP, CIS Critical Security Controls, and the ISO/IEC 27000 family. Entities regulated under HIPAA, GLBA or FISMA can conform to those instead.
- **Scaling:** the program's scale and scope are judged against the entity's size and complexity, its activities, the sensitivity of its data, the cost and availability of tools, and the entity's resources. That makes it realistic even for small projects.
- **Program goals:** protect security and confidentiality, guard against anticipated threats, and guard against unauthorized access that's likely to cause material risk of identity theft or fraud.
- **What a code audit can show:** whether the technical safeguards the framework expects are present. Examples are TLS everywhere, encryption at rest, least-privilege access, authentication on admin and moderation routes, secret management (no secrets in the repo), logging and monitoring, patching and dependency hygiene, backup and recovery, and rate limiting.
- **What it can't show:** the written program itself, risk assessments, training or incident response plans. Always ask whether these exist.
- **Map control gaps to CIS Controls v8 IG1** for small orgs. It's the most achievable baseline.

## Ohio breach notification — ORC 1349.19
- Covers computerized "personal information" of Ohio residents: name plus SSN, driver's license or state ID, or account or card number with its access code, where that data is unencrypted or unredacted.
- Residents must be notified in the most expedient time possible, **no later than 45 days** after discovery, subject to law-enforcement delay.
- More than 1,000 residents affected → also notify consumer reporting agencies.
- Encrypted data is outside the definition unless the key was also compromised. That's a strong argument for encryption at rest.

## Ohio consumer privacy legislation
- Ohio has considered a comprehensive privacy act (the Ohio Personal Privacy Act was introduced in 2021–22 and similar bills have followed). **Check current status** before saying Ohio has or lacks a comprehensive privacy law.

## DMCA safe harbor — 17 U.S.C. §512(c)
A service storing user-uploaded material keeps the safe harbor only if it:
1. **Designates an agent** with the U.S. Copyright Office's online directory (small fee; **renew every 3 years**, or the designation lapses). Publish the agent's contact details on the site.
2. Has **no actual or red-flag knowledge** of infringement, and acts expeditiously on knowledge.
3. Gets **no financial benefit directly attributable** to infringement it has the right and ability to control.
4. **Removes or disables access expeditiously** on a valid notice.
5. Adopts, reasonably implements and informs users of a **repeat-infringer termination policy** (§512(i)).
6. Supports **counter-notices**, restoring material 10–14 business days after a counter-notice unless the claimant files suit (§512(g)).

What code should support: a takedown intake path (form or email), a way to disable a specific upload without deleting the evidence, a record of notices per user to drive the repeat-infringer policy, notification to the uploader, and restoration.

## COPPA — 15 U.S.C. §6501; 16 CFR Part 312
- Applies to operators of services **directed to children under 13**, or with **actual knowledge** that they collect personal information from children under 13.
- Personal information includes name, contact details, persistent identifiers, photos, video, **audio files containing a child's voice**, and geolocation.
- If it applies: verifiable parental consent, direct notice to parents, a COPPA-specific privacy policy section, data minimization and deletion.
- If the service isn't child-directed: a neutral age screen (one that doesn't hint at the "right" answer) plus deleting data on discovering a user is under 13 is the common posture.
- The FTC amended the COPPA Rule in 2025, adding things like a written security program, separate consent for third-party disclosure and retention limits. Check the current compliance dates.

## GDPR / UK GDPR
- **Territorial scope (Art. 3(2)):** offering goods or services to people in the EU/UK (EU-language pages, EUR pricing or EU shipping are indicators), or monitoring their behavior. Mere accessibility from the EU isn't enough.
- If it applies: a lawful basis per purpose, Art. 13 notice contents, data subject rights (access, deletion, portability, objection), DPAs with processors, a transfer mechanism for US processing (EU–US Data Privacy Framework, or SCCs), records of processing, and 72-hour breach notice to the authority. An Art. 27 representative may be needed.
- Voice recordings are personal data. They become special-category **biometric** data only when processed to uniquely identify someone.

## CCPA / CPRA (California) and other state laws
- **CCPA applies to for-profit businesses** doing business in California that meet one of these: annual gross revenue over the threshold (originally $25M, CPI-adjusted, now about $26.6M; verify), buying, selling or sharing personal information of 100,000+ consumers or households, or earning 50% or more of revenue from selling or sharing personal information.
- **Nonprofits are generally exempt** (unless controlled by a covered business).
- Other comprehensive state laws (Virginia, Colorado, Connecticut, Texas, Oregon, and more) mostly use consumer-count thresholds, often 100,000 residents. Texas uses a small-business test instead. Some exempt nonprofits and some don't (Colorado and Oregon cover nonprofits). Assess this when user volume is meaningful.

## HIPAA and the FTC Act
- HIPAA binds only **covered entities** (providers who bill electronically, health plans, clearinghouses) and their **business associates**.
- Non-HIPAA health data still falls under **FTC Act §5** (unfair or deceptive practices) and the **FTC Health Breach Notification Rule** for personal health record apps.
- **FTC §5 applies to everyone:** a privacy policy that misstates the code's behavior is itself a deceptive practice. This is the core reason to align code and policy.

## Biometric and voice data
- **Illinois BIPA:** written release before collecting a "biometric identifier" (voiceprint, face geometry, etc.), a public retention and destruction policy, and a private right of action with statutory damages. Courts have found voiceprint extraction, not the mere recording, triggers it, but the line is litigated.
- **Texas CUBI** and **Washington RCW 19.375** are similar, with Attorney General enforcement.
- Projects that build speaker-identification features, or release voice corpora for ML, should get explicit, informed consent covering that use, and offer withdrawal.

## ML training data and user contributions
- Get a clear **license grant** from contributors for the intended uses, including training models and redistributing the dataset. Name the license (e.g. CC0 like Mozilla Common Voice, or CC BY 4.0) and whether commercial use is allowed.
- Separate **copyright license** (the recording) from **privacy consent** (the person's voice and identity). Both are needed, and a performer may be someone other than the uploader.
- Explain **withdrawal limits** honestly: data can be removed from future releases, but not from copies already distributed or models already trained.
- Collect only the demographic metadata you need, and make it optional.
