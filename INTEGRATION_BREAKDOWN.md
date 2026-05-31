# Teachific Module Integration - Detailed Breakdown

**Total Scope:**
- **88 database tables** (47 LMS + 7 Email + 9 Form + 11 Media + 7 Member + 14 Funnel)
- **18 server routers** (7 LMS + 2 Email + 2 Form + 1 Media + 4 Member + 2 Funnel)
- **35 client pages** (9 LMS + 5 Email + 3 Form + 3 Media + 6 Member + 9 Funnel)
- **8 lib helpers** (3 LMS + 3 Email + 1 Form + 0 Media + 0 Member + 1 Funnel)

---

## Module 1: LMS (Learning Management System)

### Purpose
Full-featured course platform with enrollment, progress tracking, certificates, quizzes, cohorts, and Thinkific import.

### Scope: 47 Tables + 7 Routers + 9 Pages + 3 Helpers

#### Database Tables (47)
**Core Course Structure:**
- `lmsCourses` - Course metadata (title, description, thumbnail, access level)
- `lmsSections` - Course chapters/modules
- `lmsLessons` - Individual lessons within sections
- `lmsLessonBlocks` - Rich content blocks (text, video, quiz, assignment)
- `lmsLessonBlockMedia` - Media attachments per block

**Enrollment & Progress:**
- `lmsEnrollments` - User course enrollments with status
- `lmsProgress` - Per-user lesson completion tracking
- `lmsBookmarks` - User bookmarks within lessons
- `lmsNotes` - User notes per lesson

**Quizzes & Assessments:**
- `lmsQuizzes` - Quiz metadata
- `lmsQuestions` - Quiz questions
- `lmsAnswerChoices` - Multiple choice options
- `lmsQuizAttempts` - User quiz submissions
- `lmsQuizResponses` - Per-question answers

**Certificates & Completion:**
- `lmsCertificates` - Certificate templates
- `lmsCertificateIssued` - Issued certificates per user
- `lmsCompletionRules` - Rules for course completion

**Cohorts & Groups:**
- `lmsCohorts` - Cohort/class groupings
- `lmsCohortMembers` - Users in cohorts
- `lmsCohortSchedules` - Cohort start/end dates
- `lmsGroupSeats` - Seat allocation per cohort

**Discussions & Collaboration:**
- `lmsDiscussionForums` - Forum categories
- `lmsDiscussionTopics` - Forum topics
- `lmsDiscussionPosts` - Forum posts and replies

**Assignments & Submissions:**
- `lmsAssignments` - Assignment metadata
- `lmsSubmissions` - Student submissions
- `lmsSubmissionGrades` - Grading and feedback

**Analytics & Reporting:**
- `lmsEngagementMetrics` - Engagement data per user/course
- `lmsCompletionReports` - Completion tracking
- `lmsAccessLogs` - Access history

**Thinkific Integration:**
- `thinkificMappings` - Course ID mappings
- `thinkificWebhooks` - Webhook logs
- `thinkificSyncStatus` - Sync state tracking

**Additional:**
- `lmsInstructors` - Instructor assignments to courses
- `lmsPrerequisites` - Course prerequisites
- `lmsAccessRules` - Membership/role-based access
- `lmsNotifications` - Course notifications
- `lmsAnnouncements` - Course announcements
- `lmsResources` - Course downloadable resources
- `lmsBadges` - Achievement badges
- `lmsBadgesIssued` - Issued badges per user
- `lmsGradebook` - Grade tracking per course
- `lmsAttendance` - Attendance for live sessions
- `lmsLiveSession` - Live webinar/class sessions
- `lmsLiveSessionAttendees` - Attendee records

**Org-Level Additions:**
- Add `orgId` to all tables
- Add `customDomain`, `customDomainVerified`, `customDomainVerificationToken`, `customDomainVerificationStatus` to `lmsCourses`
- Add `instructorId` foreign key to `lmsInstructors` (links to users with instructor role)

