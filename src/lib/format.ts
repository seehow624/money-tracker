// Currency helpers live in ./currency (pure, base-currency aware). Re-exported
// here so existing `@/lib/format` imports keep working.
export { fmtMoney, fmtCurrency, currencySymbol, BASE_CURRENCY, BASE_SYMBOL } from './currency';

import { BASE_LOCALE } from './currency';

export function fmtNum(n: number, digits = 2): string {
  return n.toLocaleString(BASE_LOCALE, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function fmtPct(n: number, digits = 0): string {
  return `${(n * 100).toFixed(digits)}%`;
}

export function fmtDate(iso: string): string {
  return iso;
}

export function thisMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function daysInMonth(yyyymm: string): number {
  const [y, m] = yyyymm.split('-').map(Number);
  return new Date(y, m, 0).getDate();
}

export function dayOfMonth(): number {
  return new Date().getDate();
}
