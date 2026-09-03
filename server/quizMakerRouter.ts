import { z } from "zod";
import { router, protectedProcedure, publicProcedure } from "./_core/trpc";
import { getDb, getOrgIdForUserWithFallback, requireOrgAdmin } from "./db";
import { TRPCError } from "@trpc/server";
import { quizzes, quizQuestions, quizAnswerChoices, organizations, orgMembers, orgSubscriptions, quizAttempts, quizBanks, quizBankFolders, quizBankQuestions, quizBankTags, quizQuestionTags } from "../drizzle/schema";
import { eq, and, asc, desc, inArray, sql } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { fetchPublicSourceText } from "./lib/publicSourceUrl";
import { canUseMockExamSubscription } from "./lib/mockExamEntitlement";

type QuizMakerContext = { user: { id: number; role: string } };

async function getMockExamAvailability(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  orgId: number,
) {
  const [subscription] = await db
    .select({ plan: orgSubscriptions.plan, status: orgSubscriptions.status })
    .from(orgSubscriptions)
    .where(eq(orgSubscriptions.orgId, orgId))
    .limit(1);
  if (!subscription) return { plan: "free", canUseMockExams: false };
  return {
    plan: subscription.plan,
    canUseMockExams: canUseMockExamSubscription(subscription.plan, subscription.status),
  };
}

async function resolveQuizMakerOrg(ctx: QuizMakerContext) {
  return requireOrgAdmin(ctx.user.id, ctx.user.role);
}

async function requireMockExamPlan(ctx: QuizMakerContext, quizOrgId: number) {
  const activeOrgId = await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role);
  if (!activeOrgId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Select an active organization before changing mock-exam settings." });
  }
  await requireOrgAdmin(ctx.user.id, ctx.user.role, activeOrgId);
  if (activeOrgId !== quizOrgId) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Mock-exam settings can only be changed in the active organization.",
    });
  }
  const db = (await getDb())!;
  const availability = await getMockExamAvailability(db, quizOrgId);
  if (!availability.canUseMockExams) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Mock exams are available on Pro and Enterprise plans. Upgrade this organization to enable mock-exam delivery.",
    });
  }
  return { db, activeOrgId, availability };
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

function buildVisualQuizConfig(quiz: typeof quizzes.$inferSelect, mockExamEnabled: boolean) {
  let questions: unknown[] = [];
  try {
    const parsed = quiz.instructions ? JSON.parse(quiz.instructions) : [];
    if (Array.isArray(parsed)) questions = parsed;
  } catch {
    // The existing editor can recover a saved quiz with no questions, but must
    // never treat malformed server data as executable client configuration.
  }
  return {
    meta: {
      id: String(quiz.id),
      title: quiz.title,
      description: quiz.description ?? "",
      author: "",
      authorEmail: "",
      createdAt: quiz.createdAt?.toISOString?.() ?? new Date().toISOString(),
      updatedAt: quiz.updatedAt?.toISOString?.() ?? new Date().toISOString(),
      version: 1,
      licenseKey: null,
      teachificOrgId: quiz.orgId,
      tags: [],
      passingScore: (quiz as any).passingScore ?? 70,
      timeLimit: (quiz as any).timeLimit ?? null,
      shuffleQuestions: Boolean((quiz as any).shuffleQuestions),
      shuffleAnswers: Boolean((quiz as any).shuffleAnswers),
      showFeedback: (quiz as any).showFeedbackImmediately === false ? "deferred" : "immediate",
      allowRetry: true,
      maxAttempts: (quiz as any).maxAttempts ?? 0,
      cloudId: quiz.id,
      mockExamEnabled,
    },
    questions,
  };
}

type SerializedQuizQuestion = {
  id?: string;
  type?: string;
  stem?: string;
  stemHtml?: string;
  image?: { url?: string; alt?: string } | null;
  video?: { url?: string } | null;
  explanation?: string;
  explanationHtml?: string;
  points?: number;
  lockAnswerOrder?: boolean;
  data?: Record<string, any>;
};

function mapQuestionBankType(question: SerializedQuizQuestion) {
  const type = question.type;
  const data = question.data ?? {};
  if (type === "mcq") return data.multiSelect ? "ms" : "mc";
  if (type === "image_choice") return data.multiSelect ? "ms" : "mc";
  if (type === "tf") return "tf";
  if (type === "matching") return "matching";
  if (type === "hotspot") return "hotspot";
  if (type === "ordering") return "sequence";
  if (type === "drag_drop") return "puzzle";
  if (type === "numeric") return "numeric";
  if (type === "short_answer" || type === "essay" || type === "fill_blank" || type === "drag_words" || type === "dropdown") return "short_answer";
  return "info_slide";
}

