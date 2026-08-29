ALTER TABLE `quiz_bank_questions` ADD `source_quiz_id` int;--> statement-breakpoint
ALTER TABLE `quiz_bank_questions` ADD `source_question_id` varchar(64);--> statement-breakpoint
ALTER TABLE `quiz_bank_questions` ADD `source_quiz_payload` json;--> statement-breakpoint
ALTER TABLE `quiz_bank_questions` ADD CONSTRAINT `quiz_bank_questions_source_unique` UNIQUE(`org_id`,`bank_id`,`source_quiz_id`,`source_question_id`);