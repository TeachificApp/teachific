# Media Folder and Asset Schema Audit

## Verified live contract

The live `media_folders` table uses an organization-owned hierarchy with `id`, `orgId`, `name`, `parentFolderId`, and `created_at`. The live `media_assets` table holds its folder relation in nullable `folderId` alongside `orgId`, file storage fields, and optional display metadata.

| Concern | Supported live columns | Stale router expectation | Result |
|---|---|---|---|
| Folder identity | `media_folders.id` and `media_folders.orgId` | Global string `slug` | A global slug cannot safely identify an organization-owned folder. |
| Folder hierarchy | `parentFolderId` | `parentId` | The current hierarchy requires owner validation for both the folder and parent. |
| Asset relation | `media_assets.folderId` | String `media_assets.folder` | Label-based updates do not match the live relation and must remain unavailable. |
| Folder fields | `name` and `created_at` | `description`, `sortOrder`, `updatedAt` | Legacy CRUD cannot issue valid live-table writes. |

> **Conclusion:** The live schema already supports an organization-owned folder relationship, but the legacy router and UI use an incompatible label-and-slug model. Restoring the legacy controls would fail at runtime and could bypass tenant boundaries.

## Safe rebuild requirements

The replacement must expose folder IDs, never slugs, in the UI and RPC contract. Every list, create, rename, delete, move, and bulk-move operation must resolve the active organization and verify that the target folder and its parent share that organization. Asset filtering must use `folderId` plus the active `orgId`; deletion should either reparent children or refuse to delete non-empty folders according to a documented rule.

The present UI and endpoint quarantine should remain in place until this replacement is implemented. Existing media assets are still safely managed at the organization level; only structured folder creation and browsing are intentionally unavailable.
