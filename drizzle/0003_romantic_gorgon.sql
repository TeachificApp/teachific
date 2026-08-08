ALTER TABLE `lms_quiz_questions` MODIFY COLUMN `type` enum('multiple_choice','true_false','short_answer','matching','hotspot','image_comparison','drag_sort','branching','fill_blank','annotation','flashcard') NOT NULL DEFAULT 'multiple_choice';--> statement-breakpoint
ALTER TABLE `lms_quiz_questions` ADD `comparison_image_a` varchar(1024);--> statement-breakpoint
ALTER TABLE `lms_quiz_questions` ADD `comparison_image_b` varchar(1024);--> statement-breakpoint
ALTER TABLE `lms_quiz_questions` ADD `comparison_label_a` varchar(255);--> statement-breakpoint
ALTER TABLE `lms_quiz_questions` ADD `comparison_label_b` varchar(255);--> statement-breakpoint
ALTER TABLE `lms_quiz_questions` ADD `drag_items` longtext;--> statement-breakpoint
ALTER TABLE `lms_quiz_questions` ADD `branching_config` longtext;--> statement-breakpoint
ALTER TABLE `lms_quiz_questions` ADD `fill_blank_template` longtext;--> statement-breakpoint
ALTER TABLE `lms_quiz_questions` ADD `fill_blank_answers` longtext;--> statement-breakpoint
ALTER TABLE `lms_quiz_questions` ADD `annotation_image_url` varchar(1024);--> statement-breakpoint
ALTER TABLE `lms_quiz_questions` ADD `annotation_target_zones` longtext;--> statement-breakpoint
ALTER TABLE `lms_quiz_questions` ADD `flashcard_front` longtext;--> statement-breakpoint
ALTER TABLE `lms_quiz_questions` ADD `flashcard_back` longtext;