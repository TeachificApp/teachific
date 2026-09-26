# Course360 Safe-Port Audit — Landing Page Builders and Public Landing Delivery

**Audit date:** 2026-09-25  
**Area:** Landing page builders and public landing delivery  
**Source reviewed:** `/home/ubuntu/ultrasound-app` at `d21f91e`  
**Target reviewed:** `/home/ubuntu/scorm-host` at `6cc0571` (only pre-existing working-tree change: `todo.md`)  
**Scope:** Comparison of current behavior and the relevant recent source changes, not filename matching. No source files were modified.

> **Conclusion:** Course360 already contains the bulk of the source-era landing/funnel/editor capability, plus Course360-specific organization branding, verified-domain precedence, entitlement controls, and much of the AI claims-safety work. The safe delta is **four functional fixes**: review-only AI page regeneration; durable explicit-save/template insertion; scalable template list/detail loading; and recursive fresh-ID template cloning. A fifth, lower-priority UX parity change is FAQ-settings ordering. Per-page SEO is a compatible capability gap, but it must be reimplemented against Course360’s organization-scoped public-delivery contract—not copied from the source’s source-brand/domain code.

> **Do not cherry-pick source commits.** The source commits are not in the target object database and include a single-tenant/legacy authorization model, source-project branding, and price/CME semantics that conflict with Course360’s required constraints.

---

## 1. Method and evidence

### Repositories and heads

| Repository | Head reviewed | Working tree observed | Assessment basis |
|---|---:|---|---|
| Ultrasound source | `d21f91e` | Not modified by this audit | Current implementation plus recent landing/page-template commits |
| Course360 target | `6cc0571` | Pre-existing modified `todo.md`; this audit adds only this report | Current implementation, tests, routing, organization/domain helpers, entitlement tests |

### Source files inspected

**Landing builders and editor primitives**

- `client/src/pages/admin/LandingPageBuilder.tsx`
- `client/src/pages/admin/LMSAdmin.tsx`
- `client/src/pages/admin/SitePageBuilder.tsx`
- `client/src/pages/admin/FunnelBuilder.tsx`
- `client/src/pages/admin/FunnelPageEditor.tsx`
- `client/src/components/PublicLandingBlock.tsx`
- `client/src/components/PublishDomainSelect.tsx`
- `client/src/components/FunnelBlocks.tsx`
- `client/src/components/FunnelFlowDiagram.tsx`
- `client/src/hooks/useSubdomain.ts`
- `client/src/lib/pageTemplateInsertion.ts`
- `client/src/lib/sitePageDomain.ts`
- `client/src/lib/funnelTemplates.ts`

**Public delivery, routing, persistence, and source regression coverage**

- `client/src/pages/StandaloneLandingPage.tsx`
- `client/src/pages/PublicFunnelPage.tsx`
- `client/src/App.tsx`
- `server/routers/lmsQuizLandingRouter.ts`
- `server/routers/funnelRouter.ts`
- `server/routers.ts`
- `server/routes/funnelOgMeta.ts`
- `server/_core/vite.ts`
- `server/pageRegenerationDraft.test.ts`
- `server/landingPagePersistence.test.ts`
- `server/pageTemplateListing.test.ts`
- `client/src/lib/pageTemplateInsertion.test.ts`
- `client/src/pages/admin/LandingPageBuilder.faqSettings.test.ts`
- `server/funnel.test.ts`, `server/subdomainRouting.test.ts`, `server/courseLandingCta.test.ts`, `server/courseLandingEmbeddedAvailability.test.ts`, `server/courseLandingPricingRender.test.ts`, and `server/form-domain-funnel-url.test.ts`

### Target files inspected

**Builders and public rendering**

- `client/src/pages/admin/LandingPageBuilder.tsx`
- `client/src/pages/lms/PageBuilderPage.tsx`
- `client/src/pages/lms/OrgLandingPage.tsx`
- `client/src/pages/lms/OrgLandingPageEditor.tsx`
- `client/src/pages/lms/LandingPageBuilder.tsx`
- `client/src/components/PageBuilder.tsx`
- `client/src/components/WysiwygPageBuilder.tsx`
- `client/src/components/PublicLandingBlock.tsx`
- `client/src/components/SubdomainThemeProvider.tsx`
- `client/src/hooks/useSubdomain.ts`
- `client/src/lib/sitePageDomain.ts`

