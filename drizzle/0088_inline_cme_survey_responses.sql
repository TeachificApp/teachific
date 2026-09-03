-- Additive, organization-owned persistence for inline lesson CME survey
-- submissions. These tables do not alter standalone Quiz Creator or Question
-- Bank records.
CREATE TABLE IF NOT EXISTS `lms_inline_quiz_attempts` (
  `id` int NOT NULL AUTO_INCREMENT,
  `orgId` int NOT NULL,
  `user_id` int NOT NULL,
  `enrollment_id` int NOT NULL,
  `course_id` int NOT NULL,
  `lesson_id` int NOT NULL,
  `quiz_block_id` varchar(128) NOT NULL,
  `score` int NOT NULL,
  `passed` boolean NOT NULL,
  `submitted_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `lms_inline_quiz_attempts_org_course_lesson_idx` (`orgId`, `course_id`, `lesson_id`),
  KEY `lms_inline_quiz_attempts_enrollment_block_idx` (`enrollment_id`, `quiz_block_id`)
);

CREATE TABLE IF NOT EXISTS `lms_inline_quiz_responses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `orgId` int NOT NULL,
  `attempt_id` int NOT NULL,
  `question_key` varchar(128) NOT NULL,
  `question_text` text NOT NULL,
  `question_type` varchar(32) NOT NULL,
  `answer_value` text,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `lms_inline_quiz_responses_org_attempt_idx` (`orgId`, `attempt_id`)
);
