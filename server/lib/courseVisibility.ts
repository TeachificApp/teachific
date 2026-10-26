const COURSE_ADMIN_PREVIEW_ROLES = new Set([
  "site_owner",
  "site_admin",
  "admin",
  "org_super_admin",
  "org_admin",
  "sub_admin",
]);

/**
 * Non-public courses can only be previewed by an administrator while their
 * active organization matches the owning organization. Public and hidden
 * course landing pages remain governed by the public request domain.
 */
export function canPreviewNonPublicCourseInActiveOrg(input: {
  role: string | null | undefined;
  activeOrgId: number | null | undefined;
  courseOrgId: number;
}): boolean {
  return COURSE_ADMIN_PREVIEW_ROLES.has(input.role ?? "")
    && input.activeOrgId != null
    && input.activeOrgId === input.courseOrgId;
}
