import { z } from "zod";
import { protectedProcedure } from "./_core/trpc";
import { getNativeQuizReviewAttempt, listNativeQuizReviewAttempts, mutateNativeQuizReview } from "./lib/course360NativeQuizReviewRuntime";
const scopeInput = z.object({ orgId: z.number().int().positive().optional(), quizId: z.number().int().positive().optional() }).strict();
const attemptInput = scopeInput.extend({ attemptId: z.number().int().positive() }).strict();
const mutationInput = attemptInput.extend({ expectedReviewRevision: z.number().int().nonnegative(), operationId: z.string().min(12).max(128).regex(/^[a-zA-Z0-9_-]+$/) }).strict();
/** Parent spreads into quizRouter. Mutation-only reads ensure the review UI performs no requests on mount. */
export const course360NativeQuizReviewProcedures = {
  listNativeQuizReviewAttempts: protectedProcedure.input(scopeInput.extend({ cursor: z.number().int().nonnegative().optional(), limit: z.number().int().min(1).max(100).default(50) }).strict()).mutation(({ ctx, input }) => listNativeQuizReviewAttempts(ctx, input)),
  getNativeQuizReviewAttempt: protectedProcedure.input(attemptInput).mutation(({ ctx, input }) => getNativeQuizReviewAttempt(ctx, input)),
  gradeNativeQuizReviewQuestion: protectedProcedure.input(mutationInput.extend({ questionId: z.string().min(1).max(255), points: z.number().finite().nonnegative(), feedback: z.string().max(4000).default("") }).strict()).mutation(({ ctx, input }) => mutateNativeQuizReview(ctx, input, "grade")),
  releaseNativeQuizReviewAttempt: protectedProcedure.input(mutationInput).mutation(({ ctx, input }) => mutateNativeQuizReview(ctx, input, "release")),
};