**Public delivery, authorization, branding, pricing, and tests**

- `server/routers/funnelRouter.ts` and its `funnelPublicRouter` / `funnelAdminRouter` exports
- `server/routers.ts`, `server/lmsRouter.ts`, `server/routers/lmsAdminRouter.ts`, and `server/routers/lmsQuizLandingRouter.ts`
- `server/lib/publicOrgRequestScope.ts` and `server/lib/orgUrl.ts`
- `server/_core/staticServer.ts`
- `drizzle/schema.ts`
- `server/funnels.test.ts`, `server/lmsLandingAiSafety.test.ts`, `server/funnelCheckoutOrgUrl.test.ts`, `server/freePreviewOrgUrl.test.ts`, `server/sitePagesCourse360Domain.test.ts`, `server/staticServerDomain.test.ts`, `server/courseBuilderDomainGuidance.test.ts`, `server/mockExamEntitlement.test.ts`, and `server/mockExamActiveOrganization.test.ts`
- `shared/tierLimits.ts`, `shared/subscriptionEntitlement`, and mock-exam entitlement helpers/tests

### Source commits inspected

| Commit | Why inspected | Finding relevant to this area |
|---|---|---|
| `fb85754` (2026-09-01) | AI page regeneration safety | Returns generated blocks as a session-only review draft; blocks autosave/dirty persistence while under review; prohibits fabricated testimonials/reviews/ratings/named students; omits raw provider output from parse-error logging. |
| `0278081` (2026-09-01) | Landing-page persistence repair | Explicit save preserves the exact current blocks, refreshes state/timestamp, verifies readback before success, and keeps dirty state on failure; inserted templates save immediately. |
| `d6ecce4` (2026-09-01) | Template-library loading repair | Lists lightweight metadata first and fetches full template blocks only on Add; avoids returning every large saved JSON document in one response. |
| `9712b84` (2026-09-01) | Production template-list query repair | Selects only fields needed by the picker and avoids an optional legacy thumbnail column that can fail on deployed schema. |
| `4c7766a` (2026-09-01) | Template insertion correctness | Fresh query/retry UI; recursively deep-copies nested layouts and assigns fresh IDs without mutating template/page source. |
| `4221566` (2026-09-01) | FAQ authoring usability | Moves FAQ item editing immediately below heading and before appearance controls. |
| `170c863` (2026-08-29) | Related mixed-scope change | Generic AI error hygiene and synthetic-testimonial removal are relevant; quiz read-aloud/voice work is expressly excluded. |
| `e7a63e2` (2026-08-30) | Mixed-scope builder change | Full-lesson word-count work is lesson authoring, not a landing/public-delivery port. |

---

## 2. Capability comparison and port decisions

### Required compatible updates

