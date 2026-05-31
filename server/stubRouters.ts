import { z } from "zod";
import { router, publicProcedure } from "./_core/trpc";

// Stub routers for features that need to be implemented
// These provide basic structure to resolve TypeScript errors

export const downloadsRouter = router({
  list: publicProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async () => []),
  create: publicProcedure
    .input(z.object({ orgId: z.number(), name: z.string() }))
    .mutation(async () => ({ id: 1 })),
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async () => ({ success: true })),
});

export const pagesRouter = router({
  list: publicProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async () => []),
  create: publicProcedure
    .input(z.object({ orgId: z.number(), name: z.string() }))
    .mutation(async () => ({ id: 1 })),
  update: publicProcedure
    .input(z.object({ id: z.number(), name: z.string() }))
    .mutation(async () => ({ id: 1 })),
  delete: publicProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async () => ({ success: true })),
});

export const themesRouter = router({
  list: publicProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async () => []),
  create: publicProcedure
    .input(z.object({ orgId: z.number(), name: z.string() }))
    .mutation(async () => ({ id: 1 })),
  update: publicProcedure
    .input(z.object({ id: z.number(), name: z.string() }))
    .mutation(async () => ({ id: 1 })),
});

export const emailMarketingRouter = router({
  list: publicProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async () => []),
  create: publicProcedure
    .input(z.object({ orgId: z.number(), name: z.string() }))
    .mutation(async () => ({ id: 1 })),
});

export const curriculumRouter = router({
  list: publicProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async () => []),
  create: publicProcedure
    .input(z.object({ orgId: z.number(), name: z.string() }))
    .mutation(async () => ({ id: 1 })),
});

export const groupsRouter = router({
  list: publicProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async () => []),
  create: publicProcedure
    .input(z.object({ orgId: z.number(), name: z.string() }))
    .mutation(async () => ({ id: 1 })),
});

export const orderBumpsRouter = router({
  list: publicProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async () => []),
  create: publicProcedure
    .input(z.object({ orgId: z.number(), name: z.string() }))
    .mutation(async () => ({ id: 1 })),
});

export const dashboardRouter = router({
  getStats: publicProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async () => ({
      totalCourses: 0,
      totalStudents: 0,
      totalRevenue: 0,
      totalEnrollments: 0,
    })),
  getRecentActivity: publicProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async () => []),
});

export const flashcardsRouter = router({
  list: publicProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async () => []),
  create: publicProcedure
    .input(z.object({ orgId: z.number(), name: z.string() }))
    .mutation(async () => ({ id: 1 })),
});
