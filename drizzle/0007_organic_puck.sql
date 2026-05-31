ALTER TABLE `funnel_purchases` MODIFY COLUMN `lead_id` int;--> statement-breakpoint
ALTER TABLE `funnel_purchases` MODIFY COLUMN `status` enum('pending','paid','completed','failed','refunded') NOT NULL DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE `funnel_purchases` ADD `user_id` int;--> statement-breakpoint
ALTER TABLE `funnel_purchases` ADD `email` varchar(320) NOT NULL;--> statement-breakpoint
ALTER TABLE `funnel_purchases` ADD `name` varchar(255);--> statement-breakpoint
ALTER TABLE `funnel_purchases` ADD `phone` varchar(20);--> statement-breakpoint
ALTER TABLE `funnel_purchases` ADD `product_name` varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE `funnel_purchases` ADD `product_type` enum('course','download','quiz','physical','membership','bundle','other') DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE `funnel_purchases` ADD `product_id` int;--> statement-breakpoint
ALTER TABLE `funnel_purchases` ADD `currency` varchar(10) DEFAULT 'USD' NOT NULL;--> statement-breakpoint
ALTER TABLE `funnel_purchases` ADD `order_bumps` longtext;--> statement-breakpoint
ALTER TABLE `funnel_purchases` ADD `stripe_payment_intent_id` varchar(255);--> statement-breakpoint
ALTER TABLE `funnel_purchases` ADD `stripe_session_id` varchar(255);--> statement-breakpoint
ALTER TABLE `funnel_purchases` ADD `source_type` enum('funnel','landing_page','product_page','lms_lesson','email','other') DEFAULT 'other' NOT NULL;--> statement-breakpoint
ALTER TABLE `funnel_purchases` ADD `source_funnel_id` int;--> statement-breakpoint
ALTER TABLE `funnel_purchases` ADD `source_funnel_page_id` int;--> statement-breakpoint
ALTER TABLE `funnel_purchases` ADD `source_landing_page_id` int;--> statement-breakpoint
ALTER TABLE `funnel_purchases` ADD `source_lms_lesson_id` int;--> statement-breakpoint
ALTER TABLE `funnel_purchases` ADD `fulfillment_course_id` int;--> statement-breakpoint
ALTER TABLE `funnel_purchases` ADD `fulfillment_download_id` int;--> statement-breakpoint
ALTER TABLE `funnel_purchases` ADD `fulfillment_quiz_id` int;--> statement-breakpoint
ALTER TABLE `funnel_purchases` ADD `fulfillment_membership_id` int;--> statement-breakpoint
ALTER TABLE `funnel_purchases` ADD `shipping_name` varchar(255);--> statement-breakpoint
ALTER TABLE `funnel_purchases` ADD `shipping_line1` varchar(255);--> statement-breakpoint
ALTER TABLE `funnel_purchases` ADD `shipping_line2` varchar(255);--> statement-breakpoint
ALTER TABLE `funnel_purchases` ADD `shipping_city` varchar(100);--> statement-breakpoint
ALTER TABLE `funnel_purchases` ADD `shipping_state` varchar(100);--> statement-breakpoint
ALTER TABLE `funnel_purchases` ADD `shipping_postal_code` varchar(20);--> statement-breakpoint
ALTER TABLE `funnel_purchases` ADD `shipping_country` varchar(10);--> statement-breakpoint
ALTER TABLE `funnel_purchases` ADD `promo_code` varchar(100);--> statement-breakpoint
ALTER TABLE `funnel_purchases` ADD `discount_applied` decimal(12,2);--> statement-breakpoint
ALTER TABLE `funnel_purchases` ADD `updated_at` timestamp DEFAULT (now()) NOT NULL ON UPDATE CURRENT_TIMESTAMP;