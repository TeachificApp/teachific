# Course360™ — Studio, Creator and Quiz Creator repair status

**Status: IN PROGRESS — DO NOT PUBLISH**  
**Date:** November 25, 2026  
**Workspace:** `/home/ubuntu/scorm-host`  
**Starting checkpoint:** `e5386003` (main-account Media Library increment)

This tranche implements and integrates substantial audited capability repairs. It does **not** establish that every marketing promise is fulfilled, that desktop products exist, or that payments and media processing are production-certified. Existing marketing copy has not been removed or rewritten to make incomplete capabilities appear complete. No publication is authorized by this status report.

## 1. Ownership and preservation

The Media Library remains a resource of the main Course360 organization/account and its school subscription, not a Studio-owned subscription. Studio, Creator and Quiz Creator can use that library through their own appropriately scoped operations. Optional export saves remain opt-in; default downloads are retained.

Server-persisted active organization, persisted membership/author permission and exact application/mode entitlement are authoritative. Browser organization IDs are consistency hints, not permission grants. Same-email school membership does not merge schools or expose another school’s content. Platform support access must use an explicit selected school and an awaited audit, not an inferred paid entitlement.

The preservation check found **1,386 baseline files present, no missing baseline files**, and no changes to protected original assets, public files, the supplied home-page banner/copy, schema/migrations, package/lockfile, environment files, compiler/Vite configuration or shared storage implementation. The read-only Ultrasound-App reuse snapshot remains clean at `5ca7dca7afd894998cf4ae5e2897b403cbea2f39`. Existing data, media rows, quizzes, courses, certificate records and templates were not deleted, migrated or backfilled by this capability tranche. Preservation copies of affected original code/test fixtures are held outside the project.

Existing source code was amended only within authorized capability repairs. New Creator layouts and controls are additive. Existing screens, tabs, routes, price assertions, default export options and unrelated project features are retained.

## 2. Studio: implemented repairs

**Capture and editing.** The client now has actual screen/camera canvas composition, picture-in-picture, mic/system-audio mixing, recording lifecycle cleanup, codec selection, pause/mute handling, stable recording IDs, autosave/retry handling and awaited upload metadata. The compatible paginated Media Library list and picker contracts are retained. Transcript edits are literal rather than regular-expression replacements; multiword filler handling and undo preserve the source document. Caption style/SRT export and derivative download paths are connected to actual output rather than merely relabeled originals.

**Media processing.** Bounded server-side FFmpeg processing produces H.264/AAC MP4 derivatives with selected cuts, remapped captions, ASS/karaoke rendering and trial watermark where applicable. It registers a new organization-owned media item and retains the source unchanged. Semantic highlights produce exactly ten usable nonoverlapping highlights only when there is sufficient substantive content; insufficient input fails honestly. Transcription, chunked upload and caption persistence use owned storage keys and strict organization checks, with revision/conflict handling.

**Derivative re-edit.** A real source → render → derivative reload → re-edit regression verifies that the editable document is rebound to the derivative’s own media ID, while historical source provenance remains unchanged. A second render uses that derivative’s owned key, not a foreign or original item by accident.

**URL import.** Supported direct public media and bounded public HTML extraction now retrieve and probe actual bytes before saving a new library row. Each source, redirect and extracted URL is separately tenant/DNS/SSRF checked; socket DNS is pinned, private/internal/metadata/encoded-IP destinations are rejected, and application credentials are not forwarded. Byte counts, container/MIME, duration, dimensions, quota, authoritative storage URL/key and the exact saved row are verified. Existing legacy pseudo rows remain untouched and readable.

**Current runtime envelope.** Studio processing is intentionally limited: 8 MiB source input, 16 MiB derivative output, up to 120 seconds of source video, up to 1080p/60 source and 720p/30 output, bounded cut ranges, one processing request per process, bounded memory and child-process/request deadlines. URL import has its own 60-second source/probe/storage budget within the shared processing admission. The existing Dockerfile has additive FFmpeg, font and `prlimit` dependencies; the image has not been deployed or certified under production’s 512 MiB envelope.

