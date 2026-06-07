'use server';

import { rawDb } from '@/db';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import {
  getBaseCurrency,
  setBaseCurrency,
  supportedCurrencies,
} from '@/lib/settings';
import { fxToBase } from '@/lib/fx';

async function fetchRate(from: string, to: string): Promise<number | null> {
  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=${from}&to=${to}`,
      { cache: 'no-store' },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { rates?: Record<string, number> };
    const rate = data.rates?.[to];
    return typeof rate === 'number' ? rate : null;
  } catch {
    return null;
  }
}

/**
 * Change the base currency everything is shown in. Because each transaction's
 * converted amount (`amount_myr`) is stored at write time and FX rates are
 * anchored to the base, switching requires:
 *   1. re-fetching today's rate for every foreign currency → new base, and
 *   2. recomputing `amount_myr` for every transaction.
 * Single-currency setups (every account already in the new base) skip the fetch
 * and just pass through 1:1. Admin only — the base currency is global.
 */
export async function changeBaseCurrency(formData: FormData): Promise<void> {
  await requireAdmin();

  const code = String(formData.get('currency') ?? '').trim().toUpperCase();
  if (!code || !supportedCurrencies().includes(code)) return;
  if (code === getBaseCurrency()) return;

  // Distinct foreign currencies actually in use across accounts.
  const foreign = (
    rawDb.prepare(`SELECT DISTINCT currency FROM accounts`).all() as {
      currency: string;
    }[]
  )
    .map((r) => r.currency?.toUpperCase())
    .filter((c): c is string => Boolean(c) && c !== code);

  const today = new Date().toISOString().slice(0, 10);
  for (const from of foreign) {
    const rate = await fetchRate(from, code);
    if (rate != null) {
      rawDb
        .prepare(
          `INSERT INTO fx_rates (date, base, to_currency, rate, source)
           VALUES (?, ?, ?, ?, 'frankfurter')
           ON CONFLICT(date, base, to_currency) DO UPDATE SET rate=excluded.rate, source='frankfurter'`,
        )
        .run(today, from, code, rate);
    }
    // If the fetch failed we still proceed; fxToBase falls back to the most
    // recent stored rate (or 1 if none), so totals stay sane.
  }

  // Switch the base, then recompute every stored conversion against it.
  setBaseCurrency(code);

  const rows = rawDb
    .prepare(`SELECT id, amount, currency, date FROM transactions`)
    .all() as { id: number; amount: number; currency: string; date: string }[];

  const update = rawDb.prepare(
    `UPDATE transactions SET amount_myr = ?, fx_rate = ? WHERE id = ?`,
  );
  const recompute = rawDb.transaction(
    (items: typeof rows) => {
      for (const t of items) {
        const { rate } = fxToBase(t.currency, t.date, code);
        update.run(t.amount * rate, rate, t.id);
      }
    },
  );
  recompute(rows);

  revalidatePath('/', 'layout');
}
