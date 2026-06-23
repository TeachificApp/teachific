CREATE TABLE `org_site_pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int NOT NULL,
	`slug` varchar(255) NOT NULL DEFAULT 'home',
	`title` varchar(255) NOT NULL DEFAULT 'Home',
	`blocks` json NOT NULL,
	`meta_title` varchar(255),
	`meta_description` text,
	`published_at` bigint,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `org_site_pages_id` PRIMARY KEY(`id`)
);
