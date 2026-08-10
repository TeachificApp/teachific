ALTER TABLE `bundle_pricing_options` MODIFY COLUMN `price` decimal(10,2) NOT NULL DEFAULT '0';--> statement-breakpoint
ALTER TABLE `workshop_instances` MODIFY COLUMN `price` decimal(10,2);--> statement-breakpoint
ALTER TABLE `workshop_instances` MODIFY COLUMN `compare_at_price` decimal(10,2);--> statement-breakpoint
ALTER TABLE `workshop_pricing_options` MODIFY COLUMN `price` decimal(10,2) NOT NULL DEFAULT '0';--> statement-breakpoint
ALTER TABLE `workshop_pricing_options` MODIFY COLUMN `compare_at_price` decimal(10,2);