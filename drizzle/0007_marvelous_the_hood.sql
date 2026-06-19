CREATE TABLE `course_announcements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int NOT NULL,
	`course_id` int NOT NULL,
	`author_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`body` longtext,
	`is_pinned` boolean DEFAULT false,
	`send_email` boolean DEFAULT false,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `course_announcements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `course_resources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int NOT NULL,
	`course_id` int NOT NULL,
	`lesson_id` int,
	`title` varchar(255) NOT NULL,
	`description` text,
	`file_url` varchar(2048),
	`file_key` varchar(1024),
	`file_name` varchar(255),
	`file_size` int,
	`mime_type` varchar(100),
	`external_url` varchar(2048),
	`resource_type` varchar(50) DEFAULT 'file',
	`sort_order` int DEFAULT 0,
	`created_at` bigint NOT NULL,
	CONSTRAINT `course_resources_id` PRIMARY KEY(`id`)
);
