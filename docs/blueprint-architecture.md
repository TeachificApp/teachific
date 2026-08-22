# Teachific Blueprint System — Architecture Document

**Version:** 1.0  
**Date:** July 2026  
**Status:** Approved for Phase 1 Implementation

---

## 1. Executive Summary

The Blueprint system extends Teachific's existing LMS and organization-account architecture with a reusable template layer. A Blueprint is a versioned, immutable package of Teachific resources — courses, products, downloads, funnel pages, webinars, and more — that an organization can install with a single guided wizard. Installation performs a deep clone: every resource receives a new ID, is assigned to the installing organization, and all internal cross-references are rewritten using an ID map. The original Blueprint is never modified.

The system is delivered in four phases. Phase 1 (this document) covers the foundation: platform-owned Blueprints, the installation engine, and the org-admin wizard. Phases 2–4 add Brand Kit inheritance, third-party creator sales, and AI-assisted customization.

---

## 2. Existing Architecture Summary

### 2.1 Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Tailwind 4, shadcn/ui, tRPC client |
| Backend | Express 4, tRPC 11, Drizzle ORM |
| Database | MySQL / TiDB |
| Auth | Teachific email/password + signed JWT session cookies |
| Storage | S3 (via `storagePut` / `storageGet` helpers) |
| Payments | Stripe (checkout sessions + webhooks) |
| Email | SendGrid |

### 2.2 Organization and Subscription Model

Organizations are the tenant boundary. Every content resource carries an `orgId` foreign key. The `org_subscriptions` table stores the active plan for each org:

| Plan | Current Blueprint Access |
|---|---|
| `free` | None |
| `starter` | None |
| `builder` | Install unlimited platform Blueprints |
| `pro` | Install + create private Blueprints within own org |
| `enterprise` | All above + submit to marketplace, multi-org licenses |

### 2.3 Existing Resource Tables Relevant to Blueprints

The following tables represent the resource types that Phase 1 Blueprints can package and clone:

| Resource Type | Primary Table | Key Relationships |
|---|---|---|
| Course | `lms_courses` | → `lms_sections` → `lms_lessons` → `lms_landing_pages` |
| Course Pricing | `lms_pricing_options` | → `lms_courses` |
| Digital Download | `digital_products` → `digital_product_files` | → `digital_product_prices` |
| Digital Bundle | `digital_bundles` | → `digital_products` |
| Webinar | `webinars` | → `webinar_funnel_steps` |
| Funnel Page | `page_builder_pages` (type=funnel) | standalone |
| Landing Page | `lms_landing_pages` | → `lms_courses` |
| Form | `forms` → `form_fields` | → `form_branching_rules` |
| Product | `digital_products` (pricingType=one_time) | — |

### 2.4 Existing Duplication Functions (Reusable)

The following duplication helpers already exist and will be called by the Blueprint installation service rather than reimplemented:

| Function / Procedure | Location | Scope |
|---|---|---|
| `duplicateCourse` | `lmsEnrollmentAdminRouter.ts` | Course + sections + lessons + landing page |
| `duplicate` (page) | `lmsRouter.ts` → `lmsDb.duplicatePage` | Single page builder page |
| `duplicate` (funnel page) | `funnelRouter.ts` | Single funnel page |
| `duplicate` (download) | `downloadsRouter.ts` | Digital product + files + prices |
| `duplicateBundle` | `downloadsRouter.ts` | Digital bundle + member products |
| `duplicateForm` | `generalFormRouter.ts` | Form + fields + branching rules |

These functions will be refactored to accept an explicit `targetOrgId` parameter so the Blueprint service can install into any organization.

### 2.5 Tenant Isolation Pattern

Every existing query helper enforces `orgId` scoping. The Blueprint installation service must follow the same pattern: every `INSERT` for a cloned resource must explicitly set `orgId` to the installing organization's ID, never the Blueprint creator's `orgId`.

---

## 3. New Database Entities

### 3.1 Entity Relationship Summary

