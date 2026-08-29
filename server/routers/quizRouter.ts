import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb, requireOrgAdmin } from "../db";
import { TRPCError } from "@trpc/server";

type Db = NonNullable<Awaited<ReturnType<typeof getDb>>>;
let _db: Db | undefined;
async function db(): Promise<Db> {
  if (_db) return _db;
  const connection = await getDb();
  if (!connection) {
    throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  }
  _db = connection;
  return connection;
}
import {
  quizzes,
  quizBankQuestions,
  quizQuestionPools,
  quizQuestionOverrides,
  quizAttempts,
  quizAttemptResponses,
  quizAnswerChoices,
  quizBankTags,
  quizQuestionTags,
  quizAccessGrants,
  quizBanks,
  lmsCourses,
  lmsEnrollments,
  lmsLessons,
} from "../../drizzle/schema";
import { and, eq, inArray, sql, desc, asc, isNull } from "drizzle-orm";
import { buildStandaloneLearnerOptions } from "../lib/questionOptionOrder";
import { canOpenEmbeddedLearnerQuiz } from "../lib/embeddedLearnerQuizAccess";

// ─── Quiz settings schema ─────────────────────────────────────────────────────
const quizSettingsSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  coverImageUrl: z.string().optional(),
  timeLimitSeconds: z.number().optional(),
  maxAttempts: z.number().optional(),
  passScorePercent: z.number().default(70),
  randomizeQuestions: z.boolean().default(false),
  randomizeAnswers: z.boolean().default(false),
  feedbackMode: z.enum(["immediate","end","never"]).default("end"),
  showCorrectAnswers: z.boolean().default(true),
  showExplanations: z.boolean().default(true),
  allowPartialCredit: z.boolean().default(true),
  penaltyForWrong: z.boolean().default(false),
  themeConfig: z.any().optional(),
  priceAmountCents: z.number().default(0),
  currency: z.string().default("usd"),
});

// ─── Question pool schema ─────────────────────────────────────────────────────
const questionPoolSchema = z.object({
  bankId: z.number(),
  tagId: z.number().optional(),
  drawCount: z.number().min(1),
  sortOrder: z.number().default(0),
});

type RequestContext = { user: { id: number; role: string } };

const embeddedLearnerQuizInput = z.object({
  quizId: z.number().int().positive(),
  courseSlug: z.string().min(1).max(255).optional(),
  sourceLessonId: z.number().int().positive().optional(),
  /** Allows an authorized organization administrator to exercise an inline author preview. */
  authorPreview: z.boolean().optional().default(false),
});

function isPublishedForLearners(quiz: { isPublished: boolean; visibility: string }) {
  return quiz.isPublished || quiz.visibility === "published";
}

/**
 * Resolves the trusted course + lesson path for an embedded quiz. The client may
 * supply a slug and lesson ID for navigation, but both must map to the quiz's
 * owning organization before learner access is granted.
 */
