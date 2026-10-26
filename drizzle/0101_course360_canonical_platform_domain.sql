-- Canonical Course360 platform-domain migration.
-- Preserve all existing page and navigation records: rows move only when an
-- identical Course360 destination does not already exist.
UPDATE `site_pages` AS legacy
LEFT JOIN `site_pages` AS canonical
  ON canonical.`domain` = 'course360.app'
 AND canonical.`slug` = legacy.`slug`
SET legacy.`domain` = 'course360.app'
WHERE legacy.`domain` IN ('www.course360.app', 'teachific.app', 'www.teachific.app', 'app.teachific.app')
  AND canonical.`id` IS NULL;

UPDATE `site_nav_menus` AS legacy
LEFT JOIN `site_nav_menus` AS canonical
  ON canonical.`domain` = 'course360.app'
 AND canonical.`menu_key` = legacy.`menu_key`
SET legacy.`domain` = 'course360.app'
WHERE legacy.`domain` IN ('www.course360.app', 'teachific.app', 'www.teachific.app', 'app.teachific.app')
  AND canonical.`id` IS NULL;

-- New accreditation form templates now default to Course360. Existing values
-- are normalized without changing any form content or settings.
ALTER TABLE `accreditationFormTemplates`
  MODIFY COLUMN `hostDomain` varchar(255) DEFAULT 'course360.app';

UPDATE `accreditationFormTemplates`
SET `hostDomain` = 'course360.app'
WHERE `hostDomain` IN ('www.course360.app', 'teachific.app', 'www.teachific.app', 'app.teachific.app');
