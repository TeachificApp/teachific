import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import {
  teachGameAnswers,
  teachGameParticipants,
  teachGameQuestions,
  teachGames,
  teachGameSessions,
  organizations,
} from "../../drizzle/schema";
import { getDb, getOrgIdForUserWithFallback, requireOrgAdmin } from "../db";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

const gameStatus = z.enum(["draft", "published", "archived"]);
const sessionStatus = z.enum(["lobby", "active", "paused", "ended"]);
const TEACH_GAME_TIERS = ["pro", "enterprise"] as const;

function calculatePoints(basePoints: number, timeLimitMs: number, responseTimeMs: number): number {
  const speedRatio = Math.max(0, 1 - responseTimeMs / Math.max(timeLimitMs, 1));
  return basePoints + Math.round(basePoints * 0.5 * speedRatio);
}

function createParticipantName(): string {
  return `Player ${Math.floor(Math.random() * 9000 + 1000)}`;
}

async function assertTeachGamesPlan(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  orgId: number,
) {
  const [org] = await db.select({ plan: organizations.plan }).from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
  if (!(TEACH_GAME_TIERS as readonly string[]).includes(org.plan)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Teach Games is available on Pro and Enterprise plans. Upgrade this organization to host or manage games.",
    });
  }
}

async function requireActiveGameOrg(userId: number, role: string): Promise<number> {
  const orgId = await getOrgIdForUserWithFallback(userId, role);
  if (!orgId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Select an active organization before managing Teach games." });
  }
  await requireOrgAdmin(userId, role, orgId);
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  await assertTeachGamesPlan(db, orgId);
  return orgId;
}

async function getActiveGameOrThrow(userId: number, role: string, gameId: number) {
  const orgId = await requireActiveGameOrg(userId, role);
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  const [game] = await db
    .select()
    .from(teachGames)
    .where(and(eq(teachGames.id, gameId), eq(teachGames.orgId, orgId)))
    .limit(1);
  if (!game) throw new TRPCError({ code: "NOT_FOUND", message: "Teach game not found in the active organization." });
  return { db, orgId, game };
}

async function getActiveSessionOrThrow(userId: number, role: string, sessionId: number) {
  const orgId = await requireActiveGameOrg(userId, role);
  const db = await getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
  const [session] = await db
    .select()
    .from(teachGameSessions)
    .where(and(eq(teachGameSessions.id, sessionId), eq(teachGameSessions.orgId, orgId)))
    .limit(1);
  if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Teach game session not found in the active organization." });
  return { db, orgId, session };
}

const gameInput = z.object({
  title: z.string().trim().min(1).max(300),
  description: z.string().max(20_000).optional(),
  timeLimitSeconds: z.number().int().min(5).max(600).default(20),
  musicTrack: z.string().max(100).nullable().optional(),
  theme: z.string().max(50).default("org"),
  coverImageUrl: z.string().url().nullable().optional(),
  category: z.string().trim().min(1).max(120).default("General"),
});

