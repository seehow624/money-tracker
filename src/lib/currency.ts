// Currency registry + formatting.
//
// This is a PURE module (no server-only imports such as `db`) so it can be used
// from client components, server components, and standalone scripts alike.
//
// The active "base currency" (the one every balance/total is shown in) is NOT
// defined here — it's stored in the DB and read via `getBaseCurrency()` in
// `settings.ts` (server/scripts). Client components receive it as a prop. Pass
// the resolved code into `fmtCurrency`/`currencySymbol` below. The env var
// NEXT_PUBLIC_BASE_CURRENCY is only the initial default on a fresh install.

type CurrencyMeta = {
  /** Display symbol, e.g. "$", "RM", "S$". */
  symbol: string;
  /** Locale used for thousands grouping / digit formatting. */
  locale: string;
  /** Number of fraction digits (0 for yen/won/etc.). Defaults to 2. */
  decimals?: number;
};

// Common currencies with a display symbol and a sensible number locale.
// Add yours here if it's missing — any ISO 4217 code still works without an
// entry (it just renders the code itself as the "symbol").
export const CURRENCIES: Record<string, CurrencyMeta> = {
  USD: { symbol: '$', locale: 'en-US' },
  EUR: { symbol: '€', locale: 'en-IE' },
  GBP: { symbol: '£', locale: 'en-GB' },
  JPY: { symbol: '¥', locale: 'ja-JP', decimals: 0 },
  CNY: { symbol: '¥', locale: 'zh-CN' },
  AUD: { symbol: 'A$', locale: 'en-AU' },
  CAD: { symbol: 'C$', locale: 'en-CA' },
  CHF: { symbol: 'CHF', locale: 'de-CH' },
  SGD: { symbol: 'S$', locale: 'en-SG' },
  MYR: { symbol: 'RM', locale: 'en-MY' },
  HKD: { symbol: 'HK$', locale: 'en-HK' },
  TWD: { symbol: 'NT$', locale: 'zh-TW', decimals: 0 },
  INR: { symbol: '₹', locale: 'en-IN' },
  IDR: { symbol: 'Rp', locale: 'id-ID', decimals: 0 },
  THB: { symbol: '฿', locale: 'th-TH' },
  PHP: { symbol: '₱', locale: 'en-PH' },
  VND: { symbol: '₫', locale: 'vi-VN', decimals: 0 },
  KRW: { symbol: '₩', locale: 'ko-KR', decimals: 0 },
};

// The env default used on a fresh install, before anything is saved in the DB.
export const DEFAULT_BASE_CURRENCY = (
  process.env.NEXT_PUBLIC_BASE_CURRENCY || 'USD'
).toUpperCase();

/** All currency codes we have metadata for, for building a picker. */
export const CURRENCY_CODES = Object.keys(CURRENCIES);

export function currencyMeta(code: string): CurrencyMeta {
  return (
    CURRENCIES[code.toUpperCase()] ?? {
      symbol: code.toUpperCase(),
      locale: 'en-US',
    }
  );
}

/** Display symbol for a currency code, e.g. "USD" -> "$", "MYR" -> "RM". */
export function currencySymbol(code: string): string {
  return currencyMeta(code).symbol;
}

/** Format an amount that is already in `code`, e.g. "S$ 1,234.50". */
export function fmtCurrency(n: number, code: string): string {
  const meta = currencyMeta(code);
  const d = meta.decimals ?? 2;
  return `${meta.symbol} ${n.toLocaleString(meta.locale, {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })}`;
}
