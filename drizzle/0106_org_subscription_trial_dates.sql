-- Add exact Stripe trial dates for platform Members account reporting.
-- Existing billing periods, subscriptions, organizations and member data remain unchanged.
ALTER TABLE `org_subscriptions`
  ADD COLUMN `trialStartedAt` timestamp NULL,
  ADD COLUMN `trialEndsAt` timestamp NULL,
  ADD COLUMN `rawStripeStatus` varchar(64) NULL;
