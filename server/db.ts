import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { CANONICAL_FEATURE_KEYS } from "../shared/tierLimits";
import { drizzle } from "drizzle-orm/mysql2";
import {
  accreditationFormBranchRules,
  accreditationFormItems,
  accreditationFormOptions,
  accreditationFormOrgVisibilityRules,
  accreditationFormSections,
  accreditationFormSubmissions,
  accreditationFormTemplateAssignments,
  accreditationFormTemplates,
  accreditationReadiness,
  accreditationReadinessNavigator,
  analyticsEvents,
  contentFolders,
  contentPackages,
  contentVersions,
  fileAssets,
  InsertContentFolder,
  InsertUser,
  orgLimitOverrides,
  orgMediaLibrary,
  orgMembers,
  orgSubscriptions,
  organizations,
  permissions,
  playSessions,
  platformSettings,
  scormData,
  subscriptionPlanLimits,
  diyOrganizations,
  labSubscriptions,
  userRoles,
  userActiveOrg,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ─────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }

  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }

  // Auto-promote owner to site_owner
  if (user.openId === ENV.ownerOpenId) {
    values.role = "site_owner";
    updateSet.role = "site_owner";
  } else if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0];
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result[0];
}

export async function createManualUser(data: {
  openId: string;
  name: string;
  email: string;
  passwordHash: string;
  role: "site_admin" | "org_super_admin" | "org_admin" | "member" | "user";
  loginMethod: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  await db.insert(users).values({
    openId: data.openId,
    name: data.name,
    email: data.email,
    passwordHash: data.passwordHash,
    role: data.role,
    loginMethod: data.loginMethod,
    emailVerified: true,
    lastSignedIn: new Date(),
  });
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(users).orderBy(desc(users.createdAt));
}

export async function updateUserRole(userId: number, role: "site_owner" | "site_admin" | "org_super_admin" | "org_admin" | "member" | "user") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}
export async function updateUser(userId: number, data: { name?: string; email?: string; role?: "site_owner" | "site_admin" | "org_super_admin" | "org_admin" | "member" | "user"; quizCreatorAccess?: "none" | "web" | "desktop" | "bundle" }) {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set(data).where(eq(users.id, userId));
}
export async function deleteUser(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(users).where(eq(users.id, userId));
}
export async function getPlatformSettings() {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(platformSettings).where(eq(platformSettings.id, 1)).limit(1);
  return rows[0] ?? null;
}
export async function updatePlatformSettings(data: Partial<typeof platformSettings.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(platformSettings).set(data).where(eq(platformSettings.id, 1));
  return getPlatformSettings();
}

// ─── Organizations ─────────────────────────────────────────────────────────────
export async function createOrg(data: {
  name: string;
  slug: string;
  description?: string;
  ownerId: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(organizations).values(data);
  return result[0];
}

export async function getOrgById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(organizations).where(eq(organizations.id, id)).limit(1);
  return result[0];
}

export async function getOrgBySlug(slug: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(organizations).where(eq(organizations.slug, slug)).limit(1);
  return result[0];
}

export async function getAllOrgs() {
  const db = await getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      slug: organizations.slug,
      description: organizations.description,
      logoUrl: organizations.logoUrl,
      customDomain: organizations.customDomain,
      ownerId: organizations.ownerId,
      isActive: organizations.isActive,
      createdAt: organizations.createdAt,
      updatedAt: organizations.updatedAt,
      plan: orgSubscriptions.plan,
      subStatus: orgSubscriptions.status,
      ownerName: users.name,
      ownerEmail: users.email,
      isPrimary: organizations.isPrimary,
      memberCount: sql<number>`(SELECT COUNT(*) FROM org_members WHERE org_members.orgId = ${organizations.id})`,
    })
    .from(organizations)
    .leftJoin(orgSubscriptions, eq(orgSubscriptions.orgId, organizations.id))
    .leftJoin(users, eq(users.id, organizations.ownerId))
    // isPrimary orgs first so site_owner always auto-selects the platform org
    .orderBy(desc(organizations.isPrimary), desc(organizations.createdAt));
  return rows;
}

export async function updateOrg(id: number, data: Partial<typeof organizations.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(organizations).set(data).where(eq(organizations.id, id));
}

export async function deleteOrg(id: number) {
  const db = await getDb();
  if (!db) return;
  // Remove all members first, then delete the org
  await db.delete(orgMembers).where(eq(orgMembers.orgId, id));
  await db.delete(organizations).where(eq(organizations.id, id));
}

export async function getOrgsByUserId(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const members = await db.select().from(orgMembers).where(eq(orgMembers.userId, userId));
  if (members.length === 0) return [];
  const orgIds = members.map((m) => m.orgId);
  // Order: primary org first, then by name alphabetically.
  const orgs = await db.select().from(organizations).where(inArray(organizations.id, orgIds));
  return orgs.sort((a, b) => {
    const aPrimary = a.isPrimary ? 0 : 1;
    const bPrimary = b.isPrimary ? 0 : 1;
    if (aPrimary !== bPrimary) return aPrimary - bPrimary;
    return a.name.localeCompare(b.name);
  });
}

/** Returns the primary orgId for a user.
 * Priority order:
 * 1. Org where user has role = org_super_admin
 * 2. Org where user has role = org_admin
 * 3. Org marked as isPrimary
 * 4. First membership row (fallback)
 * This ensures org_super_admin users always land in their own org, not a platform org they were accidentally added to as a plain member.
 */
export async function getOrgIdForUser(userId: number): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  // Check if user has an explicitly selected active org (from org switcher)
  const [activeRow] = await db
    .select({ orgId: userActiveOrg.orgId })
    .from(userActiveOrg)
    .where(eq(userActiveOrg.userId, userId))
    .limit(1);
  if (activeRow?.orgId) {
    // Verify the user still has membership in this org
    const [membership] = await db
      .select({ orgId: orgMembers.orgId })
      .from(orgMembers)
      .where(and(eq(orgMembers.userId, userId), eq(orgMembers.orgId, activeRow.orgId)))
      .limit(1);
    if (membership) return membership.orgId;
    // Active org no longer valid — fall through to membership-based resolution
  }
  // Get all memberships ordered by role priority
  const allMemberships = await db
    .select({ orgId: orgMembers.orgId, role: orgMembers.role, isPrimary: organizations.isPrimary })
    .from(orgMembers)
    .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
    .where(eq(orgMembers.userId, userId));
  if (allMemberships.length === 0) return null;
  // Role priority: org_super_admin > org_admin > sub_admin > instructor > member/user
  const ROLE_PRIORITY: Record<string, number> = {
    org_super_admin: 100,
    org_admin: 90,
    sub_admin: 70,
    instructor: 60,
    group_manager: 50,
    group_member: 40,
    member: 20,
    user: 10,
  };
  // Sort: highest role first, then isPrimary as tiebreaker
  const sorted = [...allMemberships].sort((a, b) => {
    const pa = ROLE_PRIORITY[a.role] ?? 0;
    const pb = ROLE_PRIORITY[b.role] ?? 0;
    if (pb !== pa) return pb - pa;
    // Tiebreak: prefer non-primary (personal workspace) orgs for platform members
    if (a.isPrimary && !b.isPrimary) return 1;
    if (!a.isPrimary && b.isPrimary) return -1;
    return 0;
  });
  return sorted[0].orgId;
}

