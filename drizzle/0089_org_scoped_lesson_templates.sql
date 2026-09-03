CREATE TABLE IF NOT EXISTS `lesson_templates` (
  `id` int AUTO_INCREMENT NOT NULL,
  `orgId` int NOT NULL,
  `title` varchar(255) NOT NULL,
  `lesson_type` varchar(64) NOT NULL DEFAULT 'video',
  `blocks` longtext,
  `cover_image` text,
  `tags` text,
  `created_by_admin_id` int,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `lesson_templates_id` PRIMARY KEY(`id`),
  KEY `lesson_templates_org_created_idx` (`orgId`, `created_at`)
);
