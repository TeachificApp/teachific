# Course360™ — marketing, package checkout and capability status

**IN PROGRESS — DO NOT PUBLISH**

**Date:** November 25, 2026 (final verification completed November 26 UTC)

**Workspace:** `/home/ubuntu/scorm-host`

**Baseline checkpoint:** `94bab3e8`

**Managed project:** `fJXMsdmk8vcb8V4GDt37f6`

This is an implementation and verification checkpoint, **not production-release certification**. It preserves the earlier `course360-capability-repair-status-2026-11-25.md` report. The current document supersedes that report's specific gaps for manual Quiz review, explicit Creator image generation and direct school publishing, but does not erase its other limitations. Original implementation handoffs and receipts are retained outside the project.

## 1. Owner-approved marketing and prices

The public marketing now has two distinct tracks: **Run Your School / LMS Learning Delivery Platform**, using teal/white school-delivery positioning, and **Create Content / Content Creator Platform**, using navy creator positioning. The hero, navigation and workflows emphasize these tracks. The supplied banner/logo, original testimonials, much of the original layout, standalone pricing sections, comparison and other retained sections remain. Authorized original marketing copy was archived before replacement.

New cross-tool offers use exact canonical USD dollar values:

| Package | Monthly | Annual, paid upfront |
|---|---:|---:|
| Builder + Creator Web | $169.97 | $1,599.97 |
| Pro + Creator Web | $249.97 | **$2,497.00** |

Each package retains the corresponding school's normal Builder/Pro benefits, **including the existing Studio Web school-plan inclusion**, and adds only its bound Creator Web paid source. It does not fabricate a separate paid Studio subscription, Quiz Creator, Desktop or Bundle grant. White label remains Pro, not Builder.

All approved standalone prices remain unchanged:

| Standalone product | Monthly | Annual |
|---|---:|---:|
| Course360 Starter | $39.97 | $399.97 |
| Course360 Builder | $99.97 | $999.97 |
| Course360 Pro | $199.97 | $1,999.97 |
| Studio Web | $39.97 | $299.97 |
| Studio Desktop | $49.97 | $399.97 |
| Studio Bundle | $69.97 | $599.97 |
| Creator Web | $99.97 | $899.97 |
| Creator Desktop | $119.97 | $999.97 |
| Creator Bundle | $149.97 | $1,299.97 |
| Quiz Creator Web | $39.97 | $299.97 |
| Quiz Creator Desktop | $49.97 | $399.97 |
| Quiz Creator Bundle | $69.97 | $599.97 |

Free remains available to existing eligible accounts in code, not a public root registration choice. Root registration labels now display exact interval-aware prices; organization-domain student registration controls and behavior are retained.

## 2. Genuine package checkout, fulfillment and recovery

The landing page mounts the actual `billing.getCrossToolOffers` query and `billing.createCrossToolCheckout` mutation. All four configured prices and durable provisioning must be ready before the package CTA can submit. Focus/periodic refresh and a fresh pre-submit readiness check protect against stale availability. Selection, cancellation and back navigation do not create Checkout. A synchronous duplicate lock, safe retry behavior and an HTTPS `checkout.stripe.com` destination allowlist are enforced. Browser amount, arbitrary price IDs, organization inference and payment/authentication grants are not accepted.

New-school checkout collects name/email and requires explicit agreement to a **card-backed 14-day trial and automatic renewal**. Annual plans clearly disclose the exact upfront annual charge after the trial. Checkout comes before account setup. The existing-school billing link is `/billing`; an already-paid school's migration into a package is deliberately blocked until a reviewed change/migration policy exists.

The server uses an immutable durable reservation, the existing signature-verified Stripe Inbox transaction and distributed overlap guards across standalone/package checkout paths. Fulfillment validates actual current Checkout/subscription identity, approved price/product/amount/currency/interval/quantity and package reservation before atomically committing the school billing projection and bound Creator Web source. Current-state failure, cancellation, paid-through periods, trial expiry, reactivation, catalog drift, out-of-order delivery and recovery are exercised by executable tests. Independent historical/manual/other-school sources remain separate.

Onboarding email is sent only after the grant transaction commits. A durable pending-delivery marker permits retry without duplicating schools or grants. Email delivery is **at least once**, not provider exactly once; a crash after send but before clearing the marker can resend guidance.

## 3. Separate-school account setup and owner claims

`/account-setup` uses neutral **Finish setting up your school** guidance. A redirect or URL parameter does not prove payment, create access, reset an existing password or sign anyone in. New identities receive a secure initial password-setup email after verified fulfillment. Existing identities sign in normally and use a separate verified-school ownership claim.