**Not fulfilled:** 4K, multi-gigabyte or long-media processing; durable distributed render/import jobs and quota reservations; object-store/DB atomicity and orphan reconciliation; verified social-platform download providers. YouTube imports are explicitly unsupported. Vimeo has no dedicated verified provider—only an actual public downloadable media object may work through the generic path. Recording remains blocked by the retained global camera/microphone Permissions-Policy pending the owner’s decision on a narrow exception. Local capture unit tests do not prove browser recording is available in the deployed app.

The URL importer reuses the existing abortable real-byte Studio storage helper rather than the literal shared `storagePut` function, whose API has no request abort/deadline. This preserves bounded work but remains a documented implementation-contract mismatch; shared storage was deliberately not overwritten.

## 3. Creator: implemented repairs

**Document and learner runtime.** The editor and exports share a lossless typed canvas/model and renderer. Learner preview, seven assessment types, five interaction types, branch targets, SCORM initialization/resume/scoring/completion, organization-owned media/logo packaging and serialized save/revision-conflict retention are connected to real document data. Fifty-two geometrically distinct layouts were added without replacing existing layouts/templates. Template seeding and project settings retain unsaved edits rather than resetting them on the component’s own dirty-state changes.

**AI and editable PowerPoint tranche.** A dedicated implementation adds reviewed AI drafts and editable PPTX import/export through the repaired document runtime. Generation/import must remain draft-only until explicit review and apply consent; applying must preserve the existing project unless append/new-project is explicitly selected. PowerPoint download awaits the current project save and does not publish or automatically upload the project. Provider and final integration details are recorded in the completed handoff and final verification addendum below.

**Not established as complete:** xAPI/LRS integration; direct school publishing; approval/comment collaboration and complete revision workflows; full conditional dialogue/role-play semantics; full stock/media/font provider parity; offline authoring; native desktop packaging and activation. AI image placeholders are not generated images, and narration text is not audio. The excluded dedicated read-aloud/TTS feature was not added.

## 4. Quiz Creator and enrolled lessons: implemented repairs

**Native authoring and export.** Versioned native question/configuration persistence, precise grading, explicit opt-in partial credit, manual-pending results, actual SCORM 1.2/2004 generation, save-before-export, scoped local drafts, public answer redaction, cryptographic share IDs/visibility and precision-aware result/analytics paths are implemented. A genuine export race is repaired: independently resolved library scope and quiz/source scope must match the exact application capability organization before generating an optional library save or default download. No Studio gate was added.

**Actual enrolled Course Player path.** The existing Embedded Quiz Player dispatches native Quiz Creator documents additively while preserving numeric bank-quiz delivery. Native attempts bind the persisted learner school, request host, course, lesson, enrollment, user and exact native UUID. Frozen configuration and matching maps stay private. Initial/resume payloads are allowlisted and redacted. Transaction/row-lock lifecycle, answer revisions, server deadlines, saved-only expiry submissions, idempotent retries and limits are tested. Seven controlled native question types are wired into real React delivery.

**Lesson/course/certificate completion.** A pending manual result is incomplete, in-progress, not passed and has no completion timestamp. The actual lesson-completion procedure checks the trusted native result before progress or effects. Course-wide completion and new/forced certificate issuance are gated on exact active enrollment and final passed native lessons. Existing normally issued certificates return unchanged. Author-preview intent is explicit and server-verified, not inferred from a browser role. The primary player now passes the trusted preview flag and waits for a successful progress save before updating completion UI or firing effects. The alternate player receives an explicit parent course slug, fixing an undeclared scope reference without granting preview privileges.

**Not fulfilled:** manual review/release UI and queue; native enrolled branching/draw execution; complete adaptive/visual/feedback parity; every historical consumer of legacy integer score columns. Unsupported enrolled native branching/draw configurations fail explicitly instead of flattening into a misleading assessment. Precise scoring is retained in JSON plus compatible float paths, while integer-only legacy consumers need separate reconciliation.

