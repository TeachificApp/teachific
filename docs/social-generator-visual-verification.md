# Social Generator Visual Verification

**Verification date:** 2026-09-17

After restarting the development service, the local root responded with HTTP 200 and the expected Vite document. The public preview route `/marketing/social` resolves the Course360 application shell successfully. Its initial screenshot caught the shared `Loading Course360…` bootstrap state; a subsequent DOM inspection confirmed that the application had settled to the standard signed-out Course360 prompt: “Sign in to access your content library, manage SCORM packages, and track learner progress.” The development log independently records the expected missing session cookie. No client-side exception was reported.

The browser test environment has no authenticated organization-administrator session, so it cannot enter the protected social-generator interface. The social generator is registered at `/marketing/social` inside the DashboardLayout marketing navigation. Its server procedures derive the active organization from authenticated context, require organization-admin authorization, and do not accept an `orgId` input. Focused server-side authorization, route-registration, and feature tests passed.
