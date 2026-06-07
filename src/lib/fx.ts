import { rawDb } from '@/db';
import { getBaseCurrency } from './settings';

/**
 * Look up the FX rate to convert `amount` from `currency` to the base currency
 * on the given date. Falls back to the most recent rate before that date if the
 * exact date is missing (e.g. weekends, holidays — Frankfurter only publishes
 * weekday rates). Returns 1 for the base currency or an unknown currency.
 *
 * Pass `base` explicitly in hot loops (e.g. recompute) to avoid re-reading it.
 */
export function fxToBase(
  currency: string,
  date: string,
  base: string = getBaseCurrency(),
): { rate: number; rateDate: string | null } {
  if (currency.toUpperCase() === base) return { rate: 1, rateDate: date };

  const r = rawDb
    .prepare(
      `SELECT date, rate FROM fx_rates
       WHERE base = ? AND to_currency = ? AND date <= ?
       ORDER BY date DESC
       LIMIT 1`,
    )
    .get(currency, base, date) as
    | { date: string; rate: number }
    | undefined;

  if (r) return { rate: r.rate, rateDate: r.date };

  // No rate at all on or before — try the earliest rate available
  const fallback = rawDb
    .prepare(
      `SELECT date, rate FROM fx_rates
       WHERE base = ? AND to_currency = ?
       ORDER BY date ASC
       LIMIT 1`,
    )
    .get(currency, base) as { date: string; rate: number } | undefined;

  if (fallback) return { rate: fallback.rate, rateDate: fallback.date };

  return { rate: 1, rateDate: null };
}

/**
 * Convert `amount` (in `currency`) to the base currency on `date`.
 * Returns the converted amount plus the FX rate used. The converted figure is
 * persisted as `transactions.amountMyr` (column `amount_myr`, kept under its
 * historical name) — i.e. "amount in base currency".
 */
export function convertToBase(
  amount: number,
  currency: string,
  date: string,
  base: string = getBaseCurrency(),
): { amountBase: number; fxRate: number } {
  const { rate } = fxToBase(currency, date, base);
  return { amountBase: amount * rate, fxRate: rate };
}
