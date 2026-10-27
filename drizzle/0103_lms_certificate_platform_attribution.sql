-- Course360: retain platform attribution on existing certificate templates by default.
-- This migration is additive and does not alter existing template content.
ALTER TABLE `lms_certificate_templates`
  ADD COLUMN `show_platform_attribution` boolean NOT NULL DEFAULT true;
