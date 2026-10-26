CREATE INDEX `member_activity_events_org_created_at_idx` ON `member_activity_events` (`orgId`,`createdAt`);
--> statement-breakpoint
CREATE INDEX `member_activity_events_org_user_created_at_idx` ON `member_activity_events` (`orgId`,`userId`,`createdAt`);
