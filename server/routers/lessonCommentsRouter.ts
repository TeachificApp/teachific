import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNull, lt } from "drizzle-orm";
import { z } from "zod";
import { lessonComments, lmsLessons, users } from "../../drizzle/schema";
import { getDb } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const COMMENT_LIMIT_MAX = 50;

type CommentRow = typeof lessonComments.$inferSelect & {
  authorName: string | null;
};

function shapeComment(row: CommentRow, currentUserId: number) {
  return {
    id: row.id,
    userId: row.userId,
    content: row.content,
    parentId: row.parentId,
    createdAt: row.createdAt,
    authorName: row.authorName,
    authorDisplayName: row.authorName,
    authorAvatarUrl: null,
    authorCredentials: null,
    isOwn: row.userId === currentUserId,
  };
}

export const lessonCommentsRouter = router({
  list: protectedProcedure
    .input(z.object({
      lessonId: z.number(),
      limit: z.number().int().min(1).max(COMMENT_LIMIT_MAX).default(20),
      cursor: z.number().optional(),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const conditions = [
        eq(lessonComments.lessonId, input.lessonId),
        isNull(lessonComments.parentId),
        isNull(lessonComments.deletedAt),
      ];
      if (input.cursor) conditions.push(lt(lessonComments.id, input.cursor));

      const topLevelRows = await db
        .select({
          id: lessonComments.id,
          lessonId: lessonComments.lessonId,
          userId: lessonComments.userId,
          content: lessonComments.content,
          parentId: lessonComments.parentId,
          deletedAt: lessonComments.deletedAt,
          deletedByAdminId: lessonComments.deletedByAdminId,
          createdAt: lessonComments.createdAt,
          updatedAt: lessonComments.updatedAt,
          authorName: users.name,
        })
        .from(lessonComments)
        .leftJoin(users, eq(users.id, lessonComments.userId))
        .where(and(...conditions))
        .orderBy(desc(lessonComments.id))
        .limit(input.limit + 1);

      const hasMore = topLevelRows.length > input.limit;
      const pageRows = topLevelRows.slice(0, input.limit);
      const parentIds = pageRows.map((row) => row.id);

      const replyRows = parentIds.length === 0
        ? []
        : await db
          .select({
            id: lessonComments.id,
            lessonId: lessonComments.lessonId,
            userId: lessonComments.userId,
            content: lessonComments.content,
            parentId: lessonComments.parentId,
            deletedAt: lessonComments.deletedAt,
            deletedByAdminId: lessonComments.deletedByAdminId,
            createdAt: lessonComments.createdAt,
            updatedAt: lessonComments.updatedAt,
            authorName: users.name,
          })
          .from(lessonComments)
          .leftJoin(users, eq(users.id, lessonComments.userId))
          .where(and(
            eq(lessonComments.lessonId, input.lessonId),
            inArray(lessonComments.parentId, parentIds),
            isNull(lessonComments.deletedAt),
          ))
          .orderBy(lessonComments.createdAt);

      const repliesByParent = new Map<number, ReturnType<typeof shapeComment>[]>();
      for (const reply of replyRows) {
        if (!reply.parentId) continue;
        const shaped = shapeComment(reply, ctx.user.id);
        repliesByParent.set(reply.parentId, [...(repliesByParent.get(reply.parentId) ?? []), shaped]);
      }

      return {
        comments: pageRows.map((row) => ({
          ...shapeComment(row, ctx.user.id),
          replies: repliesByParent.get(row.id) ?? [],
        })),
        hasMore,
      };
    }),

  add: protectedProcedure
    .input(z.object({
      lessonId: z.number(),
      content: z.string().trim().min(1).max(2000),
      parentId: z.number().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });

      const [lesson] = await db
        .select({ id: lmsLessons.id, commentsEnabled: lmsLessons.commentsEnabled })
        .from(lmsLessons)
        .where(eq(lmsLessons.id, input.lessonId))
        .limit(1);

      if (!lesson) throw new TRPCError({ code: "NOT_FOUND", message: "Lesson not found" });
      if (!lesson.commentsEnabled) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Comments are not enabled for this lesson" });
      }

      if (input.parentId) {
        const [parent] = await db
          .select({ id: lessonComments.id })
          .from(lessonComments)
          .where(and(
            eq(lessonComments.id, input.parentId),
            eq(lessonComments.lessonId, input.lessonId),
            isNull(lessonComments.parentId),
            isNull(lessonComments.deletedAt),
          ))
          .limit(1);
        if (!parent) throw new TRPCError({ code: "BAD_REQUEST", message: "Parent comment not found" });
      }

      const [result] = await db.insert(lessonComments).values({
        lessonId: input.lessonId,
        userId: ctx.user.id,
        content: input.content,
        parentId: input.parentId ?? null,
      });

      return { id: result.insertId };
    }),
});
