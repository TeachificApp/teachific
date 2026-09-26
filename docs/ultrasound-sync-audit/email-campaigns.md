# Course360™ Ultrasound Sync Audit — Email Campaigns & Marketing Audiences

**Audit area:** Email campaigns and marketing audiences  
**Source inspected:** `/home/ubuntu/ultrasound-app` at `d21f91e6e6b5caf0291637fbd511abfcdeea9d45`  
**Target inspected:** `/home/ubuntu/scorm-host` at `6cc057190bddd97735074bcc535d0b542143f6e7`  
**Audit date:** 2026-09-25  
**Scope:** Read-only comparison of the **current implementations and recent source changes**, not a filename-only sync. No source files were changed. Target initially had only an unrelated modified `todo.md`; this report is the only audit artifact added.

## Executive conclusion

Course360 already has the **safer and more multi-tenant-aware campaign core** in several critical respects: active-organization resolution, campaign/list/sender ownership checks, verified organization learner-domain tracking URLs, organization-theme delivery styling, signed recipient unsubscribe support, and a string-based rich-text sanitizer that is safer for server-side delivery than the source's browser-DOM approach. These must **not** be replaced with source implementations.

The meaningful port opportunity is therefore a **small, adapted UX/workflow port**, not a router or schema transplant:

1. **Port the three active-participant composer handoffs**: course, cohort group, and workshop instance. This is the only recent source feature that is plainly absent end-to-end in Course360.
2. **Expose the audience controls already supported by Course360's server-side schema/resolver**, including engagement segments and A/B selection, while retaining Course360 server ownership validation.
3. **Restore editor workflow parity** where the target server already supports it or can safely do so: campaign hydration/autosave, brand-safe header controls, a secure test-send flow, and unambiguous scheduling time handling.

> **Do not copy source router authorization, URL/domain defaults, branding, template defaults, or source HTML sanitization.** Build on the target's `requireActiveEmailMarketingOrg`, `validateAudienceScopeForOrg`, `getEmailCampaignOrgContext`, `getOrgBaseUrl`, verified-domain behavior, and Course360 email templates.

## Constraints applied to every recommendation

| Required Course360 constraint | Audit application |
|---|---|
| Retain **Course360™** identity | All platform fallback copy, templates, sender fallback, and error/UI copy remain Course360. No source All About Ultrasound/iHeartEcho wording, logos, support addresses, or domains may enter target code. |
| Organization branding and verified custom learner domains win | Delivery/presentation must continue to resolve organization name/logo/theme and `getOrgBaseUrl` first; use Course360 only as fallback. Campaign UI must not introduce arbitrary cross-org `from`, logo, URL, or color overrides. |
| Enforce an active organization server-side; never trust input `orgId` | No new campaign, audience, sender, test-send, handoff, or AI procedure accepts a caller-authoritative org ID. Resolve from `requireActiveEmailMarketingOrg(ctx.user)` and validate every referenced record belongs to that resolved organization. |
| Members cannot switch organizations | Do not add a campaign-org picker or an `orgId` query parameter selector. A handoff URL only carries a resource ID and serves as UI convenience; its organization is re-derived on the server. |
| Tier gates remain enforced | Preserve the existing course-specific feature gating around campaign/marketing routes. Any new test-send, advanced segmentation, A/B, automation, or custom sender capability must call the applicable server-side entitlement helper—not rely on hidden UI. |
| Prices stay decimal dollars; cents only at Stripe | If a campaign promotes a price, read a decimal dollar amount and display `Number(price).toFixed(2)`. Do not import source cent conversion assumptions or add a `/100` in campaign copy/rendering. |
| CME only for a verified organization CME entitlement | Do not add a generic `CME` audience/filter or CME claim to campaign copy. If a future campaign targets CME activity learners, resolve activity ownership and verified CME entitlement server-side. |
| Mock exams are organization-scoped Pro+ | Do not widen quiz/mock-exam audiences. Any future mock-exam filter/promotion must be org-owned and server-side Pro+ gated. |
| No read-aloud/TTS or source branding | Dedicated read-aloud/TTS is out of scope and not ported. Source-project branding is explicitly excluded. |

## Evidence reviewed

### Source implementation files inspected

