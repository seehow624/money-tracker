CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text DEFAULT 'member' NOT NULL,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_username_idx` ON `users` (`username`);--> statement-breakpoint
DROP INDEX `accounts_name_idx`;--> statement-breakpoint
ALTER TABLE `accounts` ADD `user_id` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_user_name_idx` ON `accounts` (`user_id`,`name`);--> statement-breakpoint
DROP INDEX `categories_parent_name_idx`;--> statement-breakpoint
ALTER TABLE `categories` ADD `user_id` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `categories_user_parent_name_idx` ON `categories` (`user_id`,`parent_id`,`name`);--> statement-breakpoint
DROP INDEX `transactions_fingerprint_idx`;--> statement-breakpoint
DROP INDEX `transactions_date_idx`;--> statement-breakpoint
ALTER TABLE `transactions` ADD `user_id` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_user_fingerprint_idx` ON `transactions` (`user_id`,`fingerprint`);--> statement-breakpoint
CREATE INDEX `transactions_user_date_idx` ON `transactions` (`user_id`,`date`);--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_monthly_budgets` (
	`user_id` integer DEFAULT 1 NOT NULL,
	`month` text NOT NULL,
	`total_myr` real NOT NULL,
	`notes` text,
	PRIMARY KEY(`user_id`, `month`)
);
--> statement-breakpoint
INSERT INTO `__new_monthly_budgets`("user_id", "month", "total_myr", "notes") SELECT 1, "month", "total_myr", "notes" FROM `monthly_budgets`;--> statement-breakpoint
DROP TABLE `monthly_budgets`;--> statement-breakpoint
ALTER TABLE `__new_monthly_budgets` RENAME TO `monthly_budgets`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `scheduled_rules` ADD `user_id` integer DEFAULT 1 NOT NULL;