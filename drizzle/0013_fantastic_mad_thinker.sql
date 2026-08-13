ALTER TABLE `bundles` ADD `enrollment_closed` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `digital_products` ADD `enrollment_closed` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `memberships` ADD `enrollment_closed` boolean DEFAULT false NOT NULL;
