export const MOCK_EXAM_PLAN_TIERS = ["pro", "enterprise"] as const;

/** Mock exams are an organization-level Pro-or-higher delivery capability. */
export function canUseMockExams(plan: string | null | undefined): boolean {
  return (MOCK_EXAM_PLAN_TIERS as readonly string[]).includes(plan ?? "free");
}

/** A paid organization may deliver mock exams only while its subscription remains usable. */
export function canUseMockExamSubscription(
  plan: string | null | undefined,
  status: string | null | undefined,
): boolean {
  return canUseMockExams(plan) && ["active", "trialing"].includes(status ?? "");
}
