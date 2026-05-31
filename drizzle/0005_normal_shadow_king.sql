CREATE TABLE `instructor_payout_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`instructor_id` int NOT NULL,
	`payout_method` enum('stripe','bank_transfer','paypal') NOT NULL,
	`payout_details` text,
	`commission_percentage` decimal(5,2) NOT NULL DEFAULT '0.00',
	`total_earned` decimal(12,2) NOT NULL DEFAULT '0.00',
	`total_paid` decimal(12,2) NOT NULL DEFAULT '0.00',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `instructor_payout_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_affiliate_conversions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`affiliate_id` int NOT NULL,
	`course_id` int NOT NULL,
	`enrollment_id` int NOT NULL,
	`commission_amount` decimal(12,2) NOT NULL,
	`status` enum('pending','approved','paid') NOT NULL DEFAULT 'pending',
	`paid_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_affiliate_conversions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_certificate_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`template_html` longtext NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_certificate_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_certificates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`enrollment_id` int NOT NULL,
	`template_id` int NOT NULL,
	`certificate_number` varchar(64) NOT NULL,
	`issued_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_certificates_id` PRIMARY KEY(`id`),
	CONSTRAINT `lms_certificates_certificate_number_unique` UNIQUE(`certificate_number`)
);
--> statement-breakpoint
CREATE TABLE `lms_cohort_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`cohort_session_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` longtext,
	`due_date` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_cohort_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_cohort_group_enrollments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`cohort_group_id` int NOT NULL,
	`user_id` int NOT NULL,
	`enrolled_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_cohort_group_enrollments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_cohort_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`cohort_session_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_cohort_groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_cohort_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`cohort_session_id` int NOT NULL,
	`user_id` int NOT NULL,
	`message` longtext NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_cohort_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_cohort_recordings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`cohort_session_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`recording_url` text NOT NULL,
	`recorded_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_cohort_recordings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_cohort_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`course_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`start_date` timestamp NOT NULL,
	`end_date` timestamp NOT NULL,
	`status` enum('upcoming','active','completed') NOT NULL DEFAULT 'upcoming',
	`max_participants` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lms_cohort_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_cohort_staff` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`cohort_session_id` int NOT NULL,
	`user_id` int NOT NULL,
	`role` enum('instructor','ta','facilitator') NOT NULL DEFAULT 'instructor',
	`assigned_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_cohort_staff_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_cohort_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`assignment_id` int NOT NULL,
	`user_id` int NOT NULL,
	`submission_content` longtext,
	`submitted_at` timestamp NOT NULL DEFAULT (now()),
	`grade_received` decimal(5,2),
	`feedback` longtext,
	CONSTRAINT `lms_cohort_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_collection_courses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`collection_id` int NOT NULL,
	`course_id` int NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	CONSTRAINT `lms_collection_courses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_collections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` longtext,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_collections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_course_instructors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`course_id` int NOT NULL,
	`instructor_id` int NOT NULL,
	`role` enum('primary','secondary') NOT NULL DEFAULT 'primary',
	`assigned_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_course_instructors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_courses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`slug` varchar(255) NOT NULL,
	`title` varchar(255) NOT NULL,
	`subtitle` varchar(500),
	`description` longtext,
	`cover_image_url` text,
	`status` enum('draft','public','hidden','private','archived') NOT NULL DEFAULT 'draft',
	`type` enum('course','quiz','download','cohort') NOT NULL DEFAULT 'course',
	`enrollment_close_date` timestamp,
	`price` int NOT NULL DEFAULT 0,
	`is_free` boolean NOT NULL DEFAULT false,
	`bundle_only` boolean NOT NULL DEFAULT false,
	`currency` varchar(8) NOT NULL DEFAULT 'usd',
	`pricing_type` enum('free','one_time','subscription','payment_plan','trial_then_subscription') NOT NULL DEFAULT 'one_time',
	`subscription_interval` enum('monthly','quarterly','annual'),
	`trialDays` int,
	`accessDurationDays` int,
	`down_payment` int DEFAULT 0,
	`installment_count` int DEFAULT 0,
	`installment_amount` int DEFAULT 0,
	`installment_interval_days` int DEFAULT 30,
	`stripe_price_id` varchar(255),
	`meta_title` varchar(255),
	`meta_description` text,
	`meta_keywords` text,
	`has_certificate` boolean NOT NULL DEFAULT false,
	`certificate_template_id` int,
	`is_featured` boolean NOT NULL DEFAULT false,
	`is_drip` boolean NOT NULL DEFAULT false,
	`show_instructor` boolean NOT NULL DEFAULT false,
	`hide_progress` boolean NOT NULL DEFAULT false,
	`show_in_library` boolean NOT NULL DEFAULT true,
	`course_overview_top_blocks` longtext,
	`course_overview_blocks` longtext,
	`course_overview_bottom_blocks` longtext,
	`send_enrollment_email` boolean NOT NULL DEFAULT true,
	`primary_color` varchar(20) DEFAULT '#179ca3',
	`accent_color` varchar(20) DEFAULT '#0d9488',
	`gradient_from` varchar(20) DEFAULT '#179ca3',
	`gradient_to` varchar(20) DEFAULT '#0d9488',
	`gradient_direction` varchar(30) DEFAULT '135deg',
	`thumbnail_url` text,
	`custom_labels` longtext,
	`default_mark_complete` int NOT NULL DEFAULT 1,
	`player_theme` enum('light','dark') NOT NULL DEFAULT 'light',
	`allow_group_purchase` boolean NOT NULL DEFAULT true,
	`created_by_user_id` int NOT NULL,
	`library_order` int NOT NULL DEFAULT 0,
	`publish_domain` varchar(255),
	`customDomain` varchar(255),
	`customDomainVerified` boolean NOT NULL DEFAULT false,
	`customDomainVerificationToken` varchar(128),
	`customDomainVerificationStatus` enum('unverified','pending','verified') NOT NULL DEFAULT 'unverified',
	`multi_cohort_mode` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lms_courses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_enrollments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`user_id` int NOT NULL,
	`course_id` int NOT NULL,
	`status` enum('active','completed','cancelled','expired') NOT NULL DEFAULT 'active',
	`enrolled_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	`expires_at` timestamp,
	`progress_percent` decimal(5,2) NOT NULL DEFAULT '0.00',
	`last_accessed_at` timestamp,
	CONSTRAINT `lms_enrollments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_group_courses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`group_id` int NOT NULL,
	`course_id` int NOT NULL,
	CONSTRAINT `lms_group_courses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_group_seats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`group_id` int NOT NULL,
	`user_id` int NOT NULL,
	`assigned_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_group_seats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` longtext,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_instructors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`user_id` int NOT NULL,
	`bio` longtext,
	`profile_image_url` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_instructors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_lesson_bookmarks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`enrollment_id` int NOT NULL,
	`lesson_id` int NOT NULL,
	`bookmarked_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_lesson_bookmarks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_lesson_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`enrollment_id` int NOT NULL,
	`lesson_id` int NOT NULL,
	`note_content` longtext NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lms_lesson_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_lesson_progress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`enrollment_id` int NOT NULL,
	`lesson_id` int NOT NULL,
	`status` enum('not_started','in_progress','completed') NOT NULL DEFAULT 'not_started',
	`completed_at` timestamp,
	`watch_time_seconds` int NOT NULL DEFAULT 0,
	`last_accessed_at` timestamp,
	CONSTRAINT `lms_lesson_progress_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_lessons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`course_id` int,
	`section_id` int,
	`title` varchar(255) NOT NULL,
	`type` enum('video','text','quiz','download','embed','video_text') NOT NULL DEFAULT 'text',
	`content` longtext,
	`video_content` longtext,
	`embed_url` varchar(500),
	`media_asset_id` int,
	`position` int NOT NULL DEFAULT 0,
	`is_preview` boolean NOT NULL DEFAULT false,
	`preview_mode` enum('none','preview','preview_hide_after_purchase') NOT NULL DEFAULT 'none',
	`drip_days` int NOT NULL DEFAULT 0,
	`duration_minutes` int,
	`require_video_completion` int NOT NULL DEFAULT 0,
	`require_manual_complete` int,
	`effect_enabled` boolean DEFAULT false,
	`effect_trigger` varchar(20) DEFAULT 'lesson_start',
	`effect_banner_text` varchar(500),
	`effect_banner_bg_color` varchar(20),
	`effect_banner_text_color` varchar(20),
	`effect_sound` varchar(50),
	`effect_sound_url` varchar(500),
	`effect_confetti` boolean DEFAULT false,
	`effect_confetti_colors` varchar(500),
	`effect_confetti_mode` enum('fall','cannon') DEFAULT 'fall',
	`effect_banner_duration` int DEFAULT 5,
	`content_blocks` longtext,
	`learning_objectives` longtext,
	`show_instructor` enum('inherit','show','hide') NOT NULL DEFAULT 'inherit',
	`is_prerequisite` boolean NOT NULL DEFAULT false,
	`prerequisite_lesson_id` int,
	`meeting_link` varchar(1024),
	`live_start_at` bigint,
	`live_end_at` bigint,
	`comments_enabled` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lms_lessons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`user_id` int,
	`course_id` int NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'usd',
	`status` enum('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
	`stripe_payment_intent_id` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	CONSTRAINT `lms_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_quiz_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`enrollment_id` int NOT NULL,
	`quiz_id` int NOT NULL,
	`score` decimal(5,2) NOT NULL,
	`passed` boolean NOT NULL,
	`attempt_number` int NOT NULL DEFAULT 1,
	`completed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_quiz_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_quiz_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`quiz_id` int NOT NULL,
	`type` enum('multiple_choice','true_false','short_answer') NOT NULL DEFAULT 'multiple_choice',
	`question` longtext NOT NULL,
	`explanation` longtext,
	`position` int NOT NULL DEFAULT 0,
	`points` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_quiz_questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_quizzes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`course_id` int NOT NULL,
	`lesson_id` int,
	`title` varchar(255) NOT NULL,
	`description` text,
	`passing_score` int NOT NULL DEFAULT 70,
	`attempts_allowed` int NOT NULL DEFAULT 1,
	`show_answers` boolean NOT NULL DEFAULT true,
	`randomize_questions` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lms_quizzes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_sections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`course_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	`is_preview` boolean NOT NULL DEFAULT false,
	`drip_days` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_sections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_video_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`enrollment_id` int NOT NULL,
	`lesson_id` int NOT NULL,
	`event_type` enum('play','pause','seek','complete') NOT NULL,
	`event_data` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_video_events_id` PRIMARY KEY(`id`)
);
