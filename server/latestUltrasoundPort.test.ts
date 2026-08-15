import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { isStaleAssetError } from "../client/src/components/ErrorBoundary";
import { mapQuestionType, parseBlocks } from "./lib/lessonQuizQuestionBankSync";

describe("latest Ultrasound-App learning feature port", () => {
  it("recognizes HTML returned in place of a Quiz Creator JavaScript module", () => {
    expect(isStaleAssetError(new Error("'text/html' is not a valid JavaScript MIME type."))).toBe(true);
    expect(isStaleAssetError(new Error("Loading chunk 42 failed"))).toBe(true);
    expect(isStaleAssetError(new Error("ordinary validation error"))).toBe(false);
  });

  it("maps lesson quiz question variants into supported Question Bank types", () => {
    expect(mapQuestionType("multiple_choice")).toBe("mcq");
    expect(mapQuestionType("true_false")).toBe("tf");
    expect(mapQuestionType("multiselect")).toBe("multiple_select");
    expect(mapQuestionType("drag_sort")).toBe("ordering");
    expect(mapQuestionType("fill_blank")).toBe("fill_blank");
  });

  it("accepts only serialized block arrays for page-builder lesson quiz synchronization", () => {
    expect(parseBlocks('[{"id":"quiz-1","type":"lesson_quiz"}]')).toHaveLength(1);
    expect(parseBlocks('{"type":"lesson_quiz"}')).toEqual([]);
    expect(parseBlocks("not JSON")).toEqual([]);
    expect(parseBlocks(null)).toEqual([]);
  });

  it("enforces org-owned waitlist and enrollment-closed states before creating a course enrollment", () => {
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    expect(routerSource).toContain('eq(contentAvailability.productType, "course")');
    expect(routerSource).toContain('availability?.status === "waitlist"');
    expect(routerSource).toContain('availability?.status === "enrollment_closed"');
    expect(routerSource).toContain("orgId: course.orgId");
  });

  it("protects active Question Bank banks, tags, questions, and import jobs with org ownership checks", () => {
    const routerSource = readFileSync(new URL("./routers/quizBankRouter.ts", import.meta.url), "utf8");
    expect(routerSource).toContain("requireOwnedOrg(ctx, input.orgId)");
    expect(routerSource).toContain("requireBankAccess(ctx, input.id)");
    expect(routerSource).toContain("requireQuestionAccess(ctx, input.id)");
    expect(routerSource).toContain("requireTagAccess(ctx, input.id)");
    expect(routerSource).toContain("requireImportJobAccess(ctx, input.jobId)");
    expect(routerSource).toContain("The selected Question Bank belongs to another organisation.");
  });

  it("locks active Question Bank imports to their saved organization-owned media source", () => {
    const routerSource = readFileSync(new URL("./routers/quizBankRouter.ts", import.meta.url), "utf8");
    const pageSource = readFileSync(new URL("../client/src/pages/lms/QuestionBankPage.tsx", import.meta.url), "utf8");
    expect(routerSource).toContain("orgMediaId: z.number().int().positive().optional()");
    expect(routerSource).toContain("The selected media file belongs to another organisation.");
    expect(routerSource).toContain("filename: quizImportJobs.filename");
    expect(routerSource).toContain("fetch(job.fileUrl)");
    expect(pageSource).toContain('import { MediaLibraryPicker } from "@/components/MediaLibraryPicker"');
    expect(pageSource).toContain("Choose from organization media");
    expect(pageSource).toContain("orgMediaId: orgMediaId ?? undefined");
  });

  it("falls back to QTI XML question parsing for non-iSpring SCORM packages", () => {
    const routerSource = readFileSync(new URL("./routers/quizBankRouter.ts", import.meta.url), "utf8");
    expect(routerSource).toContain('parseSCORMQuestions(entry.getData().toString("utf8"))');
    expect(routerSource).toContain("if (parsedQuestions.length === 0) throw iSpringError;");
  });

  it("routes direct Media Repository extraction into a same-organization Question Bank preview", () => {
    const routerSource = readFileSync(new URL("./routers/quizBankRouter.ts", import.meta.url), "utf8");
    const repositorySource = readFileSync(new URL("../client/src/pages/admin/MediaRepository.tsx", import.meta.url), "utf8");
    const questionBankSource = readFileSync(new URL("../client/src/pages/lms/QuestionBankPage.tsx", import.meta.url), "utf8");
    expect(routerSource).toContain("mediaRepositoryAssetId: z.number().int().positive().optional()");
    expect(routerSource).toContain("The selected media repository asset belongs to another organisation.");
    expect(repositorySource).toContain("Extract to Question Bank");
    expect(repositorySource).toContain("mediaRepositoryAssetId: data.asset.id");
    expect(repositorySource).toContain("/lms/question-bank?importJob=${job.id}&bankId=${targetBankId}");
    expect(questionBankSource).toContain("const directImportJobId");
    expect(questionBankSource).toContain("initialJobId={directImportJobId}");
  });

  it("keeps webinar curriculum links and webinar mutations within the organization", () => {
    const schemaSource = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const editorSource = readFileSync(new URL("../client/src/pages/admin/WebinarEditorPage.tsx", import.meta.url), "utf8");
    expect(schemaSource).toContain('linkedCourseId: int("linked_course_id")');
    expect(routerSource).toContain("async function requireWebinarAccess");
    expect(routerSource).toContain("The linked course must belong to the webinar organization.");
    expect(editorSource).toContain('label: "Curriculum"');
    expect(editorSource).toContain("Open Course Builder");
  });

  it("scopes Question Bank folders to their bank and allows QuizMaker exports into an eligible folder", () => {
    const schemaSource = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
    const bankRouterSource = readFileSync(new URL("./routers/quizBankRouter.ts", import.meta.url), "utf8");
    const quizMakerSource = readFileSync(new URL("./quizMakerRouter.ts", import.meta.url), "utf8");
    const toolbarSource = readFileSync(new URL("../client/src/quiz-creator/components/EditorToolbar.tsx", import.meta.url), "utf8");
    expect(schemaSource).toContain('export const quizBankFolders = mysqlTable("quiz_bank_folders"');
    expect(schemaSource).toContain('folderId: int("folder_id")');
    expect(bankRouterSource).toContain("listFolders: protectedProcedure");
    expect(bankRouterSource).toContain("The selected folder belongs to another Question Bank.");
    expect(quizMakerSource).toContain("The selected Question Bank folder belongs to another organisation or bank.");
    expect(toolbarSource).toContain("Question Bank folder");
    expect(toolbarSource).toContain("folderId: targetFolderId ? Number(targetFolderId) : undefined");
  });

  it("includes the existing AI content block in the email-safe editor catalog", () => {
    const editorSource = readFileSync(new URL("../client/src/components/EmailBlockEditor.tsx", import.meta.url), "utf8");
    expect(editorSource).toContain('"ai_content",');
    expect(editorSource).toContain("EMAIL_SAFE_TYPES.includes(b.type)");
  });

  it("blocks enrollment-closed products in hosted checkout and shows a learner-facing status", () => {
    const schemaSource = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
    const checkoutSource = readFileSync(new URL("./routers/lmsCheckoutRouter.ts", import.meta.url), "utf8");
    const checkoutPageSource = readFileSync(new URL("../client/src/pages/lms/HostedCheckoutPage.tsx", import.meta.url), "utf8");
    expect(schemaSource).toContain('export const digitalProducts = mysqlTable("digital_products"');
    expect(schemaSource).toContain('enrollmentClosed: boolean("enrollment_closed").default(false).notNull()');
    expect(checkoutSource).toContain("if (content.enrollmentClosed)");
    expect(checkoutSource).toContain("Enrollment is closed for this item.");
    expect(checkoutPageSource).toContain("const enrollmentClosed = content?.enrollmentClosed === true;");
    expect(checkoutPageSource).toContain("Enrollment is closed");
  });

  it("lets digital product admins save an enrollment-closed setting", () => {
    const routerSource = readFileSync(new URL("./routers/downloadsRouter.ts", import.meta.url), "utf8");
    const editorSource = readFileSync(new URL("../client/src/pages/admin/DigitalProductEditorPage.tsx", import.meta.url), "utf8");
    expect(routerSource).toContain("enrollmentClosed: z.boolean().optional()");
    expect(editorSource).toContain("download-enrollment-closed");
    expect(editorSource).toContain("Prevent new purchases while current learners retain their existing access.");
  });

  it("lets bundle admins save an enrollment-closed setting", () => {
    const editorSource = readFileSync(new URL("../client/src/pages/products/BundleEditorPage.tsx", import.meta.url), "utf8");
    expect(editorSource).toContain("bundle-enrollment-closed");
    expect(editorSource).toContain("Prevent new bundle purchases while retaining access for current learners.");
    expect(editorSource).toContain("enrollmentClosed,");
  });

  it("lets membership admins save an enrollment-closed setting", () => {
    const editorSource = readFileSync(new URL("../client/src/pages/products/MembershipEditorPage.tsx", import.meta.url), "utf8");
    expect(editorSource).toContain("membership-enrollment-closed");
    expect(editorSource).toContain("Prevent new membership purchases while preserving access for current members.");
    expect(editorSource).toContain("enrollmentClosed: currentMembership.enrollmentClosed ?? false");
  });

  it("provides org-scoped Question Bank folder management and manual assignment", () => {
    const routerSource = readFileSync(new URL("./routers/quizBankRouter.ts", import.meta.url), "utf8");
    const pageSource = readFileSync(new URL("../client/src/pages/lms/QuestionBankPage.tsx", import.meta.url), "utf8");
    expect(routerSource).toContain("listFolders: protectedProcedure");
    expect(routerSource).toContain("createFolder: protectedProcedure");
    expect(pageSource).toContain("Question Bank Folders");
    expect(pageSource).toContain("folders={folders}");
    expect(pageSource).toContain("Folder</Label>");
  });

  it("validates and persists same-bank folders for AI-generated questions", () => {
    const routerSource = readFileSync(new URL("./routers/quizBankRouter.ts", import.meta.url), "utf8");
    const pageSource = readFileSync(new URL("../client/src/pages/lms/QuestionBankPage.tsx", import.meta.url), "utf8");
    expect(routerSource).toContain("folderId: z.number().optional()");
    expect(routerSource).toContain("The selected folder belongs to another Question Bank.");
    expect(routerSource).toContain("folderId: input.folderId");
    expect(pageSource).toContain("Save generated questions in");
    expect(pageSource).toContain("folderId: aiFolderId");
  });

  it("lists only active-organization lesson quizzes in the Quiz Creator browser", () => {
    const routerSource = readFileSync(new URL("./routers/lmsQuizLandingRouter.ts", import.meta.url), "utf8");
    const browserSource = readFileSync(new URL("../client/src/quiz-creator/components/CloudQuizBrowser.tsx", import.meta.url), "utf8");
    expect(routerSource).toContain("listOrgQuizzes: protectedProcedure");
    expect(routerSource).toContain("requireOrgAdmin(ctx.user.id, ctx.user.role, input.orgId)");
    expect(routerSource).toContain("where(eq(lmsCourses.orgId, input.orgId))");
    expect(browserSource).toContain("Course Lesson Quizzes");
    expect(browserSource).toContain("trpc.lms.quiz.listOrgQuizzes.useQuery");
  });

  it("builds Course Builder checkout and free-preview links from the course organization domain", () => {
    const enrollmentRouterSource = readFileSync(new URL("./routers/lmsEnrollmentAdminRouter.ts", import.meta.url), "utf8");
    const builderSource = readFileSync(new URL("../client/src/pages/lms/CourseBuilderPage.tsx", import.meta.url), "utf8");
    const stripeWebhookSource = readFileSync(new URL("./stripeWebhookRoutes.ts", import.meta.url), "utf8");
    const membershipSource = readFileSync(new URL("./lib/membershipFulfillment.ts", import.meta.url), "utf8");
    const courseLandingSource = readFileSync(new URL("../client/src/pages/lms/CourseLanding.tsx", import.meta.url), "utf8");
    const coursePlayerSource = readFileSync(new URL("../client/src/pages/lms/CoursePlayer.tsx", import.meta.url), "utf8");
    const myCoursesSource = readFileSync(new URL("../client/src/pages/lms/MyCoursesPage.tsx", import.meta.url), "utf8");
    const lmsLayoutSource = readFileSync(new URL("../client/src/components/LMSLayout.tsx", import.meta.url), "utf8");
    const landingBuilderSource = readFileSync(new URL("../client/src/pages/lms/LandingPageBuilder.tsx", import.meta.url), "utf8");
    const quizRouterSource = readFileSync(new URL("./quizMakerRouter.ts", import.meta.url), "utf8");
    const quizBrowserSource = readFileSync(new URL("../client/src/quiz-creator/components/CloudQuizBrowser.tsx", import.meta.url), "utf8");
    const lmsRouterSource = readFileSync(new URL("./routers/lmsRouter.ts", import.meta.url), "utf8");
    expect(enrollmentRouterSource).toContain("orgSlug: org?.slug ?? null");
    expect(enrollmentRouterSource).toContain("orgCustomDomain: org?.customDomain ?? null");
    expect(builderSource).toContain('import { getOrgBaseUrl } from "@/lib/orgUrl"');
    expect(builderSource).toContain("const courseBaseUrl = getOrgBaseUrl(course.orgSlug");
    expect(builderSource).toContain("getOrgBaseUrl(data.orgSlug, data.orgCustomDomain, data.orgDomainVerificationStatus)");
    expect(builderSource).toContain("${courseBaseUrl}/courses/${course.slug}?checkout=1");
    expect(stripeWebhookSource).toContain("const bundleLibraryUrl = bundleOrg?.slug");
    expect(stripeWebhookSource).toContain("loginUrl: bundleLibraryUrl");
    expect(membershipSource).toContain("const [membershipOrg] = plan.orgId");
    expect(membershipSource).toContain("orgSlug: membershipOrg?.slug ?? null");
    expect(membershipSource).toContain("getOrgBaseUrl(opts.orgSlug");
    expect(courseLandingSource).toContain('import { getSubdomain } from "@/hooks/useSubdomain"');
    expect(courseLandingSource).toContain("const organizationSlug = getSubdomain()");
    expect(courseLandingSource).toContain("orgId: organization?.id");
    expect(courseLandingSource).toContain("const { data: organizationTheme } = trpc.lms.publicSchool.themeBySlug.useQuery");
    expect(courseLandingSource).toContain("const landingAccentColor = (course as any)?.primaryColor");
    expect(courseLandingSource).toContain("backgroundColor: landingAccentColor");
    expect(courseLandingSource).toContain("const landingOrganizationName = organization?.name");
    expect(courseLandingSource).toContain("const isOrganizationLanding = !!organizationSlug && !!organization?.id");
    expect(courseLandingSource).toContain("isOrganizationLanding ? landingOrganizationName : \"Teachific™\"");
    expect(coursePlayerSource).toContain('import { getSubdomain } from "@/hooks/useSubdomain"');
    expect(coursePlayerSource).toContain("const playerBrandName = organization?.name");
    expect(coursePlayerSource).toContain("orgId: organization?.id");
    expect(lmsRouterSource).toContain("getCoursePlayer: protectedProcedure");
    expect(lmsRouterSource).toContain("orgId: z.number().optional()");
    expect(lmsRouterSource).toContain("eq(lmsCourses.orgId, input.orgId)");
    expect(myCoursesSource).toContain("{invoice.orgName && <p className=");
    expect(lmsLayoutSource).toContain("hover:text-[var(--org-primary)]");
    expect(lmsLayoutSource).toContain("DollarSign className=\"w-3.5 h-3.5 text-[var(--org-primary)]\"");
    expect(lmsLayoutSource).toContain("BookOpen className=\"w-3.5 h-3.5 text-[var(--org-primary)]\"");
    expect(lmsLayoutSource).toContain("const isOrganizationShell = !!subdomain");
    expect(lmsLayoutSource).toContain("const shellBrandName = organization?.name ?? \"Teachific™\"");
    expect(lmsLayoutSource).toContain("!isOrganizationShell && <nav");
    expect(landingBuilderSource).toContain('defaultData: { quote: "", author: "", avatarUrl: ""');
    expect(landingBuilderSource).toContain('defaultData: { headline: "Student Feedback", reviews: []');
    expect(landingBuilderSource).not.toContain('author: "Jane Smith, RDMS"');
    expect(landingBuilderSource).not.toContain('name: "Jane D."');
    expect(quizRouterSource).toContain('quizType: z.enum(["assessment", "practice", "survey", "exam"]).optional()');
    expect(quizRouterSource).toContain('eq(quizzes.quizType, input.quizType)');
    expect(quizRouterSource).toContain('conditions.push(inArray(quizAttempts.quizId, allowedQuizIds))');
    expect(quizBrowserSource).toContain('const [resultQuizType, setResultQuizType] = useState("all")');
    expect(quizBrowserSource).toContain('<option value="assessment">Assessment</option>');
  });

  it("preserves legacy Quiz Creator attempts while dual-writing canonical attempt fields", () => {
    const schemaSource = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
    const routerSource = readFileSync(new URL("./quizMakerRouter.ts", import.meta.url), "utf8");
    const migrationSource = readFileSync(new URL("../drizzle/0077_quiz_attempt_compatibility.sql", import.meta.url), "utf8");
    expect(schemaSource).toContain('quizId: int("quiz_id")');
    expect(schemaSource).toContain('legacyQuizId: int("quizId")');
    expect(routerSource).toContain('status: "completed"');
    expect(routerSource).toContain("legacyAnswersJson: input.answersJson");
    expect(migrationSource).toContain("ADD COLUMN IF NOT EXISTS `quiz_id`");
    expect(migrationSource).toContain("WHERE `quiz_id` = 0");
  });

  it("limits standalone Quiz Creator result filtering to an authorized organization", () => {
    const routerSource = readFileSync(new URL("./quizMakerRouter.ts", import.meta.url), "utf8");
    const browserSource = readFileSync(new URL("../client/src/quiz-creator/components/CloudQuizBrowser.tsx", import.meta.url), "utf8");
    expect(routerSource).toContain("listOrgAttemptResults: protectedProcedure");
    expect(routerSource).toContain("requireOrgAdmin(ctx.user.id, ctx.user.role, input.orgId)");
    expect(routerSource).toContain("eq(quizAttempts.legacyOrgId, input.orgId)");
    expect(routerSource).toContain("learnerEmail: z.string().trim().email().optional()");
    expect(browserSource).toContain('setActiveTab("results")');
    expect(browserSource).toContain("trpc.quizMaker.listOrgAttemptResults.useQuery");
    expect(browserSource).toContain("Filter by learner email");
  });

  it("uses the linked standalone quiz for quiz and exam lessons when a lesson quizId is present", () => {
    const playerSource = readFileSync(new URL("../client/src/pages/lms/CoursePlayerPage.tsx", import.meta.url), "utf8");
    expect(playerSource).toContain('import EmbeddedQuizPlayer from "@/components/EmbeddedQuizPlayer"');
    expect(playerSource).toContain("lesson.quizId ? (");
    expect(playerSource).toContain("<EmbeddedQuizPlayer");
    expect(playerSource).toContain("quizId={lesson.quizId}");
  });

  it("creates and plays organization-owned standalone QuizMaker links in active LMS lessons", () => {
    const schemaSource = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
    const builderRouterSource = readFileSync(new URL("./routers/lmsCourseBuilderRouter.ts", import.meta.url), "utf8");
    const builderPageSource = readFileSync(new URL("../client/src/pages/lms/CourseBuilderPage.tsx", import.meta.url), "utf8");
    const playerSource = readFileSync(new URL("../client/src/pages/lms/CoursePlayer.tsx", import.meta.url), "utf8");
    expect(schemaSource).toContain('standaloneQuizId: int("standalone_quiz_id")');
    expect(builderRouterSource).toContain("assertStandaloneQuizForCourse");
    expect(builderRouterSource).toContain("eq(quizzes.orgId, course.orgId)");
    expect(builderPageSource).toContain("Standalone Quiz Creator quiz");
    expect(builderPageSource).toContain("trpc.quizMaker.listQuizzes.useQuery");
    expect(playerSource).toContain('import EmbeddedQuizPlayer from "@/components/EmbeddedQuizPlayer"');
    expect(playerSource).toContain("lessonData.standaloneQuizId ? (");
    expect(playerSource).toContain("quizId={lessonData.standaloneQuizId}");
  });

  it("exposes answer-level feedback and media controls in the org-scoped Question Bank editor", () => {
    const questionBankPage = readFileSync(new URL("../client/src/pages/lms/QuestionBankPage.tsx", import.meta.url), "utf8");
    expect(questionBankPage).toContain('updateChoice(idx, "mediaUrl", e.target.value)');
    expect(questionBankPage).toContain('updateChoice(idx, "feedbackText", e.target.value)');
    expect(questionBankPage).toContain('updateChoice(idx, "feedbackMediaUrl", e.target.value)');
    expect(questionBankPage).toContain("Feedback for this answer (optional)");
  });

  it("wires the active organization into Question Bank media picker controls", () => {
    const questionBankPage = readFileSync(new URL("../client/src/pages/lms/QuestionBankPage.tsx", import.meta.url), "utf8");
    expect(questionBankPage).toContain('import { MediaLibraryPicker } from "@/components/MediaLibraryPicker"');
    expect(questionBankPage).toContain("orgId={orgId}");
    expect(questionBankPage).toContain("Choose question media");
    expect(questionBankPage).toContain("Feedback media");
  });

  it("provides an org-admin-gated AI generator that creates questions only in the selected Question Bank", () => {
    const routerSource = readFileSync(new URL("./routers/quizBankRouter.ts", import.meta.url), "utf8");
    const questionBankPage = readFileSync(new URL("../client/src/pages/lms/QuestionBankPage.tsx", import.meta.url), "utf8");
    expect(routerSource).toContain("generateQuestions: protectedProcedure");
    expect(routerSource).toContain("const bank = await requireBankAccess(ctx, input.bankId)");
    expect(routerSource).toContain('model: "gpt-5-mini"');
    expect(routerSource).toContain("orgId: bank.orgId");
    expect(questionBankPage).toContain("AI Question Generator");
    expect(questionBankPage).toContain("trpc.quizBank.generateQuestions.useMutation");
  });

  it("provides a Teachific-branded visual workspace for an authorized standalone Quiz Creator quiz", () => {
    const appSource = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
    const workspaceSource = readFileSync(new URL("../client/src/pages/QuizVisualBuilderPage.tsx", import.meta.url), "utf8");
    expect(appSource).toContain('path="/quiz-creator/:quizId/builder"');
    expect(workspaceSource).toContain("trpc.quizMaker.getQuiz.useQuery");
    expect(workspaceSource).toContain("Back to Teachific Quiz Creator");
    expect(workspaceSource).toContain("BrandingPanel");
    expect(workspaceSource).not.toContain("All About Ultrasound");
  });

  it("offers Teachific Form and Slides authoring modes in the visual Quiz Creator workspace", () => {
    const workspaceSource = readFileSync(new URL("../client/src/pages/QuizVisualBuilderPage.tsx", import.meta.url), "utf8");
    const slideEditorSource = readFileSync(new URL("../client/src/quiz-creator/components/SlideViewEditor.tsx", import.meta.url), "utf8");
    expect(workspaceSource).toContain('editorViewMode: "form"');
    expect(workspaceSource).toContain('editorViewMode: "slides"');
    expect(workspaceSource).toContain("SlideViewEditor");
    expect(slideEditorSource).toContain("Slide storyboard");
    expect(slideEditorSource).toContain("QuestionEditor");
  });

  it("resolves an active organization and verifies ownership in the active QuizMaker router", () => {
    const routerSource = readFileSync(new URL("../server/quizMakerRouter.ts", import.meta.url), "utf8");
    expect(routerSource).toContain("resolveQuizMakerOrg");
    expect(routerSource).toContain("requireQuizMakerAccess");
    expect(routerSource).toContain("requireQuizMakerQuestionAccess");
    expect(routerSource).toContain("requireQuizMakerChoiceAccess");
    expect(routerSource).not.toContain("orgId: 0");
    expect(routerSource).not.toContain("eq(quizzes.userId, ctx.user.id)");
    expect(routerSource).toContain("getQuizAnalytics");
    expect(routerSource).toContain("exportScorm");
    expect(routerSource).toContain("getPublishStatus");
    expect(routerSource).toContain("exportToQuestionBank");
    expect(routerSource).toContain("targetBankId");
    expect(routerSource).toContain("The selected Question Bank belongs to another organisation.");
    expect(routerSource).toContain('importSource: "quiz_maker"');
    expect(routerSource).toContain("const orgId = await resolveQuizMakerOrg(ctx)");
  });

  it("protects Quiz Creator authoring with organization ownership helpers", () => {
    const routerSource = readFileSync(new URL("./routers/quizRouter.ts", import.meta.url), "utf8");
    expect(routerSource).toContain("async function requireQuizAdmin");
    expect(routerSource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, input.orgId)");
    expect(routerSource).toContain("await requireQuizAdmin(ctx, input.id)");
  });

  it("rejects cross-organization Question Bank pools, tags, and overrides", () => {
    const routerSource = readFileSync(new URL("./routers/quizRouter.ts", import.meta.url), "utf8");
    expect(routerSource).toContain("requireQuizBankInOrg(pool.bankId, quiz.orgId)");
    expect(routerSource).toContain("Question Bank tags must belong to the quiz organization.");
    expect(routerSource).toContain("Question overrides must belong to the quiz organization.");
  });

  it("protects legacy lesson quiz authoring, groups, and AI lesson context with course ownership checks", () => {
    const routerSource = readFileSync(new URL("./routers/lmsQuizLandingRouter.ts", import.meta.url), "utf8");
    expect(routerSource).toContain("async function requireLegacyQuizOwnership");
    expect(routerSource).toContain("await requireLessonQuizOwnership(ctx, input.lessonId)");
    expect(routerSource).toContain("await requireLegacyQuestionOwnership(ctx, input.id)");
    expect(routerSource).toContain("AI course context must belong to the quiz course.");
    expect(routerSource).toContain("Selected lesson context must belong to the quiz course.");
    expect(routerSource).toContain("await requireLegacyQuizGroupOwnership(ctx, input.groupId)");
  });
});
