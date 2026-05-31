import {
  boolean,
  decimal,
  int,
  json,
  longtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
  bigint,
  uniqueIndex,
} from "drizzle-orm/mysql-core";

// ─── Core Auth ────────────────────────────────────────────────────────────────

export const cmeCoursesCache = mysqlTable("cmeCoursesCache", {
  id: int("id").primaryKey().autoincrement(),
  // Thinkific product ID (used for deep-link URLs and enrollment lookups)
  thinkificProductId: int("thinkificProductId").notNull().unique(),
  // Thinkific course ID (different from product ID)
  thinkificCourseId: int("thinkificCourseId"),
  name: varchar("name", { length: 300 }).notNull(),
  slug: varchar("slug", { length: 200 }).notNull(),
  description: text("description"),
  price: varchar("price", { length: 20 }),
  cardImageUrl: text("cardImageUrl"),
  instructorNames: text("instructorNames"),
  hasCertificate: boolean("hasCertificate").default(false).notNull(),
  // Raw Thinkific status fields (for reference)
  thinkificStatus: varchar("thinkificStatus", { length: 20 }),
  // JSON array of Thinkific collection IDs this product belongs to
  collectionIds: text("collectionIds"),
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
});
export type CmeCourseCache = typeof cmeCoursesCache.$inferSelect;
export type InsertCmeCourseCache = typeof cmeCoursesCache.$inferInsert;

// ─── CME Hub: Course Metadata ─────────────────────────────────────────────────
// Admin-managed CME credit metadata not stored in Thinkific.
// One row per Thinkific product — upserted by platform_admin via the CME Hub admin panel.

export const cmeCourseMeta = mysqlTable("cmeCourseMeta", {
  id: int("id").primaryKey().autoincrement(),
  thinkificProductId: int("thinkificProductId").notNull().unique(),
  // Credit hours (e.g. 2.5 stored as "2.5")
  creditHours: varchar("creditHours", { length: 10 }),
  // Credit type: SDMS, AMA_PRA_1, ANCC, etc.
  creditType: mysqlEnum("creditType", ["SDMS", "AMA_PRA_1", "ANCC", "OTHER"]),
  // Specialty category for filtering
  specialty: varchar("specialty", { length: 100 }),
  // Accreditation body name
  accreditationBody: varchar("accreditationBody", { length: 100 }),
  // Whether to show in the public catalog (admin override)
  isVisible: boolean("isVisible").default(true).notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  updatedByUserId: int("updatedByUserId"),
});
export type CmeCourseMeta = typeof cmeCourseMeta.$inferSelect;
export type InsertCmeCourseMeta = typeof cmeCourseMeta.$inferInsert;

// ─── CME Hub: Enrollment Cache ────────────────────────────────────────────────
// Per-user enrollment progress cached from Thinkific.
// Keyed by (userId, thinkificProductId) — refreshed on-demand when user visits CME Hub.

export const cmeEnrollmentCache = mysqlTable("cmeEnrollmentCache", {
  id: int("id").primaryKey().autoincrement(),
  // iHeartEcho user ID
  userId: int("userId").notNull(),
  // Thinkific user ID (resolved by email match)
  thinkificUserId: int("thinkificUserId"),
  // Thinkific product ID
  thinkificProductId: int("thinkificProductId").notNull(),
  thinkificCourseId: int("thinkificCourseId"),
  courseName: varchar("courseName", { length: 300 }),
  percentCompleted: varchar("percentCompleted", { length: 10 }),
  completed: boolean("completed").default(false).notNull(),
  completedAt: timestamp("completedAt"),
  startedAt: timestamp("startedAt"),
  expiryDate: timestamp("expiryDate"),
  expired: boolean("expired").default(false).notNull(),
  syncedAt: timestamp("syncedAt").defaultNow().notNull(),
});
export type CmeEnrollmentCache = typeof cmeEnrollmentCache.$inferSelect;
export type InsertCmeEnrollmentCache = typeof cmeEnrollmentCache.$inferInsert;

// ─── Daily QuickFire: Questions ───────────────────────────────────────────────
// Individual questions for the Daily QuickFire engine.
// Types: scenario (text-only MCQ), image (image + MCQ), quickReview (flashcard).

