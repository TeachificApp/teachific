# Course360™ Source Sync Audit — Products, Checkout, and Fulfillment

**Audit date:** 2026-09-25  
**Scope:** Exactly one area — products, checkout, payment hand-off, and fulfillment.  
**Source inspected:** `/home/ubuntu/ultrasound-app` at `d21f91e`  
**Target inspected:** `/home/ubuntu/scorm-host` at `6cc0571` (the only pre-existing working-tree change was `todo.md`; it was not edited).  
**Method:** Implementation and reachable call-path comparison, not file-name comparison. No source or target application code was changed by this audit.

## Executive decision

There are **six priority work items**, including **two Course360 safety preconditions** that must be completed before exposing additional product/checkout surfaces:

1. **P0 — Fix mixed dollar/cents handling in `checkoutPricing.ts`.** Course360 persists product prices as decimal dollars, but `resolveCatalogPriceCents()` currently returns raw decimal values rounded as though they were cents. This makes embedded/funnel checkout validation inconsistent with the required Stripe-only cents conversion.
2. **P0 — Enforce an active organization and prevent member-selected organization switching in the common resolver.** The current resolver checks membership but does not check `organizations.isActive`; its non-admin fall-through also re-enters a helper that honors `userActiveOrg` for a plain member. This conflicts with the stated Course360 constraints.
3. **P1 — Add an organization-scoped public physical-product storefront/page.** The source has a physical product listing and landing page; Course360 has public product data and a strong native physical checkout, but no public `/product/:slug` page even though native Stripe return URLs point there. Its public product queries are currently global by slug/list rather than resolving the organization from a trusted host/path.
4. **P1/P2 — Port date-aware availability enforcement.** Adapt the source’s timezone-safe enrollment-deadline comparison and closed/waitlist checkout guards. Target still has raw `new Date(enrollmentCloseDate) < new Date()` paths and lacks the source’s checkout-level `waitlist`/`enrollment_closed` guards for downloads, bundles, and memberships.
5. **P2 — Port public workshop/cohort lifecycle filtering.** Source commit `bbda7d1` hides completed closed offerings from public enrollment choices while retaining them in administrative/reporting data. Target’s public workshop query only returns `published` instances and still exposes ended instances.
6. **P3 — Deliberately expand order bumps only after reauthorization.** Source supports additional bump targets and preview-to-full upgrades; target currently supports course/download/quiz bumps. The expansion is compatible, but must be rebuilt to use an organization-owned bump record as the authoritative source, preserve tier/CME gates, and never grant access from mutable metadata.

**Do not copy source branding, raw HTML insertion, source domains, `origin`-derived return URLs, source brand-membership grants, or dedicated read-aloud/TTS features.** Course360’s safer organization-aware replacements should be retained.

---

## Non-negotiable Course360 guardrails applied to every decision

| Guardrail | Audit interpretation / required implementation rule |
|---|---|
| **Course360™ identity** | New UI, Stripe coupon names, emails, provider references, and fallback copy use Course360™ or the owning organization only. No All About Ultrasound, iHeartEcho, AAUS, UltrasoundAssist, EchoAssist, or source domains. |
| **Organization branding and verified custom domains win** | Resolve organization from the actual product/funnel/course server-side. Use `getOrgBaseUrl(slug, customDomain, domainVerificationStatus)` so only a **verified** custom domain overrides `{org}.course360.app`. Never form public checkout URLs from browser `origin`. |
| **Active organization is server-enforced** | A product, checkout, coupon, fulfillment action, and associated emails must stop before Stripe/provider calls if the organization is inactive. This is a prerequisite gap in the current common resolver. |
| **Never trust browser `orgId`; members cannot switch organizations** | Derive the organization from the persisted selected product/content and authenticated membership. Do not add an input `orgId`. Fix the resolver fall-through described below; a member’s `user_active_org` record cannot choose an administrative or purchase-management context. |
| **Tier gates remain enforced** | A new storefront is a delivery surface, not a bypass. Product authoring, order-bump creation, funnel configuration, provider configuration, and related premium features must continue through existing organization tier checks. |
| **CME only with verified organization CME entitlement** | Do not import source CME membership/brand fulfillment. Any proposed bump or checkout grant that could create CME access/certificates must re-check the organization’s verified CME entitlement on the server at creation and fulfillment time. |
| **Mock exams are organization-scoped Pro+** | No product/checkout/fulfillment work may expose a mock exam, its results, or its review UI unless the persisted quiz belongs to the resolved organization and the existing Pro/Enterprise entitlement check passes. |
| **No read-aloud/TTS** | The source’s quiz read-aloud work is out of scope and explicitly excluded. Do not add it to product landing pages, checkout, course grants, or order bumps. |

