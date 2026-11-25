-- Generated from isolated new Drizzle tables; reviewed additive-only migration.
-- Binary identity collation and InnoDB apply only to these new tables.
CREATE TABLE `course360_entitlement_sources` (
	`id` varchar(64) NOT NULL,
	`target_id` varchar(64) NOT NULL,
	`purchase_id` varchar(64) NOT NULL,
	`org_id` int NOT NULL,
	`user_id` int NOT NULL,
	`family` varchar(32) NOT NULL,
	`resource_id` int NOT NULL,
	`subscription_id` varchar(255),
	`canonical_values` text,
	`source` varchar(128) NOT NULL,
	`status` varchar(32) NOT NULL,
	`cutoff` timestamp,
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `course360_entitlement_sources_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
--> statement-breakpoint
CREATE TABLE `course360_entitlement_targets` (
	`id` varchar(64) NOT NULL,
	`org_id` int NOT NULL,
	`user_id` int NOT NULL,
	`family` varchar(32) NOT NULL,
	`resource_id` int NOT NULL,
	`canonical_id` int,
	`projection` text,
	CONSTRAINT `course360_entitlement_targets_id` PRIMARY KEY(`id`),
	CONSTRAINT `course360_target_identity_uq` UNIQUE(`org_id`,`user_id`,`family`,`resource_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
--> statement-breakpoint
CREATE TABLE `course360_recurring_bindings` (
	`id` varchar(64) NOT NULL,
	`purchase_id` varchar(64) NOT NULL,
	`org_id` int NOT NULL,
	`user_id` int NOT NULL,
	`content_type` varchar(32) NOT NULL,
	`content_id` int NOT NULL,
	`gateway` varchar(32) NOT NULL,
	`account_id` varchar(255) NOT NULL,
	`subscription_id` varchar(255) NOT NULL,
	`customer_id` varchar(255) NOT NULL,
	`livemode` int NOT NULL,
	`raw_status` varchar(64) NOT NULL,
	`period_end` timestamp,
	`cancel_at_period_end` int NOT NULL DEFAULT 0,
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `course360_recurring_bindings_id` PRIMARY KEY(`id`),
	CONSTRAINT `course360_recurring_account_sub_uq` UNIQUE(`account_id`,`subscription_id`,`livemode`),
	CONSTRAINT `course360_recurring_purchase_uq` UNIQUE(`purchase_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
--> statement-breakpoint
CREATE TABLE `course360_school_stripe_endpoints` (
	`id` varchar(64) NOT NULL,
	`org_id` int NOT NULL,
	`gateway` varchar(32) NOT NULL,
	`account_id` varchar(255) NOT NULL,
	`livemode` int NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	`signing_secret_ciphertext` text NOT NULL,
	`merchant_key_ciphertext` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `course360_school_stripe_endpoints_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
--> statement-breakpoint
CREATE TABLE `course360_builder_template_ownership` (
	`template_kind` varchar(32) NOT NULL,
	`template_id` int NOT NULL,
	`org_id` int NOT NULL,
	`saved_by_user_id` int NOT NULL,
	`source_course_id` int,
	`source_section_id` int,
	`evidence` varchar(255) NOT NULL,
	`verified_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `course360_builder_template_ownership_template_kind_template_id_pk` PRIMARY KEY(`template_kind`,`template_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
--> statement-breakpoint
CREATE INDEX `course360_source_purchase_target_idx` ON `course360_entitlement_sources` (`purchase_id`,`target_id`);--> statement-breakpoint
CREATE INDEX `course360_source_target_idx` ON `course360_entitlement_sources` (`target_id`);--> statement-breakpoint
CREATE INDEX `course360_school_endpoint_org_idx` ON `course360_school_stripe_endpoints` (`org_id`);--> statement-breakpoint
CREATE INDEX `course360_builder_template_org_idx` ON `course360_builder_template_ownership` (`org_id`,`template_kind`);