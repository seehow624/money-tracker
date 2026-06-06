import 'dotenv/config';
import { db, schema, rawDb } from '../src/db';
import { eq, and, lte, sql } from 'drizzle-orm';
import { convertToMyr } from '../src/lib/fx';
import crypto from 'node:crypto';

function nextMonthSameDay(dateStr: string, dayOfMonth: number): string {
  const [y, m] = dateStr.split('-').map(Number);
  // Move to next month
  const nextY = m === 12 ? y + 1 : y;
  const nextM = m === 12 ? 1 : m + 1;
  // Cap to last day of next month if dayOfMonth > last day
  const lastDay = new Date(Date.UTC(nextY, nextM, 0)).getUTCDate();
  const cap = Math.min(dayOfMonth, lastDay);
  return `${nextY}-${String(nextM).padStart(2, '0')}-${String(cap).padStart(2, '0')}`;
}

async function run() {
  const today = new Date().toISOString().slice(0, 10);
  console.log(`[run-scheduled] today = ${today}`);

  const dueRules = db
    .select()
    .from(schema.scheduledRules)
    .where(
      and(
        eq(schema.scheduledRules.active, true),
        lte(schema.scheduledRules.nextDueDate, today),
      ),
    )
    .all();

  console.log(`[run-scheduled] found ${dueRules.length} due rules`);

  let executed = 0;
  let skippedExpired = 0;

  for (const rule of dueRules) {
    let nextDue = rule.nextDueDate;
    let runs = 0;

    // If multiple periods elapsed (e.g. cron didn't run for a while), catch up
    while (nextDue <= today) {
      // Check end date
      if (rule.endDate && nextDue > rule.endDate) {
        // Mark inactive past end
        db.update(schema.scheduledRules)
          .set({ active: false })
          .where(
            and(
              eq(schema.scheduledRules.id, rule.id),
              eq(schema.scheduledRules.userId, rule.userId),
            ),
          )
          .run();
        skippedExpired++;
        break;
      }

      // Insert transaction
      const { amountMyr, fxRate } = convertToMyr(
        rule.amount,
        rule.currency,
        nextDue,
      );
      const fingerprint = `scheduled:${rule.id}:${nextDue}:${crypto.randomBytes(4).toString('hex')}`;

      try {
        db.insert(schema.transactions)
          .values({
            userId: rule.userId,
            date: nextDue,
            amount: rule.amount,
            currency: rule.currency,
            amountMyr,
            fxRate,
            type: rule.type as 'expense' | 'income' | 'transfer',
            categoryId: rule.type === 'transfer' ? null : rule.categoryId,
            accountId: rule.accountId,
            toAccountId: rule.type === 'transfer' ? rule.toAccountId : null,
            description: rule.description ?? rule.name,
            paidBy: rule.paidBy,
            notes: rule.notes,
            source: `scheduled:${rule.id}`,
            isBusiness: false,
            isRecurring: true,
            recurringId: rule.id,
            fingerprint,
          })
          .run();
        executed++;
        runs++;
        console.log(
          `  ✓ "${rule.name}" → ${nextDue} ${rule.type} ${rule.amount} ${rule.currency}`,
        );
      } catch (e) {
        console.error(`  ✗ "${rule.name}" failed for ${nextDue}:`, (e as Error).message);
      }

      nextDue = nextMonthSameDay(nextDue, rule.dayOfMonth);
    }

    if (runs > 0) {
      db.update(schema.scheduledRules)
        .set({ nextDueDate: nextDue, lastRunDate: today })
        .where(
          and(
            eq(schema.scheduledRules.id, rule.id),
            eq(schema.scheduledRules.userId, rule.userId),
          ),
        )
        .run();
    }
  }

  console.log(
    `[run-scheduled] done · ${executed} txns created · ${skippedExpired} rules expired`,
  );
}

run().catch((e) => {
  console.error('[run-scheduled] failed:', e);
  process.exit(1);
});