| Area | Source files reviewed |
|---|---|
| Campaign UI/editor | `client/src/pages/EmailCampaignDashboard.tsx`, `client/src/pages/EmailCampaignEditor.tsx`, `client/src/pages/EmailAdmin.tsx`, `client/src/components/EmailBlockEditor.tsx`, `client/src/pages/EmailListsTab.tsx` |
| Entry points | `client/src/pages/admin/LMSAdmin.tsx`, `client/src/pages/admin/WorkshopsAdmin.tsx` |
| Campaign/audience server | `server/routers/emailCampaignRouter.ts`, `server/lib/emailCampaignAudienceResolver.ts`, `server/lib/emailListHelper.ts`, `server/lib/campaignUnsubscribe.ts`, `server/lib/emailCampaignTracking.ts` |
| Newsletter/delivery | `server/routers/newsletterRouter.ts`, `server/webhooks/sendgrid.ts`, `server/lib/sendgridContacts.ts`, `server/lib/sendgridSuppressions.ts`, `server/_core/email.ts` |
| Shared/schema/tests | `shared/emailCampaignAudience.ts`, `shared/emailCampaignLayout.ts`, `shared/emailRichTextHtml.ts`, `drizzle/schema.ts`, `server/emailCampaignAudience.test.ts`, `server/newsletterAllAudience.test.ts`, `server/emailListHelper.test.ts`, `server/emailCampaignDisplay.test.ts`, `server/emailCampaignTracking.test.ts` |

### Target implementation files inspected

| Area | Target files reviewed |
|---|---|
| Campaign UI/editor | `client/src/pages/marketing/EmailCampaignDashboard.tsx`, `client/src/pages/EmailCampaignEditor.tsx`, `client/src/pages/marketing/EmailListsTab.tsx`, `client/src/components/EmailBlockEditor.tsx`, `client/src/pages/lms/EmailMarketingPage.tsx` |
| Existing entry surfaces/routes | `client/src/pages/admin/LMSAdmin.tsx`, `client/src/pages/admin/WorkshopsAdmin.tsx`, `client/src/App.tsx` |
| Campaign/audience server | `server/routers/emailCampaignRouter.ts`, `server/emailCampaignsRouter.ts`, `server/lib/emailCampaignAudienceResolver.ts`, `server/lib/emailListHelper.ts`, `server/lib/campaignUnsubscribe.ts`, `server/lib/emailCampaignTracking.ts` |
| Newsletter/delivery | `server/routers/newsletterRouter.ts`, `server/routes/emailTrackingRoutes.ts`, `server/sendgrid.ts`, `server/_core/email.ts`, `server/emailTemplates.ts` |
| Shared/schema/tests/auth | `shared/emailCampaignAudience.ts`, `shared/emailCampaignLayout.ts`, `shared/emailRichTextHtml.ts`, `drizzle/schema.ts`, `server/db.ts`, `server/emailCampaignOrgScope.test.ts`, `server/emailCampaignActiveCourseAudience.test.ts`, `server/newsletterCampaignAudience.test.ts`, `server/emailCampaignTrackingDomain.test.ts`, `server/emailCampaignPromotionContext.test.ts`, `server/emailRichTextHtml.test.ts`, `server/emailTemplatesCourse360.test.ts` |

### Recent source commits inspected

| Commit | Date | Relevant verified change | Comparison result |
|---|---:|---|---|
| `2df5400` | 2026-08-29 | Rich-text email preparation, 750px preview alignment, legacy 900px normalization, pasted metadata cleanup | **Already present/stronger in target** through target shared sanitizer/layout; do not replace it. |
| `2e6639e` | 2026-08-30 | Newsletter opt-ins/re-subscriptions reconcile into All Contacts; unsubscribe marks membership unsubscribed; startup reconciliation | **Already present in target**, including organization-scoped behavior. |
| `2ea2621` | 2026-09-01 | Course Settings “Email course participants” handoff to composer with confirmation and selected audience | **Gap**: target has active-course selection but no course handoff or initial audience hydration. |
| `2d1907f` | 2026-09-01 | Correct course handoff to use only **active course access** and active users, not historic enrollments | **Gap coupled to the course handoff**; port this safer definition, not the earlier enrollment behavior. |
| `d82c7b1` | 2026-09-01 | Authorized cohort-group and workshop-instance “Email Active Participants” composer entry points | **Gap**: target has exports but no campaign handoff/initial audience wiring. |