---

## Source material and history inspected

### Current source implementation inspected

| Source files | Why inspected |
|---|---|
| `server/routers/productsRouter.ts`, `server/routers/embeddedCheckoutRouter.ts` | Public physical product listing/landing data; Stripe Checkout/embedded payment creation; coupon behavior; source-origin return URLs; free fulfillment. |
| `server/lib/stripePriceUnits.ts`, `server/lib/courseCheckoutPricing.ts`, `docs/product-price-contracts.md` | Decimal-dollar persistence and one-time cents conversion contract. |
| `server/lib/couponTargeting.ts`, `server/lib/orderBumpCheckout.ts`, `server/lib/fulfillmentEngine.ts` | Coupon targeting; checkout line construction; product/brand fulfillment variants. |
| `server/lib/lmsCheckoutFulfillment.ts`, `server/lib/membershipFulfillment.ts`, `server/webhooks/stripe.ts` | Post-payment enrollments, membership fulfillment, emails, and source-specific identifiers. |
| `server/routers/downloadsRouter.ts`, `bundleRouter.ts`, `membershipRouter.ts`, `lmsRouter.ts`, `workshopRouter.ts`, `contentAvailabilityRouter.ts` | Server availability controls, deadline handling, public lifecycle behavior, course/cohort/workshop fulfillment. |
| `shared/platformTime.ts` | Timezone-aware scheduled-wall-time conversion and deadline comparison. |
| `client/src/pages/ProductsListing.tsx`, `ProductLanding.tsx`, `Checkout.tsx` | Source public storefront and hosted checkout behavior; also identified source branding and unsafe raw HTML insertion that must not move. |
| `client/src/components/EmbeddedCheckoutBlock.tsx`, `CheckoutFormBlock.tsx` | Flexible checkout behavior, coupon UI, terms UI, and organization-brand adaptation differences. |
| Commerce tests including `productPricingContracts.test.ts`, `courseCheckoutPricing.test.ts`, `productCheckoutPricing.test.ts`, `couponTargeting.test.ts`, `remainingProductAvailability.test.ts`, `embeddedCheckoutAvailabilityTime.test.ts`, `courseLandingEmbeddedAvailability.test.ts`, `workshopDetailAvailability.test.ts`, and `orderBumpCheckout.test.ts` | Confirmed intended behavior rather than inferring it from code names. |

### Recent source commits inspected

| Commit | Relevant finding |
|---|---|
| `d21f91e` — current source head | Baseline for every implementation-level comparison. |
| `6b7690c` (2026-09-01) | Added granular catalog/content-type/product coupon targeting and checkout eligibility checks. Target already has a stronger organization-aware equivalent. |
| `bbda7d1` (2026-09-02) | Added date-aware public workshop/cohort lifecycle filtering; this is absent in the target public workshop router. |
| `170c863` (2026-08-29) | Added source quiz read-aloud configuration. Explicitly excluded by the task; it is not a checkout port candidate. |
| Source commerce path history for products, embedded checkout, LMS, downloads, bundles, memberships, workshops, pricing helpers, fulfillment, Stripe webhooks, and source public pages | Reviewed to distinguish current code from historical/source-brand implementation. No commit-message-only conclusions were used. |

### Target implementation inspected

`server/routers/productsRouter.ts`, `embeddedCheckoutRouter.ts`, `lmsRouter.ts`, `lmsCheckoutRouter.ts`, `lmsCheckoutLearnerRouter.ts`, `downloadsRouter.ts`, `bundleRouter.ts`, `membershipRouter.ts`, `workshopRouter.ts`; `server/lib/checkoutPricing.ts`, `couponTargeting.ts`, `orderBumpCheckout.ts`, `orgUrl.ts`, physical provider helpers, and fulfillment modules; `server/db.ts`; `drizzle/schema.ts`; `client/src/App.tsx`, `pages/lms/HostedCheckoutPage.tsx`, checkout blocks/admin product surfaces; and the listed target tests/docs.

---

## Mandatory Course360 safety preconditions (not a blind source port)

These are required before enabling the missing source-derived surfaces. They are listed separately because they arise from Course360’s stated constraints, even where source code is not an acceptable model.

