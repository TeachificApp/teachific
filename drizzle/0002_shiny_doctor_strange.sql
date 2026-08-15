CREATE TABLE `affiliate_org_access` (
	`id` int AUTO_INCREMENT NOT NULL,
	`affiliate_id` int NOT NULL,
	`org_id` int NOT NULL,
	`granted_by_admin_id` int,
	`granted_at` timestamp NOT NULL DEFAULT (now()),
	`revoked_at` timestamp,
	CONSTRAINT `affiliate_org_access_id` PRIMARY KEY(`id`)
);
