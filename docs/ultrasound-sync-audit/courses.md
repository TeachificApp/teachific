# UltrasoundApp → Course360™ Sync Audit: Courses and Course Delivery

**Audit date:** 2026-09-25  
**Area:** Courses and course delivery only  
**Source inspected:** `/home/ubuntu/ultrasound-app` at `d21f91e6e6b5caf0291637fbd511abfcdeea9d45`  
**Target inspected:** `/home/ubuntu/scorm-host` at `6cc057190bddd97735074bcc535d0b542143f6e7`  
**Target worktree note:** only pre-existing `todo.md` is modified. This audit adds this document only; it makes **no application-source edits**.

## Executive conclusion

Course360 already contains the important earlier delivery port: server-resolved active-organization Course Player access, verified-domain public scoping, protected SCORM/media delivery, enrollment checks, CME-entitlement-gated inline surveys, saved-answer restoration, decimal-price/Stripe-cent handling, and organization-scoped Pro+ mock-exam controls. Those are **not port gaps**.

There are, however, **six material compatible gaps** in the current source area:

1. **Secure course-enrollment exports** — target currently exports order amount and Stripe session ID, lacks spreadsheet-formula neutralization, and does not visibly tenant-filter the export query.
2. **Learner-facing capacity/privacy leakage** — target public workshop routes return capacity, enrolled count, and remaining seats. The source removes those learner-facing data contracts.
3. **Latest inline lesson-quiz persistence resilience** — target has the earlier organization-owned survey migration but lacks the source’s idempotent runtime schema assurance and optional account-field fallback for mixed-version deployments.
4. **Inline lesson-quiz account-field snapshots and accessible question ordering** — source has selected, server-resolved profile snapshots and keyboard/DnD ordering; target’s CME port does not.
5. **Course-level CME survey results/export** — source provides protected individual responses, Eastern-time date filtering, and filtered CSV; target has activity forms and inline survey storage but no equivalent course-settings result surface.
6. **Course delivery lifecycle and administration refinements** — ended public workshop/cohort choices, active-only participant communication handoff, and review-before-apply course/lesson focus regeneration are not presently equivalent.

Treat the first two as **security/privacy fixes**, the schema/persistence work as **reliability hardening**, and the others as feature ports. Do not cherry-pick source commits: the repositories have no merge base and Course360’s organization model, paths, schemas, brand, entitlement model, and learner domain model differ materially.

## Non-negotiable Course360 port contract

Every item below must be implemented against these rules, not copied mechanically:

- Keep **Course360™** as the platform fallback identity. An owning organization’s branding and a **verified** custom learner domain take precedence.
- Derive the organization at the server from authenticated active context or verified public request domain. Treat any client `orgId` as non-authoritative; course, lesson, enrollment, media, CSV, survey, and checkout ownership must all match it.
- Before every new server procedure mutates or returns organization data, require a **currently active organization** server-side. `getOrgIdForUserWithFallback`/membership alone must not become a suspended-organization bypass. Members must not be given an organization-switch input; only the existing authorized admin/platform context may resolve a different organization.
- Keep existing plan gates: CME controls/results only when the owning organization has verified `cmeEnabled`; mock exams remain organization-scoped and **Pro+** only. Never infer either entitlement from client input.
- Persist and render authored prices as decimal dollars. Convert only at Stripe boundaries through the existing Course360 price helper; do not introduce stored cents or `amount / 100` display assumptions.
- Preserve the target’s no-TTS guard. Do not port dedicated read-aloud/browser speech synthesis, source-branded assets/copy, or source-specific clinical/provider integrations.

> **Implementation pattern:** establish a small `requireActiveCourseOrganization(ctx, courseId)`/equivalent internal helper that resolves the active organization, verifies organization status, then verifies course ownership. Reuse it from every new course, export, survey, and report procedure. It must not accept `input.orgId` as authority.

## Evidence reviewed

### Source commits inspected

