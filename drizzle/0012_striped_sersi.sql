CREATE TABLE IF NOT EXISTS `quiz_bank_folders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int NOT NULL,
	`bank_id` int NOT NULL,
	`parent_id` int,
	`name` varchar(255) NOT NULL,
	`description` text,
	`color` varchar(32) DEFAULT '#24abbc',
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quiz_bank_folders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `quiz_bank_questions` ADD COLUMN IF NOT EXISTS `folder_id` int;
