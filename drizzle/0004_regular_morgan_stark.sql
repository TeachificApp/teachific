CREATE TABLE `teach_game_answers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`session_id` int NOT NULL,
	`participant_id` int NOT NULL,
	`question_id` int NOT NULL,
	`selected_answer` int NOT NULL DEFAULT -1,
	`is_correct` boolean NOT NULL DEFAULT false,
	`points_earned` int NOT NULL DEFAULT 0,
	`response_time_ms` int,
	`answered_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `teach_game_answers_id` PRIMARY KEY(`id`),
	CONSTRAINT `teach_game_answers_response_idx` UNIQUE(`session_id`,`participant_id`,`question_id`)
);
--> statement-breakpoint
CREATE TABLE `teach_game_participants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`session_id` int NOT NULL,
	`user_id` int,
	`display_name` varchar(100) NOT NULL,
	`avatar_seed` varchar(50),
	`total_score` int NOT NULL DEFAULT 0,
	`final_rank` int,
	`is_active` boolean NOT NULL DEFAULT true,
	`joined_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `teach_game_participants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teach_game_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`game_id` int NOT NULL,
	`question` longtext NOT NULL,
	`options` text NOT NULL,
	`correct_answer` int NOT NULL,
	`explanation` longtext,
	`media_url` text,
	`teach_game_media_type` enum('image','video','gif'),
	`time_limit_seconds` int,
	`points` int NOT NULL DEFAULT 100,
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teach_game_questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teach_game_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int NOT NULL,
	`game_id` int NOT NULL,
	`host_user_id` int NOT NULL,
	`join_code` varchar(10) NOT NULL,
	`teach_game_session_status` enum('lobby','active','paused','ended') NOT NULL DEFAULT 'lobby',
	`current_question_index` int,
	`question_started_at` timestamp,
	`allow_anonymous` boolean NOT NULL DEFAULT true,
	`show_leaderboard` boolean NOT NULL DEFAULT true,
	`game_snapshot` longtext NOT NULL,
	`participant_count` int NOT NULL DEFAULT 0,
	`started_at` timestamp,
	`ended_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `teach_game_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `teach_game_sessions_join_code_unique` UNIQUE(`join_code`)
);
--> statement-breakpoint
CREATE TABLE `teach_games` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int NOT NULL,
	`created_by_user_id` int NOT NULL,
	`title` varchar(300) NOT NULL,
	`description` text,
	`time_limit_seconds` int NOT NULL DEFAULT 20,
	`music_track` varchar(100),
	`theme` varchar(50) NOT NULL DEFAULT 'org',
	`cover_image_url` text,
	`category` varchar(120) NOT NULL DEFAULT 'General',
	`question_count` int NOT NULL DEFAULT 0,
	`teach_game_status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teach_games_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `teach_game_participants_session_score_idx` ON `teach_game_participants` (`session_id`,`total_score`);--> statement-breakpoint
CREATE INDEX `teach_game_questions_game_sort_idx` ON `teach_game_questions` (`game_id`,`sort_order`);--> statement-breakpoint
CREATE INDEX `teach_game_sessions_org_status_idx` ON `teach_game_sessions` (`org_id`,`teach_game_session_status`);--> statement-breakpoint
CREATE INDEX `teach_game_sessions_game_idx` ON `teach_game_sessions` (`game_id`);--> statement-breakpoint
CREATE INDEX `teach_games_org_updated_idx` ON `teach_games` (`org_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `teach_games_org_status_idx` ON `teach_games` (`org_id`,`teach_game_status`);