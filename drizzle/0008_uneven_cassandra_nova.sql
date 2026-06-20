ALTER TABLE `form_submissions` ADD `status` enum('pending','reviewed','approved','rejected') DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `form_submissions` ADD `scoreTotal` int;--> statement-breakpoint
ALTER TABLE `form_submissions` ADD `scoreMax` int;--> statement-breakpoint
ALTER TABLE `organizations` ADD `embedAllowedDomains` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `embedDefaultTheme` enum('light','dark','auto') DEFAULT 'auto' NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `embedAnalyticsEnabled` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `embedHideTeachificBranding` boolean DEFAULT false NOT NULL;