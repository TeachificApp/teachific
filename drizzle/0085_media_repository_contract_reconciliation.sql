-- Reconcile the active media repository write contract with the verified live
-- organization-owned media tables. All changes are additive.

ALTER TABLE `media_assets`
  ADD COLUMN IF NOT EXISTS `access` enum('public','private') NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS `tags` text,
  ADD COLUMN IF NOT EXISTS `createdByUserId` int,
  ADD COLUMN IF NOT EXISTS `thumbnailUrl` text,
  ADD COLUMN IF NOT EXISTS `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS `deletedAt` timestamp NULL;

UPDATE `media_assets`
SET `createdByUserId` = `uploadedBy`
WHERE `createdByUserId` IS NULL;

ALTER TABLE `media_versions`
  ADD COLUMN IF NOT EXISTS `s3Url` text,
  ADD COLUMN IF NOT EXISTS `fileName` varchar(255),
  ADD COLUMN IF NOT EXISTS `fileSize` bigint,
  ADD COLUMN IF NOT EXISTS `mimeType` varchar(100),
  ADD COLUMN IF NOT EXISTS `notes` text,
  ADD COLUMN IF NOT EXISTS `uploadedByUserId` int,
  ADD COLUMN IF NOT EXISTS `scormExtractionStatus` varchar(32),
  ADD COLUMN IF NOT EXISTS `scormExtractedPrefix` text,
  ADD COLUMN IF NOT EXISTS `scormLaunchFile` text,
  ADD COLUMN IF NOT EXISTS `scormExtractionError` text;

ALTER TABLE `media_view_events`
  ADD COLUMN IF NOT EXISTS `ipHash` varchar(128),
  ADD COLUMN IF NOT EXISTS `viewType` enum('embed','direct') NOT NULL DEFAULT 'direct',
  ADD COLUMN IF NOT EXISTS `referer` text;
