-- Preserve all existing groups and members while enabling expiry-bound, organization-owned invite links.
ALTER TABLE `groups`
  ADD COLUMN `inviteToken` varchar(96) NULL,
  ADD COLUMN `inviteExpiresAt` timestamp NULL;

CREATE INDEX `groups_invite_token_idx` ON `groups` (`inviteToken`);
