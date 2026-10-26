import { TRPCError } from "@trpc/server";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { lmsCourses, lmsEnrollments, quizzes } from "../../drizzle/schema";

/**
 * Landing-page embeds are stored as authoring JSON, but public delivery must
 * always resolve a fresh, organization-scoped record. These helpers deliberately
 * keep presentation configuration separate from resource authorization.
 */
const MAX_LANDING_BLOCKS = 160;
const MAX_LANDING_NESTING = 4;
const PUBLIC_QUIZ_VISIBILITIES = new Set(["published", "hidden"]);

type LandingBlock = {
  id?: unknown;
  type?: unknown;
  data?: unknown;
};

type LandingBlockRecord = {
  id: string;
  type: string;
  data: Record<string, unknown>;
};

type PublicOrganizationUrl = {
  slug: string;
  customDomain?: string | null;
  domainVerificationStatus?: string | null;
};

export type PublicLandingEmbeddedResources = {
  courses: Record<string, {
    title: string;
    description: string | null;
    coverImageUrl: string | null;
    price: string | number;
    isFree: boolean;
    pricingType: string;
    courseUrl: string;
  }>;
  courseCards: Record<string, Array<{
    title: string;
    description: string | null;
    coverImageUrl: string | null;
    price: string | number;
    isFree: boolean;
    pricingType: string;
    courseUrl: string;
  }>>;
  quizzes: Record<string, {
    title: string;
    description: string | null;
    questionCount: number;
    passingScore: number;
    quizUrl: string;
  }>;
  socialProof: Record<string, {
    enrollmentCount: number;
    activityStyle: "enrolling" | "learning";
  }>;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function asNonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function asPositiveId(value: unknown): number | null {
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isSafeInteger(numeric) && numeric > 0 ? numeric : null;
}

function isPublicQuizDeliveryVisible(visibility: unknown): boolean {
  return PUBLIC_QUIZ_VISIBILITIES.has(typeof visibility === "string" ? visibility : "published");
}

function buildOrganizationBaseUrl(organization: PublicOrganizationUrl): string {
  if (organization.customDomain && organization.domainVerificationStatus === "verified") {
    return organization.customDomain.match(/^https?:\/\//)
      ? organization.customDomain.replace(/\/$/, "")
      : `https://${organization.customDomain}`;
  }
  return `https://${organization.slug}.course360.app`;
}

function publicCourseUrl(organization: PublicOrganizationUrl, slug: string): string {
  return `${buildOrganizationBaseUrl(organization)}/courses/${encodeURIComponent(slug)}`;
}

function publicQuizUrl(organization: PublicOrganizationUrl, shareToken: string): string {
  return `${buildOrganizationBaseUrl(organization)}/quiz/${encodeURIComponent(shareToken)}`;
}

function visitLandingBlocks(
  blocks: unknown,
  visitor: (block: LandingBlockRecord) => void,
  depth = 0,
): void {
  if (!Array.isArray(blocks)) return;
  if (depth > MAX_LANDING_NESTING) return;
  for (const rawBlock of blocks) {
    const block = asRecord(rawBlock);
    const data = asRecord(block?.data);
    const id = asNonEmptyString(block?.id);
    const type = asNonEmptyString(block?.type);
    if (!block || !data || !id || !type) continue;
    const normalized = { id, type, data };
    visitor(normalized);
    if (type === "column_layout") {
      visitLandingBlocks(data.leftBlocks, visitor, depth + 1);
      visitLandingBlocks(data.rightBlocks, visitor, depth + 1);
    }
  }
}

function assertLandingBlocksAreBounded(blocks: unknown, depth = 0): asserts blocks is LandingBlock[] {
  if (!Array.isArray(blocks)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Landing pages must contain a block array." });
  }
  if (blocks.length > MAX_LANDING_BLOCKS) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "This landing page has too many blocks." });
  }
  if (depth > MAX_LANDING_NESTING) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Landing page columns cannot be nested this deeply." });
  }
  for (const rawBlock of blocks) {
    const block = asRecord(rawBlock);
    if (!block || !asNonEmptyString(block.type) || !asRecord(block.data)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Each landing block needs an id, type, and data object." });
    }
    if (block.type === "column_layout") {
      const data = block.data as Record<string, unknown>;
      if (data.leftBlocks !== undefined) assertLandingBlocksAreBounded(data.leftBlocks, depth + 1);
      if (data.rightBlocks !== undefined) assertLandingBlocksAreBounded(data.rightBlocks, depth + 1);
    }
  }
}

