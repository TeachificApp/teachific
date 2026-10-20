CREATE TABLE `email_workflows` (
  `id` int NOT NULL AUTO_INCREMENT,
  `org_id` int NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` varchar(1000),
  `trigger_type` enum('form_submitted','lesson_completed','course_completed','course_enrolled','purchase_completed','campaign_opened','campaign_clicked') NOT NULL,
  `trigger_resource_id` int,
  `condition_field` varchar(128),
  `condition_operator` enum('equals','not_equals','contains','is_set'),
  `condition_value` varchar(1000),
  `is_active` boolean NOT NULL DEFAULT false,
  `created_by_user_id` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `email_workflows_org_trigger_idx` (`org_id`,`trigger_type`,`is_active`)
);
--> statement-breakpoint
CREATE TABLE `email_workflow_steps` (
  `id` int NOT NULL AUTO_INCREMENT,
  `workflow_id` int NOT NULL,
  `org_id` int NOT NULL,
  `position` int NOT NULL,
  `delay_minutes` int NOT NULL DEFAULT 0,
  `subject` varchar(500) NOT NULL,
  `html_body` longtext NOT NULL,
  `preview_text` varchar(300),
  `sender_profile_id` int,
  `is_active` boolean NOT NULL DEFAULT true,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email_workflow_steps_workflow_position_unique` (`workflow_id`,`position`),
  KEY `email_workflow_steps_org_workflow_idx` (`org_id`,`workflow_id`)
);
--> statement-breakpoint
CREATE TABLE `email_workflow_events` (
  `id` int NOT NULL AUTO_INCREMENT,
  `org_id` int NOT NULL,
  `event_type` varchar(64) NOT NULL,
  `source_type` varchar(64) NOT NULL,
  `source_id` int NOT NULL,
  `recipient_email` varchar(320) NOT NULL,
  `recipient_name` varchar(255),
  `recipient_user_id` int,
  `payload` json,
  `idempotency_key` varchar(255) NOT NULL,
  `occurred_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email_workflow_events_org_key_unique` (`org_id`,`idempotency_key`),
  KEY `email_workflow_events_org_type_idx` (`org_id`,`event_type`,`created_at`)
);
--> statement-breakpoint
CREATE TABLE `email_workflow_executions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `org_id` int NOT NULL,
  `workflow_id` int NOT NULL,
  `workflow_step_id` int NOT NULL,
  `event_id` int NOT NULL,
  `recipient_email` varchar(320) NOT NULL,
  `recipient_name` varchar(255),
  `recipient_user_id` int,
  `status` enum('pending','scheduled','sending','sent','skipped','failed','cancelled') NOT NULL DEFAULT 'pending',
  `due_at` timestamp NOT NULL,
  `schedule_cron_task_uid` varchar(65),
  `attempts` int NOT NULL DEFAULT 0,
  `error_message` text,
  `sent_at` timestamp,
  `completed_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email_workflow_executions_event_step_unique` (`event_id`,`workflow_step_id`),
  KEY `email_workflow_executions_org_status_idx` (`org_id`,`workflow_id`,`status`,`due_at`),
  KEY `email_workflow_executions_cron_task_idx` (`schedule_cron_task_uid`)
);
