CREATE TABLE `ip_access_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`ip_address` varchar(45) NOT NULL,
	`user_agent` text,
	`content_type` enum('course','download','paid_content') NOT NULL,
	`content_id` int,
	`accessed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ip_access_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sharing_abuse_flags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`status` enum('flagged','confirmed','dismissed','warned') NOT NULL DEFAULT 'flagged',
	`distinct_ip_count` int NOT NULL DEFAULT 0,
	`ip_addresses` longtext,
	`detection_reason` text,
	`alert_sent_at` timestamp,
	`reviewed_at` timestamp,
	`reviewed_by` int,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sharing_abuse_flags_id` PRIMARY KEY(`id`)
);
