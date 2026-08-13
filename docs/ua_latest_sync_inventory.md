# Latest Ultrasound-App Sync Inventory

The most recent Ultrasound-App source session introduced a group of related learning-platform changes that need Teachific equivalents with strict `orgId` ownership checks and multi-tier authorization. The in-scope groups are: lesson-quiz-to-question-bank synchronization, Question Bank media reuse, standalone/embedded quiz workflows, Quiz Creator resilience and branding, quiz feedback and answer-order controls, content availability and waitlists, import improvements, inline lesson-quiz completion, and responsive Page Editor behavior.

## Key Findings

| Area | Recent Ultrasound-App capability | Teachific porting requirement |
|---|---|---|
| Lesson quiz synchronization | Page-builder and legacy lesson questions sync into a `Lesson Quiz` root folder with a course-name child folder and stable source identifiers. | Use the existing org-scoped `questionBankFolders` and `questionBankItems` tables; add source identity fields and enforce `orgId` in every read/write. |
| Quiz Creator recovery | Stale JavaScript module responses trigger a controlled reload instead of leaving the Quiz Creator unusable. | Preserve Teachific-only name, visual identity, and URLs. |
| Content availability | Waitlists and availability behavior extend across product types. | Apply the same org-scoped ownership and student-facing domain rules. |
| Page editor | Responsive layout improvements for mobile and tablet. | Keep each org's theme and landing-page content isolated. |
| Imports and media | iSpring/SCORM and Excel quiz import improvements; reusable Question Bank media. | Imported questions and media must be attributed to the active org only. |

## Additional Question Bank Findings

The newest Ultrasound-App work confirms that Question Bank questions support per-answer media, per-answer feedback, question-level image/video, feedback image/video, folders, tags, hotspot markers, and matching pairs. Its import workflow supports SCORM/ZIP/.quiz extraction with automatic folder placement and explicit folder/tag assignment. Teachific already includes the core import/export and media fields; remaining parity work should focus on validating the editor flows and preserving org ownership on every source-backed question record.

## Branding Boundary

Quiz Creator must remain branded as **Teachific**. No Ultrasound-App organization name, site URL, asset, footer, or copy may be ported into this project.

## Permission Model

Platform owners and site admins can administer all orgs. Org super admins and org admins can manage only their active org. Instructors may author only where explicitly granted. Members and learners have no authoring or Question Bank administration rights.
