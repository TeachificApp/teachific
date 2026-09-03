/**
 * Custom Teachific Authentication Router
 * Handles email/password registration, login, logout, email verification,
 * and password reset — completely independent of Manus OAuth.
 */
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { router, publicProcedure, protectedProcedure } from "./_core/trpc";
import { TRPCError } from "@trpc/server";
import { getDb } from "./db";
import { users, orgMembers, organizations, magicLinkTokens } from "../drizzle/schema";
import { eq, and, lt } from "drizzle-orm";
import { generateUniqueOrgSlug } from "../shared/slugUtils";
import { sendEmail } from "./sendgrid";
import * as dbHelpers from "./db";
import { verifyEmailHtml, resetPasswordHtml, magicLinkEmailHtml } from "./emailTemplates";
import { signSessionToken } from "./_core/context";
import { getOrgBaseUrl } from "./lib/orgUrl";
import { getSessionCookieOptions } from "./_core/cookies";
import { getCourse360PlatformAppUrl } from "../shared/brands";

const COOKIE_NAME = "teachific_session";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days
const BCRYPT_ROUNDS = 12;
function getSiteUrl() {
  return getCourse360PlatformAppUrl().replace(/\/$/, "");
}

function generateToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("hex");
}

function generateOpenId(): string {
  return `local_${crypto.randomUUID().replace(/-/g, "")}`;
}

export function serializeCookie(
  name: string,
  value: string,
  maxAge: number,
  req: Parameters<typeof getSessionCookieOptions>[0],
  sameSite: "none" | "lax" = process.env.NODE_ENV === "production" ? "none" : "lax",
  includePlatformDomain = true,
): string {
  const options = getSessionCookieOptions(req);
  let str = `${name}=${encodeURIComponent(value)}; HttpOnly; Path=/; Max-Age=${maxAge}`;
  if (options.secure) str += "; Secure";
  str += sameSite === "none" ? "; SameSite=None" : "; SameSite=Lax";
  if (includePlatformDomain && options.domain) str += `; Domain=${options.domain}`;
  return str;
}

function normalizeAccountAccessOrigin(origin?: string | null): string | null {
  if (!origin) return null;
  try {
    const url = new URL(origin);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.origin.replace(/\/$/, "");
  } catch {
    return null;
  }
}

/**
 * A client-provided origin must correspond to an organization that the
 * recipient belongs to. This avoids sending account links to arbitrary URLs
 * while keeping organization subdomains and verified custom domains intact.
 */
