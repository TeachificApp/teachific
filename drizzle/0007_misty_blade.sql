ALTER TABLE `email_campaigns` ADD `scheduledTimezone` varchar(64);--> statement-breakpoint
ALTER TABLE `organizations` ADD `timezone` varchar(64) DEFAULT 'UTC' NOT NULL;