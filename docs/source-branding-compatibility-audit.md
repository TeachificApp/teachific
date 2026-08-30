# Source-Branding Compatibility Audit

## Purpose

Teachific customer-facing navigation, platform fallbacks, CME client copy, and new-data defaults must not expose source-project names, domains, or brand discriminators. This note records the remaining identifiers that are deliberately retained only to read, fulfill, or render imported records safely.

> These values are **not** approved for new Teachific UI, variables, data defaults, routes, or public URLs. Change them only through an additive data migration and a verified consumer migration.

| Location | Remaining value | Reason it remains | Required future action |
|---|---|---|---|
| Included-item and membership components | Imported legacy item-type keys | Existing membership records use those strings; the visible UI maps them to generic **Membership Access** labels. | Introduce a neutral stored access type, migrate records, then retire the mapper. |
| Checkout and fulfillment contracts | Legacy fulfillment discriminator values | Imported checkout configuration and fulfillment metadata can still resolve these values. | Replace with a neutral organization-owned access contract before removing inputs. |
| Media and email audience filters | Legacy filter values | Historical records may contain the filters; they are not author-facing defaults. | Migrate stored filters to organization scope and remove the discriminator. |
| Legacy bundle and workshop routers | Source-derived router inputs and defaults | These routers do not match the live organization-scoped schema and are not active client contracts. | Keep quarantined; replace only after an additive organization-scoped model is implemented. |
| Drizzle history and schema snapshots | Historical source-domain defaults and legacy model definitions | These are migration history and reference artifacts, not runtime defaults. | Do not rewrite history; ensure current schema and new migrations use Teachific-safe defaults. |
| CME activity sender fallback | Approved service addresses in `cmeActivityFormRouter.ts` | The addresses are the documented operational exception. Client code now uses only the organization's CME contact address. | Retain only in the allowed server fallback until an approved service-configuration migration replaces it. |

## Completed active-surface cleanup in this slice

The reusable platform navigation now contains only Teachific-safe routes. The LMS layout no longer uses the source-project logo asset or a source-specific community route. CME send dialogs no longer prefill external provider addresses, and public CME disclosure copy uses the owning organization identity with neutral continuing-education wording.

## Guardrail

Regression coverage in `server/latestUltrasoundPort.test.ts` verifies that the cleaned platform navigation, LMS layout, and CME client surfaces contain no source-provider or source-project wording. It separately confirms that the approved CME service addresses remain in the server-side fallback, rather than in the client UI.
