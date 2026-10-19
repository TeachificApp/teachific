-- Additive support for lesson-flashcard reuse in the existing organization-scoped Question Bank.
-- Existing questions, answer data, folders, and tags are preserved unchanged.
ALTER TABLE `question_bank` MODIFY COLUMN `type` enum('mcq','truefalse','multiselect','hotspot','matching','flashcard') NOT NULL DEFAULT 'mcq';
--> statement-breakpoint
ALTER TABLE `question_bank` ADD `flashcard_front` longtext;
--> statement-breakpoint
ALTER TABLE `question_bank` ADD `flashcard_back` longtext;
--> statement-breakpoint
ALTER TABLE `question_bank` ADD `flashcard_hint` longtext;
--> statement-breakpoint
ALTER TABLE `question_bank` ADD `flashcard_back_image_url` text;
--> statement-breakpoint
ALTER TABLE `question_bank` ADD `source_lesson_id` int;
--> statement-breakpoint
ALTER TABLE `question_bank` ADD `source_block_id` varchar(128);
--> statement-breakpoint
ALTER TABLE `question_bank` ADD `source_card_index` int;
--> statement-breakpoint
CREATE INDEX `question_bank_lesson_flashcard_source_idx` ON `question_bank` (`org_id`,`source_lesson_id`,`source_block_id`,`source_card_index`);