| Priority | Current target evidence | Gap / risk | Required target files | Required fix and tests |
|---|---|---|---|---|
| **P0-A** | `server/db.ts#getOrgIdForUserWithFallback()` checks `userActiveOrg` membership and role, but does not verify `organizations.isActive`. Product admin helpers (`productsRouter.ts`) rely on it; public product checkout resolves the product’s organization but does not establish an active-org guard. | A deactivated organization can remain selected or have a published product path reach checkout/provider/email code. This violates **server-side active organization enforcement**. | `server/db.ts`; `server/routers/productsRouter.ts`; `embeddedCheckoutRouter.ts`; `lmsCheckoutRouter.ts`; `lmsCheckoutLearnerRouter.ts`; `lmsRouter.ts`; relevant fulfillment entry points; focused tests. | Introduce one shared `requireActiveOrganizationById` / `requireActiveOrgMembership` helper that verifies persisted `isActive` before any write, Stripe creation, free grant, fulfillment, or organization email. Derive the ID from persisted content; do not accept one from input. Test inactive org results in `FORBIDDEN`/`NOT_FOUND` before Stripe, provider, enrollment, email, or coupon calls. |
| **P0-B** | `getOrgIdForUserWithFallback()` comments that members cannot switch, but on a non-admin active-row miss it calls `getOrgIdForUser()`, which honors any still-member `userActiveOrg` row. | A plain member with multiple memberships can be resolved through a selected `user_active_org` context, contrary to **members cannot switch orgs**. UI restrictions are not a server-side guarantee. | `server/db.ts`; organization-switch mutation/router if present; all product admin helpers that use the resolver; resolver tests. | Split “administrator-selected active org” from “member canonical org.” Only site/platform administrators and exact organization administrators may honor a selectable active row. For a member, ignore/clear active selection and resolve the canonical membership policy server-side. Test a member with memberships in A/B and `user_active_org=B` cannot manage A/B commerce or alter product context; test org admins may select only an organization where they hold an admin role. |

> **Implementation note:** Treat P0-A and P0-B as prerequisite work. Do not add public product routing, order-bump targets, or source availability features around a resolver that can select an inactive or member-switched organization.

---

## Capability comparison and port decisions

