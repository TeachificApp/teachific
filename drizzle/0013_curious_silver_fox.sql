CREATE TABLE `emailListSubscribers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`listId` int NOT NULL,
	`email` varchar(300) NOT NULL,
	`name` varchar(300),
	`userId` int,
	`source` varchar(100),
	`sourceId` varchar(100),
	`status` varchar(50) NOT NULL DEFAULT 'subscribed',
	`subscribedAt` timestamp NOT NULL DEFAULT (now()),
	`unsubscribedAt` timestamp,
	`metadata` text,
	CONSTRAINT `emailListSubscribers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `emailLists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`subscriberCount` int NOT NULL DEFAULT 0,
	`webhookToken` varchar(64),
	`orgId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `emailLists_id` PRIMARY KEY(`id`)
);
