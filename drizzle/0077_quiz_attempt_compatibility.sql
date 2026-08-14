-- Preserve the existing legacy attempt columns and add the canonical columns used
-- by the current standalone quiz runtime. Existing records are backfilled below.
ALTER TABLE `quiz_attempts`
  ADD COLUMN IF NOT EXISTS `quiz_id` int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `user_id` int,
  ADD COLUMN IF NOT EXISTS `guest_email` varchar(255),
  ADD COLUMN IF NOT EXISTS `attempt_number` int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS `attempt_status` enum('in_progress','completed','abandoned','timed_out') NOT NULL DEFAULT 'in_progress',
  ADD COLUMN IF NOT EXISTS `question_snapshot` json,
  ADD COLUMN IF NOT EXISTS `total_points` int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `earned_points` int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `score_percent` decimal(5,2),
  ADD COLUMN IF NOT EXISTS `passed` boolean,
  ADD COLUMN IF NOT EXISTS `started_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS `completed_at` timestamp,
  ADD COLUMN IF NOT EXISTS `time_spent_seconds` int,
  ADD COLUMN IF NOT EXISTS `source_type` enum('standalone','lesson','funnel','landing_page') DEFAULT 'standalone',
  ADD COLUMN IF NOT EXISTS `source_lesson_id` int,
  ADD COLUMN IF NOT EXISTS `source_funnel_page_id` int;--> statement-breakpoint

UPDATE `quiz_attempts`
SET
  `quiz_id` = `quizId`,
  `user_id` = `userId`,
  `guest_email` = `takerEmail`,
  `attempt_number` = COALESCE(`attemptNumber`, 1),
  `attempt_status` = CASE WHEN `isCompleted` = 1 THEN 'completed' ELSE 'in_progress' END,
  `total_points` = COALESCE(ROUND(`totalPoints`), 0),
  `earned_points` = COALESCE(ROUND(`scoreRaw`), 0),
  `score_percent` = `scorePct`,
  `passed` = `isPassed`,
  `started_at` = COALESCE(`startedAt`, CURRENT_TIMESTAMP),
  `completed_at` = `submittedAt`,
  `time_spent_seconds` = `timeTakenSeconds`,
  `source_type` = 'standalone'
WHERE `quiz_id` = 0;