| Source capability (evidence) | Target status | Compatibility decision | Required target files | Organization / tier / security implications | Recommended order |
|---|---|---|---|---|---|
| **Canonical authored dollars → Stripe cents conversion.** Source uses `dollarsToStripeCents()` / `courseDollarsToStripeCents()` and documents one conversion at the payment boundary; e.g., `$99.97 → 9,997` cents. | **Partial / unsafe.** Target schemas correctly store course, download, physical, membership, workshop, bundle, and pricing-option prices as `DECIMAL(...,2)`. Direct Stripe paths commonly multiply by 100. But `server/lib/checkoutPricing.ts#resolveCatalogPriceCents()` returns `Math.round(Number(price))` for decimal catalog prices, while callers compare it to a client dollar value multiplied by 100. | **Port the invariant, not source names.** Add a neutral, shared decimal-dollar-to-cents helper and use it in the catalog resolver; retain dollars in DB/UI/order presentation and convert once when constructing Stripe amount fields. | `server/lib/checkoutPricing.ts`; optionally a new `server/lib/stripePriceUnits.ts`/neutral shared helper; `embeddedCheckoutRouter.ts`; focused new `server/checkoutPricing.test.ts` or extension of existing checkout tests. | Server must continue to recompute price from persisted product/pricing-option records; browser price is only a mismatch check. Prevent 100× undercharge/false rejection. No organization ID input. | **1 — P0**, after P0-A/B. |
| **Public physical-product directory and landing page.** Source `ProductsListing.tsx` and `ProductLanding.tsx` consume a public catalog and render product blocks/CTA into native, Shopify, or external checkout. | **Partial / missing delivery surface.** Target has `productsPublicRouter.list/getBySlug`, product admin, native checkout, and physical fulfillment; however no `client` public physical-product sales page or `/product/:slug` route exists. Native physical checkout success/cancel URLs currently point to `/product/:slug`. Target public router queries global published products and global slug, not an organization resolved from trusted host/path. | **Implement an adapted Course360 public physical page and organization-scoped lookup.** Use product-owned organization plus trusted domain/host resolution; retain Course360 fallback and organization theme. Implement only native Course360 checkout initially. Do **not** copy source arbitrary HTML/script execution, colors/copy, Shopify embeds, or external provider redirects. | `client/src/App.tsx`; new `client/src/pages/lms/PublicPhysicalProductSalesPage.tsx` (or equivalent); `server/routers/productsRouter.ts`; `server/lib/orgUrl.ts`; `client/src/lib/orgUrl.ts`; admin preview/link surfaces; `nativePhysicalCheckoutScope.test.ts`; a new public storefront scope/route test. | Product lookup must be scoped to host-resolved organization (or a server-validated org slug), not browser `orgId`; same slugs in different organizations must not bleed. Verified custom domain is preferred, then org subdomain. Checkout buttons call only server product identifiers; active-org check applies. Existing plan/tier gates still protect authoring and provider setup. | **2 — P1**, after price + resolver fixes. |
| **Native Stripe physical checkout with shipping, coupon validation, and provider fulfillment.** Source has a basic physical checkout; target has organization-aware native checkout. | **Already present; target is safer.** `productsLearnerRouter.createCheckout` derives returns/coupons from `product.orgId`, uses verified organization base URL, sends shipping collection, and records `org_id`. Stripe completion records shipping, idempotently creates orders, creates buyer accounts only after success, and calls Bookvault/Printful/Printify. | **Do not port source implementation. Retain target.** | No feature port. Maintain `productsRouter.ts`, `stripeWebhookRoutes.ts`, provider helpers, and existing tests. | Current target validates organization coupon scope before Stripe, retains 100%-discount checkout for shipping/fulfillment, and uses Course360 provider IDs/email. Preserve these controls while adding storefront UI. | **Already complete; regression gate for P1.** |
| **Granular coupon targeting by full catalog, content types, or selected products** (`6b7690c`). | **Already present / target supersedes source.** Target `couponTargeting.ts` recognizes organization-owned `all`, `content_types`, and `products` targets, validates target products belong to the active org, and checks active/expiry/usage/target before checkout. Physical checkout tests reject a different organization/product before Stripe calls. | **Do not port source helper or source Stripe promotion-code lookup.** Keep target’s local coupon record as authority and create a Stripe coupon only after local eligibility passes. | No port. Maintain `server/lib/couponTargeting.ts`, `productsRouter.ts`, `lmsCheckoutRouter.ts`, `downloadsRouter.ts`, and coupon tests. | Target correctly adds organization identity to source’s catalog targeting model. Continue to reject cross-org/untargeted codes before free grants, Stripe calls, or fulfillment. | **Already complete; regression gate for all new checkout paths.** |
| **Organization/custom-domain checkout return URLs.** Source uses browser/header `origin` in older product paths. | **Already present / target safer.** `getOrgBaseUrl` prefers only verified custom domains; physical checkout, hosted checkout, funnel/embedded checkout, and fulfillment emails use persisted organization values. | **Retain target; do not port source origin logic.** | No port; use `server/lib/orgUrl.ts` and `client/src/lib/orgUrl.ts` in P1. | Do not accept URL/host/origin from client as an authority. The target’s organization base URL must also be used by the new physical product page and any redirect after checkout. | **Already complete; P1 dependency.** |
| **Content/product-specific checkout terms resolution.** Source resolves product → platform terms but its checkout text renderer permits raw `dangerouslySetInnerHTML`. | **Present in safe form / no source renderer port.** Target has content → organization → platform fallback coverage in `checkoutTerms.test.ts`; hosted checkout renders organization terms/privacy links and requires acknowledgement. | **Keep Course360 resolution; do not copy raw source HTML rendering.** If an uncovered physical checkout surface needs terms, use the existing structured labels/URLs, text rendering, validation, and Course360 hosted checkout—not raw source fields/HTML. | Only if P1 needs a physical hosted screen: `lmsCheckoutRouter.ts`, `HostedCheckoutPage.tsx`, `productsRouter.ts`, and a structured terms test. | Organization terms must not leak across organizations. Sanitize/store plain text; no administrator-authored script/HTML. Terms must not be used to bypass payment or entitlement checks. | **Already complete for current hosted checkout; verify in P1.** |
| **Timezone-aware enrollment deadline enforcement.** Source `shared/platformTime.ts` converts legacy scheduled wall time before comparing, and source `lmsRouter`/`embeddedCheckoutRouter` use `isScheduledDeadlineOpen`. | **Older / inconsistent.** Target `lmsRouter` signed-in and guest checkout branches and `embeddedCheckoutRouter` use raw `new Date(course.enrollmentCloseDate) < new Date()`. There is no target equivalent of the shared time utility. | **Port the behavior with Course360 configuration, not source’s hard-coded Eastern-only policy.** Introduce a shared parser/comparator using the owning organization’s configured timezone (with an explicit safe platform fallback) and use it consistently in every paid/free/embedded/guest course/cohort purchase path. | New `shared/platformTime.ts` or a neutral `server/lib/scheduling.ts`; `lmsRouter.ts`; `embeddedCheckoutRouter.ts`; `lmsCheckoutRouter.ts`; `lmsCheckoutLearnerRouter.ts`; relevant admin date-input formatting; targeted time tests. | Deadline is an authorization boundary: reject before Stripe/payment intent, free grant, waitlist mutation, enrollment, or email. Derive timezone from the persisted organization/course, never client input. | **3 — P1**, after P0. |
| **Server checkout blocks for `waitlist` and `enrollment_closed`.** Source blocks those statuses in download, bundle, membership, course/cohort, and workshop purchase procedures, and directs users toward appropriate availability instead. | **Partial / missing for non-course catalog.** Target currently checks draft/archived/private visibility in downloads and course closure in some paths, but lacks the source’s download/bundle/membership checkout guards. Target schemas/status models must be reviewed and migrated deliberately rather than treating an unsupported string as a status. | **Port a normalized availability policy.** Add explicit lifecycle statuses only for product families that intentionally support them; share one server guard across public page details, Stripe/embedded checkout, free grants, promo handling, and order-bump fulfillment. | `drizzle/schema.ts` and additive migration if statuses are absent; `downloadsRouter.ts`; `bundleRouter.ts`; `membershipRouter.ts`; `lmsCheckoutRouter.ts`; `lmsCheckoutLearnerRouter.ts`; `productsRouter.ts` if physical status gains lifecycle states; public landing UI; availability tests. | Must execute server-side before coupon/Stripe/free paths. Waitlist enrollment must record the product’s real org and honor active-org status. Do not expose capacity/peer data publicly. Preserve organization tier gates for memberships. | **4 — P1/P2.** |
| **Date-aware public workshop/cohort lifecycle** (`bbda7d1`). Source filters instances/groups whose end date has passed, retains them in records/reporting, chooses waitlist only if no future/active alternative remains, and provides lifecycle presentation state. | **Missing / older.** Target `workshopPublicRouter.getBySlug` selects only `published` instances then derives availability from all of them; it does not filter completed instances or return waitlist/lifecycle state. Target has no source-equivalent public cohort lifecycle response in the inspected paths. | **Port lifecycle behavior with Course360’s organization-scoped data and UI.** Keep historical records, attendance, completions, and reporting untouched; only public choice/CTA calculation changes. | `server/routers/workshopRouter.ts`; `server/routers/lmsRouter.ts` public cohort projection; applicable public course/workshop landing component(s); lifecycle/availability tests. | Resolve workshop/course organization from the record. Do not leak capacity, enrollment totals, attendee/peer information, CME status, or a cross-org alternative. CME stays gated by verified org entitlement; no public lifecycle state grants access. | **5 — P2.** |
| **Order-bump target breadth and fulfillment.** Source supports course/quiz/download/cohort/bundle/webinar/membership/physical bump types, bundle child grants, webinar registration, membership activation, physical shipping, and upgrades a `free_preview` enrollment to `full`. | **Partial.** Target `orderBumpCheckout.ts` currently builds/fulfills only course, quiz, and download bumps, with organization ID recorded on conversion. It does not include source bundle/webinar/membership/physical/cohort variants or preview upgrade. It also should resolve `bump.bumpProductId` from the persisted bump rather than use a metadata product ID as the grant target when this feature grows. | **Compatible, but staged rebuild—not a direct copy.** First make the stored, active, same-organization bump and its target authoritative; then add types one at a time behind tier/entitlement checks. Port free-preview upgrade only after an organization-scoped enrollment authorization check. | `server/lib/orderBumpCheckout.ts`; `drizzle/schema.ts` + migration only if necessary; `lmsCheckoutRouter.ts`; `embeddedCheckoutWebhook.ts`; `stripeWebhookRoutes.ts`; admin `OrderBumpsAdmin` surfaces; `HostedCheckoutPage.tsx`; focused order-bump tests. | Confirm trigger product, bump, and target all belong to the same active organization. Ignore or reject mismatched Stripe metadata. Physical bumps require Stripe-collected shipping and idempotent physical fulfillment. Bundle grants only organization-owned children. Webinar/member/CME grants recheck publication, verified CME entitlement, and plan limits at fulfillment. Mock-exam-related access remains Pro+ and org-scoped. | **6 — P3, after P0–P2.** |
| **Hosted checkout composition: pricing options, team seats, order summary, order bumps, promotion and terms acknowledgement.** Source provides a branded embedded checkout page. | **Already present / target appropriate.** `HostedCheckoutPage.tsx` has pricing option selection, team seats, order summary, promotion entry, terms acknowledgement, and redirect/free outcomes; Course360 checkout editors/blocks already exist. | **Do not port source `Checkout.tsx`.** Reuse/extend Course360 hosted checkout and organization CSS variables; never copy the source identity or HTML terms handling. | No base port. P1 may route physical product purchases to this model only if the product page and APIs supply an organization-scoped physical content contract. | Continue server-side amount, content ownership, coupon, active-org, tier, and CME enforcement; client presentation cannot become authority. | **Already complete; use as a component, not a source import.** |
| **Legacy generic source fulfillment / source brand membership grants.** Source embedded checkout and fulfillment engine accept `fulfillmentBrand` values and grant AAUS/iHeartEcho brand memberships. | **Explicitly excluded.** Target public embedded checkout already excludes these inputs/grants (`embeddedCheckoutBrandExclusion.test.ts`). Target retains a legacy `fulfillmentEngine.ts` with source identifiers, but audit found no live import other than a regression-source scan; it must remain unreachable and should be separately retired/quarantined. | **Do not port or reactivate.** Replace any future “membership” entitlement only with Course360 organization-owned memberships and verified organization rules. | No source import. Future cleanup: `server/lib/fulfillmentEngine.ts` and remaining inert legacy references, after migration/consumer audit. | Prevent cross-brand grants, source domain email links, and organization bypass. CME entitlement may never be represented by a legacy brand flag. | **Excluded.** |

