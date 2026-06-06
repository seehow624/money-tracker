CREATE TABLE `reminder_settings` (
	`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
	`daily_entry_enabled` integer DEFAULT true NOT NULL,
	`daily_entry_time` text DEFAULT '21:00' NOT NULL,
	`bill_due_enabled` integer DEFAULT true NOT NULL,
	`bill_due_days_before` integer DEFAULT 3 NOT NULL,
	`budget_warning_enabled` integer DEFAULT true NOT NULL,
	`budget_warning_pct` integer DEFAULT 80 NOT NULL
);
