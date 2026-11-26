import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, eq } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
import { protectedProcedure } from "./_core/trpc";
import { getDb, getOrgMember, getOrgStorageUsage } from "./db";
import { requireCourse360AppCapability, requireCourse360AppOrganization } from "./lib/course360AppCapabilities";
import { requireActiveMediaOrganization } from "./formsRouter";
import { canUseHiddenPrivateCourseVisibility } from "./lib/courseVisibilityEntitlement";
import { authoringProjects, authoringSlides, lmsCourses, lmsSections, lmsLessons, organizations, userActiveOrg, orgMembers, orgSubscriptions, orgMediaLibrary, mediaAssets, mediaVersions } from "../drizzle/schema";
import { buildCreatorSchoolArtifact, creatorSchoolSnapshotDigest, creatorSchoolMediaSnapshots } from "./course360CreatorSchoolPublishArtifact";
import { storeCreatorSchoolArtifact } from "./course360CreatorSchoolPublishStorage";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
const conflict = (message: string): never => { throw new TRPCError({ code: "CONFLICT", message }); };
const forbidden = (message: string): never => { throw new TRPCError({ code: "FORBIDDEN", message }); };
const scopeInput = z.object({ expectedOrgId: z.number().int().positive(), projectId: z.number().int().positive() }).strict();
export const creatorSchoolPublishInput = scopeInput.extend({ courseId: z.number().int().positive(), sectionId: z.number().int().positive(), lessonTitle: z.string().trim().min(1).max(255), requestId: z.string().uuid(), consentToPublish: z.literal(true) }).strict();
type PublishInput = z.infer<typeof creatorSchoolPublishInput>;
async function requireScope(userId: number, expectedOrgId: number) {
  const org = await requireCourse360AppOrganization(userId, expectedOrgId);
  const capability = await requireCourse360AppCapability(userId, "creator", "web");
  const mediaOrgId = await requireActiveMediaOrganization(userId, expectedOrgId);
  if (org.orgId !== expectedOrgId || capability.orgId !== expectedOrgId || mediaOrgId !== expectedOrgId) conflict("The selected school changed; reopen school publishing.");
  // School lesson authoring/media writes require actual exact-school administrator membership.
  // Neither support role nor a paid application subscription grants school write permission.
  const member = await getOrgMember(expectedOrgId, userId);
  if (!member || !["org_super_admin", "org_admin", "sub_admin"].includes(member.role)) forbidden("School administrator permission is required to append lessons.");
  return capability;
}
async function schoolTier(db: Db, orgId: number, lock = false) {
  let query = db.select().from(orgSubscriptions).where(eq(orgSubscriptions.orgId, orgId)).limit(1);
  const [sub] = await (lock ? query.for("update") : query);
  const status = sub?.rawStripeStatus || sub?.status;
  if (!sub || !["free", "starter", "builder", "pro", "enterprise"].includes(sub.plan) || !["active", "trialing"].includes(sub.status) || !["active", "trialing"].includes(status || "")) forbidden("An active persisted school subscription is required to add school content.");
  if ((sub.currentPeriodEnd && new Date(sub.currentPeriodEnd).getTime() <= Date.now()) || (status === "trialing" && sub.trialEndsAt && new Date(sub.trialEndsAt).getTime() <= Date.now())) forbidden("The school subscription has expired.");
  return sub;
}
async function projectSnapshot(db: Db, userId: number, orgId: number, projectId: number, lock = false) {
  const query = db.select().from(authoringProjects).where(and(eq(authoringProjects.id, projectId), eq(authoringProjects.orgId, orgId), eq(authoringProjects.userId, userId))).limit(1);
  const [project] = await (lock ? query.for("update") : query);
  if (!project) throw new TRPCError({ code: "NOT_FOUND", message: "Creator project is not owned by this author in the selected school." });
  const slideQuery = db.select().from(authoringSlides).where(eq(authoringSlides.projectId, projectId)).orderBy(asc(authoringSlides.slideIndex));
  const slides = await (lock ? slideQuery.for("update") : slideQuery);
  return { project, slides, digest: creatorSchoolSnapshotDigest(project, slides) };
}
async function destination(db: Db, orgId: number, courseId: number, sectionId: number, lock = false) {
  const courseQuery = db.select().from(lmsCourses).where(and(eq(lmsCourses.id, courseId), eq(lmsCourses.orgId, orgId))).limit(1);
  const sectionQuery = db.select().from(lmsSections).where(and(eq(lmsSections.id, sectionId), eq(lmsSections.orgId, orgId), eq(lmsSections.courseId, courseId))).limit(1);
  const [course] = await (lock ? courseQuery.for("update") : courseQuery);
  const [section] = await (lock ? sectionQuery.for("update") : sectionQuery);
  if (!course || !section || !["course", "cohort"].includes(course.type) || !["public", "hidden", "private"].includes(course.status)) forbidden("Select an existing published course and owned section in this exact school.");
  const tier = await schoolTier(db, orgId, lock);
  if (["hidden", "private"].includes(course.status) && !canUseHiddenPrivateCourseVisibility(tier.plan, tier.rawStripeStatus || tier.status)) forbidden("This restricted course requires an active Pro or Enterprise school plan.");
  if (section.isPreview) forbidden("Publishing protected Creator content into a preview section is not supported.");
  return { course, section };
}
async function quota(orgId: number, bytes: number) {
  const q = await getOrgStorageUsage(orgId);
  if (!Number.isSafeInteger(q.usedBytes) || q.usedBytes < 0 || !Number.isSafeInteger(q.maxBytes) || q.maxBytes < -1) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "School storage availability cannot be verified." });
  if (q.maxBytes !== -1 && q.usedBytes + bytes > q.maxBytes) forbidden("The new learner artifact exceeds this school's Media Library storage allowance.");
}
function requestFingerprint(input: PublishInput, userId: number) {
  return createHash("sha256").update(JSON.stringify({ userId, ...input })).digest("hex");
}
function result(orgId: number, courseId: number, sectionId: number, lessonId: number, assetId: number, mediaItemId: number, slug: string, sha256: string) {
  return { status: "published" as const, orgId, courseId, sectionId, lessonId, assetId, mediaItemId, embedUrl: `/api/media/${slug}/scorm/`, format: "html5" as const, sha256, completionMode: "manual_lesson" as const };
}
async function existingReceipt(db: Db, input: PublishInput, userId: number, slug: string) {
  const [asset] = await db.select().from(mediaAssets).where(and(eq(mediaAssets.slug, slug), eq(mediaAssets.orgId, input.expectedOrgId))).limit(1);
  if (!asset) return null;
  let receipt: any; try { receipt = JSON.parse(asset.description || ""); } catch { conflict("Existing publish receipt is unreadable; no data was changed."); }
  if (asset.deletedAt || asset.access !== "private" || asset.createdByUserId !== userId || receipt.fingerprint !== requestFingerprint(input, userId)) conflict("This publish request ID already identifies another artifact or destination.");
  const [lesson] = await db.select().from(lmsLessons).where(and(eq(lmsLessons.orgId, input.expectedOrgId), eq(lmsLessons.courseId, input.courseId), eq(lmsLessons.sectionId, input.sectionId), eq(lmsLessons.mediaAssetId, asset.id))).limit(1);
  const [media] = await db.select().from(orgMediaLibrary).where(and(eq(orgMediaLibrary.orgId, input.expectedOrgId), eq(orgMediaLibrary.fileKey, asset.s3Key))).limit(1);
  const [version] = await db.select().from(mediaVersions).where(and(eq(mediaVersions.orgId, input.expectedOrgId), eq(mediaVersions.assetId, asset.id), eq(mediaVersions.versionNumber, 1))).limit(1);
  if (!lesson || !media || !version || lesson.embedUrl !== `/api/media/${slug}/scorm/` || lesson.type !== "embed" || version.s3Key !== asset.s3Key || media.fileSize !== asset.size || version.fileSize !== asset.size || media.mimeType !== "application/zip") conflict("The existing artifact/lesson receipt changed; no duplicate was created.");
  const versions = await db.select().from(mediaVersions).where(and(eq(mediaVersions.orgId, input.expectedOrgId), eq(mediaVersions.assetId, asset.id)));
  if (versions.length !== 1 || asset.s3Key !== receipt.key || asset.s3Url !== receipt.url || asset.size !== receipt.size || version.s3Url !== receipt.url || media.url !== receipt.url || lesson.title !== input.lessonTitle || lesson.lessonStatus !== "published" || lesson.previewMode !== "none" || lesson.requireManualComplete !== 1 || asset.uploadedBy !== userId || media.uploadedBy !== userId || !/^[a-f\d]{64}$/.test(receipt.sha256 || "")) conflict("The retained artifact or lesson has changed since this publish request; no duplicate was created.");
  return result(input.expectedOrgId, input.courseId, input.sectionId, lesson.id, asset.id, media.id, slug, receipt.sha256);
}
function insertId(value: unknown) { const id = Number((value as any)?.[0]?.insertId); if (!Number.isSafeInteger(id) || id < 1) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "New school row did not return an owned insert receipt." }); return id; }
const active = new Set<number>();
export const creatorSchoolPublishProcedures = {
  listSchoolPublishDestinations: protectedProcedure.input(scopeInput).query(async ({ ctx, input }) => {
    await requireScope(ctx.user.id, input.expectedOrgId);
    const db = await getDb(); if (!db) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "School publishing persistence is unavailable." });
    await projectSnapshot(db, ctx.user.id, input.expectedOrgId, input.projectId);
    const tier = await schoolTier(db, input.expectedOrgId);
    const courses = await db.select().from(lmsCourses).where(eq(lmsCourses.orgId, input.expectedOrgId)).orderBy(asc(lmsCourses.title));
    const output = [];
    for (const course of courses) {
      if (!["course", "cohort"].includes(course.type) || !["public", "hidden", "private"].includes(course.status) || (["hidden", "private"].includes(course.status) && !canUseHiddenPrivateCourseVisibility(tier.plan, tier.rawStripeStatus || tier.status))) continue;
      const sections = await db.select().from(lmsSections).where(and(eq(lmsSections.orgId, input.expectedOrgId), eq(lmsSections.courseId, course.id))).orderBy(asc(lmsSections.position));
      output.push({ id: course.id, title: course.title, slug: course.slug, sections: sections.filter(s => !s.isPreview).map(s => ({ id: s.id, title: s.title })) });
    }
    await requireScope(ctx.user.id, input.expectedOrgId);
    return { orgId: input.expectedOrgId, model: "lms_courses" as const, courses: output };
  }),
  publishToSchoolCourse: protectedProcedure.input(creatorSchoolPublishInput).mutation(async ({ ctx, input }) => {
    const capability = await requireScope(ctx.user.id, input.expectedOrgId);
    const db = await getDb(); if (!db || typeof db.transaction !== "function") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Transactional school publishing is unavailable." });
    if (active.has(input.expectedOrgId)) conflict("Another Creator publish is running for this school; retry with the same request ID.");
    active.add(input.expectedOrgId);
    const slug = `creator-${input.expectedOrgId}-${ctx.user.id}-${input.requestId.toLowerCase()}`;
    try {
      const snapshot = await projectSnapshot(db, ctx.user.id, input.expectedOrgId, input.projectId);
      const dest = await destination(db, input.expectedOrgId, input.courseId, input.sectionId);
      const existing = await existingReceipt(db, input, ctx.user.id, slug); if (existing) return existing;
      const artifact = await buildCreatorSchoolArtifact(db, input.expectedOrgId, snapshot.project, snapshot.slides, !(capability.isPaid || capability.hasManualGrant));
      await requireScope(ctx.user.id, input.expectedOrgId);
      await quota(input.expectedOrgId, artifact.bytes.length);
      const key = `org-${input.expectedOrgId}/media/creator-school/${randomUUID()}.zip`;
      const stored = await storeCreatorSchoolArtifact(key, artifact.bytes);
      if (stored.key !== key || stored.size !== artifact.bytes.length || stored.mimeType !== "application/zip") conflict("The owned artifact receipt drifted before lesson publication.");
      await requireScope(ctx.user.id, input.expectedOrgId);
      return await db.transaction(async tx => {
        const t = tx as unknown as Db;
        // Serialize this feature's quota/retry/appends without changing existing rows.
        const [org] = await t.select().from(organizations).where(and(eq(organizations.id, input.expectedOrgId), eq(organizations.isActive, true))).limit(1).for("update");
        const [selected] = await t.select().from(userActiveOrg).where(and(eq(userActiveOrg.userId, ctx.user.id), eq(userActiveOrg.orgId, input.expectedOrgId))).limit(1).for("update");
        const [member] = await t.select().from(orgMembers).where(and(eq(orgMembers.userId, ctx.user.id), eq(orgMembers.orgId, input.expectedOrgId))).limit(1).for("update");
        if (!org || !selected || !member || !["org_super_admin", "org_admin", "sub_admin"].includes(member.role)) conflict("Persisted selected school or author permission changed before publication.");
        const currentCapability = await requireScope(ctx.user.id, input.expectedOrgId);
        if (!!(currentCapability.isPaid || currentCapability.hasManualGrant) !== !!(capability.isPaid || capability.hasManualGrant)) conflict("Creator watermark capability changed during packaging; retry.");
        const currentDest = await destination(t, input.expectedOrgId, input.courseId, input.sectionId, true);
        if (creatorSchoolSnapshotDigest(dest.course, dest.section) !== creatorSchoolSnapshotDigest(currentDest.course, currentDest.section)) conflict("The destination course or section changed; reopen publishing.");
        const duplicate = await existingReceipt(t, input, ctx.user.id, slug); if (duplicate) return duplicate;
        const current = await projectSnapshot(t, ctx.user.id, input.expectedOrgId, input.projectId, true);
        if (current.digest !== snapshot.digest) conflict("Creator content changed during packaging; save and retry a new publish request.");
        const currentMedia = await creatorSchoolMediaSnapshots(t, input.expectedOrgId, current.project, current.slides, true);
        if (creatorSchoolSnapshotDigest(currentMedia, null) !== creatorSchoolSnapshotDigest(artifact.mediaSnapshots, null)) conflict("Owned source media changed during packaging; retry.");
        await quota(input.expectedOrgId, artifact.bytes.length);
        const lessons = await t.select().from(lmsLessons).where(and(eq(lmsLessons.orgId, input.expectedOrgId), eq(lmsLessons.courseId, input.courseId), eq(lmsLessons.sectionId, input.sectionId))).orderBy(asc(lmsLessons.position)).for("update");
        const position = lessons.reduce((max, lesson) => Math.max(max, lesson.position), -1) + 1;
        if (!Number.isSafeInteger(position) || position > 2_147_483_647) conflict("The section has no safe append position.");
        const filename = `creator-${input.projectId}-html5.zip`;
        const assetId = insertId(await t.insert(mediaAssets).values({ orgId: input.expectedOrgId, filename, mimeType: "application/zip", size: artifact.bytes.length, s3Key: key, s3Url: stored.url, uploadedBy: ctx.user.id, createdByUserId: ctx.user.id, slug, title: input.lessonTitle, mediaType: "zip", access: "private", description: JSON.stringify({ version: 1, fingerprint: requestFingerprint(input, ctx.user.id), sourceDigest: snapshot.digest, sha256: artifact.sha256, key, url: stored.url, size: artifact.bytes.length }), tags: JSON.stringify(["creator", "school-publish", "html5"]) }));
        insertId(await t.insert(mediaVersions).values({ orgId: input.expectedOrgId, assetId, versionNumber: 1, s3Key: key, s3Url: stored.url, fileName: filename, fileSize: artifact.bytes.length, mimeType: "application/zip", uploadedByUserId: ctx.user.id, scormExtractionStatus: "not_required" }));
        const mediaItemId = insertId(await t.insert(orgMediaLibrary).values({ orgId: input.expectedOrgId, uploadedBy: ctx.user.id, filename, mimeType: "application/zip", fileSize: artifact.bytes.length, fileKey: key, url: stored.url, source: "course", sourceId: input.courseId, tags: JSON.stringify(["creator", "school-publish", "html5"]) }));
        const lessonId = insertId(await t.insert(lmsLessons).values({ orgId: input.expectedOrgId, courseId: input.courseId, sectionId: input.sectionId, title: input.lessonTitle, type: "embed", embedUrl: `/api/media/${slug}/scorm/`, mediaAssetId: assetId, position, isPreview: false, previewMode: "none", lessonStatus: "published", requireManualComplete: 1, countTowardCompletion: true }));
        const finalCapability = await requireScope(ctx.user.id, input.expectedOrgId);
        if (!!(finalCapability.isPaid || finalCapability.hasManualGrant) !== !!(capability.isPaid || capability.hasManualGrant)) conflict("Creator capability changed before commit; no new lesson was committed.");
        return result(input.expectedOrgId, input.courseId, input.sectionId, lessonId, assetId, mediaItemId, slug, artifact.sha256);
      });
    } finally { active.delete(input.expectedOrgId); }
  }),
};
