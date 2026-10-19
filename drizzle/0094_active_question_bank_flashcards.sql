-- Additive Course360 Question Bank support for reusable lesson flashcards.
-- Existing question rows remain unchanged.
ALTER TABLE `question_bank_items`
  MODIFY COLUMN `questionType` enum('mcq','tf','short_answer','long_answer','matching','multiple_select','image_choice','hotspot','ordering','fill_blank','numeric','rating_scale','flashcard') NOT NULL DEFAULT 'mcq',
  ADD COLUMN `flashcard_front` longtext,
  ADD COLUMN `flashcard_back` longtext,
  ADD COLUMN `flashcard_hint` longtext,
  ADD COLUMN `flashcard_back_image_url` text,
  ADD COLUMN `source_card_index` int;

CREATE INDEX `question_bank_items_flashcard_source_idx`
  ON `question_bank_items` (`orgId`, `source_lesson_id`, `source_block_id`, `source_card_index`);
