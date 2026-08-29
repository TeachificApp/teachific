ALTER TABLE `email_templates` ADD COLUMN IF NOT EXISTS `createdByUserId` int;--> statement-breakpoint
ALTER TABLE `email_templates` ADD COLUMN IF NOT EXISTS `blocksJson` longtext;--> statement-breakpoint
ALTER TABLE `email_templates` ADD COLUMN IF NOT EXISTS `previewText` varchar(300);--> statement-breakpoint

ALTER TABLE `email_campaigns` ADD COLUMN IF NOT EXISTS `blocksJson` longtext;--> statement-breakpoint
ALTER TABLE `email_campaigns` ADD COLUMN IF NOT EXISTS `previewText` varchar(300);--> statement-breakpoint
ALTER TABLE `email_campaigns` ADD COLUMN IF NOT EXISTS `audienceFilter` longtext;--> statement-breakpoint
ALTER TABLE `email_campaigns` ADD COLUMN IF NOT EXISTS `senderProfileId` int;--> statement-breakpoint
ALTER TABLE `email_campaigns` ADD COLUMN IF NOT EXISTS `fromName` varchar(200);--> statement-breakpoint
ALTER TABLE `email_campaigns` ADD COLUMN IF NOT EXISTS `fromEmail` varchar(300);--> statement-breakpoint
ALTER TABLE `email_campaigns` ADD COLUMN IF NOT EXISTS `headerTitle` varchar(300);--> statement-breakpoint
ALTER TABLE `email_campaigns` ADD COLUMN IF NOT EXISTS `headerSubtext` varchar(500);--> statement-breakpoint
ALTER TABLE `email_campaigns` ADD COLUMN IF NOT EXISTS `headerColor` varchar(20);--> statement-breakpoint
ALTER TABLE `email_campaigns` ADD COLUMN IF NOT EXISTS `headerEnabled` boolean NOT NULL DEFAULT true;--> statement-breakpoint
ALTER TABLE `email_campaigns` ADD COLUMN IF NOT EXISTS `errorMessage` text;--> statement-breakpoint
ALTER TABLE `email_campaigns` ADD COLUMN IF NOT EXISTS `sentByUserId` int;--> statement-breakpoint
ALTER TABLE `email_campaigns` ADD COLUMN IF NOT EXISTS `scheduleCronTaskUid` varchar(65);--> statement-breakpoint

ALTER TABLE `emailSenderProfiles` ADD COLUMN IF NOT EXISTS `orgId` int;--> statement-breakpoint
ALTER TABLE `leadCaptureWidgets` ADD COLUMN IF NOT EXISTS `orgId` int;--> statement-breakpoint

UPDATE `email_campaigns` SET `name` = COALESCE(NULLIF(`name`, ''), NULLIF(`subject`, ''), CONCAT('Campaign #', `id`));--> statement-breakpoint
UPDATE `email_campaigns` SET `audienceFilter` = '{}' WHERE `audienceFilter` IS NULL;--> statement-breakpoint
UPDATE `email_campaigns` SET `sentByUserId` = COALESCE(`sentByUserId`, `createdBy`) WHERE `sentByUserId` IS NULL;--> statement-breakpoint
UPDATE `email_campaigns` SET `headerEnabled` = true WHERE `headerEnabled` IS NULL;
