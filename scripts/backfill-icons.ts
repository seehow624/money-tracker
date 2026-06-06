import 'dotenv/config';
import { db, schema } from '../src/db';
import { eq } from 'drizzle-orm';

const ICONS: Record<string, { icon: string; color: string }> = {
  // Income
  'Interest Earned':    { icon: '💵', color: 'emerald' },
  'Cash Back':          { icon: '💸', color: 'emerald' },
  'Bonus':              { icon: '🎁', color: 'emerald' },
  'Gift / 紅包':        { icon: '🧧', color: 'emerald' },
  'Income':             { icon: '💰', color: 'emerald' },

  // Expense
  'Food & Dining':      { icon: '🍜', color: 'amber' },
  'Transportation':     { icon: '🚗', color: 'blue' },
  'Shopping':           { icon: '🛍️', color: 'pink' },
  'Subscription':       { icon: '🔁', color: 'violet' },
  'Entertainment':      { icon: '🎮', color: 'fuchsia' },
  'Bills & Utilities':  { icon: '🧾', color: 'slate' },
  'Health & Beauty':    { icon: '💆', color: 'rose' },
  'Insurance':          { icon: '🛡️', color: 'teal' },
  'Self-development':   { icon: '📚', color: 'indigo' },
  'Travel':             { icon: '✈️', color: 'sky' },
  'Pet':                { icon: '🐾', color: 'orange' },
  'Gift / 人情紅包':    { icon: '🧧', color: 'red' },
  'Household':          { icon: '🏠', color: 'stone' },
  'Assets':             { icon: '📷', color: 'zinc' },
  'Daily Supplies':     { icon: '🧴', color: 'lime' },
  'Other':              { icon: '🔧', color: 'gray' },
  'Social Life':        { icon: '🍻', color: 'amber' },
};

let updated = 0;
let skipped = 0;
for (const [name, { icon, color }] of Object.entries(ICONS)) {
  const r = db
    .update(schema.categories)
    .set({ icon, color })
    .where(eq(schema.categories.name, name))
    .run();
  if (r.changes > 0) {
    console.log(`  ${icon}  ${name.padEnd(22)} → ${color}`);
    updated += r.changes;
  } else {
    skipped++;
    console.log(`  --  ${name.padEnd(22)} (not found)`);
  }
}
console.log(`\nupdated: ${updated}, skipped: ${skipped}`);
