'use server';

import { db, schema, rawDb } from '@/db';
import { eq, sql, and, isNotNull, desc } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import crypto from 'node:crypto';
import { convertToBase } from '@/lib/fx';
import { BASE_CURRENCY } from '@/lib/currency';
import { requireSession } from '@/lib/auth';
import { assertOwnedAccounts, assertOwnedCategories } from '@/lib/ownership';

const MONTH_RE = /^\d{4}-\d{2}-\d{2}$/;

function newFingerprint(): string {
  return `manual:${Date.now()}:${crypto.randomBytes(6).toString('hex')}`;
}

/** Only allow same-origin paths starting with `/`, no `//` (protocol-relative) or `://`. */
function safeReturnTo(raw: string | null): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v.startsWith('/')) return null;
  if (v.startsWith('//')) return null;
  if (v.includes('://')) return null;
  return v;
}

function appendQuery(url: string, key: string, value: string): string {
  const hashIdx = url.indexOf('#');
  const base = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
  const hash = hashIdx >= 0 ? url.slice(hashIdx) : '';
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}${key}=${value}${hash}`;
}

function parseFloatSafe(v: FormDataEntryValue | null): number | null {
  if (v === null) return null;
  const s = String(v).replace(/,/g, '').trim();
  if (s === '') return null;
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : null;
}

function parseIntSafe(v: FormDataEntryValue | null): number | null {
  if (v === null || String(v).trim() === '') return null;
  const n = parseInt(String(v), 10);
  return Number.isFinite(n) ? n : null;
}

function inferCurrency(accountId: number, userId: number): string {
  const acct = db
    .select({ currency: schema.accounts.currency })
    .from(schema.accounts)
    .where(
      and(
        eq(schema.accounts.id, accountId),
        eq(schema.accounts.userId, userId),
      ),
    )
    .get();
  return acct?.currency ?? BASE_CURRENCY;
}

export async function saveTransaction(formData: FormData): Promise<void> {
  const { userId } = await requireSession();
  const id = parseIntSafe(formData.get('id'));
  const type = String(formData.get('type') ?? '') as
    | 'expense'
    | 'income'
    | 'transfer';
  const date = String(formData.get('date') ?? '');
  const amount = parseFloatSafe(formData.get('amount'));
  const accountId = parseIntSafe(formData.get('accountId'));
  const toAccountId = parseIntSafe(formData.get('toAccountId'));
  const categoryId = parseIntSafe(formData.get('categoryId'));
  const description = String(formData.get('description') ?? '').trim();
  const paidBy = String(formData.get('paidBy') ?? 'me').trim() || 'me';
  const notes = String(formData.get('notes') ?? '').trim();

  if (!['expense', 'income', 'transfer'].includes(type)) return;
  if (!MONTH_RE.test(date)) return;
  if (amount == null || amount <= 0) return;
  if (accountId == null) return;
  if (type === 'transfer' && toAccountId == null) return;
  if (type !== 'transfer' && categoryId == null) return; // category required for income/expense

  // Defense-in-depth: ensure all referenced ids belong to the current user.
  const accIds: number[] = [accountId];
  if (type === 'transfer' && toAccountId != null) accIds.push(toAccountId);
  assertOwnedAccounts(accIds, userId);
  if (type !== 'transfer' && categoryId != null) {
    assertOwnedCategories([categoryId], userId);
  }

  const currency = inferCurrency(accountId, userId);
  const { amountBase: amountMyr, fxRate } = convertToBase(amount, currency, date);

  const baseValues = {
    date,
    amount,
    currency,
    amountMyr,
    fxRate,
    type,
    categoryId: type === 'transfer' ? null : categoryId,
    accountId,
    toAccountId: type === 'transfer' ? toAccountId : null,
    description: description || null,
    paidBy,
    notes: notes || null,
  };

  if (id) {
    // Update — keep existing fingerprint and source
    db.update(schema.transactions)
      .set({
        ...baseValues,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(schema.transactions.id, id),
          eq(schema.transactions.userId, userId),
        ),
      )
      .run();
  } else {
    // Insert — generate new fingerprint, set source=manual
    db.insert(schema.transactions)
      .values({
        ...baseValues,
        userId,
        source: 'manual',
        isBusiness: false,
        isRecurring: false,
        fingerprint: newFingerprint(),
      })
      .run();
  }

  revalidatePath('/');
  revalidatePath('/stats');
  revalidatePath('/balances');
  revalidatePath('/more');

  const returnTo = safeReturnTo(formData.get('returnTo') as string | null);
  redirect(returnTo ?? `/?month=${date.slice(0, 7)}`);
}

export type CategorySuggestion = {
  id: number;
  name: string;
  confidence: number; // 0..1, count / max-count among suggestions
};

export async function suggestCategory(
  description: string,
  type: 'expense' | 'income' = 'expense',
): Promise<CategorySuggestion | null> {
  const { userId } = await requireSession();
  const q = description.trim().toLowerCase();
  if (q.length < 2) return null;

  // Find historical transactions with similar description, group by category, pick most common
  const rows = db
    .select({
      categoryId: schema.transactions.categoryId,
      categoryName: schema.categories.name,
      n: sql<number>`COUNT(*)`,
    })
    .from(schema.transactions)
    .innerJoin(
      schema.categories,
      eq(schema.categories.id, schema.transactions.categoryId),
    )
    .where(
      and(
        sql`LOWER(${schema.transactions.description}) LIKE ${`%${q}%`}`,
        eq(schema.transactions.type, type),
        isNotNull(schema.transactions.categoryId),
        eq(schema.transactions.userId, userId),
      ),
    )
    .groupBy(
      schema.transactions.categoryId,
      schema.categories.name,
    )
    .orderBy(desc(sql`COUNT(*)`))
    .limit(3)
    .all();

  if (rows.length === 0 || !rows[0].categoryId) return null;
  const top = rows[0];
  const total = rows.reduce((s, r) => s + r.n, 0);
  return {
    id: top.categoryId!,
    name: top.categoryName,
    confidence: total > 0 ? top.n / total : 1,
  };
}

export async function deleteTransaction(formData: FormData): Promise<void> {
  const { userId } = await requireSession();
  const id = parseIntSafe(formData.get('id'));
  if (id == null) return;

  const existing = db
    .select()
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.id, id),
        eq(schema.transactions.userId, userId),
      ),
    )
    .get();
  if (!existing) return;

  rawDb
    .prepare('DELETE FROM transactions WHERE id=? AND user_id=?')
    .run(id, userId);

  revalidatePath('/');
  revalidatePath('/stats');
  revalidatePath('/balances');

  // Pass deleted snapshot via URL so a Toast on the next page can offer Undo
  const snapshot = encodeURIComponent(
    JSON.stringify({
      date: existing.date,
      amount: existing.amount,
      currency: existing.currency,
      amountMyr: existing.amountMyr,
      fxRate: existing.fxRate,
      type: existing.type,
      categoryId: existing.categoryId,
      accountId: existing.accountId,
      toAccountId: existing.toAccountId,
      description: existing.description,
      paidBy: existing.paidBy,
      notes: existing.notes,
      source: existing.source,
    }),
  );

  const returnTo = safeReturnTo(formData.get('returnTo') as string | null);
  const base = returnTo ?? `/?month=${existing.date.slice(0, 7)}`;
  redirect(appendQuery(base, 'undo', snapshot));
}

export async function bulkUpdate(formData: FormData): Promise<void> {
  const { userId } = await requireSession();
  const idsRaw = formData.getAll('ids');
  const ids = idsRaw
    .map((v) => parseInt(String(v), 10))
    .filter(Number.isFinite);
  if (ids.length === 0) return;

  const action = String(formData.get('action') ?? '');
  const value = String(formData.get('value') ?? '').trim();

  if (action === 'paid_by' && value) {
    const placeholders = ids.map(() => '?').join(',');
    rawDb
      .prepare(
        `UPDATE transactions SET paid_by=?, updated_at=CURRENT_TIMESTAMP WHERE id IN (${placeholders}) AND user_id=?`,
      )
      .run(value, ...ids, userId);
  } else if (action === 'category' && value) {
    const cid = parseInt(value, 10);
    if (!Number.isFinite(cid)) return;
    const placeholders = ids.map(() => '?').join(',');
    rawDb
      .prepare(
        `UPDATE transactions SET category_id=?, updated_at=CURRENT_TIMESTAMP WHERE id IN (${placeholders}) AND user_id=?`,
      )
      .run(cid, ...ids, userId);
  } else if (action === 'delete') {
    const placeholders = ids.map(() => '?').join(',');
    rawDb
      .prepare(
        `DELETE FROM transactions WHERE id IN (${placeholders}) AND user_id=?`,
      )
      .run(...ids, userId);
  } else {
    return;
  }

  revalidatePath('/');
  revalidatePath('/stats');
  revalidatePath('/balances');
  revalidatePath('/search');
}

export async function restoreTransaction(formData: FormData): Promise<void> {
  const { userId } = await requireSession();
  const dataStr = String(formData.get('data') ?? '');
  if (!dataStr) return;
  let snap: Record<string, unknown>;
  try {
    snap = JSON.parse(dataStr) as Record<string, unknown>;
  } catch {
    return;
  }

  const date = String(snap.date ?? '');
  if (!date) return;

  db.insert(schema.transactions)
    .values({
      userId,
      date,
      amount: Number(snap.amount ?? 0),
      currency: String(snap.currency ?? BASE_CURRENCY),
      amountMyr: Number(snap.amountMyr ?? 0),
      fxRate: Number(snap.fxRate ?? 1),
      type: snap.type as 'expense' | 'income' | 'transfer',
      categoryId: snap.categoryId == null ? null : Number(snap.categoryId),
      accountId: Number(snap.accountId),
      toAccountId: snap.toAccountId == null ? null : Number(snap.toAccountId),
      description: (snap.description as string | null) ?? null,
      paidBy: String(snap.paidBy ?? 'me'),
      notes: (snap.notes as string | null) ?? null,
      source: String(snap.source ?? 'manual'),
      isBusiness: false,
      isRecurring: false,
      fingerprint: newFingerprint(),
    })
    .run();

  revalidatePath('/');
  revalidatePath('/stats');
  revalidatePath('/balances');
  redirect(`/?month=${date.slice(0, 7)}`);
}
