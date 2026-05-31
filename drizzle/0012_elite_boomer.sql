CREATE TABLE `global_form_theme` (
	`id` int AUTO_INCREMENT NOT NULL,
	`theme_settings` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `global_form_theme_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `googleFormIntegrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`formId` int NOT NULL,
	`googleClientId` varchar(500),
	`googleClientSecret` varchar(500),
	`accessToken` text,
	`refreshToken` text,
	`tokenExpiresAt` bigint,
	`connectedEmail` varchar(255),
	`spreadsheetId` varchar(255),
	`spreadsheetName` varchar(500),
	`sheetTabName` varchar(255) DEFAULT 'Form Responses',
	`headersInitialised` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `googleFormIntegrations_id` PRIMARY KEY(`id`),
	CONSTRAINT `googleFormIntegrations_formId_unique` UNIQUE(`formId`)
);
--> statement-breakpoint
CREATE TABLE `lms_pricing_options` (
	`id` int AUTO_INCREMENT NOT NULL,
	`course_id` int NOT NULL,
	`label` varchar(255) NOT NULL,
	`sublabel` varchar(500),
	`pricing_type` enum('one_time','subscription','payment_plan','free') NOT NULL DEFAULT 'one_time',
	`price` int NOT NULL DEFAULT 0,
	`stripe_price_id` varchar(255),
	`subscription_interval` enum('monthly','quarterly','annual'),
	`down_payment` int DEFAULT 0,
	`installment_count` int DEFAULT 0,
	`installment_amount` int DEFAULT 0,
	`installment_interval_days` int DEFAULT 30,
	`cta_label` varchar(100),
	`cta_url` varchar(2048),
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lms_pricing_options_id` PRIMARY KEY(`id`)
);
