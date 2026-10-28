-- Preserve existing subscriptions and organizations while making Stripe webhook
-- retries idempotent for checkout-first Course360 school-owner onboarding.
CREATE TABLE `platform_trial_signup_fulfillments` (
  `id` int AUTO_INCREMENT NOT NULL,
  `stripeCheckoutSessionId` varchar(255) NOT NULL,
  `stripeSubscriptionId` varchar(255),
  `userId` int,
  `orgId` int,
  `status` enum('processing','completed','failed') NOT NULL DEFAULT 'processing',
  `errorMessage` varchar(500),
  `createdAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updatedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT `platform_trial_signup_fulfillments_id` PRIMARY KEY(`id`),
  CONSTRAINT `platform_trial_signup_fulfillments_session_unique` UNIQUE(`stripeCheckoutSessionId`)
);