## 5. Access, billing and payment readiness

The app access repair uses exact web/desktop ledger sources, explicit school permissions and audited support provenance. School-plan inclusion is limited to the actual configured Studio Builder/Pro/Enterprise Web inclusion; Creator, Quiz Creator and Desktop inclusion are not invented. Application-specific billing/recovery routes preserve their exact customer/subscription source. Protected app login returns retain approved purchase/billing intent without granting access, choosing an organization or treating a redirect as payment proof. Missing native installers/activation are reported honestly.

Production startup now awaits a read-only payment bootstrap that verifies live Stripe credential/account identity, the configured enabled webhook endpoint and required events, and the eight-table durable ledger schema before configuring the application capability ledger. A prior read-only own-account check succeeded. This is **readiness evidence, not deployed lifecycle certification**: no charge, refund, cancellation or lifecycle mutation was performed. Live webhook processing, deployed portal/checkout behavior, school ingress credential/registry integration, historic manual grants, source-aware learner entitlement consumers and pending owner claim flows remain release blockers.

All owner-approved monthly/annual dollar prices and retained approved-price assertions remain unchanged. Existing Free accounts were not changed. The prior card-backed, checkout-first 14-day trial policy remains unchanged. Conflicting Studio/Quiz “no card” marketing awaits owner choice; it was not silently rewritten or used to change billing behavior.

## 6. Validation and evidence

The final combined suite and production build results are recorded in the verification addendum after all implementation agents finish editing. Tests run with credentials cleared, `envFile:false`, a single worker and a preload denying real HTTP(S), TCP/TLS, DNS and fetch egress except permitted local/mock behavior. Synthetic local FFmpeg media exercises actual processing; no live provider/storage/DB/email/payment mutation is claimed from mocks.

Previously completed integration checks include retained media/export/picker/approved-price **146/146**, parent configuration **38/38**, source/derivative re-edit plus Creator editor **23/23**, native completion and retained inline/CME/concurrency **34/34**, and actual player-preview/native scope/completion **67/67**. These overlap; they must not be added as a unique test total.

The three-app audits remain the source-specific inventory: Studio 66 claims, Creator 95 claims and Quiz Creator 88 claims. Original characterization failures are defect evidence, not acceptance tests. The completed implementation handoffs document actual behavior and residual gaps rather than treating a file, health endpoint or HTTP 200 as proof of fulfillment.

Repository-wide TypeScript remains unclean and resource-limited, with approximately 2,860 existing diagnostics and an inherited compiler abort. Focused tests, selected semantic checks and a successful production bundle do not certify the whole repository’s type correctness. The managed preview renders the preserved home page; authenticated app workflows, real camera/audio capture, production media memory/deadlines, AI output quality, PowerPoint interoperability, native lesson delivery and deployed Stripe lifecycle still require end-to-end QA.

## 7. Release gate and next work

**Do not publish this checkpoint as a fully marketed release.** The next engineering groups are: (1) production runtime/durable media jobs and provider adapters; (2) Quiz manual review/release, branching/draw and remaining learner/completion consumers; (3) Creator xAPI/direct publish/collaboration/advanced interactions; (4) genuine native installers/activation and advertised enterprise deployment/integration features; (5) remaining payment, school ingress and entitlement lifecycle certification. SAML/on-premises/support promises remain unverified.

Two owner decisions are still pending: the conflicting no-card versus card-backed trial policy, and permission to retain the global recording deny while adding a narrow authenticated same-origin camera/microphone exception. Neither policy was changed without consent. These decisions are independent of the safe implementation work already completed.

### Evidence locations

- Consolidated final tests: `capability-final-tests.log` and `capability-final-test-results.json`.
- Final production build: `capability-final-build.log`.
- Preservation: `capability-preservation-check.json` and `capability-final-tracked-changes.tsv`.
- Studio URL import: `implementation-studio-url-import.md`, `studio-url-import-tests-fourth.log`, `studio-url-import-targeted-types.log`.
- Creator AI/PPTX: `implementation-creator-ai-pptx.md`, `creator-ai-pptx-tests.log`.
- Native lessons: `implementation-native-course-quiz.md`, `native-course-quiz-tests.log`, `native-parent-completion-tests.log`, `native-player-preview-tests.log`.
- Payment readiness: `payment-bootstrap-readonly-runtime-receipt.json` (read-only, not release certification).

