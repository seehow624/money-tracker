'use server';

import { db, schema, rawDb } from '@/db';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { assertOwnedAccounts, assertOwnedCategories } from '@/lib/ownership';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function toInt(v: FormDataEntryValue | null): number | null {
  if (v == null || String(v).trim() === '') return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}
function toFloat(v: FormDataEntryValue | null): number | null {
  if (v == null || String(v).trim() === '') return null;
  const n = parseFloat(String(v).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/**
 * Compute first run date given startDate (YYYY-MM-DD) and dayOfMonth (1-31).
 * If startDate already has the right day, that's it. Otherwise, next occurrence
 * of dayOfMonth on/after startDate.
 */
function computeNextDueDate(startDate: string, dayOfMonth: number): string {
  const [y, m, d] = startDate.split('-').map(Number);
  const startObj = new Date(Date.UTC(y, m - 1, d));
  // Try this month
  const lastDayOfMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cap = Math.min(dayOfMonth, lastDayOfMonth);
  let next = new Date(Date.UTC(y, m - 1, cap));
  if (next < startObj) {
    // Move to next month
    const nm = m; // m here is 1-12, Date(y, m, ...) goes to next month 0-indexed
    const lastNext = new Date(Date.UTC(y, nm + 1, 0)).getUTCDate();
    next = new Date(Date.UTC(y, nm, Math.min(dayOfMonth, lastNext)));
  }
  return next.toISOString().slice(0, 10);
}

export async function saveScheduledRule(formData: FormData): Promise<void> {
  const { userId } = await requireSession();
  const id = toInt(formData.get('id'));
  const name = String(formData.get('name') ?? '').trim();
  const type = String(formData.get('type') ?? 'expense') as
    | 'expense'
    | 'income'
    | 'transfer';
  const amount = toFloat(formData.get('amount'));
  const accountId = toInt(formData.get('accountId'));
  const toAccountId = toInt(formData.get('toAccountId'));
  const categoryId = toInt(formData.get('categoryId'));
  const description = String(formData.get('description') ?? '').trim();
  const paidBy =
    String(formData.get('paidBy') ?? 'me').trim() || 'me';
  const dayOfMonth = toInt(formData.get('dayOfMonth'));
  const startDate = String(formData.get('startDate') ?? '').trim();
  const endDate = String(formData.get('endDate') ?? '').trim();
  const active = formData.get('active') === 'on';

  if (!name) return;
  if (!['expense', 'income', 'transfer'].includes(type)) return;
  if (amount == null || amount <= 0) return;
  if (accountId == null) return;
  if (type === 'transfer' && toAccountId == null) return;
  if (dayOfMonth == null || dayOfMonth < 1 || dayOfMonth > 31) return;
  if (!DATE_RE.test(startDate)) return;
  if (endDate && !DATE_RE.test(endDate)) return;

  // Defense-in-depth: ensure all referenced ids belong to the current user.
  const accIds: number[] = [accountId];
  if (type === 'transfer' && toAccountId != null) accIds.push(toAccountId);
  assertOwnedAccounts(accIds, userId);
  if (type !== 'transfer' && categoryId != null) {
    assertOwnedCategories([categoryId], userId);
  }

  const nextDueDate = computeNextDueDate(startDate, dayOfMonth);

  const accCurrency =
    db
      .select({ c: schema.accounts.currency })
      .from(schema.accounts)
      .where(
        and(
          eq(schema.accounts.id, accountId),
          eq(schema.accounts.userId, userId),
        ),
      )
      .get()?.c ?? 'MYR';

  const values = {
    name,
    type,
    amount,
    currency: accCurrency,
    accountId,
    toAccountId: type === 'transfer' ? toAccountId : null,
    categoryId: type === 'transfer' ? null : categoryId,
    description: description || null,
    paidBy,
    dayOfMonth,
    startDate,
    endDate: endDate || null,
    nextDueDate,
    active,
  };

  if (id) {
    db.update(schema.scheduledRules)
      .set(values)
      .where(
        and(
          eq(schema.scheduledRules.id, id),
          eq(schema.scheduledRules.userId, userId),
        ),
      )
      .run();
  } else {
    db.insert(schema.scheduledRules).values({ ...values, userId }).run();
  }

  revalidatePath('/more/scheduled');
  revalidatePath('/more');
  redirect('/more/scheduled');
}

export async function deleteScheduledRule(formData: FormData): Promise<void> {
  const { userId } = await requireSession();
  const id = toInt(formData.get('id'));
  if (id == null) return;
  rawDb
    .prepare('DELETE FROM scheduled_rules WHERE id=? AND user_id=?')
    .run(id, userId);
  revalidatePath('/more/scheduled');
  revalidatePath('/more');
  redirect('/more/scheduled');
}

export async function toggleScheduledRule(formData: FormData): Promise<void> {
  const { userId } = await requireSession();
  const id = toInt(formData.get('id'));
  if (id == null) return;
  const cur = db
    .select({ active: schema.scheduledRules.active })
    .from(schema.scheduledRules)
    .where(
      and(
        eq(schema.scheduledRules.id, id),
        eq(schema.scheduledRules.userId, userId),
      ),
    )
    .get();
  if (!cur) return;
  db.update(schema.scheduledRules)
    .set({ active: !cur.active })
    .where(
      and(
        eq(schema.scheduledRules.id, id),
        eq(schema.scheduledRules.userId, userId),
      ),
    )
    .run();
  revalidatePath('/more/scheduled');
}
