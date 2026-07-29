CREATE TABLE `lms_checkout_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`config` longtext NOT NULL,
	`created_by_user_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lms_checkout_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `question_bank_tag_map` (
	`id` int AUTO_INCREMENT NOT NULL,
	`question_id` int NOT NULL,
	`tag_id` int NOT NULL,
	CONSTRAINT `question_bank_tag_map_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `question_bank_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`color` varchar(32) NOT NULL DEFAULT '#179ca3',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `question_bank_tags_id` PRIMARY KEY(`id`),
	CONSTRAINT `question_bank_tags_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
ALTER TABLE `lms_certificates` MODIFY COLUMN `template_id` int;--> statement-breakpoint
ALTER TABLE `lms_quiz_questions` MODIFY COLUMN `type` enum('multiple_choice','true_false','short_answer','matching','hotspot') NOT NULL DEFAULT 'multiple_choice';--> statement-breakpoint
ALTER TABLE `lms_video_events` MODIFY COLUMN `event_type` enum('play','pause','seek','complete','progress') NOT NULL;--> statement-breakpoint
ALTER TABLE `digital_bundles` ADD `after_purchase_workflow` longtext;--> statement-breakpoint
ALTER TABLE `digital_bundles` ADD `hide_pricing_options` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `digital_products` ADD `after_purchase_workflow` longtext;--> statement-breakpoint
ALTER TABLE `digital_products` ADD `member_page_blocks_above` longtext;--> statement-breakpoint
ALTER TABLE `digital_products` ADD `member_page_blocks_below` longtext;--> statement-breakpoint
ALTER TABLE `digital_products` ADD `hide_pricing_options` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_certificates` ADD `user_id` int;--> statement-breakpoint
ALTER TABLE `lms_certificates` ADD `course_id` int;--> statement-breakpoint
ALTER TABLE `lms_certificates` ADD `certificate_url` text;--> statement-breakpoint
ALTER TABLE `lms_courses` ADD `credit_hours` varchar(16);--> statement-breakpoint
ALTER TABLE `lms_courses` ADD `certificate_title_override` varchar(512);--> statement-breakpoint
ALTER TABLE `lms_courses` ADD `completion_email_enabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_courses` ADD `completion_email_subject` varchar(512);--> statement-breakpoint
ALTER TABLE `lms_courses` ADD `completion_email_body` longtext;--> statement-breakpoint
ALTER TABLE `lms_courses` ADD `completion_redirect_url` varchar(1024);--> statement-breakpoint
ALTER TABLE `lms_courses` ADD `welcome_email_enabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_courses` ADD `welcome_email_subject` varchar(512);--> statement-breakpoint
ALTER TABLE `lms_courses` ADD `welcome_email_body` longtext;--> statement-breakpoint
ALTER TABLE `lms_courses` ADD `custom_thank_you_enabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_courses` ADD `custom_thank_you_blocks` longtext;--> statement-breakpoint
ALTER TABLE `lms_courses` ADD `post_purchase_redirect_url` varchar(1024);--> statement-breakpoint
ALTER TABLE `lms_courses` ADD `waitlist_enabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_courses` ADD `waitlist_heading` varchar(512);--> statement-breakpoint
ALTER TABLE `lms_courses` ADD `waitlist_body` longtext;--> statement-breakpoint
ALTER TABLE `lms_courses` ADD `waitlist_cta_label` varchar(255);--> statement-breakpoint
ALTER TABLE `lms_courses` ADD `waitlist_cta_url` varchar(1024);--> statement-breakpoint
ALTER TABLE `lms_courses` ADD `waitlist_redirect_url` varchar(1024);--> statement-breakpoint
ALTER TABLE `lms_courses` ADD `waitlist_success_message` longtext;--> statement-breakpoint
ALTER TABLE `lms_courses` ADD `upsell_enabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_courses` ADD `upsell_headline` varchar(512);--> statement-breakpoint
ALTER TABLE `lms_courses` ADD `upsell_description` longtext;--> statement-breakpoint
ALTER TABLE `lms_courses` ADD `upsell_course_id` int;--> statement-breakpoint
ALTER TABLE `lms_courses` ADD `upsell_product_id` int;--> statement-breakpoint
ALTER TABLE `lms_courses` ADD `upsell_product_type` varchar(64);--> statement-breakpoint
ALTER TABLE `lms_courses` ADD `hide_pricing_options` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_courses` ADD `player_sidebar_blocks` longtext;--> statement-breakpoint
ALTER TABLE `lms_courses` ADD `brand` varchar(128);--> statement-breakpoint
ALTER TABLE `lms_courses` ADD `checkout_page_config` longtext;--> statement-breakpoint
ALTER TABLE `lms_enrollments` ADD `source` varchar(128);--> statement-breakpoint
ALTER TABLE `lms_enrollments` ADD `stripe_subscription_id` varchar(256);--> statement-breakpoint
ALTER TABLE `lms_enrollments` ADD `access_expires_at` timestamp;--> statement-breakpoint
ALTER TABLE `lms_enrollments` ADD `affiliate_code` varchar(128);--> statement-breakpoint
ALTER TABLE `lms_enrollments` ADD `group_id` int;--> statement-breakpoint
ALTER TABLE `lms_enrollments` ADD `created_at` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_lesson_progress` ADD `quiz_score` int;--> statement-breakpoint
ALTER TABLE `lms_lesson_progress` ADD `quiz_passed` boolean;--> statement-breakpoint
ALTER TABLE `lms_lesson_progress` ADD `attempts` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_lessons` ADD `count_toward_completion` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_lessons` ADD `lesson_status` varchar(32) DEFAULT 'published' NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_lessons` ADD `show_video_controls` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_quiz_attempts` ADD `user_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_quiz_attempts` ADD `lesson_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_quiz_attempts` ADD `course_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_quiz_attempts` ADD `total_questions` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_quiz_attempts` ADD `correct_answers` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_quiz_attempts` ADD `time_taken_sec` int;--> statement-breakpoint
ALTER TABLE `lms_quiz_attempts` ADD `answers_json` longtext;--> statement-breakpoint
ALTER TABLE `lms_quiz_attempts` ADD `selected_question_ids` text;--> statement-breakpoint
ALTER TABLE `lms_quiz_attempts` ADD `created_at` timestamp DEFAULT (now()) NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_quiz_questions` ADD `options` longtext;--> statement-breakpoint
ALTER TABLE `lms_quiz_questions` ADD `correct_answer` text;--> statement-breakpoint
ALTER TABLE `lms_quiz_questions` ADD `correct_answers` longtext;--> statement-breakpoint
ALTER TABLE `lms_quiz_questions` ADD `question_image_url` varchar(1024);--> statement-breakpoint
ALTER TABLE `lms_quiz_questions` ADD `question_video_url` varchar(1024);--> statement-breakpoint
ALTER TABLE `lms_quiz_questions` ADD `feedback_image_url` varchar(1024);--> statement-breakpoint
ALTER TABLE `lms_quiz_questions` ADD `feedback_video_url` varchar(1024);--> statement-breakpoint
ALTER TABLE `lms_quiz_questions` ADD `hotspot_markers` longtext;--> statement-breakpoint
ALTER TABLE `lms_quiz_questions` ADD `matching_pairs` longtext;--> statement-breakpoint
ALTER TABLE `lms_quizzes` ADD `randomize_answers` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_quizzes` ADD `require_passing_to_progress` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_quizzes` ADD `allow_retakes` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_quizzes` ADD `show_correct_answers` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_quizzes` ADD `show_per_question_result` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_quizzes` ADD `show_only_percentage` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_quizzes` ADD `use_question_groups` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_quizzes` ADD `show_group_names` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_quizzes` ADD `question_bank_folder_id` int;--> statement-breakpoint
ALTER TABLE `lms_video_events` ADD `user_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_video_events` ADD `course_id` int NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_video_events` ADD `position_sec` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_video_events` ADD `duration_sec` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_video_events` ADD `percent_watched` int DEFAULT 0 NOT NULL;