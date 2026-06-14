import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import DashboardLayout from "@/components/DashboardLayout";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { UploadQueueProvider } from "./contexts/UploadQueueContext";
import { UploadQueuePanel } from "./components/UploadQueuePanel";
import { getSubdomain } from "./hooks/useSubdomain";
import { SubdomainThemeProvider } from "./components/SubdomainThemeProvider";


import Dashboard from "./pages/Dashboard";
import FilesPage from "./pages/FilesPage";
import UploadPage from "./pages/UploadPage";
import MediaLibraryPage from "./pages/MediaLibraryPage";
import QuestionBankPage from "./pages/QuestionBankPage";
import QuestionBankImportPage from "./pages/QuestionBankImportPage";
import OrgAnalyticsPage from "./pages/analytics/OrgAnalyticsPage";
import FileDetailPage from "./pages/FileDetailPage";
import PlayerPage from "./pages/PlayerPage";
import EmbedPage from "./pages/EmbedPage";
import QuizzesPage from "./pages/QuizzesPage";
import QuizBuilderPage from "./pages/QuizBuilderPage";
import QuizPlayerPage from "./pages/QuizPlayerPage";
import QuizResultsPage from "./pages/QuizResultsPage";
import AnalyticsPage from "./pages/AnalyticsPage";
import AdminOrgsPage from "./pages/admin/AdminOrgsPage";
import AdminUsersPage from "./pages/admin/AdminUsersPage";
import AdminPermissionsPage from "./pages/admin/AdminPermissionsPage";
import AdminSettingsPage from "./pages/admin/AdminSettingsPage";
import PlatformAdminPage from "./pages/admin/PlatformAdminPage";

import CoursesPage from "./pages/lms/CoursesPage";
import CourseBuilderPage from "./pages/lms/CourseBuilderPage";
import CourseEditorPage from "./pages/lms/CourseEditorPage";
import BrandingPage from "./pages/lms/BrandingPage";
import MembersPage from "./pages/lms/MembersPage";
import LmsAnalyticsPage from "./pages/lms/LmsAnalyticsPage";
import PageBuilderPage from "./pages/lms/PageBuilderPage";
import SchoolPage from "./pages/lms/SchoolPage";
import OrgLandingPage from "./pages/lms/OrgLandingPage";
import SchoolMyCoursesPage from "./pages/lms/SchoolMyCoursesPage";
import FormsPage from "./pages/lms/FormsPage";
import FormBuilderPage from "./pages/lms/FormBuilderPage";
import FormResponsesPage from "./pages/lms/FormResponsesPage";
import FormAnalyticsPage from "./pages/lms/FormAnalyticsPage";
import FormPlayerPage from "./pages/FormPlayerPage";
import CourseSalesPage from "./pages/lms/CourseSalesPage";
import CoursePlayerPage from "./pages/lms/CoursePlayerPage";
import CourseLanding from "./pages/lms/CourseLanding";
import CoursePlayer from "./pages/lms/CoursePlayer";
import CourseOverviewPage from "./pages/lms/CourseOverviewPage";
import OrgPoliciesPage from "./pages/OrgPoliciesPage";
import CustomPagesPage from "./pages/admin/CustomPagesPage";
import DigitalProductsPage from "./pages/admin/DigitalProductsPage";
import DigitalProductEditorPage from "./pages/admin/DigitalProductEditorPage";
import DigitalProductSalesPage from "./pages/DigitalProductSalesPage";
import DigitalDownloadsReportsPage from "./pages/admin/DigitalDownloadsReportsPage";
import DigitalDownloadsAdminPage from "./pages/lms/DigitalDownloadsAdminPage";
import WebinarsPage from "./pages/admin/WebinarsPage";
import WebinarEditorPage from "./pages/admin/WebinarEditorPage";
import WebinarReportsPage from "./pages/admin/WebinarReportsPage";
import WebinarRegisterPage from "./pages/WebinarRegisterPage";
import WebinarWatchPage from "./pages/WebinarWatchPage";
import OrgSettingsPage from "./pages/OrgSettingsPage";
import StudentLogReportsPage from "./pages/lms/StudentLogReportsPage";
import LmsDashboardPage from "./pages/lms/LmsDashboardPage";
import MyCoursesPage from "./pages/lms/MyCoursesPage";
import MyCertificatesPage from "./pages/lms/MyCertificatesPage";
import EmailMarketingPage from "./pages/lms/EmailMarketingPage";
import PublicPagePage from "./pages/PublicPagePage";

