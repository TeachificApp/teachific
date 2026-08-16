# Recent Ultrasound-App Migration Review

Source repository reviewed: `TeachificApp/ultrasound-app` at the current default branch on 2026-08-15.

Recent upstream capabilities relevant to Teachific include secure source-file uploads for AI generation, source-derived Question Bank questions with explanations and answer-level feedback, multi-lesson AI curricula with optional course-wide assessments, per-question feedback modes in Quiz Creator, CME lesson-completion progression, and responsive layout safeguards.

The upstream source-file review component accepts up to PDF, JPEG, PNG, and WebP files and presents upload, ready, and removal states. Teachific should apply organization-derived colors and labels to that organization-owned authoring surface rather than copy fixed upstream teal utilities or organization-specific branding.

Teachific migration boundaries: retain **Teachific** for platform and Quiz Creator identity; derive organization-owned content, permissions, sender identity, themes, and learner links from the active organization; never carry upstream organization branding into Teachific organization surfaces.
