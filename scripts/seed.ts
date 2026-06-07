import { config } from 'dotenv';
config({ path: '.env.local' });
config(); // fall back to .env

import { db, schema, rawDb } from '../src/db';
import { eq, and, isNull } from 'drizzle-orm';
import { getBaseCurrency, setBaseCurrency } from '../src/lib/settings';

// Resolve the base currency (DB value, or NEXT_PUBLIC_BASE_CURRENCY, or USD) and
// persist it so the app/UI agree with what we seed accounts in.
const BASE_CURRENCY = getBaseCurrency();
setBaseCurrency(BASE_CURRENCY);

type AccountSeed = {
  name: string;
  type: 'bank' | 'credit_card' | 'ewallet' | 'cash';
  currency: string;
  active?: boolean;
  notes?: string;
};

// A different currency to the base, just to demonstrate multi-currency support
// (the dashboard converts it to the base currency via FX rates).
const FOREIGN = BASE_CURRENCY === 'USD' ? 'EUR' : 'USD';

// Example accounts — edit this list to match your own banks, cards and wallets.
// `type` is one of: bank | credit_card | ewallet | cash. `currency` is any ISO code;
// here everything defaults to your base currency except one foreign demo account.
const ACCOUNTS: AccountSeed[] = [
  // Banks
  { name: 'Bank', type: 'bank', currency: BASE_CURRENCY, notes: 'Primary account' },
  { name: 'Savings', type: 'bank', currency: BASE_CURRENCY },
  { name: 'Foreign Account', type: 'bank', currency: FOREIGN },

  // Credit cards
  { name: 'Credit Card', type: 'credit_card', currency: BASE_CURRENCY },

  // E-wallets
  { name: 'E-Wallet', type: 'ewallet', currency: BASE_CURRENCY },

  // Cash
  { name: 'Cash', type: 'cash', currency: BASE_CURRENCY },
];

type SubCat = string;
type CatSeed = {
  name: string;
  isIncome?: boolean;
  monthlyBudgetMyr?: number;
  subs?: SubCat[];
};

const CATEGORIES: CatSeed[] = [
  // Income
  { name: 'Interest Earned', isIncome: true },
  { name: 'Cash Back', isIncome: true },
  { name: 'Bonus', isIncome: true },
  { name: 'Gift', isIncome: true },
  { name: 'Income', isIncome: true },

  // Expense
  {
    name: 'Food & Dining',
    monthlyBudgetMyr: 700,
    subs: ['Eating Out', 'Beverages', 'Grocery', 'Food Delivery'],
  },
  {
    name: 'Transportation',
    monthlyBudgetMyr: 400,
    subs: ['Petrol', 'Parking', 'Tolls', 'Public Transport'],
  },
  { name: 'Shopping', monthlyBudgetMyr: 500, subs: ['Clothing', 'Apps/Webs'] },
  {
    name: 'Subscription',
    monthlyBudgetMyr: 280,
    subs: ['AI Sub', 'Software', 'Cloud Storage', 'Other'],
  },
  {
    name: 'Entertainment',
    monthlyBudgetMyr: 150,
    subs: ['Streaming', 'Games', 'Movie'],
  },
  {
    name: 'Bills & Utilities',
    monthlyBudgetMyr: 550,
    subs: ['Phone', 'Internet', 'Water', 'Electricity', 'License & Tax'],
  },
  {
    name: 'Health & Beauty',
    monthlyBudgetMyr: 400,
    subs: ['Gym', 'Medicine', 'Hair', 'Skincare', 'Health Check-up'],
  },
  { name: 'Insurance', monthlyBudgetMyr: 560, subs: ['Life', 'Car', 'Medical'] },
  { name: 'Self-development', subs: ['Course', 'Books'] },
  { name: 'Travel', subs: ['Accommodation', 'Transport'] },
  { name: 'Pet', subs: ['Vet', 'Pet Food', 'Pet Accessories'] },
  {
    name: 'Gift',
    monthlyBudgetMyr: 400,
    subs: ['Wedding', 'Donation'],
  },
  {
    name: 'Household',
    subs: ['Appliances', 'Furniture', 'Home Supplies'],
  },
  {
    name: 'Assets',
    subs: ['Electronics', 'Equipment'],
  },
  {
    name: 'Daily Supplies',
    subs: ['Toiletries', 'Cleaning', 'Other Consumables'],
  },
  { name: 'Other', monthlyBudgetMyr: 100, subs: ['Bank Fee', 'Service Fee'] },
];

const MONTHLY_BUDGET_TOTAL = 5000; // example total in your base currency

async function seed() {
  console.log('[seed] starting');

  rawDb.exec('BEGIN');
  try {
    // Accounts
    let acctOrder = 0;
    for (const a of ACCOUNTS) {
      const existing = db
        .select()
        .from(schema.accounts)
        .where(eq(schema.accounts.name, a.name))
        .get();
      if (existing) {
        console.log(`  [acct] skip existing: ${a.name}`);
        continue;
      }
      db.insert(schema.accounts)
        .values({
          name: a.name,
          type: a.type,
          currency: a.currency,
          active: a.active ?? true,
          displayOrder: acctOrder++,
          notes: a.notes,
        })
        .run();
      console.log(`  [acct] +${a.name}`);
    }

    // Categories
    let catOrder = 0;
    for (const c of CATEGORIES) {
      let parent = db
        .select()
        .from(schema.categories)
        .where(
          and(
            eq(schema.categories.name, c.name),
            isNull(schema.categories.parentId),
          ),
        )
        .get();

      if (!parent) {
        const inserted = db
          .insert(schema.categories)
          .values({
            name: c.name,
            isIncome: c.isIncome ?? false,
            monthlyBudgetMyr: c.monthlyBudgetMyr,
            displayOrder: catOrder++,
          })
          .returning()
          .get();
        parent = inserted;
        console.log(`  [cat] +${c.name}`);
      } else {
        console.log(`  [cat] skip existing: ${c.name}`);
      }

      if (c.subs) {
        let subOrder = 0;
        for (const sub of c.subs) {
          const existsSub = db
            .select()
            .from(schema.categories)
            .where(
              and(
                eq(schema.categories.name, sub),
                eq(schema.categories.parentId, parent.id),
              ),
            )
            .get();
          if (existsSub) continue;
          db.insert(schema.categories)
            .values({
              name: sub,
              parentId: parent.id,
              isIncome: c.isIncome ?? false,
              displayOrder: subOrder++,
            })
            .run();
          console.log(`    [sub] +${c.name} > ${sub}`);
        }
      }
    }

    // Default budget for current month
    const currentMonth = new Date().toISOString().slice(0, 7);
    const existingBudget = db
      .select()
      .from(schema.monthlyBudgets)
      .where(eq(schema.monthlyBudgets.month, currentMonth))
      .get();
    if (!existingBudget) {
      db.insert(schema.monthlyBudgets)
        .values({ month: currentMonth, totalMyr: MONTHLY_BUDGET_TOTAL })
        .run();
      console.log(
        `  [budget] +${currentMonth} ${BASE_CURRENCY} ${MONTHLY_BUDGET_TOTAL}`,
      );
    }

    rawDb.exec('COMMIT');
    console.log('[seed] done');
  } catch (e) {
    rawDb.exec('ROLLBACK');
    throw e;
  }
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});