The wider source and target path histories were also reviewed. Target has later Course360-specific commits for organization-scoped campaigns, domain-aware tracking, theme-aware email rendering, source-brand cleanup, AI copy, and audience authorization. That history confirms this should be an **adapted forward port**, not a commit cherry-pick.

## Capability comparison and port decision

**Legend:** **Present** means behavior is available in the target implementation, not merely a similarly named file. **Gap** means a materially useful source behavior is unavailable or only partially wired in target. **Do not port** means target is safer/newer or the source behavior conflicts with Course360 constraints.

| # | Source capability verified | Target status at `6cc0571` | Compatibility decision | Required target files / changes | Organization, tier, and security implications | Recommended order |
|---:|---|---|---|---|---|---:|
| 1 | **Course Settings → Email course participants** opens the full campaign editor with `activeAccessCourseIds: [courseId]` and `userStatus: "active"` (`2ea2621`, corrected in `2d1907f`). | **Gap.** Target editor already renders an Active Course Access selector and target resolver supports it, but no `initialAudienceFilter`, no dashboard query parsing, and no Course Settings button/handoff. | **Port with adaptation.** This is the highest-value safe port. | `client/src/pages/admin/LMSAdmin.tsx`; `client/src/pages/marketing/EmailCampaignDashboard.tsx`; `client/src/pages/EmailCampaignEditor.tsx`; add focused UI/server tests. | URL `courseId` is never authorization. On preview/save/send/schedule, target must retain `requireActiveEmailMarketingOrg` + `validateAudienceScopeForOrg`; resource must belong to resolved active org. Default only active access plus active accounts. Preserve final send confirmation and sender-profile ownership validation. | 1 |
| 2 | **Cohort Group → Email Active Participants** hands the cohort audience to composer (`inCohortGroupIds`) (`d82c7b1`). | **Gap.** Target has cohort participant export controls and a cohort filter in editor/resolver, but no email action or initial-filter route handling. | **Port with adaptation.** | `client/src/pages/admin/LMSAdmin.tsx`; `client/src/pages/marketing/EmailCampaignDashboard.tsx`; `client/src/pages/EmailCampaignEditor.tsx`; `server/routers/emailCampaignRouter.ts` tests. | Query ID may only prefill UI. Server validates cohort is organization-owned; recipient resolver must remain active-user/active-access scoped as defined for cohorts. Do not add org switching. | 1 |
| 3 | **Workshop Instance → Email Active Participants** hands selected instance to composer (`workshopInstanceIds`) (`d82c7b1`). | **Gap.** Target has participant export and resolver support for workshop instances, but no email entry action or initial-filter support. | **Port with adaptation.** | `client/src/pages/admin/WorkshopsAdmin.tsx`; `client/src/pages/marketing/EmailCampaignDashboard.tsx`; `client/src/pages/EmailCampaignEditor.tsx`; relevant router and UI tests. | Same anti-tampering model. Resolve workshop instance through its workshop's server-side org ownership. Keep only active participants; do not include historic/refunded/cancelled records absent an explicitly approved policy. | 1 |
| 4 | Rich **audience-builder UI**: list modes, subscriber interests/roles/status, course/quiz/product/workshop/cohort/form criteria, membership/bundle/webinar dimensions, open/click campaign segments, and A/B configuration. | **Partial gap.** Target `shared/emailCampaignAudience.ts`, resolver, and `validateAudienceScopeForOrg` support many advanced dimensions (including list, active access, workshop instance, engagement IDs and A/B), but target `EmailCampaignEditor` uses a reduced local `AudienceFilter` and exposes only a small subset. No UI for workshop instance or many server-supported dimensions; no source-equivalent A/B builder. | **Port the UI selectively, reusing target contract.** Do **not** copy the source resolver or schema. | Primarily `client/src/pages/EmailCampaignEditor.tsx`; optionally extract a shared `AudienceFilterBuilder`; use existing `server/routers/emailCampaignRouter.ts#getAudienceOptions`; expand focused tests in `server/emailCampaignOrgScope.test.ts`. | Every selected ID—lists, courses, products, campaigns, cohorts, workshops, forms, etc.—must be validated against the server-resolved org for preview, draft, send, and schedule. Engagement campaign IDs require same-org ownership. Tier-gate advanced segmentation/A/B server-side if current plan policy requires it. Preserve no org picker for members. CME/mock exam dimensions are not part of this port. | 2 |
| 5 | Editor can accept an **initial audience filter** from an authenticated handoff, visibly preserving the restricted audience. | **Gap.** Target's `EmailCampaignEditor` has no prop/state initialization path; its dashboard reads no `courseId`, `cohortGroupId`, or `workshopInstanceId`. | **Port.** It is the shared plumbing required for rows 1–3. | `client/src/pages/marketing/EmailCampaignDashboard.tsx`; `client/src/pages/EmailCampaignEditor.tsx`; add a Course360-specific test similar in intent to source `EmailAdminCourseAudience.test.ts`. | Treat query data as untrusted prefill only; Zod parse it client-side defensively and have server authorize all resource IDs. Clear prefill when editing an existing campaign so stored, authorized campaign state wins. | 1 |
| 6 | Campaign editor **hydrates an existing campaign**, restores blocks/audience/header/sender, and **autosaves** draft changes. | **Partial gap.** Target server already exposes organization-scoped `getCampaign`/`saveDraft` and validates campaign ownership, but target editor does not fetch/hydrate a supplied `campaignId` and only offers manual draft save. The `/marketing/email/:campaignId/edit` route also does not pass a campaign ID into the editor. | **Port with target-native implementation.** | `client/src/App.tsx`; `client/src/pages/EmailCampaignEditor.tsx`; perhaps `client/src/pages/marketing/EmailCampaignDashboard.tsx`; router tests for `getCampaign`/`saveDraft`; component tests. | Never rely on route ID alone: server `requireCampaignForOrg` stays authoritative. Debounce autosave; cancel timers on unmount; avoid overwriting an existing campaign before initial load; do not autosend. Tier gate only if drafts/autosave are a gated product capability. | 3 |
| 7 | Optional campaign **header title/subtitle/color/enabled** controls, persisted with draft/send/schedule and used in preview. | **Partial gap.** Target server accepts/persists header fields and delivery has organization context, but target editor has no corresponding controls or hydration. | **Port only as brand-safe presentation controls.** | `client/src/pages/EmailCampaignEditor.tsx`; use existing `server/routers/emailCampaignRouter.ts` inputs and `shared/emailCampaignLayout.ts`; add visual/render tests. | Organization logo/name/theme and verified learner domain remain dominant. Restrict colors to the organization theme palette or validate safe hex values; do not make a user-entered campaign title replace organization identity in the sender/header. Preserve Course360 fallback only when no organization context exists. | 3 |
| 8 | Source supports **test email** from the campaign editor before send. | **Gap.** No comparable target editor mutation/control was found. | **Port only with stricter Course360 controls.** | Add a narrowly scoped target mutation in `server/routers/emailCampaignRouter.ts`; `client/src/pages/EmailCampaignEditor.tsx`; `server/...test.ts`. | Do not copy an arbitrary-recipient send. Require active organization plus authorized admin; send only to the authenticated admin's verified account email or an organization-verified sender/test-recipient allowlist; rate-limit, audit, sanitize HTML, include no tracking/real unsubscribe side effects, and obey plan limits. Sender profile must be owned by org. | 4 |
| 9 | Source shows scheduled time using a shared wall-clock parser/formatter (`PLATFORM_TIMEZONE`) rather than browser-local implicit conversion. | **Partial gap.** Target schedules via `new Date(scheduledAt)` and displays local browser time. This is ambiguous across administrators and can send at the wrong expected time. | **Port the behavior, not source's hard-coded Eastern policy.** | `client/src/pages/EmailCampaignEditor.tsx`; target time utility/config; server schedule validation test. | Resolve a configured **organization timezone** server-side (or a documented Course360 platform fallback). Store an instant in UTC plus selected/derived zone for audit/display. Never accept a client `orgId`/timezone as authority; ensure scheduled-job execution rechecks active org and tier/entitlement before sending. | 4 |
| 10 | Newsletter subscription/re-subscription ensures exactly one active **All Contacts** membership; unsubscribe retains a subscribed-row history as `unsubscribed`; startup reconciliation backfills. (`2e6639e`) | **Present.** Target newsletter router and `emailListHelper` perform organization-scoped `addToAllContacts`, explicit reactivation, unsubscribed status retention, and backfill. | **No port.** Keep target version. | None beyond regression maintenance. | Target scopes All Contacts by `orgId`; preserve consent state and never resurrect an opt-out without explicit opt-in. Public subscription org resolution must remain constrained to valid public organization lookup, not member-controlled org selection. | — |
| 11 | Email lists, subscriber management, lead-capture widgets, templates/drafts, approved sender profiles, explicit final send confirmation, scheduled send/cancel, campaign event analytics, open/click tracking, and list segmentation from engagement. | **Present.** Target has functioning equivalents and in multiple areas richer analytics/organization scope. | **No direct port.** Maintain target implementation. | None. | Keep sender/list/campaign resource checks and current entitlement gates. CSV/export use must continue escaping spreadsheet formulas and excluding disallowed personal/financial fields. | — |
| 12 | Recipient-level campaign unsubscribe, List-Unsubscribe headers, suppression handling, and event logging. | **Present and stronger in target.** Target adds signed campaign-recipient unsubscribe tied to campaign/org/email/list subscriber and organization-scoped event recording. | **Do not port source implementation.** | None. | Preserve signed-token verification, list ownership checks, global suppression policy, and no enumeration leak. New handoff/audience work must still flow through existing send pipeline so footer/header rules apply. | — |
| 13 | Rich-text preparation and campaign layout normalization: strips unsafe editor markup, preserves readable math/iframe fallback, 750px email width, image normalization, legacy 900px cleanup. (`2df5400`) | **Present and stronger in target.** Target's shared `prepareEmailRichTextHtml` is server-safe string transformation (removes event handlers/editor metadata and neutralizes unsafe URL schemes) and target layout normalizes 600/900px content. | **Do not replace sanitizer.** Use target helper consistently for any editor preview changes. | If editor hydration/preview is changed: `client/src/pages/EmailCampaignEditor.tsx`, `client/src/components/EmailBlockEditor.tsx`, and existing shared helpers/tests. | Never port the source DOMParser-only implementation as the delivery authority. Keep target's URL protocol filtering and target theme accent injection. | — |
| 14 | Source generic email AI copy flow/product defaults. | **Present or superseded.** Target has active-org-scoped block/full-email AI generation and validates promoted product ownership (`emailCampaignPromotionContext.test.ts`). | **Do not port source AI flow.** | None. | Keep active-org resolution before model invocation; do not disclose another org's product data. Do not generate unverified CME claims, mock-exam claims, prices converted from cents, source brands, or source domains. | — |
| 15 | Source static newsletter/widget and campaign presentation contain All About Ultrasound/iHeartEcho brand strings, legacy learner URLs, default logo/footer copy, and source sender placeholders. | **Incompatible.** Target has Course360 organization-aware newsletter/widget and email template behavior. | **Explicitly excluded.** | None. | Use organization theme/name/logo and verified learner base URL; Course360™ only as fallback. | — |

