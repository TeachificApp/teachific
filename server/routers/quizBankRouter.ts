import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";

let _db: Awaited<ReturnType<typeof getDb>>;
async function db() { return _db ?? (_db = await getDb()); }
import {
  quizBanks,
  quizBankFolders,
  quizBankQuestions,
  quizBankTags,
  quizQuestionTags,
  quizAnswerChoices,
  quizImportJobs,
  quizzes,
  quizQuestions,
} from "../../drizzle/schema";
import { invokeLLM } from "../_core/llm";
import { and, eq, inArray, like, sql, desc, asc } from "drizzle-orm";
import { storagePut } from "../storage";
import { TRPCError } from "@trpc/server";

// ─── Question type enum ───────────────────────────────────────────────────────
const QUESTION_TYPES = ["mc","tf","ms","hotspot","puzzle","matching","sequence","numeric","short_answer","info_slide"] as const;
type QuestionType = typeof QUESTION_TYPES[number];

// ─── Answer choice schema ─────────────────────────────────────────────────────
const answerChoiceSchema = z.object({
  id: z.number().optional(),
  choiceText: z.string().optional(),
  choiceHtml: z.string().optional(),
  mediaType: z.enum(["none","image","video"]).default("none"),
  mediaUrl: z.string().optional(),
  mediaAlt: z.string().optional(),
  isCorrect: z.boolean().default(false),
  sortOrder: z.number().default(0),
  matchPairId: z.string().optional(),
  matchSide: z.enum(["left","right"]).optional(),
  feedbackText: z.string().optional(),
  feedbackMediaUrl: z.string().optional(),
});

// ─── Question upsert schema ───────────────────────────────────────────────────
const questionUpsertSchema = z.object({
  id: z.number().optional(),
  bankId: z.number(),
  questionType: z.enum(QUESTION_TYPES).default("mc"),
  questionText: z.string().min(1),
  questionHtml: z.string().optional(),
  mediaType: z.enum(["none","image","video"]).default("none"),
  mediaUrl: z.string().optional(),
  mediaAlt: z.string().optional(),
  hotspotZones: z.any().optional(),
  puzzleConfig: z.any().optional(),
  numericMin: z.number().optional(),
  numericMax: z.number().optional(),
  points: z.number().default(1),
  partialCredit: z.boolean().default(false),
  penaltyPoints: z.number().default(0),
  difficulty: z.enum(["easy","medium","hard"]).default("medium"),
  explanationText: z.string().optional(),
  explanationHtml: z.string().optional(),
  explanationMediaType: z.enum(["none","image","video"]).default("none"),
  explanationMediaUrl: z.string().optional(),
  tagIds: z.array(z.number()).default([]),
  choices: z.array(answerChoiceSchema).default([]),
});

