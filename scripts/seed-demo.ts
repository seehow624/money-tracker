import { config } from 'dotenv';
config({ path: '.env.local' });
config(); // fall back to .env

import { db, schema, rawDb } from '../src/db';
import { eq } from 'drizzle-orm';
import { getBaseCurrency } from '../src/lib/settings';
import { convertToBase } from '../src/lib/fx';

// Populate a fresh install with a few months of realistic-looking sample
// transactions so the dashboard, stats and charts have something to show
// (handy for demos and screenshots). Idempotent: clears prior demo rows first.
// Run AFTER `npm run db:seed` (needs the example accounts + categories).
//
//   npm run db:seed         # accounts + categories
//   npm run db:seed-demo    # sample transactions

const base = getBaseCurrency();
const MONTHS_BACK = 4;

function userId(): number {
  const row = rawDb.prepare(`SELECT id FROM users ORDER BY id LIMIT 1`).get() as
    | { id: number }
    | undefined;
  return row?.id ?? 1;
}

function acctId(name: string): number | null {
  const r = db
    .select({ id: schema.accounts.id })
    .from(schema.accounts)
    .where(eq(schema.accounts.name, name))
    .get();
  return r?.id ?? null;
}

function catId(name: string): number | null {
  const r = rawDb
    .prepare(`SELECT id FROM categories WHERE name = ? AND parent_id IS NULL LIMIT 1`)
    .get(name) as { id: number } | undefined;
  return r?.id ?? null;
}

// Deterministic pseudo-random so demo data is stable across runs.
let _seed = 42;
function rand(): number {
  _seed = (_seed * 1103515245 + 12345) & 0x7fffffff;
  return _seed / 0x7fffffff;
}
function between(lo: number, hi: number): number {
  return Math.round((lo + rand() * (hi - lo)) * 100) / 100;
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

type Row = {
  date: string;
  amount: number;
  type: 'expense' | 'income' | 'transfer';
  account: string;
  toAccount?: string;
  category?: string;
  description: string;
  paidBy?: string;
};

function monthStart(offset: number): Date {
  const d = new Date();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() - offset);
  return d;
}
function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function dayOf(monthOffset: number, day: number): string {
  const d = monthStart(monthOffset);
  d.setUTCDate(day);
  return iso(d);
}

const EXPENSES: { category: string; desc: string[]; lo: number; hi: number; account: string[] }[] = [
  { category: 'Food & Dining', desc: ['Lunch', 'Coffee', 'Dinner out', 'Groceries', 'Takeaway'], lo: 6, hi: 60, account: ['Credit Card', 'E-Wallet', 'Cash'] },
  { category: 'Transportation', desc: ['Fuel', 'Parking', 'Ride share', 'Toll'], lo: 3, hi: 70, account: ['Credit Card', 'E-Wallet'] },
  { category: 'Shopping', desc: ['Clothes', 'Online order', 'Electronics'], lo: 15, hi: 180, account: ['Credit Card'] },
  { category: 'Subscription', desc: ['Streaming', 'Cloud storage', 'Software'], lo: 5, hi: 25, account: ['Credit Card'] },
  { category: 'Entertainment', desc: ['Movie', 'Game', 'Concert'], lo: 8, hi: 90, account: ['Credit Card', 'E-Wallet'] },
  { category: 'Bills & Utilities', desc: ['Phone bill', 'Internet', 'Electricity', 'Water'], lo: 20, hi: 120, account: ['Bank'] },
  { category: 'Health & Beauty', desc: ['Pharmacy', 'Gym', 'Haircut'], lo: 10, hi: 80, account: ['Credit Card', 'Cash'] },
];

const rows: Row[] = [];

for (let m = MONTHS_BACK - 1; m >= 0; m--) {
  // Monthly salary
  rows.push({
    date: dayOf(m, 1),
    amount: 5200,
    type: 'income',
    account: 'Bank',
    category: 'Income',
    description: 'Salary',
  });
  // Monthly transfer to savings
  rows.push({
    date: dayOf(m, 2),
    amount: 800,
    type: 'transfer',
    account: 'Bank',
    toAccount: 'Savings',
    description: 'Monthly savings',
  });
  // ~18-26 expenses spread across the month
  const n = Math.floor(between(18, 26));
  for (let i = 0; i < n; i++) {
    const e = pick(EXPENSES);
    const day = Math.min(28, 1 + Math.floor(rand() * 27));
    rows.push({
      date: dayOf(m, day),
      amount: between(e.lo, e.hi),
      type: 'expense',
      account: pick(e.account),
      category: e.category,
      description: pick(e.desc),
      paidBy: rand() < 0.08 ? 'mom' : 'me',
    });
  }
}

const uid = userId();
let inserted = 0;
let skipped = 0;

rawDb.exec('BEGIN');
try {
  // Clear previous demo rows so re-running is idempotent.
  db.delete(schema.transactions).where(eq(schema.transactions.source, 'demo')).run();

  const insert = db.insert(schema.transactions);
  let idx = 0;
  for (const r of rows) {
    const aId = acctId(r.account);
    const toId = r.toAccount ? acctId(r.toAccount) : null;
    const cId = r.category ? catId(r.category) : null;
    if (aId == null || (r.toAccount && toId == null)) {
      skipped++;
      continue;
    }
    const { amountBase, fxRate } = convertToBase(r.amount, base, r.date, base);
    insert
      .values({
        userId: uid,
        date: r.date,
        amount: r.amount,
        currency: base,
        amountMyr: amountBase,
        fxRate,
        type: r.type,
        categoryId: r.type === 'transfer' ? null : cId,
        accountId: aId,
        toAccountId: toId,
        description: r.description,
        paidBy: r.paidBy ?? 'me',
        source: 'demo',
        fingerprint: `demo:${idx++}`,
      })
      .run();
    inserted++;
  }
  rawDb.exec('COMMIT');
} catch (e) {
  rawDb.exec('ROLLBACK');
  throw e;
}

console.log(`[seed-demo] inserted ${inserted} sample transactions (skipped ${skipped}).`);
console.log(`[seed-demo] base currency: ${base}. Re-run anytime — it replaces prior demo rows.`);