import GroupsPage from "./pages/members/GroupsPage";
import GroupManagerPortalPage from "./pages/members/GroupManagerPortalPage";
import MemberCertificatesPage from "./pages/members/MemberCertificatesPage";
import DiscussionsPage from "./pages/members/DiscussionsPage";
import AssignmentsPage from "./pages/members/AssignmentsPage";

import MembershipsPage from "./pages/products/MembershipsPage";
import MembershipEditorPage from "./pages/products/MembershipEditorPage";
import BundlesPage from "./pages/products/BundlesPage";
import CommunityPage from "./pages/products/CommunityPage";
import CommunityLearnerPage from "./pages/lms/CommunityLearnerPage";
import CommunityManagePage from "./pages/products/CommunityManagePage";
import CategoriesPage from "./pages/products/CategoriesPage";
import RecordPage from "./pages/RecordPage";

import WebsitePage from "./pages/marketing/WebsitePage";
import EmailCampaignsPage from "./pages/marketing/EmailCampaignsPage";
import FunnelsPage from "./pages/marketing/FunnelsPage";
import FunnelBuilderPage from "./pages/marketing/FunnelBuilderPage";
import FunnelBuilder from "./pages/marketing/FunnelBuilder";
import CohortSchedule from "./pages/CohortSchedule";
import AssignmentDetail from "./pages/AssignmentDetail";
import FunnelPageEditor from "./pages/marketing/FunnelPageEditor";
import AffiliatesPage from "./pages/marketing/AffiliatesPage";
import WidgetsPage from "./pages/marketing/WidgetsPage";
import LandingPageBuilder from "./pages/lms/LandingPageBuilder";
import DownloadLandingPageBuilder from "./pages/admin/DownloadLandingPageBuilder";
import ProductLandingPageBuilder from "./pages/admin/ProductLandingPageBuilder";
import EmailCampaignEditor from "./pages/EmailCampaignEditor";

// Sales section
import OrdersPage from "./pages/sales/OrdersPage";
import SubscriptionsPage from "./pages/sales/SubscriptionsPage";
import GroupOrdersPage from "./pages/sales/GroupOrdersPage";
import CouponsPage from "./pages/sales/CouponsPage";
import InvoicesPage from "./pages/sales/InvoicesPage";
import RevenuePartnersPage from "./pages/sales/RevenuePartnersPage";
import OrderBumpsPage from "./pages/sales/OrderBumpsPage";
import OrderBumpEditorPage from "./pages/sales/OrderBumpEditorPage";

// Analytics section
import RevenueAnalyticsPage from "./pages/analytics/RevenueAnalyticsPage";
import EngagementAnalyticsPage from "./pages/analytics/EngagementAnalyticsPage";
import MarketingAnalyticsPage from "./pages/analytics/MarketingAnalyticsPage";
import CustomReportsPage from "./pages/analytics/CustomReportsPage";

// Integrations section
import IntegrationsPage from "./pages/integrations/IntegrationsPage";
import ApiPage from "./pages/integrations/ApiPage";
import WebhooksPage from "./pages/integrations/WebhooksPage";

// Profile section
import ProfilePage from "./pages/profile/ProfilePage";
import BillingPage from "./pages/profile/BillingPage";

import LandingPage from "./pages/LandingPage";
import SupportPage from "./pages/SupportPage";
import PlatformPoliciesPage from "./pages/PlatformPoliciesPage";
import HelpPage from "./pages/HelpPage";
import UnsubscribePage from "./pages/UnsubscribePage";

import QuizCreatorPage from "./pages/QuizCreatorPage";
import PublicQuizPlayerPage from "./pages/PublicQuizPlayerPage";
import QuizCreatorGate from "./pages/QuizCreatorGate";
import QuizCreatorDashboard from "./pages/QuizCreatorDashboard";
import QuizCreatorLandingPage from "./pages/QuizCreatorLandingPage";
import StudioDashboard from "./pages/StudioDashboard";
import StudioLandingPage from "./pages/StudioLandingPage";
import CreatorDashboardPage from "./pages/CreatorDashboardPage";
import CreatorEditorPage from "./pages/CreatorEditorPage";
import CreatorLandingPage from "./pages/CreatorLandingPage";
import DesktopDownloadPage from "./pages/DesktopDownloadPage";

import ThankYouPage from "./pages/ThankYouPage";
import HostedCheckoutPage from "./pages/lms/HostedCheckoutPage";
import CheckoutCompletePage from "./pages/lms/CheckoutCompletePage";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import ForgotPasswordPage from "./pages/auth/ForgotPasswordPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import VerifyEmailPage from "./pages/auth/VerifyEmailPage";