export const lmsCourses = mysqlTable("lms_courses", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  subtitle: varchar("subtitle", { length: 500 }),
  description: longtext("description"),
  coverImageUrl: text("cover_image_url"),
  status: mysqlEnum("status", ["draft", "public", "hidden", "private", "archived"]).default("draft").notNull(),
  type: mysqlEnum("type", ["course", "quiz", "download", "cohort"]).default("course").notNull(),
  // Cohort-specific: close enrollment after this date (null = always open)
  enrollmentCloseDate: timestamp("enrollment_close_date"),
  brand: mysqlEnum("brand", ["aaus", "iheartecho"]).default("aaus").notNull(),
  price: int("price").default(0).notNull(), // cents — used for one_time and payment_plan total
  isFree: boolean("is_free").default(false).notNull(),
  bundleOnly: boolean("bundle_only").default(false).notNull(), // if true, cannot be purchased standalone
  currency: varchar("currency", { length: 8 }).default("usd").notNull(),
  // Extended pricing model
  pricingType: mysqlEnum("pricing_type", ["free", "one_time", "subscription", "payment_plan", "trial_then_subscription"]).default("one_time").notNull(),
  subscriptionInterval: mysqlEnum("subscription_interval", ["monthly", "quarterly", "annual"]),
  // Free trial before subscription
  trialDays: int("trialDays"), // NULL = no trial
  // Access duration after enrollment (NULL = lifetime)
  accessDurationDays: int("accessDurationDays"), // e.g. 30, 90, 365
  // Payment plan: down payment (cents) + N installments of installmentAmount (cents)
  downPayment: int("down_payment").default(0), // cents
  installmentCount: int("installment_count").default(0),
  installmentAmount: int("installment_amount").default(0), // cents per installment
  installmentIntervalDays: int("installment_interval_days").default(30), // days between installments
  // Stripe IDs for subscription/payment-plan products (created on first checkout)
  stripePriceId: varchar("stripe_price_id", { length: 255 }),
  // SEO / landing page
  metaTitle: varchar("meta_title", { length: 255 }),
  metaDescription: text("meta_description"),
  metaKeywords: text("meta_keywords"),
  // Completion certificate
  hasCertificate: boolean("has_certificate").default(false).notNull(),
  certificateTemplateId: int("certificate_template_id"), // FK to lms_certificate_templates.id (null = default template)
  // Featured: admin-selectable to show on LMS home page
  isFeatured: boolean("is_featured").default(false).notNull(),
  // Drip: unlock all immediately (false) or by schedule (true)
  isDrip: boolean("is_drip").default(false).notNull(),
  // Show instructor profile card in the lesson player right panel
  showInstructor: boolean("show_instructor").default(false).notNull(),
  // Hide the progress bar/percentage from students in the course player and overview
  hideProgress: boolean("hide_progress").default(false).notNull(),
  // Show in Education Library — admin toggle to include/exclude from the public library
  showInLibrary: boolean("show_in_library").default(true).notNull(),
  // Block editor content for the Course Overview page (JSON array of Block objects)
  // courseOverviewTopBlocks: shown ABOVE the progress bar
  // courseOverviewBlocks: shown BETWEEN progress bar and curriculum (middle zone)
  // courseOverviewBottomBlocks: shown BELOW the curriculum outline
  courseOverviewTopBlocks: longtext("course_overview_top_blocks"),
  courseOverviewBlocks: longtext("course_overview_blocks"),
  courseOverviewBottomBlocks: longtext("course_overview_bottom_blocks"),
  // Send a welcome/enrollment confirmation email to the student when they enroll in this course
  // Can be overridden per-course; also subject to the platform-wide enrollmentEmailEnabled setting
  sendEnrollmentEmail: boolean("send_enrollment_email").default(true).notNull(),
  // Course color scheme — applied to player sidebar, overview curriculum, landing page curriculum block
  // primaryColor: main brand color (buttons, active states, section headers)
  // accentColor: secondary/highlight color
  // gradientFrom/gradientTo: gradient start/end colors (used for section headers, progress bars)
  // gradientDirection: CSS gradient direction (e.g. "to right", "135deg")
  primaryColor: varchar("primary_color", { length: 20 }).default("#179ca3"),
  accentColor: varchar("accent_color", { length: 20 }).default("#0d9488"),
  gradientFrom: varchar("gradient_from", { length: 20 }).default("#179ca3"),
  gradientTo: varchar("gradient_to", { length: 20 }).default("#0d9488"),
  gradientDirection: varchar("gradient_direction", { length: 30 }).default("135deg"),
  thumbnailUrl: text("thumbnail_url"),
  // Custom text labels — JSON object overriding default terminology per-course
  // e.g. { lesson: "Lecture", section: "Unit", markComplete: "Mark Complete", nextLesson: "Next Lesson", ... }
  customLabels: longtext("custom_labels"),
  // Course-level default: show Mark Complete button on all lessons (can be overridden per lesson)
  // 1 = show (default), 0 = hide
  defaultMarkComplete: int("default_mark_complete").default(1).notNull(),
  // Course player UI theme: 'light' (default) or 'dark'
  playerTheme: mysqlEnum("player_theme", ["light", "dark"]).default("light").notNull(),
  // Group purchase: allow bulk seat purchases for teams/organizations
  allowGroupPurchase: boolean("allow_group_purchase").default(true).notNull(),
  createdByUserId: int("created_by_user_id").notNull(),
  // Display order in the public Education Library (0 = unset/default, positive = explicit position)
  libraryOrder: int("library_order").default(0).notNull(),
  // Per-course publish domain override (null = use global coursePublishDomain from platform_settings)
  publishDomain: varchar("publish_domain", { length: 255 }),
  // Multi-cohort mode: when true, live sessions/assignments/recordings are scoped per cohort group
  multiCohortMode: boolean("multi_cohort_mode").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsCourse = typeof lmsCourses.$inferSelect;
export type InsertLmsCourse = typeof lmsCourses.$inferInsert;


export const lmsSections = mysqlTable("lms_sections", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("course_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  position: int("position").default(0).notNull(),
  isPreview: boolean("is_preview").default(false).notNull(),
  dripDays: int("drip_days").default(0).notNull(), // days after enrollment to unlock the whole section
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsSection = typeof lmsSections.$inferSelect;


export const lmsLessons = mysqlTable("lms_lessons", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("course_id"), // direct course reference (sectionId optional for top-level lessons)
  sectionId: int("section_id"), // nullable — top-level lessons have no section
  title: varchar("title", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["video", "text", "quiz", "download", "embed", "video_text"]).default("text").notNull(),
  content: longtext("content"), // rich text HTML or markdown
  videoContent: longtext("video_content"), // rich text below the video for video_text lessons
  embedUrl: varchar("embed_url", { length: 500 }), // iframe src for embed lessons
  mediaAssetId: int("media_asset_id"), // FK to mediaAssets
  position: int("position").default(0).notNull(),
  isPreview: boolean("is_preview").default(false).notNull(), // kept for backward compat; derived from previewMode
  // Three-state preview mode:
  //   'none'                        = enrolled users only (default)
  //   'preview'                     = free preview, always visible to non-enrolled users
  //   'preview_hide_after_purchase' = free preview for non-enrolled, hidden once user purchases
  previewMode: mysqlEnum("preview_mode", ["none", "preview", "preview_hide_after_purchase"]).default("none").notNull(),
  dripDays: int("drip_days").default(0).notNull(), // days after enrollment to unlock
  durationMinutes: int("duration_minutes"),
  requireVideoCompletion: int("require_video_completion").default(0).notNull(), // 1 = must watch video before marking complete
  // null = inherit from course default, 0 = hide, 1 = show
  requireManualComplete: int("require_manual_complete"), // null = inherit from course (default)
  // Lesson Effects
  effectEnabled: boolean("effect_enabled").default(false),
  effectTrigger: varchar("effect_trigger", { length: 20 }).default("lesson_start"),
  effectBannerText: varchar("effect_banner_text", { length: 500 }),
  effectBannerBgColor: varchar("effect_banner_bg_color", { length: 20 }),
  effectBannerTextColor: varchar("effect_banner_text_color", { length: 20 }),
  effectSound: varchar("effect_sound", { length: 50 }),
  effectSoundUrl: varchar("effect_sound_url", { length: 500 }),
  effectConfetti: boolean("effect_confetti").default(false),
  effectConfettiColors: varchar("effect_confetti_colors", { length: 500 }),
  // Confetti mode: 'fall' = gentle falling confetti, 'cannon' = burst from sides
  effectConfettiMode: mysqlEnum("effect_confetti_mode", ["fall", "cannon"]).default("fall"),
  // Banner display duration in seconds (default 5)
  effectBannerDuration: int("effect_banner_duration").default(5),
  // Page builder blocks for rich lesson content (JSON array of Block objects)
  contentBlocks: longtext("content_blocks"),
  // Lesson learning objectives shown in "In This Lesson" panel (JSON array of strings)
  learningObjectives: longtext("learning_objectives"),
  // Override course-level showInstructor: null = inherit from course, true = always show, false = always hide
  showInstructor: mysqlEnum("show_instructor", ["inherit", "show", "hide"]).default("inherit").notNull(),
  // Prerequisite gate: when true, this lesson acts as a gate — all subsequent lessons in the course
  // are locked until this lesson is completed (or at minimum opened, if no Mark Complete button).
  isPrerequisite: boolean("is_prerequisite").default(false).notNull(),
  // Legacy: kept for DB compatibility but no longer used in logic
  prerequisiteLessonId: int("prerequisite_lesson_id"),
  // Live meeting link (Zoom/Teams) — shown as "Join Live" button on enrolled course overview only
  meetingLink: varchar("meeting_link", { length: 1024 }),
  // Scheduled start/end times for the live session (UTC ms). Join Live button appears 15 min before
  // liveStartAt and hides after liveEndAt (or 3 hours after liveStartAt if liveEndAt is not set).
  liveStartAt: bigint("live_start_at", { mode: "number" }),
  liveEndAt: bigint("live_end_at", { mode: "number" }),
  // Comments: when true, enrolled students can post comments on this lesson
  commentsEnabled: boolean("comments_enabled").default(false).notNull(),
  // Per-lesson publish status: 'published' = visible to enrolled learners (default), 'draft' = hidden from learners even if course is published
  lessonStatus: mysqlEnum("lesson_status", ["published", "draft"]).default("published").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsLesson = typeof lmsLessons.$inferSelect;

// ── Section Templates ─────────────────────────────────────────────────────────
// A section template stores a section title + all its lessons (as a JSON snapshot)
// so admins can reuse common module structures across courses.

export const lmsSectionTemplates = mysqlTable("lms_section_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(), // template display name
  description: text("description"), // optional description
  sectionTitle: varchar("section_title", { length: 255 }).notNull(), // default section title when imported
  // JSON snapshot of lessons: array of { title, type, content, embedUrl, dripDays, requireVideoCompletion, requireManualComplete, durationMinutes, contentBlocks, learningObjectives }
  lessonsJson: longtext("lessons_json").notNull(),
  lessonCount: int("lesson_count").default(0).notNull(),
  createdByUserId: int("created_by_user_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsSectionTemplate = typeof lmsSectionTemplates.$inferSelect;


export const lmsQuizzes = mysqlTable("lms_quizzes", {
  id: int("id").autoincrement().primaryKey(),
  lessonId: int("lesson_id").notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  passingScore: int("passing_score").default(70).notNull(), // percentage
  allowRetakes: boolean("allow_retakes").default(true).notNull(),
  showCorrectAnswers: boolean("show_correct_answers").default(true).notNull(),
  requirePassingToProgress: boolean("require_passing_to_progress").default(false).notNull(),
  randomizeQuestions: boolean("randomize_questions").default(false).notNull(),
  randomizeAnswers: boolean("randomize_answers").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsQuiz = typeof lmsQuizzes.$inferSelect;


export const lmsQuizQuestions = mysqlTable("lms_quiz_questions", {
  id: int("id").autoincrement().primaryKey(),
  quizId: int("quiz_id").notNull(),
  question: text("question").notNull(),
  type: mysqlEnum("type", ["mcq", "truefalse"]).default("mcq").notNull(),
  options: text("options"), // JSON array of strings
  correctAnswer: varchar("correct_answer", { length: 255 }).notNull(),
  explanation: text("explanation"),
  position: int("position").default(0).notNull(),
});
export type LmsQuizQuestion = typeof lmsQuizQuestions.$inferSelect;


export const lmsEnrollments = mysqlTable("lms_enrollments", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  courseId: int("course_id").notNull(),
  enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  progressPct: int("progress_pct").default(0).notNull(),
  groupId: int("group_id"),
  affiliateCode: varchar("affiliate_code", { length: 64 }),
  orderId: int("order_id"),
  // Enrollment type: 'full' = paid/full access, 'free_preview' = free preview only (limited to preview lessons)
  enrollmentType: mysqlEnum("enrollment_type", ["full", "free_preview"]).default("full").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsEnrollment = typeof lmsEnrollments.$inferSelect;


export const lmsLessonProgress = mysqlTable("lms_lesson_progress", {
  id: int("id").autoincrement().primaryKey(),
  enrollmentId: int("enrollment_id").notNull(),
  lessonId: int("lesson_id").notNull(),
  completedAt: timestamp("completed_at"),
  quizScore: int("quiz_score"), // percentage if quiz lesson
  quizPassed: boolean("quiz_passed"),
  attempts: int("attempts").default(0).notNull(),
});
export type LmsLessonProgress = typeof lmsLessonProgress.$inferSelect;


export const lmsGroups = mysqlTable("lms_groups", {
  id: int("id").autoincrement().primaryKey(),
  /** Legacy single-course field — kept for backward compat, new teams use lmsGroupCourses */
  courseId: int("course_id"),
  name: varchar("name", { length: 255 }).notNull(),
  /** Legacy total seats — new teams track seats per course in lmsGroupCourses */
  seats: int("seats").default(1).notNull(),
  managerId: int("manager_id"), // FK to users — the group manager (legacy)
  /** Team admin user ID — has team-admin role, can manage this team only */
  teamAdminId: int("team_admin_id"),
  /** Organisation / institution name */
  orgName: varchar("org_name", { length: 255 }),
  /** Team admin contact email */
  adminEmail: varchar("admin_email", { length: 320 }),
  /** Team admin contact phone */
  adminPhone: varchar("admin_phone", { length: 50 }),
  /** Organisation website */
  website: varchar("website", { length: 255 }),
  notes: text("notes"),
  // Stripe order that created this group (set after webhook fulfillment)
  orderId: int("order_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsGroup = typeof lmsGroups.$inferSelect;

/** Per-course seat allocation for a team (replaces single courseId+seats on lmsGroups) */

export const lmsGroupCourses = mysqlTable("lms_group_courses", {
  id: int("id").autoincrement().primaryKey(),
  groupId: int("group_id").notNull(),
  courseId: int("course_id").notNull(),
  seats: int("seats").default(1).notNull(),
  /** Stripe order that added this course allocation */
  orderId: int("order_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsGroupCourse = typeof lmsGroupCourses.$inferSelect;


export const lmsGroupSeats = mysqlTable("lms_group_seats", {
  id: int("id").autoincrement().primaryKey(),
  groupId: int("group_id").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  memberName: varchar("member_name", { length: 255 }), // optional display name
  status: mysqlEnum("status", ["pending", "active", "revoked"]).default("pending").notNull(),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
  enrollmentId: int("enrollment_id"), // set when user accepts and enrolls
  inviteToken: varchar("invite_token", { length: 128 }),
  acceptedAt: timestamp("accepted_at"),
  lastInviteSentAt: timestamp("last_invite_sent_at"),
});
export type LmsGroupSeat = typeof lmsGroupSeats.$inferSelect;


export const lmsInstructors = mysqlTable("lms_instructors", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id"), // optional link to app user account
  name: varchar("name", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }),
  bio: longtext("bio"),
  avatarUrl: text("avatar_url"),
  website: varchar("website", { length: 255 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsInstructor = typeof lmsInstructors.$inferSelect;


export const lmsCourseInstructors = mysqlTable("lms_course_instructors", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("course_id").notNull(),
  instructorId: int("instructor_id").notNull(),
  revenueSharePct: int("revenue_share_pct").default(0).notNull(), // 0-100
  isPrimary: boolean("is_primary").default(false).notNull(),
});
export type LmsCourseInstructor = typeof lmsCourseInstructors.$inferSelect;


export const lmsAffiliates = mysqlTable("lms_affiliates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id"), // optional link to app user
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }),
  code: varchar("code", { length: 64 }).notNull().unique(),
  commissionPct: int("commission_pct").default(10).notNull(), // percentage
  isActive: boolean("is_active").default(true).notNull(),
  totalEarned: int("total_earned").default(0).notNull(), // cents
  totalPaid: int("total_paid").default(0).notNull(), // cents
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsAffiliate = typeof lmsAffiliates.$inferSelect;


export const lmsAffiliateConversions = mysqlTable("lms_affiliate_conversions", {
  id: int("id").autoincrement().primaryKey(),
  affiliateId: int("affiliate_id").notNull(),
  enrollmentId: int("enrollment_id"), // nullable for non-LMS conversions (e.g. digital downloads)
  orderId: int("order_id"), // nullable for non-LMS conversions
  digitalPurchaseId: int("digital_purchase_id"), // for digital download conversions
  conversionType: varchar("conversion_type", { length: 32 }).default("lms_course"), // lms_course | digital_download
  saleAmount: int("sale_amount").notNull(), // cents
  commissionAmount: int("commission_amount").notNull(), // cents
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsAffiliateConversion = typeof lmsAffiliateConversions.$inferSelect;


export const lmsLandingPages = mysqlTable("lms_landing_pages", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("course_id").notNull().unique(),
  heroTitle: varchar("hero_title", { length: 255 }),
  heroSubtitle: text("hero_subtitle"),
  heroImageUrl: text("hero_image_url"),
  bodyContent: longtext("body_content"), // rich text HTML
  ctaText: varchar("cta_text", { length: 128 }).default("Enroll Now"),
  whatYouLearn: longtext("what_you_learn"), // rich text
  requirements: longtext("requirements"), // rich text
  isCustom: boolean("is_custom").default(false).notNull(),
  blocks: longtext("blocks"), // JSON array of page builder blocks
  seoTitle: varchar("seo_title", { length: 255 }),
  seoDescription: text("seo_description"),
  seoImage: varchar("seo_image", { length: 512 }),
  // Per-funnel publish domain override (null = use global funnelPublishDomain)
  publishDomain: varchar("publish_domain", { length: 255 }),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsLandingPage = typeof lmsLandingPages.$inferSelect;


export const lmsOrders = mysqlTable("lms_orders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  courseId: int("course_id").notNull(),
  amount: int("amount").notNull(), // cents
  currency: varchar("currency", { length: 8 }).default("usd").notNull(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  stripeSessionId: varchar("stripe_session_id", { length: 255 }),
  stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
  status: mysqlEnum("status", ["pending", "paid", "failed", "refunded"]).default("pending").notNull(),
  affiliateId: int("affiliate_id"),
  groupId: int("group_id"),
  seats: int("seats").default(1).notNull(), // for group purchases
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsOrder = typeof lmsOrders.$inferSelect;

// ─── LMS Page Templates ───────────────────────────────────────────────────────


export const lmsPageTemplates = mysqlTable("lms_page_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  templateType: mysqlEnum("template_type", ["page", "block"]).notNull().default("page"),
  blockType: varchar("block_type", { length: 64 }),
  blocks: longtext("blocks").notNull(), // JSON array of Block objects
  thumbnailUrl: text("thumbnail_url"),
  createdBy: int("created_by"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
export type LmsPageTemplate = typeof lmsPageTemplates.$inferSelect;
export type NewLmsPageTemplate = typeof lmsPageTemplates.$inferInsert;

// ─── LMS Certificate Templates ───────────────────────────────────────────────


export const lmsCertificateTemplates = mysqlTable("lms_certificate_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  // Visual design
  backgroundImageUrl: text("background_image_url"),
  logoUrl: text("logo_url"),
  primaryColor: varchar("primary_color", { length: 20 }).default("#189aa1").notNull(),
  accentColor: varchar("accent_color", { length: 20 }).default("#c9a84c").notNull(),
  textColor: varchar("text_color", { length: 20 }).default("#0e1e2e").notNull(),
  fontFamily: varchar("font_family", { length: 100 }).default("Helvetica").notNull(),
  // Signature block
  signatureName: varchar("signature_name", { length: 200 }),
  signatureTitle: varchar("signature_title", { length: 200 }),
  signatureImageUrl: text("signature_image_url"),
  // Footer / legal text
  footerText: text("footer_text"),
  // Organization name shown on the certificate
  organizationName: varchar("organization_name", { length: 200 }).default("All About Ultrasound").notNull(),
  // Layout variant: classic | modern | minimal
  layout: mysqlEnum("layout", ["classic", "modern", "minimal"]).default("classic").notNull(),
  isDefault: boolean("is_default").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsCertificateTemplate = typeof lmsCertificateTemplates.$inferSelect;
export type InsertLmsCertificateTemplate = typeof lmsCertificateTemplates.$inferInsert;

// ─── LMS Certificates ─────────────────────────────────────────────────────────


export const lmsCertificates = mysqlTable("lms_certificates", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  courseId: int("course_id").notNull(),
  enrollmentId: int("enrollment_id").notNull(),
  certificateUrl: text("certificate_url").notNull(),
  templateId: int("template_id"), // FK to lms_certificate_templates.id (null = legacy/default)
  issuedAt: timestamp("issued_at").defaultNow().notNull(),
});
export type LmsCertificate = typeof lmsCertificates.$inferSelect;

// ─── LMS Lesson Notes ─────────────────────────────────────────────────────────


export const lmsLessonNotes = mysqlTable("lms_lesson_notes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  lessonId: int("lesson_id").notNull(),
  courseId: int("course_id").notNull(),
  note: longtext("note").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsLessonNote = typeof lmsLessonNotes.$inferSelect;

// ─── LMS Lesson Bookmarks ─────────────────────────────────────────────────────


export const lmsLessonBookmarks = mysqlTable("lms_lesson_bookmarks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  lessonId: int("lesson_id").notNull(),
  courseId: int("course_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsLessonBookmark = typeof lmsLessonBookmarks.$inferSelect;

// ─── LMS Collections ─────────────────────────────────────────────────────────

export const lmsCollections = mysqlTable("lms_collections", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description"),
  label: varchar("label", { length: 100 }),
  color: varchar("color", { length: 20 }).default("#189aa1"),
  coverImageUrl: text("cover_image_url"),
  position: int("position").default(0).notNull(),
  isPublished: boolean("is_published").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsCollection = typeof lmsCollections.$inferSelect;


export const lmsCollectionCourses = mysqlTable("lms_collection_courses", {
  id: int("id").autoincrement().primaryKey(),
  collectionId: int("collection_id").notNull(),
  courseId: int("course_id").notNull(),
  position: int("position").default(0).notNull(),
});
export type LmsCollectionCourse = typeof lmsCollectionCourses.$inferSelect;


// ─── Digital Downloads (File Repository) ────────────────────────────────────

export const lmsVideoEvents = mysqlTable("lms_video_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  lessonId: int("lesson_id").notNull(),
  courseId: int("course_id").notNull(),
  eventType: varchar("event_type", { length: 32 }).notNull(), // 'play'|'pause'|'complete'|'seek'|'progress'
  positionSec: int("position_sec").default(0).notNull(),      // playback position
  durationSec: int("duration_sec").default(0).notNull(),      // total video length
  percentWatched: int("percent_watched").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsVideoEvent = typeof lmsVideoEvents.$inferSelect;
export type InsertLmsVideoEvent = typeof lmsVideoEvents.$inferInsert;

/** One row per quiz attempt (full attempt record with answers) */

export const lmsQuizAttempts = mysqlTable("lms_quiz_attempts", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  lessonId: int("lesson_id").notNull(),
  courseId: int("course_id").notNull(),
  score: int("score").notNull(),          // percentage 0-100
  passed: boolean("passed").notNull(),
  totalQuestions: int("total_questions").notNull(),
  correctAnswers: int("correct_answers").notNull(),
  timeTakenSec: int("time_taken_sec"),
  answersJson: longtext("answers_json"),  // JSON array of {questionId, selectedAnswer, correct}
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsQuizAttempt = typeof lmsQuizAttempts.$inferSelect;
export type InsertLmsQuizAttempt = typeof lmsQuizAttempts.$inferInsert;

// ─── Brand Memberships (Multi-Tenant Premium) ────────────────────────────────
// Tracks per-brand premium subscriptions. A user can have separate premium status
// for AAUS (UltrasoundAssist) and iHeartEcho (EchoAssist).

export const lmsPricingOptions = mysqlTable("lms_pricing_options", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("course_id").notNull(),
  // Display label shown to students (e.g. "3-Month Payment Plan", "Group Rate")
  label: varchar("label", { length: 255 }).notNull(),
  // Optional sub-label / description shown below the label (e.g. "3 × $99/month")
  sublabel: varchar("sublabel", { length: 500 }),
  // Pricing type for this option
  pricingType: mysqlEnum("pricing_type", ["one_time", "subscription", "payment_plan", "free"]).default("one_time").notNull(),
  // Price in cents (total for payment_plan, per-period for subscription, full for one_time)
  price: int("price").default(0).notNull(),
  // Stripe Price ID — if set, used directly; otherwise a price is created on-the-fly
  stripePriceId: varchar("stripe_price_id", { length: 255 }),
  // Subscription interval (only for pricingType=subscription)
  subscriptionInterval: mysqlEnum("subscription_interval", ["monthly", "quarterly", "annual"]),
  // Payment plan fields (only for pricingType=payment_plan)
  downPayment: int("down_payment").default(0), // cents — charged immediately
  installmentCount: int("installment_count").default(0),
  installmentAmount: int("installment_amount").default(0), // cents per installment
  installmentIntervalDays: int("installment_interval_days").default(30),
  // Custom CTA button text override (null = use default "Enroll Now" / "Buy Now")
  ctaLabel: varchar("cta_label", { length: 100 }),
  // Optional external URL — if set, the CTA button links here instead of triggering Stripe checkout
  ctaUrl: varchar("cta_url", { length: 2048 }),
  // Sort order in the pricing options list (lower = shown first)
  sortOrder: int("sort_order").default(0).notNull(),
  // Whether this option is currently shown on the landing page
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});

export type LmsPricingOption = typeof lmsPricingOptions.$inferSelect;

// ─── Physical Products ────────────────────────────────────────────────────────
// A "product" is a physical (or external) item that can be sold on the platform.
// It mirrors the digitalProducts structure but has no downloadable file requirement.
// Supports native Stripe checkout (with shipping address) and Shopify embeds/URLs.


export const lmsThinkificImports = mysqlTable("lms_thinkific_imports", {
  id: int("id").autoincrement().primaryKey(),
  thinkificCourseId: int("thinkific_course_id").notNull(),
  thinkificCourseName: varchar("thinkific_course_name", { length: 255 }).notNull(),
  thinkificSlug: varchar("thinkific_slug", { length: 255 }),
  lmsCourseId: int("lms_course_id"),
  status: mysqlEnum("status", ["pending", "running", "complete", "failed"]).default("pending").notNull(),
  importedByUserId: int("imported_by_user_id").notNull(),
  sectionsImported: int("sections_imported").default(0).notNull(),
  lessonsImported: int("lessons_imported").default(0).notNull(),
  enrollmentsPending: int("enrollments_pending").default(0).notNull(),
  enrollmentsActivated: int("enrollments_activated").default(0).notNull(),
  errorMessage: text("error_message"),
  importLog: longtext("import_log"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsThinkificImport = typeof lmsThinkificImports.$inferSelect;


export const lmsPendingEnrollments = mysqlTable("lms_pending_enrollments", {
  id: int("id").autoincrement().primaryKey(),
  importId: int("import_id").notNull(),
  lmsCourseId: int("lms_course_id").notNull(),
  thinkificUserId: int("thinkific_user_id"),
  thinkificEmail: varchar("thinkific_email", { length: 255 }).notNull(),
  thinkificName: varchar("thinkific_name", { length: 255 }),
  lmsUserId: int("lms_user_id"),
  thinkificEnrolledAt: timestamp("thinkific_enrolled_at"),
  thinkificCompletedAt: timestamp("thinkific_completed_at"),
  thinkificProgressPct: int("thinkific_progress_pct").default(0),
  status: mysqlEnum("status", ["pending", "activated", "skipped"]).default("pending").notNull(),
  activatedAt: timestamp("activated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsPendingEnrollment = typeof lmsPendingEnrollments.$inferSelect;

// --- LMS Archive (30-day soft-delete) ---

export const lmsArchive = mysqlTable("lms_archive", {
  id: int("id").autoincrement().primaryKey(),
  itemType: mysqlEnum("item_type", ["course", "quiz", "download", "product", "bundle"]).notNull(),
  originalId: int("original_id").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  snapshot: longtext("snapshot").notNull(),
  deletedByUserId: int("deleted_by_user_id").notNull(),
  deletedAt: timestamp("deleted_at").defaultNow().notNull(),
  purgeAt: timestamp("purge_at").notNull(),
});
export type LmsArchiveItem = typeof lmsArchive.$inferSelect;

// --- Cross-Domain SSO Tokens ---

export const lessonComments = mysqlTable("lesson_comments", {
  id: int("id").autoincrement().primaryKey(),
  lessonId: int("lesson_id").notNull(),
  userId: int("user_id").notNull(),
  content: text("content").notNull(),
  // Reply threading: null = top-level comment, non-null = reply to that comment id
  parentId: int("parent_id"),
  // Soft delete: set by admin, comment hidden from students but preserved in DB
  deletedAt: timestamp("deleted_at"),
  deletedByAdminId: int("deleted_by_admin_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LessonComment = typeof lessonComments.$inferSelect;
export type InsertLessonComment = typeof lessonComments.$inferInsert;

// ─── Auto-Login Tokens (post-purchase one-time login) ────────────────────────

export const lessonTemplates = mysqlTable("lesson_templates", {
  id: int("id").autoincrement().primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  lessonType: varchar("lesson_type", { length: 64 }).default("video").notNull(),
  blocks: longtext("blocks"),
  coverImage: text("cover_image"),
  tags: text("tags"),
  createdByAdminId: int("created_by_admin_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LessonTemplate = typeof lessonTemplates.$inferSelect;

// ─── Question Bank ─────────────────────────────────────────────────────────────
// Central repository of reusable quiz questions with tagging support.
// Questions are auto-saved here when created via the quiz builder or AI generator.
// Media: questionImageUrl / questionVideoUrl attach to the question stem.
// Options are stored as JSON array of objects: { text, imageUrl?, videoUrl? }
// Quiz-level settings (randomizeQuestions, randomizeAnswers) live on lms_quizzes.


export const lmsCohortSessions = mysqlTable("lms_cohort_sessions", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("course_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  sessionDate: timestamp("session_date").notNull(),
  durationMinutes: int("duration_minutes").default(60).notNull(),
  meetingUrl: text("meeting_url"),
  recordingUrl: text("recording_url"),
  // draft = not yet visible to students; published = visible; cancelled = cancelled
  status: mysqlEnum("status", ["draft", "published", "cancelled"]).default("draft").notNull(),
  // IANA timezone string for this session (e.g. "America/New_York", "Europe/London")
  timezone: varchar("timezone", { length: 64 }).default("America/New_York"),
  // ── Recurrence ──────────────────────────────────────────────────────────────
  // recurrenceRule: weekly | biweekly | monthly | null (one-off)
  recurrenceRule: mysqlEnum("recurrence_rule", ["weekly", "biweekly", "monthly"]),
  // Comma-separated days of week for custom recurrence: "0,1,2,3,4,5,6" (0=Sun)
  recurrenceDaysOfWeek: varchar("recurrence_days_of_week", { length: 20 }),
  recurrenceInterval: int("recurrence_interval").default(1), // multiplier (reserved for future use)
  recurrenceEndDate: timestamp("recurrence_end_date"),       // inclusive last occurrence date
  // Alternative to end date: stop after N occurrences
  recurrenceOccurrenceCount: int("recurrence_occurrence_count"),
  // parentSessionId links child instances back to the template/parent session
  parentSessionId: int("parent_session_id"),
  // Cohort group this session belongs to (null = shared across all groups / single-cohort mode)
  cohortGroupId: int("cohort_group_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsCohortSession = typeof lmsCohortSessions.$inferSelect;
export type InsertLmsCohortSession = typeof lmsCohortSessions.$inferInsert;


export const lmsCohortAssignments = mysqlTable("lms_cohort_assignments", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("course_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  contentBlocks: json("content_blocks").$type<any[]>(),  // page-builder blocks
  dueDate: timestamp("due_date"),
  maxPoints: int("max_points").default(100).notNull(),
  // text = typed submission; file = file upload; url = link submission; none = no submission required
  submissionType: mysqlEnum("submission_type", ["text", "file", "url", "none"]).default("none").notNull(),
  // draft = not yet visible; published = visible to enrolled students
  status: mysqlEnum("status", ["draft", "published"]).default("draft").notNull(),
  position: int("position").default(0).notNull(),
  // Cohort group this assignment belongs to (null = shared / single-cohort mode)
  cohortGroupId: int("cohort_group_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsCohortAssignment = typeof lmsCohortAssignments.$inferSelect;
export type InsertLmsCohortAssignment = typeof lmsCohortAssignments.$inferInsert;

// ─── Cohort Recordings ──────────────────────────────────────────────────────

export const lmsCohortRecordings = mysqlTable("lms_cohort_recordings", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("course_id").notNull(),
  sessionId: int("session_id"),           // optional link to a live session
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  videoUrl: text("video_url"),
  thumbnailUrl: text("thumbnail_url"),
  durationSeconds: int("duration_seconds"),
  status: mysqlEnum("status", ["draft", "published"]).default("draft").notNull(),
  position: int("position").default(0).notNull(),
  // Cohort group this recording belongs to (null = shared / single-cohort mode)
  cohortGroupId: int("cohort_group_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsCohortRecording = typeof lmsCohortRecordings.$inferSelect;
export type InsertLmsCohortRecording = typeof lmsCohortRecordings.$inferInsert;

// ─── Cohort Assignment Submissions ───────────────────────────────────────────

export const lmsCohortSubmissions = mysqlTable("lms_cohort_submissions", {
  id: int("id").autoincrement().primaryKey(),
  assignmentId: int("assignment_id").notNull(),
  userId: int("user_id").notNull(),
  // mirrors assignment submissionType
  submissionType: mysqlEnum("submission_type", ["text", "file", "url", "none"]).default("none").notNull(),
  textContent: text("text_content"),
  fileUrl: text("file_url"),
  fileKey: varchar("file_key", { length: 512 }),
  urlContent: text("url_content"),
  // pending = submitted, awaiting review; graded = instructor has reviewed
  status: mysqlEnum("status", ["pending", "graded"]).default("pending").notNull(),
  grade: decimal("grade", { precision: 6, scale: 2 }),  // optional numeric grade
  feedback: text("feedback"),    // optional instructor feedback
  gradedAt: bigint("graded_at", { mode: "number" }),
  gradedBy: int("graded_by"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsCohortSubmission = typeof lmsCohortSubmissions.$inferSelect;
export type InsertLmsCohortSubmission = typeof lmsCohortSubmissions.$inferInsert;

// ─── Media Upload Folders & Responses ────────────────────────────────────────

export const lmsCohortGroups = mysqlTable("lms_cohort_groups", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("course_id").notNull(), // FK to lms_courses.id (type = 'cohort')
  name: varchar("name", { length: 255 }).notNull(), // e.g. "June 2026 Cohort"
  slug: varchar("slug", { length: 255 }).notNull(), // URL-safe identifier
  description: text("description"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  enrollmentCloseDate: timestamp("enrollment_close_date"),
  maxStudents: int("max_students"), // null = unlimited
  status: mysqlEnum("status", ["draft", "open", "active", "completed", "archived"]).default("draft").notNull(),
  // Page builder blocks for this specific cohort group's overview page
  pageBlocks: longtext("page_blocks"),
  // Landing page link override — which cohort to feature on the course landing page
  isFeaturedOnLanding: boolean("is_featured_on_landing").default(false).notNull(),
  sortOrder: int("sort_order").default(0).notNull(),
  // How many days students retain access from group start date (null = indefinite)
  accessDurationDays: int("access_duration_days"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsCohortGroup = typeof lmsCohortGroups.$inferSelect;
export type InsertLmsCohortGroup = typeof lmsCohortGroups.$inferInsert;

// ─── LMS Cohort Group Enrollments ─────────────────────────────────────────────
// Links a student enrollment to a specific cohort group within a course.

export const lmsCohortGroupEnrollments = mysqlTable("lms_cohort_group_enrollments", {
  id: int("id").autoincrement().primaryKey(),
  cohortGroupId: int("cohort_group_id").notNull(),
  enrollmentId: int("enrollment_id").notNull(), // FK to lms_enrollments.id
  userId: int("user_id").notNull(),
  courseId: int("course_id").notNull(),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});
export type LmsCohortGroupEnrollment = typeof lmsCohortGroupEnrollments.$inferSelect;
export type InsertLmsCohortGroupEnrollment = typeof lmsCohortGroupEnrollments.$inferInsert;

// ─── Cohort Group Messages ────────────────────────────────────────────────────

export const lmsCohortMessages = mysqlTable("lms_cohort_messages", {
  id: int("id").autoincrement().primaryKey(),
  cohortGroupId: int("cohort_group_id").notNull(),
  courseId: int("course_id").notNull(),
  userId: int("user_id").notNull(),
  body: text("body"),
  // JSON array of { url, mimeType, fileName } objects
  mediaUrls: json("media_urls").$type<{ url: string; mimeType: string; fileName: string }[]>(),
  isAdminPost: boolean("is_admin_post").default(false).notNull(),
  isPinned: boolean("is_pinned").default(false).notNull(),
  deletedAt: timestamp("deleted_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsCohortMessage = typeof lmsCohortMessages.$inferSelect;
export type InsertLmsCohortMessage = typeof lmsCohortMessages.$inferInsert;

// Cohort group staff (admins/moderators per cohort group)

export const lmsCohortStaff = mysqlTable("lms_cohort_staff", {
  id: int("id").autoincrement().primaryKey(),
  cohortGroupId: int("cohort_group_id").notNull(),
  courseId: int("course_id").notNull(),
  userId: int("user_id").notNull(),
  role: varchar("role", { length: 20 }).notNull().default("moderator"), // 'admin' | 'moderator'
  canManageDiscussions: boolean("can_manage_discussions").default(true).notNull(),
  canAddSessions: boolean("can_add_sessions").default(false).notNull(),
  canAddAssignments: boolean("can_add_assignments").default(false).notNull(),
  canAddRecordings: boolean("can_add_recordings").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsCohortStaff = typeof lmsCohortStaff.$inferSelect;
export type InsertLmsCohortStaff = typeof lmsCohortStaff.$inferInsert;

// Ultrasound interests (managed by admin, brand-filtered)

export const lmsInterests = mysqlTable("lms_interests", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull(),
  category: varchar("category", { length: 50 }).notNull().default("general"), // 'general' | 'echo' | 'both'
  // brandFilter: 'aaus' = general ultrasound only, 'iheartecho' = echo only, 'both' = all brands
  brandFilter: varchar("brand_filter", { length: 20 }).notNull().default("both"),
  iconEmoji: varchar("icon_emoji", { length: 10 }),
  sortOrder: int("sort_order").notNull().default(0),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsInterest = typeof lmsInterests.$inferSelect;
export type InsertLmsInterest = typeof lmsInterests.$inferInsert;

// User interests (many-to-many)

export const instructorCoursePermissions = mysqlTable("instructor_course_permissions", {
  id: int("id").autoincrement().primaryKey(),
  instructorId: int("instructor_id").notNull(),   // users.id
  courseId: int("course_id").notNull(),            // lms_courses.id
  // true = instructor can publish directly; false = requires admin approval
  canSelfPublish: boolean("can_self_publish").default(false).notNull(),
  grantedByAdminId: int("granted_by_admin_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type InstructorCoursePermission = typeof instructorCoursePermissions.$inferSelect;
export type InsertInstructorCoursePermission = typeof instructorCoursePermissions.$inferInsert;

// ─── Instructor Publish Requests ─────────────────────────────────────────────
// When an instructor without self-publish permission wants to publish a course,
// they submit a request here. Admins approve or reject it.

export const instructorPublishRequests = mysqlTable("instructor_publish_requests", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("course_id").notNull(),
  instructorId: int("instructor_id").notNull(),
  status: mysqlEnum("status", ["pending", "approved", "rejected"]).default("pending").notNull(),
  note: text("note"),
  reviewNote: text("review_note"),
  reviewedByAdminId: int("reviewed_by_admin_id"),
  requestedAt: timestamp("requested_at").defaultNow().notNull(),
  reviewedAt: timestamp("reviewed_at"),
});
export type InstructorPublishRequest = typeof instructorPublishRequests.$inferSelect;
export type InsertInstructorPublishRequest = typeof instructorPublishRequests.$inferInsert;

// ─── Affiliate Course Overrides ───────────────────────────────────────────────
// Per-course affiliate settings: enable/disable affiliate tracking and set a
// course-specific commission % that overrides the affiliate's default rate.

export const instructorPayoutConfig = mysqlTable("instructor_payout_config", {
  id: int("id").autoincrement().primaryKey(),
  instructorUserId: int("instructor_user_id").notNull().unique(),
  preferredMethod: mysqlEnum("preferred_method", ["stripe", "paypal", "ach"]).notNull().default("paypal"),
  // JSON blob: { paypal_email, ach_routing, ach_account, stripe_account_id }
  paymentDetails: text("payment_details"),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type InstructorPayoutConfig = typeof instructorPayoutConfig.$inferSelect;

// ─── Affiliate Course Access ──────────────────────────────────────────────────
// Controls which affiliates can promote which affiliate-enabled courses.
// Admins grant/revoke access per affiliate per course.
// If no row exists for a (affiliateId, courseId) pair, the affiliate cannot
// generate a link for that course even if the course has affiliateEnabled=true.
