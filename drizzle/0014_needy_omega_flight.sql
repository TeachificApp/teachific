CREATE TABLE `digital_download_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`product_id` int NOT NULL,
	`file_id` int NOT NULL,
	`downloaded_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `digital_download_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `digital_product_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`file_name` varchar(500) NOT NULL,
	`file_url` text NOT NULL,
	`file_key` varchar(500) NOT NULL,
	`file_size` int NOT NULL DEFAULT 0,
	`mime_type` varchar(100),
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `digital_product_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_archive` (
	`id` int AUTO_INCREMENT NOT NULL,
	`item_type` enum('course','quiz','download','product','bundle') NOT NULL,
	`original_id` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`snapshot` longtext NOT NULL,
	`deleted_by_user_id` int NOT NULL,
	`deleted_at` timestamp NOT NULL DEFAULT (now()),
	`purge_at` timestamp NOT NULL,
	CONSTRAINT `lms_archive_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sso_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(128) NOT NULL,
	`user_id` int NOT NULL,
	`used_at` timestamp,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sso_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `sso_tokens_token_unique` UNIQUE(`token`)
);