```
blueprints
  └── blueprint_versions (immutable snapshots)
        └── blueprint_resources (resource manifest)
              └── blueprint_variables (token definitions)

blueprints
  └── blueprint_purchases (org buys a blueprint)
  └── blueprint_installations (org installs a version)
        └── blueprint_installed_resources (per-resource install record)
        └── blueprint_licenses (access control)

blueprints
  └── blueprint_reviews (org rates a blueprint)
```

### 3.2 Table Specifications

#### `blueprints`

| Column | Type | Notes |
|---|---|---|
| `id` | int PK autoincrement | |
| `creatorUserId` | int FK users | null for platform-owned |
| `creatorOrgId` | int FK organizations | null for platform-owned |
| `title` | varchar(255) | |
| `slug` | varchar(255) unique | URL-safe identifier |
| `shortDescription` | varchar(500) | |
| `fullDescription` | longtext | |
| `category` | varchar(100) | e.g. "Course Creation", "Webinars" |
| `subcategory` | varchar(100) | |
| `thumbnailUrl` | text | |
| `previewImageUrls` | text | JSON array of URLs |
| `previewUrl` | text | |
| `status` | enum | draft / pending_review / approved / published / suspended / archived |
| `visibility` | enum | private / organization_only / marketplace / direct_link / platform_only |
| `pricingType` | enum | free / one_time / subscription_included / private_access |
| `price` | decimal(10,2) | null for free |
| `currency` | varchar(3) | default "USD" |
| `currentVersion` | varchar(20) | e.g. "1.0.0" |
| `setupTimeEstimate` | varchar(50) | e.g. "30 minutes" |
| `difficultyLevel` | enum | beginner / intermediate / advanced |
| `featured` | boolean | platform curated |
| `publishedAt` | timestamp | |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

#### `blueprint_versions`

| Column | Type | Notes |
|---|---|---|
| `id` | int PK autoincrement | |
| `blueprintId` | int FK blueprints | |
| `versionNumber` | varchar(20) | semver e.g. "1.0.0" |
| `releaseNotes` | text | |
| `snapshotData` | longtext | JSON — full resource snapshots, never overwritten |
| `publishedAt` | timestamp | null until published |
| `createdAt` | timestamp | |

**Rule:** A published version's `snapshotData` is immutable. New changes always create a new version row.

#### `blueprint_resources`

| Column | Type | Notes |
|---|---|---|
| `id` | int PK autoincrement | |
| `blueprintId` | int FK blueprints | |
| `blueprintVersionId` | int FK blueprint_versions | |
| `resourceType` | enum | course / product / download / page / funnel / webinar / form / email / coupon / tag |
| `sourceResourceId` | int | ID of the original resource in the creator's org |
| `resourceName` | varchar(255) | display name |
| `resourceOrder` | int | installation order |
| `configurationData` | text | JSON — type-specific config |
| `required` | boolean | if false, user can skip during install |
| `createdAt` | timestamp | |

#### `blueprint_variables`

| Column | Type | Notes |
|---|---|---|
| `id` | int PK autoincrement | |
| `blueprintId` | int FK blueprints | |
| `variableKey` | varchar(100) | e.g. "business_name" |
| `label` | varchar(255) | human-readable label |
| `description` | text | |
| `variableType` | enum | text / textarea / url / email / phone / image / logo / color / number / currency / date / select / boolean |
| `defaultValue` | text | |
| `required` | boolean | |
| `validationRules` | text | JSON |
| `displayOrder` | int | |

#### `blueprint_purchases`

| Column | Type | Notes |
|---|---|---|
| `id` | int PK autoincrement | |
| `blueprintId` | int FK blueprints | |
| `blueprintVersionId` | int FK blueprint_versions | version at time of purchase |
| `buyerUserId` | int FK users | |
| `buyerOrgId` | int FK organizations | |
| `orderId` | varchar(255) | Stripe payment intent or "free" |
| `purchasePrice` | decimal(10,2) | 0 for free |
| `currency` | varchar(3) | |
| `licenseType` | enum | single_organization / multi_organization / platform_subscription / lifetime |
| `accessStatus` | enum | active / refunded / revoked / expired |
| `purchasedAt` | timestamp | |

