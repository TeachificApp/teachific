# Bundle Router and Schema Audit

## Scope and evidence

This audit compares the registered legacy bundle router at `server/routers/bundleRouter.ts`, the active Drizzle definitions in `drizzle/schema.ts`, the live database column inventory, and the bundle screens currently used by Teachific. It does not change persisted bundle data or imported compatibility keys.

> **Conclusion:** `bundleRouter.ts` is a stale, source-derived contract. It is not safe to expose or repair by adding a router alias alone. The live `bundles` table and active `lms.bundles` procedures instead implement a smaller, organization-owned course-bundle model.

| Area | Authoritative current state | Legacy router expectation | Consequence |
|---|---|---|---|
| Bundle identity | `orgId`, `name`, `description`, `thumbnailUrl`, `price`, `salePrice`, `courseIds`, `isActive`, `enrollmentClosed` | `title`, `slug`, `status`, `brand`, `accessType`, `coverImage`, SEO, landing-page, checkout, and workflow fields | Legacy reads and writes reference columns absent from the live table. |
| Bundle items | `bundle_items` supports `course`, `quiz`, `download`, `product`, and `webinar` | The router also branches for unsupported `cohort` and `community` item types | Type and lookup behavior cannot be relied on without a deliberate schema decision. |
| Pricing | `bundle_pricing_options.price` is decimal dollars; `isDefault` is present; `isActive` is absent | The router filters on `isActive` and converts submitted dollar values to cents before storage | The legacy flow can fail against the live table and corrupt displayed pricing by multiplying amounts by 100. |
| Purchase records | `digital_bundle_purchases` stores a purchaser, bundle, Stripe session, and timestamp | The router expects amount, currency, payment-intent, and status columns | Sales, refunds, and revenue aggregation cannot safely operate from this table as written. |
| Administration | `lms.bundles` verifies the bundle's owning `orgId` through `requireOrgAdmin` | `bundleAdminRouter` only accepts one global `admin` role and filters records by unscoped IDs | The legacy administration contract violates active-organization isolation. |

## Reachability assessment

The current `/products/bundles` and `/products/bundles/:id/edit` screens call `lms.bundles`. Those procedures use the small live bundle contract and enforce organization access. Their present scope is a bundle of courses stored in `courseIds`.

Some older administrative surfaces still render `client/src/pages/admin/BundlesAdmin.tsx` and `BundleLandingPageBuilder.tsx`. They call `trpc.bundlesAdmin.*`, but the application registers `bundleAdmin`, not `bundlesAdmin`. Even if an alias were registered, the called legacy procedures would issue queries and updates for columns that do not exist. `ProductSalesTab.tsx` is the only current client caller of the registered `bundleAdmin` namespace, and it invokes sales and refund operations that are also incompatible with the live purchase schema.

The public and learner legacy namespaces are registered, but no current client component calls `bundlePublic.*` or `bundleLearner.*`. They must therefore not become the default public bundle API merely because they are present in the router tree.

## Security and tenancy findings

The live bundle table is organization-owned and requires an active authorized organization at every privileged entry point. The legacy router does not meet that requirement: it looks up bundles and items globally by ID or slug, treats a global `admin` role as sufficient authorization, and does not verify that selected courses, downloads, products, webinars, or quizzes are owned by the same `orgId` as the bundle.

Public resolution also cannot be correct without an owning-organization context because `bundles.slug` does not exist and public URLs must be formed from `getOrgBaseUrl` using the owning organization's configured subdomain or verified custom domain. The old `brand` input and source-specific default are prohibited for new Teachific data and are not an organization boundary.

## Safe remediation sequence

| Order | Change | Safety requirement |
|---|---|---|
| 1 | Keep `lms.bundles` as the only supported organization-scoped create, read, update, and delete contract while the older screens are migrated. | Every ID lookup must resolve the bundle first and call `requireOrgAdmin` with its `orgId`. |
| 2 | Replace or redirect legacy `BundlesAdmin` and `BundleLandingPageBuilder` callers to a purpose-built organization-scoped bundle experience. | Do not register a `bundlesAdmin` alias to the stale router as a shortcut. |
| 3 | Define a single Teachific bundle domain model. Add new columns only after their public/admin use cases and data ownership are specified. | Use additive migrations; do not rename or overload imported compatibility values. |
| 4 | When itemized bundles are enabled, make `bundle_items` authoritative and validate every selected item against the active bundle organization. | Reject cross-organization content IDs before insert, update, display, fulfillment, or checkout. |
| 5 | When pricing is expanded, preserve decimal dollar values in the database and convert only at the Stripe API boundary. | Do not reuse the legacy cents conversion for `price`, `downPayment`, or `installmentAmount`. |
| 6 | Introduce sales, refunds, subscriptions, landing blocks, and public purchase routes only after the associated purchase schema includes their required fields. | Verify payment records, refunds, and learner URLs against the owning organization and `getOrgBaseUrl`. |
| 7 | Remove deprecated legacy router registrations after callers have migrated and regression tests prove isolation. | Keep any imported legacy membership keys as compatibility data until a separate migration plan is approved. |

## Explicit non-actions

This audit deliberately does **not** add missing legacy columns, change `courseIds`, convert prices, alter `digital_bundle_purchases`, register a plural router alias, or replace compatibility identifiers. Each of those changes could either break existing records or make a broad source-derived contract reachable before its tenant boundaries are repaired.

## Acceptance criteria for the follow-on implementation

The next bundle implementation slice must demonstrate that all administrative list, get, create, update, item, pricing, enrollment, refund, and workflow operations use an authorized active organization. It must prove that an administrator from organization A cannot inspect, mutate, include, refund, or fulfill a bundle or bundle item from organization B. Learner-facing bundle and checkout URLs must resolve through the owner organization's base URL. New bundle fields, labels, and defaults must use Teachific or organization-owned terminology only, with no source-project brand discriminator.
