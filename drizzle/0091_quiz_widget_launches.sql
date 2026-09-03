CREATE TABLE `quiz_widget_launches` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `org_id` INT NOT NULL,
  `quiz_id` INT NOT NULL,
  `token_hash` VARCHAR(64) NOT NULL,
  `label` VARCHAR(120) NULL,
  `created_by_user_id` INT NOT NULL,
  `is_active` BOOLEAN NOT NULL DEFAULT TRUE,
  `expires_at` TIMESTAMP NOT NULL,
  `revoked_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `quiz_widget_launches_token_hash_unique` (`token_hash`),
  KEY `quiz_widget_launches_org_quiz_active_idx` (`org_id`, `quiz_id`, `is_active`, `expires_at`)
);