const AUTH_PATHS = ["/login", "/register", "/forgot-password", "/reset-password", "/verify-email"];

// Bare routes — no admin sidebar (share links, embeds, auth pages, student player)
function BareRouter() {
  return (
      <Switch>
        <Route path="/embed/:id" component={EmbedPage} />
        <Route path="/learn/:courseId/overview" component={CourseOverviewPage} />
        <Route path="/learn/:courseId" component={CoursePlayerPage} />
        <Route path="/learn/:courseId/lesson/:lessonId" component={CoursePlayerPage} />
        <Route path="/p/:slug" component={PublicPagePage} />
        <Route path="/webinar/:slug/register" component={WebinarRegisterPage} />
        <Route path="/webinar/:slug/watch" component={WebinarWatchPage} />
        <Route path="/shop/:slug" component={DigitalProductSalesPage} />
        <Route path="/checkout/complete" component={CheckoutCompletePage} />
        <Route path="/checkout/:contentType/:slug" component={HostedCheckoutPage} />
        <Route path="/forms/:orgSlug/:slug" component={FormPlayerPage} />
        <Route path="/forms/:slug" component={FormPlayerPage} />
        <Route path="/school">{() => <SchoolPage />}</Route>
        <Route path="/school/:orgSlug">{() => <SchoolPage />}</Route>
        <Route path="/school/courses/:courseId/thank-you" component={ThankYouPage} />
        <Route path="/school/:orgSlug/courses/:courseId/thank-you" component={ThankYouPage} />
        <Route path="/school/courses/:courseId" component={CourseSalesPage} />
        <Route path="/school/:orgSlug/courses/:courseId" component={CourseSalesPage} />
        {/* Member portal routes — require auth, show member sidebar */}
        <Route path="/school/:orgSlug/my-courses" component={SchoolMyCoursesPage} />
        <Route path="/school/my-courses" component={SchoolMyCoursesPage} />
        <Route path="/community/:hubId" component={CommunityLearnerPage} />
        {/* Cohort learner routes */}
        <Route path="/cohort/:courseId/assignment/:assignmentId" component={AssignmentDetail} />
        <Route path="/cohort/:courseId" component={CohortSchedule} />
        {/* Platform-level legal policies — independent of any org */}
        <Route path="/help" component={HelpPage} />
        <Route path="/unsubscribe" component={UnsubscribePage} />
        <Route path="/policies" component={PlatformPoliciesPage} />
        <Route path="/terms" component={PlatformPoliciesPage} />
        <Route path="/privacy" component={PlatformPoliciesPage} />
        {/* Org-specific policies */}
        <Route path="/policies/:orgSlug" component={OrgPoliciesPage} />
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route path="/verify-email" component={VerifyEmailPage} />
        {/* Marketing landing page — shown to logged-out visitors at root */}
        <Route path="/" component={LandingPage} />
        {/* Support page — publicly accessible */}
        <Route path="/support" component={SupportPage} />
        {/* Standalone Quiz Creator — gated by role */}
        <Route path="/quiz-creator" component={QuizCreatorGate} />
        {/* QuizMaker standalone app for users without LMS access */}
        <Route path="/quiz-creator-app/download">{() => <DesktopDownloadPage app="quizCreator" />}</Route>
        <Route path="/quiz-creator-app" component={QuizCreatorDashboard} />
        {/* QuizMaker sales/marketing page */}
        <Route path="/quiz-creator-pro" component={QuizCreatorLandingPage} />
        {/* Teachific Studio standalone dashboard */}
        <Route path="/studio/download">{() => <DesktopDownloadPage app="studio" />}</Route>
        <Route path="/studio" component={StudioDashboard} />
        {/* Teachific Studio sales/marketing page */}
        <Route path="/studio-pro" component={StudioLandingPage} />
        {/* TeachificCreator™ — eLearning authoring tool */}
        <Route path="/creator-pro" component={CreatorLandingPage} />
        <Route path="/creator/download">{() => <DesktopDownloadPage app="creator" />}</Route>
        <Route path="/creator" component={CreatorDashboardPage} />
        <Route path="/creator/:projectId" component={CreatorEditorPage} />
        {/* Public quiz player — no auth required */}
        <Route path="/school/:orgSlug/quiz/:shareToken" component={PublicQuizPlayerPage} />
        <Route path="/quiz/:shareToken" component={PublicQuizPlayerPage} />
      </Switch>
  );
}

