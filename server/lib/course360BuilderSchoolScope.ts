import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { getDb, requireOrgAdmin } from "../db";
import { lmsCourses, lmsLessons, lmsSections, organizations, userActiveOrg } from "../../drizzle/schema";

export const course360BuilderRequestSchool = Symbol("course360BuilderRequestSchool");
type BuilderContext = { user: { id: number; role: string }; [course360BuilderRequestSchool]?: { db: NonNullable<Awaited<ReturnType<typeof getDb>>>; orgId: number } };

/** Authoring always uses an explicit persisted school selection, even for platform admins. */
export async function requireCourse360BuilderSchool(ctx: BuilderContext) {
  if (ctx[course360BuilderRequestSchool]) return ctx[course360BuilderRequestSchool]!;
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  const [active] = await db.select({ orgId: userActiveOrg.orgId }).from(userActiveOrg)
    .innerJoin(organizations, eq(organizations.id, userActiveOrg.orgId))
    .where(and(eq(userActiveOrg.userId, ctx.user.id), eq(organizations.isActive, true))).limit(1);
  if (!active?.orgId) throw new TRPCError({ code: "FORBIDDEN", message: "Choose an active organization before authoring" });
  if (ctx.user.role === "admin") throw new TRPCError({ code: "FORBIDDEN", message: "A current platform role or approved school administrator membership is required" });
  await requireOrgAdmin(ctx.user.id, ctx.user.role, active.orgId);
  return { db, orgId: active.orgId };
}

export async function assertCourse360BuilderCourse(ctx: BuilderContext, courseId: number) {
  const scope = await requireCourse360BuilderSchool(ctx);
  const [course] = await scope.db.select({ id: lmsCourses.id }).from(lmsCourses)
    .where(and(eq(lmsCourses.id, courseId), eq(lmsCourses.orgId, scope.orgId))).limit(1);
  if (!course) throw new TRPCError({ code: "FORBIDDEN", message: "Course does not belong to the active organization" });
  return { ...scope, courseId };
}

export async function assertCourse360BuilderSection(ctx: BuilderContext, sectionId: number, expectedCourseId?: number) {
  const scope = await requireCourse360BuilderSchool(ctx);
  const [section] = await scope.db.select({ courseId: lmsSections.courseId }).from(lmsSections)
    .innerJoin(lmsCourses, eq(lmsSections.courseId, lmsCourses.id))
    .where(and(eq(lmsSections.id, sectionId), eq(lmsCourses.orgId, scope.orgId))).limit(1);
  if (!section || (expectedCourseId !== undefined && section.courseId !== expectedCourseId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Section does not belong to the target course in the active organization" });
  }
  return { ...scope, courseId: section.courseId };
}

export async function assertCourse360BuilderLesson(ctx: BuilderContext, lessonId: number, expectedCourseId?: number) {
  const scope = await requireCourse360BuilderSchool(ctx);
  // Only parent identity is read until the owning course has been verified; never lesson content.
  const [lesson] = await scope.db.select({ courseId: lmsLessons.courseId, sectionId: lmsLessons.sectionId }).from(lmsLessons)
    .where(eq(lmsLessons.id, lessonId)).limit(1);
  if (!lesson) throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
  const section = lesson.sectionId ? await assertCourse360BuilderSection(ctx, lesson.sectionId) : undefined;
  const courseId = lesson.courseId ?? section?.courseId;
  if (!courseId || (section && section.courseId !== courseId) || (expectedCourseId !== undefined && expectedCourseId !== courseId)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Lesson parent does not match the target course" });
  }
  await assertCourse360BuilderCourse(ctx, courseId);
  return { ...scope, courseId };
}
