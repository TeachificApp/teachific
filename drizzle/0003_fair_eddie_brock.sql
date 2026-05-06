CREATE TABLE `membership_content` (
	`id` int AUTO_INCREMENT NOT NULL,
	`membershipId` int NOT NULL,
	`contentType` enum('course','digital_product','community','webinar') NOT NULL,
	`contentId` int NOT NULL,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `membership_content_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `membership_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`membershipId` int NOT NULL,
	`userId` int NOT NULL,
	`status` enum('active','paused','cancelled','expired') NOT NULL DEFAULT 'active',
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	`cancelledAt` timestamp,
	`stripeSubscriptionId` varchar(255),
	CONSTRAINT `membership_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `membership_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`membershipId` int NOT NULL,
	`triggerType` enum('course_purchase','product_purchase','webinar_registration','tag_added','manual') NOT NULL,
	`triggerEntityId` int,
	`triggerTag` varchar(255),
	`action` enum('add_to_membership','remove_from_membership') NOT NULL DEFAULT 'add_to_membership',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `membership_rules_id` PRIMARY KEY(`id`)
);
