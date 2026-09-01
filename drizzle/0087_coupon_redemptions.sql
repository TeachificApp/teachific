CREATE TABLE IF NOT EXISTS `coupon_redemptions` (
  `id` int NOT NULL AUTO_INCREMENT,
  `orgId` int NOT NULL,
  `couponId` int NOT NULL,
  `stripeCheckoutSessionId` varchar(255) NOT NULL,
  `userId` int,
  `contentType` varchar(64) NOT NULL,
  `contentId` int NOT NULL,
  `redeemedAt` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `coupon_redemptions_session_unique` (`stripeCheckoutSessionId`),
  KEY `coupon_redemptions_coupon_idx` (`orgId`, `couponId`)
);
