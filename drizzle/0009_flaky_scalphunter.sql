CREATE TABLE `digital_bundles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(255) NOT NULL,
	`title` varchar(255) NOT NULL,
	`subtitle` varchar(500),
	`description` longtext,
	`thumbnail_url` text,
	`original_price` int NOT NULL DEFAULT 0,
	`discount_price` int NOT NULL DEFAULT 0,
	`currency` varchar(8) NOT NULL DEFAULT 'usd',
	`status` enum('draft','published','hidden','private','archived') NOT NULL DEFAULT 'draft',
	`org_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `digital_bundles_id` PRIMARY KEY(`id`),
	CONSTRAINT `digital_bundles_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `lms_landing_pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`course_id` int NOT NULL,
	`hero_title` varchar(255),
	`hero_subtitle` text,
	`hero_image_url` text,
	`body_content` longtext,
	`cta_text` varchar(128) DEFAULT 'Enroll Now',
	`what_you_learn` longtext,
	`requirements` longtext,
	`is_custom` boolean NOT NULL DEFAULT false,
	`blocks` longtext,
	`seo_title` varchar(255),
	`seo_description` text,
	`seo_image` varchar(512),
	`publish_domain` varchar(255),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lms_landing_pages_id` PRIMARY KEY(`id`),
	CONSTRAINT `lms_landing_pages_course_id_unique` UNIQUE(`course_id`)
);