// Admin shell routes — wrapped in DashboardLayout
function AdminRouter() {
  return (
    <DashboardLayout>
        <Switch>
          {/* Root → Dashboard */}
          {/* Root is handled by BareRouter (LandingPage redirects logged-in users to /lms) */}

          {/* Dashboard */}
          <Route path="/lms" component={LmsDashboardPage} />
          <Route path="/lms/dashboard" component={LmsDashboardPage} />

          {/* ── Members ── */}
          <Route path="/members/users" component={MembersPage} />
          <Route path="/members/groups" component={GroupsPage} />
          <Route path="/members/group-manager" component={GroupManagerPortalPage} />
          <Route path="/members/certificates" component={MemberCertificatesPage} />
          <Route path="/members/discussions" component={DiscussionsPage} />
          <Route path="/members/assignments" component={AssignmentsPage} />
          {/* Legacy /lms/members redirect */}
          <Route path="/lms/members">{() => { window.location.replace("/members/users"); return null; }}</Route>
          {/* Parent nav redirects — collapsed sidebar navigates to parent path */}
          <Route path="/members">{() => { window.location.replace("/members/users"); return null; }}</Route>
          <Route path="/products">{() => { window.location.replace("/lms/courses"); return null; }}</Route>
          <Route path="/marketing">{() => { window.location.replace("/marketing/website"); return null; }}</Route>
          <Route path="/sales">{() => { window.location.replace("/sales/orders"); return null; }}</Route>
          <Route path="/settings">{() => { window.location.replace("/lms/settings"); return null; }}</Route>
          <Route path="/admin">{() => { window.location.replace("/platform-admin"); return null; }}</Route>

          {/* ── Products ── */}
          <Route path="/lms/manage" component={CourseBuilderPage} />
          <Route path="/lms/courses" component={CoursesPage} />
          <Route path="/lms/courses/new" component={CourseEditorPage} />
          <Route path="/lms/courses/:id/curriculum" component={CourseEditorPage} />
          <Route path="/lms/courses/:id/settings" component={CourseEditorPage} />
          <Route path="/lms/courses/:id/pricing" component={CourseEditorPage} />
          <Route path="/lms/courses/:id/sales_page" component={CourseEditorPage} />
          <Route path="/lms/courses/:id/drip" component={CourseEditorPage} />
          <Route path="/lms/courses/:id/after_purchase" component={CourseEditorPage} />
          <Route path="/lms/courses/:id" component={CourseEditorPage} />
          <Route path="/admin/downloads" component={DigitalProductsPage} />
          <Route path="/lms/downloads" component={DigitalDownloadsAdminPage} />
          <Route path="/admin/downloads/reports" component={DigitalDownloadsReportsPage} />
          <Route path="/admin/downloads/new">{() => <DigitalProductEditorPage />}</Route>
          <Route path="/admin/downloads/:id">{() => <DigitalProductEditorPage />}</Route>
          <Route path="/lms/webinars" component={WebinarsPage} />
          <Route path="/lms/webinars/reports" component={WebinarReportsPage} />
          <Route path="/lms/webinars/:id/edit">{() => <WebinarEditorPage />}</Route>
          <Route path="/products/memberships" component={MembershipsPage} />
          <Route path="/products/memberships/:id/edit">{() => <MembershipEditorPage />}</Route>
          <Route path="/products/bundles" component={BundlesPage} />
          <Route path="/lms/forms" component={FormsPage} />
          <Route path="/lms/forms/:id/responses" component={FormResponsesPage} />
          <Route path="/lms/forms/:id/analytics" component={FormAnalyticsPage} />
          <Route path="/lms/forms/:id" component={FormBuilderPage} />
          <Route path="/products/community" component={CommunityPage} />
          <Route path="/products/community/:hubId/manage" component={CommunityManagePage} />
          <Route path="/products/categories" component={CategoriesPage} />
          <Route path="/media-library" component={MediaLibraryPage} />
          <Route path="/question-bank" component={QuestionBankPage} />
          <Route path="/question-bank/import" component={QuestionBankImportPage} />
          <Route path="/record">{() => { window.location.replace("/media-library#record-edit"); return null; }}</Route>

          {/* ── Marketing ── */}
          <Route path="/marketing/website" component={WebsitePage} />
          <Route path="/marketing/email" component={EmailCampaignsPage} />
          <Route path="/marketing/email/:campaignId/edit">{() => <EmailCampaignEditor />}</Route>
          <Route path="/marketing/funnels/:funnelId/pages/:pageId/edit">{() => <FunnelPageEditor />}</Route>
          <Route path="/marketing/funnels" component={FunnelsPage} />
          <Route path="/admin/funnels/:funnelId/pages/:pageId/edit">{() => <FunnelPageEditor />}</Route>
          <Route path="/admin/funnels/:funnelId">{() => <FunnelBuilder />}</Route>
          <Route path="/admin/funnels">{() => <FunnelBuilder />}</Route>
          <Route path="/marketing/widgets" component={WidgetsPage} />
          <Route path="/admin/widgets">{() => { window.location.replace("/marketing/widgets"); return null; }}</Route>
          <Route path="/admin/community">{() => { window.location.replace("/products/community"); return null; }}</Route>
          <Route path="/marketing/affiliates" component={AffiliatesPage} />
          {/* Legacy email marketing redirect */}
          <Route path="/lms/email-marketing">{() => { window.location.replace("/marketing/email"); return null; }}</Route>

          {/* ── Sales ── */}
          <Route path="/sales/orders" component={OrdersPage} />
          <Route path="/sales/subscriptions" component={SubscriptionsPage} />
          <Route path="/sales/group-orders" component={GroupOrdersPage} />
          <Route path="/sales/coupons" component={CouponsPage} />
          <Route path="/sales/invoices" component={InvoicesPage} />
          <Route path="/sales/revenue-partners" component={RevenuePartnersPage} />
          <Route path="/sales/order-bumps" component={OrderBumpsPage} />
          <Route path="/sales/order-bumps/:id" component={OrderBumpEditorPage} />

          {/* ── Analytics ── */}
          <Route path="/analytics/revenue" component={RevenueAnalyticsPage} />
          <Route path="/analytics/engagement" component={EngagementAnalyticsPage} />
          <Route path="/analytics/marketing" component={MarketingAnalyticsPage} />
          <Route path="/analytics/custom-reports" component={CustomReportsPage} />
          <Route path="/analytics/organization" component={OrgAnalyticsPage} />
          <Route path="/analytics-hub" component={RevenueAnalyticsPage} />
          {/* Legacy analytics redirects */}
          <Route path="/analytics" component={AnalyticsPage} />
          <Route path="/lms/analytics" component={LmsAnalyticsPage} />
          <Route path="/lms/activity" component={StudentLogReportsPage} />

          {/* ── Integrations ── */}
          <Route path="/integrations" component={IntegrationsPage} />
          <Route path="/integrations/api" component={ApiPage} />
          <Route path="/integrations/webhooks" component={WebhooksPage} />

          {/* ── Profile ── */}
          <Route path="/profile" component={ProfilePage} />
          <Route path="/billing" component={BillingPage} />

          {/* ── Platform Admin ── */}
          <Route path="/admin/orgs" component={AdminOrgsPage} />
          <Route path="/admin/users" component={AdminUsersPage} />
          <Route path="/admin/permissions" component={AdminPermissionsPage} />
          <Route path="/admin/settings" component={AdminSettingsPage} />
          <Route path="/platform-admin" component={PlatformAdminPage} />

          {/* ── Cohort learner routes (accessible from admin shell too) ── */}
          <Route path="/cohort/:courseId/assignment/:assignmentId" component={AssignmentDetail} />
          <Route path="/cohort/:courseId" component={CohortSchedule} />

          {/* ── Misc / Legacy ── */}
          <Route path="/upload">{() => { window.location.replace("/media-library#library"); return null; }}</Route>
          <Route path="/files">{() => { window.location.replace("/media-library#library"); return null; }}</Route>
          <Route path="/files/:id" component={FileDetailPage} />
          <Route path="/quizzes">{() => { window.location.replace("/media-library#quizzes"); return null; }}</Route>
          <Route path="/play/:id" component={PlayerPage} />
          <Route path="/quizzes/new" component={QuizBuilderPage} />
          <Route path="/quizzes/:id/edit" component={QuizBuilderPage} />
          <Route path="/quizzes/:id/play" component={QuizPlayerPage} />
          <Route path="/quizzes/:id/results/:attemptId" component={QuizResultsPage} />
          <Route path="/lms/my-courses" component={MyCoursesPage} />
          <Route path="/lms/my-certificates" component={MyCertificatesPage} />
          <Route path="/lms/branding" component={BrandingPage} />
          <Route path="/lms/page-builder/:pageId" component={PageBuilderPage} />
          <Route path="/lms/courses/:courseId/page-builder" component={PageBuilderPage} />
          <Route path="/lms/courses/:courseId/thank-you-builder" component={PageBuilderPage} />
          <Route path="/lms/courses/:courseId/landing-builder">{() => <LandingPageBuilder />}</Route>
          <Route path="/admin/downloads/:productId/page-builder" component={PageBuilderPage} />
          <Route path="/admin/downloads/:productId/landing-builder">{() => <DownloadLandingPageBuilder />}</Route>
          <Route path="/admin/products/:productId/landing-builder">{() => <ProductLandingPageBuilder />}</Route>
          <Route path="/lms/webinars/:webinarId/page-builder" component={PageBuilderPage} />
          <Route path="/lms/custom-pages" component={CustomPagesPage} />
          <Route path="/lms/settings" component={OrgSettingsPage} />
          <Route path="/learn/:courseId" component={CoursePlayerPage} />
          <Route path="/learn/:courseId/lesson/:lessonId" component={CoursePlayerPage} />

          {/* 404 */}
          <Route path="/404" component={NotFound} />
          <Route component={NotFound} />
        </Switch>
    </DashboardLayout>
  );
}