---

## Already present in Course360 (retain; do not re-port)

- **Organization-scoped physical product administration.** Product, pricing-option, order, analytics, fulfillment provider settings, and manual actions are scoped through active organization/admin helpers in `productsRouter.ts`.
- **Native physical purchase security and fulfillment.** The target’s physical checkout is stronger than source: trusted organization returns, local coupon targeting, Stripe shipping collection, Stripe-confirmed shipping values, idempotent records, guest account creation after payment, provider hand-off, and Course360-specific provider identifiers.
- **Verified custom-domain precedence.** `getOrgBaseUrl()` uses a custom domain only when `domainVerificationStatus === "verified"`; fallback is `{slug}.course360.app`.
- **Organization-aware coupon targeting.** The target validates target product ownership and redeems only coupons belonging to the same organization.
- **Core order bumps.** Course/download/quiz bumps, persisted conversion records, hosted checkout selection, and fulfillment hooks are already implemented. The decision is **expansion**, not replacement.
- **Checkout terms hierarchy and acknowledgement surface.** Target tests cover content → organization → platform fallback. Preserve structured terms handling rather than copying source raw HTML rendering.
- **Organization-aware fulfillment notifications.** Target checkout fulfillment has moved relevant enrollment messages to the purchased course’s organization/domain.
- **Tier/CME/mock-exam guardrails.** Existing target regression coverage asserts organization-scoped Pro/Enterprise mock exams and protected CME behavior. This audit introduces no exception.