#### Server Routers (7)
1. **lmsRouter.ts** - Main CRUD for courses, sections, lessons, enrollments
2. **lmsCourseBuilderRouter.ts** - Course builder UI operations
3. **lmsEnrollmentAdminRouter.ts** - Enrollment management, bulk operations
4. **lmsCohortAdminRouter.ts** - Cohort creation, scheduling, seat management
5. **lmsQuizLandingRouter.ts** - Quiz rendering, attempt submission
6. **lmsHelpers.ts** - Shared query helpers
7. **thinkificImportRouter.ts** - Thinkific API integration (optional — can remove)

**Adaptation:** Add `orgId` filter to all queries, check instructor/admin role

#### Client Pages (9)
1. **LMSHome.tsx** - Course catalog/enrollment page (public)
2. **CourseLanding.tsx** - Course overview and enrollment CTA
3. **CoursePlayer.tsx** - Lesson viewer with progress tracking
4. **CourseOverview.tsx** - Course details, syllabus, instructor info
5. **Enrolled.tsx** - Student dashboard showing enrolled courses
6. **StudentDashboardPage.tsx** - Student progress and certificates
7. **LMSAdmin.tsx** - Admin dashboard for course management
8. **ThinkificImporter.tsx** - Thinkific import UI
9. **ThinkificWebhookAdmin.tsx** - Webhook management

**Adaptation:** 
- Add org context to all pages
- Add instructor/admin permission checks
- Add custom domain routing support
- Integrate into org admin dashboard

#### Lib Helpers (3)
1. **enrollmentEmail.ts** - Enrollment confirmation emails
2. **certificateEmail.ts** - Certificate issuance emails
3. **certificateGenerator.ts** - PDF certificate generation (jsPDF)

**Adaptation:** Use org's custom sender email if configured

---

## Module 2: Email Campaigns

### Purpose
Drag-and-drop email campaign builder with SendGrid delivery, email lists, lead capture, and unsubscribe handling.

### Scope: 7 Tables + 2 Routers + 5 Pages + 3 Helpers

#### Database Tables (7)
- `emailCampaigns` - Campaign metadata (name, status, send date)
- `emailCampaignBlocks` - Campaign content blocks (text, image, button, spacer, divider, lead capture)
- `emailLists` - Email subscriber lists
- `emailListSubscribers` - Subscribers per list
- `emailSenderProfiles` - Verified SendGrid sender identities
- `emailCampaignAnalytics` - Open/click/bounce tracking
- `emailUnsubscribes` - Unsubscribe records

**Org-Level Additions:**
- Add `orgId` to all tables
- Add `customDomain` to `emailCampaigns` (for tracking links)

#### Server Routers (2)
1. **emailCampaignRouter.ts** - Campaign CRUD, send, analytics
2. **emailAuthRouter.ts** - SendGrid sender verification

**Adaptation:** Org-scoped queries, use org's sender profile

#### Client Pages (5)
1. **EmailCampaignDashboard.tsx** - Campaign list and overview
2. **EmailCampaignEditor.tsx** - Drag-and-drop campaign builder
3. **EmailListsTab.tsx** - Email list management
4. **EmailAdmin.tsx** - Admin dashboard
5. **Unsubscribe.tsx** - Public unsubscribe page

**Adaptation:** Org-scoped UI, custom domain support

#### Lib Helpers (3)
1. **emailListHelper.ts** - List import/export, CSV parsing
2. **emailLogger.ts** - Campaign delivery logging
3. **sendgridSuppressions.ts** - Bounce/complaint handling

---

## Module 3: Form Builder

### Purpose
Multi-section forms with conditional branching, file uploads, Google Sheets sync, webhook delivery.

### Scope: 9 Tables + 2 Routers + 3 Pages + 1 Helper

#### Database Tables (9)
- `generalForms` - Form metadata
- `formSections` - Multi-section layout
- `formFields` - Individual form fields
- `formFieldOptions` - Options for select/radio/checkbox fields
- `formBranchingRules` - Conditional logic (show/hide fields, redirect)
- `formSubmissions` - Form responses
- `formSubmissionData` - Per-field submission data
- `formGoogleSheetsConfig` - Google Sheets sync settings
- `formWebhookLogs` - Webhook delivery logs