function quizMakerChoicesForBank(question: SerializedQuizQuestion) {
  const data = question.data ?? {};
  if (question.type === "mcq") {
    return (data.choices ?? []).map((choice: any, index: number) => ({
      choiceText: choice.text ?? "",
      mediaType: choice.imageUrl ? "image" as const : "none" as const,
      mediaUrl: choice.imageUrl || undefined,
      isCorrect: Boolean(choice.correct),
      sortOrder: index,
    }));
  }
  if (question.type === "image_choice") {
    return (data.choices ?? []).map((choice: any, index: number) => ({
      choiceText: choice.label ?? "",
      mediaType: choice.imageUrl ? "image" as const : "none" as const,
      mediaUrl: choice.imageUrl || undefined,
      isCorrect: Boolean(choice.correct),
      sortOrder: index,
    }));
  }
  if (question.type === "tf") {
    return [
      { choiceText: "True", mediaType: "none" as const, isCorrect: data.correct === true, sortOrder: 0 },
      { choiceText: "False", mediaType: "none" as const, isCorrect: data.correct === false, sortOrder: 1 },
    ];
  }
  if (question.type === "matching") {
    return [
      ...(data.pairs ?? []).flatMap((pair: any, index: number) => [
        { choiceText: pair.premise ?? "", mediaType: pair.premiseImageUrl ? "image" as const : "none" as const, mediaUrl: pair.premiseImageUrl || undefined, isCorrect: true, sortOrder: index * 2, matchPairId: pair.id, matchSide: "left" as const },
        { choiceText: pair.response ?? "", mediaType: pair.responseImageUrl ? "image" as const : "none" as const, mediaUrl: pair.responseImageUrl || undefined, isCorrect: true, sortOrder: index * 2 + 1, matchPairId: pair.id, matchSide: "right" as const },
      ]),
      ...(data.extraDistractors ?? []).map((text: string, index: number) => ({ choiceText: text, mediaType: "none" as const, isCorrect: false, sortOrder: (data.pairs?.length ?? 0) * 2 + index, matchSide: "right" as const })),
    ];
  }
  if (question.type === "ordering") {
    return (data.items ?? []).map((item: any, index: number) => ({
      choiceText: item.text ?? "",
      mediaType: item.imageUrl ? "image" as const : "none" as const,
      mediaUrl: item.imageUrl || undefined,
      isCorrect: true,
      sortOrder: index,
    }));
  }
  return [];
}

const QUIZ_TEXT_EXCLUDED_KEYS = new Set([
  "id",
  "url",
  "imageUrl",
  "videoUrl",
  "audioUrl",
  "backgroundImageUrl",
  "targetId",
  "type",
]);