export const quizBankRouter = router({
  // ─── Banks ────────────────────────────────────────────────────────────────
  listBanks: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input, ctx }) => {
      return (await db()).select().from(quizBanks)
        .where(eq(quizBanks.orgId, input.orgId))
        .orderBy(asc(quizBanks.name));
    }),

  createBank: protectedProcedure
    .input(z.object({ orgId: z.number(), name: z.string().min(1), description: z.string().optional() }))
    .mutation(async ({ input }) => {
      const [result] = await (await db()).insert(quizBanks).values({
        orgId: input.orgId,
        name: input.name,
        description: input.description,
      });
      return { id: result.insertId };
    }),

  updateBank: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().min(1), description: z.string().optional() }))
    .mutation(async ({ input }) => {
      await (await db()).update(quizBanks).set({ name: input.name, description: input.description }).where(eq(quizBanks.id, input.id));
    }),

  deleteBank: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      // Delete all questions in this bank first
      const questions = await (await db()).select({ id: quizBankQuestions.id })
        .from(quizBankQuestions).where(eq(quizBankQuestions.bankId, input.id));
      if (questions.length > 0) {
        const qIds = questions.map(q => q.id);
        await (await db()).delete(quizQuestionTags).where(inArray(quizQuestionTags.questionId, qIds));
        await (await db()).delete(quizAnswerChoices).where(inArray(quizAnswerChoices.questionId, qIds));
        await (await db()).delete(quizBankQuestions).where(eq(quizBankQuestions.bankId, input.id));
      }
      await (await db()).delete(quizBanks).where(eq(quizBanks.id, input.id));
    }),

  // ─── Folders ──────────────────────────────────────────────────────────────
  listFolders: protectedProcedure
    .input(z.object({ orgId: z.number(), bankId: z.number().optional() }))
    .query(async ({ input }) => {
      const conditions = [eq(quizBankFolders.orgId, input.orgId)];
      if (input.bankId) conditions.push(eq(quizBankFolders.bankId, input.bankId));
      return (await db()).select().from(quizBankFolders)
        .where(and(...conditions))
        .orderBy(asc(quizBankFolders.sortOrder), asc(quizBankFolders.name));
    }),

  createFolder: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      bankId: z.number(),
      name: z.string().min(1),
      parentId: z.number().optional(),
      color: z.string().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const [result] = await (await db()).insert(quizBankFolders).values({
        orgId: input.orgId,
        bankId: input.bankId,
        name: input.name,
        parentId: input.parentId ?? null,
        color: input.color ?? "#24abbc",
        description: input.description,
      });
      return { id: result.insertId };
    }),

  updateFolder: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).optional(),
      color: z.string().optional(),
      description: z.string().optional(),
      parentId: z.number().nullable().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await (await db()).update(quizBankFolders).set(data as any).where(eq(quizBankFolders.id, id));
    }),

  deleteFolder: protectedProcedure
    .input(z.object({ id: z.number(), moveQuestionsToFolderId: z.number().nullable().optional() }))
    .mutation(async ({ input }) => {
      // Move or unfile questions
      await (await db()).update(quizBankQuestions)
        .set({ folderId: input.moveQuestionsToFolderId ?? null })
        .where(eq(quizBankQuestions.folderId, input.id));
      // Move child folders to parent
      const [folder] = await (await db()).select().from(quizBankFolders).where(eq(quizBankFolders.id, input.id));
      if (folder) {
        await (await db()).update(quizBankFolders)
          .set({ parentId: folder.parentId ?? null })
          .where(eq(quizBankFolders.parentId, input.id));
      }
      await (await db()).delete(quizBankFolders).where(eq(quizBankFolders.id, input.id));
    }),

  // ─── Tags ─────────────────────────────────────────────────────────────────
  listTags: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input }) => {
      return (await db()).select().from(quizBankTags)
        .where(eq(quizBankTags.orgId, input.orgId))
        .orderBy(asc(quizBankTags.name));
    }),

  createTag: protectedProcedure
    .input(z.object({ orgId: z.number(), name: z.string().min(1), color: z.string().optional() }))
    .mutation(async ({ input }) => {
      const [result] = await (await db()).insert(quizBankTags).values({
        orgId: input.orgId,
        name: input.name,
        color: input.color ?? "#24abbc",
      });
      return { id: result.insertId };
    }),

  updateTag: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().min(1), color: z.string().optional() }))
    .mutation(async ({ input }) => {
      await (await db()).update(quizBankTags).set({ name: input.name, color: input.color }).where(eq(quizBankTags.id, input.id));
    }),

  deleteTag: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await (await db()).delete(quizQuestionTags).where(eq(quizQuestionTags.tagId, input.id));
      await (await db()).delete(quizBankTags).where(eq(quizBankTags.id, input.id));
    }),

  // ─── AI Question Generation ──────────────────────────────────────────────
  aiGenerateQuestions: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      bankId: z.number(),
      folderId: z.number().optional(),
      tagIds: z.array(z.number()).default([]),
      topic: z.string().min(1),
      questionCount: z.number().min(1).max(30).default(5),
      difficulty: z.enum(["easy","medium","hard","mixed"]).default("mixed"),
      questionTypes: z.array(z.enum(["mc","tf","ms","short_answer"])).default(["mc"]),
      additionalContext: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const typeLabels: Record<string, string> = {
        mc: "multiple choice (1 correct answer)",
        tf: "true/false",
        ms: "multiple select (multiple correct answers)",
        short_answer: "short answer (text response)",
      };
      const typesDesc = input.questionTypes.map(t => typeLabels[t] || t).join(", ");
      const prompt = `Generate ${input.questionCount} quiz questions about: "${input.topic}".

Requirements:
- Question types to use: ${typesDesc}
- Difficulty: ${input.difficulty === "mixed" ? "vary between easy, medium, and hard" : input.difficulty}
- Each question must be educationally accurate and clear
${input.additionalContext ? `- Additional context: ${input.additionalContext}` : ""}

Return a JSON array of questions. Each question object must have:
- questionType: one of "mc", "tf", "ms", "short_answer"
- questionText: the question stem (plain text)
- difficulty: "easy", "medium", or "hard"
- points: 1 for easy, 2 for medium, 3 for hard
- explanationText: a brief explanation of the correct answer
- choices: array of answer choices (for mc/tf/ms), each with { choiceText, isCorrect, sortOrder }
  - For mc: exactly 4 choices, exactly 1 correct
  - For tf: exactly 2 choices ("True" and "False"), exactly 1 correct
  - For ms: 4-6 choices, 2-3 correct
  - For short_answer: empty choices array`;

      const response = await invokeLLM({
        messages: [
          { role: "system", content: "You are an expert quiz question author. Always respond with valid JSON only, no markdown." },
          { role: "user", content: prompt },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "quiz_questions",
            strict: true,
            schema: {
              type: "object",
              properties: {
                questions: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      questionType: { type: "string" },
                      questionText: { type: "string" },
                      difficulty: { type: "string" },
                      points: { type: "number" },
                      explanationText: { type: "string" },
                      choices: {
                        type: "array",
                        items: {
                          type: "object",
                          properties: {
                            choiceText: { type: "string" },
                            isCorrect: { type: "boolean" },
                            sortOrder: { type: "number" },
                          },
                          required: ["choiceText","isCorrect","sortOrder"],
                          additionalProperties: false,
                        },
                      },
                    },
                    required: ["questionType","questionText","difficulty","points","explanationText","choices"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["questions"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response?.choices?.[0]?.message?.content ?? "{}";
      const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
      const questions: any[] = parsed.questions ?? [];

      const savedIds: number[] = [];
      for (const q of questions) {
        const qType = ["mc","tf","ms","short_answer"].includes(q.questionType) ? q.questionType : "mc";
        const [result] = await (await db()).insert(quizBankQuestions).values({
          orgId: input.orgId,
          bankId: input.bankId,
          folderId: input.folderId ?? null,
          questionType: qType as any,
          questionText: q.questionText,
          difficulty: ["easy","medium","hard"].includes(q.difficulty) ? q.difficulty : "medium",
          points: q.points ?? 1,
          explanationText: q.explanationText,
          importSource: "ai_generated",
        });
        const qId = result.insertId;
        savedIds.push(qId);
        if (q.choices?.length > 0) {
          await (await db()).insert(quizAnswerChoices).values(
            q.choices.map((c: any, i: number) => ({
              questionId: qId,
              choiceText: c.choiceText,
              isCorrect: c.isCorrect,
              sortOrder: c.sortOrder ?? i,
            }))
          );
        }
        if (input.tagIds.length > 0) {
          await (await db()).insert(quizQuestionTags).values(
            input.tagIds.map(tagId => ({ questionId: qId, tagId }))
          );
        }
      }
      // Update bank question count
      await (await db()).update(quizBanks)
        .set({ questionCount: sql`question_count + ${savedIds.length}` })
        .where(eq(quizBanks.id, input.bankId));

      return { count: savedIds.length, questionIds: savedIds };
    }),

  // ─── Bulk Move Questions to Folder ────────────────────────────────────────
  bulkMoveToFolder: protectedProcedure
    .input(z.object({
      questionIds: z.array(z.number()),
      folderId: z.number().nullable(),
    }))
    .mutation(async ({ input }) => {
      if (input.questionIds.length === 0) return { moved: 0 };
      await (await db()).update(quizBankQuestions)
        .set({ folderId: input.folderId })
        .where(inArray(quizBankQuestions.id, input.questionIds));
      return { moved: input.questionIds.length };
    }),

  // ─── Import Bank Questions into a Quiz ────────────────────────────────────
  importToQuiz: protectedProcedure
    .input(z.object({
      quizId: z.number(),
      questionIds: z.array(z.number()),
    }))
    .mutation(async ({ input }) => {
      if (input.questionIds.length === 0) return { imported: 0 };
      const bankQuestions = await (await db()).select().from(quizBankQuestions)
        .where(inArray(quizBankQuestions.id, input.questionIds));
      const bankChoices = await (await db()).select().from(quizAnswerChoices)
        .where(inArray(quizAnswerChoices.questionId, input.questionIds));

      // Get current max sort order in quiz
      const existing = await (await db()).select({ sortOrder: quizQuestions.sortOrder })
        .from(quizQuestions).where(eq(quizQuestions.quizId, input.quizId))
        .orderBy(desc(quizQuestions.sortOrder)).limit(1);
      let sortOrder = (existing[0]?.sortOrder ?? -1) + 1;

      const typeMap: Record<string, string> = {
        mc: "multiple_choice", tf: "true_false", ms: "multiple_select",
        short_answer: "short_answer", info_slide: "info_slide",
        matching: "matching", sequence: "sequence", numeric: "numeric",
      };

      const importedIds: number[] = [];
      for (const bq of bankQuestions) {
        const [result] = await (await db()).insert(quizQuestions).values({
          quizId: input.quizId,
          sortOrder: sortOrder++,
          questionType: (typeMap[bq.questionType] ?? "multiple_choice") as any,
          questionText: bq.questionText,
          explanation: bq.explanationText ?? undefined,
          points: bq.points,
          imageUrl: bq.mediaType === "image" ? bq.mediaUrl ?? undefined : undefined,
          videoUrl: bq.mediaType === "video" ? bq.mediaUrl ?? undefined : undefined,
        });
        const newQId = result.insertId;
        importedIds.push(newQId);
        const choices = bankChoices.filter(c => c.questionId === bq.id);
        if (choices.length > 0) {
          await (await db()).insert(quizQAnswerChoices).values(
            choices.map((c, i) => ({
              questionId: newQId,
              choiceText: c.choiceText ?? "",
              isCorrect: c.isCorrect,
              sortOrder: c.sortOrder ?? i,
              feedbackText: c.feedbackText ?? undefined,
            }))
          );
        }
      }
      return { imported: importedIds.length };
    }),

  // ─── Questions ────────────────────────────────────────────────────────────
  listQuestions: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      bankId: z.number().optional(),
      tagIds: z.array(z.number()).optional(),
      questionType: z.string().optional(),
      search: z.string().optional(),
      difficulty: z.string().optional(),
      includeArchived: z.boolean().default(false),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(async ({ input }) => {
      const conditions = [eq(quizBankQuestions.orgId, input.orgId)];
      if (input.bankId) conditions.push(eq(quizBankQuestions.bankId, input.bankId));
      if (!input.includeArchived) conditions.push(eq(quizBankQuestions.isArchived, false));
      if (input.questionType) conditions.push(eq(quizBankQuestions.questionType, input.questionType as QuestionType));
      if (input.difficulty) conditions.push(eq(quizBankQuestions.difficulty, input.difficulty as "easy"|"medium"|"hard"));
      if (input.search) conditions.push(like(quizBankQuestions.questionText, `%${input.search}%`));

      const questions = await (await db()).select().from(quizBankQuestions)
        .where(and(...conditions))
        .orderBy(desc(quizBankQuestions.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      // Get choices and tags for each question
      if (questions.length === 0) return { questions: [], total: 0 };

      const qIds = questions.map(q => q.id);
      const choices = await (await db()).select().from(quizAnswerChoices)
        .where(inArray(quizAnswerChoices.questionId, qIds))
        .orderBy(asc(quizAnswerChoices.sortOrder));
      const tags = await (await db()).select().from(quizQuestionTags)
        .where(inArray(quizQuestionTags.questionId, qIds));

      const [{ count }] = await (await db()).select({ count: sql<number>`count(*)` })
        .from(quizBankQuestions).where(and(...conditions));

      return {
        questions: questions.map(q => ({
          ...q,
          choices: choices.filter(c => c.questionId === q.id),
          tagIds: tags.filter(t => t.questionId === q.id).map(t => t.tagId),
        })),
        total: count,
      };
    }),

  getQuestion: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const [question] = await (await db()).select().from(quizBankQuestions).where(eq(quizBankQuestions.id, input.id));
      if (!question) throw new TRPCError({ code: "NOT_FOUND" });
      const choices = await (await db()).select().from(quizAnswerChoices)
        .where(eq(quizAnswerChoices.questionId, input.id))
        .orderBy(asc(quizAnswerChoices.sortOrder));
      const tags = await (await db()).select().from(quizQuestionTags)
        .where(eq(quizQuestionTags.questionId, input.id));
      return { ...question, choices, tagIds: tags.map(t => t.tagId) };
    }),

  upsertQuestion: protectedProcedure
    .input(questionUpsertSchema)
    .mutation(async ({ input, ctx }) => {
      const { id, tagIds, choices, ...questionData } = input;

      let questionId: number;
      if (id) {
        await (await db()).update(quizBankQuestions).set({
          ...questionData,
          hotspotZones: questionData.hotspotZones ?? null,
          puzzleConfig: questionData.puzzleConfig ?? null,
        }).where(eq(quizBankQuestions.id, id));
        questionId = id;
      } else {
        const [result] = await (await db()).insert(quizBankQuestions).values({
          ...questionData,
          orgId: questionData.bankId, // will be overridden below
        });
        // Fix orgId from bank
        const [bank] = await (await db()).select({ orgId: quizBanks.orgId }).from(quizBanks).where(eq(quizBanks.id, questionData.bankId));
        if (bank) {
          await (await db()).update(quizBankQuestions).set({ orgId: bank.orgId }).where(eq(quizBankQuestions.id, result.insertId));
        }
        questionId = result.insertId;
        // Update question count
        await (await db()).update(quizBanks).set({ questionCount: sql`question_count + 1` }).where(eq(quizBanks.id, questionData.bankId));
      }

      // Sync tags
      await (await db()).delete(quizQuestionTags).where(eq(quizQuestionTags.questionId, questionId));
      if (tagIds.length > 0) {
        await (await db()).insert(quizQuestionTags).values(tagIds.map(tagId => ({ questionId, tagId })));
      }

      // Sync choices
      await (await db()).delete(quizAnswerChoices).where(eq(quizAnswerChoices.questionId, questionId));
      if (choices.length > 0) {
        await (await db()).insert(quizAnswerChoices).values(
          choices.map((c, i) => ({
            questionId,
            choiceText: c.choiceText,
            choiceHtml: c.choiceHtml,
            mediaType: c.mediaType,
            mediaUrl: c.mediaUrl,
            mediaAlt: c.mediaAlt,
            isCorrect: c.isCorrect,
            sortOrder: c.sortOrder ?? i,
            matchPairId: c.matchPairId,
            matchSide: c.matchSide,
            feedbackText: c.feedbackText,
            feedbackMediaUrl: c.feedbackMediaUrl,
          }))
        );
      }

      return { id: questionId };
    }),

  deleteQuestion: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const [q] = await (await db()).select({ bankId: quizBankQuestions.bankId }).from(quizBankQuestions).where(eq(quizBankQuestions.id, input.id));
      await (await db()).delete(quizQuestionTags).where(eq(quizQuestionTags.questionId, input.id));
      await (await db()).delete(quizAnswerChoices).where(eq(quizAnswerChoices.questionId, input.id));
      await (await db()).delete(quizBankQuestions).where(eq(quizBankQuestions.id, input.id));
      if (q) {
        await (await db()).update(quizBanks).set({ questionCount: sql`GREATEST(question_count - 1, 0)` }).where(eq(quizBanks.id, q.bankId));
      }
    }),

  archiveQuestion: protectedProcedure
    .input(z.object({ id: z.number(), archived: z.boolean() }))
    .mutation(async ({ input }) => {
      await (await db()).update(quizBankQuestions).set({ isArchived: input.archived }).where(eq(quizBankQuestions.id, input.id));
    }),

  // ─── Import ───────────────────────────────────────────────────────────────
  createImportJob: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      bankId: z.number().optional(),
      source: z.enum(["scorm","csv","xls"]),
      filename: z.string(),
      fileUrl: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      const [result] = await (await db()).insert(quizImportJobs).values({
        orgId: input.orgId,
        bankId: input.bankId,
        importedById: ctx.user.id,
        source: input.source,
        filename: input.filename,
        fileUrl: input.fileUrl,
        status: "pending",
      });
      return { id: result.insertId };
    }),

  getImportJob: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const [job] = await (await db()).select().from(quizImportJobs).where(eq(quizImportJobs.id, input.id));
      if (!job) throw new TRPCError({ code: "NOT_FOUND" });
      return job;
    }),

  listImportJobs: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input }) => {
      return (await db()).select().from(quizImportJobs)
        .where(eq(quizImportJobs.orgId, input.orgId))
        .orderBy(desc(quizImportJobs.createdAt))
        .limit(20);
    }),

  parseImportFile: protectedProcedure
    .input(z.object({
      jobId: z.number(),
      fileUrl: z.string(),
      source: z.enum(["scorm","csv","xls"]),
    }))
    .mutation(async ({ input }) => {
      // Mark as parsing
      await (await db()).update(quizImportJobs).set({ status: "parsing" }).where(eq(quizImportJobs.id, input.jobId));

      try {
        let parsedQuestions: any[] = [];

        if (input.source === "csv") {
          // Parse CSV
          const response = await fetch(input.fileUrl);
          const text = await response.text();
          parsedQuestions = parseCSVQuestions(text);
        } else if (input.source === "scorm") {
          // Parse SCORM QTI XML
          const response = await fetch(input.fileUrl);
          const text = await response.text();
          parsedQuestions = parseSCORMQuestions(text);
        }

        await (await db()).update(quizImportJobs).set({
          status: "preview_ready",
          parsedQuestions: parsedQuestions,
        }).where(eq(quizImportJobs.id, input.jobId));

        return { count: parsedQuestions.length, questions: parsedQuestions.slice(0, 5) };
      } catch (err: any) {
        await (await db()).update(quizImportJobs).set({
          status: "failed",
          errorLog: [{ message: err.message }],
        }).where(eq(quizImportJobs.id, input.jobId));
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: err.message });
      }
    }),

  confirmImport: protectedProcedure
    .input(z.object({
      jobId: z.number(),
      bankId: z.number(),
      orgId: z.number(),
      selectedIndices: z.array(z.number()).optional(), // null = import all
    }))
    .mutation(async ({ input }) => {
      const [job] = await (await db()).select().from(quizImportJobs).where(eq(quizImportJobs.id, input.jobId));
      if (!job || !job.parsedQuestions) throw new TRPCError({ code: "NOT_FOUND" });

      await (await db()).update(quizImportJobs).set({ status: "importing", bankId: input.bankId }).where(eq(quizImportJobs.id, input.jobId));

      const allQuestions = job.parsedQuestions as any[];
      const toImport = input.selectedIndices
        ? allQuestions.filter((_, i) => input.selectedIndices!.includes(i))
        : allQuestions;

      let importedCount = 0;
      let skippedCount = 0;
      const errors: any[] = [];

      for (const q of toImport) {
        try {
          const [qResult] = await (await db()).insert(quizBankQuestions).values({
            orgId: input.orgId,
            bankId: input.bankId,
            questionType: q.questionType ?? "mc",
            questionText: q.questionText ?? "Imported question",
            questionHtml: q.questionHtml,
            mediaType: q.mediaType ?? "none",
            mediaUrl: q.mediaUrl,
            points: q.points ?? 1,
            difficulty: q.difficulty ?? "medium",
            explanationText: q.explanationText,
            importSource: job.source,
            importJobId: input.jobId,
          });

          if (q.choices && q.choices.length > 0) {
            await (await db()).insert(quizAnswerChoices).values(
              q.choices.map((c: any, i: number) => ({
                questionId: qResult.insertId,
                choiceText: c.text ?? c.choiceText,
                isCorrect: c.isCorrect ?? false,
                sortOrder: i,
                feedbackText: c.feedback,
              }))
            );
          }

          importedCount++;
        } catch (err: any) {
          skippedCount++;
          errors.push({ question: q.questionText, error: err.message });
        }
      }

      // Update bank question count
      await (await db()).update(quizBanks).set({ questionCount: sql`question_count + ${importedCount}` }).where(eq(quizBanks.id, input.bankId));

      await (await db()).update(quizImportJobs).set({
        status: "completed",
        importedCount,
        skippedCount,
        errorLog: errors.length > 0 ? errors : null,
        completedAt: new Date(),
      }).where(eq(quizImportJobs.id, input.jobId));

      return { importedCount, skippedCount, errors };
    }),
});

