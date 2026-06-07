// Base currency + currency formatting.
//
// This is a PURE module (no server-only imports such as `db`) so it can be used
// from client components, server components, and standalone scripts alike.
//
// The "base currency" is the single currency that every account balance and
// cross-account total is converted into for display. It is configured ONCE per
// install via the NEXT_PUBLIC_BASE_CURRENCY env var (default USD). Because each
// transaction's converted amount is computed and stored at write time, and FX
// rates are fetched anchored to the base currency, changing the base after you
// already have data would require re-fetching rates and recomputing every stored
// conversion — so treat it as install-time configuration.

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

export const BASE_CURRENCY = (
  process.env.NEXT_PUBLIC_BASE_CURRENCY || 'USD'
).toUpperCase();

export const BASE_LOCALE =
  CURRENCIES[BASE_CURRENCY]?.locale ?? 'en-US';

export const BASE_SYMBOL =
  CURRENCIES[BASE_CURRENCY]?.symbol ?? BASE_CURRENCY;

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

/** Format an amount that is already in the base currency. */
export function fmtMoney(n: number): string {
  return fmtCurrency(n, BASE_CURRENCY);
}
