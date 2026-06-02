CREATE TABLE `lms_checkout_page_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`header_config` longtext,
	`course_info_config` longtext,
	`trust_badges_config` longtext,
	`payment_form_config` longtext,
	`footer_config` longtext,
	`sections_order` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lms_checkout_page_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_checkout_pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int NOT NULL,
	`course_id` int,
	`content_type` enum('course','download','physical_product','webinar','membership','membership_plan') NOT NULL DEFAULT 'course',
	`content_id` int NOT NULL DEFAULT 0,
	`header_config` longtext,
	`course_info_config` longtext,
	`trust_badges_config` longtext,
	`payment_form_config` longtext,
	`footer_config` longtext,
	`sections_order` text,
	`primary_color` varchar(20),
	`accent_color` varchar(20),
	`bg_color` varchar(20),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lms_checkout_pages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `digital_product_prices` ADD `stripe_price_id` varchar(255);--> statement-breakpoint
ALTER TABLE `digital_product_prices` ADD `stripe_product_id` varchar(255);--> statement-breakpoint
ALTER TABLE `membership_plans` ADD `stripe_price_id` varchar(255);--> statement-breakpoint
ALTER TABLE `membership_plans` ADD `stripe_product_id` varchar(255);--> statement-breakpoint
ALTER TABLE `membership_plans` ADD `stripe_payment_link_url` varchar(2048);--> statement-breakpoint
ALTER TABLE `memberships` ADD `stripe_price_id` varchar(255);--> statement-breakpoint
ALTER TABLE `memberships` ADD `stripe_product_id` varchar(255);--> statement-breakpoint
ALTER TABLE `memberships` ADD `stripe_payment_link_url` varchar(2048);--> statement-breakpoint
ALTER TABLE `physical_products` ADD `stripe_price_id` varchar(255);--> statement-breakpoint
ALTER TABLE `physical_products` ADD `stripe_product_id` varchar(255);--> statement-breakpoint
ALTER TABLE `webinars` ADD `price` decimal(10,2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE `webinars` ADD `currency` varchar(8) DEFAULT 'usd';--> statement-breakpoint
ALTER TABLE `webinars` ADD `pricing_type` enum('free','one_time','subscription') DEFAULT 'free';--> statement-breakpoint
ALTER TABLE `webinars` ADD `stripe_price_id` varchar(255);--> statement-breakpoint
ALTER TABLE `webinars` ADD `stripe_product_id` varchar(255);--> statement-breakpoint
ALTER TABLE `webinars` ADD `stripe_payment_link_url` varchar(2048);