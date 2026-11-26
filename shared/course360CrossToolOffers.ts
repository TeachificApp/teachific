/** Owner-approved Run Your School + Create Content family. Canonical USD dollars. */
export const COURSE360_CROSS_TOOL_OFFERS = {
  builder_creator_web: {
    name: "Course360 Builder + Creator Web",
    monthly: 169.97,
    annual: 1599.97,
    schoolPlan: "builder",
    creatorMode: "web",
  },
  pro_creator_web: {
    name: "Course360 Pro + Creator Web",
    monthly: 249.97,
    annual: 2497.0,
    schoolPlan: "pro",
    creatorMode: "web",
  },
} as const;

export type Course360CrossToolOfferKey =
  keyof typeof COURSE360_CROSS_TOOL_OFFERS;
export type Course360CrossToolInterval = "monthly" | "annual";