| # | Source capability / evidence | Target status now | Compatibility decision | Required target files (minimum) | Organization, tier, and security implications | Recommended order |
|---:|---|---|---|---|---|---|
| 1 | **Review-only AI landing-page regeneration** (`fb85754`): generated blocks are returned as a draft, stored only in browser session, visibly marked for review, and cannot trigger dirty/autosave persistence until an administrator explicitly saves. Prompt/response filtering rejects fabricated testimonials, reviews, ratings, and named students; raw model output is not logged. | **Partial / older.** `server/lmsLandingAiSafety.test.ts` and the 2026-09-17 Course360 landing-generator work already provide strong claims-safety guidance. The current source-derived landing flow does not contain the source’s `landing-page-ai-draft:${courseId}` review-only workflow and explicit autosave block. | **Port as an adapted Course360 enhancement.** Apply the workflow to the active Course360 course/organization landing editor(s), not to a source-admin route. Keep the target’s stronger prohibition on unsupported outcome/credential/guarantee claims. | `server/routers/lmsQuizLandingRouter.ts` or the actual Course360 landing-generation router; `client/src/pages/admin/LandingPageBuilder.tsx`; the caller page (likely `client/src/pages/lms/PageBuilderPage.tsx` and/or course-builder caller); new `server/pageRegenerationDraft.test.ts` adapted for Course360. | Generation must resolve the editor’s active organization server-side; **do not accept `orgId` from the browser as authority**. Require organization admin/server-active-org membership. Draft blocks must never publish or mutate a saved page merely because a generation succeeds. No tier/CME/mock-exam capability is granted by generated content. | **1 — P0 safety prerequisite** |
| 2 | **Exact save/readback and failure-safe template insertion** (`0278081`): explicit save sends current block reference, refreshes saved query/timestamp, verifies serialized block payload readback before reporting success, and retains dirty state after failed save. Template insertion marks dirty and durable-saves the exact appended blocks. | **Gap / older.** Target has manual Save and `isDirty` in `PageBuilderPage`, but no equivalent focused persistence regression and no evidence of exact serialized readback/transactional inserted-template handling in the active Course360 path. | **Port, adapted to organization-owned page records.** Implement a single authoritative save mutation and only report success after its confirmed persisted result. | Active Course360 page persistence router (likely `server/lmsRouter.ts` / `server/routers/lmsAdminRouter.ts`); `client/src/pages/lms/PageBuilderPage.tsx`; `client/src/pages/lms/OrgLandingPageEditor.tsx`; any course landing caller; `server/landingPagePersistence.test.ts`. | Mutation must derive active org from session and verify page/course ownership before write. Never use route/query/input `orgId` as the tenant selector. Do not allow a member to switch organizations via page save. Preserve existing subscription/tier checks rather than treating page save as a license bypass. | **2 — P0/P1 data-integrity** |
| 3 | **Scalable page-template metadata/detail contract** (`d6ecce4`, `9712b84`): list metadata only, fetch blocks on demand, avoid legacy optional `thumbnailUrl`, and avoid one oversized response containing every saved layout. | **Gap / older.** Target has template facilities but lacks the source’s current `listPageTemplates(includeBlocks: false)` plus `getPageTemplate` contract and targeted deployed-schema regression. | **Port, but make templates organization-scoped.** Introduce a paginated/lightweight list followed by an owned-template detail lookup. Do not globally expose template blocks. | Course360 page-template router/module (source analogue: `server/routers/lmsQuizLandingRouter.ts`); schema/migration only if target cannot scope existing templates by org; `client/src/pages/admin/LandingPageBuilder.tsx` and/or `PageBuilderPage.tsx`; `server/pageTemplateListing.test.ts`. | Template list/detail must be restricted to the server-resolved active organization, unless a deliberate platform-template policy exists. If platform templates exist, make them read-only and explicit; never cross-copy private organization templates. No client-selected org fallback. | **3 — P1 performance and tenant isolation** |
| 4 | **Recursive fresh-ID template copy** (`4c7766a`, `client/src/lib/pageTemplateInsertion.ts`): deep-clones data; remaps IDs in `leftBlocks`, `rightBlocks`, `blocks`, `children`, and `columns[].blocks`; preserves source template; prevents nested-ID collisions. | **Gap / older.** Target’s older builder/template behavior is present, but there is no target equivalent of the current source helper and test. Shallow copy is unsafe for nested layouts and can couple future edits or collide keys. | **Port the generic algorithm only.** Use Course360’s block types/ID generator and keep all copied blocks local to the selected organization/page. | New/adapted `client/src/lib/pageTemplateInsertion.ts`; `client/src/lib/pageTemplateInsertion.test.ts`; template insertion sites in `client/src/pages/admin/LandingPageBuilder.tsx`, `client/src/pages/lms/PageBuilderPage.tsx`, and any funnel/site-page editor that shares this library. | Client-side cloning does **not** replace server ownership checks on save. The server must validate block payload limits/shape and target-page ownership. This is a tenant-safety and integrity fix, not a license/tier feature. | **4 — P1 correctness; ship with #3** |
| 5 | **FAQ settings ordering** (`4221566`): FAQ item editor appears directly after Section Headline, before color/style controls; add/remove/reorder semantics unchanged. | **Gap, low risk.** Target’s large builder has FAQ editing but not this current source ordering. | **Port unchanged except theme tokens.** It is a safe authoring UX parity change. | `client/src/pages/admin/LandingPageBuilder.tsx`; targeted test analogous to `client/src/pages/admin/LandingPageBuilder.faqSettings.test.ts`. | No organization, tier, CME, mock-exam, or public-delivery semantics. Preserve Course360/theme variables rather than source colors. | **5 — P3 UX** |
| 6 | **Per-page server-side social/SEO metadata for public landing routes** (`server/routes/funnelOgMeta.ts`, `server/_core/vite.ts`): injected title, description, image, canonical/OG/Twitter metadata for public course/workshop/download/funnel/standalone paths so crawlers need not execute JS. | **Partial.** Target `server/_core/staticServer.ts` injects organization branding metadata and canonical URL based on host; it does not provide the source’s per-public-page metadata lookup/injection. | **Port as a new Course360 implementation, not a copy.** The general crawler/SEO capability is compatible; source route mappings and hard-coded brands are not. | New `server/routes/publicLandingOgMeta.ts` (or extension of `server/_core/staticServer.ts`); `server/_core/staticServer.ts`; public page/funnel routers; `server/publicLandingOgMeta.test.ts`; potentially `client` only for saved SEO authoring fields. | Resolve hostname with `publicOrgRequestScope`; verified custom learner domain wins, otherwise use the owning `*.course360.app` subdomain. Query only the resolved organization and only published/public records. Canonical URL must never use request-controlled `Origin`, source domains, or another org’s custom domain. This is not an entitlement path. | **6 — P2, after public route scope is closed** |

