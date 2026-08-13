import { and, eq, isNull } from "drizzle-orm";
import { lmsCourses, lmsLessons, lmsQuizQuestions, lmsQuizzes, questionBankFolders, questionBankItems } from "../../drizzle/schema";

type BankQuestionType = "mcq" | "tf" | "short_answer" | "matching" | "multiple_select" | "hotspot" | "ordering" | "fill_blank";

export function mapQuestionType(type: unknown): BankQuestionType {
  switch (String(type)) {
    case "truefalse":
    case "true_false":
      return "tf";
    case "multiselect":
    case "multiple_select":
      return "multiple_select";
    case "matching":
      return "matching";
    case "hotspot":
    case "annotation":
      return "hotspot";
    case "drag_sort":
    case "ordering":
      return "ordering";
    case "fill_blank":
      return "fill_blank";
    case "short_answer":
    case "essay":
      return "short_answer";
    default:
      return "mcq";
  }
}

async function ensureLessonQuizFolder(db: any, orgId: number, courseId: number, userId: number) {
  const [course] = await db.select({ title: lmsCourses.title }).from(lmsCourses)
    .where(and(eq(lmsCourses.id, courseId), eq(lmsCourses.orgId, orgId))).limit(1);
  const courseFolderName = course?.title?.trim() || `Course ${courseId}`;
  let [root] = await db.select({ id: questionBankFolders.id }).from(questionBankFolders).where(and(
    eq(questionBankFolders.orgId, orgId),
    eq(questionBankFolders.name, "Lesson Quiz"),
    isNull(questionBankFolders.parentId),
  )).limit(1);
  if (!root) {
    const [created] = await db.insert(questionBankFolders).values({
      orgId,
      parentId: null,
      name: "Lesson Quiz",
      description: "Questions synchronized from lesson quizzes.",
      createdBy: userId,
    }).$returningId();
    root = { id: created.id };
  }
  let [courseFolder] = await db.select({ id: questionBankFolders.id }).from(questionBankFolders).where(and(
    eq(questionBankFolders.orgId, orgId),
    eq(questionBankFolders.name, courseFolderName),
    eq(questionBankFolders.parentId, root.id),
  )).limit(1);
  if (!courseFolder) {
    const [created] = await db.insert(questionBankFolders).values({
      orgId,
      parentId: root.id,
      name: courseFolderName,
      description: `Questions synchronized from lesson quizzes in ${courseFolderName}.`,
      createdBy: userId,
    }).$returningId();
    courseFolder = { id: created.id };
  }
  return courseFolder.id;
}

export function parseBlocks(contentBlocks: string | null | undefined): any[] {
  if (!contentBlocks) return [];
  try {
    const parsed = JSON.parse(contentBlocks);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Synchronize page-builder lesson quiz blocks into the active org's Question Bank. */
export async function syncLessonQuizBlocksToQuestionBank(db: any, lessonId: number, contentBlocks: string | null | undefined, userId: number) {
  const blocks = parseBlocks(contentBlocks);
  if (!blocks.length) return { created: 0, updated: 0 };
  const [lesson] = await db.select({ courseId: lmsLessons.courseId }).from(lmsLessons).where(eq(lmsLessons.id, lessonId)).limit(1);
  if (!lesson?.courseId) return { created: 0, updated: 0 };
  const [course] = await db.select({ orgId: lmsCourses.orgId }).from(lmsCourses).where(eq(lmsCourses.id, lesson.courseId)).limit(1);
  if (!course) return { created: 0, updated: 0 };
  const folderId = await ensureLessonQuizFolder(db, course.orgId, lesson.courseId, userId);
  let created = 0;
  let updated = 0;
  for (const block of blocks) {
    if (block?.type !== "lesson_quiz" || !Array.isArray(block?.data?.questions)) continue;
    const sourceBlockId = String(block.id ?? "lesson-quiz");
    for (const [sourceQuestionIndex, raw] of block.data.questions.entries()) {
      const stem = String(raw?.question ?? raw?.stem ?? "").trim();
      if (!stem) continue;
      const questionType = mapQuestionType(raw?.type);
      const values = {
        orgId: course.orgId,
        folderId,
        questionType,
        stem,
        dataJson: JSON.stringify({ ...raw, source: "lesson_quiz", sourceLessonId: lessonId, sourceBlockId, sourceQuestionIndex }),
        points: Number(raw?.points ?? 1) || 1,
        difficulty: raw?.difficulty === "easy" || raw?.difficulty === "hard" ? raw.difficulty : "medium",
        tags: JSON.stringify(["Lesson Quiz", course.orgId ? `Course:${lesson.courseId}` : ""] .filter(Boolean)),
        explanation: raw?.explanation ?? null,
        createdBy: userId,
        sourceLessonId: lessonId,
        sourceBlockId,
        sourceQuestionIndex,
        sourceQuizId: null,
        sourceQuizQuestionId: null,
      };
      const [existing] = await db.select({ id: questionBankItems.id }).from(questionBankItems).where(and(
        eq(questionBankItems.orgId, course.orgId),
        eq(questionBankItems.sourceLessonId, lessonId),
        eq(questionBankItems.sourceBlockId, sourceBlockId),
        eq(questionBankItems.sourceQuestionIndex, sourceQuestionIndex),
      )).limit(1);
      if (existing) {
        await db.update(questionBankItems).set(values).where(eq(questionBankItems.id, existing.id));
        updated++;
      } else {
        await db.insert(questionBankItems).values(values);
        created++;
      }
    }
  }
  return { created, updated };
}

/** Synchronize a legacy lms_quiz_questions record when it belongs to a lesson quiz. */
export async function syncLegacyLessonQuizQuestionToBank(db: any, quizQuestionId: number, userId: number) {
  const [question] = await db.select().from(lmsQuizQuestions).where(eq(lmsQuizQuestions.id, quizQuestionId)).limit(1);
  if (!question) return { created: 0, updated: 0 };
  const [quiz] = await db.select({ id: lmsQuizzes.id, lessonId: lmsQuizzes.lessonId, orgId: lmsQuizzes.orgId, courseId: lmsQuizzes.courseId })
    .from(lmsQuizzes).where(eq(lmsQuizzes.id, question.quizId)).limit(1);
  if (!quiz?.lessonId) return { created: 0, updated: 0 };
  const folderId = await ensureLessonQuizFolder(db, quiz.orgId, quiz.courseId, userId);
  const values = {
    orgId: quiz.orgId,
    folderId,
    questionType: mapQuestionType(question.type),
    stem: question.question,
    dataJson: JSON.stringify({ ...question, source: "legacy_lesson_quiz" }),
    points: Number(question.points ?? 1) || 1,
    difficulty: "medium" as const,
    tags: JSON.stringify(["Lesson Quiz", `Course:${quiz.courseId}`]),
    explanation: question.explanation ?? null,
    createdBy: userId,
    sourceLessonId: quiz.lessonId,
    sourceBlockId: null,
    sourceQuestionIndex: null,
    sourceQuizId: quiz.id,
    sourceQuizQuestionId: question.id,
  };
  const [existing] = await db.select({ id: questionBankItems.id }).from(questionBankItems).where(and(
    eq(questionBankItems.orgId, quiz.orgId),
    eq(questionBankItems.sourceQuizQuestionId, question.id),
  )).limit(1);
  if (existing) {
    await db.update(questionBankItems).set(values).where(eq(questionBankItems.id, existing.id));
    return { created: 0, updated: 1 };
  }
  await db.insert(questionBankItems).values(values);
  return { created: 1, updated: 0 };
}
