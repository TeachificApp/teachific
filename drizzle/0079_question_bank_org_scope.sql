ALTER TABLE `question_bank` ADD COLUMN `org_id` int NOT NULL;
--> statement-breakpoint
ALTER TABLE `question_bank_tags` ADD COLUMN `org_id` int NOT NULL;
