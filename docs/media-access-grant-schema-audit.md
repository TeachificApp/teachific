# Media Access Grant Router and Schema Audit

## Finding

The active `media_access_grants` table is an organization-owned rule grant model. Its live and Drizzle columns are `id`, `orgId`, `ruleId`, `userId`, and `grantedAt`. The legacy media repository invitation and token workflow instead reads and writes `assetId`, `email`, `token`, `expiresAt`, `createdByUserId`, `createdAt`, and `revokedAt` fields that do not exist in the active table.

> **This is a data-model conflict, not a URL-only issue.** Replacing the hard-coded platform URL before resolving the conflict would leave the invitation workflow unable to store, list, revoke, or validate access grants.

| Surface | Current contract | Legacy router expectation | Safe disposition |
|---|---|---|---|
| `media_access_grants` | Organization ID, access rule ID, user ID, grant timestamp | Asset ID, recipient email, bearer token, expiry, sender identity, revocation state | Use for authenticated same-organization member grants only; do not issue or validate token links from this table. |
| Media repository UI | Lists active-organization members and grants/revokes direct user access | Email-token invitation behavior | The member-grant controls are restored; email invitations remain unavailable. |
| Media asset | Contains an owning `orgId` | Legacy grant lookup is asset-only | Resolve organization ownership from the asset server-side; never trust a client-supplied organization ID. |
| Media access email link | Uses a global `VITE_APP_URL` / platform fallback | A tokenized `/media/:slug?token=...` URL | Build it from `getOrgBaseUrl` only after a compatible per-organization token or user-grant model exists. |

## Live-use assessment

The media repository is actively used for valid organization-owned asset and folder management throughout the LMS. It must not be unregistered wholesale. The schema-compatible direct member-grant list and revoke operations are restored with active-organization predicates. The unsafe subset is the legacy email-token invitation and public token access contract.

## Safe migration choices

| Option | Model | Requirements |
|---|---|---|
| A. Authenticated user grants | Rebuild the UI around `media_access_rules` and `media_access_grants`, granting a specific organization member access under an organization-owned rule. | **Implemented.** Server-side asset-to-rule ownership checks, organization-aware user selection, authenticated learner media access, and expiration checks are in place. |
| B. Explicit email-token invitations | Add a new, additive invitation table keyed by organization and asset, with recipient email, opaque token, expiry, creator, and revocation timestamp. | Migrate no existing `media_access_grants` data into the new table without evidence; validate the asset's `orgId`, send `getOrgBaseUrl` links, and expose only organization-scoped list/revoke controls. |

## Required follow-on safeguards

The legacy invitation procedure remains deliberately quarantined with a clear precondition error, and no UI control attempts a token invitation. Direct member grant/revoke controls verify the asset, rule, recipient, and request organization server-side before authorizing delivery. No schema columns were renamed or overloaded. Any future email-token invitation capability still requires a separate additive model, owning-domain link creation, and two-organization isolation tests.
