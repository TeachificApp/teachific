-- Additive only. Do not rewrite existing purchases or their order-bump JSON.
CREATE TABLE IF NOT EXISTS `embedded_checkout_snapshots` (
  `purchase_id` int NOT NULL,
  `org_id` int NOT NULL,
  `manifest` longtext NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`purchase_id`),
  KEY `embedded_snapshot_org` (`org_id`, `purchase_id`)
);
