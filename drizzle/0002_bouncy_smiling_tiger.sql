ALTER TABLE `lms_pricing_options` ADD `is_team_pricing` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `lms_pricing_options` ADD `min_seats` int DEFAULT 2;--> statement-breakpoint
ALTER TABLE `lms_pricing_options` ADD `max_seats` int DEFAULT 100;--> statement-breakpoint
ALTER TABLE `lms_pricing_options` ADD `per_seat_price` decimal(10,2);--> statement-breakpoint
ALTER TABLE `lms_pricing_options` ADD `team_stripe_price_id` varchar(255);--> statement-breakpoint
ALTER TABLE `order_bumps` ADD `pricing_option_id` int;