function getCourseReference(data: Record<string, unknown>, context: string) {
  const courseId = data.courseId === null || data.courseId === undefined ? null : asPositiveId(data.courseId);
  const courseSlug = data.courseSlug === null || data.courseSlug === undefined ? null : asNonEmptyString(data.courseSlug);
  if ((data.courseId !== null && data.courseId !== undefined && !courseId) ||
      (data.courseSlug !== null && data.courseSlug !== undefined && !courseSlug)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `${context} has an invalid course reference.` });
  }
  return { courseId, courseSlug };
}

async function assertPublicCourseReference(
  db: any,
  organizationId: number,
  reference: { courseId: number | null; courseSlug: string | null },
  context: string,
): Promise<void> {
  if (!reference.courseId && !reference.courseSlug) return;
  const whereCondition = reference.courseId
    ? eq(lmsCourses.id, reference.courseId)
    : eq(lmsCourses.slug, reference.courseSlug!);
  const [target] = await db.select({
    id: lmsCourses.id,
    orgId: lmsCourses.orgId,
    slug: lmsCourses.slug,
    type: lmsCourses.type,
    status: lmsCourses.status,
  }).from(lmsCourses).where(whereCondition).limit(1);
  if (!target) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `${context} references a course that no longer exists.` });
  }
  if (target.orgId !== organizationId) {
    throw new TRPCError({ code: "FORBIDDEN", message: `${context} must reference a course in this organization.` });
  }
  if (reference.courseSlug && target.slug !== reference.courseSlug) {
    throw new TRPCError({ code: "BAD_REQUEST", message: `${context} has mismatched course id and slug values.` });
  }
  if (target.type !== "course" || target.status !== "public") {
    throw new TRPCError({ code: "BAD_REQUEST", message: `${context} must reference a public course.` });
  }
}

async function assertPublicQuizReference(
  db: any,
  organizationId: number,
  rawQuizId: unknown,
): Promise<void> {
  if (rawQuizId === null || rawQuizId === undefined || rawQuizId === "") return;
  const quizId = asPositiveId(rawQuizId);
  if (!quizId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Quiz embeds require a valid quiz selection." });
  }
  const [quiz] = await db.select({
    id: quizzes.id,
    orgId: quizzes.orgId,
    isPublished: quizzes.isPublished,
    visibility: quizzes.visibility,
    shareToken: quizzes.shareToken,
  }).from(quizzes).where(eq(quizzes.id, quizId)).limit(1);
  if (!quiz) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "The selected quiz no longer exists." });
  }
  if (quiz.orgId !== organizationId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Quiz embeds must reference a quiz in this organization." });
  }
  if (!quiz.isPublished || !quiz.shareToken || !isPublicQuizDeliveryVisible(quiz.visibility)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Quiz embeds require a published public quiz with an active share link." });
  }
}

/**
 * Validate new saves before persistence. Existing saved content remains untouched
 * until an author elects to save it; public delivery still resolves it fail-closed.
 */
export async function validateLandingEmbeddedReferences(
  db: any,
  organizationId: number,
  blocks: unknown,
): Promise<void> {
  assertLandingBlocksAreBounded(blocks);
  const checks: Promise<void>[] = [];
  visitLandingBlocks(blocks, (block) => {
    if (block.type === "lms_course_embed") {
      checks.push(assertPublicCourseReference(db, organizationId, getCourseReference(block.data, "Course embed"), "Course embed"));
    }
    if (block.type === "lms_course_card") {
      const cards = block.data.cards;
      if (!Array.isArray(cards)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Course card grids must contain a card array." });
      }
      for (const rawCard of cards) {
        const card = asRecord(rawCard);
        if (!card) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Each course card needs a valid course reference." });
        }
        checks.push(assertPublicCourseReference(
          db,
          organizationId,
          getCourseReference({
            courseId: card.courseId ?? card.id,
            courseSlug: card.courseSlug ?? card.slug,
          }, "Course card"),
          "Course card",
        ));
      }
    }
    if (block.type === "lms_quiz_embed") {
      checks.push(assertPublicQuizReference(db, organizationId, block.data.quizId));
    }
    if (block.type === "countdown_enrollment" && block.data.targetDate) {
      const targetDate = asNonEmptyString(block.data.targetDate);
      if (!targetDate || !Number.isFinite(Date.parse(targetDate))) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Enrollment countdowns need a valid closing date." });
      }
    }
  });
  await Promise.all(checks);
}

