-- Generated from isolated new Drizzle tables; reviewed additive-only migration.
-- Binary identity collation and InnoDB apply only to these new tables.
CREATE TABLE `course360_payment_app_subscriptions` (
	`id` varchar(36) NOT NULL,
	`account_id` varchar(64) NOT NULL,
	`livemode` boolean NOT NULL,
	`org_id` int NOT NULL,
	`user_id` int NOT NULL,
	`product` varchar(32) NOT NULL,
	`tier` varchar(16) NOT NULL,
	`subscription_id` varchar(255) NOT NULL,
	`customer_id` varchar(255) NOT NULL,
	`reservation_id` varchar(36) NOT NULL,
	`session_id` varchar(255) NOT NULL,
	`raw_status` varchar(32) NOT NULL,
	`current_period_start` timestamp,
	`current_period_end` timestamp,
	`trial_start` timestamp,
	`trial_end` timestamp,
	`cancel_at_period_end` boolean NOT NULL DEFAULT false,
	`updated_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `course360_payment_app_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `c360_app_subscription_uq` UNIQUE(`account_id`,`livemode`,`subscription_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
--> statement-breakpoint
CREATE TABLE `course360_payment_checkouts` (
	`id` varchar(36) NOT NULL,
	`slot_id` varchar(64) NOT NULL,
	`account_id` varchar(64) NOT NULL,
	`livemode` boolean NOT NULL,
	`org_id` int,
	`user_id` int,
	`product` varchar(32) NOT NULL,
	`selection` varchar(32) NOT NULL,
	`billing_interval` varchar(16) NOT NULL,
	`fingerprint` varchar(64) NOT NULL,
	`spec` longtext NOT NULL,
	`previous_subscription_id` varchar(255),
	`customer_id` varchar(255),
	`session_id` varchar(255),
	`subscription_id` varchar(255),
	`session_url` longtext,
	`state` varchar(24) NOT NULL DEFAULT 'reserved',
	`trial` boolean NOT NULL DEFAULT false,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	CONSTRAINT `course360_payment_checkouts_id` PRIMARY KEY(`id`),
	CONSTRAINT `c360_checkout_session_uq` UNIQUE(`account_id`,`livemode`,`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
--> statement-breakpoint
CREATE TABLE `course360_payment_inbox` (
	`id` varchar(64) NOT NULL,
	`account_id` varchar(64) NOT NULL,
	`livemode` boolean NOT NULL,
	`endpoint` varchar(64) NOT NULL,
	`event_id` varchar(255) NOT NULL,
	`event_type` varchar(255) NOT NULL,
	`object_id` varchar(255),
	`org_id` int,
	`payload` longtext NOT NULL,
	`payload_hash` varchar(64) NOT NULL,
	`state` varchar(24) NOT NULL DEFAULT 'pending',
	`claim_token` varchar(36),
	`lease_until` timestamp,
	`attempts` int NOT NULL DEFAULT 0,
	`last_error` longtext,
	`received_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	CONSTRAINT `course360_payment_inbox_id` PRIMARY KEY(`id`),
	CONSTRAINT `c360_inbox_event_uq` UNIQUE(`endpoint`,`account_id`,`livemode`,`event_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
--> statement-breakpoint
CREATE TABLE `course360_payment_locks` (
	`id` varchar(64) NOT NULL,
	`revision` int NOT NULL DEFAULT 0,
	CONSTRAINT `course360_payment_locks_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
--> statement-breakpoint
CREATE TABLE `course360_payment_manual_grants` (
	`id` varchar(36) NOT NULL,
	`org_id` int NOT NULL,
	`user_id` int NOT NULL,
	`product` varchar(32) NOT NULL,
	`tier` varchar(16) NOT NULL,
	`actor_id` int NOT NULL,
	`source` varchar(255) NOT NULL,
	`reason` longtext NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`expires_at` timestamp,
	`revoked_at` timestamp,
	CONSTRAINT `course360_payment_manual_grants_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
--> statement-breakpoint
CREATE TABLE `course360_payment_owner_claims` (
	`id` varchar(36) NOT NULL,
	`org_id` int NOT NULL,
	`user_id` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`session_id` varchar(255) NOT NULL,
	`subscription_id` varchar(255) NOT NULL,
	`state` varchar(24) NOT NULL DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`claimed_at` timestamp,
	CONSTRAINT `course360_payment_owner_claims_id` PRIMARY KEY(`id`),
	CONSTRAINT `c360_owner_session_uq` UNIQUE(`session_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
--> statement-breakpoint
CREATE TABLE `course360_payment_slots` (
	`id` varchar(64) NOT NULL,
	`reservation_id` varchar(36),
	`revision` int NOT NULL DEFAULT 0,
	CONSTRAINT `course360_payment_slots_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
--> statement-breakpoint
CREATE TABLE `course360_payment_trial_history` (
	`id` varchar(64) NOT NULL,
	`org_id` int,
	`user_id` int,
	`product` varchar(32) NOT NULL,
	`reservation_id` varchar(36) NOT NULL,
	`claimed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `course360_payment_trial_history_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
--> statement-breakpoint
CREATE INDEX `c360_app_school_idx` ON `course360_payment_app_subscriptions` (`org_id`,`user_id`,`product`);--> statement-breakpoint
CREATE INDEX `c360_checkout_slot_idx` ON `course360_payment_checkouts` (`slot_id`);--> statement-breakpoint
CREATE INDEX `c360_manual_school_idx` ON `course360_payment_manual_grants` (`org_id`,`user_id`,`product`);