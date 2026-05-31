CREATE TABLE `funnel_branch_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`page_id` int NOT NULL,
	`condition` varchar(500) NOT NULL,
	`target_page_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `funnel_branch_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `funnel_leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`page_id` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` varchar(255),
	`lead_data` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `funnel_leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `funnel_pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`type` enum('landing','sales','thank_you','checkout') NOT NULL,
	`content` longtext,
	`customDomain` varchar(255),
	`customDomainVerified` boolean NOT NULL DEFAULT false,
	`customDomainVerificationToken` varchar(128),
	`customDomainVerificationStatus` enum('unverified','pending','verified') NOT NULL DEFAULT 'unverified',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `funnel_pages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `funnel_purchases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`lead_id` int NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`status` enum('pending','completed','failed') NOT NULL DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `funnel_purchases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `general_form_branch_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`form_id` int NOT NULL,
	`condition` varchar(500) NOT NULL,
	`action` varchar(500) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `general_form_branch_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `general_form_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`section_id` int NOT NULL,
	`field_type` varchar(50) NOT NULL,
	`label` varchar(255) NOT NULL,
	`required` boolean NOT NULL DEFAULT false,
	`position` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `general_form_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `general_form_options` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`item_id` int NOT NULL,
	`option_label` varchar(255) NOT NULL,
	`option_value` varchar(255) NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `general_form_options_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `general_form_sections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`form_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `general_form_sections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `general_form_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`form_id` int NOT NULL,
	`submission_data` json NOT NULL,
	`submitted_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `general_form_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `general_form_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description` longtext,
	`customDomain` varchar(255),
	`customDomainVerified` boolean NOT NULL DEFAULT false,
	`customDomainVerificationToken` varchar(128),
	`customDomainVerificationStatus` enum('unverified','pending','verified') NOT NULL DEFAULT 'unverified',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `general_form_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `general_form_webhooks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`form_id` int NOT NULL,
	`webhook_url` text NOT NULL,
	`event` varchar(100) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `general_form_webhooks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media_access_grants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`rule_id` int NOT NULL,
	`user_id` int NOT NULL,
	`granted_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `media_access_grants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media_access_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`asset_id` int NOT NULL,
	`access_type` enum('public','private','restricted') NOT NULL DEFAULT 'private',
	`expires_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `media_access_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`folder_id` int,
	`filename` varchar(255) NOT NULL,
	`mime_type` varchar(100) NOT NULL,
	`size` bigint NOT NULL,
	`s3_key` varchar(500) NOT NULL,
	`s3_url` text NOT NULL,
	`uploaded_by` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `media_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media_folders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`parent_folder_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `media_folders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media_upload_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`uploaded_by` int NOT NULL,
	`status` enum('pending','completed','failed') NOT NULL DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	CONSTRAINT `media_upload_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`asset_id` int NOT NULL,
	`version_number` int NOT NULL,
	`s3_key` varchar(500) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `media_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media_view_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`asset_id` int NOT NULL,
	`viewed_by` int,
	`viewed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `media_view_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `membership_plan_access` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`plan_id` int NOT NULL,
	`resource_type` varchar(100) NOT NULL,
	`resource_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `membership_plan_access_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `membership_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` longtext,
	`price` decimal(12,2) NOT NULL,
	`billing_interval` enum('monthly','quarterly','annual') NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `membership_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `membership_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`user_id` int NOT NULL,
	`plan_id` int NOT NULL,
	`status` enum('active','paused','cancelled') NOT NULL DEFAULT 'active',
	`start_date` timestamp NOT NULL DEFAULT (now()),
	`end_date` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `membership_subscriptions_id` PRIMARY KEY(`id`)
);