**Org-Level Additions:**
- Add `orgId` to all tables
- Add `customDomain` to `generalForms`

#### Server Routers (2)
1. **formBuilderRouter.ts** - Form CRUD, submission handling
2. **generalFormRouter.ts** - Public form rendering

**Adaptation:** Org-scoped, custom domain routing

#### Client Pages (3)
1. **GeneralFormBuilder.tsx** - Form builder UI
2. **PublicFormRenderer.tsx** - Public form display
3. (Admin dashboard integrated into main admin)

#### Lib Helpers (1)
1. **googleSheets.ts** - Google Sheets API integration (optional)

---

## Module 4: Media Repository

### Purpose
S3/R2-backed asset management with folders, access rules, upload sessions, view tracking.

### Scope: 11 Tables + 1 Router + 3 Pages + 0 Helpers

#### Database Tables (11)
- `mediaAssets` - Asset metadata (name, type, size, S3 key)
- `mediaFolders` - Folder organization
- `mediaAccessRules` - Membership/role-based access control
- `mediaUploadSessions` - Resumable upload tracking
- `mediaUploadChunks` - Chunk tracking for large files
- `mediaViews` - View/download tracking
- `mediaVersions` - Asset versioning
- `mediaSharedLinks` - Public share links with expiry
- `mediaTagging` - Asset tags for search
- `mediaCollections` - Curated asset collections
- `mediaUsage` - Usage analytics per asset

**Org-Level Additions:**
- Add `orgId` to all tables
- Add `customDomain` to `mediaAssets` (for CDN delivery)

#### Server Router (1)
1. **mediaRepoRouter.ts** - Asset CRUD, upload, access control

**Adaptation:** Org-scoped, custom domain CDN routing

#### Client Pages (3)
1. **MediaRepository.tsx** - Asset library UI
2. **MediaRepositoryIHE.tsx** - Variant for specific brand (remove)
3. **MediaRedirect.tsx** - Public media redirect/tracking

---

## Module 5: Member Management

### Purpose
User profiles, membership plans, subscriptions, brand memberships, SSO, admin user management.

### Scope: 7 Tables + 4 Routers + 6 Pages + 0 Helpers

#### Database Tables (7)
- `membershipPlans` - Subscription tier definitions
- `membershipSubscriptions` - User subscriptions
- `membershipFeatures` - Features per plan
- `brandMemberships` - Multi-brand access control (REMOVE — single domain)
- `adminUsers` - Admin user records
- `userProfiles` - Extended user profile data
- `ssoTokens` - SSO token management

**Org-Level Additions:**
- Add `orgId` to all tables
- Extend `users` table with `affiliate`, `instructor` roles
- Create `orgUserRoles` table for role assignments per org

#### Server Routers (4)
1. **adminUserRouter.ts** - Admin user management
2. **brandMembershipRouter.ts** - Brand membership logic (REMOVE)
3. **premiumRouter.ts** - Subscription management
4. **ssoRouter.ts** - SSO token generation (adapt for single domain)

**Adaptation:** Org-scoped, remove brand logic, add affiliate/instructor routers

#### Client Pages (6)
1. **MembersHub.tsx** - Member directory
2. **MembershipAdmin.tsx** - Membership plan management
3. **AdminUserDetailPage.tsx** - Admin user details
4. **ContactsAdmin.tsx** - Contact/lead management
5. (Profile page — integrate into existing)
6. (Dashboard — integrate into existing)

**Adaptation:** Org-scoped UI, add affiliate dashboard

---

## Module 6: Funnel Management

### Purpose
Funnel builder with landing pages, branch logic, lead capture, digital products, analytics.

### Scope: 14 Tables + 2 Routers + 9 Pages + 1 Helper