All evidence above is under `/home/ubuntu/course360-repairs/` unless its handoff explicitly identifies a project source/test path.

## Final verification addendum

The stable combined run completed successfully: **706/706 tests passed across 43 test files; no failures or skipped tests**. Machine-readable results are in `capability-final-test-results.json`; the full run is in `capability-final-tests.log`. The frontend and server production build completed successfully in `capability-final-build.log`. Existing large-bundle warnings remain (including an approximately 4.3 MiB bundled server and large frontend chunks); they were not hidden or resolved by this tranche.

The completed Creator handoff verifies **38/38 owned tests** (included in the combined total). AI generation uses the existing configured provider/model without a fallback switch, strict schema, a 4,096-token output cap, 45-second abort and response-size limit. Full lesson mode enforces **1,500 words total**, retained in complete notes and paginated editable learner-visible slides—not 1,500 words per slide. Draft preview returns a server-issued ticket bound to the author, exact active school and complete draft digest. Apply requires that exact ticket plus literal consent. Tickets expire after 15 minutes, are single-use after success, and fail closed after restart or on another instance. This is not a durable multi-instance review system.

PPTX output is actual editable PresentationML text, supported shapes/pictures and notes, with native custom XML preserving the original document/configuration. It is not HTML renamed as PowerPoint. Safe bounded ZIP/XML parsing rejects external relationships, macros, traversal, corrupt parts and decompression bombs. Imported raster media saves require separate main-library consent and quota/ownership checks; only NEW media records are created. Complex master/theme inheritance, mixed run formatting, groups/charts/SmartArt and transitions are not claimed as fully reproduced. Native non-picture asset rebinding across schools is unsupported and fails closed. Real PowerPoint application interoperability remains unverified.

AI image generation is explicitly unavailable in this tranche because the retained image helper auto-uploads to an unscoped generated namespace and lacks the bounded/cancellable organization-owned byte contract. No fake generated image, automatic unscoped image save or TTS was added.

The focused configuration and capture fixtures are also retained additively **inside the project**, without replacing `vitest.config.ts` or existing scripts:

- `course360CapabilityRepair.vitest.config.ts`
- `scripts/course360-repair-deny-network.cjs`
- `server/course360StudioCaptureContracts.test.ts`
- `server/course360StudioCaptureUi.test.tsx`
- `server/course360StudioCaptureFakes.ts`

Run the checkpoint’s focused suite from the project directory with credentials cleared:

```bash
cd /home/ubuntu/scorm-host
env -i PATH="$PATH" HOME=/home/ubuntu LANG=C.UTF-8 NODE_ENV=test \
  NODE_OPTIONS="--require=$PWD/scripts/course360-repair-deny-network.cjs" \
  pnpm exec vitest run --config course360CapabilityRepair.vitest.config.ts
```

An initial portability check exposed a jsdom `import.meta.url` filesystem-path mismatch only in the newly copied fixture. It was corrected to project-relative source loading without changing any original assertion or production source. Final project-local configuration results are recorded separately in `capability-portable-final-tests.log` and `capability-portable-final-test-results.json`; this duplicate run must not be added to the unique 706-test total.

**Portable final verification:** The project-local configuration and retained safeguard also passed **706/706 tests across the same 43 files**, with zero failures or skipped tests. This independently confirms the checkpoint retains the complete focused coverage, not just references to temporary external tests. The last production source edit preceded the successful production build; subsequent additions were verification configuration, test fixtures and documentation only. Final `git diff --check` and protected-content preservation checks passed. No publication, live charge/refund, lifecycle mutation, destructive data operation or Ultrasound-App write was performed.
