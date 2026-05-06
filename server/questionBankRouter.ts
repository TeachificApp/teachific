import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { router, protectedProcedure } from "./_core/trpc";
import {
  getFoldersByOrg,
  getFolderById,
  createFolder,
  updateFolder,
  deleteFolder,
  getQuestionsByOrg,
  getQuestionCountByOrg,
  getQuestionById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  bulkDeleteQuestions,
  moveQuestionsToFolder,
  incrementUsageCount,
} from "./questionBankDb";

// Require org admin access
async function requireOrgAdmin(userId: number, orgId: number, userRole: string) {
  if (["site_owner", "site_admin", "org_super_admin", "org_admin"].includes(userRole)) return;
  throw new TRPCError({ code: "FORBIDDEN", message: "Organization admin access required" });
}

export const questionBankRouter = router({
  // ── Folders ─────────────────────────────────────────────────────────────────
  listFolders: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx.user.id, input.orgId, ctx.user.role);
      return getFoldersByOrg(input.orgId);
    }),

  createFolder: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      name: z.string().min(1).max(255),
      parentId: z.number().nullable().optional(),
      description: z.string().optional(),
      color: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx.user.id, input.orgId, ctx.user.role);
      return createFolder({
        orgId: input.orgId,
        name: input.name,
        parentId: input.parentId ?? null,
        description: input.description ?? null,
        color: input.color ?? null,
        createdBy: ctx.user.id,
      });
    }),

  updateFolder: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255).optional(),
      parentId: z.number().nullable().optional(),
      description: z.string().nullable().optional(),
      color: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const folder = await getFolderById(input.id);
      if (!folder) throw new TRPCError({ code: "NOT_FOUND" });
      await requireOrgAdmin(ctx.user.id, folder.orgId, ctx.user.role);
      const { id, ...updates } = input;
      await updateFolder(id, updates as any);
      return { success: true };
    }),

  deleteFolder: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const folder = await getFolderById(input.id);
      if (!folder) throw new TRPCError({ code: "NOT_FOUND" });
      await requireOrgAdmin(ctx.user.id, folder.orgId, ctx.user.role);
      await deleteFolder(input.id);
      return { success: true };
    }),

  // ── Questions ───────────────────────────────────────────────────────────────
  listQuestions: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      folderId: z.number().nullable().optional(),
      questionType: z.string().optional(),
      difficulty: z.string().optional(),
      search: z.string().optional(),
      limit: z.number().min(1).max(100).optional(),
      offset: z.number().min(0).optional(),
    }))
    .query(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx.user.id, input.orgId, ctx.user.role);
      const questions = await getQuestionsByOrg(input.orgId, {
        folderId: input.folderId,
        questionType: input.questionType,
        difficulty: input.difficulty,
        search: input.search,
        limit: input.limit,
        offset: input.offset,
      });
      const total = await getQuestionCountByOrg(input.orgId, input.folderId);
      return { questions, total };
    }),

  getQuestion: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      const q = await getQuestionById(input.id);
      if (!q) throw new TRPCError({ code: "NOT_FOUND" });
      await requireOrgAdmin(ctx.user.id, q.orgId, ctx.user.role);
      return q;
    }),

  createQuestion: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      folderId: z.number().nullable().optional(),
      questionType: z.string(),
      stem: z.string().min(1),
      dataJson: z.string(),
      points: z.number().optional(),
      difficulty: z.enum(["easy", "medium", "hard"]).optional(),
      tags: z.string().optional(),
      explanation: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx.user.id, input.orgId, ctx.user.role);
      return createQuestion({
        orgId: input.orgId,
        folderId: input.folderId ?? null,
        questionType: input.questionType as any,
        stem: input.stem,
        dataJson: input.dataJson,
        points: input.points ?? 1,
        difficulty: (input.difficulty ?? "medium") as any,
        tags: input.tags ?? null,
        explanation: input.explanation ?? null,
        createdBy: ctx.user.id,
      });
    }),

  updateQuestion: protectedProcedure
    .input(z.object({
      id: z.number(),
      folderId: z.number().nullable().optional(),
      questionType: z.string().optional(),
      stem: z.string().optional(),
      dataJson: z.string().optional(),
      points: z.number().optional(),
      difficulty: z.enum(["easy", "medium", "hard"]).optional(),
      tags: z.string().optional(),
      explanation: z.string().nullable().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const q = await getQuestionById(input.id);
      if (!q) throw new TRPCError({ code: "NOT_FOUND" });
      await requireOrgAdmin(ctx.user.id, q.orgId, ctx.user.role);
      const { id, ...updates } = input;
      await updateQuestion(id, updates as any);
      return { success: true };
    }),

  deleteQuestion: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const q = await getQuestionById(input.id);
      if (!q) throw new TRPCError({ code: "NOT_FOUND" });
      await requireOrgAdmin(ctx.user.id, q.orgId, ctx.user.role);
      await deleteQuestion(input.id);
      return { success: true };
    }),

  bulkDelete: protectedProcedure
    .input(z.object({ orgId: z.number(), ids: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx.user.id, input.orgId, ctx.user.role);
      await bulkDeleteQuestions(input.ids);
      return { success: true };
    }),

  moveToFolder: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      ids: z.array(z.number()),
      folderId: z.number().nullable(),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx.user.id, input.orgId, ctx.user.role);
      await moveQuestionsToFolder(input.ids, input.folderId);
      return { success: true };
    }),

  // Import questions from bank into a quiz (returns question data for the quiz creator to use)
  exportForQuiz: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      questionIds: z.array(z.number()),
    }))
    .mutation(async ({ ctx, input }) => {
      await requireOrgAdmin(ctx.user.id, input.orgId, ctx.user.role);
      const questions = [];
      for (const id of input.questionIds) {
        const q = await getQuestionById(id);
        if (q && q.orgId === input.orgId) {
          questions.push({
            bankItemId: q.id,
            questionType: q.questionType,
            stem: q.stem,
            dataJson: q.dataJson,
            points: q.points,
            difficulty: q.difficulty,
            explanation: q.explanation,
          });
        }
      }
      // Increment usage counts
      await incrementUsageCount(input.questionIds);
      return { questions };
    }),
});