The additive claim panel calls the real protected no-input list API only when authenticated, accepts fresh identity-scoped fetches rather than shared cached query data, and requires an explicit checkbox for each exact listed school before submitting `{claimId}`. Duplicate, stale identity/list, unmount, mismatch and retry cases are guarded. The server requires verified matching identity/email, exact school ownership and a **pending** claim before inserting membership; replay cannot regrant membership that was subsequently removed.

A successful claim refreshes claims and organization-membership list caches and provides an explicit dashboard link. It does not mutate authentication, cookies, global role, active-school selection or subscription entitlement. Same-email schools never merge, share members or expose one another's content. Learners remain separately host/school scoped; only authorized administrative roles may switch selected organizations.

## 4. Additional integrated capabilities

**Native Quiz manual review.** The actual Quiz Creator dashboard now includes an explicit queue/detail/grade/release panel. Exact school, author permission, Quiz Web capability, frozen enrolled attempt/source and revision checks are server enforced. Row locks and revision CAS preserve student answers, automatic grades and append-only review audit. Saving grades, even the last one, remains pending and cannot satisfy completion. Explicit release installs the trusted final native result. Review/release itself does not complete lessons/courses, create certificates, grant access or send email. The learner's existing trusted completion path separately rechecks enrollment and final pass. Original legacy numeric score columns are retained; JSON-aware native scoring is authoritative.

**Creator generated images.** The configured existing image provider is called only after explicit generation/save consent. Actual supported PNG bytes are bounded and verified, saved to a fresh school-owned key and a NEW main-account Media Library row, and read back against the actual receipt. A separate author action inserts a fresh image block; existing blocks/assets are not replaced. It is a bounded one-image path, not automatic full-course image insertion. Unsupported response formats fail honestly. Provider model/default selection is preserved rather than silently changed. Live provider compatibility, cost/quality and deployed storage behavior remain untested.

**Creator publishing to school courses.** Explicit save-before-publish creates a real shared-renderer HTML5 ZIP, new owned media/accounting metadata and a NEW lesson in an exact-school course/section. Original source projects, slides, settings, lessons and default downloads are preserved. Durable receipt/request checks prevent duplicate lesson grants from retries. The actual `MediaEmbedIframe → ScormPlayer → ZIP extraction → Blob → Creator renderer` chain is tested, including execution of generated learner HTML in JSDOM. **LMS completion is explicitly manual**; local Creator assessment results are not server-certified school grades or automatic certificates.

The Media Library remains owned by the **main Course360 school account/subscription**, not Studio. Studio, Creator and Quiz are appropriately scoped clients with optional saves. No dedicated read-aloud/TTS feature was added; fractional CME and dollar-valued price conventions remain unchanged.

## 5. Actual live configuration versus release evidence