## Actual implementation gap list

The target should be planned around these **five** compatible work items, in this order:

1. **Participant-email handoff foundation and entry points** — course + cohort + workshop instance, prefilled as active audiences.
2. **Advanced audience-builder UI** — surface the server-supported filtering, engagement, list-mode, and A/B capabilities without changing resolver authorization.
3. **Campaign edit reliability and brand-safe header controls** — route-param hydration, restore/save state, debounced autosave, constrained header presentation.
4. **Safe preflight and scheduling UX** — test-send with strict recipient controls and organization-timezone schedule semantics.
5. **Regression hardening** — tests below, plus focused typecheck/build and no changes to delivery core unless tests demonstrate a genuine target defect.

## Safe implementation design

### 1. Handoff contract

Use only narrow URL hints, for example:

```text
/marketing/email?courseId=123
/marketing/email?cohortGroupId=456
/marketing/email?workshopInstanceId=789
```

`EmailCampaignDashboard` may parse one positive integer and build one immutable **initial UI filter**:

```ts
{ ...DEFAULT_AUDIENCE_FILTER, activeAccessCourseIds: [courseId], userStatus: "active" }
{ ...DEFAULT_AUDIENCE_FILTER, inCohortGroupIds: [cohortGroupId], userStatus: "active" }
{ ...DEFAULT_AUDIENCE_FILTER, workshopInstanceIds: [workshopInstanceId], userStatus: "active" }
```