/**
 * Returns the ID of the primary (platform) org.
 * Used as fallback for site_owner/site_admin users who have no orgMembers row.
 */
export async function getPrimaryOrgId(): Promise<number | null> {
  const db = await getDb();
  if (!db) return null;
  const result = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.isPrimary, true))
    .limit(1);
  return result[0]?.id ?? null;
}

/**
 * Returns the org ID for a user, with a fallback to the primary org for platform admins.
 * This ensures site_owner/site_admin always see their own platform org's content,
 * even if they have no orgMembers row.
 */
export async function getOrgIdForUserWithFallback(
  userId: number,
  userRole: string
): Promise<number | null> {
  // For platform admins, check userActiveOrg first (respects org switcher)
  if (userRole === "site_owner" || userRole === "site_admin") {
    const db = await getDb();
    if (db) {
      const [activeRow] = await db
        .select({ orgId: userActiveOrg.orgId })
        .from(userActiveOrg)
        .where(eq(userActiveOrg.userId, userId))
        .limit(1);
      if (activeRow?.orgId) return activeRow.orgId;
    }
    // No active org preference — fall back to primary org
    return getPrimaryOrgId();
  }
  const orgId = await getOrgIdForUser(userId);
  return orgId;
}

/**
 * Shared helper: verify the current user has org admin access.
 * - Platform admins (users.role === 'admin') are always allowed.
 * - Org admins/super admins are allowed for their own org.
 * - If orgIdHint is provided, verifies the user is an admin of that specific org.
 * - If no orgIdHint, resolves the user's highest-priority admin org.
 * Returns the orgId the user is authorised to act on.
 * Throws TRPCError FORBIDDEN if the user has no admin access.
 */
export async function requireOrgAdmin(
  userId: number,
  platformRole: string,
  orgIdHint?: number
): Promise<number> {
  const db = await getDb();
  const ORG_ADMIN_ROLES = ["org_super_admin", "org_admin", "sub_admin"];
  // Platform admins bypass org check
  if (platformRole === "site_owner" || platformRole === "site_admin" || platformRole === "admin") {
    if (orgIdHint) return orgIdHint;
    // Use fallback to primary org for platform admins with no membership row
    const orgId = await getOrgIdForUserWithFallback(userId, platformRole);
    if (!orgId) {
      const { TRPCError } = await import("@trpc/server");
      throw new TRPCError({ code: "FORBIDDEN", message: "No organisation found" });
    }
    return orgId;
  }
  if (orgIdHint && db) {
    const [membership] = await db
      .select({ role: orgMembers.role })
      .from(orgMembers)
      .where(and(eq(orgMembers.userId, userId), eq(orgMembers.orgId, orgIdHint)))
      .limit(1);
    if (!membership || !ORG_ADMIN_ROLES.includes(membership.role)) {
      const { TRPCError } = await import("@trpc/server");
      throw new TRPCError({ code: "FORBIDDEN", message: "You do not have admin access to this organisation" });
    }
    return orgIdHint;
  }
  // No orgId hint — find the user's highest-role admin org
  if (!db) {
    const { TRPCError } = await import("@trpc/server");
    throw new TRPCError({ code: "FORBIDDEN", message: "Database unavailable" });
  }
  const memberships = await db
    .select({ orgId: orgMembers.orgId, role: orgMembers.role })
    .from(orgMembers)
    .where(eq(orgMembers.userId, userId));
  const adminMemberships = memberships.filter(m => ORG_ADMIN_ROLES.includes(m.role));
  if (adminMemberships.length === 0) {
    const { TRPCError } = await import("@trpc/server");
    throw new TRPCError({ code: "FORBIDDEN", message: "You need org admin access to perform this action" });
  }
  const ROLE_PRIORITY: Record<string, number> = { org_super_admin: 100, org_admin: 90, sub_admin: 70 };
  adminMemberships.sort((a, b) => (ROLE_PRIORITY[b.role] ?? 0) - (ROLE_PRIORITY[a.role] ?? 0));
  return adminMemberships[0].orgId;
}

/** Returns true for site_owner / site_admin / admin (platform-wide admins who can see all orgs) */
export function isPlatformAdmin(role: string | undefined): boolean {
  return ["site_owner", "site_admin", "admin"].includes(role ?? "");
}

// ─── Org Members ───────────────────────────────────────────────────────────────
export async function addOrgMember(orgId: number, userId: number, role: "org_super_admin" | "org_admin" | "member" | "user", invitedBy?: number, memberSubRole?: "basic_member" | "instructor" | "group_manager" | "group_member") {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(orgMembers).values({ orgId, userId, role, invitedBy, memberSubRole: memberSubRole ?? "basic_member" }).onDuplicateKeyUpdate({ set: { role, memberSubRole: memberSubRole ?? "basic_member" } });
  // Sync users.role so ctx.user.role reflects the org role for middleware checks.
  const [currentUser] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  const currentUserRole = currentUser?.role ?? "user";
  const isPlatformLevel = ["site_owner", "site_admin"].includes(currentUserRole);
  if (!isPlatformLevel) {
    const newUserRole = role === "org_super_admin" ? "org_super_admin" : role === "org_admin" ? "org_admin" : "user";
    await db.update(users).set({ role: newUserRole }).where(eq(users.id, userId));
  }
  // Dispatch Zapier new_member event (non-blocking)
  import("./zapierRouter").then(({ dispatchZapierEvent }) => {
    dispatchZapierEvent(orgId, "new_member", {
      user_id: userId,
      org_id: orgId,
      role,
      member_sub_role: memberSubRole ?? "basic_member",
      joined_at: new Date().toISOString(),
    });
  }).catch(() => {});
}

export async function getOrgMembers(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orgMembers).where(eq(orgMembers.orgId, orgId));
}

export async function getOrgMember(orgId: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(orgMembers)
    .where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)))
    .limit(1);
  return result[0];
}

export async function removeOrgMember(orgId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(orgMembers).where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)));
}

