ALTER TABLE `accreditationFormTemplates`
  ADD COLUMN IF NOT EXISTS `hostDomain` varchar(255) DEFAULT 'teachific.app';--> statement-breakpoint

ALTER TABLE `accreditationFormTemplates`
  MODIFY COLUMN `hostDomain` varchar(255) DEFAULT 'teachific.app';
