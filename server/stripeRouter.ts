/**
 * Stripe Billing Router for Course360
 * Handles org subscription checkout, customer portal, and payment settings.
 */
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import {
  protectedProcedure,
  publicProcedure,
  adminProcedure,
  router,
} from "./_core/trpc";
import {
  getStripe,
  getPlatformStripeSecretKey,
  getPlatformStripePublishableKey,
  getPlatformPaymentReadiness,
  STRIPE_PRICE_IDS,
  PLAN_LIMITS,
  type PlanTier,
} from "./stripePlans";
import { getOrgSubscription, upsertOrgSubscription } from "./lmsDb";
import { ENV } from "./_core/env";
import { getOrgBaseUrl } from "./lib/orgUrl";
import {
  confirmedPlatformBillingState,
  isTerminalPlatformSubscription,
  preservedSchoolSchedulePhase,
  nextSchoolBillingPeriodEnd,
} from "./course360BillingState";
import type Stripe from "stripe";
import { requireCourse360AppOrganization, requireCourse360AppCapability, getCourse360AppCapabilityStatus, getCourse360AppBillingRecords, course360DesktopArtifactUrl } from "./lib/course360AppCapabilities";
import { createCourse360PaymentCheckout, getCourse360PaymentAppAccess, claimCourse360PaymentSchoolOwner, listCourse360PaymentOwnerClaims, course360PaymentLedgerReady, setCourse360PaymentManualRole, course360PaymentAppTrialEligible } from "./lib/course360PaymentLedger";
import { course360CrossToolProcedures } from "./course360CrossToolProcedures";
import { COURSE360_CROSS_TOOL_FAMILY } from "./lib/course360CrossToolCatalog";
import { assertCourse360CrossToolRecovery } from "./lib/course360CrossToolFulfillment";
import { getCourse360PaymentDb } from "./lib/course360PaymentLedger";

async function getDb() {
  const { getDb: _getDb } = await import("./db");
  const db = await _getDb();
  if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Database not available" });
  return db;
}

const COURSE360_CHECKOUT_PLATFORM_HOSTS = new Set([
  "course360.app",
  "www.course360.app",
]);

function hostFromUrl(url: string | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

function getConfiguredPreviewUrl(): string | undefined {
  // Some deployment environments expose the preview URL at runtime even though
  // this older ENV type does not declare it. Retain the established protected
  // checkout behavior without widening browser-provided origin authority.
  return (ENV as { appUrl?: string }).appUrl;
}

export function parseApprovedPlatformCheckoutOrigin(
  origin: string,
  configuredPreviewUrl = getConfiguredPreviewUrl()
): string | null {
  try {
    const parsed = new URL(origin);
    const hostname = parsed.hostname.toLowerCase();
    const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
    const isConfiguredPreview =
      !!configuredPreviewUrl &&
      parsed.origin === new URL(configuredPreviewUrl).origin;
    const isSecure =
      parsed.protocol === "https:" ||
      (isLocalhost && parsed.protocol === "http:");

    if (
      !parsed.username &&
      !parsed.password &&
      isSecure &&
      (isLocalhost ||
        isConfiguredPreview ||
        (COURSE360_CHECKOUT_PLATFORM_HOSTS.has(hostname) && !parsed.port))
    ) {
      return parsed.origin;
    }
  } catch {
    // The request schema validates URL syntax; this is a separate, fail-closed host check.
  }
  return null;
}

/**
 * School-owner signup starts on Course360's platform site, not a tenant school.
 * Tenant/custom-domain checkout returns are intentionally supported only for
 * authenticated product billing paths that prove organization membership.
 */
export function parseApprovedPlatformSignupOrigin(
  origin: string,
  configuredPreviewUrl = getConfiguredPreviewUrl()
): string | null {
  const approved = parseApprovedPlatformCheckoutOrigin(
    origin,
    configuredPreviewUrl
  );
  if (!approved) return null;
  const hostname = hostFromUrl(approved);
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
  const isConfiguredPreview = hostname === hostFromUrl(configuredPreviewUrl);
  return hostname && (COURSE360_CHECKOUT_PLATFORM_HOSTS.has(hostname) || isLocalhost || isConfiguredPreview)
    ? approved
    : null;
}

function normalizeConfiguredDomain(
  domain: string | null | undefined
): string | null {
  if (!domain) return null;
  return hostFromUrl(domain.includes("://") ? domain : `https://${domain}`);
}

export function matchesVerifiedMemberCustomDomain(
  hostname: string,
  organizations: Array<{
    customDomain: string | null;
    domainVerificationStatus: string | null;
  }>
): boolean {
  return organizations.some(
    organization =>
      organization.domainVerificationStatus === "verified" &&
      normalizeConfiguredDomain(organization.customDomain) === hostname
  );
}

export async function resolveProductCheckoutReturnOrigin(
  origin: string,
  userId: number,
  userRole = "org_admin"
): Promise<string> {
  const approvedPlatformOrigin = parseApprovedPlatformCheckoutOrigin(origin);
  if (approvedPlatformOrigin) return approvedPlatformOrigin;

  let hostname: string;
  let normalizedOrigin: string;
  try {
    const parsed = new URL(origin);
    if (
      parsed.protocol !== "https:" ||
      parsed.port ||
      parsed.username ||
      parsed.password
    )
      throw new Error("Custom organization origins must use HTTPS");
    hostname = parsed.hostname.toLowerCase();
    normalizedOrigin = parsed.origin;
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Checkout return URL is not permitted" });
  }

  const orgCtx = await getOrgContext(userId, userRole);
  if (
    !orgCtx ||
    !(
      hostname === `${orgCtx.orgSlug}.course360.app` ||
      matchesVerifiedMemberCustomDomain(hostname, [orgCtx])
    )
  ) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Checkout return URL is not permitted" });
  }
  return normalizedOrigin;
}

/** App checkout returns prove the same explicit school; legacy fallback is not authority. */
async function resolveAppCapabilityCheckoutOrigin(origin: string, userId: number): Promise<string> {
  const scope = await requireCourse360AppOrganization(userId);
  const approved = parseApprovedPlatformCheckoutOrigin(origin);
  if (approved) return approved;
  const db = await getDb();
  const { organizations } = await import("../drizzle/schema");
  const [school] = await db.select().from(organizations).where(and(eq(organizations.id, scope.orgId), eq(organizations.isActive, true))).limit(1);
  try {
    const url = new URL(origin);
    if (!school || url.protocol !== "https:" || url.username || url.password || url.port || !(url.hostname === `${school.slug}.course360.app` || matchesVerifiedMemberCustomDomain(url.hostname, [school]))) throw new Error("origin mismatch");
    return url.origin;
  } catch { throw new TRPCError({ code: "BAD_REQUEST", message: "App checkout return URL is not permitted for the selected school." }); }
}
// ─── Helper: get org context for the current user ─────────────────────────────
async function getOrgContext(userId: number, userRole = "org_admin") {
  const { getOrgIdForUserWithFallback } = await import("./db");
  const orgId = await getOrgIdForUserWithFallback(userId, userRole);
  if (!orgId) return null;
  const db = await getDb();
  const { orgMembers, organizations } = await import("../drizzle/schema");
  const rows = await db
    .select({
      orgId: orgMembers.orgId,
      role: orgMembers.role,
      orgName: organizations.name,
      orgSlug: organizations.slug,
      customDomain: organizations.customDomain,
      domainVerificationStatus: organizations.domainVerificationStatus,
    })
    .from(orgMembers)
    .innerJoin(organizations, eq(organizations.id, orgMembers.orgId))
    .where(
      and(
        eq(orgMembers.userId, userId),
        eq(orgMembers.orgId, orgId),
        eq(organizations.isActive, true)
      )
    )
    .limit(1);
  return rows[0] ?? null;
}

async function requireBillingOrg(userId: number, userRole: string) {
  const orgCtx = await getOrgContext(userId, userRole);
  if (!orgCtx || !["org_super_admin", "org_admin"].includes(orgCtx.role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only admins of the active school can manage billing",
    });
  }
  return orgCtx;
}