export async function updateOrgMemberRole(orgId: number, userId: number, role: "org_super_admin" | "org_admin" | "member" | "user", memberSubRole?: "basic_member" | "instructor" | "group_manager" | "group_member") {
  const db = await getDb();
  if (!db) return;
  const updateData: Record<string, unknown> = { role };
  if (memberSubRole) updateData.memberSubRole = memberSubRole;
  await db.update(orgMembers).set(updateData as any).where(and(eq(orgMembers.orgId, orgId), eq(orgMembers.userId, userId)));
  // Sync users.role so ctx.user.role reflects the org role for middleware checks.
  // Only elevate if the current users.role is a plain member/user (don't downgrade site admins).
  const [currentUser] = await db.select({ role: users.role }).from(users).where(eq(users.id, userId)).limit(1);
  const currentUserRole = currentUser?.role ?? "user";
  const isPlatformLevel = ["site_owner", "site_admin"].includes(currentUserRole);
  if (!isPlatformLevel) {
    // Map org_members role → users.role
    let newUserRole: typeof currentUserRole;
    if (role === "org_super_admin") newUserRole = "org_super_admin";
    else if (role === "org_admin") newUserRole = "org_admin";
    else newUserRole = "user";
    await db.update(users).set({ role: newUserRole }).where(eq(users.id, userId));
  }
}

// ─── Content Packages ──────────────────────────────────────────────────────────
export async function createPackage(data: typeof contentPackages.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(contentPackages).values(data);
  return result[0];
}

export async function getPackageById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(contentPackages).where(eq(contentPackages.id, id)).limit(1);
  return result[0];
}

export async function getPackagesByOrg(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contentPackages).where(eq(contentPackages.orgId, orgId)).orderBy(desc(contentPackages.createdAt));
}

export async function getAllPackages() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contentPackages).orderBy(desc(contentPackages.createdAt));
}

export async function updatePackage(id: number, data: Partial<typeof contentPackages.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(contentPackages).set(data).where(eq(contentPackages.id, id));
}

export async function deletePackage(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(contentPackages).where(eq(contentPackages.id, id));
}

export async function incrementPlayCount(packageId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(contentPackages)
    .set({ totalPlayCount: sql`totalPlayCount + 1` })
    .where(eq(contentPackages.id, packageId));
}

export async function incrementDownloadCount(packageId: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(contentPackages)
    .set({ totalDownloadCount: sql`totalDownloadCount + 1` })
    .where(eq(contentPackages.id, packageId));
}

// ─── Content Versions ──────────────────────────────────────────────────────────
export async function createVersion(data: typeof contentVersions.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(contentVersions).values(data);
  return result[0];
}

export async function getVersionsByPackage(packageId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contentVersions)
    .where(eq(contentVersions.packageId, packageId))
    .orderBy(desc(contentVersions.versionNumber));
}

export async function getVersionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(contentVersions).where(eq(contentVersions.id, id)).limit(1);
  return result[0];
}

export async function getLatestVersionNumber(packageId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const versions = await db.select().from(contentVersions)
    .where(eq(contentVersions.packageId, packageId))
    .orderBy(desc(contentVersions.versionNumber))
    .limit(1);
  return versions[0]?.versionNumber ?? 0;
}

export async function setVersionReplacedAt(versionId: number, replacedAt: Date | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(contentVersions).set({ replacedAt }).where(eq(contentVersions.id, versionId));
}

export async function deleteVersionAssets(versionId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(fileAssets).where(eq(fileAssets.versionId, versionId));
  await db.delete(contentVersions).where(eq(contentVersions.id, versionId));
}

// ─── File Assets ───────────────────────────────────────────────────────────────
export async function createFileAsset(data: typeof fileAssets.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(fileAssets).values(data);
}

export async function getFileAssetsByVersion(versionId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(fileAssets).where(eq(fileAssets.versionId, versionId));
}

export async function getEntryPointAsset(versionId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(fileAssets)
    .where(and(eq(fileAssets.versionId, versionId), eq(fileAssets.isEntryPoint, true)))
    .limit(1);
  return result[0];
}

// ─── Permissions ───────────────────────────────────────────────────────────────
export async function createPermissions(packageId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(permissions).values({ packageId });
}

export async function getPermissions(packageId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(permissions).where(eq(permissions.packageId, packageId)).limit(1);
  return result[0];
}

export async function updatePermissions(packageId: number, data: Partial<typeof permissions.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(permissions).set(data).where(eq(permissions.packageId, packageId));
}

// ─── Play Sessions ─────────────────────────────────────────────────────────────
export async function createPlaySession(data: typeof playSessions.$inferInsert) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(playSessions).values(data);
  return result[0];
}

export async function getPlaySession(sessionToken: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(playSessions).where(eq(playSessions.sessionToken, sessionToken)).limit(1);
  return result[0];
}

export async function updatePlaySession(sessionToken: string, data: Partial<typeof playSessions.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(playSessions).set(data).where(eq(playSessions.sessionToken, sessionToken));
}

export async function getPlaySessionsByPackage(packageId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(playSessions)
    .where(eq(playSessions.packageId, packageId))
    .orderBy(desc(playSessions.startedAt))
    .limit(limit);
}

export async function getUserPlayCount(packageId: number, userId: number): Promise<number> {
  const db = await getDb();
  if (!db) return 0;
  const result = await db.select({ count: sql<number>`count(*)` })
    .from(playSessions)
    .where(and(eq(playSessions.packageId, packageId), eq(playSessions.userId, userId)));
  return result[0]?.count ?? 0;
}

// ─── SCORM Data ────────────────────────────────────────────────────────────────
export async function upsertScormData(sessionId: number, packageId: number, userId: number | undefined, data: {
  cmiData?: string;
  suspendData?: string;
  lessonStatus?: string;
  lessonLocation?: string;
  score?: number;
  totalTime?: string;
}) {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(scormData).where(eq(scormData.sessionId, sessionId)).limit(1);
  if (existing.length > 0) {
    await db.update(scormData).set(data).where(eq(scormData.sessionId, sessionId));
  } else {
    await db.insert(scormData).values({ sessionId, packageId, userId, ...data });
  }
}

export async function getScormData(sessionId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(scormData).where(eq(scormData.sessionId, sessionId)).limit(1);
  return result[0];
}

// ─── Analytics Events ──────────────────────────────────────────────────────────
export async function logAnalyticsEvent(data: typeof analyticsEvents.$inferInsert) {
  const db = await getDb();
  if (!db) return;
  await db.insert(analyticsEvents).values(data);
}

export async function getAnalyticsByPackage(packageId: number, limit = 500) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(analyticsEvents)
    .where(eq(analyticsEvents.packageId, packageId))
    .orderBy(desc(analyticsEvents.occurredAt))
    .limit(limit);
}

export async function getAnalyticsByOrg(orgId: number, limit = 1000) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(analyticsEvents)
    .where(eq(analyticsEvents.orgId, orgId))
    .orderBy(desc(analyticsEvents.occurredAt))
    .limit(limit);
}

