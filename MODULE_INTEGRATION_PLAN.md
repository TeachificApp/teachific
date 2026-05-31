# Teachific Module Integration Plan

**Goal:** Import and adapt 6 production-ready modules from UltrasoundAssist into Teachific, restructuring for org-level administration with subdomain/custom domain support at product level.

---

## Modules to Import

| Module | Purpose | Key Tables | Adaptation Notes |
|--------|---------|-----------|------------------|
| **LMS** | Course builder, enrollment, progress, certificates | `lmsCourses`, `lmsEnrollments`, `lmsLessons`, `lmsQuizzes`, `lmsCertificates` | Add org-level scoping, custom domain per course |
| **Email Campaigns** | Campaign builder, email lists, SendGrid delivery | `emailCampaigns`, `emailLists`, `emailListSubscribers`, `emailSenderProfiles` | Org-level sender profiles, custom domain support |
| **Form Builder** | Multi-section forms, branching, Google Sheets sync | `generalForms`, `formSubmissions`, `formFields` | Org-level forms, custom domain for form pages |
| **Media Repository** | S3/R2 asset management, access control | `mediaAssets`, `mediaFolders`, `mediaAccessRules` | Org-level media library, custom domain for media CDN |
| **Member Management** | User profiles, membership plans, SSO | `membershipPlans`, `membershipSubscriptions`, `brandMemberships` | Org-level membership tiers, affiliate/instructor roles |
| **Funnel Management** | Funnel builder, landing pages, lead capture | `funnels`, `funnelPages`, `funnelLeads`, `digitalProducts` | Org-level funnels, custom domain per funnel |

---

## Key Adaptations Required

### 1. **Single Domain Structure**
- Remove cross-domain/multi-brand logic
- All content lives at `teachific.app` or org's custom domain
- Org slug determines subdomain: `{orgslug}.teachific.app`
- Individual products can have custom domains: `courses.example.com`, `learn.example.com`, etc.

### 2. **Org-Level Scoping**
- Every table must include `orgId` foreign key
- All queries filtered by `ctx.org.id` (from auth context)
- Org admins manage all content within their org
- No cross-org data visibility

### 3. **Custom Domain Support (Per Product)**
- Add to each product type (courses, funnels, forms, etc.):
  - `customDomain: varchar` (e.g., "courses.example.com")
  - `customDomainVerified: boolean`
  - `customDomainVerificationToken: varchar`
  - `customDomainVerificationStatus: enum` ("unverified", "pending", "verified")
- Org admins can set custom domain per course/funnel/form
- Public pages accessible at both subdomain and custom domain

### 4. **New User Roles**
Current roles: `site_owner`, `site_admin`, `org_super_admin`, `org_admin`, `member`, `user`

**Add:**
- `affiliate` - Can promote org's products, earn commissions
- `instructor` - Can create/manage courses and content within org

**Role Hierarchy (within org):**
```
org_super_admin (full access)
  ├─ org_admin (manage all content, members, settings)
  ├─ instructor (create/manage courses, forms, media)
  ├─ affiliate (promote products, view commissions)
  └─ member (access purchased content)
```

### 5. **Database Schema Changes**

#### Add to `users` table:
```sql
ALTER TABLE users ADD COLUMN role ENUM(..., 'affiliate', 'instructor') AFTER role;
```

#### Add to each product table (courses, funnels, forms, etc.):
```sql
ALTER TABLE lmsCourses ADD COLUMN customDomain VARCHAR(255);
ALTER TABLE lmsCourses ADD COLUMN customDomainVerified BOOLEAN DEFAULT FALSE;
ALTER TABLE lmsCourses ADD COLUMN customDomainVerificationToken VARCHAR(128);
ALTER TABLE lmsCourses ADD COLUMN customDomainVerificationStatus ENUM('unverified', 'pending', 'verified') DEFAULT 'unverified';

-- Repeat for: funnels, generalForms, emailCampaigns, mediaFolders
```

#### New tables for affiliate system:
```sql
CREATE TABLE affiliates (
  id INT PRIMARY KEY AUTO_INCREMENT,
  orgId INT NOT NULL,
  userId INT NOT NULL,
  commissionRate DECIMAL(5,2),
  totalEarnings DECIMAL(10,2),
  createdAt TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (orgId) REFERENCES organizations(id),
  FOREIGN KEY (userId) REFERENCES users(id)
);

CREATE TABLE affiliateCommissions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  affiliateId INT NOT NULL,
  productType ENUM('course', 'digital_product', 'membership', 'funnel'),
  productId INT,
  saleId INT,
  commissionAmount DECIMAL(10,2),
  status ENUM('pending', 'approved', 'paid'),
  createdAt TIMESTAMP DEFAULT NOW(),
  FOREIGN KEY (affiliateId) REFERENCES affiliates(id)
);
```

---

## Integration Phases

### Phase 1: Analyze & Plan ✅
- [x] Review all 6 module structures
- [x] Identify cross-domain logic to remove
- [x] Plan org-level scoping strategy
- [x] Define custom domain per-product implementation

### Phase 2: Add Roles
- [ ] Update `users` table enum to include `affiliate`, `instructor`
- [ ] Create `orgUserRoles` table for role assignments per org
- [ ] Add permission checks in tRPC context

### Phase 3: Merge Schemas
- [ ] Extract all table definitions from 6 modules
- [ ] Add `orgId` to every table (if missing)
- [ ] Add custom domain fields to product tables
- [ ] Create affiliate tables
- [ ] Generate migration SQL

