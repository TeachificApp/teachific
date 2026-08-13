import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import { getDb, requireOrgAdmin } from "./db";
import { TRPCError } from "@trpc/server";
import { quizzes, quizQuestions, quizAnswerChoices, organizations, orgMembers, quizAttempts } from "../drizzle/schema";
import { eq, and, asc, desc } from "drizzle-orm";

type QuizMakerContext = { user: { id: number; role: string } };

async function resolveQuizMakerOrg(ctx: QuizMakerContext) {
  return requireOrgAdmin(ctx.user.id, ctx.user.role);
}

/**
 * Resolves a QuizMaker quiz into an organisation and verifies authoring access.
 * Legacy owner-only records with orgId 0 are adopted into the caller's active
 * authorised organisation on first access; they are never exposed to other users.
 */
async function requireQuizMakerAccess(ctx: QuizMakerContext, quizId: number) {
  const db = (await getDb())!;
  const [quiz] = await db.select().from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
  if (!quiz) throw new TRPCError({ code: "NOT_FOUND", message: "Quiz not found" });

  if (quiz.orgId && quiz.orgId > 0) {
    await requireOrgAdmin(ctx.user.id, ctx.user.role, quiz.orgId);
    return quiz;
  }

  if (quiz.userId !== ctx.user.id) {
    throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this quiz" });
  }
  const orgId = await resolveQuizMakerOrg(ctx);
  await db.update(quizzes).set({ orgId }).where(eq(quizzes.id, quizId));
  return { ...quiz, orgId };
}

async function requireQuizMakerQuestionAccess(ctx: QuizMakerContext, questionId: number) {
  const db = (await getDb())!;
  const [question] = await db.select({ id: quizQuestions.id, quizId: quizQuestions.quizId })
    .from(quizQuestions).where(eq(quizQuestions.id, questionId)).limit(1);
  if (!question) throw new TRPCError({ code: "NOT_FOUND", message: "Question not found" });
  await requireQuizMakerAccess(ctx, question.quizId);
  return question;
}

async function requireQuizMakerChoiceAccess(ctx: QuizMakerContext, choiceId: number) {
  const db = (await getDb())!;
  const [choice] = await db.select({ id: quizAnswerChoices.id, questionId: quizAnswerChoices.questionId })
    .from(quizAnswerChoices).where(eq(quizAnswerChoices.id, choiceId)).limit(1);
  if (!choice) throw new TRPCError({ code: "NOT_FOUND", message: "Answer choice not found" });
  await requireQuizMakerQuestionAccess(ctx, choice.questionId);
  return choice;
}

// ─── QuizMaker Web Editor Router ─────────────────────────────────────────────
// Full CRUD for standalone quizzes owned by a user (userId-based, not org-based)