export async function getAnalyticsSummary(orgId?: number) {
  const db = await getDb();
  if (!db) return { totalPlays: 0, totalDownloads: 0, totalCompletions: 0 };

  const baseQuery = orgId
    ? db.select({ eventType: analyticsEvents.eventType, count: sql<number>`count(*)` })
        .from(analyticsEvents)
        .where(eq(analyticsEvents.orgId, orgId))
        .groupBy(analyticsEvents.eventType)
    : db.select({ eventType: analyticsEvents.eventType, count: sql<number>`count(*)` })
        .from(analyticsEvents)
        .groupBy(analyticsEvents.eventType);

  const rows = await baseQuery;
  const map = Object.fromEntries(rows.map((r) => [r.eventType, r.count]));
  return {
    totalPlays: (map["play_start"] ?? 0),
    totalDownloads: (map["download"] ?? 0),
    totalCompletions: (map["scorm_complete"] ?? 0) + (map["scorm_pass"] ?? 0),
  };
}

// ─── Content Folders ───────────────────────────────────────────────────────────
export async function getFoldersByOrg(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(contentFolders)
    .where(eq(contentFolders.orgId, orgId))
    .orderBy(contentFolders.sortOrder, contentFolders.name);
}

export async function getFolderById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(contentFolders).where(eq(contentFolders.id, id)).limit(1);
  return rows[0];
}

export async function createFolder(data: InsertContentFolder) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(contentFolders).values(data);
  const id = (result[0] as any).insertId as number;
  const rows = await db.select().from(contentFolders).where(eq(contentFolders.id, id)).limit(1);
  return rows[0];
}

export async function updateFolder(id: number, data: Partial<InsertContentFolder>) {
  const db = await getDb();
  if (!db) return;
  await db.update(contentFolders).set(data).where(eq(contentFolders.id, id));
}

export async function deleteFolder(id: number) {
  const db = await getDb();
  if (!db) return;
  // Move all child folders to the parent of the deleted folder
  const folder = await getFolderById(id);
  if (folder) {
    await db.update(contentFolders)
      .set({ parentId: folder.parentId ?? null })
      .where(eq(contentFolders.parentId, id));
    // Move all packages in this folder to uncategorized (null)
    await db.update(contentPackages)
      .set({ folderId: null })
      .where(eq(contentPackages.folderId, id));
  }
  await db.delete(contentFolders).where(eq(contentFolders.id, id));
}

export async function movePackageToFolder(packageId: number, folderId: number | null) {
  const db = await getDb();
  if (!db) return;
  await db.update(contentPackages)
    .set({ folderId: folderId ?? null })
    .where(eq(contentPackages.id, packageId));
}

// ─── Subscription Plan Limits ──────────────────────────────────────────────────
/** Returns all rows for all plans, ordered by plan then featureKey */
export async function getPlanLimits() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(subscriptionPlanLimits).orderBy(subscriptionPlanLimits.plan, subscriptionPlanLimits.featureKey);
}

