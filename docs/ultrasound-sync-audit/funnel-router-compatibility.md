# Course360™ Funnel Router Compatibility Finding

**Recorded:** 2026-09-26  
**Status:** Deferred — requires a target-native public delivery reconstruction before public-funnel hardening can be safely enabled.

## Finding

The existing `server/routers/funnelRouter.ts` is a mixed legacy surface, not a dependable public-funnel delivery implementation. Its `funnelPublicRouter` combines fields from an older, incompatible funnel-page model with the current Course360 schema.

| Current persisted model | Relevant current columns | Legacy router assumptions that do not exist |
|---|---|---|
| `funnels` | `id`, `orgId`, `slug`, `isActive`, `totalVisitors`, `totalConversions` | `status`, `total_views` |
| `funnel_steps` | `funnelId`, `pageId`, `slug`, `sortOrder`, `stepType` | — |
| `page_builder_pages` | `orgId`, `slug`, `title`, `blocksJson`, `isPublished` | — |
| `funnel_pages` | `orgId`, `slug`, `type`, `content` | `funnelId`, `blocks`, `isActive`, `isHidden`, `pageType`, `nextPageId`, counters |

A live database column audit confirms the same shape. Therefore, adding host-scoped filters to the legacy procedures would create a static-looking but runtime-invalid security patch. The attempted uncheckpointed public-funnel changes were intentionally reverted rather than relying on type assertions or stale column assumptions.

## Safe next implementation shape

1. Treat `funnels` plus `funnel_steps` plus `page_builder_pages` as the authoritative public funnel model.
2. Resolve the organization only from `resolvePublicOrganizationScope(request)` and query `funnels.orgId === scope.id` plus `funnels.isActive === true`.
3. Resolve a public step through `funnel_steps.funnelId` and the linked `page_builder_pages.pageId`, requiring matching `orgId` and `isPublished === true`.
4. Rebuild public checkout/form/lead behavior only after defining the persisted source page and block contract. Require every server-side target and product to match the resolved organization; use decimal-dollar amounts and convert only at the Stripe boundary.
5. Add route-level behavior tests for same slug in two organizations, verified custom-domain precedence, Course360 subdomains, inactive organizations/funnels, unpublished pages, cross-organization step IDs, and checkout/lead attempts before any provider call.
6. Keep the legacy `funnel_pages` procedures quarantined until a deliberate migration/retirement plan establishes ownership and public delivery semantics. Do not infer that data model from the deprecated router.

## Guardrails retained

- Course360™ fallback identity; organization branding and verified custom domains take precedence.
- No caller-authoritative `orgId`, `origin`, funnel ID, page ID, or product ID.
- Active organization, organization-admin, CME, and Pro+ mock-exam rules remain server-side.
- Prices persist/display as decimal dollars; Stripe receives integer cents only at the payment boundary.
- No source-project branding, generic brand grants, or dedicated TTS/read-aloud functionality.
