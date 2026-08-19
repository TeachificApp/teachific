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

  it("requires organization-admin ownership before creating a native package from a Question Bank import", () => {
    const importRouteSource = readFileSync(new URL("./quizImportRoutes.ts", import.meta.url), "utf8");
    expect(importRouteSource).toContain('import { requireOrgAdmin } from "./db"');
    expect(importRouteSource).toContain('await requireOrgAdmin(userId, (user as any).role ?? "user", orgId);');
    expect(importRouteSource).toContain("return res.status(403).json({");
  });

  it("applies organization-owned LMS shell configuration without platform branding in package playback", () => {
    const playerSource = readFileSync(new URL("../client/src/pages/PlayerPage.tsx", import.meta.url), "utf8");
    expect(playerSource).toContain('import { useOrgTheme } from "@/contexts/OrgThemeContext"');
    expect(playerSource).toContain("const packageShellConfig = parseLmsShellConfig((pkg as any)?.lmsShellConfig);");
    expect(playerSource).toContain('shellConfig.shellTitle?.trim() || shellConfig.organizationName?.trim() || "Learning Portal"');
    expect(playerSource).toContain("shellConfig.logoUrl?.trim() || orgTheme.adminLogoUrl?.trim() || null");
    expect(playerSource).toContain("const showProgress = shellConfig.showProgress !== false;");
    expect(playerSource).toContain("const showCompletionBadge = shellConfig.showCompletionBadge !== false;");
    expect(playerSource).toContain("const showSessionStatus = shellConfig.showSessionStatus !== false;");
    expect(playerSource).toContain("const showFooter = shellConfig.showFooter !== false;");
    expect(playerSource).toContain('theme: parsed.theme === "light" || parsed.theme === "dark" ? parsed.theme : undefined');
    expect(playerSource).toContain('const lmsShellTheme = shellConfig.theme ?? "dark";');
    expect(playerSource).toContain('const isLightLmsShell = lmsShellTheme === "light";');
    expect(playerSource).toContain("showProgress && (completionStatus");
    expect(playerSource).toContain("showCompletionBadge && completionStatus");
    expect(playerSource).not.toContain("Teachific&#8482; LMS");
    expect(playerSource).toContain('showSidebar: typeof parsed.showSidebar === "boolean"');
    expect(playerSource).toContain('allowNotes: typeof parsed.allowNotes === "boolean"');
    expect(playerSource).toContain("Package overview");
    expect(playerSource).toContain("teachific-package-notes-${packageId}");
    const fileDetailSource = readFileSync(new URL("../client/src/pages/FileDetailPage.tsx", import.meta.url), "utf8");
    expect(fileDetailSource).toContain("type LmsShellSettings");
    expect(fileDetailSource).toContain("parseLmsShellSettings(packageRecord.lmsShellConfig)");
    expect(fileDetailSource).toContain("lmsShellConfig: JSON.stringify(lmsShellSettings)");
    expect(fileDetailSource).toContain("LMS Shell Settings");
    expect(fileDetailSource).toContain("lmsShellSettings.shellTitle");
    expect(fileDetailSource).toContain("showSessionStatus");
    expect(fileDetailSource).toContain("showSidebar");
    expect(fileDetailSource).toContain("allowNotes");
    expect(fileDetailSource).toContain("Save to Question Bank");
    expect(fileDetailSource).not.toContain('["quiz", "Quiz", "Deliver extracted questions through the quiz experience."]');
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

  it("scopes member management to the active organization and exposes the org super-admin role", () => {
    const membersSource = readFileSync(new URL("../client/src/pages/lms/MembersPage.tsx", import.meta.url), "utf8");
    expect(membersSource).toContain('import { useOrgScope } from "@/hooks/useOrgScope"');
    expect(membersSource).toContain("const { orgId } = useOrgScope();");
    expect(membersSource).not.toContain("orgCtx?.org?.id ?? orgs?.[0]?.id");
    expect(membersSource).toContain('SelectItem value="org_super_admin"');
  });

  it("applies organization SEO metadata and custom CSS through the subdomain theme provider", () => {
    const themeProviderSource = readFileSync(new URL("../client/src/components/SubdomainThemeProvider.tsx", import.meta.url), "utf8");
    const themeRouterSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    expect(themeProviderSource).toContain("setMeta(\"og:title\", seoTitle, true);");
    expect(themeProviderSource).toContain("setMeta(\"og:image\", (theme as any).seoOgImage, true);");
    expect(themeProviderSource).toContain("const title = (theme as any).seoTitle || (theme as any).orgName;");
    expect(themeRouterSource).toContain("seoTitle: (org as any).seoTitle ?? null");
    expect(themeRouterSource).toContain("customCss: (org as any).customCss ?? null");
  });

  it("uses organization theme variables for Course Overview learner accents", () => {
    const courseOverviewSource = readFileSync(new URL("../client/src/pages/lms/CourseOverviewPage.tsx", import.meta.url), "utf8");
    expect(courseOverviewSource).toContain("text-[var(--org-primary)]");
    expect(courseOverviewSource).toContain("border-[var(--org-primary)]");
    expect(courseOverviewSource).not.toContain("text-teal-600");
  });

  it("keeps the organization School Page free of platform branding in its footer", () => {
    const schoolPageSource = readFileSync(new URL("../client/src/pages/lms/SchoolPage.tsx", import.meta.url), "utf8");
    expect(schoolPageSource).toContain("const primaryColor = theme?.studentPrimaryColor || theme?.primaryColor");
    expect(schoolPageSource).not.toContain("Powered by");
    expect(schoolPageSource).not.toContain("teach</span>");
  });

  it("injects the active organization theme into the LMS administration shell", () => {
    const layoutSource = readFileSync(new URL("../client/src/components/DashboardLayout.tsx", import.meta.url), "utf8");
    const landingEditorSource = readFileSync(new URL("../client/src/pages/lms/OrgLandingPageEditor.tsx", import.meta.url), "utf8");
    const studentLayoutSource = readFileSync(new URL("../client/src/components/StudentLayout.tsx", import.meta.url), "utf8");
    expect(layoutSource).toContain('import { OrgThemeProvider } from "@/contexts/OrgThemeContext"');
    expect(layoutSource).toContain("<OrgThemeProvider");
    expect(layoutSource).toContain("theme={orgCtx?.org ? {");
    expect(layoutSource).toContain("primaryColor: orgCtx.org.primaryColor");
    expect(layoutSource).toContain("buttonColor: orgCtx.org.buttonColor");
    expect(layoutSource).toContain("customCss: orgCtx.org.customCss");
    expect(layoutSource).toContain("const { orgId, orgs: activeOrgs } = useOrgScope();");
    expect(layoutSource).toContain("const activeOrg = activeOrgs.find((org: any) => org.id === orgId);");
    expect(layoutSource).not.toContain("orgs?.[0]?.customDomain");
    expect(landingEditorSource).toContain("const activeOrg = orgs.find((org: any) => org.id === orgId);");
    expect(landingEditorSource).toContain("getOrgBaseUrl(activeOrg.slug");
    expect(landingEditorSource).not.toContain("const org = orgs?.[0];");
    expect(studentLayoutSource).toContain("const { orgId, orgs } = useOrgScope();");
    expect(studentLayoutSource).toContain("const activeOrg = orgs.find((org: any) => org.id === orgId);");
    expect(studentLayoutSource).not.toContain("const orgSlug = orgs?.[0]?.slug;");
  });

  it("scopes Course Builder legacy teal utilities to the active organization theme without changing inline content overrides", () => {
    const builderSource = readFileSync(new URL("../client/src/pages/lms/CourseBuilderPage.tsx", import.meta.url), "utf8");
    const coursesSource = readFileSync(new URL("../client/src/pages/lms/CoursesPage.tsx", import.meta.url), "utf8");
    const themeCss = readFileSync(new URL("../client/src/index.css", import.meta.url), "utf8");
    const blockPreviewSource = readFileSync(new URL("../client/src/components/BlockPreview.tsx", import.meta.url), "utf8");
    expect(builderSource).toContain('className="lms-org-theme w-full"');
    expect(themeCss).toContain(".lms-org-theme");
    expect(themeCss).toContain("var(--org-primary)");
    expect(themeCss).not.toMatch(/\.lms-org-theme[\s\S]*!important/);
    expect(blockPreviewSource).toContain("backgroundColor: d.bgColor");
    expect(blockPreviewSource).toContain("color: d.textColor");
    expect(blockPreviewSource).toContain("backgroundColor: d.ctaColor");
    expect(coursesSource).toContain("bg-[var(--org-primary)] text-white");
    expect(coursesSource).toContain("text-[var(--org-primary)]");
    expect(coursesSource).not.toContain("bg-purple-600");
    expect(coursesSource).not.toContain("text-purple-500");
    expect(builderSource).not.toContain("text-purple-400 hover:text-purple-600");
  });

  it("uses active organization primary variables for Lesson Block Editor actions", () => {
    const lessonEditorSource = readFileSync(new URL("../client/src/components/LessonBlockEditor.tsx", import.meta.url), "utf8");
    const formBuilderSource = readFileSync(new URL("../client/src/pages/lms/FormBuilderPage.tsx", import.meta.url), "utf8");
    const formAnalyticsSource = readFileSync(new URL("../client/src/pages/lms/FormAnalyticsPage.tsx", import.meta.url), "utf8");
    const formsSource = readFileSync(new URL("../client/src/pages/lms/FormsPage.tsx", import.meta.url), "utf8");
    const themeCss = readFileSync(new URL("../client/src/index.css", import.meta.url), "utf8");
    expect(lessonEditorSource).toContain("bg-[var(--org-primary)]");
    expect(lessonEditorSource).toContain("lesson-block-editor-org-theme lms-org-theme");
    expect(lessonEditorSource).not.toContain("bg-[#189aa1]");
    expect(lessonEditorSource).not.toContain("hover:bg-[#147f86]");
    expect(lessonEditorSource).not.toMatch(/(?:text|border|bg|ring|hover:text|hover:border|hover:bg|focus:ring|group-hover|accent)-teal-\d+/);
    expect(formBuilderSource).toContain("text-[var(--org-primary)]");
    expect(formBuilderSource).toContain("bg-[color:color-mix(in_srgb,var(--org-primary)_12%,transparent)]");
    expect(formBuilderSource).not.toContain("text-purple-500");
    expect(formBuilderSource).not.toContain("border-purple-200");
    expect(formAnalyticsSource).toContain("bg-[var(--org-primary)]");
    expect(formAnalyticsSource).toContain("text-[var(--org-primary)]");
    expect(formAnalyticsSource).not.toContain("bg-purple-100");
    expect(formsSource).toContain('color: "text-[var(--org-primary)]"');
    expect(formsSource).not.toContain('color: "text-purple-500"');
    expect(themeCss).toContain(".lms-org-theme");
    expect(themeCss).not.toMatch(/\.lms-org-theme[\s\S]*!important/);
  });

  it("derives new Landing Page Builder block defaults from the active organization theme", () => {
    const landingBuilderSource = readFileSync(new URL("../client/src/pages/lms/LandingPageBuilder.tsx", import.meta.url), "utf8");
    expect(landingBuilderSource).toContain("getOrgPrimaryDefault");
    expect(landingBuilderSource).toContain("resolveOrgBlockDefaults");
    expect(landingBuilderSource).toContain("createOrgThemedBlock(catalog)");
    expect(landingBuilderSource).toContain("createOrgThemedBlock(c)");
    expect(landingBuilderSource).toContain("createOrgThemedBlock(b)");
    expect(landingBuilderSource).toContain('className="lms-org-theme fixed inset-0 z-40 flex flex-col bg-gray-50"');
    expect(landingBuilderSource).not.toMatch(/data: \{ \.\.\.(c|b|catalog)\.defaultData \}/);
  });

  it("keeps Landing Page Builder checkout defaults in dollars and review creation blank", () => {
    const landingBuilderSource = readFileSync(new URL("../client/src/pages/lms/LandingPageBuilder.tsx", import.meta.url), "utf8");
    expect(landingBuilderSource).toContain("price: 97");
    expect(landingBuilderSource).toContain("price: 27");
    expect(landingBuilderSource).not.toContain("price: 9700");
    expect(landingBuilderSource).not.toContain("price: 2700");
    expect(landingBuilderSource).toContain('reviews, { name: "", rating: 0, text: "" }');
    expect(landingBuilderSource).not.toContain('reviews, { name: "Student Name", rating: 5, text: "Great course!" }');
  });

  it("does not ship fabricated testimonials or unsupported social-proof claims in platform marketing", () => {
    const landingPageSource = readFileSync(new URL("../client/src/pages/LandingPage.tsx", import.meta.url), "utf8");
    expect(landingPageSource).not.toContain("Dr. Sarah Mitchell");
    expect(landingPageSource).not.toContain("James Okafor");
    expect(landingPageSource).not.toContain("Priya Sharma");
    expect(landingPageSource).not.toContain("Trusted by educators worldwide");
    expect(landingPageSource).not.toContain("10,000+");
    expect(landingPageSource).not.toContain("250,000+");
    expect(landingPageSource).not.toContain("$12,480");
    expect(landingPageSource).not.toContain("Revenue up 34% this month");
    expect(landingPageSource).not.toContain("847 new enrollments");
  });

  it("stores embedded checkout pending purchase amounts in dollars while Stripe receives cents", () => {
    const embeddedCheckoutSource = readFileSync(new URL("./routers/embeddedCheckoutRouter.ts", import.meta.url), "utf8");
    expect(embeddedCheckoutSource).toContain("amount: totalAmountCents,");
    expect(embeddedCheckoutSource).toContain("amountPaid: totalAmount,");
    expect(embeddedCheckoutSource).toContain("amountPaid: paymentIntent.amount / 100");
    expect(embeddedCheckoutSource).not.toContain("amountPaid: totalAmountCents,");
  });

  it("displays organization-scoped digital download purchase amounts as stored dollars", () => {
    const downloadsSource = readFileSync(new URL("../client/src/pages/lms/DigitalDownloadsAdmin.tsx", import.meta.url), "utf8");
    expect(downloadsSource).toContain("$${Number(p.amountPaid).toFixed(2)}");
    expect(downloadsSource).toContain("${totalRevenue.toFixed(2)}");
    expect(downloadsSource).toContain("$${avgOrder.toFixed(2)}");
    expect(downloadsSource).not.toContain("Number(p.amountPaid) / 100");
    expect(downloadsSource).not.toContain("totalRevenue / 100");
    expect(downloadsSource).not.toContain("avgOrder / 100");
  });

  it("displays Download Analytics order amounts as stored dollars", () => {
    const downloadAnalyticsSource = readFileSync(new URL("../client/src/pages/admin/DownloadAnalytics.tsx", import.meta.url), "utf8");
    expect(downloadAnalyticsSource).toContain("${Number(data.amount ?? 0).toFixed(2)}");
    expect(downloadAnalyticsSource).toContain("${Number(o.amount ?? 0).toFixed(2)}");
    expect(downloadAnalyticsSource).not.toContain("data.amount ?? 0) / 100");
    expect(downloadAnalyticsSource).not.toContain("o.amount ?? 0) / 100");
  });

  it("displays platform digital download purchaser and average-order amounts as stored dollars", () => {
    const platformDownloadsSource = readFileSync(new URL("../client/src/pages/admin/DigitalDownloadsAdmin.tsx", import.meta.url), "utf8");
    expect(platformDownloadsSource).toContain("$${Number(p.amountPaid).toFixed(2)}");
    expect(platformDownloadsSource).toContain("$${avgOrder.toFixed(2)}");
    expect(platformDownloadsSource).not.toContain("Number(p.amountPaid) / 100");
    expect(platformDownloadsSource).not.toContain("avgOrder / 100");
  });

  it("displays and edits bundle pricing options as stored dollars", () => {
    const bundlesSource = readFileSync(new URL("../client/src/pages/admin/BundlesAdmin.tsx", import.meta.url), "utf8");
    expect(bundlesSource).toContain("Number(initial?.price ?? 0).toFixed(2)");
    expect(bundlesSource).toContain("Number(o.downPayment ?? 0).toFixed(2)");
    expect(bundlesSource).toContain("Number(o.installmentAmount ?? 0).toFixed(2)");
    expect(bundlesSource).toContain("Number(o.price).toFixed(2)");
    expect(bundlesSource).not.toContain("initial?.price ?? 0) / 100");
    expect(bundlesSource).not.toContain("o.downPayment ?? 0) / 100");
    expect(bundlesSource).not.toContain("o.installmentAmount ?? 0) / 100");
    expect(bundlesSource).not.toContain("o.price / 100");
    expect(bundlesSource).toContain("text-[var(--org-primary)]");
    expect(bundlesSource).not.toContain("text-purple-500");
  });

  it("displays, edits, and saves membership plan prices as stored dollars", () => {
    const membershipsSource = readFileSync(new URL("../client/src/pages/admin/MembershipsAdmin.tsx", import.meta.url), "utf8");
    expect(membershipsSource).toContain(".format(price);");
    expect(membershipsSource).toContain("price: String(plan.price)");
    expect(membershipsSource).toContain("price: parseFloat(form.price || \"0\")");
    expect(membershipsSource).toContain("compareAtPrice: form.compareAtPrice ? parseFloat(form.compareAtPrice) : null");
    expect(membershipsSource).not.toContain("plan.price / 100");
    expect(membershipsSource).not.toContain("parseFloat(form.price || \"0\") * 100");
  });

  it("displays, edits, and saves workshop and instance prices as stored dollars", () => {
    const workshopsSource = readFileSync(new URL("../client/src/pages/admin/WorkshopsAdmin.tsx", import.meta.url), "utf8");
    expect(workshopsSource).toContain("return `$${Number(amount).toFixed(2)}`");
    expect(workshopsSource).toContain("setPrice(w.price ?? 0)");
    expect(workshopsSource).toContain("status, price,");
    expect(workshopsSource).toContain("setInstPrice(inst.price != null ? inst.price : \"\")");
    expect(workshopsSource).toContain("price: instPrice !== \"\" ? Number(instPrice) : null");
    expect(workshopsSource).not.toContain("cents / 100");
    expect(workshopsSource).not.toContain("Math.round(price * 100)");
    expect(workshopsSource).not.toContain("Math.round(Number(instPrice) * 100)");
  });

  it("keeps product analytics transactions and manual invoices dollar-denominated", () => {
    const routerSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
    const analyticsSource = readFileSync(new URL("../client/src/pages/admin/ProductAnalytics.tsx", import.meta.url), "utf8");
    const userDetailSource = readFileSync(new URL("../client/src/pages/admin/AdminUserDetailPage.tsx", import.meta.url), "utf8");
    expect(routerSource).toContain("amountPaid: Number(o.amount)");
    expect(routerSource).toContain("amountPaid: Number(i.amountPaid)");
    expect(routerSource).toContain("amountPaid: String(input.amountPaid)");
    expect(routerSource).not.toContain("Math.round(Number(o.amount) * 100)");
    expect(analyticsSource).toContain(".format(Number(amount))");
    expect(analyticsSource).not.toContain(".format(cents / 100)");
    expect(userDetailSource).toContain("const totalLineItemsDollars");
    expect(userDetailSource).toContain("amountPaid: totalLineItemsDollars");
    expect(userDetailSource).not.toContain("totalLineItemsCents");
  });

  it("displays active-organization Course Builder order amounts as stored dollars", () => {
    const builderSource = readFileSync(new URL("../client/src/pages/lms/CourseBuilderPage.tsx", import.meta.url), "utf8");
    expect(builderSource).toContain("${Number(o.amount).toFixed(2)}");
    expect(builderSource).not.toContain("Number(o.amount) / 100");
  });

  it("displays platform LMS order amounts as stored dollars", () => {
    const platformLmsSource = readFileSync(new URL("../client/src/pages/admin/LMSAdmin.tsx", import.meta.url), "utf8");
    expect(platformLmsSource).toContain("${Number(o.amount).toFixed(2)}");
    expect(platformLmsSource).not.toContain("Number(o.amount) / 100");
  });

  it("scopes funnel product catalogs to the active organization and preserves dollar prices", () => {
    const routerSource = readFileSync(new URL("./routers/funnelRouter.ts", import.meta.url), "utf8");
    const relatedProductsSource = readFileSync(new URL("../client/src/components/RelatedProductsBlock.tsx", import.meta.url), "utf8");
    const editorSource = readFileSync(new URL("../client/src/components/RichTextEditor.tsx", import.meta.url), "utf8");
    const adminBuilderSource = readFileSync(new URL("../client/src/pages/admin/LandingPageBuilder.tsx", import.meta.url), "utf8");
    const lmsBuilderSource = readFileSync(new URL("../client/src/pages/lms/LandingPageBuilder.tsx", import.meta.url), "utf8");
    expect(routerSource).toContain("getOrgBySlug(input.orgSlug)");
    expect(routerSource).toContain("eq(lmsCourses.orgId, scopeOrgId)");
    expect(routerSource).toContain("eq(membershipPlans.orgId, scopeOrgId)");
    expect(routerSource).toContain("eq(communityHubs.orgId, scopeOrgId)");
    expect(routerSource).toContain('type: "community"');
    expect(routerSource).toContain('type: "membership_plan"');
    expect(routerSource).not.toContain("APP_REGISTRY");
    expect(routerSource).not.toContain("UltrasoundAssist™");
    expect(routerSource).not.toContain("EchoAssist™");
    expect(routerSource).toContain("price: Number(w.price ?? 0)");
    expect(relatedProductsSource).toContain("{ items: manualRefs, orgSlug }");
    expect(editorSource).toContain('{ orgSlug: getSubdomain() ?? undefined }');
    expect(adminBuilderSource).toContain('import { getSubdomain } from "@/hooks/useSubdomain"');
    expect(lmsBuilderSource).toContain('import { getSubdomain } from "@/hooks/useSubdomain"');
  });

  it("routes free funnel checkout account and purchase emails through the owning organization sender", () => {
    const routerSource = readFileSync(new URL("./routers/funnelRouter.ts", import.meta.url), "utf8");
    expect(routerSource).toContain("const { buildPasswordResetEmail, sendEmailViaOrg }");
    expect(routerSource).toContain("}, funnel.orgId ?? null);");
    expect(routerSource).toContain("const { sendEmailViaOrg, buildFunnelPurchaseConfirmationEmail }");
  });

  it("routes membership welcome emails through the owning organization sender", () => {
    const membershipSource = readFileSync(new URL("./lib/membershipFulfillment.ts", import.meta.url), "utf8");
    expect(membershipSource).toContain('import { buildPasswordResetEmail, sendEmailViaOrg }');
    expect(membershipSource).toContain("orgId?: number | null;");
    expect(membershipSource).toContain("}, opts.orgId ?? undefined);");
    expect(membershipSource).toContain("orgId: membershipOrg?.id ?? null,");
  });

  it("limits membership course, download, bundle, and all-access grants to the plan organization", () => {
    const membershipSource = readFileSync(new URL("./lib/membershipFulfillment.ts", import.meta.url), "utf8");
    expect(membershipSource).toContain("eq(lmsCourses.orgId, ctx.orgId)");
    expect(membershipSource).toContain("eq(digitalProducts.orgId, ctx.orgId)");
    expect(membershipSource).toContain("eq(bundles.orgId, ctx.orgId)");
    expect(membershipSource).toContain("orgId: plan.orgId,");
  });

  it("persists a trusted organization on embedded checkout purchases and uses it for free-order emails", () => {
    const routerSource = readFileSync(new URL("./routers/embeddedCheckoutRouter.ts", import.meta.url), "utf8");
    expect(routerSource).toContain("async function resolveCheckoutOrgId");
    expect(routerSource).toContain("funnelPages.orgId");
    expect(routerSource).toContain("Unable to resolve the checkout organization");
    expect(routerSource).toContain("orgId,");
    expect(routerSource).toContain("await sendEmailViaOrg({ to: { name: customerName || firstName, email: input.email }, subject, htmlBody, previewText }, orgId);");
  });

  it("scopes learner purchase history to the active organization subdomain", () => {
    const pageSource = readFileSync(new URL("../client/src/pages/lms/MyCoursesPage.tsx", import.meta.url), "utf8");
    expect(pageSource).toContain('import { getSubdomain } from "@/hooks/useSubdomain"');
    expect(pageSource).toContain("const organizationSlug = getSubdomain();");
    expect(pageSource).toContain("orgId: organization?.id ?? undefined");
  });

  it("uses the Course Builder course organization for CME visibility", () => {
    const builderSource = readFileSync(new URL("../client/src/pages/lms/CourseBuilderPage.tsx", import.meta.url), "utf8");
    expect(builderSource).toContain('import { useOrgScope } from "@/hooks/useOrgScope"');
    expect(builderSource).toContain("const { orgs: scopedOrgs } = useOrgScope();");
    expect(builderSource).toContain("org.id === (course as any)?.orgId");
    expect(builderSource).not.toContain("myOrgs?.[0]?.cmeEnabled");
  });

  it("uses the active organization for BrandingPage theme settings", () => {
    const brandingSource = readFileSync(new URL("../client/src/pages/lms/BrandingPage.tsx", import.meta.url), "utf8");
    expect(brandingSource).toContain('import { useOrgScope } from "@/hooks/useOrgScope"');
    expect(brandingSource).toContain("const { orgId } = useOrgScope();");
    expect(brandingSource).not.toContain("orgs?.[0]?.id");
  });

  it("persists the source lesson on standalone quiz attempts completed in Course Player", () => {
    const playerSource = readFileSync(new URL("../client/src/pages/lms/CoursePlayer.tsx", import.meta.url), "utf8");
    const quizSource = readFileSync(new URL("../client/src/components/EmbeddedQuizPlayer.tsx", import.meta.url), "utf8");
    expect(playerSource).toContain("sourceLessonId={lessonData.id}");
    expect(quizSource).toContain("sourceLessonId?: number");
    expect(quizSource).toContain('sourceType: sourceLessonId ? "lesson" : "standalone"');
    expect(quizSource).toContain("sourceLessonId }");
  });

  it("resolves product-level checkout terms before organization defaults across supported paid content", () => {
    const checkoutSource = readFileSync(new URL("./routers/lmsCheckoutRouter.ts", import.meta.url), "utf8");
    expect(checkoutSource).toContain("from(digitalProducts)");
    expect(checkoutSource).toContain("from(webinars)");
    expect(checkoutSource).toContain("from(workshops)");
    expect(checkoutSource).toContain("contentTermsRow?.purchaseTermsAgreement || orgPaySettings?.purchaseTermsAgreement");
    expect(checkoutSource).toContain("purchaseTermsAgreement: resolvedTermsAgreement");
  });

  it("scopes instructor revenue-share administration to the active organization", () => {
    const routerSource = readFileSync(new URL("./routers/lmsEnrollmentAdminRouter.ts", import.meta.url), "utf8");
    expect(routerSource).toContain("requireOrgAdmin(ctx.user.id, ctx.user.role)");
    expect(routerSource).toContain("eq(lmsCourses.orgId, orgId)");
    expect(routerSource).toContain("Course does not belong to the active organization");
    expect(routerSource).toContain("instructor.courseShares.length > 0");
  });

  it("scopes payout request administration and self-service history to the active organization", () => {
    const routerSource = readFileSync(new URL("./routers/lmsEnrollmentAdminRouter.ts", import.meta.url), "utf8");
    const migrationSource = readFileSync(new URL("../drizzle/0001_nosy_fixer.sql", import.meta.url), "utf8");
    expect(routerSource).toContain("eq(payoutRequests.orgId, orgId)");
    expect(routerSource).toContain("Select an organization before requesting a payout.");
    expect(routerSource).toContain("orgId,\n        requestorType: input.requestorType");
    expect(routerSource).toContain("eq(payoutRequests.id, input.id), eq(payoutRequests.orgId, orgId)");
    expect(routerSource).toContain("affiliateCourseAccess");
    expect(routerSource).toContain("affiliateOrgAccess");
    expect(routerSource).toContain("isNull(affiliateOrgAccess.revokedAt)");
    expect(routerSource).toContain("No affiliate access is available for the active organization.");
    expect(routerSource).toContain("eq(lmsCourses.orgId, orgId)");
    expect(routerSource).toContain("eq(lmsAffiliateConversions.orgId, orgId)");
    expect(routerSource).toContain("Requested payout exceeds approved commission available for the active organization.");
    expect(migrationSource).toContain("HAVING COUNT(DISTINCT course_record.orgId) = 1");
    expect(migrationSource).toContain("remain NULL and are intentionally excluded");
    const affiliateMigrationSource = readFileSync(new URL("../drizzle/0002_shiny_doctor_strange.sql", import.meta.url), "utf8");
    expect(affiliateMigrationSource).toContain("HAVING COUNT(DISTINCT course_record.orgId) = 1");
    expect(affiliateMigrationSource).toContain("remain unassigned and blocked from payout requests");
  });

  it("requires authenticated organization ownership for content package uploads", () => {
    const uploadSource = readFileSync(new URL("./scormUploadRoutes.ts", import.meta.url), "utf8");
    const uploadPageSource = readFileSync(new URL("../client/src/pages/UploadPage.tsx", import.meta.url), "utf8");
    const chunkedUploadSource = readFileSync(new URL("./chunkedUploadRoutes.ts", import.meta.url), "utf8");
    expect(uploadSource).toContain("requireOrgAdmin(authUser.id, authUser.role, orgId)");
    expect(uploadSource).toContain("Upload user does not match the authenticated user");
    expect(uploadSource).toContain("You are not authorized to upload content for this organization");
    expect(uploadPageSource).toContain('import { useOrgScope } from "@/hooks/useOrgScope"');
    expect(uploadPageSource).toContain("const { orgId: activeOrgId } = useOrgScope();");
    expect(uploadPageSource).toContain("selectedOrgId || activeOrgId");
    expect(chunkedUploadSource).toContain("authUserId: user.id");
    expect(chunkedUploadSource).toContain("Upload session does not belong to the authenticated user");
    expect(chunkedUploadSource).toContain("requireOrgAdmin(user.id, user.role, session.orgId)");
    expect(chunkedUploadSource).toContain("/version/:packageId/chunk/:uploadId");
    expect(chunkedUploadSource).toContain("user.id !== session.authUserId");
    expect(chunkedUploadSource).toContain("Version attribution does not match the authenticated user");
    expect(chunkedUploadSource).toContain("const uploadedByNum = user.id");
    const packageRouterSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
    expect(packageRouterSource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, input.orgId);");
    expect(packageRouterSource).toContain("const existingPackage = await getPackageById(input.id);");
    expect(packageRouterSource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, existingPackage.orgId);");
    expect(packageRouterSource).toContain("delete: protectedProcedure");
    expect(packageRouterSource).toContain("return deletePackage(input.id);");
    const filesPageSource = readFileSync(new URL("../client/src/pages/FilesPage.tsx", import.meta.url), "utf8");
    expect(filesPageSource).toContain("const { orgId } = useOrgScope();");
    expect(filesPageSource).toContain("orgId ? { orgId } : undefined");
    const dashboardSource = readFileSync(new URL("../client/src/pages/Dashboard.tsx", import.meta.url), "utf8");
    expect(dashboardSource).toContain("const { activeOrg } = useOrgScope();");
    expect(dashboardSource).toContain("activeOrg?.id ? { orgId: activeOrg.id } : undefined");
    const analyticsPageSource = readFileSync(new URL("../client/src/pages/AnalyticsPage.tsx", import.meta.url), "utf8");
    expect(analyticsPageSource).toContain("const { activeOrg } = useOrgScope();");
    expect(analyticsPageSource).toContain("activeOrg?.id ? { orgId: activeOrg.id } : undefined");
    expect(packageRouterSource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, input.orgId);");
    expect(packageRouterSource).toContain("return getPackagesByOrg(activeOrgId);");
    expect(packageRouterSource).toContain("const requestedOrgId = input?.orgId;");
    expect(packageRouterSource).toContain("requestedOrgId ?? await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role)");
    expect(packageRouterSource).toContain("requestedOrgId ?? await getOrgIdForUser(ctx.user.id)");
    expect(packageRouterSource).toContain("This content package does not belong to the active organization.");
    expect(packageRouterSource).toContain("The selected package belongs to another organisation.");
    expect(packageRouterSource).toContain("getManaged: protectedProcedure");
    expect(packageRouterSource).toContain("This content package does not belong to the active organization.");
    expect(packageRouterSource).toContain("input.orgId ?? await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role)");
    expect(packageRouterSource).toContain("Content can only be created in the active organization.");
    expect(packageRouterSource).toContain("activeOrgId !== existingPackage.orgId");
    expect(packageRouterSource).toContain("getManaged: protectedProcedure");
    expect(packageRouterSource).toContain("await requireActivePackageAdmin(ctx.user.id, ctx.user.role, input.packageId);");
    expect(filesPageSource).toContain("trpc.packages.list.useQuery");
    const lmsHelpersSource = readFileSync(new URL("../server/routers/lmsHelpers.ts", import.meta.url), "utf8");
    expect(lmsHelpersSource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, course.orgId);");
    expect(lmsHelpersSource).toContain("getOrgIdForUserWithFallback");
    expect(lmsHelpersSource).toContain("This course does not belong to the active organization");
    const courseOwnershipHelper = lmsHelpersSource.slice(
      lmsHelpersSource.indexOf("export async function assertCourseOwnership"),
      lmsHelpersSource.indexOf("export async function assertSectionOwnership"),
    );
    expect(courseOwnershipHelper).not.toContain("const isPlatformAdmin");
    const courseBuilderRouterSource = readFileSync(new URL("../server/routers/lmsCourseBuilderRouter.ts", import.meta.url), "utf8");
    expect(courseBuilderRouterSource).toContain("getAfterPurchase: protectedProcedure");
    expect(courseBuilderRouterSource).toContain("await assertCourseOwnership(ctx, input.courseId);");
    expect(courseBuilderRouterSource).toContain("await assertCourseOwnership(ctx, courseId);");
    const courseBuilderSource = readFileSync(new URL("../client/src/pages/lms/CourseBuilderPage.tsx", import.meta.url), "utf8");
    expect(courseBuilderSource).toContain("/lms/courses/${course.id}/after_purchase");
    expect(courseBuilderSource).toContain("After-purchase automation");
    expect(courseBuilderSource).toContain("Lifecycle automation");
    expect(courseBuilderSource).toContain("trpc.lmsAdmin.updateAfterPurchase.useMutation");
    expect(courseBuilderSource).toContain("welcomeEmailEnabled, completionEmailEnabled, upsellEnabled");
    expect(courseBuilderSource).toContain("trpc.lmsAdmin.getCourseWaitlistSettings.useQuery");
    expect(courseBuilderSource).toContain("trpc.lmsAdmin.updateCourseWaitlistSettings.useMutation");
    expect(courseBuilderSource).toContain("Course waitlist configuration");
    expect(courseBuilderRouterSource).toContain("getCourseWaitlistSettings: protectedProcedure");
    expect(courseBuilderRouterSource).toContain("updateCourseWaitlistSettings: protectedProcedure");
    const membersPageSource = readFileSync(new URL("../client/src/pages/lms/MembersPage.tsx", import.meta.url), "utf8");
    expect(membersPageSource).toContain('m.role === "org_super_admin" ? "Org Super Admin"');
    expect(membersPageSource).toContain("Member access");
    expect(membersPageSource).toContain('SelectItem value="instructor"');
    expect(membersPageSource).toContain("memberSubRole");
    expect(membersPageSource).toContain("bulkImport.mutate({ orgId, users: bulkPreview })");
    expect(membersPageSource).toContain("bulkResult.importedMembers");
    expect(membersPageSource).toContain('member.memberSubRole === "instructor" ? "Instructor"');
    const membersRouterSource = readFileSync(new URL("../server/routers.ts", import.meta.url), "utf8");
    expect(membersRouterSource).toContain("memberSubRole: z.enum");
    expect(membersRouterSource).toContain("input.memberSubRole");
    expect(membersRouterSource).toContain("u.memberSubRole");
    expect(membersRouterSource).toContain("updateMemberRole: orgAdminProcedure");
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
    expect(stripeWebhookSource).toContain("if (bundleOrg?.slug)");
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
    expect(routerSource).toContain('model: sourceFiles.length ? "gemini-3-flash-preview" : "gpt-5-mini"');
    expect(routerSource).toContain("buildAiSourceMessage(");
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

  it("requires active-organization authorization for product analytics reads, invoices, and product access grants", () => {
    const routerSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
    expect(routerSource).toContain("async function requireActiveAnalyticsAdmin");
    expect(routerSource).toContain("Select an active organization before managing product analytics.");
    expect(routerSource).toContain("await requireOrgAdmin(userId, userRole, activeOrgId);");
    expect(routerSource).toContain("const orgId = await requireActiveAnalyticsAdmin(ctx.user.id, ctx.user.role);");
    expect(routerSource).toContain("Product does not belong to the active organization.");
    expect(routerSource).toContain("Course does not belong to the active organization.");
    expect(routerSource).toContain("Download does not belong to the active organization.");
    expect(routerSource).toContain("Bundle does not belong to the active organization.");
    expect(routerSource).toContain("Bundle includes a download outside the active organization.");
    expect(routerSource).toContain("eq(lmsEnrollments.orgId, orgId)");
    expect(routerSource).toContain("eq(orgInvoices.orgId, orgId)");
    expect(routerSource).toContain("eq(digitalProducts.orgId, orgId)");
    expect(routerSource).toContain("eq(digitalBundles.orgId, orgId)");
  });

  it("scopes Webinar administration controls to the active organization theme", () => {
    const webinarSource = readFileSync(new URL("../client/src/pages/admin/WebinarsAdmin.tsx", import.meta.url), "utf8");
    const lmsAnalyticsSource = readFileSync(new URL("../client/src/pages/lms/LmsAnalyticsPage.tsx", import.meta.url), "utf8");
    const webinarReportsSource = readFileSync(new URL("../client/src/pages/admin/WebinarReportsPage.tsx", import.meta.url), "utf8");
    const downloadsReportsSource = readFileSync(new URL("../client/src/pages/admin/DigitalDownloadsReportsPage.tsx", import.meta.url), "utf8");
    const emailMarketingSource = readFileSync(new URL("../client/src/pages/lms/EmailMarketingPage.tsx", import.meta.url), "utf8");
    const pageBuilderSource = readFileSync(new URL("../client/src/pages/lms/PageBuilderPage.tsx", import.meta.url), "utf8");
    const coursePlayerSource = readFileSync(new URL("../client/src/pages/lms/CoursePlayerPage.tsx", import.meta.url), "utf8");
    const schoolPageSource = readFileSync(new URL("../client/src/pages/lms/SchoolPage.tsx", import.meta.url), "utf8");
    const membersPageSource = readFileSync(new URL("../client/src/pages/lms/MembersPage.tsx", import.meta.url), "utf8");
    const kajabiImportSource = readFileSync(new URL("../client/src/pages/integrations/KajabiImportPage.tsx", import.meta.url), "utf8");
    const teachableImportSource = readFileSync(new URL("../client/src/pages/integrations/TeachableImportPage.tsx", import.meta.url), "utf8");
    const thinkificImportSource = readFileSync(new URL("../client/src/pages/integrations/ThinkificImportPage.tsx", import.meta.url), "utf8");
    const themeCss = readFileSync(new URL("../client/src/index.css", import.meta.url), "utf8");
    expect(webinarSource).toContain('className="webinar-admin-org-theme lms-org-theme p-4 md:p-6 max-w-6xl mx-auto"');
    expect(webinarSource).toContain("bg-[var(--org-button)] hover:opacity-90 text-[var(--org-button-text)]");
    expect(webinarSource).not.toContain("bg-teal-600 hover:bg-teal-700 text-white");
    expect(webinarSource).not.toMatch(/(?:text|border|bg|ring|hover:text|hover:border|hover:bg|focus:ring)-teal-\d+/);
    expect(webinarSource).toContain("text-[var(--org-primary)]");
    expect(webinarSource).toContain("bg-[color-mix(in_srgb,var(--org-primary)_12%,transparent)]");
    expect(webinarSource).not.toContain("border-purple-600 text-purple-700");
    expect(webinarSource).not.toContain("text-purple-500");
    expect(themeCss).toContain(".hover\\:bg-teal-700:hover");
    expect(themeCss).toContain("color-mix(in srgb, var(--org-primary) 82%, #000 18%)");
    expect(themeCss).toContain("background-color: var(--org-primary);");
    expect(webinarReportsSource).toContain("const { orgId } = useOrgScope();");
    expect(webinarReportsSource).not.toContain("const orgId = orgs?.[0]?.id;");
    expect(webinarReportsSource).toContain('color: "bg-[var(--org-primary)]"');
    expect(webinarReportsSource).not.toContain("bg-purple-500");
    expect(lmsAnalyticsSource).toContain('color: "text-[var(--org-primary)]"');
    expect(lmsAnalyticsSource).toContain('bg: "bg-[color:color-mix(in_srgb,var(--org-primary)_12%,transparent)]"');
    expect(lmsAnalyticsSource).not.toContain("text-indigo-600");
    expect(downloadsReportsSource).toContain("const { orgId } = useOrgScope();");
    expect(downloadsReportsSource).not.toContain("const orgId = orgs?.[0]?.id;");
    expect(downloadsReportsSource).toContain("text-[var(--org-primary)]");
    expect(downloadsReportsSource).not.toContain("bg-purple-500");
    expect(emailMarketingSource).toContain("const { orgId } = useOrgScope();");
    expect(emailMarketingSource).not.toContain("const orgId = orgs?.[0]?.id ?? 0;");
    expect(pageBuilderSource).toContain("const { orgId } = useOrgScope();");
    expect(pageBuilderSource).not.toContain("const orgId = orgs?.[0]?.id;");
    expect(coursePlayerSource).toContain("const courseOrgId = course?.orgId;");
    expect(coursePlayerSource).toContain("{ orgId: courseOrgId! }");
    expect(coursePlayerSource).not.toContain("const orgId = orgs?.[0]?.id;");
    expect(schoolPageSource).toContain("const { orgId: activeOrgId, orgs: activeOrgs } = useOrgScope();");
    expect(schoolPageSource).toContain(": (activeOrgId ?? undefined);");
    expect(schoolPageSource).not.toContain("orgs?.[0]?.id");
    expect(membersPageSource).toContain("const { orgId } = useOrgScope();");
    expect(membersPageSource).not.toContain("orgCtx?.org?.id ?? orgs?.[0]?.id");
    for (const importSource of [kajabiImportSource, teachableImportSource, thinkificImportSource]) {
      expect(importSource).toContain("const { orgId: activeOrgId } = useOrgScope();");
      expect(importSource).not.toContain("const orgId = orgs?.[0]?.id ?? 0;");
    }
  });

  it("routes hosted LMS checkout enrollment confirmations through the purchased course organization", () => {
    const fulfillmentSource = readFileSync(new URL("./lib/lmsCheckoutFulfillment.ts", import.meta.url), "utf8");
    const emailSource = readFileSync(new URL("./lib/enrollmentEmail.ts", import.meta.url), "utf8");
    expect(fulfillmentSource).toContain("orgId: lmsCourses.orgId");
    expect(fulfillmentSource).toContain("orgSlug: organizations.slug");
    expect(fulfillmentSource).toContain("orgCustomDomain: organizations.customDomain");
    expect(fulfillmentSource).toContain("orgDomainVerificationStatus: organizations.domainVerificationStatus");
    expect(fulfillmentSource).toContain("orgId: course.orgId");
    expect(fulfillmentSource).toContain("getOrgBaseUrl(course.orgSlug, course.orgCustomDomain, course.orgDomainVerificationStatus)");
    expect(fulfillmentSource).toContain("orgSlug: course.orgSlug");
    expect(fulfillmentSource).toContain("orgDomainVerificationStatus: course.orgDomainVerificationStatus");
    expect(fulfillmentSource).toContain("Purchased course no longer exists");
    expect(emailSource).toContain("return await sendEmailViaOrg({ to: opts.to, subject: opts.subject, htmlBody: opts.htmlBody }, opts.orgId);");
    expect(emailSource).toContain("getOrgBaseUrl(opts.orgSlug, opts.orgCustomDomain, opts.orgDomainVerificationStatus)");
  });

  it("scopes workshop waitlist administration to the active organization and keeps waitlist pricing in dollars", () => {
    const routerSource = readFileSync(new URL("./routers/workshopRouter.ts", import.meta.url), "utf8");
    const adminSource = readFileSync(new URL("../client/src/pages/admin/WorkshopsAdmin.tsx", import.meta.url), "utf8");
    const waitlistGrantSource = routerSource.slice(
      routerSource.indexOf("grantWaitlistAccess: protectedProcedure"),
      routerSource.indexOf("// ── Instance Landing Page Builder")
    );
    const waitlistSettingsSource = routerSource.slice(
      routerSource.indexOf("getWaitlistSettings: protectedProcedure"),
      routerSource.indexOf("grantWaitlistAccess: protectedProcedure")
    );
    expect(routerSource).toContain("async function requireActiveWorkshopAdmin");
    expect(routerSource).toContain("Workshop does not belong to the active organization.");
    expect(routerSource).toContain("await requireOrgAdmin(userId, userRole, workshop.orgId);");
    expect(routerSource).toContain("Waitlist entry does not belong to this workshop.");
    expect(waitlistSettingsSource).toContain("requireActiveWorkshopAdmin(ctx.user.id, ctx.user.role, input.workshopId)");
    expect(waitlistSettingsSource).toContain("getWaitlistEntries: protectedProcedure");
    expect(waitlistSettingsSource).toContain("exportWaitlistCsv: protectedProcedure");
    expect(waitlistGrantSource).toContain("priceOverride: z.number().min(0).optional()");
    expect(waitlistGrantSource).not.toContain("priceOverrideCents");
    expect(waitlistGrantSource).not.toContain("priceInCents");
    expect(waitlistGrantSource).toContain("const priceInDollars = input.priceOverride");
    expect(waitlistGrantSource).toContain("unit_amount: Math.round(priceInDollars * 100)");
    expect(waitlistGrantSource).toContain("sendEmailViaOrg({");
    expect(waitlistGrantSource).toContain("}, workshop.orgId);");
    expect(waitlistGrantSource).toContain("getOrgBaseUrl(organization.slug, organization.customDomain, organization.domainVerificationStatus)");
    expect(waitlistGrantSource).not.toContain("input.origin}/workshops/${workshop.slug}");
    expect(adminSource).toContain("trpc.workshopAdmin.grantWaitlistAccess.useMutation");
    expect(adminSource).toContain("<Dialog open={!!grantEntry}");
    expect(adminSource).toContain("Price Override (USD, optional)");
    expect(adminSource).toContain("priceOverride: grantType === \"paid\" ? parsedOverride : undefined");
    expect(adminSource).not.toContain("priceOverrideCents");
  });

  it("converts stored workshop dollars to Stripe cents only at checkout and returns to the organization domain", () => {
    const routerSource = readFileSync(new URL("./routers/workshopRouter.ts", import.meta.url), "utf8");
    const checkoutSource = routerSource.slice(
      routerSource.indexOf("// Determine price (instance override or workshop default)"),
      routerSource.indexOf("/** Complete enrollment after successful Stripe payment */")
    );
    expect(checkoutSource).toContain("const priceInDollars =");
    expect(checkoutSource).toContain("const stripeAmountCents = Math.round(priceInDollars * 100);");
    expect(checkoutSource).toContain("unit_amount: stripeAmountCents");
    expect(checkoutSource).toContain("displayPrice: priceInDollars");
    expect(checkoutSource).not.toContain("priceInCents");
    expect(checkoutSource).not.toContain("displayPrice: Math.round");
    expect(routerSource).toContain("getOrgBaseUrl(organization.slug, organization.customDomain, organization.domainVerificationStatus)");
    expect(checkoutSource).toContain("return_url: `${orgBaseUrl}/checkout/complete?session_id={CHECKOUT_SESSION_ID}&type=workshop`");
    expect(checkoutSource).not.toContain("return_url: `${input.origin}");
  });

  it("requires active-organization course ownership for checkout configuration administration", () => {
    const routerSource = readFileSync(new URL("./routers/lmsCourseBuilderRouter.ts", import.meta.url), "utf8");
    const checkoutConfigSource = routerSource.slice(
      routerSource.indexOf("getCheckoutPageConfig: protectedProcedure"),
      routerSource.indexOf("getPublicCheckoutPageConfig: publicProcedure")
    );
    expect(checkoutConfigSource).toContain("getCheckoutPageConfig: protectedProcedure");
    expect(checkoutConfigSource).toContain("saveCheckoutPageConfig: protectedProcedure");
    expect((checkoutConfigSource.match(/await assertCourseOwnership\(ctx, input\.courseId\);/g) ?? []).length).toBe(2);
  });

  it("scopes membership administration list and editor controls to the active organization theme", () => {
    const membershipSource = readFileSync(new URL("../client/src/pages/admin/MembershipsAdmin.tsx", import.meta.url), "utf8");
    const themeCss = readFileSync(new URL("../client/src/index.css", import.meta.url), "utf8");
    expect((membershipSource.match(/membership-admin-org-theme lms-org-theme/g) ?? []).length).toBeGreaterThanOrEqual(2);
    expect(membershipSource).toContain("text-[var(--org-primary)]");
    expect(themeCss).toContain(".lms-org-theme :is(");
    expect(themeCss).toContain("background-color: var(--org-primary);");
  });

  it("requires organization-admin ownership throughout mounted legacy LMS membership administration", () => {
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const membershipSource = routerSource.slice(
      routerSource.indexOf("memberships: router({"),
      routerSource.indexOf("// ── Bundles")
    );
    const dbSource = readFileSync(new URL("./lmsDb.ts", import.meta.url), "utf8");
    expect(routerSource).toContain("async function requireLegacyMembershipAccess");
    expect(membershipSource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);");
    expect((membershipSource.match(/await requireLegacyMembershipAccess\(ctx,/g) ?? []).length).toBeGreaterThanOrEqual(11);
    expect(membershipSource).toContain("getMembershipIdByMemberRecordId(input.id)");
    expect(membershipSource).toContain("getMembershipIdByContentRecordId(input.id)");
    expect(membershipSource).toContain("getMembershipIdByRuleRecordId(input.id)");
    expect(dbSource).toContain("export async function getMembershipIdByMemberRecordId");
    expect(dbSource).toContain("export async function getMembershipIdByContentRecordId");
    expect(dbSource).toContain("export async function getMembershipIdByRuleRecordId");
  });

  it("requires organization-admin ownership throughout mounted legacy LMS bundle administration", () => {
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const bundleSource = routerSource.slice(
      routerSource.indexOf("bundles: router({"),
      routerSource.indexOf("// ── Flashcards")
    );
    expect(routerSource).toContain("async function requireLegacyBundleAccess");
    expect(bundleSource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);");
    expect((bundleSource.match(/await requireLegacyBundleAccess\(ctx, input\.id\);/g) ?? []).length).toBe(3);
  });

  it("requires organization-admin ownership throughout mounted legacy LMS flashcard administration", () => {
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const flashcardSource = routerSource.slice(
      routerSource.indexOf("flashcards: router({"),
      routerSource.indexOf("// ── Media")
    );
    expect(routerSource).toContain("async function requireLegacyFlashcardDeckAccess");
    expect(flashcardSource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);");
    expect(flashcardSource).toContain("orgId: z.number().optional(), topic: z.string()");
    expect((flashcardSource.match(/await requireLegacyFlashcardDeckAccess\(ctx, input\.(?:id|deckId)\);/g) ?? []).length).toBe(3);
  });

  it("requires organization-admin ownership throughout mounted legacy LMS media management", () => {
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const mediaSource = routerSource.slice(
      routerSource.indexOf("media: router({"),
      routerSource.indexOf("// ── Course Builder")
    );
    expect(mediaSource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, input.orgId);");
    expect(mediaSource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, mediaItem.orgId);");
    expect(mediaSource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, folder.orgId);");
    expect(mediaSource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, clip.orgId);");
    expect(mediaSource).toContain("orgId: mediaItem.orgId,");
    expect(mediaSource).toContain("createdBy: ctx.user.id,");
    expect(mediaSource).toContain("const fallbackOrgId = input.orgId ?? await requireOrgId(ctx.user.id);");
    expect(mediaSource).toContain("One or more media items were not found");
    expect((mediaSource.match(/requireOrgAdmin\(ctx\.user\.id, ctx\.user\.role, orgId\)/g) ?? []).length).toBeGreaterThanOrEqual(3);
  });

  it("requires organization-admin ownership for legacy LMS AI generation and course-copy operations", () => {
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const aiSource = routerSource.slice(
      routerSource.indexOf("ai: router({"),
      routerSource.indexOf("// ── Copy Course")
    );
    const copySource = routerSource.slice(
      routerSource.indexOf("copy: router({"),
      routerSource.indexOf("// ── Public School")
    );
    expect(aiSource).toContain("orgId: z.number().optional()");
    expect((aiSource.match(/await requireOrgAdmin\(ctx\.user\.id, ctx\.user\.role, orgId\);/g) ?? []).length).toBe(2);
    expect(copySource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);");
    expect(copySource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, original.orgId!);");
  });

  it("requires organization-admin ownership for legacy LMS workshops, announcements, and course resources", () => {
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const lmsDbSource = readFileSync(new URL("./lmsDb.ts", import.meta.url), "utf8");
    const workshopsSource = routerSource.slice(
      routerSource.indexOf("workshops: router({"),
      routerSource.indexOf("// ── Course Announcements")
    );
    const announcementsSource = routerSource.slice(
      routerSource.indexOf("announcements: router({"),
      routerSource.indexOf("// ── Course Resources")
    );
    const resourcesSource = routerSource.slice(
      routerSource.indexOf("resources: router({"),
      routerSource.indexOf("// ── Aliased sub-routers")
    );
    expect(routerSource).toContain("async function requireLegacyWorkshopAccess");
    expect(workshopsSource).toContain("await requireLegacyWorkshopAccess(ctx, input.id);");
    expect(workshopsSource).toContain("await requireLegacyWorkshopAccess(ctx, registration.workshopId);");
    expect(lmsDbSource).toContain("export async function getWorkshopRegistrationById");
    expect(announcementsSource).toContain("await requireLegacyCourseAccess(ctx, announcement.courseId);");
    expect(resourcesSource).toContain("await requireLegacyCourseAccess(ctx, resource.courseId);");
    expect(resourcesSource).toContain("Course does not belong to the requested organization");
  });

  it("requires authenticated learner or organization-admin course access before returning legacy announcements and resources", () => {
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const announcementSource = routerSource.slice(
      routerSource.indexOf("announcements: router({"),
      routerSource.indexOf("// ── Course Resources")
    );
    const resourcesSource = routerSource.slice(
      routerSource.indexOf("resources: router({"),
      routerSource.indexOf("// ── Aliased sub-routers")
    );
    expect(routerSource).toContain("async function requireLegacyCourseLearnerAccess");
    expect(announcementSource).toContain("list: protectedProcedure");
    expect(resourcesSource).toContain("list: protectedProcedure");
    expect(announcementSource).toContain("await requireLegacyCourseLearnerAccess(ctx, input.courseId);");
    expect(resourcesSource).toContain("await requireLegacyCourseLearnerAccess(ctx, input.courseId);");
  });

  it("requires organization-admin ownership for legacy LMS course and instructor listings", () => {
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const listSource = routerSource.slice(
      routerSource.indexOf("listCourses: protectedProcedure"),
      routerSource.indexOf("// ── Workshops")
    );
    expect((listSource.match(/await requireOrgAdmin\(ctx\.user\.id, ctx\.user\.role, orgId\);/g) ?? []).length).toBe(2);
  });

  it("requires organization-admin ownership for legacy LMS webinar administration", () => {
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const webinarSource = routerSource.slice(
      routerSource.indexOf("webinars: router({"),
      routerSource.indexOf("// ── Members")
    );
    expect(webinarSource).toContain("Webinar does not belong to the requested organization");
    expect((webinarSource.match(/await requireWebinarAccess\(ctx, input\.webinarId\);/g) ?? []).length).toBeGreaterThanOrEqual(7);
    expect((webinarSource.match(/await requireOrgAdmin\(ctx\.user\.id, ctx\.user\.role, orgId\);/g) ?? []).length).toBe(2);
  });

  it("requires organization-admin ownership for legacy LMS member management", () => {
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const membersSource = routerSource.slice(
      routerSource.indexOf("members: router({"),
      routerSource.indexOf("// ── Email Marketing")
    );
    expect((membersSource.match(/await requireOrgAdmin\(ctx\.user\.id, ctx\.user\.role, orgId\);/g) ?? []).length).toBe(4);
    expect(membersSource).toContain("Course does not belong to the requested organization");
  });

  it("requires organization-admin ownership for legacy LMS pages, instructors, and affiliates", () => {
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const lmsDbSource = readFileSync(new URL("./lmsDb.ts", import.meta.url), "utf8");
    const pagesSource = routerSource.slice(
      routerSource.indexOf("pages: router({"),
      routerSource.indexOf("// ── Instructors")
    );
    const instructorsSource = routerSource.slice(
      routerSource.indexOf("instructors: router({"),
      routerSource.indexOf("// ── Affiliates")
    );
    const affiliatesSource = routerSource.slice(
      routerSource.indexOf("affiliates: router({"),
      routerSource.indexOf("// ── Certificates")
    );
    expect(pagesSource).toContain("orgId: z.number().optional(), prompt: z.string()");
    expect(pagesSource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, page.orgId);");
    expect(instructorsSource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, instructor.orgId);");
    expect(affiliatesSource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, affiliate.orgId);");
    expect(lmsDbSource).toContain("export async function getInstructorById");
  });

  it("requires organization-admin ownership for legacy LMS subscriptions and page queries", () => {
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const subscriptionSource = routerSource.slice(
      routerSource.indexOf("subscription: router({"),
      routerSource.indexOf("// ── Pages")
    );
    const pagesSource = routerSource.slice(
      routerSource.indexOf("pages: router({"),
      routerSource.indexOf("// ── Instructors")
    );
    expect(subscriptionSource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);");
    expect(pagesSource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, page.orgId);");
    expect(pagesSource).toContain("await requireLegacyCourseAccess(ctx, input.courseId);");
    expect(pagesSource).toContain("getPublishedPageBySlug(input.slug)");
  });

  it("verifies the free-preview course belongs to the requested organization", () => {
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const freePreviewSource = routerSource.slice(
      routerSource.indexOf("registerFreePreview: protectedProcedure"),
      routerSource.indexOf("// ── Upgrade Prompt Checkout")
    );
    expect(freePreviewSource).toContain("const course = await getCourseById(input.courseId);");
    expect(freePreviewSource).toContain("Course does not belong to the requested organization");
  });

  it("returns only published legacy courses publicly while allowing organization-admin draft previews", () => {
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const courseLookupSource = routerSource.slice(
      routerSource.indexOf("getCourse: publicProcedure"),
      routerSource.indexOf("listCourses: protectedProcedure")
    );
    expect(courseLookupSource).toContain('if (!course || course.status === "published")');
    expect(courseLookupSource).toContain("if (!user)");
    expect(courseLookupSource).toContain("await requireOrgAdmin(user.id, user.role, course.orgId);");
  });

  it("uses Teachific platform identifiers rather than legacy brand identifiers in widget embed code", () => {
    const widgetManagerSource = readFileSync(new URL("../client/src/pages/admin/WidgetManager.tsx", import.meta.url), "utf8");
    expect(widgetManagerSource).toContain("teachific-widget-");
    expect(widgetManagerSource).toContain("teachific-widget-resize");
    expect(widgetManagerSource).not.toContain("aau-widget-");
    expect(widgetManagerSource).not.toContain("ultrasound-widget-resize");
  });

  it("applies the owning organization theme to public embed widgets", () => {
    const widgetRouterSource = readFileSync(new URL("./routers/widgetAdminRouter.ts", import.meta.url), "utf8");
    const widgetRendererSource = readFileSync(new URL("../client/src/pages/WidgetRenderer.tsx", import.meta.url), "utf8");
    expect(widgetRouterSource).toContain('import { getOrgTheme } from "../lmsDb";');
    expect(widgetRouterSource).toContain("const organizationTheme = await getOrgTheme(row.orgId);");
    expect(widgetRouterSource).toContain("studentPrimaryColor || organizationTheme.primaryColor");
    expect(widgetRendererSource).toContain("organizationTheme?.buttonColor || organizationTheme?.primaryColor");
    expect(widgetRendererSource).toContain("fontFamily: widget.organizationTheme?.fontFamily");
  });

  it("uses Teachific labeling and active organization styles for Question Bank folder controls", () => {
    const lmsAdminSource = readFileSync(new URL("../client/src/pages/admin/LMSAdmin.tsx", import.meta.url), "utf8");
    expect(lmsAdminSource).toContain("Teachific Quiz Creator");
    expect(lmsAdminSource).toContain("org-primary-button");
    expect(lmsAdminSource).toContain("var(--org-primary)");
    expect(lmsAdminSource).not.toContain('>SonoQuiz<');
    expect(lmsAdminSource).not.toContain('Share in SonoQuiz');
  });

  it("uses active organization colors for Checkout Page Editor content-block controls", () => {
    const checkoutEditorSource = readFileSync(new URL("../client/src/pages/admin/CheckoutPageEditorPage.tsx", import.meta.url), "utf8");
    expect(checkoutEditorSource).toContain('if (section.type === "content_block") return "text-[var(--org-primary)]";');
    expect(checkoutEditorSource).toContain('color: "text-[var(--org-primary)]"');
    expect(checkoutEditorSource).toContain('borderColor: "var(--org-primary)"');
    expect(checkoutEditorSource).not.toContain('"text-indigo-600"');
  });

  it("uses generic placeholders in organization-owned bundle and physical-product creation flows", () => {
    const adminBundlesSource = readFileSync(new URL("../client/src/pages/admin/BundlesAdmin.tsx", import.meta.url), "utf8");
    const lmsBundlesSource = readFileSync(new URL("../client/src/pages/lms/BundlesAdmin.tsx", import.meta.url), "utf8");
    const adminProductsSource = readFileSync(new URL("../client/src/pages/admin/PhysicalProductsAdmin.tsx", import.meta.url), "utf8");
    const lmsProductsSource = readFileSync(new URL("../client/src/pages/lms/PhysicalProductsAdmin.tsx", import.meta.url), "utf8");
    expect(adminBundlesSource).toContain("Complete Learning Resource Pack");
    expect(lmsBundlesSource).toContain("Complete Learning Resource Pack");
    expect(adminProductsSource).toContain("Professional Reference Card Set");
    expect(lmsProductsSource).toContain("Professional Reference Card Set");
    expect(`${adminBundlesSource}\n${lmsBundlesSource}\n${adminProductsSource}\n${lmsProductsSource}`).not.toContain("Ultrasound Reference Card Set");
  });

  it("uses a generic manual access grant product placeholder", () => {
    const fulfillmentSource = readFileSync(new URL("../client/src/pages/admin/FulfillmentAdmin.tsx", import.meta.url), "utf8");
    expect(fulfillmentSource).toContain("Professional Development Course");
    expect(fulfillmentSource).not.toContain("Vascular Ultrasound Course");
  });

  it("uses active organization colors for General Form Builder score and webhook accents", () => {
    const formBuilderSource = readFileSync(new URL("../client/src/pages/admin/GeneralFormBuilder.tsx", import.meta.url), "utf8");
    expect(formBuilderSource).toContain('backgroundColor: "color-mix(in_srgb, var(--org-primary) 14%, transparent)"');
    expect(formBuilderSource).toContain('backgroundColor: "color-mix(in_srgb, var(--org-primary) 10%, transparent)"');
    expect(formBuilderSource).toContain('style={{ color: "var(--org-primary)" }}');
    expect(formBuilderSource).not.toContain("bg-purple-50");
  });

  it("uses Teachific wording in SCORM health and account-sharing operational notices", () => {
    const healthAlertSource = readFileSync(new URL("./lib/scormHealthAlerts.ts", import.meta.url), "utf8");
    const sharingMonitorSource = readFileSync(new URL("./jobs/sharingMonitor.ts", import.meta.url), "utf8");
    expect(healthAlertSource).toContain('subject: `[Teachific] SCORM health alert');
    expect(healthAlertSource).toContain('brandMode: "teachific"');
    expect(sharingMonitorSource).toContain("Teachific™ Account Sharing Monitor");
    expect(`${healthAlertSource}\n${sharingMonitorSource}`).not.toContain("UltrasoundAssist");
  });

  it("uses Teachific-only wording in the account upgrade prompt", () => {
    const upgradePromptSource = readFileSync(new URL("../client/src/components/UpgradePrompt.tsx", import.meta.url), "utf8");
    expect(upgradePromptSource).toContain("Teachific™ Premium");
    expect(upgradePromptSource).not.toContain("UltrasoundAssist");
  });

  it("uses Teachific branding in platform analytics PDF exports", () => {
    const pdfExportSource = readFileSync(new URL("../client/src/lib/exportAnalyticsPdf.ts", import.meta.url), "utf8");
    expect(pdfExportSource).toContain("Teachific™ Analytics");
    expect(pdfExportSource).not.toContain("UltrasoundAssist");
  });

  it("uses generic Teachific labels in the shared platform navigation", () => {
    const layoutSource = readFileSync(new URL("../client/src/components/Layout.tsx", import.meta.url), "utf8");
    expect(layoutSource).toContain('label: "Guided Tools"');
    expect(layoutSource).toContain('label: "Clinical Calculators"');
    expect(layoutSource).toContain("Submit Clinical Case");
    expect(layoutSource).toContain("Educator Tools");
    expect(layoutSource).not.toContain("UltrasoundAssist");
    expect(layoutSource).not.toContain("PediatricAssist");
    expect(layoutSource).not.toContain("EchoAssist");
  });

  it("uses generic Teachific wording in the premium access guard", () => {
    const roleGuardSource = readFileSync(new URL("../client/src/components/RoleGuard.tsx", import.meta.url), "utf8");
    expect(roleGuardSource).toContain("expanded learning tools, guided resources");
    expect(roleGuardSource).toContain("Unlimited flashcards and case studies");
    expect(roleGuardSource).not.toContain("EchoAssist");
    expect(roleGuardSource).not.toContain("Ultrasound Flashcards");
  });

  it("uses Teachific platform wording in user subscription details", () => {
    const userDetailSource = readFileSync(new URL("../client/src/pages/admin/AdminUserDetailPage.tsx", import.meta.url), "utf8");
    expect(userDetailSource).toContain("Teachific™ platform app subscriptions");
    expect(userDetailSource).not.toContain("UltrasoundAssist™ and EchoAssist™ app subscriptions");
  });

  it("uses generic Teachific labels in the reusable navigation configuration", () => {
    const brandNavSource = readFileSync(new URL("../client/src/config/brandNav.ts", import.meta.url), "utf8");
    expect(brandNavSource).toContain("const PLATFORM_NAV_GROUPS");
    expect(brandNavSource).toContain("const PLATFORM_HIDDEN_NAV");
    expect(brandNavSource).toContain('label: "Guided Tools"');
    expect(brandNavSource).toContain('label: "Audio Learning Library"');
    expect(brandNavSource).toContain("navGroups: PLATFORM_NAV_GROUPS");
    expect(brandNavSource).not.toContain("UltrasoundAssist");
    expect(brandNavSource).not.toContain("EchoAssist");
    expect(brandNavSource).not.toContain("PediatricAssist");
    expect(brandNavSource).not.toContain("iHeartEcho");
  });

  it("supports per-question feedback modes in Teachific Quiz Creator authoring and preview", () => {
    const questionTypesSource = readFileSync(new URL("../client/src/quiz-creator/types/quiz.ts", import.meta.url), "utf8");
    const quizStoreSource = readFileSync(new URL("../client/src/quiz-creator/store/quizStore.ts", import.meta.url), "utf8");
    const questionEditorSource = readFileSync(new URL("../client/src/quiz-creator/components/QuestionEditor.tsx", import.meta.url), "utf8");
    const mcqEditorSource = readFileSync(new URL("../client/src/quiz-creator/components/editors/McqEditor.tsx", import.meta.url), "utf8");
    const previewSource = readFileSync(new URL("../client/src/quiz-creator/components/QuizPreview.tsx", import.meta.url), "utf8");
    expect(questionTypesSource).toContain('feedbackMode?: "question" | "answer"');
    expect(questionTypesSource).toContain("trueFeedback?: string");
    expect(questionTypesSource).toContain("feedbackHtml?: string");
    expect(quizStoreSource).toContain('feedbackMode: "answer"');
    expect(questionEditorSource).toContain("Question-based");
    expect(questionEditorSource).toContain("Answer-based");
    expect(mcqEditorSource).toContain("Optional feedback for option");
    expect(previewSource).toContain("feedbackQuestionId");
    expect(previewSource).toContain('quiz.meta.feedbackMode === "immediate"');
  });

  it("offers and persists optional organization-authorized AI course assessments", () => {
    const aiRouterSource = readFileSync(new URL("../server/routers/lmsEnrollmentAdminRouter.ts", import.meta.url), "utf8");
    const courseBuilderSource = readFileSync(new URL("../client/src/pages/lms/CourseBuilderPage.tsx", import.meta.url), "utf8");
    expect(aiRouterSource).toContain("generateCourseQuiz: z.boolean().default(false)");
    expect(aiRouterSource).toContain('"courseQuiz": ${generateCourseQuiz');
    expect(aiRouterSource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, course.orgId)");
    expect(aiRouterSource).toContain("title: \"Course Assessment\"");
    expect(courseBuilderSource).toContain("aiGenerateCourseQuiz");
    expect(courseBuilderSource).toContain("Add a <strong>5-question course assessment</strong>");
    expect(courseBuilderSource).toContain("Course Assessment ({aiPreview.courseQuiz.questions.length} questions)");
  });

  it("auto-completes ordinary CME lessons only when the owning organization has CME enabled", () => {
    const coursePlayerSource = readFileSync(new URL("../client/src/pages/lms/CoursePlayerPage.tsx", import.meta.url), "utf8");
    expect(coursePlayerSource).toContain("trpc.cme.getCmeStatus.useQuery");
    expect(coursePlayerSource).toContain("cmeStatus?.enabled && course?.creditHours");
    expect(coursePlayerSource).toContain('!["video", "quiz"].includes(currentLesson.type)');
    expect(coursePlayerSource).toContain("shouldAutoCompleteCmeLesson");
    expect(coursePlayerSource).toContain("void handleComplete()");
  });

  it("supports native hosting, Question Bank import, or both for SCORM and quiz packages", () => {
    const importPageSource = readFileSync(new URL("../client/src/pages/QuestionBankImportPage.tsx", import.meta.url), "utf8");
    const fileDetailSource = readFileSync(new URL("../client/src/pages/FileDetailPage.tsx", import.meta.url), "utf8");
    expect(importPageSource).toContain('importMode === "native-only" || importMode === "both"');
    expect(importPageSource).toContain('importMode === "bank-only" || importMode === "both"');
    expect(importPageSource).toContain('Host & Import ${selectedIndices.size} Question');
    expect(importPageSource).toContain("confirm-native");
    expect(fileDetailSource).toContain("Save to Question Bank");
    expect(fileDetailSource).toContain("extract-from-package");
    expect(fileDetailSource).toContain("originalZipKey");
  });

  it("provides draggable editor height and a sticky toolbar for shared rich-text authoring", () => {
    const richTextEditorSource = readFileSync(new URL("../client/src/components/RichTextEditor.tsx", import.meta.url), "utf8");
    expect(richTextEditorSource).toContain("const [editorHeight, setEditorHeight]");
    expect(richTextEditorSource).toContain("Drag to resize editor");
    expect(richTextEditorSource).toContain("cursor-ns-resize");
    expect(richTextEditorSource).toContain("sticky top-0 z-10");
    expect(richTextEditorSource).toContain("maxHeight = 600");
  });

  it("uses organization theme tokens for Question Bank package importer controls", () => {
    const importPageSource = readFileSync(new URL("../client/src/pages/QuestionBankImportPage.tsx", import.meta.url), "utf8");
    expect(importPageSource).toContain("bg-primary border-primary text-primary-foreground");
    expect(importPageSource).toContain("border-primary bg-primary/5 text-primary");
    expect(importPageSource).not.toContain("teal-");
  });

  it("uses the active organization theme for LMS administration cohort assignment badges", () => {
    const lmsAdminSource = readFileSync(new URL("../client/src/pages/admin/LMSAdmin.tsx", import.meta.url), "utf8");
    expect(lmsAdminSource).toContain("text-[var(--org-primary)] border border-[color-mix(in_srgb,var(--org-primary)_30%,transparent)]");
    expect(lmsAdminSource).not.toContain("bg-purple-100 text-purple-700 border border-purple-200");
  });

  it("scopes organization-admin user detail records to the active organization", () => {
    const adminUserRouterSource = readFileSync(new URL("./routers/adminUserRouter.ts", import.meta.url), "utf8");
    expect(adminUserRouterSource).toContain("This user is not a member of the active organization.");
    expect(adminUserRouterSource).toContain("eq(workshops.orgId, orgId)");
    expect(adminUserRouterSource).toContain("eq(memberships.orgId, orgId)");
    expect(adminUserRouterSource).toContain("eq(bundles.orgId, orgId)");
    expect(adminUserRouterSource).toContain("eq(orgMembers.orgId, orgId)");
  });

  it("requires active-organization user membership for user administration workshop, progress, activity, and alias actions", () => {
    const adminUserRouterSource = readFileSync(new URL("./routers/adminUserRouter.ts", import.meta.url), "utf8");
    expect(adminUserRouterSource).toContain("requireActiveOrgUserMembership");
    expect(adminUserRouterSource).toContain("Workshop does not belong to the active organization.");
    expect(adminUserRouterSource).toContain("Workshop instance does not belong to the selected workshop.");
    expect(adminUserRouterSource).toContain("eq(lmsEnrollments.orgId, orgId)");
    expect(adminUserRouterSource).toContain("Email alias not found.");
  });

  it("requires active-organization ownership for user administration membership and certificate actions and platform authority for raw Stripe actions", () => {
    const adminUserRouterSource = readFileSync(new URL("./routers/adminUserRouter.ts", import.meta.url), "utf8");
    expect(adminUserRouterSource).toContain("Enrollment does not belong to the active organization.");
    expect(adminUserRouterSource).toContain("Order does not belong to the active organization.");
    expect(adminUserRouterSource).toContain("Membership does not belong to the active organization.");
    expect(adminUserRouterSource).toContain("Enrollment does not belong to the active organization and course.");
    expect(adminUserRouterSource).toContain("Certificate does not belong to the active organization.");
    expect(adminUserRouterSource).toContain("assertPlatformAdmin(ctx.user.role);");
  });

  it("requires active-organization user and course ownership for enrollment management and confirmation emails", () => {
    const adminUserRouterSource = readFileSync(new URL("./routers/adminUserRouter.ts", import.meta.url), "utf8");
    expect(adminUserRouterSource).toContain("Course does not belong to the active organization.");
    expect(adminUserRouterSource).toContain("Enrollment does not belong to the active organization and user.");
    expect(adminUserRouterSource).toContain("requireActiveOrgUserMembership(ctx, input.userId)");
  });

  it("requires active-organization user, cohort, and course ownership for cohort administration", () => {
    const adminUserRouterSource = readFileSync(new URL("./routers/adminUserRouter.ts", import.meta.url), "utf8");
    expect(adminUserRouterSource).toContain("Cohort group does not belong to the active organization and course.");
    expect(adminUserRouterSource).toContain("eq(lmsCohortGroups.orgId, orgId)");
    expect(adminUserRouterSource).toContain("requireActiveOrgUserMembership(ctx, input.userId)");
  });

  it("restricts cross-organization user search and merge administration to platform administrators", () => {
    const adminUserRouterSource = readFileSync(new URL("./routers/adminUserRouter.ts", import.meta.url), "utf8");
    const mergeSlice = adminUserRouterSource.slice(adminUserRouterSource.indexOf("searchUsersForMerge"));
    expect(mergeSlice).toContain("assertPlatformAdmin(ctx.user.role);");
  });

  it("requires active-organization target-user membership for profile and password actions and platform authority for global roles", () => {
    const adminUserRouterSource = readFileSync(new URL("./routers/adminUserRouter.ts", import.meta.url), "utf8");
    const profileSlice = adminUserRouterSource.slice(adminUserRouterSource.indexOf("updateUserProfile"), adminUserRouterSource.indexOf("// ─── Brand Memberships"));
    const appRoleSlice = adminUserRouterSource.slice(adminUserRouterSource.indexOf("getUserAppRoles"), adminUserRouterSource.indexOf("// ─── Profile management"));
    expect(profileSlice).toContain("requireActiveOrgUserMembership(ctx, userId)");
    expect(profileSlice).toContain("requireActiveOrgUserMembership(ctx, input.userId)");
    expect(appRoleSlice).toContain("assertPlatformAdmin(ctx.user.role);");
    expect(adminUserRouterSource.slice(adminUserRouterSource.indexOf("grantBrandMembership"))).toContain("assertPlatformAdmin(ctx.user.role);");
  });

  it("requires platform authority for global coupons and active-organization ownership for purchase access emails", () => {
    const adminUserRouterSource = readFileSync(new URL("./routers/adminUserRouter.ts", import.meta.url), "utf8");
    const couponSlice = adminUserRouterSource.slice(adminUserRouterSource.indexOf("createCoupon"), adminUserRouterSource.indexOf("// ─── Sales Dashboard"));
    const accessSlice = adminUserRouterSource.slice(adminUserRouterSource.indexOf("resendAccessEmail"));
    expect(couponSlice).toContain("assertPlatformAdmin(ctx.user.role);");
    expect(accessSlice).toContain("Purchase does not belong to the active organization.");
    expect(accessSlice).toContain("getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role)");
  });

  it("requires platform authority for custom domains and active-organization ownership for LMS sales and order actions", () => {
    const enrollmentRouterSource = readFileSync(new URL("./routers/lmsEnrollmentAdminRouter.ts", import.meta.url), "utf8");
    const customDomainSlice = enrollmentRouterSource.slice(enrollmentRouterSource.indexOf("getCustomDomains"), enrollmentRouterSource.indexOf("// ─── Sales: get all orders"));
    const salesSlice = enrollmentRouterSource.slice(enrollmentRouterSource.indexOf("getSalesData"), enrollmentRouterSource.indexOf("// ─── Sales: cancel a subscription"));
    expect(customDomainSlice).toContain("Platform admin access required.");
    expect(salesSlice).toContain("Course does not belong to the active organization.");
    expect(salesSlice).toContain("Order does not belong to the active organization.");
  });

  it("restricts legacy global affiliate records to platform administrators until they carry organization ownership", () => {
    const enrollmentRouterSource = readFileSync(new URL("./routers/lmsEnrollmentAdminRouter.ts", import.meta.url), "utf8");
    const affiliateSlice = enrollmentRouterSource.slice(enrollmentRouterSource.indexOf("listAffiliates"), enrollmentRouterSource.indexOf("// ── Analytics"));
    expect(affiliateSlice).toContain("Platform admin access required for global affiliate records.");
  });

  it("requires active-organization ownership for legacy LMS teams, team courses, and enrolled-student searches", () => {
    const enrollmentRouterSource = readFileSync(new URL("./routers/lmsEnrollmentAdminRouter.ts", import.meta.url), "utf8");
    const teamSlice = enrollmentRouterSource.slice(enrollmentRouterSource.indexOf("listTeams"), enrollmentRouterSource.indexOf("// ── Instructors"));
    expect(teamSlice).toContain("requireActiveEnrollmentOrg(ctx.user.id, ctx.user.role)");
    expect(teamSlice).toContain("Team does not belong to the active organization.");
    expect(teamSlice).toContain("Team or course does not belong to the active organization.");
    expect(teamSlice).toContain("Team course allocation does not belong to the active organization.");
  });

  it("reconciles instructor storage and requires active-organization ownership for instructor administration", () => {
    const enrollmentRouterSource = readFileSync(new URL("./routers/lmsEnrollmentAdminRouter.ts", import.meta.url), "utf8");
    const schemaSource = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
    const instructorSlice = enrollmentRouterSource.slice(enrollmentRouterSource.indexOf("listInstructors"), enrollmentRouterSource.indexOf("// ── Affiliates"));
    expect(schemaSource).toContain('displayName: varchar("display_name"');
    expect(schemaSource).toContain('socialLinks: text("social_links")');
    expect(instructorSlice).toContain("requireActiveEnrollmentOrg(ctx.user.id, ctx.user.role)");
    expect(instructorSlice).toContain("Instructor does not belong to the active organization.");
    expect(instructorSlice).toContain("One or more instructors do not belong to the active organization.");
  });

  it("resolves protected legacy LMS instructor listing from the active organization", () => {
    const legacyLmsSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const listingSlice = legacyLmsSource.slice(legacyLmsSource.indexOf("listInstructors: protectedProcedure"), legacyLmsSource.indexOf("// ── Workshops"));
    expect(listingSlice).toContain("getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role)");
    expect(listingSlice).toContain("Instructor records must be loaded from the active organization.");
  });

  it("shows the maintenance banner only to signed-in users with dismissal and August 25 removal safeguards", () => {
    const bannerSource = readFileSync(new URL("../client/src/components/MaintenanceBanner.tsx", import.meta.url), "utf8");
    const appSource = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");
    expect(bannerSource).toContain("!user");
    expect(bannerSource).toContain("teachific-maintenance-2026-08");
    expect(bannerSource).toContain("Date.UTC(2026, 7, 25, 13, 0, 0)");
    expect(bannerSource).toContain("window.setTimeout(() => setIsActive(false), remainingMs)");
    expect(bannerSource).toContain("window.clearTimeout(removalTimer)");
    expect(bannerSource).toContain("Scheduled Server Maintenance Aug 22–24, 2026");
    expect(bannerSource).toContain("Dismiss scheduled maintenance notice");
    expect(appSource).toContain("<MaintenanceBanner />");
  });

  it("resolves CME activity-form administration from the active organization for organization administrators", () => {
    const cmeRouterSource = readFileSync(new URL("./routers/cmeActivityFormRouter.ts", import.meta.url), "utf8");
    const resolverSlice = cmeRouterSource.slice(cmeRouterSource.indexOf("async function resolveOrgId"), cmeRouterSource.indexOf("/** Assert the org has CME enabled"));
    expect(resolverSlice).toContain("getOrgIdForUserWithFallback(userId, platformRole)");
    expect(resolverSlice).toContain("CME activity forms must be managed from the active organization.");
    expect(resolverSlice).toContain('platformRole === "site_owner" || platformRole === "site_admin"');
  });

  it("resolves CME disclosure administration from the active organization for organization administrators", () => {
    const disclosureRouterSource = readFileSync(new URL("./routers/cmeDisclosureRouter.ts", import.meta.url), "utf8");
    const resolverSlice = disclosureRouterSource.slice(disclosureRouterSource.indexOf("async function resolveOrgId"), disclosureRouterSource.indexOf("async function assertCmeEnabled"));
    expect(resolverSlice).toContain("getOrgIdForUserWithFallback(userId, platformRole)");
    expect(resolverSlice).toContain("CME disclosures must be managed from the active organization.");
    expect(resolverSlice).toContain('platformRole === "site_owner" || platformRole === "site_admin"');
  });

  it("uses active organization theme tokens for Email Campaigns click analytics and status indicators", () => {
    const campaignSource = readFileSync(new URL("../client/src/pages/marketing/EmailCampaignsPage.tsx", import.meta.url), "utf8");
    expect(campaignSource).toContain('color: "bg-[var(--org-primary)]"');
    expect(campaignSource).toContain('color: "text-[var(--org-primary)]"');
    expect(campaignSource).toContain('text-[var(--org-primary)]');
    expect(campaignSource).toContain('color-mix(in_srgb,var(--org-primary)_18%,transparent)');
  });

  it("uses active organization theme tokens for CME form AI controls, badges, and send actions", () => {
    const dialogSource = readFileSync(new URL("../client/src/components/CmeActivityFormDialog.tsx", import.meta.url), "utf8");
    const tabSource = readFileSync(new URL("../client/src/components/CmeFormTab.tsx", import.meta.url), "utf8");
    for (const source of [dialogSource, tabSource]) {
      expect(source).toContain('text-[var(--org-primary)]');
      expect(source).toContain('org-primary-button');
      expect(source).toContain('color-mix(in_srgb,var(--org-primary)_30%,transparent)');
    }
  });

  it("uses the active organization theme for After Purchase Workflow message actions", () => {
    const workflowSource = readFileSync(new URL("../client/src/components/AfterPurchaseWorkflowEditor.tsx", import.meta.url), "utf8");
    expect(workflowSource).toContain('window_message: "text-[var(--org-primary)]"');
    expect(workflowSource).toContain('window_message: "bg-[color:color-mix(in_srgb,var(--org-primary)_8%,transparent)]');
  });

  it("uses the active organization theme for Funnel Builder order and checkout actions", () => {
    const funnelSource = readFileSync(new URL("../client/src/pages/marketing/FunnelBuilderPage.tsx", import.meta.url), "utf8");
    expect(funnelSource).toContain('value: "order", label: "Order / Checkout", icon: ShoppingCart, color: "bg-[var(--org-primary)]"');
  });

  it("uses the active organization theme for Lesson Editor text-block accents", () => {
    const lessonEditorSource = readFileSync(new URL("../client/src/components/lms/LessonEditorSheet.tsx", import.meta.url), "utf8");
    expect(lessonEditorSource).toContain('text: { label: "Text / Rich Content", icon: FileText, color: "bg-[color:color-mix(in_srgb,var(--org-primary)_14%,transparent)] text-[var(--org-primary)]" }');
  });

  it("uses the active organization theme for Form Stripe Settings information panels", () => {
    const stripePanelSource = readFileSync(new URL("../client/src/components/admin/FormStripeSettingsPanel.tsx", import.meta.url), "utf8");
    expect(stripePanelSource).toContain('bg-[color:color-mix(in_srgb,var(--org-primary)_8%,transparent)]');
    expect(stripePanelSource).toContain('border-[color:color-mix(in_srgb,var(--org-primary)_28%,transparent)]');
  });

  it("resolves core content library pages from the active organization rather than the first membership", () => {
    const flashcardsSource = readFileSync(new URL("../client/src/pages/FlashcardsPage.tsx", import.meta.url), "utf8");
    const quizBuilderSource = readFileSync(new URL("../client/src/pages/QuizBuilderPage.tsx", import.meta.url), "utf8");
    const quizzesSource = readFileSync(new URL("../client/src/pages/QuizzesPage.tsx", import.meta.url), "utf8");
    const mediaFilesSource = readFileSync(new URL("../client/src/pages/MediaFilesPage.tsx", import.meta.url), "utf8");
    for (const source of [flashcardsSource, quizBuilderSource, quizzesSource, mediaFilesSource]) {
      expect(source).toContain('useOrgScope');
      expect(source).toContain('const { orgId } = useOrgScope();');
      expect(source).not.toContain('myOrgs?.[0]?.id');
    }
  });

  it("resolves CME Management from the active organization rather than the first membership", () => {
    const cmeManagementSource = readFileSync(new URL("../client/src/pages/lms/CmeManagementPage.tsx", import.meta.url), "utf8");
    expect(cmeManagementSource).toContain('const { orgId } = useOrgScope();');
    expect(cmeManagementSource).not.toContain('const orgId = orgs?.[0]?.id;');
  });

  it("resolves Community Learner messaging from the active organization rather than the first membership", () => {
    const communityLearnerSource = readFileSync(new URL("../client/src/pages/lms/CommunityLearnerPage.tsx", import.meta.url), "utf8");
    expect(communityLearnerSource).toContain('const { orgId } = useOrgScope();');
    expect(communityLearnerSource).not.toContain('const orgId = orgs?.[0]?.id;');
  });

  it("resolves Membership Editor and Invoices from the active organization rather than the first membership", () => {
    const membershipEditorSource = readFileSync(new URL("../client/src/pages/products/MembershipEditorPage.tsx", import.meta.url), "utf8");
    const invoicesSource = readFileSync(new URL("../client/src/pages/sales/InvoicesPage.tsx", import.meta.url), "utf8");
    expect(membershipEditorSource).toContain('const { orgId } = useOrgScope();');
    expect(membershipEditorSource).not.toContain('myOrgs?.[0]?.id');
    expect(invoicesSource).toContain('const { orgId, orgs } = useOrgScope();');
    expect(invoicesSource).not.toContain('myOrgs?.[0]?.id');
  });

  it("resolves Digital Product and Webinar editor links from the active organization rather than the first membership", () => {
    const productEditorSource = readFileSync(new URL("../client/src/pages/admin/DigitalProductEditorPage.tsx", import.meta.url), "utf8");
    const webinarEditorSource = readFileSync(new URL("../client/src/pages/admin/WebinarEditorPage.tsx", import.meta.url), "utf8");
    expect(productEditorSource).toContain('const { orgId, orgs } = useOrgScope();');
    expect(productEditorSource).not.toContain('myOrgs?.[0]');
    expect(webinarEditorSource).toContain('const { orgId, orgs } = useOrgScope();');
    expect(webinarEditorSource).not.toContain('const wOrg = myOrgs?.[0];');
  });

  it("resolves Record Edit media authoring from the active organization rather than the first membership", () => {
    const recordEditSource = readFileSync(new URL("../client/src/pages/RecordEditPage.tsx", import.meta.url), "utf8");
    expect(recordEditSource).toContain('const { orgId } = useOrgScope();');
    expect(recordEditSource).not.toContain('myOrgs?.[0]?.id');
  });

  it("resolves Files page package, folder, and media queries from the active organization", () => {
    const filesPageSource = readFileSync(new URL("../client/src/pages/FilesPage.tsx", import.meta.url), "utf8");
    expect(filesPageSource).toContain('const { orgId } = useOrgScope();');
    expect(filesPageSource).toContain('orgId ? { orgId } : undefined');
    expect(filesPageSource).not.toContain('activeOrg?.id ?? myOrgs?.[0]?.id');
  });

  it("requires non-platform LMS administrators to use the active organization for caller-supplied organization inputs", () => {
    const lmsAdminSource = readFileSync(new URL("./routers/lmsAdminRouter.ts", import.meta.url), "utf8");
    expect(lmsAdminSource).toContain('async function resolveActiveAdminOrg');
    expect(lmsAdminSource).toContain('requestedOrgId !== activeOrgId && !isPlatformAdministrator');
    expect(lmsAdminSource).toContain('await resolveActiveAdminOrg(ctx, input?.orgId);');
    expect(lmsAdminSource).toContain('await resolveActiveAdminOrg(ctx, input.orgId);');
  });

  it("uses the active organization theme for Community product page upgrade callouts", () => {
    const communityPageSource = readFileSync(new URL("../client/src/pages/products/CommunityPage.tsx", import.meta.url), "utf8");
    expect(communityPageSource).toContain('text-[var(--org-primary)]');
    expect(communityPageSource).toContain('className="org-primary-button hover:gap-1.5 flex-shrink-0"');
    expect(communityPageSource).not.toContain('border-purple-200');
  });

  it("resolves legacy LMS discussion notification links only from the owning organization domain", () => {
    const legacyLmsSource = readFileSync(new URL("./routers/lmsRouter.ts", import.meta.url), "utf8");
    expect(legacyLmsSource).toContain('let discussionOrgBase: string | null = null;');
    expect(legacyLmsSource).toContain('if (!discussionOrgBase) return;');
    expect(legacyLmsSource).not.toContain('let discussionOrgBase = "https://teachific.app";');
  });

  it("resolves invoice receipt login links from the owning organization domain", () => {
    const invoiceRouterSource = readFileSync(new URL("./routers/invoiceRouter.ts", import.meta.url), "utf8");
    expect(invoiceRouterSource).toContain('async function getOrganizationLoginUrl');
    expect(invoiceRouterSource).toContain('return getOrgBaseUrl(organization.slug');
    expect(invoiceRouterSource).toContain('loginUrl = await getOrganizationLoginUrl');
    expect(invoiceRouterSource).not.toContain('loginUrl: `https://teachific.app`');
  });

  it("sends LMS checkout confirmation links only when the owning organization domain is available", () => {
    const checkoutFulfillmentSource = readFileSync(new URL("./lib/lmsCheckoutFulfillment.ts", import.meta.url), "utf8");
    expect(checkoutFulfillmentSource).toContain('Enrollment email skipped (organization domain unavailable)');
    expect(checkoutFulfillmentSource).toContain('const orgBaseUrl = getOrgBaseUrl(course.orgSlug');
    expect(checkoutFulfillmentSource).not.toContain(': "https://teachific.app";');
  });

  it("sends membership fulfillment links only when the owning organization domain is available", () => {
    const membershipFulfillmentSource = readFileSync(new URL("./lib/membershipFulfillment.ts", import.meta.url), "utf8");
    expect(membershipFulfillmentSource).toContain('Skipping welcome email for plan ${opts.planId}: organization domain unavailable');
    expect(membershipFulfillmentSource).toContain('const baseUrl = getOrgBaseUrl(opts.orgSlug');
    expect(membershipFulfillmentSource).not.toContain(': "https://teachific.app";');
  });

  it("sends organization-owned enrollment and access email links only when an organization domain is available", () => {
    const enrollmentEmailSource = readFileSync(new URL("./lib/enrollmentEmail.ts", import.meta.url), "utf8");
    expect(enrollmentEmailSource).toContain('if (!orgBase) return false;');
    expect(enrollmentEmailSource).toContain('return orgBaseUrl ? `${orgBaseUrl}/auth/access?token=${accessToken}&next=${encoded}` : destination;');
    expect(enrollmentEmailSource).not.toContain('https://teachific.app/courses/${opts.courseSlug}');
    expect(enrollmentEmailSource).not.toContain('https://teachific.app/downloads/${opts.productSlug}/files');
    expect(enrollmentEmailSource).not.toContain('https://teachific.app/downloads/bundle/${opts.bundleSlug}');
  });

  it("uses Teachific-neutral wording in organization-owned enrollment and access email templates", () => {
    const enrollmentEmailSource = readFileSync(new URL("./lib/enrollmentEmail.ts", import.meta.url), "utf8");
    expect(enrollmentEmailSource).toContain('Teachific™ Learning');
    expect(enrollmentEmailSource).toContain('Your online learning access');
    expect(enrollmentEmailSource).not.toContain('General &amp; Vascular Ultrasound Clinical Intelligence');
    expect(enrollmentEmailSource).not.toContain('aaus_logo_ring');
  });

  it("requires active-organization authorization for AI image generation and passes scope from Landing Page Builder", () => {
    const courseBuilderRouterSource = readFileSync(new URL("./routers/lmsCourseBuilderRouter.ts", import.meta.url), "utf8");
    const landingBuilderSource = readFileSync(new URL("../client/src/pages/admin/LandingPageBuilder.tsx", import.meta.url), "utf8");
    expect(courseBuilderRouterSource).toContain('orgId: z.number().int().positive()');
    expect(courseBuilderRouterSource).toContain('Select the active organization before generating an image');
    expect(landingBuilderSource).toContain('const { orgId } = useOrgScope();');
    expect(landingBuilderSource).toContain('generateImageMutation.mutate({ prompt: prompt.trim(), orgId });');
  });

  it("supports the shared AI image block across lesson, email, and page authoring surfaces", () => {
    const lessonBlockEditorSource = readFileSync(new URL("../client/src/components/LessonBlockEditor.tsx", import.meta.url), "utf8");
    const emailBlockEditorSource = readFileSync(new URL("../client/src/components/EmailBlockEditor.tsx", import.meta.url), "utf8");
    const landingBuilderSource = readFileSync(new URL("../client/src/pages/admin/LandingPageBuilder.tsx", import.meta.url), "utf8");
    expect(lessonBlockEditorSource).toContain('BLOCK_CATALOG, CATALOG_CATEGORIES, BlockSettings');
    expect(emailBlockEditorSource).toContain('"ai_image"');
    expect(emailBlockEditorSource).toContain('BlockSettings');
    expect(landingBuilderSource).toContain('type: "ai_image", label: "AI Generate Image"');
  });

  it("uses the active organization theme for LMS player layout zone editor controls", () => {
    const lmsAdminSource = readFileSync(new URL("../client/src/pages/admin/LMSAdmin.tsx", import.meta.url), "utf8");
    expect(lmsAdminSource).toContain('top: { label: "Top Zone", desc: "Above progress bar", color: "var(--org-primary)" }');
    expect(lmsAdminSource).toContain('background: activeZone === "top" ? "var(--org-primary)"');
    expect(lmsAdminSource).not.toContain('top: { label: "Top Zone", desc: "Above progress bar", color: "#7c3aed" }');
  });

  it("uses the active organization theme for Course Builder player layout zone editor controls", () => {
    const courseBuilderSource = readFileSync(new URL("../client/src/pages/lms/CourseBuilderPage.tsx", import.meta.url), "utf8");
    expect(courseBuilderSource).toContain('top: { label: "Top Zone", desc: "Above progress bar", color: "var(--org-primary)" }');
    expect(courseBuilderSource).toContain('background: activeZone === "top" ? "var(--org-primary)"');
    expect(courseBuilderSource).not.toContain('top: { label: "Top Zone", desc: "Above progress bar", color: "#7c3aed" }');
  });

  it("resolves AI email promotion products from the active organization", () => {
    const emailCampaignRouterSource = readFileSync(new URL("./routers/emailCampaignRouter.ts", import.meta.url), "utf8");
    expect(emailCampaignRouterSource).toContain('getOrgIdForUserWithFallback');
    expect(emailCampaignRouterSource).toContain('await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role)');
    expect(emailCampaignRouterSource).not.toContain('await getOrgIdForUser(ctx.user.id)');
  });

  it("uses the active organization theme for Bundles administration download badges", () => {
    const bundlesAdminSource = readFileSync(new URL("../client/src/pages/admin/BundlesAdmin.tsx", import.meta.url), "utf8");
    expect(bundlesAdminSource).toContain('download: "bg-[color-mix(in_srgb,var(--org-primary)_12%,transparent)] text-[var(--org-primary)]"');
    expect(bundlesAdminSource).not.toContain('download: "bg-purple-100 text-purple-700"');
  });

  it("uses the active organization theme for General Form Builder template metadata", () => {
    const formBuilderSource = readFileSync(new URL("../client/src/pages/admin/GeneralFormBuilder.tsx", import.meta.url), "utf8");
    expect(formBuilderSource).toContain('Form Type", value: FORM_TYPES.find(t => t.value === template.formType)?.label ?? template.formType, color: "var(--org-primary)"');
    expect(formBuilderSource).not.toContain('Form Type", value: FORM_TYPES.find(t => t.value === template.formType)?.label ?? template.formType, color: "#7c3aed"');
  });

  it("uses the active organization theme for Form Responses brand and tier indicators", () => {
    const formResponsesSource = readFileSync(new URL("../client/src/components/FormResponsesTab.tsx", import.meta.url), "utf8");
    expect(formResponsesSource).toContain('const BRAND = "var(--org-primary)"');
    expect(formResponsesSource).toContain('tier: "Unacceptable", color: "var(--org-primary)"');
    expect(formResponsesSource).toContain('background ?? color + "18"');
    expect(formResponsesSource).not.toContain('return { tier: "Unacceptable", color: "#7c3aed", bg: "#faf5ff" }');
  });

  it("uses the active organization theme for Widget Manager quiz badges", () => {
    const widgetManagerSource = readFileSync(new URL("../client/src/pages/admin/WidgetManager.tsx", import.meta.url), "utf8");
    expect(widgetManagerSource).toContain('quiz:       { label: "Quiz",        emoji: "📝", color: "bg-[color-mix(in_srgb,var(--org-primary)_12%,transparent)] text-[var(--org-primary)]" }');
    expect(widgetManagerSource).not.toContain('quiz:       { label: "Quiz",        emoji: "📝", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300" }');
  });

  it("uses the active organization theme for Product Sales statistics and confirmation actions", () => {
    const productSalesTabSource = readFileSync(new URL("../client/src/components/ProductSalesTab.tsx", import.meta.url), "utf8");
    expect(productSalesTabSource).toContain('text-2xl font-bold text-[var(--org-primary)]');
    expect(productSalesTabSource).toContain('text-[var(--org-primary)] border-[color-mix(in_srgb,var(--org-primary)_35%,transparent)]');
    expect(productSalesTabSource).not.toContain('text-teal-700');
  });

  it("resolves Blueprint organization administration from the authorized active organization", () => {
    const blueprintRouterSource = readFileSync(new URL("./routers/blueprintRouter.ts", import.meta.url), "utf8");
    expect(blueprintRouterSource).toContain('async function resolveActiveBlueprintOrg');
    expect(blueprintRouterSource).toContain('await getOrgIdForUserWithFallback(ctx.user.id, ctx.user.role)');
    expect(blueprintRouterSource).toContain('await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId)');
    expect(blueprintRouterSource.match(/await resolveActiveBlueprintOrg\(ctx\)/g)).toHaveLength(6);
    expect(blueprintRouterSource).not.toContain('getOrgIdForUser(ctx.user.id)');
  });

  it("builds LMS Administration learner and preview links from the active organization domain", () => {
    const lmsAdminSource = readFileSync(new URL("../client/src/pages/admin/LMSAdmin.tsx", import.meta.url), "utf8");
    expect(lmsAdminSource).toContain('function useActiveOrgLearnerUrl(path: string)');
    expect(lmsAdminSource).toContain('return getOrgLearnUrl(path, activeOrg?.slug, activeOrg?.customDomain, activeOrg?.domainVerificationStatus);');
    expect(lmsAdminSource).toContain('const url = useActiveOrgLearnerUrl(path);');
    expect(lmsAdminSource).toContain('const previewUrl = useActiveOrgLearnerUrl(`/courses/${data.courseSlug}?open_preview=1`);');
    expect(lmsAdminSource).not.toContain('const url = `https://teachific.app/learn${path}`;');
    expect(lmsAdminSource).not.toContain('const previewUrl = `https://teachific.app/learn/courses/${data.courseSlug}?open_preview=1`;');
  });

  it("requires active-organization course ownership before cohort-group creation", () => {
    const cohortRouterSource = readFileSync(new URL("./routers/lmsCohortAdminRouter.ts", import.meta.url), "utf8");
    expect(cohortRouterSource).toContain('await assertCourseOwnership(ctx, courseId);');
    expect(cohortRouterSource).toContain('const [course] = await db.select({ orgId: lmsCourses.orgId }).from(lmsCourses).where(eq(lmsCourses.id, courseId)).limit(1);');
    expect(cohortRouterSource).toContain('orgId: course.orgId, courseId, name, slug, description,');
    expect(cohortRouterSource).not.toContain('const orgId = await getOrgIdForUser(ctx.user.id);');
  });

  it("scopes enrollment administration listings to the authorized active organization", () => {
    const enrollmentAdminRouterSource = readFileSync(new URL("./routers/lmsEnrollmentAdminRouter.ts", import.meta.url), "utf8");
    expect(enrollmentAdminRouterSource).toContain('const orgId = await requireActiveEnrollmentOrg(ctx.user.id, ctx.user.role);');
    expect(enrollmentAdminRouterSource).toContain('const orgCourseIds = await db.select({ id: lmsCourses.id }).from(lmsCourses).where(eq(lmsCourses.orgId, orgId));');
    expect(enrollmentAdminRouterSource).toContain('conditions.push(inArray(lmsEnrollments.courseId, ids));');
    expect(enrollmentAdminRouterSource).not.toContain('if (!isPlatformAdmin(ctx.user.role)) {\n        const orgId = await getOrgIdForUser(ctx.user.id);');
  });

  it("uses active-organization course authorization for legacy LMS section and lesson ownership", () => {
    const lmsHelpersSource = readFileSync(new URL("./routers/lmsHelpers.ts", import.meta.url), "utf8");
    expect(lmsHelpersSource).toContain('await assertCourseOwnership(ctx, section.courseId);');
    expect(lmsHelpersSource).toContain('await assertCourseOwnership(ctx, courseId);');
    expect(lmsHelpersSource).not.toContain('const isPlatformAdmin = (ADMIN_ROLES as readonly string[]).includes(ctx.user.role);\n  if (isPlatformAdmin) return;');
  });

  it("builds embedded checkout success and account setup links from the owning organization domain", () => {
    const embeddedCheckoutSource = readFileSync(new URL("./routers/embeddedCheckoutRouter.ts", import.meta.url), "utf8");
    expect(embeddedCheckoutSource.match(/const orgBaseUrl = getOrgBaseUrl\(organization\.slug, organization\.customDomain, organization\.domainVerificationStatus\);/g)).toHaveLength(2);
    expect(embeddedCheckoutSource).toContain('const setPasswordUrl = `${orgBaseUrl}/auth/reset-password?token=${result.resetToken}`;');
    expect(embeddedCheckoutSource).not.toContain('const brandMode = "aaus"');
    expect(embeddedCheckoutSource).not.toContain('https://app.iheartecho.net');
    expect(embeddedCheckoutSource).not.toContain('https://teachific.app');
  });

  it("builds inline Funnel checkout success and account setup links from the owning organization domain", () => {
    const funnelRouterSource = readFileSync(new URL("./routers/funnelRouter.ts", import.meta.url), "utf8");
    expect(funnelRouterSource).toContain('const orgBaseUrl = getOrgBaseUrl(organization.slug, organization.customDomain, organization.domainVerificationStatus);');
    expect(funnelRouterSource).toContain('const setPasswordUrl = `${orgBaseUrl}/auth/reset-password?token=${resetToken}`;');
    expect(funnelRouterSource).toContain('let loginUrl = `${orgBaseUrl}/my-courses`;');
    expect(funnelRouterSource).toContain('const successUrl = funnel.thankYouPageUrl || `${orgBaseUrl}/`;');
    expect(funnelRouterSource).not.toContain('const baseUrl = brandMode === "iheartecho" ? "https://app.iheartecho.net" : "https://teachific.app";');
  });

  it("does not fall back to the platform domain for Stripe course purchase confirmation links", () => {
    const stripeWebhookSource = readFileSync(new URL("./stripeWebhookRoutes.ts", import.meta.url), "utf8");
    expect(stripeWebhookSource).toContain('let courseOrgBase: string | null = null;');
    expect(stripeWebhookSource).toContain('if (courseOrgBase) {');
    expect(stripeWebhookSource).not.toContain('let courseOrgBase = "https://teachific.app";');
  });

  it("resolves digital download listing and creation from the active organization", () => {
    const downloadsRouterSource = readFileSync(new URL("./routers/downloadsRouter.ts", import.meta.url), "utf8");
    expect(downloadsRouterSource).toContain('const orgId = await assertAdmin(ctx);\n    return db.select().from(digitalProducts).where(eq(digitalProducts.orgId, orgId))');
    expect(downloadsRouterSource).toContain('const orgId = await assertAdmin(ctx);\n      const [result] = await db.insert(digitalProducts).values({');
    expect(downloadsRouterSource).not.toContain('const orgId = await getOrgIdForUser(ctx.user.id);');
  });

  it("requires active-organization ownership for core digital download management", () => {
    const downloadsRouterSource = readFileSync(new URL("./routers/downloadsRouter.ts", import.meta.url), "utf8");
    expect(downloadsRouterSource).toContain('async function assertProductAccess(ctx: any, productId: number)');
    expect(downloadsRouterSource).toContain('Digital product does not belong to the active organization');
    expect(downloadsRouterSource).toContain('const { db, product } = await assertProductAccess(ctx, input.id);');
    expect(downloadsRouterSource).toContain('const { db } = await assertProductAccess(ctx, input.productId);');
    expect(downloadsRouterSource).toContain('await assertProductAccess(ctx, file.productId);');
    expect(downloadsRouterSource).toContain('and(eq(digitalProductFiles.id, input.fileIds[i]), eq(digitalProductFiles.productId, input.productId))');
    expect(downloadsRouterSource).toContain('await Promise.all(input.products.map(({ id }) => assertProductAccess(ctx, id)));');
  });

  it("resolves digital download analytics and bundle creation from the active organization", () => {
    const downloadsRouterSource = readFileSync(new URL("./routers/downloadsRouter.ts", import.meta.url), "utf8");
    expect(downloadsRouterSource).toContain('const orgId = isPlatformAdmin(ctx.user.role) ? null : activeOrgId;');
    expect(downloadsRouterSource).toContain('await Promise.all(productIds.map((productId) => assertProductAccess(ctx, productId)));');
    expect(downloadsRouterSource).toContain('values({ ...bundleData, slug, orgId })');
  });

  it("requires active-organization ownership for digital download bundle updates and deletion", () => {
    const downloadsRouterSource = readFileSync(new URL("./routers/downloadsRouter.ts", import.meta.url), "utf8");
    expect(downloadsRouterSource).toContain('async function assertBundleAccess(ctx: any, bundleId: number)');
    expect(downloadsRouterSource).toContain('Digital bundle does not belong to the active organization');
    expect(downloadsRouterSource).toContain('await assertBundleAccess(ctx, id);');
    expect(downloadsRouterSource).toContain('const { db, bundle } = await assertBundleAccess(ctx, input.id);');
  });

  it("requires active-organization ownership before duplicating or granting access to digital downloads", () => {
    const downloadsRouterSource = readFileSync(new URL("./routers/downloadsRouter.ts", import.meta.url), "utf8");
    expect(downloadsRouterSource).toContain('const { db, product: src } = await assertProductAccess(ctx, input.id);');
    expect(downloadsRouterSource).toContain('const { db, bundle: src } = await assertBundleAccess(ctx, input.id);');
    expect(downloadsRouterSource).toContain('await assertProductAccess(ctx, input.productId);');
    expect(downloadsRouterSource).toContain('await assertBundleAccess(ctx, input.bundleId);');
  });

  it("sends embedded checkout confirmation links only when the owning organization domain is available", () => {
    const embeddedCheckoutSource = readFileSync(new URL("./embeddedCheckoutWebhook.ts", import.meta.url), "utf8");
    expect(embeddedCheckoutSource).toContain('if (orgBase) {');
    expect(embeddedCheckoutSource).toContain('Confirmation email skipped for purchase ${purchase.id}: organization domain unavailable');
    expect(embeddedCheckoutSource).not.toContain('const fallbackBase = orgBase ?? "https://teachific.app";');
  });

  it("resolves widget administration from the active organization rather than a fallback membership", () => {
    const widgetRouterSource = readFileSync(new URL("./routers/widgetAdminRouter.ts", import.meta.url), "utf8");
    const widgetManagerSource = readFileSync(new URL("../client/src/pages/admin/WidgetManager.tsx", import.meta.url), "utf8");
    expect(widgetRouterSource).toContain("const widgetOrgInputSchema = z.object({ orgId: z.number().int().positive() });");
    expect(widgetRouterSource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);");
    expect(widgetRouterSource).not.toContain("getOrgIdForUserWithFallback");
    expect(widgetManagerSource).toContain("const { orgId } = useOrgScope();");
    expect(widgetManagerSource).toContain("trpc.widgetAdmin.list.useQuery(widgetOrgInput");
    expect(widgetManagerSource).toContain("regenMutation.mutate({ id: w.id, orgId });");
  });

  it("resolves landing-block picker content from the active organization", () => {
    const lmsAdminSource = readFileSync(new URL("./routers/lmsAdminRouter.ts", import.meta.url), "utf8");
    const bundleBuilderSource = readFileSync(new URL("../client/src/pages/admin/BundleLandingPageBuilder.tsx", import.meta.url), "utf8");
    const funnelBuilderSource = readFileSync(new URL("../client/src/pages/admin/FunnelPageEditor.tsx", import.meta.url), "utf8");
    const landingBuilderSource = readFileSync(new URL("../client/src/pages/lms/LandingPageBuilder.tsx", import.meta.url), "utf8");
    expect(lmsAdminSource).toContain("async function resolveActiveAdminOrg");
    expect(lmsAdminSource).toContain("await resolveActiveAdminOrg(ctx, input?.orgId);");
    expect(bundleBuilderSource).toContain("const { orgId } = useOrgScope();");
    expect(bundleBuilderSource).toContain("getDownloadsWithLandingBlocks.useQuery(landingBlockOrgInput");
    expect(funnelBuilderSource).toContain("getProductsWithLandingBlocks.useQuery(landingBlockOrgInput");
    expect(landingBuilderSource).toContain("getCoursesWithLandingBlocks.useQuery(\n    landingBlockOrgInput");
  });

  it("uses an active organization only for authorized organization administrators", () => {
    const dbSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
    const fallbackSource = dbSource.slice(
      dbSource.indexOf("export async function getOrgIdForUserWithFallback"),
      dbSource.indexOf("export async function requireOrgAdmin")
    );
    expect(fallbackSource).toContain("Organization administrators can use a selected organization only when they");
    expect(fallbackSource).toContain("eq(orgMembers.orgId, activeRow.orgId)");
    expect(fallbackSource).toContain('["org_super_admin", "org_admin", "sub_admin"]');
    expect(fallbackSource).toContain("const orgId = await getOrgIdForUser(userId);");
  });

  it("requires organization-admin ownership before listing or revoking linked organizations", () => {
    const routersSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
    const linksSource = routersSource.slice(
      routersSource.indexOf("link: router({"),
      routersSource.indexOf("// ── Content Packages")
    );
    expect(linksSource).toContain("Organization administrator access is required to view linked organizations");
    expect(linksSource).toContain("Organization administrator access is required to revoke this link");
    expect(linksSource).toContain("getOrgMember(link.primaryOrgId, ctx.user.id)");
    expect(linksSource).toContain("getOrgMember(link.linkedOrgId, ctx.user.id)");
  });

  it("requires organization-admin ownership for legacy LMS certificates and certificate templates", () => {
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const certificatesSource = routerSource.slice(
      routerSource.indexOf("certificates: router({"),
      routerSource.indexOf("// ── Certificate Templates")
    );
    const templatesSource = routerSource.slice(
      routerSource.indexOf("certificateTemplates: router({"),
      routerSource.indexOf("// ── Webinars")
    );
    expect(certificatesSource).toContain("Course does not belong to the requested organization");
    expect((certificatesSource.match(/await requireOrgAdmin\(ctx\.user\.id, ctx\.user\.role, orgId\);/g) ?? []).length).toBe(2);
    expect(templatesSource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, template.orgId);");
    expect(templatesSource).toContain("Certificate template does not belong to the requested organization");
    expect(templatesSource).toContain("org-${orgId}/certificate-assets/");
  });

  it("requires organization-admin ownership for legacy LMS category and group administration", () => {
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const categorySource = routerSource.slice(
      routerSource.indexOf("categories: router({"),
      routerSource.indexOf("// ── Groups")
    );
    const groupSource = routerSource.slice(
      routerSource.indexOf("groups: router({"),
      routerSource.indexOf("// ── Cohorts")
    );
    expect(categorySource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, category.orgId);");
    expect(groupSource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, group.orgId);");
    expect(groupSource).toContain("Group does not belong to the requested organization");
    expect(groupSource).toContain("Group and course must belong to the requested organization");
  });

  it("requires organization-admin ownership for legacy LMS discussions and assignments and user ownership for notes and bookmarks", () => {
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const discussionsSource = routerSource.slice(
      routerSource.indexOf("discussions: router({"),
      routerSource.indexOf("// ── Assignments")
    );
    const assignmentsSource = routerSource.slice(
      routerSource.indexOf("assignments: router({"),
      routerSource.indexOf("// ── Notes")
    );
    const notesSource = routerSource.slice(
      routerSource.indexOf("notes: router({"),
      routerSource.indexOf("// ── Bookmarks")
    );
    const bookmarksSource = routerSource.slice(
      routerSource.indexOf("bookmarks: router({"),
      routerSource.indexOf("// ── Dashboard")
    );
    expect(discussionsSource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, discussion.orgId);");
    expect(assignmentsSource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, assignment.orgId);");
    expect(notesSource).toContain("You can only update your own notes");
    expect(notesSource).toContain("You can only delete your own notes");
    expect(bookmarksSource).toContain("You can only delete your own bookmarks");
  });

  it("requires organization-admin ownership for legacy LMS dashboard analytics", () => {
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const dashboardSource = routerSource.slice(
      routerSource.indexOf("dashboard: router({"),
      routerSource.indexOf("// ── Analytics")
    );
    expect((dashboardSource.match(/await requireOrgAdmin\(ctx\.user\.id, ctx\.user\.role, orgId\);/g) ?? []).length).toBe(4);
  });

  it("requires organization-admin ownership for legacy LMS analytics, activity reporting, and coupon administration", () => {
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const lmsDbSource = readFileSync(new URL("./lmsDb.ts", import.meta.url), "utf8");
    const analyticsSource = routerSource.slice(
      routerSource.indexOf("analytics: router({"),
      routerSource.indexOf("// ── Activity")
    );
    const activitySource = routerSource.slice(
      routerSource.indexOf("activity: router({"),
      routerSource.indexOf("// ── Coupons")
    );
    const couponSource = routerSource.slice(
      routerSource.indexOf("coupons: router({"),
      routerSource.indexOf("// ── Notifications")
    );
    expect((analyticsSource.match(/await requireOrgAdmin\(ctx\.user\.id, ctx\.user\.role, orgId\);/g) ?? []).length).toBe(3);
    expect(activitySource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);");
    expect(couponSource).toContain("Coupon does not belong to the requested organization");
    expect(lmsDbSource).toContain("export async function getCouponById");
  });

  it("requires organization-admin ownership for legacy LMS notifications, revenue partners, and course orders", () => {
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const notificationsSource = routerSource.slice(
      routerSource.indexOf("notifications: router({"),
      routerSource.indexOf("// ── Revenue Partners")
    );
    const partnersSource = routerSource.slice(
      routerSource.indexOf("revenuePartners: router({"),
      routerSource.indexOf("// ── Course Orders")
    );
    const ordersSource = routerSource.slice(
      routerSource.indexOf("courseOrders: router({"),
      routerSource.indexOf("// ── Memberships")
    );
    expect((notificationsSource.match(/await requireOrgAdmin\(ctx\.user\.id, ctx\.user\.role, orgId\);/g) ?? []).length).toBe(2);
    expect(partnersSource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, partner.orgId);");
    expect(ordersSource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, order.orgId);");
    expect(ordersSource).toContain("delete data.orgId;");
  });

  it("requires organization-admin ownership for high-impact mounted legacy LMS course administration", () => {
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const courseSource = routerSource.slice(
      routerSource.indexOf("courses: router({"),
      routerSource.indexOf("// ── Curriculum")
    );
    expect(routerSource).toContain("async function requireLegacyCourseAccess");
    expect(courseSource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, orgId);");
    expect((courseSource.match(/await requireLegacyCourseAccess\(ctx, input\.id\);/g) ?? []).length).toBe(2);
    expect(courseSource).toContain("const course = await requireLegacyCourseAccess(ctx, id);");
    expect(courseSource).toContain("input.courseIds.map((courseId) => requireLegacyCourseAccess(ctx, courseId))");
  });

  it("requires organization-admin ownership throughout mounted legacy LMS curriculum authoring", () => {
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const curriculumSource = routerSource.slice(
      routerSource.indexOf("curriculum: router({"),
      routerSource.indexOf("// ── Pricing")
    );
    const dbSource = readFileSync(new URL("./lmsDb.ts", import.meta.url), "utf8");
    expect(routerSource).toContain("async function requireLegacySectionAccess");
    expect(routerSource).toContain("async function requireLegacyLessonAccess");
    expect(curriculumSource).toContain("await requireLegacyCourseAccess(ctx, input.courseId);");
    expect((curriculumSource.match(/await requireLegacySectionAccess\(ctx,/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect((curriculumSource.match(/await requireLegacyLessonAccess\(ctx,/g) ?? []).length).toBeGreaterThanOrEqual(3);
    expect(curriculumSource).toContain("input.lessonIds.map((lessonId) => requireLegacyLessonAccess(ctx, lessonId))");
    expect(dbSource).toContain("export async function getCourseIdBySectionId");
  });

  it("requires organization-admin ownership while preserving dollar-priced legacy LMS pricing administration", () => {
    const routerSource = readFileSync(new URL("./lmsRouter.ts", import.meta.url), "utf8");
    const pricingSource = routerSource.slice(
      routerSource.indexOf("pricing: router({"),
      routerSource.indexOf("// ── Enrollments")
    );
    const dbSource = readFileSync(new URL("./lmsDb.ts", import.meta.url), "utf8");
    expect(routerSource).toContain("async function requireLegacyPricingAccess");
    expect((pricingSource.match(/await requireLegacyCourseAccess\(ctx, input\.courseId\);/g) ?? []).length).toBe(2);
    expect(pricingSource).toContain("await requireLegacyPricingAccess(ctx, input.id);");
    expect(pricingSource).toContain("await requireLegacyPricingAccess(ctx, id);");
    expect(pricingSource).not.toMatch(/price\s*\/\s*100|price\s*\*\s*100/);
    expect(dbSource).toContain("export async function getCourseIdByPricingId");
  });

  it("uses generic non-legacy metadata in learner cohort calendar exports", () => {
    const cohortScheduleSource = readFileSync(new URL("../client/src/pages/CohortSchedule.tsx", import.meta.url), "utf8");
    expect(cohortScheduleSource).toContain('"PRODID:-//Learning Calendar//Cohort//EN"');
    expect(cohortScheduleSource).toContain("UID:cohort-session-${s.id}");
    expect(cohortScheduleSource).not.toContain("UltrasoundAssist");
  });

  it("routes public workshop waitlist notifications through the owning organization sender", () => {
    const workshopRouterSource = readFileSync(new URL("./routers/workshopRouter.ts", import.meta.url), "utf8");
    const waitlistSource = workshopRouterSource.slice(workshopRouterSource.indexOf("export const workshopWaitlistRouter"));
    expect(waitlistSource).toContain("sendEmailViaOrg");
    expect(waitlistSource).toContain("ownerId: organizations.ownerId");
    expect(waitlistSource).toContain("workshop.orgId");
    expect(waitlistSource).not.toContain("admin@teachific.app");
  });

  it("requires active workshop organization ownership for instance landing page reads and saves", () => {
    const workshopRouterSource = readFileSync(new URL("./routers/workshopRouter.ts", import.meta.url), "utf8");
    const landingSource = workshopRouterSource.slice(
      workshopRouterSource.indexOf("getInstanceLandingBlocks: protectedProcedure"),
      workshopRouterSource.indexOf("/** List pricing options")
    );
    expect((landingSource.match(/await requireActiveWorkshopAdmin\(ctx\.user\.id, ctx\.user\.role, inst\.workshopId\);/g) ?? []).length).toBe(2);
    expect(landingSource).toContain("if (!inst) throw new TRPCError({ code: \"NOT_FOUND\" });");
  });

  it("requires active workshop organization ownership before listing pricing options", () => {
    const workshopRouterSource = readFileSync(new URL("./routers/workshopRouter.ts", import.meta.url), "utf8");
    const pricingSource = workshopRouterSource.slice(workshopRouterSource.indexOf("listPricingOptions: protectedProcedure"));
    expect(pricingSource).toContain("await requireActiveWorkshopAdmin(ctx.user.id, ctx.user.role, input.workshopId);");
    expect(pricingSource).not.toContain('ctx.user.role !== "admin"');
  });

  it("uses only organization-resolved library links in bundle confirmation emails", () => {
    const webhookSource = readFileSync(new URL("./stripeWebhookRoutes.ts", import.meta.url), "utf8");
    expect(webhookSource).toContain("if (bundleOrg?.slug)");
    expect(webhookSource).toContain("getOrgBaseUrl(bundleOrg.slug");
    expect(webhookSource).not.toContain("https://teachific.app/my-library");
  });

  it("resolves organization-owned enrollment and access email links from organization ID", () => {
    const enrollmentEmailSource = readFileSync(new URL("./lib/enrollmentEmail.ts", import.meta.url), "utf8");
    expect(enrollmentEmailSource).toContain("async function resolveOrganizationBaseUrl");
    expect(enrollmentEmailSource).toContain("const organization = await getOrgById(opts.orgId);");
    expect((enrollmentEmailSource.match(/const orgBase = await resolveOrganizationBaseUrl\(opts\);/g) ?? []).length).toBe(4);
    expect((enrollmentEmailSource.match(/if \(!orgBase\) return false;/g) ?? []).length).toBe(4);
  });

  it("requires organization-admin ownership for certificate template administration", () => {
    const certificateRouterSource = readFileSync(new URL("./routers/lmsAdminRouter.ts", import.meta.url), "utf8");
    const certificateSource = certificateRouterSource.slice(certificateRouterSource.indexOf("const _lmsCertificateTemplatesRouter"));
    expect((certificateSource.match(/await requireOrgAdmin\(ctx\.user\.id, ctx\.user\.role, template\.orgId\);/g) ?? []).length).toBe(3);
    expect(certificateSource).toContain("await resolveActiveAdminOrg(ctx, input?.orgId);");
  });

  it("requires active organization ownership across webinar administration", () => {
    const webinarRouterSource = readFileSync(new URL("./routers/webinarAdminRouter.ts", import.meta.url), "utf8");
    expect(webinarRouterSource).toContain("async function requireActiveWebinarAdmin");
    expect((webinarRouterSource.match(/await requireActiveWebinarAdmin\(ctx\.user\.id, ctx\.user\.role, input\.webinarId\);/g) ?? []).length).toBeGreaterThanOrEqual(10);
  });

  it("resolves the active organization before authorizing digital download administration", () => {
    const downloadsRouterSource = readFileSync(new URL("./routers/downloadsRouter.ts", import.meta.url), "utf8");
    expect(downloadsRouterSource).toContain("getOrgIdForUserWithFallback(ctx.user!.id, ctx.user!.role)");
    expect(downloadsRouterSource).toContain("requireOrgAdmin(ctx.user!.id, ctx.user!.role, orgId)");
  });

  it("aligns order bump listing and creation with organization-owned schema fields", () => {
    const orderBumpRouterSource = readFileSync(new URL("./routers/orderBumpsRouter.ts", import.meta.url), "utf8");
    expect(orderBumpRouterSource).toContain("eq(orderBumps.orgId, orgId)");
    expect(orderBumpRouterSource).toContain("triggerProductType: input.triggerProductType");
    expect(orderBumpRouterSource).toContain("bumpProductType: input.bumpProductType");
    expect(orderBumpRouterSource).toContain("and(eq(orderBumps.id, id), eq(orderBumps.orgId, orgId))");
    expect(orderBumpRouterSource).toContain("and(eq(orderBumps.id, input.id), eq(orderBumps.orgId, orgId))");
    expect(orderBumpRouterSource).toContain('triggerProductType: z.enum(["course", "quiz", "download"]).optional()');
    expect(orderBumpRouterSource).toContain('placement: z.enum(["before_checkout", "during_checkout", "after_checkout"]).optional()');
    expect(orderBumpRouterSource).toContain("eq(orderBumps.orgId, triggerProduct.orgId)");
    expect(orderBumpRouterSource).toContain("eq(orderBumps.triggerProductType, input.triggerType)");
    expect(orderBumpRouterSource).toContain("discountedPrice: z.string().nullable().optional()");
    expect(orderBumpRouterSource).toContain("landingPageJson: z.any().nullable().optional()");
    const orderBumpCheckoutSource = readFileSync(new URL("./lib/orderBumpCheckout.ts", import.meta.url), "utf8");
    expect(orderBumpCheckoutSource).toContain("eq(orderBumps.triggerProductType, input.triggerType)");
    expect(orderBumpCheckoutSource).toContain("eq(orderBumps.placement, \"before_checkout\")");
    expect(orderBumpCheckoutSource).toContain("orgId: bump.orgId");
    expect(orderBumpCheckoutSource).toContain("accepted: true");
    expect(orderBumpRouterSource).toContain("impressions: null");
    expect(orderBumpRouterSource).toContain("conversionRate: null");
    expect(orderBumpRouterSource).toContain("accepted: true,");
    const cmeDisclosureSource = readFileSync(new URL("./routers/cmeDisclosureRouter.ts", import.meta.url), "utf8");
    expect(cmeDisclosureSource).toContain('message: "Course not found in this organization."');
    expect(cmeDisclosureSource).toContain("const baseUrl = getOrgBaseUrl(");
    expect(cmeDisclosureSource).not.toContain("const baseUrl = input.origin || getOrgBaseUrl(");
    const newsletterSource = readFileSync(new URL("./routers/newsletterRouter.ts", import.meta.url), "utf8");
    expect(newsletterSource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, input?.orgId)");
    expect(newsletterSource).toContain("await requireOrgAdmin(ctx.user.id, ctx.user.role, subscriber.orgId)");
    const cohortAdminSource = readFileSync(new URL("./routers/lmsCohortAdminRouter.ts", import.meta.url), "utf8");
    expect(cohortAdminSource).toContain("await assertCourseOwnership(ctx, input.courseId);");
    expect(cohortAdminSource).toContain("await assertCohortSessionOwnership(ctx, input.id);");
    expect(cohortAdminSource).toContain("await assertCohortAssignmentOwnership(ctx, input.id);");
    expect(cohortAdminSource).toContain("getOrgBaseUrl(org.slug, org.customDomain, org.domainVerificationStatus)");
    expect(cohortAdminSource).not.toContain("https://members.teachific.com/cohort/");
    const contentAvailabilitySource = readFileSync(new URL("./routers/contentAvailabilityRouter.ts", import.meta.url), "utf8");
    expect(contentAvailabilitySource).toContain("sendEmailViaOrg({");
    expect(contentAvailabilitySource).toContain("}, target.orgId);");
    const bundleRouterSource = readFileSync(new URL("./routers/bundleRouter.ts", import.meta.url), "utf8");
    expect(bundleRouterSource).toContain("const price = selectedOption.price ?? 0;");
    expect(bundleRouterSource).not.toContain("selectedOption.price / 100");
    expect(bundleRouterSource).toContain("getOrgBaseUrl(org.slug, org.customDomain, org.domainVerificationStatus)");
    const mediaUploadSource = readFileSync(new URL("./mediaUploadRoutes.ts", import.meta.url), "utf8");
    expect(mediaUploadSource).toContain("await requireOrgAdmin(user.id, (user as any).role ?? \"user\", orgId);");
    const aiSourceFileSource = readFileSync(new URL("./lib/aiSourceFile.ts", import.meta.url), "utf8");
    expect(aiSourceFileSource).toContain("AI_SOURCE_FILE_MAX_BYTES = 50 * 1024 * 1024");
    expect(aiSourceFileSource).toContain("application/pdf");
    expect(aiSourceFileSource).toContain("buildAiSourceMessage");
    const aiSourceReviewSource = readFileSync(new URL("../client/src/components/AiSourceFileReview.tsx", import.meta.url), "utf8");
    expect(aiSourceReviewSource).toContain("var(--org-primary)");
    expect(aiSourceReviewSource).toContain("application/pdf,image/jpeg,image/png,image/webp");
    const aiSourceUploadRoute = readFileSync(new URL("./routes/uploadAiGenerationSource.ts", import.meta.url), "utf8");
    expect(aiSourceUploadRoute).toContain("await requireOrgAdmin(user.id, (user as any).role ?? \"user\", orgId);");
    expect(aiSourceUploadRoute).toContain("ai-generation-sources/${orgId}/${user.id}");
    const courseBuilderSource = readFileSync(new URL("./routers/lmsCourseBuilderRouter.ts", import.meta.url), "utf8");
    expect(courseBuilderSource).toContain("buildAiSourceMessage(userPrompt, sourceFiles)");
    expect(courseBuilderSource).toContain("ai-generation-sources/${course?.orgId}/${ctx.user.id}");
    const courseBuilderPageSource = readFileSync(new URL("../client/src/pages/lms/CourseBuilderPage.tsx", import.meta.url), "utf8");
    expect(courseBuilderPageSource).toContain("function QuestionBankAdmin() {");
    expect(courseBuilderPageSource).toContain("const { orgId } = useOrgScope();");
    expect(courseBuilderPageSource).toContain('fetch("/api/upload-ai-generation-source"');
    expect(courseBuilderPageSource).toContain("description=\"Add organization-authorized PDFs or images to ground the generated questions.\"");
    expect(courseBuilderPageSource).toContain("sourceFiles: aiSourceFiles.map(({ url, mimeType }) => ({ url, mimeType }))");
  });
});