/** Upsert a single plan-limit row (insert or update limitValue + featureLabel) */
export async function upsertPlanLimit(data: {
  plan: "free" | "starter" | "builder" | "pro" | "enterprise";
  featureKey: string;
  featureLabel: string;
  limitValue: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(subscriptionPlanLimits)
    .values(data)
    .onDuplicateKeyUpdate({ set: { limitValue: data.limitValue, featureLabel: data.featureLabel } });
}

// ─── Org Limit Overrides ───────────────────────────────────────────────────────
/** Returns all overrides for a given org */
export async function getOrgLimitOverrides(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(orgLimitOverrides).where(eq(orgLimitOverrides.orgId, orgId));
}

/** Upsert a per-org limit override */
export async function upsertOrgLimitOverride(data: {
  orgId: number;
  featureKey: string;
  limitValue: number;
  overriddenByUserId?: number;
  note?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Try update first, then insert
  const existing = await db.select({ id: orgLimitOverrides.id })
    .from(orgLimitOverrides)
    .where(and(eq(orgLimitOverrides.orgId, data.orgId), eq(orgLimitOverrides.featureKey, data.featureKey)))
    .limit(1);
  if (existing.length > 0) {
    await db.update(orgLimitOverrides)
      .set({ limitValue: data.limitValue, overriddenByUserId: data.overriddenByUserId ?? null, note: data.note ?? null })
      .where(eq(orgLimitOverrides.id, existing[0].id));
  } else {
    await db.insert(orgLimitOverrides).values({
      orgId: data.orgId,
      featureKey: data.featureKey,
      limitValue: data.limitValue,
      overriddenByUserId: data.overriddenByUserId ?? null,
      note: data.note ?? null,
    });
  }
}

/** Returns plan limits merged with org overrides for a given org.
 * Uses CANONICAL_FEATURE_KEYS as the authoritative list of features.
 * Each row has featureKey, featureLabel, planDefault, limitValue (effective), isOverride.
 */
export async function getOrgLimitsEnriched(orgId: number) {
  const db = await getDb();
  if (!db) return [];
  // Get org's current plan
  const subRows = await db.select({ plan: orgSubscriptions.plan })
    .from(orgSubscriptions)
    .where(eq(orgSubscriptions.orgId, orgId))
    .limit(1);
  const plan = subRows[0]?.plan ?? "free";
  // Get plan limits for that plan (only canonical feature keys)
  const canonicalKeys = CANONICAL_FEATURE_KEYS.map(f => f.key);
  const planLimits = await db.select()
    .from(subscriptionPlanLimits)
    .where(and(
      eq(subscriptionPlanLimits.plan, plan),
      inArray(subscriptionPlanLimits.featureKey, canonicalKeys)
    ))
    .orderBy(subscriptionPlanLimits.featureKey);
  // Build a map of plan defaults from DB
  const planMap = new Map(planLimits.map(pl => [pl.featureKey, pl.limitValue]));
  // Get org overrides
  const overrides = await db.select()
    .from(orgLimitOverrides)
    .where(eq(orgLimitOverrides.orgId, orgId));
  const overrideMap = new Map(overrides.map(o => [o.featureKey, o.limitValue]));
  // Return rows for ALL canonical features (using DB plan default or 0 if not seeded yet)
  return CANONICAL_FEATURE_KEYS.map(f => {
    const planDefault = planMap.get(f.key) ?? 0;
    const hasOverride = overrideMap.has(f.key);
    return {
      featureKey: f.key,
      featureLabel: f.label,
      planDefault,
      limitValue: hasOverride ? overrideMap.get(f.key)! : planDefault,
      isOverride: hasOverride,
      plan,
    };
  });
}

/** Delete a per-org limit override (reverts to plan default) */
export async function deleteOrgLimitOverride(orgId: number, featureKey: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(orgLimitOverrides)
    .where(and(eq(orgLimitOverrides.orgId, orgId), eq(orgLimitOverrides.featureKey, featureKey)));
}

// ─── Storage Usage ────────────────────────────────────────────────────────────
/**
 * Returns total bytes used by an org across SCORM file assets and media library items,
 * plus the org's storage quota derived from their active subscription plan.
 * Returns maxBytes = -1 for unlimited (Enterprise).
 */
export async function getOrgStorageUsage(orgId: number): Promise<{ usedBytes: number; maxBytes: number }> {
  const db = await getDb();
  if (!db) return { usedBytes: 0, maxBytes: 100 * 1024 * 1024 * 1024 }; // default 100 GB (free tier)

  // Sum file sizes from SCORM file assets (via contentPackages)
  const [scormResult] = await db
    .select({ total: sql<number>`COALESCE(SUM(${fileAssets.fileSize}), 0)` })
    .from(fileAssets)
    .innerJoin(contentPackages, eq(fileAssets.packageId, contentPackages.id))
    .where(eq(contentPackages.orgId, orgId));

  // Sum file sizes from org media library
  const [mediaResult] = await db
    .select({ total: sql<number>`COALESCE(SUM(${orgMediaLibrary.fileSize}), 0)` })
    .from(orgMediaLibrary)
    .where(eq(orgMediaLibrary.orgId, orgId));

  // Derive quota from the org's active subscription plan
  const { PLAN_LIMITS } = await import("./stripePlans");
  const { orgSubscriptions } = await import("../drizzle/schema");
  const [sub] = await db.select().from(orgSubscriptions).where(eq(orgSubscriptions.orgId, orgId)).limit(1);
  const planTier = (sub?.plan ?? "free") as keyof typeof PLAN_LIMITS;
  const maxBytes = PLAN_LIMITS[planTier]?.maxStorageBytes ?? 100 * 1024 * 1024 * 1024; // default 100 GB

  const usedBytes = Number(scormResult?.total ?? 0) + Number(mediaResult?.total ?? 0);
  return { usedBytes, maxBytes };
}

// ─── Delete Org (cascade) ──────────────────────────────────────────────────────
export async function deleteOrgCascade(orgId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Remove related rows before deleting the org
  await db.delete(orgMembers).where(eq(orgMembers.orgId, orgId));
  await db.delete(orgSubscriptions).where(eq(orgSubscriptions.orgId, orgId));
  await db.delete(orgLimitOverrides).where(eq(orgLimitOverrides.orgId, orgId));
  await db.delete(organizations).where(eq(organizations.id, orgId));
}

// ─── Support Tickets ──────────────────────────────────────────────────────────
export async function createSupportTicket(data: {
  name: string;
  email: string;
  userId?: number;
  subject: string;
  category: "general" | "billing" | "technical" | "account" | "other";
  message: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const { supportTickets } = await import("../drizzle/schema");
  const [result] = await db.insert(supportTickets).values(data);
  return result;
}

export async function getSupportTickets(opts?: { status?: string; limit?: number; offset?: number }) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const { supportTickets } = await import("../drizzle/schema");
  const { desc: descOrd, eq: eqOp } = await import("drizzle-orm");
  let q = db.select().from(supportTickets).$dynamic();
  if (opts?.status) q = q.where(eqOp(supportTickets.status, opts.status as any));
  return q.orderBy(descOrd(supportTickets.createdAt)).limit(opts?.limit ?? 50).offset(opts?.offset ?? 0);
}

export async function updateSupportTicketStatus(id: number, status: "open" | "in_progress" | "resolved" | "closed", staffNotes?: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const { supportTickets } = await import("../drizzle/schema");
  const { eq: eqOp } = await import("drizzle-orm");
  await db.update(supportTickets).set({ status, ...(staffNotes !== undefined ? { staffNotes } : {}) }).where(eqOp(supportTickets.id, id));
}

export async function getOrCreateUserByEmail(opts: {
  email: string;
  name?: string;
}): Promise<{ user: { id: number; email: string | null; name: string | null }; isNew: boolean; resetToken: string | null }> {
  const db = await getDb();
  if (!db) throw new Error("Database unavailable");
  const existing = await getUserByEmail(opts.email);
  if (existing) {
    return { user: existing as any, isNew: false, resetToken: null };
  }
  const { randomBytes } = await import("crypto");
  const resetToken = randomBytes(32).toString("hex");
  const resetExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const displayName = opts.name || opts.email.split("@")[0];
  const openId = `email_${opts.email.replace(/[^a-z0-9]/gi, "_")}_${Date.now()}`;
  await db.insert(users).values({
    openId,
    email: opts.email,
    name: displayName,
    loginMethod: "email",
    emailVerified: true,
    resetToken,
    resetTokenExpiry: resetExpiry,
    lastSignedIn: new Date(),
  });
  const [newUser] = await db.select().from(users).where(eq(users.email, opts.email)).limit(1);
  return { user: newUser as any, isNew: true, resetToken };
}

export async function getOrCreateAccessToken(userId: number): Promise<string> {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.select({ accessToken: users.accessToken }).from(users).where(eq(users.id, userId)).limit(1);
  const existing = result[0]?.accessToken;
  if (existing) return existing;
  const { randomBytes } = await import("crypto");
  const token = randomBytes(32).toString("hex");
  await db.update(users).set({ accessToken: token } as any).where(eq(users.id, userId));
  return token;
}

export async function searchUsersByQuery(query: string, limit = 10): Promise<Array<{
  id: number;
  name: string | null;
  displayName: string | null;
  email: string | null;
}>> {
  const db = await getDb();
  if (!db) return [];
  const q = `%${query.trim()}%`;
  return db.select({
    id: users.id,
    name: users.name,
    displayName: users.displayName,
    email: users.email,
  }).from(users)
    .where(sql`(${users.name} LIKE ${q} OR ${users.displayName} LIKE ${q} OR ${users.email} LIKE ${q})`)
    .limit(limit);
}

// ─── User Roles helpers ───────────────────────────────────────────────────────
export type AppRole = "user" | "premium_user" | "diy_admin" | "diy_user" | "platform_admin" | "accreditation_manager" | "education_manager" | "education_admin" | "education_student" | "platform_owner" | "platform_moderator" | "instructor" | "team_admin" | "affiliate";

export async function getUserRoles(userId: number): Promise<AppRole[]> {
  const db = await getDb();
  if (!db) return [];
  const rows = await db.select().from(userRoles).where(eq(userRoles.userId, userId));
  return rows.map(r => r.role as AppRole);
}

export async function ensureUserRole(userId: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(userRoles)
    .where(and(eq(userRoles.userId, userId), eq(userRoles.role, "user"))).limit(1);
  if (existing.length > 0) return;
  await db.insert(userRoles).values({ userId, role: "user", assignedByUserId: userId });
}

/** No-op stub: Thinkific is not used in Teachific */
export async function markThinkificEnrolled(_userId: number): Promise<void> {
  // Not applicable in Teachific
}


// ─── Form Builder & Accreditation DB Helpers (ported from UA) ───────────────

export async function listFormTemplates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(accreditationFormTemplates).orderBy(accreditationFormTemplates.name);
}

export async function getFormTemplateById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(accreditationFormTemplates).where(eq(accreditationFormTemplates.id, id));
  return rows[0] ?? null;
}

