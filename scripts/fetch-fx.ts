import { config } from 'dotenv';
config({ path: '.env.local' });
config(); // fall back to .env

import { rawDb } from '../src/db';
import { getBaseCurrency } from '../src/lib/settings';

const BASE_CURRENCY = getBaseCurrency();

// Fetch a daily rate for every foreign currency you actually use (any currency
// that appears on an account and isn't the base currency), converting it INTO
// the base currency. Rates come from the free Frankfurter API.
function foreignCurrencies(): string[] {
  const rows = rawDb
    .prepare(`SELECT DISTINCT currency FROM accounts`)
    .all() as { currency: string }[];
  return [
    ...new Set(
      rows
        .map((r) => r.currency?.toUpperCase())
        .filter((c): c is string => Boolean(c) && c !== BASE_CURRENCY),
    ),
  ];
}

async function fetchRate(from: string, to: string): Promise<number> {
  const url = `https://api.frankfurter.app/latest?from=${from}&to=${to}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Frankfurter ${from}→${to} ${res.status}`);
  const data = (await res.json()) as { rates: Record<string, number> };
  const rate = data.rates[to];
  if (typeof rate !== 'number') throw new Error(`No rate in response`);
  return rate;
}

async function run() {
  const today = new Date().toISOString().slice(0, 10);
  const currencies = foreignCurrencies();

  if (currencies.length === 0) {
    console.log(`[fx] no foreign currencies to fetch (base = ${BASE_CURRENCY})`);
    return;
  }

  for (const from of currencies) {
    try {
      const rate = await fetchRate(from, BASE_CURRENCY);
      rawDb
        .prepare(
          `INSERT INTO fx_rates (date, base, to_currency, rate, source)
           VALUES (?, ?, ?, ?, 'frankfurter')
           ON CONFLICT(date, base, to_currency) DO UPDATE SET rate=excluded.rate, source='frankfurter'`,
        )
        .run(today, from, BASE_CURRENCY, rate);
      console.log(`[fx] ${today}  1 ${from} = ${rate} ${BASE_CURRENCY}`);
    } catch (e) {
      console.error(`[fx] ${from}→${BASE_CURRENCY} failed:`, (e as Error).message);
    }
  }
}

run().catch((e) => {
  console.error('[fx] failed:', e);
  process.exit(1);
});
