CREATE TABLE `question_bank_folders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`parentId` int,
	`name` varchar(255) NOT NULL,
	`description` text,
	`color` varchar(32),
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `question_bank_folders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `question_bank_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`folderId` int,
	`questionType` enum('mcq','tf','short_answer','long_answer','matching','multiple_select','image_choice','hotspot','ordering','fill_blank','numeric','rating_scale') NOT NULL DEFAULT 'mcq',
	`stem` text NOT NULL,
	`dataJson` longtext NOT NULL,
	`points` float NOT NULL DEFAULT 1,
	`difficulty` enum('easy','medium','hard') DEFAULT 'medium',
	`tags` text,
	`explanation` text,
	`createdBy` int NOT NULL,
	`usageCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `question_bank_items_id` PRIMARY KEY(`id`)
);
