import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { drizzle } from "drizzle-orm/mysql2";
import {
  communityHubs,
  communitySpaces,
  communityMembers,
  communityInvites,
  communityPosts,
  communityPostReplies,
  communityPostReactions,
  communityDms,
  orgSubscriptions,
  communityAdminProfiles,
  users,
} from "../drizzle/schema";
import { eq, and, desc, asc, sql, or } from "drizzle-orm";
import crypto from "crypto";
import { getLimits } from "../shared/tierLimits";

let _db: ReturnType<typeof drizzle> | null = null;
function getDb() {
  if (!_db) _db = drizzle(process.env.DATABASE_URL as string);
  return _db;
}
const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_t, prop) {
    return (getDb() as any)[prop];
  },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getOrCreateHub(orgId: number) {
  const [existing] = await db
    .select()
    .from(communityHubs)
    .where(eq(communityHubs.orgId, orgId))
    .limit(1);
  if (existing) return existing;
  const [created] = await db.insert(communityHubs).values({
    orgId,
    name: "Community",
    slug: `org-${orgId}`,
    isEnabled: true,
  });
  const [hub] = await db
    .select()
    .from(communityHubs)
    .where(eq(communityHubs.id, (created as any).insertId))
    .limit(1);
  return hub;
}

async function requireSpaceMember(spaceId: number, userId: number) {
  const [member] = await db
    .select()
    .from(communityMembers)
    .where(
      and(
        eq(communityMembers.spaceId, spaceId),
        eq(communityMembers.userId, userId),
        eq(communityMembers.isBanned, false)
      )
    )
    .limit(1);
  return member ?? null;
}

// ─── Community Router ─────────────────────────────────────────────────────────