| Commit(s) | Why inspected |
|---|---|
| `d21f91e`, `e25e2c4` | Latest all-course inline quiz persistence recovery; idempotent schema assurance and optional snapshot retry. |
| `f37a829`, `6ddedbb`, `a90c321`, `ebe7300`, `68b940e`, `700c896`, `3b7cab9`, `15d4f08`, `93f69d3` | CME inline surveys, stored-answer restoration, survey/scoring/conditional rules, reporting, and race-safe progress. |
| `2ea2621`, `2d1907f`, `6a51b1c`, `3f8533f`, `0a1c045`, `ba436ee`, `d82c7b1` | Active participant campaign audiences and privacy-safe participant exports. |
| `bbda7d1` | Date-aware public workshop/cohort lifecycle behavior. |
| `238d994`, `03747f8`, `d6fc20d`, `ee938d9` | Administrator-reviewed lesson/course focus regeneration. |
| `5210e91`, `ff23b1c`, `84c3e2d` | Question-bank folder/import ergonomics, standalone workspace routing, and a source-only settings import fix. |
| `d09b410`, `dcc2d70`, `15a8141`, `81bd3b7`, `1344439`, `ca03226`, `a59a5fd` | Section-owned lessons, protected SCORM/ZIP/embedded quiz delivery, overview/player alignment, and Course Player runtime repair. |
| `f5d5008`, `9b4b06e`, `170c863`, `bbcdfc5` | Explicitly excluded branding/TTS items. |

### Key source files inspected

- `client/src/pages/CoursePlayer.tsx`, `CourseOverview.tsx`, `CourseLanding.tsx`, `pages/admin/LMSAdmin.tsx`
- `client/src/components/LessonQuizBlockEditor.tsx`, `RemainingSeatsBlock.tsx`, `components/admin/FocusRegenerationDialog.tsx`
- `server/routers/lmsRouter.ts`, `lmsCourseBuilderRouter.ts`, `lmsEnrollmentAdminRouter.ts`, `cmeManagementRouter.ts`, `workshopRouter.ts`
- `server/lib/ensureInlineLessonQuizSchema.ts`, `inlineLessonQuizResponses.ts`, `inlineQuizAttemptPersistence.ts`, `cmeLessonProgress.ts`, `lessonFocusRegeneration.ts`, `courseFocusRegenerationBatch.ts`, `courseCheckoutPricing.ts`, `stripePriceUnits.ts`
- `shared/inlineLessonQuizFlow.ts`, `cmeLessonCompletion.ts`, `lessonAccessGating.ts`
- migrations `0052`, `0053`, `0055`, and `0056`, plus focused source tests named in the table below.

### Key target files/tests inspected

- `client/src/pages/lms/CoursePlayer.tsx`, `CourseBuilderPage.tsx`, `CourseLanding.tsx`, `CmeManagementPage.tsx`, `EmailCampaignEditor.tsx`, `components/RemainingSeatsBlock.tsx`
- `server/routers/lmsRouter.ts`, `lmsCourseBuilderRouter.ts`, `lmsEnrollmentAdminRouter.ts`, `lmsCheckoutRouter.ts`, `workshopRouter.ts`, `questionBankRouter.ts`, `cmeActivityFormRouter.ts`
- `server/lib/inlineLessonCmeSurvey.ts`, `mockExamEntitlement.ts`; `shared/inlineLessonQuizFlow.ts`, `cmeLessonCompletion.ts`
- `drizzle/0088_inline_cme_survey_responses.sql`, `drizzle/schema.ts`
- `server/coursePlayerDeliveryScope.test.ts`, `coursePlayerInlineSurveyRestore.test.ts`, `inlineLessonCmeSurvey.test.ts`, `lmsInlineCmeSurveyAuthoring.test.ts`, `lmsInlineCmeSurveyRouter.test.ts`, `emailCampaignActiveCourseAudience.test.ts`, `mockExamEntitlement.test.ts`, `mockExamActiveOrganization.test.ts`, `lmsCourseCheckoutOrgUrl.test.ts`.

## Capability comparison and decisions

Status is based on implementation and test evidence, not file names or commit titles. **Required target files** are intended edit points, not a mandate to copy source files verbatim.

