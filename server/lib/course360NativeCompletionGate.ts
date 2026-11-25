import { TRPCError } from "@trpc/server";
import { and, eq, inArray, or } from "drizzle-orm";
import { lmsCourses, lmsEnrollments, lmsLessons, lmsSections } from "../../drizzle/schema";
import { assertCourse360NativeLessonCompletion, isCourse360NativeQuiz } from "./course360NativeCourseQuizRuntime";
import { quizzes } from "../../drizzle/schema";

/** Internal progress/certificate gate. Existing certificates and progress rows are never deleted or rewritten here. */
export async function assertCourse360NativeCourseCompletion(db: any, userId: number, courseId: number, enrollmentId: number, countableLessonIds?: number[]) {
  let lessons: Array<{ id: number; standaloneQuizId?: number | null; courseId?: number | null; sectionId?: number | null; lessonStatus?: string | null; countTowardCompletion?: boolean | number | null; previewMode?: string | null }>;
  if (countableLessonIds) {
    if (!countableLessonIds.length) return;
    lessons = await db.select().from(lmsLessons).where(inArray(lmsLessons.id, countableLessonIds));
  } else {
    const sections = await db.select({ id: lmsSections.id }).from(lmsSections).where(eq(lmsSections.courseId, courseId));
    const sectionIds = sections.map((section: { id: number }) => section.id);
    lessons = await db.select().from(lmsLessons).where(sectionIds.length ? or(eq(lmsLessons.courseId, courseId), inArray(lmsLessons.sectionId, sectionIds)) : eq(lmsLessons.courseId, courseId));
    lessons = lessons.filter(lesson => lesson.lessonStatus === "published" && (lesson.countTowardCompletion === true || lesson.countTowardCompletion === 1) && lesson.previewMode !== "preview_hide_after_purchase");
  }
  const nativeLessons: typeof lessons = [];
  for (const lesson of lessons) {
    if (!lesson.standaloneQuizId) continue;
    const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, lesson.standaloneQuizId)).limit(1);
    if (quiz && isCourse360NativeQuiz(quiz)) nativeLessons.push(lesson);
  }
  if (!nativeLessons.length) return;
  const [course] = await db.select().from(lmsCourses).where(eq(lmsCourses.id, courseId)).limit(1);
  const [enrollment] = await db.select().from(lmsEnrollments).where(and(eq(lmsEnrollments.id, enrollmentId), eq(lmsEnrollments.userId, userId), eq(lmsEnrollments.courseId, courseId))).limit(1);
  if (!course || !enrollment || enrollment.id !== enrollmentId || enrollment.userId !== userId || enrollment.courseId !== courseId || enrollment.orgId !== course.orgId || !["active", "completed"].includes(enrollment.status) || ["free_preview", "admin_preview"].includes(enrollment.enrollmentType) || [enrollment.accessExpiresAt, enrollment.expiresAt].some(value => value != null && (!Number.isFinite(new Date(value).getTime()) || new Date(value).getTime() <= Date.now()))) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "An active enrolled learner and passed assigned quizzes are required before course completion or a new certificate." });
  }
  for (const lesson of nativeLessons) await assertCourse360NativeLessonCompletion(db, userId, courseId, lesson.id, enrollmentId);
}
