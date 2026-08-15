CREATE TABLE `affiliate_org_access` (
	`id` int AUTO_INCREMENT NOT NULL,
	`affiliate_id` int NOT NULL,
	`org_id` int NOT NULL,
	`granted_by_admin_id` int,
	`granted_at` timestamp NOT NULL DEFAULT (now()),
	`revoked_at` timestamp,
	CONSTRAINT `affiliate_org_access_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
INSERT INTO `affiliate_org_access` (`affiliate_id`, `org_id`, `granted_by_admin_id`)
SELECT source.affiliate_id, source.org_id, NULL
FROM (
  SELECT access_record.affiliate_id, MIN(course_record.orgId) AS org_id
  FROM `affiliate_course_access` AS access_record
  INNER JOIN `lms_courses` AS course_record ON course_record.id = access_record.course_id
  WHERE access_record.revoked_at IS NULL
  GROUP BY access_record.affiliate_id
  HAVING COUNT(DISTINCT course_record.orgId) = 1
) AS source;
-- Affiliates tied to zero or multiple organizations remain unassigned and blocked from payout requests.
