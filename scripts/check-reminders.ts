import 'dotenv/config';
import { db, schema } from '../src/db';
import { eq, and, gte, sql } from 'drizzle-orm';

function getSettings() {
  const row = db
    .select()
    .from(schema.reminderSettings)
    .where(eq(schema.reminderSettings.id, 1))
    .get();
  if (!row) {
    return {
      dailyEntryEnabled: true,
      dailyEntryTime: '21:00',
      billDueEnabled: true,
      billDueDaysBefore: 3,
      budgetWarningEnabled: true,
      budgetWarningPct: 80,
    };
  }
  return row;
}

function alreadySent(kind: string, date: string, accountId?: number): boolean {
  const conditions = [
    eq(schema.reminderSent.kind, kind),
    eq(schema.reminderSent.date, date),
  ];
  if (accountId != null) {
    conditions.push(eq(schema.reminderSent.accountId, accountId));
  }
  const row = db
    .select()
    .from(schema.reminderSent)
    .where(and(...conditions))
    .get();
  return !!row;
}

function markSent(kind: string, date: string, accountId?: number): void {
  try {
    db.insert(schema.reminderSent)
      .values({ kind, date, accountId: accountId ?? null })
      .run();
  } catch {
    // duplicate, already marked by another run
  }
}

function checkDailyEntry(enabled: boolean, time: string): string[] {
  if (!enabled) return [];

  const [h, m] = time.split(':').map(Number);
  const now = new Date();
  const nowTotal = now.getHours() * 60 + now.getMinutes();
  const cfgTotal = h * 60 + m;

  // Only trigger around the configured time (±30 min window)
  if (Math.abs(nowTotal - cfgTotal) > 30) return [];

  const today = now.toISOString().slice(0, 10);
  if (alreadySent('daily_entry', today)) return [];

  const count =
    db
      .select({ n: sql<number>`COUNT(*)` })
      .from(schema.transactions)
      .where(eq(schema.transactions.date, today))
      .get()?.n ?? 0;

  if (count === 0) {
    markSent('daily_entry', today);
    return [`📝 今日尚未記帳！別忘了記錄今天的支出/收入。`];
  }
  return [];
}

function checkBillDue(enabled: boolean, daysBefore: number): string[] {
  if (!enabled) return [];

  const cards = db
    .select()
    .from(schema.accounts)
    .where(
      and(
        eq(schema.accounts.type, 'credit_card'),
        eq(schema.accounts.active, true),
      ),
    )
    .all();

  const msgs: string[] = [];
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  for (const card of cards) {
    if (!card.paymentDay) continue;
    const day = card.paymentDay;

    const y = today.getFullYear();
    const m = today.getMonth();
    const paymentDate = new Date(y, m, day);
    const checkDate =
      paymentDate < today ? new Date(y, m + 1, day) : paymentDate;

    const diffDays = Math.ceil(
      (checkDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays >= 0 && diffDays <= daysBefore) {
      const dateStr = checkDate.toISOString().slice(0, 10);
      if (alreadySent('bill_due', dateStr, card.id)) continue;

      msgs.push(
        `💳 ${card.name} 繳款日 ${dateStr}（${diffDays === 0 ? '今天' : `剩${diffDays}天`}）`,
      );
      markSent('bill_due', dateStr, card.id);
    }
  }

  if (msgs.length > 0) {
    msgs.unshift('⚠️ 信用卡繳款提醒：');
  }
  return msgs;
}

function checkBudget(enabled: boolean, warningPct: number): string[] {
  if (!enabled) return [];

  const month = new Date().toISOString().slice(0, 7);
  const budget = db
    .select()
    .from(schema.monthlyBudgets)
    .where(eq(schema.monthlyBudgets.month, month))
    .get();

  if (!budget) return [];

  const spent =
    db
      .select({
        total: sql<number>`COALESCE(SUM(${schema.transactions.amountMyr}), 0)`,
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.type, 'expense'),
          gte(schema.transactions.date, `${month}-01`),
        ),
      )
      .get()?.total ?? 0;

  const pct = Math.round((spent / budget.totalMyr) * 100);
  const remaining = budget.totalMyr - spent;

  // Mark the day we would alert
  const today = new Date().toISOString().slice(0, 10);

  if (pct >= 100) {
    if (alreadySent('budget_warning', today)) return [];
    markSent('budget_warning', today);
    return [
      `🔴 預算爆了！本月已花 RM ${spent.toLocaleString()}（${pct}%）`,
      `預算 RM ${budget.totalMyr.toLocaleString()} 已超支 RM ${Math.abs(remaining).toLocaleString()}`,
    ];
  }

  if (pct >= warningPct) {
    if (alreadySent('budget_warning', today)) return [];
    markSent('budget_warning', today);
    return [
      `🟡 預算警告：本月已花 RM ${spent.toLocaleString()}（${pct}%）`,
      `剩餘 RM ${remaining.toLocaleString()} / RM ${budget.totalMyr.toLocaleString()}`,
    ];
  }

  return [];
}

async function main() {
  const settings = getSettings();
  const msgs: string[] = [];

  msgs.push(
    ...checkDailyEntry(settings.dailyEntryEnabled, settings.dailyEntryTime),
  );
  msgs.push(
    ...checkBillDue(settings.billDueEnabled, settings.billDueDaysBefore),
  );
  msgs.push(
    ...checkBudget(settings.budgetWarningEnabled, settings.budgetWarningPct),
  );

  if (msgs.length > 0) {
    console.log(msgs.join('\n'));
  } else {
    console.log('');
  }
}

main().catch((e) => {
  console.error('[check-reminders] failed:', e);
  process.exit(1);
});
