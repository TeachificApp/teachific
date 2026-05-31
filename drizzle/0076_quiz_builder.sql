-- Quiz Builder: Question Banks, Quizzes, Attempts, Import
-- Migration: 0076_quiz_builder.sql

CREATE TABLE IF NOT EXISTS `quiz_bank_tags` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `org_id` int NOT NULL,
  `name` varchar(100) NOT NULL,
  `color` varchar(20) DEFAULT '#24abbc',
  `created_at` timestamp DEFAULT (now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS `quiz_banks` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `org_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text,
  `is_default` boolean DEFAULT false,
  `question_count` int NOT NULL DEFAULT 0,
  `created_at` timestamp DEFAULT (now()) NOT NULL,
  `updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS `quiz_bank_questions` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `org_id` int NOT NULL,
  `bank_id` int NOT NULL,
  `question_type` enum('mc','tf','ms','hotspot','puzzle','matching','sequence','numeric','short_answer','info_slide') NOT NULL DEFAULT 'mc',
  `question_text` text NOT NULL,
  `question_html` text,
  `q_media_type` enum('none','image','video') DEFAULT 'none',
  `media_url` varchar(1024),
  `media_alt` varchar(255),
  `hotspot_zones` json,
  `puzzle_config` json,
  `numeric_min` decimal(15,4),
  `numeric_max` decimal(15,4),
  `points` int NOT NULL DEFAULT 1,
  `partial_credit` boolean DEFAULT false,
  `penalty_points` int DEFAULT 0,
  `difficulty` enum('easy','medium','hard') DEFAULT 'medium',
  `explanation_text` text,
  `explanation_html` text,
  `exp_media_type` enum('none','image','video') DEFAULT 'none',
  `explanation_media_url` varchar(1024),
  `import_source` varchar(50),
  `import_job_id` int,
  `is_archived` boolean DEFAULT false,
  `created_at` timestamp DEFAULT (now()) NOT NULL,
  `updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS `quiz_question_tags` (
  `question_id` int NOT NULL,
  `tag_id` int NOT NULL,
  PRIMARY KEY (`question_id`, `tag_id`)
);

CREATE TABLE IF NOT EXISTS `quiz_answer_choices` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `question_id` int NOT NULL,
  `choice_text` text,
  `choice_html` text,
  `choice_media_type` enum('none','image','video') DEFAULT 'none',
  `media_url` varchar(1024),
  `media_alt` varchar(255),
  `is_correct` boolean NOT NULL DEFAULT false,
  `sort_order` int NOT NULL DEFAULT 0,
  `match_pair_id` varchar(50),
  `match_side` enum('left','right'),
  `feedback_text` text,
  `feedback_media_url` varchar(1024)
);

CREATE TABLE IF NOT EXISTS `quizzes` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `org_id` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `cover_image_url` varchar(1024),
  `time_limit_seconds` int,
  `max_attempts` int,
  `pass_score_percent` int NOT NULL DEFAULT 70,
  `randomize_questions` boolean NOT NULL DEFAULT false,
  `randomize_answers` boolean NOT NULL DEFAULT false,
  `feedback_mode` enum('immediate','end','never') NOT NULL DEFAULT 'end',
  `show_correct_answers` boolean NOT NULL DEFAULT true,
  `show_explanations` boolean NOT NULL DEFAULT true,
  `allow_partial_credit` boolean NOT NULL DEFAULT true,
  `penalty_for_wrong` boolean NOT NULL DEFAULT false,
  `quiz_status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
  `theme_config` json,
  `price_amount_cents` int DEFAULT 0,
  `currency` varchar(8) DEFAULT 'usd',
  `stripe_product_id` varchar(255),
  `stripe_price_id` varchar(255),
  `created_at` timestamp DEFAULT (now()) NOT NULL,
  `updated_at` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP NOT NULL
);

CREATE TABLE IF NOT EXISTS `quiz_question_pools` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `quiz_id` int NOT NULL,
  `bank_id` int NOT NULL,
  `tag_id` int,
  `draw_count` int NOT NULL,
  `sort_order` int NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS `quiz_question_overrides` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `quiz_id` int NOT NULL,
  `question_id` int NOT NULL,
  `sort_order` int NOT NULL DEFAULT 0,
  `always_include` boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS `quiz_attempts` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `quiz_id` int NOT NULL,
  `user_id` int,
  `guest_email` varchar(255),
  `attempt_number` int NOT NULL DEFAULT 1,
  `attempt_status` enum('in_progress','completed','abandoned','timed_out') NOT NULL DEFAULT 'in_progress',
  `question_snapshot` json,
  `total_points` int NOT NULL DEFAULT 0,
  `earned_points` int NOT NULL DEFAULT 0,
  `score_percent` decimal(5,2),
  `passed` boolean,
  `started_at` timestamp DEFAULT (now()) NOT NULL,
  `completed_at` timestamp,
  `time_spent_seconds` int,
  `source_type` enum('standalone','lesson','funnel','landing_page') DEFAULT 'standalone',
  `source_lesson_id` int,
  `source_funnel_page_id` int
);

CREATE TABLE IF NOT EXISTS `quiz_attempt_responses` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `attempt_id` int NOT NULL,
  `question_id` int NOT NULL,
  `question_type` varchar(30) NOT NULL,
  `selected_choice_ids` json,
  `hotspot_click_x` decimal(6,2),
  `hotspot_click_y` decimal(6,2),
  `text_answer` text,
  `numeric_answer` decimal(15,4),
  `is_correct` boolean,
  `is_partially_correct` boolean DEFAULT false,
  `points_earned` int NOT NULL DEFAULT 0,
  `time_spent_seconds` int,
  `answered_at` timestamp DEFAULT (now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS `quiz_import_jobs` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `org_id` int NOT NULL,
  `bank_id` int,
  `imported_by_id` int NOT NULL,
  `import_source` enum('scorm','csv','xls') NOT NULL,
  `filename` varchar(255) NOT NULL,
  `file_url` varchar(1024),
  `import_status` enum('pending','parsing','preview_ready','importing','completed','failed') NOT NULL DEFAULT 'pending',
  `parsed_questions` json,
  `imported_count` int DEFAULT 0,
  `skipped_count` int DEFAULT 0,
  `error_log` json,
  `created_at` timestamp DEFAULT (now()) NOT NULL,
  `completed_at` timestamp
);

CREATE TABLE IF NOT EXISTS `quiz_access_grants` (
  `id` int AUTO_INCREMENT PRIMARY KEY,
  `quiz_id` int NOT NULL,
  `user_id` int NOT NULL,
  `granted_at` timestamp DEFAULT (now()) NOT NULL,
  `expires_at` timestamp,
  `grant_source` enum('purchase','manual','org_member','course_enrollment') DEFAULT 'manual',
  `stripe_payment_intent_id` varchar(255)
);
