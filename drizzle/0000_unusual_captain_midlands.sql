CREATE TABLE `affiliate_clicks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`link_id` int NOT NULL,
	`affiliate_id` int NOT NULL,
	`ip` varchar(64),
	`user_agent` varchar(512),
	`referrer` varchar(512),
	`clicked_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `affiliate_clicks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `affiliate_course_access` (
	`id` int AUTO_INCREMENT NOT NULL,
	`affiliate_id` int NOT NULL,
	`course_id` int NOT NULL,
	`commission_pct_override` int,
	`granted_by_admin_id` int,
	`granted_at` timestamp NOT NULL DEFAULT (now()),
	`revoked_at` timestamp,
	CONSTRAINT `affiliate_course_access_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `affiliate_course_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`course_id` int NOT NULL,
	`affiliate_enabled` boolean NOT NULL DEFAULT false,
	`commission_pct_override` int,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `affiliate_course_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `affiliate_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`affiliate_id` int NOT NULL,
	`course_id` int,
	`slug` varchar(128) NOT NULL,
	`destination_url` text NOT NULL,
	`clicks` int NOT NULL DEFAULT 0,
	`conversions` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `affiliate_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `affiliates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`userId` int,
	`name` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`code` varchar(64) NOT NULL,
	`commissionType` enum('percentage','fixed') NOT NULL DEFAULT 'percentage',
	`commissionValue` float NOT NULL DEFAULT 20,
	`totalClicks` int NOT NULL DEFAULT 0,
	`totalSales` int NOT NULL DEFAULT 0,
	`totalEarned` float NOT NULL DEFAULT 0,
	`totalPaid` float NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `affiliates_id` PRIMARY KEY(`id`),
	CONSTRAINT `affiliates_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `analytics_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`packageId` int NOT NULL,
	`sessionId` int,
	`userId` int,
	`orgId` int,
	`eventType` enum('play_start','play_end','play_pause','play_resume','download','scorm_complete','scorm_pass','scorm_fail','page_view','link_click','error') NOT NULL,
	`eventData` text,
	`occurredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analytics_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `app_versions` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`product` enum('creator','studio','quizcreator') NOT NULL,
	`version` varchar(32) NOT NULL,
	`releaseNotes` text,
	`windowsUrl` varchar(1024),
	`macUrl` varchar(1024),
	`isLatest` boolean NOT NULL DEFAULT false,
	`releasedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `app_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `assignment_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`assignmentId` int NOT NULL,
	`userId` int NOT NULL,
	`userName` varchar(255),
	`userEmail` varchar(320),
	`body` text,
	`fileUrl` text,
	`fileKey` text,
	`grade` varchar(32),
	`score` int,
	`feedback` text,
	`status` enum('pending','graded','returned') NOT NULL DEFAULT 'pending',
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	`gradedAt` timestamp,
	CONSTRAINT `assignment_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`courseId` int,
	`title` varchar(500) NOT NULL,
	`description` text,
	`dueDate` timestamp,
	`maxScore` int DEFAULT 100,
	`status` enum('draft','active','closed') NOT NULL DEFAULT 'draft',
	`allowFileUpload` boolean NOT NULL DEFAULT true,
	`allowTextSubmission` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `authoringProjects` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`orgId` bigint NOT NULL,
	`userId` bigint NOT NULL,
	`title` varchar(255) NOT NULL DEFAULT 'Untitled Project',
	`description` text,
	`settingsJson` text,
	`thumbnailUrl` varchar(1024),
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`lastPublishedUrl` varchar(1024),
	`lastPublishedFormat` enum('scorm12','scorm2004','html5'),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `authoringProjects_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `authoringSlides` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`projectId` bigint NOT NULL,
	`slideIndex` int NOT NULL DEFAULT 0,
	`title` varchar(255) NOT NULL DEFAULT 'Slide',
	`slideType` enum('content','quiz','interaction','scenario','video') NOT NULL DEFAULT 'content',
	`contentJson` text,
	`layout` varchar(64) NOT NULL DEFAULT 'title-content',
	`background` varchar(512),
	`notes` text,
	`nextSlideId` bigint,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `authoringSlides_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blockTemplates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`blockType` varchar(80) NOT NULL,
	`blockData` longtext NOT NULL,
	`tags` varchar(500),
	`orgId` int,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `blockTemplates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blueprint_commissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`referral_link_id` int NOT NULL,
	`pending_install_id` int,
	`subscriber_user_id` int NOT NULL,
	`subscriber_org_id` int NOT NULL,
	`creator_org_id` int NOT NULL,
	`subscription_amount_cents` int NOT NULL,
	`commission_amount_cents` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`status` enum('pending','approved','paid','reversed') NOT NULL DEFAULT 'pending',
	`stripe_payment_intent_id` varchar(255),
	`paid_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `blueprint_commissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blueprint_installations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`blueprint_id` int NOT NULL,
	`blueprint_version_id` int NOT NULL,
	`purchase_id` int,
	`organization_id` int NOT NULL,
	`installed_by_user_id` int NOT NULL,
	`installation_status` enum('queued','validating','copying','configuring','awaiting_setup','completed','failed','rolled_back') NOT NULL DEFAULT 'queued',
	`customization_values` text,
	`resource_id_map` text,
	`installation_log` longtext,
	`installed_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	`last_updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `blueprint_installations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blueprint_installed_resources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`installation_id` int NOT NULL,
	`blueprint_resource_id` int NOT NULL,
	`resource_type` enum('course','product','download','page','funnel','webinar','form','email','email_sequence','automation','coupon','tag') NOT NULL,
	`source_resource_id` int NOT NULL,
	`installed_resource_id` int,
	`organization_id` int NOT NULL,
	`installation_status` enum('pending','completed','failed','skipped') NOT NULL DEFAULT 'pending',
	`customized` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `blueprint_installed_resources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blueprint_licenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`blueprint_id` int NOT NULL,
	`organization_id` int NOT NULL,
	`license_type` enum('single_organization','multi_organization','platform_subscription','lifetime') NOT NULL DEFAULT 'single_organization',
	`starts_at` timestamp NOT NULL DEFAULT (now()),
	`expires_at` timestamp,
	`update_access` boolean NOT NULL DEFAULT true,
	`support_access` boolean NOT NULL DEFAULT true,
	`status` enum('active','expired','revoked') NOT NULL DEFAULT 'active',
	CONSTRAINT `blueprint_licenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blueprint_pending_installs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`blueprint_id` int NOT NULL,
	`referral_link_id` int,
	`session_token` varchar(255) NOT NULL,
	`user_email` varchar(255),
	`user_id` int,
	`org_id` int,
	`status` enum('pending','claimed','installing','completed','expired','failed') NOT NULL DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`claimed_at` timestamp,
	`installed_at` timestamp,
	`expires_at` timestamp NOT NULL,
	CONSTRAINT `blueprint_pending_installs_id` PRIMARY KEY(`id`),
	CONSTRAINT `blueprint_pending_installs_session_token_unique` UNIQUE(`session_token`)
);
--> statement-breakpoint
CREATE TABLE `blueprint_purchases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`blueprint_id` int NOT NULL,
	`blueprint_version_id` int NOT NULL,
	`buyer_user_id` int NOT NULL,
	`buyer_org_id` int NOT NULL,
	`order_id` varchar(255),
	`purchase_price` decimal(10,2) NOT NULL DEFAULT '0',
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`license_type` enum('single_organization','multi_organization','platform_subscription','lifetime') NOT NULL DEFAULT 'single_organization',
	`access_status` enum('active','refunded','revoked','expired') NOT NULL DEFAULT 'active',
	`stripe_checkout_session_id` varchar(255),
	`stripe_payment_intent_id` varchar(255),
	`referral_link_id` int,
	`buyer_email` varchar(255),
	`buyer_name` varchar(255),
	`purchased_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `blueprint_purchases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blueprint_referral_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`blueprint_id` int NOT NULL,
	`creator_org_id` int NOT NULL,
	`creator_user_id` int NOT NULL,
	`slug` varchar(100) NOT NULL,
	`commission_rate` decimal(5,4) NOT NULL DEFAULT '0.2000',
	`total_clicks` int NOT NULL DEFAULT 0,
	`total_signups` int NOT NULL DEFAULT 0,
	`total_conversions` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `blueprint_referral_links_id` PRIMARY KEY(`id`),
	CONSTRAINT `blueprint_referral_links_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `blueprint_resources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`blueprint_id` int NOT NULL,
	`blueprint_version_id` int,
	`resource_type` enum('course','product','download','page','funnel','webinar','form','email','email_sequence','automation','coupon','tag') NOT NULL,
	`source_resource_id` int NOT NULL,
	`resource_name` varchar(255) NOT NULL,
	`resource_order` int NOT NULL DEFAULT 0,
	`configuration_data` text,
	`required` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `blueprint_resources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blueprint_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`blueprint_id` int NOT NULL,
	`user_id` int NOT NULL,
	`organization_id` int NOT NULL,
	`rating` tinyint NOT NULL,
	`title` varchar(255),
	`review_text` text,
	`verified_purchase` boolean NOT NULL DEFAULT false,
	`moderation_status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `blueprint_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blueprint_variables` (
	`id` int AUTO_INCREMENT NOT NULL,
	`blueprint_id` int NOT NULL,
	`variable_key` varchar(100) NOT NULL,
	`label` varchar(255) NOT NULL,
	`description` text,
	`variable_type` enum('text','textarea','url','email','phone','image','logo','color','number','currency','date','select','boolean') NOT NULL DEFAULT 'text',
	`default_value` text,
	`required` boolean NOT NULL DEFAULT false,
	`validation_rules` text,
	`display_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `blueprint_variables_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blueprint_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`blueprint_id` int NOT NULL,
	`version_number` varchar(20) NOT NULL,
	`release_notes` text,
	`snapshot_data` longtext NOT NULL,
	`published_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `blueprint_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `blueprints` (
	`id` int AUTO_INCREMENT NOT NULL,
	`creator_user_id` int,
	`creator_org_id` int,
	`title` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`short_description` varchar(500),
	`full_description` longtext,
	`category` varchar(100),
	`subcategory` varchar(100),
	`thumbnail_url` text,
	`preview_image_urls` text,
	`preview_url` text,
	`status` enum('draft','pending_review','approved','published','suspended','archived') NOT NULL DEFAULT 'draft',
	`visibility` enum('private','organization_only','marketplace','direct_link','platform_only') NOT NULL DEFAULT 'private',
	`pricing_type` enum('free','one_time','subscription_included','private_access') NOT NULL DEFAULT 'free',
	`price` decimal(10,2),
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`current_version` varchar(20) NOT NULL DEFAULT '1.0.0',
	`setup_time_estimate` varchar(50),
	`difficulty_level` enum('beginner','intermediate','advanced') NOT NULL DEFAULT 'beginner',
	`featured` boolean NOT NULL DEFAULT false,
	`published_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `blueprints_id` PRIMARY KEY(`id`),
	CONSTRAINT `blueprints_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `brandMemberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`brand` varchar(32) NOT NULL,
	`tier` varchar(32) NOT NULL DEFAULT 'free',
	`status` varchar(32) NOT NULL DEFAULT 'active',
	`stripeCustomerId` varchar(128),
	`stripeSubscriptionId` varchar(128),
	`grantedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	`source` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `brandMemberships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `bundles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`thumbnailUrl` text,
	`price` float NOT NULL DEFAULT 0,
	`salePrice` float,
	`courseIds` text NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`totalEnrollments` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `bundles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description` text,
	`color` varchar(32) DEFAULT '#0ea5e9',
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `certificate_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`htmlTemplate` text,
	`previewImageUrl` text,
	`isDefault` boolean NOT NULL DEFAULT false,
	`logoUrl` text,
	`primaryColor` varchar(32),
	`accentColor` varchar(32),
	`bgStyle` enum('white','light','gradient','dark') DEFAULT 'white',
	`signatureName` varchar(255),
	`signatureTitle` varchar(255),
	`signatureImageUrl` text,
	`footerText` text,
	`showTeachificBranding` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `certificate_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `certificates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`enrollmentId` int NOT NULL,
	`userId` int NOT NULL,
	`courseId` int NOT NULL,
	`orgId` int NOT NULL,
	`issuedAt` timestamp NOT NULL DEFAULT (now()),
	`certUrl` text,
	`certKey` text,
	`certData` text,
	`verificationCode` varchar(64),
	CONSTRAINT `certificates_id` PRIMARY KEY(`id`),
	CONSTRAINT `certificates_verificationCode_unique` UNIQUE(`verificationCode`)
);
--> statement-breakpoint
CREATE TABLE `community_admin_profiles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hubId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`bio` text,
	`avatarUrl` text,
	`createdByUserId` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `community_admin_profiles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `community_dms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`fromUserId` int NOT NULL,
	`toUserId` int NOT NULL,
	`content` text NOT NULL,
	`isRead` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `community_dms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `community_hubs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`tagline` varchar(500),
	`description` text,
	`coverImageUrl` text,
	`logoUrl` text,
	`primaryColor` varchar(20) DEFAULT '#0d9488',
	`isEnabled` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `community_hubs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `community_invites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`spaceId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`token` varchar(64) NOT NULL,
	`invitedByUserId` int NOT NULL,
	`status` enum('pending','accepted','revoked') NOT NULL DEFAULT 'pending',
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `community_invites_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `community_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`spaceId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('member','moderator','admin') NOT NULL DEFAULT 'member',
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	`isBanned` boolean NOT NULL DEFAULT false,
	`status` enum('pending','approved','rejected') NOT NULL DEFAULT 'approved',
	CONSTRAINT `community_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `community_post_reactions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`userId` int NOT NULL,
	`emoji` varchar(10) NOT NULL DEFAULT '👍',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `community_post_reactions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `community_post_replies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`postId` int NOT NULL,
	`authorId` int NOT NULL,
	`authorName` varchar(255),
	`authorAvatarUrl` text,
	`content` text NOT NULL,
	`isHidden` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `community_post_replies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `community_posts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`spaceId` int NOT NULL,
	`hubId` int NOT NULL,
	`orgId` int NOT NULL,
	`authorId` int NOT NULL,
	`authorName` varchar(255),
	`authorAvatarUrl` text,
	`content` text NOT NULL,
	`imageUrl` text,
	`isPinned` boolean NOT NULL DEFAULT false,
	`isHidden` boolean NOT NULL DEFAULT false,
	`replyCount` int NOT NULL DEFAULT 0,
	`reactionCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `community_posts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `community_spaces` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hubId` int NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description` text,
	`coverImageUrl` text,
	`emoji` varchar(10) DEFAULT '💬',
	`sortOrder` int NOT NULL DEFAULT 0,
	`accessType` enum('open','invite_only','course_enrollment','purchase') NOT NULL DEFAULT 'open',
	`isInviteOnly` boolean NOT NULL DEFAULT false,
	`linkedCourseId` int,
	`price` decimal(10,2) DEFAULT '0',
	`stripePriceId` varchar(255),
	`salesPageTitle` varchar(500),
	`salesPageContent` text,
	`salesPageCta` varchar(255) DEFAULT 'Join Community',
	`memberCount` int NOT NULL DEFAULT 0,
	`postCount` int NOT NULL DEFAULT 0,
	`isArchived` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `community_spaces_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_folders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`ownerId` int NOT NULL,
	`parentId` int,
	`name` varchar(255) NOT NULL,
	`color` varchar(32),
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_folders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_packages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`uploadedBy` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	`tags` text,
	`scormVersion` enum('1.2','2004','none') NOT NULL DEFAULT 'none',
	`scormEntryPoint` text,
	`scormManifest` text,
	`contentType` enum('scorm','html','articulate','ispring','unknown') NOT NULL DEFAULT 'unknown',
	`displayMode` varchar(20) NOT NULL DEFAULT 'native',
	`lmsShellConfig` text,
	`llmSummary` text,
	`llmTags` text,
	`llmValidationNotes` text,
	`originalZipKey` text NOT NULL,
	`originalZipUrl` text NOT NULL,
	`originalZipSize` bigint DEFAULT 0,
	`extractedFolderKey` text,
	`status` enum('uploading','processing','ready','error') NOT NULL DEFAULT 'uploading',
	`processingError` text,
	`currentVersionId` int,
	`totalPlayCount` int NOT NULL DEFAULT 0,
	`totalDownloadCount` int NOT NULL DEFAULT 0,
	`isPublic` boolean NOT NULL DEFAULT false,
	`autoFullscreenMobile` boolean NOT NULL DEFAULT false,
	`folderId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_packages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`packageId` int NOT NULL,
	`versionNumber` int NOT NULL,
	`versionLabel` varchar(100),
	`changelog` text,
	`uploadedBy` int NOT NULL,
	`zipKey` text NOT NULL,
	`zipUrl` text NOT NULL,
	`zipSize` bigint DEFAULT 0,
	`extractedFolderKey` text,
	`entryPoint` text,
	`fileCount` int DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`replacedAt` timestamp,
	CONSTRAINT `content_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `coupons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`code` varchar(64) NOT NULL,
	`discountType` enum('percentage','fixed') NOT NULL DEFAULT 'percentage',
	`discountValue` float NOT NULL,
	`maxUses` int,
	`usedCount` int NOT NULL DEFAULT 0,
	`expiresAt` timestamp,
	`appliesToCourseIds` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `coupons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `course_announcements` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int NOT NULL,
	`course_id` int NOT NULL,
	`author_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`body` longtext,
	`is_pinned` boolean DEFAULT false,
	`send_email` boolean DEFAULT false,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `course_announcements_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `course_categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseId` int NOT NULL,
	`categoryId` int NOT NULL,
	CONSTRAINT `course_categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `course_enrollments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseId` int NOT NULL,
	`userId` int NOT NULL,
	`orgId` int NOT NULL,
	`pricingId` int,
	`enrolledAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`expiresAt` timestamp,
	`progressPct` float NOT NULL DEFAULT 0,
	`lastLessonId` int,
	`lastAccessedAt` timestamp,
	`amountPaid` float DEFAULT 0,
	`currency` varchar(3) DEFAULT 'USD',
	`stripePaymentIntentId` varchar(255),
	`couponId` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`certificateIssued` boolean NOT NULL DEFAULT false,
	CONSTRAINT `course_enrollments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `course_lessons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseId` int NOT NULL,
	`sectionId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`lessonType` enum('video','text','scorm','quiz','flashcard','exam','pdf','audio','assignment','live','download','weblink','zoom') NOT NULL DEFAULT 'text',
	`contentJson` text,
	`videoUrl` text,
	`videoProvider` enum('upload','youtube','vimeo','wistia') DEFAULT 'upload',
	`packageId` int,
	`quizId` int,
	`pdfUrl` text,
	`audioUrl` text,
	`downloadUrl` text,
	`downloadFileName` varchar(255),
	`webLinkUrl` text,
	`richTextAddOn` text,
	`liveSessionJson` text,
	`startBannerEnabled` boolean NOT NULL DEFAULT false,
	`startBannerPosition` enum('top','bottom','left') DEFAULT 'top',
	`startBannerMessage` text,
	`startBannerImageUrl` text,
	`startBannerSound` varchar(64),
	`startBannerCustomSoundUrl` text,
	`startBannerConfetti` boolean NOT NULL DEFAULT false,
	`startBannerConfettiStyle` enum('burst','cannon','rain','fireworks') DEFAULT 'burst',
	`startBannerDurationMs` int DEFAULT 5000,
	`completeBannerEnabled` boolean NOT NULL DEFAULT false,
	`completeBannerPosition` enum('top','bottom','left') DEFAULT 'bottom',
	`completeBannerMessage` text,
	`completeBannerImageUrl` text,
	`completeBannerSound` varchar(64),
	`completeBannerCustomSoundUrl` text,
	`completeBannerConfetti` boolean NOT NULL DEFAULT false,
	`completeBannerConfettiStyle` enum('burst','cannon','rain','fireworks') DEFAULT 'burst',
	`completeBannerDurationMs` int DEFAULT 5000,
	`sortOrder` int NOT NULL DEFAULT 0,
	`durationSeconds` int,
	`isFreePreview` boolean NOT NULL DEFAULT false,
	`isPublished` boolean NOT NULL DEFAULT true,
	`isPrerequisite` boolean NOT NULL DEFAULT false,
	`requiresCompletion` boolean NOT NULL DEFAULT true,
	`passingScore` int,
	`allowSkip` boolean NOT NULL DEFAULT false,
	`estimatedMinutes` int,
	`dripDays` int,
	`dripDate` timestamp,
	`dripType` enum('immediate','days_after_enrollment','specific_date') NOT NULL DEFAULT 'immediate',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `course_lessons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `course_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`userId` int,
	`customerName` varchar(255),
	`customerEmail` varchar(320) NOT NULL,
	`courseId` int,
	`pricingId` int,
	`productType` enum('course','bundle','membership','digital') NOT NULL DEFAULT 'course',
	`productName` varchar(255),
	`amount` float NOT NULL DEFAULT 0,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`status` enum('pending','completed','refunded','failed') NOT NULL DEFAULT 'pending',
	`couponId` int,
	`couponCode` varchar(64),
	`discountAmount` float DEFAULT 0,
	`stripePaymentIntentId` varchar(255),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `course_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `course_pricing` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseId` int NOT NULL,
	`pricingType` enum('free','one_time','subscription','payment_plan') NOT NULL DEFAULT 'free',
	`name` varchar(255),
	`price` float NOT NULL DEFAULT 0,
	`salePrice` float,
	`currency` varchar(3) NOT NULL DEFAULT 'USD',
	`accessDays` int,
	`subscriptionInterval` enum('monthly','yearly'),
	`installmentCount` int,
	`installmentAmount` float,
	`stripePriceId` varchar(255),
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `course_pricing_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `course_resources` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int NOT NULL,
	`course_id` int NOT NULL,
	`lesson_id` int,
	`title` varchar(255) NOT NULL,
	`description` text,
	`file_url` varchar(2048),
	`file_key` varchar(1024),
	`file_name` varchar(255),
	`file_size` int,
	`mime_type` varchar(100),
	`external_url` varchar(2048),
	`resource_type` varchar(50) DEFAULT 'file',
	`sort_order` int DEFAULT 0,
	`created_at` bigint NOT NULL,
	CONSTRAINT `course_resources_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `course_reviews` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseId` int NOT NULL,
	`userId` int NOT NULL,
	`orgId` int NOT NULL,
	`rating` int NOT NULL,
	`reviewText` text,
	`isPublished` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `course_reviews_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `course_sections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`courseId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`description` text,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isFreePreview` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `course_sections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `courses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`instructorId` int,
	`title` varchar(500) NOT NULL,
	`slug` varchar(200) NOT NULL,
	`description` text,
	`shortDescription` varchar(500),
	`thumbnailUrl` text,
	`promoVideoUrl` text,
	`status` enum('draft','published','hidden','private','archived') NOT NULL DEFAULT 'draft',
	`isPrivate` boolean NOT NULL DEFAULT false,
	`isHidden` boolean NOT NULL DEFAULT false,
	`disableTextCopy` boolean NOT NULL DEFAULT false,
	`seoTitle` varchar(255),
	`seoDescription` text,
	`enableChapterShare` boolean NOT NULL DEFAULT true,
	`enableCompletionShare` boolean NOT NULL DEFAULT true,
	`socialShareText` text,
	`playerThemeColor` varchar(32),
	`playerSidebarStyle` enum('full','minimal','hidden') NOT NULL DEFAULT 'full',
	`playerShowProgress` boolean NOT NULL DEFAULT true,
	`playerShowProgressPercent` boolean NOT NULL DEFAULT true,
	`playerAllowNotes` boolean NOT NULL DEFAULT false,
	`playerShowLessonIcons` boolean NOT NULL DEFAULT true,
	`completionType` enum('all_lessons','percentage','quiz_pass') NOT NULL DEFAULT 'all_lessons',
	`completionPercentage` int DEFAULT 100,
	`welcomeEmailEnabled` boolean NOT NULL DEFAULT true,
	`welcomeEmailSubject` varchar(255),
	`welcomeEmailBody` text,
	`afterPurchaseRedirectUrl` text,
	`thankYouPageEnabled` boolean NOT NULL DEFAULT false,
	`thankYouPageBlocks` text,
	`upsellCourseId` int,
	`headerCode` text,
	`footerCode` text,
	`designTemplate` varchar(64) DEFAULT 'colossal',
	`showCompleteButton` boolean NOT NULL DEFAULT true,
	`enableCertificate` boolean NOT NULL DEFAULT false,
	`trackProgress` boolean NOT NULL DEFAULT true,
	`requireSequential` boolean NOT NULL DEFAULT false,
	`language` varchar(16) DEFAULT 'en',
	`copiedFromId` int,
	`notificationOverrides` text,
	`whatYouLearn` text,
	`requirements` text,
	`targetAudience` text,
	`instructorBio` text,
	`preStartPageEnabled` boolean NOT NULL DEFAULT true,
	`accessDurationType` enum('lifetime','days','date') NOT NULL DEFAULT 'lifetime',
	`accessDurationDays` int,
	`accessExpiryDate` timestamp,
	`sortOrder` int NOT NULL DEFAULT 0,
	`totalEnrollments` int NOT NULL DEFAULT 0,
	`totalCompletions` int NOT NULL DEFAULT 0,
	`totalRevenue` float NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `courses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `digital_bundle_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bundle_id` int NOT NULL,
	`product_id` int NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `digital_bundle_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `digital_bundle_purchases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`bundle_id` int NOT NULL,
	`stripe_checkout_session_id` varchar(255),
	`purchased_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `digital_bundle_purchases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `digital_bundles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(255) NOT NULL,
	`title` varchar(255) NOT NULL,
	`subtitle` varchar(500),
	`description` longtext,
	`thumbnail_url` text,
	`original_price` decimal(10,2) NOT NULL DEFAULT '0',
	`discount_price` decimal(10,2) NOT NULL DEFAULT '0',
	`currency` varchar(8) NOT NULL DEFAULT 'usd',
	`status` enum('draft','published','hidden','private','archived') NOT NULL DEFAULT 'draft',
	`org_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `digital_bundles_id` PRIMARY KEY(`id`),
	CONSTRAINT `digital_bundles_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `digital_download_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`product_id` int NOT NULL,
	`file_id` int NOT NULL,
	`downloaded_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `digital_download_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `digital_download_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`productId` int NOT NULL,
	`downloadedAt` timestamp DEFAULT (now()),
	`ipAddress` varchar(45),
	`userAgent` text,
	CONSTRAINT `digital_download_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `digital_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`priceId` int NOT NULL,
	`orgId` int NOT NULL,
	`buyerEmail` varchar(255) NOT NULL,
	`buyerName` varchar(255),
	`amount` varchar(20) NOT NULL,
	`currency` varchar(3) DEFAULT 'USD',
	`status` varchar(50) NOT NULL DEFAULT 'pending',
	`paymentRef` varchar(255),
	`downloadToken` varchar(64) NOT NULL,
	`accessExpiresAt` timestamp,
	`maxDownloads` int,
	`downloadCount` int DEFAULT 0,
	`notes` text,
	`createdAt` timestamp DEFAULT (now()),
	`paidAt` timestamp,
	CONSTRAINT `digital_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `digital_product_files` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`file_name` varchar(500) NOT NULL,
	`file_url` text NOT NULL,
	`file_key` varchar(500) NOT NULL,
	`file_size` int NOT NULL DEFAULT 0,
	`mime_type` varchar(100),
	`sort_order` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `digital_product_files_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `digital_product_prices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`productId` int NOT NULL,
	`label` varchar(255) NOT NULL,
	`type` varchar(50) NOT NULL,
	`amount` varchar(20) NOT NULL,
	`currency` varchar(3) DEFAULT 'USD',
	`installments` int,
	`installmentAmount` varchar(20),
	`intervalDays` int,
	`isActive` boolean DEFAULT true,
	`stripePaymentLinkUrl` varchar(2048),
	`stripePaymentLinkId` varchar(255),
	`stripe_price_id` varchar(255),
	`stripe_product_id` varchar(255),
	`createdAt` timestamp DEFAULT (now()),
	CONSTRAINT `digital_product_prices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `digital_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description` text,
	`fileUrl` text NOT NULL,
	`fileKey` varchar(512) NOT NULL,
	`fileType` varchar(100),
	`fileSize` bigint,
	`thumbnailUrl` text,
	`salesPageBlocksJson` json,
	`isPublished` boolean DEFAULT false,
	`visibility` enum('draft','published','hidden','private','archived') NOT NULL DEFAULT 'draft',
	`defaultAccessDays` int,
	`defaultMaxDownloads` int,
	`createdAt` timestamp DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `digital_products_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `digital_purchases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`product_id` int NOT NULL,
	`stripe_payment_intent_id` varchar(255),
	`stripe_checkout_session_id` varchar(255),
	`purchased_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `digital_purchases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `discussion_replies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`discussionId` int NOT NULL,
	`authorId` int NOT NULL,
	`authorName` varchar(255),
	`body` text NOT NULL,
	`isInstructorReply` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `discussion_replies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `discussions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`courseId` int,
	`title` varchar(500) NOT NULL,
	`body` text,
	`authorId` int NOT NULL,
	`authorName` varchar(255),
	`isPinned` boolean NOT NULL DEFAULT false,
	`status` enum('open','resolved','closed') NOT NULL DEFAULT 'open',
	`replyCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `discussions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_campaign_recipients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`userId` int,
	`email` varchar(320) NOT NULL,
	`status` enum('pending','sent','failed','bounced') NOT NULL DEFAULT 'pending',
	`sentAt` timestamp,
	`openedAt` timestamp,
	`clickedAt` timestamp,
	`errorMessage` text,
	CONSTRAINT `email_campaign_recipients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int,
	`name` varchar(255) NOT NULL,
	`templateId` int,
	`subject` varchar(255) NOT NULL,
	`htmlBody` text NOT NULL,
	`textBody` text,
	`status` enum('draft','scheduled','sending','sent','failed') NOT NULL DEFAULT 'draft',
	`scheduledAt` timestamp,
	`sentAt` timestamp,
	`recipientCount` int NOT NULL DEFAULT 0,
	`sentCount` int NOT NULL DEFAULT 0,
	`failedCount` int NOT NULL DEFAULT 0,
	`openCount` int NOT NULL DEFAULT 0,
	`clickCount` int NOT NULL DEFAULT 0,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `emailListSubscribers` (
	`id` int AUTO_INCREMENT NOT NULL,
	`listId` int NOT NULL,
	`email` varchar(300) NOT NULL,
	`name` varchar(300),
	`userId` int,
	`source` varchar(100),
	`sourceId` varchar(100),
	`status` varchar(50) NOT NULL DEFAULT 'subscribed',
	`subscribedAt` timestamp NOT NULL DEFAULT (now()),
	`unsubscribedAt` timestamp,
	`metadata` text,
	CONSTRAINT `emailListSubscribers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `emailLists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`subscriberCount` int NOT NULL DEFAULT 0,
	`webhookToken` varchar(64),
	`orgId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `emailLists_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int,
	`name` varchar(255) NOT NULL,
	`subject` varchar(255) NOT NULL,
	`htmlBody` text NOT NULL,
	`textBody` text,
	`isDefault` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `email_unsubscribes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`email` varchar(320) NOT NULL,
	`orgId` int,
	`unsubscribedAt` timestamp NOT NULL DEFAULT (now()),
	`reason` text,
	CONSTRAINT `email_unsubscribes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `file_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`versionId` int NOT NULL,
	`packageId` int NOT NULL,
	`relativePath` text NOT NULL,
	`s3Key` text NOT NULL,
	`s3Url` text NOT NULL,
	`mimeType` varchar(255),
	`fileSize` bigint DEFAULT 0,
	`isEntryPoint` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `file_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `flashcard_cards` (
	`id` int AUTO_INCREMENT NOT NULL,
	`deckId` int NOT NULL,
	`front` text NOT NULL,
	`back` text NOT NULL,
	`frontImageUrl` varchar(1024),
	`backImageUrl` varchar(1024),
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `flashcard_cards_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `flashcard_decks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`category` varchar(100),
	`cardCount` int NOT NULL DEFAULT 0,
	`isPublic` boolean NOT NULL DEFAULT false,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `flashcard_decks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `form_analytics_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`formId` int NOT NULL,
	`sessionId` int NOT NULL,
	`fieldId` int,
	`event` varchar(50) NOT NULL,
	`value` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `form_analytics_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `form_branching_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`formId` int NOT NULL,
	`sourceFieldId` int NOT NULL,
	`operator` varchar(50) NOT NULL,
	`value` text,
	`action` varchar(50) NOT NULL,
	`targetFieldId` int,
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `form_branching_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `form_docs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`formId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`docType` varchar(50) NOT NULL DEFAULT 'merged_pdf',
	`template` text,
	`templateFileUrl` text,
	`templateFileKey` varchar(1000),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `form_docs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `form_fields` (
	`id` int AUTO_INCREMENT NOT NULL,
	`formId` int NOT NULL,
	`type` varchar(50) NOT NULL,
	`label` text NOT NULL,
	`placeholder` text,
	`helpText` text,
	`required` boolean NOT NULL DEFAULT false,
	`sortOrder` int NOT NULL DEFAULT 0,
	`options` text,
	`minLength` int,
	`maxLength` int,
	`isBranchingSource` boolean NOT NULL DEFAULT false,
	`isHidden` boolean NOT NULL DEFAULT false,
	`memberVarName` varchar(100),
	`scaleMin` int,
	`scaleMax` int,
	`scaleMinLabel` varchar(100),
	`scaleMaxLabel` varchar(100),
	`richTextContent` text,
	`emailRoutingRules` text,
	`scoreWeight` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `form_fields_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `form_filters` (
	`id` int AUTO_INCREMENT NOT NULL,
	`formId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`conditions` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `form_filters_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `form_integrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`formId` int NOT NULL,
	`type` enum('course','custom_page','landing_page') NOT NULL,
	`targetId` int,
	`targetUrl` text,
	`triggerOn` enum('on_submit','on_completion') NOT NULL DEFAULT 'on_submit',
	`action` enum('enroll','redirect','tag','embed') NOT NULL,
	`label` varchar(255),
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `form_integrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `form_labels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`formId` int NOT NULL,
	`fieldId` int NOT NULL,
	`customLabel` varchar(500) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `form_labels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `form_scheduled_exports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`formId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`frequency` varchar(20) NOT NULL DEFAULT 'weekly',
	`dayValue` int,
	`hourUtc` int NOT NULL DEFAULT 8,
	`deliveryEmail` varchar(320) NOT NULL,
	`format` varchar(10) NOT NULL DEFAULT 'csv',
	`filterId` int,
	`isActive` boolean NOT NULL DEFAULT true,
	`lastRunAt` timestamp,
	`nextRunAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `form_scheduled_exports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `form_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`formId` int NOT NULL,
	`sessionToken` varchar(100) NOT NULL,
	`userId` int,
	`respondentEmail` varchar(255),
	`droppedAtFieldId` int,
	`completed` boolean NOT NULL DEFAULT false,
	`memberVars` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`durationSeconds` int,
	CONSTRAINT `form_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `form_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`formId` int NOT NULL,
	`userId` int,
	`respondentEmail` varchar(255),
	`respondentName` varchar(255),
	`answers` text NOT NULL,
	`ipAddress` varchar(50),
	`userAgent` text,
	`submittedAt` timestamp NOT NULL DEFAULT (now()),
	`status` enum('pending','reviewed','approved','rejected') NOT NULL DEFAULT 'pending',
	`scoreTotal` int,
	`scoreMax` int,
	CONSTRAINT `form_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `form_views` (
	`id` int AUTO_INCREMENT NOT NULL,
	`formId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`visibleFieldIds` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `form_views_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `forms` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`slug` varchar(200) NOT NULL,
	`status` enum('draft','published','closed') NOT NULL DEFAULT 'draft',
	`notifyEmails` text,
	`notifyOrgAdmin` boolean NOT NULL DEFAULT false,
	`notifyRespondent` boolean NOT NULL DEFAULT false,
	`sendConfirmation` boolean NOT NULL DEFAULT false,
	`confirmationEmailField` varchar(100),
	`confirmationSubject` varchar(255),
	`confirmationBody` text,
	`successMessage` text,
	`successMessageHtml` text,
	`redirectUrl` text,
	`showPageProgressBar` boolean NOT NULL DEFAULT true,
	`requireLogin` boolean NOT NULL DEFAULT false,
	`allowMultipleSubmissions` boolean NOT NULL DEFAULT true,
	`primaryColor` varchar(20),
	`buttonColor` varchar(20),
	`buttonTextColor` varchar(20),
	`headerBgColor` varchar(20),
	`headerTextColor` varchar(20),
	`fontFamily` varchar(100),
	`headerImageUrl` text,
	`useOrgBranding` boolean NOT NULL DEFAULT true,
	`customCss` text,
	`memberVarMappings` text,
	`submissionCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `forms_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `free_preview_enrollments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`course_id` int NOT NULL,
	`user_id` int,
	`email` varchar(320) NOT NULL,
	`first_name` varchar(100),
	`last_name` varchar(100),
	`source` varchar(128),
	`utm_source` varchar(128),
	`utm_medium` varchar(128),
	`utm_campaign` varchar(128),
	`access_token` varchar(128) NOT NULL,
	`access_expires_at` timestamp NOT NULL,
	`follow_up_sent_at` timestamp,
	`tags` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `free_preview_enrollments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `funnel_branch_conditions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`rule_id` int NOT NULL,
	`variable` enum('product_purchased','order_bump_selected','email_contains','email_domain','purchase_price','source_url','utm_source','utm_medium','utm_campaign','date_range','day_of_week','hour_of_day','country','device_type','custom_field') NOT NULL,
	`operator` enum('equals','not_equals','contains','not_contains','starts_with','ends_with','greater_than','less_than','between','in_list','not_in_list','is_set','is_not_set') NOT NULL,
	`value` varchar(1024) NOT NULL DEFAULT '',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `funnel_branch_conditions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `funnel_branch_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`page_id` int NOT NULL,
	`condition` varchar(500) NOT NULL,
	`target_page_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `funnel_branch_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `funnel_leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`page_id` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`name` varchar(255),
	`lead_data` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `funnel_leads_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `funnel_pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`type` enum('landing','sales','thank_you','checkout') NOT NULL,
	`content` longtext,
	`customDomain` varchar(255),
	`customDomainVerified` boolean NOT NULL DEFAULT false,
	`customDomainVerificationToken` varchar(128),
	`customDomainVerificationStatus` enum('unverified','pending','verified') NOT NULL DEFAULT 'unverified',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `funnel_pages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `funnel_purchases` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`user_id` int,
	`lead_id` int,
	`email` varchar(320) NOT NULL,
	`name` varchar(255),
	`phone` varchar(20),
	`product_name` varchar(255) NOT NULL,
	`product_type` enum('course','download','quiz','physical','membership','bundle','other') NOT NULL DEFAULT 'other',
	`product_id` int,
	`amount` decimal(12,2) NOT NULL,
	`currency` varchar(10) NOT NULL DEFAULT 'USD',
	`order_bumps` longtext,
	`stripe_payment_intent_id` varchar(255),
	`stripe_session_id` varchar(255),
	`source_type` enum('funnel','landing_page','product_page','lms_lesson','email','other') NOT NULL DEFAULT 'other',
	`source_funnel_id` int,
	`source_funnel_page_id` int,
	`source_landing_page_id` int,
	`source_lms_lesson_id` int,
	`fulfillment_course_id` int,
	`fulfillment_download_id` int,
	`fulfillment_quiz_id` int,
	`fulfillment_membership_id` int,
	`fulfillment_bundle_id` int,
	`shipping_name` varchar(255),
	`shipping_line1` varchar(255),
	`shipping_line2` varchar(255),
	`shipping_city` varchar(100),
	`shipping_state` varchar(100),
	`shipping_postal_code` varchar(20),
	`shipping_country` varchar(10),
	`promo_code` varchar(100),
	`discount_applied` decimal(12,2),
	`status` enum('pending','paid','completed','failed','refunded') NOT NULL DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `funnel_purchases_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `funnel_steps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`funnelId` int NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`name` varchar(255) NOT NULL,
	`stepType` enum('landing','sales','order','upsell','downsell','thank_you','webinar','custom') NOT NULL DEFAULT 'landing',
	`pageId` int,
	`slug` varchar(200),
	`visitors` int NOT NULL DEFAULT 0,
	`conversions` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `funnel_steps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `funnel_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`pages_json` longtext NOT NULL,
	`accent_color` varchar(20) DEFAULT '#0d9488',
	`bg_color` varchar(20) DEFAULT '#f8fafc',
	`logo_url` text,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `funnel_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `funnels` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`slug` varchar(200) NOT NULL,
	`isActive` boolean NOT NULL DEFAULT true,
	`courseId` int,
	`totalVisitors` int NOT NULL DEFAULT 0,
	`totalConversions` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `funnels_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `general_form_branch_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`form_id` int NOT NULL,
	`condition` varchar(500) NOT NULL,
	`action` varchar(500) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `general_form_branch_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `general_form_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`section_id` int NOT NULL,
	`field_type` varchar(50) NOT NULL,
	`label` varchar(255) NOT NULL,
	`required` boolean NOT NULL DEFAULT false,
	`position` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `general_form_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `general_form_options` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`item_id` int NOT NULL,
	`option_label` varchar(255) NOT NULL,
	`option_value` varchar(255) NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `general_form_options_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `general_form_sections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`form_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `general_form_sections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `general_form_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`form_id` int NOT NULL,
	`submission_data` json NOT NULL,
	`submitted_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `general_form_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `general_form_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description` longtext,
	`customDomain` varchar(255),
	`customDomainVerified` boolean NOT NULL DEFAULT false,
	`customDomainVerificationToken` varchar(128),
	`customDomainVerificationStatus` enum('unverified','pending','verified') NOT NULL DEFAULT 'unverified',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `general_form_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `general_form_webhooks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`form_id` int NOT NULL,
	`webhook_url` text NOT NULL,
	`event` varchar(100) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `general_form_webhooks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `global_form_theme` (
	`id` int AUTO_INCREMENT NOT NULL,
	`theme_settings` text,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `global_form_theme_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `googleFormIntegrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`formId` int NOT NULL,
	`googleClientId` varchar(500),
	`googleClientSecret` varchar(500),
	`accessToken` text,
	`refreshToken` text,
	`tokenExpiresAt` bigint,
	`connectedEmail` varchar(255),
	`spreadsheetId` varchar(255),
	`spreadsheetName` varchar(500),
	`sheetTabName` varchar(255) DEFAULT 'Form Responses',
	`headersInitialised` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `googleFormIntegrations_id` PRIMARY KEY(`id`),
	CONSTRAINT `googleFormIntegrations_formId_unique` UNIQUE(`formId`)
);
--> statement-breakpoint
CREATE TABLE `group_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`groupId` int NOT NULL,
	`userId` int,
	`email` varchar(320) NOT NULL,
	`name` varchar(255),
	`status` enum('invited','active','removed') NOT NULL DEFAULT 'invited',
	`enrolledAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `group_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`managerId` int,
	`managerName` varchar(255),
	`managerTitle` varchar(255),
	`managerEmail` varchar(320),
	`managerPhone` varchar(50),
	`productIds` text,
	`welcomeEmailSent` boolean NOT NULL DEFAULT false,
	`seats` int NOT NULL DEFAULT 10,
	`usedSeats` int NOT NULL DEFAULT 0,
	`courseId` int,
	`notes` text,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `instructor_course_permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`instructor_id` int NOT NULL,
	`course_id` int NOT NULL,
	`can_self_publish` boolean NOT NULL DEFAULT false,
	`granted_by_admin_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `instructor_course_permissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `instructor_payout_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`instructor_id` int NOT NULL,
	`payout_method` enum('stripe','bank_transfer','paypal') NOT NULL,
	`payout_details` text,
	`commission_percentage` decimal(5,2) NOT NULL DEFAULT '0.00',
	`total_earned` decimal(12,2) NOT NULL DEFAULT '0.00',
	`total_paid` decimal(12,2) NOT NULL DEFAULT '0.00',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `instructor_payout_config_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `instructor_publish_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`course_id` int NOT NULL,
	`instructor_id` int NOT NULL,
	`ipr_status` enum('pending','approved','rejected') NOT NULL DEFAULT 'pending',
	`note` text,
	`review_note` text,
	`reviewed_by_admin_id` int,
	`requested_at` timestamp NOT NULL DEFAULT (now()),
	`reviewed_at` timestamp,
	CONSTRAINT `instructor_publish_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `instructors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`orgId` int NOT NULL,
	`displayName` varchar(255),
	`title` varchar(255),
	`bio` text,
	`avatarUrl` text,
	`socialLinks` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `instructors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ip_access_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`ip_address` varchar(45) NOT NULL,
	`user_agent` text,
	`content_type` enum('course','download','paid_content') NOT NULL,
	`content_id` int,
	`accessed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ip_access_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `kajabi_integrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int NOT NULL,
	`api_key` text NOT NULL,
	`school_name` varchar(255),
	`status` varchar(50) NOT NULL DEFAULT 'active',
	`last_sync_at` bigint,
	`last_sync_stats` json,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `kajabi_integrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lesson_bookmarks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`courseId` int NOT NULL,
	`lessonId` int NOT NULL,
	`enrollmentId` int NOT NULL,
	`label` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lesson_bookmarks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lesson_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`lesson_id` int NOT NULL,
	`user_id` int NOT NULL,
	`content` text NOT NULL,
	`parent_id` int,
	`deleted_at` timestamp,
	`deleted_by_admin_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lesson_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lesson_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`courseId` int NOT NULL,
	`lessonId` int NOT NULL,
	`enrollmentId` int NOT NULL,
	`content` text NOT NULL,
	`videoTimestamp` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lesson_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lesson_progress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`enrollmentId` int NOT NULL,
	`lessonId` int NOT NULL,
	`userId` int NOT NULL,
	`courseId` int NOT NULL,
	`status` enum('not_started','in_progress','completed') NOT NULL DEFAULT 'not_started',
	`completedAt` timestamp,
	`timeSpentSeconds` int DEFAULT 0,
	`scormData` text,
	`quizScore` float,
	`quizPassed` boolean,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lesson_progress_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lesson_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`title` varchar(255) NOT NULL,
	`lesson_type` varchar(64) NOT NULL DEFAULT 'video',
	`blocks` longtext,
	`cover_image` text,
	`tags` text,
	`created_by_admin_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lesson_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_affiliate_conversions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`affiliate_id` int NOT NULL,
	`course_id` int NOT NULL,
	`enrollment_id` int NOT NULL,
	`commission_amount` decimal(12,2) NOT NULL,
	`status` enum('pending','approved','paid') NOT NULL DEFAULT 'pending',
	`paid_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_affiliate_conversions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_affiliates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int,
	`name` varchar(255) NOT NULL,
	`email` varchar(320),
	`code` varchar(64) NOT NULL,
	`commission_pct` int NOT NULL DEFAULT 10,
	`is_active` boolean NOT NULL DEFAULT true,
	`total_earned` int NOT NULL DEFAULT 0,
	`total_paid` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_affiliates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_archive` (
	`id` int AUTO_INCREMENT NOT NULL,
	`item_type` enum('course','quiz','download','product','bundle') NOT NULL,
	`original_id` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`snapshot` longtext NOT NULL,
	`deleted_by_user_id` int NOT NULL,
	`deleted_at` timestamp NOT NULL DEFAULT (now()),
	`purge_at` timestamp NOT NULL,
	CONSTRAINT `lms_archive_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_certificate_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int,
	`name` varchar(255) NOT NULL,
	`description` text,
	`logo_url` text,
	`background_image_url` text,
	`background_color_hex` varchar(20) DEFAULT '#f0fbfc',
	`title_text` varchar(255) DEFAULT 'Certificate of Completion',
	`subtitle_text` varchar(255),
	`body_text` text,
	`signature_text` varchar(255),
	`signature_title_text` varchar(255),
	`footer_text` text,
	`font_family` varchar(100) DEFAULT 'Helvetica',
	`primary_color_hex` varchar(20) DEFAULT '#189aa1',
	`accent_color_hex` varchar(20) DEFAULT '#c9a84c',
	`text_color_hex` varchar(20) DEFAULT '#0e1e2e',
	`show_border` boolean DEFAULT true,
	`border_color_hex` varchar(20) DEFAULT '#189aa1',
	`border_width` int DEFAULT 3,
	`layout` enum('classic','modern','minimal') DEFAULT 'classic',
	`is_default` boolean DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lms_certificate_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_certificates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`enrollment_id` int NOT NULL,
	`template_id` int NOT NULL,
	`certificate_number` varchar(64) NOT NULL,
	`issued_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_certificates_id` PRIMARY KEY(`id`),
	CONSTRAINT `lms_certificates_certificate_number_unique` UNIQUE(`certificate_number`)
);
--> statement-breakpoint
CREATE TABLE `lms_checkout_page_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`header_config` longtext,
	`course_info_config` longtext,
	`trust_badges_config` longtext,
	`payment_form_config` longtext,
	`footer_config` longtext,
	`sections_order` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lms_checkout_page_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_checkout_pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int NOT NULL,
	`course_id` int,
	`content_type` enum('course','download','physical_product','webinar','membership','membership_plan','bundle') NOT NULL DEFAULT 'course',
	`content_id` int NOT NULL DEFAULT 0,
	`header_config` longtext,
	`course_info_config` longtext,
	`trust_badges_config` longtext,
	`payment_form_config` longtext,
	`footer_config` longtext,
	`sections_order` text,
	`primary_color` varchar(20),
	`accent_color` varchar(20),
	`bg_color` varchar(20),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lms_checkout_pages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_cohort_assignments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`cohort_session_id` int,
	`course_id` int,
	`cohort_group_id` int,
	`title` varchar(255) NOT NULL,
	`description` longtext,
	`content_blocks` longtext,
	`due_date` datetime,
	`max_points` int NOT NULL DEFAULT 100,
	`submission_type` enum('text','file','url','none') NOT NULL DEFAULT 'none',
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`position` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_cohort_assignments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_cohort_group_enrollments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`cohort_group_id` int NOT NULL,
	`user_id` int NOT NULL,
	`course_id` int,
	`enrollment_id` int,
	`joined_at` datetime,
	`enrolled_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_cohort_group_enrollments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_cohort_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`cohort_session_id` int,
	`course_id` int,
	`name` varchar(255) NOT NULL,
	`slug` varchar(255),
	`description` text,
	`start_date` datetime,
	`end_date` datetime,
	`enrollment_close_date` datetime,
	`max_students` int,
	`status` enum('draft','open','active','completed','archived') NOT NULL DEFAULT 'draft',
	`sort_order` int NOT NULL DEFAULT 0,
	`is_featured_on_landing` tinyint NOT NULL DEFAULT 0,
	`access_duration_days` int,
	`page_blocks` longtext,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_cohort_groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_cohort_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`cohort_session_id` int,
	`course_id` int,
	`cohort_group_id` int,
	`user_id` int NOT NULL,
	`body` longtext,
	`media_urls` longtext,
	`is_admin_post` tinyint NOT NULL DEFAULT 0,
	`is_pinned` tinyint NOT NULL DEFAULT 0,
	`updated_at` datetime,
	`deleted_at` datetime,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_cohort_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_cohort_recordings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`cohort_session_id` int,
	`course_id` int,
	`cohort_group_id` int,
	`session_id` int,
	`title` varchar(255) NOT NULL,
	`description` text,
	`video_url` text,
	`thumbnail_url` text,
	`duration_seconds` int,
	`status` enum('draft','published') NOT NULL DEFAULT 'draft',
	`position` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_cohort_recordings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_cohort_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`course_id` int NOT NULL,
	`cohort_group_id` int,
	`title` varchar(255),
	`description` text,
	`session_date` datetime,
	`duration_minutes` int NOT NULL DEFAULT 60,
	`meeting_url` text,
	`recording_url` text,
	`status` enum('draft','published','cancelled') NOT NULL DEFAULT 'draft',
	`timezone` varchar(100) NOT NULL DEFAULT 'America/New_York',
	`recurrence_rule` enum('weekly','biweekly','monthly'),
	`recurrence_days_of_week` varchar(20),
	`recurrence_interval` int,
	`recurrence_end_date` datetime,
	`recurrence_occurrence_count` int,
	`parent_session_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lms_cohort_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_cohort_staff` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`cohort_session_id` int,
	`course_id` int,
	`cohort_group_id` int,
	`user_id` int NOT NULL,
	`role` enum('instructor','ta','facilitator') NOT NULL DEFAULT 'instructor',
	`can_add_assignments` tinyint NOT NULL DEFAULT 0,
	`can_add_recordings` tinyint NOT NULL DEFAULT 0,
	`can_add_sessions` tinyint NOT NULL DEFAULT 0,
	`can_manage_discussions` tinyint NOT NULL DEFAULT 0,
	`assigned_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_cohort_staff_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_cohort_submissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`assignment_id` int NOT NULL,
	`user_id` int NOT NULL,
	`submission_content` longtext,
	`submitted_at` timestamp NOT NULL DEFAULT (now()),
	`grade_received` decimal(5,2),
	`feedback` longtext,
	CONSTRAINT `lms_cohort_submissions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_collection_courses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`collection_id` int NOT NULL,
	`course_id` int NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	CONSTRAINT `lms_collection_courses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_collections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` longtext,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_collections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_course_instructors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`course_id` int NOT NULL,
	`instructor_id` int NOT NULL,
	`role` enum('primary','secondary') NOT NULL DEFAULT 'primary',
	`assigned_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_course_instructors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_courses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`slug` varchar(255) NOT NULL,
	`title` varchar(255) NOT NULL,
	`subtitle` varchar(500),
	`description` longtext,
	`cover_image_url` text,
	`status` enum('draft','public','hidden','private','archived') NOT NULL DEFAULT 'draft',
	`type` enum('course','quiz','download','cohort') NOT NULL DEFAULT 'course',
	`enrollment_close_date` timestamp,
	`price` decimal(10,2) NOT NULL DEFAULT '0',
	`is_free` boolean NOT NULL DEFAULT false,
	`bundle_only` boolean NOT NULL DEFAULT false,
	`currency` varchar(8) NOT NULL DEFAULT 'usd',
	`pricing_type` enum('free','one_time','subscription','payment_plan','trial_then_subscription') NOT NULL DEFAULT 'one_time',
	`subscription_interval` enum('monthly','quarterly','annual'),
	`trialDays` int,
	`accessDurationDays` int,
	`down_payment` decimal(10,2) DEFAULT '0',
	`installment_count` int DEFAULT 0,
	`installment_amount` decimal(10,2) DEFAULT '0',
	`installment_interval_days` int DEFAULT 30,
	`stripe_price_id` varchar(255),
	`meta_title` varchar(255),
	`meta_description` text,
	`meta_keywords` text,
	`has_certificate` boolean NOT NULL DEFAULT false,
	`certificate_template_id` int,
	`is_featured` boolean NOT NULL DEFAULT false,
	`is_drip` boolean NOT NULL DEFAULT false,
	`show_instructor` boolean NOT NULL DEFAULT false,
	`hide_progress` boolean NOT NULL DEFAULT false,
	`show_in_library` boolean NOT NULL DEFAULT true,
	`course_overview_top_blocks` longtext,
	`course_overview_blocks` longtext,
	`course_overview_bottom_blocks` longtext,
	`send_enrollment_email` boolean NOT NULL DEFAULT true,
	`primary_color` varchar(20) DEFAULT '#179ca3',
	`accent_color` varchar(20) DEFAULT '#0d9488',
	`gradient_from` varchar(20) DEFAULT '#179ca3',
	`gradient_to` varchar(20) DEFAULT '#0d9488',
	`gradient_direction` varchar(30) DEFAULT '135deg',
	`thumbnail_url` text,
	`custom_labels` longtext,
	`default_mark_complete` int NOT NULL DEFAULT 1,
	`player_theme` enum('light','dark') NOT NULL DEFAULT 'light',
	`player_color` varchar(20) DEFAULT '#00b4b4',
	`allow_group_purchase` boolean NOT NULL DEFAULT true,
	`created_by_user_id` int NOT NULL,
	`library_order` int NOT NULL DEFAULT 0,
	`publish_domain` varchar(255),
	`customDomain` varchar(255),
	`customDomainVerified` boolean NOT NULL DEFAULT false,
	`customDomainVerificationToken` varchar(128),
	`customDomainVerificationStatus` enum('unverified','pending','verified') NOT NULL DEFAULT 'unverified',
	`multi_cohort_mode` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lms_courses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_enrollments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`user_id` int NOT NULL,
	`course_id` int NOT NULL,
	`status` enum('active','completed','cancelled','expired') NOT NULL DEFAULT 'active',
	`enrolled_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	`expires_at` timestamp,
	`progress_percent` decimal(5,2) NOT NULL DEFAULT '0.00',
	`last_accessed_at` timestamp,
	`enrollment_type` enum('full','free_preview') NOT NULL DEFAULT 'full',
	`order_id` int,
	CONSTRAINT `lms_enrollments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_group_courses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`group_id` int NOT NULL,
	`course_id` int NOT NULL,
	CONSTRAINT `lms_group_courses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_group_seats` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`group_id` int NOT NULL,
	`user_id` int NOT NULL,
	`assigned_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_group_seats_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_groups` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` longtext,
	`seats` int DEFAULT 10,
	`manager_id` int,
	`manager_email` varchar(255),
	`manager_phone` varchar(50),
	`notes` longtext,
	`invite_token` varchar(100),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_groups_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_instructors` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`user_id` int NOT NULL,
	`bio` longtext,
	`profile_image_url` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_instructors_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_landing_pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`course_id` int NOT NULL,
	`hero_title` varchar(255),
	`hero_subtitle` text,
	`hero_image_url` text,
	`body_content` longtext,
	`cta_text` varchar(128) DEFAULT 'Enroll Now',
	`what_you_learn` longtext,
	`requirements` longtext,
	`is_custom` boolean NOT NULL DEFAULT false,
	`blocks` longtext,
	`seo_title` varchar(255),
	`seo_description` text,
	`seo_image` varchar(512),
	`publish_domain` varchar(255),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lms_landing_pages_id` PRIMARY KEY(`id`),
	CONSTRAINT `lms_landing_pages_course_id_unique` UNIQUE(`course_id`)
);
--> statement-breakpoint
CREATE TABLE `lms_lesson_bookmarks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`enrollment_id` int NOT NULL,
	`lesson_id` int NOT NULL,
	`bookmarked_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_lesson_bookmarks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_lesson_notes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`enrollment_id` int NOT NULL,
	`lesson_id` int NOT NULL,
	`note_content` longtext NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lms_lesson_notes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_lesson_progress` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`enrollment_id` int NOT NULL,
	`lesson_id` int NOT NULL,
	`status` enum('not_started','in_progress','completed') NOT NULL DEFAULT 'not_started',
	`completed_at` timestamp,
	`watch_time_seconds` int NOT NULL DEFAULT 0,
	`last_accessed_at` timestamp,
	CONSTRAINT `lms_lesson_progress_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_lessons` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int,
	`course_id` int,
	`section_id` int,
	`title` varchar(255) NOT NULL,
	`type` enum('video','text','quiz','download','embed','video_text') NOT NULL DEFAULT 'text',
	`content` longtext,
	`video_content` longtext,
	`embed_url` varchar(500),
	`media_asset_id` int,
	`position` int NOT NULL DEFAULT 0,
	`is_preview` boolean NOT NULL DEFAULT false,
	`preview_mode` enum('none','preview','preview_hide_after_purchase') NOT NULL DEFAULT 'none',
	`drip_days` int NOT NULL DEFAULT 0,
	`duration_minutes` int,
	`require_video_completion` int NOT NULL DEFAULT 0,
	`require_manual_complete` int,
	`effect_enabled` boolean DEFAULT false,
	`effect_trigger` varchar(20) DEFAULT 'lesson_start',
	`effect_banner_text` varchar(500),
	`effect_banner_bg_color` varchar(20),
	`effect_banner_text_color` varchar(20),
	`effect_sound` varchar(50),
	`effect_sound_url` varchar(500),
	`effect_confetti` boolean DEFAULT false,
	`effect_confetti_colors` varchar(500),
	`effect_confetti_mode` enum('fall','cannon') DEFAULT 'fall',
	`effect_banner_duration` int DEFAULT 5,
	`content_blocks` longtext,
	`learning_objectives` longtext,
	`show_instructor` enum('inherit','show','hide') NOT NULL DEFAULT 'inherit',
	`is_prerequisite` boolean NOT NULL DEFAULT false,
	`prerequisite_lesson_id` int,
	`meeting_link` varchar(1024),
	`live_start_at` bigint,
	`live_end_at` bigint,
	`comments_enabled` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lms_lessons_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`user_id` int,
	`course_id` int NOT NULL,
	`amount` decimal(12,2) NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'usd',
	`status` enum('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
	`stripe_payment_intent_id` varchar(255),
	`stripe_session_id` varchar(255),
	`stripe_subscription_id` varchar(255),
	`affiliate_id` int,
	`seats` int NOT NULL DEFAULT 1,
	`pricing_option_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lms_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_page_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`template_type` enum('page','block') NOT NULL DEFAULT 'page',
	`block_type` varchar(64),
	`blocks` longtext NOT NULL,
	`thumbnail_url` text,
	`org_id` int,
	`created_by` int,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `lms_page_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_pending_enrollments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`import_id` int NOT NULL,
	`lms_course_id` int NOT NULL,
	`thinkific_user_id` int,
	`thinkific_email` varchar(255) NOT NULL,
	`thinkific_name` varchar(255),
	`lms_user_id` int,
	`thinkific_enrolled_at` timestamp,
	`thinkific_completed_at` timestamp,
	`thinkific_progress_pct` int DEFAULT 0,
	`lms_pending_enrollment_status` enum('pending','activated','skipped') NOT NULL DEFAULT 'pending',
	`activated_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_pending_enrollments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_pricing_options` (
	`id` int AUTO_INCREMENT NOT NULL,
	`course_id` int NOT NULL,
	`label` varchar(255) NOT NULL,
	`sublabel` varchar(500),
	`pricing_type` enum('one_time','subscription','payment_plan','free') NOT NULL DEFAULT 'one_time',
	`price` decimal(10,2) NOT NULL DEFAULT '0',
	`stripe_price_id` varchar(255),
	`subscription_interval` enum('monthly','quarterly','annual'),
	`down_payment` decimal(10,2) DEFAULT '0',
	`installment_count` int DEFAULT 0,
	`installment_amount` decimal(10,2) DEFAULT '0',
	`installment_interval_days` int DEFAULT 30,
	`cta_label` varchar(100),
	`cta_url` varchar(2048),
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`stripe_payment_link_url` varchar(2048),
	`stripe_payment_link_id` varchar(255),
	`is_team_pricing` boolean NOT NULL DEFAULT false,
	`min_seats` int DEFAULT 2,
	`max_seats` int DEFAULT 100,
	`per_seat_price` decimal(10,2),
	`team_stripe_price_id` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lms_pricing_options_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_quiz_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`enrollment_id` int NOT NULL,
	`quiz_id` int NOT NULL,
	`score` decimal(5,2) NOT NULL,
	`passed` boolean NOT NULL,
	`attempt_number` int NOT NULL DEFAULT 1,
	`completed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_quiz_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_quiz_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`quiz_id` int NOT NULL,
	`type` enum('multiple_choice','true_false','short_answer') NOT NULL DEFAULT 'multiple_choice',
	`question` longtext NOT NULL,
	`explanation` longtext,
	`position` int NOT NULL DEFAULT 0,
	`points` int NOT NULL DEFAULT 1,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_quiz_questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_quizzes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`course_id` int NOT NULL,
	`lesson_id` int,
	`title` varchar(255) NOT NULL,
	`description` text,
	`passing_score` int NOT NULL DEFAULT 70,
	`attempts_allowed` int NOT NULL DEFAULT 1,
	`show_answers` boolean NOT NULL DEFAULT true,
	`randomize_questions` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lms_quizzes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_section_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`section_title` varchar(255) NOT NULL,
	`lessons_json` longtext NOT NULL,
	`lesson_count` int NOT NULL DEFAULT 0,
	`created_by_user_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lms_section_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_sections` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int,
	`course_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`position` int NOT NULL DEFAULT 0,
	`is_preview` boolean NOT NULL DEFAULT false,
	`drip_days` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_sections_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_thinkific_imports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`thinkific_course_id` int NOT NULL,
	`thinkific_course_name` varchar(255) NOT NULL,
	`thinkific_slug` varchar(255),
	`lms_course_id` int,
	`thinkific_status` enum('pending','running','complete','failed') NOT NULL DEFAULT 'pending',
	`imported_by_user_id` int NOT NULL,
	`sections_imported` int NOT NULL DEFAULT 0,
	`lessons_imported` int NOT NULL DEFAULT 0,
	`enrollments_pending` int NOT NULL DEFAULT 0,
	`enrollments_activated` int NOT NULL DEFAULT 0,
	`error_message` text,
	`import_log` longtext,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `lms_thinkific_imports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lms_video_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`enrollment_id` int NOT NULL,
	`lesson_id` int NOT NULL,
	`event_type` enum('play','pause','seek','complete') NOT NULL,
	`event_data` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `lms_video_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `magic_link_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(128) NOT NULL,
	`email` varchar(255) NOT NULL,
	`user_id` int,
	`redirect_to` varchar(512),
	`used_at` timestamp,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `magic_link_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `magic_link_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `media_access_grants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`rule_id` int NOT NULL,
	`user_id` int NOT NULL,
	`granted_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `media_access_grants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media_access_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`asset_id` int NOT NULL,
	`access_type` enum('public','private','restricted') NOT NULL DEFAULT 'private',
	`expires_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `media_access_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media_assets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`folder_id` int,
	`filename` varchar(255) NOT NULL,
	`mime_type` varchar(100) NOT NULL,
	`size` bigint NOT NULL,
	`s3_key` varchar(500) NOT NULL,
	`s3_url` text NOT NULL,
	`uploaded_by` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `media_assets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media_folders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`parent_folder_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `media_folders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media_upload_folders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`created_by` int,
	`created_at` bigint NOT NULL,
	CONSTRAINT `media_upload_folders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media_upload_responses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`block_id` varchar(128),
	`page_id` varchar(128),
	`page_type` varchar(64),
	`folder_id` int,
	`file_url` varchar(1024) NOT NULL,
	`file_key` varchar(512) NOT NULL,
	`file_name` varchar(512),
	`mime_type` varchar(128),
	`file_size` int,
	`created_at` bigint NOT NULL,
	CONSTRAINT `media_upload_responses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media_upload_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`uploaded_by` int NOT NULL,
	`status` enum('pending','completed','failed') NOT NULL DEFAULT 'pending',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	CONSTRAINT `media_upload_sessions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media_versions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`asset_id` int NOT NULL,
	`version_number` int NOT NULL,
	`s3_key` varchar(500) NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `media_versions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `media_view_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`asset_id` int NOT NULL,
	`viewed_by` int,
	`viewed_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `media_view_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `member_activity_events` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`userId` int,
	`orgId` int,
	`sessionKey` varchar(64),
	`eventType` enum('page_view','page_exit','session_start','session_heartbeat','session_end','video_play','video_pause','video_seek','video_complete','video_progress','lesson_start','lesson_complete','quiz_start','quiz_submit','download','link_click','button_click','search','enrollment','course_complete') NOT NULL,
	`pageUrl` varchar(2048),
	`pageTitle` varchar(500),
	`courseId` int,
	`lessonId` int,
	`quizId` int,
	`durationMs` int,
	`videoPositionSec` float,
	`videoDurationSec` float,
	`metadata` text,
	`userAgent` varchar(512),
	`referrer` varchar(2048),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `member_activity_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `membership_content` (
	`id` int AUTO_INCREMENT NOT NULL,
	`membershipId` int NOT NULL,
	`contentType` enum('course','digital_product','community','webinar') NOT NULL,
	`contentId` int NOT NULL,
	`addedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `membership_content_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `membership_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`membershipId` int NOT NULL,
	`userId` int NOT NULL,
	`status` enum('active','paused','cancelled','expired') NOT NULL DEFAULT 'active',
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	`cancelledAt` timestamp,
	`stripeSubscriptionId` varchar(255),
	CONSTRAINT `membership_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `membership_plan_access` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`plan_id` int NOT NULL,
	`resource_type` varchar(100) NOT NULL,
	`resource_id` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `membership_plan_access_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `membership_plans` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` longtext,
	`price` decimal(12,2) NOT NULL,
	`billing_interval` enum('monthly','quarterly','annual') NOT NULL,
	`stripe_price_id` varchar(255),
	`stripe_product_id` varchar(255),
	`stripe_payment_link_url` varchar(2048),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `membership_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `membership_rules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`membershipId` int NOT NULL,
	`triggerType` enum('course_purchase','product_purchase','webinar_registration','tag_added','manual') NOT NULL,
	`triggerEntityId` int,
	`triggerTag` varchar(255),
	`action` enum('add_to_membership','remove_from_membership') NOT NULL DEFAULT 'add_to_membership',
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `membership_rules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `membership_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`user_id` int NOT NULL,
	`plan_id` int NOT NULL,
	`status` enum('active','paused','cancelled') NOT NULL DEFAULT 'active',
	`start_date` timestamp NOT NULL DEFAULT (now()),
	`end_date` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `membership_subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`price` float NOT NULL DEFAULT 0,
	`billingInterval` enum('monthly','yearly','one_time') NOT NULL DEFAULT 'monthly',
	`trialDays` int DEFAULT 0,
	`courseAccess` enum('all','specific') NOT NULL DEFAULT 'all',
	`courseIds` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`memberCount` int NOT NULL DEFAULT 0,
	`stripe_price_id` varchar(255),
	`stripe_product_id` varchar(255),
	`stripe_payment_link_url` varchar(2048),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `memberships_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_bump_conversions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`bumpId` int NOT NULL,
	`orgId` int NOT NULL,
	`triggerOrderId` int,
	`bumpOrderId` int,
	`buyerEmail` varchar(255),
	`accepted` boolean NOT NULL DEFAULT false,
	`sessionId` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `order_bump_conversions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `order_bumps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`triggerProductType` enum('course','download','quiz') NOT NULL,
	`triggerProductId` int NOT NULL,
	`bumpProductType` enum('course','download','quiz') NOT NULL,
	`bumpProductId` int NOT NULL,
	`placement` enum('before_checkout','during_checkout','after_checkout') NOT NULL DEFAULT 'during_checkout',
	`headline` varchar(500),
	`description` text,
	`discountPercent` int DEFAULT 0,
	`discountedPrice` varchar(20),
	`landingPageJson` json,
	`buttonText` varchar(100) DEFAULT 'Add to Order',
	`declineText` varchar(100) DEFAULT 'No thanks',
	`imageUrl` text,
	`isActive` boolean NOT NULL DEFAULT true,
	`sortOrder` int NOT NULL DEFAULT 0,
	`pricing_option_id` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `order_bumps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `org_invoices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int NOT NULL,
	`user_id` int,
	`invoice_number` varchar(64) NOT NULL,
	`product_type` enum('course','download','bundle','membership','manual') NOT NULL DEFAULT 'manual',
	`product_id` int,
	`product_title` varchar(512) NOT NULL,
	`buyer_name` varchar(255),
	`buyer_email` varchar(320),
	`amount_paid` decimal(12,2) NOT NULL DEFAULT '0.00',
	`currency` varchar(8) NOT NULL DEFAULT 'usd',
	`status` enum('paid','pending','refunded') NOT NULL DEFAULT 'paid',
	`stripe_payment_intent_id` varchar(255),
	`stripe_checkout_session_id` varchar(255),
	`notes` text,
	`is_manual` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `org_invoices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `org_landing_pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`heroHeadline` varchar(255),
	`heroSubheadline` text,
	`heroCtaText` varchar(100),
	`heroCtaUrl` varchar(512),
	`heroBgColor` varchar(32) DEFAULT '#0f172a',
	`heroTextColor` varchar(32) DEFAULT '#ffffff',
	`aboutTitle` varchar(255),
	`aboutBody` text,
	`features` text,
	`accentColor` varchar(32) DEFAULT '#0ea5e9',
	`showCourses` boolean NOT NULL DEFAULT true,
	`isPublished` boolean NOT NULL DEFAULT true,
	`footerText` text,
	`blocksJson` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `org_landing_pages_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_landing_pages_orgId_unique` UNIQUE(`orgId`)
);
--> statement-breakpoint
CREATE TABLE `org_limit_overrides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`featureKey` varchar(100) NOT NULL,
	`limitValue` int NOT NULL,
	`overriddenByUserId` int,
	`note` varchar(255),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `org_limit_overrides_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `org_media_folders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `org_media_folders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `org_media_library` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`uploadedBy` int NOT NULL,
	`filename` varchar(500) NOT NULL,
	`mimeType` varchar(100) NOT NULL,
	`fileSize` int NOT NULL DEFAULT 0,
	`fileKey` varchar(1000) NOT NULL,
	`url` text NOT NULL,
	`altText` varchar(500),
	`tags` text,
	`source` enum('form','course','direct','other') NOT NULL DEFAULT 'direct',
	`sourceId` int,
	`durationSeconds` int,
	`captionsUrl` text,
	`transcriptJson` text,
	`folderId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `org_media_library_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `org_members` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('org_super_admin','org_admin','member','user') NOT NULL DEFAULT 'member',
	`memberSubRole` enum('basic_member','instructor','group_manager','group_member') DEFAULT 'basic_member',
	`invitedBy` int,
	`joinedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `org_members_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `org_merge_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`source_org_id` int NOT NULL,
	`target_org_id` int NOT NULL,
	`initiated_by` int NOT NULL,
	`status` enum('pending','in_progress','completed','failed') NOT NULL DEFAULT 'pending',
	`summary` json,
	`error_message` text,
	`created_at` bigint NOT NULL,
	`completed_at` bigint,
	CONSTRAINT `org_merge_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `org_payment_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`stripePublishableKey` varchar(255),
	`stripeSecretKey` varchar(255),
	`stripeConnectAccountId` varchar(255),
	`stripeConnectEnabled` boolean NOT NULL DEFAULT false,
	`stripeConnectOnboardingComplete` boolean NOT NULL DEFAULT false,
	`paypalEmail` varchar(320),
	`paypalEnabled` boolean NOT NULL DEFAULT false,
	`paypalClientId` varchar(255),
	`paypalClientSecret` varchar(255),
	`currency` varchar(10) NOT NULL DEFAULT 'USD',
	`autoEnrollNewMembers` boolean NOT NULL DEFAULT false,
	`autoEnrollCourseIds` text,
	`revenueShareJson` text,
	`invoicePrefix` varchar(20),
	`nextInvoiceNumber` int NOT NULL DEFAULT 1,
	`purchaseDescriptionTemplate` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `org_payment_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_payment_settings_orgId_unique` UNIQUE(`orgId`)
);
--> statement-breakpoint
CREATE TABLE `org_site_pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int NOT NULL,
	`slug` varchar(255) NOT NULL DEFAULT 'home',
	`title` varchar(255) NOT NULL DEFAULT 'Home',
	`blocks` json NOT NULL,
	`meta_title` varchar(255),
	`meta_description` text,
	`published_at` bigint,
	`created_at` bigint NOT NULL,
	`updated_at` bigint NOT NULL,
	CONSTRAINT `org_site_pages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `org_subscriptions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`plan` enum('free','starter','builder','pro','enterprise') NOT NULL DEFAULT 'free',
	`stripeSubscriptionId` varchar(255),
	`stripeCustomerId` varchar(255),
	`status` enum('active','trialing','past_due','cancelled','unpaid') NOT NULL DEFAULT 'active',
	`currentPeriodStart` timestamp,
	`currentPeriodEnd` timestamp,
	`cancelAtPeriodEnd` boolean NOT NULL DEFAULT false,
	`customPriceUsd` decimal(10,2),
	`customPriceLabel` varchar(100),
	`adminNotes` text,
	`assignedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `org_subscriptions_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_subscriptions_orgId_unique` UNIQUE(`orgId`)
);
--> statement-breakpoint
CREATE TABLE `org_themes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`bgMode` enum('light','dark') NOT NULL DEFAULT 'light',
	`primaryColor` varchar(32) NOT NULL DEFAULT '#189aa1',
	`accentColor` varchar(32) NOT NULL DEFAULT '#4ad9e0',
	`buttonColor` varchar(32),
	`buttonTextColor` varchar(32),
	`sidebarBgColor` varchar(32),
	`sidebarTextColor` varchar(32),
	`sidebarActiveColor` varchar(32),
	`pageBgColor` varchar(32),
	`fontFamily` varchar(128) NOT NULL DEFAULT 'Inter',
	`schoolName` varchar(255),
	`adminLogoUrl` text,
	`faviconUrl` text,
	`customCss` text,
	`studentPrimaryColor` varchar(32),
	`studentAccentColor` varchar(32),
	`studentTheme` enum('light','dark') DEFAULT 'light',
	`notificationSettings` text,
	`emailBranding` text,
	`watermarkImageUrl` text,
	`watermarkOpacity` int DEFAULT 30,
	`watermarkPosition` varchar(32) DEFAULT 'bottom-left',
	`watermarkSize` int DEFAULT 120,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `org_themes_id` PRIMARY KEY(`id`),
	CONSTRAINT `org_themes_orgId_unique` UNIQUE(`orgId`)
);
--> statement-breakpoint
CREATE TABLE `org_user_roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`userId` int NOT NULL,
	`role` enum('org_super_admin','org_admin','instructor','affiliate','member') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `org_user_roles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`description` text,
	`logoUrl` text,
	`ownerId` int NOT NULL,
	`maxStorageBytes` bigint DEFAULT 10737418240,
	`usedStorageBytes` bigint DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`subdomainEnabled` boolean NOT NULL DEFAULT false,
	`customSubdomain` varchar(100),
	`customDomain` varchar(255),
	`customSenderEmail` varchar(320),
	`customSenderName` varchar(255),
	`senderDomainVerified` boolean NOT NULL DEFAULT false,
	`senderDomainVerifiedAt` timestamp,
	`termsOfService` text,
	`privacyPolicy` text,
	`requireTermsAgreement` boolean NOT NULL DEFAULT false,
	`footerLinks` text,
	`isPrimary` boolean NOT NULL DEFAULT false,
	`stripeConnectAccountId` varchar(255),
	`stripeConnectStatus` enum('not_connected','pending','active','restricted','suspended') NOT NULL DEFAULT 'not_connected',
	`paymentGateway` enum('teachific_pay','own_gateway') NOT NULL DEFAULT 'own_gateway',
	`ownStripePublishableKey` varchar(255),
	`ownStripeSecretKeyEncrypted` text,
	`domainVerificationStatus` enum('unverified','pending','verified','failed') NOT NULL DEFAULT 'unverified',
	`domainVerifiedAt` timestamp,
	`domainVerificationError` varchar(500),
	`adminNotes` text,
	`seoTitle` varchar(60),
	`seoDescription` varchar(160),
	`seoKeywords` varchar(500),
	`seoOgImageUrl` text,
	`seoRobotsIndex` boolean NOT NULL DEFAULT true,
	`customCss` longtext,
	`ownSendGridKeyEncrypted` text,
	`embedAllowedDomains` text,
	`embedDefaultTheme` enum('light','dark','auto') NOT NULL DEFAULT 'auto',
	`embedAnalyticsEnabled` boolean NOT NULL DEFAULT true,
	`embedHideTeachificBranding` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `organizations_id` PRIMARY KEY(`id`),
	CONSTRAINT `organizations_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `page_builder_pages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`courseId` int,
	`pageType` enum('course_sales','school_home','custom','checkout','thank_you') NOT NULL DEFAULT 'course_sales',
	`slug` varchar(200),
	`title` varchar(255),
	`blocksJson` text NOT NULL DEFAULT ('[]'),
	`isPublished` boolean NOT NULL DEFAULT false,
	`showHeader` boolean NOT NULL DEFAULT true,
	`showFooter` boolean NOT NULL DEFAULT true,
	`metaTitle` varchar(255),
	`metaDescription` text,
	`customCss` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `page_builder_pages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `payout_requests` (
	`id` int AUTO_INCREMENT NOT NULL,
	`requestor_type` enum('affiliate','instructor') NOT NULL,
	`affiliate_id` int,
	`instructor_user_id` int,
	`amount` decimal(10,2) NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'USD',
	`payout_status` enum('pending','approved','paid','rejected') NOT NULL DEFAULT 'pending',
	`payment_method` varchar(64),
	`payment_reference` varchar(255),
	`notes` text,
	`reviewed_by_admin_id` int,
	`requested_at` timestamp NOT NULL DEFAULT (now()),
	`reviewed_at` timestamp,
	`paid_at` timestamp,
	CONSTRAINT `payout_requests_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `permissions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`packageId` int NOT NULL,
	`allowDownload` boolean NOT NULL DEFAULT false,
	`downloadRequiresAuth` boolean NOT NULL DEFAULT true,
	`maxPlaysPerUser` int,
	`maxTotalPlays` int,
	`playExpiresAt` timestamp,
	`allowEmbed` boolean NOT NULL DEFAULT true,
	`allowedEmbedDomains` text,
	`allowExternalLinks` boolean NOT NULL DEFAULT true,
	`requiresAuth` boolean NOT NULL DEFAULT true,
	`allowedOrgIds` text,
	`allowedUserIds` text,
	`shareToken` varchar(64),
	`shareTokenExpiresAt` timestamp,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `permissions_id` PRIMARY KEY(`id`),
	CONSTRAINT `permissions_packageId_unique` UNIQUE(`packageId`)
);
--> statement-breakpoint
CREATE TABLE `physical_product_orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`product_id` int NOT NULL,
	`pricing_option_id` int,
	`amount_paid` decimal(10,2) NOT NULL DEFAULT '0',
	`currency` varchar(8) NOT NULL DEFAULT 'usd',
	`stripe_payment_intent_id` varchar(255),
	`stripe_checkout_session_id` varchar(255),
	`shipping_name` varchar(255),
	`shipping_line1` varchar(255),
	`shipping_line2` varchar(255),
	`shipping_city` varchar(100),
	`shipping_state` varchar(100),
	`shipping_postal_code` varchar(20),
	`shipping_country` varchar(10),
	`physical_fulfillment_status` enum('pending','processing','shipped','delivered','cancelled','refunded') NOT NULL DEFAULT 'pending',
	`tracking_number` varchar(255),
	`tracking_carrier` varchar(100),
	`notes` text,
	`ordered_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `physical_product_orders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `physical_product_pricing_options` (
	`id` int AUTO_INCREMENT NOT NULL,
	`product_id` int NOT NULL,
	`label` varchar(255) NOT NULL,
	`sublabel` varchar(500),
	`physical_pricing_type` enum('one_time','free') NOT NULL DEFAULT 'one_time',
	`price` decimal(10,2) NOT NULL DEFAULT '0',
	`compare_at_price` decimal(10,2),
	`stripe_price_id` varchar(255),
	`cta_label` varchar(100),
	`sort_order` int NOT NULL DEFAULT 0,
	`is_active` boolean NOT NULL DEFAULT true,
	`stripe_payment_link_url` varchar(2048),
	`stripe_payment_link_id` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `physical_product_pricing_options_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `physical_products` (
	`id` int AUTO_INCREMENT NOT NULL,
	`slug` varchar(255) NOT NULL,
	`title` varchar(255) NOT NULL,
	`subtitle` varchar(500),
	`description` longtext,
	`details` longtext,
	`thumbnail_url` text,
	`price` decimal(10,2) NOT NULL DEFAULT '0',
	`compare_at_price` decimal(10,2),
	`is_free` boolean NOT NULL DEFAULT false,
	`currency` varchar(8) NOT NULL DEFAULT 'usd',
	`checkout_mode` enum('native','shopify','external') NOT NULL DEFAULT 'native',
	`shopify_product_url` text,
	`shopify_embed_code` longtext,
	`shopify_product_id` varchar(255),
	`external_checkout_url` text,
	`stripe_price_id` varchar(255),
	`stripe_product_id` varchar(255),
	`requires_shipping` boolean NOT NULL DEFAULT true,
	`shipping_countries` text,
	`status` enum('draft','published','hidden','private','archived') NOT NULL DEFAULT 'draft',
	`landing_headline` varchar(500),
	`landing_body` longtext,
	`landing_features` longtext,
	`landing_blocks` longtext,
	`org_id` int,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `physical_products_id` PRIMARY KEY(`id`),
	CONSTRAINT `physical_products_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `platform_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`allowPublicRegistration` boolean NOT NULL DEFAULT false,
	`maintenanceMode` boolean NOT NULL DEFAULT false,
	`platformName` varchar(255) NOT NULL DEFAULT 'Teachific',
	`supportEmail` varchar(320),
	`maxUploadSizeMb` int NOT NULL DEFAULT 500,
	`enterpriseMaxUploadSizeMb` int NOT NULL DEFAULT 5000,
	`logoUrl` text,
	`faviconUrl` text,
	`primaryColor` varchar(32) NOT NULL DEFAULT '#189aa1',
	`accentColor` varchar(32) NOT NULL DEFAULT '#4ad9e0',
	`buttonColor` varchar(32),
	`buttonTextColor` varchar(32),
	`sidebarBgColor` varchar(32),
	`sidebarTextColor` varchar(32),
	`sidebarActiveColor` varchar(32),
	`pageBgColor` varchar(32),
	`tagline` varchar(500),
	`headingFont` varchar(128) DEFAULT 'Inter',
	`bodyFont` varchar(128) DEFAULT 'Inter',
	`termsOfService` text,
	`privacyPolicy` text,
	`terms_url` varchar(2048),
	`privacy_url` varchar(2048),
	`watermarkImageUrl` text,
	`watermarkOpacity` int DEFAULT 30,
	`watermarkPosition` varchar(32) DEFAULT 'bottom-left',
	`watermarkSize` int DEFAULT 120,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `platform_settings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `play_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`packageId` int NOT NULL,
	`versionId` int,
	`userId` int,
	`orgId` int,
	`sessionToken` varchar(64) NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`lastActiveAt` timestamp NOT NULL DEFAULT (now()),
	`endedAt` timestamp,
	`durationSeconds` int DEFAULT 0,
	`completionStatus` enum('not_attempted','incomplete','completed','passed','failed','unknown') DEFAULT 'not_attempted',
	`scoreRaw` float,
	`scoreMax` float,
	`scoreMin` float,
	`scoreScaled` float,
	`ipAddress` varchar(45),
	`userAgent` text,
	`referrer` text,
	`country` varchar(2),
	`isCompleted` boolean NOT NULL DEFAULT false,
	`learnerName` varchar(255),
	`learnerEmail` varchar(320),
	`learnerId` varchar(128),
	`learnerGroup` varchar(128),
	`customData` text,
	`utmSource` varchar(128),
	`utmMedium` varchar(128),
	`utmCampaign` varchar(128),
	CONSTRAINT `play_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `play_sessions_sessionToken_unique` UNIQUE(`sessionToken`)
);
--> statement-breakpoint
CREATE TABLE `private_invites` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`productType` enum('course','download','quiz') NOT NULL,
	`productId` int NOT NULL,
	`email` varchar(320) NOT NULL,
	`inviteToken` varchar(64) NOT NULL,
	`invitedBy` int NOT NULL,
	`status` enum('pending','accepted','expired') NOT NULL DEFAULT 'pending',
	`expiresAt` timestamp,
	`acceptedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `private_invites_id` PRIMARY KEY(`id`),
	CONSTRAINT `private_invites_inviteToken_unique` UNIQUE(`inviteToken`)
);
--> statement-breakpoint
CREATE TABLE `question_bank_folders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`parentId` int,
	`name` varchar(255) NOT NULL,
	`description` text,
	`color` varchar(32),
	`sortOrder` int NOT NULL DEFAULT 0,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `question_bank_folders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `question_bank_items` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`folderId` int,
	`questionType` enum('mcq','tf','short_answer','long_answer','matching','multiple_select','image_choice','hotspot','ordering','fill_blank','numeric','rating_scale') NOT NULL DEFAULT 'mcq',
	`stem` text NOT NULL,
	`dataJson` longtext NOT NULL,
	`points` float NOT NULL DEFAULT 1,
	`difficulty` enum('easy','medium','hard') DEFAULT 'medium',
	`tags` text,
	`explanation` text,
	`createdBy` int NOT NULL,
	`usageCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `question_bank_items_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quiz_access_grants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quiz_id` int NOT NULL,
	`user_id` int NOT NULL,
	`granted_at` timestamp NOT NULL DEFAULT (now()),
	`expires_at` timestamp,
	`grant_source` enum('purchase','manual','org_member','course_enrollment') DEFAULT 'manual',
	`stripe_payment_intent_id` varchar(255),
	CONSTRAINT `quiz_access_grants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quiz_answer_choices` (
	`id` int AUTO_INCREMENT NOT NULL,
	`question_id` int NOT NULL,
	`choice_text` text,
	`choice_html` text,
	`choice_media_type` enum('none','image','video') DEFAULT 'none',
	`media_url` varchar(1024),
	`media_alt` varchar(255),
	`is_correct` boolean NOT NULL DEFAULT false,
	`sort_order` int NOT NULL DEFAULT 0,
	`match_pair_id` varchar(50),
	`match_side` enum('left','right'),
	`feedback_text` text,
	`feedback_media_url` varchar(1024),
	CONSTRAINT `quiz_answer_choices_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quiz_attempt_responses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`attempt_id` int NOT NULL,
	`question_id` int NOT NULL,
	`question_type` varchar(30) NOT NULL,
	`selected_choice_ids` json,
	`hotspot_click_x` decimal(6,2),
	`hotspot_click_y` decimal(6,2),
	`text_answer` text,
	`numeric_answer` decimal(15,4),
	`is_correct` boolean,
	`is_partially_correct` boolean DEFAULT false,
	`points_earned` int NOT NULL DEFAULT 0,
	`time_spent_seconds` int,
	`answered_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quiz_attempt_responses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quiz_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quiz_id` int NOT NULL,
	`user_id` int,
	`guest_email` varchar(255),
	`attempt_number` int NOT NULL DEFAULT 1,
	`attempt_status` enum('in_progress','completed','abandoned','timed_out') NOT NULL DEFAULT 'in_progress',
	`question_snapshot` json,
	`total_points` int NOT NULL DEFAULT 0,
	`earned_points` int NOT NULL DEFAULT 0,
	`score_percent` decimal(5,2),
	`passed` boolean,
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	`time_spent_seconds` int,
	`source_type` enum('standalone','lesson','funnel','landing_page') DEFAULT 'standalone',
	`source_lesson_id` int,
	`source_funnel_page_id` int,
	CONSTRAINT `quiz_attempts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quiz_bank_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int NOT NULL,
	`bank_id` int NOT NULL,
	`question_type` enum('mc','tf','ms','hotspot','puzzle','matching','sequence','numeric','short_answer','info_slide') NOT NULL DEFAULT 'mc',
	`question_text` text NOT NULL,
	`question_html` text,
	`q_media_type` enum('none','image','video') DEFAULT 'none',
	`media_url` varchar(1024),
	`media_alt` varchar(255),
	`hotspot_zones` json,
	`puzzle_config` json,
	`numeric_min` decimal(15,4),
	`numeric_max` decimal(15,4),
	`points` int NOT NULL DEFAULT 1,
	`partial_credit` boolean DEFAULT false,
	`penalty_points` int DEFAULT 0,
	`difficulty` enum('easy','medium','hard') DEFAULT 'medium',
	`explanation_text` text,
	`explanation_html` text,
	`exp_media_type` enum('none','image','video') DEFAULT 'none',
	`explanation_media_url` varchar(1024),
	`import_source` varchar(50),
	`import_job_id` int,
	`is_archived` boolean DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quiz_bank_questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quiz_bank_tags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`color` varchar(20) DEFAULT '#24abbc',
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quiz_bank_tags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quiz_banks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`is_default` boolean DEFAULT false,
	`question_count` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quiz_banks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quiz_import_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int NOT NULL,
	`bank_id` int,
	`imported_by_id` int NOT NULL,
	`import_source` enum('scorm','csv','xls') NOT NULL,
	`filename` varchar(255) NOT NULL,
	`file_url` varchar(1024),
	`import_status` enum('pending','parsing','preview_ready','importing','completed','failed') NOT NULL DEFAULT 'pending',
	`parsed_questions` json,
	`imported_count` int DEFAULT 0,
	`skipped_count` int DEFAULT 0,
	`error_log` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`completed_at` timestamp,
	CONSTRAINT `quiz_import_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quiz_question_overrides` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quiz_id` int NOT NULL,
	`question_id` int NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	`always_include` boolean NOT NULL DEFAULT true,
	CONSTRAINT `quiz_question_overrides_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quiz_question_pools` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quiz_id` int NOT NULL,
	`bank_id` int NOT NULL,
	`tag_id` int,
	`draw_count` int NOT NULL,
	`sort_order` int NOT NULL DEFAULT 0,
	CONSTRAINT `quiz_question_pools_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quiz_question_tags` (
	`question_id` int NOT NULL,
	`tag_id` int NOT NULL
);
--> statement-breakpoint
CREATE TABLE `quiz_questions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`quizId` int NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`questionType` enum('multiple_choice','true_false','short_answer','long_answer','matching','multiple_select','hotspot','ordering','fill_blank','numeric','rating_scale') NOT NULL DEFAULT 'multiple_choice',
	`questionText` text NOT NULL,
	`questionHtml` text,
	`imageUrl` text,
	`videoUrl` text,
	`videoType` varchar(20),
	`fileUrl` text,
	`fileLabel` varchar(255),
	`wordLimit` int,
	`charLimit` int,
	`rubric` text,
	`hotspotRegionsJson` text,
	`orderingItemsJson` text,
	`fillBlankAnswersJson` text,
	`numericAnswer` float,
	`numericTolerance` float,
	`ratingMin` int DEFAULT 1,
	`ratingMax` int DEFAULT 5,
	`ratingLabelsJson` text,
	`branchOnCorrect` int,
	`branchOnIncorrect` int,
	`explanation` text,
	`points` float NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quiz_questions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quiz_responses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`attemptId` int NOT NULL,
	`questionId` int NOT NULL,
	`responseText` text,
	`selectedChoiceIds` text,
	`isCorrect` boolean,
	`pointsEarned` float DEFAULT 0,
	`timeTakenSeconds` int,
	`answeredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `quiz_responses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `quizzes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`description` text,
	`cover_image_url` varchar(1024),
	`time_limit_seconds` int,
	`max_attempts` int,
	`pass_score_percent` int NOT NULL DEFAULT 70,
	`randomize_questions` boolean NOT NULL DEFAULT false,
	`randomize_answers` boolean NOT NULL DEFAULT false,
	`feedback_mode` enum('immediate','end','never') NOT NULL DEFAULT 'end',
	`show_correct_answers` boolean NOT NULL DEFAULT true,
	`show_explanations` boolean NOT NULL DEFAULT true,
	`allow_partial_credit` boolean NOT NULL DEFAULT true,
	`penalty_for_wrong` boolean NOT NULL DEFAULT false,
	`quiz_status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`visibility` enum('public','private','org_only') NOT NULL DEFAULT 'private',
	`theme_config` json,
	`price_amount` decimal(10,2) DEFAULT '0',
	`currency` varchar(8) DEFAULT 'usd',
	`stripe_product_id` varchar(255),
	`stripe_price_id` varchar(255),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `quizzes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `revenue_partners` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`shareType` enum('percentage','fixed') NOT NULL DEFAULT 'percentage',
	`shareValue` float NOT NULL DEFAULT 10,
	`appliesTo` enum('all','specific') NOT NULL DEFAULT 'all',
	`courseIds` text,
	`totalEarned` float NOT NULL DEFAULT 0,
	`totalPaid` float NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `revenue_partners_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scorm_data` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sessionId` int NOT NULL,
	`packageId` int NOT NULL,
	`userId` int,
	`cmiData` text,
	`suspendData` text,
	`lessonStatus` varchar(64),
	`lessonLocation` text,
	`score` float,
	`totalTime` varchar(32),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scorm_data_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sharing_abuse_flags` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`status` enum('flagged','confirmed','dismissed','warned') NOT NULL DEFAULT 'flagged',
	`distinct_ip_count` int NOT NULL DEFAULT 0,
	`ip_addresses` longtext,
	`detection_reason` text,
	`alert_sent_at` timestamp,
	`reviewed_at` timestamp,
	`reviewed_by` int,
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sharing_abuse_flags_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sonoQuizzes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`createdByUserId` int NOT NULL,
	`title` varchar(300) NOT NULL,
	`description` text,
	`timeLimitSeconds` int NOT NULL DEFAULT 20,
	`musicTrack` varchar(100),
	`theme` varchar(50) NOT NULL DEFAULT 'teal',
	`coverImageUrl` text,
	`sono_category` enum('Abdominal','Small Parts','Pelvic/Gyn','OB 1st Trimester','OB 2nd/3rd Trimester','Fetal Echo','Breast','Vascular','MSK','POCUS','Physics','General') NOT NULL DEFAULT 'General',
	`questionCount` int NOT NULL DEFAULT 0,
	`sono_status` enum('draft','published','archived') NOT NULL DEFAULT 'draft',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `sonoQuizzes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sso_tokens` (
	`id` int AUTO_INCREMENT NOT NULL,
	`token` varchar(128) NOT NULL,
	`user_id` int NOT NULL,
	`used_at` timestamp,
	`expires_at` timestamp NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sso_tokens_id` PRIMARY KEY(`id`),
	CONSTRAINT `sso_tokens_token_unique` UNIQUE(`token`)
);
--> statement-breakpoint
CREATE TABLE `subscription_plan_limits` (
	`id` int AUTO_INCREMENT NOT NULL,
	`plan` enum('free','starter','builder','pro','enterprise') NOT NULL,
	`featureKey` varchar(100) NOT NULL,
	`featureLabel` varchar(150) NOT NULL,
	`limitValue` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscription_plan_limits_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `support_tickets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(128) NOT NULL,
	`email` varchar(255) NOT NULL,
	`userId` int,
	`subject` varchar(255) NOT NULL,
	`category` enum('general','billing','technical','account','other') NOT NULL DEFAULT 'general',
	`message` text NOT NULL,
	`status` enum('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
	`staffNotes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `support_tickets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `teachable_integrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int NOT NULL,
	`api_key` varchar(512) NOT NULL,
	`school_name` varchar(255),
	`status` varchar(20) NOT NULL DEFAULT 'connected',
	`last_sync_at` timestamp,
	`last_sync_stats` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teachable_integrations_id` PRIMARY KEY(`id`),
	CONSTRAINT `teachable_integrations_org_id_unique` UNIQUE(`org_id`)
);
--> statement-breakpoint
CREATE TABLE `teachific_pay_charges` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`orgId` bigint NOT NULL,
	`stripeChargeId` varchar(128) NOT NULL,
	`stripePaymentIntentId` varchar(128),
	`stripeCheckoutSessionId` varchar(128),
	`amount` bigint NOT NULL,
	`platformFee` bigint NOT NULL DEFAULT 0,
	`netAmount` bigint NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'usd',
	`chargeStatus` enum('succeeded','pending','failed','refunded','partially_refunded') NOT NULL DEFAULT 'succeeded',
	`amountRefunded` bigint NOT NULL DEFAULT 0,
	`courseId` bigint,
	`learnerId` bigint,
	`learnerEmail` varchar(256),
	`isGroupRegistration` boolean NOT NULL DEFAULT false,
	`groupSize` bigint NOT NULL DEFAULT 1,
	`chargedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teachific_pay_charges_id` PRIMARY KEY(`id`),
	CONSTRAINT `teachific_pay_charges_stripeChargeId_unique` UNIQUE(`stripeChargeId`)
);
--> statement-breakpoint
CREATE TABLE `teachific_pay_disputes` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`orgId` bigint NOT NULL,
	`stripeDisputeId` varchar(128) NOT NULL,
	`stripeChargeId` varchar(128) NOT NULL,
	`stripePaymentIntentId` varchar(128),
	`amount` bigint NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'usd',
	`status` enum('warning_needs_response','warning_under_review','warning_closed','needs_response','under_review','charge_refunded','won','lost') NOT NULL DEFAULT 'needs_response',
	`reason` varchar(128),
	`evidenceDueBy` bigint,
	`evidenceSubmitted` boolean NOT NULL DEFAULT false,
	`courseId` bigint,
	`learnerId` bigint,
	`learnerEmail` varchar(256),
	`accessRevoked` boolean NOT NULL DEFAULT false,
	`adminNotes` text,
	`escalated` boolean NOT NULL DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `teachific_pay_disputes_id` PRIMARY KEY(`id`),
	CONSTRAINT `teachific_pay_disputes_stripeDisputeId_unique` UNIQUE(`stripeDisputeId`)
);
--> statement-breakpoint
CREATE TABLE `thinkific_integrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int NOT NULL,
	`subdomain` varchar(255) NOT NULL,
	`api_key` varchar(512) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'connected',
	`last_sync_at` timestamp,
	`last_sync_stats` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `thinkific_integrations_id` PRIMARY KEY(`id`),
	CONSTRAINT `thinkific_integrations_org_id_unique` UNIQUE(`org_id`)
);
--> statement-breakpoint
CREATE TABLE `user_activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`event_type` varchar(64) NOT NULL,
	`description` varchar(512) NOT NULL,
	`path` varchar(512),
	`ip_address` varchar(64),
	`user_agent` text,
	`metadata` json,
	`course_id` int,
	`lesson_id` int,
	`content_title` varchar(512),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_roles` (
	`id` int AUTO_INCREMENT NOT NULL,
	`user_id` int NOT NULL,
	`user_role_type` enum('diy_user','platform_admin','accreditation_manager','education_manager','education_admin','education_student','platform_owner','platform_moderator','instructor','team_admin','affiliate') NOT NULL,
	`grantedByLabId` int,
	`assignedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `user_roles_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('site_owner','site_admin','org_super_admin','org_admin','instructor','affiliate','member','user') NOT NULL DEFAULT 'member',
	`passwordHash` varchar(255),
	`emailVerified` boolean NOT NULL DEFAULT false,
	`emailVerificationToken` varchar(128),
	`emailVerificationExpiry` timestamp,
	`resetToken` varchar(128),
	`resetTokenExpiry` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	`quizCreatorAccess` enum('none','web','desktop','bundle') NOT NULL DEFAULT 'none',
	`quizCreatorTrialEndsAt` timestamp,
	`studioAccess` enum('none','web','desktop','bundle') NOT NULL DEFAULT 'none',
	`studioTrialEndsAt` timestamp,
	`creatorAccess` enum('none','web','desktop','bundle') NOT NULL DEFAULT 'none',
	`creatorTrialEndsAt` timestamp,
	`unsubscribeToken` varchar(128),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE `video_clips` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`mediaItemId` int NOT NULL,
	`label` varchar(255) NOT NULL DEFAULT 'Clip',
	`startSec` float NOT NULL DEFAULT 0,
	`endSec` float NOT NULL DEFAULT 0,
	`videoUrl` text,
	`videoKey` text,
	`captionsUrl` text,
	`captionsBaked` boolean NOT NULL DEFAULT false,
	`createdBy` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `video_clips_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webinar_funnel_steps` (
	`id` int AUTO_INCREMENT NOT NULL,
	`webinarId` int NOT NULL,
	`stepOrder` int DEFAULT 0,
	`stepType` enum('registration','confirmation','reminder','watch','offer','thankyou') NOT NULL,
	`title` varchar(255),
	`pageBlocksJson` json,
	`emailSubject` varchar(255),
	`emailBody` text,
	`triggerType` enum('immediate','delay','scheduled') DEFAULT 'immediate',
	`triggerDelayMinutes` int DEFAULT 0,
	`isActive` boolean DEFAULT true,
	CONSTRAINT `webinar_funnel_steps_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webinar_registrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`webinarId` int NOT NULL,
	`orgId` int NOT NULL,
	`firstName` varchar(128),
	`lastName` varchar(128),
	`email` varchar(320) NOT NULL,
	`phone` varchar(32),
	`customFields` json,
	`registeredAt` timestamp NOT NULL DEFAULT (now()),
	`attended` boolean DEFAULT false,
	`watchedSeconds` int DEFAULT 0,
	`completedAt` timestamp,
	`convertedAt` timestamp,
	`ipAddress` varchar(45),
	CONSTRAINT `webinar_registrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webinar_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`webinarId` int NOT NULL,
	`registrationId` int,
	`sessionToken` varchar(128) NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`lastHeartbeatAt` timestamp DEFAULT (now()),
	`endedAt` timestamp,
	`watchedSeconds` int DEFAULT 0,
	`peakViewerCount` int DEFAULT 0,
	`ipAddress` varchar(45),
	`userAgent` text,
	CONSTRAINT `webinar_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `webinar_sessions_sessionToken_unique` UNIQUE(`sessionToken`)
);
--> statement-breakpoint
CREATE TABLE `webinars` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orgId` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description` text,
	`type` enum('live','evergreen') NOT NULL DEFAULT 'evergreen',
	`videoSource` enum('upload','youtube','vimeo','zoom','teams','embed') DEFAULT 'youtube',
	`videoUrl` text,
	`videoFileUrl` text,
	`videoFileKey` text,
	`meetingUrl` text,
	`meetingId` varchar(128),
	`scheduledAt` timestamp,
	`durationMinutes` int DEFAULT 60,
	`timezone` varchar(64) DEFAULT 'America/New_York',
	`replayDelayMinutes` int DEFAULT 0,
	`aiViewersEnabled` boolean DEFAULT false,
	`aiViewersMin` int DEFAULT 50,
	`aiViewersMax` int DEFAULT 300,
	`aiViewersPeakAt` int DEFAULT 30,
	`salesPageBlocksJson` json,
	`thumbnailUrl` text,
	`requireRegistration` boolean DEFAULT true,
	`registrationFormFields` json,
	`postWebinarAction` enum('product','url','thankyou','none') DEFAULT 'none',
	`postWebinarProductId` int,
	`postWebinarUrl` text,
	`postWebinarMessage` text,
	`postWebinarDelaySeconds` int DEFAULT 0,
	`price` decimal(10,2) DEFAULT '0',
	`currency` varchar(8) DEFAULT 'usd',
	`pricing_type` enum('free','one_time','subscription') DEFAULT 'free',
	`stripe_price_id` varchar(255),
	`stripe_product_id` varchar(255),
	`stripe_payment_link_url` varchar(2048),
	`isPublished` boolean DEFAULT false,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webinars_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workshop_registrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workshop_id` int NOT NULL,
	`user_id` int,
	`first_name` varchar(100),
	`last_name` varchar(100),
	`email` varchar(255) NOT NULL,
	`phone` varchar(50),
	`status` varchar(20) NOT NULL DEFAULT 'registered',
	`amount_paid` decimal(10,2) DEFAULT '0.00',
	`currency` varchar(10) DEFAULT 'usd',
	`stripe_session_id` varchar(255),
	`stripe_payment_intent_id` varchar(255),
	`check_in_at` timestamp,
	`notes` text,
	`registered_at` timestamp NOT NULL DEFAULT (now()),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `workshop_registrations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `workshops` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int NOT NULL,
	`title` varchar(255) NOT NULL,
	`slug` varchar(255) NOT NULL,
	`description` text,
	`short_description` varchar(500),
	`cover_image_url` varchar(1024),
	`status` varchar(20) NOT NULL DEFAULT 'draft',
	`format` varchar(20) NOT NULL DEFAULT 'in_person',
	`location` varchar(255),
	`virtual_url` varchar(1024),
	`start_date` timestamp,
	`end_date` timestamp,
	`timezone` varchar(100) DEFAULT 'UTC',
	`max_attendees` int,
	`price` decimal(10,2) NOT NULL DEFAULT '0.00',
	`compare_at_price` decimal(10,2),
	`currency` varchar(10) NOT NULL DEFAULT 'usd',
	`is_free` boolean NOT NULL DEFAULT false,
	`stripe_product_id` varchar(255),
	`stripe_price_id` varchar(255),
	`checkout_slug` varchar(255),
	`landing_page_blocks` json,
	`checkout_page_blocks` json,
	`thank_you_page_blocks` json,
	`instructor_name` varchar(255),
	`instructor_bio` text,
	`instructor_image_url` varchar(1024),
	`tags` json,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workshops_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `zapier_webhook_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`webhook_id` int NOT NULL,
	`org_id` int NOT NULL,
	`event_type` varchar(100) NOT NULL,
	`payload` text,
	`response_status` int,
	`response_body` text,
	`success` boolean NOT NULL DEFAULT false,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `zapier_webhook_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `zapier_webhooks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`org_id` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`webhook_url` text NOT NULL,
	`secret` varchar(128),
	`event_type` varchar(100) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`last_triggered_at` timestamp,
	`last_status` varchar(20),
	`trigger_count` int NOT NULL DEFAULT 0,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `zapier_webhooks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `analytics_package_idx` ON `analytics_events` (`packageId`);--> statement-breakpoint
CREATE INDEX `analytics_org_idx` ON `analytics_events` (`orgId`);--> statement-breakpoint
CREATE INDEX `analytics_event_type_idx` ON `analytics_events` (`eventType`);