'use server';

import { db, schema } from '@/db';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { setAccountTypeOrder } from '@/lib/settings';
import type { AccountType } from '@/lib/account-meta';

export async function saveBalances(formData: FormData): Promise<void> {
  const { userId } = await requireSession();
  const fallbackDate = new Date().toISOString().slice(0, 10);
  const accts = db
    .select()
    .from(schema.accounts)
    .where(eq(schema.accounts.userId, userId))
    .all();

  for (const a of accts) {
    const raw = formData.get(`balance_${a.id}`);
    if (raw === null || raw === '') continue;
    const v = parseFloat(String(raw).replace(/,/g, ''));
    if (!Number.isFinite(v)) continue;

    const dateRaw = formData.get(`date_${a.id}`);
    const date =
      typeof dateRaw === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateRaw)
        ? dateRaw
        : fallbackDate;

    db.update(schema.accounts)
      .set({ startingBalance: v, startingBalanceDate: date })
      .where(
        and(
          eq(schema.accounts.id, a.id),
          eq(schema.accounts.userId, userId),
        ),
      )
      .run();
  }

  revalidatePath('/balances');
  revalidatePath('/');
}

// Persist the custom account ordering set on the Accounts page: the order of
// the type groups, plus the order of accounts within them (flattened into a
// single sequential display_order across the user's accounts).
export async function saveAccountOrder(input: {
  typeOrder: AccountType[];
  accountIds: number[];
}): Promise<void> {
  const { userId } = await requireSession();

  setAccountTypeOrder(userId, input.typeOrder);

  let order = 0;
  for (const id of input.accountIds) {
    if (!Number.isFinite(id)) continue;
    db.update(schema.accounts)
      .set({ displayOrder: order++ })
      .where(
        and(eq(schema.accounts.id, id), eq(schema.accounts.userId, userId)),
      )
      .run();
  }

  revalidatePath('/balances');
  revalidatePath('/');
  revalidatePath('/transactions/new');
}

export async function clearBalance(formData: FormData) {
  const { userId } = await requireSession();
  const id = parseInt(String(formData.get('id')), 10);
  if (!Number.isFinite(id)) return;
  db.update(schema.accounts)
    .set({ startingBalance: 0, startingBalanceDate: null })
    .where(
      and(
        eq(schema.accounts.id, id),
        eq(schema.accounts.userId, userId),
      ),
    )
    .run();
  revalidatePath('/balances');
  revalidatePath('/');
}
