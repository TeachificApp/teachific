-- Existing default Course360 palettes should follow an organization's learner theme.
-- Distinct course palettes remain explicit overrides and are left untouched.
ALTER TABLE `lms_courses`
  ADD COLUMN `inherit_organization_theme` boolean NOT NULL DEFAULT true;

UPDATE `lms_courses`
SET `inherit_organization_theme` = false
WHERE NOT (
  `primary_color` <=> '#179ca3'
  AND `accent_color` <=> '#0d9488'
  AND `gradient_from` <=> '#179ca3'
  AND `gradient_to` <=> '#0d9488'
  AND `player_color` <=> '#00b4b4'
);