async function resolveAccountAccessBaseUrl(
  db: NonNullable<Awaited<ReturnType<typeof getDb>>>,
  userId: number,
  requestedOrigin?: string | null,
): Promise<string> {
  const normalizedOrigin = normalizeAccountAccessOrigin(requestedOrigin);
  if (!normalizedOrigin) return getSiteUrl();

  const memberships = await db
    .select({
      slug: organizations.slug,
      customDomain: organizations.customDomain,
      domainVerificationStatus: organizations.domainVerificationStatus,
    })
    .from(orgMembers)
    .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
    .where(eq(orgMembers.userId, userId));

  const matchingOrganization = memberships.find((organization) =>
    getOrgBaseUrl(
      organization.slug,
      organization.customDomain,
      organization.domainVerificationStatus,
    ).toLowerCase() === normalizedOrigin.toLowerCase(),
  );

  return matchingOrganization
    ? getOrgBaseUrl(
        matchingOrganization.slug,
        matchingOrganization.customDomain,
        matchingOrganization.domainVerificationStatus,
      )
    : getSiteUrl();
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const customAuthRouter = router({

  /** Register a new user with email + password — auto-signs in immediately */
  register: publicProcedure
    .input(z.object({
      name: z.string().min(1).max(100),
      email: z.string().email().max(320),
      password: z.string().min(8).max(128),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database unavailable." });

      const settings = await dbHelpers.getPlatformSettings();
      if (!settings?.allowPublicRegistration) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Public registration is currently closed." });
      }

      const existing = await db.select({ id: users.id }).from(users)
        .where(eq(users.email, input.email.toLowerCase()))
        .limit(1);
      if (existing.length > 0) {
        throw new TRPCError({ code: "CONFLICT", message: "An account with this email already exists." });
      }

      const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
      const verificationToken = generateToken();
      const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);
      const openId = generateOpenId();

      await db.insert(users).values({
        openId,
        name: input.name,
        email: input.email.toLowerCase(),
        loginMethod: "email",
        role: "user",
        passwordHash,
        // Mark as verified immediately so the user can sign in right away.
        // The verification email is still sent for security, but it is not required to use the app.
        emailVerified: true,
        emailVerificationToken: verificationToken,
        emailVerificationExpiry: verificationExpiry,
        lastSignedIn: new Date(),
      });

      const [newUser] = await db.select().from(users)
        .where(eq(users.email, input.email.toLowerCase()))
        .limit(1);

      let orgSlug: string | null = null;
      if (newUser) {
        try {
          const orgName = `${input.name}'s School`;
          const slug = await generateUniqueOrgSlug(orgName, async (s) => !!(await dbHelpers.getOrgBySlug(s)));
          await dbHelpers.createOrg({ name: orgName, slug, description: "Default workspace", ownerId: newUser.id });
          const org = await dbHelpers.getOrgBySlug(slug);
          if (org) {
            await dbHelpers.addOrgMember(org.id, newUser.id, "org_admin");
            orgSlug = slug;
          }
        } catch {}

        // Send verification email in background (non-blocking)
        const verifyUrl = `${getSiteUrl()}/verify-email?token=${verificationToken}`;
        sendEmail({
          to: input.email,
          subject: "Welcome to Course360 — please verify your email",
          html: verifyEmailHtml(input.name, verifyUrl),
        }).catch(() => {});

        // Auto sign-in: issue session cookie immediately
        const sessionToken = signSessionToken({ userId: newUser.id, ts: Date.now() });
        ctx.res.setHeader("Set-Cookie", serializeCookie(COOKIE_NAME, sessionToken, COOKIE_MAX_AGE, ctx.req));
      }

      return {
        success: true,
        autoSignedIn: true,
        orgSlug,
        user: newUser ? { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role } : null,
        message: "Account created! Welcome to Course360.",
      };
    }),

  /** Login with email + password */
  login: publicProcedure
    .input(z.object({
      email: z.string().email(),
      password: z.string().min(1),
    }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [user] = await db.select().from(users)
        .where(eq(users.email, input.email.toLowerCase()))
        .limit(1);

      if (!user || !user.passwordHash) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
      }

      const valid = await bcrypt.compare(input.password, user.passwordHash);
      if (!valid) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid email or password." });
      }

      if (!user.emailVerified) {
        // Only block login if this is a self-registered account with a pending verification token.
        // Admin-created accounts (no emailVerificationToken) are auto-verified on first login.
        if (user.emailVerificationToken) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Please verify your email address before logging in. Check your inbox for the verification link." });
        }
        // Auto-verify admin-created or legacy accounts
        await db.update(users).set({ emailVerified: true, lastSignedIn: new Date() }).where(eq(users.id, user.id));
      } else {
        await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
      }

      const sessionToken = signSessionToken({ userId: user.id, ts: Date.now() });
      ctx.res.setHeader("Set-Cookie", serializeCookie(COOKIE_NAME, sessionToken, COOKIE_MAX_AGE, ctx.req));

      // Resolve the user's primary org slug for immediate subdomain redirect
      const ROLE_PRIORITY: Record<string, number> = {
        org_super_admin: 100, org_admin: 90, sub_admin: 70,
        instructor: 60, group_manager: 50, group_member: 40, member: 20, user: 10,
      };
      const memberships = await db
        .select({ role: orgMembers.role, slug: organizations.slug })
        .from(orgMembers)
        .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
        .where(eq(orgMembers.userId, user.id));
      const bestMembership = memberships.sort((a, b) =>
        (ROLE_PRIORITY[b.role] ?? 0) - (ROLE_PRIORITY[a.role] ?? 0)
      )[0];

      return {
        success: true,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, emailVerified: user.emailVerified },
        orgSlug: bestMembership?.slug ?? null,
        orgRole: bestMembership?.role ?? null,
      };
    }),

  /** Logout */
  logout: publicProcedure.mutation(async ({ ctx }) => {
    ctx.res.setHeader("Set-Cookie", serializeCookie(COOKIE_NAME, "", 0, ctx.req));
    return { success: true };
  }),

  /** Get current user from custom session cookie */
  me: publicProcedure.query(async ({ ctx }) => {
    try {
      const cookieHeader = ctx.req.headers.cookie ?? "";
      const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
      if (!match) return null;

      const { verifySessionToken } = await import("./_core/context");
      const payload = verifySessionToken(decodeURIComponent(match[1]));
      if (!payload?.userId) return null;

      const db = await getDb();
      if (!db) return null;

      const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
      if (!user) return null;

      return { id: user.id, name: user.name, email: user.email, role: user.role, emailVerified: user.emailVerified, openId: user.openId };
    } catch {
      return null;
    }
  }),

  /** Verify email with token */
  verifyEmail: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [user] = await db.select().from(users)
        .where(eq(users.emailVerificationToken, input.token))
        .limit(1);

      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid or expired verification link." });
      if (user.emailVerificationExpiry && user.emailVerificationExpiry < new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Verification link has expired. Please request a new one." });
      }

      await db.update(users).set({ emailVerified: true, emailVerificationToken: null, emailVerificationExpiry: null }).where(eq(users.id, user.id));
      return { success: true, message: "Email verified! You can now log in." };
    }),

  /** Resend verification email */
  resendVerification: publicProcedure
    .input(z.object({ email: z.string().email(), origin: z.string().url().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { success: true };

      const [user] = await db.select().from(users).where(eq(users.email, input.email.toLowerCase())).limit(1);
      if (!user || user.emailVerified) return { success: true };

      const verificationToken = generateToken();
      const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await db.update(users).set({ emailVerificationToken: verificationToken, emailVerificationExpiry: verificationExpiry }).where(eq(users.id, user.id));

      const baseUrl = await resolveAccountAccessBaseUrl(
        db,
        user.id,
        input.origin ?? ctx.req.headers.origin ?? null,
      );
      const verifyUrl = `${baseUrl}/verify-email?token=${verificationToken}`;
      await sendEmail({ to: input.email, subject: "Verify your Course360 email address", html: verifyEmailHtml(user.name || "", verifyUrl) });
      return { success: true };
    }),

  /** Request password reset */
  forgotPassword: publicProcedure
    .input(z.object({ email: z.string().email(), origin: z.string().url().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) return { success: true };

      const [user] = await db.select().from(users).where(eq(users.email, input.email.toLowerCase())).limit(1);
      // Return success even if user not found (prevents email enumeration)
      if (!user) return { success: true };
      // Allow reset even for OAuth accounts (no passwordHash) so they can set a password

      const resetToken = generateToken();
      const resetExpiry = new Date(Date.now() + 60 * 60 * 1000);

      await db.update(users).set({ resetToken, resetTokenExpiry: resetExpiry }).where(eq(users.id, user.id));

      const baseUrl = await resolveAccountAccessBaseUrl(
        db,
        user.id,
        input.origin ?? ctx.req.headers.origin ?? null,
      );
      const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
      await sendEmail({ to: input.email, subject: "Reset your Course360 password", html: resetPasswordHtml(user.name || "", resetUrl) });
      return { success: true };
    }),

  /** Reset password with token */
  resetPassword: publicProcedure
    .input(z.object({ token: z.string(), newPassword: z.string().min(8).max(128) }))
    .mutation(async ({ input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [user] = await db.select().from(users).where(eq(users.resetToken, input.token)).limit(1);
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid or expired reset link." });
      if (user.resetTokenExpiry && user.resetTokenExpiry < new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Reset link has expired. Please request a new one." });
      }

      const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
      await db.update(users).set({ passwordHash, resetToken: null, resetTokenExpiry: null, emailVerified: true }).where(eq(users.id, user.id));
      return { success: true, message: "Password updated! You can now log in." };
    }),

  /** Request a magic link (passwordless sign-in) */
  requestMagicLink: publicProcedure
    .input(z.object({ email: z.string().email(), redirectTo: z.string().optional(), origin: z.string().url().optional() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      // Clean up expired tokens for this email
      await db.delete(magicLinkTokens)
        .where(and(eq(magicLinkTokens.email, input.email.toLowerCase()), lt(magicLinkTokens.expiresAt, new Date())));
      const [user] = await db.select().from(users).where(eq(users.email, input.email.toLowerCase())).limit(1);
      const token = generateToken(48);
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes
      await db.insert(magicLinkTokens).values({
        token,
        email: input.email.toLowerCase(),
        userId: user?.id ?? null,
        redirectTo: input.redirectTo ?? null,
        expiresAt,
      });
      // Only preserve a requested origin when it belongs to an organization
      // the recipient belongs to; otherwise use the canonical platform URL.
      const baseUrl = user
        ? await resolveAccountAccessBaseUrl(db, user.id, input.origin ?? ctx.req.headers.origin ?? null)
        : getSiteUrl();
      const magicUrl = `${baseUrl}/magic-link/verify?token=${token}`;
      await sendEmail({
        to: input.email,
        subject: "Your Course360 sign-in link",
        html: magicLinkEmailHtml(user?.name ?? "", magicUrl, 15),
      });
      return { success: true, message: "Check your email for a sign-in link." };
    }),

  /** Verify a magic link token and create a session */
  verifyMagicLink: publicProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });
      const [record] = await db.select().from(magicLinkTokens)
        .where(eq(magicLinkTokens.token, input.token)).limit(1);
      if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "Invalid or expired sign-in link." });
      if (record.usedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "This sign-in link has already been used." });
      if (record.expiresAt < new Date()) throw new TRPCError({ code: "BAD_REQUEST", message: "This sign-in link has expired. Please request a new one." });
      // Mark token as used immediately (prevent replay)
      await db.update(magicLinkTokens).set({ usedAt: new Date() }).where(eq(magicLinkTokens.id, record.id));
      let user: typeof users.$inferSelect | undefined;
      if (record.userId) {
        const [u] = await db.select().from(users).where(eq(users.id, record.userId)).limit(1);
        user = u;
      }
      if (!user) {
        // Find by email (handles case where userId was null or user was created after token)
        const [u] = await db.select().from(users).where(eq(users.email, record.email)).limit(1);
        if (u) {
          user = u;
        } else {
          // Auto-register new user via magic link
          const openId = generateOpenId();
          const name = record.email.split("@")[0];
          await db.insert(users).values({ openId, email: record.email, name, emailVerified: true, loginMethod: "magic_link", role: "user", lastSignedIn: new Date() });
          const [newUser] = await db.select().from(users).where(eq(users.email, record.email)).limit(1);
          user = newUser;
          // Create default org for new user
          if (user) {
            try {
              const { generateUniqueOrgSlug } = await import("../shared/slugUtils");
              const orgName = `${name}'s School`;
              const slug = await generateUniqueOrgSlug(orgName, async (s) => !!(await dbHelpers.getOrgBySlug(s)));
              await dbHelpers.createOrg({ name: orgName, slug, description: "Default workspace", ownerId: user.id });
              const org = await dbHelpers.getOrgBySlug(slug);
              if (org) await dbHelpers.addOrgMember(org.id, user.id, "org_admin");
            } catch {}
          }
        }
      }
      if (!user) throw new TRPCError({ code: "NOT_FOUND", message: "User account not found." });
      if (!user.emailVerified) {
        await db.update(users).set({ emailVerified: true, lastSignedIn: new Date() }).where(eq(users.id, user.id));
      } else {
        await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, user.id));
      }
      const sessionToken = signSessionToken({ userId: user.id, ts: Date.now() });
      // Set the primary cookie using the same serializer as login/register for consistency.
      // Also set _lax and host-only variants for email-client compatibility.
      const cookieMaxAgeSeconds = COOKIE_MAX_AGE;
      ctx.res.setHeader("Set-Cookie", [
        serializeCookie(COOKIE_NAME, sessionToken, cookieMaxAgeSeconds, ctx.req),
        serializeCookie(`${COOKIE_NAME}_lax`, sessionToken, cookieMaxAgeSeconds, ctx.req, "lax"),
        serializeCookie(`${COOKIE_NAME}_host`, sessionToken, cookieMaxAgeSeconds, ctx.req, "lax", false),
      ]);
      const ROLE_PRIORITY: Record<string, number> = {
        org_super_admin: 100, org_admin: 90, sub_admin: 70,
        instructor: 60, group_manager: 50, group_member: 40, member: 20, user: 10,
      };
      const memberships = await db
        .select({ role: orgMembers.role, slug: organizations.slug })
        .from(orgMembers)
        .innerJoin(organizations, eq(orgMembers.orgId, organizations.id))
        .where(eq(orgMembers.userId, user.id));
      const bestMembership = memberships.sort((a, b) =>
        (ROLE_PRIORITY[b.role] ?? 0) - (ROLE_PRIORITY[a.role] ?? 0)
      )[0];
      return {
        success: true,
        redirectTo: record.redirectTo ?? null,
        user: { id: user.id, name: user.name, email: user.email, role: user.role, emailVerified: true },
        orgSlug: bestMembership?.slug ?? null,
        orgRole: bestMembership?.role ?? null,
      };
    }),

  /** Change password (authenticated) */
  changePassword: protectedProcedure
    .input(z.object({ currentPassword: z.string(), newPassword: z.string().min(8).max(128) }))
    .mutation(async ({ input, ctx }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR" });

      const [user] = await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1);
      if (!user?.passwordHash) throw new TRPCError({ code: "BAD_REQUEST", message: "No password set on this account." });

      const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
      if (!valid) throw new TRPCError({ code: "UNAUTHORIZED", message: "Current password is incorrect." });

      const passwordHash = await bcrypt.hash(input.newPassword, BCRYPT_ROUNDS);
      await db.update(users).set({ passwordHash }).where(eq(users.id, user.id));
      return { success: true };
    }),
});
