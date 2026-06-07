// Currency helpers live in ./currency (pure). Re-exported here so existing
// `@/lib/format` imports keep working. The active base currency is resolved at
// runtime via getBaseCurrency() (server) and passed into these as `code`.
export {
  fmtCurrency,
  currencySymbol,
  currencyMeta,
  CURRENCY_CODES,
  DEFAULT_BASE_CURRENCY,
} from './currency';

export function fmtNum(n: number, digits = 2): string {
  return n.toLocaleString('en-US', {
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