### Phase 4: Integrate Server Routers
- [ ] Copy all router files to `server/routers/`
- [ ] Adapt each router to:
  - Filter by `ctx.org.id`
  - Support custom domain lookups
  - Check affiliate/instructor permissions
- [ ] Register all routers in main `server/routers.ts`

### Phase 5: Integrate Client Pages
- [ ] Copy all page components to `client/src/pages/`
- [ ] Adapt UI for org admin structure
- [ ] Add custom domain management UI to each product editor
- [ ] Register routes in `client/src/App.tsx`

### Phase 6: Test & Verify
- [ ] Test org-level data isolation
- [ ] Test custom domain routing
- [ ] Test affiliate/instructor permissions
- [ ] Test email campaigns, forms, media uploads

### Phase 7: Document & Deploy
- [ ] Create integration documentation
- [ ] Update README with new features
- [ ] Deploy to production

---

## File Structure After Integration

```
scorm-host/
├── drizzle/
│   └── schema.ts                    ← Merged schemas
├── server/
│   ├── routers/
│   │   ├── lmsRouter.ts             ← Org-scoped
│   │   ├── emailCampaignRouter.ts   ← Org-scoped
│   │   ├── formBuilderRouter.ts     ← Org-scoped
│   │   ├── mediaRepoRouter.ts       ← Org-scoped
│   │   ├── memberManagementRouter.ts ← Org-scoped
│   │   ├── funnelRouter.ts          ← Org-scoped
│   │   └── affiliateRouter.ts       ← NEW: Affiliate system
│   └── lib/
│       ├── emailHelpers.ts
│       ├── certificateGenerator.ts
│       ├── googleSheets.ts
│       └── affiliateEngine.ts       ← NEW
├── client/src/
│   ├── pages/
│   │   ├── admin/
│   │   │   ├── LMSAdmin.tsx
│   │   │   ├── EmailCampaignDashboard.tsx
│   │   │   ├── FormBuilder.tsx
│   │   │   ├── MediaRepository.tsx
│   │   │   ├── MembershipAdmin.tsx
│   │   │   ├── FunnelBuilder.tsx
│   │   │   └── AffiliateAdmin.tsx    ← NEW
│   │   ├── public/
│   │   │   ├── CourseLanding.tsx
│   │   │   ├── CoursePlayer.tsx
│   │   │   ├── FunnelPage.tsx
│   │   │   ├── FormPage.tsx
│   │   │   └── PublicEmailSignup.tsx
│   │   └── ...
│   └── components/
│       ├── CustomDomainManager.tsx  ← NEW
│       ├── AffiliateWidget.tsx      ← NEW
│       └── ...
└── MODULE_INTEGRATION_PLAN.md       ← This file
```

---

## Custom Domain Implementation (Per Product)

### Database Fields (add to each product table):
```typescript
customDomain: varchar("customDomain", { length: 255 }),
customDomainVerified: boolean("customDomainVerified").default(false),
customDomainVerificationToken: varchar("customDomainVerificationToken", { length: 128 }),
customDomainVerificationStatus: mysqlEnum("customDomainVerificationStatus", 
  ["unverified", "pending", "verified"]
).default("unverified"),
```

### UI Component (CustomDomainManager.tsx):
- Input field for custom domain
- Verification instructions (DNS CNAME setup)
- Verification status badge
- Auto-verify on DNS check

### Routing Logic:
```typescript
// In SubdomainSchoolRouter or public router
// Check if request domain matches any product's customDomain
const course = await db.query.lmsCourses.findFirst({
  where: eq(lmsCourses.customDomain, req.hostname)
});

if (course?.customDomainVerified) {
  // Serve course at custom domain
  return renderCourseLanding(course);
}
```

---

## Affiliate System

### Commission Tracking:
- Affiliate creates unique referral link: `teachific.app/ref/{affiliateId}`
- When user purchases via link, commission recorded
- Org admin sets commission rate per affiliate
- Affiliates view earnings dashboard

### Payout:
- Manual or automatic payout to affiliate's payment method
- Track commission status: pending → approved → paid

---

## Environment Variables (New)

```bash
# Already configured
SENDGRID_API_KEY
SENDGRID_FROM_EMAIL
SENDGRID_FROM_NAME

# May need for Google Sheets integration
GOOGLE_SHEETS_API_KEY
GOOGLE_SHEETS_CLIENT_ID
GOOGLE_SHEETS_CLIENT_SECRET
```

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

## Success Criteria

- [x] All 6 modules analyzed and adaptation strategy defined
- [ ] Affiliate and instructor roles added to user schema
- [ ] All schemas merged with org-level scoping
- [ ] All routers integrated and org-scoped
- [ ] All client pages integrated and adapted
- [ ] Custom domain support working per product
- [ ] Email campaigns sending via org's sender profile
- [ ] Forms submitting to Google Sheets (optional)
- [ ] Media repository accessible via custom domain
- [ ] Affiliate system tracking commissions
- [ ] All tests passing

---

## Timeline Estimate

- Phase 2 (Roles): 2 hours
- Phase 3 (Schemas): 4 hours
- Phase 4 (Routers): 6 hours
- Phase 5 (Pages): 8 hours
- Phase 6 (Testing): 4 hours
- Phase 7 (Documentation): 2 hours

**Total: ~26 hours of focused development**

---

## Notes

- This is a major integration — recommend creating a new checkpoint before starting
- Test each module independently before integrating with others
- Keep the original UltrasoundAssist modules as reference
- Document any breaking changes for future maintenance
