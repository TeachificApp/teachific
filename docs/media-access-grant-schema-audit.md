# Media Access Grant Router and Schema Audit

## Finding

The active `media_access_grants` table is an organization-owned rule grant model. Its live and Drizzle columns are `id`, `orgId`, `ruleId`, `userId`, and `grantedAt`. The legacy media repository invitation and token workflow instead reads and writes `assetId`, `email`, `token`, `expiresAt`, `createdByUserId`, `createdAt`, and `revokedAt` fields that do not exist in the active table.

> **This is a data-model conflict, not a URL-only issue.** Replacing the hard-coded platform URL before resolving the conflict would leave the invitation workflow unable to store, list, revoke, or validate access grants.

| Surface | Current contract | Legacy router expectation | Safe disposition |
|---|---|---|---|
| `media_access_grants` | Organization ID, access rule ID, user ID, grant timestamp | Asset ID, recipient email, bearer token, expiry, sender identity, revocation state | Do not issue or validate token links from this table. |
| Media repository UI | Calls `inviteByEmail` and `revokeGrant` in addition to valid asset/folder operations | Email-token invitation behavior | Quarantine these controls or show a clear unavailable state until the grant model is migrated. |
| Media asset | Contains an owning `orgId` | Legacy grant lookup is asset-only | Resolve organization ownership from the asset server-side; never trust a client-supplied organization ID. |
| Media access email link | Uses a global `VITE_APP_URL` / platform fallback | A tokenized `/media/:slug?token=...` URL | Build it from `getOrgBaseUrl` only after a compatible per-organization token or user-grant model exists. |

## Live-use assessment

The media repository is actively used for valid organization-owned asset and folder management throughout the LMS. It must not be unregistered wholesale. The unsafe subset is the legacy email-token grant, grant list/revoke, and public token access contract.

## Safe migration choices

| Option | Model | Requirements |
|---|---|---|
| A. Authenticated user grants | Rebuild the UI around `media_access_rules` and `media_access_grants`, granting a specific enrolled user access under an organization-owned rule. | Add server-side asset-to-rule ownership checks, organization-aware user selection, and authenticated learner media access. |
| B. Explicit email-token invitations | Add a new, additive invitation table keyed by organization and asset, with recipient email, opaque token, expiry, creator, and revocation timestamp. | Migrate no existing `media_access_grants` data into the new table without evidence; validate the asset's `orgId`, send `getOrgBaseUrl` links, and expose only organization-scoped list/revoke controls. |

## Required follow-on safeguards

The legacy grant procedures should be deliberately quarantined with a clear precondition error, and their active UI controls should not attempt a token invitation or revocation. No schema columns should be renamed or overloaded. When a migration choice is approved, implement it with an additive migration, active-organization authorization, owning-domain link creation, and two-organization isolation tests before restoring the capability.