function pickPresentationData(data: Record<string, unknown>, allowedFields: string[]): Record<string, unknown> {
  return Object.fromEntries(allowedFields
    .filter((field) => data[field] !== undefined)
    .map((field) => [field, data[field]]));
}

/**
 * Strip authoring-only linked-resource snapshots before a public payload leaves
 * the server. Dynamic records are supplied separately by the trusted resolver.
 */
export function sanitizePublicLandingBlocks(blocks: unknown): unknown[] {
  if (!Array.isArray(blocks)) return [];
  return blocks.map((rawBlock) => {
    const block = asRecord(rawBlock);
    const data = asRecord(block?.data);
    if (!block || !data) return rawBlock;
    if (block.type === "column_layout") {
      return {
        ...block,
        data: {
          ...data,
          leftBlocks: sanitizePublicLandingBlocks(data.leftBlocks),
          rightBlocks: sanitizePublicLandingBlocks(data.rightBlocks),
        },
      };
    }
    if (block.type === "lms_course_embed") {
      return {
        ...block,
        data: pickPresentationData(data, ["ctaText", "accentColor", "bgColor", "contentWidth", "marginTop", "marginBottom", "paddingTop", "paddingBottom", "paddingLeft", "paddingRight"]),
      };
    }
    if (block.type === "lms_quiz_embed") {
      return {
        ...block,
        data: pickPresentationData(data, ["ctaText", "accentColor", "bgColor", "contentWidth", "marginTop", "marginBottom", "paddingTop", "paddingBottom", "paddingLeft", "paddingRight"]),
      };
    }
    if (block.type === "lms_course_card") {
      return {
        ...block,
        data: pickPresentationData(data, ["headline", "subtext", "accentColor", "bgColor", "contentWidth", "marginTop", "marginBottom", "paddingTop", "paddingBottom", "paddingLeft", "paddingRight"]),
      };
    }
    if (block.type === "social_proof_live") {
      return {
        ...block,
        data: pickPresentationData(data, ["headline", "activityStyle", "accentColor", "bgColor", "contentWidth", "marginTop", "marginBottom", "paddingTop", "paddingBottom", "paddingLeft", "paddingRight"]),
      };
    }
    return rawBlock;
  });
}