/**
 * SubdomainSchoolRouter
 * When the app is accessed via an org subdomain (e.g. allaboutultrasound.teachific.app),
 * serve both the learner portal AND the admin dashboard for org admins.
 */
function SubdomainSchoolRouter({ subdomain }: { subdomain: string }) {
  return (
      <Switch>
        {/* Auth works on subdomains */}
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/forgot-password" component={ForgotPasswordPage} />
        <Route path="/reset-password" component={ResetPasswordPage} />
        <Route path="/verify-email" component={VerifyEmailPage} />

        {/* ── Admin dashboard routes (org_admin / org_super_admin) ── */}
        {/* These are served inside DashboardLayout on the subdomain */}
        <Route path="/lms">{() => <DashboardLayout><LmsDashboardPage /></DashboardLayout>}</Route>
        <Route path="/lms/dashboard">{() => <DashboardLayout><LmsDashboardPage /></DashboardLayout>}</Route>
        <Route path="/lms/courses">{() => <DashboardLayout><CoursesPage /></DashboardLayout>}</Route>
        <Route path="/lms/courses/new" component={CourseEditorPage} />
        <Route path="/lms/courses/:id/curriculum" component={CourseEditorPage} />
        <Route path="/lms/courses/:id/settings" component={CourseEditorPage} />
        <Route path="/lms/courses/:id/pricing" component={CourseEditorPage} />
        <Route path="/lms/courses/:id/sales_page" component={CourseEditorPage} />
        <Route path="/lms/courses/:id/drip" component={CourseEditorPage} />
        <Route path="/lms/courses/:id/after_purchase" component={CourseEditorPage} />
        <Route path="/lms/courses/:id" component={CourseEditorPage} />
        <Route path="/members/users">{() => <DashboardLayout><MembersPage /></DashboardLayout>}</Route>
        <Route path="/members/groups">{() => <DashboardLayout><GroupsPage /></DashboardLayout>}</Route>
        <Route path="/members/certificates">{() => <DashboardLayout><MemberCertificatesPage /></DashboardLayout>}</Route>
        <Route path="/members/discussions">{() => <DashboardLayout><DiscussionsPage /></DashboardLayout>}</Route>
        <Route path="/members/assignments">{() => <DashboardLayout><AssignmentsPage /></DashboardLayout>}</Route>
        <Route path="/members">{() => { window.location.replace("/members/users"); return null; }}</Route>
        <Route path="/admin/downloads">{() => <DashboardLayout><DigitalProductsPage /></DashboardLayout>}</Route>
        <Route path="/admin/downloads/new">{() => <DigitalProductEditorPage />}</Route>
        <Route path="/admin/downloads/:id">{() => <DigitalProductEditorPage />}</Route>
        <Route path="/lms/webinars">{() => <DashboardLayout><WebinarsPage /></DashboardLayout>}</Route>
        <Route path="/lms/webinars/:id/edit">{() => <WebinarEditorPage />}</Route>
        <Route path="/products/memberships">{() => <DashboardLayout><MembershipsPage /></DashboardLayout>}</Route>
        <Route path="/products/memberships/:id/edit">{() => <MembershipEditorPage />}</Route>
        <Route path="/products/bundles">{() => <DashboardLayout><BundlesPage /></DashboardLayout>}</Route>
        <Route path="/lms/forms">{() => <DashboardLayout><FormsPage /></DashboardLayout>}</Route>
        <Route path="/lms/forms/:id/responses">{() => <DashboardLayout><FormResponsesPage /></DashboardLayout>}</Route>
        <Route path="/lms/forms/:id/analytics">{() => <DashboardLayout><FormAnalyticsPage /></DashboardLayout>}</Route>
        <Route path="/lms/forms/:id">{() => <DashboardLayout><FormBuilderPage /></DashboardLayout>}</Route>
        <Route path="/products/community">{() => <DashboardLayout><CommunityPage /></DashboardLayout>}</Route>
        <Route path="/products/community/:hubId/manage">{() => <DashboardLayout><CommunityManagePage /></DashboardLayout>}</Route>
        <Route path="/products/categories">{() => <DashboardLayout><CategoriesPage /></DashboardLayout>}</Route>
        <Route path="/media-library">{() => <DashboardLayout><MediaLibraryPage /></DashboardLayout>}</Route>
        <Route path="/marketing/website">{() => <DashboardLayout><WebsitePage /></DashboardLayout>}</Route>
        <Route path="/marketing/email">{() => <DashboardLayout><EmailCampaignsPage /></DashboardLayout>}</Route>
        <Route path="/marketing/funnels/:id">{() => <FunnelBuilderPage />}</Route>
        <Route path="/marketing/funnels">{() => <DashboardLayout><FunnelsPage /></DashboardLayout>}</Route>
        <Route path="/marketing/affiliates">{() => <DashboardLayout><AffiliatesPage /></DashboardLayout>}</Route>
        <Route path="/marketing">{() => { window.location.replace("/marketing/website"); return null; }}</Route>
        <Route path="/sales/orders">{() => <DashboardLayout><OrdersPage /></DashboardLayout>}</Route>
        <Route path="/sales/subscriptions">{() => <DashboardLayout><SubscriptionsPage /></DashboardLayout>}</Route>
        <Route path="/sales/coupons">{() => <DashboardLayout><CouponsPage /></DashboardLayout>}</Route>
        <Route path="/sales/invoices">{() => <DashboardLayout><InvoicesPage /></DashboardLayout>}</Route>
        <Route path="/sales">{() => { window.location.replace("/sales/orders"); return null; }}</Route>
        <Route path="/analytics/revenue">{() => <DashboardLayout><RevenueAnalyticsPage /></DashboardLayout>}</Route>
        <Route path="/analytics/engagement">{() => <DashboardLayout><EngagementAnalyticsPage /></DashboardLayout>}</Route>
        <Route path="/analytics">{() => <DashboardLayout><RevenueAnalyticsPage /></DashboardLayout>}</Route>
        <Route path="/lms/analytics">{() => <DashboardLayout><LmsAnalyticsPage /></DashboardLayout>}</Route>
        <Route path="/lms/activity">{() => <DashboardLayout><StudentLogReportsPage /></DashboardLayout>}</Route>
        <Route path="/integrations">{() => <DashboardLayout><IntegrationsPage /></DashboardLayout>}</Route>
        <Route path="/integrations/api">{() => <DashboardLayout><ApiPage /></DashboardLayout>}</Route>
        <Route path="/integrations/webhooks">{() => <DashboardLayout><WebhooksPage /></DashboardLayout>}</Route>
        <Route path="/profile">{() => <DashboardLayout><ProfilePage /></DashboardLayout>}</Route>
        <Route path="/billing">{() => <DashboardLayout><BillingPage /></DashboardLayout>}</Route>
        <Route path="/lms/branding">{() => <DashboardLayout><BrandingPage /></DashboardLayout>}</Route>
        <Route path="/lms/settings">{() => <DashboardLayout><OrgSettingsPage /></DashboardLayout>}</Route>
        <Route path="/lms/my-courses">{() => <DashboardLayout><MyCoursesPage /></DashboardLayout>}</Route>
        <Route path="/lms/my-certificates">{() => <DashboardLayout><MyCertificatesPage /></DashboardLayout>}</Route>
        <Route path="/lms/custom-pages">{() => <DashboardLayout><CustomPagesPage /></DashboardLayout>}</Route>
        <Route path="/lms/page-builder/:pageId" component={PageBuilderPage} />
        <Route path="/lms/courses/:courseId/page-builder" component={PageBuilderPage} />
        <Route path="/lms/courses/:courseId/thank-you-builder" component={PageBuilderPage} />
        <Route path="/admin/downloads/:productId/page-builder" component={PageBuilderPage} />
        <Route path="/lms/webinars/:webinarId/page-builder" component={PageBuilderPage} />

        {/* ── Learner / public routes ── */}
        <Route path="/learn/:courseId/overview" component={CourseOverviewPage} />
        <Route path="/learn/:courseId/lesson/:lessonId" component={CoursePlayerPage} />
        <Route path="/learn/:courseId" component={CoursePlayerPage} />
        <Route path="/my-courses" component={SchoolMyCoursesPage} />
        <Route path="/my-certificates">{() => <DashboardLayout><MyCertificatesPage /></DashboardLayout>}</Route>
        <Route path="/courses/:courseId/thank-you" component={ThankYouPage} />
        <Route path="/courses/:slug/player" component={CoursePlayer} />
        <Route path="/courses/:slug" component={CourseLanding} />
        <Route path="/community/:hubId" component={CommunityLearnerPage} />
        <Route path="/embed/:id" component={EmbedPage} />
        <Route path="/webinar/:slug/register" component={WebinarRegisterPage} />
        <Route path="/webinar/:slug/watch" component={WebinarWatchPage} />
        <Route path="/shop/:slug" component={DigitalProductSalesPage} />
        <Route path="/forms/:orgSlug/:slug" component={FormPlayerPage} />
        <Route path="/forms/:slug" component={FormPlayerPage} />
        <Route path="/quiz/:shareToken" component={PublicQuizPlayerPage} />
        <Route path="/p/:slug" component={PublicPagePage} />
        <Route path="/policies" component={OrgPoliciesPage} />
        <Route path="/terms" component={OrgPoliciesPage} />
        <Route path="/privacy" component={OrgPoliciesPage} />
        <Route path="/help" component={HelpPage} />

        {/* Default: show landing page if published, otherwise fall back to SchoolPage */}
        <Route>{() => <OrgLandingPage subdomainOrg={subdomain} fallback={<SchoolPage subdomainOrg={subdomain} />} />}</Route>
      </Switch>
  );
}

