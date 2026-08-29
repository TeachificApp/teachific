# Cohort learner entry-point matrix

This audit records the cohort learner entry points that exist in Teachific and the routing or authorization control used by each. A cohort route is either built from the owning organization base URL when it is emitted from the server, or it is an intentional relative route which remains on the learner's current organization custom domain or subdomain.

| Entry point | Surface | Routing model | Access or visibility control | Audit result |
|---|---|---|---|---|
| `/cohort/:courseId` | Cohort schedule | Same-origin relative route | `lmsLearner.getCohortSchedule` requires enrollment for learners and active-organization course ownership for staff. | Scoped |
| `/cohort/:courseId/assignment/:assignmentId` | Assignment detail | Same-origin relative route | Learners require enrollment and published content; staff assignment reads require active-organization course ownership. | Scoped |
| `/cohort/:courseId/replay/:recordingId` | Cohort replay | Same-origin relative route | The protected replay page reads only the schedule response, which exposes published recordings filtered to the learner's cohort group and organization-authorized staff access. | Scoped |
| Course overview assignment actions | Course overview | Same-origin relative route | The action uses the current organization host and opens the assignment detail route. | Scoped |
| Course player cohort action | Course player | Same-origin relative route | The action uses the current organization host and opens the cohort schedule route. | Scoped |
| Replay cards and list rows | Cohort schedule | Same-origin relative route | The links open the protected replay route rather than a platform-hosted URL. | Scoped |
| Session notification email | Cohort administration | Owning organization base URL | `getOrgBaseUrl(slug, customDomain, domainVerificationStatus)` builds the schedule link. The footer and button use the owning organization identity and validated organization accent. | Scoped |
| Assignment notification email | Cohort administration | Owning organization base URL | `getOrgBaseUrl(slug, customDomain, domainVerificationStatus)` builds the assignment link. The footer and button use the owning organization identity and validated organization accent. | Scoped |
| Cohort welcome/enrollment email | Cohort administration | Organization-aware enrollment helper | The helper receives the owning `orgId`, allowing organization sender and learner routing resolution without a platform-domain fallback. | Scoped |
| ICS calendar export | Cohort administration | Downloaded calendar document | Calendar metadata is generic and contains no source-project or platform domain. Meeting URLs remain the instructor-configured external provider links. | Scoped |
| Add-to-calendar links | Cohort schedule | External calendar provider | These intentionally open the learner-selected calendar provider rather than an application domain. | Intentional external link |
| Live-session and recording source links | Cohort schedule | Instructor-configured external media provider | These intentionally open the configured meeting or media destination and are not Teachific learner navigation links. | Intentional external link |
| Cohort resource links | Cohort resource card | Author-configured resource destination | These are explicit course resource destinations; they do not construct or fall back to a platform learner domain. | Intentional author link |

The codebase no longer constructs `learn.teachific.app` or another hard-coded Teachific platform domain for cohort learner navigation. The route registrations in `client/src/App.tsx` cover the schedule, assignment, and replay paths in every relevant route shell. The selected content query is the source of truth for visibility and prevents replay IDs from being used to bypass enrollment, cohort-group filtering, publication state, or active-organization staff access.