// ─── CSV Parser ───────────────────────────────────────────────────────────────
function parseCSVQuestions(csvText: string): any[] {
  const lines = csvText.split("\n").filter(l => l.trim());
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/"/g, ""));
  const questions: any[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = (cols[idx] ?? "").trim(); });

    if (!row["question"] && !row["question_text"]) continue;

    const questionText = row["question"] || row["question_text"];
    const questionType = detectQuestionType(row);
    const choices: any[] = [];

    // Parse A/B/C/D choices
    ["a","b","c","d","e","f"].forEach(letter => {
      const text = row[letter] || row[`choice_${letter}`] || row[`option_${letter}`];
      if (text) {
        const correctAnswer = (row["correct_answer"] || row["answer"] || "").toLowerCase();
        choices.push({
          text,
          isCorrect: correctAnswer === letter || correctAnswer === text.toLowerCase(),
          feedback: row[`feedback_${letter}`],
        });
      }
    });

    questions.push({
      questionType,
      questionText,
      choices,
      points: parseFloat(row["points"] || row["point_value"] || "1") || 1,
      difficulty: (row["difficulty"] || "medium").toLowerCase(),
      explanationText: row["explanation"] || row["feedback"] || row["rationale"],
      mediaUrl: row["image_url"] || row["media_url"],
      mediaType: (row["image_url"] || row["media_url"]) ? "image" : "none",
    });
  }

  return questions;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; }
    else if (char === "," && !inQuotes) { result.push(current); current = ""; }
    else { current += char; }
  }
  result.push(current);
  return result;
}