### Already present in Course360 — do not re-port

| Capability | Current target evidence | Decision |
|---|---|---|
| Broad landing/funnel/page-builder foundation: visual blocks, templates, standalone/funnel/public structures, flow builder, manual Save, preview modes, published/draft controls | Target includes `LandingPageBuilder`, `PageBuilder`, `WysiwygPageBuilder`, `PageBuilderPage`, `OrgLandingPage(Editor)`, `FunnelBuilder`, `FunnelPageEditor`, `funnelPublicRouter`, and the June source-port commits. | **Already present.** Only apply the focused deltas above. |
| Organization landing page and public organization branding | `OrgLandingPage`, `OrgLandingPageEditor`, `SubdomainThemeProvider`, `publicOrgRequestScope`, and static-server organization metadata. | **Already present and preferred over source branding.** Retain Course360 identity and the organization’s active theme. |
| Verified custom-domain precedence and tenant-owned checkout URLs | `server/lib/orgUrl.ts`, `server/_core/staticServer.ts`, `server/funnelCheckoutOrgUrl.test.ts`, `server/freePreviewOrgUrl.test.ts`, and `server/staticServerDomain.test.ts`. | **Already present.** Do not replace with source `allaboutultrasound`/`iHeartEcho` or client-origin URL logic. |
| Course360 AI landing claims safety | `server/lmsLandingAiSafety.test.ts` and target commit `ed4e3b0` prohibit fabricated testimonials/endorsements/ratings/named learners/credentials/outcomes/guarantees and avoid raw model-output logging. | **Already present, stronger in scope.** Extend it to draft-only persistence (#1); do not weaken it to source wording. |
| Tier/entitlement and organization enforcement infrastructure | Active-org helpers, `requireOrgAdmin`, `shared/tierLimits.ts`, subscription entitlements, and related target regression suites. | **Already present.** Every new write/list/detail endpoint must consume these existing server-side controls. |
| CME verification and mock-exam controls | CME routers and entitlement tests; `mockExamEntitlement.test.ts` / `mockExamActiveOrganization.test.ts` enforce active Pro/Enterprise organization access. | **Already present.** Landing work must not surface or grant CME/mock-exam functionality without their existing server authority. |
| Funnel checkout cents conversion at Stripe | Target’s checkout code uses stored product values and converts with `Math.round(Number(unitAmount) * 100)` in Stripe `unit_amount`. | **Already present.** Preserve decimal-dollar values in authored/persisted Course360 product data and convert only at Stripe. |

---

## 3. Mandatory safe-port guardrails

These are acceptance conditions for **every** item above. They take precedence over source code behavior.

1. **Course360 identity and organization branding**
   - Keep **Course360™** as the platform identity.
   - Render the active organization’s name, logo, colors, and selected verified learner domain before any platform fallback.
   - Do not import or leave source-project branding such as **All About Ultrasound**, **iHeartEcho**, `allaboutultrasound.com`, `iheartecho`, or legacy source CTA/legal text.

2. **Public hostname and content scope**
   - Resolve public organization context from the request hostname using the target’s `publicOrgRequestScope`/verified-domain mechanism.
   - Only serve an organization’s public/published landing record where its `orgId` matches the resolved organization. A global `slug` lookup is insufficient for tenant-isolated delivery.
   - Existing target `funnelPublicRouter.getBySlug` / `getStandalonePage` uses global slug lookup rather than the public-org request scope. Treat organization-scoped public funnel lookup as a **P0 prerequisite hardening** before extending public landing delivery or SEO. This is a target security hardening requirement, not a request to copy the source’s similarly non-tenant source routing.
   - Do not derive a canonical URL, Stripe return URL, or owner scope from browser-supplied `origin`, `host`, `orgId`, route parameters, or a client-selected organization.

3. **Admin write scope**
   - Page, template, AI regeneration, and SEO write endpoints must resolve active organization from the authenticated session, then verify that the page/template/course/funnel belongs to that organization and that the caller is an organization admin.
   - Members must not be able to select/switch an organization through an input field or reuse an ID from another organization.
   - A platform administrator cross-org capability, if retained, must be explicit, audited, and never become the default path.

4. **Tiers and paid capabilities**
   - Preserve target tier gates on page features, generation, hosted checkout, and premium functionality. A landing block may describe a premium offering but may not activate it or bypass entitlement checks.
   - **CME:** render/publish CME claims or CME purchasing paths only after the server verifies the organization’s active CME entitlement. No source SDMS/clinical entitlement assumption may be copied.
   - **Mock exams:** remain organization-scoped and only active for **Pro+** organizations with eligible active/trialing subscription status. Landing pages must not turn on mock-exam mode or disclose it cross-tenant.

5. **Prices**
   - Persist and display monetary values as decimal dollars (e.g., `299.00`), with explicit decimal validation/formatting.
   - Convert to integer cents **only** when constructing the Stripe request.
   - Do not port source fields/workflows that label `originalPriceCents` as cents (the current source has such a UI); this conflicts with Course360’s dollar-storage/display rule. The target’s current label/value mismatch around `originalPriceCents` should be separately normalized rather than propagated.

6. **Generated content and logs**
   - Generated drafts are untrusted until explicit administrator Save.
   - Retain Course360’s strict no-fabrication rules and do not log raw model/provider content on parser failure.
   - Sanitize or validate rich content/URLs and constrain media access by organization; never use generated block content to construct arbitrary redirect domains.

---

## 4. Recommended implementation plan

### Phase 0 — close public tenant boundaries first

1. Add organization-aware public funnel/standalone lookup: resolve hostname → verified organization → query `funnel.orgId`/parent ownership and published/active state.
2. Add negative tests for same slug in two organizations, unverified custom domain, platform host, hidden/draft page, and direct cross-org ID/slug probing.
3. Preserve existing Course360 org base URL and Stripe return/cancel URL functions. Do not modify payment/currency behavior during this phase.

### Phase 1 — protect authors and page data

4. Adapt `fb85754` draft-only regeneration to Course360’s active landing editor and existing claims-safety prompt rules.
5. Adapt `0278081` save/readback semantics to Course360’s organization-owned page persistence.
6. Ensure Save is the only action that promotes a generated draft or inserted template into durable content.

### Phase 2 — template scalability/correctness

7. Implement organization-scoped metadata list + detail fetch from `d6ecce4`/`9712b84`.
8. Add recursive cloned-block IDs from `4c7766a`; then make insertion use the explicit save behavior from Phase 1.
9. Impose payload-size/block-count limits and validate nested structures server-side before persistence.

### Phase 3 — public discoverability and minor parity

10. Add per-page OG/SEO injection using resolved owning organization and only verified custom learner domain/`*.course360.app` fallbacks.
11. Apply FAQ settings ordering (`4221566`).
12. Perform a branded visual pass on platform host, verified learner custom domain, and organization subdomain; confirm no source branding appears.

---

## 5. Exact test ideas and acceptance cases

### A. Active organization, authorization, and public delivery

1. **Same slug, two organizations:** create two organization-owned funnels/pages with the same slug. Request each from its own verified hostname and assert only the matching organization returns. Request from the other org hostname and assert `NOT_FOUND`/403—not another organization’s blocks, title, analytics, or checkout metadata.
2. **Unverified domain:** set a custom domain to `pending`/`failed`; request it and assert it does not become a public organization scope/canonical URL. Verify platform/org subdomain fallback is used.
3. **Published/hidden guard:** draft, inactive, and hidden funnel/standalone pages must not be delivered by direct slug or SEO route. A published page returns only its visible blocks.
4. **Forged org input:** invoke save/list/get-template/regenerate with a valid page/template ID but a different input `orgId`; assert target derives active org and rejects mismatch. Test a regular member, org admin, org super admin, and platform admin separately.
5. **No organization switch:** give a member memberships in two orgs (if allowed by data model); assert landing page actions do not honor body/query `orgId` or a client-selected organization. Verify only the server-established active org is used.
6. **Public analytics isolation:** a page view increments only the resolved organization’s public page/funnel record. A cross-tenant request cannot increment another organization’s counters.

### B. AI draft review and safety

7. **No automatic persistence:** snapshot saved blocks, run generation, and assert database blocks and `updatedAt` are unchanged. Assert response has draft blocks only.
8. **Session-only draft:** reload/open the editor in a new browser/session after generation without Save and assert saved blocks—not draft blocks—load. In the same session show the amber review warning.
9. **Autosave/dirty suppression:** edit/view a loaded AI draft and advance fake timers; assert no write occurs until explicit Save. After explicit successful Save, assert draft flag clears and normal dirty/autosave policy resumes.
10. **Failed explicit save:** force mutation/readback failure; assert warning remains, editor retains draft/current blocks, and dirty state stays true; no success toast.
11. **Claims filter:** prompt for testimonials, ratings, named learners, clinical outcomes, credentials, or guarantees; assert returned blocks reject/remove those claims. Assert server logs have a stable error code/message and never raw model text.
12. **CME/mock-exam non-escalation:** prompt to advertise CME or mock exams. Assert content cannot activate entitlement flags; public render hides/does not promise these without active server entitlement, with mock exam remaining active-Pro+ only.

### C. Persistence and templates

13. **Exact readback:** save an ordered, nested block payload; verify returned serialized blocks equal the submitted canonical payload and `updatedAt` changes only on success.
14. **Concurrent edit behavior:** issue two saves with a stale `updatedAt`/revision. Assert deterministic optimistic-concurrency conflict (or documented last-write behavior) and no silent loss; add a conflict-resolution UI test if versioning is introduced.
15. **Metadata list payload:** create 100+ large page templates. `listPageTemplates(includeBlocks:false)` returns IDs/names/type/count/timestamps only, no `blocks` JSON and no optional legacy thumbnail selection; detail endpoint returns blocks for one owned template.
16. **Template tenant isolation:** templates belonging to Org A never appear in Org B list/detail, even when `id` is guessed. Platform template policy is separately tested read-only.
17. **Recursive copy:** template contains each supported nesting form—`leftBlocks`, `rightBlocks`, `blocks`, `children`, and `columns[].blocks`. Insert twice and assert every ID is unique across original and both insertions; mutate an inserted nested block and assert source template and other insertion do not change.
18. **Insert-save failure:** force the write failure after cloning; assert no partial persisted blocks, editor remains dirty, template remains unchanged, and retry saves exactly one copy.
19. **Large templates:** verify list is fast/bounded and detail/paste still works without response-size failure.

### D. Prices, checkout, domains, and metadata

20. **Decimal dollars:** author `299.00`, `19.99`, and `0.01`; assert persistence/rendering retains decimal-dollar strings/numbers and formatted display. At the Stripe adapter boundary assert `29900`, `1999`, and `1` cents respectively—nowhere earlier.
21. **No source cents UI:** assert no editor presents a `...Cents` field as a dollar input and no save routine silently interprets a dollar value as cents.
22. **Verified-domain checkout:** public landing checkout on verified domain, org subdomain, and unverified-domain fallback must use the owning organization’s `getOrgBaseUrl` success/cancel URLs. A forged `origin` must not alter them.
23. **SEO/canonical scope:** crawler request to a verified custom domain returns title/description/image/canonical for that organization and page; unverified domain uses org subdomain fallback; another organization’s metadata never appears. Assert no `allaboutultrasound`, `iHeartEcho`, or source CDN/meta values.
24. **Organization theme:** compare page rendered from verified custom learner domain vs Course360 org subdomain; organization logo/theme wins and Course360 platform footer/identity remains correct.

### E. Regression command bundle

At implementation time, run the focused existing suites plus the new tests:

```bash
cd /home/ubuntu/scorm-host
pnpm vitest run \
  server/lmsLandingAiSafety.test.ts \
  server/funnels.test.ts \
  server/funnelCheckoutOrgUrl.test.ts \
  server/freePreviewOrgUrl.test.ts \
  server/staticServerDomain.test.ts \
  server/sitePagesCourse360Domain.test.ts \
  server/mockExamEntitlement.test.ts \
  server/mockExamActiveOrganization.test.ts \
  server/pageRegenerationDraft.test.ts \
  server/landingPagePersistence.test.ts \
  server/pageTemplateListing.test.ts \
  client/src/lib/pageTemplateInsertion.test.ts \
  server/publicLandingOrgScope.test.ts \
  server/publicLandingOgMeta.test.ts
```

Then compile the affected server/client bundles and perform browser checks on: platform host, Course360 organization subdomain, verified custom learner domain, and an unverified custom domain.

---

## 6. Explicit exclusions

| Excluded source feature/change | Why it is excluded |
|---|---|
| **Dedicated text-to-speech/read-aloud/voice picker** portions of `170c863` and related quiz work | Explicit non-negotiable exclusion. It is not landing/public delivery work and must not be brought over incidentally with mixed commits. |
| **All About Ultrasound / iHeartEcho source branding**, source domains, source legal links, brand-specific social metadata, and source platform pixel settings | Explicitly incompatible. Course360™ identity and organization branding/verified custom learner domains take precedence. Source `funnelOgMeta` branding map must not be copied. |
| Source subdomain/cross-domain SSO assumptions and source `useSubdomain` domain allowlists | They reference source brands/domains and do not satisfy Course360’s verified-domain/public-org scope model. Keep/reuse target `publicOrgRequestScope`, `orgUrl`, static-server domain logic instead. |
| Source `SDMS CME Module` landing block/default CME claims | Source-specific clinical/CME semantics do not prove Course360 entitlement. CME must remain enabled/rendered only after server verification of the organization’s active CME entitlement. |
| Source price-cents authoring semantics (`originalPriceCents` labeled as cents) | Conflicts with required Course360 rule: prices persist/display as decimal dollars and convert only at Stripe. Do not port; normalize target’s similarly named UI field separately. |
| Source direct global funnel/standalone public lookup behavior | It is not a safe tenancy model. Course360 must add hostname-resolved organization scope rather than transplant global-slug behavior. |
| Full-lesson 1,500-word generation commit `e7a63e2` | Lesson-content authoring, not landing builder/public delivery. It requires independent educational-content review and is outside this single-area audit. |
| Source generic checkout/promo behavior where it depends on source assumptions | Course360 already has organization-owned checkout URL tests and Stripe rules. Preserve existing decimal pricing, server organization ownership, and tier gates. |

---

## 7. Final recommendation

Proceed with a **small adapted port**, not a bulk source merge:

1. First make public funnel/standalone resolution organization-scoped by request hostname and publication state.
2. Port the source’s AI draft-only regeneration and persistence/readback protections into the current Course360 editor paths.
3. Port template metadata/detail loading and recursive fresh-ID cloning as organization-scoped shared utilities.
4. Add per-page SEO only after the public scope boundary is tested.
5. Apply FAQ ordering last.

This sequence captures the meaningful current source improvements while retaining Course360™ identity, organization-first verified domains, server-authoritative tenant/tier enforcement, decimal-dollar pricing, verified CME entitlement, and organization-scoped Pro+ mock exams.