Exactly **two NEW live Stripe products and four active recurring USD prices** were created and read back on the expected Course360 account. Existing products/prices, customers, subscriptions, charges and refunds were not changed. Only those newly created package products had their initial descriptions corrected to retain normal school benefits. Canonical package amounts are 16997/159997/24997/**249700** cents at the Stripe boundary.

A new server-owned, production-only non-secret verified price configuration supplies those four IDs. Explicit environment overrides, including blank/invalid values, remain authoritative and fail closed. Development/test never silently adopts live price IDs. No `.env` or existing managed credential configuration was overwritten.

Actual isolated **read-only production-mode** checks passed payment bootstrap/account/webhook/eight-table schema verification, all four real catalog prices and sender verification. The existing SendGrid sender is still **`hello@teachific.net`**, verified as a single sender and through authenticated domain configuration. It was deliberately not silently replaced. A Course360/SoundMedia-branded sender change requires approved configuration; deployed delivery remains unverified. Missing/malformed package onboarding transport configuration blocks checkout.

These checks created **no Checkout session, sent no email and exercised no live payment lifecycle**. They are not proof of SCA, webhook delivery, trial conversion, failure/cancellation recovery or school onboarding in the deployed application. No publish operation was invoked for this tranche. A separate hosting-success notification did not establish the currently deployed revision; current source must not be described as live solely from that notification.

## 6. Final verification and preservation

The stable post-fix run passed **1,187/1,187 test occurrences across 67 files**, with zero failed or pending tests. All **706 original occurrences across 43 files** are retained and passing. Duplicate-title multiplicities were checked: 697 original unique file/full-title keys and 1,176 final keys; no original occurrence was lost. Overlapping focused runs are not summed.

The suite runs with an empty inherited environment, `envFile:false`, one worker and a preload denying real HTTP(S), TCP/TLS, DNS and fetch egress. Tests execute actual source/control flow/renderers, with external persistence/provider boundaries mocked. They are not production integration tests.

The final frontend/server production build passed after all source corrections. Large chunk warnings remain, including the approximately 4.4 MiB server bundle. A full TypeScript run completed with **2,860 repository diagnostics**: **zero diagnostics in newly added modules or the exact corrected LandingPage/review-panel/publish-player/account-setup/registration/payment-ledger paths**. Existing diagnostics remain in modified legacy Creator/Quiz/webhook files and elsewhere. The repository is **not type-clean**.

Independent read-only preservation checks passed:

- All **1,464 files from checkpoint `94bab3e8`** still exist.
- Precisely reconstructed **189 protected files** are byte-identical; expanded checks cover 205 unique protected/config files.
- App/Home, supplied assets/public files, schema/migrations, packages/lockfile, global configurations, shared storage and school application capabilities are preserved.
- No original assertion/case lines were removed across 292 baseline test files; testimonials are byte-identical.
- Standalone catalog SHA-256 remains `102f39c2995ee5bd5af45366e725e3df418fb8002d647809b62ed102202201dd`.
- `git diff --check` passes. Ultrasound-App remains read-only and clean at `5ca7dca7afd894998cf4ae5e2897b403cbea2f39`.

The public two-track hero and exact package section rendered in the preview. Development package CTAs correctly fail closed when durable live provisioning is unavailable. **The guest account-setup browser route did not pass visual QA:** repeated normal navigation/reload rendered the app-loading failure screen. Read-only diagnostics found the mounted `AppLoadFailure` and successful later explicit module imports, but did not establish or repair the original load-failure cause. No successful normal account-setup browser flow, login, claim, Checkout or learner publishing browser session is claimed.

## 7. Release blockers and next work

Before publishing this as a production-ready signup/package release:

1. Diagnose and clear the normal account-setup/app bootstrap preview failure, then test guest and authenticated setup/claim behavior through ordinary navigation.
2. Identify and verify the deployed revision/configuration; authorize and execute controlled checkout/SCA, signature-verified webhook delivery, onboarding email, verified same-email claims, trial conversion and lifecycle/recovery QA. Resolve branded sender configuration without overwriting existing settings without consent.
3. Certify school host ingress/credential registry, exact school-bound learner entitlement consumers, historical/manual grant reconciliation and generic status-only school expiry consumers. Existing paid-plan-to-package migration remains blocked pending review.
4. Resolve broad TypeScript drift and production runtime/CSP/CORS/storage/DB/provider behavior; passing mocks/builds do not certify these boundaries.

Other advertised capability gaps remain: 4K/large/long media and verified social providers; durable distributed media/image jobs, cross-feature atomic quota reservations and object-store/DB orphan reconciliation; Creator automatic full-course images, xAPI/LRS, collaboration/advanced interactions and PowerPoint/native-app interoperability; enrolled Quiz branching/draw, advanced feedback/reopening and JSON-unaware legacy numeric consumers; genuine native installers/activation and unverified SAML/on-premises promises. Studio's current bounded envelope remains 8 MiB input, 16 MiB output, 120 seconds, 1080p/60 source and 720p/30 output with per-process admission.

The retained global camera/microphone deny and conflicting standalone Studio/Quiz no-card-versus-card-backed trial messaging still require owner policy decisions. Package card-backed trials are approved; these other policies were not silently changed.

## Evidence and reproduction

Evidence directory: `/home/ubuntu/course360-repairs/`.

- Final stable suite: `cross-tool-capabilities-final-attempt2-test-results.json`, `cross-tool-capabilities-final-attempt2-tests.log`.
- Final build: `cross-tool-capabilities-final-attempt2-build.log`.
- Full compiler result and precise scope: `cross-tool-capabilities-final-attempt2-tsc.log`, `cross-tool-capabilities-final-attempt2-tsc-precise-summary.json`. The earlier broad filename-filter summary is not the precise new-path result.
- Independent preservation/case comparison: `final-independent-preservation-attempt2.json`, `final-independent-preservation-attempt2.md`.
- Live catalog and description correction: `cross-tool-live-catalog-result.json`, `new-package-description-correction-receipt.json`.
- Read-only production readiness: `cross-tool-production-readonly-final-receipt.json`, `cross-tool-production-readonly-final.log`.
- Benefit/configuration correction: `package-plan-preservation-supplement.md` supersedes the original backend handoff's package-specific Studio exclusion.
- Implementation handoffs: `implementation-two-track-marketing.md`, `implementation-public-package-checkout.md`, `implementation-account-setup-guidance.md`, `implementation-paid-school-claims-ui.md`, `implementation-native-quiz-review.md`, `implementation-creator-owned-images.md`, `implementation-creator-school-publish.md`.

Reproduce the credential-free portable suite:

```bash
cd /home/ubuntu/scorm-host
env -i PATH="$PATH" HOME=/home/ubuntu LANG=C.UTF-8 NODE_ENV=test \
  NODE_OPTIONS="--require=$PWD/scripts/course360-repair-deny-network.cjs" \
  pnpm exec vitest run --config course360CapabilityRepair.vitest.config.ts
```

**Checkpoint must remain IN PROGRESS — DO NOT PUBLISH.** No live charge/refund/cancellation, destructive data operation, existing catalog replacement or Ultrasound-App write was performed for this tranche.

## Post-checkpoint additive setup-loader and final verification addendum

**November 26, 2026, 00:40 UTC. This addendum supersedes the earlier account-setup preview failure and earlier final test/build figures above; the original observations and evidence remain preserved.**

A development-only restart yielded one successful qualified setup-page load but did not reliably repair ordinary navigation. A subsequent narrowly additive fix now selects a lightweight entry for exact `/account-setup` on the existing Course360 platform/local/managed-preview host classifier. School subdomains, custom/unknown hosts and other paths retain the original full-App path. The existing root classifier was not changed.

`client/src/AppBootstrap.tsx` has exactly **four added lines and zero removed or replaced lines**: a helper import and a preceding conditional import of the existing setup page. Every original ternary, catch/fallback, provider, tRPC client, credential and API error-handling line is retained. The original file is archived outside the project; removing only those four additions restores its exact original bytes. `App.tsx`, `main.tsx`, `BootstrapShell.tsx`, the setup page and claim panel were not changed by this loader repair. Entry selection is not identity, payment, school, membership or entitlement proof. The original full-App import-failure cause is not claimed established, and other heavy-App routes are not certified by this repair.

The new actual-source loader suite contains **49 tests** for exact hosts/paths, query independence, actual guest setup/claims rendering, synthetic authenticated consent, unchanged root marketing/providers and the retained heavy-App/fallback path. Its separate adjacent run passed 155/155 across seven files; that overlapping count is **not added** to the final integrated total.

**Normal browser navigation and reload now pass for the guest setup page.** The actual page rendered its neutral payment disclaimer and separate-school sign-in recovery controls. Read-only resource checks confirmed `heavyAppRequested:false`, `protectedClaimsRequested:false`, `checkoutRequested:false` and `failureVisible:false`. No login, claim, Checkout, email or learner publishing action was performed. This is successful guest preview verification, not authenticated or deployed lifecycle certification. Screenshots/HTML and the read-only check are retained under the sandbox evidence paths, including `/home/ubuntu/console_outputs/exec_result_2026-11-26_00-38-25_686.txt`.

The **final stable suite passed 1,236/1,236 occurrences across 68 files**, with no failed or pending tests, after all production source edits. The final production frontend/server build passed. Large bundle warnings remain. A fresh full TypeScript run still reports **2,860 global diagnostics**, with **zero diagnostics in all newly added modules, exact narrow corrected paths, the bootstrap addition and new loader tests**. Global type cleanliness is not claimed.

Authoritative final evidence under `/home/ubuntu/course360-repairs/`:

- `cross-tool-capabilities-final-attempt3-test-results.json` and `cross-tool-capabilities-final-attempt3-tests.log`.
- `cross-tool-capabilities-final-attempt3-build.log`.
- `cross-tool-capabilities-final-attempt3-tsc.log` and `cross-tool-capabilities-final-attempt3-tsc-precise-summary.json`.
- `final-parent-preservation-attempt3.json` and its read-only verifier `verify-final-course360-checkpoint.py`.
- `implementation-account-setup-light-entry.md`, `account-setup-light-entry-preservation.json` and the exclusive original archive.
- `post-checkpoint-account-setup-recovery-limits.md` clarifies why the earlier restart-only success was insufficient.

The remaining release gates are authenticated/deployed setup and exact-school claims, deployed Checkout/SCA/signature-verified webhook/trial/lifecycle recovery and email delivery, approved branded sender configuration, school ingress/historical/expiry entitlement consumers, reviewed existing-plan migrations, broad type drift and previously documented runtime/advanced/native capability gaps. Existing `hello@teachific.net` sender and all provider credentials remain unchanged. A later hosting notification still did not identify a certified deployed revision. No publish operation, live charge/refund/cancellation, customer subscription mutation, destructive data operation or Ultrasound write was performed.

**Updated checkpoint remains IN PROGRESS — DO NOT PUBLISH.**