---

## Explicit exclusions and deferred source features

| Source feature | Decision | Why it must not be ported in this area |
|---|---|---|
| **All About Ultrasound/iHeartEcho/AAUS source identities, logos, support emails, domains, `brandMode`, `fulfillmentBrand`, `brandMemberships`, UltrasoundAssist/EchoAssist wording** | **Excluded** | Violates Course360™ identity and organization-branding precedence. Target already has an explicit public embedded-checkout exclusion test. |
| **Source source-domain return URLs and browser `origin` as checkout authority** | **Excluded** | Course360 must derive URLs from the stored organization and verified custom-domain status; client `origin` can be spoofed/misconfigured and loses tenant identity. |
| **Source dedicated quiz read-aloud / text-to-speech from `170c863`** | **Excluded** | The task expressly prohibits it. It is not a product/fulfillment dependency. |
| **Raw source checkout/product HTML rendering (`dangerouslySetInnerHTML`) and unreviewed `<script>` execution for Shopify embeds** | **Excluded** | Unsafe for tenant-authored checkout/terms/landing content. Use Course360 structured checkout blocks, sanitized rich content, and approved integration configurations only. |
| **Shopify buy-button and arbitrary external checkout modes** | **Deferred/excluded from the safe initial storefront port** | An external payment path cannot satisfy Course360’s authoritative Stripe amount, coupon, shipping, organization/entitlement, and fulfillment guarantees without an organization-owned integration, signed callback verification, idempotency, and a separate provider security review. Native Course360 Stripe checkout is already available. |
| **Source 100%-discount “free product” shortcut that can avoid a normal Stripe physical session** | **Excluded** | Course360 correctly preserves the Stripe Checkout session for shipping/fulfillment even with a 100% coupon. Retain target behavior. |
| **Source generic brand fulfillment engine** | **Excluded from activation** | It contains legacy membership-brand routing. It is unreachable in the inspected target runtime; do not wire it into new checkout paths. Retire only through a separate consumer/migration audit. |
| **Source CME membership/brand fulfillment semantics** | **Excluded** | CME access must be tied only to the verified owning organization’s CME entitlement and the existing server checks, not an imported global membership/brand flag. |