#### Database Tables (14)
- `funnels` - Funnel metadata
- `funnelPages` - Funnel pages (landing, sales, order, upsell, thank you)
- `funnelPageBlocks` - Page content blocks (same as page builder)
- `funnelBranchRules` - Conditional routing (based on form answers, purchase status)
- `funnelLeads` - Lead records (form submissions)
- `funnelLeadData` - Per-field lead data
- `funnelConversions` - Conversion tracking
- `funnelAnalytics` - Funnel metrics (views, conversions, revenue)
- `digitalProducts` - Digital product/download definitions
- `digitalProductFiles` - Files per product
- `digitalProductPurchases` - Purchase records
- `funnelSteps` - Funnel step sequence
- `funnelEmailSequences` - Email automation per funnel
- `funnelPixelTracking` - Third-party pixel tracking

**Org-Level Additions:**
- Add `orgId` to all tables
- Add `customDomain` to `funnels`

#### Server Routers (2)
1. **funnelRouter.ts** - Funnel CRUD, page management
2. (Analytics router — may be combined)

**Adaptation:** Org-scoped, custom domain routing

#### Client Pages (9)
1. **FunnelBuilder.tsx** - Funnel editor
2. **FunnelPageEditor.tsx** - Page editor (landing, sales, etc.)
3. **PublicFunnelPage.tsx** - Public funnel page rendering
4. **FunnelAnalytics.tsx** - Funnel metrics dashboard
5. **FunnelLeads.tsx** - Lead list and details
6. **DigitalProductManager.tsx** - Digital product CRUD
7. **FunnelEmailSequence.tsx** - Email automation builder
8. **FunnelConversions.tsx** - Conversion tracking
9. **FunnelAdmin.tsx** - Admin dashboard

**Adaptation:** Org-scoped, custom domain support

#### Lib Helpers (1)
1. **funnelEngine.ts** - Funnel logic, branching, lead scoring

---

## New Modules to Create

### Affiliate System (NEW)

#### Database Tables (3)
- `affiliates` - Affiliate profiles (userId, orgId, commissionRate, totalEarnings)
- `affiliateCommissions` - Commission records (affiliateId, productType, productId, saleId, amount, status)
- `affiliatePayouts` - Payout records (affiliateId, amount, method, status, date)

#### Server Router (1)
- **affiliateRouter.ts** - Affiliate CRUD, commission tracking, payout management

#### Client Pages (2)
- **AffiliateAdmin.tsx** - Affiliate management (org admin)
- **AffiliateDashboard.tsx** - Affiliate earnings dashboard (affiliate user)

#### Lib Helpers (1)
- **affiliateEngine.ts** - Commission calculation, payout processing

---

## Role Hierarchy (Updated)

```
site_owner (Teachific platform owner)
├─ site_admin (Teachific platform admin)
└─ org_super_admin (Org owner)
   ├─ org_admin (Org administrator)
   │  ├─ instructor (Create/manage courses, forms, media)
   │  ├─ affiliate (Promote products, view commissions)
   │  └─ member (Access purchased content)
   └─ member (Basic member)
```

**Permission Matrix:**

| Action | site_owner | site_admin | org_super_admin | org_admin | instructor | affiliate | member |
|--------|-----------|-----------|-----------------|-----------|-----------|----------|--------|
| Create course | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Create email campaign | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Create form | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Upload media | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| Create funnel | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| Manage affiliates | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ | ✗ |
| View commissions | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| Enroll in course | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| Access media | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

---

## Custom Domain Support (Per Product)

### Fields to Add to Each Product Table

```typescript
// Courses
customDomain: varchar("customDomain", { length: 255 }),
customDomainVerified: boolean("customDomainVerified").default(false),
customDomainVerificationToken: varchar("customDomainVerificationToken", { length: 128 }),
customDomainVerificationStatus: mysqlEnum("customDomainVerificationStatus", 
  ["unverified", "pending", "verified"]
).default("unverified"),

// Funnels
customDomain: varchar("customDomain", { length: 255 }),
customDomainVerified: boolean("customDomainVerified").default(false),
customDomainVerificationToken: varchar("customDomainVerificationToken", { length: 128 }),
customDomainVerificationStatus: mysqlEnum("customDomainVerificationStatus", 
  ["unverified", "pending", "verified"]
).default("unverified"),

// Forms
customDomain: varchar("customDomain", { length: 255 }),
customDomainVerified: boolean("customDomainVerified").default(false),
customDomainVerificationToken: varchar("customDomainVerificationToken", { length: 128 }),
customDomainVerificationStatus: mysqlEnum("customDomainVerificationStatus", 
  ["unverified", "pending", "verified"]
).default("unverified"),

// Email Campaigns (for tracking links)
customDomain: varchar("customDomain", { length: 255 }),

// Media Assets (for CDN delivery)
customDomain: varchar("customDomain", { length: 255 }),

// Funnels (already listed above)
```

