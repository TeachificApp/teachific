ALTER TABLE `lms_groups` ADD `seats` int DEFAULT 10;--> statement-breakpoint
ALTER TABLE `lms_groups` ADD `manager_id` int;--> statement-breakpoint
ALTER TABLE `lms_groups` ADD `manager_email` varchar(255);--> statement-breakpoint
ALTER TABLE `lms_groups` ADD `manager_phone` varchar(50);--> statement-breakpoint
ALTER TABLE `lms_groups` ADD `notes` longtext;--> statement-breakpoint
ALTER TABLE `lms_groups` ADD `invite_token` varchar(100);