CREATE TABLE `content_availability` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int NOT NULL,
	`product_type` varchar(64) NOT NULL,
	`product_id` int NOT NULL,
	`status` enum('open','waitlist','presale','enrollment_closed') NOT NULL DEFAULT 'open',
	`presale_heading` varchar(255),
	`presale_body` text,
	`presale_media_url` text,
	`presale_cta_label` varchar(255),
	`presale_cta_url` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_availability_id` PRIMARY KEY(`id`),
	CONSTRAINT `content_availability_org_product_unique` UNIQUE(`org_id`,`product_type`,`product_id`)
);
--> statement-breakpoint
CREATE TABLE `content_waitlist_entries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int NOT NULL,
	`product_type` varchar(64) NOT NULL,
	`product_id` int NOT NULL,
	`parent_product_id` int,
	`user_id` int,
	`name` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`notified_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `content_waitlist_entries_id` PRIMARY KEY(`id`),
	CONSTRAINT `content_waitlist_org_product_email_unique` UNIQUE(`org_id`,`product_type`,`product_id`,`email`)
);
--> statement-breakpoint
CREATE INDEX `content_availability_org_status_idx` ON `content_availability` (`org_id`,`status`);--> statement-breakpoint
CREATE INDEX `content_waitlist_org_product_idx` ON `content_waitlist_entries` (`org_id`,`product_type`,`product_id`);