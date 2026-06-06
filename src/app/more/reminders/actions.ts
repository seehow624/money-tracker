'use server';

import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';

export type ReminderSettings = {
  dailyEntryEnabled: boolean;
  dailyEntryTime: string;
  billDueEnabled: boolean;
  billDueDaysBefore: number;
  budgetWarningEnabled: boolean;
  budgetWarningPct: number;
};

function ensureRow(): void {
  const existing = db
    .select()
    .from(schema.reminderSettings)
    .where(eq(schema.reminderSettings.id, 1))
    .get();
  if (!existing) {
    db.insert(schema.reminderSettings).values({ id: 1 }).run();
  }
}

export async function getReminderSettings(): Promise<ReminderSettings> {
  await requireAdmin();
  ensureRow();
  const row = db
    .select()
    .from(schema.reminderSettings)
    .where(eq(schema.reminderSettings.id, 1))
    .get()!;
  return {
    dailyEntryEnabled: row.dailyEntryEnabled,
    dailyEntryTime: row.dailyEntryTime,
    billDueEnabled: row.billDueEnabled,
    billDueDaysBefore: row.billDueDaysBefore,
    budgetWarningEnabled: row.budgetWarningEnabled,
    budgetWarningPct: row.budgetWarningPct,
  };
}

export async function saveReminderSettings(
  settings: Partial<ReminderSettings>,
): Promise<{ ok: boolean }> {
  await requireAdmin();
  ensureRow();
  const updates: Record<string, unknown> = {};
  if (settings.dailyEntryEnabled !== undefined) updates.dailyEntryEnabled = settings.dailyEntryEnabled;
  if (settings.dailyEntryTime !== undefined) updates.dailyEntryTime = settings.dailyEntryTime;
  if (settings.billDueEnabled !== undefined) updates.billDueEnabled = settings.billDueEnabled;
  if (settings.billDueDaysBefore !== undefined) updates.billDueDaysBefore = settings.billDueDaysBefore;
  if (settings.budgetWarningEnabled !== undefined) updates.budgetWarningEnabled = settings.budgetWarningEnabled;
  if (settings.budgetWarningPct !== undefined) updates.budgetWarningPct = settings.budgetWarningPct;
  if (Object.keys(updates).length === 0) return { ok: true };

  db.update(schema.reminderSettings)
    .set(updates)
    .where(eq(schema.reminderSettings.id, 1))
    .run();
  revalidatePath('/more/reminders');
  return { ok: true };
}
