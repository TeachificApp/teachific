ALTER TABLE `quiz_bank_questions` ADD `shuffle_answer_options` boolean;--> statement-breakpoint
ALTER TABLE `quiz_bank_questions` ADD `lock_answer_order` boolean DEFAULT false NOT NULL;