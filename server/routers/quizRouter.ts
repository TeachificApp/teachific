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
} from "../../drizzle/schema";
import { and, eq, inArray, sql, desc, asc, isNull } from "drizzle-orm";
import { buildStandaloneLearnerOptions } from "../lib/questionOptionOrder";

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
