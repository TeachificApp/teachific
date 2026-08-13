ALTER TABLE `lms_quiz_questions` ADD `shuffle_answer_options` boolean;--> statement-breakpoint
ALTER TABLE `lms_quiz_questions` ADD `lock_answer_order` boolean DEFAULT false NOT NULL;