---

## Recommended implementation sequence

1. **P0: Common authorization foundation**
   - Repair active-organization validation and member non-switching in `server/db.ts`.
   - Add regression coverage before touching routes. Ensure site admins’ documented cross-organization behavior is explicit and does not allow inactive-org checkout/fulfillment.

2. **P0: Monetary invariant**
   - Add a single decimal-dollar → integer-cent conversion helper.
   - Correct `resolveCatalogPriceCents()` and embedded checkout validation; preserve all existing DB/UI dollar values.

3. **P1: Deadline and product availability policy**
   - Add organization-timezone-safe deadline comparison and use it in signed-in, guest, and embedded checkout paths.
   - Normalize waitlist/closed availability server-side before adding presentation changes.

4. **P1: Public physical storefront**
   - First make product lookup host/org-scoped and active-org-aware.
   - Then add the Course360-branded public product route/page that matches native checkout success/cancel URLs, with verified custom-domain precedence and no external/legacy modes.

5. **P2: Lifecycle delivery**
   - Port public workshop/cohort completed-offering filtering and lifecycle presentation without changing historical data.
   - Extend product-family availability statuses only where the target schema/product strategy formally supports them.

6. **P3: Order-bump expansion**
   - Build target type-by-type from persisted, same-organization records; add entitlement/fulfillment tests for every new type.
   - Do not support CME, mock-exam, physical, membership, or provider-related bumps until their specific server revalidation is implemented.

7. **Final hardening/release gate**
   - Run focused tests and a non-paying browser verification on verified custom domain + fallback org subdomain. Confirm no source identity/read-aloud text has entered public UI, Stripe metadata, emails, or providers.

---

## Exact test plan

### 1. Money and checkout-authority tests (P0)

1. Add table-driven unit tests for the canonical conversion helper:
   - `"0" → 0`, `"0.01" → 1`, `"7.00" → 700`, `"99.97" → 9997`, `"299.97" → 29997`, and `"2297.00" → 229700`.
   - Assert the persisted/display value remains the decimal dollar amount; only the Stripe `unit_amount`/`amount_off` value is cents.
2. Exercise `resolveEmbeddedCheckoutExpectedCents()` for course, download, bundle, and physical product rows stored as decimal prices. A `$99.97` client/display price must validate against `9997`, not `100`.
3. Send a mismatched browser `productPrice` and assert `BAD_REQUEST`, no PaymentIntent/Checkout Session, no order, and no fulfillment job.
4. For each applicable Stripe route, inspect created `price_data.unit_amount` and `amount_off` for the values above; assert no second 100× conversion occurs.

### 2. Active-organization and member-context tests (P0)

1. Set organization A `isActive=false`; attempt product list/create/update, pricing option change, order retry, coupon checkout, native physical checkout, embedded checkout, hosted checkout, free grant, and fulfillment re-entry. Each must fail **before** Stripe/provider/email/enrollment writes.
2. Set a user as plain `member` in organizations A and B and persist `user_active_org=B`. Assert a product management/admin operation cannot use B solely through the selected row; verify the documented canonical member behavior.
3. Set an `org_admin` in A and plain member in B; assert selecting B is rejected/ignored and selecting A succeeds. Test a site owner/site admin’s documented selection behavior separately.
4. Submit request shapes containing a forged `orgId`, `organizationId`, or a product ID from another organization. Assert input is rejected/ignored and the organization always comes from the persisted record.

### 3. Availability and scheduled-time tests (P1/P2)

