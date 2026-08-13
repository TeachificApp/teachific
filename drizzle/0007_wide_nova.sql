ALTER TABLE `question_bank_items` ADD `source_lesson_id` int;--> statement-breakpoint
ALTER TABLE `question_bank_items` ADD `source_block_id` varchar(128);--> statement-breakpoint
ALTER TABLE `question_bank_items` ADD `source_question_index` int;--> statement-breakpoint
ALTER TABLE `question_bank_items` ADD `source_quiz_id` int;--> statement-breakpoint
ALTER TABLE `question_bank_items` ADD `source_quiz_question_id` int;--> statement-breakpoint
CREATE INDEX `question_bank_items_lesson_source_idx` ON `question_bank_items` (`orgId`,`source_lesson_id`,`source_block_id`,`source_question_index`);--> statement-breakpoint
CREATE INDEX `question_bank_items_quiz_source_idx` ON `question_bank_items` (`orgId`,`source_quiz_question_id`);