export async function createFormTemplate(data: InsertAccreditationFormTemplate) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(accreditationFormTemplates).values(data);
  return (result as any).insertId as number;
}

export async function updateFormTemplate(id: number, data: Partial<InsertAccreditationFormTemplate>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(accreditationFormTemplates).set({ ...data, updatedAt: new Date() }).where(eq(accreditationFormTemplates.id, id));
}

export async function deleteFormTemplate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Cascade delete all related data
  const sections = await db.select({ id: accreditationFormSections.id }).from(accreditationFormSections).where(eq(accreditationFormSections.templateId, id));
  for (const s of sections) {
    const items = await db.select({ id: accreditationFormItems.id }).from(accreditationFormItems).where(eq(accreditationFormItems.sectionId, s.id));
    for (const item of items) {
      await db.delete(accreditationFormOptions).where(eq(accreditationFormOptions.itemId, item.id));
    }
    await db.delete(accreditationFormItems).where(eq(accreditationFormItems.sectionId, s.id));
  }
  await db.delete(accreditationFormSections).where(eq(accreditationFormSections.templateId, id));
  await db.delete(accreditationFormBranchRules).where(eq(accreditationFormBranchRules.templateId, id));
  await db.delete(accreditationFormTemplates).where(eq(accreditationFormTemplates.id, id));
}

export async function getFullFormTemplate(id: number) {
  const db = await getDb();
  if (!db) return null;
  const template = await getFormTemplateById(id);
  if (!template) return null;
  const sections = await db.select().from(accreditationFormSections).where(eq(accreditationFormSections.templateId, id)).orderBy(accreditationFormSections.sortOrder);
  const items = await db.select().from(accreditationFormItems).where(eq(accreditationFormItems.templateId, id)).orderBy(accreditationFormItems.sortOrder);
  const itemIds = items.map(i => i.id);
  const options = itemIds.length > 0 ? await db.select().from(accreditationFormOptions).where(inArray(accreditationFormOptions.itemId, itemIds)).orderBy(accreditationFormOptions.sortOrder) : [];
  const branchRules = await db.select().from(accreditationFormBranchRules).where(eq(accreditationFormBranchRules.templateId, id));
  return { template, sections, items, options, branchRules };
}

export async function createFormSection(data: InsertAccreditationFormSection) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(accreditationFormSections).values(data);
  return (result as any).insertId as number;
}

export async function updateFormSection(id: number, data: Partial<InsertAccreditationFormSection>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(accreditationFormSections).set(data).where(eq(accreditationFormSections.id, id));
}

export async function deleteFormSection(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const items = await db.select({ id: accreditationFormItems.id }).from(accreditationFormItems).where(eq(accreditationFormItems.sectionId, id));
  for (const item of items) {
    await db.delete(accreditationFormOptions).where(eq(accreditationFormOptions.itemId, item.id));
  }
  await db.delete(accreditationFormItems).where(eq(accreditationFormItems.sectionId, id));
  await db.delete(accreditationFormSections).where(eq(accreditationFormSections.id, id));
}

export async function reorderFormSections(sectionOrders: { id: number; sortOrder: number }[]) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  for (const { id, sortOrder } of sectionOrders) {
    await db.update(accreditationFormSections).set({ sortOrder }).where(eq(accreditationFormSections.id, id));
  }
}

export async function createFormItem(data: InsertAccreditationFormItem) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(accreditationFormItems).values(data);
  return (result as any).insertId as number;
}

export async function updateFormItem(id: number, data: Partial<InsertAccreditationFormItem>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(accreditationFormItems).set(data).where(eq(accreditationFormItems.id, id));
}

export async function deleteFormItem(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(accreditationFormOptions).where(eq(accreditationFormOptions.itemId, id));
  await db.delete(accreditationFormBranchRules).where(
    or(eq(accreditationFormBranchRules.targetItemId, id), eq(accreditationFormBranchRules.conditionItemId, id))
  );
  await db.delete(accreditationFormItems).where(eq(accreditationFormItems.id, id));
}

export async function reorderFormItems(itemOrders: { id: number; sortOrder: number; sectionId: number }[]) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  for (const { id, sortOrder, sectionId } of itemOrders) {
    await db.update(accreditationFormItems).set({ sortOrder, sectionId }).where(eq(accreditationFormItems.id, id));
  }
}

export async function createFormOption(data: InsertAccreditationFormOption) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(accreditationFormOptions).values(data);
  return (result as any).insertId as number;
}

export async function updateFormOption(id: number, data: Partial<InsertAccreditationFormOption>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(accreditationFormOptions).set(data).where(eq(accreditationFormOptions.id, id));
}

export async function deleteFormOption(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(accreditationFormOptions).where(eq(accreditationFormOptions.id, id));
}

export async function replaceFormOptions(itemId: number, options: Omit<InsertAccreditationFormOption, "itemId">[]) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(accreditationFormOptions).where(eq(accreditationFormOptions.itemId, itemId));
  if (options.length > 0) {
    await db.insert(accreditationFormOptions).values(options.map(o => ({ ...o, itemId })));
  }
}

export async function createFormBranchRule(data: InsertAccreditationFormBranchRule) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(accreditationFormBranchRules).values(data);
  return (result as any).insertId as number;
}

export async function updateFormBranchRule(id: number, data: Partial<InsertAccreditationFormBranchRule>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(accreditationFormBranchRules).set(data).where(eq(accreditationFormBranchRules.id, id));
}

export async function deleteFormBranchRule(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(accreditationFormBranchRules).where(eq(accreditationFormBranchRules.id, id));
}

export async function getFormBranchRulesByTemplate(templateId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(accreditationFormBranchRules).where(eq(accreditationFormBranchRules.templateId, templateId));
}

export async function listDiyOrganizations() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: diyOrganizations.id, name: diyOrganizations.name, accreditationTypes: diyOrganizations.accreditationTypes })
    .from(diyOrganizations)
    .orderBy(diyOrganizations.name);
}

export async function getOrgVisibilityRulesByTemplate(templateId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(accreditationFormOrgVisibilityRules).where(eq(accreditationFormOrgVisibilityRules.templateId, templateId));
}

export async function saveOrgVisibilityRules(templateId: number, rules: InsertAccreditationFormOrgVisibilityRule[]) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(accreditationFormOrgVisibilityRules).where(eq(accreditationFormOrgVisibilityRules.templateId, templateId));
  if (rules.length > 0) {
    await db.insert(accreditationFormOrgVisibilityRules).values(rules);
  }
}

export async function deleteOrgVisibilityRule(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(accreditationFormOrgVisibilityRules).where(eq(accreditationFormOrgVisibilityRules.id, id));
}

