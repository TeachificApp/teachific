CREATE TABLE `blockTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`blockType` varchar(80) NOT NULL,
	`blockData` longtext NOT NULL,
	`tags` varchar(500),
	`orgId` int,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `blockTemplates_id` PRIMARY KEY(`id`)
);