export const communityRouter = router({
  // ── Hub List (multi-hub support) ──────────────────────────────────────────

  listHubs: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input }) => {
      return db
        .select()
        .from(communityHubs)
        .where(eq(communityHubs.orgId, input.orgId))
        .orderBy(asc(communityHubs.sortOrder), asc(communityHubs.id));
    }),

  createHub: protectedProcedure
    .input(z.object({
      orgId: z.number(),
      name: z.string().min(1),
      tagline: z.string().optional(),
      description: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      // Verify org membership for org_super_admin (they can only manage their own org)
      if (ctx.user.role === "org_super_admin") {
        const { orgMembers: orgMembersTable } = await import("../drizzle/schema");
        const [membership] = await db.select().from(orgMembersTable)
          .where(and(eq(orgMembersTable.userId, ctx.user.id), eq(orgMembersTable.orgId, input.orgId)))
          .limit(1);
        if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this organization" });
      }
      // Platform admins and org super admins (of this org) bypass community count limits
      const _isPlatformAdmin = ctx.user.role === "site_owner" || ctx.user.role === "site_admin" || ctx.user.role === "org_super_admin";
      if (!_isPlatformAdmin) {
        const [sub] = await db.select().from(orgSubscriptions).where(eq(orgSubscriptions.orgId, input.orgId)).limit(1);
        const limits = getLimits(sub?.plan);
        const existing = await db.select().from(communityHubs).where(eq(communityHubs.orgId, input.orgId));
        if (limits.maxCommunities !== null && existing.length >= limits.maxCommunities) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: `Your plan allows up to ${limits.maxCommunities} communit${limits.maxCommunities === 1 ? 'y' : 'ies'}. Upgrade to create more.`,
          });
        }
      }
      const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const [result] = await db.insert(communityHubs).values({
        orgId: input.orgId,
        name: input.name,
        slug: `${slug}-${Date.now()}`,
        tagline: input.tagline,
        description: input.description,
        isEnabled: true,
      });
      return { id: (result as any).insertId };
    }),

  deleteHub: protectedProcedure
    .input(z.object({ hubId: z.number() }))
    .mutation(async ({ input }) => {
      await db.delete(communityHubs).where(eq(communityHubs.id, input.hubId));
      return { success: true };
    }),

  reorderHubs: protectedProcedure
    .input(z.object({ orderedIds: z.array(z.number()) }))
    .mutation(async ({ input }) => {
      for (let i = 0; i < input.orderedIds.length; i++) {
        await db
          .update(communityHubs)
          .set({ sortOrder: i })
          .where(eq(communityHubs.id, input.orderedIds[i]));
      }
      return { success: true };
    }),

  // ── Hub ───────────────────────────────────────────────────────────────────

  getHub: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input }) => {
      return getOrCreateHub(input.orgId);
    }),

  updateHub: protectedProcedure
    .input(
      z.object({
        orgId: z.number(),
        name: z.string().optional(),
        tagline: z.string().optional(),
        description: z.string().optional(),
        coverImageUrl: z.string().optional(),
        logoUrl: z.string().optional(),
        primaryColor: z.string().optional(),
        isEnabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { orgId, ...updates } = input;
      const hub = await getOrCreateHub(orgId);
      await db
        .update(communityHubs)
        .set(updates)
        .where(eq(communityHubs.id, hub.id));
      return { success: true };
    }),

  // ── Spaces ────────────────────────────────────────────────────────────────

  listSpaces: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input }) => {
      const hub = await getOrCreateHub(input.orgId);
      return db
        .select()
        .from(communitySpaces)
        .where(
          and(
            eq(communitySpaces.hubId, hub.id),
            eq(communitySpaces.isArchived, false)
          )
        )
        .orderBy(asc(communitySpaces.sortOrder));
    }),

  getSpace: protectedProcedure
    .input(z.object({ spaceId: z.number() }))
    .query(async ({ input }) => {
      const [space] = await db
        .select()
        .from(communitySpaces)
        .where(eq(communitySpaces.id, input.spaceId))
        .limit(1);
      if (!space) throw new TRPCError({ code: "NOT_FOUND" });
      return space;
    }),

  createSpace: protectedProcedure
    .input(
      z.object({
        orgId: z.number(),
        name: z.string().min(1),
        description: z.string().optional(),
        emoji: z.string().optional(),
        coverImageUrl: z.string().optional(),
        accessType: z
          .enum(["open", "invite_only", "course_enrollment", "purchase"])
          .default("open"),
        isInviteOnly: z.boolean().default(false),
        linkedCourseId: z.number().optional(),
        price: z.number().optional(),
        salesPageTitle: z.string().optional(),
        salesPageContent: z.string().optional(),
        salesPageCta: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const hub = await getOrCreateHub(input.orgId);
      const slug = input.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      const [result] = await db.insert(communitySpaces).values({
        hubId: hub.id,
        orgId: input.orgId,
        name: input.name,
        slug,
        description: input.description,
        emoji: input.emoji ?? "💬",
        coverImageUrl: input.coverImageUrl,
        accessType: input.accessType,
        isInviteOnly: input.isInviteOnly,
        linkedCourseId: input.linkedCourseId,
        price: input.price ?? 0,
        salesPageTitle: input.salesPageTitle,
        salesPageContent: input.salesPageContent,
        salesPageCta: input.salesPageCta ?? "Join Community",
      });
      return { id: (result as any).insertId };
    }),

  updateSpace: protectedProcedure
    .input(
      z.object({
        spaceId: z.number(),
        name: z.string().optional(),
        description: z.string().optional(),
        emoji: z.string().optional(),
        coverImageUrl: z.string().optional(),
        accessType: z
          .enum(["open", "invite_only", "course_enrollment", "purchase"])
          .optional(),
        isInviteOnly: z.boolean().optional(),
        linkedCourseId: z.number().nullable().optional(),
        price: z.number().optional(),
        salesPageTitle: z.string().optional(),
        salesPageContent: z.string().optional(),
        salesPageCta: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { spaceId, ...updates } = input;
      await db
        .update(communitySpaces)
        .set(updates)
        .where(eq(communitySpaces.id, spaceId));
      return { success: true };
    }),

  deleteSpace: protectedProcedure
    .input(z.object({ spaceId: z.number() }))
    .mutation(async ({ input }) => {
      await db
        .update(communitySpaces)
        .set({ isArchived: true })
        .where(eq(communitySpaces.id, input.spaceId));
      return { success: true };
    }),

  reorderSpaces: protectedProcedure
    .input(z.object({ spaceIds: z.array(z.number()) }))
    .mutation(async ({ input }) => {
      for (let i = 0; i < input.spaceIds.length; i++) {
        await db
          .update(communitySpaces)
          .set({ sortOrder: i })
          .where(eq(communitySpaces.id, input.spaceIds[i]));
      }
      return { success: true };
    }),

  // ── Members ───────────────────────────────────────────────────────────────

  listMembers: protectedProcedure
    .input(z.object({ spaceId: z.number() }))
    .query(async ({ input }) => {
      return db
        .select()
        .from(communityMembers)
        .where(
          and(
            eq(communityMembers.spaceId, input.spaceId),
            eq(communityMembers.isBanned, false)
          )
        )
        .orderBy(asc(communityMembers.joinedAt));
    }),

  joinSpace: protectedProcedure
    .input(z.object({ spaceId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      const [space] = await db
        .select()
        .from(communitySpaces)
        .where(eq(communitySpaces.id, input.spaceId))
        .limit(1);
      if (!space) throw new TRPCError({ code: "NOT_FOUND" });

      // Check access
      if (space.accessType === "invite_only" || space.isInviteOnly) {
        // Check for valid invite
        const [invite] = await db
          .select()
          .from(communityInvites)
          .where(
            and(
              eq(communityInvites.spaceId, input.spaceId),
              eq(communityInvites.status, "pending")
            )
          )
          .limit(1);
        if (!invite) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message:
              "This space is invite-only. Please request an invitation from the community admin.",
          });
        }
      }

      // Check if already a member
      const existing = await requireSpaceMember(input.spaceId, ctx.user.id);
      if (existing) return { success: true };

      await db.insert(communityMembers).values({
        spaceId: input.spaceId,
        userId: ctx.user.id,
        role: "member",
      });
      await db
        .update(communitySpaces)
        .set({ memberCount: sql`${communitySpaces.memberCount} + 1` })
        .where(eq(communitySpaces.id, input.spaceId));
      return { success: true };
    }),

  leaveSpace: protectedProcedure
    .input(z.object({ spaceId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await db
        .delete(communityMembers)
        .where(
          and(
            eq(communityMembers.spaceId, input.spaceId),
            eq(communityMembers.userId, ctx.user.id)
          )
        );
      await db
        .update(communitySpaces)
        .set({
          memberCount: sql`GREATEST(${communitySpaces.memberCount} - 1, 0)`,
        })
        .where(eq(communitySpaces.id, input.spaceId));
      return { success: true };
    }),

  banMember: protectedProcedure
    .input(z.object({ spaceId: z.number(), userId: z.number() }))
    .mutation(async ({ input }) => {
      await db
        .update(communityMembers)
        .set({ isBanned: true })
        .where(
          and(
            eq(communityMembers.spaceId, input.spaceId),
            eq(communityMembers.userId, input.userId)
          )
        );
      return { success: true };
    }),

  updateMemberRole: protectedProcedure
    .input(
      z.object({
        spaceId: z.number(),
        userId: z.number(),
        role: z.enum(["member", "moderator", "admin"]),
      })
    )
    .mutation(async ({ input }) => {
      await db
        .update(communityMembers)
        .set({ role: input.role })
        .where(
          and(
            eq(communityMembers.spaceId, input.spaceId),
            eq(communityMembers.userId, input.userId)
          )
        );
      return { success: true };
    }),

  // ── Invites ───────────────────────────────────────────────────────────────

  listInvites: protectedProcedure
    .input(z.object({ spaceId: z.number() }))
    .query(async ({ input }) => {
      return db
        .select()
        .from(communityInvites)
        .where(eq(communityInvites.spaceId, input.spaceId))
        .orderBy(desc(communityInvites.createdAt));
    }),

  createInvite: protectedProcedure
    .input(
      z.object({
        spaceId: z.number(),
        email: z.string().email(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const token = crypto.randomBytes(32).toString("hex");
      await db.insert(communityInvites).values({
        spaceId: input.spaceId,
        email: input.email,
        token,
        invitedByUserId: ctx.user.id,
        status: "pending",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });
      return { token };
    }),

  revokeInvite: protectedProcedure
    .input(z.object({ inviteId: z.number() }))
    .mutation(async ({ input }) => {
      await db
        .update(communityInvites)
        .set({ status: "revoked" })
        .where(eq(communityInvites.id, input.inviteId));
      return { success: true };
    }),

  // ── Posts ─────────────────────────────────────────────────────────────────

  listPosts: protectedProcedure
    .input(
      z.object({
        spaceId: z.number(),
        limit: z.number().default(20),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input }) => {
      return db
        .select()
        .from(communityPosts)
        .where(
          and(
            eq(communityPosts.spaceId, input.spaceId),
            eq(communityPosts.isHidden, false)
          )
        )
        .orderBy(desc(communityPosts.isPinned), desc(communityPosts.createdAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

  listAllPosts: protectedProcedure
    .input(
      z.object({
        orgId: z.number(),
        limit: z.number().default(50),
        offset: z.number().default(0),
      })
    )
    .query(async ({ input }) => {
      return db
        .select()
        .from(communityPosts)
        .where(eq(communityPosts.orgId, input.orgId))
        .orderBy(desc(communityPosts.createdAt))
        .limit(input.limit)
        .offset(input.offset);
    }),

  createPost: protectedProcedure
    .input(
      z.object({
        spaceId: z.number(),
        hubId: z.number(),
        orgId: z.number(),
        content: z.string().min(1),
        imageUrl: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [result] = await db.insert(communityPosts).values({
        spaceId: input.spaceId,
        hubId: input.hubId,
        orgId: input.orgId,
        authorId: ctx.user.id,
        authorName: ctx.user.name ?? "Anonymous",
        content: input.content,
        imageUrl: input.imageUrl,
      });
      await db
        .update(communitySpaces)
        .set({ postCount: sql`${communitySpaces.postCount} + 1` })
        .where(eq(communitySpaces.id, input.spaceId));
      return { id: (result as any).insertId };
    }),

  updatePost: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        content: z.string().optional(),
        isPinned: z.boolean().optional(),
        isHidden: z.boolean().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const { postId, ...updates } = input;
      await db
        .update(communityPosts)
        .set(updates)
        .where(eq(communityPosts.id, postId));
      return { success: true };
    }),

  deletePost: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .mutation(async ({ input }) => {
      await db
        .update(communityPosts)
        .set({ isHidden: true })
        .where(eq(communityPosts.id, input.postId));
      return { success: true };
    }),

  // ── Replies ───────────────────────────────────────────────────────────────

  listReplies: protectedProcedure
    .input(z.object({ postId: z.number() }))
    .query(async ({ input }) => {
      return db
        .select()
        .from(communityPostReplies)
        .where(
          and(
            eq(communityPostReplies.postId, input.postId),
            eq(communityPostReplies.isHidden, false)
          )
        )
        .orderBy(asc(communityPostReplies.createdAt));
    }),

  createReply: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await db.insert(communityPostReplies).values({
        postId: input.postId,
        authorId: ctx.user.id,
        authorName: ctx.user.name ?? "Anonymous",
        content: input.content,
      });
      await db
        .update(communityPosts)
        .set({ replyCount: sql`${communityPosts.replyCount} + 1` })
        .where(eq(communityPosts.id, input.postId));
      return { success: true };
    }),

  deleteReply: protectedProcedure
    .input(z.object({ replyId: z.number() }))
    .mutation(async ({ input }) => {
      await db
        .update(communityPostReplies)
        .set({ isHidden: true })
        .where(eq(communityPostReplies.id, input.replyId));
      return { success: true };
    }),

  // ── Reactions ─────────────────────────────────────────────────────────────

  toggleReaction: protectedProcedure
    .input(
      z.object({
        postId: z.number(),
        emoji: z.string().default("👍"),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const [existing] = await db
        .select()
        .from(communityPostReactions)
        .where(
          and(
            eq(communityPostReactions.postId, input.postId),
            eq(communityPostReactions.userId, ctx.user.id),
            eq(communityPostReactions.emoji, input.emoji)
          )
        )
        .limit(1);

      if (existing) {
        await db
          .delete(communityPostReactions)
          .where(eq(communityPostReactions.id, existing.id));
        await db
          .update(communityPosts)
          .set({
            reactionCount: sql`GREATEST(${communityPosts.reactionCount} - 1, 0)`,
          })
          .where(eq(communityPosts.id, input.postId));
        return { added: false };
      } else {
        await db.insert(communityPostReactions).values({
          postId: input.postId,
          userId: ctx.user.id,
          emoji: input.emoji,
        });
        await db
          .update(communityPosts)
          .set({ reactionCount: sql`${communityPosts.reactionCount} + 1` })
          .where(eq(communityPosts.id, input.postId));
        return { added: true };
      }
    }),

  getMyReactions: protectedProcedure
    .input(z.object({ postIds: z.array(z.number()) }))
    .query(async ({ input, ctx }) => {
      if (input.postIds.length === 0) return [];
      return db
        .select()
        .from(communityPostReactions)
        .where(eq(communityPostReactions.userId, ctx.user.id));
    }),

  // ── DMs ───────────────────────────────────────────────────────────────────

  listDmConversations: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input, ctx }) => {
      // Get all unique conversation partners
      const rows = await db
        .select()
        .from(communityDms)
        .where(
          and(
            eq(communityDms.orgId, input.orgId),
            or(
              eq(communityDms.fromUserId, ctx.user.id),
              eq(communityDms.toUserId, ctx.user.id)
            )
          )
        )
        .orderBy(desc(communityDms.createdAt));

      // Group by conversation partner
      const convMap = new Map<
        number,
        { partnerId: number; lastMessage: (typeof rows)[0] }
      >();
      for (const row of rows) {
        const partnerId =
          row.fromUserId === ctx.user.id ? row.toUserId : row.fromUserId;
        if (!convMap.has(partnerId)) {
          convMap.set(partnerId, { partnerId, lastMessage: row });
        }
      }
      return Array.from(convMap.values());
    }),

  listDmMessages: protectedProcedure
    .input(
      z.object({
        orgId: z.number(),
        partnerId: z.number(),
        limit: z.number().default(50),
      })
    )
    .query(async ({ input, ctx }) => {
      return db
        .select()
        .from(communityDms)
        .where(
          and(
            eq(communityDms.orgId, input.orgId),
            or(
              and(
                eq(communityDms.fromUserId, ctx.user.id),
                eq(communityDms.toUserId, input.partnerId)
              ),
              and(
                eq(communityDms.fromUserId, input.partnerId),
                eq(communityDms.toUserId, ctx.user.id)
              )
            )
          )
        )
        .orderBy(asc(communityDms.createdAt))
        .limit(input.limit);
    }),

  sendDm: protectedProcedure
    .input(
      z.object({
        orgId: z.number(),
        toUserId: z.number(),
        content: z.string().min(1),
      })
    )
    .mutation(async ({ input, ctx }) => {
      await db.insert(communityDms).values({
        orgId: input.orgId,
        fromUserId: ctx.user.id,
        toUserId: input.toUserId,
        content: input.content,
      });
      return { success: true };
    }),

  markDmsRead: protectedProcedure
    .input(z.object({ orgId: z.number(), fromUserId: z.number() }))
    .mutation(async ({ input, ctx }) => {
      await db
        .update(communityDms)
        .set({ isRead: true })
        .where(
          and(
            eq(communityDms.orgId, input.orgId),
            eq(communityDms.fromUserId, input.fromUserId),
            eq(communityDms.toUserId, ctx.user.id)
          )
        );
      return { success: true };
    }),

  // ── Hub by ID ──────────────────────────────────────────────────────────────

  getHubById: protectedProcedure
    .input(z.object({ hubId: z.number() }))
    .query(async ({ input }) => {
      const [hub] = await db
        .select()
        .from(communityHubs)
        .where(eq(communityHubs.id, input.hubId))
        .limit(1);
      if (!hub) throw new TRPCError({ code: "NOT_FOUND" });
      return hub;
    }),

  updateHubById: protectedProcedure
    .input(
      z.object({
        hubId: z.number(),
        name: z.string().optional(),
        tagline: z.string().optional(),
        description: z.string().optional(),
        coverImageUrl: z.string().nullable().optional(),
        logoUrl: z.string().nullable().optional(),
        primaryColor: z.string().optional(),
        isEnabled: z.boolean().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const { hubId, ...updates } = input;
      await db.update(communityHubs).set(updates).where(eq(communityHubs.id, hubId));
      return { success: true };
    }),

  listSpacesByHubId: protectedProcedure
    .input(z.object({ hubId: z.number() }))
    .query(async ({ input }) => {
      return db
        .select()
        .from(communitySpaces)
        .where(
          and(
            eq(communitySpaces.hubId, input.hubId),
            eq(communitySpaces.isArchived, false)
          )
        )
        .orderBy(asc(communitySpaces.sortOrder));
    }),

  createSpaceForHub: protectedProcedure
    .input(
      z.object({
        hubId: z.number(),
        orgId: z.number(),
        name: z.string().min(1),
        description: z.string().optional(),
        emoji: z.string().optional(),
        coverImageUrl: z.string().optional(),
        accessType: z.enum(["open", "invite_only", "course_enrollment", "purchase"]).default("open"),
        isInviteOnly: z.boolean().default(false),
      })
    )
    .mutation(async ({ input }) => {
      const slug = input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      const [result] = await db.insert(communitySpaces).values({
        hubId: input.hubId,
        orgId: input.orgId,
        name: input.name,
        slug: `${slug}-${Date.now()}`,
        description: input.description,
        emoji: input.emoji ?? "💬",
        coverImageUrl: input.coverImageUrl,
        accessType: input.accessType,
        isInviteOnly: input.isInviteOnly,
      });
      return { id: (result as any).insertId };
    }),

  listAllMembersByHub: protectedProcedure
    .input(z.object({ hubId: z.number() }))
    .query(async ({ input }) => {
      const spaces = await db
        .select({ id: communitySpaces.id })
        .from(communitySpaces)
        .where(eq(communitySpaces.hubId, input.hubId));
      if (!spaces.length) return [];
      const spaceIds = spaces.map((s) => s.id);
      const members = await db
        .select()
        .from(communityMembers)
        .where(sql`${communityMembers.spaceId} IN (${sql.join(spaceIds.map((id) => sql`${id}`), sql`, `)})`)
        .orderBy(asc(communityMembers.joinedAt));
      return members;
    }),

  listInvitesByHub: protectedProcedure
    .input(z.object({ hubId: z.number() }))
    .query(async ({ input }) => {
      const spaces = await db
        .select({ id: communitySpaces.id })
        .from(communitySpaces)
        .where(eq(communitySpaces.hubId, input.hubId));
      if (!spaces.length) return [];
      const spaceIds = spaces.map((s) => s.id);
      return db
        .select()
        .from(communityInvites)
        .where(sql`${communityInvites.spaceId} IN (${sql.join(spaceIds.map((id) => sql`${id}`), sql`, `)})`)
        .orderBy(desc(communityInvites.createdAt));
    }),

  // ── Moderation ────────────────────────────────────────────────────────────

  getModerationQueue: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ input }) => {
      const posts = await db
        .select()
        .from(communityPosts)
        .where(
          and(
            eq(communityPosts.orgId, input.orgId),
            eq(communityPosts.isHidden, true)
          )
        )
        .orderBy(desc(communityPosts.createdAt))
        .limit(50);
      return posts;
    }),

  // ── Pending Members ──────────────────────────────────────────────────────

  listPendingMembers: protectedProcedure
    .input(z.object({ hubId: z.number() }))
    .query(async ({ input }) => {
      const spaces = await db
        .select({ id: communitySpaces.id })
        .from(communitySpaces)
        .where(eq(communitySpaces.hubId, input.hubId));
      if (!spaces.length) return [];
      const spaceIds = spaces.map((s) => s.id);
      const rows = await db
        .select({
          id: communityMembers.id,
          spaceId: communityMembers.spaceId,
          userId: communityMembers.userId,
          joinedAt: communityMembers.joinedAt,
          status: communityMembers.status,
          userName: users.name,
          userEmail: users.email,
          userAvatar: users.avatarUrl,
        })
        .from(communityMembers)
        .innerJoin(users, eq(users.id, communityMembers.userId))
        .where(
          and(
            sql`${communityMembers.spaceId} IN (${sql.join(spaceIds.map((id) => sql`${id}`), sql`, `)})`,
            eq(communityMembers.status, "pending")
          )
        )
        .orderBy(asc(communityMembers.joinedAt));
      return rows;
    }),

  approveMember: protectedProcedure
    .input(z.object({
      memberId: z.number(),
      action: z.enum(["approve", "reject"]),
    }))
    .mutation(async ({ input }) => {
      const newStatus = input.action === "approve" ? "approved" : "rejected";
      await db
        .update(communityMembers)
        .set({ status: newStatus })
        .where(eq(communityMembers.id, input.memberId));
      return { success: true };
    }),

  // ── Admin Profiles ───────────────────────────────────────────────────────

  listAdminProfiles: protectedProcedure
    .input(z.object({ hubId: z.number() }))
    .query(async ({ input }) => {
      return db
        .select()
        .from(communityAdminProfiles)
        .where(eq(communityAdminProfiles.hubId, input.hubId))
        .orderBy(asc(communityAdminProfiles.createdAt));
    }),

  createAdminProfile: protectedProcedure
    .input(z.object({
      hubId: z.number(),
      name: z.string().min(1).max(100),
      bio: z.string().optional(),
      avatarUrl: z.string().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const [result] = await db.insert(communityAdminProfiles).values({
        hubId: input.hubId,
        name: input.name,
        bio: input.bio ?? null,
        avatarUrl: input.avatarUrl ?? null,
        createdByUserId: ctx.user.id,
      });
      return { id: (result as any).insertId };
    }),

  updateAdminProfile: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(100).optional(),
      bio: z.string().optional(),
      avatarUrl: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await db.update(communityAdminProfiles).set(data).where(eq(communityAdminProfiles.id, id));
      return { success: true };
    }),

  deleteAdminProfile: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await db.delete(communityAdminProfiles).where(eq(communityAdminProfiles.id, input.id));
      return { success: true };
    }),
});