/** Resolve currently eligible public resources without trusting saved snapshots. */
export async function resolvePublicLandingEmbeddedResources(
  db: any,
  options: {
    blocks: unknown;
    organizationId: number;
    organization: PublicOrganizationUrl;
    sourceCourseId: number;
  },
): Promise<PublicLandingEmbeddedResources> {
  const courseRefs: Array<{ blockId: string; kind: "embed" | "card"; courseId: number | null; courseSlug: string | null }> = [];
  const quizRefs: Array<{ blockId: string; quizId: number }> = [];
  const socialProofBlockIds: Array<{ blockId: string; activityStyle: "enrolling" | "learning" }> = [];

  visitLandingBlocks(options.blocks, (block) => {
    if (block.type === "lms_course_embed") {
      const courseId = asPositiveId(block.data.courseId);
      const courseSlug = asNonEmptyString(block.data.courseSlug);
      if (courseId || courseSlug) courseRefs.push({ blockId: block.id, kind: "embed", courseId, courseSlug });
    }
    if (block.type === "lms_course_card" && Array.isArray(block.data.cards)) {
      for (const rawCard of block.data.cards) {
        const card = asRecord(rawCard);
        const courseId = asPositiveId(card?.id ?? card?.courseId);
        const courseSlug = asNonEmptyString(card?.slug ?? card?.courseSlug);
        if (courseId || courseSlug) courseRefs.push({ blockId: block.id, kind: "card", courseId, courseSlug });
      }
    }
    if (block.type === "lms_quiz_embed") {
      const quizId = asPositiveId(block.data.quizId);
      if (quizId) quizRefs.push({ blockId: block.id, quizId });
    }
    if (block.type === "social_proof_live") {
      socialProofBlockIds.push({
        blockId: block.id,
        activityStyle: block.data.activityStyle === "learning" ? "learning" : "enrolling",
      });
    }
  });

  const courseIds = [...new Set(courseRefs.flatMap((reference) => reference.courseId ? [reference.courseId] : []))];
  const courseSlugs = [...new Set(courseRefs.flatMap((reference) => reference.courseSlug ? [reference.courseSlug] : []))];
  const courseLookup = courseIds.length || courseSlugs.length
    ? await db.select({
        id: lmsCourses.id,
        slug: lmsCourses.slug,
        title: lmsCourses.title,
        description: lmsCourses.description,
        coverImageUrl: lmsCourses.coverImageUrl,
        price: lmsCourses.price,
        isFree: lmsCourses.isFree,
        pricingType: lmsCourses.pricingType,
      }).from(lmsCourses).where(and(
        eq(lmsCourses.orgId, options.organizationId),
        eq(lmsCourses.type, "course"),
        eq(lmsCourses.status, "public"),
        or(
          ...(courseIds.length ? [inArray(lmsCourses.id, courseIds)] : []),
          ...(courseSlugs.length ? [inArray(lmsCourses.slug, courseSlugs)] : []),
        ),
      ))
    : [];
  const coursesById = new Map(courseLookup.map((course: any) => [course.id, course]));
  const coursesBySlug = new Map(courseLookup.map((course: any) => [course.slug, course]));
  const toPublicCourse = (course: any) => ({
    title: course.title,
    description: course.description,
    coverImageUrl: course.coverImageUrl,
    price: course.price,
    isFree: course.isFree,
    pricingType: course.pricingType,
    courseUrl: publicCourseUrl(options.organization, course.slug),
  });
  const courses: PublicLandingEmbeddedResources["courses"] = {};
  const courseCards: PublicLandingEmbeddedResources["courseCards"] = {};
  for (const reference of courseRefs) {
    const candidate = reference.courseId ? coursesById.get(reference.courseId) : coursesBySlug.get(reference.courseSlug!);
    // When both values were saved, a changed or spoofed slug never redirects a
    // visitor to another resource. The linked item simply becomes unavailable.
    if (!candidate || (reference.courseSlug && candidate.slug !== reference.courseSlug)) continue;
    if (reference.kind === "embed") courses[reference.blockId] = toPublicCourse(candidate);
    else (courseCards[reference.blockId] ??= []).push(toPublicCourse(candidate));
  }

  const quizIds = [...new Set(quizRefs.map((reference) => reference.quizId))];
  const quizLookup = quizIds.length
    ? await db.select({
        id: quizzes.id,
        title: quizzes.title,
        description: quizzes.description,
        instructions: quizzes.instructions,
        passScorePercent: quizzes.passScorePercent,
        legacyPassingScore: quizzes.legacyPassingScore,
        shareToken: quizzes.shareToken,
        visibility: quizzes.visibility,
        isPublished: quizzes.isPublished,
      }).from(quizzes).where(and(
        eq(quizzes.orgId, options.organizationId),
        eq(quizzes.isPublished, true),
        inArray(quizzes.id, quizIds),
      ))
    : [];
  const quizzesById = new Map(quizLookup.map((quiz: any) => [quiz.id, quiz]));
  const resolvedQuizzes: PublicLandingEmbeddedResources["quizzes"] = {};
  for (const reference of quizRefs) {
    const quiz = quizzesById.get(reference.quizId);
    if (!quiz || !quiz.shareToken || !isPublicQuizDeliveryVisible(quiz.visibility)) continue;
    let questionCount = 0;
    try {
      const parsed = quiz.instructions ? JSON.parse(quiz.instructions) : [];
      questionCount = Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      // A malformed authoring payload never becomes executable public content.
    }
    resolvedQuizzes[reference.blockId] = {
      title: quiz.title,
      description: quiz.description,
      questionCount,
      passingScore: Number(quiz.passScorePercent ?? quiz.legacyPassingScore ?? 70),
      quizUrl: publicQuizUrl(options.organization, quiz.shareToken),
    };
  }

  const socialProof: PublicLandingEmbeddedResources["socialProof"] = {};
  if (socialProofBlockIds.length > 0) {
    const [{ count }] = await db.select({ count: sql<number>`count(*)` })
      .from(lmsEnrollments)
      .where(and(
        eq(lmsEnrollments.orgId, options.organizationId),
        eq(lmsEnrollments.courseId, options.sourceCourseId),
        inArray(lmsEnrollments.status, ["active", "completed"]),
      ));
    for (const { blockId, activityStyle } of socialProofBlockIds) {
      socialProof[blockId] = { enrollmentCount: Number(count ?? 0), activityStyle };
    }
  }

  return { courses, courseCards, quizzes: resolvedQuizzes, socialProof };
}
