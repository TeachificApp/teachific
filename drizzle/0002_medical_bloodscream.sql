CREATE TABLE `cme_financial_disclosures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`courseId` int NOT NULL,
	`facultyName` varchar(255) NOT NULL,
	`facultyEmail` varchar(255) NOT NULL,
	`token` varchar(128) NOT NULL,
	`status` varchar(32) NOT NULL DEFAULT 'pending',
	`rolesJson` text,
	`relationshipsJson` text,
	`hasRelationships` varchar(8),
	`attestationName` varchar(255),
	`attestationDate` varchar(32),
	`submittedAt` bigint,
	`pdfUrl` varchar(1024),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `cme_financial_disclosures_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `course_lessons` ADD `dripOutDays` int;