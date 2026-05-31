import {
  bigint,
  boolean,
  decimal,
  float,
  index,
  int,
  json,
  longtext,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["site_owner", "site_admin", "org_super_admin", "org_admin", "instructor", "affiliate", "member", "user"]).default("member").notNull(),
  // Custom Teachific auth fields
  passwordHash: varchar("passwordHash", { length: 255 }),
  emailVerified: boolean("emailVerified").default(false).notNull(),
  emailVerificationToken: varchar("emailVerificationToken", { length: 128 }),
  emailVerificationExpiry: timestamp("emailVerificationExpiry"),
  resetToken: varchar("resetToken", { length: 128 }),
  resetTokenExpiry: timestamp("resetTokenExpiry"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
  // QuizCreator standalone product access (none=no access, web=web app, desktop=desktop app, bundle=web+desktop)
  quizCreatorAccess: mysqlEnum("quizCreatorAccess", ["none", "web", "desktop", "bundle"]).default("none").notNull(),
  // QuizCreator 14-day trial end date (null = no trial started, past date = trial expired)
  quizCreatorTrialEndsAt: timestamp("quizCreatorTrialEndsAt"),
  // Teachific Studio standalone product access (none=no access, web=web app, desktop=desktop app, bundle=web+desktop)
  studioAccess: mysqlEnum("studioAccess", ["none", "web", "desktop", "bundle"]).default("none").notNull(),
  // Studio 14-day trial end date (null = no trial started, past date = trial expired)
  studioTrialEndsAt: timestamp("studioTrialEndsAt"),
  // TeachificCreator™ standalone product access (none=no access, web=web app, desktop=desktop app, bundle=web+desktop)
  creatorAccess: mysqlEnum("creatorAccess", ["none", "web", "desktop", "bundle"]).default("none").notNull(),
  // Creator 14-day trial end date (null = no trial started, past date = trial expired)
  creatorTrialEndsAt: timestamp("creatorTrialEndsAt"),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Organizations ────────────────────────────────────────────────────────────
export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  logoUrl: text("logoUrl"),
  ownerId: int("ownerId").notNull(),
  maxStorageBytes: bigint("maxStorageBytes", { mode: "number" }).default(10737418240),
  usedStorageBytes: bigint("usedStorageBytes", { mode: "number" }).default(0),
  isActive: boolean("isActive").default(true).notNull(),
  // Subdomain on teachific.app (uses org slug by default)
  subdomainEnabled: boolean("subdomainEnabled").default(false).notNull(),
  customSubdomain: varchar("customSubdomain", { length: 100 }),
  // Custom domain for Pro+ orgs
  customDomain: varchar("customDomain", { length: 255 }),
  // Custom sender email for Builder+ orgs
  customSenderEmail: varchar("customSenderEmail", { length: 320 }),
  customSenderName: varchar("customSenderName", { length: 255 }),
  senderDomainVerified: boolean("senderDomainVerified").default(false).notNull(),
  senderDomainVerifiedAt: timestamp("senderDomainVerifiedAt"),
  // Legal documents
  termsOfService: text("termsOfService"),
  privacyPolicy: text("privacyPolicy"),
  requireTermsAgreement: boolean("requireTermsAgreement").default(false).notNull(),
  // Footer navigation links (JSON array of {label, url})
  footerLinks: text("footerLinks"),
  // Primary org flag — the owner's default org shown on login
  isPrimary: boolean("isPrimary").default(false).notNull(),
  // TeachificPay / Stripe Connect
  stripeConnectAccountId: varchar("stripeConnectAccountId", { length: 255 }),
  stripeConnectStatus: mysqlEnum("stripeConnectStatus", ["not_connected", "pending", "active", "restricted", "suspended"]).default("not_connected").notNull(),
  paymentGateway: mysqlEnum("paymentGateway", ["teachific_pay", "own_gateway"]).default("teachific_pay").notNull(),
  ownStripePublishableKey: varchar("ownStripePublishableKey", { length: 255 }),
  ownStripeSecretKeyEncrypted: text("ownStripeSecretKeyEncrypted"),
  // Custom domain verification
  domainVerificationStatus: mysqlEnum("domainVerificationStatus", ["unverified", "pending", "verified", "failed"]).default("unverified").notNull(),
  domainVerifiedAt: timestamp("domainVerifiedAt"),
  domainVerificationError: varchar("domainVerificationError", { length: 500 }),
  // Internal platform admin notes (never visible to org admins or members)
  adminNotes: text("adminNotes"),
  // SEO settings for subdomain/custom domain pages
  seoTitle: varchar("seoTitle", { length: 60 }),
  seoDescription: varchar("seoDescription", { length: 160 }),
  seoKeywords: varchar("seoKeywords", { length: 500 }),
  seoOgImageUrl: text("seoOgImageUrl"),
  seoRobotsIndex: boolean("seoRobotsIndex").default(true).notNull(),
  // Custom CSS injected into subdomain/custom domain pages (org admin use only)
  customCss: longtext("customCss"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Organization = typeof organizations.$inferSelect;
export type InsertOrganization = typeof organizations.$inferInsert;

// ─── Organization Members ─────────────────────────────────────────────────────
export const orgMembers = mysqlTable("org_members", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["org_super_admin", "org_admin", "member", "user"]).default("member").notNull(),
  memberSubRole: mysqlEnum("memberSubRole", ["basic_member", "instructor", "group_manager", "group_member"]).default("basic_member"),
  invitedBy: int("invitedBy"),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
});

export type OrgMember = typeof orgMembers.$inferSelect;
export type InsertOrgMember = typeof orgMembers.$inferInsert;

