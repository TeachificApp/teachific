import { hasUsableSubscriptionStatus } from "../../shared/subscriptionEntitlement";

export const EMAIL_CAMPAIGN_AB_TEST_TIERS = ["pro", "enterprise"] as const;

/** A/B campaign delivery is an organization-level Pro-or-higher capability. */
export function canUseEmailCampaignAbTests(
  plan: string | null | undefined,
  status: string | null | undefined,
): boolean {
  return (
    (EMAIL_CAMPAIGN_AB_TEST_TIERS as readonly string[]).includes(plan ?? "free")
    && hasUsableSubscriptionStatus(status)
  );
}
