import { rawDb } from '@/db';

/**
 * Look up the FX rate to convert `amount` from `currency` to MYR on the given date.
 * Falls back to the most recent rate before that date if the exact date is missing
 * (e.g. weekends, holidays — Frankfurter only publishes weekday rates).
 * Returns 1 for MYR or unknown currency.
 */
export function fxToMyr(
  currency: string,
  date: string,
): { rate: number; rateDate: string | null } {
  if (currency === 'MYR') return { rate: 1, rateDate: date };

  const r = rawDb
    .prepare(
      `SELECT date, rate FROM fx_rates
       WHERE base = ? AND to_currency = 'MYR' AND date <= ?
       ORDER BY date DESC
       LIMIT 1`,
    )
    .get(currency, date) as { date: string; rate: number } | undefined;

  if (r) return { rate: r.rate, rateDate: r.date };

  // No rate at all on or before — try the earliest rate available
  const fallback = rawDb
    .prepare(
      `SELECT date, rate FROM fx_rates
       WHERE base = ? AND to_currency = 'MYR'
       ORDER BY date ASC
       LIMIT 1`,
    )
    .get(currency) as { date: string; rate: number } | undefined;

  if (fallback) return { rate: fallback.rate, rateDate: fallback.date };

  return { rate: 1, rateDate: null };
}

export function convertToMyr(
  amount: number,
  currency: string,
  date: string,
): { amountMyr: number; fxRate: number } {
  const { rate } = fxToMyr(currency, date);
  return { amountMyr: amount * rate, fxRate: rate };
}
