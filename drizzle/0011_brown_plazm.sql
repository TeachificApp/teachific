CREATE TABLE `lms_page_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`template_type` enum('page','block') NOT NULL DEFAULT 'page',
	`block_type` varchar(64),
	`blocks` longtext NOT NULL,
	`thumbnail_url` text,
	`org_id` int,
	`created_by` int,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `lms_page_templates_id` PRIMARY KEY(`id`)
);
