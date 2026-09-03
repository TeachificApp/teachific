-- Organization-owned mock-exam delivery flag for standalone Quiz Creator quizzes.
-- The owning organization and Pro-or-higher entitlement are enforced in the server router.
ALTER TABLE quizzes
  ADD COLUMN mock_exam_enabled TINYINT(1) NOT NULL DEFAULT 0;