#### `blueprint_installations`

| Column | Type | Notes |
|---|---|---|
| `id` | int PK autoincrement | |
| `blueprintId` | int FK blueprints | |
| `blueprintVersionId` | int FK blueprint_versions | |
| `purchaseId` | int FK blueprint_purchases | null for free/platform-included |
| `organizationId` | int FK organizations | installing org |
| `installedByUserId` | int FK users | |
| `installationStatus` | enum | queued / validating / copying / configuring / awaiting_setup / completed / failed / rolled_back |
| `customizationValues` | text | JSON — variable key→value map |
| `resourceIdMap` | text | JSON — source_id→installed_id map |
| `installationLog` | longtext | JSON array of step logs |
| `installedAt` | timestamp | |
| `completedAt` | timestamp | |
| `lastUpdatedAt` | timestamp | |

#### `blueprint_installed_resources`

| Column | Type | Notes |
|---|---|---|
| `id` | int PK autoincrement | |
| `installationId` | int FK blueprint_installations | |
| `blueprintResourceId` | int FK blueprint_resources | |
| `resourceType` | enum | mirrors blueprint_resources.resourceType |
| `sourceResourceId` | int | original template resource ID |
| `installedResourceId` | int | new org-owned resource ID |
| `organizationId` | int FK organizations | |
| `installationStatus` | enum | pending / completed / failed / skipped |
| `customized` | boolean | true if user has edited this resource post-install |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

#### `blueprint_licenses`

| Column | Type | Notes |
|---|---|---|
| `id` | int PK autoincrement | |
| `blueprintId` | int FK blueprints | |
| `organizationId` | int FK organizations | |
| `licenseType` | enum | single_organization / multi_organization / platform_subscription / lifetime |
| `startsAt` | timestamp | |
| `expiresAt` | timestamp | null for lifetime |
| `updateAccess` | boolean | can receive version updates |
| `supportAccess` | boolean | |
| `status` | enum | active / expired / revoked |

#### `blueprint_reviews`

| Column | Type | Notes |
|---|---|---|
| `id` | int PK autoincrement | |
| `blueprintId` | int FK blueprints | |
| `userId` | int FK users | |
| `organizationId` | int FK organizations | |
| `rating` | tinyint | 1–5 |
| `title` | varchar(255) | |
| `reviewText` | text | |
| `verifiedPurchase` | boolean | |
| `moderationStatus` | enum | pending / approved / rejected |
| `createdAt` | timestamp | |
| `updatedAt` | timestamp | |

---

## 4. Permission Matrix

| Action | Platform Admin | Org Admin (Pro+) | Org Admin (Builder) | Org Admin (Starter/Free) | Student |
|---|---|---|---|---|---|
| View marketplace | ✓ | ✓ | ✓ | ✗ | ✗ |
| Install free Blueprint | ✓ | ✓ | ✓ | ✗ | ✗ |
| Purchase Blueprint | ✓ | ✓ | ✓ | ✗ | ✗ |
| Create Blueprint (private) | ✓ | ✓ | ✗ | ✗ | ✗ |
| Submit Blueprint to marketplace | ✓ | Enterprise only | ✗ | ✗ | ✗ |
| Approve/reject Blueprints | ✓ | ✗ | ✗ | ✗ | ✗ |
| Feature Blueprints | ✓ | ✗ | ✗ | ✗ | ✗ |
| Manage creator approvals | ✓ | ✗ | ✗ | ✗ | ✗ |
| View all installations | ✓ | own org only | own org only | ✗ | ✗ |
| Edit installed resources | — | ✓ | ✓ | ✗ | ✗ |

---

## 5. Blueprint Installation Service — Design

### 5.1 Installation Order

Resources must be installed in dependency order to ensure foreign keys resolve correctly:

1. Tags and categories
2. Files and media (S3 copy)
3. Downloads (`digital_products` + `digital_product_files` + `digital_product_prices`)
4. Courses (`lms_courses` + `lms_sections` + `lms_lessons` + `lms_landing_pages`)
5. Products (pricing options, checkout config)
6. Forms (`forms` + `form_fields` + `form_branching_rules`)
7. Webinars (`webinars` + `webinar_funnel_steps`)
8. Funnel pages and landing pages (`page_builder_pages`)
9. Email campaigns and sequences
10. Automations
11. Coupons
12. Cross-resource link rewriting (using the completed ID map)

### 5.2 ID Remapping

Every installation maintains a `resourceIdMap` JSON object:

```json
{
  "course:101": "course:5621",
  "download:202": "download:9843",
  "page:303": "page:7734",
  "webinar:404": "webinar:3389"
}
```

After all resources are created, a post-processing pass rewrites all internal references in page content, email bodies, automation triggers, and product links using this map.

### 5.3 Variable Replacement

Blueprint content uses `{{variable_key}}` tokens. The installation service performs a string replacement pass over all text fields (page content, email subjects/bodies, product descriptions, course descriptions) after variable values are collected in the wizard.

**Priority order:**
1. User-entered value from the installation wizard
2. Organization Brand Kit value (Phase 2)
3. Blueprint default value
4. Preserve visible placeholder and flag in setup checklist

### 5.4 Rollback

If any critical step fails, the service deletes all resources created in the current installation attempt (in reverse dependency order) and marks the installation record as `rolled_back`. A compensating-action log is written to `installationLog` for diagnostics.

### 5.5 Snapshot Data Structure

The `blueprint_versions.snapshotData` JSON contains a complete, self-contained copy of each resource's content and configuration at the time of Blueprint publication. It does not store database references to the creator's live resources. The snapshot is sufficient to recreate every resource without querying the creator's org.

---

## 6. Migration Plan

All migrations are additive. No existing columns or tables are altered in Phase 1.

| Migration | SQL Operation | Risk |
|---|---|---|
| Create `blueprints` | `CREATE TABLE` | None |
| Create `blueprint_versions` | `CREATE TABLE` | None |
| Create `blueprint_resources` | `CREATE TABLE` | None |
| Create `blueprint_variables` | `CREATE TABLE` | None |
| Create `blueprint_purchases` | `CREATE TABLE` | None |
| Create `blueprint_installations` | `CREATE TABLE` | None |
| Create `blueprint_installed_resources` | `CREATE TABLE` | None |
| Create `blueprint_licenses` | `CREATE TABLE` | None |
| Create `blueprint_reviews` | `CREATE TABLE` | None |
| Add `blueprintAccess` to `org_subscriptions` | `ALTER TABLE ADD COLUMN` | Low — additive only |

---

## 7. Reusable Services

The following existing server-side helpers will be called by the Blueprint installation service. Each will be extended to accept a `targetOrgId` parameter:

| Service | Current Location | Extension Required |
|---|---|---|
| `duplicateCourse` | `lmsEnrollmentAdminRouter.ts` | Accept `targetOrgId`, return ID map |
| `duplicatePage` | `lmsDb.ts` | Accept `targetOrgId` |
| `duplicate` (funnel) | `funnelRouter.ts` | Accept `targetOrgId` |
| `duplicate` (download) | `downloadsRouter.ts` | Accept `targetOrgId` |
| `duplicateBundle` | `downloadsRouter.ts` | Accept `targetOrgId` |
| `duplicateForm` | `generalFormRouter.ts` | Accept `targetOrgId` |

---

## 8. API Procedures (tRPC)

### Platform Admin (`blueprintAdminRouter`)