export async function getTemplateAssignments() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(accreditationFormTemplateAssignments).orderBy(accreditationFormTemplateAssignments.formType);
}

export async function getActiveFormMenuItems(orgId?: number) {
  const db = await getDb();
  if (!db) return [];
  // Get all active assignments, prefer org-specific over global
  const rows = await db.select({
    id: accreditationFormTemplateAssignments.id,
    formType: accreditationFormTemplateAssignments.formType,
    templateId: accreditationFormTemplateAssignments.templateId,
    orgId: accreditationFormTemplateAssignments.orgId,
    templateName: accreditationFormTemplates.name,
    templateDescription: accreditationFormTemplates.description,
  })
    .from(accreditationFormTemplateAssignments)
    .innerJoin(accreditationFormTemplates, eq(accreditationFormTemplateAssignments.templateId, accreditationFormTemplates.id))
    .where(eq(accreditationFormTemplateAssignments.isActive, true))
    .orderBy(accreditationFormTemplateAssignments.formType);
  // Deduplicate: prefer org-specific over global for same formType
  const seen = new Map<string, typeof rows[0]>();
  for (const row of rows) {
    const key = row.formType;
    const existing = seen.get(key);
    if (!existing || (row.orgId === orgId && existing.orgId !== orgId)) {
      seen.set(key, row);
    }
  }
  return Array.from(seen.values());
}

export async function upsertTemplateAssignment(data: InsertAccreditationFormTemplateAssignment) {
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  // Deactivate any existing assignment for same formType + orgId scope
  await db.update(accreditationFormTemplateAssignments)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(
      eq(accreditationFormTemplateAssignments.formType, data.formType),
      data.orgId
        ? eq(accreditationFormTemplateAssignments.orgId, data.orgId)
        : sql`${accreditationFormTemplateAssignments.orgId} IS NULL`
    ));
  const [result] = await db.insert(accreditationFormTemplateAssignments).values({ ...data, isActive: true });
  return (result as any).insertId as number;
}

export async function deleteTemplateAssignment(id: number) {
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  await db.delete(accreditationFormTemplateAssignments).where(eq(accreditationFormTemplateAssignments.id, id));
}

export async function createFormSubmission(data: InsertAccreditationFormSubmission) {
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  const [result] = await db.insert(accreditationFormSubmissions).values(data);
  return (result as any).insertId as number;
}

export async function getFormSubmissionById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(accreditationFormSubmissions).where(eq(accreditationFormSubmissions.id, id)).limit(1);
  return rows[0];
}

export async function getFormSubmissionsByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(accreditationFormSubmissions)
    .where(eq(accreditationFormSubmissions.submittedByUserId, userId))
    .orderBy(desc(accreditationFormSubmissions.submittedAt));
}

export async function getFormSubmissionsByOrg(orgId: number, formType?: string) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(accreditationFormSubmissions.orgId, orgId)];
  if (formType) conditions.push(eq(accreditationFormSubmissions.formType, formType));
  return db.select().from(accreditationFormSubmissions)
    .where(and(...conditions))
    .orderBy(desc(accreditationFormSubmissions.submittedAt));
}

export async function getFormSubmissionsByTemplate(templateId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(accreditationFormSubmissions)
    .where(eq(accreditationFormSubmissions.templateId, templateId))
    .orderBy(desc(accreditationFormSubmissions.submittedAt));
}

export async function updateFormSubmissionStatus(id: number, status: 'draft' | 'submitted' | 'reviewed') {
  const db = await getDb();
  if (!db) throw new Error('DB unavailable');
  await db.update(accreditationFormSubmissions).set({ status, updatedAt: new Date() }).where(eq(accreditationFormSubmissions.id, id));
}

export async function getActiveTemplateForFormType(formType: string, orgId?: number) {
  const db = await getDb();
  if (!db) return undefined;
  // Prefer org-specific assignment, fall back to global
  if (orgId) {
    const orgRow = await db.select().from(accreditationFormTemplateAssignments)
      .where(and(
        eq(accreditationFormTemplateAssignments.formType, formType),
        eq(accreditationFormTemplateAssignments.orgId, orgId),
        eq(accreditationFormTemplateAssignments.isActive, true)
      )).limit(1);
    if (orgRow.length > 0) return orgRow[0];
  }
  const globalRow = await db.select().from(accreditationFormTemplateAssignments)
    .where(and(
      eq(accreditationFormTemplateAssignments.formType, formType),
      eq(accreditationFormTemplateAssignments.isActive, true),
      sql`${accreditationFormTemplateAssignments.orgId} IS NULL`
    )).limit(1);
  return globalRow[0];
}

export async function getFormSubmissionsForLab(filter: FormSubmissionFilter) {
  const db = await getDb();
  if (!db) return { rows: [], total: 0 };
  // Resolve labId → adminUserId → diyOrganizations.ownerUserId → orgId
  const labRow = await db
    .select({ adminUserId: labSubscriptions.adminUserId })
    .from(labSubscriptions)
    .where(eq(labSubscriptions.id, filter.labId))
    .limit(1);
  const adminUserId = labRow[0]?.adminUserId;
  if (!adminUserId) return { rows: [], total: 0 };
  const orgRow = await db
    .select({ orgId: diyOrganizations.id })
    .from(diyOrganizations)
    .where(eq(diyOrganizations.ownerUserId, adminUserId))
    .limit(1);
  const orgId = orgRow[0]?.orgId;
  if (!orgId) return { rows: [], total: 0 };
  const conditions: Parameters<typeof and>[0][] = [eq(accreditationFormSubmissions.orgId, orgId)];
  if (filter.formType) conditions.push(eq(accreditationFormSubmissions.formType, filter.formType));
  if (filter.templateId) conditions.push(eq(accreditationFormSubmissions.templateId, filter.templateId));
  if (filter.submittedByUserId) conditions.push(eq(accreditationFormSubmissions.submittedByUserId, filter.submittedByUserId));
  if (filter.status) conditions.push(eq(accreditationFormSubmissions.status, filter.status));
  if (filter.dateFrom) conditions.push(gte(accreditationFormSubmissions.submittedAt, filter.dateFrom));
  if (filter.dateTo) conditions.push(lte(accreditationFormSubmissions.submittedAt, filter.dateTo));
  const whereClause = and(...conditions);
  const countResult = await db
    .select({ total: count() })
    .from(accreditationFormSubmissions)
    .where(whereClause);
  const total = countResult[0]?.total ?? 0;
  const rows = await db
    .select({
      id: accreditationFormSubmissions.id,
      templateId: accreditationFormSubmissions.templateId,
      formType: accreditationFormSubmissions.formType,
      submittedByUserId: accreditationFormSubmissions.submittedByUserId,
      reviewTargetType: accreditationFormSubmissions.reviewTargetType,
      reviewTargetId: accreditationFormSubmissions.reviewTargetId,
      qualityScore: accreditationFormSubmissions.qualityScore,
      maxPossibleScore: accreditationFormSubmissions.maxPossibleScore,
      status: accreditationFormSubmissions.status,
      submittedAt: accreditationFormSubmissions.submittedAt,
      updatedAt: accreditationFormSubmissions.updatedAt,
      submitterName: users.name,
      submitterDisplayName: users.displayName,
      submitterEmail: users.email,
      submitterCredentials: users.credentials,
      templateName: accreditationFormTemplates.name,
    })
    .from(accreditationFormSubmissions)
    .leftJoin(users, eq(accreditationFormSubmissions.submittedByUserId, users.id))
    .leftJoin(accreditationFormTemplates, eq(accreditationFormSubmissions.templateId, accreditationFormTemplates.id))
    .where(whereClause)
    .orderBy(desc(accreditationFormSubmissions.submittedAt))
    .limit(filter.limit ?? 50)
    .offset(filter.offset ?? 0);
  return { rows, total };
}

