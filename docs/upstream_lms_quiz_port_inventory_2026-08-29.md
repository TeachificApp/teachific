# Upstream LMS and Quiz Port Inventory — 2026-08-29

## Approved Porting Boundaries

Port applicable LMS and Quiz Creator improvements into Teachific while retaining Teachific platform and Quiz Creator identity. Organization-owned surfaces must resolve through the authorized active organization, including content, users, domains, sender identity, and theme values. Do not port read-aloud or text-to-speech capabilities, source-project names, source domains, source data corrections, or production-only data mutations.

## Portable Workstreams Identified

| Workstream | Recent upstream changes reviewed | Teachific status | Required adaptation |
|---|---|---|---|
| Question Bank and Visual Builder synchronization | Canonical bank-backed question content, search/replace, feedback restoration, mock-exam review | Quiz Maker has active-organization CRUD but lacks canonical builder payload and search/replace contracts | Additive schema and procedures must validate quiz and Question Bank ownership against the same active organization before reading or changing linked content. |
| Quiz Creator publication and preview | Publish/unpublish controls, staff preview, visibility protection | Teachific already has publish procedures and active-org access resolution | Audit public learner reads and preview paths so unpublished content is never exposed outside authorized staff context. |
| SCORM, ZIP, and embedded quiz course playback | Section-owned lesson resolution, signed interactive playback, embedded quiz access | Teachific has Course Player, Embedded Quiz Player, SCORM upload, and active-org LMS router | Port only behavior fixes compatible with Teachific’s content model; retain organization-domain learner links and organization authorization. |
| Question Bank folder and bulk workflows | Subfolders, reorder UI, bulk folder/tag operations, imported-content naming | Teachific has Question Bank folders and organization-scoped bank procedures | Audit data model and UI for missing safe bulk actions; every selected record must be validated as belonging to the active organization. |
| Quiz generation safeguards | Optional public web-source validation and source-blind question output | Teachific has AI question generation but no matching dedicated source URL path | Any URL source feature must validate public HTTP(S), reject private/local addresses and credentialed URLs, and prevent source references from appearing in learner questions or feedback. |
| Learner experience reliability | Course/overview lesson alignment, stale bundle handling, enrollment links, dashboard routes | Teachific has distinct LMS page and router layout | Port route and access logic only after verifying Teachific route names and active-organization domain behavior. |
| Availability, schedules, prices, and checkout | Eastern-time enrollment deadlines, waitlist/closed states, dollar-to-Stripe conversion boundaries | Existing Teachific code already stores prices in dollars and has organization-scoped checkout | Validate existing controls against source changes; do not reintroduce cents storage or source-specific branding. |

## Learner Playback Audit — August 29, 2026

The upstream history for `CoursePlayer.tsx` and `EmbeddedQuizPlayer.tsx` from August 25 onward contains one applicable reliability change: passing the parent course slug through embedded quiz metadata and attempt requests so the server can confirm that the learner opened the quiz through its assigned course. Teachific now implements the same learner-course alignment through its registered `quiz` router, with an additional source lesson identifier. The server verifies the quiz-to-lesson link, lesson-to-course link, course slug, and course/quiz organization match before allowing access.

Teachific's implementation also retains its existing multi-tenant policy. Organization staff may preview a linked quiz only after authorization against the quiz's owning organization; regular learners require a published quiz and either a published preview lesson or active, unexpired full enrollment. Free-preview enrollment does not grant access to a protected quiz lesson. Linked quiz and exam lesson types are both supported where present. No read-aloud capability, source-project terms, source URLs, or source branding were ported.

## Build Repair Finding

The failed managed deployment was caused by frozen-install verification of a project-level `pnpm` development dependency, which expected an `@pnpm/exe` platform binary that was absent from the lockfile. The unnecessary dependency has been removed and `pnpm install --frozen-lockfile --prod` now succeeds. The production server bundle succeeds. Full Vite production build continues to exceed the sandbox memory limit, which is separate from the frozen-lockfile error.

## External Deployment Reference

Railway’s official MySQL guidance documents use of `MYSQL_URL` for in-project services and `MYSQL_PUBLIC_URL` for externally reachable database connections. Its Node/Express deployment guidance requires listening on the dynamically supplied `PORT` and recommends a health-check endpoint. Teachific already listens on `0.0.0.0:$PORT` and exposes `/api/health`.

## References

[1] [Railway MySQL documentation](https://docs.railway.com/databases/mysql)

[2] [Railway Node and Express deployment guidance](https://docs.railway.com/guides/deploy-node-express-api-with-auto-scaling-secrets-and-zero-downtime)