| Procedure | Type | Description |
|---|---|---|
| `create` | mutation | Create a new Blueprint draft |
| `update` | mutation | Edit Blueprint metadata |
| `addResource` | mutation | Add a resource to a Blueprint |
| `removeResource` | mutation | Remove a resource |
| `defineVariable` | mutation | Add/edit a variable definition |
| `createVersion` | mutation | Snapshot current resources as a new version |
| `validate` | query | Run pre-publish validation checks |
| `submit` | mutation | Submit for review |
| `approve` | mutation | Approve a submitted Blueprint |
| `publish` | mutation | Publish an approved version |
| `suspend` | mutation | Suspend a marketplace listing |
| `listAll` | query | List all Blueprints (platform admin view) |
| `getInstallationLogs` | query | View installation audit logs |

### Org Admin (`blueprintOrgRouter`)

| Procedure | Type | Description |
|---|---|---|
| `listMarketplace` | query | Browse published Blueprints (Builder+ only) |
| `get` | query | Get Blueprint detail with included resources |
| `purchase` | mutation | Purchase a paid Blueprint |
| `install` | mutation | Start installation wizard |
| `getInstallationStatus` | query | Poll installation progress |
| `retryInstallation` | mutation | Retry a failed installation |
| `rollbackInstallation` | mutation | Roll back a failed installation |
| `listInstalled` | query | List org's installed Blueprints |
| `getInstalledDetail` | query | Get installed resources + setup checklist |

---

## 9. Navigation Additions

### Platform Admin Sidebar

- Blueprint Marketplace
- Manage Blueprints
- Creator Approvals *(Phase 3)*
- Marketplace Sales *(Phase 3)*

### Organization Admin Sidebar (Builder+ plans)

- Blueprint Marketplace
- My Blueprint Purchases
- Installed Blueprints

---

## 10. Phased Roadmap

### Phase 1 — Foundation (Current)

Platform-owned Blueprints containing: courses, products, downloads, landing pages, funnel pages, webinars. Includes: Blueprint creation, immutable snapshots, deep cloning, organization assignment, ID remapping, variables, installation wizard, setup checklist, installed Blueprint dashboard.

### Phase 2 — Brand Kit + Marketplace Shell

Adds: email campaigns, email sequences, forms, tags, coupons, Brand Kit inheritance, free and paid marketplace listings, variable auto-population from Brand Kit.

### Phase 3 — Creator Ecosystem

Adds: approved third-party creators, creator dashboards, commission tracking, reviews and ratings, version update notifications, new-resource updates, side-by-side version comparisons.

### Phase 4 — Intelligence Layer

Adds: selective field-level merging, AI-assisted customization, Blueprint recommendations, marketplace subscriptions, multi-organization licenses.

---

## 11. Identified Risks and Safeguards

| Risk | Safeguard |
|---|---|
| Buyer org sees creator's live resources | Snapshot is self-contained; installation reads only from `snapshotData`, never from creator's tables |
| Cross-org data leak via ID reuse | Every cloned resource gets a new auto-increment ID; `resourceIdMap` is validated before post-processing |
| Partial installation leaves orphaned rows | Rollback service deletes in reverse dependency order; `installationLog` records every created ID |
| Duplicate Blueprint installation | `blueprint_installations` checked before starting; user warned if Blueprint already installed |
| Stripe credentials copied | Snapshot explicitly excludes: customer records, orders, transactions, API secrets, payment credentials |
| Automations fire immediately after install | All automations and email campaigns set to `paused`/`draft` status post-install |
| Student data copied | Snapshot explicitly excludes: enrollments, form submissions, analytics history |

---

## 12. Definition of Done — Phase 1

Phase 1 is complete when a platform administrator can:

1. Select existing Teachific resources and package them as a Blueprint
2. Define variables with defaults
3. Publish an immutable Blueprint version
4. Preview the Blueprint detail page
5. Install it into a test organization via the 7-step wizard
6. Verify that all copied resources have new IDs belonging to the test org
7. Verify that internal links point to the new copies, not the originals
8. Customize installed resources without affecting the master Blueprint
9. Install the same Blueprint into a second organization and verify no shared data
10. Review a complete installation log and setup checklist

---

*This document is the canonical reference for all Blueprint implementation work. It should be updated when schema changes are made or new phases are scoped.*
