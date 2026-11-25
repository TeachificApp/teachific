-- Additive repair tables only. No existing content, purchases, grants or configuration is modified.
CREATE TABLE IF NOT EXISTS course360_hosted_checkout_purchases (
  id varchar(64) NOT NULL PRIMARY KEY,
  org_id int NOT NULL,
  user_id int NOT NULL,
  content_type varchar(32) NOT NULL,
  content_id int NOT NULL,
  content_slug varchar(255) NOT NULL,
  gateway varchar(32) NOT NULL,
  account_id varchar(255) NOT NULL,
  stripe_session_id varchar(255) NULL,
  stripe_subscription_id varchar(255) NULL,
  stripe_payment_intent_id varchar(255) NULL,
  pricing_option_id int NULL,
  pricing_type varchar(32) NOT NULL,
  unit_price decimal(12,2) NOT NULL,
  seats int NOT NULL,
  currency varchar(8) NOT NULL,
  trial_days int NOT NULL DEFAULT 0,
  zero_payment_eligible int NOT NULL DEFAULT 0,
  selected_bump_ids text NULL,
  amount decimal(12,2) NULL,
  status varchar(32) NOT NULL DEFAULT 'pending',
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at timestamp NULL,
  UNIQUE KEY course360_hosted_account_session_uq (gateway, account_id, stripe_session_id)
);
CREATE TABLE IF NOT EXISTS embedded_checkout_snapshots (
  purchase_id int NOT NULL PRIMARY KEY,
  org_id int NOT NULL,
  manifest longtext NOT NULL,
  created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY embedded_snapshot_org (org_id, purchase_id)
);
CREATE TABLE IF NOT EXISTS funnel360_draft_requests (
  orgId int NOT NULL,
  requestId varchar(36) NOT NULL,
  actorId int NOT NULL,
  payloadHash varchar(64) NOT NULL,
  funnelId int NULL,
  pageIdsJson text NULL,
  createdAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (orgId, requestId)
);
CREATE TABLE IF NOT EXISTS funnel360_page_learn_settings (
  orgId int NOT NULL,
  pageId int NOT NULL,
  seoKeywords varchar(1000) NULL,
  displayName varchar(255) NULL,
  showInLibrary boolean NOT NULL DEFAULT false,
  updatedAt timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (orgId, pageId)
);