### Routing Logic

```typescript
// In SubdomainSchoolRouter or custom router
async function resolveProductByDomain(hostname: string) {
  // Check if hostname matches any product's customDomain
  const course = await db.query.lmsCourses.findFirst({
    where: and(
      eq(lmsCourses.customDomain, hostname),
      eq(lmsCourses.customDomainVerified, true)
    )
  });
  if (course) return { type: 'course', product: course };

  const funnel = await db.query.funnels.findFirst({
    where: and(
      eq(funnels.customDomain, hostname),
      eq(funnels.customDomainVerified, true)
    )
  });
  if (funnel) return { type: 'funnel', product: funnel };

  // ... check other product types
  
  // Fall back to org subdomain
  const orgSlug = hostname.split('.')[0];
  const org = await db.query.organizations.findFirst({
    where: eq(organizations.slug, orgSlug)
  });
  if (org) return { type: 'org', product: org };
  
  return null;
}
```

---

## Integration Checklist

### Phase 1: Roles & Permissions
- [ ] Add `affiliate` and `instructor` to user role enum
- [ ] Create `orgUserRoles` table
- [ ] Update auth context to include org role
- [ ] Add permission checks to all routers

### Phase 2: Schema Merge
- [ ] Extract all 88 table definitions
- [ ] Add `orgId` to tables missing it
- [ ] Add custom domain fields to product tables
- [ ] Create affiliate tables
- [ ] Generate migration SQL

### Phase 3: Router Integration
- [ ] Copy 18 routers
- [ ] Add org-level scoping to each
- [ ] Add custom domain lookups
- [ ] Register in main router
- [ ] Create affiliate router

### Phase 4: Page Integration
- [ ] Copy 35 pages
- [ ] Adapt for org context
- [ ] Add custom domain UI
- [ ] Register routes
- [ ] Create affiliate pages

### Phase 5: Helpers & Utilities
- [ ] Copy 8 helpers
- [ ] Adapt for org context
- [ ] Create affiliate engine

### Phase 6: Testing
- [ ] Test org data isolation
- [ ] Test custom domain routing
- [ ] Test role permissions
- [ ] Test affiliate commissions
- [ ] Test email delivery
- [ ] Test form submissions
- [ ] Test media access

### Phase 7: Documentation
- [ ] Update README
- [ ] Create integration guide
- [ ] Document custom domain setup
- [ ] Document affiliate system

---

## Dependencies to Install

```bash
pnpm add @sendgrid/mail @sendgrid/client
pnpm add googleapis
pnpm add jspdf html2canvas
pnpm add qrcode
pnpm add streamdown
```

---

## Estimated Effort

| Phase | Task | Hours |
|-------|------|-------|
| 1 | Add roles & permissions | 3 |
| 2 | Merge schemas | 6 |
| 3 | Integrate routers | 10 |
| 4 | Integrate pages | 15 |
| 5 | Helpers & utilities | 4 |
| 6 | Testing | 8 |
| 7 | Documentation | 3 |
| **Total** | | **49 hours** |

---

## Success Criteria

✅ All 88 tables merged and org-scoped
✅ All 18 routers integrated with org filtering
✅ All 35 pages adapted for org admin structure
✅ Custom domain support working per product
✅ Affiliate and instructor roles functional
✅ Email campaigns sending via org sender profile
✅ Forms submitting to Google Sheets (optional)
✅ Media repository accessible with access control
✅ Affiliate commissions tracking
✅ All tests passing
✅ Comprehensive documentation complete
