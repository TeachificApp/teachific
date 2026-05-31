# SCORM Host Platform - TODO

## Phase 1: Database Schema & Migrations
- [x] Organizations table (multi-tenant workspaces)
- [x] Update users table with org membership and roles (site_owner, admin, user)
- [x] Content packages table (uploaded ZIP files with metadata)
- [x] Content versions table (version control per package)
- [x] File assets table (extracted files within a package)
- [x] Permissions table (per-file granular permissions)
- [x] Play sessions table (tracking playback events)
- [x] SCORM interactions table (LMS data storage)
- [x] Analytics events table (engagement metrics)
- [x] Run migrations via webdev_execute_sql

## Phase 2: Backend API Routes
- [x] File upload endpoint (multipart, S3 storage)
- [x] ZIP extraction and file asset indexing
- [x] SCORM manifest parser (imsmanifest.xml, SCORM 1.2 + 2004)
- [x] LLM content analysis on upload (metadata, tags, description)
- [x] Organization CRUD procedures
- [x] User/member management procedures
- [x] Content package CRUD procedures
- [x] Version control procedures (create version, rollback, diff)
- [x] Permission management procedures (per-file settings)
- [x] Secure content serving endpoint (with permission checks)
- [x] SCORM LMS API endpoint (cmi data persistence)
- [x] Play session tracking procedures
- [x] Analytics aggregation procedures
- [x] Report export procedures

## Phase 3: Admin Panel UI
- [x] Dashboard layout with sidebar navigation
- [x] Overview dashboard (stats cards, recent activity)
- [x] File management page (upload, list, search, filter)
- [x] File detail page (metadata, versions, permissions)
- [x] Upload modal with drag-and-drop and progress)
- [x] Organization management page (create, edit, members)
- [x] User management page (roles, invites)
- [x] Permission editor component (per-file settings)
- [x] Version history panel with rollback UI

## Phase 4: Content Viewer
- [x] Secure viewer page with permission enforcement
- [x] Sandboxed iframe for HTML/SCORM content
- [x] SCORM 1.2 LMS API (API object)
- [x] SCORM 2004 LMS API (API_1484_11 object)
- [x] Play limit enforcement (max plays per user)
- [x] Download button with permission check
- [x] External link controls
- [x] Viewer analytics event emission

## Phase 5: Analytics Dashboard
- [x] Analytics overview page (play counts, completions, durations)
- [x] Per-file analytics breakdown
- [x] Per-organization analytics
- [x] SCORM interaction logs viewer
- [x] Exportable CSV/JSON reports
- [x] Real-time engagement tracking

## Phase 6: Testing & Delivery
- [x] Vitest unit tests for key procedures
- [x] Save checkpoint
- [x] Deliver to user

## Display Mode & Quiz System (New Requirements)
- [ ] Add displayMode field to content_packages (native, lms_presentation, quiz)
- [ ] Import modal: ask user to choose display mode on upload
- [ ] Native mode: render content exactly as-imported inside sandboxed iframe
- [ ] LMS Presentation mode: wrap content in internal branded LMS shell (sidebar nav, progress bar, completion tracking, branded header/footer)
- [ ] Quiz mode: parse SCORM/HTML content and import questions into internal quiz engine
- [ ] Quiz schema: quizzes, questions, answer_choices, quiz_attempts, quiz_responses tables
- [ ] Quiz builder UI: create/edit questions (MCQ, true/false, short answer, matching)
- [ ] Quiz player UI: timed quiz, progress indicator, immediate/deferred feedback
- [ ] Quiz results page: score, per-question breakdown, pass/fail, retry
- [ ] LLM-assisted quiz extraction: auto-detect and import questions from uploaded SCORM/HTML content
- [ ] Quiz attempt tracking and analytics integration
- [ ] Per-question analytics (most missed, avg time per question)

## Universal Two-Path Import System (Refined)
- [ ] Every content type (SCORM, HTML, quiz) gets the same two-path choice at import
- [ ] Path A - Native: serve content exactly as-uploaded inside sandboxed iframe, no shell wrapping
- [ ] Path B - LMS Shell: re-host content inside branded internal LMS presentation shell
- [ ] LMS Shell features: branded header, sidebar chapter/slide nav, progress bar, completion badge, prev/next controls, notes panel, bookmarking
- [ ] Import wizard step 2: after file analysis, show "How would you like to display this content?" card with Native vs LMS Shell options and visual previews
- [ ] displayMode stored per package: 'native' | 'lms_shell' | 'quiz'
- [ ] lmsShellConfig JSON field: theme color, show sidebar, show progress, allow notes, show completion badge
- [ ] Ability to switch display mode post-import from the file detail page
- [ ] LMS Shell works for all three content types: SCORM iframe inside shell, HTML iframe inside shell, quiz engine inside shell

## Excel Quiz Import/Export (iSpring Template Format)
- [ ] Install xlsx (SheetJS) for server-side Excel read/write
- [ ] Parse Template sheet columns: Question Type, Question Text, Image, Video, Audio, Answer 1-10, Correct Feedback, Incorrect Feedback, Points
- [ ] Support all question types: TF (True/False), MC (Multiple Choice), MR (Multiple Response), TI (Short Answer), MG (Matching), SEQ (Sequence), NUMG (Numeric), IS (Info Slide)
- [ ] Correct answers identified by * prefix on answer text (e.g. "*True", "*Alternative 1")
- [ ] Matching questions use pipe delimiter: "Premise|Response"
- [ ] Export quiz to XLS matching exact Template sheet column layout
- [ ] Export includes both a "Template" sheet (reference) and a "Questions" sheet with the quiz data
- [ ] Import endpoint: POST /api/quiz/import — accepts XLS/XLSX, returns parsed question list for preview before saving
- [ ] Import preview UI: show parsed questions in a table, allow user to confirm or discard
- [ ] Export button on quiz builder page downloads XLS in template format
- [ ] Validation: flag unsupported question types, missing question text, no correct answer marked
- [ ] Upload sample template file to S3 and provide download link from quiz builder

## Rebranding to Teachific™
- [x] Update VITE_APP_TITLE to Teachific™
- [x] Update DashboardLayout sidebar branding to Teachific™
- [x] Update PlayerPage LMS shell header branding to Teachific™
- [x] Update HTML page title and meta tags in index.html
- [x] Update all page headers and references to old platform name
- [x] Save checkpoint and deliver

## Bug Fix: Upload Requires Organization Selection
- [x] Auto-create a default "Personal Workspace" org for site owner on first login
- [x] Add backend procedure to ensure user always has at least one org
- [x] UploadPage: auto-select org when user only has one org (skip the selector)
- [x] UploadPage: if no org exists, auto-provision one before showing upload form
- [x] Fix org selector to not block upload for site owner

## Bug Fix: Player iframe shows Teachific app + 404 on content files
- [ ] Diagnose upload route: check how files are stored (S3 keys, extracted paths)
- [ ] Fix static file serving for extracted SCORM content
- [ ] Fix PlayerPage iframe src to point to correct content entry point
- [ ] Verify SCORM manifest parsing sets correct entryPoint field
- [ ] Test full upload → play flow end-to-end

