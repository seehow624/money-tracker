CREATE TABLE `reminder_sent` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`kind` text NOT NULL,
	`date` text NOT NULL,
	`account_id` integer,
	`sent_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `reminder_sent_kind_date_idx` ON `reminder_sent` (`kind`,`date`,`account_id`);