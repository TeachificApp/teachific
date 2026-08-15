ALTER TABLE `payout_requests` ADD `org_id` int;
--> statement-breakpoint
UPDATE `payout_requests` AS pr
INNER JOIN (
  SELECT legacy.id, MIN(course_record.orgId) AS org_id
  FROM `payout_requests` AS legacy
  LEFT JOIN `affiliate_links` AS link_record ON link_record.affiliate_id = legacy.affiliate_id
  LEFT JOIN `lms_course_instructors` AS instructor_record ON instructor_record.instructor_id = legacy.instructor_user_id
  LEFT JOIN `lms_courses` AS course_record ON course_record.id = COALESCE(link_record.course_id, instructor_record.course_id)
  WHERE legacy.org_id IS NULL
  GROUP BY legacy.id
  HAVING COUNT(DISTINCT course_record.orgId) = 1
) AS trusted_org ON trusted_org.id = pr.id
SET pr.org_id = trusted_org.org_id;
-- Legacy rows with no single derivable organization remain NULL and are intentionally excluded
-- from organization-scoped payout administration rather than being assigned incorrectly.