function detectQuestionType(row: Record<string, string>): string {
  const type = (row["type"] || row["question_type"] || "").toLowerCase();
  if (type.includes("true") || type.includes("tf") || type.includes("boolean")) return "tf";
  if (type.includes("multi") && type.includes("select")) return "ms";
  if (type.includes("hotspot")) return "hotspot";
  if (type.includes("match")) return "matching";
  if (type.includes("order") || type.includes("sequence")) return "sequence";
  if (type.includes("numeric") || type.includes("number")) return "numeric";
  if (type.includes("short") || type.includes("text")) return "short_answer";
  return "mc";
}

// ─── SCORM QTI XML Parser ─────────────────────────────────────────────────────
function parseSCORMQuestions(xmlText: string): any[] {
  const questions: any[] = [];

  // Simple regex-based QTI parser (handles SCORM 1.2 and 2004 QTI)
  const itemRegex = /<item[^>]*>([\s\S]*?)<\/item>/gi;
  let itemMatch;

  while ((itemMatch = itemRegex.exec(xmlText)) !== null) {
    const itemXml = itemMatch[1];

    // Extract question text
    const matTextMatch = itemXml.match(/<mattext[^>]*>([\s\S]*?)<\/mattext>/i)
      || itemXml.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    if (!matTextMatch) continue;

    const questionText = stripHtml(matTextMatch[1]).trim();
    if (!questionText) continue;

    // Extract response type
    const rtMatch = itemXml.match(/rcardinality="([^"]+)"/i);
    const cardinality = rtMatch ? rtMatch[1].toLowerCase() : "single";
    const questionType = cardinality === "multiple" ? "ms" : "mc";

    // Extract choices
    const choices: any[] = [];
    const responseChoiceRegex = /<response_label[^>]*ident="([^"]+)"[^>]*>([\s\S]*?)<\/response_label>/gi;
    let choiceMatch;
    while ((choiceMatch = responseChoiceRegex.exec(itemXml)) !== null) {
      const choiceId = choiceMatch[1];
      const choiceText = stripHtml(choiceMatch[2]).trim();
      if (choiceText) {
        choices.push({ id: choiceId, text: choiceText, isCorrect: false });
      }
    }

    // Mark correct answers
    const correctRegex = /<varequal[^>]*>(.*?)<\/varequal>/gi;
    let correctMatch;
    while ((correctMatch = correctRegex.exec(itemXml)) !== null) {
      const correctId = correctMatch[1].trim();
      const choice = choices.find(c => c.id === correctId);
      if (choice) choice.isCorrect = true;
    }

    // Extract feedback
    const feedbackMatch = itemXml.match(/<mattext[^>]*>([\s\S]*?)<\/mattext>/gi);
    const explanationText = feedbackMatch && feedbackMatch.length > 1
      ? stripHtml(feedbackMatch[feedbackMatch.length - 1]).trim()
      : undefined;

    questions.push({
      questionType,
      questionText,
      choices,
      explanationText,
      points: 1,
      difficulty: "medium",
    });
  }

  return questions;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}