export async function resolveEmbeddedLearnerQuizAccess(
  ctx: RequestContext,
  input: z.infer<typeof embeddedLearnerQuizInput>,
) {
  const connection = await db();
  const [quiz] = await connection.select({
    id: quizzes.id,
    orgId: quizzes.orgId,
    title: quizzes.title,
    description: quizzes.description,
    timeLimitSeconds: quizzes.timeLimitSeconds,
    maxAttempts: quizzes.maxAttempts,
    passScorePercent: quizzes.passScorePercent,
    quizType: quizzes.quizType,
    showExplanations: quizzes.showExplanations,
    showCorrectAnswers: quizzes.showCorrectAnswers,
    isPublished: quizzes.isPublished,
    visibility: quizzes.visibility,
  }).from(quizzes).where(eq(quizzes.id, input.quizId)).limit(1);
  if (!quiz) throw new TRPCError({ code: "NOT_FOUND", message: "Quiz not found." });

  if (input.authorPreview) {
    await requireOrgAdmin(ctx.user.id, ctx.user.role, quiz.orgId);
    return { quiz, course: null, lesson: null, isStaffPreview: true };
  }

  if (!input.courseSlug || !input.sourceLessonId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "This quiz must be opened from its assigned course lesson.",
    });
  }

  const [lesson] = await connection.select({
    id: lmsLessons.id,
    courseId: lmsLessons.courseId,
    standaloneQuizId: lmsLessons.standaloneQuizId,
    type: lmsLessons.type,
    previewMode: lmsLessons.previewMode,
    isPreview: lmsLessons.isPreview,
  }).from(lmsLessons).where(and(
    eq(lmsLessons.id, input.sourceLessonId),
    eq(lmsLessons.standaloneQuizId, input.quizId),
  )).limit(1);
  if (!lesson || !["quiz", "exam"].includes(lesson.type) || !lesson.courseId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "This quiz is not assigned to the selected course lesson." });
  }

  const [course] = await connection.select({
    id: lmsCourses.id,
    orgId: lmsCourses.orgId,
    slug: lmsCourses.slug,
  }).from(lmsCourses).where(and(
    eq(lmsCourses.id, lesson.courseId),
    eq(lmsCourses.slug, input.courseSlug),
  )).limit(1);
  if (!course || course.orgId !== quiz.orgId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "This quiz is not available in the selected course." });
  }

  // A staff member may preview unpublished quizzes only with administrator-level
  // access to the specific owning organization. Do not rely on their global role.
  let isStaffPreview = false;
  try {
    await requireOrgAdmin(ctx.user.id, ctx.user.role, course.orgId);
    isStaffPreview = true;
  } catch {
    // Learners proceed through the published-course and enrollment checks below.
  }
  const previewMode = lesson.previewMode ?? (lesson.isPreview ? "preview" : "none");
  const [enrollment] = await connection.select({
    status: lmsEnrollments.status,
    enrollmentType: lmsEnrollments.enrollmentType,
    accessExpiresAt: lmsEnrollments.accessExpiresAt,
  }).from(lmsEnrollments).where(and(
    eq(lmsEnrollments.userId, ctx.user.id),
    eq(lmsEnrollments.courseId, course.id),
  )).limit(1);
  const isPublished = isPublishedForLearners(quiz);
  const canOpen = canOpenEmbeddedLearnerQuiz({
    lessonType: lesson.type,
    isStaffPreview,
    isPublished,
    isPreviewLesson: previewMode === "preview" || previewMode === "preview_hide_after_purchase",
    enrollmentStatus: enrollment?.status,
    enrollmentType: enrollment?.enrollmentType,
    accessExpiresAt: enrollment?.accessExpiresAt ?? null,
  });
  if (!canOpen && !isPublished) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Quiz not found." });
  }
  if (!canOpen) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Course enrollment is required to access this quiz." });
  }

  return { quiz, course, lesson, isStaffPreview };
}

async function getConfiguredQuestionCount(quizId: number) {
  const connection = await db();
  const [pools, overrides] = await Promise.all([
    connection.select({ drawCount: quizQuestionPools.drawCount })
      .from(quizQuestionPools)
      .where(eq(quizQuestionPools.quizId, quizId)),
    connection.select({ id: quizQuestionOverrides.id })
      .from(quizQuestionOverrides)
      .where(eq(quizQuestionOverrides.quizId, quizId)),
  ]);
  return pools.reduce((total, pool) => total + pool.drawCount, 0) + overrides.length;
}

async function requireQuizAdmin(ctx: RequestContext, quizId: number) {
  const [quiz] = await (await db()).select({ orgId: quizzes.orgId })
    .from(quizzes)
    .where(eq(quizzes.id, quizId))
    .limit(1);
  if (!quiz) throw new TRPCError({ code: "NOT_FOUND", message: "Quiz not found." });
  await requireOrgAdmin(ctx.user.id, ctx.user.role, quiz.orgId);
  return quiz;
}

async function requireQuizBankInOrg(bankId: number, orgId: number) {
  const [bank] = await (await db()).select({ orgId: quizBanks.orgId })
    .from(quizBanks)
    .where(eq(quizBanks.id, bankId))
    .limit(1);
  if (!bank) throw new TRPCError({ code: "NOT_FOUND", message: "Question Bank not found." });
  if (bank.orgId !== orgId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Question Banks must belong to the same organization as the quiz." });
  }
  return bank;
}

