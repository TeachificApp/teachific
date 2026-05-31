# Router Implementation Plan

## Priority 1: Core LMS Routers (Critical)
These are essential for the platform to function:

1. **lmsRouter.ts** - Core courses, enrollments, cohorts
   - Status: Partially implemented (needs completion)
   - Size: ~500 lines
   - Impact: HIGH - Core LMS functionality

2. **lmsCourseBuilderRouter.ts** - Course editor, sections, lessons
   - Status: Not started
   - Size: ~400 lines
   - Impact: HIGH - Course creation/editing

3. **lmsEnrollmentAdminRouter.ts** - Admin enrollment management
   - Status: Not started
   - Size: ~300 lines
   - Impact: MEDIUM - Admin features

4. **lmsCohortAdminRouter.ts** - Cohort management
   - Status: Not started
   - Size: ~350 lines
   - Impact: HIGH - Cohort-based learning

## Priority 2: Forms & Media (Critical)
Essential for content management:

5. **formBuilderRouter.ts** - Form builder operations
   - Status: Not started
   - Size: ~400 lines
   - Impact: HIGH - Form creation/editing

6. **generalFormRouter.ts** - Form submission & responses
   - Status: Not started
   - Size: ~300 lines
   - Impact: HIGH - Form functionality

7. **mediaRepoRouter.ts** - Media repository operations
   - Status: Not started
   - Size: ~350 lines
   - Impact: HIGH - Asset management

## Priority 3: Funnels & Membership (Important)
Sales & monetization features:

8. **funnelRouter.ts** - Funnel builder & management
   - Status: Partially implemented
   - Size: ~600 lines
   - Impact: HIGH - Sales funnels

9. **downloadsRouter.ts** - Digital downloads
   - Status: Stub only
   - Size: ~200 lines
   - Impact: MEDIUM - Product delivery

10. **brandMembershipRouter.ts** - Membership management
    - Status: Partially implemented
    - Size: ~300 lines
    - Impact: HIGH - Subscription management

## Priority 4: Admin & Support (Secondary)
Administrative features:

11. **adminUserRouter.ts** - User management
    - Status: Not started
    - Size: ~250 lines
    - Impact: MEDIUM - Admin features

12. **emailCampaignRouter.ts** - Email campaigns
    - Status: Partially implemented
    - Size: ~400 lines
    - Impact: HIGH - Marketing automation

## Skip (Not Needed)
- thinkificImportRouter.ts - Thinkific integration (not applicable)
- emailAuthRouter.ts - Email authentication (handled by Manus OAuth)
- ssoRouter.ts - SSO integration (not applicable)
- premiumRouter.ts - Premium features (can be added later)
- lmsQuizLandingRouter.ts - Quiz landing pages (can be added later)

## Implementation Strategy

1. **Extract each router** from imported modules
2. **Adapt for org-level scoping** (add orgId filtering)
3. **Replace stub routers** in main routers.ts
4. **Test with vitest** for each router
5. **Save checkpoint** after each major router

## Estimated Timeline
- Priority 1: 8-10 hours
- Priority 2: 6-8 hours
- Priority 3: 6-8 hours
- Priority 4: 4-6 hours
- **Total: 24-32 hours**

## Current Status
- ✅ Stubs created for all routers
- ✅ Main appRouter integrated
- ⏳ Full implementations needed

## Next Steps
1. Extract and implement Priority 1 routers (LMS)
2. Extract and implement Priority 2 routers (Forms & Media)
3. Extract and implement Priority 3 routers (Funnels & Membership)
4. Extract and implement Priority 4 routers (Admin)
5. Run comprehensive integration tests
6. Final checkpoint and deployment