This is not a security boundary. Each target procedure—**preview, save draft, send, schedule, and any test-send**—must continue to:

1. resolve `orgId` from `requireActiveEmailMarketingOrg(ctx.user)`;
2. reject inactive/no organization;
3. validate every resource in `AudienceFilterSchema` via `validateAudienceScopeForOrg` (including new or previously omitted dimensions);
4. resolve recipients using only that server-resolved organization;
5. fetch campaign/sender/list records with `requireCampaignForOrg`, `requireSenderProfileForOrg`, and `requireEmailListForOrg` equivalents.

Do not include `orgId` in the handoff URL or pass it through editor props as authority. Do not add a chooser that lets `member` users switch organizations.

### 2. Active participant semantics

- **Course:** Use the source's corrected `activeAccessCourseIds` + `userStatus: "active"`; do not revert to all historical enrollments.
- **Cohort:** Use the existing cohort-group dimension and define active participation in the target resolver; do not include removed/inactive users merely because they appear in a historical group row.
- **Workshop instance:** Use the existing instance dimension and filter out canceled/refunded/inactive participation according to target's canonical enrollment data model.
- **CME:** Do not infer CME eligibility from a course/workshop filter. Any later CME campaign branch must require verified organization CME entitlement on the server.
- **Mock exams:** Do not add mock-exam-specific audiences under this port. If requested later, enforce current organization ownership and Pro+ on the server.