1. At a DST-sensitive boundary, reproduce the source’s scheduled-wall-time assertions: an Eastern scheduled deadline remains open immediately before the resolved instant and closes exactly at it. Repeat with a non-default organization timezone.
2. Call each signed-in, guest, embedded, hosted, and free checkout branch one millisecond before and at/after the deadline. At/after close: no Stripe call, no coupon creation, no free enrollment, no purchase/order, and no email.
3. For each enabled product family, set status to `waitlist` and `enrollment_closed`; assert its direct API checkout cannot be used even if a UI CTA was cached or manually crafted. Coupon and 100%-off inputs must not bypass this.
4. Give a workshop/cohort a closed past instance plus a future published one: public response displays only future/active choices and does not show waitlist as the sole state. With only past closed offerings, it returns lifecycle/archive presentation but preserves administrative/reporting records.
5. Assert public lifecycle responses omit enrollment totals, remaining seats, attendee identity, CME eligibility, and cross-organization alternatives.

### 4. Public physical storefront and domain tests (P1)

1. Route `/product/:slug` (or the approved neutral route) loads a published physical product and shows its organization’s name/logo/colors and decimal price; it does not show Course360 branding when organization branding exists, and uses Course360 only as fallback.
2. Create the same product slug in two organizations. On each verified custom domain/subdomain, resolve only that domain’s product; a request from org A cannot read/checkout org B’s product or pricing options.
3. Assert a verified custom domain is used for page, Stripe success URL, cancel URL, confirmation email, and access link; an unverified custom domain falls back to `{org}.course360.app`.
4. Submit a physical checkout for an inactive organization and assert no Stripe session. Submit a valid 100% same-org coupon and assert Stripe still collects shipping, records `org_id`, and creates a zero-dollar, idempotently fulfilled physical order.
5. Route the current native checkout success URL end-to-end (without paying) and verify it lands on the newly provided physical product page rather than a 404/fallback.
6. Assert the page does not accept/execute Shopify code, external checkout URL, raw script HTML, source project identity, or a client-supplied organization ID.

### 5. Order-bump expansion tests (P3)

1. For every new bump type, create trigger, bump, and target in organizations A/B. Any cross-organization relation must fail at authoring, checkout construction, and fulfillment.
2. Mutate `order_bump_product_id`/type in simulated Stripe metadata. Fulfillment must use the stored active bump’s actual target or reject; it must not grant the metadata-selected product.
3. Bundle bump grants exactly the persisted, same-org published child products; duplicate webhook delivery produces one purchase/conversion per session.
4. Physical bump requests Stripe shipping and uses the existing idempotent native provider fulfillment flow; no address from arbitrary metadata is accepted.
5. Membership/webinar/CME-related bumps re-check plan status, active organization, product publication, and verified CME entitlement at fulfillment. A mock-exam-related target is unavailable outside the owning Pro/Enterprise organization.
6. A source-style `free_preview` → `full` upgrade succeeds only for the same user, existing organization-owned enrollment, paid confirmed session, and same target course; it must not upgrade another organization’s preview.

### 6. Regression/negative-source tests

1. Retain and run `embeddedCheckoutBrandExclusion.test.ts`; add source-identifier scans for product page, checkout metadata, fulfillment emails, provider IDs, and public routes.
2. Search public checkout/storefront sources for `All About Ultrasound`, `iHeartEcho`, `aaus`, `iheartecho`, source domains, `fulfillmentBrand`, `brandMemberships`, `readAloud`, and `speechSynthesis`; expected new-surface result is empty.
3. Assert the structured terms renderer treats an attempted HTML/script value as text or rejects it; it never calls `dangerouslySetInnerHTML` for agreement copy.
4. Run the existing physical checkout/fillment suite: `nativePhysicalCheckoutScope.test.ts`, `nativePhysicalCheckoutFulfillment.test.ts`, `physicalCheckoutOrgUrl.test.ts`, and `lmsCheckoutCouponScope.test.ts`, plus all new focused tests.

---

## Release criteria

A port in this area is ready only when:

- all P0 tests pass and prices remain **decimal dollars** in persistence/display;
- no checkout/fulfillment path runs for an inactive organization or a member-selected switched organization;
- every organization-specific URL uses verified-custom-domain precedence, never browser origin;
- tenant boundary, coupon boundary, and Stripe/provider no-call assertions pass;
- CME and mock exam entitlement behavior remains enforced server-side;
- public pages and emails carry Course360™/organization branding only; and
- source read-aloud/TTS and source project brand/brand-membership behavior remain absent from new code paths.

**No migration, checkout submission, provider action, email, or source edit was performed during this audit.**
