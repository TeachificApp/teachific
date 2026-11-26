import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure } from "./_core/trpc";
import { COURSE360_CROSS_TOOL_OFFERS } from "../shared/course360CrossToolOffers";
import {
  COURSE360_CROSS_TOOL_FAMILY,
  getCourse360CrossToolCatalog,
  course360CrossToolConfiguredPrice,
} from "./lib/course360CrossToolCatalog";
import { requireCourse360AppOrganization } from "./lib/course360AppCapabilities";
import { createCourse360PaymentCheckout } from "./lib/course360PaymentLedger";
import { getOrgSubscription } from "./lmsDb";
import { getStripe } from "./stripePlans";

const common = {
  offer: z.enum(["builder_creator_web", "pro_creator_web"]),
  interval: z.enum(["monthly", "annual"]),
  origin: z.string().url(),
};
export const course360CrossToolCheckoutInput = z.discriminatedUnion("target", [
  z
    .object({
      ...common,
      target: z.literal("new_school"),
      name: z.string().trim().min(1).max(100),
      email: z.string().trim().email().max(320),
    })
    .strict(),
  z
    .object({
      ...common,
      target: z.literal("existing_school"),
      orgId: z.number().int().positive().optional(),
    })
    .strict(),
]);
/** Mount additively in the existing billing/stripe namespace. Origin policy supplied by that router. */
export function course360CrossToolProcedures(origins: {
  signup: (origin: string) => string | null;
  existing: (origin: string, userId: number) => Promise<string>;
}) {
  return {
    getCrossToolOffers: publicProcedure.query(() =>
      getCourse360CrossToolCatalog()
    ),
    createCrossToolCheckout: publicProcedure
      .input(course360CrossToolCheckoutInput)
      .mutation(async ({ ctx, input }) => {
        let orgId: number | null = null,
          userId: number | null = null;
        let previousSubscriptionId: string | null = null,
          customerId: string | null = null;
        let email: string | undefined,
          name: string | undefined,
          origin: string,
          trialEligible = true;
        if (input.target === "new_school") {
          const allowed = origins.signup(input.origin);
          if (!allowed)
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Checkout return URL is not permitted.",
            });
          origin = allowed;
          email = input.email.toLowerCase();
          name = input.name;
        } else {
          if (!ctx.user)
            throw new TRPCError({
              code: "UNAUTHORIZED",
              message: "Sign in before managing an existing school.",
            });
          const selected = await requireCourse360AppOrganization(
            ctx.user.id,
            input.orgId
          );
          // Support bypass is NOT purchased authority; only persisted exact-school billing membership qualifies.
          if (
            !selected.member ||
            !["org_super_admin", "org_admin"].includes(selected.member.role)
          )
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Only admins of the selected school can buy a package.",
            });
          orgId = selected.orgId;
          userId = ctx.user.id;
          origin = await origins.existing(input.origin, userId);
          const saved = await getOrgSubscription(orgId);
          previousSubscriptionId = saved?.stripeSubscriptionId ?? null;
          customerId = saved?.stripeCustomerId ?? null;
          if (
            saved &&
            (previousSubscriptionId
              ? !["canceled", "cancelled", "incomplete_expired"].includes(
                  saved.rawStripeStatus ?? saved.status
                )
              : saved.plan !== "free")
          )
            throw new TRPCError({
              code: "CONFLICT",
              message:
                "This school already has a paid plan. A reviewed package change is required.",
            });
          if (previousSubscriptionId) {
            const live = await getStripe().subscriptions.retrieve(
              previousSubscriptionId
            );
            if (
              live.metadata?.org_id !== String(orgId) ||
              !["canceled", "incomplete_expired"].includes(live.status)
            )
              throw new TRPCError({
                code: "CONFLICT",
                message:
                  "Existing subscription overlap must be resolved before package checkout.",
              });
          }
          trialEligible =
            !previousSubscriptionId && !saved?.starterTrialClaimed;
          email = ctx.user.email ?? undefined;
          name = ctx.user.name ?? undefined;
        }
        const readiness = await getCourse360CrossToolCatalog();
        if (!readiness.ready)
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: readiness.reason ?? "Package checkout is not ready.",
          });
        const plan = COURSE360_CROSS_TOOL_OFFERS[input.offer].schoolPlan;
        const metadata = {
          type: COURSE360_CROSS_TOOL_FAMILY,
          cross_tool_offer: input.offer,
          plan,
          creator_mode: "web",
          interval: input.interval,
          ...(orgId && userId
            ? { org_id: String(orgId), user_id: String(userId) }
            : { signup_email: email!, signup_name: name! }),
        };
        try {
          const session = await createCourse360PaymentCheckout(
            {
              orgId,
              userId,
              product: orgId ? "platform" : "signup",
              selection: plan,
              interval: input.interval,
              email,
              previousSubscriptionId,
              customerId,
              trialEligible,
              params: {
                mode: "subscription",
                payment_method_types: ["card"],
                payment_method_collection: "always",
                line_items: [
                  {
                    price: course360CrossToolConfiguredPrice(
                      input.offer,
                      input.interval
                    ),
                    quantity: 1,
                  },
                ],
                customer: customerId ?? undefined,
                customer_email: customerId ? undefined : email,
                metadata,
                subscription_data: { trial_period_days: 14, metadata },
                // Packages have their own exact price. No coupons, discounts, or standalone item additions.
                allow_promotion_codes: false,
                success_url: orgId
                  ? `${origin}/billing?cross_tool=success`
                  : `${origin}/account-setup?checkout=platform_trial&session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: orgId
                  ? `${origin}/billing?cancelled=1`
                  : `${origin}/register?cancelled=1`,
              },
            },
            getStripe()
          );
          return { url: session.url! };
        } catch (error) {
          if (
            error instanceof Error &&
            /overlap|already pending|already exists|Historical Creator|CAS lost|reviewed change/.test(
              error.message
            )
          )
            throw new TRPCError({ code: "CONFLICT", message: error.message });
          throw error;
        }
      }),
  };
}
