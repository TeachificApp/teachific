# Ultrasound-App Last-Week Port Audit

**Source:** `TeachificApp/ultrasound-app` Git history reviewed on 2026-09-03.

## Candidate changes

| Upstream commit | Area | Compatibility observation for Course360 |
|---|---|---|
| `700c896`, `3b7cab9`, `a9b7893` | CME inline lesson surveys and dependent questions | High value, but Course360 uses a lighter `client/src/pages/lms/CoursePlayer.tsx` inline-quiz implementation and lacks the upstream shared policy module. Port only with an explicit course-progress and CME entitlement model. |
| `9429bd3`, `df832e9`, `067bf7f`, `1344439` | Large Question Bank quiz hydration, standalone quiz staff preview, and embedded quiz access | Course360 has different router names and previously ported active-organization Quiz Creator safeguards. Compare behavior before porting; preserve Course360 branding and never add quiz read-aloud. |
| `ca03226`, `15a8141`, `d09b410`, `dcc2d70` | Course player hook and SCORM/ZIP display fixes | Candidate regression and delivery hardening only after mapping Course360's learner player components and signed Media Repository delivery. |
| `0d8888e` | Enrollment email and learner content URLs | Applicable only if Course360’s existing organization-owned domain resolver does not already cover the affected link paths. |
| `6b7690c` | Granular discount targeting | Course360’s current scoped coupon targeting implementation is already more recent and validated separately. |

## Exclusions

Dedicated quiz read-aloud, voice selection, voice samples, synthesis, and any source-project or clinical branding are **out of scope** for Course360.

## Next decision

Start with a focused Course360 compatibility map for required CME survey completion and conditional lesson-quiz questions. Do not copy upstream code verbatim: Course360 needs active-organization ownership, existing CME gates, and organization branding preserved at every learner and authoring surface.