function replaceQuizTextValue(value: unknown, find: string, replace: string): { value: unknown; count: number } {
  if (typeof value === "string") {
    const count = value.split(find).length - 1;
    return { value: count > 0 ? value.split(find).join(replace) : value, count };
  }
  if (Array.isArray(value)) {
    return value.reduce<{ value: unknown[]; count: number }>((result, item) => {
      const next = replaceQuizTextValue(item, find, replace);
      result.value.push(next.value);
      result.count += next.count;
      return result;
    }, { value: [], count: 0 });
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>).reduce<{ value: Record<string, unknown>; count: number }>((result, [key, item]) => {
      if (QUIZ_TEXT_EXCLUDED_KEYS.has(key)) {
        result.value[key] = item;
        return result;
      }
      const next = replaceQuizTextValue(item, find, replace);
      result.value[key] = next.value;
      result.count += next.count;
      return result;
    }, { value: {}, count: 0 });
  }
  return { value, count: 0 };
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
      const mockExamAvailability = await getMockExamAvailability(db, quiz.orgId);

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
        mockExamEntitlement: mockExamAvailability.canUseMockExams,
        builderConfig: buildVisualQuizConfig(
          quiz,
          Boolean(quiz.mockExamEnabled && mockExamAvailability.canUseMockExams),
        ),
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
        mockExamEnabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const { quizId, ...data } = input;
      const quiz = await requireQuizMakerAccess(ctx, quizId);

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
      if (data.mockExamEnabled !== undefined) {
        if (data.mockExamEnabled) await requireMockExamPlan(ctx, quiz.orgId);
        updateData.mockExamEnabled = data.mockExamEnabled;
      }

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
      let requestedMockExamEnabled: boolean | undefined;
      if (input.settingsJson) {
        try {
          const settings = JSON.parse(input.settingsJson);
          if (typeof settings.mockExamEnabled === "boolean") {
            requestedMockExamEnabled = settings.mockExamEnabled;
          }
        } catch {
          // Existing settings parsing intentionally falls back to default values.
        }
      }

      if (input.quizId) {
        // Update existing
        const quiz = await requireQuizMakerAccess(ctx, input.quizId);
        if (requestedMockExamEnabled) await requireMockExamPlan(ctx, quiz.orgId);

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
            if (requestedMockExamEnabled !== undefined) {
              updateFields.mockExamEnabled = requestedMockExamEnabled;
            }
          } catch (e) { /* ignore parse errors */ }
        }
        await db.update(quizzes).set(updateFields).where(eq(quizzes.id, input.quizId));

        return { id: input.quizId };
      } else {
        // Create new
        const orgId = await resolveQuizMakerOrg(ctx);
        if (requestedMockExamEnabled) await requireMockExamPlan(ctx, orgId);
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
          mockExamEnabled: requestedMockExamEnabled ?? false,
          isPublished: false,
        });
        return { id: result.insertId };
      }
    }),

  /** Replace exact text in a saved quiz that the active organization may administer. */
  findAndReplaceText: protectedProcedure
    .input(z.object({
      quizId: z.number().int().positive(),
      find: z.string().min(1).max(500),
      replace: z.string().max(5_000),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const quiz = await requireQuizMakerAccess(ctx, input.quizId);
      let questions: unknown;
      try {
        questions = quiz.instructions ? JSON.parse(quiz.instructions) : [];
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This quiz has invalid saved question data." });
      }
      if (!Array.isArray(questions)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "This quiz has invalid saved question data." });
      }
      const result = replaceQuizTextValue(questions, input.find, input.replace);
      const updatedQuestions = result.value as unknown[];
      if (result.count > 0) {
        await db.update(quizzes)
          .set({ instructions: JSON.stringify(updatedQuestions) })
          .where(eq(quizzes.id, quiz.id));
      }
      return {
        replacementCount: result.count,
        questions: updatedQuestions,
      };
    }),

  /** Generate reviewable Quiz Creator questions from a safe public reference URL. */
  generateQuestionsFromSource: protectedProcedure
    .input(z.object({
      quizId: z.number().int().positive(),
      topic: z.string().min(1).max(500),
      sourceUrl: z.string().url().max(2048),
      count: z.number().int().min(1).max(20).default(5),
      difficulty: z.enum(["beginner", "intermediate", "advanced"]).default("intermediate"),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireQuizMakerAccess(ctx, input.quizId);
      let sourceText: string;
      try {
        sourceText = await fetchPublicSourceText(input.sourceUrl);
      } catch (error) {
        throw new TRPCError({ code: "BAD_REQUEST", message: error instanceof Error ? error.message : "The source URL could not be used." });
      }

      const response = await invokeLLM({
        model: "gpt-5-mini",
        messages: [
          {
            role: "system",
            content: `Create accurate ${input.difficulty} educational assessment questions for an author. Return only the requested JSON. Use the supplied reference text only as private authoring context. Do not mention, cite, link to, or identify the source URL, publisher, organization, platform, or any branding in generated questions, explanations, or feedback. Generate only multiple-choice and true/false questions.`,
          },
          { role: "user", content: `Topic: ${input.topic}\n\nReference text:\n${sourceText}` },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "teachific_source_questions",
            strict: true,
            schema: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      question: { type: "string" },
                      type: { type: "string", enum: ["mcq", "truefalse"] },
                      options: { type: "array", items: { type: "string" } },
                      correctAnswer: { type: "string" },
                      explanation: { type: "string" },
                      correctFeedback: { type: "string" },
                      incorrectFeedback: { type: "string" },
                    },
                    required: ["question", "type", "options", "correctAnswer", "explanation", "correctFeedback", "incorrectFeedback"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["questions"],
              additionalProperties: false,
            },
          },
        } as any,
      });
      const raw = response.choices?.[0]?.message?.content ?? "{}";
      let parsed: { questions?: unknown };
      try {
        parsed = typeof raw === "string" ? JSON.parse(raw) : raw as { questions?: unknown };
      } catch {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Question generation returned invalid data. Please try again." });
      }
      const questions = Array.isArray(parsed.questions) ? parsed.questions.slice(0, input.count) : [];
      if (questions.length === 0) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Question generation did not return any usable questions. Please try again." });
      }
      return { questions };
    }),

  // ── Publish / Export ───────────────────────────────────────────────────────

  /** Publish a quiz (mark as published) */
  publishQuiz: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const quiz = await requireQuizMakerAccess(ctx, input.quizId);
      if (quiz.mockExamEnabled) await requireMockExamPlan(ctx, quiz.orgId);
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
        mockExamEnabled: quiz.mockExamEnabled,
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

  /**
   * Load an unpublished or published quiz for an authorized staff preview.
   * This procedure is deliberately protected and resolves access through the
   * active organization; it must never be used by the public learner player.
   */
  getStaffPreviewQuiz: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .query(async ({ ctx, input }) => {
      const quiz = await requireQuizMakerAccess(ctx, input.quizId);
      const db = (await getDb())!;
      const mockExamAvailability = await getMockExamAvailability(db, quiz.orgId);
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
        mockExamEnabled: Boolean(quiz.mockExamEnabled && mockExamAvailability.canUseMockExams),
        questions,
        previewMode: "staff" as const,
        branding: {
          brandPrimaryColor: quiz.brandPrimaryColor,
          brandBgColor: quiz.brandBgColor,
          brandLogoUrl: quiz.brandLogoUrl,
          brandFontFamily: quiz.brandFontFamily,
          completionMessage: quiz.completionMessage,
        },
      };
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
      const mockExamAvailability = await getMockExamAvailability(db, quiz.orgId);

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
        mockExamEnabled: Boolean(quiz.mockExamEnabled && mockExamAvailability.canUseMockExams),
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
        totalPoints: Math.round(input.totalPoints),
        earnedPoints: Math.round(input.score),
        scorePercent: String(scorePct),
        passed: input.passed,
        status: "completed",
        completedAt: new Date(),
        timeSpentSeconds: input.timeTakenSeconds || undefined,
        guestEmail: input.takerEmail || undefined,
        sourceType: "standalone",
        // Retain the proven legacy fields during the gradual compatibility window.
        legacyQuizId: quiz.id,
        legacyOrgId: quiz.orgId || undefined,
        legacyScoreRaw: input.score,
        legacyScorePct: scorePct,
        legacyTotalPoints: input.totalPoints,
        legacyIsPassed: input.passed,
        legacyIsCompleted: true,
        legacyTimeTakenSeconds: input.timeTakenSeconds || undefined,
        legacyTakerName: input.takerName || undefined,
        legacyTakerEmail: input.takerEmail || undefined,
        legacyAnswersJson: input.answersJson,
        legacyShareToken: input.shareToken,
        legacySubmittedAt: new Date(),
      });

      return { attemptId: result.insertId };
    }),

  /** Get attempts for an authorized organization quiz */
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
      await requireQuizMakerAccess(ctx, input.quizId);

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

  /** List standalone Quiz Creator results within one authorized organization. */
  listOrgAttemptResults: protectedProcedure
    .input(z.object({
      orgId: z.number().int().positive(),
      quizId: z.number().int().positive().optional(),
      quizType: z.enum(["assessment", "practice", "survey", "exam"]).optional(),
      learnerEmail: z.string().trim().email().optional(),
      limit: z.number().int().min(1).max(100).default(50),
      offset: z.number().int().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const db = (await getDb())!;
      await requireOrgAdmin(ctx.user.id, ctx.user.role, input.orgId);
      const quizConditions = [eq(quizzes.orgId, input.orgId)];
      if (input.quizType) quizConditions.push(eq(quizzes.quizType, input.quizType));
      const quizRows = await db
        .select({ id: quizzes.id, title: quizzes.title, quizType: quizzes.quizType })
        .from(quizzes)
        .where(and(...quizConditions));
      const allowedQuizIds = quizRows.map((quiz) => quiz.id);
      if (allowedQuizIds.length === 0) return { total: 0, results: [] };
      const conditions = [eq(quizAttempts.legacyOrgId, input.orgId)];
      if (input.quizId) conditions.push(eq(quizAttempts.quizId, input.quizId));
      if (input.learnerEmail) conditions.push(eq(quizAttempts.guestEmail, input.learnerEmail));
      conditions.push(inArray(quizAttempts.quizId, allowedQuizIds));

      const attempts = await db.select().from(quizAttempts)
        .where(and(...conditions))
        .orderBy(desc(quizAttempts.completedAt), desc(quizAttempts.startedAt));
      const titles = new Map(quizRows.map((quiz) => [quiz.id, quiz.title]));
      const types = new Map(quizRows.map((quiz) => [quiz.id, quiz.quizType]));

      const total = attempts.length;
      return {
        total,
        results: attempts.slice(input.offset, input.offset + input.limit).map((attempt) => ({
          id: attempt.id,
          quizId: attempt.quizId,
          quizTitle: titles.get(attempt.quizId) ?? "Quiz",
          quizType: types.get(attempt.quizId) ?? "assessment",
          learnerEmail: attempt.guestEmail,
          scorePercent: Number(attempt.scorePercent ?? 0),
          passed: Boolean(attempt.passed),
          status: attempt.status,
          completedAt: attempt.completedAt,
          startedAt: attempt.startedAt,
        })),
      };
    }),

  /** Get analytics summary for an authorized organization quiz */
  getQuizAnalytics: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = (await getDb())!;
      await requireQuizMakerAccess(ctx, input.quizId);

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

      const scores = attempts.map((a: any) => Number(a.scorePercent ?? a.legacyScorePct ?? a.scorePct ?? 0));
      const averageScore = scores.reduce((sum, s) => sum + s, 0) / totalAttempts;
      const passCount = attempts.filter((a: any) => a.passed ?? a.legacyIsPassed ?? a.isPassed).length;
      const passRate = (passCount / totalAttempts) * 100;
      const times = attempts.map((a: any) => a.timeSpentSeconds ?? a.legacyTimeTakenSeconds ?? a.timeTakenSeconds).filter(Boolean);
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
      await requireQuizMakerAccess(ctx, quizId);

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

  /** Export an authorized organization quiz as SCORM 1.2 or 2004 package */
  exportScorm: protectedProcedure
    .input(
      z.object({
        quizId: z.number(),
        format: z.enum(["scorm12", "scorm2004"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const quiz = await requireQuizMakerAccess(ctx, input.quizId);

      let serializedQuestions: SerializedQuizQuestion[];
      try {
        serializedQuestions = quiz.instructions ? JSON.parse(quiz.instructions) : [];
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Quiz questions could not be read. Save the quiz and try again." });
      }
      if (!Array.isArray(serializedQuestions) || serializedQuestions.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Quiz has no questions. Save the quiz and try again." });
      }

      const { generateScormPackage } = await import("./scormGenerator");
      const zipBuffer = await generateScormPackage({
        title: quiz.title,
        description: quiz.description || "",
        questions: serializedQuestions,
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

  /** Copy supported authored questions into a Question Bank owned by the same organization. */
  exportToQuestionBank: protectedProcedure
    .input(z.object({
      quizId: z.number(),
      targetBankId: z.number(),
      folderId: z.number().nullable().optional(),
      questionIds: z.array(z.string()).optional(),
      tagIds: z.array(z.number()).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const quiz = await requireQuizMakerAccess(ctx, input.quizId);
      let serializedQuestions: SerializedQuizQuestion[];
      try {
        serializedQuestions = quiz.instructions ? JSON.parse(quiz.instructions) : [];
      } catch {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Quiz questions could not be read. Save the quiz and try again." });
      }
      if (!Array.isArray(serializedQuestions) || serializedQuestions.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Quiz has no questions. Save the quiz and try again." });
      }
      const [bank] = await db.select().from(quizBanks).where(eq(quizBanks.id, input.targetBankId)).limit(1);
      if (!bank) throw new TRPCError({ code: "NOT_FOUND", message: "Question Bank not found." });
      if (bank.orgId !== quiz.orgId) {
        throw new TRPCError({ code: "FORBIDDEN", message: "The selected Question Bank belongs to another organisation." });
      }
      await requireOrgAdmin(ctx.user.id, ctx.user.role, bank.orgId);

      if (input.folderId) {
        const [folder] = await db.select({ orgId: quizBankFolders.orgId, bankId: quizBankFolders.bankId })
          .from(quizBankFolders).where(eq(quizBankFolders.id, input.folderId)).limit(1);
        if (!folder || folder.orgId !== quiz.orgId || folder.bankId !== bank.id) {
          throw new TRPCError({ code: "FORBIDDEN", message: "The selected Question Bank folder belongs to another organisation or bank." });
        }
      }

      if (input.tagIds.length > 0) {
        const tags = await db.select({ id: quizBankTags.id, orgId: quizBankTags.orgId })
          .from(quizBankTags)
          .where(inArray(quizBankTags.id, input.tagIds));
        if (tags.length !== input.tagIds.length || tags.some((tag) => tag.orgId !== quiz.orgId)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Question Bank tags must belong to the quiz organization." });
        }
      }

      const selectedQuestions = input.questionIds?.length
        ? serializedQuestions.filter((question) => question.id && input.questionIds!.includes(question.id))
        : serializedQuestions;
      if (selectedQuestions.length === 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Select at least one quiz question to export." });
      }
      if (selectedQuestions.some((question) => !question.id)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Every quiz question must be saved before it can synchronize to the Question Bank." });
      }

      let exportedCount = 0;
      let updatedCount = 0;
      for (const question of selectedQuestions) {
        const data = question.data ?? {};
        const values = {
          orgId: quiz.orgId,
          bankId: bank.id,
          folderId: input.folderId ?? null,
          sourceQuizId: quiz.id,
          sourceQuestionId: question.id,
          sourceQuizPayload: question,
          questionType: mapQuestionBankType(question),
          questionText: question.stem?.trim() || "Untitled question",
          questionHtml: question.stemHtml || undefined,
          mediaType: question.image?.url ? "image" : question.video?.url ? "video" : "none",
          mediaUrl: question.image?.url || question.video?.url || undefined,
          mediaAlt: question.image?.alt || undefined,
          hotspotZones: question.type === "hotspot" ? data.regions ?? [] : undefined,
          // Retain the native QuizMaker configuration for supported and future compatible question-bank players.
          puzzleConfig: ["drag_drop", "fill_blank", "drag_words", "dropdown", "short_answer", "essay", "numeric"].includes(question.type ?? "") ? data : undefined,
          numericMin: question.type === "numeric" && typeof data.rangeMin === "number" ? String(data.rangeMin) : undefined,
          numericMax: question.type === "numeric" && typeof data.rangeMax === "number" ? String(data.rangeMax) : undefined,
          points: Math.max(1, Math.round(question.points ?? 1)),
          lockAnswerOrder: Boolean(question.lockAnswerOrder),
          explanationText: question.explanation || undefined,
          explanationHtml: question.explanationHtml || undefined,
          importSource: "quiz_creator",
        };

        const [existingQuestion] = question.id
          ? await db.select({ id: quizBankQuestions.id })
            .from(quizBankQuestions)
            .where(and(
              eq(quizBankQuestions.orgId, quiz.orgId),
              eq(quizBankQuestions.bankId, bank.id),
              eq(quizBankQuestions.sourceQuizId, quiz.id),
              eq(quizBankQuestions.sourceQuestionId, question.id),
            ))
            .limit(1)
          : [];
        const questionId = existingQuestion?.id ?? (await db.insert(quizBankQuestions).values(values)).insertId;

        if (existingQuestion) {
          await db.update(quizBankQuestions).set(values).where(eq(quizBankQuestions.id, questionId));
          await db.delete(quizAnswerChoices).where(eq(quizAnswerChoices.questionId, questionId));
          await db.delete(quizQuestionTags).where(eq(quizQuestionTags.questionId, questionId));
          updatedCount++;
        } else {
          exportedCount++;
        }

        const choices = quizMakerChoicesForBank(question);
        if (choices.length > 0) {
          await db.insert(quizAnswerChoices).values(choices.map((choice) => ({ ...choice, questionId })));
        }
        if (input.tagIds.length > 0) {
          await db.insert(quizQuestionTags).values(input.tagIds.map((tagId) => ({ questionId, tagId })));
        }
      }

      if (exportedCount > 0) {
        await db.update(quizBanks)
          .set({ questionCount: sql`${quizBanks.questionCount} + ${exportedCount}` })
          .where(eq(quizBanks.id, bank.id));
      }

      return { exportedCount, updatedCount, bankId: bank.id };
    }),

  /** Get question-level analytics for an authorized organization quiz */
  getQuestionAnalytics: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const quiz = await requireQuizMakerAccess(ctx, input.quizId);

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
          try {
            const answers = (a as any).legacyAnswersJson ?? (a as any).answersJson;
            return answers ? JSON.parse(answers) : null;
          }
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

  /** Get publish status for an authorized organization quiz */
  getPublishStatus: protectedProcedure
    .input(z.object({ quizId: z.number() }))
    .query(async ({ ctx, input }) => {
      const db = (await getDb())!;
      const quiz = await requireQuizMakerAccess(ctx, input.quizId);

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
