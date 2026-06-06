import 'dotenv/config';
import { rawDb } from '../src/db';

const PAIRS = [
  { base: 'SGD', target: 'MYR' },
  { base: 'USD', target: 'MYR' },
];

async function fetchRate(base: string, target: string): Promise<number> {
  const url = `https://api.frankfurter.app/latest?from=${base}&to=${target}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Frankfurter ${base}→${target} ${res.status}`);
  const data = (await res.json()) as { rates: Record<string, number> };
  const rate = data.rates[target];
  if (typeof rate !== 'number') throw new Error(`No rate in response`);
  return rate;
}

async function run() {
  const today = new Date().toISOString().slice(0, 10);

  for (const { base, target } of PAIRS) {
    try {
      const rate = await fetchRate(base, target);
      rawDb
        .prepare(
          `INSERT INTO fx_rates (date, base, to_currency, rate, source)
           VALUES (?, ?, ?, ?, 'frankfurter')
           ON CONFLICT(date, base, to_currency) DO UPDATE SET rate=excluded.rate, source='frankfurter'`,
        )
        .run(today, base, target, rate);
      console.log(`[fx] ${today}  1 ${base} = ${rate} ${target}`);
    } catch (e) {
      console.error(`[fx] ${base}→${target} failed:`, (e as Error).message);
    }
  }
}

run().catch((e) => {
  console.error('[fx] failed:', e);
  process.exit(1);
});
