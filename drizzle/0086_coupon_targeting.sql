ALTER TABLE `coupons`
  ADD COLUMN IF NOT EXISTS `targetScope` enum('all','content_types','products') NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS `targetContentTypes` text NULL,
  ADD COLUMN IF NOT EXISTS `targetProducts` text NULL;
