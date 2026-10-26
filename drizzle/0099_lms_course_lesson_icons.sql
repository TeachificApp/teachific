-- Keep existing course player navigation unchanged unless an organization administrator opts out.
ALTER TABLE `lms_courses`
  ADD COLUMN `show_lesson_icons` boolean NOT NULL DEFAULT true;
