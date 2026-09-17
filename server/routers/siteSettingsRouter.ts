import { router } from "../_core/trpc";

/**
 * Reserved router namespace retained for backwards-compatible application
 * composition. Course360 does not inject source-project or platform-wide Meta
 * pixels on organization surfaces; analytics integrations must be configured
 * through an organization-owned contract.
 */
export const siteSettingsRouter = router({});