## Bug Fix: Player iframe + Share Links
- [x] Fix iframe src — currently loads Teachific app shell instead of SCORM content
- [x] Add /api/content/:packageId/* proxy route to serve extracted S3 files with correct MIME types
- [x] Create bare /embed/:packageId route (no admin nav) for share/embed links
- [x] Fix share links to point to /embed/:packageId
- [x] Test full upload → play → share flow

## Logo Branding
- [x] Upload Teachific.png logo to CDN
- [x] Apply logo to sidebar header (replaces icon + text)
- [x] Apply logo to login screen (white/inverted version)
- [x] Apply logo to embed player LMS shell header
- [x] Set logo as browser tab favicon in index.html

## Dynamic URL Parameters
- [x] Add learnerName, learnerEmail, learnerId, orgId, groupId, customData columns to play_sessions
- [x] Update sessions.start tRPC procedure to accept and store URL params
- [x] Update EmbedPage to parse URL query params and pass to session start
- [x] Add URL builder UI in FileDetailPage with all supported params and copy-ready examples
- [x] Update analytics to expose per-session learner param data
- [x] Support ?token= for share links combined with learner params

## Logo Text Lockup
- [x] Replace logo image with styled text: "teach" white + "ific" teal + "™" white in sidebar
- [x] Same text lockup on login screen
- [x] Same text lockup in embed player header
- [x] Collapsed sidebar shows just teal "t" icon character

## Bug Fix: Upload Spinning / Timeout
- [x] Diagnose upload timeout root cause (body size limit, multer, S3)
- [x] Fix server body size limit and multer config for large ZIPs — switched to diskStorage
- [x] Add streaming S3 upload with real-time progress events (XHR + SSE)
- [x] UploadPage: show file size before upload starts
- [x] UploadPage: real-time bytes-uploaded progress bar with % and MB/MB display
- [x] UploadPage: phase labels (Upload → Extract → CDN Upload → Ready)
- [x] Batch-streaming extraction: read CONCURRENCY files at a time to avoid RAM exhaustion
- [x] Seed AdvancedCardiacSonographer.zip (345 files) under All About Ultrasound org (ID 1)

## Bug Fix: Learner URL Parameters Not Stored in Sessions
- [ ] Audit EmbedPage: confirm URL params are parsed and passed to sessions.start mutation
- [ ] Audit sessions.start procedure: confirm all learner fields are accepted and written to DB
- [ ] Check PlayerPage (non-embed): does it also parse and forward URL params?
- [ ] Verify play_sessions rows contain learner fields after a tracked play
- [ ] Fix whichever layer is dropping the params
- [ ] Test end-to-end with a constructed tracking URL

## File Organization: Folders & Subfolders
- [ ] Add content_folders table (id, name, parentId, orgId, ownerId, createdAt, updatedAt)
- [ ] Add folderId column to content_packages table
- [ ] Generate and apply migration SQL
- [ ] Add folder CRUD tRPC procedures (create, rename, delete, list, move)
- [ ] Add procedure to move package into/out of folder
- [ ] Build folder tree sidebar in FilesPage (collapsible, nested)
- [ ] Add "New Folder" button and inline rename
- [ ] Show packages filtered by selected folder (or "All" / "Uncategorized")
- [ ] Allow moving packages between folders (context menu or drag)
- [ ] Allow moving folders into other folders (drag or move dialog)
- [ ] Delete folder: prompt to move contents or delete all
- [ ] Show folder breadcrumb when browsing inside a folder
- [ ] Write vitest tests for folder procedures

## URL Builder Redesign: Template Placeholder Mode
- [x] Replace manual-entry fields with a template placeholder system
- [x] Each param shows its placeholder token (e.g. {{learner_name}}) for use in the host site
- [x] Generate a base embed URL with all enabled params as placeholders
- [x] Provide tabbed code snippets: Plain JS, iframe HTML, and a generic LMS/server-side example
- [x] JS snippet uses string replacement to swap placeholders with the host site's dynamic variables
- [x] Explain that the host site is responsible for substituting values before launching the iframe
- [x] Add a "Live Preview" section where user can test-fill values and see the final URL

## Mobile Responsiveness
- [ ] DashboardLayout: collapsible sidebar drawer with hamburger menu on mobile
- [ ] FilesPage: show type/status/plays on mobile, folder sidebar as collapsible panel
- [ ] FileDetailPage: tabs scroll horizontally, form fields full width, sharing section stacks
- [ ] AnalyticsPage: stats cards wrap, table scrolls horizontally
- [ ] UploadPage: full width on mobile
- [ ] PlayerPage/EmbedPage: iframe fills full viewport on mobile
- [ ] Dashboard/Home: stat cards wrap to 2-col grid on mobile
- [ ] Navigation: hamburger opens full-screen nav drawer on mobile

## Bug Fix: Iframe Embed Broken on External Sites
- [ ] Proxy content bytes through server instead of redirecting to S3 (avoids S3 X-Frame-Options blocks)
- [ ] Add X-Frame-Options: ALLOWALL and correct CORS headers to content proxy responses
- [ ] Ensure embed page itself has no frame-blocking headers
- [ ] Test embed loads on boutultrasound.com mobile

## Stripe Checkout Integration for Products & Funnels
- [x] Create embeddedCheckoutRouter.ts for funnel/landing page inline Stripe checkout with PaymentElement
- [x] Extended funnelPurchases schema with Stripe payment tracking and fulfillment fields
- [x] Add order bump support to checkout flows (additional products at discounted rates)
- [x] Add promo code validation and discount application to checkout
- [x] Create Stripe webhook handler for embedded checkout fulfillment (courses, downloads, quizzes, memberships)
- [x] Register webhook handler in server (_core/index.ts)
- [x] Implement fulfillment logic: course enrollment, download/quiz access grants, membership subscriptions
- [ ] Add embedded_checkout content block type to page builder (funnels, landing pages, product pages)
- [ ] Extend funnel CTA actions to support Stripe checkout (not just external links)
- [ ] Extend email campaign CTA actions to support Stripe checkout
- [ ] Add org admin UI to OrgSettingsPage for Stripe Connect onboarding and gateway selection
- [ ] Add org admin UI to configure own Stripe keys (publishable + secret) for Pro+ plans
- [ ] Integrate quiz/download/product purchase flows with existing Stripe checkout
- [ ] Test end-to-end: funnel lead capture → CTA with Stripe checkout → fulfillment
- [ ] Test end-to-end: course/quiz/download purchase with own Stripe gateway

## Bug Fix: Embed Requires Login (Critical)
- [ ] Make sessions.start a publicProcedure (no auth required)
- [ ] Make sessions.end a publicProcedure
- [ ] Make packages.get a publicProcedure for embed context
- [ ] Update EmbedPage: remove login redirect, allow anonymous session start
- [ ] Content proxy routes already public (Express, no tRPC auth)
- [ ] Test: incognito window can view embedded content

## Access Control: Public / Private Per Package
- [x] Add isPublic boolean column to content_packages (default false = private)
- [x] packages.get: make publicProcedure, return package only if public OR user is authenticated org member
- [x] sessions.start: block unauthenticated start for private packages
- [x] sessions.end / scorm data: already publicProcedure
- [x] FileDetailPage Details tab: Public/Private toggle with live save and badge in header
- [x] EmbedPage: if package is private and user not logged in, show login wall
- [ ] PlayerPage: same private access gate (low priority — admin-only route)
- [ ] Share link: token-protected links bypass the public/private check

## Bug Fix: Embed Content Flash
- [x] Content shows briefly then disappears in embed player
- [x] Root cause: permissions.get was protectedProcedure — threw UNAUTHORIZED for unauthenticated users, causing tRPC retries and re-renders that flashed the iframe
- [x] Fix: made permissions.get a publicProcedure; added retry:false + staleTime:Infinity to pkg and perms queries in EmbedPage

## File Organization: Drag-and-Drop Folders
- [ ] Install @dnd-kit/core and @dnd-kit/sortable for drag-and-drop
- [ ] Two-column layout: folder tree sidebar (left) + package grid (right)
- [ ] Drag package cards onto folder nodes to move them
- [ ] Folder drop zones highlight on hover during drag
- [ ] Clicking a folder filters packages to show only that folder's contents
- [ ] Breadcrumb path shows current folder location
- [ ] "All Files" and "Uncategorized" virtual folders in sidebar

## Bug Fix: Drag-to-Order Questions Not Working on Mobile in Iframe
- [x] Diagnose: iframe sandbox attribute blocking touch/pointer events
- [x] Removed sandbox attribute from all iframes in EmbedPage and PlayerPage (native + LMS shell modes)
- [x] Applies to ordering, connect, and match question types — all rely on touch drag events

## UI: Teal Fullscreen Button on Mobile
- [x] EmbedPage: fullscreen button teal-highlighted on mobile screens
- [x] PlayerPage: fullscreen button teal-highlighted on mobile screens (both native and LMS shell modes)

## UI: Mobile Fullscreen Prompt Banner
- [x] EmbedPage: show themed banner on mobile with "Best displayed in full screen" + Full Screen + Dismiss (✕)
- [x] PlayerPage: same banner in both native and LMS shell modes
- [x] Banner only shows on mobile (sm breakpoint), hidden when fullscreen is active, dismissed via state

## Feature: Upload New Version (Version Replacement)
- [x] Version upload endpoint: POST /api/upload/version/:packageId — same extraction logic, increments version number
- [x] Keep same package ID / embed URL — only the content files change
- [x] FileDetailPage Versions tab: Upload New Version card with file picker, changelog field, and progress bar
- [x] Version history list showing versionLabel, changelog, file count, entry point, and Current badge
- [ ] Allow rolling back to a previous version from the version history list (future)

## Feature: Drag-and-Drop Folder Organization
- [x] Add sortOrder column to content_folders table
- [x] Add folders.reorder tRPC procedure to persist folder order
- [x] packages.move procedure already existed in routers.ts
- [x] FilesPage: draggable package cards that can be dropped onto folder nodes
- [x] FilesPage: reorderable folder list in sidebar via drag handle
- [x] FilesPage: fix stale @/contexts/AuthContext import

## Bug Fix: Folder Sort Order Not Persisting
- [x] Fix getFoldersByOrg in db.ts to sort by sortOrder ASC (was sorting alphabetically by name)
- [x] Folder drag-and-drop reorder now persists correctly across page refreshes

## Feature: Auto-Fullscreen on Mobile
- [x] Add autoFullscreenMobile boolean column to content_packages table (default false)
- [x] Generate and apply migration SQL
- [x] Expose autoFullscreenMobile in packages.get (public) and packages.update (protected) tRPC procedures
- [x] Add toggle in FileDetailPage Details tab under Mobile Playback section
- [x] EmbedPage: read autoFullscreenMobile from package, detect mobile UA, request fullscreen on mount
- [x] PlayerPage: same auto-fullscreen logic for admin preview
- [x] Dismiss mobile prompt banner automatically when auto-fullscreen fires
- [x] Write vitest test for packages.update with autoFullscreenMobile field

## Bug Fix: Folder Sidebar — Remove Uncategorized Virtual Folder
- [x] Remove "Uncategorized" virtual folder entry from the sidebar
- [x] "All Files" remains the only top-level filter (shows all packages regardless of folder)
- [x] Clicking a real folder filters to only that folder's packages
- [x] Packages without a folderId appear under "All Files" and inside whichever folder is selected (or all)
- [x] Remove "drop-uncategorized" drop target; dragging a package off a folder just moves it back to no folder via the folder's own drop zone or context menu
- [x] Update empty-state message when a folder is selected but empty

## Bug Fix: New Version Not Showing on Mobile
- [x] Audit content proxy: was querying ALL assets for a package, ignoring versionId — old entry point matched first
- [x] Fix contentRoutes to filter file_assets by currentVersionId in both /entry and /* routes
- [x] Add Cache-Control: no-store, no-cache, must-revalidate + Pragma: no-cache to all proxy responses
- [x] Remove forwarding of S3 ETag/Cache-Control headers that caused mobile caching
- [x] Add ?v={currentVersionId} cache-buster to iframe src in EmbedPage and PlayerPage

## Bug Fix: Version Uploader Timeout on Large Files
- [x] Audit: root cause was streamToBuffer() loading entire ZIP into RAM before S3 upload, blocking the HTTP response
- [x] Replace streamToBuffer() with storagePutStream() in both /package and /version routes — streams file directly to S3 without RAM buffer
- [x] Remove unused streamToBuffer helper and createReadStream import
- [x] Rewrite UploadNewVersion component to use XHR with upload.onprogress for real byte-level progress
- [x] Two-phase progress: Phase 1 = XHR byte upload % (0-100%), Phase 2 = SSE extraction/CDN progress
- [x] XHR timeout set to 0 (unlimited) — server handles the 10-min timeout
- [x] phaseLabel updated to show "Uploading... 47%" during upload phase

## Bug Fix: Upload Silently Stops (Proxy Body Limit)
- [x] Root cause: reverse proxy silently drops requests exceeding its body size limit with no error
- [x] New chunkedUploadRoutes.ts: initiate / chunk / finalize endpoints at /api/chunked
- [x] Each chunk is 5 MB max — well under any proxy limit
- [x] Finalize assembles chunks into a temp file, then forwards to /api/upload/version/:id internally
- [x] All SSE extraction progress reused unchanged
- [x] UploadNewVersion UI: 3-step chunked flow with per-chunk XHR progress (shows "Uploading... 47%")
- [x] Installed form-data package for server-side multipart forwarding
- [x] Mounted /api/chunked router in server/_core/index.ts

## Bug Fix: Upload Still Timing Out After Chunked Upload
- [x] Root cause: finalize was forwarding the 457 MB assembled file via internal HTTP POST — same proxy limit
- [x] Fix: export processZipVersion + emitProgress from scormUploadRoutes
- [x] Fix: chunkedUploadRoutes finalize now calls processZipVersion directly — no HTTP forward at all
- [x] Fix: storagePutStream rewritten to use form-data + Node http.request piping — truly streams to S3 without loading file into RAM
- [x] Finalize responds immediately after storagePutStream + updatePackage; extraction runs in background
- [x] SSE progress stream unchanged — client still receives extraction updates via /api/upload/progress/:id

## Bug Fix: Chunk Upload Stops at ~40%
- [x] Diagnosis: proxy idle timeout drops connection when sequential chunks leave gaps > ~60s
- [x] Reduced chunk size from 5 MB to 2 MB so each chunk completes faster
- [x] Changed from sequential to parallel batch upload (3 chunks at a time) to keep connection active
- [x] Added per-chunk retry with exponential backoff (1s, 2s, 4s) up to 3 retries
- [x] Per-chunk XHR timeout set to 2 minutes (was unlimited)
- [x] Accurate overall progress using per-chunk byte tracking across parallel uploads

## Feature: Restrict Large Uploads (>100 MB) to Site Owner Only
- [x] Server: /initiate rejects with 403 if totalBytes > 100 MB and user.openId !== OWNER_OPEN_ID
- [x] Frontend: passes totalBytes in initiate body; 403 error surfaces as toast with clear message
- [x] Chunk size reduced to 512 KB to pass through strict production proxy limits
- [x] Parallel batch size increased to 4 chunks at a time

## Feature: Version Restore + Auto-Delete + Upload Size Warning
- [ ] Add replacedAt timestamp column to content_package_versions table
- [ ] Generate and apply migration SQL
- [ ] DB helper: setVersionReplacedAt(versionId, timestamp)
- [ ] DB helper: getVersionsDueForDeletion(packageId) — versions where replacedAt < now - 30 days
- [ ] DB helper: deleteVersionAssets(versionId) — remove S3 files and DB rows
- [ ] tRPC procedure: packages.versions.restore — sets package currentVersionId, clears replacedAt on restored version, sets replacedAt on previously current version
- [ ] tRPC procedure: packages.versions.purgeExpired — deletes S3 assets + DB rows for versions past 30-day window (called on page load)
- [x] FileDetailPage Versions tab: "Restore" button on non-current versions
- [x] FileDetailPage Versions tab: "Auto-delete in Xd" amber badge + "Pending deletion" badge on replaced versions
- [ ] FileDetailPage Versions tab: confirmation dialog before restore (deferred)
- [x] Frontend: show "File size is restricted to 100 MB." inline warning when selected file exceeds 100 MB
- [x] Upload button disabled for oversized files for non-privileged users

## Feature: Split Admin Role into Site Admin + Org Admin
- [x] Schema: users.role enum updated to ["site_owner","site_admin","org_admin","user"]
- [x] Schema: org_members.role enum updated to include org_admin
- [x] Migrated existing admin users to site_admin
- [x] Applied migration SQL
- [x] Server: adminProcedure now allows site_owner + site_admin
- [x] Server: upload size gate — site_owner + site_admin = unlimited; org_admin + user = 100 MB cap
- [ ] Server: orgAdminProcedure scoped to their org (deferred)
- [ ] Server: packages/files queries for org_admin scoped to their assigned org only (deferred)
- [x] Frontend: role labels updated in Users admin panel (Site Admin, Org Admin, Owner, User)
- [x] Frontend: sidebar admin nav hidden from org_admin users
- [ ] Frontend: org_admin My Files shows only their org's packages (deferred)

## Feature: Org Admin Content Scoping
- [x] packages.list: filtered to org_admin's assigned org (getOrgIdForUser)
- [x] analytics.summary: scoped to org_admin's org
- [x] analytics.byPackage: 403 if package is outside org_admin's org
- [x] sessions.listByPackage: 403 if package is outside org_admin's org
- [x] folders.list: scoped to org_admin's assigned org
- [x] Helper getOrgIdForUser(userId) added to db.ts
- [x] No frontend changes needed — all queries return scoped data automatically

## Bug Fix: Upload Fails Mid-Way (Presigned S3 Multipart)
- [ ] Server: createMultipartUpload tRPC mutation — returns uploadId + array of presigned PUT URLs (one per 5 MB part)
- [ ] Server: completeMultipartUpload tRPC mutation — receives ETags from client, tells S3 to assemble, triggers ZIP processing
- [ ] Server: abortMultipartUpload tRPC mutation — cleanup on client cancel/error
- [ ] Client: UploadNewVersion uploads each part directly to S3 presigned URL (no proxy involved)
- [ ] Client: accurate per-part XHR progress (0-100%)
- [ ] Client: after all parts uploaded, calls completeMultipartUpload, then polls SSE for extraction progress
- [ ] Apply same flow to initial package upload (UploadPage)

## Bug Fix: Upload Permanently Broken — Direct-to-Storage Approach
- [ ] Investigate Forge API for presigned upload endpoint
- [ ] Test direct browser-to-S3 upload bypassing proxy entirely
- [ ] Implement chosen approach end-to-end
- [ ] Update UploadNewVersion UI for new flow

## LMS Platform Build — Full Feature Set

### Phase 2: LMS Database Schema Extensions
- [ ] Add `courses` table (title, slug, description, thumbnail_url, promo_video_url, status, org_id, instructor_id, settings JSON, is_private, is_hidden, disable_text_copy)
- [ ] Add `course_sections` table (course_id, title, sort_order, is_free_preview, description)
- [ ] Add `course_lessons` table (section_id, course_id, title, lesson_type enum, content JSON, sort_order, duration_seconds, is_free_preview, is_published, drip_days)
- [ ] Add `course_enrollments` table (course_id, user_id, org_id, enrolled_at, completed_at, progress_pct, last_lesson_id, expires_at)
- [ ] Add `lesson_progress` table (enrollment_id, lesson_id, user_id, status enum, completed_at, time_spent_seconds, scorm_data JSON)
- [ ] Add `course_pricing` table (course_id, pricing_type enum, price, sale_price, currency, payment_plan JSON, access_days, is_free)
- [ ] Add `coupons` table (org_id, code, discount_type, discount_value, max_uses, used_count, expires_at, applies_to JSON)
- [ ] Add `org_theme` table (org_id, primary_color, accent_color, bg_mode enum, font_family, admin_logo_url, favicon_url, custom_css)
- [ ] Add `page_builder_pages` table (org_id, course_id, page_type enum, blocks JSON, is_published, updated_at)
- [ ] Add `certificates` table (enrollment_id, user_id, course_id, issued_at, cert_url, cert_data JSON)
- [ ] Add `org_subscriptions` table (org_id, plan enum, stripe_subscription_id, status, current_period_end)
- [ ] Extend `org_members` role enum: org_admin, sub_admin, instructor, member
- [ ] Add `instructors` table (user_id, org_id, bio, avatar_url, title, social_links JSON)
- [ ] Add `course_reviews` table (course_id, user_id, rating, review_text, created_at)
- [ ] Add `drip_schedule` table (course_id, lesson_id, release_type enum, release_days, release_date)
- [ ] Add `social_sharing` settings to courses (enable_chapter_share, enable_completion_share, share_text)
- [ ] Run migration SQL via webdev_execute_sql

### Phase 3: LMS Server Procedures
- [ ] courses.create / update / delete / list / get
- [ ] courses.publish / unpublish / duplicate
- [ ] courses.sections.create / update / delete / reorder
- [ ] courses.lessons.create / update / delete / reorder
- [ ] courses.enroll / unenroll (admin + student self-enroll)
- [ ] courses.progress.update / get
- [ ] courses.pricing.set / get
- [ ] courses.settings.update (basic, appearance, completion, SEO, drip, social sharing)
- [ ] org.theme.get / update (role-gated: org_admin, sub_admin, instructor only)
- [ ] org.branding.update (logo, favicon, colors — role-gated)
- [ ] pageBuilder.get / save (per course or per page type)
- [ ] certificates.issue / get / list / download
- [ ] coupons.create / validate / apply / list
- [ ] enrollments.list (admin) / myEnrollments (student)
- [ ] instructors.get / update profile
- [ ] reviews.create / list / delete

### Phase 4: Admin Dashboard Shell & Theming
- [ ] Extend DashboardLayout sidebar: add LMS sections (Courses, Students, Analytics, Site Builder, Settings)
- [ ] Org theme panel: light/dark mode toggle, primary color picker, accent color picker, font selector
- [ ] Theme panel gated to org_admin, sub_admin, instructor roles only
- [ ] Persist theme to DB and apply CSS variables dynamically to admin shell
- [ ] Role-based sidebar item visibility
- [ ] Update Dashboard home with LMS stats: total courses, active enrollments, revenue, completion rate
- [ ] Add org branding settings page (logo upload, favicon, school name, custom domain)

### Phase 5: Course Builder (Admin)
- [ ] Course list page: thumbnail, status badge (Draft/Published), enrollment count, revenue
- [ ] New course wizard: title, slug, thumbnail upload, description, instructor assignment
- [ ] Course editor: Teachable-style top tabs — Curriculum / Settings / Pricing / After Purchase / Drip Schedule
- [ ] Curriculum editor: drag-and-drop sections and lessons, add/remove/reorder
- [ ] Lesson types: Video, Text/Rich Text, SCORM/ZIP (reuse existing), Quiz (reuse existing), PDF, Audio, Assignment
- [ ] Course settings sub-nav: Basic Settings, Image & Description, Course Player Appearance, Progress & Completion, Page Code, Drip Schedule, Admins/Revenue Partners/Affiliates, SEO, Social Sharing
- [ ] Pricing tab: free, one-time, subscription, payment plan, bundle
- [ ] After Purchase tab: redirect URL, welcome email, upsell funnel
- [ ] Drip schedule: by enrollment date, specific date, or course start
- [ ] Design templates selector (multiple layout options)
- [ ] Course player appearance: theme color, sidebar style, progress bar style

### Phase 6: Thinkific-Style Page Builder
- [ ] Page builder shell: left block panel, center live preview, header with Desktop/Mobile/Fullscreen toggle, Save/Discard
- [ ] Block types: Banner (hero), Text, Image, 3-Image grid, Video, Curriculum (auto), Pricing Options, Testimonials, CTA, Instructor Bio, Checklist, FAQ, Countdown Timer
- [ ] Each block: drag to reorder, click to edit inline, duplicate, delete
- [ ] Banner block: background image/color, title, subtitle, CTA button, price dropdown
- [ ] Pricing block: course pricing options with "Get started now" buttons
- [ ] Curriculum block: auto-renders sections/lessons with free preview badges
- [ ] Mobile preview mode toggle
- [ ] Save publishes page builder state to DB
- [ ] Theme settings tab: colors and fonts from org theme

### Phase 7: Student-Facing Storefront
- [ ] School home page: rendered from page builder blocks with org branding
- [ ] Course catalog page: grid/list of published courses with category filters
- [ ] Course sales page: rendered from page builder blocks, pricing sidebar
- [ ] Student enrollment/checkout flow
- [ ] My Enrollments / Student Dashboard
- [ ] Student profile page
- [ ] Apply org theme (primary color, font, logo) to all student-facing pages

### Phase 8: Teachable-Style Course Player
- [ ] Course player layout: minimal top bar (home icon, settings, Previous / Complete & Continue), left sidebar (collapsible sections + lesson list), main content area
- [ ] Sidebar: search by lesson title, section headers, lesson type icons, completion status circles
- [ ] Lesson types rendered: video player, rich text, SCORM iframe (reuse proxy), quiz engine, PDF viewer
- [ ] Progress tracking: mark complete, auto-advance, track time spent
- [ ] Complete & Continue button advances to next lesson
- [ ] Course completion: trigger certificate, show completion screen
- [ ] Notes panel (optional per org settings)
- [ ] Fullscreen toggle for SCORM/video content

### Phase 9: Stripe Billing
- [ ] Platform subscription tiers: Free (1 course, 25 students), Starter ($39/mo), Builder ($99/mo), Pro ($199/mo)
- [ ] Per-org Stripe Connect for student course payments
- [ ] Coupon/discount code at checkout
- [ ] Payment plan support (installments)
- [ ] Subscription management page
- [ ] Webhook: subscription created/updated/cancelled

### Phase 10: Analytics, Certificates & Reporting
- [ ] Enrollment analytics: total enrollments, active students, completion rate, revenue
- [ ] Per-course analytics: lesson completion funnel, quiz scores, time spent
- [ ] Student progress report
- [ ] Certificate template builder: org logo, student name, course name, date, signature
- [ ] Auto-issue certificate on course completion
- [ ] Certificate PDF download
- [ ] Export student data as CSV

## LMS Course Player Enhancements
- [ ] Course player: toggle to show/hide lesson type icons in sidebar (per-course setting, admin/instructor controlled, stored in course settings)
- [ ] Course publishing: three visibility states — Published (in catalog), Hidden (direct link only, not in catalog), Private (admin-only manual enrollment, no self-enrollment)
- [ ] Update course status enum to include hidden/private visibility alongside draft/published/archived
- [ ] Course builder: show visibility selector with descriptions for each option
- [ ] Storefront catalog: filter out hidden and private courses from public listing
- [ ] Private courses: block self-enrollment, show "Contact admin to enroll" message
- [ ] Gate Hidden and Private course visibility to Pro and Enterprise tiers only — show upgrade prompt for lower tiers
- [ ] Video player controls: default to Teachific teal (#189aa1) scheme, customizable per org via branding settings (playerAccentColor applied to progress bar, play button, and controls)
- [ ] YouTube and Vimeo embed: available as video lesson type (paste URL, renders inline player) and as embed tool in rich text editor toolbar

## LMS Spec Cross-Reference (Apr 2026)
- [ ] Add showCompleteButton, enableCertificate, language, trackProgress, requireSequential, copiedFromId to courses schema
- [ ] DB migration for new courses columns
- [ ] lms.courses.copy - duplicate a course with all sections and lessons
- [ ] lms.courses.archive - set status to archived
- [ ] lms.curriculum.copyLesson - copy lesson to another course/section
- [ ] lms.curriculum.copySection - copy section to another course
- [ ] lms.ai.generateCourse - AI course generator (topic to modules and lessons)
- [ ] lms.ai.generateQuiz - AI quiz generator from topic or lesson content
- [ ] lms.ai.generateFlashcards - AI flashcard generator
- [ ] lms.media.getUploadUrl - S3 upload URL for lesson media files
- [ ] Full lesson editor dialog for all 12 lesson types in CourseBuilderPage
- [ ] Video lesson editor: URL input (YouTube/Vimeo/Wistia/direct), provider selector, rich text add-on
- [ ] Text lesson editor: full Tiptap rich text with YouTube/Vimeo embed
- [ ] Audio lesson editor: file upload or URL, rich text add-on
- [ ] PDF lesson editor: file upload or URL, rich text add-on
- [ ] SCORM/ZIP lesson editor: link to existing content package
- [ ] Web link lesson editor: URL input, embed toggle, rich text add-on
- [ ] Download lesson editor: file upload or URL, filename, rich text add-on
- [ ] Quiz lesson editor: link to existing quiz or create new
- [ ] Flashcard lesson editor: inline flashcard editor (front/back pairs)
- [ ] Exam lesson editor: link to quiz with exam settings (time limit, pass score)
- [ ] Assignment lesson editor: instructions (rich text), submission type
- [ ] Zoom/Teams lesson editor: platform, meeting URL, scheduled datetime, duration, recurrence
- [ ] Per-lesson settings: isFreePreview, isPublished, durationSeconds, drip settings
- [ ] CourseBuilderPage Settings - Image and Description: thumbnail upload, promo video URL, description (rich text), short description
- [ ] CourseBuilderPage Settings - Player Appearance: theme color, sidebar style, show progress, allow notes, show lesson icons
- [ ] CourseBuilderPage Settings - Progress and Completion: completion type, showCompleteButton, requireSequential, enableCertificate
- [ ] CourseBuilderPage Settings - After Purchase: redirect URL, welcome email, upsell course selector
- [ ] CourseBuilderPage Settings - Page Code: header/footer code textareas
- [ ] CourseBuilderPage Settings - SEO: title, description
- [ ] CourseBuilderPage Settings - Social Sharing: share toggles, share text
- [ ] CourseBuilderPage Settings - Language: default language selector
- [ ] CourseBuilderPage Settings - Design Template: template selector
- [ ] CoursesPage: Copy/Duplicate course action
- [ ] CoursesPage: Archive course action
- [ ] CoursesPage: Status filter tabs (All/Draft/Published/Hidden/Private/Archived)
- [ ] CoursesPage: AI Course Generator modal
- [ ] CoursePlayerPage: Lesson icon toggle (respect course.playerShowLessonIcons)
- [ ] CoursePlayerPage: Sidebar search filter
- [ ] CoursePlayerPage: Notes panel (when playerAllowNotes is true)
- [ ] CoursePlayerPage: Completion screen with certificate download
- [ ] CoursePlayerPage: showCompleteButton respect course setting
- [ ] CoursePlayerPage: requireSequential lock future lessons
- [x] Student My Courses dashboard (/school/my-courses and /school/:orgSlug/my-courses)
- [ ] Enrollment flow: enroll button, confirm, redirect to player
- [ ] Free course auto-enrollment on click
- [ ] Preview access: free preview lessons without enrollment
- [ ] Private course: show Contact admin to enroll message
- [ ] Student profile page (/school/profile)
- [ ] Members: bulk upload via CSV/Excel
- [ ] Members: manual enrollment of member to course
- [ ] Members: member detail with courses, progress, certificates

## Media Library Consolidation
- [x] Create MediaLibraryPage with three tabs: Upload Content (SCORM/HTML5), My Files (uploaded media), Quizzes
- [x] Remove Upload Content, My Files, and Quizzes from sidebar nav
- [x] Add single "Media Library" link to sidebar nav in their place
- [x] Update all internal links/routes to point to /media-library

## Subscription Tier Gating
- [ ] Define TIER_LIMITS constant with per-plan limits (courses, members, storage, features)
- [ ] Server: gate course count per org by plan (Free: 3, Starter: 10, Builder: 25, Pro: unlimited, Enterprise: unlimited)
- [ ] Server: gate member count per org by plan (Free: 50, Starter: 200, Builder: 1000, Pro: 5000, Enterprise: unlimited)
- [ ] Server: gate AI course generation to Builder+ plans
- [ ] Server: gate AI quiz/flashcard generation to Builder+ plans
- [ ] Server: gate custom domain to Pro+ plans
- [ ] Server: gate drip scheduling to Builder+ plans
- [ ] Server: gate certificates to Starter+ plans
- [ ] Server: gate course bundles to Builder+ plans
- [ ] Server: gate advanced analytics to Pro+ plans
- [ ] Server: gate Zoom/Teams live sessions to Pro+ plans
- [ ] Server: gate hidden/private courses to Pro+ (already done)
- [ ] Server: gate custom CSS/page code to Pro+ plans
- [ ] Server: gate Zapier/webhook integrations to Pro+ plans
- [ ] Client: show upgrade prompt UI when hitting tier limits
- [ ] Client: show current plan badge on org settings page
- [ ] Client: disable/lock gated features with upgrade CTA
- [ ] Client: subscription management page for org admins

## Custom Pages Feature (Session Apr 2, 2026)
- [x] Update pages.update mutation to include showHeader, showFooter, metaTitle, metaDescription, customCss fields
- [x] Build CustomPagesPage UI with rich text editor (TipTap), slug input, show/hide header/footer toggles, SEO fields, custom CSS textarea
- [x] Add Custom Pages route to App.tsx (/lms/custom-pages)
- [x] Add Custom Pages nav link to Administration section in DashboardLayout
- [x] Verify showHeader/showFooter/metaTitle/metaDescription/customCss columns exist in DB

## Banner Display in CoursePlayerPage (Session Apr 2, 2026)
- [x] Import BANNER_SOUNDS from LessonBannerEditor for sound playback
- [x] Add LessonBanner component with top/bottom bar and left popover positions
- [x] Add playBannerSound helper function
- [x] Add activeBanner state and bannerTimerRef to CoursePlayerPage
- [x] Show start banner when lesson changes (with auto-dismiss)
- [x] Show completion banner when lesson is marked complete (with auto-dismiss)
- [x] Render LessonBanner overlay in CoursePlayerPage JSX

## Bug Fix: TeachificStudio Video Upload Stalls
- [x] Add timeout + retry logic to storagePutStream in storage.ts
- [x] Fix client XHR to distinguish browser→server progress from server→storage progress (two-phase label)
- [ ] Test large video upload end-to-end in TeachificStudio

## Vimeo Support (Already Implemented)
- [x] Vimeo URLs already handled in CoursePlayerPage video case (lines 245-248)
- [x] Converts vimeo.com/{id} to https://player.vimeo.com/video/{id} embed URL

## Searchable Organization Selector in Custom Pages
- [x] Replace plain <select> with a searchable combobox (input + filtered dropdown) in CustomPagesPage

## Custom Teachific-Branded Authentication System (Replace Manus OAuth)
- [ ] Design new auth schema: users table with email, passwordHash, emailVerified, resetToken, resetTokenExpiry
- [ ] Build registration endpoint: POST /api/auth/register (email, password, name) → create user, send verification email
- [ ] Build login endpoint: POST /api/auth/login (email, password) → verify credentials, return JWT session token
- [ ] Build logout endpoint: POST /api/auth/logout → clear session cookie
- [ ] Build password reset flow: POST /api/auth/forgot-password (email) → send reset link, POST /api/auth/reset-password (token, newPassword)
- [ ] Build email verification flow: GET /api/auth/verify-email?token=xxx → mark user as verified
- [ ] Replace Manus OAuth callback route with custom login page at /login
- [ ] Build registration page at /register with Teachific branding
- [ ] Build forgot password page at /forgot-password
- [ ] Build reset password page at /reset-password
- [ ] Update DashboardLayout to use custom auth context instead of Manus useAuth
- [ ] Update all protected routes to check custom JWT session instead of Manus OAuth
- [ ] Remove Manus OAuth dependencies from server/_core/oauth.ts and server/_core/context.ts
- [ ] Update login/logout UI to use Teachific branding (logo, colors, copy)
- [ ] Write vitest tests for registration, login, password reset flows

## Enhanced Users Page with Org Filter/Search/Sort
- [ ] Add organization filter dropdown (searchable combobox) to Users page
- [ ] Add search input to filter users by name or email
- [ ] Add sort dropdown: Name (A-Z), Name (Z-A), Email (A-Z), Role, Date Joined
- [ ] Show user's organization(s) in the users table
- [ ] Add "Delete User" action for site owner/admins
- [ ] Add confirmation dialog for user deletion
- [ ] Update users.list tRPC procedure to accept orgId, search, sortBy params
- [ ] Show empty state when no users match filters

## Workspace/Organization Deletion
- [ ] Add "Delete Organization" button to Organizations page (visible only to site owner and site admins)
- [ ] Build confirmation dialog: warn that all courses, content, users, and data will be permanently deleted
- [ ] Build orgs.delete tRPC procedure (site owner/admin only)
- [ ] Cascade delete: remove all org-owned courses, lessons, content packages, pages, enrollments, sessions, analytics
- [ ] Show toast notification on successful deletion
- [ ] Redirect to Organizations list after deletion
- [ ] Write vitest test for org deletion with cascade checks

## Email Marketing System via SendGrid
### Database Schema
- [ ] Create email_templates table (id, orgId, name, subject, htmlBody, textBody, isDefault, createdAt, updatedAt)
- [ ] Create email_campaigns table (id, orgId, name, templateId, subject, status [draft, scheduled, sending, sent], scheduledAt, sentAt, recipientCount, openCount, clickCount, createdBy, createdAt)
- [ ] Create email_campaign_recipients table (id, campaignId, userId, email, status [pending, sent, failed, bounced], sentAt, openedAt, clickedAt)
- [ ] Create email_unsubscribes table (id, userId, email, orgId, unsubscribedAt, reason)
- [ ] Generate and apply migration SQL for all email tables

### SendGrid Integration
- [ ] Install @sendgrid/mail npm package
- [ ] Create server/sendgrid.ts helper with sendEmail(to, subject, html, text, fromName, fromEmail) function
- [ ] Request SENDGRID_API_KEY from user via webdev_request_secrets
- [ ] Build email sending queue: campaigns.send procedure processes recipients in batches
- [ ] Track delivery status: update email_campaign_recipients with sent/failed/bounced status
- [ ] Handle SendGrid webhooks for open/click tracking (POST /api/webhooks/sendgrid)
- [ ] Build unsubscribe link generator: {{unsubscribe_url}} placeholder in templates
- [ ] Build unsubscribe landing page: GET /unsubscribe?token=xxx → mark user as unsubscribed from org
- [ ] Respect unsubscribe status: filter out unsubscribed users before sending campaigns

### Email Templates
- [ ] Build 5 default email templates: Welcome, Course Enrollment, Course Completion, Newsletter, Announcement
- [ ] Each template includes: subject line, HTML body, plain text fallback, merge tags ({{user_name}}, {{org_name}}, {{course_title}}, {{unsubscribe_url}})
- [ ] Seed default templates for each org on first access to email marketing page
- [ ] Build template editor UI: rich text editor for HTML body, plain text textarea, subject line input
- [ ] Allow org admins to customize templates: edit subject, body, add custom CSS, preview before saving
- [ ] Template preview modal: show rendered HTML with sample merge tag values
- [ ] Template duplication: "Duplicate Template" button creates a copy for customization

### Email Marketing UI
- [ ] Build EmailMarketingPage at /lms/email-marketing (visible to org admins and site owner)
- [ ] Add "Email Marketing" nav link to Administration section in DashboardLayout
- [ ] Campaign list view: show all campaigns with status, recipient count, open rate, click rate, sent date
- [ ] Campaign creation wizard: Step 1 - Select template, Step 2 - Customize subject/body, Step 3 - Select audience, Step 4 - Schedule or send now
- [ ] Audience selector: All members, Enrolled in specific course, Completed specific course, Custom filter (role, join date range)
- [ ] Campaign preview: show recipient count, preview email with merge tags resolved
- [ ] Send confirmation dialog: "Send to X recipients now?" with final preview
- [ ] Campaign detail page: show send status, recipient list with open/click status, resend to failed recipients
- [ ] Template management page: list all templates, create/edit/delete/duplicate
- [ ] Unsubscribe management page: list all unsubscribed users per org, allow manual re-subscription

### Site Owner → Org Admin Communication
- [ ] Site owner can send campaigns to "All Org Admins" audience
- [ ] Site owner email marketing page shows campaigns sent to org admins vs org members
- [ ] Org admins cannot see site owner's campaigns to other orgs
- [ ] Site owner campaigns use site-level unsubscribe (not org-level)

### Testing
- [ ] Write vitest tests for email sending, unsubscribe flow, audience filtering
- [ ] Test SendGrid integration with test API key
- [ ] Test merge tag replacement in templates
- [ ] Test org-level unsubscribe isolation (unsubscribe from Org A, still receive from Org B)

## Custom Sender Domain/Email for Org Admins (Builder+ Tier)
- [ ] Add customSenderEmail and customSenderName columns to organizations table
- [ ] Add senderDomainVerified boolean column to organizations table
- [ ] Add senderDomainVerifiedAt timestamp to organizations table
- [ ] Build UI in org settings for Builder+ admins to set custom from name and email
- [ ] Validate custom email domain against org subscription tier (Builder and above only)
- [ ] Use custom sender email/name when sending campaigns for that org (fall back to hello@teachific.net for Free/Starter)
- [ ] Show "Custom Sender" badge in email marketing page when custom domain is active
- [ ] Show upgrade prompt for Free/Starter orgs trying to set custom sender

## Fix Custom CSS Injection Scope
- [ ] Remove custom CSS injection from admin dashboard / DashboardLayout
- [ ] Apply org custom CSS only to student-facing routes: course player, course catalog, learner dashboard, enrollment pages, certificate pages, public custom pages
- [ ] Build a StudentLayout wrapper that loads the active org's custom CSS and injects it into a <style> tag scoped to student pages
- [ ] Admin dashboard always uses Teachific default branding (no custom CSS override)
- [ ] Custom CSS editor in org settings should preview in a student-page context, not admin context

## Platform Admin Nav Fix
- [x] Remove Platform Admin header button from DashboardLayout top bar
- [x] Platform Admin remains in profile dropdown (site_owner/site_admin only)
- [x] Profile menu order: Profile, Organization Settings, (divider), Platform Admin [admin only], (divider), Sign Out

## Sidebar Settings → Org Setup
- [x] "Settings" link in sidebar nav now points to /lms/settings (org settings page)
- [x] Profile dropdown "Settings" now says "Organization Settings" and points to /lms/settings
- [ ] Create OrgSettingsPage at /lms/settings with tabs: General, Branding, Domain, Email Sender, Subscription
- [ ] General tab: org name, slug, description, contact email
- [ ] Domain tab: custom domain binding instructions and status
- [ ] Email Sender tab: custom from name and email (Builder+ only), with upgrade prompt for lower tiers
- [ ] Subscription tab: current plan, usage stats, upgrade CTA

## Branding Page: Logo Upload
- [ ] Add logo upload section to BrandingPage (org logo used in student-facing pages, school page, course player header)
- [ ] Upload logo to S3 via storagePut, save URL to org record (organizations.logoUrl column already exists)
- [ ] Show current logo preview with remove button
- [ ] Logo accepted formats: PNG, JPG, SVG, WebP — max 2MB
- [ ] Logo displayed in: SchoolPage header, CoursePlayerPage header, email templates (org logo)

## Bug: Add Course → 404
- [x] Fix /lms/courses/new route — "new" is being matched as :id by the dynamic route, causing 404
- [x] Ensure /lms/courses/new is declared before /lms/courses/:id in App.tsx router
- [x] Add /lms/courses/:id/curriculum, /settings, /pricing, /drip, /after_purchase routes to App.tsx
- [x] CourseBuilderPage derives active tab from URL sub-path

#- [x] Org Admin Dashboard Redesign (LmsDashboardPage.ts- [x] Replace the current Dashboard.tsx with an org-focused analytics dashboard
- [x] Welcome header with org name and greeting
- [x] Key metrics cards: Total Revenue (past 30 days), New Registrations (past 30 days), Course Sales (past 30 days), Active Members
- [x] Revenue/enrollment chart with daily/weekly/monthly toggle (line chart showing revenue or enrollment trend)
- [x] Live activity feed (right sidebar): recent enrollments, course purchases, logins — show user name, course name, timestamp, price (if sale)
- [x] Recently edited courses section: grid of course cards with thumbnail, title, status badge (Published/Draft), last edited timestamp
- [x] All data scoped to the org admin's organization (org_admin sees their org only, site_owner/site_admin see all orgs or selected org)
## Member (Learner) Dashboard
- [ ] When logged-in user role is "user" (org member), show a learner home dashboard instead of the admin dashboard
- [ ] Display course cards for all courses the member is enrolled in or has access to
- [ ] Each card shows: course thumbnail, title, org name, progress bar (% complete), "Continue" or "Start" button
- [ ] Group by: In Progress, Not Started, Completed
- [ ] If no courses, show a friendly empty state with a link to the course catalog
- [ ] Role-based routing: org_admin and above → org admin dashboard; user role → learner dashboard

## Full WYSIWYG Drag-and-Drop Page Builder
- [ ] Replace simple text editor with a full block-based page builder
- [ ] Left panel: section type library (Banner, Text+Media, Image Block, CTA, Course Outline, Video, Testimonials, Pricing, Checklist, Social Proof, HTML Block)
- [ ] Canvas: live WYSIWYG preview with click-to-edit inline editing
- [ ] Drag to reorder sections (dnd-kit)
- [ ] Each block has a settings panel (background color, text, image URL, button text/link, etc.)
- [ ] Banner block: full-width hero with background image/color, headline, subtext, CTA button
- [ ] Text & Media block: left/right image + text layout
- [ ] Image Block: gallery or single image with caption
- [ ] CTA block: centered headline + button
- [ ] Course Outline block: pulls curriculum from a selected course
- [ ] Video block: embed YouTube/Vimeo or upload
- [ ] Testimonials block: quote cards with avatar, name, role
- [ ] Pricing block: shows pricing options from a selected course
- [ ] Checklist block: bullet list with checkmark icons
- [ ] HTML block: raw HTML/CSS/JS injection
- [ ] Page settings panel: slug, SEO title/description, show/hide header+footer
- [ ] Save and publish controls
- [ ] Public renderer at /p/:slug for published pages

## Org Auto-Detection (No Manual Org Selection for Org Admins)
- [ ] Org admins should never see an org selector dropdown — their org is auto-detected from their membership
- [ ] All lmsRouter dashboard/analytics/course procedures should derive orgId from ctx.user's org membership, not from input
- [ ] If a user is admin of multiple orgs, show an org switcher in the header (not a dropdown on every page)
- [ ] Platform Admin pages are the only place where org filtering/sorting by organization is shown

## Nav Restriction: Platform Admin Items Stay in Platform Admin
- [ ] Remove any org-level filtering/sorting from the sidebar nav menu items
- [ ] Sidebar nav items (Courses, Members, Analytics, etc.) should be scoped to the user's current org automatically
- [ ] Organization selector/filter belongs only in Platform Admin panel

## Course Image Upload in Course Settings
- [ ] Add thumbnail/cover image upload to course settings (General tab in CourseBuilderPage)
- [ ] Upload via S3 storagePut, store URL in courses.thumbnailUrl
- [ ] Show thumbnail on course cards in CoursesPage and learner dashboard

## Pricing Plan Improvements
- [ ] Add "Free" option as a primary pricing type (no payment required, instant enrollment)
- [ ] Add "Monthly Payment Plan" option: total price divided into N monthly payments
- [ ] Payment plan fields: number of payments (e.g. 3), amount per payment, total price
- [ ] Show payment count on pricing cards (e.g. "3 payments of $33.33")
- [ ] Primary pricing section: Free / One-time / Subscription / Payment Plan radio selector
- [ ] Additional pricing options: allow multiple pricing tiers per course
- [ ] Copy enrollment link button per pricing option

## Course Builder Content Editor Improvements
- [ ] Move lesson content editor from left slide-out to a right-side panel (full height, wide enough for proper editing)
- [ ] Editor panel should keep curriculum list visible on the left while editor opens on the right
- [x] Add AI content generator button in the lesson editor toolbar
- [ ] AI generator: prompt input → generates lesson text, summaries, quiz questions, or outlines
- [x] AI generator uses invokeLLM server-side via a new tRPC mutation (lms.lessons.generateContent)
- [ ] Show generated content in a preview/insert dialog before applying to the editor

## Lesson Banner Editor Improvements
- [ ] Add left/right popout position toggle for the popout banner type (currently only supports left)
- [ ] Add image upload support for banner images (not just URL entry)
- [ ] Image upload should use storagePut to upload to S3 and return the public URL
- [ ] Store the uploaded image URL in the banner config (startBanner.imageUrl, completeBanner.imageUrl)

## Course Builder Right Panel Width
- [x] Widen the right slide-out lesson editor panel to cover 72vw (was max-w-2xl = 672px)
- [x] Panel now overlays the curriculum list with proper width for content editing

## Sound Preview Fix in Banner Editor
- [ ] Fix sound preview buttons — Pixabay CDN URLs are unreliable/blocked
- [ ] Upload 5 reliable notification sounds to Teachific CDN (chime, bell, success, fanfare, ding)
- [ ] Replace BANNER_SOUNDS URLs with CDN-hosted versions

## Auto-Open Lesson Editor on New Lesson
- [ ] When a new lesson is created in CourseBuilderPage, automatically open the lesson editor panel (LessonEditorSheet) for the newly created lesson
- [ ] No need for the user to click "Edit" after adding a lesson — editor opens immediately

## Bug: Web Link Lesson Save Error
- [x] Fix updateLesson mutation sending null for packageId, quizId, durationSeconds — should send undefined (omit) instead of null
- [x] Strip null values from the form payload before calling updateLesson mutation in LessonEditorSheet

## Quiz & Exam Question Type Overhaul
- [ ] Remove dependency on pre-existing question bank for exams — allow standalone question creation
- [ ] Add AI question generator: prompt → auto-generate multiple choice, T/F, short answer questions
- [ ] Support question types: Multiple Choice, Short Answer, Long Answer (essay), True/False, Hotspot (point to area in image), Match Items (words ↔ words, words ↔ images)
- [ ] Each question can have: image upload, video upload, YouTube/Vimeo URL embed, file link
- [ ] Hotspot question: upload an image, draw clickable regions on it, student clicks the correct region
- [ ] Match Items: drag-and-drop pairs, support image thumbnails on either side of the pair
- [ ] Short/Long Answer: configurable word/character limits, optional rubric for grading
- [ ] All question types support rich text in the question stem (bold, italic, lists, code)
- [ ] Quiz/Exam builder: add questions manually, import from question bank, or AI generate
- [ ] Question bank: tag questions by topic/difficulty, reuse across multiple quizzes/exams

## Feature: Public Page Renderer + Block/Page Clipboard
- [x] Public page renderer at /p/:slug (published custom pages accessible publicly)
- [x] Block clipboard in PageBuilder: copy individual blocks to clipboard, paste into any page
- [x] Full page duplication in CustomPagesPage (duplicate page with all blocks)

## Feature: Course URL Display in Settings
- [x] Show full course URL (origin + /lms/courses/:slug) below slug field in Course Settings
- [x] One-click copy button to copy the full URL to clipboard

## Feature: Comprehensive Member Activity Tracking
- [ ] Add member_activity_events table (eventType, userId, orgId, courseId, lessonId, pageUrl, metadata, sessionId, durationMs, createdAt)
- [ ] Backend batch-insert procedure for activity events (fire-and-forget, no auth required for embed)
- [ ] useActivityTracker hook: auto page view on route change, session heartbeat every 30s, video play/pause/complete, click tracking
- [ ] Wire tracker into LMS DashboardLayout so it runs on every authenticated member page
- [ ] Member Activity analytics page: per-member timeline, page views, video events, session durations
- [ ] Admin can filter by member, date range, course, event type

## Feature: Student Log Reports
- [ ] member_activity_events table with full event taxonomy (page_view, video_play/pause/complete, session_heartbeat, lesson_start/complete, quiz_start/submit, click, download, enrollment, course_complete)
- [ ] Batch-insert tRPC procedure for activity events (fire-and-forget)
- [ ] useActivityTracker hook: auto page view, 30s heartbeat, video instrumentation, click tracking
- [ ] Wire tracker into LMS DashboardLayout for all authenticated pages
- [ ] Student Log Reports page: filterable by student, date range, course, event type
- [ ] Per-student timeline view with event icons and timestamps
- [ ] Summary stats: total time, pages visited, videos watched, lessons completed
- [ ] CSV export of raw event log

## Feature: Email Templates Editor (Org Settings)
- [ ] email_templates table: orgId, templateKey (welcome, enrollment, completion, quiz_result, reminder, announcement), subject, htmlBody, isEnabled, logoUrl, primaryColor, footerText
- [ ] Backend CRUD procedures for email templates
- [ ] Email Templates tab in Org Settings with template list
- [ ] Rich HTML editor for each template with variable placeholders ({{firstName}}, {{courseName}}, etc.)
- [ ] Theme customization: primary color, logo upload, footer text
- [ ] Live email preview panel (rendered HTML)

## Feature: Notification Toggles (Org-wide + Per-course)
- [ ] Add notificationSettings JSON column to org_themes (or organizations): toggles for enrollment, completion, quiz_result, reminder, announcement
- [ ] Add courseNotificationOverrides JSON column to courses table
- [ ] Notifications tab in Org Settings: org-wide on/off toggles per notification type
- [ ] Notification overrides section in Course Settings: inherit from org or override per course
- [ ] Backend procedures to get/update org notification settings and course overrides

## Feature: Web Design Blocks in Course Lesson Content
- [ ] Background Image Section block (full-width section with bg image, overlay, text overlay)
- [ ] Banner Image block (image with optional caption and link)
- [ ] CTA Section block (headline, subtext, primary button, secondary button, background color)
- [ ] Button block (single styled button with URL, style variants: primary/secondary/outline/ghost)
- [ ] Pre-formatted List blocks: Checklist (checkmarks), Icon List (custom icons), Numbered Steps, Feature Grid
- [ ] All new blocks available in PageBuilder block library and renderable in lesson content

## Feature: Digital Downloads Sales Module
- [ ] digital_products table (title, slug, description, fileUrl, fileKey, fileType, fileSize, salesPageBlocksJson, thumbnailUrl, orgId, isPublished)
- [ ] digital_product_prices table (productId, label, amount, currency, type: one_time|payment_plan, installments, installmentAmount, intervalDays)
- [ ] digital_orders table (productId, priceId, orgId, buyerEmail, buyerName, amount, status, paymentRef, accessExpiresAt, maxDownloads, downloadCount, downloadToken, createdAt)
- [ ] digital_download_logs table (orderId, productId, downloadedAt, ipAddress, userAgent)
- [ ] Backend: product CRUD, file upload to S3, order creation, download token generation
- [ ] Backend: access control check (expiry, download count limit), download log insert
- [ ] Backend: download notification email on purchase
- [ ] Admin: DigitalProductsPage (list, create, publish/unpublish)
- [ ] Admin: DigitalProductEditorPage (file upload, pricing plans, sales page builder, access controls)
- [ ] Public: /shop/:slug sales page with product info, pricing, buy button
- [ ] Checkout: payment form (single payment + payment plan), order confirmation page
- [ ] Secure download: /api/download/:token endpoint with access control
- [ ] Admin: Digital Downloads Reports (orders table, download logs, per-buyer access status)
- [ ] Sidebar nav entry for Digital Downloads under admin section

## Feature: Webinar Module
- [ ] Webinar DB tables: webinars, webinar_registrations, webinar_sessions, webinar_funnel_steps
- [ ] Backend tRPC procedures: webinar CRUD, registration, session tracking, funnel steps, AI viewer count
- [ ] WebinarsPage admin list
- [ ] WebinarEditorPage: details, video (upload/embed/Zoom/Teams), schedule, AI viewers, funnel builder
- [ ] Public registration page /webinar/:slug/register with countdown timer and sales page blocks
- [ ] Webinar room /webinar/:slug/watch: video player, AI viewer ticker, live chat, post-webinar offer overlay
- [ ] Post-webinar funnel: CTA to product, custom URL, or thank-you page
- [ ] Webinar Reports page: registrations, attendance, funnel conversion, drop-off
- [ ] Wire routes and sidebar nav for webinars

## Feature: Mobile Responsiveness (All Admin & Org Pages)
- [ ] DashboardLayout: collapsible drawer sidebar on mobile, hamburger menu button
- [ ] OrganizationsPage: card/list layout on mobile instead of table
- [ ] UsersPage: card/list layout on mobile
- [ ] MembersPage: card/list layout on mobile
- [ ] AnalyticsPage: responsive stat cards and charts
- [ ] BrandingPage: responsive form layout
- [ ] CustomPagesPage: responsive table/list
- [ ] OrgSettingsPage: responsive tabs
- [ ] CourseBuilderPage: scrollable tab bar on mobile (done), responsive content
- [ ] MediaLibraryPage: stacked layout on mobile (no two-panel split)
- [ ] QuizBuilderPage: responsive question list
- [ ] WebinarsPage: responsive card/list
- [ ] DigitalProductsPage: responsive card/list

## Session: Mobile Responsiveness + New Features (Apr 2, 2026)
- [x] DigitalProductsPage: mobile card layout with dropdown actions
- [x] WebinarsPage: mobile card layout with dropdown actions
- [x] AdminUsersPage: mobile card row layout (hidden desktop columns on mobile)
- [x] MembersPage: responsive stats grid (1 col on mobile, 3 on sm+)
- [x] AdminOrgsPage, AdminPermissionsPage, AdminSettingsPage, PlatformAdminPage: responsive padding
- [x] DigitalProductEditorPage: all 2-col and 3-col grids responsive
- [x] WebinarEditorPage: all 2-col and 3-col grids responsive, tabs scrollable on mobile
- [x] CourseBuilderPage: all 2-col grids responsive
- [x] CoursesPage: stats grid and form grids responsive
- [x] BrandingPage, LmsAnalyticsPage: responsive padding
- [x] SchoolPage: stats grid responsive
- [x] OrgSettingsPage: tab bar scrollable on mobile (overflow-x-auto)
- [x] Digital Downloads route wired to /admin/downloads in App.tsx
- [x] Webinars route wired to /lms/webinars in App.tsx
- [x] Activity Log route wired to /lms/activity in App.tsx
- [x] DashboardLayout sidebar: Digital Downloads, Webinars, Activity Log nav items added
- [x] WebinarEditorPage: removed self-wrapping DashboardLayout
- [x] OrgSettingsPage: Email Templates tab added (list of 6 template types with Edit buttons)
- [x] OrgSettingsPage: Notifications tab added (5 toggle switches + course-level override info)
- [x] StudentLogReportsPage: built at /lms/activity with org picker, filters (student, course, event type, date range, search), summary stats, mobile card + desktop table layout, CSV export, pagination

## Bug Fixes Reported Apr 2, 2026 (Mobile Screenshots)
- [x] BrandingPage: remove "Admin Dashboard" tab - branding should only affect student-facing school, not admin UI
- [x] BrandingPage: fix page description to say "student school" not "admin dashboard and student school"
- [x] BrandingPage: add org logo upload section (PNG/JPG/SVG, max 2MB, stored in S3, shown on school page and course player)
- [x] DashboardLayout sidebar: restore styled "teach" + "ific" teal + "™" text lockup
- [x] DashboardLayout mobile header: styled Teachific™ logo lockup when no active page
- [x] Notification Settings wired to backend (lms.notifications procedures)
- [x] Email Templates tab wired to emailBranding backend (logo, color, footer, sender name)
- [x] LMS Dashboard page at /lms with metrics, revenue chart, recent activity, recent courses
- [x] My Courses (Learner Dashboard) page at /lms/my-courses
- [x] MembersPage rebuilt with full enrollment data, CSV export, manual enrollment dialog
- [x] AdminOrgsPage: edit/delete org actions with confirmation dialogs
- [x] CoursesPage: status filter tabs (All, Published, Draft, Archived)
- [x] Digital Downloads Reports page at /admin/downloads/reports
- [x] Webinar Reports page at /lms/webinars/reports
- [x] Email Marketing page at /lms/email-marketing with campaign CRUD and stats
- [x] Sidebar: Downloads Reports, Webinar Reports, Email Marketing links added
- [x] lmsDb: getMembersWithEnrollments, email campaign CRUD helpers added
- [x] lmsRouter: emailMarketing router, members.listWithEnrollments, members.manualEnroll added
- [x] routers.ts: orgs.delete procedure added

## Lesson-Level Settings + Prerequisite Gating (Apr 2, 2026)
- [x] Add lesson settings columns to DB: isPrerequisite, requiresCompletion, passingScore, allowSkip, estimatedMinutes
- [x] Generate and apply migration SQL (0021_giant_blo...)
- [x] Update updateLesson procedure to accept all new fields (lmsRouter.ts)
- [x] Add prerequisite gating section to LessonEditorSheet Settings tab
  - Prerequisite Gate toggle (isPrerequisite) with explanation
  - Require Completion toggle (requiresCompletion)
  - Allow Skip toggle (allowSkip)
  - Passing Score input (passingScore, for quiz/exam lessons)
  - Estimated Time input (estimatedMinutes)
- [x] Enforce gating in CoursePlayerPage: isLessonLocked() checks all prior prerequisite lessons
- [x] Show lock icon + 'Locked' label in lesson sidebar for gated lessons
- [x] Show 'Gate' badge on prerequisite lessons that are not yet completed
- [x] Show 'Prerequisite' badge in lesson header when lesson is a gate
- [x] Show locked overlay in main content area with link to prerequisite lesson
- [x] Block handleLessonClick for locked lessons with toast error naming the blocking lesson
- [x] Save checkpoint

## Sidebar Navigation Cleanup (Apr 2, 2026)
- [x] Merge "Dashboard" + "LMS Dashboard" into single "Dashboard" → /lms
- [x] Remove "My Courses" from sidebar top group (learner view accessible from Dashboard or Courses)
- [x] Group content items together: Courses, Digital Downloads, Webinars (in that order, under a CONTENT section label)
- [x] Remove "Downloads Reports" from sidebar
- [x] Remove "Webinar Reports" from sidebar
- [x] Remove "Activity Log" from sidebar (link from Analytics page instead)
- [x] Add "Reports" button/link inside DigitalProductsPage → /admin/downloads/reports
- [x] Add "Reports" button/link inside WebinarsPage → /lms/webinars/reports
- [x] Add report links to AnalyticsPage (Downloads Reports, Webinar Reports, Activity Log)
- [x] Keep final nav order: Dashboard, Media Library, [CONTENT: Courses, Digital Downloads, Webinars], Members, [ADMINISTRATION: Organizations, Users, Analytics, Branding, Custom Pages, Email Marketing, Settings]

## User Management Enhancements (Apr 2, 2026)
- [x] Backend: createUser procedure (name, email, password, role, orgId)
- [x] Backend: updateUser procedure (role, org assignment, name, email)
- [x] Backend: listUsersWithOrg procedure (includes org name column, searchable by org for platform admins)
- [x] Backend: assignUserToOrg procedure (platform admin only)
- [x] Backend: enrollUserInCourses procedure (bulk enroll user in selected courses)
- [x] AdminUsersPage: Add User button + dialog (name, email, temp password, role, org assignment for platform admins)
- [x] AdminUsersPage: Edit User sheet/dialog (role, org, enroll in courses)
- [x] AdminUsersPage: search includes organization column for platform admins
- [x] AdminUsersPage: org filter dropdown for platform admins
- [x] MembersPage: Add Member button + dialog (name, email, role, course enrollment)
- [x] MembersPage: Edit Member sheet (role change, course enrollment)

## Sidebar Navigation Redesign (Apr 2, 2026)
- [x] Add collapsible accordion groups to sidebar (Courses, Analytics, Settings expand inline)
- [x] Add sub-items under Courses: All Courses, Course Builder, Certificates, Coupons
- [x] Add sub-items under Analytics: Overview, Activity Log, Downloads Reports, Webinar Reports
- [x] Add sub-items under Settings: General, Branding, Custom Pages, Email Marketing, Integrations
- [x] Add sub-items under Users: All Users, Roles & Permissions, Invitations
- [x] Style sub-items with left border accent and indented text (Thinkific-style)
- [x] Add divider between content section and Administration section
- [x] Polish active state: teal background + white text for active item
- [x] Add hover state: subtle gray background
- [x] Improve section label styling: uppercase, small, muted

## Full Nav Restructure & New Pages (Apr 2, 2026)

### Nav Structure
- [x] Rewrite DashboardLayout navGroups: Dashboard, Members, Products, Marketing, Sales, Analytics, Integrations
- [x] Members group: All Users, Groups, Certificates, Discussions, Assignments
- [x] Products group: Courses, Digital Downloads, Webinars, Memberships, Bundles, Community, Categories, Media Library
- [x] Marketing group: Website, Email Campaigns, Funnels, Affiliates
- [x] Sales group: Orders, Subscriptions, Group Orders, Coupons, Invoices, Revenue Partners
- [x] Analytics group: Revenue, Engagement, Marketing, Custom Reports
- [x] Integrations group: Integrations, API, Webhooks
- [x] Profile dropdown: My Profile, Billing, Sign Out (remove extra items)

### New Pages (stubs)
- [x] /members/groups - Group Seat Manager tool
- [x] /members/certificates - Certificate template builder + automated flows
- [x] /members/discussions - Discussion forum management per course
- [x] /members/assignments - Assignment creator + management
- [x] /products/memberships - Membership plans page
- [x] /products/bundles - Bundle builder page
- [x] /products/community - Community builder tool
- [x] /products/categories - Category management page
- [x] /marketing/website - Website builder (home, landing pages, custom pages, tracking)
- [x] /marketing/email - Email campaigns, templates, automation workflows
- [x] /marketing/funnels - Funnel page builder
- [x] /marketing/affiliates - Affiliate management
- [x] /sales/orders - Orders management
- [x] /sales/subscriptions - Subscriptions (cancel, refund, transactions)
- [x] /sales/group-orders - Group registration management
- [x] /sales/coupons - Coupon/discount code builder
- [x] /sales/invoices - Invoice templates + automation
- [x] /sales/revenue-partners - Revenue partner setup
- [x] /analytics/revenue - Revenue analytics
- [x] /analytics/engagement - Engagement analytics
- [x] /analytics/marketing - Marketing analytics
- [x] /analytics/custom-reports - Custom reports builder
- [x] /integrations - Integrations/apps marketplace
- [x] /integrations/api - API key management
- [x] /integrations/webhooks - Webhook configuration
- [x] /profile - My Profile page
- [x] /billing - Billing page

## Analytics Nav Sub-items (Apr 2, 2026)
- [x] Add Downloads Reports link under Analytics in sidebar → /admin/downloads/reports
- [x] Add Webinar Reports link under Analytics in sidebar → /lms/webinars/reports

## DATE_FORMAT Fix & Settings Nav (Apr 2, 2026)
- [x] Fix DATE_FORMAT query error in getRevenueChartData (enrolledAt column type issue)
- [x] Add Settings accordion group back to sidebar nav

## Org Settings Cleanup (Apr 2, 2026)
- [x] Remove Email Sender tab from Organization Settings
- [x] Remove Email Templates tab from Organization Settings
- [x] Replace Logo URL text field with file upload control on Branding tab
- [x] Backend: uploadOrgLogo procedure (S3 upload, returns URL, saves to org)

## Full Feature Build-Out (Apr 2, 2026)

### Phase 1 - Org Settings
- [x] Remove Email Sender tab from Org Settings
- [x] Remove Email Templates tab from Org Settings
- [x] Replace Logo URL text field with file upload (S3) on Branding tab
- [x] Backend: orgs.uploadLogo procedure (presigned S3 upload)

### Phase 2 - Members Section
- [ ] Groups page: seat management tool, group seat managers, seat assignment/change
- [ ] Certificates page: template builder, automated flows, link to course settings
- [ ] Discussions page: forum management per course
- [ ] Assignments page: instructor assignment creator + management

### Phase 3 - Products Section
- [ ] Categories page: CRUD for categories, auto-sort on catalog
- [ ] Memberships page: membership plans
- [ ] Bundles page: bundle builder
- [ ] Community page: community builder tool + landing page

### Phase 4 - Marketing Section
- [ ] Website page: home page settings, landing pages, custom pages, tracking codes (GA, FB Pixel, GSV)
- [ ] Email Campaigns page: send, templates, automation workflows
- [ ] Funnels page: funnel page builder
- [ ] Affiliates page: affiliate management

### Phase 5 - Sales Section
- [ ] Orders page: order management
- [ ] Subscriptions page: cancel, refund, transaction support
- [ ] Group Orders page: org admin group registrations
- [ ] Coupons page: discount code builder (one or multiple products)
- [ ] Invoices page: automated invoice templates, on/off per customer or site-wide
- [ ] Revenue Partners page: revenue share setup per course

### Phase 6 - Analytics & Integrations
- [ ] Analytics/Revenue page: revenue charts and data
- [ ] Analytics/Engagement page: engagement metrics
- [ ] Analytics/Marketing page: marketing funnel metrics
- [ ] Analytics/Custom Reports page: custom report builder
- [ ] Integrations page: apps marketplace
- [ ] API page: API key management
- [ ] Webhooks page: webhook configuration

### Phase 7 - Profile & Billing
- [ ] Profile page: edit name, email, password, avatar
- [ ] Billing page: subscription, payment methods, invoices

## Reports Buttons & ProfilePage Fix (Apr 2, 2026)
- [x] Fix ProfilePage useAuth import path (@/hooks/useAuth → @/_core/hooks/useAuth)
- [x] Add "Reports" button to DigitalProductsPage header → /admin/downloads/reports
- [x] Add "Reports" button to CoursesPage (LMS) header → /analytics/revenue
- [x] Confirm Analytics sidebar still shows Downloads Reports and Webinar Reports

## Org Selector & Reports Buttons Fix (Apr 2, 2026)
- [x] DigitalProductsPage: hide org selector for org_admin role (show only for site_owner/admin)
- [x] WebinarsPage: hide org selector for org_admin role (show only for site_owner/admin)
- [x] DigitalProductsPage: add Reports button → /admin/downloads/reports
- [x] WebinarsPage: add Reports button → /lms/webinars/reports
- [x] CoursesPage (LMS): add Reports button → /analytics/revenue
- [x] Confirm Analytics sidebar has Downloads Reports and Webinar Reports links

## Platform-Wide Org Scoping Rule (Apr 2, 2026)
- [x] Create useOrgScope hook: platform owner/admin → show org selector; org_admin → auto-scope to own org
- [x] Apply to DigitalProductsPage (hide selector for org_admin)
- [x] Apply to WebinarsPage (hide selector for org_admin)
- [x] Apply to CoursesPage/LMS (hide selector for org_admin)
- [x] Apply to Analytics pages (Revenue, Engagement, Marketing, Custom Reports)
- [ ] Apply to Downloads Reports page
- [ ] Apply to Webinar Reports page
- [ ] Apply to Activity Log page
- [ ] Apply to Members/Users pages
- [x] Add Reports buttons: DigitalProductsPage → /admin/downloads/reports, WebinarsPage → /lms/webinars/reports, CoursesPage → /analytics/revenue

## Website Preview Button (Apr 2, 2026)
- [x] Add Preview button to Website marketing page → opens org storefront preview in new tab (works in draft mode)

## Settings Nav Simplification (Apr 2, 2026)
- [x] Remove all sub-items under Settings accordion in sidebar
- [x] Make Settings a direct link to /lms/settings (general settings page)

## Full Feature Build-Out (Apr 2, 2026)

### Schema & Migrations
- [ ] Add categories table (id, orgId, name, slug, color, sortOrder, description)
- [ ] Add groups table (id, orgId, name, managerId, seats, courseId, expiresAt, notes)
- [ ] Add group_members table (id, groupId, userId, email, enrolledAt, status)
- [ ] Add discussions table (id, orgId, courseId, title, body, authorId, isPinned, status, createdAt)
- [ ] Add discussion_replies table (id, discussionId, authorId, body, createdAt)
- [ ] Add assignments table (id, orgId, courseId, title, description, dueDate, status)
- [ ] Add assignment_submissions table (id, assignmentId, userId, body, fileUrl, grade, gradedAt, status)
- [ ] Add certificate_templates table (id, orgId, name, htmlTemplate, isDefault)
- [ ] Add showProgressBar and showProgressPercent columns to courses table
- [ ] Apply all migrations via webdev_execute_sql

### Backend Procedures
- [ ] categories: list, create, update, delete, reorder
- [ ] groups: list, create, update, delete, addMember, removeMember
- [ ] discussions: list, create, reply, pin, delete
- [ ] assignments: list, create, update, delete, submit, grade
- [ ] certificateTemplates: list, create, update, delete
- [ ] courses.updateDisplaySettings: showProgressBar, showProgressPercent
- [ ] orders: list by org with pagination and filters
- [ ] subscriptions: list by org
- [ ] invoices: list by org, generate PDF
- [ ] revenuePartners: list, create, update
- [ ] affiliates: list, create, update
- [ ] analytics: real enrollment chart data for dashboard

### Frontend Pages
- [ ] CategoriesPage: real CRUD wired to backend (create, edit, delete, reorder)
- [ ] GroupsPage: real CRUD with seat management wired to backend
- [ ] MemberCertificatesPage: list issued certificates, certificate templates CRUD
- [ ] DiscussionsPage: real forum list wired to backend with reply/pin/delete
- [ ] AssignmentsPage: real CRUD wired to backend with submission grading
- [ ] EmailCampaignsPage: real CRUD wired to backend with send/schedule
- [ ] OrdersPage: real orders list from backend with filters and export
- [ ] CouponsPage: real CRUD wired to backend
- [ ] SubscriptionsPage: real list from backend
- [ ] InvoicesPage: real list from backend
- [ ] RevenuePartnersPage: real CRUD wired to backend
- [ ] AffiliatesPage: real CRUD wired to backend
- [ ] Course player: respect showProgressBar and showProgressPercent flags
- [ ] Course settings: toggle for showProgressBar and showProgressPercent
- [x] Dashboard enrollment chart: real Recharts bar chart with enrollment data (LmsDashboardPage)
- [ ] Analytics pages: real data with Recharts visualizations

## School Storefront Footer - Org Policies (Apr 3, 2026)
- [x] Add publicLegalDocsBySlug backend endpoint (public, lookup by org slug)
- [x] Add /school/:orgSlug route in App.tsx for slug-based school pages
- [x] Update SchoolPage to resolve org by slug param (falls back to user's first org)
- [x] Footer already exists in SchoolPage - verify it shows ToS/Privacy links per org
- [x] Add org-scoped footer to school storefront with Terms of Service and Privacy Policy links

## Form Generator (Products)
- [x] DB schema: forms, form_fields, form_branching_rules, form_submissions tables
- [x] Migration applied
- [x] formsRouter.ts: list, create, get, update, delete, duplicate procedures
- [x] formsRouter.ts: fields.upsert, rules.upsert procedures
- [x] formsRouter.ts: publicGet, publicSubmit procedures
- [x] formsRouter.ts: submissions.list, submissions.delete procedures
- [x] formsRouter.ts: emailAccessCheck (gated by subscription plan)
- [x] FormsPage.tsx: list, create, duplicate, delete forms
- [x] FormBuilderPage.tsx: drag-and-drop field palette (10 field types)
- [x] FormBuilderPage.tsx: branching rules editor (IF/THEN logic)
- [x] FormBuilderPage.tsx: email routing panel (pro-gated)
- [x] FormBuilderPage.tsx: share panel (URL + embed code)
- [x] FormPlayerPage.tsx: public form player with branching engine
- [x] FormResponsesPage.tsx: view and export responses as CSV
- [x] Routes: /lms/forms, /lms/forms/:id, /lms/forms/:id/responses, /forms/:slug
- [x] Forms added to Products section in sidebar
- [x] TypeScript errors fixed (sonner toast, type casts)
- [x] Production build verified clean

## Form Generator — Phase 2 Enhancements

### Schema & Migration
- [ ] Add form_analytics_events table (formId, sessionId, fieldId, event, value, timestamp)
- [ ] Add form_sessions table (id, formId, startedAt, completedAt, droppedAtFieldId, memberVars JSON)
- [ ] Add branding columns to forms table: headerImageUrl, headerBgColor, headerTextColor, fontFamily, buttonColor, buttonTextColor, useOrgBranding (bool)
- [ ] Add memberVariableFields JSON column to forms (list of field IDs that map to member vars)
- [ ] Add form_integrations table (formId, type: course|custom_page|landing_page, targetId, triggerOn: submit|completion, action: enroll|redirect|tag)
- [ ] Generate and apply migration

### Backend Procedures
- [ ] forms.analytics.summary: completion rate, avg time, drop-off field, total starts vs completions
- [ ] forms.analytics.fieldDropoff: per-field view count, answer rate, drop-off count
- [ ] forms.analytics.timeSeries: daily starts/completions over date range
- [ ] forms.sessions.start: create session row, return sessionId
- [ ] forms.sessions.fieldView: record field view event (for drop-off tracking)
- [ ] forms.sessions.complete: mark session complete, store member vars used
- [ ] forms.branding.getOrgDefaults: fetch org site settings (primaryColor, logo, fonts)
- [ ] forms.branding.update: save per-form branding overrides
- [ ] forms.integrations.list / upsert / delete: manage course/page/landing-page links
- [ ] forms.memberVars.resolve: given formId + userId or URL params, return pre-filled values

### Form Builder UI
- [ ] Branding tab: toggle "Use org defaults" vs custom overrides
- [ ] Branding tab: primary color, button color, header bg/text color pickers
- [ ] Branding tab: header image upload (S3, CDN URL stored)
- [ ] Branding tab: font family selector (Google Fonts presets)
- [ ] Member Variables tab: map form fields to member data (name, email, org, custom attributes)
- [ ] Member Variables tab: show preview of auto-populated values
- [ ] Integrations tab: link form to course (enroll on submit), custom page (redirect), landing page (embed)
- [ ] Integrations tab: trigger options (on submit, on completion, on score threshold)

### Form Analytics Page
- [ ] Summary cards: total starts, completions, completion rate, avg time to complete
- [ ] Drop-off funnel chart: per-question view → answer rate waterfall
- [ ] Time series chart: daily starts vs completions (last 30 days)
- [ ] Per-field breakdown table: views, answers, drop-offs, avg answer time
- [ ] Export analytics as CSV

### Form Player
- [ ] Apply org branding by default (fetch org settings for the form's org)
- [ ] Apply per-form overrides on top of org defaults
- [ ] Render header image if set (full-width banner above form title)
- [ ] Auto-populate fields mapped to member variables from: URL params (?name=, ?email=, etc.) or logged-in user context
- [ ] Hidden field support: fields with member var mapping can be hidden from view but still submitted
- [ ] Track session start/field views/completion events for analytics

## Form Generator Enhancements (Phase 2)
- [x] DB schema: formSessions, formAnalyticsEvents, formIntegrations, branding columns, isHidden, memberVarName
- [x] Backend: analytics summary, field drop-off, time series procedures
- [x] Backend: branding orgDefaults, uploadHeaderImage procedures
- [x] Backend: sessions.start, fieldView, complete, dropout procedures
- [x] Backend: integrations.list, upsert procedures
- [x] Form Builder: Branding tab (org defaults toggle, per-form color overrides, header image upload)
- [x] Form Builder: Member Variables tab (field-to-variable mapping, hidden field toggle, URL param reference)
- [x] Form Builder: Integrations tab (course enroll, redirect, tag, embed actions)
- [x] Form Analytics page: completion rate, drop-off funnel, time series chart, per-field table
- [x] Form Player: org/form branding applied (colors, fonts, header image)
- [x] Form Player: member variable auto-population from auth user and URL params
- [x] Form Player: session tracking (start, field view, complete)
- [x] Forms list: Analytics button added to each form card

## Form Builder Phase 3 (completed)
- [x] Rebuild FormBuilderPage with FormSite-style top nav (Form Editor / Form Settings / Share / Results tabs)
- [x] Form name dropdown switcher in top nav
- [x] Form Editor tab: Build / Style / Rules left sidebar
- [x] Form Settings tab: General / Notifications / Success Pages / Custom Text / Save & Return / Payments / Integrations sidebar
- [x] Share tab: Links (Form Link, Pre-populate Link, Directory) / Preview / Embed Code / QR Code sidebar
- [x] Results tab: Results Table / Analytics / Results Filters / Results Views / Results Labels / Results Docs / Results Reports / Export / Scheduled Exports / Import / Delete Results sidebar
- [x] Field-based filtering in Results Table (pick field + operator + value)
- [x] Column show/hide in Results Table
- [x] Notification settings: notify org admin, notify respondent, custom email addresses
- [x] notifyOrgAdmin and notifyRespondent columns added to forms table
- [x] MediaLibraryPicker component (browse by tag/type + upload + tag management)
- [x] Platform Admin Forms tab (view forms by org, form limits reference table)
- [x] Form limits enforced: Free=0, Starter=3, Builder=10, Pro=50, Enterprise=200
- [x] org_media_library table with tags support
- [x] form_filters, form_views, form_labels, form_docs, form_scheduled_exports tables

## Custom Form URL & Digital Downloads Fix
- [ ] Fix Digital Downloads upload: change from presigned PUT to server-side proxy upload via /api/media-upload
- [x] Add custom form slug editor in Form Settings > General tab (editable URL field with live preview)
- [x] Add slug uniqueness validation in formsRouter.update (check no other form in org has same slug)
- [x] Show full form URL preview in Share tab (domain + /forms/ + slug)
- [ ] Allow slug to be edited from the Share tab Links section as well
- [x] Add redirectUrl column to forms table (nullable text)
- [x] Add redirect URL field in Form Settings > Success Pages section
- [x] Form Player: after successful submission, redirect to redirectUrl if set (otherwise show thank-you message)
- [ ] Show redirect URL in Share tab for reference

## Rich Text in Forms
- [ ] Install a lightweight rich text editor (tiptap or react-quill) for form builder
- [ ] Add "Rich Text" field type to form builder (display-only formatted content block)
- [ ] Add successMessageHtml column to forms table (replaces plain text successMessage)
- [ ] Form Settings > Success Pages: replace plain textarea with rich text editor for success message
- [ ] Form Player: render success message as HTML (sanitized) after submission
- [ ] Rich Text field in form player: render HTML content block inline within the form

## Form Pagination (Multi-Page Forms)
- [x] Add pageBreak field type to form builder (inserts a page break between questions)
- [x] Add pageBreak to form_fields type enum in schema
- [x] Form Builder: show page numbers in the field list (Page 1, Page 2, etc.) with visual separator
- [x] Form Player: split fields into pages at pageBreak boundaries, show one page at a time
- [x] Form Player: show Next/Back navigation buttons between pages
- [x] Form Player: show page progress indicator (e.g., "Page 2 of 4" or a step progress bar)
- [x] Form Player: validate required fields on current page before advancing to next page
- [ ] Form Settings > General: add "Show page progress bar" toggle
- [ ] Form Analytics: track per-page drop-off (not just per-field)

## Video Player Branding & Watermark
- [x] Add watermarkImageUrl and watermarkOpacity columns to orgThemes table in schema
- [x] Add watermarkImageUrl and watermarkOpacity columns to courses table (per-course override)
- [x] Org Branding settings: add watermark image upload and opacity slider
- [ ] Course editor: add per-course watermark override toggle + image upload
- [ ] Video player component: apply org primary color to controls bar background and progress bar
- [x] Video player component: render watermark image at bottom-left corner with configurable opacity
- [x] Video player component: inherit watermark from org theme, allow per-course override

## Platform Admin Fixes (Apr 3)
- [x] Fix org table text color: always show org name in teal (not invisible until hover)
- [x] Add light teal hover background to org table rows
- [x] Add plan/subscription selector to Edit Organization dialog
- [ ] Fix tier-gated "Insufficient permissions" errors to show upgrade message (e.g., webinars require Builder+)

## Platform Admin: Impersonation & Granular Editing (Apr 3)
- [x] Backend: impersonation JWT endpoint (site_owner/site_admin only)
- [x] Backend: impersonation session cookie with impersonatedBy metadata
- [x] Backend: end impersonation endpoint (restore original session)
- [x] Backend: fix requireOrgRole to allow site_owner/site_admin to bypass org membership check
- [x] Backend: add webinar tier check with clear "upgrade to Builder+" message
- [x] Platform Admin UI: "Login as Customer" button per org row
- [x] Platform Admin UI: impersonation banner shown when active (who you're impersonating + exit button)
- [x] Platform Admin UI: granular Edit Org dialog (name, slug, description, domain, logo, plan, status, admin notes)
- [x] Platform Admin UI: fix org table text always visible in teal, light teal hover on rows

## Course Reordering (Apr 3, 2026)
- [x] Add sortOrder column to courses table in schema
- [x] Generate and apply migration SQL
- [x] Add lms.courses.reorder tRPC procedure (accepts ordered array of courseIds)
- [x] CoursesPage (admin): drag-and-drop reorder using @dnd-kit, persist on drop
- [x] SchoolPage (catalog): render courses in sortOrder sequence
- [x] CoursesPage: show drag handle icon on each course card/row
- [x] Reorder persists across page refreshes (stored in DB)

## Community Enhancements (Apr 3, 2026)
- [x] Schema: add coverImageUrl to community_spaces table
- [x] Schema: add isInviteOnly boolean to community_spaces
- [x] Schema: add accessType enum (open, invite_only, course_enrollment, purchase) to community_spaces
- [x] Schema: add linkedCourseId (FK to courses) to community_spaces
- [x] Schema: add price/priceId to community_spaces for standalone purchase access
- [x] Schema: add salesPageContent (rich text) to community_spaces
- [x] Schema: add community_invites table (id, spaceId, email, token, status, createdAt)
- [x] Schema: add community_dms table (id, orgId, fromUserId, toUserId, content, createdAt, readAt)
- [x] Generate and apply migration
- [x] Backend: update space create/update procedures with new fields
- [ ] Backend: add invite management procedures (createInvite, listInvites, acceptInvite, revokeInvite)
- [ ] Backend: access check middleware for invite-only spaces (check membership or valid invite)
- [ ] Backend: auto-grant community access on course enrollment if linkedCourseId is set
- [x] Backend: DM procedures (sendDm, listConversations, getConversation, markRead)
- [ ] Community Admin UI: management page with Posts moderation tab
- [ ] Community Admin UI: Member Access tab (list members, invite, revoke)
- [x] Community Admin UI: Space Settings tab (cover image upload, access type, linked course, price)
- [x] Community Admin UI: Enter Community button linking to learner-facing hub
- [x] Community learner UI: space cards with cover image
- [x] Community learner UI: invite-only lock indicator on locked spaces
- [ ] Community learner UI: sales/landing page for community access with join CTA
- [x] Community learner UI: DMs panel with conversation list sidebar and thread view


## Record Feature (Loom-style) - DEFERRED (complete after all other items)
- [x] Add Record to sidebar under Products section in DashboardLayout
- [x] Record page: browser-based screen + camera simultaneous recording using MediaRecorder API
  - [x] Screen capture (getDisplayMedia) + camera overlay (getUserMedia) combined into single MediaStream
  - [x] Camera bubble overlay (draggable, resizable, circle/square shape options)
  - [x] Recording controls: Start, Pause, Resume, Stop, Countdown timer
  - [ ] Recording quality settings (resolution, frame rate)
  - [x] Microphone selection + audio level indicator
- [ ] Video editor (in-browser, post-recording):
  - [ ] Timeline with waveform visualization
  - [ ] Trim/cut: drag handles on timeline to set in/out points
  - [ ] Split clips at playhead position
  - [ ] Delete segments from timeline
  - [ ] Transcript panel (auto-generated via Whisper API on upload)
  - [ ] Click word in transcript to jump to that timestamp in video
  - [ ] Edit transcript text inline (corrections sync to caption timing)
  - [ ] Closed captions overlay: toggle on/off, font family, font size, color, background color, position
  - [ ] Caption style presets (white on black, yellow, etc.)
  - [ ] Export captions as SRT/VTT file
- [ ] Marketing snips: select clip range, add text overlay/CTA, download or share link
- [ ] Video storage: upload to S3, save metadata to DB, appear in Media Library
- [ ] Schema: add recorded_videos and video_snips tables
- [ ] Backend procedures: upload, list, get, update, delete recorded videos; create/list snips
- [ ] Integration: Insert from Record Library button in Course Lesson editor and Webinar media picker

## Community Hub List Page (Thinkific-style)
- [x] CommunityPage: Thinkific-style list of community hubs with cover image, name, share button, published status badge
- [x] CommunityPage: search/filter by name
- [x] CommunityPage: Grid/List view toggle
- [x] CommunityPage: "New community" button (tier-gated: Free=0, Starter=1, Builder=2, Pro=5, Enterprise=unlimited)
- [x] CommunityPage: upgrade prompt card when community limit reached (dashed border, upgrade CTA)
- [ ] CommunityPage: Re-order tab with drag-and-drop reordering (backend ready, UI pending)
- [x] CommunityPage: three-dot menu per hub (Edit, Enter Community, Delete)
- [x] Backend: community.listHubs procedure (list all hubs for org)
- [x] Backend: community.createHub procedure (create new hub with name, slug)
- [x] Backend: community.deleteHub procedure
- [x] Backend: community.reorderHubs procedure
- [x] CommunityEditorPage: full management page at /products/community/:hubId with tabs
- [x] CommunityEditorPage: Hub Settings tab (name, tagline, description, cover image, logo, primary color, enabled toggle)
- [x] CommunityEditorPage: Spaces tab (list spaces, create/edit/delete/reorder spaces with cover images, access type, invite-only toggle)
- [x] CommunityEditorPage: Members tab (list members per space, ban/unban, role change)
- [x] CommunityEditorPage: Moderation tab (hidden/flagged posts queue, restore/delete actions)
- [x] CommunityEditorPage: Invites tab (send invite by email, list pending/revoked invites)
- [x] CommunityEditorPage: "Enter Community" button linking to learner view
- [x] Community learner view at /community/:hubId (spaces sidebar, posts feed, DMs panel)

## Course Pre-Start Page (Teachable-style)
- [x] Course overview page at /learn/:courseId/overview - Teachable-style pre-start page
- [x] Top section: course thumbnail image + "next lesson" card with lesson title, position (e.g. "1/3"), and "Start Lesson" / "Continue" button
- [x] Module/lesson outline: expandable sections showing module name, X/Y complete count, collapse/expand toggle
- [x] Each lesson row: circle progress icon (empty/half/full), lesson title, subtitle/type icon, Start/Continue/Review button
- [x] Right sidebar: completion percentage (e.g. "0% COMPLETE"), instructor bio card with avatar, name/credentials, bio text
- [x] Link from CoursePlayerPage header back to overview page
- [x] Progress data pulled from real course_progress / lesson_completions tables

## AI Course Generation Wizard
- [x] "Create with AI" button on Courses page alongside "New Course"
- [x] Multi-step wizard dialog/page:
  - [x] Step 1: Course topic, description, target audience, difficulty (Beginner/Intermediate/Advanced), number of modules (3-10)
  - [x] Step 2: AI generates course outline - title, subtitle, description, modules with lesson names and descriptions
  - [x] Step 3: Review & edit generated outline - editable module/lesson names, add/remove lessons
  - [x] Step 4: AI generates landing page content - hero headline, course description, what you'll learn bullets, suggested pricing
- [x] Backend tRPC procedure: lms.ai.generateCourseOutline using invokeLLM
- [x] Backend tRPC procedure: lms.ai.generateLandingPage using invokeLLM
- [x] Auto-create course with all modules and lessons in DB after user confirms
- [x] Navigate to course builder after creation for further customization

## Instructors Management Page (Org Settings)
- [x] Add "Instructors" nav item under Org Settings sidebar (between Branding and Integrations)
- [x] Route: /org/instructors
- [x] Instructors list page: table/card view of all instructors for the org
- [x] Each instructor card: avatar, name, credentials/title, bio preview, course count, actions (Edit, Delete)
- [x] Add Instructor dialog: name, title/credentials, bio, avatar upload, email, social links (LinkedIn, Twitter, website)
- [x] Edit Instructor dialog: same fields as add
- [x] Delete instructor with confirmation (warn if assigned to courses)
- [x] Backend: instructors table (id, orgId, name, title, bio, avatarUrl, email, linkedinUrl, twitterUrl, websiteUrl, createdAt)
- [x] Backend tRPC procedures: instructors.list, instructors.create, instructors.update, instructors.delete
- [x] Course Builder: instructor selector dropdown on course settings tab (link course to instructor)
- [ ] Course pre-start page: pull instructor info from linked instructor record

## WYSIWYG Page Editor (Thinkific Site Builder Style)
- [x] Full-screen editor layout: narrow left panel + wide live preview pane
- [ ] Left panel: Page tab with Header (Default badge), Sections list with drag handles, Footer (Default badge), Add section button
- [ ] Left panel: Theme Settings tab (fonts, colors, button styles)
- [x] Live preview: Desktop / Mobile / Fullscreen toggle in top bar
- [x] Live preview: Discard / Save buttons in top bar with draft/published status indicator
- [ ] Live preview: Section hover highlights with blue border + "Edit" overlay button
- [ ] Section editor panel: clicking section opens settings (Headings, Background, Image or Video, Size & alignment, Blocks, Delete section)
- [ ] Add section modal: grid of section type cards with thumbnail previews and descriptions
- [ ] Section types: Banner (course), Curriculum [smart], Call to action, Call to action (course), Bonus material, Checklist, Countdown timer, FAQ, Icons & text, Instructor(s), Lead Capture, Pricing options, Social proof logos/reviews/testimonials, Image gallery, Image & text (with CTA), Additional products, All categories, All pricing options
- [ ] Remove policy pages from Pages tab in page editor

## Policies System
- [ ] Org Settings: Policies tab with list of policy pages (Privacy Policy, Terms of Service, Refund Policy, custom)
- [ ] Policy editor: rich text editor with title, slug, content, published toggle
- [x] Public policy page route: /policies/:slug (learner-facing)
- [ ] Footer site links: ability to add policy page links to footer (alongside custom links)
- [ ] Checkout page: "I agree to [Terms of Service] and [Privacy Policy]" checkbox (required before purchase)
- [ ] Checkout agreement: links open policy pages in new tab
- [ ] Checkout: block purchase if agreement checkbox not checked when policies are published

## Record Tool (Loom-style, under Products in sidebar)
- [x] Sidebar entry: Products > Record
- [x] Screen + camera simultaneous recording using browser MediaRecorder API
- [x] Camera preview bubble (moveable) overlaid on screen recording
- [x] Save recording to media library on completion
- [ ] Video editor: timeline with cut/trim tools
- [x] Transcript generation via Whisper API after recording
- [ ] Closed captions editor: editable transcript segments with font/color/size controls
- [ ] Marketing snips: select transcript segments to create short clips
- [x] Videos stored in media library and linkable to courses/products

## Flashcard Creator (Media Library)
- [x] Add "Flashcards" tab/section to Media Library page
- [x] Flashcard deck management: create deck with name, description, category/tags
- [x] Flashcard card editor: front (term/question with optional image), back (definition/answer with optional image)
- [x] AI generation: input topic or paste text → AI generates N flashcard pairs using LLM
- [x] Excel import: upload .xlsx with columns (Front, Back, Front Image URL, Back Image URL) → bulk import
- [x] Excel export: download deck as .xlsx for offline use or sharing
- [x] Deck study mode: flip animation, shuffle/randomize, progress tracking (known/unknown)
- [x] Incorporate flashcard decks into course lessons as a "Flashcards" lesson type
- [x] Backend: flashcard_decks table (id, orgId, title, description, category, cardCount, createdAt)
- [x] Backend: flashcard_cards table (id, deckId, front, back, frontImageUrl, backImageUrl, sortOrder)
- [x] Backend tRPC procedures: flashcards.listDecks, flashcards.getDeck, flashcards.createDeck, flashcards.updateDeck, flashcards.deleteDeck
- [x] Backend tRPC procedures: flashcards.listCards, flashcards.createCard, flashcards.updateCard, flashcards.deleteCard, flashcards.reorderCards
- [x] Backend: flashcards.generateWithAI procedure using invokeLLM
- [x] Backend: flashcards.importFromExcel procedure using xlsx library
- [x] Backend: flashcards.exportToExcel procedure
- [ ] Tier gating: limit number of flashcard decks per plan

## Quiz Import Template ZIP with Bundled Media
- [ ] Rebuild quiz import template as a ZIP bundle: QuizTemplate.zip containing Questions.xlsx + media/ folder with sample images
- [ ] Instructions sheet in Excel: explain ZIP structure, media/ path format, all question types, correct answer marking (* prefix), matching pipe delimiter, numeric ranges
- [ ] Questions sheet: sample rows for every question type (TF, MC, MR, TI, MG, SEQ, NUMG, IS) with real media path references like media/sample_image.jpg
- [ ] Template sheet: column reference rows showing format placeholders ([path], *Alternative 1, etc.)
- [ ] Zero iSpring branding - all instructions reference "Teachific" only
- [ ] Include sample media images in the media/ folder of the ZIP
- [ ] Backend: update quiz import endpoint to accept ZIP uploads (not just XLSX)
- [ ] Backend: when ZIP uploaded, extract media/ files to S3, rewrite media paths in Excel to S3 URLs before parsing
- [ ] Frontend: update quiz builder import UI to accept .zip files in addition to .xlsx
- [ ] Frontend: show instructions panel explaining the ZIP+media format with download template button
- [ ] Upload the new template ZIP to CDN and update the download link in quiz builder

## Group Manager System
- [x] Extend groups table: managerName, managerTitle, managerEmail, managerPhone, productIds (JSON), welcomeEmailSent
- [x] Add group_manager role to users enum in schema
- [x] Migration: generate and apply SQL for groups table changes
- [x] Backend: update createGroup procedure to accept manager contact + product assignments
- [ ] Backend: send welcome email to group manager on group creation (SendGrid)
- [x] Backend: listGroupProducts procedure (returns courses/products assigned to a group)
- [x] Backend: seatEnroll procedure (group manager enrolls learner by email into a seat)
- [x] Backend: listGroupSeats procedure (returns all seats with learner info and progress)
- [x] Backend: revokeSeat procedure (remove a learner from a seat)
- [x] Frontend: Update New Group dialog with manager name/title/email/phone + product multi-select
- [x] Frontend: Group Manager portal page (only visible to group_manager role in sidebar)
- [x] Frontend: Seat registration tool (invite by email, assign to products, view progress)
- [x] Frontend: Group Manager sees only their group(s), not full org admin views
- [x] Frontend: DashboardLayout sidebar shows Group Management link for group_manager role

## Bug: Custom Pages — No Edit After Creation (Apr 3, 2026)

- [x] Custom Pages list: add "Edit" button/link on each page row that navigates to the page builder for that page
- [x] Custom Pages list: add "Publish" / "Unpublish" toggle button on each row (currently only set at creation time)
- [x] Page builder: when opened for an existing page, load the page's current blocks and metadata
- [x] Page builder: Save button updates the existing page (not creates a new one)
- [x] Page builder: "Publish" button in top bar changes page status to published; "Unpublish" reverts to draft
- [x] Custom Pages list: show current status badge (Draft / Published) on each row

## Bug/Feature: Platform Admin — Teachific Platform Org + Platform Forms (Apr 3, 2026)

- [x] Ensure a "Teachific" organization exists in the DB as the platform-level org (owned by site owner, id=1 or auto-provisioned on first boot)
- [x] Platform Admin > Organizations list: always show "Teachific (Platform)" as the first entry, clearly labeled as the platform org
- [x] Platform Admin > Page Creator: include "Teachific (Platform)" in the org selector so platform-level pages can be created
- [x] Platform Admin > Platform Forms tab: include "Teachific (Platform)" in the org selector so platform-level forms can be created
- [x] Platform Admin > Platform Forms tab: "New Form" button should be enabled when "Teachific (Platform)" is selected (currently no org is pre-selected so button may be disabled)
- [ ] Platform org tracks all platform-level data: forms, pages, analytics under the Teachific brand
- [x] Backend: ensure auto-provisioning of the Teachific platform org on server startup if it does not exist (idempotent)

## Bug/Feature: Platform Admin — Branding Theme Tab Missing (Apr 3, 2026)

- [x] Platform Admin: add "Branding" tab alongside Overview, Organizations, Users, Page Creator, Integrations, System Settings, Platform Forms
- [x] Branding tab: platform logo upload (replaces the "teachific" text lockup globally)
- [x] Branding tab: primary color picker (teal accent color used across buttons, links, badges)
- [x] Branding tab: secondary/accent color picker
- [x] Branding tab: font selector (heading font + body font from Google Fonts list)
- [x] Branding tab: favicon upload
- [x] Branding tab: platform name / tagline fields (used in email footers and page titles)
- [x] Branding tab: email header logo (can differ from site logo)
- [x] Branding tab: Save button persists all branding settings to org settings (platform org)
- [x] Branding settings stored in the Teachific platform org record (or a dedicated platform_settings table)
- [ ] Branding changes apply live to the sidebar logo, login screen, and embed player header (deferred)

## Enhancement: Platform Admin — Full Organization Management (Apr 3, 2026)

- [x] Organizations list: show Super Admin name + email column for each org (the user who owns/registered it)
- [x] Organizations list: if org was registered via sign-up, auto-populate owner name and email from the users table
- [x] Edit Organization dialog: add "Super Admin" section showing owner name, email, and role — allow editing (change owner)
- [x] Create New Organization dialog: add "Super Admin Name" and "Super Admin Email" fields; on create, look up or create the user and assign as org owner/admin
- [x] Create New Organization: if email matches an existing user, assign them as owner; if not, create a pending invite
- [x] Organizations list: "Manage Members" button per row that opens a members panel (list current members, add/remove, change roles)
- [x] Organizations list: show member count column
- [x] Organizations list: "Teachific (Platform)" org always pinned at top, labeled with a "Platform" badge
- [x] Backend: admin.createOrg procedure — accepts name, slug, ownerName, ownerEmail; creates org + assigns owner
- [x] Backend: admin.getOrgWithOwner — returns org with joined owner user data

## Bug: + New Course Button on Dashboard Goes to 404
- [x] Dashboard "+ New Course" button links to /lms/courses/new which shows "course not found"
- [x] Fix: button should open the course creation dialog (same as clicking "+ New Course" in the Courses list) or navigate to the courses page with the dialog pre-opened

## Enhancement: Certificate Template Creator — Visual Editor
- [x] Replace raw HTML textarea with a visual certificate template picker (3-4 base designs)
- [x] Base templates: Classic, Modern, Elegant, Minimal — each pre-styled with border, colors, fonts
- [x] Rich field editor: user enters title, recipient name placeholder, body text, logo/image upload, signature image, date format
- [x] Live preview panel showing rendered certificate with merge tags replaced by sample data
- [x] Keep advanced "Edit HTML" toggle for power users who want raw access

## Bug: Storefront/School Pages — Wrong Sidebar Shown
- [x] Live client-side school/org pages (e.g. /school/all-about-ultrasound) should NOT show the org admin DashboardLayout sidebar
- [x] School pages should show a learner/member sidebar only when the user is logged in
- [x] The main org landing page (storefront) should have NO sidebar at all — public-facing layout only
- [x] The learner sidebar (My Courses, My Certificates, Account, etc.) should appear only on authenticated learner routes
- [x] SchoolMemberLayout created: sidebar with My Courses, Certificates, Profile nav items, only shown on /school/:orgSlug/my-courses and similar authenticated routes
- [x] SchoolMyCoursesPage created at /school/:orgSlug/my-courses with full enrollment grid, progress bars, and filter tabs

## Bug Fixes - Apr 3 2026 (Org Loading)
- [x] Fix org loading: organizations not showing in Platform Admin list or any dropdown selector
- [x] Fix getAllOrgs SQL subquery: wrong column name org_id → orgId in org_members table
- [x] Rewrite useOrgScope hook: platform admins now use platformAdmin.listOrgs (not orgs.list); auto-defaults to Teachific org
- [x] Remove org selector dropdowns from all pages (WebinarsPage, CoursesPage, DigitalProductsPage, EngagementAnalyticsPage, MarketingAnalyticsPage, RevenueAnalyticsPage, LmsAnalyticsPage, GroupsPage, MemberCertificatesPage)
- [x] Platform admins auto-default to "Teachific" org; regular users auto-default to their own org

## Feature: Subscription Limits & Org Deletion (Apr 3 2026)
- [x] Add subscription_plan_limits table (plan x featureKey x limitValue)
- [x] Add org_limit_overrides table (per-org override of plan defaults)
- [x] Seed 75 default limit rows (15 features x 5 plans)
- [x] Backend: getPlanLimits, upsertPlanLimit, getOrgLimits, upsertOrgLimitOverride, deleteOrgLimitOverride
- [x] Backend: deleteOrg procedure (adminProcedure, cascades members + subscription)
- [x] Platform Admin UI: Subscription Plans tab - grid of plan x feature limits, inline edit
- [x] Platform Admin UI: Org edit dialog - Limits tab showing plan defaults + per-org overrides
- [x] Platform Admin UI: Org list - Delete button with confirmation dialog

## Feature: Expanded Role System & Platform Admin User Management (Apr 3 2026)
- [ ] Schema: add memberSubRole field to org_members (basic_member, instructor, group_manager, group_member)
- [ ] Schema: update users.role enum to include org_super_admin
- [ ] Backend: update user create/edit procedures to accept new roles and memberSubRole
- [ ] Backend: group assignment when adding org member (assign to group by groupId)
- [ ] Platform Admin UI: replace "user" label with "Org Member" everywhere
- [ ] Platform Admin UI: role selector shows Owner, Platform Admin, Org Super Admin, Org Admin, Org Member
- [ ] Platform Admin UI: when Org Member selected, show sub-role selector (Basic Member, Instructor, Group Manager, Group Member)
- [ ] Platform Admin UI: when Group Manager or Group Member selected, show group assignment dropdown
- [x] Platform Admin UI: subscription limits tab (plan x feature grid, inline edit)
- [x] Platform Admin UI: org limits panel in org edit dialog (Limits tab)
- [x] Platform Admin UI: org delete button with confirmation dialog

## Bug Fixes - Apr 3 2026 (Session 2)

- [ ] PageBuilder banner block: add button color fields (primary button bg + text color, secondary button bg + text color)
- [x] Platform Admin: add Subscription Plans tab with editable plan limits grid (features × plans)
- [x] Platform Admin: add org limits override panel inside org edit dialog
- [x] Platform Admin: add Delete Organization button with confirmation
- [x] PageBuilder: fix null validation error on page save (metaTitle/metaDescription/customCss sent as null)
- [ ] PageBuilder: collapsible block editing — blocks show live preview when collapsed, settings panel when expanded/selected
- [ ] PageBuilder: direct media upload (image/video) with storage to Media Library for image/video fields
- [ ] PageBuilder: image AND video background options in all banner and CTA blocks
- [ ] PageBuilder: undo/redo history (Ctrl+Z / Ctrl+Y + toolbar buttons)
- [ ] PageBuilder: Text & Media block - add image position left/right selector
- [ ] PageBuilder: HTML block - show live sandboxed iframe preview when block is collapsed
- [ ] PageBuilder: fix paste block (clipboard paste not working, unclear UX on new pages)
- [ ] PageBuilder: "Import Block from Page" - modal with page search/select and block picker to import any block from any other page
- [ ] PageBuilder: Feature Grid - replace hardcoded SVG icons with searchable Lucide icon picker + custom image option per feature card
- [ ] PageBuilder: Add "Checklist Steps" block type (like Numbered Steps but with checkmarks instead of numbers)
- [ ] PageBuilder: Duplicate top toolbar (Show Header/Footer/Published + Save Page) to appear above the canvas too
- [ ] PageBuilder: Numbered Steps + Checklist Steps - add layout direction (left/right), center alignment when no text, image/video per item (above/below/replace text)
- [ ] PageBuilder: Banner block - add preview page URL option (opens a preview/demo page link)

## Recent Fixes & Features
- [x] Fix duplicate profile header in RecordPage (removed nested DashboardLayout)
- [x] Add CSS code editor to Form Settings style tab (CodeMirror, customCss column, injected in FormPlayerPage)
- [x] Add org slug to form URLs (/forms/:orgSlug/:slug)
- [x] Allow editing form URL slug inline in Share tab
- [x] Fix Forms share sidebar tabs (Links, Preview, Embed Code, QR Code now switch content)
- [x] Remove Group Manager Portal from sidebar nav, add as button in Groups page header
- [x] Add video background support to Banner and CTA blocks in Page Builder
- [x] Add HTML iframe preview in Page Builder HTML block
- [x] Add previewPageUrl button to BannerPreview

## Branding Color System
- [ ] Expand platform_settings branding to include buttonColor, sidebarBgColor, sidebarTextColor, pageBgColor, accentColor fields
- [ ] Add color pickers for button/sidebar/background in Platform Admin Branding tab
- [ ] Load branding on app startup via publicBranding query and inject as CSS variables
- [ ] Apply CSS variables to DashboardLayout sidebar and buttons

## Two-Tier Branding System
- [ ] Add buttonColor, sidebarBgColor, sidebarTextColor, sidebarActiveColor, pageBgColor to org_settings table
- [ ] Create resolvedBranding public procedure: returns platform branding for site admins, org branding for org members
- [ ] Add color pickers for button/sidebar/background in Platform Admin Branding tab
- [ ] Add color pickers for button/sidebar/background in Org Settings branding section
- [ ] Load resolvedBranding on app startup and inject as CSS variables
- [ ] Apply CSS variables to DashboardLayout sidebar, buttons, and page background

## GoDaddy Wildcard DNS & Org Subdomain Routing
- [ ] Store GODADDY_API_KEY and GODADDY_API_SECRET as project secrets
- [ ] Verify/create wildcard DNS record *.teachific.app pointing to Manus deployment
- [ ] Add orgSubdomain field to organizations table
- [ ] Create server procedure to resolve org from subdomain
- [ ] On app load, detect subdomain from hostname and load org context
- [ ] Apply org branding when accessed via subdomain
- [ ] Add subdomain field to Org Settings so admins can configure their subdomain
- [x] Add per-org subscription plan editing in Platform Admin Organizations tab (plan selector + limit overrides per org)
- [x] Fix org edit dialog save — subscription plan changes not persisting
- [x] Add Subscription tab in org edit dialog showing plan defaults + per-org limit overrides inline

## Record/Edit Video Studio (Media Library Integration)
- [x] Schema: add durationSeconds, captionsUrl, transcriptJson columns to org_media_library
- [x] Schema: add video_clips table (id, orgId, mediaItemId, label, startSec, endSec, captionsUrl, videoUrl, createdAt)
- [x] Run migration SQL for new columns and table
- [x] Backend: add lms.media.saveMediaItem procedure (upload URL + save to org_media_library with duration/captions/transcript)
- [x] Backend: add lms.media.generateCaptions procedure (transcribe video URL → return segments + VTT string + save captionsUrl to media item)
- [x] Backend: add lms.media.updateCaptions procedure (update captionsUrl + transcriptJson on existing media item)
- [x] Backend: add lms.media.saveClip procedure (save highlight clip metadata to video_clips table)
- [x] Backend: add lms.media.listClips procedure (list clips for a media item)
- [x] Backend: add lms.media.deleteClip procedure
- [x] Rename RecordPage to RecordEditPage; update route /record → /media-library#record-edit
- [x] RecordEditPage: add top-level mode tabs — Record, Upload Video, Edit Video
- [x] Record tab: screen/camera/screen+camera recording with countdown, pause/resume, recordings list
- [x] Upload Video tab: drag-and-drop or file picker for video files (mp4, webm, mov, avi); progress bar; saves to Media Library
- [x] Edit Video tab: video picker from Media Library (or URL input); loads video into editor
- [x] VideoEditor component: video player with timeline scrubber
- [x] VideoEditor: Generate Captions button → calls generateCaptions → shows editable transcript panel
- [x] VideoEditor: editable transcript panel — each segment shows timestamp + text; click segment seeks video; edit text inline
- [x] VideoEditor: caption overlay on video player (renders active segment text over video)
- [x] VideoEditor: toggle captions on/off in player
- [x] VideoEditor: highlight/clip selection — set start/end at playhead, define clip range
- [x] VideoEditor: clip list panel — name clips, add/remove, save to Media Library
- [x] VideoEditor: Save Full Video to Library (with or without captions baked-in as sidecar .vtt)
- [x] VideoEditor: Save Highlights — save each selected clip as a separate media library entry
- [x] VideoEditor: Download Full Video (direct download)
- [x] VideoEditor: Download VTT captions file
- [x] MediaLibraryPage: add Record/Edit tab (replaces standalone /record route)
- [x] Update DashboardLayout sidebar: rename "Record" → "Record/Edit", keep path /media-library#record-edit
- [x] Update App.tsx: /record redirects to /media-library#record-edit
- [ ] Media Library Files tab: show duration badge on video items; show CC badge if captionsUrl set (future enhancement)
- [ ] Media Library Files tab: "Edit Video" button on video items opens Edit Video tab with that item pre-loaded (future enhancement)
- [x] Write vitest tests for VTT generation, clip validation, transcript editing, format helpers (10 tests)

## Audio Studio & Text-to-Speech (Media Library Integration)
- [ ] Backend: add lms.media.generateSpeech procedure (TTS via forge API v1/audio/speech → save mp3 to S3 → save to media library)
- [ ] Backend: TTS supports voice selection (alloy, echo, fable, onyx, nova, shimmer), speed control
- [ ] RecordEditPage: add "Audio" top-level tab alongside Record/Upload/Edit
- [ ] Audio tab: sub-tabs — Record Audio, Upload Audio, Text-to-Speech
- [ ] Record Audio sub-tab: microphone-only recording (MediaRecorder, audio/webm), waveform visualizer, pause/resume/stop, save to Media Library
- [ ] Upload Audio sub-tab: drag-and-drop or file picker for audio files (mp3, wav, m4a, ogg, webm); progress bar; saves to Media Library
- [ ] Text-to-Speech sub-tab: textarea for input text, voice selector (6 voices with preview labels), speed slider (0.25–4.0), Generate button, audio player preview, Save to Media Library button
- [ ] Audio waveform visualizer using Web Audio API AnalyserNode (real-time during recording)
- [ ] Audio player component: play/pause, seek bar, time display, download button
- [x] StudioTab type extended to include "audio"
- [ ] Update DashboardLayout sidebar Record/Edit icon to include audio hint
- [x] Write vitest tests for TTS input validation and audio format helpers (15 new tests, 49 total)

## Teachific Studio™ Branding & Audio Features
- [x] Rename Record/Edit page header and description to "Teachific Studio™"
- [x] Update DashboardLayout sidebar nav item from "Record/Edit" to "Teachific Studio™"
- [x] Update MediaLibraryPage Record/Edit tab label to "Teachific Studio™"
- [x] RecordEditPage: add "Audio" tab (4th top-level tab) with Headphones icon
- [x] AudioTab: sub-tabs — Record Audio, Upload Audio, Text-to-Speech
- [x] Record Audio sub-tab: microphone-only MediaRecorder, real-time waveform canvas visualizer, pause/resume/stop, recordings list with save-to-library
- [x] Upload Audio sub-tab: drag-and-drop for mp3/wav/m4a/ogg/webm, progress bar, saves to Media Library
- [x] Text-to-Speech sub-tab: textarea (max 4096 chars with counter), voice selector (alloy/echo/fable/onyx/nova/shimmer with descriptions), speed slider (0.25–4.0), file name input, Generate button, audio preview player, Save to Media Library button
- [x] StudioTab type extended to include "audio"
- [x] Write vitest tests for TTS input validation and audio format helpers (15 new tests, 49 total)

## Default Org Fix
- [x] Fix default org selection: owner's dashboard should default to Teachific org, not All About Ultrasound
- [x] Investigate org ordering/priority logic in myOrgs procedure
- [x] Set Teachific as the primary/default org for the owner user
- [x] Add isPrimary column to organizations table; set Teachific (id=30002) as isPrimary=true
- [x] Update myContext, getOrgsByUserId, getOrgIdForUser to sort by isPrimary first

## Bug Fixes from User Testing (Apr 3)
- [ ] BUG: School page (/school/:orgSlug) redirects to OAuth login for unauthenticated users — courses.list and themes.get are protectedProcedures
- [ ] FIX: Add publicCoursesBySlug and publicThemeBySlug procedures (publicProcedure, keyed by slug)
- [ ] FIX: Update SchoolPage to use public procedures when user is not logged in

## Bug Fixes from User Testing (Apr 3 - Session 2)
- [x] BUG: WebsitePage (Marketing > Website) had hardcoded "All About Ultrasound" placeholder text — fixed to load real org name/description from DB
- [x] BUG: Clicking "Settings" sidebar item navigated to /settings which returned 404 — added redirect /settings → /lms/settings
- [x] BUG: Clicking "Platform Admin" sidebar item navigated to /admin which returned 404 — added redirect /admin → /platform-admin

## Marketing Landing Page (Sales Page)
- [x] Write all ad copy: hero headline, subheadline, value propositions, feature descriptions, social proof, CTA copy
- [x] Build LandingPage component: hero, features grid, how-it-works, pricing/comparison table, testimonials, footer CTA
- [x] Route /: logged-out users see LandingPage; logged-in users redirect to /lms dashboard
- [x] Add public nav bar with logo, nav links, Login and Sign Up buttons
- [x] Add pricing section with Free / Pro / Enterprise tiers and feature comparison table
- [x] Add Sign Up CTA buttons throughout the page
- [ ] Stripe checkout integration (pending user providing Stripe app credentials)
- [ ] Save checkpoint and deliver

## Auth Page Rebrand & Navy Theme
- [x] Remove all Manus/Meta references from auth pages (login, register, forgot-password, reset-password, verify-email)
- [x] Redesign auth pages with unique Teachific branding (logo, headline, visual panel, teal/navy palette)
- [x] Update sidebar background to deep navy blue (not black)
- [x] Update CSS variables: sidebar bg, card bg, dark surfaces → deep navy; primary accent stays teal
- [x] Ensure all text is legible against navy backgrounds

## Quiz Creator Tool (Standalone .quiz Editor)
- [x] Design .quiz file format spec (TEACHIFIC_QUIZ_V1 header, base64 payload, AES-256-GCM encryption for Pro)
- [x] Build quiz store (Zustand) with full CRUD for questions and quiz metadata
- [x] Build MCQ editor (multiple choice with radio/checkbox, add/remove options, image support)
- [x] Build True/False editor
- [x] Build Fill-in-Blank editor
- [x] Build Short Answer editor
- [x] Build Image Choice editor
- [x] Build Hotspot editor (canvas-based clickable region selector with image upload)
- [x] Build Matching editor (drag-and-drop pair builder with dnd-kit)
- [x] Build QuestionList sidebar with drag-to-reorder and question type badges
- [x] Build EditorToolbar with File menu (New/Open/Save/Download), Preview, Settings, License
- [x] Build QuizSettings modal (title, description, time limit, pass score, shuffle, attempts)
- [x] Build LicenseManager modal (license key entry, free vs paid tier display)
- [x] Build QuizPreview player (simulates student taking the quiz, shows score at end)
- [x] Implement .quiz file save/load (browser download, open from disk, encryption for Pro tier)
- [x] Integrate Quiz Creator into main Teachific app at /quiz-creator (no auth gate, full-screen)
- [ ] Add sidebar link to Quiz Creator from LMS dashboard
- [ ] Add Teachific platform integration: publish quiz to course, import .quiz into course builder
- [ ] Add license key generation and validation backend (server-side license issuance)

## QuizCreator as Standalone Product
- [x] Add quiz_creator_role enum (none/lite/premium) to users table in schema + migration
- [x] Add backend procedures: getQuizCreatorRole, setQuizCreatorRole (admin only)
- [x] Gate /quiz-creator route: require quiz_creator_role (lite or premium) OR LMS Enterprise plan
- [ ] Add QuizCreator sidebar link in LMS dashboard (visible only to Enterprise users — pending user request)
- [x] Build standalone QuizCreator app shell (no LMS sidebar) for quiz_creator-only users at /quiz-creator-app
- [x] Standalone shell: QuizCreator branding, Lite/Premium badge, logout, upgrade CTA
- [x] Build QuizCreator sales/marketing landing page at /quiz-creator-pro with full ad copy
- [x] Sales page: hero, feature highlights, Lite vs Premium comparison table, pricing cards, CTAs
- [x] Route /quiz-creator-app for standalone users → QuizCreator dashboard shell
- [x] Route /quiz-creator for LMS Enterprise users → full editor (QuizCreatorGate)
- [x] Logged-out users visiting /quiz-creator → redirect to login, then gate checks role
- [ ] Add QuizCreator plan to platform admin: assign quiz_creator_role to users
- [ ] Stripe integration for QuizCreator Lite/Premium subscriptions (pending credentials)

## Import from QuizCreator into Course Builder
- [ ] Audit lesson schema: understand how lesson content type is stored (video/text/quiz/scorm)
- [ ] Add .quiz file upload endpoint: accept .quiz file, decrypt if encrypted, store parsed quiz JSON linked to lesson
- [ ] Add importedQuizId column to lessons table (nullable FK to quizzes)
- [ ] Add tRPC procedure: lessons.importFromQuizCreator (upload .quiz, parse, create quiz record, link to lesson)
- [ ] Add "Import from QuizCreator" button in lesson editor (CourseBuilderPage)
- [ ] File picker: accept .quiz files only, show quiz title/question count preview before confirming
- [ ] On confirm: create lesson of type "quiz" with the imported quiz data
- [ ] Course player: render imported QuizCreator quizzes using the existing quiz engine
- [ ] Show quiz source badge "Imported from QuizCreator" in lesson editor
- [ ] Write vitest tests for the import procedure

## 404 Audit & Fix
- [ ] Audit all sidebar nav links against registered routes in App.tsx
- [ ] Audit all in-app href links (a tags, Link components) for broken paths
- [ ] Fix all identified 404s: missing routes, broken hrefs, missing redirects

## Member (Student) Gating Audit
- [ ] Audit orgMemberRole check: ensure non-admin members are blocked from LMS admin routes
- [ ] Ensure /lms, /lms/courses, /members, /sales, /analytics, /platform-admin redirect members to /school
- [ ] Ensure /learn/:courseId works for enrolled members
- [ ] Ensure /school/:slug public page works without login
- [ ] Ensure /lms/my-courses works for members
- [ ] Fix /lms/catalog 404 (add route or redirect)
- [ ] Fix /policies/teachific 404 (add Terms/Privacy page)
- [ ] Fix /api/quiz/template 404 (add backend route for quiz template download)
- [ ] Ensure member cannot access QuizCreator without quiz_creator_role

## Stripe Billing Integration
- [ ] Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET env vars
- [ ] Install stripe npm package
- [ ] Create Stripe products/prices: Teachific Pro, Teachific Enterprise, QuizCreator Lite, QuizCreator Premium
- [ ] Backend: stripeRouter with createCheckoutSession, createPortalSession, getSubscription procedures
- [ ] Backend: Stripe webhook handler (/api/stripe/webhook) to sync subscription status to DB
- [ ] DB: stripe_subscriptions table (orgId, userId, stripeCustomerId, stripeSubscriptionId, plan, status, currentPeriodEnd)
- [ ] Frontend: BillingPage showing current plan, upgrade options, payment history
- [ ] Frontend: Upgrade CTA buttons on Pro/Enterprise features linking to Stripe checkout
- [ ] Frontend: QuizCreator upgrade flow (Lite/Premium) via Stripe checkout
- [ ] Frontend: Post-checkout success/cancel redirect handling

## Platform Billing Tiers (Teachific Plans)
- [ ] Define PLAN_LIMITS constant with all 5 tiers (Free/Starter/Builder/Pro/Enterprise)
- [ ] Create server/stripePlans.ts with Stripe product/price IDs for monthly + annual billing
- [ ] Create Stripe products and prices via API on server startup (idempotent)
- [ ] stripeRouter: createCheckoutSession (monthly/annual, plan selection)
- [ ] stripeRouter: createPortalSession (manage/cancel subscription)
- [ ] stripeRouter: getSubscription (current plan + status for org)
- [x] Stripe webhook handler at /api/stripe/webhook (checkout.session.completed, customer.subscription.updated/deleted)
- [ ] BillingPage: plan comparison table with feature matrix
- [ ] BillingPage: current plan card with status, next billing date, cancel option
- [ ] BillingPage: upgrade/downgrade flow with monthly/annual toggle
- [ ] BillingPage: Enterprise "Contact Sales" CTA
- [ ] Wire plan limits to feature gates across the app

## Org Settings Page
- [ ] OrgSettingsPage: General tab (org name, logo, subdomain setup)
- [ ] OrgSettingsPage: Theme tab (primary color, accent, sidebar colors, fonts)
- [ ] OrgSettingsPage: Payment tab (connect own Stripe account, PayPal integration)
- [ ] OrgSettingsPage: Billing tab (Teachific subscription management - links to BillingPage)
- [ ] OrgSettingsPage: Members tab (auto/manual enrollment toggle, member list)
- [ ] Subdomain setup: validate and save customSubdomain field on org record
- [ ] Display subdomain preview link after setup

## AI-Generated Org Homepage + WYSIWYG Editor
- [ ] On org creation: collect org name, tagline, description, logo, primary color
- [ ] AI generates homepage HTML/JSON content (hero, features, CTA sections)
- [ ] Store page content in lms_pages table as JSON blocks
- [ ] Display generated homepage at /[orgSlug] or subdomain root
- [ ] WYSIWYG drag-and-drop page editor (block-based: text, image, CTA, video, pricing)
- [ ] Show live preview link and copy button for subdomain URL

## Member Management
- [ ] Bulk member import: CSV/Excel upload with columns (name, email, role, group)
- [ ] Import preview: show parsed rows, flag errors, confirm before saving
- [ ] Auto-enrollment toggle per org (new members auto-enrolled in all published courses)
- [ ] Manual enrollment: admin selects courses for each member
- [ ] Member list: search, filter by role/group, export CSV
- [ ] Group management: create groups, assign members, bulk-enroll groups to courses

## Per-Org Payment Collection
- [ ] OrgPaymentSettings: store stripeAccountId (Connect), paypalEmail per org
- [ ] Course pricing: per-course price with Stripe checkout for member purchase
- [ ] Transaction fee deduction based on plan tier (3% Starter, 1% Builder, 0% Pro/Enterprise)
- [ ] Revenue share: Pro/Enterprise - split revenue % with multiple users, payout via PayPal

## Transaction Fees & Auto-Enrollment
- [ ] Transaction fee applied to course checkout (3% Starter, 1% Builder, 0% Pro/Enterprise)
- [ ] Auto-enrollment toggle in Org Settings (General tab)
- [ ] Auto-enrollment courses selector (which courses to auto-enroll into)
- [ ] Auto-enrollment trigger on member join

## Enterprise Sales & Email & Webhook
- [ ] Enterprise contact-sales button on Billing page
- [ ] Enterprise inquiry notification to platform owner
- [x] Enrollment confirmation email on auto-enroll and bulk import
- [ ] Stripe checkout.session.completed webhook grants course access

## Bug Fixes
- [x] Fix video upload in Teachific Studio (lesson video upload not working)

## Teachific Studio Standalone Product
- [x] Fix video upload in Teachific Studio
- [ ] Studio standalone sales/landing page at /studio
- [ ] Studio subscription tiers (Free, Creator $19/mo, Pro $49/mo, Team $99/mo)
- [ ] Studio Stripe products and checkout flow
- [ ] Standalone Studio dashboard at /studio/dashboard
- [ ] Studio subscriber gating (separate from LMS org subscription)

## Upload Queue (Background Multi-Video Upload)
- [ ] Build UploadQueueContext + useUploadQueue hook with sequential processing
- [ ] Build UploadQueuePanel floating tray component (minimizable, shows per-item progress)
- [ ] Integrate queue into RecordEditPage UploadTab (video) and UploadAudioSubTab (audio)
- [ ] Wire UploadQueuePanel as global overlay in App.tsx
- [ ] Test: queue 3 videos, navigate away, verify all complete in background

## Bug Fix: Upload Timeouts (Chunked Upload)
- [x] Add server-side chunked upload endpoint (/api/chunked/media/*)
- [x] Update UploadQueueContext to split files into 5 MB chunks and upload sequentially
- [ ] Test large video upload (>100MB) end-to-end without timeout

## TeachificStudio Bug Fixes (from user test)
- [x] Fix subscription gate: bypass for site_owner and site_admin roles
- [x] Fix webhook: handle product_type=studio in checkout.session.completed to update studioRole
- [x] Fix StudioDashboard: add "New Recording" quick action linking to /media-library#record-edit
- [x] Fix useUploadQueue Fast Refresh: split hook into client/src/hooks/useUploadQueue.ts
- [x] Fix StudioDashboard: after logout redirect to / not /studio-pro
- [x] Fix StudioDashboard: Analytics nav item replaced with correct nav items (Record & Upload, Media Library, etc.)

## Bug Fix: Camera Settings in TeachificStudio
- [x] Diagnose camera device enumeration / constraints / preview failure
- [x] Fix camera settings UI: filter empty deviceId from enumerateDevices to prevent SelectItem crash
- [x] Fix Settings panel crash: empty-value SelectItem in mic/camera dropdowns replaced with 'default' values
- [x] Verified: all tabs (Record Video, Upload Video, Edit Video, Audio + sub-tabs), all mode buttons, Settings panel, Voice dropdown all work without errors

## Feature: Recording Countdown Timer
- [ ] Add 3-2-1 animated countdown overlay to RecordEditPage before recording starts
- [ ] Wire countdown into the record button handler (delay actual capture start)
- [ ] Allow user to cancel during countdown

## Feature: Draggable Camera Bubble + Logo Mode in TeachificStudio
- [ ] Add draggable camera bubble overlay in Screen+Camera mode (reposition anywhere over preview)
- [x] Add snap-to-corner presets (top-left, top-right, bottom-left, bottom-right)
- [ ] Add logo mode toggle: replace webcam feed with an uploaded logo image in the bubble
- [ ] Upgrade countdown overlay to full-screen animated 3-2-1 display

## Feature: Auto-Save Recordings to Media Library
- [x] Auto-save recording to Media Library immediately when user clicks Stop
- [x] Show uploading spinner/progress in the recordings list during auto-save
- [ ] Remove manual "Save to Library" button (replaced by auto-save)

## Feature: MP4 Recording Format
- [ ] Record in MP4 format (video/mp4) instead of WebM
- [ ] Update file extension and mimeType in recording name and save handler

## Feature: Auto-Populate Transcript in Edit Tab
- [ ] Auto-trigger generateCaptions when Edit tab opens and no transcript exists
- [ ] Show loading state while transcript is being generated
- [ ] Display transcript segments automatically once generated

## Bug Fix: Transcript Generation Failing
- [ ] Diagnose and fix generateCaptions procedure failure
- [ ] Verify transcription API key and endpoint are correctly configured

## Feature: Auto-Generate 10 Highlight Clips from Transcript
- [ ] After transcript is generated, auto-create 10 evenly-spaced highlight clips
- [ ] Each clip gets a label derived from its transcript text
- [ ] Add download button per clip to export as standalone video
- [ ] Server-side clip extraction endpoint using FFmpeg (trim video to clip time range)

## Feature: VideoEditor Comprehensive Rewrite (Loom-style)
- [x] Transcript multi-select with shift-click
- [x] "Delete selected segments" button to mark/cut segments
- [x] Caption style picker: Default, Bold, Outlined, Highlighted, Animated Pop, Subtitle Bar
- [x] Auto-generate 10 highlight clips from transcript
- [x] Per-clip download button (client-side canvas capture)
- [ ] extractClip procedure in lmsRouter.ts (FFmpeg trim + S3 upload)
- [x] Countdown fires AFTER screen-share picker (not before)
- [x] Auto-save recording to library on stop
- [x] Draggable camera bubble with snap-to-corner
- [ ] Logo upload toggle for camera bubble
- [x] Auto-populate transcript on Edit tab load (already implemented)

## Bug Fix: Transcription (generateCaptions) Still Failing
- [ ] Check server logs for the exact error when generateCaptions is called
- [ ] Inspect the generateCaptions procedure and voiceTranscription helper
- [ ] Verify the audio extraction / file URL passed to the transcription API
- [ ] Fix root cause and verify transcription works end-to-end

## CC Style Editor (VideoEditor)
- [x] CC style panel: text color picker (white/black/yellow/cyan/custom)
- [x] CC style panel: background color + opacity slider
- [x] CC style panel: bold / italic / shadow toggles
- [x] CC style panel: font size slider
- [x] CC style panel: 8 preset color schemes (Classic, Neon, Karaoke, TikTok, Minimal, Fire, Purple, White)
- [x] CC emoji auto-insert toggle (maps 20 keywords to emojis in transcript display)
- [x] Live CC overlay on video using div overlay (not native track) for full style control
- [x] CC style persisted in component state and applied to overlay
- [x] Live preview section in style panel
- [x] Reset to Default button

## Feature: Burn Styled Captions into Video (FFmpeg Export)
- [ ] burnCaptions tRPC procedure: accept mediaItemId, segments, CCStyle params
- [ ] Server-side: download video from S3, write ASS subtitle file with style params
- [ ] Server-side: run FFmpeg with ass subtitle filter to burn captions into frames
- [ ] Server-side: upload burned MP4 to S3, return download URL
- [ ] VideoEditor UI: "Export Burned Video" button in CC style panel
- [ ] Show progress spinner with status messages during burn (can take 30-120s)
- [ ] On complete: show download link + auto-trigger browser download
- [ ] Handle emoji in subtitle text (strip or replace with text equivalents for FFmpeg)

## Bug Fix: Record Tab Controls Unresponsive After Save
- [x] Diagnose why buttons/controls are frozen after recording is saved
- [x] Fix state management so recordState resets properly after auto-save
- [x] Ensure "New Recording" / "Record Again" button works after save
- [x] Ensure download, delete, and edit buttons on saved recordings work

## Bug Fix: Transcription Fails — FFmpeg Unavailable in Production
- [x] Fix voiceTranscription.ts to send webm directly to Whisper API (webm IS supported)
- [x] Remove hard dependency on FFmpeg for audio extraction
- [x] Try FFmpeg extraction first (if available), fall back to sending video file directly
- [x] Fix "Invalid file format" error — normalize video/webm → audio/webm MIME type for Whisper
- [ ] Test transcription end-to-end on a real recording (manual test required)

## Bug Fix: Camera Preview Dim and Dark in Recording Studio
- [x] Find camera preview video element in RecordEditPage
- [x] Fix dim camera: removed bg-black/60 overlay that covered the camera feed in idle state
- [x] Request camera with explicit video constraints (720p ideal, 30fps)
- [x] Ensure camera video element is not behind a dark overlay
- [x] Added subtle "Camera ready" badge at bottom of preview (non-blocking)
- [x] Fixed screen+camera mode: camera now shows full-size in idle/stopped state (not just small bubble)
- [x] Added useEffect to re-attach camera stream when video element swaps between full-size and bubble
- [ ] Test camera preview appears bright and clear (manual test required)

## Bug Fix: Camera Preview Has Black Bars on Sides
- [x] Fix camera video element: wrap in absolute-positioned div, apply scaleX(-1) to wrapper not video
- [x] Add aspectRatio: 16/9 to getUserMedia constraints to prevent 4:3 camera streams causing black bars
- [x] Ensure mirror transform doesn't clip video via overflow-hidden on parent container

## Feature: Auto-Stop and Save Recording on Tab Close
- [ ] Add beforeunload handler to stop MediaRecorder and trigger save when tab is closed
- [ ] Add visibilitychange handler to detect tab hide/navigation away
- [ ] Use sendBeacon API to upload recording data before page unloads
- [ ] Show "Recording saved automatically" toast when user returns or on next visit
- [ ] Warn user with confirmation dialog if recording is in progress and they try to close

## Bug Fix: Camera Still Has Black Bar on One Side
- [x] Changed objectFit from cover to fill — eliminates black bars from any aspect ratio mismatch
- [x] Applied transform scaleX(-1) directly to absolutely-positioned video element (no wrapper div)

## Feature: Auto-Stop and Save Recording on Tab Close
- [x] Added beforeunload handler — shows native browser "Leave site?" dialog when recording is active
- [x] Added visibilitychange handler — auto-stops and saves recording when tab becomes hidden
- [x] Uses existing autoSaveRecording path (recorder.onstop fires and uploads to Media Library)

## Bug Fix: Landing Page Subscription Options + Content Cleanup
- [x] Audited pricing section — was showing only 3 wrong tiers (Free, $49 Pro, Enterprise)
- [x] Fixed to show all 5 correct tiers: Free, Starter ($39), Builder ($99), Pro ($199), Enterprise
- [x] Updated comparison table to include all 5 tiers with correct feature matrix
- [x] Removed all ultrasound/echo/cardiac/POCUS/OBGyn references across all pages
- [x] Replaced with generic education examples (Python, Digital Marketing, World History, etc.)
- [x] Verified pricing matches stripePlans.ts definitions

## UX Improvement: Eliminate Flash of Logged-Out Landing Page
- [x] Audit App.tsx and LandingPage.tsx for current auth-check and redirect logic
- [x] Built branded "Lights, camera, learning..." loading screen with spinning Clapperboard icon
- [x] Show loading screen while auth check is in-flight (instead of blank or marketing page)
- [x] Teal text and pulsing ring animation with Teachific wordmark
- [x] Cache auth state in localStorage — returning users recognized instantly, no loading screen
- [x] LandingPage redirects immediately when user is known from cache

## Feature: Update Storage Limits Per Plan
- [ ] Update stripePlans.ts storage limits: Free=100GB, Starter=1TB, Builder=2TB, Pro=5TB, Enterprise=Unlimited
- [ ] Update LandingPage.tsx PRICING_TIERS storage feature text for all 5 tiers
- [ ] Update backend storage gating to enforce new limits per plan
- [ ] Update BillingPage storage display to show new limits

## Feature: TeachificPay (Stripe Connect Express Platform)
- [ ] Update PLAN_LIMITS: add customGateway flag (false for Free/Starter, true for Builder+)
- [ ] Update PLAN_LIMITS: set teachificPayFeePercent (2% for Free/Starter, 0.5% for Builder+)
- [ ] Update landing page comparison chart: add "Custom Payment Gateway" row, remove transaction fee row
- [ ] Update landing page pricing cards: remove fee mentions, add TeachificPay badge
- [ ] Backend: Stripe Connect Express onboarding endpoint for Builder+ creators
- [ ] Backend: TeachificPay checkout (Stripe Connect with platform fee) for all plans
- [ ] Backend: Enforce gateway rules — Free/Starter always use TeachificPay
- [ ] Backend: Group registrations always route through TeachificPay regardless of plan
- [ ] Backend: Store connected Stripe account ID on org (stripe_connect_account_id)
- [ ] UI: TeachificPay onboarding flow in Payment Settings for Builder+ plans
- [ ] UI: Payment gateway selector in org settings (TeachificPay vs own gateway) for Builder+
- [ ] UI: TeachificPay badge/indicator on checkout pages
- [ ] UI: Payout dashboard showing earnings, pending payouts, and fee breakdown

## Bug Fix: Remove Transaction Fee from Pricing Cards on Sales Page
- [ ] Find and remove transaction fee bullet from each pricing card on LandingPage
- [ ] Keep TeachificPay fee info only in the comparison table (not in cards)

## TeachificPay — Completion Audit (Apr 2026)
### DONE ✅
- [x] PLAN_LIMITS: customGateway flag (false Free/Starter, true Builder+) in stripePlans.ts
- [x] PLAN_LIMITS: teachificPayFeePercent (2% Free/Starter, 0.5% Builder+) in stripePlans.ts
- [x] DB schema: stripeConnectAccountId, stripeConnectStatus, paymentGateway, ownStripePublishableKey, ownStripeSecretKeyEncrypted on organizations table
- [x] DB migration applied via migrate-teachificpay.mjs
- [x] Backend teachificPayRouter registered at trpc.teachificPay.*
- [x] Backend: getStatus — returns org connect status, tier, gateway, fee info
- [x] Backend: startConnectOnboarding — creates Stripe Connect Express account + onboarding link
- [x] Backend: syncConnectStatus — syncs account status from Stripe after onboarding return
- [x] Backend: setGateway — lets Builder+ orgs switch between teachific_pay and own_gateway
- [x] Backend: createCheckout — TeachificPay checkout with platform fee via Stripe Connect
- [x] Backend: getEarnings — available/pending balance + payout history for connected account
- [x] Backend: adminListAccounts — platform admin view of all connected orgs
- [x] Backend: adminGetPlatformRevenue — platform-level fee revenue summary
- [x] Backend: adminSetOrgGateway — platform admin can override org gateway
- [x] Backend: adminRefundCharge — platform admin can issue refunds
- [x] UI: OrgPaymentSettingsTab — TeachificPay section with fee info, plan messaging
- [x] UI: TeachificPayConnectSection — Connect Express onboarding button, status badge, earnings summary
- [x] UI: Custom Gateway section (Builder+ only) — own Stripe + PayPal credential entry
- [x] Landing page: comparison table has TeachificPay fee row + Custom Payment Gateway row
- [x] Landing page: pricing cards show TeachificPay fee (no transaction fee)
- [x] Landing page: Teachific™ TM symbol on all body copy mentions
- [x] Landing page: AI course/page builder messaging in features + How It Works steps

### PENDING ❌
- [ ] Platform Admin: Add "TeachificPay" tab to PlatformAdminPage using adminListAccounts + adminGetPlatformRevenue + adminRefundCharge procedures
- [ ] Checkout enforcement: update course/product checkout flow to call trpc.teachificPay.createCheckout instead of billing.createCheckoutSession for TeachificPay orgs
- [ ] Checkout enforcement: block own_gateway checkout for Free/Starter plans at the UI level
- [ ] Group registration checkout: always route through TeachificPay regardless of org gateway setting
- [ ] Connect return URL handler: call trpc.teachificPay.syncConnectStatus when user returns from Stripe onboarding (?connect=success in URL)
- [ ] TeachificPay badge on student-facing checkout pages
- [x] Webhook: handle Stripe Connect account.updated events to auto-sync stripeConnectStatus

## Saved Prompt — Landing Page Updates (Apr 2026)
- [x] Add Teachific™ TM symbol to all body copy mentions on landing page
- [x] Add AI tools messaging to "Create Your School" and "Build Your Courses" steps
- [x] Add AI Course & Page Builder feature card to features grid
- [x] Update How It Works headline to "From idea to income — in no time"

## Feature: Dedicated Teachific-Branded Auth Pages (Apr 2026)
- [ ] Build /login page — Teachific-branded, email + password, no Manus branding
- [ ] Build /signup page — Teachific-branded, name + email + password, no Manus branding
- [ ] Backend: auth.emailLogin procedure (email + password → session cookie)
- [ ] Backend: auth.emailRegister procedure (name + email + password → session cookie)
- [ ] Backend: auth.forgotPassword procedure (send reset email via SendGrid)
- [ ] Backend: auth.resetPassword procedure (token → new password)
- [x] Update all getLoginUrl() calls on landing page to point to /login
- [x] Update all signUpUrl calls on landing page to point to /register
- [x] Remove Manus OAuth portal redirect from all public-facing CTAs
- [ ] Keep Manus OAuth as optional fallback for admin/owner login only

## Bug Fix / Clarification: Free Trial CTA Buttons (Apr 2026)
- [x] Audit all "Start Free Trial" buttons on landing page — no trial structure exists
- [x] Replace "Start Free Trial" with "Get Started Free" (points to /register)
- [x] Free plan = always free (no trial), paid plans = sign up then upgrade from billing
- [x] Remove any trial-period language from pricing cards and comparison table
- [x] Decision: YES — 14-day free trial for paid plans. trial_ends_at fields added to schema for Studio, Creator, QuizCreator. LMS org trial via Stripe trial_period_days:14 on checkout.

## Bug Fix: Remove TeachificPay Fee Row from Comparison Chart (Apr 2026)
- [x] Remove "TeachificPay fee" row from COMPARISON_FEATURES array in LandingPage.tsx
- [x] Keep "Custom payment gateway" row (it's a feature, not a fee)

## Feature: Standalone Product Sales Pages + Admin Tools (Apr 2026)
### Sales Pages
- [x] Audit TeachificCreator current status — backend fully built, dashboard/editor/sales page exist, admin procedures added
- [ ] Build /quiz-creator standalone sales page for Teachific QuizCreator™
- [ ] Update /creator-pro sales page — ensure branding, pricing, and CTA consistency
- [ ] Update /studio-pro sales page — ensure branding, pricing, and CTA consistency
- [x] Add "Products" dropdown or nav links to main LandingPage nav (Creator, Studio, QuizCreator)
- [x] Add standalone product links to LandingPage footer
### Platform Admin Tools
- [x] Add "TeachificCreator™ Customers" tab to PlatformAdminPage
- [x] Add "Teachific Studio™ Customers" tab to PlatformAdminPage
- [x] Add "Teachific QuizCreator™ Customers" tab to PlatformAdminPage
- [x] Each tab: list customers, plan/role, trial status, joined date
- [x] Each tab: ability to view/edit customer role via dropdown
- [ ] Each tab: platform revenue summary for that product (pending Stripe integration)

## Watermark on Free/Trial Exports
- [ ] Free accounts and free trial users (Studio, QuizCreator, TeachificCreator) must have "Created with Teachific™" watermark on ALL exports, downloads, and outputs
- [ ] TeachificCreator: inject watermark HTML/CSS overlay into exported SCORM/HTML packages
- [ ] QuizCreator: inject watermark into quiz PDF exports and any downloadable output
- [ ] Studio: overlay watermark on exported/downloaded video files
- [ ] Show "Remove watermark — upgrade to paid plan" notice on free/trial dashboards
- [ ] Watermark must be persistent (cannot be easily removed by end user)

## Full UX Audit & Creator Upgrade Flow (Apr 5, 2026)

- [ ] Full end-to-end user flow test: landing page, auth, nav, all product links
- [ ] Build TeachificCreator in-app upgrade modal (calls createCreatorCheckout)
- [ ] Add trial countdown badge to TeachificCreator dashboard
- [ ] Add trial countdown badge to Teachific Studio dashboard
- [ ] Add trial countdown badge to Teachific QuizCreator dashboard
- [ ] Test and verify LMS org 14-day trial checkout flow
- [ ] Test and verify Studio checkout trial flow
- [ ] Test and verify TeachificPay Connect onboarding flow
- [ ] Fix all bugs found during testing

## Full UX Audit & Creator Upgrade Flow (Apr 5, 2026)

- [ ] Full end-to-end user flow test: landing page, auth, nav, all product links
- [ ] Build TeachificCreator in-app upgrade modal (calls createCreatorCheckout)
- [ ] Add trial countdown badge to TeachificCreator dashboard
- [ ] Add trial countdown badge to Teachific Studio dashboard
- [ ] Add trial countdown badge to Teachific QuizCreator dashboard
- [ ] Test and verify LMS org 14-day trial checkout flow
- [ ] Test and verify Studio checkout trial flow
- [ ] Test and verify TeachificPay Connect onboarding flow
- [ ] Fix all bugs found during testing

## Confirmed Product Architecture (Apr 5 2026)

### Desktop App Decisions
- [ ] Build TeachificCreator™ as Electron standalone desktop app (Windows + Mac) at $117/mo
- [ ] TeachificCreator™ includes: slide authoring, PPTX import/export, SCORM export, QuizMaker built-in, Studio video tools built-in, Content Library (characters/backgrounds/objects/icons), AI image gen, role-play builder, interactions
- [ ] Build Teachific QuizCreator™ as Electron standalone desktop app (Windows + Mac) at $47/mo
- [ ] QuizCreator features: Form View + Slide View, question groups, shuffle, True/False/MC/Image/Hotspot/Matching/Sequence/Fill-in-blank, intro slide, user info form, quiz properties (title/size/time limit/scoring), player customization (features/navigation/color scheme/text/font/corner radius), import questions (Excel/CSV), translation, preview, publish (SCORM/HTML5/.quiz)
- [ ] Build Teachific Studio™ as Electron standalone desktop app (Windows + Mac) at $47/mo
- [ ] Studio features: screen/camera/both recording, transcription generation, transcription-based editing (delete words = cut video, like Loom), AI-generated 10 highlight clips from full video, export as MP4, video timeline editor
- [ ] All three desktop apps use login-based activation (email/password through Teachific)
- [ ] All three desktop apps have 14-day free trial
- [ ] All three desktop apps show watermark on exports for free/trial users

### LMS Studio Lite Gating
- [x] Update LMS plan gating: Teachific Studio™ Lite (record only) available from Builder plan and above
- [ ] Studio Lite = record only (camera, screen, or both) — no editing
- [x] Add upgrade prompts to TeachificStudio desktop app from Studio Lite in LMS

### Web Dashboards (retained)
- [ ] Update /creator dashboard to be download hub for TeachificCreator™ desktop app
- [ ] Update /studio dashboard to be download hub for Teachific Studio™ desktop app
- [ ] Update /quiz-creator-app dashboard to be download hub for QuizCreator™ desktop app
- [ ] Each dashboard has product-specific media library
- [ ] Users can choose to save to product media library OR LMS media library

### Pricing Updates
- [x] Update TeachificCreator™ sales page: $117/mo
- [x] Update Teachific Studio™ sales page: $47/mo
- [x] Update Teachific QuizCreator™ sales page: $47/mo
- [ ] Remove placeholder pricing tiers (Starter/Pro/Team) from Creator upgrade modal
- [x] Add annual billing option (2 months free) to all three products


## Confirmed Product Architecture (Apr 5 2026)

### Desktop Apps
- [ ] TeachificCreator desktop app (Electron, Win+Mac) $117/mo - slide authoring, PPTX import/export, SCORM export, QuizMaker built-in, Studio video tools built-in, Content Library, AI image gen, role-play, interactions
- [ ] Teachific QuizCreator desktop app (Electron, Win+Mac) $47/mo - Form/Slide View, question groups, shuffle, all question types, quiz properties, player customization, import questions, translation, SCORM/HTML5 publish
- [ ] Teachific Studio desktop app (Electron, Win+Mac) $47/mo - screen/camera recording, transcription, transcription-based editing (Loom-style), 10 AI highlight clips, MP4 export, timeline editor
- [ ] All desktop apps: login-based activation, 14-day trial, watermark on free/trial exports

### LMS Studio Lite Gating
- [x] Studio Lite (record only, no editing) available from Builder plan and above
- [x] Add upgrade prompts to Studio desktop app from Studio Lite in LMS

### Web Dashboards as Download Hubs
- [ ] /creator dashboard = download hub for TeachificCreator desktop + product media library
- [ ] /studio dashboard = download hub for Studio desktop + product media library
- [ ] /quiz-creator-app dashboard = download hub for QuizCreator desktop + product media library
- [ ] Users can save to product media library OR LMS media library

### Pricing Updates
- [x] Update TeachificCreator sales page to $117/mo (single plan, not tiered)
- [x] Update Studio sales page to $47/mo (single plan)
- [x] Update QuizCreator sales page to $47/mo (single plan)
- [x] Add annual billing option (2 months free) to all three products
- [ ] Remove Starter/Pro/Team tiers from Creator upgrade modal - single plan only

## Cross-Product Navigation & Functional Fixes (Apr 2026)

- [x] Create useSubscriptions hook (calls billing.getAllSubscriptions in one query)
- [x] Add getAllSubscriptions procedure to stripeRouter (LMS + Studio + Creator + QuizCreator)
- [x] Create ProductSwitcher component (sidebar + topbar variants, only shows subscribed products)
- [x] Add ProductSwitcher to LMS DashboardLayout sidebar footer
- [x] Add ProductSwitcher to StudioDashboard sidebar and topbar
- [x] Add ProductSwitcher to CreatorDashboardPage topbar (replaced static Back to LMS link)
- [x] Add ProductSwitcher to QuizCreatorDashboard topbar
- [x] Smart redirect on landing page: LMS > Studio > Creator > QuizCreator priority
- [x] Replace old tiered upgrade modal in CreatorDashboardPage with single-plan $117/mo modal
- [x] Wire createCreatorSingleCheckout in upgrade modal (replaces old createCreatorCheckout)
- [x] Add createCreatorSingleCheckout, createStudioSingleCheckout, createQuizCreatorCheckout to stripeRouter
- [x] Update stripePlans.ts with single-plan prices for all three standalone apps

## Homepage & Subdomain Fixes (Apr 2026)

- [x] Remove auto-redirect from landing page — logged-in users should see the homepage and choose to log in themselves
- [x] Audit subdomain routing for org-specific subdomains (e.g. allaboutultrasound.teachific.app)
- [x] Add frontend subdomain detection (useSubdomain hook + SubdomainSchoolRouter in App.tsx)
- [x] Add subdomainOrg prop to SchoolPage so subdomain-based org resolution works
- [x] Update LandingNav to show "Go to Dashboard" button for logged-in users instead of auto-redirecting
- [ ] Configure wildcard DNS CNAME record (*.teachific.app → teachific.app) in domain registrar — MANUAL STEP REQUIRED

## Platform-Level Policies (Apr 2026)

- [ ] Add platform_settings table columns for termsOfService and privacyPolicy (separate from org)
- [ ] Add getPlatformPolicies (public) and updatePlatformPolicies (admin-only) tRPC procedures
- [ ] Build Platform Policies editor tab under Platform Admin page
- [ ] Create public PlatformPoliciesPage served at /policies (not linked to any org)
- [ ] Update routing so /policies shows platform docs, /policies/:orgSlug still shows org docs

## Platform-Level Policies (Apr 2026)
- [x] Add termsOfService and privacyPolicy columns to platform_settings table
- [x] Run migration to add columns to live database
- [x] Add getPolicies (public) and updatePolicies (admin-only) procedures to platformAdmin router
- [x] Build PlatformPoliciesTab editor under Platform Admin → Policies tab
- [x] Create public PlatformPoliciesPage at /policies, /terms, /privacy
- [x] Update App.tsx routing so /policies serves platform docs (not org-specific)
- [x] Keep /policies/:orgSlug for org-specific policies (unchanged)

## Desktop Apps & Form Import (Apr 6 2026)
- [x] Build Electron project scaffolding for TeachificCreator (main.js, preload, splash, electron-builder config)
- [x] Build Electron project scaffolding for Teachific Studio (main.js, preload, splash, electron-builder config)
- [x] Build Electron project scaffolding for Teachific QuizCreator (main.js, preload, splash, electron-builder config)
- [x] Write GitHub Actions CI workflow to build .exe and .dmg for all three apps
- [x] Add app_versions table to database schema for managing installer download URLs
- [x] Add getLatestAppVersion and upsertAppVersion procedures to platformAdmin router
- [x] Add App Versions tab to Platform Admin for managing installer URLs per product
- [x] Build shared DownloadPage component for all three product dashboards
- [x] Add Download App nav link to CreatorDashboardPage
- [x] Add Download App nav item to StudioDashboard
- [x] Add Download App button to QuizCreatorDashboard topbar
- [x] Add importFromUrl procedure to formsRouter (LLM-powered form field extraction)
- [x] Add Import from URL button and dialog to FormBuilderPage toolbar
- [x] Fix autocorrect on all name input fields (MembersPage, PlatformAdminPage, AdminUsersPage)

## GitHub, Studio Recorder & Footer (Apr 6 2026)
- [x] Push Electron desktop app code to private GitHub repo (teachific/teachific-desktop-apps)
- [x] Wire clip export to server-side FFmpeg extractClip — produces MP4 with audio
- [x] Embed RecordEditPage directly in StudioDashboard (no redirect to /media-library)
- [x] Add "Record & Upload" nav item to Studio sidebar that opens embedded recorder
- [x] Update homepage footer Legal section with real /privacy, /terms, /policies links
- [x] Update footer grid to 5 columns for better layout

## Org User Management in Platform Admin (Apr 6)
- [ ] Add getOrgMembersAdmin procedure to platformAdmin router
- [ ] Add removeOrgMemberAdmin and updateOrgMemberRoleAdmin procedures to platformAdmin router
- [ ] Add Users tab to org edit dialog in PlatformAdminPage showing all org members with role, email, name
- [ ] Allow editing role (org_admin / user) and removing members directly from the org edit dialog
- [ ] Add "Add Existing User" search to the Users tab to add a platform user to the org

## Session: Org Settings Tabs Fix + Platform Admin Users Tab (Apr 2026)
- [x] Fix Organization Settings tabs overlapping on small screens — replaced fixed grid with flex-wrap layout
- [x] Add Users tab to org edit dialog in Platform Admin — shows all members with role, joined date, remove button, and add-by-email form
- [x] Add addUserToOrgByEmail procedure to platformAdmin router
- [x] Extend updateOrgMemberRole to accept all org role values (org_super_admin, org_admin, member, user)
- [x] Verify stripePlans.ts single-plan prices are correct (Creator $117/mo or $999/yr, Studio $47/mo or $399/yr, QuizCreator $47/mo or $399/yr)

## Bug Fix: Platform Admin Stripe Integration Shows "Coming Soon" (Apr 2026)
- [x] Find the "coming soon" placeholder in PlatformAdminPage Stripe integration tab
- [x] Replace with real Stripe integration UI (plan prices, webhook status, sandbox claim link, key status)

## Bug Fix: Stripe Sandbox Claim Link Goes to Wrong Page (Apr 2026)
- [x] Fix sandbox claim URL to use the full token-based URL from project config (not generic /claim_sandbox)
- [x] Update getStripeStatus procedure to return the correct full claim URL
- [x] Build real Stripe integration UI in Platform Admin IntegrationsTab (replace coming soon toast)

## Task: Update Stripe to Live Mode Keys (Apr 2026)
- [x] Update STRIPE_SECRET_KEY to live key
- [x] Update VITE_STRIPE_PUBLISHABLE_KEY to live key
- [x] Verify live keys work and Stripe plans re-initialize

## Task: Build Desktop App Installers v1.0.0 (Apr 2026)
- [ ] Verify CI workflows in teachific-creator-desktop, teachific-studio-desktop, teachific-quizcreator-desktop
- [ ] Create v1.0.0 release tag in teachific-creator-desktop
- [ ] Create v1.0.0 release tag in teachific-studio-desktop
- [ ] Create v1.0.0 release tag in teachific-quizcreator-desktop
- [ ] Confirm .exe and .dmg installers are attached to each release

## Feature: Subscription-Gated Desktop App Download Pages (Apr 2026)
- [ ] Add getDesktopDownloads tRPC procedure - checks subscription, returns GitHub release asset URLs per app
- [ ] Build /creator/download page - gated by creator subscription, shows Windows/Mac download buttons
- [ ] Build /studio/download page - gated by studio subscription, shows Windows/Mac download buttons
- [ ] Build /quiz-creator/download page - gated by quiz creator subscription, shows Windows/Mac download buttons
- [ ] Add download page links from each app dashboard
- [ ] Write vitest tests for the getDesktopDownloads procedure

## Bug Fix: Desktop CI build.yml
- [x] Fix build.yml in teachific-creator-desktop: remove npm cache from setup-node, upgrade to Node 22
- [x] Fix build.yml in teachific-studio-desktop: remove npm cache from setup-node, upgrade to Node 22
- [x] Fix build.yml in teachific-quizcreator-desktop: remove npm cache from setup-node, upgrade to Node 22

## Feature: Subscription-Gated Desktop Download Pages
- [x] Add getDesktopDownloads procedure to stripeRouter (checks subscription, returns GitHub release URLs)
- [x] Create DesktopDownloadPage.tsx (standalone gated page per app)
- [x] Add routes /creator/download, /studio/download, /quiz-creator-app/download in App.tsx
- [x] DownloadPage component in each dashboard reads URLs from App Versions table

## Feature: Desktop App Auto-Update
- [ ] Add electron-updater to package.json in all three desktop repos
- [ ] Add publish config (GitHub Releases) to electron-builder in package.json
- [ ] Update main.js in all three repos: check for updates on startup, show native dialog prompt
- [ ] Handle update events: checking, available, not-available, downloaded, error
- [ ] Update build.yml to publish release assets (latest.yml / latest-mac.yml metadata files)
- [ ] Test update flow end-to-end

## Platform Admin: Sitemap Tab
- [x] Add Sitemap tab to Platform Admin with live links to all 60+ pages across 15 sections
- [x] Search/filter across all pages by label, path, or description
- [x] Dynamic routes shown as non-clickable with description (requires ID)
- [x] Static routes open teachific.app in new tab
- [x] Desktop Apps section included with all 9 desktop app pages

## Account & UI Fixes (Apr 7)
- [x] Fix larawilliams0501 account plan to show correct subscription (not Free Plan)
- [x] Fix sidebar MY APPS icon colors — all icons must use teal variants only (no yellow/orange/purple)

## Desktop App SVG Icons (Apr 7)
- [x] Design TeachificCreator icon SVG (pen/document authoring theme, teal)
- [x] Design Teachific Studio icon SVG (video camera theme, teal)
- [x] Design TeachificQuizCreator icon SVG (quiz/brain/checkmark theme, teal)
- [x] Upload all three SVGs to CDN
- [x] Update DownloadPage component to show SVG icons per product
- [x] Update Platform Admin desktop app management UI to show SVG icons
- [x] Update ProductSwitcher to use SVG icons instead of Lucide icons
- [ ] Push SVG icon files to all three desktop app GitHub repos for use in electron-builder

## Branded HTML Email Templates (Apr 7)
- [x] Create base Teachific email HTML template (header with logo, footer with links)
- [x] Create verification/magic-link email template
- [x] Create password reset email template
- [x] Create welcome email template
- [x] Create course enrollment confirmation email template
- [x] Update SendGrid email sending code to use HTML templates
- [ ] Test all email templates render correctly

## Media Library File Type Expansion (Apr 2026)
- [x] Extend allowed upload types: ZIP, PDF, Word (.doc/.docx), images (jpg/png/gif/webp/svg), video (mp4/mov/webm), audio (mp3/wav/ogg/m4a)
- [x] Update server-side MIME type validation and S3 upload handler
- [x] Update DB schema if needed (mediaType enum or string field)
- [x] Update media library UI: file type icons, preview thumbnails, filter tabs
- [x] Wire branded HTML email templates into all sendEmail call sites

## GitHub SVG Icon Push & Media Copy URL (Apr 8)
- [x] Find all three desktop app GitHub repos (Creator, Studio, QuizCreator)
- [x] Push icon-creator.png to TeachificCreator repo (assets/icon.png)
- [x] Push icon-studio.png to Teachific Studio repo (assets/icon.png)
- [x] Push icon-quizcreator.png to TeachificQuizCreator repo (assets/icon.png)
- [x] Add Copy URL button to each media file card in MediaFilesPage
- [x] Show toast confirmation on copy

## Desktop App Release Bump & Media Library Enhancements (Apr 8)
- [x] Bump version in package.json and tag v1.0.5 release for teachific-creator-desktop
- [x] Bump version in package.json and tag v1.0.5 release for teachific-studio-desktop
- [x] Bump version in package.json and tag v1.0.5 release for teachific-quizcreator-desktop
- [x] Add inline file rename to media file cards (double-click filename to edit)
- [x] Add updateOrgMediaFilename tRPC procedure to lmsRouter
- [x] Add "Insert into Lesson" action to media card dropdown
- [x] Build MediaLibraryPickerModal for selecting a file to insert
- [x] Wire insert action into lesson/block editor
- [x] Reorder My Apps in ProductSwitcher: QuizCreator first, then Studio, then Creator

## Media Library Bulk Operations & Folders (Apr 8)
- [ ] Add folder support to orgMediaLibrary: new orgMediaFolders table + folderId FK on orgMediaLibrary
- [ ] Run DB migration for folders
- [ ] Add tRPC procedures: createFolder, listFolders, deleteFolder, bulkDelete, bulkMoveToFolder
- [ ] Add folder sidebar to MediaFilesPage (list folders, create, rename, delete)
- [ ] Add checkbox selection mode toggle to MediaFilesPage
- [ ] Add select-all checkbox in the grid header
- [ ] Show bulk action toolbar when items are selected (count, Delete Selected, Move to Folder)
- [ ] Build Move to Folder modal (folder picker dropdown + confirm)
- [ ] Confirm bulk delete with count in dialog

## Upload Page Unification & 404 Fix (Apr 8)
- [ ] Fix 404 on Dashboard page
- [ ] Merge Upload Content and Media Library into one unified upload experience
- [ ] Upload Content page shows tabs: SCORM/HTML Packages + Media Files (images, video, audio, PDF, Word, ZIP)
- [ ] Remove the separate Media Library tab from MediaLibraryPage (consolidate into Upload Content)

## Unified Content Library (Apr 8)
- [ ] Fix Vite parse error in MediaFilesPage (duplicate useRef or syntax issue)
- [ ] Build unified ContentLibraryPage: single browser for SCORM packages + all media files
- [ ] Single Upload button that auto-detects SCORM vs media
- [ ] File type filter tabs: All, SCORM/HTML, Images, Video, Audio, Documents, Archives
- [ ] Folder sidebar with create/rename/delete folder support
- [ ] Checkbox selection mode with bulk delete and bulk move to folder
- [ ] Remove separate My Files, Upload Content, and Media Library tabs from MediaLibraryPage
- [ ] New tab order: Content Library, Teachific Studio, Quizzes, Flashcards
- [x] Rename sidebar Products > "Teachific Studio™" to "Teachific Studio™ - Lite" to distinguish from desktop app
- [x] Fix Upload Content button — dialog not opening (modal not rendering) [VERIFIED WORKING]
- [x] Fix "Free Member" plan badge — site_owner should show Enterprise Plan [VERIFIED WORKING]
- [x] Add desktop app download prompts/CTAs inside Teachific Studio™ - Lite tab
- [x] Studio Lite Record Video: add camera device selector, microphone selector, video quality selector (720p/1080p/4K), frame rate selector
- [x] Studio Lite Record Video: add speaker/output device selector for monitoring
- [x] Studio Lite Audio: add microphone device selector, speaker/output device selector, sample rate and quality settings

## Bug Fixes: Session Continuation (Apr 2026)
- [x] Fix /studio-pro 404 — Download App button now uses window.location.href for full page navigation instead of SPA setLocation
- [x] Confirm orgId bug in RecordEditPage.tsx already fixed (uses trpc.orgs.myOrgs, not hardcoded fallback)
- [x] Confirm StudioDashboard.tsx TypeScript errors already fixed (studioAccess vs "team" was resolved)
- [x] Fix Stripe webhook handler: was reading studio_tier (wrong key) instead of access_tier from session metadata
- [x] Extend Stripe webhook to handle creator and quiz_creator product types (previously only handled studio)
- [x] TypeScript: 0 errors confirmed after all fixes

## Bug Fix: Upload Fails for Non-HTML/SCORM Files
- [ ] Diagnose upload error for PDF, video, audio, image, Word doc uploads in Media Library
- [ ] Fix server-side file type validation / multer filter to allow all media types
- [ ] Fix client-side upload handler to correctly route non-ZIP files
- [ ] Test PDF, MP4, MP3, image, and Word doc uploads end-to-end

## Unified Media Library (Apr 2026)
- [x] Remove SCORM/HTML Packages vs Media Files tab split from FilesPage
- [x] Show all content (packages + media files) in one unified list/grid
- [x] Single "Upload Content" button that auto-routes by file type (ZIP/HTML → SCORM uploader, else → media uploader)
- [x] Single type filter bar: All, SCORM, HTML, Image, Video, Audio, Document, ZIP
- [x] One folder tree (content_folders) for organizing all items
- [x] Remove duplicate folder sidebar from MediaFilesPage when embedded
- [x] Media items show file type icon/badge; packages show SCORM/HTML badge
- [x] Unified search across both packages and media items

## Replace File Feature (Apr 2026)
- [ ] Add "Replace File" option to media item context menu in unified Media Library
- [ ] Server: replaceMediaItem procedure — upload new file to S3 at same key, update DB record (url, fileSize, mimeType), keep same ID so all links remain intact
- [ ] Client: hidden file input per row, progress indicator during replace, success toast

## TeachificPay Full Charge Management (Apr 2026)
- [x] Fix fee: Free=2%, Starter=1%, Builder=0.5%, Pro/Enterprise=0% (own gateway allowed)
- [x] Add disputes table to DB schema (disputeId, chargeId, orgId, userId, amount, currency, reason, status, dueBy, evidenceSubmitted, resolvedAt)
- [x] Add charge_transactions table (chargeId, orgId, userId, amount, currency, status, courseId, createdAt)
- [x] Webhook: charge.dispute.created — log dispute, suspend learner access, notify school owner
- [x] Webhook: charge.dispute.updated — update dispute status in DB
- [x] Webhook: charge.dispute.closed — restore/confirm access based on outcome (won/lost)
- [x] Webhook: charge.refunded — log refund, revoke access if full refund
- [x] tRPC: listDisputes — list open/closed disputes for an org
- [x] tRPC: submitDisputeEvidence — submit evidence to Stripe for a dispute
- [x] tRPC: listCharges — paginated charge history for an org
- [x] tRPC: issueRefund — refund a charge (already exists in admin, expose to org owner too)
- [x] tRPC: getPayoutStatus — explain how payouts work (automatic via Stripe Connect)
- [x] UI: TeachificPay page — Disputes tab (open disputes, evidence submission, deadline countdown)
- [x] UI: TeachificPay page — Charge History tab (all transactions, filter by status)
- [x] UI: TeachificPay page — Payouts tab (balance, payout schedule, payout history)
- [x] UI: TeachificPay page — Refunds tab (issue refund from charge history)
- [ ] Admin panel: dispute overview across all schools

## Media Library File Management Fixes (Apr 2026)
- [ ] Media files: add drag-to-folder support (DnD onto sidebar folder nodes)
- [x] Media files: add "Move to Folder" option in context menu (same as packages have)
- [ ] Media files: add sort controls (Newest First, Title A-Z, Largest, Oldest)
- [x] Media files: add moveMediaItem tRPC procedure (update folderId on orgMediaLibrary row) — uses bulkMoveToFolder
- [ ] Media files: folder item counts should include both packages and media items

## Marketing Pages: Fee/Gateway Update (Apr 2026)
- [x] LandingPage.tsx: update pricing cards to show correct fees (Free 2%, Starter 1%, Builder 0.5%, Pro/Enterprise 0%)
- [x] LandingPage.tsx: update gateway feature copy (only Pro/Enterprise can use own gateway)
- [x] OrgSettingsPage.tsx: update TeachificPay section fee display and gateway toggle visibility
- [x] teachificPayRouter.ts: remove group registration TeachificPay override (follow org gateway setting)

## Admin Dispute Overview — Platform Admin Panel (Apr 2026)
- [ ] tRPC: adminListAllDisputes — paginated list of all disputes across all orgs, with filters (status, org, date range)
- [ ] tRPC: adminGetDisputeDetail — full dispute detail including charge info, learner, course, evidence submitted
- [ ] tRPC: adminUpdateDisputeNote — add internal admin note to a dispute
- [ ] tRPC: adminEscalateDispute — flag a dispute for escalation (email owner, mark as escalated)
- [ ] UI: Disputes tab in PlatformAdminPage
- [ ] UI: Summary stats bar (total open, total won, total lost, total amount at risk)
- [ ] UI: Filterable dispute table (filter by status: warning_needs_response/needs_response/under_review/won/lost/all; filter by org; date range)
- [ ] UI: Dispute detail drawer/modal (charge info, learner details, course, evidence status, deadline countdown, admin notes)
- [ ] UI: Escalate button — marks dispute as escalated and sends notification to school owner
- [ ] UI: Add Note button — internal admin notes per dispute
- [ ] UI: Link to Stripe dispute dashboard for each dispute

## Admin Dispute Overview — Completed (Apr 8, 2026)
- [x] Add adminDisputeStats procedure (open/won/lost counts + amounts)
- [x] Add adminListAllDisputes procedure (paginated, filterable by status/search, joins org name + learner email)
- [x] Add adminAddDisputeNote procedure (internal admin notes on disputes)
- [x] Add adminEscalateDispute procedure (flag dispute for priority attention)
- [x] Add adminSubmitDisputeEvidence procedure (submit evidence to Stripe API)
- [x] Add adminListAllCharges procedure (paginated, filterable, joins org + learner)
- [x] Add adminNotes and escalated columns to teachific_pay_disputes table (migrated)
- [x] TeachificPay admin tab now has 3 sub-tabs: Schools & Revenue, Disputes, Charge History
- [x] Disputes panel: stats header (open/won/lost/total), searchable/filterable table, deadline countdown, escalate button, evidence submission form, inline admin notes
- [x] Charge History panel: searchable/filterable table, refund action per charge

## Dispute Email Notifications (Apr 8, 2026)
- [x] Send email to platform owner on charge.dispute.created webhook
- [x] Email includes: school name, learner email, dispute amount, reason, evidence deadline
- [x] Use SendGrid helper (already configured) for email delivery
- [x] Fallback to notifyOwner() in-app notification if email fails
- [x] TypeScript check and checkpoint

## Third-Party Cookie Fix & Firewall Bypass (Apr 10, 2026)
- [ ] Diagnose why embedded HTML iframes require third-party cookies
- [ ] Fix: serve HTML/SCORM content from same origin (proxy endpoint or subdomain)
- [ ] Research why hospital firewalls block teachific.app
- [ ] Implement firewall-friendly content delivery strategy

## Cookie-Free Embed Token System (Apr 10, 2026)
- [x] Create server/embedToken.ts: issue and verify short-lived signed JWT (24h TTL)
- [x] Add tRPC publicProcedure: getEmbedToken — issues token from session or anonymous learner params
- [x] Add token-based session procedures: startSessionWithToken, updateSessionWithToken, endSessionWithToken
- [x] Update EmbedPage to request embed token and pass as ?t= param to iframe src
- [x] Update PlayerPage to use embed token for session tracking (PlayerPage is internal-only, no change needed)
- [x] Ensure /api/content/* proxy routes accept token auth (no cookie required — routes are already public)
- [x] TypeScript check and checkpoint

## Security Hardening for Hospital Firewall Acceptability (Apr 10, 2026)
- [x] Audit current security headers (HSTS, CSP, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy)
- [x] Add HSTS header (max-age=31536000; includeSubDomains; preload)
- [x] Add Content-Security-Policy header (strict, with frame-ancestors for embed support)
- [x] Add X-Content-Type-Options: nosniff
- [x] Add Referrer-Policy: strict-origin-when-cross-origin
- [x] Add Permissions-Policy (disable camera/mic/geolocation by default)
- [x] Add X-DNS-Prefetch-Control: off
- [x] Add security.txt at /.well-known/security.txt
- [x] Add robots.txt with proper crawl rules
- [ ] Add /privacy and /terms pages (required for enterprise trust)
- [x] Implement cookie-free embed token (JWT, 24h TTL) for iframe embeds
- [ ] Submit domain to Cisco Umbrella, Palo Alto, Zscaler, Fortinet, Webroot for Education categorization

## Cookie-Free Embed — Frontend Wiring (Apr 10, 2026)
- [x] EmbedPage: call trpc.embed.getToken on load, pass token to iframe URL as ?t=<token>
- [x] EmbedPage: use trpc.embed.startSession / endSession instead of cookie-based sessions.*
- [x] PlayerPage: cookie-based sessions kept (internal-only page, same-domain, no iframe embedding)
- [x] /api/content/* proxy: already public, no auth needed (access control at session start)
- [x] SCORM xAPI/cmi routes: scorm.setData/getData already publicProcedure, no cookie needed
- [x] TypeScript check and checkpoint (0 errors)

## Replace File Feature — Media Library (Apr 10, 2026)
- [x] Audit media file storage: confirmed S3 key is stored in fileKey column; overwriting it keeps URL unchanged
- [x] Add POST /api/media-upload/replace Express route: authenticate, look up item by mediaItemId, overwrite same S3 key, update DB metadata
- [x] Add Replace File UI: "Replace File" option in ⋯ menu on each media item (MediaRow in FilesPage.tsx)
- [x] File picker dialog: shows current vs new file info, XHR upload with progress bar, cancel/confirm buttons
- [x] On success: toast confirms URL unchanged, invalidates media cache, refetches list
- [x] Write vitest tests for replace route logic (7 tests passing in server/mediaReplace.test.ts)
- [x] TypeScript check (0 errors) and checkpoint saved

## Bug Fix: /lms blank page + auth redirect loop (Apr 13, 2026)
- [x] Diagnose blank page at teachific.app/lms after login — root cause: two parallel auth systems (app_session_id vs teachific_session); ctx.user was always null for custom-login users
- [x] Fix auth guard: updated context.ts to fall back to teachific_session when app_session_id is absent
- [x] OAuth callback not involved — issue was custom email/password session not populating ctx.user
- [x] TypeScript check (0 errors), 69 tests passing, checkpoint saved

## Bug Fix: /lms blank page (Round 2 — Apr 13, 2026)
- [ ] Add debug logging to context.ts to confirm which cookie path is being hit
- [ ] Check if teachific_session cookie is actually being sent to the server on teachific.app
- [ ] Verify the deployed server has the updated context.ts (not serving stale build)
- [ ] Check if the issue is SameSite=Lax blocking the cookie on navigation from external referrer
- [ ] Investigate whether the issue is the DashboardLayout orgCtx loading state causing infinite skeleton
- [ ] Fix and checkpoint

## Bug Fix: Blank white page on teachific.app/lms + preview (Apr 13, 2026)
- [x] Check browser console for JS errors / uncaught exceptions on page load
- [x] Check if the Vite build is failing or producing broken chunks — no build errors
- [x] Check for import errors — fixed authCache.ts import, returnPath/returnTo mismatch
- [x] Fix root cause: LoginPage now seeds auth.me cache after customAuth.login success; preview loads correctly
- [x] TypeScript check (0 errors), 69 tests passing

## Bug Fix: App links returning 404 (Apr 13, 2026)
- [x] Fix QuizCreator™, Teachific Studio™, TeachificCreator™ sidebar links to open external URLs in new tab instead of navigating internally

## App Links Audit (Apr 13, 2026)
- [x] Audit all links for QuizCreator™, Teachific Studio™, TeachificCreator™ across codebase
- [x] ProductSwitcher: fixed to use /quiz-creator-app, /studio, /creator (internal routes, no new tab)
- [x] QuizCreatorLandingPage: fixed "Dashboard" links from /quiz-creator to /quiz-creator-app
- [x] All other links confirmed correct: -pro pages for marketing, /creator /studio /quiz-creator-app for dashboards
- [x] TypeScript check (0 errors) and checkpoint

## Bug Fix: /help returning 404 (Apr 13, 2026)
- [ ] Diagnose why /help returns 404 — check route registration in App.tsx
- [ ] Do full broken-route audit across the app
- [ ] Fix all broken routes
- [ ] TypeScript check and checkpoint

## Bug Fix: Desktop app downloads require GitHub login (Apr 13, 2026)
- [ ] Find all download URLs in DesktopDownloadPage and related components
- [ ] Replace private GitHub release URLs with public download URLs
- [ ] TypeScript check and checkpoint

## Electron Desktop Apps (Apr 13, 2026)
- [ ] Scaffold TeachificCreator™ Electron app (wraps /creator route)
- [ ] Scaffold Teachific Studio™ Electron app (wraps /studio route)
- [ ] Scaffold Teachific QuizCreator™ Electron app (wraps /quiz-creator-app route)
- [ ] Configure electron-builder for Windows NSIS (.exe) and macOS DMG (.dmg)
- [ ] Set up GitHub Actions CI for cross-platform builds (Windows + macOS)
- [ ] Upload built installers to S3
- [ ] Wire up signed S3 download endpoint (pre-signed URL, 60s expiry)
- [ ] Update app_versions table with real S3 download URLs
- [ ] TypeScript check and checkpoint

## Bug Fix: Password reset email not sending (Apr 13, 2026)
- [ ] Check forgotPassword procedure in customAuthRouter.ts
- [ ] Verify SendGrid API key is configured and working
- [ ] Check email template and from address
- [ ] Test password reset flow end-to-end
- [ ] Fix and checkpoint

## Bug Fix Batch (Apr 13, 2026)
- [ ] Fix forgotPassword: remove passwordHash guard so all accounts (OAuth + email) can reset/set password
- [ ] Fix authCache import error (stale Vite log from before file was created — verify it's actually resolved)
- [ ] Fix /help 404 — add to isBare list in App.tsx
- [ ] Fix app links 404 — ProductSwitcher using correct internal routes
- [ ] Manually set passwordHash for admin@allaboutultrasound.com via reset flow
- [ ] Fix feature gate: AI Course Generation upgrade prompt shown even when org has Enterprise plan — check org.plan not user Stripe subscription

## Bug Fix: Platform Admin Data Integrity (Apr 13, 2026)
- [ ] Fix createOrg in Platform Admin: automatically add owner as org_admin in org_members table
- [ ] Fix createMember in Platform Admin: link new user to their org with correct role in org_members table
- [ ] Fix feature gate: check org.plan tier (not Stripe subscription) for plan-gated features
- [ ] Fix forgotPassword: remove passwordHash guard so all accounts can reset/set password
- [ ] Fix authCache import error in LoginPage.tsx
- [ ] Fix admin@allaboutultrasound.com: add as org_admin of All About Ultrasound org in DB
- [ ] Fix dashboard loading skeleton: ensure org context loads for all admin accounts

## Landing Page & Subdomain DNS Features
- [x] Add landing page content fields to DB schema and migrate
- [x] Add getLandingPage (public) and saveLandingPage (admin) procedures
- [x] Auto-seed landing page on first subdomain assignment only (not on subdomain edits)
- [x] Seed landing pages for existing orgs (allaboutultrasound, the-recovery-studio)
- [x] Build public OrgLandingPage (hero, about, course grid, CTA, footer)
- [x] Build admin landing page editor (OrgLandingPageTab) in OrgSettingsPage
- [x] Wire subdomain root routing to show OrgLandingPage if published, fall back to SchoolPage
- [x] Wildcard DNS *.teachific.app already in place via GoDaddy; Cloudflare SSL pending activation

## White-label Student Auth Pages
- [x] Create useOrgAuthBranding hook (fetches org branding from subdomain)
- [x] White-label LoginPage with org logo, colors, and name on subdomain
- [x] White-label RegisterPage with org branding on subdomain
- [x] White-label ForgotPasswordPage with org branding on subdomain
- [x] White-label ResetPasswordPage with org branding on subdomain
- [x] White-label VerifyEmailPage with org branding on subdomain

## User Management (Fixed)
- [x] Add lms.members.listWithEnrollments procedure (org admin: members + course progress)
- [x] Add lms.members.createAndAdd procedure (create email/password user and add to org)
- [x] Add lms.members.manualEnroll procedure (enroll existing member in a course)
- [x] Add lms.members.bulkImport procedure (CSV bulk member import)
- [x] Platform admin AdminUsersPage: users.listWithOrg, users.create, users.update, users.delete, users.assignToOrg, users.enrollInCourse, users.revokeEnrollment all confirmed present

## WYSIWYG Page Builder (Weebly-style)
- [x] Replace old block-panel editor with new WysiwygPageBuilder component
- [x] Left sidebar with draggable element tiles (18 block types)
- [x] Canvas: full-width live preview, click to select, drag to reorder sections
- [x] Right properties panel: context-sensitive editing for selected block
- [x] Inline text editing directly on canvas (contentEditable)
- [x] Color pickers, image upload, alignment controls in properties panel
- [x] Block visibility toggle (show/hide without deleting)
- [x] Duplicate and delete block actions
- [x] Wire new editor into PageBuilderPage (course sales pages)
- [x] Wire new editor into CustomPagesPage (custom org pages)
- [x] Wire new editor into DigitalProductEditorPage
- [x] Wire new editor into WebinarEditorPage
- [x] Write vitest tests for block serialization and drag-drop ordering
- [x] All 81 tests passing

## Platform Admin — User Management
- [x] AdminUsersPage: list all users across all orgs with role badges
- [x] Filter users by organization
- [x] Create new users with role assignment (site_admin, org_super_admin, org_admin, member)
- [x] Edit user name, email, and platform role
- [x] Assign users to organizations with org-level role
- [x] Enroll users in courses directly from admin panel
- [x] Revoke course enrollments
- [x] Delete users (owner-only)
- [x] Backend procedures support all role types: site_owner, site_admin, org_super_admin, org_admin, member

## WYSIWYG Editor — OrgSettings Landing Page
- [x] Replace OrgLandingPageTab form fields with WysiwygPageBuilder canvas editor
- [x] Persist landing page blocks as blocksJson on the landing page record
- [x] Keep existing landing page data (heroHeadline, colors etc.) as default blocks on first open
- [x] Wire save/publish buttons to update landing page via existing tRPC procedure

## Per-Org Member Management in OrgSettings
- [x] Add Members tab to OrgSettingsPage for org admins
- [x] List all org members with role badges (org_super_admin, org_admin, member)
- [x] Invite/add member by email with role selection
- [x] Edit member role (promote/demote within org)
- [x] Remove member from org
- [x] Backend: ensure org admin can call member management procedures (not just platform admin)

## Auto-Generated Landing Page Teal Branding
- [x] All auto-created org landing pages use Teachific teal (#0ea5e9 / #0284c7) as primary color
- [x] Hero background defaults to dark teal (#0f2942 or teal gradient)
- [x] CTA button defaults to teal (#0ea5e9)
- [x] Accent color defaults to teal (#0ea5e9)
- [x] Apply to: org creation auto-seed, WYSIWYG default blocks, and any fallback landing page generation

## My Certificates Feature
- [ ] Add lms.certificates.download tRPC procedure (generates/caches branded PDF to S3)
- [ ] White-label logic: pro/enterprise use org logo+colors; free/starter show Teachific branding
- [ ] Student My Certificates page (/dashboard/certificates)
- [ ] Certificate Settings tab in OrgSettings (logo, colors, signature line, custom text)
- [ ] Wire PDF generation into auto-issue on course completion
- [ ] Vitest tests for certificate branding logic

## My Certificates Feature
- [ ] Add lms.certificates.download tRPC procedure (generates/caches branded PDF to S3)
- [ ] White-label logic: pro/enterprise use org logo+colors; free/starter show Teachific branding
- [ ] Student My Certificates page (/dashboard/certificates)
- [ ] Certificate Settings tab in OrgSettings (logo, colors, signature line, custom text)
- [ ] Wire PDF generation into auto-issue on course completion
- [ ] Vitest tests for certificate branding logic

## Bulk User Actions (Platform Admin)
- [ ] Add row checkboxes to AdminUsersPage user table
- [ ] Add bulk action toolbar (bulk role-change, bulk org-assign, bulk enroll, bulk delete)
- [ ] Add bulkUpdateUsers backend procedure (role, orgId)
- [ ] Add bulkEnrollUsers backend procedure

## Private Org Notes (Platform Admin)
- [ ] Add adminNotes column to organizations table (if not exists)
- [ ] Add getOrgNotes / updateOrgNotes backend procedures
- [ ] Surface private notes field in AdminOrgsPage and platform admin org detail view

## Website Tab in OrgSettings (Domain Setup)
- [ ] Move subdomain slug field into new Website tab in OrgSettings
- [ ] Move custom domain field into Website tab
- [ ] Add step-by-step DNS instructions for pointing custom domain to teachific subdomain
- [ ] Show current subdomain URL and copy button in Website tab
- [ ] Add domain verification status indicator

## Session: Bulk User Actions, Org Notes, Website/Domain Tab
- [x] Fix TypeScript error in AdminUsersPage: bulkEnroll call now includes required orgId field
- [x] Private org notes: adminNotes column in organizations table (migration applied), orgs.update procedure accepts adminNotes, AdminOrgsPage edit dialog shows Private Admin Notes textarea
- [x] Website/Domain tab in OrgSettings: renamed "Domain" tab to "Website", added subdomain display card with copy/visit buttons, added step-by-step DNS instructions for custom domain setup (CNAME record table, 3-step guide), custom domain input with save/remove

## Domain Verification Status
- [x] Add domainVerifiedAt (timestamp) and domainVerificationStatus (enum: unverified/pending/verified/failed) columns to organizations table
- [x] Generate and apply migration SQL
- [x] Add orgs.verifyDomain tRPC procedure (orgAdminProcedure): performs server-side DNS CNAME lookup via dns.promises.resolveCname, updates verification status and timestamp
- [x] Add orgs.getDomainStatus tRPC procedure: returns current customDomain, verificationStatus, verifiedAt
- [x] Website tab: show verification badge (Verified/Pending/Failed/Unverified) next to configured domain
- [x] Website tab: "Verify DNS" button that calls verifyDomain and refreshes badge
- [x] Show last verified timestamp when status is verified
- [x] Show helpful error message when DNS check fails (CNAME not found or points to wrong target)

## Domain Verification Enhancements
- [x] Auto-verify on domain save: when a new customDomain is saved via updateSettings, immediately trigger a background DNS check and update domainVerificationStatus
- [x] SSL/HTTPS status check: add sslStatus field to getDomainStatus response (performs HTTPS HEAD request to custom domain, returns 'active'|'pending'|'error'), show SSL badge in Website tab
- [x] AdminOrgsPage: add domain verification status badge column to the orgs table (shows customDomain + badge: Verified/Failed/Not Verified/None)

## Website Tab: Favicon & Logo Upload
- [x] Add orgs.uploadFavicon and orgs.uploadSiteLogo tRPC procedures (S3 upload, save URL to orgThemes)
- [x] Website tab: favicon upload card (preview, upload button, remove button, format/size hint)
- [x] Website tab: site logo upload card (preview, upload button, remove button)
- [x] Create useOrgBranding hook: injects <link rel="icon"> and document.title into <head>
- [x] Call useOrgBranding in SchoolPage and OrgLandingPage (subdomain/custom domain learner portal)

## Website Tab: Org SEO Settings
- [ ] Add seoTitle, seoDescription, seoKeywords, seoOgImage, seoRobotsIndex columns to organizations table
- [ ] Generate and apply migration SQL
- [ ] Add orgs.updateSeo tRPC procedure (orgAdminProcedure): save SEO fields
- [ ] Add seoOgImageUpload tRPC procedure: upload OG image to S3, return URL
- [ ] Website tab: SEO card with fields: Site Title (meta title), Meta Description, Keywords, OG Image upload, Robots (index/noindex toggle)
- [ ] Website tab: character count hints on title (max 60) and description (max 160)
- [ ] useOrgBranding hook: inject seoTitle as document.title, meta description, meta keywords, og:title, og:description, og:image, robots meta tag into <head> on subdomain pages
- [ ] themeBySlug procedure: include SEO fields in response

## Website Tab: Custom CSS Injection
- [ ] Add customCss column (longtext) to organizations table
- [ ] Include customCss in migration SQL
- [ ] Add orgs.updateCustomCss tRPC procedure (orgAdminProcedure): save custom CSS
- [ ] Website tab: Custom CSS card with CodeMirror/textarea editor, warning banner about no support
- [ ] useOrgBranding hook: inject customCss as <style> tag into <head> on subdomain pages
- [ ] themeBySlug procedure: include customCss in response

## Support Page & Ticket System
- [ ] Add support_tickets table (id, name, email, subject, category, message, status, userId, createdAt)
- [ ] Generate and apply migration SQL
- [ ] Add support.submitTicket tRPC procedure (publicProcedure): save ticket to DB, send email to support@teachific.net via SendGrid, notify owner
- [ ] Add support.listTickets tRPC procedure (adminProcedure): list all tickets with pagination and status filter
- [ ] Build /support page: FAQ accordion + ticket submission form with name, email, subject, category, message fields
- [ ] Add Support link to main navigation (LandingPage header + DashboardLayout sidebar)
- [ ] Add Tickets tab in PlatformAdminPage to view and manage submitted tickets

## Bundle Size Optimization & Publish Pipeline Fix (Apr 18, 2026)
- [x] Convert all 112 static page imports in App.tsx to React.lazy() dynamic imports
- [x] Add Suspense fallback (PageLoader spinner) wrapping BareRouter, AdminRouter, SubdomainSchoolRouter
- [x] Remove app-admin/app-lms/app-org manualChunks groupings from vite.config.ts (counterproductive with lazy loading)
- [x] Add vendor-tiptap, vendor-codemirror, vendor-dnd, vendor-aws chunks to split vendor-misc
- [x] index chunk reduced from 2.12MB → 190KB (gzip: 272KB → 30KB)
- [x] No large-chunk warnings in production build
- [x] 81/81 tests passing, 0 TypeScript errors

## Railway Deployment Preparation
- [x] Add railway.toml and Dockerfile for Railway deployment
- [x] Add /api/health endpoint for Railway health checks
- [x] Replace Manus S3 storage with dual-backend (AWS S3 + Manus fallback)
- [x] Replace Manus LLM with dual-backend (OpenAI + Manus fallback)
- [x] Install @aws-sdk/client-s3, @aws-sdk/s3-request-presigner, openai packages
- [x] Write DEPLOYMENT.md with full Railway setup guide

## Teachific Teal Default Theme for Learner Pages
- [ ] Apply Teachific teal (#0d9488 / teal-600) as default primary color to SchoolPage (auto-generated landing)
- [ ] Apply teal theme to CourseSalesPage header and CTAs
- [ ] Apply teal theme to CoursePlayerPage header and progress elements
- [ ] Apply teal theme to SchoolMyCoursesPage
- [ ] Apply teal theme to OrgPoliciesPage header
- [ ] Apply teal theme to CommunityLearnerPage
- [ ] Apply teal theme to FormPlayerPage (when no org branding override)
- [ ] Apply teal theme to SchoolMemberLayout header/nav
- [ ] Apply teal theme to StudentLayout
- [ ] Ensure org branding primaryColor overrides the teal default where set
- [x] Add studentTheme field (light | dark) to org_themes table (default: light)
- [x] Add Dark/Light theme toggle to BrandingPage under the color settings section
- [x] Wire studentTheme from org theme data into SubdomainSchoolRouter so learner pages use the org's chosen theme
- [x] Ensure teal primary color is applied correctly in both light and dark theme variations

## Per-Course Access Duration
- [x] Add accessDurationType (lifetime/days/date), accessDurationDays, accessExpiryDate fields to courses table
- [x] Generate and apply Drizzle migration for access duration fields
- [x] Add access duration fields to courses.update procedure input schema in lmsRouter.ts
- [x] Add Access Duration section UI to CourseSettingsTab in CourseBuilderPage
- [x] Pass course prop to RenderBlock in CourseSalesPage for access duration display

## Funnel Builder (ClickFunnels-style)
- [x] Add funnels and funnel_steps tables to schema.ts
- [x] Generate and apply Drizzle migration for funnels tables
- [x] Create funnelDb.ts with CRUD helpers (create/get/update/delete funnel + steps, reorder)
- [x] Add funnels router to lmsRouter.ts (list, get, create, update, delete, createStep, updateStep, deleteStep, reorderSteps)
- [x] Replace FunnelsPage mock data with real tRPC data (list, create, delete)
- [x] Create FunnelBuilderPage with full-screen visual step-flow editor (DnD sortable steps)
- [x] Add FunnelBuilderPage route to App.tsx (/marketing/funnels/:id)
- [x] Write unit tests for funnels schema, router input validation, and access duration logic

## Funnel Builder (ClickFunnels-style)
- [x] Add funnels and funnel_steps tables to schema.ts
- [x] Create funnelDb.ts with CRUD helpers
- [x] Add funnels router to lmsRouter.ts
- [x] Replace FunnelsPage mock data with real tRPC data
- [x] Create FunnelBuilderPage with visual step-flow editor
- [x] Write unit tests for funnels and access duration
## Per-Course Access Duration
- [x] Add accessDurationType/accessDurationDays/accessExpiryDate to courses table
- [x] Add access duration UI to CourseSettingsTab

## Lesson Banner Confetti & Sound Improvements
- [x] Install canvas-confetti library
- [x] Add startBannerConfetti, startBannerConfettiStyle, startBannerCustomSoundUrl fields to schema
- [x] Add completeBannerConfetti, completeBannerConfettiStyle, completeBannerCustomSoundUrl fields to schema
- [x] Apply migration to database
- [x] Update lmsRouter lesson update procedure with new banner fields
- [x] Expand bannerSounds.ts with more presets (applause, fanfare, chime, bell, etc.) and custom entry
- [x] Rewrite LessonBannerEditor with confetti cannon toggle, confetti style picker, custom MP3 URL, and "Show Effect" preview button
- [x] Update LessonEditorSheet to pass confetti/customSoundUrl fields to LessonBannerEditor
- [x] Update CoursePlayerPage to fire confetti cannon and play custom sound when banners trigger

## Certificate of Completion Email
- [x] certificateEnabled flag on courses table (already existed)
- [x] certificateCompletionHtml email template added
- [x] Certificate email sent via SendGrid when learner reaches 100% progress
- [x] Email includes verification code, course URL CTA, and org branding

## Lesson Notes and Bookmarks
- [x] lesson_notes table: userId, courseId, lessonId, enrollmentId, content, createdAt
- [x] lesson_bookmarks table: userId, courseId, lessonId, enrollmentId, label, createdAt
- [x] tRPC procedures: notes.byLesson, notes.byCourse, notes.create, notes.update, notes.delete
- [x] tRPC procedures: bookmarks.byCourse, bookmarks.toggle, bookmarks.delete
- [x] My Notes sidebar tab in CoursePlayerPage with Current Lesson / All Notes / Bookmarks tabs
- [x] Bookmark toggle button in player top bar

## Course Drip Scheduling
- [x] dripDays, dripType, dripDate fields already in courseLessons schema
- [x] curriculum.get procedure computes isDripLocked and unlocksAt per lesson based on enrollment date
- [x] Sidebar shows "Unlocks in X days" / "Unlocks tomorrow" / "Unlocks [date]" for locked lessons
- [x] Drip-locked lessons block navigation in sidebar
- [x] dripUnlockHtml email template added
- [x] drip.sendUnlockNotifications tRPC procedure (admin-only, for daily scheduled task)
- [x] Drip scheduling UI already in LessonEditorSheet settings tab

## Chunked Upload Fixes (Apr 28)
- [x] Add /api/chunked/package/* routes for new SCORM package uploads (initiate/chunk/finalize)
- [x] Convert UploadPage.tsx from single-POST to chunked upload (fixes Railway proxy timeout)
- [x] Convert LessonEditorSheet media upload to chunked (fixes large video timeout)
- [x] Create shared chunkedMediaUpload utility (client/src/lib/chunkedMediaUpload.ts)
- [x] Convert FilesPage.tsx media upload to chunked
- [x] Convert MediaFilesPage.tsx media upload to chunked

## Desktop Apps: Real Electron Builds
- [x] Build Teachific Studio Electron app (screen recording, media capture)
- [x] Build Teachific Creator Electron app (SCORM course authoring)
- [x] Build Teachific Quiz Creator Electron app (interactive quiz builder)
- [x] Package all three as Windows NSIS installers (.exe)
- [x] Upload all three as .zip archives to S3/CDN
- [x] Update app_versions DB table with real S3 download URLs
- [x] Update DesktopDownloadPage to reflect .zip format and remove broken GitHub links
- [x] Disable macOS button when no macOS URL available (shows "Coming soon")

## Desktop Apps: Auto-Update, macOS Builds & Code Signing
- [ ] Add electron-updater to all three Electron apps
- [ ] Wire auto-update check on app startup (check for new version from app_versions API)
- [ ] Show update notification UI in each app (banner + download button)
- [ ] Attempt macOS cross-compilation (.dmg) or document CI approach
- [ ] Upload macOS builds to S3 and update app_versions macUrl
- [ ] Add code signing config to electron-builder for Windows
- [ ] Document EV certificate workflow for production signing
- [ ] Update DesktopDownloadPage to show macOS download button when URL is available
- [ ] Run all tests and save checkpoint

## Bug Fix: Platform Admin App Versions shows empty URLs
- [x] Find the App Versions admin page component
- [x] Fix it to display the existing S3 URLs from the database (not show empty input fields)
- [x] Created appVersionsSeed.ts — idempotent startup seed that upserts all 3 app versions with real S3 URLs on every server start
- [x] Wired ensureAppVersions() into server/_core/index.ts startup (runs 3s after server starts, non-blocking)

## Desktop Apps: Full Rebuild (per original PRD)

### Architecture (corrected)
- TeachificCreator™ ($117/mo) = ALL-IN-ONE: course authoring + QuizMaker + Studio + PowerPoint add-in + Content Library + AI + Role-Play + Interactions
- Teachific QuizCreator™ ($47/mo) = Standalone iSpring QuizMaker equivalent
- Teachific Studio™ ($47/mo) = Screen recording + transcription editing + AI highlights + MP4 export

### Phase 1: Shared File Formats & Scaffolding
- [x] Define .quiz JSON schema (metadata, groups, questions, answers, feedback, scoring, player settings, animations)
- [x] Define .course JSON schema (modules, lessons, pages, media)
- [x] Scaffold all 3 Electron apps with React + Tailwind + Vite
- [x] Shared login/activation component (email/password via Teachific API)

### Phase 2: Teachific QuizCreator™
- [ ] Ribbon toolbar: Home, Insert, Design, Animation, Help tabs
- [ ] Left panel: question list with groups, shuffle toggle, question count badges
- [ ] Form View: structured question editor (question text, answers, correct answer, feedback)
- [ ] Slide View: visual slide editor with branded background, embedded media
- [ ] Question types: MC, T/F, Multiple Response, Fill-in-the-blank, Matching, Sequence, Hotspot, Image-based
- [ ] Intro slide and User Info Form slides
- [ ] Quiz Properties dialog: General, Scoring, Question Properties, Question List, Reporting
- [ ] Player customization: Features, Navigation, Color Scheme, Text, Import/Export
- [ ] Animation tab: Answer animation (None, Appear, Fade, Float In) with timing
- [ ] Insert: Picture, Shape, Text Box, Equation, Symbol, Video, Audio, Characters, Backgrounds
- [ ] Design: Themes, Format Background, Color Scheme
- [ ] Publish: HTML5, SCORM 1.2, SCORM 2004, xAPI, Word export
- [ ] Export to Excel (.xlsx)
- [ ] Import questions from Excel/CSV
- [ ] Open/Save .quiz files natively
- [ ] Preview quiz in built-in browser window
- [ ] Login-based activation, 14-day trial, watermark on exports for trial users

### Phase 3: Teachific Studio™
- [ ] Screen recording: Screen only, Camera only, Screen + Camera
- [ ] Transcription generation from recordings
- [ ] Transcription-based editing (delete words to cut video)
- [ ] AI-generated 10 highlight clips from full video
- [ ] Video timeline editor
- [ ] Export as MP4
- [ ] Login-based activation, 14-day trial, watermark for trial users

### Phase 4: TeachificCreator™ (All-in-One)
- [ ] Slide-based course authoring (PowerPoint-like)
- [ ] Import .pptx files
- [ ] PowerPoint add-in (.ppam) for ribbon integration
- [ ] Built-in QuizMaker (full QuizCreator feature set)
- [ ] Built-in Studio (screen recording + video editing)
- [ ] Content Library: Characters, Backgrounds, Objects, Icons
- [ ] AI Image Generation
- [ ] Role-Play / Dialogue builder
- [ ] Interactions: Steps, Timeline, Process, Cyclic, Catalog
- [ ] Publish to SCORM 1.2, SCORM 2004, xAPI, HTML5, .pptx
- [ ] Login-based activation, 14-day trial, watermark for trial users

### Phase 5: Build & Deploy
- [x] Package all three as Windows NSIS installers (96 MB each)
- [x] Upload .zip files to S3 (CDN URLs updated in appVersionsSeed.ts)
- [x] Update appVersionsSeed.ts with new URLs
- [x] Run all tests (116 passed) and save checkpoint

## Desktop Apps: Engine Implementation (Missing from Previous Build)

### QuizCreator Engines
- [ ] Implement publishQuiz IPC handler in electron/main.ts
- [ ] HTML5 export engine: generate self-contained quiz player HTML with embedded JS/CSS
- [ ] SCORM 1.2 export engine: imsmanifest.xml + adl/scorm 1.2 API wrapper + quiz HTML + zip
- [ ] SCORM 2004 export engine: imsmanifest.xml (SCORM 2004 4th Ed) + API_1484_11 wrapper + zip
- [ ] xAPI export engine: quiz HTML with tincan.xml + xAPI statement generation
- [ ] Word export: generate .docx with question list using docx library
- [ ] Excel export: generate .xlsx in iSpring template format using xlsx library
- [ ] Excel import: parse iSpring template columns, map to quiz question types
- [ ] CSV import: parse question/answer rows into quiz format
- [ ] Preview: render quiz HTML in BrowserWindow popup
- [ ] Wire all IPC handlers to preload.ts contextBridge

### Studio Engines
- [ ] desktopCapturer: enumerate screens and windows for recording source selection
- [ ] Screen recording: MediaRecorder API with desktopCapturer stream
- [ ] Camera recording: getUserMedia camera overlay on screen capture
- [ ] Save recording as .webm then convert to .mp4 using ffmpeg
- [ ] Transcription: send audio to Teachific API /api/transcribe endpoint
- [ ] Transcript-based editing: map word timestamps to video segments, cut on delete
- [ ] AI highlights: send transcript to Teachific API /api/highlights endpoint
- [ ] Export: ffmpeg concat/trim pipeline for final MP4

### TeachificCreator Engines
- [ ] SCORM course export: generate imsmanifest.xml + HTML5 course player + zip
- [ ] pptx import: parse .pptx using pptx2json or officegen
- [ ] PowerPoint add-in: generate .ppam manifest + ribbon XML + VBA stub
- [ ] Publish IPC handler: wire all export formats
- [ ] All IPC handlers connected to preload.ts contextBridge

### Build & Deploy
- [ ] Rebuild all three Windows installers after engine implementation
- [ ] Upload new .zip files to S3
- [ ] Update appVersionsSeed.ts with new URLs
- [ ] Run all tests and save checkpoint

## Desktop App Rebuild v1.1.0 (RecordView + contextIsolation fix)
- [x] Rewrite RecordView.tsx: clean teal/white design, SVG icons (no emoji), proper layout (no black block), fixed screen capture flow with error handling
- [x] Fix TeachificCreator main.ts: contextIsolation set to false (required for getUserMedia with chromeMediaSource)
- [x] Fix TeachificCreator main.ts: backgroundColor changed from #1a1a2e to #ffffff
- [x] Rebuild all three apps: Vite frontend + esbuild electron bundle (clean dist-electron with only main.js and preload.js)
- [x] Package all three Windows NSIS installers (v1.1.0)
- [x] Upload new ZIPs to S3 CDN
- [x] Update appVersionsSeed.ts with new CDN URLs for all three apps
- [x] Restart server to apply seed

## Rename QuizCreator to QuizMaker
- [x] Update quiz-creator/package.json: productName, appId, description
- [x] Update quiz-creator/electron/main.ts: window title, About dialog text
- [x] Update appVersionsSeed.ts: product key remains "quizcreator" internally but display name changes; update windowsUrl filename
- [x] Update all web platform UI references: DesktopDownloadPage, any page that shows "QuizCreator"
- [x] Rebuild QuizMaker app (Vite + esbuild)
- [x] Package new installer (now named "Teachific QuizMaker Setup 1.1.0.exe")
- [x] Upload new ZIP to S3
- [x] Update appVersionsSeed.ts with new URL
- [x] Restart server and save checkpoint

## QuizMaker Desktop App - Full Overhaul (iSpring parity)
- [x] Fix blank dialog windows: dialog-box needs explicit height, overflow-y-auto on content area
- [x] Add missing selectFolder IPC handler to preload.ts and main.ts
- [x] Fix Publish flow: outputPath must default to user's Desktop, Browse button must work
- [x] Add Numeric, Short Answer, Essay, Rating Scale question types
- [x] Add per-question branching section in FormView (Correct → Next/Specific/End, Incorrect → same)
- [x] Add per-question scoring override in FormView
- [x] Fix SlideView: render actual question text and answer choices on the slide canvas
- [x] Fix SlideView: clicking thumbnail selects that question
- [x] Improve QuestionPanel: show question type icon and truncated question text
- [x] Update Ribbon title bar to say QuizMaker not QuizCreator
- [x] Add question count badge per group in QuestionPanel
- [x] Fix status bar text: QuizMaker not QuizCreator
- [x] Rebuild and re-package installer after all fixes

## QuizMaker Player Settings - Theme Import/Export Fix
- [ ] Fix Import button in PlayerSettingsDialog: should open a .theme JSON file and load color/font/layout settings into the dialog (not import quiz content)
- [ ] Fix Export button in PlayerSettingsDialog: should save current color/font/layout settings as a .theme JSON file to disk (not export quiz)
- [ ] Add save-theme and open-theme IPC handlers to preload.ts and main.ts
- [ ] Rebuild QuizMaker, package installer, upload to CDN, update seed

## QuizMaker Web Editor Build
- [x] Add userId column to quizzes table (migration)
- [x] Add ordering, fill_blank, numeric, rating_scale question types to quizQuestions enum (migration)
- [x] Create server/quizMakerRouter.ts with full CRUD procedures
- [x] Wire quizMakerRouter into appRouter as quizMaker namespace
- [x] Rewrite QuizCreatorPage.tsx as full 3-panel editor (question list | form editor | settings)
- [x] Support all question types: MC, T/F, multiple select, matching, ordering, fill-in-blank, short answer, essay, numeric, rating scale
- [x] Quiz settings panel: title, description, passing score, time limit, shuffle, feedback mode
- [x] Cloud save/load: Save to Cloud and Open from Cloud with CloudQuizBrowser modal
- [x] Local save/load: .quiz file format (TEACHIFIC_QUIZ_V1 header + base64 JSON)
- [x] Quiz preview mode with interactive question rendering
- [x] Unit tests for quizMaker router (8 tests passing)
- [ ] SCORM/HTML5 export from web
- [x] Save checkpoint

## QuizMaker Publish Feature (Shareable Links & Embed Codes)
- [x] Add shareToken column to quizzes table (unique, nullable — generated on publish)
- [x] Add publishedAt timestamp column to quizzes table
- [x] Generate and apply migration SQL
- [x] Add quizMaker.publish procedure: generates shareToken, sets isPublished=true, sets publishedAt
- [x] Add quizMaker.unpublish procedure: clears isPublished, keeps shareToken for re-publish
- [x] Add quizMaker.getPublishedQuiz public procedure: fetch quiz by shareToken (no auth required)
- [x] Build public quiz player page at /quiz/:shareToken (standalone, no login required)
- [x] Quiz player: renders all question types, scoring, results page
- [x] Add Publish button to QuizMaker editor toolbar
- [x] Build ShareDialog component: shows shareable link, iframe embed code, copy buttons
- [x] Show published/unpublished badge in editor
- [x] Write vitest tests for publish/unpublish/getPublishedQuiz procedures
- [x] Save checkpoint

## QuizMaker Publish - Subdomain Integration
- [x] Add /quiz/:shareToken route to SubdomainSchoolRouter so quizzes are served on org subdomains
- [x] Update ShareDialog to generate share links using the user's org subdomain URL
- [x] Associate published quizzes with the user's org (store orgId with quiz on publish)
- [x] Backend: getPublishStatus returns orgSlug for subdomain URL generation
- [x] Keep /quiz/:shareToken in BareRouter as fallback for dev/preview (production uses subdomains)
- [x] QuizMaker editor requires login via QuizCreatorGate (already enforced)

## Quiz Attempt Tracking & Analytics
- [x] Create quiz_attempts table (quizId, taker name/email, score, totalPoints, passed, answers JSON, startedAt, completedAt)
- [x] Add quizMaker.submitAttempt public procedure (records attempt from public player)
- [x] Add quizMaker.getAttempts protected procedure (list attempts for a quiz, with pagination)
- [x] Add quizMaker.getQuizAnalytics protected procedure (aggregate stats: avg score, pass rate, attempts count)
- [x] Update PublicQuizPlayerPage to submit attempt on quiz completion
- [x] Build QuizAnalyticsPanel in editor sidebar (total attempts, avg score, pass rate, recent attempts table)
- [x] Write vitest tests for attempt tracking procedures

## SCORM/HTML5 Export from Web Editor
- [x] Create server-side SCORM package generator (builds imsmanifest.xml, SCO HTML, JS runtime)
- [x] Support SCORM 1.2 export (cmi.core.score, cmi.core.lesson_status)
- [x] Support SCORM 2004 export (cmi.score.scaled, cmi.completion_status, cmi.success_status)
- [x] Add quizMaker.exportScorm procedure (generates ZIP, uploads to S3, returns download URL)
- [x] Add Export button to QuizMaker editor toolbar with format picker (SCORM 1.2 / SCORM 2004)
- [x] Write vitest tests for SCORM export

## Quiz Branding/Theming
- [x] Add branding fields to quizzes table (primaryColor, logoUrl, completionMessage, bgColor, fontFamily)
- [x] Add BrandingPanel to editor sidebar with color presets, pickers, font selector, logo URL, completion message
- [x] Update PublicQuizPlayerPage to apply quiz branding (colors, logo, fonts, completion message)
- [x] Live preview of branding in the panel
- [x] Write vitest tests for branding persistence

## Question-Level Analytics
- [x] Add quizMaker.getQuestionAnalytics procedure (aggregates per-question correct/incorrect rates from attempt answers JSON)
- [x] Parse answersJson from quiz_attempts to compute per-question stats (correct count, incorrect count, % correct, most common wrong answer)
- [x] Update QuizAnalyticsPanel to show per-question breakdown with visual bars
- [x] Show which answer options were selected most frequently for MCQ questions
- [x] Write vitest tests for getQuestionAnalytics procedure
- [x] Save checkpoint

## TeachificCreator Rich Text Editor
- [x] Install TipTap rich text editor packages (@tiptap/react, starter-kit, text-align, text-style, underline, highlight, font-family)
- [x] Create RichTextEditor component with toolbar (bold, italic, underline, strikethrough, font size, font family, text color, highlight, alignment, bullet/numbered lists)
- [x] Replace plain textarea in Add Text Box dialog with RichTextEditor
- [x] Replace plain textarea in Properties panel (text element editing) with RichTextEditor
- [x] Render text elements on canvas using dangerouslySetInnerHTML for HTML content
- [x] Add CSS styles for rich text editor (toolbar, buttons, content area, compact variant)
- [x] Verify TypeScript compiles cleanly and Vite build succeeds

## Landing Page Builder UX Improvements
- [x] Redesign FAQ editor: replace raw JSON textarea with visual Q&A pair inputs (add/remove individual items)
- [x] Each FAQ item has separate Question and Answer text fields with add/delete buttons
- [x] Review all other block editors for raw code/JSON inputs and replace with user-friendly controls
- [x] Add new block type: Embed HTML (textarea for pasting embed codes like YouTube, Vimeo, etc.)
- [x] Add new block type: Divided Columns (2-column layout for side-by-side content)
- [x] Divided Columns: allow adding sub-blocks into left and right columns
- [x] Add live preview pane to page builder for real-time editing feedback
- [x] Verify build compiles and save checkpoint

## Order Bumps System
- [ ] Add order_bumps and order_bump_conversions tables to schema
- [ ] Add visibility column to quizzes and digital_products tables
- [ ] Create orderBumpsDb.ts with CRUD helpers
- [ ] Add orderBumps, visibility, and privateInvites sub-routers to lmsRouter
- [ ] Build OrderBumpsPage (list/manage bumps)
- [ ] Build OrderBumpEditorPage (landing page builder for bump offers)
- [ ] Integrate order bumps into checkout flow (before/during/after)
- [ ] Add OrderBumpOffer component for displaying bumps to customers
- [ ] Enforce visibility rules in public-facing pages

## Visibility Status for Courses/Downloads/Quizzes
- [ ] Add visibility dropdown to CourseBuilderPage (draft/published/hidden/private/archived)
- [ ] Add visibility dropdown to DigitalProductEditorPage
- [ ] Add visibility dropdown to Quiz ShareDialog
- [ ] Enforce visibility in public course listing (coursesBySlug)
- [ ] Enforce visibility in public digital product page (getProductBySlug)
- [ ] Enforce visibility in public quiz access (getPublishedQuiz)

## Two-Line Headline for Hero/CTA Block
- [x] Add headline2 field to hero/CTA block defaults in WysiwygPageBuilder
- [x] Update hero block editor panel to show both headline fields
- [x] Update hero canvas renderer to display both headline lines
- [x] Update PageBuilder.tsx public renderer for two-line headline
- [x] Update DigitalProductSalesPage and CourseSalesPage renderers

## Banner Headline Animation
- [x] Add subtle fade-in/slide-up animation for headline text on page load in banner/hero blocks
- [x] Apply to PageBuilder public renderer, CourseSalesPage, and DigitalProductSalesPage

## Banner Video Background & Upload & Headline Colors
- [ ] Add video background option to hero/banner block (already exists in CTA, ensure banner has it too)
- [ ] Add direct file upload button for image/video background in banner properties panel
- [ ] Add separate font color picker for headline 1 (headlineColor)
- [ ] Add separate font color picker for headline 2 (headline2Color)
- [ ] Update canvas renderers and public renderers to use per-headline colors
- [ ] Add inline image/video media element within hero banner (separate from background)
- [ ] Allow left/center/right placement of inline media relative to text content
- [ ] Add upload support for inline media in banner properties panel

## Preview as Student/Customer Feature
- [ ] Preview as Student for courses (view course content as enrolled student would see it)
- [ ] Preview as Student for quizzes (take quiz as student would see it)
- [ ] Preview as Customer for downloads (view download page as customer would see it)
- [ ] Preview banner/button in admin course builder, quiz editor, and download editor

## Page Builder UI Redesign (Full-page layout like reference)
- [x] Redesign WysiwygPageBuilder to full-page layout (no scrolling wrapper)
- [x] Top toolbar with Back to Admin, page title, Preview button, Save button
- [x] Left sidebar: block list with drag handles, block type + subtitle preview
- [x] Center area: live content preview (full-width, scrollable)
- [x] Right sidebar: properties panel overlays the preview when a block is selected
- [x] Block library categorized (Layout, Content, Conversion, Social Proof)
- [x] Back to Admin button returns to the specific product editor (course/quiz/download) the page belongs to

## Preview as Student/Member Feature
- [x] Preview as Student button on CourseBuilderPage (opens course player in new tab with ?preview=1)
- [x] Preview as Student button on QuizBuilderPage (opens quiz player in new tab)
- [x] Preview as Student button on DigitalProductEditorPage (opens product sales page in new tab)

## Quiz Maker iSpring-equivalent Enhancements
- [x] Add new question types: ordering, drag_drop, drag_words, dropdown, numeric, likert, essay
- [x] Implement iSpring .quiz file importer (ZIP/document.json parsing, media extraction)
- [x] Add iSpring import option to File menu in EditorToolbar
- [x] Create AdvancedEditors.tsx with editors for all new question types
- [x] Add per-question media attachments (image, audio, video, background)
- [x] Enhanced QuizSettings with branding, navigation, intro/result slides
- [x] Update QuizPreview with renderers for all new question types
- [x] Update PublicQuizPlayerPage with renderers for all new question types
- [x] Extended scoring for ordering, numeric, dropdown, drag_words, fill_blank
- [x] Audio/video rendering in PublicQuizPlayerPage per question

## Excel Import/Export Verification & Fix
- [x] Verify existing Excel import/export works with new question types
- [x] Fix any missing question type mappings in Excel import/export
- [x] Ensure all 14 question types can round-trip through Excel

## HTML5 Drag-and-Drop for Quiz Player
- [x] Implement drag-and-drop reordering for ordering questions (replace arrow buttons)
- [x] Implement drag-and-drop word placement for drag_words questions (replace click-to-place)
- [x] Add touch support for mobile drag interactions
- [x] Update both QuizPreview and PublicQuizPlayerPage with DnD

## Quiz Branching / Conditional Logic
- [x] Add branching data model (per-answer next question routing)
- [x] Add branching editor UI in quiz builder (per-choice destination selector)
- [x] Update quiz player to follow branching paths instead of linear sequence
- [x] Add "end quiz" and "jump to result" branch destinations
- [x] Support branching in PublicQuizPlayerPage

## Question Pools/Banks with Groups
- [x] Add QuestionGroup type (id, name, color) to quiz types
- [x] Each question gets optional groupId field
- [x] QuizMeta gets groups array and drawConfig (total questions per attempt, per-group draw counts)
- [x] Group management UI in quiz builder (create/rename/delete/recolor groups)
- [x] Assign questions to groups (drag or dropdown selector)
- [x] Draw configuration panel: set how many questions to show per attempt, how many from each group
- [x] Quiz player: on start, draw the configured number of questions from each group randomly
- [x] Show group labels in quiz builder question list

## Advanced Randomization Controls
- [x] Quiz-level shuffleQuestions toggle (randomize question order per attempt)
- [x] Quiz-level shuffleAnswers toggle (randomize answer order for all questions)
- [x] Per-question lockAnswerOrder override (keeps answers in set order even when quiz-level shuffle is on)
- [x] UI: toggle in QuizSettings for quiz-level shuffles
- [x] UI: per-question "Lock answer order" checkbox in QuestionEditor
- [x] Player respects both quiz-level and per-question shuffle settings

## Branching Flow Visualizer
- [x] Visual flowchart/graph component showing questions as nodes and branch rules as edges
- [x] Color-coded edges for different conditions (correct=green, incorrect=red, choice=blue, always=gray)
- [ ] Clickable nodes to jump to question editor
- [x] Auto-layout algorithm (top-to-bottom or left-to-right)
- [x] Show "End Quiz" and "Show Result" as terminal nodes
- [x] Accessible from quiz builder as a tab or panel

## Quiz Analytics Dashboard
- [x] Per-question analytics: times answered, % correct, avg time spent
- [x] Most-missed questions ranking
- [ ] Branching path distribution: which paths students take most often
- [x] Score distribution histogram
- [ ] Attempt timeline (attempts over time)
- [x] Filter by date range, group, question type
- [ ] Export analytics to CSV

## Centralized Question Bank (Per-Organization)
- [x] Add question_bank_folders table (id, orgId, name, parentId, color, sortOrder, createdAt, updatedAt)
- [x] Add question_bank_items table (id, orgId, folderId, questionType, stem, choices JSON, correctAnswer, explanation, points, tags, media, lockAnswerOrder, createdAt, updatedAt)
- [x] Generate and apply migration SQL
- [x] Backend: folder CRUD procedures (create, rename, move, delete, list tree)
- [x] Backend: question CRUD procedures (create, update, delete, list with filters, bulk move)
- [x] Backend: import questions from quiz to bank (copy selected questions into a folder)
- [x] Backend: import questions from bank to quiz (pull selected bank questions into a quiz)
- [x] Backend: bulk operations (move to folder, delete multiple, tag multiple)
- [x] UI: Question Bank page accessible from sidebar (per-org)
- [x] UI: Folder tree sidebar with create/rename/delete/drag-to-move
- [x] UI: Question list with search, filter by type/tags/folder
- [x] UI: Question editor modal (create/edit bank questions with same editor as quiz)
- [x] UI: Import to Quiz dialog (select questions from bank, choose target quiz)
- [ ] UI: Export from Quiz dialog (select quiz questions to save to bank folder)
- [x] UI: Bulk select and bulk actions (move, delete, tag)

## Clickable Branching Flow Visualizer Nodes
- [x] Make question nodes clickable to jump to that question in the editor
- [x] Highlight current question node in the visualizer (hover stroke effect)
- [ ] Add hover tooltip with question details

## Enhanced Analytics (Org + Group Breakdowns for Quizzes & Courses)
- [x] Org-level analytics dashboard: aggregate quiz stats across all quizzes in org
- [x] Org-level analytics dashboard: aggregate course stats (enrollments, completions, progress) across all courses in org
- [x] Filter analytics by organization group (learner groups)
- [x] Group comparison view: side-by-side stats for different groups
- [x] Course analytics: completion rates, avg progress, time spent per course, by group
- [x] Quiz analytics: pass rates, avg scores, attempts, by group
- [x] Combined dashboard: unified view of quiz + course performance per org
- [x] Export analytics data to CSV (org-level and group-level)

## Page Builder Visual Rebuild (Match All About Ultrasound Project)
- [x] Rebuild PageBuilderPage with teal header bar (Back to Product, product name, Editor/As Visitor/As Customer toggle, Open Page, Save button)
- [x] Left sidebar: blocks list with drag handles, showing block name + subtitle preview
- [x] Right panel: live preview of the page as it will appear to visitors
- [x] Block category tabs at bottom of sidebar: Layout, Content, Conversion, Social Proof
- [x] Layout blocks: Hero/Banner, Two Columns, Divided Columns, Spacer, Divider
- [x] Content blocks: Text/Rich Text, Image Block, Video, Course Outline, HTML Block
- [x] Conversion blocks: CTA/Pricing, Call to Action, Pricing
- [x] Social Proof blocks: Testimonials/Reviews, Checklist
- [x] Block editing: click Edit on any block to open inline editor
- [x] Block actions: Edit, Hide/Show, Duplicate, Move, Delete
- [x] Drag-to-reorder blocks in the sidebar list
- [x] Background Image Section block type
- [x] Page title and URL slug editable in header area
- [x] Works for course landing pages, homepage, and custom pages

## After Purchase Feature (Complete)
- [x] After purchase redirect URL configuration
- [x] Welcome email template editor (subject, body with merge tags)
- [x] Thank you page builder (use page builder blocks)
- [ ] Auto-enroll in related courses option
- [ ] Post-purchase webhook URL

## Drip Schedule Feature (Complete)
- [x] Drip schedule configuration per section/lesson
- [x] Schedule types: days after enrollment, specific date
- [x] Visual drip schedule table with per-lesson controls
- [ ] Email notification when drip content unlocks
- [x] Student view: locked content with unlock date shown (already in player)

## Custom Thank You Page (Per-Course)
- [x] Add thankYouPageBlocks JSON field to courses table (stores page builder blocks)
- [x] Add thankYouPageEnabled boolean field to courses table
- [x] Backend: update course.update procedure to accept thankYouPageBlocks
- [x] UI: Thank You Page builder section in After Purchase tab using WysiwygPageBuilder
- [x] Public route: /thank-you/:courseId renders the custom thank-you page blocks
- [x] After purchase redirect: if thankYouPageEnabled, redirect to custom thank-you page instead of default
- [x] Default thank-you page template with course access button if no custom page is set

## Standardize ALL Page Editors to Full-Screen AAU-Style with Teal Defaults
- [ ] DigitalProductEditorPage: Replace inline PageBuilder with full-screen WysiwygPageBuilder (teal)
- [ ] WebinarEditorPage: Replace inline PageBuilder with full-screen WysiwygPageBuilder (teal)
- [ ] PlatformAdmin PageCreatorTab: Replace Sheet-based PageBuilder with full-screen WysiwygPageBuilder (teal)
- [ ] CustomPagesPage: Replace Sheet-based WysiwygPageBuilder with full-screen navigation to PageBuilderPage (teal)
- [ ] PageBuilder.tsx component: Change all purple/indigo defaults to teal
- [ ] WysiwygPageBuilder.tsx: Ensure all accent colors default to teal
- [x] CourseBuilderPage sales page tab: Ensure it navigates to full-screen PageBuilderPage

## Subdomain / Custom Domain / Whitelabel Routing
- [x] All products (courses, downloads, webinars, custom pages, quizzes) served at org subdomain or custom domain
- [x] SubdomainSchoolRouter already has routes for /courses/:courseId, /shop/:slug, /webinar/:slug, /quiz/:shareToken, /p/:slug
- [x] Add /courses/:courseId/thank-you route to SubdomainSchoolRouter
- [x] Ensure all admin "share" links and "preview" buttons use org subdomain/custom domain URL
- [x] CourseBuilderPage share/preview links use getOrgBaseUrl() for course URLs
- [x] DigitalProductEditorPage share link uses getOrgBaseUrl() + /shop/:slug
- [x] WebinarEditorPage share link uses getOrgBaseUrl() + /webinar/:slug
- [ ] QuizCreatorPage published quiz link uses getOrgBaseUrl() + /quiz/:shareToken
- [ ] Custom pages share links use getOrgBaseUrl() + /p/:slug
- [x] Whitelabel support: custom domain only available on Pro+ subscription tiers
- [x] OrgSettingsPage domain section shows plan-gated custom domain configuration
- [x] Thank-you page route added to both SubdomainSchoolRouter and BareRouter
- [x] Thank-you page public renderer component (ThankYouPage.tsx)

## Thank You Page Builder (Complete Implementation)
- [x] AfterPurchaseTab: toggle switch for thankYouPageEnabled
- [x] AfterPurchaseTab: "Open Thank You Page Builder" button navigating to page builder
- [x] PageBuilderPage: support "thankyou" context type with courseId
- [x] App.tsx: add /lms/courses/:courseId/thank-you-builder route
- [x] ThankYouPage.tsx: public renderer that loads course thankYouPageBlocks and renders them
- [x] After purchase flow: redirect to thank-you page when enabled

## Custom Domain Setup for Org Admins
- [x] Custom domain settings UI in org admin settings (CNAME to teachific.app)
- [x] CNAME verification backend (DNS lookup to verify CNAME points to teachific.app)
- [x] Domain verification status display (unverified, pending, verified, failed)
- [x] Instructions for org admins on how to set up CNAME record
- [x] Restrict custom domain feature to higher subscription tiers (whitelabel)

## Post-Purchase Redirect Flow
- [x] Checkout success_url respects afterPurchaseRedirectUrl field from course
- [x] If afterPurchaseRedirectUrl is set, redirect there after successful payment
- [x] If thankYouPageEnabled and no redirect URL, redirect to /courses/:id/thank-you
- [x] Default fallback: redirect to course player /learn/:courseId

## Standardize Product Editors (Consistent Full-Screen Layout)
- [ ] All product editors (courses, downloads, webinars, memberships) use same visual layout
- [x] All product editors open full-screen without sidebar navigation
- [x] All products have full-screen sales page builder (not inline/sheet)
- [x] DigitalProductEditorPage: full-screen layout matching course editor style
- [x] WebinarEditorPage: full-screen layout matching course editor style
- [x] MembershipEditorPage: full-screen layout matching course editor style
- [x] Remove old inline/sheet-based page builders from product editors

## Membership Features (Missing Implementation)
- [x] Membership content inclusion: select which courses to include
- [x] Membership content inclusion: select which digital products to include
- [x] Membership content inclusion: select which communities to include
- [x] Membership member management: view/add/remove members
- [x] Membership auto-enrollment rules: if user buys course X, auto-add to membership Y
- [x] Membership auto-enrollment rules: if user buys product X, auto-add to membership Y
- [x] Membership rules engine: trigger-based membership assignment

## Product Editor Fixes (from user feedback)
- [x] Add "Sales Page" tab to CourseBuilderPage (currently missing)
- [ ] CourseBuilderPage Sales Page tab: button to open full-screen page builder
- [ ] DigitalProductEditorPage: rewrite to full-screen layout matching CourseBuilder (no sidebar)
- [ ] DigitalProductEditorPage: Sales Page tab should link to full-screen builder (not inline)
- [ ] WebinarEditorPage: rewrite to full-screen layout matching CourseBuilder (no sidebar)
- [ ] All product editors: remove DashboardLayout wrapper from routes (full-screen only)


## Module Integration (LMS, Email Campaigns, Form Builder, Media Repository, Member Management, Funnel Management)

- [ ] Add affiliate and instructor roles to user schema
- [ ] Create org user roles table for role assignments
- [ ] Merge LMS schema (courses, enrollments, lessons, quizzes, certificates)
- [ ] Merge Email Campaigns schema (campaigns, lists, subscribers, sender profiles)
- [ ] Merge Form Builder schema (forms, fields, submissions)
- [ ] Merge Media Repository schema (assets, folders, access rules)
- [ ] Merge Member Management schema (membership plans, subscriptions)
- [ ] Merge Funnel Management schema (funnels, pages, leads, digital products)
- [ ] Add custom domain fields to all product tables (courses, funnels, forms, etc.)
- [ ] Create affiliate commission tracking tables
- [ ] Generate and apply database migrations
- [ ] Integrate LMS router with org-level scoping
- [ ] Integrate Email Campaigns router with org-level scoping
- [ ] Integrate Form Builder router with org-level scoping
- [ ] Integrate Media Repository router with org-level scoping
- [ ] Integrate Member Management router with org-level scoping
- [ ] Integrate Funnel Management router with org-level scoping
- [ ] Create Affiliate router for commission tracking
- [ ] Integrate LMS admin pages
- [ ] Integrate Email Campaigns admin pages
- [ ] Integrate Form Builder admin pages
- [ ] Integrate Media Repository admin pages
- [ ] Integrate Member Management admin pages
- [ ] Integrate Funnel Management admin pages
- [ ] Create Affiliate admin dashboard
- [ ] Add CustomDomainManager component for per-product domain setup
- [ ] Implement custom domain routing in SubdomainSchoolRouter
- [ ] Test org-level data isolation across all modules
- [ ] Test custom domain routing for each product type
- [ ] Test affiliate commission tracking
- [ ] Test email campaign delivery via org sender profile
- [ ] Test form submissions and Google Sheets sync (optional)
- [ ] Test media repository access control
- [ ] Create comprehensive integration documentation


## Bugs & Issues

### Form URL Importer Not Working
- [ ] Form URL importer only imports form title, no fields are extracted
- [ ] LLM response parsing failing or LLM not returning field data
- [ ] Form branching patterns not being detected or imported
- [ ] Fix: Debug LLM response, enhance schema, preserve HTML structure for better extraction
