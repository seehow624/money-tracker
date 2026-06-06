CREATE TABLE `accounts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`currency` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `accounts_name_idx` ON `accounts` (`name`);--> statement-breakpoint
CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`parent_id` integer,
	`is_income` integer DEFAULT false NOT NULL,
	`monthly_budget_myr` real,
	`icon` text,
	`color` text,
	`display_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_parent_name_idx` ON `categories` (`parent_id`,`name`);--> statement-breakpoint
CREATE INDEX `categories_parent_idx` ON `categories` (`parent_id`);--> statement-breakpoint
CREATE TABLE `fx_rates` (
	`date` text NOT NULL,
	`base` text NOT NULL,
	`to_currency` text NOT NULL,
	`rate` real NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fx_date_pair_idx` ON `fx_rates` (`date`,`base`,`to_currency`);--> statement-breakpoint
CREATE TABLE `imports` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`file_name` text,
	`file_hash` text,
	`rows_inserted` integer DEFAULT 0 NOT NULL,
	`rows_skipped` integer DEFAULT 0 NOT NULL,
	`started_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`completed_at` text,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `monthly_budgets` (
	`month` text PRIMARY KEY NOT NULL,
	`total_myr` real NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `recurring` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text NOT NULL,
	`account_id` integer,
	`category_id` integer,
	`day_of_month` integer,
	`active` integer DEFAULT true NOT NULL,
	`last_seen` text,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`date` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text NOT NULL,
	`amount_myr` real NOT NULL,
	`fx_rate` real DEFAULT 1 NOT NULL,
	`type` text NOT NULL,
	`category_id` integer,
	`subcategory_id` integer,
	`account_id` integer NOT NULL,
	`to_account_id` integer,
	`description` text,
	`payee` text,
	`receipt_no` text,
	`fingerprint` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`raw_data` text,
	`is_business` integer DEFAULT false NOT NULL,
	`business_split_pct` integer,
	`is_recurring` integer DEFAULT false NOT NULL,
	`recurring_id` integer,
	`paid_by` text DEFAULT 'me' NOT NULL,
	`notes` text,
	`created_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL,
	`updated_at` text DEFAULT (CURRENT_TIMESTAMP) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_fingerprint_idx` ON `transactions` (`fingerprint`);--> statement-breakpoint
CREATE INDEX `transactions_date_idx` ON `transactions` (`date`);--> statement-breakpoint
CREATE INDEX `transactions_account_idx` ON `transactions` (`account_id`);--> statement-breakpoint
CREATE INDEX `transactions_category_idx` ON `transactions` (`category_id`);--> statement-breakpoint
CREATE INDEX `transactions_type_idx` ON `transactions` (`type`);