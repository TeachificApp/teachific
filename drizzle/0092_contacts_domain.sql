-- Course360 organization-scoped contacts domain.
-- All records retain org_id so matching a shared email or phone in one school
-- never reveals or merges the contact at another school.

CREATE TABLE `contacts` (
  `id` int AUTO_INCREMENT NOT NULL,
  `org_id` int NOT NULL,
  `user_id` int,
  `first_name` varchar(128),
  `last_name` varchar(128),
  `display_name` varchar(255),
  `email` varchar(320),
  `email_normalized` varchar(320),
  `email_verified` boolean NOT NULL DEFAULT false,
  `phone` varchar(32),
  `phone_normalized` varchar(32),
  `phone_verified` boolean NOT NULL DEFAULT false,
  `lifecycle_stage` enum('lead','subscriber','learner','customer','inactive') NOT NULL DEFAULT 'lead',
  `source` varchar(100) NOT NULL DEFAULT 'manual',
  `source_detail` varchar(255),
  `attribution` json,
  `custom_fields` json,
  `deleted_at` timestamp,
  `anonymized_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `contacts_id` PRIMARY KEY(`id`),
  CONSTRAINT `contacts_org_email_normalized_unique` UNIQUE(`org_id`,`email_normalized`),
  CONSTRAINT `contacts_org_phone_normalized_unique` UNIQUE(`org_id`,`phone_normalized`)
);
--> statement-breakpoint
CREATE INDEX `contacts_org_lifecycle_idx` ON `contacts` (`org_id`,`lifecycle_stage`,`deleted_at`);
--> statement-breakpoint
CREATE INDEX `contacts_org_user_idx` ON `contacts` (`org_id`,`user_id`);
--> statement-breakpoint

CREATE TABLE `contact_tags` (
  `id` int AUTO_INCREMENT NOT NULL,
  `org_id` int NOT NULL,
  `name` varchar(100) NOT NULL,
  `color` varchar(20),
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `contact_tags_id` PRIMARY KEY(`id`),
  CONSTRAINT `contact_tags_org_name_unique` UNIQUE(`org_id`,`name`)
);
--> statement-breakpoint

CREATE TABLE `contact_tag_assignments` (
  `id` int AUTO_INCREMENT NOT NULL,
  `org_id` int NOT NULL,
  `contact_id` int NOT NULL,
  `tag_id` int NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `contact_tag_assignments_id` PRIMARY KEY(`id`),
  CONSTRAINT `contact_tag_assignments_contact_tag_unique` UNIQUE(`contact_id`,`tag_id`)
);
--> statement-breakpoint
CREATE INDEX `contact_tag_assignments_org_contact_idx` ON `contact_tag_assignments` (`org_id`,`contact_id`);
--> statement-breakpoint

CREATE TABLE `contact_custom_field_definitions` (
  `id` int AUTO_INCREMENT NOT NULL,
  `org_id` int NOT NULL,
  `field_key` varchar(100) NOT NULL,
  `label` varchar(150) NOT NULL,
  `field_type` enum('text','number','date','boolean','select','url') NOT NULL DEFAULT 'text',
  `options` json,
  `is_required` boolean NOT NULL DEFAULT false,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `contact_custom_field_definitions_id` PRIMARY KEY(`id`),
  CONSTRAINT `contact_custom_field_definitions_org_key_unique` UNIQUE(`org_id`,`field_key`)
);
--> statement-breakpoint

CREATE TABLE `contact_consents` (
  `id` int AUTO_INCREMENT NOT NULL,
  `org_id` int NOT NULL,
  `contact_id` int NOT NULL,
  `consent_type` enum('marketing_email','marketing_sms','terms','privacy','data_processing') NOT NULL,
  `status` enum('granted','withdrawn','pending') NOT NULL DEFAULT 'pending',
  `source` varchar(100) NOT NULL DEFAULT 'manual',
  `evidence` json,
  `granted_at` timestamp,
  `withdrawn_at` timestamp,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `contact_consents_id` PRIMARY KEY(`id`),
  CONSTRAINT `contact_consents_org_contact_type_unique` UNIQUE(`org_id`,`contact_id`,`consent_type`)
);
--> statement-breakpoint
CREATE INDEX `contact_consents_org_contact_idx` ON `contact_consents` (`org_id`,`contact_id`);
--> statement-breakpoint

CREATE TABLE `contact_activities` (
  `id` bigint AUTO_INCREMENT NOT NULL,
  `org_id` int NOT NULL,
  `contact_id` int NOT NULL,
  `actor_user_id` int,
  `activity_type` varchar(100) NOT NULL,
  `summary` varchar(500) NOT NULL,
  `metadata` json,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `contact_activities_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `contact_activities_org_contact_created_idx` ON `contact_activities` (`org_id`,`contact_id`,`created_at`);
--> statement-breakpoint

CREATE TABLE `contact_audit_events` (
  `id` bigint AUTO_INCREMENT NOT NULL,
  `org_id` int NOT NULL,
  `contact_id` int NOT NULL,
  `actor_user_id` int,
  `action` varchar(100) NOT NULL,
  `field_name` varchar(100),
  `previous_value` json,
  `next_value` json,
  `metadata` json,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `contact_audit_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `contact_audit_events_org_contact_created_idx` ON `contact_audit_events` (`org_id`,`contact_id`,`created_at`);