export const teachGamesRouter = router({
  listGames: protectedProcedure
    .input(z.object({ status: z.union([gameStatus, z.literal("all")]).default("all") }).optional())
    .query(async ({ ctx, input }) => {
      const orgId = await requireActiveGameOrg(ctx.user.id, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const conditions = [eq(teachGames.orgId, orgId)];
      if (input?.status && input.status !== "all") conditions.push(eq(teachGames.status, input.status));
      return db.select().from(teachGames).where(and(...conditions)).orderBy(desc(teachGames.updatedAt));
    }),

  getGame: protectedProcedure
    .input(z.object({ gameId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const { db, game } = await getActiveGameOrThrow(ctx.user.id, ctx.user.role, input.gameId);
      const questions = await db
        .select()
        .from(teachGameQuestions)
        .where(eq(teachGameQuestions.gameId, game.id))
        .orderBy(asc(teachGameQuestions.sortOrder), asc(teachGameQuestions.id));
      return { game, questions };
    }),

  createGame: protectedProcedure
    .input(gameInput)
    .mutation(async ({ ctx, input }) => {
      const orgId = await requireActiveGameOrg(ctx.user.id, ctx.user.role);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const result = await db.insert(teachGames).values({
        orgId,
        createdByUserId: ctx.user.id,
        title: input.title,
        description: input.description,
        timeLimitSeconds: input.timeLimitSeconds,
        musicTrack: input.musicTrack ?? null,
        theme: input.theme,
        coverImageUrl: input.coverImageUrl ?? null,
        category: input.category,
        questionCount: 0,
        status: "draft",
      });
      return { gameId: Number((result as any).insertId), orgId };
    }),

  updateGame: protectedProcedure
    .input(gameInput.partial().extend({ gameId: z.number().int().positive(), status: gameStatus.optional() }))
    .mutation(async ({ ctx, input }) => {
      const { db, game } = await getActiveGameOrThrow(ctx.user.id, ctx.user.role, input.gameId);
      const { gameId: _gameId, ...updates } = input;
      await db.update(teachGames).set(updates).where(eq(teachGames.id, game.id));
      return { ok: true };
    }),

  deleteGame: protectedProcedure
    .input(z.object({ gameId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { db, game } = await getActiveGameOrThrow(ctx.user.id, ctx.user.role, input.gameId);
      const sessions = await db.select({ id: teachGameSessions.id }).from(teachGameSessions).where(eq(teachGameSessions.gameId, game.id));
      const sessionIds = sessions.map((session) => session.id);
      for (const sessionId of sessionIds) {
        const participants = await db.select({ id: teachGameParticipants.id }).from(teachGameParticipants).where(eq(teachGameParticipants.sessionId, sessionId));
        const participantIds = participants.map((participant) => participant.id);
        if (participantIds.length) {
          for (const participantId of participantIds) {
            await db.delete(teachGameAnswers).where(eq(teachGameAnswers.participantId, participantId));
          }
        }
        await db.delete(teachGameParticipants).where(eq(teachGameParticipants.sessionId, sessionId));
        await db.delete(teachGameSessions).where(eq(teachGameSessions.id, sessionId));
      }
      await db.delete(teachGameQuestions).where(eq(teachGameQuestions.gameId, game.id));
      await db.delete(teachGames).where(eq(teachGames.id, game.id));
      return { ok: true };
    }),

  upsertQuestion: protectedProcedure
    .input(z.object({
      questionId: z.number().int().positive().optional(),
      gameId: z.number().int().positive(),
      question: z.string().trim().min(1).max(30_000),
      options: z.array(z.string().trim().min(1).max(2_000)).min(2).max(6),
      correctAnswer: z.number().int().min(0).max(5),
      explanation: z.string().max(30_000).nullable().optional(),
      mediaUrl: z.string().url().nullable().optional(),
      mediaType: z.enum(["image", "video", "gif"]).nullable().optional(),
      timeLimitSeconds: z.number().int().min(5).max(600).nullable().optional(),
      points: z.number().int().min(10).max(10_000).default(100),
      sortOrder: z.number().int().min(0).default(0),
    }))
    .mutation(async ({ ctx, input }) => {
      if (input.correctAnswer >= input.options.length) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Correct answer must reference an available option." });
      }
      const { db, game } = await getActiveGameOrThrow(ctx.user.id, ctx.user.role, input.gameId);
      const values = {
        question: input.question,
        options: JSON.stringify(input.options),
        correctAnswer: input.correctAnswer,
        explanation: input.explanation ?? null,
        mediaUrl: input.mediaUrl ?? null,
        mediaType: input.mediaType ?? null,
        timeLimitSeconds: input.timeLimitSeconds ?? null,
        points: input.points,
        sortOrder: input.sortOrder,
      };
      if (input.questionId) {
        const [question] = await db.select().from(teachGameQuestions).where(and(eq(teachGameQuestions.id, input.questionId), eq(teachGameQuestions.gameId, game.id))).limit(1);
        if (!question) throw new TRPCError({ code: "NOT_FOUND", message: "Teach game question not found in the active organization." });
        await db.update(teachGameQuestions).set(values).where(eq(teachGameQuestions.id, question.id));
        return { questionId: question.id };
      }
      const result = await db.insert(teachGameQuestions).values({ gameId: game.id, ...values });
      await db.update(teachGames).set({ questionCount: sql`${teachGames.questionCount} + 1` }).where(eq(teachGames.id, game.id));
      return { questionId: Number((result as any).insertId) };
    }),

  deleteQuestion: protectedProcedure
    .input(z.object({ gameId: z.number().int().positive(), questionId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { db, game } = await getActiveGameOrThrow(ctx.user.id, ctx.user.role, input.gameId);
      const [question] = await db.select().from(teachGameQuestions).where(and(eq(teachGameQuestions.id, input.questionId), eq(teachGameQuestions.gameId, game.id))).limit(1);
      if (!question) throw new TRPCError({ code: "NOT_FOUND", message: "Teach game question not found in the active organization." });
      await db.delete(teachGameQuestions).where(eq(teachGameQuestions.id, question.id));
      await db.update(teachGames).set({ questionCount: sql`GREATEST(0, ${teachGames.questionCount} - 1)` }).where(eq(teachGames.id, game.id));
      return { ok: true };
    }),

  reorderQuestions: protectedProcedure
    .input(z.object({ gameId: z.number().int().positive(), order: z.array(z.object({ questionId: z.number().int().positive(), sortOrder: z.number().int().min(0) })).min(1) }))
    .mutation(async ({ ctx, input }) => {
      const { db, game } = await getActiveGameOrThrow(ctx.user.id, ctx.user.role, input.gameId);
      const questionRows = await db.select({ id: teachGameQuestions.id }).from(teachGameQuestions).where(eq(teachGameQuestions.gameId, game.id));
      const allowedIds = new Set(questionRows.map((question) => question.id));
      if (input.order.some((entry) => !allowedIds.has(entry.questionId))) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Questions must belong to the active organization game." });
      }
      for (const entry of input.order) {
        await db.update(teachGameQuestions).set({ sortOrder: entry.sortOrder }).where(eq(teachGameQuestions.id, entry.questionId));
      }
      return { ok: true };
    }),

  createSession: protectedProcedure
    .input(z.object({ gameId: z.number().int().positive(), allowAnonymous: z.boolean().default(true), showLeaderboard: z.boolean().default(true) }))
    .mutation(async ({ ctx, input }) => {
      const { db, orgId, game } = await getActiveGameOrThrow(ctx.user.id, ctx.user.role, input.gameId);
      const questions = await db.select().from(teachGameQuestions).where(eq(teachGameQuestions.gameId, game.id)).orderBy(asc(teachGameQuestions.sortOrder), asc(teachGameQuestions.id));
      if (!questions.length) throw new TRPCError({ code: "BAD_REQUEST", message: "Add at least one question before starting a Teach game." });
      let joinCode = "";
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const candidate = Math.random().toString(36).slice(2, 8).toUpperCase();
        const [existing] = await db.select({ id: teachGameSessions.id }).from(teachGameSessions).where(eq(teachGameSessions.joinCode, candidate)).limit(1);
        if (!existing) { joinCode = candidate; break; }
      }
      if (!joinCode) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Unable to create a unique join code." });
      const result = await db.insert(teachGameSessions).values({
        orgId,
        gameId: game.id,
        hostUserId: ctx.user.id,
        joinCode,
        allowAnonymous: input.allowAnonymous,
        showLeaderboard: input.showLeaderboard,
        gameSnapshot: JSON.stringify({ game, questions }),
      });
      return { sessionId: Number((result as any).insertId), joinCode };
    }),

  getSession: protectedProcedure
    .input(z.object({ sessionId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const { db, session } = await getActiveSessionOrThrow(ctx.user.id, ctx.user.role, input.sessionId);
      const participants = await db.select().from(teachGameParticipants).where(eq(teachGameParticipants.sessionId, session.id)).orderBy(desc(teachGameParticipants.totalScore));
      return { session, participants };
    }),

  startSession: protectedProcedure
    .input(z.object({ sessionId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { db, session } = await getActiveSessionOrThrow(ctx.user.id, ctx.user.role, input.sessionId);
      if (session.hostUserId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only the session host can start this Teach game." });
      if (session.status !== "lobby") throw new TRPCError({ code: "BAD_REQUEST", message: "This Teach game session has already started." });
      const snapshot = JSON.parse(session.gameSnapshot) as { questions?: unknown[] };
      if (!snapshot.questions?.length) throw new TRPCError({ code: "BAD_REQUEST", message: "This Teach game has no playable questions." });
      const now = new Date();
      await db.update(teachGameSessions).set({ status: "active", currentQuestionIndex: 0, questionStartedAt: now, startedAt: now }).where(eq(teachGameSessions.id, session.id));
      return { ok: true, currentQuestionIndex: 0, totalQuestions: snapshot.questions.length };
    }),

  advanceSession: protectedProcedure
    .input(z.object({ sessionId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { db, session } = await getActiveSessionOrThrow(ctx.user.id, ctx.user.role, input.sessionId);
      if (session.hostUserId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only the session host can advance this Teach game." });
      if (session.status !== "active") throw new TRPCError({ code: "BAD_REQUEST", message: "This Teach game session is not active." });
      const snapshot = JSON.parse(session.gameSnapshot) as { questions?: unknown[] };
      const nextQuestionIndex = (session.currentQuestionIndex ?? 0) + 1;
      if (nextQuestionIndex >= (snapshot.questions?.length ?? 0)) {
        await db.update(teachGameSessions).set({ status: "ended", endedAt: new Date() }).where(eq(teachGameSessions.id, session.id));
        const participants = await db.select().from(teachGameParticipants).where(eq(teachGameParticipants.sessionId, session.id)).orderBy(desc(teachGameParticipants.totalScore));
        for (const [index, participant] of participants.entries()) {
          await db.update(teachGameParticipants).set({ finalRank: index + 1 }).where(eq(teachGameParticipants.id, participant.id));
        }
        return { ended: true, currentQuestionIndex: null };
      }
      await db.update(teachGameSessions).set({ currentQuestionIndex: nextQuestionIndex, questionStartedAt: new Date() }).where(eq(teachGameSessions.id, session.id));
      return { ended: false, currentQuestionIndex: nextQuestionIndex };
    }),

  endSession: protectedProcedure
    .input(z.object({ sessionId: z.number().int().positive() }))
    .mutation(async ({ ctx, input }) => {
      const { db, session } = await getActiveSessionOrThrow(ctx.user.id, ctx.user.role, input.sessionId);
      if (session.hostUserId !== ctx.user.id) throw new TRPCError({ code: "FORBIDDEN", message: "Only the session host can end this Teach game." });
      await db.update(teachGameSessions).set({ status: "ended", endedAt: new Date() }).where(eq(teachGameSessions.id, session.id));
      return { ok: true };
    }),

  getPublicSession: publicProcedure
    .input(z.object({ joinCode: z.string().trim().min(4).max(10) }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [session] = await db.select().from(teachGameSessions).where(eq(teachGameSessions.joinCode, input.joinCode.toUpperCase())).limit(1);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Teach game session not found." });
      await assertTeachGamesPlan(db, session.orgId);
      const snapshot = JSON.parse(session.gameSnapshot) as { game?: any; questions?: any[] };
      const question = session.status === "active" ? snapshot.questions?.[session.currentQuestionIndex ?? 0] : null;
      return {
        session: { id: session.id, status: session.status, participantCount: session.participantCount, allowAnonymous: session.allowAnonymous, showLeaderboard: session.showLeaderboard },
        game: snapshot.game ? { title: snapshot.game.title, theme: snapshot.game.theme, coverImageUrl: snapshot.game.coverImageUrl } : null,
        question: question ? { id: question.id, question: question.question, options: JSON.parse(question.options), mediaUrl: question.mediaUrl, mediaType: question.mediaType, points: question.points, timeLimitSeconds: question.timeLimitSeconds ?? snapshot.game?.timeLimitSeconds ?? 20 } : null,
      };
    }),

  joinSession: publicProcedure
    .input(z.object({ joinCode: z.string().trim().min(4).max(10), displayName: z.string().trim().min(1).max(100).optional() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [session] = await db.select().from(teachGameSessions).where(and(eq(teachGameSessions.joinCode, input.joinCode.toUpperCase()), eq(teachGameSessions.status, "lobby"))).limit(1);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "This Teach game is not accepting participants." });
      await assertTeachGamesPlan(db, session.orgId);
      if (!session.allowAnonymous && !input.displayName) throw new TRPCError({ code: "BAD_REQUEST", message: "A display name is required for this Teach game." });
      const displayName = input.displayName || createParticipantName();
      const result = await db.insert(teachGameParticipants).values({ sessionId: session.id, displayName, avatarSeed: Math.random().toString(36).slice(2, 8) });
      await db.update(teachGameSessions).set({ participantCount: sql`${teachGameSessions.participantCount} + 1` }).where(eq(teachGameSessions.id, session.id));
      return { sessionId: session.id, participantId: Number((result as any).insertId), displayName };
    }),

  submitAnswer: publicProcedure
    .input(z.object({ sessionId: z.number().int().positive(), participantId: z.number().int().positive(), questionId: z.number().int().positive(), selectedAnswer: z.number().int().min(-1).max(5), responseTimeMs: z.number().int().min(0) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable" });
      const [session] = await db.select().from(teachGameSessions).where(and(eq(teachGameSessions.id, input.sessionId), eq(teachGameSessions.status, "active"))).limit(1);
      if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "Teach game session is not active." });
      await assertTeachGamesPlan(db, session.orgId);
      const [participant] = await db.select().from(teachGameParticipants).where(and(eq(teachGameParticipants.id, input.participantId), eq(teachGameParticipants.sessionId, session.id), eq(teachGameParticipants.isActive, true))).limit(1);
      if (!participant) throw new TRPCError({ code: "FORBIDDEN", message: "Participant is not active in this Teach game session." });
      const snapshot = JSON.parse(session.gameSnapshot) as { game?: any; questions?: any[] };
      const question = snapshot.questions?.[session.currentQuestionIndex ?? 0];
      if (!question || question.id !== input.questionId) throw new TRPCError({ code: "BAD_REQUEST", message: "This is not the active Teach game question." });
      const [existing] = await db.select({ id: teachGameAnswers.id }).from(teachGameAnswers).where(and(eq(teachGameAnswers.sessionId, session.id), eq(teachGameAnswers.participantId, participant.id), eq(teachGameAnswers.questionId, question.id))).limit(1);
      if (existing) return { accepted: false, pointsEarned: 0 };
      const isCorrect = input.selectedAnswer === question.correctAnswer;
      const pointsEarned = isCorrect ? calculatePoints(question.points, (question.timeLimitSeconds ?? snapshot.game?.timeLimitSeconds ?? 20) * 1000, input.responseTimeMs) : 0;
      await db.insert(teachGameAnswers).values({ sessionId: session.id, participantId: participant.id, questionId: question.id, selectedAnswer: input.selectedAnswer, isCorrect, pointsEarned, responseTimeMs: input.responseTimeMs });
      if (pointsEarned) await db.update(teachGameParticipants).set({ totalScore: sql`${teachGameParticipants.totalScore} + ${pointsEarned}` }).where(eq(teachGameParticipants.id, participant.id));
      return { accepted: true, isCorrect, pointsEarned };
    }),
});