function assertSchoolSubscription(
  subscription: Stripe.Subscription,
  orgId: number
) {
  if (
    (subscription.metadata.org_id &&
      subscription.metadata.org_id !== String(orgId)) ||
    subscription.metadata.product_type ||
    subscription.metadata.content_type
  ) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Subscription does not belong to this school's platform billing",
    });
  }
}

async function liveSchoolSubscription(orgId: number, subscriptionId: string) {
  const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
  assertSchoolSubscription(subscription, orgId);
  if (isTerminalPlatformSubscription(subscription.status)) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "This subscription has ended. Start a replacement checkout instead.",
    });
  }
  return subscription;
}

// ─── Helper: ensure org payment settings row ──────────────────────────────────
export async function getOrCreateOrgPaymentSettings(orgId: number) {
  const db = await getDb();
  const { orgPaymentSettings } = await import("../drizzle/schema");
  const rows = await db
    .select()
    .from(orgPaymentSettings)
    .where(eq(orgPaymentSettings.orgId, orgId))
    .limit(1);
  if (rows[0]) return rows[0];
  await db.insert(orgPaymentSettings).values({ orgId });
  const newRows = await db
    .select()
    .from(orgPaymentSettings)
    .where(eq(orgPaymentSettings.orgId, orgId))
    .limit(1);
  return newRows[0]!;
}