| # / source capability | Target status at `6cc0571` | Compatibility decision | Required target files | Organization, tier, and security implications | Recommended order |
|---|---|---|---|---|---|
| 1. Source active-org Course Player: server derives org, ignores supplied org, checks active enrollment, includes section-owned lessons, and protects SCORM/ZIP/media (`d09b410`, `dcc2d70`, `15a8141`, `81bd3b7`) | **Already present / stronger adaptation.** `coursePlayerDeliveryScope.test.ts` verifies a forged `orgId` is ignored, course query is active-org-scoped, section-owned lessons remain, and interactive media uses protected playback. | **No port. Preserve.** | Existing `server/routers/lmsRouter.ts`, `client/src/pages/lms/CoursePlayer.tsx`, `server/coursePlayerDeliveryScope.test.ts`. | Retain verified request-domain behavior and active enrollment check; add organization-*status* verification when touching these procedures. | Baseline regression only. |
| 2. Source public learner routing/checkout uses trusted organization domain and decimal-dollar Stripe conversion | **Already present.** Target recent history and tests cover verified custom-domain precedence, Course360 subdomain fallback, caller-origin rejection, and decimal dollars to Stripe cents. | **No port. Preserve.** | Existing checkout/public-scope helpers and tests. | Do not restore source platform URLs or cents-as-stored-price behavior. | Baseline regression only. |
| 3. Source non-scoring/required inline CME surveys, visible-only conditional answers, server-side stored-block validation, saved-answer restore (`700c896` through `6ddedbb`) | **Already present, Course360-adapted.** Target `inlineLessonCmeSurvey.ts` parses stored blocks, rejects unknown/hidden responses, applies CME entitlement server-side, and target tests cover restoration and active-org/enrollment ownership. | **No port. Preserve; do not regress.** | Existing `server/lib/inlineLessonCmeSurvey.ts`, `lmsRouter.ts`, `CoursePlayer.tsx`, tests above. | CME behavior is conditional on server-loaded `organizations.cmeEnabled`; retain this exact gate. | Baseline regression only. |
| 4. Source latest inline persistence repair: create reporting tables if absent, add only nullable `account_field_values` if missing, once per process; omit unused snapshot and retry once without it (`e25e2c4`, `d21f91e`) | **Gap — target has only static migration `0088`; no target runtime schema assurance helper or optional snapshot fallback.** A mixed deployment can still block a legitimate required-survey completion if deployment/schema ordering drifts. | **Port, adapted.** Do **not** copy source tables: target attempts require `orgId` and `enrollmentId`. Add idempotent assurance for the target schema or explicitly fail deployment health before learners submit; preserve the one safe retry without optional snapshot. | New target helper such as `server/lib/ensureInlineLessonQuizSchema.ts`; `server/_core/index.ts` (or controlled startup); `server/routers/lmsRouter.ts`; `drizzle/schema.ts`; new additive migration after `0088`; `server/inlineLessonQuizPersistence.test.ts` (new). | Resolve active org, course, lesson, enrollment, and CME entitlement *before* persistence. No raw DB error reaches learner. Never create/delete learner records during assurance. | **2** |
| 5. Source selected inline-quiz account fields: creator chooses read-only profile fields; server resolves values for authenticated learner and snapshots only their attempt (`f37a829`) | **Gap.** Target inline attempts have no selected-field config or `account_field_values`; target CME port intentionally stores only response records. | **Port as a privacy-limited enhancement.** Add only for inline lesson quizzes initially; do not expand unrelated standalone Quiz Creator in this course-area port. | `drizzle/schema.ts`; additive migration; `server/lib/inlineLessonCmeSurvey.ts`; `server/routers/lmsRouter.ts`; `client/src/components/LessonQuizBlockEditor.tsx`; `client/src/pages/lms/CoursePlayer.tsx`; shared typed field helper; report/export consumer. | Only organization admins may configure an allowlisted field set. Server reads authenticated user profile, never submitted values. Snapshot only after validated course/enrollment/org checks. CME reports must expose it only to appropriate active-org admins. | **3** (after #4) |
| 6. Source inline lesson-quiz question drag-and-drop **and keyboard** reordering (`f37a829`) | **Gap.** Target lesson quiz editor has CME controls but no demonstrated inline-question sortable/keyboard flow; DnD seen in Course Builder is not question ordering. | **Port.** Keep persisted question IDs/stable dependency keys so conditional rules and existing attempts do not change meaning. | `client/src/components/LessonQuizBlockEditor.tsx`; possibly a focused helper/type; `server/lmsInlineCmeSurveyAuthoring.test.ts` or new editor test. | Org admin only via existing authoring guard. Validate `showWhen` points to an earlier question after reorder; reject/clear invalid forward dependencies rather than silently changing scoring. | **4** |
| 7. Source CME course-settings Survey Results: protected individual response details, Eastern-time date filtering, CSV limited to filter (`f37a829`) | **Gap / partial data foundation.** Target activity form reporting can associate inline responses, but has no equivalent course-level Survey Results UI/procedure/filter/export. | **Port, adapted to Course360 CME Activity Management.** Do not copy source clinical/CME branding or filename conventions. | `server/routers/cmeActivityFormRouter.ts` (or a new active-org CME report router); `client/src/pages/lms/CmeManagementPage.tsx`; CSV helper; optional account-fields from #5; focused tests. | Require active organization, org-admin authorization, course/activity ownership, and `cmeEnabled` on every query/export. Date boundaries should be explicit **America/New_York** conversions and CSV must formula-escape. | **5** |
| 8. Source CME progress repair: record lesson opens on initial/refresh/auto-advance, unique enrollment+lesson row, idempotent/race-safe completion (`15d4f08`) | **Gap / older non-atomic target pattern.** Target routes select then insert/update progress; audit did not find source-equivalent unique enrollment+lesson protection. | **Port hardening, adapted.** Use a unique key and DB-native upsert/duplicate-safe write rather than source table assumptions. | Additive migration; `drizzle/schema.ts`; `server/routers/lmsRouter.ts`; learner navigation in `client/src/pages/lms/CoursePlayer.tsx`; new concurrency/progress test. | Scope every progress row through the verified enrollment whose `orgId` and course match. Re-run CME required-survey check inside completion transaction. | **3** (with #4/#5 persistence work) |
| 9. Source course participant CSV: active authorized use, approved nonfinancial profile fields; removes payment/session IDs and escapes spreadsheet formulas (`2ea2621`, `2d1907f`) | **Gap — target is older/insecure.** Target `exportEnrollmentsCSV` returns all matching rows, `Order Amount ($)`, `Stripe Session ID`, and uses an escaping function that only quotes values. It also needs explicit active-org/course ownership filtering. | **Port security hardening immediately.** Source output shape is compatible after adapting `progressPct` naming. | `server/routers/lmsEnrollmentAdminRouter.ts`; `client/src/pages/lms/CourseBuilderPage.tsx` export UI; new `server/courseParticipantExport.test.ts`. | Server-resolve active organization and verify the selected course/orders belong to it. Default to active course access and active account status for campaign use; CSV may retain explicit admin filters but never financial/session data. Prefix formula-leading cells (`= + - @`) before CSV quoting. | **1** |
| 10. Source course-settings “Email course participants” handoff defaults to active course access and preserves approved sender/final confirmation (`2ea2621`, `2d1907f`) | **Partial.** Target already has `Active Course Access` filter and active-org ownership validation in Email Campaigns, but no evidenced direct course-settings handoff/default. | **Port the small UX bridge only.** Do not duplicate audience resolution. | `client/src/pages/lms/CourseBuilderPage.tsx`; `client/src/pages/EmailCampaignEditor.tsx`/route bootstrap; retain `server/emailCampaignActiveCourseAudience.test.ts`. | Client may propose a course ID; server must revalidate it for preview, draft, schedule, and send. Resolve recipients as active users with active access at send time; retain explicit confirmation. | **6** |
| 11. Source cohort/workshop participant exports and “Email Active Participants” entry points (`6a51b1c`–`d82c7b1`) | **Gap for delivery-adjacent cohorts/workshops.** Target has broader course CSV and campaign infrastructure, but no evidenced active-only cohort/workshop export or direct composer entry point. | **Port after core course export.** | `server/routers/lmsCohortAdminRouter.ts`, `server/routers/workshopRouter.ts`, relevant Course Builder/admin pages, Email Campaign route bootstrap, focused export tests. | Return accepted/active participants only, nonfinancial approved fields only, formula-safe CSV. Authorize group manager only within their assigned active organization; admin otherwise. | **7** |
| 12. Source hides ended workshop/cohort instances from public enrollment choices while preserving historical records and shows waitlist only when no current alternative exists (`bbda7d1`) | **Gap.** Target `workshopPublicRouter` still returns `allInstances`; current source change filters by `endDate ?? startDate`. | **Port.** Apply the same rule to public course cohort choices, not staff/history reports. | `server/routers/workshopRouter.ts`; `server/routers/lmsRouter.ts` public cohort procedures; public landing components; new lifecycle tests. | Public domain must already be verified/organization-resolved. Do not expose ended offering metadata as enrollment choices; keep records intact. | **7** |
| 13. Source removes learner-facing capacity/enrollment/peer data (`f37a829`) | **Gap — security/privacy.** Target `RemainingSeatsBlock` is benign stub, but public workshop procedures return `capacity`, `enrolled`, `remaining`, `enrolledCount`, and `seatsRemaining`. | **Port security boundary immediately.** Keep capacity checks server-side for checkout; remove numeric values from public response contracts and UI. | `server/routers/workshopRouter.ts`; public cohort availability in `server/routers/lmsRouter.ts`; `client/src/components/RemainingSeatsBlock.tsx`; landing components; `server/learnerEnrollmentPrivacy.test.ts` (new/adapted). | Prevent cross-learner disclosure even on verified domains. Staff/admin operational endpoints may keep counts only after active-org authorization. | **1** |
| 14. Source review-before-apply course/lesson focus regeneration with capped selected lessons and structural preservation (`238d994`, `03747f8`, `d6fc20d`, `ee938d9`) | **Gap.** Target supports AI authoring but no equivalent focus-regeneration preview/apply workflow. | **Compatible enhancement, later.** Implement native Course360 version; never copy source tone, course data, logo, or external clinical assumptions. | New `server/lib/lessonFocusRegeneration.ts` and batch helper; `server/routers/lmsCourseBuilderRouter.ts`; `client/src/pages/lms/CourseBuilderPage.tsx` or a new dialog; targeted tests. | Require active-org ownership and org admin for preview and apply. Validate selected lesson IDs belong to course/org; cap 25; return draft only, never autosave. Preserve IDs/order, media, blocks/styles, links, quiz content, access, pricing, enrollments, progress, certificates, and attempts. Use Course360-safe model/error logging. | **8** |
| 15. Source Question Bank dedicated workspace and grouped SCORM imports into group subfolders (`ff23b1c`, `5210e91`) | **Outside this feature-area scope; partial comparable target exists.** Target already has standalone `/question-bank`, org-scoped folders and grouped tags. It assigns every imported group to one selected folder, so the group-subfolder refinement is absent. | **Defer to a Question Bank/assessment audit.** Do not mix with Courses implementation. | Later: `server/routers/questionBankRouter.ts`, `client/src/pages/QuestionBankPage.tsx`. | Maintain existing `assertAdmin`/active-org folder checks; do not expose Question Bank across organizations. | Deferred. |

## Already present — do not re-port

The following source capabilities were checked and should be retained through regression tests rather than copied again:

1. **Course Player delivery security:** source’s section-owned lesson/SCORM/media sequence is represented in Course360’s `getCoursePlayer` scope tests and protected media iframe path.
2. **Public organization/domain isolation:** Course360’s current history/tests already resolve public catalog/enrollment context from verified custom learner domain first, then Course360 organization subdomain; unknown domains fail closed.
3. **Trusted course checkout URLs and decimal prices:** Course360 already derives checkout returns from owning organization records and sends decimal-dollar prices to Stripe as integer cents only at the boundary.
4. **CME-gated inline survey workflow:** Course360’s `inlineLessonCmeSurvey.ts`, `lmsRouter.ts`, and focused tests already validate stored blocks server-side, retain pending answers, restore latest saved answers, and enforce `cmeEnabled` before required completion.
5. **Mock exams:** Course360 already has active-org tests and a Pro+ entitlement helper. Do not replace it with source’s more general quiz mechanics.
6. **Course landing AI safety:** Course360 already uses a review-only draft rather than immediate saved-page overwrite and has source-brand-free prompt/logging safeguards.
7. **Question Bank route:** a target standalone `/question-bank` route is already present. A source route relocation alone is not a reason to port code.

## Excluded source features and rationale

| Source feature | Decision / rationale |
|---|---|
| Dedicated quiz read-aloud, voice settings, browser speech synthesis, and related voice APIs (`170c863`, `bbcdfc5`) | **Excluded by explicit Course360 no-TTS constraint.** Target regression must continue to reject dedicated read-aloud/TTS paths. Author-uploaded media remains separate. |
| Source platform/product branding, email logo assets, themed CME certificate celebration, source filename conventions, and branded navigation (`f5d5008`, `9b4b06e` and related assets) | **Excluded.** They would violate Course360™ identity and organization-brand/verified-domain precedence. Use owning-org brand data and Course360 fallbacks only. |
| Source-specific CME providers, SDMS/clinical form integrations, external provider credentials, and named course/activity content | **Excluded.** These are source business/clinical integrations, not portable Course360 course-delivery primitives. CME reports may be ported only as generic, entitlement-gated Course360 features. |
| Source Ergonomics external-form placeholder repair | **Excluded.** It is a source course-data/integration fix; not a general Course360 platform capability. |
| Source Question Bank workspace redesign and per-group import folders | **Deferred out of area.** It is assessment/question-bank authoring, not course delivery. The target already has a scoped route; revisit in that dedicated audit. |
| Source all-course runtime schema repair copied verbatim | **Excluded as a literal cherry-pick.** The *behavior* is recommended in row 4, but the source schema lacks target `orgId`/`enrollmentId` ownership fields and therefore cannot be copied safely. |

## Recommended implementation sequence

1. **Security baseline and learner privacy**
   - Introduce/reuse a server-side active-organization status check in the new paths.
   - Harden `exportEnrollmentsCSV` (#9): active-org course ownership, no financial/session identifiers, profile allowlist, formula safety.
   - Remove numerical capacity/enrollment disclosures from public workshop/cohort contracts (#13).
2. **Reliability foundation**
   - Add target-shaped inline attempt schema assurance and safe optional-column retry (#4).
   - Add a unique enrollment+lesson progress constraint and DB-safe upsert/open-progress behavior (#8).
3. **Inline CME delivery enhancements**
   - Add selected account fields and server-owned snapshots (#5), then accessible question reordering with dependency validation (#6).
4. **CME administration**
   - Add entitlement-gated course/activity survey result detail, Eastern-time date ranges, and formula-safe CSV (#7).
5. **Admin communication and lifecycle**
   - Add direct active-course participant handoff (#10), then active cohort/workshop exports/composer actions (#11).
   - Implement ended-offering public lifecycle filtering (#12).
6. **Later authoring enhancement**
   - Implement Course360-native reviewed focus regeneration (#14).
7. **Separate audit/backlog**
   - Question Bank visual workspace/group-folder changes (#15).

## Exact test plan

Add behavior tests before implementation; run the existing Course360 delivery suite after each slice.

| Test ID | Exact scenario / expected assertion | Suggested target test file(s) |
|---|---|---|
| C-01 | Call every new course export/report/survey mutation with forged `orgId`; verify input has no authority, active-org mismatch is forbidden, and an inactive/suspended org is forbidden even with a valid membership. | New/expanded `server/courseActiveOrganization.test.ts`, `coursePlayerDeliveryScope.test.ts` |
| C-02 | A normal member cannot select/switch an organization through request input; only authorized admin context can operate its server-resolved active org. | `server/courseActiveOrganization.test.ts` |
| C-03 | Export a learner whose name/email/credential begins `=`, `+`, `-`, or `@`; CSV cell is prefixed safely. Assert headers/rows contain credentials, specialty, location and omit order amount, order ID, payment/session identifiers, and Stripe session ID. | New `server/courseParticipantExport.test.ts` |
| C-04 | Multi-org admin requests Course A while active in Org B; course export returns forbidden/empty according to contract. Include pending-order branch. | `server/courseParticipantExport.test.ts` |
| C-05 | Public workshop/cohort endpoints never serialize `capacity`, `enrolled`, `remaining`, `enrolledCount`, `seatsRemaining`, or peer list. Staff endpoint remains authorized and capacity checkout still rejects a full offering. | New `server/learnerEnrollmentPrivacy.test.ts`, `server/workshops.test.ts` |
| C-06 | Start with target inline tables absent: first valid submission assures target-shaped tables exactly once and persists an org/enrollment-scoped attempt. Start with tables present but optional snapshot column absent: attempt retries once without snapshot; no raw SQL error is returned; no duplicate attempt. | New `server/inlineLessonQuizPersistence.test.ts` |
| C-07 | Selected account fields are saved only from authenticated profile, not client payload. Cross-org lesson, un-enrolled learner, and CME-disabled required survey are rejected; inactive org rejected. | `server/lmsInlineCmeSurveyRouter.test.ts`, new account-field test |
| C-08 | Reorder an inline question by keyboard and pointer. Existing IDs remain stable; a dependency pointing to a later question is rejected or cleared deliberately; hidden answer neither persists nor scores. | `server/lmsInlineCmeSurveyAuthoring.test.ts`, editor component test, `server/inlineLessonQuizFlow.test.ts` |
| C-09 | Two simultaneous progress/open or completion writes for one enrollment+lesson yield one row and stable completion/progress. Refresh and auto-advance reopen behavior respects required video/quiz/CME survey gates. | New `server/cmeLessonProgress.test.ts`, `coursePlayerInlineSurveyRestore.test.ts` |
| C-10 | CME results endpoint: CME-disabled org is forbidden/not available; wrong org/course fails; Eastern date start/end includes only expected attempts; CSV exactly matches filtered response rows and formula-escapes values. | New `server/cmeSurveyResults.test.ts`, UI test for `CmeManagementPage.tsx` |
| C-11 | Course-settings “email active participants” opens composer with only `activeAccessCourseIds`; preview/save/schedule/send each revalidate selected course ownership and send-time recipient access; final confirmation remains mandatory. | Expand `server/emailCampaignActiveCourseAudience.test.ts`, client route test |
| C-12 | A past-ended workshop/cohort is absent from public enrollment choices but remains in staff/history data. With a current available alternative, waitlist CTA is not chosen; with none, a current waitlist may display. | New `server/publicOfferingLifecycle.test.ts` |
| C-13 | Focus regeneration preview does not write; apply accepts only selected unique in-course IDs (maximum 25) belonging to active org; malformed/incomplete model output is rejected; nontext structure, access, price, attempts, enrollments, and certificates are unchanged. | New `server/courseFocusRegeneration.test.ts`, `lessonFocusRegeneration.test.ts` |
| C-14 | Regression guard: Course Player source and bundle contain no dedicated `readAloud`, `speechSynthesis`, or source-project branding; organization logo/domain still wins over Course360 fallback. | Existing no-TTS/platform-brand tests plus a focused course-player branding test |
| C-15 | Regression guard: mock-exam enablement/delivery remains active-org owned and Pro+ gated after every inline/course change; CME entitlement is independently checked. | Existing `mockExamEntitlement.test.ts`, `mockExamActiveOrganization.test.ts`, `lmsInlineCmeSurveyRouter.test.ts` |

## Validation and rollout notes

- Apply additive migrations before enabling fields/routes that use them. The inline resilience code is specifically for safe mixed-version recovery; it is not a replacement for migration deployment.
- Use targeted Vitest suites first, then the current Course Player, CME, mock-exam, email audience, public-domain, checkout pricing, and no-TTS suites. Bundle the edited server/client files. Do not rely on a full repository TypeScript pass as the sole signal if the known target-wide drift remains.
- Seed/fixture at least two active organizations, one inactive organization, an org admin, a non-switching member, a learner, a CME-enabled org, and a CME-disabled org. Verify custom verified learner domain precedence in every public test.
- Keep target naming, UI theme tokens, Course360 logo fallback, and organization branding hooks. No source assets, source copy, source URLs, source membership concepts, or clinical course records should enter the port.
