CREATE TABLE `brandMemberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`brand` varchar(32) NOT NULL,
	`tier` varchar(32) NOT NULL DEFAULT 'free',
	`status` varchar(32) NOT NULL DEFAULT 'active',
	`stripeCustomerId` varchar(128),
	`stripeSubscriptionId` varchar(128),
	`grantedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	`source` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brandMemberships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `digital_bundle_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bundle_id` int NOT NULL,
	`product_id` int NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `digital_bundle_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `digital_bundle_purchases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`bundle_id` int NOT NULL,
	`stripe_checkout_session_id` varchar(255),
	`purchased_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `digital_bundle_purchases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `digital_purchases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`product_id` int NOT NULL,
	`stripe_payment_intent_id` varchar(255),
	`stripe_checkout_session_id` varchar(255),
	`purchased_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `digital_purchases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `funnel_branch_conditions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`rule_id` int NOT NULL,
	`variable` enum('product_purchased','order_bump_selected','email_contains','email_domain','purchase_price','source_url','utm_source','utm_medium','utm_campaign','date_range','day_of_week','hour_of_day','country','device_type','custom_field') NOT NULL,
	`operator` enum('equals','not_equals','contains','not_contains','starts_with','ends_with','greater_than','less_than','between','in_list','not_in_list','is_set','is_not_set') NOT NULL,
	`value` varchar(1024) NOT NULL DEFAULT '',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `funnel_branch_conditions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `funnel_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`pages_json` longtext NOT NULL,
	`accent_color` varchar(20) DEFAULT '#0d9488',
	`bg_color` varchar(20) DEFAULT '#f8fafc',
	`logo_url` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `funnel_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `physical_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(255) NOT NULL,
	`title` varchar(255) NOT NULL,
	`subtitle` varchar(500),
	`description` longtext,
	`details` longtext,
	`thumbnail_url` text,
	`price` int NOT NULL DEFAULT 0,
	`compare_at_price` int,
	`is_free` boolean NOT NULL DEFAULT false,
	`currency` varchar(8) NOT NULL DEFAULT 'usd',
	`checkout_mode` enum('native','shopify','external') NOT NULL DEFAULT 'native',
	`shopify_product_url` text,
	`shopify_embed_code` longtext,
	`shopify_product_id` varchar(255),
	`external_checkout_url` text,
	`requires_shipping` boolean NOT NULL DEFAULT true,
	`shipping_countries` text,
	`status` enum('draft','published','hidden','private','archived') NOT NULL DEFAULT 'draft',
	`landing_headline` varchar(500),
	`landing_body` longtext,
	`landing_features` longtext,
	`landing_blocks` longtext,
	`org_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `physical_products_id` PRIMARY KEY(`id`),
	CONSTRAINT `physical_products_slug_unique` UNIQUE(`slug`)
);