### 3. Audience-builder expansion

The target should consume the **existing target** `AudienceFilterSchema`, `getAudienceOptions`, and resolver rather than recreate source filter types locally. Before exposing each selector, audit that `validateAudienceScopeForOrg` handles that exact ID family. At minimum cover:

- list IDs and list mode;
- courses (including active access), cohorts, workshop instances, products, bundles, membership plans, forms, webinars/other applicable target resources;
- role/status/interests when supported by target data model;
- opened/clicked campaign IDs, constrained to campaigns owned by the active organization;
- A/B variant configuration, deterministic from existing target helper and gated if policy requires it.

Keep the reduced UI only until its replacement is fully authorized; do not make the resolver permissive just to support an editor field.

### 4. Editor reliability, branding, testing, and time

- On an edit route, obtain `campaignId` from the route, call target's organization-scoped `getCampaign`, and hydrate only after successful response. Do not allow the UI to overwrite before that state arrives.
- Debounced autosave writes a draft only; it must not send, schedule, expand recipients, or bypass the explicit confirmation dialog.
- Header controls must use target `getEmailCampaignOrgContext` and `shared/emailCampaignLayout.ts`; theme/organization presentation wins. Keep Course360™ as fallback. No raw source default footer/header.
- Test email is a low-volume preflight artifact, not a marketing send. Prefer the signed-in authorized admin's verified email. Log it; omit normal campaign tracking, marketing analytics, and unsubscribe event side effects.
- Replace browser-local date parsing with an organization-configured timezone (or documented Course360 fallback) converted server-side to UTC. On execution, recheck that org is active and tier/entitlement allows sending.

## Exact regression and acceptance tests

### Participant handoff and audience isolation

1. **Course handoff UI:** render Course Settings; assert an authorized admin sees `Email course participants`, link is `/marketing/email?courseId=<id>`, dashboard initializes `activeAccessCourseIds` and `userStatus: "active"`, and composer retains the final send confirmation.
2. **Cohort handoff UI:** assert authorized cohort manager/admin gets `Email Active Participants`, URL contains only `cohortGroupId`, and editor starts with exactly `inCohortGroupIds: [id]` plus active status.
3. **Workshop handoff UI:** same assertion for `workshopInstanceId` and `workshopInstanceIds`.
4. **Unauthorized/foreign URL tampering:** for an admin of org A, invoke preview, save, send, and schedule with course/cohort/workshop resource from org B. Each must fail `FORBIDDEN`/`NOT_FOUND`; no campaign row, event, queue job, or email send is created.
5. **Inactive organization:** deactivate the resolved org, then attempt each of preview/save/send/schedule/test-send. All reject before recipient resolution or provider call.
6. **Historic vs active course membership:** create active, expired/revoked, historic-completed, and inactive-account learners. Handoff preview returns only active-access active-account recipients.
7. **No org switching:** a normal member cannot select/pass a different org; UI has no org selector and router ignores/rejects injected `orgId`.

### Advanced audience builder

