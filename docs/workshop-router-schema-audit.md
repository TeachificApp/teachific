# Workshop Router and Schema Audit

## Finding

The historical `workshopAdminRouter` uses a source-derived contract that conflicts with the current organization-owned `workshops` schema. It references fields such as `brand`, `subtitle`, `createdByUserId`, `thumbnailUrl`, and legacy workflow settings that are not part of the active Drizzle definition. Its original create, read, and update operations were therefore unsafe to expose as an administration API.

| Surface | Current state | Safe disposition |
|---|---|---|
| `lms.workshops` | Current supported workshop list, create, get, update, delete, and registration operations | Enforce active-organization matching for requested organization IDs and record ownership. |
| LMS workshop tab | Previously rendered the legacy `WorkshopsAdmin` implementation | Delegate to the supported `WorkshopsPage`, preserving the optional selected workshop ID. |
| LMS collection content picker | Previously queried `workshopAdmin.list` | Query `lms.workshops.list`, which returns only the active organization’s workshops. |
| `workshopAdmin` root namespace | Registered despite a stale schema contract | Unregister it so direct RPC callers cannot invoke the incompatible administration API. |
| Public and learner workshop namespaces | Separate public/learner contracts | Retain unchanged pending their own ownership and public-link audit. |

## Current authorization guarantee

`lms.workshops.list` and `lms.workshops.create` now resolve the authorized active organization and reject a supplied organization ID that differs from it. All supported single-workshop and registration operations pass through a helper that verifies the workshop belongs to that active organization before continuing.

> The inactive legacy implementation remains source code only for the moment. It must not be remounted or re-registered. Any future advanced workshop administration features require an additive organization-scoped schema and new procedures rather than restoration of the retired namespace.

## Follow-on constraints

Do not add a source-brand default, modify imported workshop fields in place, or re-enable the retired router merely to support advanced settings. Model each required setting against the current `workshops` table, add organization ownership where needed, migrate data additively, and validate cross-organization denial before exposing it to staff or learners.
