import { hasUsableSubscriptionStatus } from "../../shared/subscriptionEntitlement";

export const AI_COURSE_GENERATOR_TIERS = ["starter", "builder", "pro", "enterprise"] as const;

/** Complete curriculum generation is a paid-organization feature, including an active Starter trial. */
export function canUseAiCourseGenerator(
  plan: string | null | undefined,
  status: string | null | undefined,
): boolean {
  return (
    (AI_COURSE_GENERATOR_TIERS as readonly string[]).includes(plan ?? "free")
    && hasUsableSubscriptionStatus(status)
  );
}
