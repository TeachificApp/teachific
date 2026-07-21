/**
 * blueprintRouter.ts
 * Teachific™ Blueprint System — tRPC Router
 *
 * Procedures:
 *   Platform Admin: create, update, addResource, removeResource, addVariable, removeVariable,
 *                   publish, unpublish, list (all), getById, delete, setFeatured
 *   Org Admin:      install, listInstalled, getInstallation, listAvailable, getBySlug
 *   Public:         listPublished, getPublicBySlug
 */

import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, asc, desc, eq, inArray, like, or, sql } from "drizzle-orm";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { getDb, isPlatformAdmin, getOrgIdForUser } from "../db";
import {
  blueprints,
  blueprintVersions,
  blueprintResources,
  blueprintVariables,
  blueprintInstallations,
  blueprintInstalledResources,
  blueprintLicenses,
  blueprintReviews,
  lmsCourses,
  organizations,
} from "../../drizzle/schema";
import { installBlueprint, snapshotCourse } from "../lib/blueprintInstallationService";

// ─── Access helpers ───────────────────────────────────────────────────────────

const BLUEPRINT_TIERS = ["builder", "pro", "enterprise"] as const;

async function assertPlatformAdmin(ctx: { user: { role: string } }) {
  if (!isPlatformAdmin(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Platform admin access required" });
  }
}

async function assertBlueprintAccess(orgId: number, db: NonNullable<Awaited<ReturnType<typeof getDb>>>) {
  const [org] = await db.select({ plan: organizations.plan }).from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org) throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
  if (!(BLUEPRINT_TIERS as readonly string[]).includes(org.plan)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: `Blueprint access requires Builder, Pro, or Enterprise plan. Your current plan is ${org.plan}.`,
    });
  }
}

