# Media Repository Delivery Audit

## Verified finding

The active Media Repository router creates display, download, embed, SCORM, and SCORM-ZIP URLs under `/api/media/:slug/...`, but the Express application currently registers no router at `/api/media`. The token helper and SCORM ZIP cache documentation both reference a removed or missing `mediaServe` implementation. As a result, restoring delivery must be a deliberate server-route rebuild, not a client URL adjustment.

## Safe boundary for a rebuild

| Concern | Verified state | Required replacement behavior |
|---|---|---|
| Asset identity | `media_assets` is organization-owned and stores an `orgId` | Resolve the asset server-side by slug and preserve its owning organization for every authorization decision. |
| Public assets | The supported asset access field can be `public` | A public route may serve only the current version of a non-deleted public asset. |
| Private assets | Existing tRPC issues a 4-hour HMAC viewer token after administrator or enrollment checks | Verify the signed token, asset slug, current user/enrollment binding, and owning organization before serving. |
| Email tokens | `media_access_grants` is a user/rule model, not an email/token model | Do not restore legacy token invitations, validation, or bearer links. |
| SCORM paths | Cached extraction helpers reject traversal outside their cache root | Reuse this validation only after the request is authorized for the owning asset. |

> **Conclusion:** No delivery endpoint has been restored in this slice. The next implementation must introduce an explicit server-side route with active organization or verified viewer-token access checks, start with a minimal current-version response, and include cross-organization and private-asset tests before SCORM asset-path handling.