export const stripeRouter = router({
  ...course360CrossToolProcedures({ signup: parseApprovedPlatformSignupOrigin, existing: resolveAppCapabilityCheckoutOrigin }),
  getPaymentConfiguration: publicProcedure.query(() => {
    const readiness = getPlatformPaymentReadiness();
    return {
      ready: readiness.ready && course360PaymentLedgerReady(),
      ledgerReady: course360PaymentLedgerReady(),
      mode: readiness.secretMode,
      publishableKey: readiness.ready && course360PaymentLedgerReady()
        ? getPlatformStripePublishableKey()
        : null,
    };
  }),
  // ── New school-owner checkout (account and organization are webhook-created) ──
  createPlatformTrialCheckout: publicProcedure
    .input(
      z.object({
        name: z.string().trim().min(1).max(100),
        email: z.string().trim().email().max(320),
        plan: z.enum(["starter", "builder", "pro"]),
        interval: z.enum(["monthly", "annual"]),
        origin: z.string().url(),
        blueprintInstallToken: z.string().min(32).max(255).optional(),
      })
    )
    .mutation(async ({ input }) => {
      if (!getPlatformStripeSecretKey()) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe not configured" });
      }

      const returnOrigin = parseApprovedPlatformSignupOrigin(input.origin);
      if (!returnOrigin) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Checkout return URL is not permitted" });
      }

      const priceKey = `${input.plan}_${input.interval}`;
      const priceId = STRIPE_PRICE_IDS[priceKey];
      if (!priceId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Price not found for ${priceKey}. Stripe plans may not be initialized yet.`,
        });
      }

      const email = input.email.toLowerCase();
      const stripe = getStripe();
      const session = await createCourse360PaymentCheckout({ orgId: null, userId: null, product: "signup", selection: input.plan, interval: input.interval, email, trialEligible: true, params: {
        mode: "subscription",
        payment_method_types: ["card"],
        // A saved card is mandatory even during the $0 introductory period so
        // Stripe can charge the selected plan automatically when it ends.
        payment_method_collection: "always",
        line_items: [{ price: priceId, quantity: 1 }],
        allow_promotion_codes: true,
        customer_email: email,
        metadata: {
          type: "platform_trial_signup",
          signup_name: input.name,
          signup_email: email,
          plan: input.plan,
          interval: input.interval,
          ...(input.blueprintInstallToken ? { blueprint_install_token: input.blueprintInstallToken } : {}),
        },
        subscription_data: {
          trial_period_days: 14,
          metadata: {
            type: "platform_trial_signup",
            signup_email: email,
            plan: input.plan,
            interval: input.interval,
          },
        },
        success_url: `${returnOrigin}/account-setup?checkout=platform_trial&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${returnOrigin}/register?cancelled=1`,
      } }, stripe);

      return { url: session.url };
    }),

  listPaidSchoolClaims: protectedProcedure.query(({ ctx }) => listCourse360PaymentOwnerClaims(ctx.user.id)),
  claimPaidSchool: protectedProcedure.input(z.object({ claimId: z.string().uuid() })).mutation(async ({ ctx, input }) => {
    const orgId = await claimCourse360PaymentSchoolOwner({ claimId: input.claimId, authenticatedUserId: ctx.user.id });
    return { orgId };
  }),

  // ── Get current subscription ───────────────────────────────────────────────
  getSubscription: protectedProcedure.query(async ({ ctx }) => {
    // Platform owners/admins always get enterprise-level access — no subscription needed
    const isPlatformAdmin = ctx.user.role === "site_owner" || ctx.user.role === "site_admin";
    if (isPlatformAdmin) {
      const orgCtx = await getOrgContext(ctx.user.id, ctx.user.role);
      return {
        orgId: orgCtx?.orgId ?? 0,
        orgName: orgCtx?.orgName ?? "Platform",
        plan: "enterprise" as PlanTier,
        limits: PLAN_LIMITS["enterprise"],
        status: "active",
        stripeSubscriptionId: null,
        stripeCustomerId: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        customPriceLabel: "Owner",
        canManageBilling: false,
        canChangeExistingSubscription: false,
        introductoryTrialAvailable: false,
        billingInterval: null as "monthly" | "annual" | null,
        pendingChange: null as {
          plan: string;
          interval: string;
          effectiveAt: Date;
        } | null,
        paymentMode: "unavailable" as "test" | "live" | "unavailable",
      };
    }
    const orgCtx = await getOrgContext(ctx.user.id, ctx.user.role);
    if (!orgCtx) return null;
    const sub = await getOrgSubscription(orgCtx.orgId);
    const plan = sub?.plan ?? "free";
    const limits = PLAN_LIMITS[plan as PlanTier];
    let pendingChange: {
      plan: string;
      interval: string;
      effectiveAt: Date;
    } | null = null;
    let billingInterval: "monthly" | "annual" | null = null;
    let confirmedState: ReturnType<
      typeof confirmedPlatformBillingState
    > | null = null;
    const paymentReadiness = getPlatformPaymentReadiness();
    if (
      sub?.stripeSubscriptionId &&
      getPlatformStripeSecretKey() &&
      (!ENV.isProduction || paymentReadiness.ready)
    ) {
      const live = await getStripe().subscriptions.retrieve(
        sub.stripeSubscriptionId
      );
      assertSchoolSubscription(live, orgCtx.orgId);
      confirmedState = confirmedPlatformBillingState(live);
      billingInterval =
        live.items.data[0]?.price.recurring?.interval === "year"
          ? "annual"
          : "monthly";
      if (live.schedule) {
        const schedule = await getStripe().subscriptionSchedules.retrieve(
          typeof live.schedule === "string" ? live.schedule : live.schedule.id
        );
        if (
          schedule.status === "active" &&
          schedule.metadata?.type === "course360_school_plan_change"
        ) {
          pendingChange = {
            plan: schedule.metadata.pending_plan,
            interval: schedule.metadata.pending_interval,
            effectiveAt: new Date(
              Number(schedule.metadata.effective_at) * 1000
            ),
          };
        }
      }
    }
    return {
      orgId: orgCtx.orgId,
      orgName: orgCtx.orgName,
      plan: plan as PlanTier,
      limits,
      status: confirmedState?.status ?? sub?.status ?? "active",
      stripeSubscriptionId: sub?.stripeSubscriptionId ?? null,
      stripeCustomerId: sub?.stripeCustomerId ?? null,
      currentPeriodEnd: confirmedState
        ? confirmedState.currentPeriodEnd
        : (sub?.currentPeriodEnd ?? null),
      cancelAtPeriodEnd:
        confirmedState?.cancelAtPeriodEnd ?? sub?.cancelAtPeriodEnd ?? false,
      customPriceLabel: sub?.customPriceLabel ?? null,
      canManageBilling: ["org_admin", "org_super_admin"].includes(orgCtx.role),
      canChangeExistingSubscription:
        !!sub?.stripeSubscriptionId &&
        !isTerminalPlatformSubscription(
          confirmedState?.rawStripeStatus ?? sub?.rawStripeStatus ?? sub?.status
        ),
      introductoryTrialAvailable:
        !sub?.stripeSubscriptionId && !sub?.starterTrialClaimed,
      billingInterval,
      pendingChange,
      paymentMode: paymentReadiness.ready
        ? (paymentReadiness.secretMode as "test" | "live")
        : ("unavailable" as const),
    };
  }),

  // ── Create checkout session ────────────────────────────────────────────────
  createCheckoutSession: protectedProcedure
    .input(
      z.object({
        plan: z.enum(["starter", "builder", "pro"]),
        interval: z.enum(["monthly", "annual"]),
        origin: z.string().url(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!getPlatformStripeSecretKey()) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe not configured" });
      }
      const orgCtx = await requireBillingOrg(ctx.user.id, ctx.user.role);
      const returnOrigin = await resolveProductCheckoutReturnOrigin(
        input.origin,
        ctx.user.id,
        ctx.user.role
      );

      const priceKey = `${input.plan}_${input.interval}`;
      const priceId = STRIPE_PRICE_IDS[priceKey];
      if (!priceId) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Price not found for ${priceKey}. Stripe plans may not be initialized yet.`,
        });
      }

      const stripe = getStripe();
      const sub = await getOrgSubscription(orgCtx.orgId);
      if (sub?.stripeSubscriptionId) {
        const existing = await stripe.subscriptions.retrieve(
          sub.stripeSubscriptionId
        );
        assertSchoolSubscription(existing, orgCtx.orgId);
        if (!isTerminalPlatformSubscription(existing.status)) {
          throw new TRPCError({
            code: "CONFLICT",
            message:
              "This school already has a subscription. Use Change Plan or the billing portal.",
          });
        }
      }
      const isIntroductoryTrial = !sub?.stripeSubscriptionId && !sub?.starterTrialClaimed;
      const subscriptionData = {
        ...(isIntroductoryTrial
          ? {
              // Every first paid plan includes a card-backed 14-day trial.
              trial_period_days: 14,
            }
          : {}),
        metadata: {
          org_id: String(orgCtx.orgId),
          plan: input.plan,
          interval: input.interval,
        },
      };

      try {
        const session = await createCourse360PaymentCheckout({
          orgId: orgCtx.orgId, userId: ctx.user.id, product: "platform", selection: input.plan,
          interval: input.interval, previousSubscriptionId: sub?.stripeSubscriptionId,
          customerId: sub?.stripeCustomerId, trialEligible: isIntroductoryTrial,
          params: {
            mode: "subscription", payment_method_types: ["card"], payment_method_collection: "always",
            line_items: [{ price: priceId, quantity: 1 }], allow_promotion_codes: true,
            customer: sub?.stripeCustomerId ?? undefined,
            customer_email: sub?.stripeCustomerId ? undefined : (ctx.user.email ?? undefined),
            client_reference_id: String(ctx.user.id),
            metadata: { user_id: String(ctx.user.id), org_id: String(orgCtx.orgId), plan: input.plan,
              interval: input.interval, customer_email: ctx.user.email ?? "", customer_name: ctx.user.name ?? "" },
            subscription_data: { ...subscriptionData, metadata: { ...subscriptionData.metadata, user_id: String(ctx.user.id) } },
            success_url: `${returnOrigin}/billing?success=1&plan=${input.plan}${isIntroductoryTrial ? "&trial=1" : ""}`,
            cancel_url: `${returnOrigin}/billing?cancelled=1`,
          },
        }, stripe);
        return { url: session.url };
      } catch (error) {
        if (error instanceof Error && /already pending|subscription already|CAS lost/.test(error.message))
          throw new TRPCError({ code: "CONFLICT", message: error.message });
        throw error;
      }
    }),

  // ── Create customer portal session ────────────────────────────────────────
  createPortalSession: protectedProcedure
    .input(z.object({ origin: z.string().url() }))
    .mutation(async ({ ctx, input }) => {
      if (!getPlatformStripeSecretKey()) {
        throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Stripe not configured" });
      }
      const orgCtx = await requireBillingOrg(ctx.user.id, ctx.user.role);
      const sub = await getOrgSubscription(orgCtx.orgId);
      if (!sub?.stripeCustomerId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "No Stripe customer found. Please subscribe first." });
      }
      const stripe = getStripe();
      const returnOrigin = await resolveProductCheckoutReturnOrigin(
        input.origin,
        ctx.user.id,
        ctx.user.role
      );
      const session = await stripe.billingPortal.sessions.create({
        customer: sub.stripeCustomerId,
        return_url: `${returnOrigin}/billing`,
      });
      return { url: session.url };
    }),

  // ── Change plan (upgrade / downgrade with proration) ────────────────────────
  changePlan: protectedProcedure
    .input(
      z.object({
        plan: z.enum(["starter", "builder", "pro"]),
        interval: z.enum(["monthly", "annual"]),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (!getPlatformStripeSecretKey())
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Stripe not configured",
        });
      const orgCtx = await requireBillingOrg(ctx.user.id, ctx.user.role);
      const sub = await getOrgSubscription(orgCtx.orgId);
      if (!sub?.stripeSubscriptionId)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No Stripe subscription found. Please subscribe first.",
        });
      const stripe = getStripe();
      const stripeSub = await liveSchoolSubscription(
        orgCtx.orgId,
        sub.stripeSubscriptionId
      );
      if (stripeSub.metadata?.type === COURSE360_CROSS_TOOL_FAMILY) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Package plan changes require a reviewed package change flow; use billing recovery for payment or cancellation." });
      if (!["active", "trialing"].includes(stripeSub.status)) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Resolve the current subscription's payment status in the billing portal before changing plans.",
        });
      }
      if (stripeSub.cancel_at_period_end)
        throw new TRPCError({
          code: "CONFLICT",
          message: "Reactivate the pending cancellation before changing plans.",
        });
      const priceId = STRIPE_PRICE_IDS[`${input.plan}_${input.interval}`];
      if (!priceId)
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Requested plan price is not configured",
        });
      const currentItem = stripeSub.items.data[0];
      if (
        !currentItem ||
        stripeSub.items.data.length !== 1 ||
        currentItem.quantity !== 1
      ) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Custom subscription items must be managed in the billing portal.",
        });
      }
      const currentPlan =
        currentItem.price.metadata?.teachific_tier ??
        stripeSub.metadata.plan ??
        sub.plan;
      const currentInterval =
        currentItem.price.recurring?.interval === "year" ? "annual" : "monthly";
      if (currentItem.price.id === priceId)
        return {
          success: true,
          isUpgrade: false,
          scheduled: false,
          effectiveAt: null,
          paymentActionRequired: false,
        };
      // Preserve unrelated/manual schedules rather than replacing them silently.
      if (stripeSub.schedule)
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "A billing schedule already exists. Manage it in the billing portal before changing plans.",
        });
      const order: Record<string, number> = { starter: 1, builder: 2, pro: 3 };
      if (!(currentPlan in order))
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This manually configured plan must be managed by support.",
        });
      const isUpgrade = order[input.plan] > order[currentPlan];
      // Any interval switch is deferred, even when paired with a tier increase.
      const deferred = !isUpgrade || currentInterval !== input.interval;
      if (deferred) {
        const periodEnd = currentItem.current_period_end;
        if (!periodEnd || periodEnd <= Math.floor(Date.now() / 1000))
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Current billing period is unavailable. Please use the billing portal.",
          });
        const adopted = await stripe.subscriptionSchedules.create({
          from_subscription: stripeSub.id,
        });
        let updatedSchedule: Stripe.SubscriptionSchedule;
        try {
          const currentPhase =
            adopted.phases.find(
              phase => phase.start_date === adopted.current_phase?.start_date
            ) ?? adopted.phases[0];
          if (!currentPhase)
            throw new Error("Current schedule phase unavailable");
          const preserved = preservedSchoolSchedulePhase(currentPhase);
          updatedSchedule = await stripe.subscriptionSchedules.update(
            adopted.id,
            {
              end_behavior: "release",
              proration_behavior: "none",
              metadata: {
                org_id: String(orgCtx.orgId),
                pending_plan: input.plan,
                pending_interval: input.interval,
                effective_at: String(periodEnd),
                type: "course360_school_plan_change",
              },
              phases: [
                {
                  ...preserved,
                  end_date: periodEnd,
                  metadata: {
                    ...stripeSub.metadata,
                    plan: currentPlan,
                    interval: currentInterval,
                    org_id: String(orgCtx.orgId),
                  },
                  ...(stripeSub.status === "trialing"
                    ? { trial: true, trial_end: undefined }
                    : {}),
                },
                {
                  ...preserved,
                  start_date: periodEnd,
                  end_date: nextSchoolBillingPeriodEnd(
                    periodEnd,
                    input.interval
                  ),
                  trial_end: undefined,
                  trial: false,
                  billing_cycle_anchor: "phase_start",
                  items: [
                    { ...preserved.items[0], price: priceId, quantity: 1 },
                  ],
                  metadata: {
                    ...stripeSub.metadata,
                    plan: input.plan,
                    interval: input.interval,
                    org_id: String(orgCtx.orgId),
                  },
                },
              ],
            }
          );
        } catch (error) {
          // Undo only the schedule we just adopted, preserving the original subscription.
          await stripe.subscriptionSchedules
            .release(adopted.id)
            .catch(() => undefined);
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message:
              "Unable to schedule this plan change safely. Please use the billing portal.",
            cause: error,
          });
        }
        if (updatedSchedule.status !== "active")
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "Stripe did not confirm an active plan-change schedule.",
          });
        return {
          success: true,
          isUpgrade,
          scheduled: true,
          effectiveAt: new Date(periodEnd * 1000),
          paymentActionRequired: false,
        };
      }
      // Fail closed when payment or SCA cannot complete; do not claim an unpaid upgrade.
      const updated = await stripe.subscriptions.update(stripeSub.id, {
        items: [{ id: currentItem.id, price: priceId }],
        payment_behavior: "error_if_incomplete",
        proration_behavior: "always_invoice",
        billing_cycle_anchor: "unchanged",
        metadata: {
          ...stripeSub.metadata,
          org_id: String(orgCtx.orgId),
          plan: input.plan,
          interval: input.interval,
        },
      });
      const confirmedPlan =
        updated.items.data[0]?.price.id === priceId ? input.plan : sub.plan;
      await upsertOrgSubscription(orgCtx.orgId, {
        plan: confirmedPlan,
        ...confirmedPlatformBillingState(updated),
      });
      const paymentActionRequired = !["active", "trialing"].includes(
        updated.status
      );
      return {
        success: !paymentActionRequired,
        isUpgrade,
        scheduled: false,
        effectiveAt: null,
        paymentActionRequired,
      };
    }),

  // ── Cancel subscription (at period end) ──────────────────────────────────────
  cancelSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    if (!getPlatformStripeSecretKey())
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Stripe not configured",
      });
    const orgCtx = await requireBillingOrg(ctx.user.id, ctx.user.role);
    const sub = await getOrgSubscription(orgCtx.orgId);
    if (!sub?.stripeSubscriptionId)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No Stripe subscription found",
      });
    const stripe = getStripe();
    const live = await liveSchoolSubscription(
      orgCtx.orgId,
      sub.stripeSubscriptionId
    );
    if (live.schedule)
      throw new TRPCError({
        code: "CONFLICT",
        message:
          "Manage the existing billing schedule in the billing portal before cancelling.",
      });
    const updated = await stripe.subscriptions.update(live.id, {
      cancel_at_period_end: true,
    });
    const state = confirmedPlatformBillingState(updated);
    await upsertOrgSubscription(orgCtx.orgId, { plan: sub.plan, ...state });
    return {
      success: state.cancelAtPeriodEnd,
      currentPeriodEnd: state.currentPeriodEnd,
    };
  }),

  // ── Reactivate subscription (undo pending cancellation) ──────────────────────
  reactivateSubscription: protectedProcedure.mutation(async ({ ctx }) => {
    if (!getPlatformStripeSecretKey())
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Stripe not configured",
      });
    const orgCtx = await requireBillingOrg(ctx.user.id, ctx.user.role);
    const sub = await getOrgSubscription(orgCtx.orgId);
    if (!sub?.stripeSubscriptionId)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "No Stripe subscription found",
      });
    const stripe = getStripe();
    const live = await liveSchoolSubscription(
      orgCtx.orgId,
      sub.stripeSubscriptionId
    );
    const updated = await stripe.subscriptions.update(live.id, {
      cancel_at_period_end: false,
    });
    const state = confirmedPlatformBillingState(updated);
    await upsertOrgSubscription(orgCtx.orgId, { plan: sub.plan, ...state });
    return {
      success: !state.cancelAtPeriodEnd,
      paymentActionRequired: !["active", "trialing"].includes(updated.status),
    };
  }),

  // ── Subuser: leave org (self-cancel membership) ───────────────────────────────
  leaveOrg: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const { orgMembers } = await import("../drizzle/schema");
      const { eq, and } = await import("drizzle-orm");
      // Verify the user is actually a member (not an admin — admins cannot self-remove)
      const [membership] = await db
        .select()
        .from(orgMembers)
        .where(
          and(
            eq(orgMembers.orgId, input.orgId),
            eq(orgMembers.userId, ctx.user.id)
          )
        )
        .limit(1);
      if (!membership) throw new TRPCError({ code: "NOT_FOUND", message: "Membership not found" });
      if (["org_super_admin", "org_admin"].includes(membership.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Org admins cannot self-remove. Transfer ownership first." });
      }
      await db
        .delete(orgMembers)
        .where(
          and(
            eq(orgMembers.orgId, input.orgId),
            eq(orgMembers.userId, ctx.user.id)
          )
        );
      return { success: true };
    }),

  // ── Get org payment settings ───────────────────────────────────────────────
  getPaymentSettings: protectedProcedure.query(async ({ ctx }) => {
    const orgCtx = await getOrgContext(ctx.user.id, ctx.user.role);
    if (!orgCtx) return null;
    if (!["org_super_admin", "org_admin"].includes(orgCtx.role)) {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    const settings = await getOrCreateOrgPaymentSettings(orgCtx.orgId);
    // Never expose secrets to frontend
    return {
      ...settings,
      stripeSecretKey: settings.stripeSecretKey ? "••••••••••••••••" : null,
      paypalClientSecret: settings.paypalClientSecret ? "••••••••" : null,
    };
  }),

  // ── Update org payment settings ───────────────────────────────────────────
  updatePaymentSettings: protectedProcedure
    .input(
      z.object({
        paypalEmail: z.string().email().optional().nullable(),
        paypalEnabled: z.boolean().optional(),
        paypalClientId: z.string().optional().nullable(),
        paypalClientSecret: z.string().optional().nullable(),
        currency: z.string().length(3).optional(),
        autoEnrollNewMembers: z.boolean().optional(),
        revenueShareJson: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgCtx = await getOrgContext(ctx.user.id, ctx.user.role);
      if (!orgCtx) throw new TRPCError({ code: "FORBIDDEN" });
      if (!["org_super_admin", "org_admin"].includes(orgCtx.role)) {
        throw new TRPCError({ code: "FORBIDDEN" });
      }
      const db = await getDb();
      const { orgPaymentSettings } = await import("../drizzle/schema");
      await getOrCreateOrgPaymentSettings(orgCtx.orgId);
      const updateData: Record<string, unknown> = {};
      if (input.paypalEmail !== undefined) updateData.paypalEmail = input.paypalEmail;
      if (input.paypalEnabled !== undefined) updateData.paypalEnabled = input.paypalEnabled;
      if (input.paypalClientId !== undefined) updateData.paypalClientId = input.paypalClientId;
      if (input.paypalClientSecret !== undefined && input.paypalClientSecret !== "••••••••") {
        updateData.paypalClientSecret = input.paypalClientSecret;
      }
      if (input.currency !== undefined) updateData.currency = input.currency;
      if (input.autoEnrollNewMembers !== undefined) updateData.autoEnrollNewMembers = input.autoEnrollNewMembers;
      if (input.revenueShareJson !== undefined) updateData.revenueShareJson = input.revenueShareJson;
      await db
        .update(orgPaymentSettings)
        .set(updateData as any)
        .where(eq(orgPaymentSettings.orgId, orgCtx.orgId));
      return { success: true };
    }),

  // ── Get org payment settings (by orgId, for org admin) ─────────────────────
  getOrgPaymentSettings: protectedProcedure
    .input(z.object({ orgId: z.number() }))
    .query(async ({ ctx, input }) => {
      const orgCtx = await getOrgContext(ctx.user.id, ctx.user.role);
      if (!orgCtx || orgCtx.orgId !== input.orgId) throw new TRPCError({ code: "FORBIDDEN" });
      if (!["org_super_admin", "org_admin"].includes(orgCtx.role)) throw new TRPCError({ code: "FORBIDDEN" });
      const settings = await getOrCreateOrgPaymentSettings(input.orgId);
      return {
        ...settings,
        stripeSecretKey: settings.stripeSecretKey ? "••••••••••••••••" : null,
        paypalClientSecret: settings.paypalClientSecret ? "••••••••" : null,
        autoEnrollment: settings.autoEnrollNewMembers,
        invoicePrefix: settings.invoicePrefix ?? "",
        nextInvoiceNumber: settings.nextInvoiceNumber ?? 1,
        purchaseDescriptionTemplate: settings.purchaseDescriptionTemplate ?? "",
        purchaseTermsAgreement: settings.purchaseTermsAgreement ?? "",
        purchaseTermsLink1Label: settings.purchaseTermsLink1Label ?? "",
        purchaseTermsLink1Url: settings.purchaseTermsLink1Url ?? "",
        purchaseTermsLink2Label: settings.purchaseTermsLink2Label ?? "",
        purchaseTermsLink2Url: settings.purchaseTermsLink2Url ?? "",
      };
    }),

  // ── Update org payment settings (by orgId, for org admin) ────────────────────
  updateOrgPaymentSettings: protectedProcedure
    .input(
      z.object({
        orgId: z.number(),
        stripePublishableKey: z.string().optional().nullable(),
        stripeSecretKey: z.string().optional().nullable(),
        paypalClientId: z.string().optional().nullable(),
        paypalClientSecret: z.string().optional().nullable(),
        autoEnrollment: z.boolean().optional(),
        autoEnrollCourseIds: z.string().optional(), // JSON array of course IDs
        invoicePrefix: z.string().max(20).optional().nullable(),
        nextInvoiceNumber: z.number().int().min(1).optional(),
        purchaseDescriptionTemplate: z.string().max(255).optional().nullable(),
        // Org-level purchase terms override
        purchaseTermsAgreement: z.string().max(1024).optional().nullable(),
        purchaseTermsLink1Label: z.string().max(255).optional().nullable(),
        purchaseTermsLink1Url: z.string().max(1024).optional().nullable(),
        purchaseTermsLink2Label: z.string().max(255).optional().nullable(),
        purchaseTermsLink2Url: z.string().max(1024).optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const orgCtx = await getOrgContext(ctx.user.id, ctx.user.role);
      if (!orgCtx || orgCtx.orgId !== input.orgId) throw new TRPCError({ code: "FORBIDDEN" });
      if (!["org_super_admin", "org_admin"].includes(orgCtx.role)) throw new TRPCError({ code: "FORBIDDEN" });
      const db = await getDb();
      const { orgPaymentSettings } = await import("../drizzle/schema");
      await getOrCreateOrgPaymentSettings(input.orgId);
      const updateData: Record<string, unknown> = {};
      if (input.stripePublishableKey !== undefined) updateData.stripePublishableKey = input.stripePublishableKey;
      if (input.stripeSecretKey !== undefined && !input.stripeSecretKey?.startsWith("•")) {
        updateData.stripeSecretKey = input.stripeSecretKey;
      }
      if (input.paypalClientId !== undefined) updateData.paypalClientId = input.paypalClientId;
      if (input.paypalClientSecret !== undefined && !input.paypalClientSecret?.startsWith("•")) {
        updateData.paypalClientSecret = input.paypalClientSecret;
      }
      if (input.autoEnrollment !== undefined) updateData.autoEnrollNewMembers = input.autoEnrollment;
      if (input.autoEnrollCourseIds !== undefined) updateData.autoEnrollCourseIds = input.autoEnrollCourseIds;
      if (input.invoicePrefix !== undefined) updateData.invoicePrefix = input.invoicePrefix || null;
      if (input.nextInvoiceNumber !== undefined) updateData.nextInvoiceNumber = input.nextInvoiceNumber;
      if (input.purchaseDescriptionTemplate !== undefined) updateData.purchaseDescriptionTemplate = input.purchaseDescriptionTemplate || null;
      if (input.purchaseTermsAgreement !== undefined) updateData.purchaseTermsAgreement = input.purchaseTermsAgreement || null;
      if (input.purchaseTermsLink1Label !== undefined) updateData.purchaseTermsLink1Label = input.purchaseTermsLink1Label || null;
      if (input.purchaseTermsLink1Url !== undefined) updateData.purchaseTermsLink1Url = input.purchaseTermsLink1Url || null;
      if (input.purchaseTermsLink2Label !== undefined) updateData.purchaseTermsLink2Label = input.purchaseTermsLink2Label || null;
      if (input.purchaseTermsLink2Url !== undefined) updateData.purchaseTermsLink2Url = input.purchaseTermsLink2Url || null;
      if (Object.keys(updateData).length > 0) {
        await db
          .update(orgPaymentSettings)
          .set(updateData as any)
          .where(eq(orgPaymentSettings.orgId, input.orgId));
      }
      return { success: true };
    }),

  // ── Create course/product checkout session (with transaction fee) ──────────
  createCourseCheckout: publicProcedure
    .input(
      z.object({
        productId: z.number(),
        priceId: z.number(),
        buyerEmail: z.string().email(),
        buyerName: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = await getDb();
      const { getDigitalProduct, listProductPrices, createDigitalOrder } = await import("./lmsDb");
      const product = await getDigitalProduct(input.productId);
      if (!product) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Product not found" });
      }

      const { orgPaymentSettings, orgSubscriptions, organizations } = await import("../drizzle/schema");
      const [organization] = await db
        .select({
          slug: organizations.slug,
          customDomain: organizations.customDomain,
          domainVerificationStatus: organizations.domainVerificationStatus,
        })
        .from(organizations)
        .where(eq(organizations.id, product.orgId))
        .limit(1);
      if (!organization) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Organization not found" });
      }

      // Get the purchased product's organization payment settings (organization Stripe key)
      const [paySettings] = await db
        .select()
        .from(orgPaymentSettings)
        .where(eq(orgPaymentSettings.orgId, product.orgId))
        .limit(1);

      if (!paySettings?.stripeSecretKey) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "This organization has not configured Stripe payments.",
        });
      }

      // Get org's Teachific plan to determine transaction fee
      const [orgSub] = await db
        .select()
        .from(orgSubscriptions)
        .where(eq(orgSubscriptions.orgId, product.orgId))
        .limit(1);
      const planTier = (orgSub?.plan ?? "free") as PlanTier;
      const planLimits = PLAN_LIMITS[planTier];
      const feePercent = planLimits.transactionFeePercent; // 0, 1, or 3

      const prices = await listProductPrices(input.productId);
      const price = prices.find(p => p.id === input.priceId);
      if (!price) throw new TRPCError({ code: "NOT_FOUND", message: "Price not found" });

      // Use the org's own Stripe secret key
      const orgStripe = new (await import("stripe")).default(
        paySettings.stripeSecretKey,
        {
          apiVersion: "2025-02-24.acacia" as any,
        }
      );

      const amountCents = Math.round(Number(price.amount) * 100);
      const applicationFeeCents = feePercent > 0 ? Math.round(amountCents * feePercent / 100) : undefined;
      const organizationBaseUrl = getOrgBaseUrl(
        organization.slug,
        organization.customDomain,
        organization.domainVerificationStatus
      );
      const productPath = `/shop/${encodeURIComponent(product.slug)}`;

      // Create a pre-order record so we can link back on webhook
      const order = await createDigitalOrder({
        productId: input.productId,
        priceId: input.priceId,
        orgId: product.orgId,
        buyerEmail: input.buyerEmail,
        buyerName: input.buyerName,
        amount: price.amount,
        currency: price.currency ?? "USD",
        paymentRef: undefined,
        accessExpiresAt: product.defaultAccessDays
          ? new Date(Date.now() + product.defaultAccessDays * 86400000)
          : null,
        maxDownloads: product.defaultMaxDownloads ?? null,
      });

      const session = await orgStripe.checkout.sessions.create({
        mode: "payment",
        customer_email: input.buyerEmail,
        line_items: [
          {
            price_data: {
              currency: (price.currency ?? "USD").toLowerCase(),
              unit_amount: amountCents,
              product_data: {
                name: product.title,
                description: product.description ?? undefined,
                images: product.thumbnailUrl ? [product.thumbnailUrl] : [],
              },
            },
            quantity: 1,
          },
        ],
        ...(applicationFeeCents ? { payment_intent_data: { application_fee_amount: applicationFeeCents } } : {}),
        metadata: {
          teachific_order_id: String(order.id),
          teachific_org_id: String(product.orgId),
          teachific_product_id: String(input.productId),
          teachific_fee_percent: String(feePercent),
          buyer_email: input.buyerEmail,
          buyer_name: input.buyerName ?? "",
        },
        success_url: `${organizationBaseUrl}${productPath}?order_id=${order.id}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${organizationBaseUrl}${productPath}`,
        allow_promotion_codes: true,
      });

      return { checkoutUrl: session.url, orderId: order.id };
    }),

  // ── Get all plan limits (public) ──────────────────────────────────────────
  getPlanLimits: protectedProcedure.query(() => {
    return PLAN_LIMITS;
  }),

  // ── Studio subscription checkout ───────────────────────────────────────
  createStudioCheckout: protectedProcedure
    .input(
      z.object({
        tier: z.enum(["web", "desktop", "bundle"]),
        interval: z.enum(["monthly", "annual"]),
        origin: z.string().url(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const orgCtx = await requireCourse360AppOrganization(ctx.user.id);
      if (!orgCtx)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "An active school membership is required for this purchase",
        });
      const returnOrigin = await resolveAppCapabilityCheckoutOrigin(input.origin, ctx.user.id);
      const stripe = getStripe();
      const priceKey = `studio_${input.tier}_${input.interval}`;
      const priceId = STRIPE_PRICE_IDS[priceKey];
      if (!priceId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Studio price not found. Please try again shortly." });
      const session = await createCourse360PaymentCheckout({ orgId: orgCtx.orgId, userId: ctx.user.id, product: "studio", selection: input.tier, interval: input.interval, trialEligible: await course360PaymentAppTrialEligible(ctx.user.id, "studio"), params: {
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        customer_email: ctx.user.email ?? undefined,
        client_reference_id: String(ctx.user.id),
        metadata: {
          user_id: String(ctx.user.id),
          customer_email: ctx.user.email ?? "",
          customer_name: ctx.user.name ?? "",
          studio_tier: input.tier,
          access_tier: input.tier,
          org_id: String(orgCtx.orgId),
          interval: input.interval,
          product_type: "studio",
        },
        subscription_data: {
          metadata: {
            user_id: String(ctx.user.id),
            org_id: String(orgCtx.orgId),
          interval: input.interval,
            product_type: "studio",
            access_tier: input.tier,
          },
        },
        success_url: `${returnOrigin}/studio?upgraded=1`,
        cancel_url: `${returnOrigin}/studio-pro`,
        allow_promotion_codes: true,
      } }, stripe);
      return { checkoutUrl: session.url };
    }),

  getAppSubscription: protectedProcedure.input(z.object({ product: z.enum(["studio", "creator", "quiz_creator"]), mode: z.enum(["web", "desktop"]).default("web") })).query(async ({ ctx, input }) => {
    const status = await getCourse360AppCapabilityStatus(ctx.user.id, input.product, input.mode);
    return { ...status.access, orgId: status.orgId, platformSupport: status.platformSupport, schoolIncluded: status.schoolIncluded, reason: status.reason };
  }),
  // ── Studio subscription status ────────────────────────────────────────────
  getStudioSubscription: protectedProcedure.query(async ({ ctx }) => {
    const status = await getCourse360AppCapabilityStatus(ctx.user.id, "studio", "web");
    return { ...status.access, orgId: status.orgId, platformSupport: status.platformSupport, schoolIncluded: status.schoolIncluded, reason: status.reason };
  }),

  // ── Admin: list all Studio users ────────────────────────────────────────
  adminListStudioUsers: adminProcedure.query(async () => {
    const db = await getDb();
    const { users } = await import("../drizzle/schema");
    const allUsers = await db.select({
      id: users.id,
      name: users.name,
      email: users.email,
      studioAccess: users.studioAccess,
      studioTrialEndsAt: users.studioTrialEndsAt,
      createdAt: users.createdAt,
    }).from(users).orderBy(users.createdAt);
    return allUsers.map(u => ({
      ...u,
      studioAccess: (u.studioAccess ?? "none") as "none" | "web" | "desktop" | "bundle",
    }));
  }),
  // ── Admin: set a user's Studio role ──────────────────────────────────────
  adminSetStudioRole: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        role: z.enum(["none", "web", "desktop", "bundle"]),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const org = await requireCourse360AppOrganization(ctx.user.id);
      if (!org) throw new TRPCError({ code: "FORBIDDEN", message: "Select an active school for manual grants" });
      await setCourse360PaymentManualRole({ orgId: org.orgId, userId: input.userId, product: "studio", tier: input.role,
        actorId: ctx.user.id, source: "platform-admin", reason: "Explicit authenticated administrator grant", expiresAt: null });
      return { success: true };
    }),
  // ── Admin: list all Creator users ─────────────────────────────────────────
  adminListCreatorUsers: adminProcedure.query(async () => {
    const db = await getDb();
    const { users } = await import("../drizzle/schema");
    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        creatorAccess: users.creatorAccess,
        creatorTrialEndsAt: users.creatorTrialEndsAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(users.createdAt);
    return allUsers.map(u => ({
      ...u,
      creatorAccess: (u.creatorAccess ?? "none") as
        | "none"
        | "web"
        | "desktop"
        | "bundle",
    }));
  }),
  // ── Admin: set a user's Creator role ─────────────────────────────────────
  adminSetCreatorRole: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        role: z.enum(["none", "web", "desktop", "bundle"]),
        trialDays: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const org = await requireCourse360AppOrganization(ctx.user.id);
      if (!org) throw new TRPCError({ code: "FORBIDDEN", message: "Select an active school for manual grants" });
      await setCourse360PaymentManualRole({ orgId: org.orgId, userId: input.userId, product: "creator", tier: input.role,
        actorId: ctx.user.id, source: "platform-admin", reason: "Explicit authenticated administrator grant", expiresAt: input.trialDays ? new Date(Date.now() + (input.trialDays ?? 0) * 86400000) : null });
      return { success: true };
    }),
  // ── Admin: list all QuizMaker users ────────────────────────────────────
  adminListQuizCreatorUsers: adminProcedure.query(async () => {
    const db = await getDb();
    const { users } = await import("../drizzle/schema");
    const allUsers = await db
      .select({
        id: users.id,
        name: users.name,
        email: users.email,
        quizCreatorAccess: users.quizCreatorAccess,
        quizCreatorTrialEndsAt: users.quizCreatorTrialEndsAt,
        createdAt: users.createdAt,
      })
      .from(users)
      .orderBy(users.createdAt);
    return allUsers.map(u => ({
      ...u,
      quizCreatorAccess: (u.quizCreatorAccess ?? "none") as
        | "none"
        | "web"
        | "desktop"
        | "bundle",
    }));
  }),
  // ── Admin: set a user's QuizMaker role ─────────────────────────────────
  adminSetQuizCreatorRole: adminProcedure
    .input(
      z.object({
        userId: z.number(),
        role: z.enum(["none", "web", "desktop", "bundle"]),
        trialDays: z.number().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const org = await requireCourse360AppOrganization(ctx.user.id);
      if (!org) throw new TRPCError({ code: "FORBIDDEN", message: "Select an active school for manual grants" });
      await setCourse360PaymentManualRole({ orgId: org.orgId, userId: input.userId, product: "quiz_creator", tier: input.role,
        actorId: ctx.user.id, source: "platform-admin", reason: "Explicit authenticated administrator grant", expiresAt: input.trialDays ? new Date(Date.now() + (input.trialDays ?? 0) * 86400000) : null });
      return { success: true };
    }),
  // ── Admin: update Studio trial end date ──────────────────────────────────
  adminSetStudioTrial: adminProcedure
    .input(z.object({ userId: z.number(), trialDays: z.number().optional() }))
    .mutation(async ({ input, ctx }) => {
      const org = await requireCourse360AppOrganization(ctx.user.id);
      if (!org) throw new TRPCError({ code: "FORBIDDEN" });
      const access = await getCourse360PaymentAppAccess(org.orgId, input.userId, "studio");
      if (!access.hasManualGrant || access.tier === "none") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Choose an explicit school-bound manual role before setting its expiry" });
      await setCourse360PaymentManualRole({ orgId: org.orgId, userId: input.userId, product: "studio", tier: access.tier,
        actorId: ctx.user.id, source: "platform-admin", reason: "Administrator manual grant expiry", expiresAt: input.trialDays ? new Date(Date.now() + input.trialDays * 86400000) : null });
      return { success: true };
    }),
  // ── Course360 Creator™ checkout (Web / Desktop / Bundle) ─────────────────────────
  createCreatorSingleCheckout: protectedProcedure
    .input(
      z.object({
        interval: z.enum(["monthly", "annual"]),
        accessTier: z.enum(["web", "desktop", "bundle"]).default("desktop"),
        origin: z.string().url(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const orgCtx = await requireCourse360AppOrganization(ctx.user.id);
      if (!orgCtx)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "An active school membership is required for this purchase",
        });
      const stripe = getStripe();
      const returnOrigin = await resolveAppCapabilityCheckoutOrigin(input.origin, ctx.user.id);
      const priceKey = `creator_${input.accessTier}_${input.interval}`;
      const priceId = STRIPE_PRICE_IDS[priceKey];
      if (!priceId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Course360™ Creator price not found. Please try again shortly." });
      const session = await createCourse360PaymentCheckout({ orgId: orgCtx.orgId, userId: ctx.user.id, product: "creator", selection: input.accessTier, interval: input.interval, trialEligible: await course360PaymentAppTrialEligible(ctx.user.id, "creator"), params: {
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        customer_email: ctx.user.email ?? undefined,
        client_reference_id: String(ctx.user.id),
        allow_promotion_codes: true,
        metadata: {
          user_id: String(ctx.user.id),
          org_id: String(orgCtx.orgId),
          interval: input.interval,
          customer_email: ctx.user.email ?? "",
          customer_name: ctx.user.name ?? "",
          product_type: "creator",
          access_tier: input.accessTier,
        },
        subscription_data: {
          trial_period_days: 14,
          metadata: {
            user_id: String(ctx.user.id),
            org_id: String(orgCtx.orgId),
          interval: input.interval,
            product_type: "creator",
            access_tier: input.accessTier,
          },
        },
        success_url: `${returnOrigin}/creator?upgraded=1`,
        cancel_url: `${returnOrigin}/creator-pro`,
      } }, stripe);
      return { checkoutUrl: session.url };
    }),

  // ── Course360 Studio™ checkout (Web / Desktop / Bundle) ───────────────────────────
  createStudioSingleCheckout: protectedProcedure
    .input(
      z.object({
        interval: z.enum(["monthly", "annual"]),
        accessTier: z.enum(["web", "desktop", "bundle"]).default("desktop"),
        origin: z.string().url(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const orgCtx = await requireCourse360AppOrganization(ctx.user.id);
      if (!orgCtx)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "An active school membership is required for this purchase",
        });
      const stripe = getStripe();
      const returnOrigin = await resolveAppCapabilityCheckoutOrigin(input.origin, ctx.user.id);
      const priceKey = `studio_${input.accessTier}_${input.interval}`;
      const priceId = STRIPE_PRICE_IDS[priceKey];
      if (!priceId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Course360™ Studio price not found. Please try again shortly." });
      const session = await createCourse360PaymentCheckout({ orgId: orgCtx.orgId, userId: ctx.user.id, product: "studio", selection: input.accessTier, interval: input.interval, trialEligible: await course360PaymentAppTrialEligible(ctx.user.id, "studio"), params: {
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        customer_email: ctx.user.email ?? undefined,
        client_reference_id: String(ctx.user.id),
        allow_promotion_codes: true,
        metadata: {
          user_id: String(ctx.user.id),
          org_id: String(orgCtx.orgId),
          interval: input.interval,
          customer_email: ctx.user.email ?? "",
          customer_name: ctx.user.name ?? "",
          product_type: "studio",
          access_tier: input.accessTier,
        },
        subscription_data: {
          trial_period_days: 14,
          metadata: {
            user_id: String(ctx.user.id),
            org_id: String(orgCtx.orgId),
          interval: input.interval,
            product_type: "studio",
            access_tier: input.accessTier,
          },
        },
        success_url: `${returnOrigin}/studio?upgraded=1`,
        cancel_url: `${returnOrigin}/studio-pro`,
      } }, stripe);
      return { checkoutUrl: session.url };
    }),

  // ── Course360 Quiz Creator™ checkout (Web / Desktop / Bundle) ─────────────────────
  createQuizCreatorCheckout: protectedProcedure
    .input(
      z.object({
        interval: z.enum(["monthly", "annual"]),
        accessTier: z.enum(["web", "desktop", "bundle"]).default("desktop"),
        origin: z.string().url(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const orgCtx = await requireCourse360AppOrganization(ctx.user.id);
      if (!orgCtx)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "An active school membership is required for this purchase",
        });
      const stripe = getStripe();
      const returnOrigin = await resolveAppCapabilityCheckoutOrigin(input.origin, ctx.user.id);
      const priceKey = `quiz_creator_${input.accessTier}_${input.interval}`;
      const priceId = STRIPE_PRICE_IDS[priceKey];
      if (!priceId) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Course360™ Quiz Creator price not found. Please try again shortly." });
      const session = await createCourse360PaymentCheckout({ orgId: orgCtx.orgId, userId: ctx.user.id, product: "quiz_creator", selection: input.accessTier, interval: input.interval, trialEligible: await course360PaymentAppTrialEligible(ctx.user.id, "quiz_creator"), params: {
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        customer_email: ctx.user.email ?? undefined,
        client_reference_id: String(ctx.user.id),
        allow_promotion_codes: true,
        metadata: {
          user_id: String(ctx.user.id),
          org_id: String(orgCtx.orgId),
          interval: input.interval,
          customer_email: ctx.user.email ?? "",
          customer_name: ctx.user.name ?? "",
          product_type: "quiz_creator",
          access_tier: input.accessTier,
        },
        subscription_data: {
          trial_period_days: 14,
          metadata: {
            user_id: String(ctx.user.id),
            org_id: String(orgCtx.orgId),
          interval: input.interval,
            product_type: "quiz_creator",
            access_tier: input.accessTier,
          },
        },
        success_url: `${returnOrigin}/quiz-creator?upgraded=1`,
        cancel_url: `${returnOrigin}/quiz-creator-pro`,
      } }, stripe);
      return { checkoutUrl: session.url };
     }),

  // ── Enterprise contact-sales inquiry ─────────────────────────────────────────────
  contactEnterprise: protectedProcedure
    .input(
      z.object({
        orgId: z.number(),
        orgName: z.string(),
        contactName: z.string(),
        contactEmail: z.string().email(),
        teamSize: z.string().optional(),
        message: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const orgCtx = await requireBillingOrg(ctx.user.id, ctx.user.role);
      if (input.orgId !== orgCtx.orgId)
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Inquiry must belong to the active school",
        });
      const { notifyOwner } = await import("./_core/notification");
      const content = [
        "**Enterprise Plan Inquiry**",
        "",
        `**Organization:** ${orgCtx.orgName} (ID: ${orgCtx.orgId})`,
        `**Contact:** ${input.contactName} <${input.contactEmail}>`,
        `**Team Size:** ${input.teamSize ?? "Not specified"}`,
        `**Message:** ${input.message ?? "No message provided"}`,
        "",
        `Submitted by user ID: ${ctx.user.id}`,
      ].join("\n");
      await notifyOwner({
        title: `Enterprise Inquiry: ${orgCtx.orgName}`,
        content,
      });
      return { success: true };
    }),

  // ── Get all product subscriptions for the current user (cross-product nav) ─────────
  getAllSubscriptions: protectedProcedure.query(async ({ ctx }) => {
    const [studio, creator, quizCreator] = await Promise.all([
      getCourse360AppCapabilityStatus(ctx.user.id, "studio", "web"),
      getCourse360AppCapabilityStatus(ctx.user.id, "creator", "web"),
      getCourse360AppCapabilityStatus(ctx.user.id, "quiz_creator", "web"),
    ]);
    const orgId = studio.orgId;
    let lmsPlan = "free", lmsIsActive = false;
    if (orgId) {
      const { orgSubscriptions } = await import("../drizzle/schema");
      const db = await getDb();
      const [sub] = await db.select().from(orgSubscriptions).where(eq(orgSubscriptions.orgId, orgId)).limit(1);
      lmsPlan = sub?.plan ?? "free";
      lmsIsActive = !!sub && (sub.status === "trialing" ? !!sub.trialEndsAt && sub.trialEndsAt > new Date() : sub.status === "active" && (!sub.stripeSubscriptionId || !!sub.currentPeriodEnd && sub.currentPeriodEnd > new Date()));
    }
    const surface = (s: typeof studio) => ({ ...s.access, orgId: s.orgId, platformSupport: s.platformSupport, schoolIncluded: s.schoolIncluded });
    return { lms: { plan: lmsPlan, isActive: lmsIsActive }, studio: surface(studio), creator: surface(creator), quizCreator: surface(quizCreator) };
  }),

  // App recovery uses exact app-ledger customer/subscription, never school billing.
  getAppBillingRecovery: protectedProcedure.input(z.object({ product: z.enum(["studio", "creator", "quiz_creator"]) })).query(async ({ ctx, input }) => {
    const rows = await getCourse360AppBillingRecords(ctx.user.id, input.product);
    return { subscriptions: rows.map(r => ({ subscriptionId: r.subscriptionId, tier: r.tier, status: r.rawStatus, cancelAtPeriodEnd: r.cancelAtPeriodEnd, currentPeriodEnd: r.currentPeriodEnd, trialEndsAt: r.trialEnd })), hasBillingCustomer: rows.length > 0 };
  }),
  createAppPortalSession: protectedProcedure.input(z.object({ product: z.enum(["studio", "creator", "quiz_creator"]), subscriptionId: z.string().optional(), returnUrl: z.string().url() })).mutation(async ({ ctx, input }) => {
    const rows = await getCourse360AppBillingRecords(ctx.user.id, input.product);
    const candidates = input.subscriptionId ? rows.filter(r => r.subscriptionId === input.subscriptionId) : rows;
    if (candidates.length !== 1) throw new TRPCError({ code: "PRECONDITION_FAILED", message: candidates.length ? "Choose the app subscription to manage." : "No app billing subscription is available in the selected school." });
    const row = candidates[0];
    const origin = await resolveAppCapabilityCheckoutOrigin(input.returnUrl, ctx.user.id);
    const stripe = getStripe();
    const live = await stripe.subscriptions.retrieve(row.subscriptionId);
    const customer = typeof live.customer === "string" ? live.customer : live.customer.id;
    const packageRecovery = live.metadata?.type === COURSE360_CROSS_TOOL_FAMILY && input.product === "creator" && await assertCourse360CrossToolRecovery(await getCourse360PaymentDb(), row, live);
    if (customer !== row.customerId || live.id !== row.subscriptionId || live.livemode !== row.livemode || (!packageRecovery && (live.metadata?.product_type !== input.product || live.metadata?.org_id !== String(row.orgId) || live.metadata?.user_id !== String(ctx.user.id)))) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "App billing identity needs support reconciliation." });
    const session = await stripe.billingPortal.sessions.create({ customer: row.customerId, return_url: `${origin}${input.product === "quiz_creator" ? "/quiz-creator-app/billing" : `/${input.product}/billing`}` });
    return { url: session.url };
  }),

  // ── Desktop app download URLs (subscription-gated) ─────────────────────────
  getDesktopDownloads: protectedProcedure
    .input(z.object({ app: z.enum(["creator", "studio", "quizCreator"]) }))
    .query(async ({ ctx, input }) => {
      const product = input.app === "quizCreator" ? "quiz_creator" : input.app;
      const capability = await requireCourse360AppCapability(ctx.user.id, product, "desktop");
      const db = await getDb();
      const dbProduct = input.app === "quizCreator" ? "quizcreator" : input.app;
      const { appVersions } = await import("../drizzle/schema");
      const [latestRow] = await db.select().from(appVersions).where(and(eq(appVersions.product, dbProduct), eq(appVersions.isLatest, true))).limit(1);
      const windows = course360DesktopArtifactUrl(latestRow?.windowsUrl);
      const mac = course360DesktopArtifactUrl(latestRow?.macUrl);
      return { hasAccess: true, orgId: capability.orgId, app: input.app, version: latestRow?.version ?? null, windows, mac, releasePage: null,
        readiness: !latestRow ? "not_configured" as const : windows || mac ? "metadata_available" as const : "artifact_unavailable" as const,
        artifactVerified: false, releaseNotes: latestRow?.releaseNotes ?? null };
    }),

  // ── Platform Admin: Stripe integration status ─────────────────
  getStripeStatus: adminProcedure.query(async () => {
    const isConfigured = !!getPlatformStripeSecretKey();
    const hasWebhookSecret = !!ENV.stripeWebhookSecret;
    const publishableKeyPrefix = ENV.stripePublishableKey
      ? ENV.stripePublishableKey.slice(0, 14) + "..."
      : null;
    const isTestMode = ENV.stripeSecretKey?.startsWith("sk_test_") ?? false;
    const priceCount = Object.keys(STRIPE_PRICE_IDS).length;
    const priceIds = Object.entries(STRIPE_PRICE_IDS).map(([key, id]) => ({ key, id }));
    return {
      isConfigured,
      isTestMode,
      hasWebhookSecret,
      publishableKeyPrefix,
      priceCount,
      priceIds,
      claimUrl: isTestMode ? "https://dashboard.stripe.com/claim_sandbox/YWNjdF8xVElITmQ1NEtpeUUwbExZLDE3NzU5MjQwNTEv100hEZaCvIU" : null,
    };
  }),
});
