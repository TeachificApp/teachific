ALTER TABLE `lms_courses` ADD `enrollment_closed` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `cmeDriveClientId` varchar(512);--> statement-breakpoint
ALTER TABLE `organizations` ADD `cmeDriveClientSecret` varchar(512);--> statement-breakpoint
ALTER TABLE `organizations` ADD `cmeDriveRefreshToken` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `cmeDriveAccessToken` text;--> statement-breakpoint
ALTER TABLE `organizations` ADD `cmeDriveTokenExpiresAt` bigint;--> statement-breakpoint
ALTER TABLE `organizations` ADD `cmeDriveFolderId` varchar(255);--> statement-breakpoint
ALTER TABLE `organizations` ADD `cmeDriveFolderName` varchar(255);--> statement-breakpoint
ALTER TABLE `organizations` ADD `cmeDriveEnabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `webinars` ADD `enrollment_closed` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `workshops` ADD `enrollment_closed` boolean DEFAULT false NOT NULL;