CREATE TABLE `community_admin_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hubId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`bio` text,
	`avatarUrl` text,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `community_admin_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kajabi_integrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int NOT NULL,
	`api_key` text NOT NULL,
	`school_name` varchar(255),
	`status` varchar(50) NOT NULL DEFAULT 'active',
	`last_sync_at` bigint,
	`last_sync_stats` json,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `kajabi_integrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teachable_integrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int NOT NULL,
	`api_key` varchar(512) NOT NULL,
	`school_name` varchar(255),
	`status` varchar(20) NOT NULL DEFAULT 'connected',
	`last_sync_at` timestamp,
	`last_sync_stats` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teachable_integrations_id` PRIMARY KEY(`id`),
	CONSTRAINT `teachable_integrations_org_id_unique` UNIQUE(`org_id`)
);
--> statement-breakpoint
CREATE TABLE `thinkific_integrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int NOT NULL,
	`subdomain` varchar(255) NOT NULL,
	`api_key` varchar(512) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'connected',
	`last_sync_at` timestamp,
	`last_sync_stats` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `thinkific_integrations_id` PRIMARY KEY(`id`),
	CONSTRAINT `thinkific_integrations_org_id_unique` UNIQUE(`org_id`)
);
--> statement-breakpoint
CREATE TABLE `workshop_registrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workshop_id` int NOT NULL,
	`user_id` int,
	`first_name` varchar(100),
	`last_name` varchar(100),
	`email` varchar(255) NOT NULL,
	`phone` varchar(50),
	`status` varchar(20) NOT NULL DEFAULT 'registered',
	`amount_paid` decimal(10,2) DEFAULT '0.00',
	`currency` varchar(10) DEFAULT 'usd',
	`stripe_session_id` varchar(255),
	`stripe_payment_intent_id` varchar(255),
	`check_in_at` timestamp,
	`notes` text,
	`registered_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workshop_registrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workshops` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description` text,
	`short_description` varchar(500),
	`cover_image_url` varchar(1024),
	`status` varchar(20) NOT NULL DEFAULT 'draft',
	`format` varchar(20) NOT NULL DEFAULT 'in_person',
	`location` varchar(255),
	`virtual_url` varchar(1024),
	`start_date` timestamp,
	`end_date` timestamp,
	`timezone` varchar(100) DEFAULT 'UTC',
	`max_attendees` int,
	`price` decimal(10,2) NOT NULL DEFAULT '0.00',
	`compare_at_price` decimal(10,2),
	`currency` varchar(10) NOT NULL DEFAULT 'usd',
	`is_free` boolean NOT NULL DEFAULT false,
	`stripe_product_id` varchar(255),
	`stripe_price_id` varchar(255),
	`checkout_slug` varchar(255),
	`landing_page_blocks` json,
	`checkout_page_blocks` json,
	`thank_you_page_blocks` json,
	`instructor_name` varchar(255),
	`instructor_bio` text,
	`instructor_image_url` varchar(1024),
	`tags` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workshops_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `zapier_webhook_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`webhook_id` int NOT NULL,
	`org_id` int NOT NULL,
	`event_type` varchar(100) NOT NULL,
	`payload` text,
	`response_status` int,
	`response_body` text,
	`success` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `zapier_webhook_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `zapier_webhooks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`webhook_url` text NOT NULL,
	`secret` varchar(128),
	`event_type` varchar(100) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`last_triggered_at` timestamp,
	`last_status` varchar(20),
	`trigger_count` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `zapier_webhooks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `community_members` ADD `status` enum('pending','approved','rejected') DEFAULT 'approved' NOT NULL;--> statement-breakpoint
ALTER TABLE `form_fields` ADD `scaleMin` int;--> statement-breakpoint
ALTER TABLE `form_fields` ADD `scaleMax` int;--> statement-breakpoint
ALTER TABLE `form_fields` ADD `scaleMinLabel` varchar(100);--> statement-breakpoint
ALTER TABLE `form_fields` ADD `scaleMaxLabel` varchar(100);--> statement-breakpoint
ALTER TABLE `form_fields` ADD `richTextContent` text;--> statement-breakpoint
ALTER TABLE `form_fields` ADD `emailRoutingRules` text;--> statement-breakpoint
ALTER TABLE `form_fields` ADD `scoreWeight` int DEFAULT 0;