export async function getFormSubmissionWithDetails(id: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select({
      id: accreditationFormSubmissions.id,
      templateId: accreditationFormSubmissions.templateId,
      formType: accreditationFormSubmissions.formType,
      submittedByUserId: accreditationFormSubmissions.submittedByUserId,
      reviewTargetType: accreditationFormSubmissions.reviewTargetType,
      reviewTargetId: accreditationFormSubmissions.reviewTargetId,
      responses: accreditationFormSubmissions.responses,
      qualityScore: accreditationFormSubmissions.qualityScore,
      maxPossibleScore: accreditationFormSubmissions.maxPossibleScore,
      status: accreditationFormSubmissions.status,
      submittedAt: accreditationFormSubmissions.submittedAt,
      updatedAt: accreditationFormSubmissions.updatedAt,
      submitterName: users.name,
      submitterDisplayName: users.displayName,
      submitterEmail: users.email,
      submitterCredentials: users.credentials,
      templateName: accreditationFormTemplates.name,
      templateFormType: accreditationFormTemplates.formType,
    })
    .from(accreditationFormSubmissions)
    .leftJoin(users, eq(accreditationFormSubmissions.submittedByUserId, users.id))
    .leftJoin(accreditationFormTemplates, eq(accreditationFormSubmissions.templateId, accreditationFormTemplates.id))
    .where(eq(accreditationFormSubmissions.id, id))
    .limit(1);
  return rows[0] ?? null;
}

export async function getFormSubmissionStatsForLab(labId: number) {
  const db = await getDb();
  if (!db) return null;
  const labRow = await db
    .select({ adminUserId: labSubscriptions.adminUserId })
    .from(labSubscriptions)
    .where(eq(labSubscriptions.id, labId))
    .limit(1);
  const adminUserId = labRow[0]?.adminUserId;
  if (!adminUserId) return null;
  const orgRow = await db
    .select({ orgId: diyOrganizations.id })
    .from(diyOrganizations)
    .where(eq(diyOrganizations.ownerUserId, adminUserId))
    .limit(1);
  const orgId = orgRow[0]?.orgId;
  if (!orgId) return null;
  const where = eq(accreditationFormSubmissions.orgId, orgId);
  const [totalResult, byTypeResult, avgScoreResult, recentResult] = await Promise.all([
    db.select({ total: count() }).from(accreditationFormSubmissions).where(where),
    db
      .select({
        formType: accreditationFormSubmissions.formType,
        cnt: count(),
        avgScore: avg(accreditationFormSubmissions.qualityScore),
      })
      .from(accreditationFormSubmissions)
      .where(where)
      .groupBy(accreditationFormSubmissions.formType),
    db
      .select({ avgScore: avg(accreditationFormSubmissions.qualityScore) })
      .from(accreditationFormSubmissions)
      .where(and(where, eq(accreditationFormSubmissions.status, 'submitted'))),
    db
      .select({ recent: count() })
      .from(accreditationFormSubmissions)
      .where(and(where, gte(accreditationFormSubmissions.submittedAt, new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)))),
  ]);
  return {
    total: totalResult[0]?.total ?? 0,
    byType: byTypeResult,
    avgQualityScore: Number(avgScoreResult[0]?.avgScore ?? 0),
    last30Days: recentResult[0]?.recent ?? 0,
  };
}

export async function getFormSubmissionStaffList(labId: number) {
  const db = await getDb();
  if (!db) return [];
  const labRow = await db
    .select({ adminUserId: labSubscriptions.adminUserId })
    .from(labSubscriptions)
    .where(eq(labSubscriptions.id, labId))
    .limit(1);
  const adminUserId = labRow[0]?.adminUserId;
  if (!adminUserId) return [];
  const orgRow = await db
    .select({ orgId: diyOrganizations.id })
    .from(diyOrganizations)
    .where(eq(diyOrganizations.ownerUserId, adminUserId))
    .limit(1);
  const orgId = orgRow[0]?.orgId;
  if (!orgId) return [];
  const rows = await db
    .selectDistinct({
      userId: accreditationFormSubmissions.submittedByUserId,
      name: users.name,
      displayName: users.displayName,
      credentials: users.credentials,
    })
    .from(accreditationFormSubmissions)
    .leftJoin(users, eq(accreditationFormSubmissions.submittedByUserId, users.id))
    .where(eq(accreditationFormSubmissions.orgId, orgId));
  return rows;
}

export async function getAccreditationReadiness(labId: number, userId: number): Promise<AccreditationReadiness | null> {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(accreditationReadiness)
    .where(eq(accreditationReadiness.labId, labId))
    .orderBy(desc(accreditationReadiness.updatedAt))
    .limit(1);
  if (existing.length > 0) return existing[0];
  // Auto-create a blank record
  await db.insert(accreditationReadiness).values({
    labId,
    userId,
    checklistProgress: "{}",
    itemNotes: "{}",
    completionPct: 0,
  });
  const created = await db.select().from(accreditationReadiness)
    .where(eq(accreditationReadiness.labId, labId)).limit(1);
  return created[0] ?? null;
}

export async function getAccreditationReadinessNavigator(userId: number): Promise<AccreditationReadinessNavigator | null> {
  const db = await getDb();
  if (!db) return null;
  const existing = await db.select().from(accreditationReadinessNavigator)
    .where(eq(accreditationReadinessNavigator.userId, userId))
    .limit(1);
  if (existing.length > 0) return existing[0];
  // Auto-create a blank record
  await db.insert(accreditationReadinessNavigator).values({
    userId,
    checklistProgress: "{}",
    itemNotes: "{}",
    completionPct: 0,
  });
  const created = await db.select().from(accreditationReadinessNavigator)
    .where(eq(accreditationReadinessNavigator.userId, userId)).limit(1);
  return created[0] ?? null;
}