8. For every exposed selector family, submit a source-compatible `AudienceFilterSchema` value referencing a foreign resource and assert target `validateAudienceScopeForOrg` rejects it for **preview, draft, send, schedule**, not just send.
9. List union/intersection/only modes return only subscribers/list rows belonging to active org; an opted-out list member is excluded unless an explicit re-opt-in occurred.
10. Engagement segments (`openedCampaignIds`, `clickedCampaignIds`) reject campaign IDs owned by another org and only resolve same-org events.
11. A/B assignment is deterministic for an email/campaign and does not change across retries; only active-org recipients are bucketed.
12. If a tier gate applies, test each advanced feature from a lower tier and a qualifying tier at the router boundary; hidden UI alone is insufficient.

### Editor, delivery, and presentation

13. **Edit route hydration:** `/marketing/email/:campaignId/edit` passes ID, loads only an active-org campaign, restores blocks/filter/sender/header; a foreign campaign ID does not reveal content.
14. **Autosave:** edits debounce to one draft update; unmount cancels timer; autosave never causes status `sending`/`scheduled` and does not overwrite before initial load.
15. **Header branding:** organization logo/name/theme remains visible/authoritative; an optional campaign heading does not replace it; unverified custom domain is never used. Verify target custom learner domain is used only when verification status permits it.
16. **Rich text:** input with `<script>`, event handler, `javascript:` URLs, iframe, editor metadata, math, 600px/900px wrappers, and images passes target `prepareEmailRichTextHtml` + `normalizeCampaignEmailHtml`; unsafe active content is absent, readable fallback remains, 750px delivery layout is preserved.
17. **Unsubscribe/suppression:** marketing email includes appropriate one-click/list unsubscribe headers and target signed recipient token; unsubscribe records the correct active-org list membership and never touches a same-email subscriber in org B.
18. **Test send:** unauthorized/inactive org blocked; arbitrary external recipient blocked; verified allowed recipient succeeds under rate limit; test sends generate audit log but no marketing campaign recipient/event/unsubscribe side effects.
19. **Timezone:** schedule `09:00` in configured org zone, assert exact stored UTC instant and UI confirmation; execute after a DST boundary test; scheduled executor refuses if the organization is subsequently inactive or entitlement lapses.
20. **Prices:** a decimal `2297.00` product appears as `$2297.00` in AI/promo context and campaign rendering; no `/100` conversion happens outside Stripe session construction.
21. **CME/mock exam negative coverage:** an org without verified CME entitlement cannot use CME-targeted/copy path; mock-exam promotion/audience (if introduced later) rejects lower tier and cross-org IDs.
22. **Brand sweep:** generated campaign HTML/UI excludes `All About Ultrasound`, `iHeartEcho`, source URLs, legacy sender email, and `Teachific`; fallback strings use `Course360™`.

Suggested focused command after implementation:

```bash
cd /home/ubuntu/scorm-host
pnpm vitest run \
  server/emailCampaignOrgScope.test.ts \
  server/emailCampaignActiveCourseAudience.test.ts \
  server/emailCampaignPromotionContext.test.ts \
  server/newsletterCampaignAudience.test.ts \
  server/emailCampaignTrackingDomain.test.ts \
  server/emailRichTextHtml.test.ts
pnpm test
```

Also run the affected client/server build/typecheck command configured in `package.json` before merge.

## Explicit exclusions

| Excluded source item | Why it is excluded |
|---|---|
| All About Ultrasound™, iHeartEcho™, legacy AAU learner URLs, legacy support/sender placeholders, source footer/header/logo copy, and source marketing copy prompts | Violates Course360™ identity and organization-brand/verified-domain precedence. Target has Course360-specific templates and organization-aware presentation. |
| Source server campaign router/auth patterns (`assertAdmin`, source-global defaults, source URL assumptions) | Target's active-organization, resource ownership, signed-unsubscribe, and verified-domain implementation is safer and must remain authority. |
| Source DOMParser rich-text delivery sanitizer | Target's shared string sanitizer is delivery-safe and additionally strips event handlers/unsafe protocols; replacing it would be a security regression. |
| Dedicated text-to-speech/read-aloud functionality | Explicitly prohibited and outside email campaigns/marketing audiences scope. |
| CME-targeting shortcuts or claims from generic course/workshop audiences | CME must be based on verified organization entitlement; generic audience handoff cannot establish it. |
| Mock-exam-specific audience/promotion paths | Mock exams must remain organization-scoped and Pro+; no such feature is needed for this port. |
| Source hard-coded Eastern scheduling policy | Target needs timezone-safe scheduling, but Course360 is multi-tenant; use a server-resolved organization timezone/Course360 fallback rather than a source business timezone. |
| Raw source test-send behavior to arbitrary addresses | A safer Course360 test-send design must restrict recipients, rate-limit, and avoid campaign side effects. |
| Source price conversion assumptions or source product URLs | Course360 prices persist/display in decimal dollars; conversion to cents belongs only at Stripe. Product links must use verified organization learner domains, not source URLs. |