// Full-screen product editors — no sidebar, no DashboardLayout
function FullScreenEditorRouter() {
  return (
    <Switch>
      <Route path="/lms/courses/new" component={CourseEditorPage} />
      <Route path="/lms/courses/:id/curriculum" component={CourseEditorPage} />
      <Route path="/lms/courses/:id/settings" component={CourseEditorPage} />
      <Route path="/lms/courses/:id/pricing" component={CourseEditorPage} />
      <Route path="/lms/courses/:id/sales_page" component={CourseEditorPage} />
      <Route path="/lms/courses/:id/drip" component={CourseEditorPage} />
      <Route path="/lms/courses/:id/after_purchase" component={CourseEditorPage} />
      <Route path="/lms/courses/:id/thank-you-builder" component={PageBuilderPage} />
      <Route path="/lms/courses/:id/page-builder" component={PageBuilderPage} />
      <Route path="/lms/courses/:id" component={CourseEditorPage} />
      <Route path="/admin/downloads/new">{() => <DigitalProductEditorPage />}</Route>
      <Route path="/admin/downloads/:id">{() => <DigitalProductEditorPage />}</Route>
      <Route path="/lms/webinars/:id/edit">{() => <WebinarEditorPage />}</Route>
      <Route path="/products/memberships/:id/edit">{() => <MembershipEditorPage />}</Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function Router() {
  // If running on an org subdomain, serve the school portal directly
  const subdomain = getSubdomain();
  if (subdomain) {
    return (
      <SubdomainThemeProvider subdomain={subdomain}>
        <SubdomainSchoolRouter subdomain={subdomain} />
      </SubdomainThemeProvider>
    );
  }

  const path = window.location.pathname;

  // Full-screen product editors — no sidebar/DashboardLayout
  const isFullScreenEditor =
    /^\/admin\/downloads\/(new|\d+)$/.test(path) ||
    /^\/lms\/webinars\/\d+\/edit$/.test(path) ||
    /^\/products\/memberships\/\d+\/edit$/.test(path) ||
    /^\/lms\/courses\/(new|\d+)/.test(path);
  if (isFullScreenEditor) {
    return <FullScreenEditorRouter />;
  }

  const isBare =
    path === "/" ||
    path.startsWith("/embed/") ||
    path.startsWith("/learn/") ||
    path.startsWith("/school") ||
    path.startsWith("/p/") ||
    path.startsWith("/webinar/") ||
    path.startsWith("/shop/") ||
    path.startsWith("/forms/") ||
    AUTH_PATHS.some((p) => path === p || path.startsWith(p + "?")) ||
    path.startsWith("/quiz-creator") ||
    path.startsWith("/quiz-creator-app") ||
    path.startsWith("/quiz-creator-pro") ||
    path.startsWith("/studio") ||
    path.startsWith("/studio-pro") ||
    path.startsWith("/creator") ||
    path.startsWith("/policies") ||
    path === "/terms" ||
    path === "/privacy" ||
    path === "/help" ||
    path.startsWith("/community/") ||
    path.startsWith("/quiz/");
  return isBare ? <BareRouter /> : <AdminRouter />;
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <UploadQueueProvider>
            <Toaster richColors position="top-right" />
            <Router />
            <UploadQueuePanel />
          </UploadQueueProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
