import { sql } from 'drizzle-orm';
import {
  sqliteTable,
  integer,
  text,
  real,
  uniqueIndex,
  index,
  primaryKey,
} from 'drizzle-orm/sqlite-core';

export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    username: text('username').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role', { enum: ['admin', 'member'] })
      .notNull()
      .default('member'),
    createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  },
  (t) => [uniqueIndex('users_username_idx').on(t.username)],
);

export const accounts = sqliteTable(
  'accounts',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').notNull().default(1),
    name: text('name').notNull(),
    type: text('type', {
      enum: ['bank', 'credit_card', 'ewallet', 'cash', 'investment'],
    }).notNull(),
    currency: text('currency').notNull(),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    displayOrder: integer('display_order').notNull().default(0),
    notes: text('notes'),
    startingBalance: real('starting_balance').notNull().default(0),
    startingBalanceDate: text('starting_balance_date'),
    statementDay: integer('statement_day'), // CC: day of month statement closes (1-31)
    paymentDay: integer('payment_day'),     // CC: day of month payment due (1-31)
    createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  },
  (t) => [uniqueIndex('accounts_user_name_idx').on(t.userId, t.name)],
);

export const categories = sqliteTable(
  'categories',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').notNull().default(1),
    name: text('name').notNull(),
    parentId: integer('parent_id'),
    isIncome: integer('is_income', { mode: 'boolean' })
      .notNull()
      .default(false),
    monthlyBudgetMyr: real('monthly_budget_myr'),
    icon: text('icon'),
    color: text('color'),
    displayOrder: integer('display_order').notNull().default(0),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
  },
  (t) => [
    uniqueIndex('categories_user_parent_name_idx').on(
      t.userId,
      t.parentId,
      t.name,
    ),
    index('categories_parent_idx').on(t.parentId),
  ],
);

export const transactions = sqliteTable(
  'transactions',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    userId: integer('user_id').notNull().default(1),
    date: text('date').notNull(), // ISO date YYYY-MM-DD
    amount: real('amount').notNull(),
    currency: text('currency').notNull(),
    amountMyr: real('amount_myr').notNull(),
    fxRate: real('fx_rate').notNull().default(1),

    type: text('type', {
      enum: ['expense', 'income', 'transfer'],
    }).notNull(),

    categoryId: integer('category_id'),
    subcategoryId: integer('subcategory_id'),

    accountId: integer('account_id').notNull(),
    toAccountId: integer('to_account_id'),

    description: text('description'),
    payee: text('payee'),
    receiptNo: text('receipt_no'),

    fingerprint: text('fingerprint').notNull(),
    source: text('source').notNull().default('manual'),
    rawData: text('raw_data'), // JSON string

    isBusiness: integer('is_business', { mode: 'boolean' })
      .notNull()
      .default(false),
    businessSplitPct: integer('business_split_pct'),

    isRecurring: integer('is_recurring', { mode: 'boolean' })
      .notNull()
      .default(false),
    recurringId: integer('recurring_id'),

    paidBy: text('paid_by').notNull().default('me'),

    notes: text('notes'),
    createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
    updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  },
  (t) => [
    uniqueIndex('transactions_user_fingerprint_idx').on(
      t.userId,
      t.fingerprint,
    ),
    index('transactions_user_date_idx').on(t.userId, t.date),
    index('transactions_account_idx').on(t.accountId),
    index('transactions_category_idx').on(t.categoryId),
    index('transactions_type_idx').on(t.type),
  ],
);

export const monthlyBudgets = sqliteTable(
  'monthly_budgets',
  {
    userId: integer('user_id').notNull().default(1),
    month: text('month').notNull(), // YYYY-MM
    totalMyr: real('total_myr').notNull(),
    notes: text('notes'),
  },
  (t) => [primaryKey({ columns: [t.userId, t.month] })],
);

export const scheduledRules = sqliteTable('scheduled_rules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  userId: integer('user_id').notNull().default(1),
  name: text('name').notNull(),
  type: text('type', {
    enum: ['expense', 'income', 'transfer'],
  }).notNull().default('expense'),
  amount: real('amount').notNull(),
  // Column-level default only; the app always supplies the account/base currency
  // explicitly, so this literal is effectively never used.
  currency: text('currency').notNull().default('MYR'),
  accountId: integer('account_id').notNull(),
  toAccountId: integer('to_account_id'),
  categoryId: integer('category_id'),
  description: text('description'),
  paidBy: text('paid_by').notNull().default('me'),
  notes: text('notes'),
  dayOfMonth: integer('day_of_month').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date'),
  nextDueDate: text('next_due_date').notNull(),
  lastRunDate: text('last_run_date'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const recurring = sqliteTable('recurring', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  amount: real('amount').notNull(),
  currency: text('currency').notNull(),
  accountId: integer('account_id'),
  categoryId: integer('category_id'),
  dayOfMonth: integer('day_of_month'),
  active: integer('active', { mode: 'boolean' }).notNull().default(true),
  lastSeen: text('last_seen'),
  notes: text('notes'),
});

export const fxRates = sqliteTable(
  'fx_rates',
  {
    date: text('date').notNull(),
    base: text('base').notNull(),
    toCurrency: text('to_currency').notNull(),
    rate: real('rate').notNull(),
    source: text('source').notNull().default('manual'),
  },
  (t) => [uniqueIndex('fx_date_pair_idx').on(t.date, t.base, t.toCurrency)],
);

export const imports = sqliteTable('imports', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  source: text('source').notNull(),
  fileName: text('file_name'),
  fileHash: text('file_hash'),
  rowsInserted: integer('rows_inserted').notNull().default(0),
  rowsSkipped: integer('rows_skipped').notNull().default(0),
  startedAt: text('started_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  completedAt: text('completed_at'),
  notes: text('notes'),
});

export const reminderSettings = sqliteTable('reminder_settings', {
  id: integer('id').primaryKey().default(1),
  dailyEntryEnabled: integer('daily_entry_enabled', { mode: 'boolean' }).notNull().default(true),
  dailyEntryTime: text('daily_entry_time').notNull().default('21:00'),
  billDueEnabled: integer('bill_due_enabled', { mode: 'boolean' }).notNull().default(true),
  billDueDaysBefore: integer('bill_due_days_before').notNull().default(3),
  budgetWarningEnabled: integer('budget_warning_enabled', { mode: 'boolean' }).notNull().default(true),
  budgetWarningPct: integer('budget_warning_pct').notNull().default(80),
});

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value'),
  updatedAt: text('updated_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
});

export const aiProfiles = sqliteTable(
  'ai_profiles',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    baseUrl: text('base_url').notNull(),
    apiKey: text('api_key'),
    createdAt: text('created_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  },
  (t) => [uniqueIndex('ai_profiles_name_idx').on(t.name)],
);

export const reminderSent = sqliteTable(
  'reminder_sent',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    kind: text('kind').notNull(), // 'daily_entry' | 'bill_due' | 'budget_warning'
    date: text('date').notNull(), // YYYY-MM-DD
    accountId: integer('account_id'), // only for bill_due
    sentAt: text('sent_at').default(sql`(CURRENT_TIMESTAMP)`).notNull(),
  },
  (t) => [
    uniqueIndex('reminder_sent_kind_date_idx').on(t.kind, t.date, t.accountId),
  ],
);

export type Account = typeof accounts.$inferSelect;
export type Category = typeof categories.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