async function assertOrgAdmin(ctx: { user: { role: string } }) {
  const allowed = ["site_owner", "site_admin", "org_super_admin", "org_admin"];
  if (!allowed.includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Organization admin access required" });
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export const blueprintRouter = router({
  // ── Platform Admin: List all blueprints ──────────────────────────────────
  adminList: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      status: z.enum(["draft", "pending_review", "approved", "published", "suspended", "archived"]).optional(),
      category: z.string().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(20),
    }))
    .query(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = [];
      if (input.search) conditions.push(like(blueprints.title, `%${input.search}%`));
      if (input.status) conditions.push(eq(blueprints.status, input.status));
      if (input.category) conditions.push(eq(blueprints.category, input.category));

      const offset = (input.page - 1) * input.pageSize;
      const rows = await db
        .select()
        .from(blueprints)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(blueprints.createdAt))
        .limit(input.pageSize)
        .offset(offset);

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(blueprints)
        .where(conditions.length > 0 ? and(...conditions) : undefined);

      return { blueprints: rows, total: Number(count), page: input.page, pageSize: input.pageSize };
    }),

  // ── Platform Admin: Get single blueprint with all details ────────────────
  adminGetById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [bp] = await db.select().from(blueprints).where(eq(blueprints.id, input.id)).limit(1);
      if (!bp) throw new TRPCError({ code: "NOT_FOUND" });

      const resources = await db.select().from(blueprintResources).where(eq(blueprintResources.blueprintId, input.id)).orderBy(asc(blueprintResources.resourceOrder));
      const variables = await db.select().from(blueprintVariables).where(eq(blueprintVariables.blueprintId, input.id)).orderBy(asc(blueprintVariables.displayOrder));
      const versions = await db.select().from(blueprintVersions).where(eq(blueprintVersions.blueprintId, input.id)).orderBy(desc(blueprintVersions.createdAt));
      const [{ installCount }] = await db.select({ installCount: sql<number>`count(*)` }).from(blueprintInstallations).where(eq(blueprintInstallations.blueprintId, input.id));

      return { ...bp, resources, variables, versions, installCount: Number(installCount) };
    }),

  // ── Platform Admin: Create blueprint ─────────────────────────────────────
  create: protectedProcedure
    .input(z.object({
      title: z.string().min(3).max(255),
      slug: z.string().min(3).max(255).regex(/^[a-z0-9-]+$/),
      shortDescription: z.string().max(500).optional(),
      fullDescription: z.string().optional(),
      category: z.string().optional(),
      subcategory: z.string().optional(),
      thumbnailUrl: z.string().url().optional(),
      pricingType: z.enum(["free", "one_time", "subscription_included", "private_access"]).default("free"),
      price: z.number().min(0).optional(),
      setupTimeEstimate: z.string().optional(),
      difficultyLevel: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"),
      visibility: z.enum(["private", "organization_only", "marketplace", "direct_link", "platform_only"]).default("private"),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Check slug uniqueness
      const [existing] = await db.select({ id: blueprints.id }).from(blueprints).where(eq(blueprints.slug, input.slug)).limit(1);
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "A blueprint with this slug already exists" });

      const [row] = await db.insert(blueprints).values({
        creatorUserId: ctx.user.id,
        title: input.title,
        slug: input.slug,
        shortDescription: input.shortDescription ?? null,
        fullDescription: input.fullDescription ?? null,
        category: input.category ?? null,
        subcategory: input.subcategory ?? null,
        thumbnailUrl: input.thumbnailUrl ?? null,
        pricingType: input.pricingType,
        price: input.price ? String(input.price) : null,
        setupTimeEstimate: input.setupTimeEstimate ?? null,
        difficultyLevel: input.difficultyLevel,
        visibility: input.visibility,
        status: "draft",
      }).$returningId();

      return { id: row.id };
    }),

  // ── Platform Admin: Update blueprint metadata ─────────────────────────────
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      title: z.string().min(3).max(255).optional(),
      shortDescription: z.string().max(500).optional(),
      fullDescription: z.string().optional(),
      category: z.string().optional(),
      subcategory: z.string().optional(),
      thumbnailUrl: z.string().url().optional().nullable(),
      previewUrl: z.string().url().optional().nullable(),
      pricingType: z.enum(["free", "one_time", "subscription_included", "private_access"]).optional(),
      price: z.number().min(0).optional().nullable(),
      setupTimeEstimate: z.string().optional(),
      difficultyLevel: z.enum(["beginner", "intermediate", "advanced"]).optional(),
      visibility: z.enum(["private", "organization_only", "marketplace", "direct_link", "platform_only"]).optional(),
      featured: z.boolean().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const { id, ...rest } = input;
      const updates: Record<string, unknown> = {};
      if (rest.title !== undefined) updates.title = rest.title;
      if (rest.shortDescription !== undefined) updates.shortDescription = rest.shortDescription;
      if (rest.fullDescription !== undefined) updates.fullDescription = rest.fullDescription;
      if (rest.category !== undefined) updates.category = rest.category;
      if (rest.subcategory !== undefined) updates.subcategory = rest.subcategory;
      if (rest.thumbnailUrl !== undefined) updates.thumbnailUrl = rest.thumbnailUrl;
      if (rest.previewUrl !== undefined) updates.previewUrl = rest.previewUrl;
      if (rest.pricingType !== undefined) updates.pricingType = rest.pricingType;
      if (rest.price !== undefined) updates.price = rest.price !== null ? String(rest.price) : null;
      if (rest.setupTimeEstimate !== undefined) updates.setupTimeEstimate = rest.setupTimeEstimate;
      if (rest.difficultyLevel !== undefined) updates.difficultyLevel = rest.difficultyLevel;
      if (rest.visibility !== undefined) updates.visibility = rest.visibility;
      if (rest.featured !== undefined) updates.featured = rest.featured;

      await db.update(blueprints).set(updates).where(eq(blueprints.id, id));
      return { success: true };
    }),

  // ── Platform Admin: Add resource to blueprint ─────────────────────────────
  addResource: protectedProcedure
    .input(z.object({
      blueprintId: z.number(),
      resourceType: z.enum(["course", "product", "download", "page", "funnel", "webinar", "form", "email", "email_sequence", "automation", "coupon", "tag"]),
      sourceResourceId: z.number(),
      resourceName: z.string(),
      required: z.boolean().default(true),
      configurationData: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      // Verify the source resource exists
      if (input.resourceType === "course") {
        const [course] = await db.select({ id: lmsCourses.id }).from(lmsCourses).where(eq(lmsCourses.id, input.sourceResourceId)).limit(1);
        if (!course) throw new TRPCError({ code: "NOT_FOUND", message: "Source course not found" });
      }

      // Get current max order
      const resources = await db.select({ order: blueprintResources.resourceOrder }).from(blueprintResources).where(eq(blueprintResources.blueprintId, input.blueprintId)).orderBy(desc(blueprintResources.resourceOrder)).limit(1);
      const nextOrder = resources.length > 0 ? resources[0].order + 1 : 0;

      const [row] = await db.insert(blueprintResources).values({
        blueprintId: input.blueprintId,
        resourceType: input.resourceType,
        sourceResourceId: input.sourceResourceId,
        resourceName: input.resourceName,
        resourceOrder: nextOrder,
        required: input.required,
        configurationData: input.configurationData ?? null,
      }).$returningId();

      return { id: row.id };
    }),

  // ── Platform Admin: Remove resource from blueprint ────────────────────────
  removeResource: protectedProcedure
    .input(z.object({ resourceId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(blueprintResources).where(eq(blueprintResources.id, input.resourceId));
      return { success: true };
    }),

  // ── Platform Admin: Add variable ──────────────────────────────────────────
  addVariable: protectedProcedure
    .input(z.object({
      blueprintId: z.number(),
      variableKey: z.string().regex(/^[a-z_][a-z0-9_]*$/),
      label: z.string(),
      description: z.string().optional(),
      variableType: z.enum(["text", "textarea", "url", "email", "phone", "image", "logo", "color", "number", "currency", "date", "select", "boolean"]).default("text"),
      defaultValue: z.string().optional(),
      required: z.boolean().default(false),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const existing = await db.select({ id: blueprintVariables.id }).from(blueprintVariables).where(and(eq(blueprintVariables.blueprintId, input.blueprintId), eq(blueprintVariables.variableKey, input.variableKey))).limit(1);
      if (existing.length > 0) throw new TRPCError({ code: "CONFLICT", message: "Variable key already exists" });

      const vars = await db.select({ order: blueprintVariables.displayOrder }).from(blueprintVariables).where(eq(blueprintVariables.blueprintId, input.blueprintId)).orderBy(desc(blueprintVariables.displayOrder)).limit(1);
      const nextOrder = vars.length > 0 ? vars[0].order + 1 : 0;

      const [row] = await db.insert(blueprintVariables).values({
        blueprintId: input.blueprintId,
        variableKey: input.variableKey,
        label: input.label,
        description: input.description ?? null,
        variableType: input.variableType,
        defaultValue: input.defaultValue ?? null,
        required: input.required,
        displayOrder: nextOrder,
      }).$returningId();

      return { id: row.id };
    }),

  // ── Platform Admin: Remove variable ──────────────────────────────────────
  removeVariable: protectedProcedure
    .input(z.object({ variableId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.delete(blueprintVariables).where(eq(blueprintVariables.id, input.variableId));
      return { success: true };
    }),

  // ── Platform Admin: Publish blueprint (create version snapshot) ───────────
  publish: protectedProcedure
    .input(z.object({
      blueprintId: z.number(),
      versionNumber: z.string().default("1.0.0"),
      releaseNotes: z.string().optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [bp] = await db.select().from(blueprints).where(eq(blueprints.id, input.blueprintId)).limit(1);
      if (!bp) throw new TRPCError({ code: "NOT_FOUND" });

      const resources = await db.select().from(blueprintResources).where(eq(blueprintResources.blueprintId, input.blueprintId));
      if (resources.length === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "Blueprint must have at least one resource before publishing" });

      // Build snapshot for each resource
      const snapshots: Record<string, unknown> = {};
      for (const resource of resources) {
        if (resource.resourceType === "course") {
          snapshots[`course:${resource.sourceResourceId}`] = await snapshotCourse(resource.sourceResourceId);
        }
      }

      const [versionRow] = await db.insert(blueprintVersions).values({
        blueprintId: input.blueprintId,
        versionNumber: input.versionNumber,
        releaseNotes: input.releaseNotes ?? null,
        snapshotData: JSON.stringify(snapshots),
        publishedAt: new Date(),
      }).$returningId();

      await db.update(blueprints).set({
        status: "published",
        currentVersion: input.versionNumber,
        publishedAt: new Date(),
      }).where(eq(blueprints.id, input.blueprintId));

      return { versionId: versionRow.id, versionNumber: input.versionNumber };
    }),

  // ── Platform Admin: Unpublish / archive blueprint ─────────────────────────
  setStatus: protectedProcedure
    .input(z.object({
      blueprintId: z.number(),
      status: z.enum(["draft", "pending_review", "approved", "published", "suspended", "archived"]),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      await db.update(blueprints).set({ status: input.status }).where(eq(blueprints.id, input.blueprintId));
      return { success: true };
    }),

  // ── Platform Admin: Delete blueprint ─────────────────────────────────────
  delete: protectedProcedure
    .input(z.object({ blueprintId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [{ installCount }] = await db.select({ installCount: sql<number>`count(*)` }).from(blueprintInstallations).where(eq(blueprintInstallations.blueprintId, input.blueprintId));
      if (Number(installCount) > 0) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot delete a blueprint that has been installed. Archive it instead." });
      }

      await db.delete(blueprintVariables).where(eq(blueprintVariables.blueprintId, input.blueprintId));
      await db.delete(blueprintResources).where(eq(blueprintResources.blueprintId, input.blueprintId));
      await db.delete(blueprintVersions).where(eq(blueprintVersions.blueprintId, input.blueprintId));
      await db.delete(blueprints).where(eq(blueprints.id, input.blueprintId));
      return { success: true };
    }),

  // ── Org Admin: List available blueprints for this org's tier ─────────────
  listAvailable: protectedProcedure
    .input(z.object({
      search: z.string().optional(),
      category: z.string().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(20),
    }))
    .query(async ({ ctx, input }) => {
      await assertOrgAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const orgId = await getOrgIdForUser(ctx.user.id);
      if (!orgId) throw new TRPCError({ code: "BAD_REQUEST", message: "No organization found" });

      await assertBlueprintAccess(orgId, db);

      const conditions = [eq(blueprints.status, "published")];
      if (input.search) conditions.push(like(blueprints.title, `%${input.search}%`));
      if (input.category) conditions.push(eq(blueprints.category, input.category));

      const offset = (input.page - 1) * input.pageSize;
      const rows = await db
        .select()
        .from(blueprints)
        .where(and(...conditions))
        .orderBy(desc(blueprints.featured), desc(blueprints.publishedAt))
        .limit(input.pageSize)
        .offset(offset);

      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(blueprints).where(and(...conditions));

      // Check which blueprints this org has already installed
      const installedBlueprintIds = rows.length > 0
        ? (await db.select({ blueprintId: blueprintInstallations.blueprintId }).from(blueprintInstallations).where(and(eq(blueprintInstallations.organizationId, orgId), inArray(blueprintInstallations.blueprintId, rows.map((r) => r.id))))).map((r) => r.blueprintId)
        : [];

      return {
        blueprints: rows.map((bp) => ({ ...bp, installed: installedBlueprintIds.includes(bp.id) })),
        total: Number(count),
        page: input.page,
        pageSize: input.pageSize,
      };
    }),

  // ── Org Admin: Get blueprint detail by slug ───────────────────────────────
  getBySlug: protectedProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertOrgAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const orgId = await getOrgIdForUser(ctx.user.id);
      if (!orgId) throw new TRPCError({ code: "BAD_REQUEST" });
      await assertBlueprintAccess(orgId, db);

      const [bp] = await db.select().from(blueprints).where(and(eq(blueprints.slug, input.slug), eq(blueprints.status, "published"))).limit(1);
      if (!bp) throw new TRPCError({ code: "NOT_FOUND" });

      const resources = await db.select().from(blueprintResources).where(eq(blueprintResources.blueprintId, bp.id)).orderBy(asc(blueprintResources.resourceOrder));
      const variables = await db.select().from(blueprintVariables).where(eq(blueprintVariables.blueprintId, bp.id)).orderBy(asc(blueprintVariables.displayOrder));
      const [latestVersion] = await db.select().from(blueprintVersions).where(eq(blueprintVersions.blueprintId, bp.id)).orderBy(desc(blueprintVersions.createdAt)).limit(1);
      const [{ installCount }] = await db.select({ installCount: sql<number>`count(*)` }).from(blueprintInstallations).where(eq(blueprintInstallations.blueprintId, bp.id));
      const reviews = await db.select().from(blueprintReviews).where(and(eq(blueprintReviews.blueprintId, bp.id), eq(blueprintReviews.moderationStatus, "approved"))).orderBy(desc(blueprintReviews.createdAt)).limit(10);

      const [existingInstall] = await db.select().from(blueprintInstallations).where(and(eq(blueprintInstallations.blueprintId, bp.id), eq(blueprintInstallations.organizationId, orgId))).limit(1);

      return {
        ...bp,
        resources,
        variables,
        latestVersion: latestVersion ?? null,
        installCount: Number(installCount),
        reviews,
        alreadyInstalled: !!existingInstall,
        installationId: existingInstall?.id ?? null,
      };
    }),

  // ── Org Admin: Install a blueprint ───────────────────────────────────────
  install: protectedProcedure
    .input(z.object({
      blueprintId: z.number(),
      blueprintVersionId: z.number(),
      customizationValues: z.record(z.string()).default({}),
    }))
    .mutation(async ({ ctx, input }) => {
      await assertOrgAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const orgId = await getOrgIdForUser(ctx.user.id);
      if (!orgId) throw new TRPCError({ code: "BAD_REQUEST", message: "No organization found" });

      await assertBlueprintAccess(orgId, db);

      const result = await installBlueprint({
        blueprintId: input.blueprintId,
        blueprintVersionId: input.blueprintVersionId,
        organizationId: orgId,
        installedByUserId: ctx.user.id,
        customizationValues: input.customizationValues,
      });

      if (result.status === "rolled_back") {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Installation failed and was rolled back: ${result.errors.join("; ")}`,
        });
      }

      return result;
    }),

  // ── Org Admin: List installed blueprints ─────────────────────────────────
  listInstalled: protectedProcedure
    .query(async ({ ctx }) => {
      await assertOrgAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const orgId = await getOrgIdForUser(ctx.user.id);
      if (!orgId) throw new TRPCError({ code: "BAD_REQUEST" });

      const installations = await db
        .select({
          installation: blueprintInstallations,
          blueprint: blueprints,
        })
        .from(blueprintInstallations)
        .innerJoin(blueprints, eq(blueprints.id, blueprintInstallations.blueprintId))
        .where(eq(blueprintInstallations.organizationId, orgId))
        .orderBy(desc(blueprintInstallations.installedAt));

      return installations;
    }),

  // ── Org Admin: Get installation detail ───────────────────────────────────
  getInstallation: protectedProcedure
    .input(z.object({ installationId: z.number() }))
    .query(async ({ ctx, input }) => {
      await assertOrgAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const orgId = await getOrgIdForUser(ctx.user.id);
      if (!orgId) throw new TRPCError({ code: "BAD_REQUEST" });

      const [installation] = await db
        .select()
        .from(blueprintInstallations)
        .where(and(eq(blueprintInstallations.id, input.installationId), eq(blueprintInstallations.organizationId, orgId)))
        .limit(1);
      if (!installation) throw new TRPCError({ code: "NOT_FOUND" });

      const installedResources = await db
        .select()
        .from(blueprintInstalledResources)
        .where(eq(blueprintInstalledResources.installationId, input.installationId));

      const [bp] = await db.select().from(blueprints).where(eq(blueprints.id, installation.blueprintId)).limit(1);

      return { installation, installedResources, blueprint: bp ?? null };
    }),

  // ── Org Admin: Mark installation setup as complete ────────────────────────
  markSetupComplete: protectedProcedure
    .input(z.object({ installationId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      await assertOrgAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const orgId = await getOrgIdForUser(ctx.user.id);
      if (!orgId) throw new TRPCError({ code: "BAD_REQUEST" });

      await db
        .update(blueprintInstallations)
        .set({ installationStatus: "completed", completedAt: new Date() })
        .where(and(eq(blueprintInstallations.id, input.installationId), eq(blueprintInstallations.organizationId, orgId)));

      return { success: true };
    }),

  // ── Public: List published blueprints ─────────────────────────────────────
  listPublished: publicProcedure
    .input(z.object({
      search: z.string().optional(),
      category: z.string().optional(),
      featured: z.boolean().optional(),
      page: z.number().default(1),
      pageSize: z.number().default(20),
    }))
    .query(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = [eq(blueprints.status, "published"), eq(blueprints.visibility, "marketplace")];
      if (input.search) conditions.push(like(blueprints.title, `%${input.search}%`));
      if (input.category) conditions.push(eq(blueprints.category, input.category));
      if (input.featured !== undefined) conditions.push(eq(blueprints.featured, input.featured));

      const offset = (input.page - 1) * input.pageSize;
      const rows = await db
        .select()
        .from(blueprints)
        .where(and(...conditions))
        .orderBy(desc(blueprints.featured), desc(blueprints.publishedAt))
        .limit(input.pageSize)
        .offset(offset);

      const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(blueprints).where(and(...conditions));

      return { blueprints: rows, total: Number(count), page: input.page, pageSize: input.pageSize };
    }),

  // ── Platform Admin: Get available source courses for blueprint building ───
  getSourceCourses: protectedProcedure
    .input(z.object({ search: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      await assertPlatformAdmin(ctx);
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const conditions = [];
      if (input.search) conditions.push(like(lmsCourses.title, `%${input.search}%`));

      const rows = await db
        .select({ id: lmsCourses.id, title: lmsCourses.title, slug: lmsCourses.slug, status: lmsCourses.status, coverImageUrl: lmsCourses.coverImageUrl })
        .from(lmsCourses)
        .where(conditions.length > 0 ? and(...conditions) : undefined)
        .orderBy(desc(lmsCourses.id))
        .limit(50);

      return rows;
    }),
});