// ─── Content Folders ────────────────────────────────────────────────────────────
export const contentFolders = mysqlTable("content_folders", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  ownerId: int("ownerId").notNull(),
  parentId: int("parentId"), // null = root folder
  name: varchar("name", { length: 255 }).notNull(),
  color: varchar("color", { length: 32 }), // optional accent color
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContentFolder = typeof contentFolders.$inferSelect;
export type InsertContentFolder = typeof contentFolders.$inferInsert;

// ─── Content Packages ─────────────────────────────────────────────────────────
export const contentPackages = mysqlTable("content_packages", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  uploadedBy: int("uploadedBy").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  tags: text("tags"), // JSON string stored as text for TiDB compatibility
  scormVersion: mysqlEnum("scormVersion", ["1.2", "2004", "none"]).default("none").notNull(),
  scormEntryPoint: text("scormEntryPoint"),
  scormManifest: text("scormManifest"), // JSON string
  contentType: mysqlEnum("contentType", ["scorm", "html", "articulate", "ispring", "unknown"]).default("unknown").notNull(),
  // Display mode chosen at import
  displayMode: varchar("displayMode", { length: 20 }).default("native").notNull(), // 'native' | 'lms_shell' | 'quiz'
  lmsShellConfig: text("lmsShellConfig"), // JSON: { themeColor, showSidebar, showProgress, allowNotes, showCompletionBadge }
  llmSummary: text("llmSummary"),
  llmTags: text("llmTags"), // JSON string
  llmValidationNotes: text("llmValidationNotes"),
  originalZipKey: text("originalZipKey").notNull(),
  originalZipUrl: text("originalZipUrl").notNull(),
  originalZipSize: bigint("originalZipSize", { mode: "number" }).default(0),
  extractedFolderKey: text("extractedFolderKey"),
  status: mysqlEnum("status", ["uploading", "processing", "ready", "error"]).default("uploading").notNull(),
  processingError: text("processingError"),
  currentVersionId: int("currentVersionId"),
  totalPlayCount: int("totalPlayCount").default(0).notNull(),
  totalDownloadCount: int("totalDownloadCount").default(0).notNull(),
  isPublic: boolean("isPublic").default(false).notNull(),
  autoFullscreenMobile: boolean("autoFullscreenMobile").default(false).notNull(),
  folderId: int("folderId"), // null = root / uncategorized
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ContentPackage = typeof contentPackages.$inferSelect;
export type InsertContentPackage = typeof contentPackages.$inferInsert;

// ─── Content Versions ─────────────────────────────────────────────────────────
export const contentVersions = mysqlTable("content_versions", {
  id: int("id").autoincrement().primaryKey(),
  packageId: int("packageId").notNull(),
  versionNumber: int("versionNumber").notNull(),
  versionLabel: varchar("versionLabel", { length: 100 }),
  changelog: text("changelog"),
  uploadedBy: int("uploadedBy").notNull(),
  zipKey: text("zipKey").notNull(),
  zipUrl: text("zipUrl").notNull(),
  zipSize: bigint("zipSize", { mode: "number" }).default(0),
  extractedFolderKey: text("extractedFolderKey"),
  entryPoint: text("entryPoint"),
  fileCount: int("fileCount").default(0),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  replacedAt: timestamp("replacedAt"), // set when a newer version becomes current; null = still current
});

export type ContentVersion = typeof contentVersions.$inferSelect;
export type InsertContentVersion = typeof contentVersions.$inferInsert;

// ─── File Assets ──────────────────────────────────────────────────────────────
export const fileAssets = mysqlTable("file_assets", {
  id: int("id").autoincrement().primaryKey(),
  versionId: int("versionId").notNull(),
  packageId: int("packageId").notNull(),
  relativePath: text("relativePath").notNull(),
  s3Key: text("s3Key").notNull(),
  s3Url: text("s3Url").notNull(),
  mimeType: varchar("mimeType", { length: 255 }),
  fileSize: bigint("fileSize", { mode: "number" }).default(0),
  isEntryPoint: boolean("isEntryPoint").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type FileAsset = typeof fileAssets.$inferSelect;

// ─── Permissions ──────────────────────────────────────────────────────────────
export const permissions = mysqlTable("permissions", {
  id: int("id").autoincrement().primaryKey(),
  packageId: int("packageId").notNull().unique(),
  allowDownload: boolean("allowDownload").default(false).notNull(),
  downloadRequiresAuth: boolean("downloadRequiresAuth").default(true).notNull(),
  maxPlaysPerUser: int("maxPlaysPerUser"),
  maxTotalPlays: int("maxTotalPlays"),
  playExpiresAt: timestamp("playExpiresAt"),
  allowEmbed: boolean("allowEmbed").default(true).notNull(),
  allowedEmbedDomains: text("allowedEmbedDomains"), // JSON string
  allowExternalLinks: boolean("allowExternalLinks").default(true).notNull(),
  requiresAuth: boolean("requiresAuth").default(true).notNull(),
  allowedOrgIds: text("allowedOrgIds"), // JSON string
  allowedUserIds: text("allowedUserIds"), // JSON string
  shareToken: varchar("shareToken", { length: 64 }),
  shareTokenExpiresAt: timestamp("shareTokenExpiresAt"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = typeof permissions.$inferInsert;

// ─── Play Sessions ─────────────────────────────────────────────────────────────
export const playSessions = mysqlTable("play_sessions", {
  id: int("id").autoincrement().primaryKey(),
  packageId: int("packageId").notNull(),
  versionId: int("versionId"),
  userId: int("userId"),
  orgId: int("orgId"),
  sessionToken: varchar("sessionToken", { length: 64 }).notNull().unique(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  lastActiveAt: timestamp("lastActiveAt").defaultNow().notNull(),
  endedAt: timestamp("endedAt"),
  durationSeconds: int("durationSeconds").default(0),
  completionStatus: mysqlEnum("completionStatus", ["not_attempted", "incomplete", "completed", "passed", "failed", "unknown"]).default("not_attempted"),
  scoreRaw: float("scoreRaw"),
  scoreMax: float("scoreMax"),
  scoreMin: float("scoreMin"),
  scoreScaled: float("scoreScaled"),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
  referrer: text("referrer"),
  country: varchar("country", { length: 2 }),
  isCompleted: boolean("isCompleted").default(false).notNull(),
  // Dynamic URL parameters for learner identity & tracking
  learnerName:   varchar("learnerName",   { length: 255 }),
  learnerEmail:  varchar("learnerEmail",  { length: 320 }),
  learnerId:     varchar("learnerId",     { length: 128 }),
  learnerGroup:  varchar("learnerGroup",  { length: 128 }),
  customData:    text("customData"),
  utmSource:     varchar("utmSource",     { length: 128 }),
  utmMedium:     varchar("utmMedium",     { length: 128 }),
  utmCampaign:   varchar("utmCampaign",   { length: 128 }),
});

export type PlaySession = typeof playSessions.$inferSelect;
export type InsertPlaySession = typeof playSessions.$inferInsert;

// ─── SCORM CMI Data ───────────────────────────────────────────────────────────
export const scormData = mysqlTable("scorm_data", {
  id: int("id").autoincrement().primaryKey(),
  sessionId: int("sessionId").notNull(),
  packageId: int("packageId").notNull(),
  userId: int("userId"),
  cmiData: text("cmiData"), // JSON string
  suspendData: text("suspendData"),
  lessonStatus: varchar("lessonStatus", { length: 64 }),
  lessonLocation: text("lessonLocation"),
  score: float("score"),
  totalTime: varchar("totalTime", { length: 32 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ScormData = typeof scormData.$inferSelect;

// ─── Analytics Events ─────────────────────────────────────────────────────────
export const analyticsEvents = mysqlTable("analytics_events", {
  id: int("id").autoincrement().primaryKey(),
  packageId: int("packageId").notNull(),
  sessionId: int("sessionId"),
  userId: int("userId"),
  orgId: int("orgId"),
  eventType: mysqlEnum("eventType", [
    "play_start",
    "play_end",
    "play_pause",
    "play_resume",
    "download",
    "scorm_complete",
    "scorm_pass",
    "scorm_fail",
    "page_view",
    "link_click",
    "error",
  ]).notNull(),
  eventData: text("eventData"), // JSON string
  occurredAt: timestamp("occurredAt").defaultNow().notNull(),
}, (table) => ({
  packageIdx: index("analytics_package_idx").on(table.packageId),
  orgIdx: index("analytics_org_idx").on(table.orgId),
  eventTypeIdx: index("analytics_event_type_idx").on(table.eventType),
}));

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;


// ─── Quiz Questions ───────────────────────────────────────────────────────────
export const quizQuestions = mysqlTable("quiz_questions", {
  id: int("id").autoincrement().primaryKey(),
  quizId: int("quizId").notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  questionType: mysqlEnum("questionType", [
    "multiple_choice",
    "true_false",
    "short_answer",
    "long_answer",
    "matching",
    "multiple_select",
    "hotspot",
    "ordering",
    "fill_blank",
    "numeric",
    "rating_scale",
  ]).default("multiple_choice").notNull(),
  questionText: text("questionText").notNull(),
  questionHtml: text("questionHtml"),
  // Media attachments on the question stem
  imageUrl: text("imageUrl"),
  videoUrl: text("videoUrl"),
  videoType: varchar("videoType", { length: 20 }),
  fileUrl: text("fileUrl"),
  fileLabel: varchar("fileLabel", { length: 255 }),
  // Short/Long answer config
  wordLimit: int("wordLimit"),
  charLimit: int("charLimit"),
  rubric: text("rubric"),
  // Hotspot: JSON array of regions [{id,x,y,width,height,label,isCorrect}]
  hotspotRegionsJson: text("hotspotRegionsJson"),
  // Ordering question: JSON array of items in correct order [{id, text}]
  orderingItemsJson: text("orderingItemsJson"),
  // Fill-in-blank: JSON array of accepted answers
  fillBlankAnswersJson: text("fillBlankAnswersJson"),
  // Numeric: correct value and tolerance
  numericAnswer: float("numericAnswer"),
  numericTolerance: float("numericTolerance"),
  // Rating scale: min, max, labels
  ratingMin: int("ratingMin").default(1),
  ratingMax: int("ratingMax").default(5),
  ratingLabelsJson: text("ratingLabelsJson"),
  // Branching: question sortOrder to jump to after correct/incorrect
  branchOnCorrect: int("branchOnCorrect"),
  branchOnIncorrect: int("branchOnIncorrect"),
  explanation: text("explanation"),
  points: float("points").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type QuizQuestion = typeof quizQuestions.$inferSelect;
export type InsertQuizQuestion = typeof quizQuestions.$inferInsert;



// ─── Quiz Responses ───────────────────────────────────────────────────────────
export const quizResponses = mysqlTable("quiz_responses", {
  id: int("id").autoincrement().primaryKey(),
  attemptId: int("attemptId").notNull(),
  questionId: int("questionId").notNull(),
  responseText: text("responseText"),
  selectedChoiceIds: text("selectedChoiceIds"), // JSON array of choice IDs
  isCorrect: boolean("isCorrect"),
  pointsEarned: float("pointsEarned").default(0),
  timeTakenSeconds: int("timeTakenSeconds"),
  answeredAt: timestamp("answeredAt").defaultNow().notNull(),
});

export type QuizResponse = typeof quizResponses.$inferSelect;

// ═══════════════════════════════════════════════════════════════════════════════
// LMS PLATFORM TABLES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Org Theme ────────────────────────────────────────────────────────────────
export const orgThemes = mysqlTable("org_themes", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull().unique(),
  // Admin UI theming (light/dark + custom colors)
  bgMode: mysqlEnum("bgMode", ["light", "dark"]).default("light").notNull(),
  primaryColor: varchar("primaryColor", { length: 32 }).default("#189aa1").notNull(),
  accentColor: varchar("accentColor", { length: 32 }).default("#4ad9e0").notNull(),
  buttonColor: varchar("buttonColor", { length: 32 }),
  buttonTextColor: varchar("buttonTextColor", { length: 32 }),
  sidebarBgColor: varchar("sidebarBgColor", { length: 32 }),
  sidebarTextColor: varchar("sidebarTextColor", { length: 32 }),
  sidebarActiveColor: varchar("sidebarActiveColor", { length: 32 }),
  pageBgColor: varchar("pageBgColor", { length: 32 }),
  fontFamily: varchar("fontFamily", { length: 128 }).default("Inter").notNull(),
  // School branding (student-facing)
  schoolName: varchar("schoolName", { length: 255 }),
  adminLogoUrl: text("adminLogoUrl"),
  faviconUrl: text("faviconUrl"),
  customCss: text("customCss"),
  // Student-facing colors and theme (derived from primary/accent but can be overridden)
  studentPrimaryColor: varchar("studentPrimaryColor", { length: 32 }),
  studentAccentColor: varchar("studentAccentColor", { length: 32 }),
  studentTheme: mysqlEnum("studentTheme", ["light", "dark"]).default("light"),
  // Notification settings (JSON): { enrollment, completion, quizResult, reminder, announcement, weeklyDigest }
  notificationSettings: text("notificationSettings"),
  // Email template overrides (JSON): { logoUrl, primaryColor, footerText, senderName }
  emailBranding: text("emailBranding"),
  // Video player watermark
  watermarkImageUrl: text("watermarkImageUrl"),
  watermarkOpacity: int("watermarkOpacity").default(30), // 0-100
  watermarkPosition: varchar("watermarkPosition", { length: 32 }).default("bottom-left"),
  watermarkSize: int("watermarkSize").default(120), // px
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type OrgTheme = typeof orgThemes.$inferSelect;
export type InsertOrgTheme = typeof orgThemes.$inferInsert;

// ─── Org Subscriptions ────────────────────────────────────────────────────────
export const orgSubscriptions = mysqlTable("org_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull().unique(),
  plan: mysqlEnum("plan", ["free", "starter", "builder", "pro", "enterprise"]).default("free").notNull(),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
  stripeCustomerId: varchar("stripeCustomerId", { length: 255 }),
  status: mysqlEnum("status", ["active", "trialing", "past_due", "cancelled", "unpaid"]).default("active").notNull(),
  currentPeriodStart: timestamp("currentPeriodStart"),
  currentPeriodEnd: timestamp("currentPeriodEnd"),
  cancelAtPeriodEnd: boolean("cancelAtPeriodEnd").default(false).notNull(),
  // Manual Enterprise pricing set by site admin/owner
  customPriceUsd: int("customPriceUsd"), // price in cents, null = use standard pricing
  customPriceLabel: varchar("customPriceLabel", { length: 100 }), // e.g. "$499/mo"
  adminNotes: text("adminNotes"), // internal notes about this org's subscription
  assignedByUserId: int("assignedByUserId"), // who manually assigned this plan
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type OrgSubscription = typeof orgSubscriptions.$inferSelect;

// ─── Instructors ──────────────────────────────────────────────────────────────
export const instructors = mysqlTable("instructors", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  orgId: int("orgId").notNull(),
  displayName: varchar("displayName", { length: 255 }),
  title: varchar("title", { length: 255 }),
  bio: text("bio"),
  avatarUrl: text("avatarUrl"),
  socialLinks: text("socialLinks"), // JSON: { website, twitter, linkedin, etc. }
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Instructor = typeof instructors.$inferSelect;
export type InsertInstructor = typeof instructors.$inferInsert;

// ─── Courses ──────────────────────────────────────────────────────────────────
export const courses = mysqlTable("courses", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  instructorId: int("instructorId"), // FK to instructors.id
  title: varchar("title", { length: 500 }).notNull(),
  slug: varchar("slug", { length: 200 }).notNull(),
  description: text("description"),
  shortDescription: varchar("shortDescription", { length: 500 }),
  thumbnailUrl: text("thumbnailUrl"),
  promoVideoUrl: text("promoVideoUrl"),
  // Status
  status: mysqlEnum("status", ["draft", "published", "hidden", "private", "archived"]).default("draft").notNull(),
  // hidden = published but not listed in catalog (direct link only) — Pro/Enterprise only
  // private = published but requires manual admin enrollment — Pro/Enterprise only
  isPrivate: boolean("isPrivate").default(false).notNull(), // legacy, now use status='private'
  isHidden: boolean("isHidden").default(false).notNull(), // legacy, now use status='hidden'
  disableTextCopy: boolean("disableTextCopy").default(false).notNull(),
  // SEO
  seoTitle: varchar("seoTitle", { length: 255 }),
  seoDescription: text("seoDescription"),
  // Social sharing
  enableChapterShare: boolean("enableChapterShare").default(true).notNull(),
  enableCompletionShare: boolean("enableCompletionShare").default(true).notNull(),
  socialShareText: text("socialShareText"),
  // Player appearance
  playerThemeColor: varchar("playerThemeColor", { length: 32 }),
  playerSidebarStyle: mysqlEnum("playerSidebarStyle", ["full", "minimal", "hidden"]).default("full").notNull(),
  playerShowProgress: boolean("playerShowProgress").default(true).notNull(),
  playerShowProgressPercent: boolean("playerShowProgressPercent").default(true).notNull(),
  playerAllowNotes: boolean("playerAllowNotes").default(false).notNull(),
  playerShowLessonIcons: boolean("playerShowLessonIcons").default(true).notNull(),
  // Completion
  completionType: mysqlEnum("completionType", ["all_lessons", "percentage", "quiz_pass"]).default("all_lessons").notNull(),
  completionPercentage: int("completionPercentage").default(100),
  // Welcome / after purchase
  welcomeEmailEnabled: boolean("welcomeEmailEnabled").default(true).notNull(),
  welcomeEmailSubject: varchar("welcomeEmailSubject", { length: 255 }),
  welcomeEmailBody: text("welcomeEmailBody"),
  afterPurchaseRedirectUrl: text("afterPurchaseRedirectUrl"),
  thankYouPageEnabled: boolean("thankYouPageEnabled").default(false).notNull(),
  thankYouPageBlocks: text("thankYouPageBlocks"), // JSON array of page builder blocks
  upsellCourseId: int("upsellCourseId"),
  // Custom page code
  headerCode: text("headerCode"),
  footerCode: text("footerCode"),
  // Design template
  designTemplate: varchar("designTemplate", { length: 64 }).default("colossal"),
  // Course behaviour
  showCompleteButton: boolean("showCompleteButton").default(true).notNull(),
  enableCertificate: boolean("enableCertificate").default(false).notNull(),
  trackProgress: boolean("trackProgress").default(true).notNull(),
  requireSequential: boolean("requireSequential").default(false).notNull(),
  language: varchar("language", { length: 16 }).default("en"),
  copiedFromId: int("copiedFromId"),
  // Notification overrides at course level (JSON): { enrollment, completion, quizResult, reminder } — null = inherit from org
  notificationOverrides: text("notificationOverrides"),
  // Pre-start page / course overview fields
  whatYouLearn: text("whatYouLearn"), // JSON array of strings
  requirements: text("requirements"), // JSON array of strings
  targetAudience: text("targetAudience"), // JSON array of strings
  instructorBio: text("instructorBio"), // Rich text bio for the instructor shown on pre-start page
  preStartPageEnabled: boolean("preStartPageEnabled").default(true).notNull(),
  // Access duration per course (how long a student has access after enrollment)
  // 'lifetime' = unlimited, 'days' = N days from enrollment, 'date' = fixed expiry date
  accessDurationType: mysqlEnum("accessDurationType", ["lifetime", "days", "date"]).default("lifetime").notNull(),
  accessDurationDays: int("accessDurationDays"), // used when accessDurationType = 'days'
  accessExpiryDate: timestamp("accessExpiryDate"), // used when accessDurationType = 'date'
  // Sort order for catalog/admin reordering
  sortOrder: int("sortOrder").default(0).notNull(),
  // Counters
  totalEnrollments: int("totalEnrollments").default(0).notNull(),
  totalCompletions: int("totalCompletions").default(0).notNull(),
  totalRevenue: float("totalRevenue").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Course = typeof courses.$inferSelect;
export type InsertCourse = typeof courses.$inferInsert;

// ─── Course Sections ──────────────────────────────────────────────────────────
export const courseSections = mysqlTable("course_sections", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("courseId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  sortOrder: int("sortOrder").default(0).notNull(),
  isFreePreview: boolean("isFreePreview").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CourseSection = typeof courseSections.$inferSelect;
export type InsertCourseSection = typeof courseSections.$inferInsert;

// ─── Course Lessons ───────────────────────────────────────────────────────────
export const courseLessons = mysqlTable("course_lessons", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("courseId").notNull(),
  sectionId: int("sectionId").notNull(),
  title: varchar("title", { length: 500 }).notNull(),
  lessonType: mysqlEnum("lessonType", [
    "video",
    "text",
    "scorm",
    "quiz",
    "flashcard",
    "exam",
    "pdf",
    "audio",
    "assignment",
    "live",
    "download",
    "weblink",
    "zoom",
  ]).default("text").notNull(),
  // Content references
  contentJson: text("contentJson"), // rich text / embed config JSON
  videoUrl: text("videoUrl"),
  videoProvider: mysqlEnum("videoProvider", ["upload", "youtube", "vimeo", "wistia"]).default("upload"),
  packageId: int("packageId"), // FK to content_packages for scorm/html lessons
  quizId: int("quizId"),       // FK to quizzes for quiz lessons
  pdfUrl: text("pdfUrl"),
  audioUrl: text("audioUrl"),
  downloadUrl: text("downloadUrl"),
  downloadFileName: varchar("downloadFileName", { length: 255 }),
  webLinkUrl: text("webLinkUrl"), // for weblink lesson type
  richTextAddOn: text("richTextAddOn"), // supplementary rich text for any lesson type
  liveSessionJson: text("liveSessionJson"), // JSON: { platform, meetingUrl, scheduledAt, duration, isRecurring, recurrenceRule }
  // Lesson banners
  startBannerEnabled: boolean("startBannerEnabled").default(false).notNull(),
  startBannerPosition: mysqlEnum("startBannerPosition", ["top", "bottom", "left"]).default("top"),
  startBannerMessage: text("startBannerMessage"),
  startBannerImageUrl: text("startBannerImageUrl"),
  startBannerSound: varchar("startBannerSound", { length: 64 }), // e.g. 'chime', 'bell', 'fanfare', 'none', 'custom'
  startBannerCustomSoundUrl: text("startBannerCustomSoundUrl"), // custom MP3 URL when sound='custom'
  startBannerConfetti: boolean("startBannerConfetti").default(false).notNull(), // fire confetti cannon
  startBannerConfettiStyle: mysqlEnum("startBannerConfettiStyle", ["burst", "cannon", "rain", "fireworks"]).default("burst"),
  startBannerDurationMs: int("startBannerDurationMs").default(5000),
  completeBannerEnabled: boolean("completeBannerEnabled").default(false).notNull(),
  completeBannerPosition: mysqlEnum("completeBannerPosition", ["top", "bottom", "left"]).default("bottom"),
  completeBannerMessage: text("completeBannerMessage"),
  completeBannerImageUrl: text("completeBannerImageUrl"),
  completeBannerSound: varchar("completeBannerSound", { length: 64 }),
  completeBannerCustomSoundUrl: text("completeBannerCustomSoundUrl"), // custom MP3 URL when sound='custom'
  completeBannerConfetti: boolean("completeBannerConfetti").default(false).notNull(), // fire confetti cannon
  completeBannerConfettiStyle: mysqlEnum("completeBannerConfettiStyle", ["burst", "cannon", "rain", "fireworks"]).default("burst"),
  completeBannerDurationMs: int("completeBannerDurationMs").default(5000),
  // Settings
  sortOrder: int("sortOrder").default(0).notNull(),
  durationSeconds: int("durationSeconds"),
  isFreePreview: boolean("isFreePreview").default(false).notNull(),
  isPublished: boolean("isPublished").default(true).notNull(),
  // Prerequisite / gating
  isPrerequisite: boolean("isPrerequisite").default(false).notNull(), // this lesson must be completed before subsequent lessons unlock
  requiresCompletion: boolean("requiresCompletion").default(true).notNull(), // must be fully completed (vs just opened)
  passingScore: int("passingScore"), // minimum quiz/exam score % to count as passed (null = any completion)
  allowSkip: boolean("allowSkip").default(false).notNull(), // learner can skip without completing
  estimatedMinutes: int("estimatedMinutes"), // shown in sidebar as estimated reading/watch time
  // Drip
  dripDays: int("dripDays"), // null = available immediately
  dripDate: timestamp("dripDate"), // specific release date
  dripType: mysqlEnum("dripType", ["immediate", "days_after_enrollment", "specific_date"]).default("immediate").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CourseLesson = typeof courseLessons.$inferSelect;
export type InsertCourseLesson = typeof courseLessons.$inferInsert;

// ─── Course Pricing ───────────────────────────────────────────────────────────
export const coursePricing = mysqlTable("course_pricing", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("courseId").notNull(),
  pricingType: mysqlEnum("pricingType", ["free", "one_time", "subscription", "payment_plan"]).default("free").notNull(),
  name: varchar("name", { length: 255 }), // e.g. "Regular price", "90 Day Access"
  price: float("price").default(0).notNull(),
  salePrice: float("salePrice"),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  accessDays: int("accessDays"), // null = lifetime
  // Subscription
  subscriptionInterval: mysqlEnum("subscriptionInterval", ["monthly", "yearly"]),
  // Payment plan
  installmentCount: int("installmentCount"),
  installmentAmount: float("installmentAmount"),
  // Stripe
  stripePriceId: varchar("stripePriceId", { length: 255 }),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CoursePricing = typeof coursePricing.$inferSelect;
export type InsertCoursePricing = typeof coursePricing.$inferInsert;

// ─── Course Enrollments ───────────────────────────────────────────────────────
export const courseEnrollments = mysqlTable("course_enrollments", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("courseId").notNull(),
  userId: int("userId").notNull(),
  orgId: int("orgId").notNull(),
  pricingId: int("pricingId"), // which pricing option was used
  enrolledAt: timestamp("enrolledAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  expiresAt: timestamp("expiresAt"),
  progressPct: float("progressPct").default(0).notNull(),
  lastLessonId: int("lastLessonId"),
  lastAccessedAt: timestamp("lastAccessedAt"),
  // Payment
  amountPaid: float("amountPaid").default(0),
  currency: varchar("currency", { length: 3 }).default("USD"),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  couponId: int("couponId"),
  isActive: boolean("isActive").default(true).notNull(),
  certificateIssued: boolean("certificateIssued").default(false).notNull(),
});
export type CourseEnrollment = typeof courseEnrollments.$inferSelect;
export type InsertCourseEnrollment = typeof courseEnrollments.$inferInsert;

// ─── Lesson Progress ──────────────────────────────────────────────────────────
export const lessonProgress = mysqlTable("lesson_progress", {
  id: int("id").autoincrement().primaryKey(),
  enrollmentId: int("enrollmentId").notNull(),
  lessonId: int("lessonId").notNull(),
  userId: int("userId").notNull(),
  courseId: int("courseId").notNull(),
  status: mysqlEnum("status", ["not_started", "in_progress", "completed"]).default("not_started").notNull(),
  completedAt: timestamp("completedAt"),
  timeSpentSeconds: int("timeSpentSeconds").default(0),
  scormData: text("scormData"), // JSON: SCORM cmi data
  quizScore: float("quizScore"),
  quizPassed: boolean("quizPassed"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LessonProgress = typeof lessonProgress.$inferSelect;
export type InsertLessonProgress = typeof lessonProgress.$inferInsert;

// ─── Coupons ──────────────────────────────────────────────────────────────────
export const coupons = mysqlTable("coupons", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  code: varchar("code", { length: 64 }).notNull(),
  discountType: mysqlEnum("discountType", ["percentage", "fixed"]).default("percentage").notNull(),
  discountValue: float("discountValue").notNull(),
  maxUses: int("maxUses"), // null = unlimited
  usedCount: int("usedCount").default(0).notNull(),
  expiresAt: timestamp("expiresAt"),
  appliesToCourseIds: text("appliesToCourseIds"), // JSON array, null = all courses
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Coupon = typeof coupons.$inferSelect;
export type InsertCoupon = typeof coupons.$inferInsert;

// ─── Certificates ─────────────────────────────────────────────────────────────
export const certificates = mysqlTable("certificates", {
  id: int("id").autoincrement().primaryKey(),
  enrollmentId: int("enrollmentId").notNull(),
  userId: int("userId").notNull(),
  courseId: int("courseId").notNull(),
  orgId: int("orgId").notNull(),
  issuedAt: timestamp("issuedAt").defaultNow().notNull(),
  certUrl: text("certUrl"), // S3 URL to generated PDF
  certKey: text("certKey"), // S3 key
  certData: text("certData"), // JSON: student name, course name, date, etc.
  verificationCode: varchar("verificationCode", { length: 64 }).unique(),
});
export type Certificate = typeof certificates.$inferSelect;
export type InsertCertificate = typeof certificates.$inferInsert;

// ─── Page Builder Pages ───────────────────────────────────────────────────────
export const pageBuilderPages = mysqlTable("page_builder_pages", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  courseId: int("courseId"), // null = site-level page (home, about, etc.)
  pageType: mysqlEnum("pageType", ["course_sales", "school_home", "custom", "checkout", "thank_you"]).default("course_sales").notNull(),
  slug: varchar("slug", { length: 200 }),
  title: varchar("title", { length: 255 }),
  blocksJson: text("blocksJson").notNull().default("[]"), // JSON array of block objects
  isPublished: boolean("isPublished").default(false).notNull(),
  showHeader: boolean("showHeader").default(true).notNull(),
  showFooter: boolean("showFooter").default(true).notNull(),
  metaTitle: varchar("metaTitle", { length: 255 }),
  metaDescription: text("metaDescription"),
  customCss: text("customCss"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PageBuilderPage = typeof pageBuilderPages.$inferSelect;
export type InsertPageBuilderPage = typeof pageBuilderPages.$inferInsert;

// ─── Course Reviews ───────────────────────────────────────────────────────────
export const courseReviews = mysqlTable("course_reviews", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("courseId").notNull(),
  userId: int("userId").notNull(),
  orgId: int("orgId").notNull(),
  rating: int("rating").notNull(), // 1-5
  reviewText: text("reviewText"),
  isPublished: boolean("isPublished").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CourseReview = typeof courseReviews.$inferSelect;
export type InsertCourseReview = typeof courseReviews.$inferInsert;

// ─── Platform Settings ────────────────────────────────────────────────────────
// Singleton table (always id=1) for global platform configuration
export const platformSettings = mysqlTable("platform_settings", {
  id: int("id").autoincrement().primaryKey(),
  allowPublicRegistration: boolean("allowPublicRegistration").default(false).notNull(),
  maintenanceMode: boolean("maintenanceMode").default(false).notNull(),
  platformName: varchar("platformName", { length: 255 }).default("Teachific").notNull(),
  supportEmail: varchar("supportEmail", { length: 320 }),
  maxUploadSizeMb: int("maxUploadSizeMb").default(500).notNull(),
  enterpriseMaxUploadSizeMb: int("enterpriseMaxUploadSizeMb").default(5000).notNull(),
  // Platform branding
  logoUrl: text("logoUrl"),
  faviconUrl: text("faviconUrl"),
  primaryColor: varchar("primaryColor", { length: 32 }).default("#189aa1").notNull(),
  accentColor: varchar("accentColor", { length: 32 }).default("#4ad9e0").notNull(),
  buttonColor: varchar("buttonColor", { length: 32 }),
  buttonTextColor: varchar("buttonTextColor", { length: 32 }),
  sidebarBgColor: varchar("sidebarBgColor", { length: 32 }),
  sidebarTextColor: varchar("sidebarTextColor", { length: 32 }),
  sidebarActiveColor: varchar("sidebarActiveColor", { length: 32 }),
  pageBgColor: varchar("pageBgColor", { length: 32 }),
  tagline: varchar("tagline", { length: 500 }),
  headingFont: varchar("headingFont", { length: 128 }).default("Inter"),
  bodyFont: varchar("bodyFont", { length: 128 }).default("Inter"),
  // Platform-level legal policies (independent of any org)
  termsOfService: text("termsOfService"),
  privacyPolicy: text("privacyPolicy"),
  // Platform-wide video watermark
  watermarkImageUrl: text("watermarkImageUrl"),
  watermarkOpacity: int("watermarkOpacity").default(30),
  watermarkPosition: varchar("watermarkPosition", { length: 32 }).default("bottom-left"),
  watermarkSize: int("watermarkSize").default(120),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type PlatformSettings = typeof platformSettings.$inferSelect;

// ─── Email Marketing: Templates ───────────────────────────────────────────────
export const emailTemplates = mysqlTable("email_templates", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId"), // null = site-wide template (for site owner)
  name: varchar("name", { length: 255 }).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  htmlBody: text("htmlBody").notNull(),
  textBody: text("textBody"),
  isDefault: boolean("isDefault").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = typeof emailTemplates.$inferInsert;

// ─── Email Marketing: Campaigns ───────────────────────────────────────────────
export const emailCampaigns = mysqlTable("email_campaigns", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId"), // null = site owner campaign
  name: varchar("name", { length: 255 }).notNull(),
  templateId: int("templateId"),
  subject: varchar("subject", { length: 255 }).notNull(),
  htmlBody: text("htmlBody").notNull(),
  textBody: text("textBody"),
  status: mysqlEnum("status", ["draft", "scheduled", "sending", "sent", "failed"]).default("draft").notNull(),
  scheduledAt: timestamp("scheduledAt"),
  sentAt: timestamp("sentAt"),
  recipientCount: int("recipientCount").default(0).notNull(),
  sentCount: int("sentCount").default(0).notNull(),
  failedCount: int("failedCount").default(0).notNull(),
  openCount: int("openCount").default(0).notNull(),
  clickCount: int("clickCount").default(0).notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmailCampaign = typeof emailCampaigns.$inferSelect;
export type InsertEmailCampaign = typeof emailCampaigns.$inferInsert;

// ─── Email Marketing: Campaign Recipients ─────────────────────────────────────
export const emailCampaignRecipients = mysqlTable("email_campaign_recipients", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaignId").notNull(),
  userId: int("userId"),
  email: varchar("email", { length: 320 }).notNull(),
  status: mysqlEnum("status", ["pending", "sent", "failed", "bounced"]).default("pending").notNull(),
  sentAt: timestamp("sentAt"),
  openedAt: timestamp("openedAt"),
  clickedAt: timestamp("clickedAt"),
  errorMessage: text("errorMessage"),
});

export type EmailCampaignRecipient = typeof emailCampaignRecipients.$inferSelect;
export type InsertEmailCampaignRecipient = typeof emailCampaignRecipients.$inferInsert;

// ─── Email Marketing: Unsubscribes ────────────────────────────────────────────
export const emailUnsubscribes = mysqlTable("email_unsubscribes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  email: varchar("email", { length: 320 }).notNull(),
  orgId: int("orgId"), // null = unsubscribed from site-level emails
  unsubscribedAt: timestamp("unsubscribedAt").defaultNow().notNull(),
  reason: text("reason"),
});

export type EmailUnsubscribe = typeof emailUnsubscribes.$inferSelect;
export type InsertEmailUnsubscribe = typeof emailUnsubscribes.$inferInsert;

// ─── Custom Auth: Password & Reset Tokens ─────────────────────────────────────
// Extend users table with custom auth fields (migration will add these columns)
// passwordHash: hashed password (bcrypt)
// emailVerified: boolean
// emailVerificationToken: token for email verification
// emailVerificationExpiry: expiry timestamp for verification token
// resetToken: token for password reset
// resetTokenExpiry: expiry timestamp for reset token

// ─── Member Activity Events ───────────────────────────────────────────────────
// Tracks every meaningful user interaction: page views, video events, clicks, sessions
export const memberActivityEvents = mysqlTable("member_activity_events", {
  id: bigint("id", { mode: "number" }).autoincrement().primaryKey(),
  // Who
  userId: int("userId"),                        // null = anonymous / embed
  orgId: int("orgId"),
  sessionKey: varchar("sessionKey", { length: 64 }), // client-generated session UUID
  // What
  eventType: mysqlEnum("eventType", [
    "page_view",
    "page_exit",
    "session_start",
    "session_heartbeat",
    "session_end",
    "video_play",
    "video_pause",
    "video_seek",
    "video_complete",
    "video_progress",
    "lesson_start",
    "lesson_complete",
    "quiz_start",
    "quiz_submit",
    "download",
    "link_click",
    "button_click",
    "search",
    "enrollment",
    "course_complete",
  ]).notNull(),
  // Context
  pageUrl: varchar("pageUrl", { length: 2048 }),
  pageTitle: varchar("pageTitle", { length: 500 }),
  courseId: int("courseId"),
  lessonId: int("lessonId"),
  quizId: int("quizId"),
  // Timing
  durationMs: int("durationMs"),
  videoPositionSec: float("videoPositionSec"),
  videoDurationSec: float("videoDurationSec"),
  // Extra metadata (JSON)
  metadata: text("metadata"),
  // Device / browser context
  userAgent: varchar("userAgent", { length: 512 }),
  referrer: varchar("referrer", { length: 2048 }),
  // Timestamp
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type MemberActivityEvent = typeof memberActivityEvents.$inferSelect;
export type InsertMemberActivityEvent = typeof memberActivityEvents.$inferInsert;

// ─── Digital Downloads ────────────────────────────────────────────────────────

export const digitalProducts = mysqlTable("digital_products", {
  id: int("id").primaryKey().autoincrement(),
  orgId: int("orgId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  description: text("description"),
  fileUrl: text("fileUrl").notNull(),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  fileType: varchar("fileType", { length: 100 }),
  fileSize: bigint("fileSize", { mode: "number" }),
  thumbnailUrl: text("thumbnailUrl"),
  salesPageBlocksJson: json("salesPageBlocksJson"),
  isPublished: boolean("isPublished").default(false),
  // Visibility status (supersedes isPublished for richer control)
  visibility: mysqlEnum("visibility", ["draft", "published", "hidden", "private", "archived"]).default("draft").notNull(),
  // Access controls (defaults applied at order creation)
  defaultAccessDays: int("defaultAccessDays"), // null = lifetime
  defaultMaxDownloads: int("defaultMaxDownloads"), // null = unlimited
  createdAt: timestamp("createdAt").defaultNow(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export const digitalProductPrices = mysqlTable("digital_product_prices", {
  id: int("id").primaryKey().autoincrement(),
  productId: int("productId").notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  type: varchar("type", { length: 50 }).notNull(), // "one_time" | "payment_plan"
  amount: varchar("amount", { length: 20 }).notNull(), // stored as string e.g. "49.99"
  currency: varchar("currency", { length: 3 }).default("USD"),
  installments: int("installments"), // payment_plan: number of payments
  installmentAmount: varchar("installmentAmount", { length: 20 }), // amount per installment
  intervalDays: int("intervalDays"), // days between installments
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow(),
});

export const digitalOrders = mysqlTable("digital_orders", {
  id: int("id").primaryKey().autoincrement(),
  productId: int("productId").notNull(),
  priceId: int("priceId").notNull(),
  orgId: int("orgId").notNull(),
  buyerEmail: varchar("buyerEmail", { length: 255 }).notNull(),
  buyerName: varchar("buyerName", { length: 255 }),
  amount: varchar("amount", { length: 20 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD"),
  status: varchar("status", { length: 50 }).notNull().default("pending"), // "pending" | "paid" | "expired" | "refunded"
  paymentRef: varchar("paymentRef", { length: 255 }),
  downloadToken: varchar("downloadToken", { length: 64 }).notNull(),
  accessExpiresAt: timestamp("accessExpiresAt"), // null = no expiry
  maxDownloads: int("maxDownloads"), // null = unlimited
  downloadCount: int("downloadCount").default(0),
  notes: text("notes"), // admin notes
  createdAt: timestamp("createdAt").defaultNow(),
  paidAt: timestamp("paidAt"),
});

export const digitalDownloadLogs = mysqlTable("digital_download_logs", {
  id: int("id").primaryKey().autoincrement(),
  orderId: int("orderId").notNull(),
  productId: int("productId").notNull(),
  downloadedAt: timestamp("downloadedAt").defaultNow(),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
});

export type DigitalProduct = typeof digitalProducts.$inferSelect;
export type DigitalProductPrice = typeof digitalProductPrices.$inferSelect;
export type DigitalOrder = typeof digitalOrders.$inferSelect;
export type DigitalDownloadLog = typeof digitalDownloadLogs.$inferSelect;

// ─── Webinars ─────────────────────────────────────────────────────────────────
export const webinars = mysqlTable("webinars", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  description: text("description"),
  // Type: live (scheduled) or evergreen (on-demand replay)
  type: mysqlEnum("type", ["live", "evergreen"]).default("evergreen").notNull(),
  // Video source
  videoSource: mysqlEnum("videoSource", ["upload", "youtube", "vimeo", "zoom", "teams", "embed"]).default("youtube"),
  videoUrl: text("videoUrl"),       // YouTube/Vimeo/embed URL
  videoFileUrl: text("videoFileUrl"), // Uploaded video S3 URL
  videoFileKey: text("videoFileKey"),
  // Zoom/Teams integration
  meetingUrl: text("meetingUrl"),   // Zoom/Teams join URL
  meetingId: varchar("meetingId", { length: 128 }),
  // Schedule (for live webinars)
  scheduledAt: timestamp("scheduledAt"),
  durationMinutes: int("durationMinutes").default(60),
  timezone: varchar("timezone", { length: 64 }).default("America/New_York"),
  // Evergreen replay settings
  replayDelayMinutes: int("replayDelayMinutes").default(0), // delay before video starts
  // AI viewer seeding
  aiViewersEnabled: boolean("aiViewersEnabled").default(false),
  aiViewersMin: int("aiViewersMin").default(50),
  aiViewersMax: int("aiViewersMax").default(300),
  aiViewersPeakAt: int("aiViewersPeakAt").default(30), // minutes into webinar
  // Sales page
  salesPageBlocksJson: json("salesPageBlocksJson"),
  thumbnailUrl: text("thumbnailUrl"),
  // Registration settings
  requireRegistration: boolean("requireRegistration").default(true),
  registrationFormFields: json("registrationFormFields"), // [{name, type, required}]
  // Post-webinar funnel
  postWebinarAction: mysqlEnum("postWebinarAction", ["product", "url", "thankyou", "none"]).default("none"),
  postWebinarProductId: int("postWebinarProductId"), // digital product or course id
  postWebinarUrl: text("postWebinarUrl"),
  postWebinarMessage: text("postWebinarMessage"),
  postWebinarDelaySeconds: int("postWebinarDelaySeconds").default(0),
  // Status
  isPublished: boolean("isPublished").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow(),
});

export const webinarRegistrations = mysqlTable("webinar_registrations", {
  id: int("id").autoincrement().primaryKey(),
  webinarId: int("webinarId").notNull(),
  orgId: int("orgId").notNull(),
  firstName: varchar("firstName", { length: 128 }),
  lastName: varchar("lastName", { length: 128 }),
  email: varchar("email", { length: 320 }).notNull(),
  phone: varchar("phone", { length: 32 }),
  customFields: json("customFields"), // answers to extra registration form fields
  registeredAt: timestamp("registeredAt").defaultNow().notNull(),
  attended: boolean("attended").default(false),
  watchedSeconds: int("watchedSeconds").default(0),
  completedAt: timestamp("completedAt"),
  convertedAt: timestamp("convertedAt"), // clicked post-webinar CTA
  ipAddress: varchar("ipAddress", { length: 45 }),
});

export const webinarSessions = mysqlTable("webinar_sessions", {
  id: int("id").autoincrement().primaryKey(),
  webinarId: int("webinarId").notNull(),
  registrationId: int("registrationId"),
  sessionToken: varchar("sessionToken", { length: 128 }).notNull().unique(),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  lastHeartbeatAt: timestamp("lastHeartbeatAt").defaultNow(),
  endedAt: timestamp("endedAt"),
  watchedSeconds: int("watchedSeconds").default(0),
  peakViewerCount: int("peakViewerCount").default(0),
  ipAddress: varchar("ipAddress", { length: 45 }),
  userAgent: text("userAgent"),
});

export const webinarFunnelSteps = mysqlTable("webinar_funnel_steps", {
  id: int("id").autoincrement().primaryKey(),
  webinarId: int("webinarId").notNull(),
  stepOrder: int("stepOrder").default(0),
  stepType: mysqlEnum("stepType", ["registration", "confirmation", "reminder", "watch", "offer", "thankyou"]).notNull(),
  title: varchar("title", { length: 255 }),
  pageBlocksJson: json("pageBlocksJson"),
  emailSubject: varchar("emailSubject", { length: 255 }),
  emailBody: text("emailBody"),
  triggerType: mysqlEnum("triggerType", ["immediate", "delay", "scheduled"]).default("immediate"),
  triggerDelayMinutes: int("triggerDelayMinutes").default(0),
  isActive: boolean("isActive").default(true),
});

export type Webinar = typeof webinars.$inferSelect;
export type WebinarRegistration = typeof webinarRegistrations.$inferSelect;
export type WebinarSession = typeof webinarSessions.$inferSelect;
export type WebinarFunnelStep = typeof webinarFunnelSteps.$inferSelect;

// ─── Categories ───────────────────────────────────────────────────────────────
export const categories = mysqlTable("categories", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 32 }).default("#0ea5e9"),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Category = typeof categories.$inferSelect;
export type InsertCategory = typeof categories.$inferInsert;

// ─── Course Categories (many-to-many) ─────────────────────────────────────────
export const courseCategories = mysqlTable("course_categories", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("courseId").notNull(),
  categoryId: int("categoryId").notNull(),
});
export type CourseCategory = typeof courseCategories.$inferSelect;

// ─── Groups ───────────────────────────────────────────────────────────────────
export const groups = mysqlTable("groups", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  managerId: int("managerId"),
  managerName: varchar("managerName", { length: 255 }),
  managerTitle: varchar("managerTitle", { length: 255 }),
  managerEmail: varchar("managerEmail", { length: 320 }),
  managerPhone: varchar("managerPhone", { length: 50 }),
  productIds: text("productIds"), // JSON array of course/product IDs assigned to this group
  welcomeEmailSent: boolean("welcomeEmailSent").default(false).notNull(),
  seats: int("seats").default(10).notNull(),
  usedSeats: int("usedSeats").default(0).notNull(),
  courseId: int("courseId"),
  notes: text("notes"),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Group = typeof groups.$inferSelect;
export type InsertGroup = typeof groups.$inferInsert;

// ─── Group Members ────────────────────────────────────────────────────────────
export const groupMembers = mysqlTable("group_members", {
  id: int("id").autoincrement().primaryKey(),
  groupId: int("groupId").notNull(),
  userId: int("userId"),
  email: varchar("email", { length: 320 }).notNull(),
  name: varchar("name", { length: 255 }),
  status: mysqlEnum("status", ["invited", "active", "removed"]).default("invited").notNull(),
  enrolledAt: timestamp("enrolledAt").defaultNow().notNull(),
});
export type GroupMember = typeof groupMembers.$inferSelect;
export type InsertGroupMember = typeof groupMembers.$inferInsert;

// ─── Discussions ──────────────────────────────────────────────────────────────
export const discussions = mysqlTable("discussions", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  courseId: int("courseId"),
  title: varchar("title", { length: 500 }).notNull(),
  body: text("body"),
  authorId: int("authorId").notNull(),
  authorName: varchar("authorName", { length: 255 }),
  isPinned: boolean("isPinned").default(false).notNull(),
  status: mysqlEnum("status", ["open", "resolved", "closed"]).default("open").notNull(),
  replyCount: int("replyCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Discussion = typeof discussions.$inferSelect;
export type InsertDiscussion = typeof discussions.$inferInsert;

// ─── Discussion Replies ───────────────────────────────────────────────────────
export const discussionReplies = mysqlTable("discussion_replies", {
  id: int("id").autoincrement().primaryKey(),
  discussionId: int("discussionId").notNull(),
  authorId: int("authorId").notNull(),
  authorName: varchar("authorName", { length: 255 }),
  body: text("body").notNull(),
  isInstructorReply: boolean("isInstructorReply").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type DiscussionReply = typeof discussionReplies.$inferSelect;
export type InsertDiscussionReply = typeof discussionReplies.$inferInsert;

// ─── Assignments ──────────────────────────────────────────────────────────────
export const assignments = mysqlTable("assignments", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  courseId: int("courseId"),
  title: varchar("title", { length: 500 }).notNull(),
  description: text("description"),
  dueDate: timestamp("dueDate"),
  maxScore: int("maxScore").default(100),
  status: mysqlEnum("status", ["draft", "active", "closed"]).default("draft").notNull(),
  allowFileUpload: boolean("allowFileUpload").default(true).notNull(),
  allowTextSubmission: boolean("allowTextSubmission").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Assignment = typeof assignments.$inferSelect;
export type InsertAssignment = typeof assignments.$inferInsert;

// ─── Assignment Submissions ───────────────────────────────────────────────────
export const assignmentSubmissions = mysqlTable("assignment_submissions", {
  id: int("id").autoincrement().primaryKey(),
  assignmentId: int("assignmentId").notNull(),
  userId: int("userId").notNull(),
  userName: varchar("userName", { length: 255 }),
  userEmail: varchar("userEmail", { length: 320 }),
  body: text("body"),
  fileUrl: text("fileUrl"),
  fileKey: text("fileKey"),
  grade: varchar("grade", { length: 32 }),
  score: int("score"),
  feedback: text("feedback"),
  status: mysqlEnum("status", ["pending", "graded", "returned"]).default("pending").notNull(),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
  gradedAt: timestamp("gradedAt"),
});
export type AssignmentSubmission = typeof assignmentSubmissions.$inferSelect;
export type InsertAssignmentSubmission = typeof assignmentSubmissions.$inferInsert;

// ─── Certificate Templates ────────────────────────────────────────────────────
export const certificateTemplates = mysqlTable("certificate_templates", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  htmlTemplate: text("htmlTemplate"),
  previewImageUrl: text("previewImageUrl"),
  isDefault: boolean("isDefault").default(false).notNull(),
  // Branding fields
  logoUrl: text("logoUrl"),
  primaryColor: varchar("primaryColor", { length: 32 }),
  accentColor: varchar("accentColor", { length: 32 }),
  bgStyle: mysqlEnum("bgStyle", ["white", "light", "gradient", "dark"]).default("white"),
  signatureName: varchar("signatureName", { length: 255 }),
  signatureTitle: varchar("signatureTitle", { length: 255 }),
  signatureImageUrl: text("signatureImageUrl"),
  footerText: text("footerText"),
  showTeachificBranding: boolean("showTeachificBranding").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CertificateTemplate = typeof certificateTemplates.$inferSelect;
export type InsertCertificateTemplate = typeof certificateTemplates.$inferInsert;

// ─── Affiliates ───────────────────────────────────────────────────────────────
export const affiliates = mysqlTable("affiliates", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  userId: int("userId"),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  code: varchar("code", { length: 64 }).notNull().unique(),
  commissionType: mysqlEnum("commissionType", ["percentage", "fixed"]).default("percentage").notNull(),
  commissionValue: float("commissionValue").default(20).notNull(),
  totalClicks: int("totalClicks").default(0).notNull(),
  totalSales: int("totalSales").default(0).notNull(),
  totalEarned: float("totalEarned").default(0).notNull(),
  totalPaid: float("totalPaid").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Affiliate = typeof affiliates.$inferSelect;
export type InsertAffiliate = typeof affiliates.$inferInsert;

// ─── Revenue Partners ─────────────────────────────────────────────────────────
export const revenuePartners = mysqlTable("revenue_partners", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  shareType: mysqlEnum("shareType", ["percentage", "fixed"]).default("percentage").notNull(),
  shareValue: float("shareValue").default(10).notNull(),
  appliesTo: mysqlEnum("appliesTo", ["all", "specific"]).default("all").notNull(),
  courseIds: text("courseIds"),
  totalEarned: float("totalEarned").default(0).notNull(),
  totalPaid: float("totalPaid").default(0).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type RevenuePartner = typeof revenuePartners.$inferSelect;
export type InsertRevenuePartner = typeof revenuePartners.$inferInsert;

// ─── Course Orders (LMS) ──────────────────────────────────────────────────────
export const courseOrders = mysqlTable("course_orders", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  userId: int("userId"),
  customerName: varchar("customerName", { length: 255 }),
  customerEmail: varchar("customerEmail", { length: 320 }).notNull(),
  courseId: int("courseId"),
  pricingId: int("pricingId"),
  productType: mysqlEnum("productType", ["course", "bundle", "membership", "digital"]).default("course").notNull(),
  productName: varchar("productName", { length: 255 }),
  amount: float("amount").default(0).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  status: mysqlEnum("status", ["pending", "completed", "refunded", "failed"]).default("pending").notNull(),
  couponId: int("couponId"),
  couponCode: varchar("couponCode", { length: 64 }),
  discountAmount: float("discountAmount").default(0),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CourseOrder = typeof courseOrders.$inferSelect;
export type InsertCourseOrder = typeof courseOrders.$inferInsert;

// ─── Memberships ──────────────────────────────────────────────────────────────
export const memberships = mysqlTable("memberships", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  price: float("price").default(0).notNull(),
  billingInterval: mysqlEnum("billingInterval", ["monthly", "yearly", "one_time"]).default("monthly").notNull(),
  trialDays: int("trialDays").default(0),
  courseAccess: mysqlEnum("courseAccess", ["all", "specific"]).default("all").notNull(),
  courseIds: text("courseIds"),
  isActive: boolean("isActive").default(true).notNull(),
  memberCount: int("memberCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Membership = typeof memberships.$inferSelect;
export type InsertMembership = typeof memberships.$inferInsert;

// ─── Bundles ──────────────────────────────────────────────────────────────────
export const bundles = mysqlTable("bundles", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  thumbnailUrl: text("thumbnailUrl"),
  price: float("price").default(0).notNull(),
  salePrice: float("salePrice"),
  courseIds: text("courseIds").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  totalEnrollments: int("totalEnrollments").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type Bundle = typeof bundles.$inferSelect;
export type InsertBundle = typeof bundles.$inferInsert;

// ─── Forms ────────────────────────────────────────────────────────────────────
export const forms = mysqlTable("forms", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  slug: varchar("slug", { length: 200 }).notNull(),
  status: mysqlEnum("status", ["draft", "published", "closed"]).default("draft").notNull(),
  // Email routing: list of email addresses (JSON array) to notify on submission
  notifyEmails: text("notifyEmails"),
  // Notify the org admin on every submission
  notifyOrgAdmin: boolean("notifyOrgAdmin").default(false).notNull(),
  // Send a copy of the submission to the respondent
  notifyRespondent: boolean("notifyRespondent").default(false).notNull(),
  // Whether to send a confirmation email to the respondent
  sendConfirmation: boolean("sendConfirmation").default(false).notNull(),
  confirmationEmailField: varchar("confirmationEmailField", { length: 100 }),
  confirmationSubject: varchar("confirmationSubject", { length: 255 }),
  confirmationBody: text("confirmationBody"),
  // Post-submit settings
  successMessage: text("successMessage"),
  successMessageHtml: text("successMessageHtml"),
  redirectUrl: text("redirectUrl"),
  showPageProgressBar: boolean("showPageProgressBar").default(true).notNull(),
  // Access
  requireLogin: boolean("requireLogin").default(false).notNull(),
  allowMultipleSubmissions: boolean("allowMultipleSubmissions").default(true).notNull(),
  // Styling — per-form overrides (null = use org defaults)
  primaryColor: varchar("primaryColor", { length: 20 }),
  buttonColor: varchar("buttonColor", { length: 20 }),
  buttonTextColor: varchar("buttonTextColor", { length: 20 }),
  headerBgColor: varchar("headerBgColor", { length: 20 }),
  headerTextColor: varchar("headerTextColor", { length: 20 }),
  fontFamily: varchar("fontFamily", { length: 100 }),
  headerImageUrl: text("headerImageUrl"),
  // When true, inherit org site settings for branding
  useOrgBranding: boolean("useOrgBranding").default(true).notNull(),
  // Custom CSS injected into the form player
  customCss: text("customCss"),
  // Member variable field mappings (JSON: [{fieldId, varName}])
  memberVarMappings: text("memberVarMappings"),
  submissionCount: int("submissionCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type Form = typeof forms.$inferSelect;
export type InsertForm = typeof forms.$inferInsert;

// ─── Form Fields ──────────────────────────────────────────────────────────────
export const formFields = mysqlTable("form_fields", {
  id: int("id").autoincrement().primaryKey(),
  formId: int("formId").notNull(),
  // Field type: short_answer, long_answer, dropdown, radio, checkbox, email, number, date, section_break, statement
  type: varchar("type", { length: 50 }).notNull(),
  label: text("label").notNull(),
  placeholder: text("placeholder"),
  helpText: text("helpText"),
  required: boolean("required").default(false).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  // Options for choice fields (JSON array of {value, label})
  options: text("options"),
  // Validation
  minLength: int("minLength"),
  maxLength: int("maxLength"),
  // Whether this field can trigger branching rules
  isBranchingSource: boolean("isBranchingSource").default(false).notNull(),
  // If set, this field is hidden from the form and auto-populated with the member variable
  isHidden: boolean("isHidden").default(false).notNull(),
  // Member variable name to auto-populate (e.g. 'name', 'email', 'org', custom attr key)
  memberVarName: varchar("memberVarName", { length: 100 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type FormField = typeof formFields.$inferSelect;
export type InsertFormField = typeof formFields.$inferInsert;

// ─── Form Branching Rules ─────────────────────────────────────────────────────
// Each rule: IF field X [operator] value THEN [action] field/page Y
export const formBranchingRules = mysqlTable("form_branching_rules", {
  id: int("id").autoincrement().primaryKey(),
  formId: int("formId").notNull(),
  // The field whose answer triggers this rule
  sourceFieldId: int("sourceFieldId").notNull(),
  // Operator: equals, not_equals, contains, not_contains, is_empty, is_not_empty
  operator: varchar("operator", { length: 50 }).notNull(),
  // The value to compare against
  value: text("value"),
  // Action: show_field, hide_field, jump_to_field, submit_form
  action: varchar("action", { length: 50 }).notNull(),
  // Target field id (for show/hide/jump actions)
  targetFieldId: int("targetFieldId"),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type FormBranchingRule = typeof formBranchingRules.$inferSelect;
export type InsertFormBranchingRule = typeof formBranchingRules.$inferInsert;

// ─── Form Submissions ─────────────────────────────────────────────────────────
export const formSubmissions = mysqlTable("form_submissions", {
  id: int("id").autoincrement().primaryKey(),
  formId: int("formId").notNull(),
  // Respondent info (may be anonymous)
  userId: int("userId"),
  respondentEmail: varchar("respondentEmail", { length: 255 }),
  respondentName: varchar("respondentName", { length: 255 }),
  // Answers stored as JSON: { fieldId: value }
  answers: text("answers").notNull(),
  // Metadata
  ipAddress: varchar("ipAddress", { length: 50 }),
  userAgent: text("userAgent"),
  submittedAt: timestamp("submittedAt").defaultNow().notNull(),
});
export type FormSubmission = typeof formSubmissions.$inferSelect;
export type InsertFormSubmission = typeof formSubmissions.$inferInsert;

// ─── Form Sessions ────────────────────────────────────────────────────────────
// Tracks each visitor's interaction with a form (for drop-off analytics)
export const formSessions = mysqlTable("form_sessions", {
  id: int("id").autoincrement().primaryKey(),
  formId: int("formId").notNull(),
  // Unique session token (generated client-side)
  sessionToken: varchar("sessionToken", { length: 100 }).notNull(),
  userId: int("userId"),
  respondentEmail: varchar("respondentEmail", { length: 255 }),
  // The field ID where the respondent dropped off (null if completed)
  droppedAtFieldId: int("droppedAtFieldId"),
  // Whether the session ended in a submission
  completed: boolean("completed").default(false).notNull(),
  // Member variable values used to pre-populate fields (JSON)
  memberVars: text("memberVars"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
  // Duration in seconds
  durationSeconds: int("durationSeconds"),
});
export type FormSession = typeof formSessions.$inferSelect;
export type InsertFormSession = typeof formSessions.$inferInsert;

// ─── Form Analytics Events ────────────────────────────────────────────────────
// Fine-grained events: field_view, field_answer, field_skip, form_start, form_submit
export const formAnalyticsEvents = mysqlTable("form_analytics_events", {
  id: int("id").autoincrement().primaryKey(),
  formId: int("formId").notNull(),
  sessionId: int("sessionId").notNull(),
  fieldId: int("fieldId"),
  // Event type
  event: varchar("event", { length: 50 }).notNull(),
  // Optional value (e.g. selected option for choice fields)
  value: text("value"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type FormAnalyticsEvent = typeof formAnalyticsEvents.$inferSelect;
export type InsertFormAnalyticsEvent = typeof formAnalyticsEvents.$inferInsert;

// ─── Form Integrations ────────────────────────────────────────────────────────
// Links a form to a course, custom page, or landing page
export const formIntegrations = mysqlTable("form_integrations", {
  id: int("id").autoincrement().primaryKey(),
  formId: int("formId").notNull(),
  // Integration type
  type: mysqlEnum("type", ["course", "custom_page", "landing_page"]).notNull(),
  // ID of the target (courseId, pageId, etc.)
  targetId: int("targetId"),
  // Target URL for redirect integrations
  targetUrl: text("targetUrl"),
  // When to trigger: on_submit, on_completion
  triggerOn: mysqlEnum("triggerOn", ["on_submit", "on_completion"]).default("on_submit").notNull(),
  // Action to perform
  action: mysqlEnum("action", ["enroll", "redirect", "tag", "embed"]).notNull(),
  // Optional label for display
  label: varchar("label", { length: 255 }),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type FormIntegration = typeof formIntegrations.$inferSelect;
export type InsertFormIntegration = typeof formIntegrations.$inferInsert;

// ─── Organization Media Folders ─────────────────────────────────────────────
// Virtual folders for organizing media assets within an org.
export const orgMediaFolders = mysqlTable("org_media_folders", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type OrgMediaFolder = typeof orgMediaFolders.$inferSelect;
export type InsertOrgMediaFolder = typeof orgMediaFolders.$inferInsert;

// ─── Organization Media Library ───────────────────────────────────────────────
// Central store for all media assets uploaded by an org (images, videos, docs).
// All uploads across courses, forms, and other org contexts register here.
export const orgMediaLibrary = mysqlTable("org_media_library", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  uploadedBy: int("uploadedBy").notNull(), // userId
  // Original filename
  filename: varchar("filename", { length: 500 }).notNull(),
  // MIME type (image/jpeg, video/mp4, application/pdf, etc.)
  mimeType: varchar("mimeType", { length: 100 }).notNull(),
  // File size in bytes
  fileSize: int("fileSize").default(0).notNull(),
  // S3 key
  fileKey: varchar("fileKey", { length: 1000 }).notNull(),
  // Public CDN URL
  url: text("url").notNull(),
  // Optional alt text / caption
  altText: varchar("altText", { length: 500 }),
  // Tags as JSON array of strings e.g. ["course", "banner", "2024"]
  tags: text("tags"),
  // Source context: where the upload originated
  source: mysqlEnum("source", ["form", "course", "direct", "other"]).default("direct").notNull(),
  // Optional reference to the source entity (formId, courseId, etc.)
  sourceId: int("sourceId"),
  // Video duration in seconds (for video/audio items)
  durationSeconds: int("durationSeconds"),
  // S3 URL to the .vtt captions/subtitle file (if generated)
  captionsUrl: text("captionsUrl"),
  // Whisper transcript JSON (serialized array of {id, start, end, text} segments)
  transcriptJson: text("transcriptJson"),
  // Optional folder assignment (null = root / uncategorized)
  folderId: int("folderId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type OrgMediaLibraryItem = typeof orgMediaLibrary.$inferSelect;
export type InsertOrgMediaLibraryItem = typeof orgMediaLibrary.$inferInsert;

// ─── Video Clips ──────────────────────────────────────────────────────────────
// Highlight clips extracted from a media library video item
export const videoClips = mysqlTable("video_clips", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  mediaItemId: int("mediaItemId").notNull(), // references org_media_library.id
  label: varchar("label", { length: 255 }).notNull().default("Clip"),
  startSec: float("startSec").notNull().default(0),
  endSec: float("endSec").notNull().default(0),
  // URL of the saved clip video in S3 (null until exported)
  videoUrl: text("videoUrl"),
  // S3 key of the saved clip video
  videoKey: text("videoKey"),
  // Optional captions VTT URL for this clip
  captionsUrl: text("captionsUrl"),
  // Whether captions are baked into the saved clip
  captionsBaked: boolean("captionsBaked").default(false).notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type VideoClip = typeof videoClips.$inferSelect;
export type InsertVideoClip = typeof videoClips.$inferInsert;

// ─── Form Filters ─────────────────────────────────────────────────────────────
// Named saved filters that can be applied to the Results Table or Export
export const formFilters = mysqlTable("form_filters", {
  id: int("id").autoincrement().primaryKey(),
  formId: int("formId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  // JSON array of conditions: [{fieldId, operator, value}]
  conditions: text("conditions").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type FormFilter = typeof formFilters.$inferSelect;
export type InsertFormFilter = typeof formFilters.$inferInsert;

// ─── Form Views ───────────────────────────────────────────────────────────────
// Named column visibility configurations for the Results Table
export const formViews = mysqlTable("form_views", {
  id: int("id").autoincrement().primaryKey(),
  formId: int("formId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  // JSON array of fieldIds to show
  visibleFieldIds: text("visibleFieldIds").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type FormView = typeof formViews.$inferSelect;
export type InsertFormView = typeof formViews.$inferInsert;

// ─── Form Labels ──────────────────────────────────────────────────────────────
// Custom display labels for field headers in the Results Table
export const formLabels = mysqlTable("form_labels", {
  id: int("id").autoincrement().primaryKey(),
  formId: int("formId").notNull(),
  fieldId: int("fieldId").notNull(),
  customLabel: varchar("customLabel", { length: 500 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type FormLabel = typeof formLabels.$inferSelect;
export type InsertFormLabel = typeof formLabels.$inferInsert;

// ─── Form Docs ────────────────────────────────────────────────────────────────
// PDF/DOCX document templates generated from submission data
export const formDocs = mysqlTable("form_docs", {
  id: int("id").autoincrement().primaryKey(),
  formId: int("formId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  // "custom_pdf" | "merged_pdf" | "merged_docx"
  docType: varchar("docType", { length: 50 }).notNull().default("merged_pdf"),
  // Template content with {{fieldId}} merge tags
  template: text("template"),
  // S3 URL of the uploaded template file (for merged docs)
  templateFileUrl: text("templateFileUrl"),
  templateFileKey: varchar("templateFileKey", { length: 1000 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type FormDoc = typeof formDocs.$inferSelect;
export type InsertFormDoc = typeof formDocs.$inferInsert;

// ─── Form Scheduled Exports ───────────────────────────────────────────────────
// Recurring export jobs that send results to an email on a schedule
export const formScheduledExports = mysqlTable("form_scheduled_exports", {
  id: int("id").autoincrement().primaryKey(),
  formId: int("formId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  // "daily" | "weekly" | "monthly"
  frequency: varchar("frequency", { length: 20 }).notNull().default("weekly"),
  // Day of week (0=Sun) for weekly, day of month for monthly
  dayValue: int("dayValue"),
  // Hour of day (0-23) in UTC
  hourUtc: int("hourUtc").default(8).notNull(),
  // Delivery email
  deliveryEmail: varchar("deliveryEmail", { length: 320 }).notNull(),
  // Export format: "csv" | "xlsx"
  format: varchar("format", { length: 10 }).notNull().default("csv"),
  // Optional filterId to apply
  filterId: int("filterId"),
  isActive: boolean("isActive").default(true).notNull(),
  lastRunAt: timestamp("lastRunAt"),
  nextRunAt: timestamp("nextRunAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type FormScheduledExport = typeof formScheduledExports.$inferSelect;
export type InsertFormScheduledExport = typeof formScheduledExports.$inferInsert;

// ─── Community Hubs ───────────────────────────────────────────────────────────
export const communityHubs = mysqlTable("community_hubs", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  tagline: varchar("tagline", { length: 500 }),
  description: text("description"),
  coverImageUrl: text("coverImageUrl"),
  logoUrl: text("logoUrl"),
  primaryColor: varchar("primaryColor", { length: 20 }).default("#0d9488"),
  isEnabled: boolean("isEnabled").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CommunityHub = typeof communityHubs.$inferSelect;
export type InsertCommunityHub = typeof communityHubs.$inferInsert;

// ─── Community Spaces ─────────────────────────────────────────────────────────
export const communitySpaces = mysqlTable("community_spaces", {
  id: int("id").autoincrement().primaryKey(),
  hubId: int("hubId").notNull(),
  orgId: int("orgId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  description: text("description"),
  coverImageUrl: text("coverImageUrl"),
  emoji: varchar("emoji", { length: 10 }).default("💬"),
  sortOrder: int("sortOrder").default(0).notNull(),
  accessType: mysqlEnum("accessType", ["open", "invite_only", "course_enrollment", "purchase"]).default("open").notNull(),
  isInviteOnly: boolean("isInviteOnly").default(false).notNull(),
  linkedCourseId: int("linkedCourseId"),
  price: int("price").default(0),
  stripePriceId: varchar("stripePriceId", { length: 255 }),
  salesPageTitle: varchar("salesPageTitle", { length: 500 }),
  salesPageContent: text("salesPageContent"),
  salesPageCta: varchar("salesPageCta", { length: 255 }).default("Join Community"),
  memberCount: int("memberCount").default(0).notNull(),
  postCount: int("postCount").default(0).notNull(),
  isArchived: boolean("isArchived").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CommunitySpace = typeof communitySpaces.$inferSelect;
export type InsertCommunitySpace = typeof communitySpaces.$inferInsert;

// ─── Community Members ────────────────────────────────────────────────────────
export const communityMembers = mysqlTable("community_members", {
  id: int("id").autoincrement().primaryKey(),
  spaceId: int("spaceId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["member", "moderator", "admin"]).default("member").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  isBanned: boolean("isBanned").default(false).notNull(),
});
export type CommunityMember = typeof communityMembers.$inferSelect;
export type InsertCommunityMember = typeof communityMembers.$inferInsert;

// ─── Community Invites ────────────────────────────────────────────────────────
export const communityInvites = mysqlTable("community_invites", {
  id: int("id").autoincrement().primaryKey(),
  spaceId: int("spaceId").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  token: varchar("token", { length: 64 }).notNull(),
  invitedByUserId: int("invitedByUserId").notNull(),
  status: mysqlEnum("status", ["pending", "accepted", "revoked"]).default("pending").notNull(),
  expiresAt: timestamp("expiresAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CommunityInvite = typeof communityInvites.$inferSelect;
export type InsertCommunityInvite = typeof communityInvites.$inferInsert;

// ─── Community Posts ──────────────────────────────────────────────────────────
export const communityPosts = mysqlTable("community_posts", {
  id: int("id").autoincrement().primaryKey(),
  spaceId: int("spaceId").notNull(),
  hubId: int("hubId").notNull(),
  orgId: int("orgId").notNull(),
  authorId: int("authorId").notNull(),
  authorName: varchar("authorName", { length: 255 }),
  authorAvatarUrl: text("authorAvatarUrl"),
  content: text("content").notNull(),
  imageUrl: text("imageUrl"),
  isPinned: boolean("isPinned").default(false).notNull(),
  isHidden: boolean("isHidden").default(false).notNull(),
  replyCount: int("replyCount").default(0).notNull(),
  reactionCount: int("reactionCount").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type CommunityPost = typeof communityPosts.$inferSelect;
export type InsertCommunityPost = typeof communityPosts.$inferInsert;

// ─── Community Post Replies ───────────────────────────────────────────────────
export const communityPostReplies = mysqlTable("community_post_replies", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  authorId: int("authorId").notNull(),
  authorName: varchar("authorName", { length: 255 }),
  authorAvatarUrl: text("authorAvatarUrl"),
  content: text("content").notNull(),
  isHidden: boolean("isHidden").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CommunityPostReply = typeof communityPostReplies.$inferSelect;
export type InsertCommunityPostReply = typeof communityPostReplies.$inferInsert;

// ─── Community Post Reactions ─────────────────────────────────────────────────
export const communityPostReactions = mysqlTable("community_post_reactions", {
  id: int("id").autoincrement().primaryKey(),
  postId: int("postId").notNull(),
  userId: int("userId").notNull(),
  emoji: varchar("emoji", { length: 10 }).default("👍").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CommunityPostReaction = typeof communityPostReactions.$inferSelect;
export type InsertCommunityPostReaction = typeof communityPostReactions.$inferInsert;

// ─── Community DMs ────────────────────────────────────────────────────────────
export const communityDms = mysqlTable("community_dms", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  fromUserId: int("fromUserId").notNull(),
  toUserId: int("toUserId").notNull(),
  content: text("content").notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type CommunityDm = typeof communityDms.$inferSelect;
export type InsertCommunityDm = typeof communityDms.$inferInsert;

// ─── Flashcard Decks ──────────────────────────────────────────────────────────
export const flashcardDecks = mysqlTable("flashcard_decks", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 100 }),
  cardCount: int("cardCount").default(0).notNull(),
  isPublic: boolean("isPublic").default(false).notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type FlashcardDeck = typeof flashcardDecks.$inferSelect;
export type InsertFlashcardDeck = typeof flashcardDecks.$inferInsert;

// ─── Flashcard Cards ──────────────────────────────────────────────────────────
export const flashcardCards = mysqlTable("flashcard_cards", {
  id: int("id").autoincrement().primaryKey(),
  deckId: int("deckId").notNull(),
  front: text("front").notNull(),
  back: text("back").notNull(),
  frontImageUrl: varchar("frontImageUrl", { length: 1024 }),
  backImageUrl: varchar("backImageUrl", { length: 1024 }),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});
export type FlashcardCard = typeof flashcardCards.$inferSelect;
export type InsertFlashcardCard = typeof flashcardCards.$inferInsert;


// ─── Subscription Plan Limits ─────────────────────────────────────────────────
// Default allotments per plan tier x content/product type.
// -1 = unlimited.  0 = not available on this plan.
export const subscriptionPlanLimits = mysqlTable("subscription_plan_limits", {
  id: int("id").autoincrement().primaryKey(),
  plan: mysqlEnum("plan", ["free", "starter", "builder", "pro", "enterprise"]).notNull(),
  featureKey: varchar("featureKey", { length: 100 }).notNull(),
  featureLabel: varchar("featureLabel", { length: 150 }).notNull(),
  limitValue: int("limitValue").notNull().default(0),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SubscriptionPlanLimit = typeof subscriptionPlanLimits.$inferSelect;
export type InsertSubscriptionPlanLimit = typeof subscriptionPlanLimits.$inferInsert;

// ─── Org Limit Overrides ──────────────────────────────────────────────────────
// Per-org overrides that supersede the plan defaults.
export const orgLimitOverrides = mysqlTable("org_limit_overrides", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  featureKey: varchar("featureKey", { length: 100 }).notNull(),
  limitValue: int("limitValue").notNull(),
  overriddenByUserId: int("overriddenByUserId"),
  note: varchar("note", { length: 255 }),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type OrgLimitOverride = typeof orgLimitOverrides.$inferSelect;
export type InsertOrgLimitOverride = typeof orgLimitOverrides.$inferInsert;

// ─── Org Payment Settings ─────────────────────────────────────────────────────────────────────────────────
// Per-org payment gateway configuration for collecting payments from members.
export const orgPaymentSettings = mysqlTable("org_payment_settings", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull().unique(),
  // Stripe (for collecting payments from members)
  stripePublishableKey: varchar("stripePublishableKey", { length: 255 }),
  stripeSecretKey: varchar("stripeSecretKey", { length: 255 }),
  stripeConnectAccountId: varchar("stripeConnectAccountId", { length: 255 }),
  stripeConnectEnabled: boolean("stripeConnectEnabled").default(false).notNull(),
  stripeConnectOnboardingComplete: boolean("stripeConnectOnboardingComplete").default(false).notNull(),
  // PayPal (for collecting payments + affiliate/revenue share payouts)
  paypalEmail: varchar("paypalEmail", { length: 320 }),
  paypalEnabled: boolean("paypalEnabled").default(false).notNull(),
  paypalClientId: varchar("paypalClientId", { length: 255 }),
  paypalClientSecret: varchar("paypalClientSecret", { length: 255 }),
  // Default currency
  currency: varchar("currency", { length: 10 }).default("USD").notNull(),
  // Auto-enrollment: new members auto-enrolled in selected courses
  autoEnrollNewMembers: boolean("autoEnrollNewMembers").default(false).notNull(),
  // JSON array of course IDs to auto-enroll into (null = all published courses)
  autoEnrollCourseIds: text("autoEnrollCourseIds"),
  // Revenue share config (JSON): [{ userId, percentage, paypalEmail }]
  revenueShareJson: text("revenueShareJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type OrgPaymentSettings = typeof orgPaymentSettings.$inferSelect;
export type InsertOrgPaymentSettings = typeof orgPaymentSettings.$inferInsert;

// ── Teachific Author: eLearning Authoring Tool ─────────────────────────────

export const authoringProjects = mysqlTable("authoringProjects", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  orgId: bigint("orgId", { mode: "number" }).notNull(),
  userId: bigint("userId", { mode: "number" }).notNull(),
  title: varchar("title", { length: 255 }).notNull().default("Untitled Project"),
  description: text("description"),
  // Project settings JSON: { theme, player, width, height, language, passingScore }
  settingsJson: text("settingsJson"),
  // Thumbnail URL
  thumbnailUrl: varchar("thumbnailUrl", { length: 1024 }),
  // Status: draft | published
  status: mysqlEnum("status", ["draft", "published"]).default("draft").notNull(),
  // Last published SCORM package URL
  lastPublishedUrl: varchar("lastPublishedUrl", { length: 1024 }),
  // Last published format: scorm12 | scorm2004 | html5
  lastPublishedFormat: mysqlEnum("lastPublishedFormat", ["scorm12", "scorm2004", "html5"]),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AuthoringProject = typeof authoringProjects.$inferSelect;
export type InsertAuthoringProject = typeof authoringProjects.$inferInsert;

export const authoringSlides = mysqlTable("authoringSlides", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  projectId: bigint("projectId", { mode: "number" }).notNull(),
  slideIndex: int("slideIndex").notNull().default(0),
  title: varchar("title", { length: 255 }).notNull().default("Slide"),
  // Slide type: content | quiz | interaction | scenario | video
  slideType: mysqlEnum("slideType", ["content", "quiz", "interaction", "scenario", "video"]).default("content").notNull(),
  // Full slide content as JSON (blocks array)
  contentJson: text("contentJson"),
  // Slide layout: blank | title | title-content | two-column | image-text | full-image
  layout: varchar("layout", { length: 64 }).default("title-content").notNull(),
  // Background color or image URL
  background: varchar("background", { length: 512 }),
  // Slide notes / speaker notes
  notes: text("notes"),
  // Branching: next slide override (null = sequential)
  nextSlideId: bigint("nextSlideId", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type AuthoringSlide = typeof authoringSlides.$inferSelect;
export type InsertAuthoringSlide = typeof authoringSlides.$inferInsert;

// ─── Desktop App Versions ────────────────────────────────────────────────────
// Stores installer download URLs for each product version.
// Managed by Platform Admin → App Versions tab.
export const appVersions = mysqlTable("app_versions", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  // Product identifier: "creator" | "studio" | "quizcreator"
  product: mysqlEnum("product", ["creator", "studio", "quizcreator"]).notNull(),
  version: varchar("version", { length: 32 }).notNull(), // e.g. "1.0.0"
  releaseNotes: text("releaseNotes"),
  // Download URLs (S3/CDN links to .exe and .dmg)
  windowsUrl: varchar("windowsUrl", { length: 1024 }),
  macUrl: varchar("macUrl", { length: 1024 }),
  // Whether this is the current latest version for this product
  isLatest: boolean("isLatest").default(false).notNull(),
  releasedAt: timestamp("releasedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type AppVersion = typeof appVersions.$inferSelect;
export type InsertAppVersion = typeof appVersions.$inferInsert;

// ─── TeachificPay Disputes ────────────────────────────────────────────────────
// Tracks Stripe disputes (chargebacks) for TeachificPay transactions.
export const teachificPayDisputes = mysqlTable("teachific_pay_disputes", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  orgId: bigint("orgId", { mode: "number" }).notNull(),
  stripeDisputeId: varchar("stripeDisputeId", { length: 128 }).notNull().unique(),
  stripeChargeId: varchar("stripeChargeId", { length: 128 }).notNull(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 128 }),
  // Amount disputed in cents
  amount: bigint("amount", { mode: "number" }).notNull(),
  currency: varchar("currency", { length: 8 }).notNull().default("usd"),
  // Dispute status from Stripe
  status: mysqlEnum("status", [
    "warning_needs_response",
    "warning_under_review",
    "warning_closed",
    "needs_response",
    "under_review",
    "charge_refunded",
    "won",
    "lost",
  ]).notNull().default("needs_response"),
  reason: varchar("reason", { length: 128 }),
  // Evidence submission deadline (Unix timestamp ms)
  evidenceDueBy: bigint("evidenceDueBy", { mode: "number" }),
  // Whether evidence has been submitted
  evidenceSubmitted: boolean("evidenceSubmitted").default(false).notNull(),
  // Metadata from the original charge
  courseId: bigint("courseId", { mode: "number" }),
  learnerId: bigint("learnerId", { mode: "number" }),
  learnerEmail: varchar("learnerEmail", { length: 256 }),
  // Access revoked when dispute was opened
  accessRevoked: boolean("accessRevoked").default(false).notNull(),
  // Admin-only internal notes (appended with timestamps)
  adminNotes: text("adminNotes"),
  // Flagged for escalation by platform admin
  escalated: boolean("escalated").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TeachificPayDispute = typeof teachificPayDisputes.$inferSelect;
export type InsertTeachificPayDispute = typeof teachificPayDisputes.$inferInsert;

// ─── TeachificPay Charges ─────────────────────────────────────────────────────
// Logs completed charges processed through TeachificPay for reporting.
export const teachificPayCharges = mysqlTable("teachific_pay_charges", {
  id: bigint("id", { mode: "number" }).primaryKey().autoincrement(),
  orgId: bigint("orgId", { mode: "number" }).notNull(),
  stripeChargeId: varchar("stripeChargeId", { length: 128 }).notNull().unique(),
  stripePaymentIntentId: varchar("stripePaymentIntentId", { length: 128 }),
  stripeCheckoutSessionId: varchar("stripeCheckoutSessionId", { length: 128 }),
  // Amounts in cents
  amount: bigint("amount", { mode: "number" }).notNull(),
  platformFee: bigint("platformFee", { mode: "number" }).notNull().default(0),
  netAmount: bigint("netAmount", { mode: "number" }).notNull(),
  currency: varchar("currency", { length: 8 }).notNull().default("usd"),
  status: mysqlEnum("chargeStatus", ["succeeded", "pending", "failed", "refunded", "partially_refunded"]).notNull().default("succeeded"),
  // Refund tracking
  amountRefunded: bigint("amountRefunded", { mode: "number" }).notNull().default(0),
  // Metadata
  courseId: bigint("courseId", { mode: "number" }),
  learnerId: bigint("learnerId", { mode: "number" }),
  learnerEmail: varchar("learnerEmail", { length: 256 }),
  isGroupRegistration: boolean("isGroupRegistration").default(false).notNull(),
  groupSize: bigint("groupSize", { mode: "number" }).default(1).notNull(),
  chargedAt: timestamp("chargedAt").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type TeachificPayCharge = typeof teachificPayCharges.$inferSelect;
export type InsertTeachificPayCharge = typeof teachificPayCharges.$inferInsert;

// ─── Org Landing Pages ────────────────────────────────────────────────────────
// One row per org. Created automatically on first subdomain assignment.
// Never recreated when the subdomain is changed — only seeded once.
export const orgLandingPages = mysqlTable("org_landing_pages", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull().unique(),
  // Hero section
  heroHeadline: varchar("heroHeadline", { length: 255 }),
  heroSubheadline: text("heroSubheadline"),
  heroCtaText: varchar("heroCtaText", { length: 100 }),
  heroCtaUrl: varchar("heroCtaUrl", { length: 512 }),
  heroBgColor: varchar("heroBgColor", { length: 32 }).default("#0f172a"),
  heroTextColor: varchar("heroTextColor", { length: 32 }).default("#ffffff"),
  // About / body section
  aboutTitle: varchar("aboutTitle", { length: 255 }),
  aboutBody: text("aboutBody"),
  // Feature highlights (JSON array of {icon, title, description})
  features: text("features"),
  // Accent / brand color used for buttons and highlights
  accentColor: varchar("accentColor", { length: 32 }).default("#0ea5e9"),
  // Whether to show the public course grid on the landing page
  showCourses: boolean("showCourses").default(true).notNull(),
  // Whether the landing page is published (visible to visitors)
  isPublished: boolean("isPublished").default(true).notNull(),
  // Custom footer text
  footerText: text("footerText"),
  // WYSIWYG canvas blocks (JSON array of block objects) — when set, overrides the legacy field-based layout
  blocksJson: text("blocksJson"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type OrgLandingPage = typeof orgLandingPages.$inferSelect;
export type InsertOrgLandingPage = typeof orgLandingPages.$inferInsert;

// ─── Funnels ─────────────────────────────────────────────────────────────────
// ClickFunnels-style multi-step funnels. Each funnel has ordered steps.
// Each step links to a page_builder_pages page.
export const funnels = mysqlTable("funnels", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  slug: varchar("slug", { length: 200 }).notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  // Optional: link funnel to a course (e.g. course sales funnel)
  courseId: int("courseId"),
  // Analytics counters
  totalVisitors: int("totalVisitors").default(0).notNull(),
  totalConversions: int("totalConversions").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type Funnel = typeof funnels.$inferSelect;
export type InsertFunnel = typeof funnels.$inferInsert;

export const funnelSteps = mysqlTable("funnel_steps", {
  id: int("id").autoincrement().primaryKey(),
  funnelId: int("funnelId").notNull(),
  // Step ordering (0-indexed)
  sortOrder: int("sortOrder").default(0).notNull(),
  // Step name shown in the builder UI
  name: varchar("name", { length: 255 }).notNull(),
  // Step type
  stepType: mysqlEnum("stepType", [
    "landing",       // Main landing / opt-in page
    "sales",         // Sales / offer page
    "order",         // Order / checkout page
    "upsell",        // One-time offer upsell
    "downsell",      // Downsell offer
    "thank_you",     // Thank you / confirmation page
    "webinar",       // Webinar registration
    "custom",        // Generic custom page
  ]).default("landing").notNull(),
  // Link to a page_builder_pages page (null = not yet designed)
  pageId: int("pageId"),
  // URL path for this step (e.g. /funnels/my-funnel/step-1)
  slug: varchar("slug", { length: 200 }),
  // Analytics
  visitors: int("visitors").default(0).notNull(),
  conversions: int("conversions").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type FunnelStep = typeof funnelSteps.$inferSelect;
export type InsertFunnelStep = typeof funnelSteps.$inferInsert;

// ─── Support Tickets ──────────────────────────────────────────────────────────
export const supportTickets = mysqlTable("support_tickets", {
  id: int("id").autoincrement().primaryKey(),
  // Submitter info (may be anonymous or logged-in user)
  name: varchar("name", { length: 128 }).notNull(),
  email: varchar("email", { length: 255 }).notNull(),
  // Optional link to a logged-in user
  userId: int("userId"),
  // Ticket content
  subject: varchar("subject", { length: 255 }).notNull(),
  category: mysqlEnum("category", ["general", "billing", "technical", "account", "other"]).default("general").notNull(),
  message: text("message").notNull(),
  // Status lifecycle
  status: mysqlEnum("status", ["open", "in_progress", "resolved", "closed"]).default("open").notNull(),
  // Optional internal notes from support staff
  staffNotes: text("staffNotes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type SupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicket = typeof supportTickets.$inferInsert;

// ─── Lesson Notes ─────────────────────────────────────────────────────────────
// Learner-private notes attached to a specific lesson (optionally with a timestamp
// so they can be linked to a specific moment in a video lesson).
export const lessonNotes = mysqlTable("lesson_notes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  courseId: int("courseId").notNull(),
  lessonId: int("lessonId").notNull(),
  enrollmentId: int("enrollmentId").notNull(),
  content: text("content").notNull(),
  // Optional video timestamp in seconds (null for non-video lessons)
  videoTimestamp: int("videoTimestamp"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type LessonNote = typeof lessonNotes.$inferSelect;
export type InsertLessonNote = typeof lessonNotes.$inferInsert;

// ─── Lesson Bookmarks ─────────────────────────────────────────────────────────
// Learner-private bookmarks to quickly return to a specific lesson.
export const lessonBookmarks = mysqlTable("lesson_bookmarks", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  courseId: int("courseId").notNull(),
  lessonId: int("lessonId").notNull(),
  enrollmentId: int("enrollmentId").notNull(),
  // Optional label the learner gives this bookmark
  label: varchar("label", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type LessonBookmark = typeof lessonBookmarks.$inferSelect;
export type InsertLessonBookmark = typeof lessonBookmarks.$inferInsert;

// ─── Order Bumps ──────────────────────────────────────────────────────────────
// Upsell/cross-sell offers shown before, during, or after checkout
export const orderBumps = mysqlTable("order_bumps", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  triggerProductType: mysqlEnum("triggerProductType", ["course", "download", "quiz"]).notNull(),
  triggerProductId: int("triggerProductId").notNull(),
  bumpProductType: mysqlEnum("bumpProductType", ["course", "download", "quiz"]).notNull(),
  bumpProductId: int("bumpProductId").notNull(),
  placement: mysqlEnum("placement", ["before_checkout", "during_checkout", "after_checkout"]).default("during_checkout").notNull(),
  headline: varchar("headline", { length: 500 }),
  description: text("description"),
  discountPercent: int("discountPercent").default(0),
  discountedPrice: varchar("discountedPrice", { length: 20 }),
  landingPageJson: json("landingPageJson"),
  buttonText: varchar("buttonText", { length: 100 }).default("Add to Order"),
  declineText: varchar("declineText", { length: 100 }).default("No thanks"),
  imageUrl: text("imageUrl"),
  isActive: boolean("isActive").default(true).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type OrderBump = typeof orderBumps.$inferSelect;
export type InsertOrderBump = typeof orderBumps.$inferInsert;

// ─── Order Bump Conversions ───────────────────────────────────────────────────
export const orderBumpConversions = mysqlTable("order_bump_conversions", {
  id: int("id").autoincrement().primaryKey(),
  bumpId: int("bumpId").notNull(),
  orgId: int("orgId").notNull(),
  triggerOrderId: int("triggerOrderId"),
  bumpOrderId: int("bumpOrderId"),
  buyerEmail: varchar("buyerEmail", { length: 255 }),
  accepted: boolean("accepted").default(false).notNull(),
  sessionId: varchar("sessionId", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type OrderBumpConversion = typeof orderBumpConversions.$inferSelect;
export type InsertOrderBumpConversion = typeof orderBumpConversions.$inferInsert;

// ─── Private Invites ──────────────────────────────────────────────────────────
export const privateInvites = mysqlTable("private_invites", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  productType: mysqlEnum("productType", ["course", "download", "quiz"]).notNull(),
  productId: int("productId").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  inviteToken: varchar("inviteToken", { length: 64 }).notNull().unique(),
  invitedBy: int("invitedBy").notNull(),
  status: mysqlEnum("status", ["pending", "accepted", "expired"]).default("pending").notNull(),
  expiresAt: timestamp("expiresAt"),
  acceptedAt: timestamp("acceptedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type PrivateInvite = typeof privateInvites.$inferSelect;
export type InsertPrivateInvite = typeof privateInvites.$inferInsert;

// ─── Question Bank ────────────────────────────────────────────────────────────
// Centralized question bank organized by org with folder/topic hierarchy
export const questionBankFolders = mysqlTable("question_bank_folders", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  parentId: int("parentId"), // null = root folder
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  color: varchar("color", { length: 32 }),
  sortOrder: int("sortOrder").default(0).notNull(),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type QuestionBankFolder = typeof questionBankFolders.$inferSelect;
export type InsertQuestionBankFolder = typeof questionBankFolders.$inferInsert;

export const questionBankItems = mysqlTable("question_bank_items", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  folderId: int("folderId"), // null = unfiled
  questionType: mysqlEnum("questionType", [
    "mcq", "tf", "short_answer", "long_answer", "matching",
    "multiple_select", "image_choice", "hotspot", "ordering",
    "fill_blank", "numeric", "rating_scale",
  ]).default("mcq").notNull(),
  stem: text("stem").notNull(), // question text (HTML)
  // Full question data as JSON (choices, correct answers, media, etc.)
  dataJson: longtext("dataJson").notNull(),
  points: float("points").default(1).notNull(),
  difficulty: mysqlEnum("difficulty", ["easy", "medium", "hard"]).default("medium"),
  tags: text("tags"), // JSON array of tag strings
  explanation: text("explanation"),
  createdBy: int("createdBy").notNull(),
  usageCount: int("usageCount").default(0).notNull(), // how many quizzes use this question
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type QuestionBankItem = typeof questionBankItems.$inferSelect;
export type InsertQuestionBankItem = typeof questionBankItems.$inferInsert;

// ─── Membership Members ──────────────────────────────────────────────────────
export const membershipMembers = mysqlTable("membership_members", {
  id: int("id").autoincrement().primaryKey(),
  membershipId: int("membershipId").notNull(),
  userId: int("userId").notNull(),
  status: mysqlEnum("status", ["active", "paused", "cancelled", "expired"]).default("active").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
  cancelledAt: timestamp("cancelledAt"),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 255 }),
});
export type MembershipMember = typeof membershipMembers.$inferSelect;
export type InsertMembershipMember = typeof membershipMembers.$inferInsert;

// ─── Membership Content (what's included in a membership) ────────────────────
export const membershipContent = mysqlTable("membership_content", {
  id: int("id").autoincrement().primaryKey(),
  membershipId: int("membershipId").notNull(),
  contentType: mysqlEnum("contentType", ["course", "digital_product", "community", "webinar"]).notNull(),
  contentId: int("contentId").notNull(),
  addedAt: timestamp("addedAt").defaultNow().notNull(),
});
export type MembershipContent = typeof membershipContent.$inferSelect;
export type InsertMembershipContent = typeof membershipContent.$inferInsert;

// ─── Membership Auto-Enrollment Rules ────────────────────────────────────────
export const membershipRules = mysqlTable("membership_rules", {
  id: int("id").autoincrement().primaryKey(),
  membershipId: int("membershipId").notNull(),
  triggerType: mysqlEnum("triggerType", ["course_purchase", "product_purchase", "webinar_registration", "tag_added", "manual"]).notNull(),
  triggerEntityId: int("triggerEntityId"),
  triggerTag: varchar("triggerTag", { length: 255 }),
  action: mysqlEnum("action", ["add_to_membership", "remove_from_membership"]).default("add_to_membership").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
export type MembershipRule = typeof membershipRules.$inferSelect;
export type InsertMembershipRule = typeof membershipRules.$inferInsert;

// ─── Org User Roles ───────────────────────────────────────────────────────────
// Maps users to roles within specific orgs (allows same user to have different roles in different orgs)
export const orgUserRoles = mysqlTable("org_user_roles", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["org_super_admin", "org_admin", "instructor", "affiliate", "member"]).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type OrgUserRole = typeof orgUserRoles.$inferSelect;
export type InsertOrgUserRole = typeof orgUserRoles.$inferInsert;




// ═══════════════════════════════════════════════════════════════════════════════════
// CRITICAL MODULES INTEGRATION
// ═══════════════════════════════════════════════════════════════════════════════════
// LMS Core + Cohorts + Instructor/Affiliate Payouts + Media + Funnels + Member Mgmt
// All tables org-scoped and deduplicated with existing schema
// ═══════════════════════════════════════════════════════════════════════════════════

// ─── LMS: Core Courses ─────────────────────────────────────────────────────────────
export const lmsCourses = mysqlTable("lms_courses", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  subtitle: varchar("subtitle", { length: 500 }),
  description: longtext("description"),
  coverImageUrl: text("cover_image_url"),
  status: mysqlEnum("status", ["draft", "public", "hidden", "private", "archived"]).default("draft").notNull(),
  type: mysqlEnum("type", ["course", "quiz", "download", "cohort"]).default("course").notNull(),
  enrollmentCloseDate: timestamp("enrollment_close_date"),
  price: int("price").default(0).notNull(),
  isFree: boolean("is_free").default(false).notNull(),
  bundleOnly: boolean("bundle_only").default(false).notNull(),
  currency: varchar("currency", { length: 8 }).default("usd").notNull(),
  pricingType: mysqlEnum("pricing_type", ["free", "one_time", "subscription", "payment_plan", "trial_then_subscription"]).default("one_time").notNull(),
  subscriptionInterval: mysqlEnum("subscription_interval", ["monthly", "quarterly", "annual"]),
  trialDays: int("trialDays"),
  accessDurationDays: int("accessDurationDays"),
  downPayment: int("down_payment").default(0),
  installmentCount: int("installment_count").default(0),
  installmentAmount: int("installment_amount").default(0),
  installmentIntervalDays: int("installment_interval_days").default(30),
  stripePriceId: varchar("stripe_price_id", { length: 255 }),
  metaTitle: varchar("meta_title", { length: 255 }),
  metaDescription: text("meta_description"),
  metaKeywords: text("meta_keywords"),
  hasCertificate: boolean("has_certificate").default(false).notNull(),
  certificateTemplateId: int("certificate_template_id"),
  isFeatured: boolean("is_featured").default(false).notNull(),
  isDrip: boolean("is_drip").default(false).notNull(),
  showInstructor: boolean("show_instructor").default(false).notNull(),
  hideProgress: boolean("hide_progress").default(false).notNull(),
  showInLibrary: boolean("show_in_library").default(true).notNull(),
  courseOverviewTopBlocks: longtext("course_overview_top_blocks"),
  courseOverviewBlocks: longtext("course_overview_blocks"),
  courseOverviewBottomBlocks: longtext("course_overview_bottom_blocks"),
  sendEnrollmentEmail: boolean("send_enrollment_email").default(true).notNull(),
  primaryColor: varchar("primary_color", { length: 20 }).default("#179ca3"),
  accentColor: varchar("accent_color", { length: 20 }).default("#0d9488"),
  gradientFrom: varchar("gradient_from", { length: 20 }).default("#179ca3"),
  gradientTo: varchar("gradient_to", { length: 20 }).default("#0d9488"),
  gradientDirection: varchar("gradient_direction", { length: 30 }).default("135deg"),
  thumbnailUrl: text("thumbnail_url"),
  customLabels: longtext("custom_labels"),
  defaultMarkComplete: int("default_mark_complete").default(1).notNull(),
  playerTheme: mysqlEnum("player_theme", ["light", "dark"]).default("light").notNull(),
  allowGroupPurchase: boolean("allow_group_purchase").default(true).notNull(),
  createdByUserId: int("created_by_user_id").notNull(),
  libraryOrder: int("library_order").default(0).notNull(),
  publishDomain: varchar("publish_domain", { length: 255 }),
  customDomain: varchar("customDomain", { length: 255 }),
  customDomainVerified: boolean("customDomainVerified").default(false).notNull(),
  customDomainVerificationToken: varchar("customDomainVerificationToken", { length: 128 }),
  customDomainVerificationStatus: mysqlEnum("customDomainVerificationStatus", ["unverified", "pending", "verified"]).default("unverified").notNull(),
  multiCohortMode: boolean("multi_cohort_mode").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsCourse = typeof lmsCourses.$inferSelect;
export type InsertLmsCourse = typeof lmsCourses.$inferInsert;

export const lmsSections = mysqlTable("lms_sections", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  courseId: int("course_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  position: int("position").default(0).notNull(),
  isPreview: boolean("is_preview").default(false).notNull(),
  dripDays: int("drip_days").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsSection = typeof lmsSections.$inferSelect;
export type InsertLmsSection = typeof lmsSections.$inferInsert;

export const lmsLessons = mysqlTable("lms_lessons", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  courseId: int("course_id"),
  sectionId: int("section_id"),
  title: varchar("title", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["video", "text", "quiz", "download", "embed", "video_text"]).default("text").notNull(),
  content: longtext("content"),
  videoContent: longtext("video_content"),
  embedUrl: varchar("embed_url", { length: 500 }),
  mediaAssetId: int("media_asset_id"),
  position: int("position").default(0).notNull(),
  isPreview: boolean("is_preview").default(false).notNull(),
  previewMode: mysqlEnum("preview_mode", ["none", "preview", "preview_hide_after_purchase"]).default("none").notNull(),
  dripDays: int("drip_days").default(0).notNull(),
  durationMinutes: int("duration_minutes"),
  requireVideoCompletion: int("require_video_completion").default(0).notNull(),
  requireManualComplete: int("require_manual_complete"),
  effectEnabled: boolean("effect_enabled").default(false),
  effectTrigger: varchar("effect_trigger", { length: 20 }).default("lesson_start"),
  effectBannerText: varchar("effect_banner_text", { length: 500 }),
  effectBannerBgColor: varchar("effect_banner_bg_color", { length: 20 }),
  effectBannerTextColor: varchar("effect_banner_text_color", { length: 20 }),
  effectSound: varchar("effect_sound", { length: 50 }),
  effectSoundUrl: varchar("effect_sound_url", { length: 500 }),
  effectConfetti: boolean("effect_confetti").default(false),
  effectConfettiColors: varchar("effect_confetti_colors", { length: 500 }),
  effectConfettiMode: mysqlEnum("effect_confetti_mode", ["fall", "cannon"]).default("fall"),
  effectBannerDuration: int("effect_banner_duration").default(5),
  contentBlocks: longtext("content_blocks"),
  learningObjectives: longtext("learning_objectives"),
  showInstructor: mysqlEnum("show_instructor", ["inherit", "show", "hide"]).default("inherit").notNull(),
  isPrerequisite: boolean("is_prerequisite").default(false).notNull(),
  prerequisiteLessonId: int("prerequisite_lesson_id"),
  meetingLink: varchar("meeting_link", { length: 1024 }),
  liveStartAt: bigint("live_start_at", { mode: "number" }),
  liveEndAt: bigint("live_end_at", { mode: "number" }),
  commentsEnabled: boolean("comments_enabled").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsLesson = typeof lmsLessons.$inferSelect;
export type InsertLmsLesson = typeof lmsLessons.$inferInsert;

export const lmsEnrollments = mysqlTable("lms_enrollments", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  userId: int("user_id").notNull(),
  courseId: int("course_id").notNull(),
  status: mysqlEnum("status", ["active", "completed", "cancelled", "expired"]).default("active").notNull(),
  enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  expiresAt: timestamp("expires_at"),
  progressPercent: decimal("progress_percent", { precision: 5, scale: 2 }).default("0.00").notNull(),
  lastAccessedAt: timestamp("last_accessed_at"),
});
export type LmsEnrollment = typeof lmsEnrollments.$inferSelect;
export type InsertLmsEnrollment = typeof lmsEnrollments.$inferInsert;

export const lmsLessonProgress = mysqlTable("lms_lesson_progress", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  enrollmentId: int("enrollment_id").notNull(),
  lessonId: int("lesson_id").notNull(),
  status: mysqlEnum("status", ["not_started", "in_progress", "completed"]).default("not_started").notNull(),
  completedAt: timestamp("completed_at"),
  watchTimeSeconds: int("watch_time_seconds").default(0).notNull(),
  lastAccessedAt: timestamp("last_accessed_at"),
});
export type LmsLessonProgress = typeof lmsLessonProgress.$inferSelect;
export type InsertLmsLessonProgress = typeof lmsLessonProgress.$inferInsert;

export const lmsQuizzes = mysqlTable("lms_quizzes", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  courseId: int("course_id").notNull(),
  lessonId: int("lesson_id"),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  passingScore: int("passing_score").default(70).notNull(),
  attemptsAllowed: int("attempts_allowed").default(1).notNull(),
  showAnswers: boolean("show_answers").default(true).notNull(),
  randomizeQuestions: boolean("randomize_questions").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsQuiz = typeof lmsQuizzes.$inferSelect;
export type InsertLmsQuiz = typeof lmsQuizzes.$inferInsert;

export const lmsQuizQuestions = mysqlTable("lms_quiz_questions", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  quizId: int("quiz_id").notNull(),
  type: mysqlEnum("type", ["multiple_choice", "true_false", "short_answer"]).default("multiple_choice").notNull(),
  question: longtext("question").notNull(),
  explanation: longtext("explanation"),
  position: int("position").default(0).notNull(),
  points: int("points").default(1).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsQuizQuestion = typeof lmsQuizQuestions.$inferSelect;
export type InsertLmsQuizQuestion = typeof lmsQuizQuestions.$inferInsert;

export const lmsQuizAttempts = mysqlTable("lms_quiz_attempts", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  enrollmentId: int("enrollment_id").notNull(),
  quizId: int("quiz_id").notNull(),
  score: decimal("score", { precision: 5, scale: 2 }).notNull(),
  passed: boolean("passed").notNull(),
  attemptNumber: int("attempt_number").default(1).notNull(),
  completedAt: timestamp("completed_at").defaultNow().notNull(),
});
export type LmsQuizAttempt = typeof lmsQuizAttempts.$inferSelect;
export type InsertLmsQuizAttempt = typeof lmsQuizAttempts.$inferInsert;

// ─── LMS: Cohorts ─────────────────────────────────────────────────────────────────
export const lmsCohortSessions = mysqlTable("lms_cohort_sessions", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  courseId: int("course_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  status: mysqlEnum("status", ["upcoming", "active", "completed"]).default("upcoming").notNull(),
  maxParticipants: int("max_participants"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsCohortSession = typeof lmsCohortSessions.$inferSelect;
export type InsertLmsCohortSession = typeof lmsCohortSessions.$inferInsert;

export const lmsCohortGroups = mysqlTable("lms_cohort_groups", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  cohortSessionId: int("cohort_session_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsCohortGroup = typeof lmsCohortGroups.$inferSelect;
export type InsertLmsCohortGroup = typeof lmsCohortGroups.$inferInsert;

export const lmsCohortGroupEnrollments = mysqlTable("lms_cohort_group_enrollments", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  cohortGroupId: int("cohort_group_id").notNull(),
  userId: int("user_id").notNull(),
  enrolledAt: timestamp("enrolled_at").defaultNow().notNull(),
});
export type LmsCohortGroupEnrollment = typeof lmsCohortGroupEnrollments.$inferSelect;
export type InsertLmsCohortGroupEnrollment = typeof lmsCohortGroupEnrollments.$inferInsert;

export const lmsCohortAssignments = mysqlTable("lms_cohort_assignments", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  cohortSessionId: int("cohort_session_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: longtext("description"),
  dueDate: timestamp("due_date").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsCohortAssignment = typeof lmsCohortAssignments.$inferSelect;
export type InsertLmsCohortAssignment = typeof lmsCohortAssignments.$inferInsert;

export const lmsCohortSubmissions = mysqlTable("lms_cohort_submissions", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  assignmentId: int("assignment_id").notNull(),
  userId: int("user_id").notNull(),
  submissionContent: longtext("submission_content"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  gradeReceived: decimal("grade_received", { precision: 5, scale: 2 }),
  feedback: longtext("feedback"),
});
export type LmsCohortSubmission = typeof lmsCohortSubmissions.$inferSelect;
export type InsertLmsCohortSubmission = typeof lmsCohortSubmissions.$inferInsert;

export const lmsCohortRecordings = mysqlTable("lms_cohort_recordings", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  cohortSessionId: int("cohort_session_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  recordingUrl: text("recording_url").notNull(),
  recordedAt: timestamp("recorded_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsCohortRecording = typeof lmsCohortRecordings.$inferSelect;
export type InsertLmsCohortRecording = typeof lmsCohortRecordings.$inferInsert;

export const lmsCohortMessages = mysqlTable("lms_cohort_messages", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  cohortSessionId: int("cohort_session_id").notNull(),
  userId: int("user_id").notNull(),
  message: longtext("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsCohortMessage = typeof lmsCohortMessages.$inferSelect;
export type InsertLmsCohortMessage = typeof lmsCohortMessages.$inferInsert;

export const lmsCohortStaff = mysqlTable("lms_cohort_staff", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  cohortSessionId: int("cohort_session_id").notNull(),
  userId: int("user_id").notNull(),
  role: mysqlEnum("role", ["instructor", "ta", "facilitator"]).default("instructor").notNull(),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
});
export type LmsCohortStaff = typeof lmsCohortStaff.$inferSelect;
export type InsertLmsCohortStaff = typeof lmsCohortStaff.$inferInsert;

// ─── LMS: Instructors & Payouts ───────────────────────────────────────────────────
export const lmsInstructors = mysqlTable("lms_instructors", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  userId: int("user_id").notNull(),
  bio: longtext("bio"),
  profileImageUrl: text("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsInstructor = typeof lmsInstructors.$inferSelect;
export type InsertLmsInstructor = typeof lmsInstructors.$inferInsert;

export const lmsCourseInstructors = mysqlTable("lms_course_instructors", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  courseId: int("course_id").notNull(),
  instructorId: int("instructor_id").notNull(),
  role: mysqlEnum("role", ["primary", "secondary"]).default("primary").notNull(),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
});
export type LmsCourseInstructor = typeof lmsCourseInstructors.$inferSelect;
export type InsertLmsCourseInstructor = typeof lmsCourseInstructors.$inferInsert;

export const instructorPayoutConfig = mysqlTable("instructor_payout_config", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  instructorId: int("instructor_id").notNull(),
  payoutMethod: mysqlEnum("payout_method", ["stripe", "bank_transfer", "paypal"]).notNull(),
  payoutDetails: text("payout_details"), // JSON: {stripeAccountId, bankAccount, etc}
  commissionPercentage: decimal("commission_percentage", { precision: 5, scale: 2 }).default("0.00").notNull(),
  totalEarned: decimal("total_earned", { precision: 12, scale: 2 }).default("0.00").notNull(),
  totalPaid: decimal("total_paid", { precision: 12, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type InstructorPayoutConfig = typeof instructorPayoutConfig.$inferSelect;
export type InsertInstructorPayoutConfig = typeof instructorPayoutConfig.$inferInsert;

export const lmsAffiliateConversions = mysqlTable("lms_affiliate_conversions", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  affiliateId: int("affiliate_id").notNull(),
  courseId: int("course_id").notNull(),
  enrollmentId: int("enrollment_id").notNull(),
  commissionAmount: decimal("commission_amount", { precision: 12, scale: 2 }).notNull(),
  status: mysqlEnum("status", ["pending", "approved", "paid"]).default("pending").notNull(),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsAffiliateConversion = typeof lmsAffiliateConversions.$inferSelect;
export type InsertLmsAffiliateConversion = typeof lmsAffiliateConversions.$inferInsert;

// ─── LMS: Certificates ────────────────────────────────────────────────────────────
export const lmsCertificateTemplates = mysqlTable("lms_certificate_templates", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  templateHtml: longtext("template_html").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsCertificateTemplate = typeof lmsCertificateTemplates.$inferSelect;
export type InsertLmsCertificateTemplate = typeof lmsCertificateTemplates.$inferInsert;

export const lmsCertificates = mysqlTable("lms_certificates", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  enrollmentId: int("enrollment_id").notNull(),
  templateId: int("template_id").notNull(),
  certificateNumber: varchar("certificate_number", { length: 64 }).unique().notNull(),
  issuedAt: timestamp("issued_at").defaultNow().notNull(),
});
export type LmsCertificate = typeof lmsCertificates.$inferSelect;
export type InsertLmsCertificate = typeof lmsCertificates.$inferInsert;

// ─── LMS: Orders & Pricing ────────────────────────────────────────────────────────
export const lmsOrders = mysqlTable("lms_orders", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  userId: int("user_id"),
  courseId: int("course_id").notNull(),
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 8 }).default("usd").notNull(),
  status: mysqlEnum("status", ["pending", "completed", "failed", "refunded"]).default("pending").notNull(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});
export type LmsOrder = typeof lmsOrders.$inferSelect;
export type InsertLmsOrder = typeof lmsOrders.$inferInsert;

// ─── LMS: Support Features ────────────────────────────────────────────────────────
export const lmsLessonNotes = mysqlTable("lms_lesson_notes", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  enrollmentId: int("enrollment_id").notNull(),
  lessonId: int("lesson_id").notNull(),
  noteContent: longtext("note_content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsLessonNote = typeof lmsLessonNotes.$inferSelect;
export type InsertLmsLessonNote = typeof lmsLessonNotes.$inferInsert;

export const lmsLessonBookmarks = mysqlTable("lms_lesson_bookmarks", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  enrollmentId: int("enrollment_id").notNull(),
  lessonId: int("lesson_id").notNull(),
  bookmarkedAt: timestamp("bookmarked_at").defaultNow().notNull(),
});
export type LmsLessonBookmark = typeof lmsLessonBookmarks.$inferSelect;
export type InsertLmsLessonBookmark = typeof lmsLessonBookmarks.$inferInsert;

export const lmsVideoEvents = mysqlTable("lms_video_events", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  enrollmentId: int("enrollment_id").notNull(),
  lessonId: int("lesson_id").notNull(),
  eventType: mysqlEnum("event_type", ["play", "pause", "seek", "complete"]).notNull(),
  eventData: text("event_data"), // JSON: {timestamp, position, etc}
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsVideoEvent = typeof lmsVideoEvents.$inferSelect;
export type InsertLmsVideoEvent = typeof lmsVideoEvents.$inferInsert;

// ─── LMS: Collections & Groups ────────────────────────────────────────────────────
export const lmsCollections = mysqlTable("lms_collections", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: longtext("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsCollection = typeof lmsCollections.$inferSelect;
export type InsertLmsCollection = typeof lmsCollections.$inferInsert;

export const lmsCollectionCourses = mysqlTable("lms_collection_courses", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  collectionId: int("collection_id").notNull(),
  courseId: int("course_id").notNull(),
  position: int("position").default(0).notNull(),
});
export type LmsCollectionCourse = typeof lmsCollectionCourses.$inferSelect;
export type InsertLmsCollectionCourse = typeof lmsCollectionCourses.$inferInsert;

export const lmsGroups = mysqlTable("lms_groups", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: longtext("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type LmsGroup = typeof lmsGroups.$inferSelect;
export type InsertLmsGroup = typeof lmsGroups.$inferInsert;

export const lmsGroupCourses = mysqlTable("lms_group_courses", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  groupId: int("group_id").notNull(),
  courseId: int("course_id").notNull(),
});
export type LmsGroupCourse = typeof lmsGroupCourses.$inferSelect;
export type InsertLmsGroupCourse = typeof lmsGroupCourses.$inferInsert;

export const lmsGroupSeats = mysqlTable("lms_group_seats", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  groupId: int("group_id").notNull(),
  userId: int("user_id").notNull(),
  assignedAt: timestamp("assigned_at").defaultNow().notNull(),
});
export type LmsGroupSeat = typeof lmsGroupSeats.$inferSelect;
export type InsertLmsGroupSeat = typeof lmsGroupSeats.$inferInsert;


// ─── Media Repository ─────────────────────────────────────────────────────────────
export const mediaFolders = mysqlTable("media_folders", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  parentFolderId: int("parent_folder_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type MediaFolder = typeof mediaFolders.$inferSelect;
export type InsertMediaFolder = typeof mediaFolders.$inferInsert;

export const mediaAssets = mysqlTable("media_assets", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  folderId: int("folder_id"),
  filename: varchar("filename", { length: 255 }).notNull(),
  mimeType: varchar("mime_type", { length: 100 }).notNull(),
  size: bigint("size", { mode: "number" }).notNull(),
  s3Key: varchar("s3_key", { length: 500 }).notNull(),
  s3Url: text("s3_url").notNull(),
  uploadedBy: int("uploaded_by").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type MediaAsset = typeof mediaAssets.$inferSelect;
export type InsertMediaAsset = typeof mediaAssets.$inferInsert;

export const mediaVersions = mysqlTable("media_versions", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  assetId: int("asset_id").notNull(),
  versionNumber: int("version_number").notNull(),
  s3Key: varchar("s3_key", { length: 500 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type MediaVersion = typeof mediaVersions.$inferSelect;
export type InsertMediaVersion = typeof mediaVersions.$inferInsert;

export const mediaAccessRules = mysqlTable("media_access_rules", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  assetId: int("asset_id").notNull(),
  accessType: mysqlEnum("access_type", ["public", "private", "restricted"]).default("private").notNull(),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type MediaAccessRule = typeof mediaAccessRules.$inferSelect;
export type InsertMediaAccessRule = typeof mediaAccessRules.$inferInsert;

export const mediaAccessGrants = mysqlTable("media_access_grants", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  ruleId: int("rule_id").notNull(),
  userId: int("user_id").notNull(),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
});
export type MediaAccessGrant = typeof mediaAccessGrants.$inferSelect;
export type InsertMediaAccessGrant = typeof mediaAccessGrants.$inferInsert;

export const mediaUploadSessions = mysqlTable("media_upload_sessions", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  uploadedBy: int("uploaded_by").notNull(),
  status: mysqlEnum("status", ["pending", "completed", "failed"]).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});
export type MediaUploadSession = typeof mediaUploadSessions.$inferSelect;
export type InsertMediaUploadSession = typeof mediaUploadSessions.$inferInsert;

export const mediaViewEvents = mysqlTable("media_view_events", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  assetId: int("asset_id").notNull(),
  viewedBy: int("viewed_by"),
  viewedAt: timestamp("viewed_at").defaultNow().notNull(),
});
export type MediaViewEvent = typeof mediaViewEvents.$inferSelect;
export type InsertMediaViewEvent = typeof mediaViewEvents.$inferInsert;

// ─── Funnel Management ─────────────────────────────────────────────────────────────
export const funnelPages = mysqlTable("funnel_pages", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["landing", "sales", "thank_you", "checkout"]).notNull(),
  content: longtext("content"),
  customDomain: varchar("customDomain", { length: 255 }),
  customDomainVerified: boolean("customDomainVerified").default(false).notNull(),
  customDomainVerificationToken: varchar("customDomainVerificationToken", { length: 128 }),
  customDomainVerificationStatus: mysqlEnum("customDomainVerificationStatus", ["unverified", "pending", "verified"]).default("unverified").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type FunnelPage = typeof funnelPages.$inferSelect;
export type InsertFunnelPage = typeof funnelPages.$inferInsert;

export const funnelBranchRules = mysqlTable("funnel_branch_rules", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  pageId: int("page_id").notNull(),
  condition: varchar("condition", { length: 500 }).notNull(),
  targetPageId: int("target_page_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type FunnelBranchRule = typeof funnelBranchRules.$inferSelect;
export type InsertFunnelBranchRule = typeof funnelBranchRules.$inferInsert;

export const funnelLeads = mysqlTable("funnel_leads", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  pageId: int("page_id").notNull(),
  email: varchar("email", { length: 320 }).notNull(),
  name: varchar("name", { length: 255 }),
  leadData: json("lead_data"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type FunnelLead = typeof funnelLeads.$inferSelect;
export type InsertFunnelLead = typeof funnelLeads.$inferInsert;

export const funnelPurchases = mysqlTable("funnel_purchases", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  userId: int("user_id"),
  leadId: int("lead_id"),
  email: varchar("email", { length: 320 }).notNull(),
  name: varchar("name", { length: 255 }),
  phone: varchar("phone", { length: 20 }),
  // Product details
  productName: varchar("product_name", { length: 255 }).notNull(),
  productType: mysqlEnum("product_type", ["course", "download", "quiz", "physical", "membership", "bundle", "other"]).default("other").notNull(),
  productId: int("product_id"),
  // Pricing
  amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 10 }).default("USD").notNull(),
  // Order bumps (JSON array of {title, price})
  orderBumps: longtext("order_bumps"),
  // Stripe payment tracking
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  stripeSessionId: varchar("stripe_session_id", { length: 255 }),
  // Source attribution
  sourceType: mysqlEnum("source_type", ["funnel", "landing_page", "product_page", "lms_lesson", "email", "other"]).default("other").notNull(),
  sourceFunnelId: int("source_funnel_id"),
  sourceFunnelPageId: int("source_funnel_page_id"),
  sourceLandingPageId: int("source_landing_page_id"),
  sourceLmsLessonId: int("source_lms_lesson_id"),
  // Fulfillment
  fulfillmentCourseId: int("fulfillment_course_id"),
  fulfillmentDownloadId: int("fulfillment_download_id"),
  fulfillmentQuizId: int("fulfillment_quiz_id"),
  fulfillmentMembershipId: int("fulfillment_membership_id"),
  // Shipping (for physical products)
  shippingName: varchar("shipping_name", { length: 255 }),
  shippingLine1: varchar("shipping_line1", { length: 255 }),
  shippingLine2: varchar("shipping_line2", { length: 255 }),
  shippingCity: varchar("shipping_city", { length: 100 }),
  shippingState: varchar("shipping_state", { length: 100 }),
  shippingPostalCode: varchar("shipping_postal_code", { length: 20 }),
  shippingCountry: varchar("shipping_country", { length: 10 }),
  // Promo code
  promoCode: varchar("promo_code", { length: 100 }),
  discountApplied: decimal("discount_applied", { precision: 12, scale: 2 }),
  // Status
  status: mysqlEnum("status", ["pending", "paid", "completed", "failed", "refunded"]).default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type FunnelPurchase = typeof funnelPurchases.$inferSelect;
export type InsertFunnelPurchase = typeof funnelPurchases.$inferInsert;
// Digital products tables already defined above in the schema

// ─── Member Management ────────────────────────────────────────────────────────────
export const membershipPlans = mysqlTable("membership_plans", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: longtext("description"),
  price: decimal("price", { precision: 12, scale: 2 }).notNull(),
  billingInterval: mysqlEnum("billing_interval", ["monthly", "quarterly", "annual"]).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type MembershipPlan = typeof membershipPlans.$inferSelect;
export type InsertMembershipPlan = typeof membershipPlans.$inferInsert;

export const membershipSubscriptions = mysqlTable("membership_subscriptions", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  userId: int("user_id").notNull(),
  planId: int("plan_id").notNull(),
  status: mysqlEnum("status", ["active", "paused", "cancelled"]).default("active").notNull(),
  startDate: timestamp("start_date").defaultNow().notNull(),
  endDate: timestamp("end_date"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type MembershipSubscription = typeof membershipSubscriptions.$inferSelect;
export type InsertMembershipSubscription = typeof membershipSubscriptions.$inferInsert;

export const membershipPlanAccess = mysqlTable("membership_plan_access", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  planId: int("plan_id").notNull(),
  resourceType: varchar("resource_type", { length: 100 }).notNull(),
  resourceId: int("resource_id").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type MembershipPlanAccess = typeof membershipPlanAccess.$inferSelect;
export type InsertMembershipPlanAccess = typeof membershipPlanAccess.$inferInsert;

// Email campaigns tables already defined above in the schema

// ─── Form Builder ─────────────────────────────────────────────────────────────────
export const generalFormTemplates = mysqlTable("general_form_templates", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull(),
  description: longtext("description"),
  customDomain: varchar("customDomain", { length: 255 }),
  customDomainVerified: boolean("customDomainVerified").default(false).notNull(),
  customDomainVerificationToken: varchar("customDomainVerificationToken", { length: 128 }),
  customDomainVerificationStatus: mysqlEnum("customDomainVerificationStatus", ["unverified", "pending", "verified"]).default("unverified").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type GeneralFormTemplate = typeof generalFormTemplates.$inferSelect;
export type InsertGeneralFormTemplate = typeof generalFormTemplates.$inferInsert;

export const generalFormSections = mysqlTable("general_form_sections", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  formId: int("form_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  position: int("position").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type GeneralFormSection = typeof generalFormSections.$inferSelect;
export type InsertGeneralFormSection = typeof generalFormSections.$inferInsert;

export const generalFormItems = mysqlTable("general_form_items", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  sectionId: int("section_id").notNull(),
  fieldType: varchar("field_type", { length: 50 }).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  required: boolean("required").default(false).notNull(),
  position: int("position").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type GeneralFormItem = typeof generalFormItems.$inferSelect;
export type InsertGeneralFormItem = typeof generalFormItems.$inferInsert;

export const generalFormOptions = mysqlTable("general_form_options", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  itemId: int("item_id").notNull(),
  optionLabel: varchar("option_label", { length: 255 }).notNull(),
  optionValue: varchar("option_value", { length: 255 }).notNull(),
  position: int("position").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type GeneralFormOption = typeof generalFormOptions.$inferSelect;
export type InsertGeneralFormOption = typeof generalFormOptions.$inferInsert;

export const generalFormSubmissions = mysqlTable("general_form_submissions", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  formId: int("form_id").notNull(),
  submissionData: json("submission_data").notNull(),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
});
export type GeneralFormSubmission = typeof generalFormSubmissions.$inferSelect;
export type InsertGeneralFormSubmission = typeof generalFormSubmissions.$inferInsert;

export const generalFormBranchRules = mysqlTable("general_form_branch_rules", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  formId: int("form_id").notNull(),
  condition: varchar("condition", { length: 500 }).notNull(),
  action: varchar("action", { length: 500 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type GeneralFormBranchRule = typeof generalFormBranchRules.$inferSelect;
export type InsertGeneralFormBranchRule = typeof generalFormBranchRules.$inferInsert;

export const generalFormWebhooks = mysqlTable("general_form_webhooks", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("orgId").notNull(),
  formId: int("form_id").notNull(),
  webhookUrl: text("webhook_url").notNull(),
  event: varchar("event", { length: 100 }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type GeneralFormWebhook = typeof generalFormWebhooks.$inferSelect;
export type InsertGeneralFormWebhook = typeof generalFormWebhooks.$inferInsert;

// ─── Funnel Templates ────────────────────────────────────────────────────────
export const funnelTemplates = mysqlTable("funnel_templates", {
  id: int("id").primaryKey().autoincrement(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  pagesJson: longtext("pages_json").notNull(),
  accentColor: varchar("accent_color", { length: 20 }).default("#0d9488"),
  bgColor: varchar("bg_color", { length: 20 }).default("#f8fafc"),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at").defaultNow(),
});
export type FunnelTemplate = typeof funnelTemplates.$inferSelect;

// ─── Funnel Branch Conditions ─────────────────────────────────────────────────
export const funnelBranchConditions = mysqlTable("funnel_branch_conditions", {
  id: int("id").autoincrement().primaryKey(),
  ruleId: int("rule_id").notNull(),
  variable: mysqlEnum("variable", [
    "product_purchased",
    "order_bump_selected",
    "email_contains",
    "email_domain",
    "purchase_price",
    "source_url",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "date_range",
    "day_of_week",
    "hour_of_day",
    "country",
    "device_type",
    "custom_field",
  ]).notNull(),
  operator: mysqlEnum("operator", [
    "equals",
    "not_equals",
    "contains",
    "not_contains",
    "starts_with",
    "ends_with",
    "greater_than",
    "less_than",
    "between",
    "in_list",
    "not_in_list",
    "is_set",
    "is_not_set",
  ]).notNull(),
  value: varchar("value", { length: 1024 }).notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type FunnelBranchCondition = typeof funnelBranchConditions.$inferSelect;
export type InsertFunnelBranchCondition = typeof funnelBranchConditions.$inferInsert;

// ─── Digital Purchases ────────────────────────────────────────────────────────
export const digitalPurchases = mysqlTable("digital_purchases", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  productId: int("product_id").notNull(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  stripeCheckoutSessionId: varchar("stripe_checkout_session_id", { length: 255 }),
  purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
});
export type DigitalPurchase = typeof digitalPurchases.$inferSelect;

// ─── Digital Bundle Items ─────────────────────────────────────────────────────
export const digitalBundleItems = mysqlTable("digital_bundle_items", {
  id: int("id").autoincrement().primaryKey(),
  bundleId: int("bundle_id").notNull(),
  productId: int("product_id").notNull(),
  sortOrder: int("sort_order").default(0).notNull(),
});
export type DigitalBundleItem = typeof digitalBundleItems.$inferSelect;

// ─── Digital Bundle Purchases ─────────────────────────────────────────────────
export const digitalBundlePurchases = mysqlTable("digital_bundle_purchases", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  bundleId: int("bundle_id").notNull(),
  stripeCheckoutSessionId: varchar("stripe_checkout_session_id", { length: 255 }),
  purchasedAt: timestamp("purchased_at").defaultNow().notNull(),
});
export type DigitalBundlePurchase = typeof digitalBundlePurchases.$inferSelect;

// ─── Brand Memberships ────────────────────────────────────────────────────────
export const brandMemberships = mysqlTable("brandMemberships", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  brand: varchar("brand", { length: 32 }).notNull(),
  tier: varchar("tier", { length: 32 }).notNull().default("free"),
  status: varchar("status", { length: 32 }).notNull().default("active"),
  stripeCustomerId: varchar("stripeCustomerId", { length: 128 }),
  stripeSubscriptionId: varchar("stripeSubscriptionId", { length: 128 }),
  grantedAt: timestamp("grantedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
  source: varchar("source", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BrandMembership = typeof brandMemberships.$inferSelect;
export type InsertBrandMembership = typeof brandMemberships.$inferInsert;

// ─── Physical Products ────────────────────────────────────────────────────────
export const physicalProducts = mysqlTable("physical_products", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  subtitle: varchar("subtitle", { length: 500 }),
  description: longtext("description"),
  details: longtext("details"),
  thumbnailUrl: text("thumbnail_url"),
  price: int("price").default(0).notNull(),
  compareAtPrice: int("compare_at_price"),
  isFree: boolean("is_free").default(false).notNull(),
  currency: varchar("currency", { length: 8 }).default("usd").notNull(),
  checkoutMode: mysqlEnum("checkout_mode", ["native", "shopify", "external"]).default("native").notNull(),
  shopifyProductUrl: text("shopify_product_url"),
  shopifyEmbedCode: longtext("shopify_embed_code"),
  shopifyProductId: varchar("shopify_product_id", { length: 255 }),
  externalCheckoutUrl: text("external_checkout_url"),
  requiresShipping: boolean("requires_shipping").default(true).notNull(),
  shippingCountries: text("shipping_countries"),
  status: mysqlEnum("status", ["draft", "published", "hidden", "private", "archived"]).default("draft").notNull(),
  landingHeadline: varchar("landing_headline", { length: 500 }),
  landingBody: longtext("landing_body"),
  landingFeatures: longtext("landing_features"),
  landingBlocks: longtext("landing_blocks"),
  orgId: int("org_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type PhysicalProduct = typeof physicalProducts.$inferSelect;
export type InsertPhysicalProduct = typeof physicalProducts.$inferInsert;

// ─── LMS Landing Pages ────────────────────────────────────────────────────────
export const lmsLandingPages = mysqlTable("lms_landing_pages", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("course_id").notNull().unique(),
  heroTitle: varchar("hero_title", { length: 255 }),
  heroSubtitle: text("hero_subtitle"),
  heroImageUrl: text("hero_image_url"),
  bodyContent: longtext("body_content"),
  ctaText: varchar("cta_text", { length: 128 }).default("Enroll Now"),
  whatYouLearn: longtext("what_you_learn"),
  requirements: longtext("requirements"),
  isCustom: boolean("is_custom").default(false).notNull(),
  blocks: longtext("blocks"),
  seoTitle: varchar("seo_title", { length: 255 }),
  seoDescription: text("seo_description"),
  seoImage: varchar("seo_image", { length: 512 }),
  publishDomain: varchar("publish_domain", { length: 255 }),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsLandingPage = typeof lmsLandingPages.$inferSelect;

// ─── Digital Bundles ──────────────────────────────────────────────────────────
export const digitalBundles = mysqlTable("digital_bundles", {
  id: int("id").autoincrement().primaryKey(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  title: varchar("title", { length: 255 }).notNull(),
  subtitle: varchar("subtitle", { length: 500 }),
  description: longtext("description"),
  thumbnailUrl: text("thumbnail_url"),
  originalPrice: int("original_price").default(0).notNull(),
  discountPrice: int("discount_price").default(0).notNull(),
  currency: varchar("currency", { length: 8 }).default("usd").notNull(),
  status: mysqlEnum("status", ["draft", "published", "hidden", "private", "archived"]).default("draft").notNull(),
  orgId: int("org_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type DigitalBundle = typeof digitalBundles.$inferSelect;

// ─── Block Templates ──────────────────────────────────────────────────────────
export const blockTemplates = mysqlTable("blockTemplates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  blockType: varchar("blockType", { length: 80 }).notNull(),
  blockData: longtext("blockData").notNull(),
  tags: varchar("tags", { length: 500 }),
  orgId: int("orgId"),
  createdByUserId: int("createdByUserId").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type BlockTemplate = typeof blockTemplates.$inferSelect;
export type InsertBlockTemplate = typeof blockTemplates.$inferInsert;

// ─── LMS Page Templates ───────────────────────────────────────────────────────
export const lmsPageTemplates = mysqlTable("lms_page_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  templateType: mysqlEnum("template_type", ["page", "block"]).notNull().default("page"),
  blockType: varchar("block_type", { length: 64 }),
  blocks: longtext("blocks").notNull(),
  thumbnailUrl: text("thumbnail_url"),
  orgId: int("org_id"),
  createdBy: int("created_by"),
  createdAt: bigint("created_at", { mode: "number" }).notNull(),
  updatedAt: bigint("updated_at", { mode: "number" }).notNull(),
});
export type LmsPageTemplate = typeof lmsPageTemplates.$inferSelect;
export type NewLmsPageTemplate = typeof lmsPageTemplates.$inferInsert;

// ─── Global Form Theme ────────────────────────────────────────────────────────
export const globalFormTheme = mysqlTable("global_form_theme", {
  id: int("id").autoincrement().primaryKey(),
  themeSettings: text("theme_settings"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type GlobalFormTheme = typeof globalFormTheme.$inferSelect;

// ─── Google Form Integrations ─────────────────────────────────────────────────
export const googleFormIntegrations = mysqlTable("googleFormIntegrations", {
  id: int("id").autoincrement().primaryKey(),
  formId: int("formId").notNull().unique(),
  googleClientId: varchar("googleClientId", { length: 500 }),
  googleClientSecret: varchar("googleClientSecret", { length: 500 }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  tokenExpiresAt: bigint("tokenExpiresAt", { mode: "number" }),
  connectedEmail: varchar("connectedEmail", { length: 255 }),
  spreadsheetId: varchar("spreadsheetId", { length: 255 }),
  spreadsheetName: varchar("spreadsheetName", { length: 500 }),
  sheetTabName: varchar("sheetTabName", { length: 255 }).default("Form Responses"),
  headersInitialised: boolean("headersInitialised").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type GoogleFormIntegration = typeof googleFormIntegrations.$inferSelect;

// ─── LMS Pricing Options ──────────────────────────────────────────────────────
export const lmsPricingOptions = mysqlTable("lms_pricing_options", {
  id: int("id").autoincrement().primaryKey(),
  courseId: int("course_id").notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  sublabel: varchar("sublabel", { length: 500 }),
  pricingType: mysqlEnum("pricing_type", ["one_time", "subscription", "payment_plan", "free"]).default("one_time").notNull(),
  price: int("price").default(0).notNull(),
  stripePriceId: varchar("stripe_price_id", { length: 255 }),
  subscriptionInterval: mysqlEnum("subscription_interval", ["monthly", "quarterly", "annual"]),
  downPayment: int("down_payment").default(0),
  installmentCount: int("installment_count").default(0),
  installmentAmount: int("installment_amount").default(0),
  installmentIntervalDays: int("installment_interval_days").default(30),
  ctaLabel: varchar("cta_label", { length: 100 }),
  ctaUrl: varchar("cta_url", { length: 2048 }),
  sortOrder: int("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type LmsPricingOption = typeof lmsPricingOptions.$inferSelect;

// ─── Email Lists ──────────────────────────────────────────────────────────────
export const emailLists = mysqlTable("emailLists", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull(),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  subscriberCount: int("subscriberCount").default(0).notNull(),
  webhookToken: varchar("webhookToken", { length: 64 }),
  orgId: int("orgId"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
export type EmailList = typeof emailLists.$inferSelect;
export type InsertEmailList = typeof emailLists.$inferInsert;

// ─── Email List Subscribers ───────────────────────────────────────────────────
export const emailListSubscribers = mysqlTable("emailListSubscribers", {
  id: int("id").autoincrement().primaryKey(),
  listId: int("listId").notNull(),
  email: varchar("email", { length: 300 }).notNull(),
  name: varchar("name", { length: 300 }),
  userId: int("userId"),
  source: varchar("source", { length: 100 }),
  sourceId: varchar("sourceId", { length: 100 }),
  status: varchar("status", { length: 50 }).default("subscribed").notNull(),
  subscribedAt: timestamp("subscribedAt").defaultNow().notNull(),
  unsubscribedAt: timestamp("unsubscribedAt"),
  metadata: text("metadata"),
});
export type EmailListSubscriber = typeof emailListSubscribers.$inferSelect;
export type InsertEmailListSubscriber = typeof emailListSubscribers.$inferInsert;

// ─── Digital Product Files ────────────────────────────────────────────────────
export const digitalProductFiles = mysqlTable("digital_product_files", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("product_id").notNull(),
  fileName: varchar("file_name", { length: 500 }).notNull(),
  fileUrl: text("file_url").notNull(),
  fileKey: varchar("file_key", { length: 500 }).notNull(),
  fileSize: int("file_size").default(0).notNull(),
  mimeType: varchar("mime_type", { length: 100 }),
  sortOrder: int("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type DigitalProductFile = typeof digitalProductFiles.$inferSelect;

// ─── Digital Download Events ──────────────────────────────────────────────────
export const digitalDownloadEvents = mysqlTable("digital_download_events", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  productId: int("product_id").notNull(),
  fileId: int("file_id").notNull(),
  downloadedAt: timestamp("downloaded_at").defaultNow().notNull(),
});
export type DigitalDownloadEvent = typeof digitalDownloadEvents.$inferSelect;

// ─── LMS Archive ─────────────────────────────────────────────────────────────
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

// ─── SSO Tokens ───────────────────────────────────────────────────────────────
export const ssoTokens = mysqlTable("sso_tokens", {
  id: int("id").autoincrement().primaryKey(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  userId: int("user_id").notNull(),
  usedAt: timestamp("used_at"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type SsoToken = typeof ssoTokens.$inferSelect;

// ─── IP Access Logs ───────────────────────────────────────────────────────────
export const ipAccessLogs = mysqlTable("ip_access_logs", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  ipAddress: varchar("ip_address", { length: 45 }).notNull(),
  userAgent: text("user_agent"),
  contentType: mysqlEnum("content_type", ["course", "download", "paid_content"]).notNull(),
  contentId: int("content_id"),
  accessedAt: timestamp("accessed_at").defaultNow().notNull(),
});
export type IpAccessLog = typeof ipAccessLogs.$inferSelect;

// ─── Sharing Abuse Flags ──────────────────────────────────────────────────────
export const sharingAbuseFlags = mysqlTable("sharing_abuse_flags", {
  id: int("id").primaryKey().autoincrement(),
  userId: int("user_id").notNull(),
  status: mysqlEnum("status", ["flagged", "confirmed", "dismissed", "warned"]).default("flagged").notNull(),
  distinctIpCount: int("distinct_ip_count").default(0).notNull(),
  ipAddresses: longtext("ip_addresses"),
  detectionReason: text("detection_reason"),
  alertSentAt: timestamp("alert_sent_at"),
  reviewedAt: timestamp("reviewed_at"),
  reviewedBy: int("reviewed_by"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type SharingAbuseFlag = typeof sharingAbuseFlags.$inferSelect;

// ─── Physical Product Pricing Options ────────────────────────────────────────
export const physicalProductPricingOptions = mysqlTable("physical_product_pricing_options", {
  id: int("id").autoincrement().primaryKey(),
  productId: int("product_id").notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  sublabel: varchar("sublabel", { length: 500 }),
  pricingType: mysqlEnum("physical_pricing_type", ["one_time", "free"]).default("one_time").notNull(),
  price: int("price").default(0).notNull(),
  compareAtPrice: int("compare_at_price"),
  stripePriceId: varchar("stripe_price_id", { length: 255 }),
  ctaLabel: varchar("cta_label", { length: 100 }),
  sortOrder: int("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type PhysicalProductPricingOption = typeof physicalProductPricingOptions.$inferSelect;

// ─── Physical Product Orders ──────────────────────────────────────────────────
export const physicalProductOrders = mysqlTable("physical_product_orders", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("user_id").notNull(),
  productId: int("product_id").notNull(),
  pricingOptionId: int("pricing_option_id"),
  amountPaid: int("amount_paid").default(0).notNull(),
  currency: varchar("currency", { length: 8 }).default("usd").notNull(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
  stripeCheckoutSessionId: varchar("stripe_checkout_session_id", { length: 255 }),
  shippingName: varchar("shipping_name", { length: 255 }),
  shippingLine1: varchar("shipping_line1", { length: 255 }),
  shippingLine2: varchar("shipping_line2", { length: 255 }),
  shippingCity: varchar("shipping_city", { length: 100 }),
  shippingState: varchar("shipping_state", { length: 100 }),
  shippingPostalCode: varchar("shipping_postal_code", { length: 20 }),
  shippingCountry: varchar("shipping_country", { length: 10 }),
  fulfillmentStatus: mysqlEnum("physical_fulfillment_status", ["pending", "processing", "shipped", "delivered", "cancelled", "refunded"]).default("pending").notNull(),
  trackingNumber: varchar("tracking_number", { length: 255 }),
  trackingCarrier: varchar("tracking_carrier", { length: 100 }),
  notes: text("notes"),
  orderedAt: timestamp("ordered_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type PhysicalProductOrder = typeof physicalProductOrders.$inferSelect;
export type InsertPhysicalProductOrder = typeof physicalProductOrders.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════════
// QUIZ BUILDER — Question Banks, Quizzes, Attempts, Import
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Question Bank Tags ───────────────────────────────────────────────────────
export const quizBankTags = mysqlTable("quiz_bank_tags", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("org_id").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 20 }).default("#24abbc"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
export type QuizBankTag = typeof quizBankTags.$inferSelect;

// ─── Question Banks ───────────────────────────────────────────────────────────
export const quizBanks = mysqlTable("quiz_banks", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("org_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  isDefault: boolean("is_default").default(false),
  questionCount: int("question_count").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type QuizBank = typeof quizBanks.$inferSelect;

// ─── Question Bank Questions ──────────────────────────────────────────────────
export const quizBankQuestions = mysqlTable("quiz_bank_questions", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("org_id").notNull(),
  bankId: int("bank_id").notNull(),
  questionType: mysqlEnum("question_type", [
    "mc","tf","ms","hotspot","puzzle","matching","sequence","numeric","short_answer","info_slide"
  ]).notNull().default("mc"),
  questionText: text("question_text").notNull(),
  questionHtml: text("question_html"),
  mediaType: mysqlEnum("q_media_type", ["none","image","video"]).default("none"),
  mediaUrl: varchar("media_url", { length: 1024 }),
  mediaAlt: varchar("media_alt", { length: 255 }),
  hotspotZones: json("hotspot_zones"),
  puzzleConfig: json("puzzle_config"),
  numericMin: decimal("numeric_min", { precision: 15, scale: 4 }),
  numericMax: decimal("numeric_max", { precision: 15, scale: 4 }),
  points: int("points").default(1).notNull(),
  partialCredit: boolean("partial_credit").default(false),
  penaltyPoints: int("penalty_points").default(0),
  difficulty: mysqlEnum("difficulty", ["easy","medium","hard"]).default("medium"),
  explanationText: text("explanation_text"),
  explanationHtml: text("explanation_html"),
  explanationMediaType: mysqlEnum("exp_media_type", ["none","image","video"]).default("none"),
  explanationMediaUrl: varchar("explanation_media_url", { length: 1024 }),
  importSource: varchar("import_source", { length: 50 }),
  importJobId: int("import_job_id"),
  isArchived: boolean("is_archived").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type QuizBankQuestion = typeof quizBankQuestions.$inferSelect;
export type InsertQuizBankQuestion = typeof quizBankQuestions.$inferInsert;

// ─── Question ↔ Tag Junction ──────────────────────────────────────────────────
export const quizQuestionTags = mysqlTable("quiz_question_tags", {
  questionId: int("question_id").notNull(),
  tagId: int("tag_id").notNull(),
});

// ─── Answer Choices ───────────────────────────────────────────────────────────
export const quizAnswerChoices = mysqlTable("quiz_answer_choices", {
  id: int("id").autoincrement().primaryKey(),
  questionId: int("question_id").notNull(),
  choiceText: text("choice_text"),
  choiceHtml: text("choice_html"),
  mediaType: mysqlEnum("choice_media_type", ["none","image","video"]).default("none"),
  mediaUrl: varchar("media_url", { length: 1024 }),
  mediaAlt: varchar("media_alt", { length: 255 }),
  isCorrect: boolean("is_correct").default(false).notNull(),
  sortOrder: int("sort_order").default(0).notNull(),
  matchPairId: varchar("match_pair_id", { length: 50 }),
  matchSide: mysqlEnum("match_side", ["left","right"]),
  feedbackText: text("feedback_text"),
  feedbackMediaUrl: varchar("feedback_media_url", { length: 1024 }),
});
export type QuizAnswerChoice = typeof quizAnswerChoices.$inferSelect;
export type InsertQuizAnswerChoice = typeof quizAnswerChoices.$inferInsert;

// ─── Quizzes ──────────────────────────────────────────────────────────────────
export const quizzes = mysqlTable("quizzes", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("org_id").notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  coverImageUrl: varchar("cover_image_url", { length: 1024 }),
  timeLimitSeconds: int("time_limit_seconds"),
  maxAttempts: int("max_attempts"),
  passScorePercent: int("pass_score_percent").default(70).notNull(),
  randomizeQuestions: boolean("randomize_questions").default(false).notNull(),
  randomizeAnswers: boolean("randomize_answers").default(false).notNull(),
  feedbackMode: mysqlEnum("feedback_mode", ["immediate","end","never"]).default("end").notNull(),
  showCorrectAnswers: boolean("show_correct_answers").default(true).notNull(),
  showExplanations: boolean("show_explanations").default(true).notNull(),
  allowPartialCredit: boolean("allow_partial_credit").default(true).notNull(),
  penaltyForWrong: boolean("penalty_for_wrong").default(false).notNull(),
  status: mysqlEnum("quiz_status", ["draft","published","archived"]).default("draft").notNull(),
  themeConfig: json("theme_config"),
  priceAmountCents: int("price_amount_cents").default(0),
  currency: varchar("currency", { length: 8 }).default("usd"),
  stripeProductId: varchar("stripe_product_id", { length: 255 }),
  stripePriceId: varchar("stripe_price_id", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().onUpdateNow().notNull(),
});
export type Quiz = typeof quizzes.$inferSelect;
export type InsertQuiz = typeof quizzes.$inferInsert;

// ─── Quiz Question Pools (from bank tags) ─────────────────────────────────────
export const quizQuestionPools = mysqlTable("quiz_question_pools", {
  id: int("id").autoincrement().primaryKey(),
  quizId: int("quiz_id").notNull(),
  bankId: int("bank_id").notNull(),
  tagId: int("tag_id"),
  drawCount: int("draw_count").notNull(),
  sortOrder: int("sort_order").default(0).notNull(),
});
export type QuizQuestionPool = typeof quizQuestionPools.$inferSelect;

// ─── Quiz Question Overrides (manually pinned) ────────────────────────────────
export const quizQuestionOverrides = mysqlTable("quiz_question_overrides", {
  id: int("id").autoincrement().primaryKey(),
  quizId: int("quiz_id").notNull(),
  questionId: int("question_id").notNull(),
  sortOrder: int("sort_order").default(0).notNull(),
  alwaysInclude: boolean("always_include").default(true).notNull(),
});
export type QuizQuestionOverride = typeof quizQuestionOverrides.$inferSelect;

// ─── Quiz Attempts ────────────────────────────────────────────────────────────
export const quizAttempts = mysqlTable("quiz_attempts", {
  id: int("id").autoincrement().primaryKey(),
  quizId: int("quiz_id").notNull(),
  userId: int("user_id"),
  guestEmail: varchar("guest_email", { length: 255 }),
  attemptNumber: int("attempt_number").default(1).notNull(),
  status: mysqlEnum("attempt_status", ["in_progress","completed","abandoned","timed_out"]).default("in_progress").notNull(),
  questionSnapshot: json("question_snapshot"),
  totalPoints: int("total_points").default(0).notNull(),
  earnedPoints: int("earned_points").default(0).notNull(),
  scorePercent: decimal("score_percent", { precision: 5, scale: 2 }),
  passed: boolean("passed"),
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  timeSpentSeconds: int("time_spent_seconds"),
  sourceType: mysqlEnum("source_type", ["standalone","lesson","funnel","landing_page"]).default("standalone"),
  sourceLessonId: int("source_lesson_id"),
  sourceFunnelPageId: int("source_funnel_page_id"),
});
export type QuizAttempt = typeof quizAttempts.$inferSelect;
export type InsertQuizAttempt = typeof quizAttempts.$inferInsert;

// ─── Quiz Attempt Responses ───────────────────────────────────────────────────
export const quizAttemptResponses = mysqlTable("quiz_attempt_responses", {
  id: int("id").autoincrement().primaryKey(),
  attemptId: int("attempt_id").notNull(),
  questionId: int("question_id").notNull(),
  questionType: varchar("question_type", { length: 30 }).notNull(),
  selectedChoiceIds: json("selected_choice_ids"),
  hotspotClickX: decimal("hotspot_click_x", { precision: 6, scale: 2 }),
  hotspotClickY: decimal("hotspot_click_y", { precision: 6, scale: 2 }),
  textAnswer: text("text_answer"),
  numericAnswer: decimal("numeric_answer", { precision: 15, scale: 4 }),
  isCorrect: boolean("is_correct"),
  isPartiallyCorrect: boolean("is_partially_correct").default(false),
  pointsEarned: int("points_earned").default(0).notNull(),
  timeSpentSeconds: int("time_spent_seconds"),
  answeredAt: timestamp("answered_at").defaultNow().notNull(),
});
export type QuizAttemptResponse = typeof quizAttemptResponses.$inferSelect;
export type InsertQuizAttemptResponse = typeof quizAttemptResponses.$inferInsert;

// ─── Quiz Import Jobs ─────────────────────────────────────────────────────────
export const quizImportJobs = mysqlTable("quiz_import_jobs", {
  id: int("id").autoincrement().primaryKey(),
  orgId: int("org_id").notNull(),
  bankId: int("bank_id"),
  importedById: int("imported_by_id").notNull(),
  source: mysqlEnum("import_source", ["scorm","csv","xls"]).notNull(),
  filename: varchar("filename", { length: 255 }).notNull(),
  fileUrl: varchar("file_url", { length: 1024 }),
  status: mysqlEnum("import_status", ["pending","parsing","preview_ready","importing","completed","failed"]).default("pending").notNull(),
  parsedQuestions: json("parsed_questions"),
  importedCount: int("imported_count").default(0),
  skippedCount: int("skipped_count").default(0),
  errorLog: json("error_log"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});
export type QuizImportJob = typeof quizImportJobs.$inferSelect;
export type InsertQuizImportJob = typeof quizImportJobs.$inferInsert;

// ─── Quiz Access Grants ───────────────────────────────────────────────────────
export const quizAccessGrants = mysqlTable("quiz_access_grants", {
  id: int("id").autoincrement().primaryKey(),
  quizId: int("quiz_id").notNull(),
  userId: int("user_id").notNull(),
  grantedAt: timestamp("granted_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  source: mysqlEnum("grant_source", ["purchase","manual","org_member","course_enrollment"]).default("manual"),
  stripePaymentIntentId: varchar("stripe_payment_intent_id", { length: 255 }),
});
export type QuizAccessGrant = typeof quizAccessGrants.$inferSelect;