export const quizRouter = router({
  // ─── Embedded Course Learner Playback ──────────────────────────────────────
  getLearnerQuizInfo: protectedProcedure
    .input(embeddedLearnerQuizInput)
    .query(async ({ input, ctx }) => {
      const { quiz, isStaffPreview } = await resolveEmbeddedLearnerQuizAccess(ctx, input);
      const [{ count }] = await (await db()).select({ count: sql<number>`count(*)` })
        .from(quizAttempts)
        .where(and(
          eq(quizAttempts.quizId, quiz.id),
          eq(quizAttempts.userId, ctx.user.id),
          eq(quizAttempts.status, "completed"),
        ));
      const attemptCount = Number(count ?? 0);
      const canAttempt = isStaffPreview || !quiz.maxAttempts || attemptCount < quiz.maxAttempts;
      const configuredQuestionCount = await getConfiguredQuestionCount(quiz.id);

      return {
        title: quiz.title,
        description: quiz.description,
        questionCount: configuredQuestionCount,
        timeLimitMinutes: quiz.timeLimitSeconds ? Math.ceil(quiz.timeLimitSeconds / 60) : null,
        passingScore: quiz.passScorePercent,
        type: quiz.quizType === "exam" ? "mock_exam" : "quiz",
        showExplanations: quiz.showExplanations,
        attemptCount,
        maxAttempts: quiz.maxAttempts,
        allowRetakes: isStaffPreview || quiz.maxAttempts === null || quiz.maxAttempts === undefined || attemptCount < quiz.maxAttempts,
        canAttempt,
        isStaffPreview,
      };
    }),

  startLearnerAttempt: protectedProcedure
    .input(embeddedLearnerQuizInput)
    .mutation(async ({ input, ctx }) => {
      const { quiz, isStaffPreview } = await resolveEmbeddedLearnerQuizAccess(ctx, input);
      const connection = await db();
      const [{ count: completedCount }] = await connection.select({ count: sql<number>`count(*)` })
        .from(quizAttempts)
        .where(and(
          eq(quizAttempts.quizId, quiz.id),
          eq(quizAttempts.userId, ctx.user.id),
          eq(quizAttempts.status, "completed"),
        ));
      if (!isStaffPreview && quiz.maxAttempts && Number(completedCount) >= quiz.maxAttempts) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Maximum attempts reached." });
      }

      const questionSnapshot = await buildQuestionSnapshot(quiz);
      if (questionSnapshot.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This quiz does not have any available questions." });
      }
      const [{ count: priorAttempts }] = await connection.select({ count: sql<number>`count(*)` })
        .from(quizAttempts)
        .where(and(eq(quizAttempts.quizId, quiz.id), eq(quizAttempts.userId, ctx.user.id)));
      const [result] = await connection.insert(quizAttempts).values({
        quizId: quiz.id,
        userId: ctx.user.id,
        attemptNumber: Number(priorAttempts ?? 0) + 1,
        status: "in_progress",
        questionSnapshot,
        totalPoints: questionSnapshot.reduce((sum: number, question: any) => sum + (question.points ?? 1), 0),
        sourceType: "lesson",
        sourceLessonId: input.sourceLessonId,
      });

      return {
        attemptId: result.insertId,
        questions: questionSnapshot.map((question: any) => ({
          id: question.id,
          questionBankId: question.id,
          questionType: question.questionType,
          question: question.questionText,
          imageUrl: question.mediaType === "image" ? question.mediaUrl : null,
          explanation: question.explanationText,
          choices: (question.choices ?? []).map((choice: any) => ({
            id: choice.id,
            text: choice.choiceText ?? "",
            mediaType: choice.mediaType,
            mediaUrl: choice.mediaUrl,
          })),
        })),
        quiz: {
          type: quiz.quizType === "exam" ? "mock_exam" : "quiz",
          feedbackMode: quiz.feedbackMode,
        },
      };
    }),

  checkLearnerResponse: protectedProcedure
    .input(embeddedLearnerQuizInput.extend({
      attemptId: z.number().int().positive(),
      questionId: z.number().int().positive(),
      selectedChoiceIds: z.array(z.number().int().positive()).min(1),
      timeSpentSeconds: z.number().int().min(0).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const access = await resolveEmbeddedLearnerQuizAccess(ctx, input);
      const connection = await db();
      const [attempt] = await connection.select().from(quizAttempts)
        .where(and(eq(quizAttempts.id, input.attemptId), eq(quizAttempts.userId, ctx.user.id)))
        .limit(1);
      if (!attempt || attempt.quizId !== access.quiz.id || attempt.status !== "in_progress") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Quiz attempt is not available." });
      }
      if (attempt.sourceLessonId !== input.sourceLessonId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Quiz attempt does not belong to this course lesson." });
      }

      const snapshot = (attempt.questionSnapshot as any[] | null) ?? [];
      const question = snapshot.find((item) => item.id === input.questionId);
      if (!question) throw new TRPCError({ code: "FORBIDDEN", message: "Question is not part of this attempt." });
      const allowedChoiceIds = new Set((question.choices ?? []).map((choice: any) => choice.id));
      if (input.selectedChoiceIds.some((choiceId) => !allowedChoiceIds.has(choiceId))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Selected answer is not part of this question." });
      }

      const choices = await connection.select().from(quizAnswerChoices)
        .where(eq(quizAnswerChoices.questionId, input.questionId));
      const graded = gradeResponse(question.questionType, choices, input.selectedChoiceIds);
      const [existing] = await connection.select({ id: quizAttemptResponses.id }).from(quizAttemptResponses)
        .where(and(eq(quizAttemptResponses.attemptId, attempt.id), eq(quizAttemptResponses.questionId, input.questionId)))
        .limit(1);
      const responseValues = {
        selectedChoiceIds: input.selectedChoiceIds,
        isCorrect: graded.isCorrect,
        isPartiallyCorrect: graded.isPartiallyCorrect,
        pointsEarned: graded.pointsEarned,
        timeSpentSeconds: input.timeSpentSeconds,
      };
      if (existing) {
        await connection.update(quizAttemptResponses).set(responseValues).where(eq(quizAttemptResponses.id, existing.id));
      } else {
        await connection.insert(quizAttemptResponses).values({
          attemptId: attempt.id,
          questionId: input.questionId,
          questionType: question.questionType,
          ...responseValues,
        });
      }

      return {
        isCorrect: graded.isCorrect,
        isPartiallyCorrect: graded.isPartiallyCorrect,
        correctChoiceIds: access.quiz.showCorrectAnswers
          ? choices.filter((choice) => choice.isCorrect).map((choice) => choice.id)
          : [],
        explanation: access.quiz.showExplanations ? question.explanationText ?? null : null,
      };
    }),

  completeLearnerAttempt: protectedProcedure
    .input(embeddedLearnerQuizInput.extend({
      attemptId: z.number().int().positive(),
      timeSpentSeconds: z.number().int().min(0).optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const access = await resolveEmbeddedLearnerQuizAccess(ctx, input);
      const connection = await db();
      const [attempt] = await connection.select().from(quizAttempts)
        .where(and(eq(quizAttempts.id, input.attemptId), eq(quizAttempts.userId, ctx.user.id)))
        .limit(1);
      if (!attempt || attempt.quizId !== access.quiz.id || attempt.status !== "in_progress") {
        throw new TRPCError({ code: "FORBIDDEN", message: "Quiz attempt is not available." });
      }
      if (attempt.sourceLessonId !== input.sourceLessonId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Quiz attempt does not belong to this course lesson." });
      }

      const snapshot = (attempt.questionSnapshot as any[] | null) ?? [];
      const responses = await connection.select().from(quizAttemptResponses)
        .where(eq(quizAttemptResponses.attemptId, attempt.id));
      const earnedPoints = responses.reduce((sum, response) => sum + (response.pointsEarned ?? 0), 0);
      const totalPoints = attempt.totalPoints || 1;
      const score = Math.round((earnedPoints / totalPoints) * 10_000) / 100;
      const passed = score >= access.quiz.passScorePercent;
      await connection.update(quizAttempts).set({
        status: "completed",
        earnedPoints,
        scorePercent: score.toFixed(2),
        passed,
        completedAt: new Date(),
        timeSpentSeconds: input.timeSpentSeconds,
      }).where(eq(quizAttempts.id, attempt.id));

      const responsesByQuestionId = new Map(responses.map((response) => [response.questionId, response]));
      return {
        score,
        passed,
        correctAnswers: responses.filter((response) => response.isCorrect).length,
        totalQuestions: snapshot.length,
        timeSpentSeconds: input.timeSpentSeconds ?? 0,
        breakdown: access.quiz.showExplanations ? snapshot.map((question) => ({
          question: question.questionText,
          isCorrect: responsesByQuestionId.get(question.id)?.isCorrect ?? false,
          explanation: question.explanationText ?? null,
        })) : null,
      };
    }),

  // ─── Quiz CRUD ────────────────────────────────────────────────────────────
  listQuizzes: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireOrgAdmin(ctx.user.id, ctx.user.role, input.orgId);
      return (await db()).select().from(quizzes)
        .where(eq(quizzes.orgId, input.orgId))
        .orderBy(desc(quizzes.createdAt));
    }),

  getQuiz: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireQuizAdmin(ctx, input.id);
      const [quiz] = await (await db()).select().from(quizzes).where(eq(quizzes.id, input.id));
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });

      const pools = await (await db()).select().from(quizQuestionPools)
        .where(eq(quizQuestionPools.quizId, input.id))
        .orderBy(asc(quizQuestionPools.sortOrder));

      const overrides = await (await db()).select().from(quizQuestionOverrides)
        .where(eq(quizQuestionOverrides.quizId, input.id))
        .orderBy(asc(quizQuestionOverrides.sortOrder));

      return { ...quiz, pools, overrides };
    }),

  createQuiz: protectedProcedure
    .input(z.object({ orgId: z.number(), ...quizSettingsSchema.shape }))
    .mutation(async ({ input, ctx }) => {
      await requireOrgAdmin(ctx.user.id, ctx.user.role, input.orgId);
      const { orgId, ...settings } = input;
      const [result] = await (await db()).insert(quizzes).values({
        orgId,
        title: settings.title,
        description: settings.description,
        coverImageUrl: settings.coverImageUrl,
        timeLimitSeconds: settings.timeLimitSeconds,
        maxAttempts: settings.maxAttempts,
        passScorePercent: settings.passScorePercent,
        randomizeQuestions: settings.randomizeQuestions,
        randomizeAnswers: settings.randomizeAnswers,
        feedbackMode: settings.feedbackMode,
        showCorrectAnswers: settings.showCorrectAnswers,
        showExplanations: settings.showExplanations,
        allowPartialCredit: settings.allowPartialCredit,
        penaltyForWrong: settings.penaltyForWrong,
        themeConfig: settings.themeConfig,
        priceAmount: (settings.priceAmountCents / 100).toFixed(2),
        currency: settings.currency,
        status: "draft",
      });
      return { id: result.insertId };
    }),

  updateQuiz: protectedProcedure
    .input(z.object({ id: z.number(), ...quizSettingsSchema.partial().shape }))
    .mutation(async ({ input, ctx }) => {
      await requireQuizAdmin(ctx, input.id);
      const { id, ...updates } = input;
      await (await db()).update(quizzes).set(updates).where(eq(quizzes.id, id));
    }),

  publishQuiz: protectedProcedure
    .input(z.object({ id: z.number(), publish: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      await requireQuizAdmin(ctx, input.id);
      await (await db()).update(quizzes).set({ status: input.publish ? "published" : "draft" }).where(eq(quizzes.id, input.id));
    }),

  deleteQuiz: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await requireQuizAdmin(ctx, input.id);
      await (await db()).delete(quizQuestionPools).where(eq(quizQuestionPools.quizId, input.id));
      await (await db()).delete(quizQuestionOverrides).where(eq(quizQuestionOverrides.quizId, input.id));
      await (await db()).delete(quizzes).where(eq(quizzes.id, input.id));
    }),

  duplicateQuiz: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await requireQuizAdmin(ctx, input.id);
      const [original] = await (await db()).select().from(quizzes).where(eq(quizzes.id, input.id));
      if (!original) throw new TRPCError({ code: "NOT_FOUND" });

      const [result] = await (await db()).insert(quizzes).values({
        ...original,
        id: undefined as any,
        title: `${original.title} (Copy)`,
        status: "draft",
        createdAt: undefined as any,
        updatedAt: undefined as any,
      });

      const newId = result.insertId;

      // Copy pools
      const pools = await (await db()).select().from(quizQuestionPools).where(eq(quizQuestionPools.quizId, input.id));
      if (pools.length > 0) {
        await (await db()).insert(quizQuestionPools).values(pools.map(p => ({ ...p, id: undefined as any, quizId: newId })));
      }

      // Copy overrides
      const overrides = await (await db()).select().from(quizQuestionOverrides).where(eq(quizQuestionOverrides.quizId, input.id));
      if (overrides.length > 0) {
        await (await db()).insert(quizQuestionOverrides).values(overrides.map(o => ({ ...o, id: undefined as any, quizId: newId })));
      }

      return { id: newId };
    }),

  // ─── Question Pools ───────────────────────────────────────────────────────
  updatePools: protectedProcedure
    .input(z.object({
      quizId: z.number(),
      pools: z.array(questionPoolSchema),
      overrides: z.array(z.object({
        questionId: z.number(),
        sortOrder: z.number().default(0),
        alwaysInclude: z.boolean().default(true),
      })).default([]),
    }))
    .mutation(async ({ input, ctx }) => {
      const quiz = await requireQuizAdmin(ctx, input.quizId);
      for (const pool of input.pools) {
        await requireQuizBankInOrg(pool.bankId, quiz.orgId);
        if (pool.tagId) {
          const [tag] = await (await db()).select({ orgId: quizBankTags.orgId })
            .from(quizBankTags)
            .where(eq(quizBankTags.id, pool.tagId))
            .limit(1);
          if (!tag || tag.orgId !== quiz.orgId) {
            throw new TRPCError({ code: "FORBIDDEN", message: "Question Bank tags must belong to the quiz organization." });
          }
        }
      }
      if (input.overrides.length > 0) {
        const questions = await (await db()).select({ id: quizBankQuestions.id, orgId: quizBankQuestions.orgId })
          .from(quizBankQuestions)
          .where(inArray(quizBankQuestions.id, input.overrides.map((override) => override.questionId)));
        if (questions.length !== input.overrides.length || questions.some((question) => question.orgId !== quiz.orgId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Question overrides must belong to the quiz organization." });
        }
      }
      await (await db()).delete(quizQuestionPools).where(eq(quizQuestionPools.quizId, input.quizId));
      await (await db()).delete(quizQuestionOverrides).where(eq(quizQuestionOverrides.quizId, input.quizId));

      if (input.pools.length > 0) {
        await (await db()).insert(quizQuestionPools).values(
          input.pools.map(p => ({ ...p, quizId: input.quizId }))
        );
      }

      if (input.overrides.length > 0) {
        await (await db()).insert(quizQuestionOverrides).values(
          input.overrides.map(o => ({ ...o, quizId: input.quizId }))
        );
      }
    }),

  // ─── Attempt Management ───────────────────────────────────────────────────
  startAttempt: protectedProcedure
    .input(z.object({
      quizId: z.number(),
      sourceType: z.enum(["standalone","lesson","funnel","landing_page"]).default("standalone"),
      sourceLessonId: z.number().optional(),
      sourceFunnelPageId: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const [quiz] = await (await db()).select().from(quizzes).where(eq(quizzes.id, input.quizId));
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });

      // Check max attempts
      if (quiz.maxAttempts) {
        const [{ count }] = await (await db()).select({ count: sql<number>`count(*)` })
          .from(quizAttempts)
          .where(and(
            eq(quizAttempts.quizId, input.quizId),
            eq(quizAttempts.userId, ctx.user.id),
            eq(quizAttempts.status, "completed"),
          ));
        if (count >= quiz.maxAttempts) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Maximum attempts reached" });
        }
      }

      // Build question set from pools + overrides
      const questionSnapshot = await buildQuestionSnapshot(quiz);

      const [{ count: attemptNumber }] = await (await db()).select({ count: sql<number>`count(*)` })
        .from(quizAttempts)
        .where(and(eq(quizAttempts.quizId, input.quizId), eq(quizAttempts.userId, ctx.user.id)));

      const [result] = await (await db()).insert(quizAttempts).values({
        quizId: input.quizId,
        userId: ctx.user.id,
        attemptNumber: (attemptNumber ?? 0) + 1,
        status: "in_progress",
        questionSnapshot,
        totalPoints: questionSnapshot.reduce((sum: number, q: any) => sum + (q.points ?? 1), 0),
        sourceType: input.sourceType,
        sourceLessonId: input.sourceLessonId,
        sourceFunnelPageId: input.sourceFunnelPageId,
      });

      return { attemptId: result.insertId, questions: questionSnapshot };
    }),

  submitResponse: protectedProcedure
    .input(z.object({
      attemptId: z.number(),
      questionId: z.number(),
      questionType: z.string(),
      selectedChoiceIds: z.array(z.number()).optional(),
      hotspotClickX: z.number().optional(),
      hotspotClickY: z.number().optional(),
      textAnswer: z.string().optional(),
      numericAnswer: z.number().optional(),
      timeSpentSeconds: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const [attempt] = await (await db()).select().from(quizAttempts).where(eq(quizAttempts.id, input.attemptId));
      if (!attempt || attempt.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });
      if (attempt.status !== "in_progress") throw new TRPCError({ code: "BAD_REQUEST", message: "Attempt is not in progress" });

      // Get question and choices to grade
      const choices = await (await db()).select().from(quizAnswerChoices)
        .where(eq(quizAnswerChoices.questionId, input.questionId));

      const { isCorrect, isPartiallyCorrect, pointsEarned } = gradeResponse(
        input.questionType,
        choices,
        input.selectedChoiceIds ?? [],
        input.hotspotClickX,
        input.hotspotClickY,
        input.textAnswer,
        input.numericAnswer,
      );

      // Upsert response
      const existing = await (await db()).select().from(quizAttemptResponses)
        .where(and(eq(quizAttemptResponses.attemptId, input.attemptId), eq(quizAttemptResponses.questionId, input.questionId)));

      if (existing.length > 0) {
        await (await db()).update(quizAttemptResponses).set({
          selectedChoiceIds: input.selectedChoiceIds,
          hotspotClickX: input.hotspotClickX?.toString(),
          hotspotClickY: input.hotspotClickY?.toString(),
          textAnswer: input.textAnswer,
          numericAnswer: input.numericAnswer?.toString(),
          isCorrect,
          isPartiallyCorrect,
          pointsEarned,
          timeSpentSeconds: input.timeSpentSeconds,
        }).where(eq(quizAttemptResponses.id, existing[0].id));
      } else {
        await (await db()).insert(quizAttemptResponses).values({
          attemptId: input.attemptId,
          questionId: input.questionId,
          questionType: input.questionType,
          selectedChoiceIds: input.selectedChoiceIds,
          hotspotClickX: input.hotspotClickX?.toString(),
          hotspotClickY: input.hotspotClickY?.toString(),
          textAnswer: input.textAnswer,
          numericAnswer: input.numericAnswer?.toString(),
          isCorrect,
          isPartiallyCorrect,
          pointsEarned,
          timeSpentSeconds: input.timeSpentSeconds,
        });
      }

      // Return immediate feedback if quiz allows it
      const [quiz] = await (await db()).select().from(quizzes).where(eq(quizzes.id, attempt.quizId));
      if (quiz?.feedbackMode === "immediate") {
        const correctChoices = choices.filter(c => c.isCorrect).map(c => c.id);
        return { isCorrect, isPartiallyCorrect, pointsEarned, correctChoiceIds: correctChoices };
      }

      return { isCorrect: null, isPartiallyCorrect: null, pointsEarned: null, correctChoiceIds: null };
    }),

  completeAttempt: protectedProcedure
    .input(z.object({
      attemptId: z.number(),
      timeSpentSeconds: z.number().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const [attempt] = await (await db()).select().from(quizAttempts).where(eq(quizAttempts.id, input.attemptId));
      if (!attempt || attempt.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      const [quiz] = await (await db()).select().from(quizzes).where(eq(quizzes.id, attempt.quizId));
      if (!quiz) throw new TRPCError({ code: "NOT_FOUND" });

      // Calculate final score
      const responses = await (await db()).select().from(quizAttemptResponses)
        .where(eq(quizAttemptResponses.attemptId, input.attemptId));

      const earnedPoints = responses.reduce((sum, r) => sum + (r.pointsEarned ?? 0), 0);
      const totalPoints = attempt.totalPoints || 1;
      const scorePercent = Math.round((earnedPoints / totalPoints) * 100 * 100) / 100;
      const passed = scorePercent >= (quiz.passScorePercent ?? 70);

      await (await db()).update(quizAttempts).set({
        status: "completed",
        earnedPoints,
        scorePercent: scorePercent.toString(),
        passed,
        completedAt: new Date(),
        timeSpentSeconds: input.timeSpentSeconds,
      }).where(eq(quizAttempts.id, input.attemptId));

      // Build results with correct answers if quiz allows
      const questionSnapshot = attempt.questionSnapshot as any[] ?? [];
      const resultsWithAnswers = quiz.showCorrectAnswers
        ? await enrichWithCorrectAnswers(questionSnapshot, responses, quiz)
        : null;

      return {
        attemptId: input.attemptId,
        earnedPoints,
        totalPoints,
        scorePercent,
        passed,
        passScorePercent: quiz.passScorePercent,
        resultsWithAnswers,
      };
    }),

  getAttemptResult: protectedProcedure
    .input(z.object({ attemptId: z.number() }))
    .query(async ({ input, ctx }) => {
      const [attempt] = await (await db()).select().from(quizAttempts).where(eq(quizAttempts.id, input.attemptId));
      if (!attempt || attempt.userId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN" });

      const [quiz] = await (await db()).select().from(quizzes).where(eq(quizzes.id, attempt.quizId));
      const responses = await (await db()).select().from(quizAttemptResponses)
        .where(eq(quizAttemptResponses.attemptId, input.attemptId));

      const questionSnapshot = attempt.questionSnapshot as any[] ?? [];
      const resultsWithAnswers = quiz?.showCorrectAnswers
        ? await enrichWithCorrectAnswers(questionSnapshot, responses, quiz)
        : null;

      return { attempt, quiz, responses, resultsWithAnswers };
    }),

  listAttempts: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .query(async ({ input, ctx }) => {
      return (await db()).select().from(quizAttempts)
        .where(and(eq(quizAttempts.quizId, input.quizId), eq(quizAttempts.userId, ctx.user.id)))
        .orderBy(desc(quizAttempts.startedAt));
    }),

  // ─── Analytics (admin) ────────────────────────────────────────────────────
  getQuizAnalytics: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .query(async ({ input, ctx }) => {
      await requireQuizAdmin(ctx, input.quizId);
      const attempts = await (await db()).select().from(quizAttempts)
        .where(and(eq(quizAttempts.quizId, input.quizId), eq(quizAttempts.status, "completed")));

      const totalAttempts = attempts.length;
      if (totalAttempts === 0) return { totalAttempts: 0, avgScore: 0, passRate: 0, avgTimeSeconds: 0 };

      const avgScore = attempts.reduce((sum, a) => sum + parseFloat(a.scorePercent ?? "0"), 0) / totalAttempts;
      const passRate = attempts.filter(a => a.passed).length / totalAttempts * 100;
      const avgTimeSeconds = attempts.filter(a => a.timeSpentSeconds).reduce((sum, a) => sum + (a.timeSpentSeconds ?? 0), 0) / totalAttempts;

      return { totalAttempts, avgScore: Math.round(avgScore * 10) / 10, passRate: Math.round(passRate), avgTimeSeconds: Math.round(avgTimeSeconds) };
    }),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
async function buildQuestionSnapshot(quiz: any): Promise<any[]> {
  // Get question pools
  const pools = await (await db()).select().from(quizQuestionPools)
    .where(eq(quizQuestionPools.quizId, quiz.id))
    .orderBy(asc(quizQuestionPools.sortOrder));

  // Get overrides (always-include questions)
  const overrides = await (await db()).select().from(quizQuestionOverrides)
    .where(eq(quizQuestionOverrides.quizId, quiz.id))
    .orderBy(asc(quizQuestionOverrides.sortOrder));

  let allQuestions: any[] = [];

  // Draw from pools
  for (const pool of pools) {
    const conditions = [eq(quizBankQuestions.bankId, pool.bankId), eq(quizBankQuestions.isArchived, false)];
    if (pool.tagId) {
      // Filter by tag via join
      const taggedIds = await (await db()).select({ qId: quizQuestionTags.questionId })
        .from(quizQuestionTags).where(eq(quizQuestionTags.tagId, pool.tagId));
      if (taggedIds.length === 0) continue;
      conditions.push(inArray(quizBankQuestions.id, taggedIds.map(t => t.qId)));
    }

    const poolQuestions = await (await db()).select().from(quizBankQuestions).where(and(...conditions));
    const shuffled = quiz.randomizeQuestions ? shuffleArray(poolQuestions) : poolQuestions;
    allQuestions.push(...shuffled.slice(0, pool.drawCount));
  }

  // Add override questions (always-include)
  if (overrides.length > 0) {
    const overrideIds = overrides.map(o => o.questionId);
    const overrideQuestions = await (await db()).select().from(quizBankQuestions)
      .where(inArray(quizBankQuestions.id, overrideIds));
    // Sort by override order
    const sorted = overrides.map(o => overrideQuestions.find(q => q.id === o.questionId)).filter(Boolean);
    allQuestions.push(...sorted);
  }

  // If no pools defined, use all questions from the quiz's first pool (fallback)
  if (allQuestions.length === 0 && pools.length === 0 && overrides.length === 0) {
    // Return empty — quiz has no questions configured
    return [];
  }

  // Get choices for all questions
  if (allQuestions.length === 0) return [];

  const qIds = allQuestions.map(q => q.id);
  const choices = await (await db()).select().from(quizAnswerChoices)
    .where(inArray(quizAnswerChoices.questionId, qIds))
    .orderBy(asc(quizAnswerChoices.sortOrder));

  return allQuestions.map(q => ({
    ...q,
    choices: buildStandaloneLearnerOptions({
      options: choices.filter(c => c.questionId === q.id),
      quizShuffleAnswers: quiz.randomizeAnswers,
      questionShuffleAnswerOptions: q.shuffleAnswerOptions,
      lockAnswerOrder: q.lockAnswerOrder,
    }),
  }));
}

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function gradeResponse(
  questionType: string,
  choices: any[],
  selectedChoiceIds: number[],
  hotspotX?: number,
  hotspotY?: number,
  textAnswer?: string,
  numericAnswer?: number,
): { isCorrect: boolean; isPartiallyCorrect: boolean; pointsEarned: number } {
  const correctChoices = choices.filter(c => c.isCorrect);

  switch (questionType) {
    case "mc":
    case "tf": {
      if (selectedChoiceIds.length === 0) return { isCorrect: false, isPartiallyCorrect: false, pointsEarned: 0 };
      const isCorrect = correctChoices.length > 0 && correctChoices[0].id === selectedChoiceIds[0];
      return { isCorrect, isPartiallyCorrect: false, pointsEarned: isCorrect ? 1 : 0 };
    }
    case "ms": {
      const correctIds = new Set(correctChoices.map(c => c.id));
      const selectedSet = new Set(selectedChoiceIds);
      const allCorrectSelected = [...correctIds].every(id => selectedSet.has(id));
      const noWrongSelected = [...selectedSet].every(id => correctIds.has(id));
      const isCorrect = allCorrectSelected && noWrongSelected;
      const partialCount = [...selectedSet].filter(id => correctIds.has(id)).length;
      const isPartiallyCorrect = !isCorrect && partialCount > 0;
      const pointsEarned = isCorrect ? 1 : (isPartiallyCorrect ? Math.round(partialCount / correctIds.size * 100) / 100 : 0);
      return { isCorrect, isPartiallyCorrect, pointsEarned };
    }
    case "hotspot": {
      // Check if click falls within any correct zone
      // Zones stored as [{x, y, width, height, isCorrect}]
      return { isCorrect: false, isPartiallyCorrect: false, pointsEarned: 0 };
    }
    case "short_answer": {
      if (!textAnswer) return { isCorrect: false, isPartiallyCorrect: false, pointsEarned: 0 };
      // Check against correct choice texts (case-insensitive)
      const isCorrect = correctChoices.some(c =>
        c.choiceText?.toLowerCase().trim() === textAnswer.toLowerCase().trim()
      );
      return { isCorrect, isPartiallyCorrect: false, pointsEarned: isCorrect ? 1 : 0 };
    }
    default:
      return { isCorrect: false, isPartiallyCorrect: false, pointsEarned: 0 };
  }
}

async function enrichWithCorrectAnswers(questionSnapshot: any[], responses: any[], quiz: any): Promise<any[]> {
  return questionSnapshot.map(q => {
    const response = responses.find(r => r.questionId === q.id);
    const correctChoiceIds = q.choices?.filter((c: any) => c.isCorrect).map((c: any) => c.id) ?? [];
    return {
      ...q,
      response,
      correctChoiceIds,
      showExplanation: quiz.showExplanations,
    };
  });
}
