ALTER TABLE `question_bank_tags` DROP INDEX `name`;--> statement-breakpoint
ALTER TABLE `question_bank_tags` ADD CONSTRAINT `question_bank_tags_org_name_unique` UNIQUE(`org_id`,`name`);