## Required target file set

**Primary implementation files**

- `client/src/pages/admin/LMSAdmin.tsx`
- `client/src/pages/admin/WorkshopsAdmin.tsx`
- `client/src/pages/marketing/EmailCampaignDashboard.tsx`
- `client/src/pages/EmailCampaignEditor.tsx`
- `client/src/App.tsx`
- `server/routers/emailCampaignRouter.ts`
- `shared/emailCampaignAudience.ts` **only if the target schema is genuinely missing a required validated field; current evidence favors no schema transplant**
- Existing shared helpers only as consumers: `shared/emailCampaignLayout.ts`, `shared/emailRichTextHtml.ts`

**Primary regression files to add or extend**

- Add a Course360-specific participant handoff test near `client/src/pages/marketing/EmailCampaignDashboard.tsx` (do not copy source branding test verbatim).
- `server/emailCampaignOrgScope.test.ts`
- `server/emailCampaignActiveCourseAudience.test.ts`
- `server/emailCampaignPromotionContext.test.ts`
- `server/emailCampaignTrackingDomain.test.ts`
- `server/emailRichTextHtml.test.ts`
- `server/newsletterCampaignAudience.test.ts`
- New focused tests for test-send and organization timezone scheduling, if those work items are accepted.

## Final recommendation

Proceed with a **target-native, four-stage port**, beginning with the active course/cohort/workshop participant email handoffs. The target already contains the difficult security and tenancy foundations; preserve them and wire the missing source UX into them. Next expose advanced target-supported audience capabilities, then repair editor hydration/autosave and brand-safe presentation, and only afterward introduce a tightly restricted test-send/timezone improvement.

Do **not** cherry-pick source commits or replace target campaign infrastructure. The correct merge posture is: **adopt source user workflows, retain Course360 server authority and brand/domain behavior, and prove every path with cross-organization, inactive-organization, tier, CME, pricing, and unsubscribe regressions.**


## Implementation update — Sep 26, 2026

**Completed:** the course participant campaign handoff is now implemented as a Course360-native, UI-only prefill. Course administration links to `/marketing/email?courseId=<id>` without placing recipient emails or an organization identifier in the URL. The Campaign Dashboard parses only a positive integer course hint, opens a new composer with `activeAccessCourseIds: [courseId]` and `userStatus: "active"`, and does not reuse that prefill when opening a normal new or existing campaign.

The existing `emailCampaignRouter` remains the enforcement point for every audience preview, draft save, schedule, and send. Its server-resolved active organization and course-ownership validation therefore continue to reject forged or cross-organization course IDs. The next email parity slice remains cohort-group and workshop-instance handoffs, followed by the broader audience-builder UX.


## Implementation update — Sep 26, 2026 (cohort participant handoff)

**Completed:** cohort-group administration now opens the Course360 campaign composer with a narrow `cohortGroupId` route hint. The composer preselects only that group and active accounts; no participant email addresses appear in the URL. The server validates every selected cohort group against the active organization before audience preview, draft save, scheduling, or delivery, and the recipient resolver requires an active linked course enrollment. Both current Course Builder and legacy LMS Administration cohort surfaces use the same helper.


## Implementation update — Sep 26, 2026 (workshop participant handoff)

**Completed:** workshop-instance administration now opens the Campaign composer with a narrow `workshopInstanceId` route hint and an **active-account** audience default. No participant emails are placed in the browser URL. Campaign preview, draft save, scheduling, and send validate both workshop and scheduled-instance ownership against the server-resolved active organization. Workshop and instance audience resolution now excludes cancelled and refunded enrollments by requiring `workshop_enrollments.status = 'active'`.


## Implementation update — Sep 26, 2026 (visible workshop audience)

**Completed:** the Course360 campaign Audience panel now renders a **Workshop Instance** multi-select from the active organization’s server-provided audience options. This makes a workshop handoff’s restricted instance selection visible and editable while retaining the existing server authorization on every preview, draft, schedule, and send operation.