export const quizMakerRouter = router({
  // ── Quiz CRUD ──────────────────────────────────────────────────────────────

  /** List all quizzes owned by the current user */
  listQuizzes: protectedProcedure.query(async ({ ctx }) => {
    const db = (await getDb())!;
    const orgId = await resolveQuizMakerOrg(ctx);
    const rows = await db
      .select()
      .from(quizzes)
      .where(eq(quizzes.orgId, orgId))
      .orderBy(desc(quizzes.updatedAt));
    return rows;
  }),

  /** Get a single quiz with all its questions and answer choices */
  getQuiz: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const quiz = await requireQuizMakerAccess(ctx, input.quizId);

      const questions = await db
        .select()
        .from(quizQuestions)
        .where(eq(quizQuestions.quizId, input.quizId))
        .orderBy(asc(quizQuestions.sortOrder));

      const questionIds = questions.map((q: any) => q.id);
      let choices: any[] = [];
      if (questionIds.length > 0) {
        const allChoices = await db.select().from(quizAnswerChoices);
        choices = allChoices.filter((c: any) => questionIds.includes(c.questionId));
      }

      const choicesByQuestion: Record<number, any[]> = {};
      for (const c of choices) {
        if (!choicesByQuestion[c.questionId]) choicesByQuestion[c.questionId] = [];
        choicesByQuestion[c.questionId].push(c);
      }

      return {
        ...quiz,
        questions: questions.map((q: any) => ({
          ...q,
          choices: (choicesByQuestion[q.id] || []).sort((a: any, b: any) => a.sortOrder - b.sortOrder),
        })),
      };
    }),

  /** Create a new quiz */
  createQuiz: protectedProcedure
    .input(
      z.object({
        title: z.string().min(1).max(500),
        description: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const orgId = await resolveQuizMakerOrg(ctx);
      const [result] = await db.insert(quizzes).values({
        title: input.title,
        description: input.description || null,
        orgId,
        createdBy: ctx.user.id,
        userId: ctx.user.id,
        passingScore: 70,
        shuffleQuestions: false,
        shuffleAnswers: false,
        showFeedbackImmediately: true,
        showCorrectAnswers: true,
        isPublished: false,
      });
      return { id: result.insertId };
    }),

  /** Update quiz settings */
  updateQuiz: protectedProcedure
    .input(
      z.object({
        quizId: z.number(),
        title: z.string().min(1).max(500).optional(),
        description: z.string().optional(),
        instructions: z.string().optional(),
        passingScore: z.number().min(0).max(100).optional(),
        timeLimit: z.number().nullable().optional(),
        maxAttempts: z.number().nullable().optional(),
        shuffleQuestions: z.boolean().optional(),
        shuffleAnswers: z.boolean().optional(),
        showFeedbackImmediately: z.boolean().optional(),
        showCorrectAnswers: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const { quizId, ...data } = input;
      await requireQuizMakerAccess(ctx, quizId);

      const updateData: any = {};
      if (data.title !== undefined) updateData.title = data.title;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.instructions !== undefined) updateData.instructions = data.instructions;
      if (data.passingScore !== undefined) updateData.passingScore = data.passingScore;
      if (data.timeLimit !== undefined) updateData.timeLimit = data.timeLimit;
      if (data.maxAttempts !== undefined) updateData.maxAttempts = data.maxAttempts;
      if (data.shuffleQuestions !== undefined) updateData.shuffleQuestions = data.shuffleQuestions;
      if (data.shuffleAnswers !== undefined) updateData.shuffleAnswers = data.shuffleAnswers;
      if (data.showFeedbackImmediately !== undefined) updateData.showFeedbackImmediately = data.showFeedbackImmediately;
      if (data.showCorrectAnswers !== undefined) updateData.showCorrectAnswers = data.showCorrectAnswers;

      if (Object.keys(updateData).length > 0) {
        await db.update(quizzes).set(updateData).where(eq(quizzes.id, quizId));
      }
      return { success: true };
    }),

  /** Delete a quiz and all its questions/choices */
  deleteQuiz: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      await requireQuizMakerAccess(ctx, input.quizId);

      const questions = await db.select().from(quizQuestions).where(eq(quizQuestions.quizId, input.quizId));
      for (const q of questions) {
        await db.delete(quizAnswerChoices).where(eq(quizAnswerChoices.questionId, q.id));
      }
      await db.delete(quizQuestions).where(eq(quizQuestions.quizId, input.quizId));
      await db.delete(quizzes).where(eq(quizzes.id, input.quizId));
      return { success: true };
    }),

  // ── Question CRUD ──────────────────────────────────────────────────────────

  /** Add a question to a quiz */
  addQuestion: protectedProcedure
    .input(
      z.object({
        quizId: z.number(),
        questionType: z.enum([
          "multiple_choice", "true_false", "short_answer", "long_answer",
          "matching", "multiple_select", "hotspot", "ordering",
          "fill_blank", "numeric", "rating_scale",
        ]),
        questionText: z.string().default("New Question"),
        points: z.number().default(1),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      await requireQuizMakerAccess(ctx, input.quizId);

      const existing = await db
        .select()
        .from(quizQuestions)
        .where(eq(quizQuestions.quizId, input.quizId));
      const nextOrder = existing.length;

      const [result] = await db.insert(quizQuestions).values({
        quizId: input.quizId,
        sortOrder: nextOrder,
        questionType: input.questionType,
        questionText: input.questionText,
        points: input.points,
      });

      const qId = result.insertId;
      if (input.questionType === "multiple_choice") {
        await db.insert(quizAnswerChoices).values([
          { questionId: qId, sortOrder: 0, choiceText: "Option A", isCorrect: true },
          { questionId: qId, sortOrder: 1, choiceText: "Option B", isCorrect: false },
          { questionId: qId, sortOrder: 2, choiceText: "Option C", isCorrect: false },
          { questionId: qId, sortOrder: 3, choiceText: "Option D", isCorrect: false },
        ]);
      } else if (input.questionType === "true_false") {
        await db.insert(quizAnswerChoices).values([
          { questionId: qId, sortOrder: 0, choiceText: "True", isCorrect: true },
          { questionId: qId, sortOrder: 1, choiceText: "False", isCorrect: false },
        ]);
      } else if (input.questionType === "multiple_select") {
        await db.insert(quizAnswerChoices).values([
          { questionId: qId, sortOrder: 0, choiceText: "Option A", isCorrect: true },
          { questionId: qId, sortOrder: 1, choiceText: "Option B", isCorrect: true },
          { questionId: qId, sortOrder: 2, choiceText: "Option C", isCorrect: false },
          { questionId: qId, sortOrder: 3, choiceText: "Option D", isCorrect: false },
        ]);
      }

      return { id: qId };
    }),

  /** Update a question */
  updateQuestion: protectedProcedure
    .input(
      z.object({
        questionId: z.number(),
        questionText: z.string().optional(),
        questionType: z.enum([
          "multiple_choice", "true_false", "short_answer", "long_answer",
          "matching", "multiple_select", "hotspot", "ordering",
          "fill_blank", "numeric", "rating_scale",
        ]).optional(),
        points: z.number().optional(),
        explanation: z.string().nullable().optional(),
        imageUrl: z.string().nullable().optional(),
        orderingItemsJson: z.string().nullable().optional(),
        fillBlankAnswersJson: z.string().nullable().optional(),
        numericAnswer: z.number().nullable().optional(),
        numericTolerance: z.number().nullable().optional(),
        ratingMin: z.number().optional(),
        ratingMax: z.number().optional(),
        ratingLabelsJson: z.string().nullable().optional(),
        branchOnCorrect: z.number().nullable().optional(),
        branchOnIncorrect: z.number().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      await requireQuizMakerQuestionAccess(ctx, input.questionId);
      const { questionId, ...data } = input;
      const updateData: any = {};
      for (const [key, val] of Object.entries(data)) {
        if (val !== undefined) updateData[key] = val;
      }
      if (Object.keys(updateData).length > 0) {
        await db.update(quizQuestions).set(updateData).where(eq(quizQuestions.id, questionId));
      }
      return { success: true };
    }),

  /** Delete a question and its choices */
  deleteQuestion: protectedProcedure
    .input(z.object({ questionId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      await requireQuizMakerQuestionAccess(ctx, input.questionId);
      await db.delete(quizAnswerChoices).where(eq(quizAnswerChoices.questionId, input.questionId));
      await db.delete(quizQuestions).where(eq(quizQuestions.id, input.questionId));
      return { success: true };
    }),

  /** Reorder questions */
  reorderQuestions: protectedProcedure
    .input(
      z.object({
        quizId: z.number(),
        questionIds: z.array(z.number()),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      await requireQuizMakerAccess(ctx, input.quizId);
      const ownedQuestions = await db.select({ id: quizQuestions.id }).from(quizQuestions)
        .where(eq(quizQuestions.quizId, input.quizId));
      if (ownedQuestions.length !== input.questionIds.length || ownedQuestions.some((question) => !input.questionIds.includes(question.id))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "All reordered questions must belong to this quiz" });
      }
      for (let i = 0; i < input.questionIds.length; i++) {
        await db
          .update(quizQuestions)
          .set({ sortOrder: i })
          .where(eq(quizQuestions.id, input.questionIds[i]));
      }
      return { success: true };
    }),

  // ── Answer Choice CRUD ─────────────────────────────────────────────────────

  /** Add a choice to a question */
  addChoice: protectedProcedure
    .input(
      z.object({
        questionId: z.number(),
        choiceText: z.string().default("New Option"),
        isCorrect: z.boolean().default(false),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      await requireQuizMakerQuestionAccess(ctx, input.questionId);
      const existing = await db
        .select()
        .from(quizAnswerChoices)
        .where(eq(quizAnswerChoices.questionId, input.questionId));
      const nextOrder = existing.length;
      const [result] = await db.insert(quizAnswerChoices).values({
        questionId: input.questionId,
        sortOrder: nextOrder,
        choiceText: input.choiceText,
        isCorrect: input.isCorrect,
      });
      return { id: result.insertId };
    }),

  /** Update a choice */
  updateChoice: protectedProcedure
    .input(
      z.object({
        choiceId: z.number(),
        choiceText: z.string().optional(),
        isCorrect: z.boolean().optional(),
        matchTarget: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      await requireQuizMakerChoiceAccess(ctx, input.choiceId);
      const { choiceId, ...data } = input;
      const updateData: any = {};
      for (const [key, val] of Object.entries(data)) {
        if (val !== undefined) updateData[key] = val;
      }
      if (Object.keys(updateData).length > 0) {
        await db.update(quizAnswerChoices).set(updateData).where(eq(quizAnswerChoices.id, choiceId));
      }
      return { success: true };
    }),

  /** Delete a choice */
  deleteChoice: protectedProcedure
    .input(z.object({ choiceId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      await requireQuizMakerChoiceAccess(ctx, input.choiceId);
      await db.delete(quizAnswerChoices).where(eq(quizAnswerChoices.id, input.choiceId));
      return { success: true };
    }),

  // ── Bulk Save (for web editor local-to-cloud sync) ─────────────────────────

  /** Save entire quiz from local editor to cloud (create or update) */
  saveQuiz: protectedProcedure
    .input(
      z.object({
        quizId: z.number().optional(), // if provided, update existing
        title: z.string().min(1).max(500),
        description: z.string().optional(),
        questionsJson: z.string(), // JSON string of the full questions array
        settingsJson: z.string().optional(), // JSON string of quiz meta/settings
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;

      if (input.quizId) {
        // Update existing
        await requireQuizMakerAccess(ctx, input.quizId);

        // Parse settings to apply quiz-level fields
        const updateFields: any = {
          title: input.title,
          description: input.description || null,
          instructions: input.questionsJson,
        };
        if (input.settingsJson) {
          try {
            const settings = JSON.parse(input.settingsJson);
            if (settings.passingScore !== undefined) updateFields.passingScore = settings.passingScore;
            if (settings.timeLimit !== undefined) updateFields.timeLimit = settings.timeLimit || null;
            if (settings.maxAttempts !== undefined) updateFields.maxAttempts = settings.maxAttempts || null;
            if (settings.shuffleQuestions !== undefined) updateFields.shuffleQuestions = !!settings.shuffleQuestions;
            if (settings.shuffleAnswers !== undefined) updateFields.shuffleAnswers = !!settings.shuffleAnswers;
            if (settings.showFeedbackImmediately !== undefined) updateFields.showFeedbackImmediately = !!settings.showFeedbackImmediately;
            if (settings.showCorrectAnswers !== undefined) updateFields.showCorrectAnswers = !!settings.showCorrectAnswers;
          } catch (e) { /* ignore parse errors */ }
        }
        await db.update(quizzes).set(updateFields).where(eq(quizzes.id, input.quizId));

        return { id: input.quizId };
      } else {
        // Create new
        const orgId = await resolveQuizMakerOrg(ctx);
        const [result] = await db.insert(quizzes).values({
          title: input.title,
          description: input.description || null,
          instructions: input.questionsJson,
          orgId,
          createdBy: ctx.user.id,
          userId: ctx.user.id,
          passingScore: 70,
          shuffleQuestions: false,
          shuffleAnswers: false,
          showFeedbackImmediately: true,
          showCorrectAnswers: true,
          isPublished: false,
        });
        return { id: result.insertId };
      }
    }),

  // ── Publish / Export ───────────────────────────────────────────────────────

  /** Publish a quiz (mark as published) */
  publishQuiz: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      await requireQuizMakerAccess(ctx, input.quizId);
      await db.update(quizzes).set({ isPublished: true }).where(eq(quizzes.id, input.quizId));
      return { success: true };
    }),

  /** Duplicate a quiz */
  duplicateQuiz: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const quiz = await requireQuizMakerAccess(ctx, input.quizId);

      const [newQuiz] = await db.insert(quizzes).values({
        title: `${quiz.title} (Copy)`,
        description: quiz.description,
        instructions: quiz.instructions,
        orgId: quiz.orgId,
        createdBy: ctx.user.id,
        userId: ctx.user.id,
        passingScore: quiz.passingScore,
        timeLimit: quiz.timeLimit,
        maxAttempts: quiz.maxAttempts,
        shuffleQuestions: quiz.shuffleQuestions,
        shuffleAnswers: quiz.shuffleAnswers,
        showFeedbackImmediately: quiz.showFeedbackImmediately,
        showCorrectAnswers: quiz.showCorrectAnswers,
        isPublished: false,
      });
      const newQuizId = newQuiz.insertId;

      const questions = await db
        .select()
        .from(quizQuestions)
        .where(eq(quizQuestions.quizId, input.quizId))
        .orderBy(asc(quizQuestions.sortOrder));

      for (const q of questions) {
        const [newQ] = await db.insert(quizQuestions).values({
          quizId: newQuizId,
          sortOrder: q.sortOrder,
          questionType: q.questionType,
          questionText: q.questionText,
          questionHtml: q.questionHtml,
          imageUrl: q.imageUrl,
          points: q.points,
          explanation: q.explanation,
          orderingItemsJson: q.orderingItemsJson,
          fillBlankAnswersJson: q.fillBlankAnswersJson,
          numericAnswer: q.numericAnswer,
          numericTolerance: q.numericTolerance,
          ratingMin: q.ratingMin,
          ratingMax: q.ratingMax,
          ratingLabelsJson: q.ratingLabelsJson,
        });
        const newQId = newQ.insertId;

        const choices = await db
          .select()
          .from(quizAnswerChoices)
          .where(eq(quizAnswerChoices.questionId, q.id));
        if (choices.length > 0) {
          await db.insert(quizAnswerChoices).values(
            choices.map((c: any) => ({
              questionId: newQId,
              sortOrder: c.sortOrder,
              choiceText: c.choiceText,
              isCorrect: c.isCorrect,
              matchTarget: c.matchTarget,
            }))
          );
        }
      }

      return { id: newQuizId };
    }),

  // ── Publish / Share ───────────────────────────────────────────────────────

  /** Publish a quiz and generate a share token */
  publish: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const quiz = await requireQuizMakerAccess(ctx, input.quizId);

      // Generate a unique share token if one doesn't exist
      let token = quiz.shareToken;
      if (!token) {
        token = generateShareToken();
      }

      // Use the quiz's authorised organization for its learner-facing subdomain.
      let orgSlug: string | null = null;
      if (quiz.orgId) {
        const [org] = await db
          .select({ slug: organizations.slug })
          .from(organizations)
          .where(eq(organizations.id, quiz.orgId));
        if (org) {
          orgSlug = org.slug;
          // Store the orgId on the quiz so it's associated with the subdomain
          await db.update(quizzes).set({
            isPublished: true,
            shareToken: token,
            publishedAt: new Date(),
            orgId: quiz.orgId,
          }).where(eq(quizzes.id, input.quizId));
        } else {
          await db.update(quizzes).set({
            isPublished: true,
            shareToken: token,
            publishedAt: new Date(),
          }).where(eq(quizzes.id, input.quizId));
        }
      } else {
        await db.update(quizzes).set({
          isPublished: true,
          shareToken: token,
          publishedAt: new Date(),
        }).where(eq(quizzes.id, input.quizId));
      }

      return { shareToken: token, orgSlug };
    }),

  /** Unpublish a quiz (keep the share token for re-publishing) */
  unpublish: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      await requireQuizMakerAccess(ctx, input.quizId);

      await db.update(quizzes).set({
        isPublished: false,
      }).where(eq(quizzes.id, input.quizId));

      return { success: true };
    }),

  /** Get a published quiz by share token (public, no auth required) */
  getPublishedQuiz: publicProcedure
    .input(z.object({ shareToken: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const [quiz] = await db
        .select()
        .from(quizzes)
        .where(and(eq(quizzes.shareToken, input.shareToken), eq(quizzes.isPublished, true)));
       if (!quiz) throw new Error("Quiz not found or not published");
      // Enforce visibility: archived/draft quizzes are not accessible
      const quizVis = (quiz as any).visibility ?? "published";
      if (quizVis === "archived" || quizVis === "draft") throw new Error("Quiz not found or not published");
      // Parse questions from the instructions JSON field
      const questions = quiz.instructions ? JSON.parse(quiz.instructions) : [];

      return {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        passingScore: quiz.passingScore,
        timeLimit: quiz.timeLimit,
        maxAttempts: quiz.maxAttempts,
        shuffleQuestions: quiz.shuffleQuestions,
        shuffleAnswers: quiz.shuffleAnswers,
        showFeedbackImmediately: quiz.showFeedbackImmediately,
        showCorrectAnswers: quiz.showCorrectAnswers,
        questions,
      };
    }),

  // ── Attempt Tracking ──────────────────────────────────────────────────────

  /** Submit a quiz attempt from the public player (no auth required) */
  submitAttempt: publicProcedure
    .input(
      z.object({
        shareToken: z.string().min(1),
        takerName: z.string().max(255).optional(),
        takerEmail: z.string().email().max(320).optional(),
        score: z.number(),
        totalPoints: z.number(),
        passed: z.boolean(),
        timeTakenSeconds: z.number().optional(),
        answersJson: z.string(), // JSON snapshot of all answers
      })
    )
    .mutation(async ({ input }) => {
      const db = (await getDb())!;
      const [quiz] = await db
        .select()
        .from(quizzes)
        .where(and(eq(quizzes.shareToken, input.shareToken), eq(quizzes.isPublished, true)));
      if (!quiz) throw new Error("Quiz not found or not published");
      // Enforce visibility: archived/draft quizzes cannot accept submissions
      const quizVis2 = (quiz as any).visibility ?? "published";
      if (quizVis2 === "archived" || quizVis2 === "draft") throw new Error("Quiz not found or not published");
      const scorePct = input.totalPoints > 0 ? (input.score / input.totalPoints) * 100 : 0;

      const [result] = await db.insert(quizAttempts).values({
        quizId: quiz.id,
        orgId: quiz.orgId || undefined,
        scoreRaw: input.score,
        scorePct,
        totalPoints: input.totalPoints,
        isPassed: input.passed,
        isCompleted: true,
        timeTakenSeconds: input.timeTakenSeconds || undefined,
        takerName: input.takerName || undefined,
        takerEmail: input.takerEmail || undefined,
        answersJson: input.answersJson,
        shareToken: input.shareToken,
        submittedAt: new Date(),
      });

      return { attemptId: result.insertId };
    }),

  /** Get attempts for a quiz (quiz owner only) */
  getAttempts: protectedProcedure
    .input(
      z.object({
        quizId: z.number(),
        limit: z.number().min(1).max(100).default(50),
        offset: z.number().min(0).default(0),
      })
    )
    .query(async ({ ctx, input }) => {
      const db = (await getDb())!;
      // Verify ownership
      const [quiz] = await db
        .select()
        .from(quizzes)
        .where(and(eq(quizzes.id, input.quizId), eq(quizzes.userId, ctx.user.id)));
      if (!quiz) throw new Error("Quiz not found");

      const attempts = await db
        .select()
        .from(quizAttempts)
        .where(eq(quizAttempts.quizId, input.quizId))
        .orderBy(desc(quizAttempts.startedAt));

      // Manual pagination since we need total count
      const total = attempts.length;
      const paginated = attempts.slice(input.offset, input.offset + input.limit);

      return { attempts: paginated, total };
    }),

  /** Get analytics summary for a quiz (quiz owner only) */
  getQuizAnalytics: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = (await getDb())!;
      // Verify ownership
      const [quiz] = await db
        .select()
        .from(quizzes)
        .where(and(eq(quizzes.id, input.quizId), eq(quizzes.userId, ctx.user.id)));
      if (!quiz) throw new Error("Quiz not found");

      const attempts = await db
        .select()
        .from(quizAttempts)
        .where(eq(quizAttempts.quizId, input.quizId));

      const totalAttempts = attempts.length;
      if (totalAttempts === 0) {
        return {
          totalAttempts: 0,
          averageScore: 0,
          passRate: 0,
          averageTime: 0,
          scoreDistribution: [],
        };
      }

      const scores = attempts.map((a) => a.scorePct || 0);
      const averageScore = scores.reduce((sum, s) => sum + s, 0) / totalAttempts;
      const passCount = attempts.filter((a) => a.isPassed).length;
      const passRate = (passCount / totalAttempts) * 100;
      const times = attempts.filter((a) => a.timeTakenSeconds).map((a) => a.timeTakenSeconds!);
      const averageTime = times.length > 0 ? times.reduce((sum, t) => sum + t, 0) / times.length : 0;

      // Score distribution in 10% buckets
      const buckets = Array.from({ length: 10 }, (_, i) => ({
        range: `${i * 10}-${(i + 1) * 10}%`,
        count: 0,
      }));
      for (const score of scores) {
        const idx = Math.min(Math.floor(score / 10), 9);
        buckets[idx].count++;
      }

      return {
        totalAttempts,
        averageScore: Math.round(averageScore * 10) / 10,
        passRate: Math.round(passRate * 10) / 10,
        averageTime: Math.round(averageTime),
        scoreDistribution: buckets,
      };
    }),

  // ── Branding ──────────────────────────────────────────────────────────────

  /** Update quiz branding settings */
  updateBranding: protectedProcedure
    .input(
      z.object({
        quizId: z.number(),
        brandPrimaryColor: z.string().max(32).nullable().optional(),
        brandBgColor: z.string().max(32).nullable().optional(),
        brandLogoUrl: z.string().nullable().optional(),
        brandFontFamily: z.string().max(128).nullable().optional(),
        completionMessage: z.string().nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const { quizId, ...data } = input;
      const [quiz] = await db
        .select()
        .from(quizzes)
        .where(and(eq(quizzes.id, quizId), eq(quizzes.userId, ctx.user.id)));
      if (!quiz) throw new Error("Quiz not found");

      const updateData: any = {};
      for (const [key, val] of Object.entries(data)) {
        if (val !== undefined) updateData[key] = val;
      }
      if (Object.keys(updateData).length > 0) {
        await db.update(quizzes).set(updateData).where(eq(quizzes.id, quizId));
      }
      return { success: true };
    }),

  /** Get quiz branding (for the public player) */
  getQuizBranding: publicProcedure
    .input(z.object({ shareToken: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = (await getDb())!;
      const [quiz] = await db
        .select({
          brandPrimaryColor: quizzes.brandPrimaryColor,
          brandBgColor: quizzes.brandBgColor,
          brandLogoUrl: quizzes.brandLogoUrl,
          brandFontFamily: quizzes.brandFontFamily,
          completionMessage: quizzes.completionMessage,
        })
        .from(quizzes)
        .where(and(eq(quizzes.shareToken, input.shareToken), eq(quizzes.isPublished, true)));
      if (!quiz) return null;
      return quiz;
    }),

  // ── SCORM Export ──────────────────────────────────────────────────────────

  /** Export quiz as SCORM 1.2 or 2004 package */
  exportScorm: protectedProcedure
    .input(
      z.object({
        quizId: z.number(),
        format: z.enum(["scorm12", "scorm2004"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const [quiz] = await db
        .select()
        .from(quizzes)
        .where(and(eq(quizzes.id, input.quizId), eq(quizzes.userId, ctx.user.id)));
      if (!quiz) throw new Error("Quiz not found");

      const questions = quiz.instructions ? JSON.parse(quiz.instructions) : [];
      if (questions.length === 0) throw new Error("Quiz has no questions. Save to cloud first.");

      const { generateScormPackage } = await import("./scormGenerator");
      const zipBuffer = await generateScormPackage({
        title: quiz.title,
        description: quiz.description || "",
        questions,
        passingScore: quiz.passingScore || 70,
        timeLimit: quiz.timeLimit,
        shuffleQuestions: quiz.shuffleQuestions,
        format: input.format,
      });

      // Upload to S3
      const { storagePut } = await import("./storage");
      const fileName = `scorm-exports/${ctx.user.id}/${quiz.id}-${input.format}-${Date.now()}.zip`;
      const { url } = await storagePut(fileName, zipBuffer, "application/zip");

      return { downloadUrl: url };
    }),

  /** Get question-level analytics for a quiz (per-question correct/incorrect rates) */
  getQuestionAnalytics: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = (await getDb())!;
      // Verify ownership
      const [quiz] = await db
        .select()
        .from(quizzes)
        .where(and(eq(quizzes.id, input.quizId), eq(quizzes.userId, ctx.user.id)));
      if (!quiz) throw new Error("Quiz not found");

      // Get questions from the quiz instructions JSON
      const questions: any[] = quiz.instructions ? JSON.parse(quiz.instructions) : [];
      if (questions.length === 0) return { questions: [] };

      // Get all attempts for this quiz
      const attempts = await db
        .select()
        .from(quizAttempts)
        .where(eq(quizAttempts.quizId, input.quizId));

      if (attempts.length === 0) {
        return {
          questions: questions.map((q: any) => ({
            id: q.id,
            stem: q.stem || "Untitled",
            type: q.type,
            totalResponses: 0,
            correctCount: 0,
            incorrectCount: 0,
            correctRate: 0,
            optionBreakdown: [] as { optionId: string; optionText: string; count: number; percentage: number; isCorrect: boolean }[],
          })),
        };
      }

      // Parse all attempts' answers
      const parsedAttempts = attempts
        .map((a) => {
          try { return a.answersJson ? JSON.parse(a.answersJson) : null; }
          catch { return null; }
        })
        .filter(Boolean) as Record<string, any>[];

      // Compute per-question stats
      const questionStats = questions.map((q: any) => {
        const qId = q.id;
        let correctCount = 0;
        let incorrectCount = 0;
        const optionCounts: Record<string, number> = {};

        for (const attemptAnswers of parsedAttempts) {
          const ans = attemptAnswers[qId];
          if (ans === undefined || ans === null) continue;

          // Determine correctness based on question type
          let isCorrect = false;
          if (q.type === "mcq" || q.type === "image_choice") {
            const data = q.data;
            const correctIds = (data?.choices || []).filter((c: any) => c.correct).map((c: any) => c.id);
            const selected = Array.isArray(ans) ? ans : [];
            isCorrect = JSON.stringify([...correctIds].sort()) === JSON.stringify([...selected].sort());
            // Track option selections
            for (const optId of selected) {
              optionCounts[optId] = (optionCounts[optId] || 0) + 1;
            }
          } else if (q.type === "tf") {
            const data = q.data;
            isCorrect = ans === data?.correct;
            // Track true/false selections
            const key = String(ans);
            optionCounts[key] = (optionCounts[key] || 0) + 1;
          } else if (q.type === "matching") {
            const data = q.data;
            const a = (typeof ans === "object" && !Array.isArray(ans)) ? ans : {};
            isCorrect = (data?.pairs || []).every((p: any) => a[p.id] === p.id);
          } else if (q.type === "fill_blank") {
            const data = q.data;
            const a = (typeof ans === "object" && !Array.isArray(ans)) ? ans : {};
            isCorrect = (data?.blanks || []).every((b: any) => {
              const userAns = (a[b.id] ?? "").trim();
              return (b.acceptedAnswers || []).some((accepted: string) =>
                b.caseSensitive ? userAns === accepted : userAns.toLowerCase() === accepted.toLowerCase()
              );
            });
          }

          if (isCorrect) correctCount++;
          else incorrectCount++;
        }

        const totalResponses = correctCount + incorrectCount;
        const correctRate = totalResponses > 0 ? Math.round((correctCount / totalResponses) * 1000) / 10 : 0;

        // Build option breakdown for MCQ/TF questions
        let optionBreakdown: { optionId: string; optionText: string; count: number; percentage: number; isCorrect: boolean }[] = [];
        if (q.type === "mcq" || q.type === "image_choice") {
          const choices = q.data?.choices || [];
          optionBreakdown = choices.map((c: any) => ({
            optionId: c.id,
            optionText: c.text || c.label || "Option",
            count: optionCounts[c.id] || 0,
            percentage: totalResponses > 0 ? Math.round(((optionCounts[c.id] || 0) / totalResponses) * 1000) / 10 : 0,
            isCorrect: !!c.correct,
          }));
        } else if (q.type === "tf") {
          optionBreakdown = [
            { optionId: "true", optionText: "True", count: optionCounts["true"] || 0, percentage: totalResponses > 0 ? Math.round(((optionCounts["true"] || 0) / totalResponses) * 1000) / 10 : 0, isCorrect: q.data?.correct === true },
            { optionId: "false", optionText: "False", count: optionCounts["false"] || 0, percentage: totalResponses > 0 ? Math.round(((optionCounts["false"] || 0) / totalResponses) * 1000) / 10 : 0, isCorrect: q.data?.correct === false },
          ];
        }

        return {
          id: qId,
          stem: q.stem || "Untitled",
          type: q.type,
          totalResponses,
          correctCount,
          incorrectCount,
          correctRate,
          optionBreakdown,
        };
      });

      return { questions: questionStats };
    }),

  /** Get publish status for a quiz */
  getPublishStatus: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const [quiz] = await db
        .select()
        .from(quizzes)
        .where(and(eq(quizzes.id, input.quizId), eq(quizzes.userId, ctx.user.id)));
      if (!quiz) throw new Error("Quiz not found");

      // Look up org slug for share URL generation
      let orgSlug: string | null = null;
      if (quiz.orgId && quiz.orgId > 0) {
        const [org] = await db
          .select({ slug: organizations.slug })
          .from(organizations)
          .where(eq(organizations.id, quiz.orgId));
        if (org) orgSlug = org.slug;
      }

      return {
        isPublished: quiz.isPublished,
        shareToken: quiz.shareToken,
        publishedAt: quiz.publishedAt,
        orgSlug,
      };
    }),
});

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateShareToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 16; i++) {
    token += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return token;
}
