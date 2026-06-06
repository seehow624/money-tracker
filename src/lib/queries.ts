import { db, rawDb, schema } from '@/db';
import { and, desc, eq, gte, lte, sql } from 'drizzle-orm';
import { fxToMyr } from './fx';

export type MonthSummary = {
  month: string;
  spentSoFar: number;
  scheduled: number;
  income: number;
  budgetMyr: number;
  remaining: number;
  txnCount: number;
};

export function monthSummary(userId: number, month: string, today: string): MonthSummary {
  const start = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${month}-${String(lastDay).padStart(2, '0')}`;
  const todayInMonth =
    today >= start && today <= end ? today : today < start ? start : end;

  const sumExpense = (from: string, to: string) =>
    db
      .select({
        total: sql<number>`COALESCE(SUM(${schema.transactions.amountMyr}), 0)`,
        n: sql<number>`COUNT(*)`,
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          eq(schema.transactions.type, 'expense'),
          gte(schema.transactions.date, from),
          lte(schema.transactions.date, to),
        ),
      )
      .get()!;

  const spent = sumExpense(start, todayInMonth);
  const scheduled =
    todayInMonth < end
      ? sumExpense(
          // day after today (string +1 day)
          isoNextDay(todayInMonth),
          end,
        )
      : { total: 0, n: 0 };

  const incomeRow = db
    .select({
      total: sql<number>`COALESCE(SUM(${schema.transactions.amountMyr}), 0)`,
      n: sql<number>`COUNT(*)`,
    })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.userId, userId),
        eq(schema.transactions.type, 'income'),
        gte(schema.transactions.date, start),
        lte(schema.transactions.date, end),
      ),
    )
    .get()!;

  const budgetRow = db
    .select()
    .from(schema.monthlyBudgets)
    .where(
      and(
        eq(schema.monthlyBudgets.userId, userId),
        eq(schema.monthlyBudgets.month, month),
      ),
    )
    .get();
  const budget = budgetRow?.totalMyr ?? 5000;

  return {
    month,
    spentSoFar: spent.total,
    scheduled: scheduled.total,
    income: incomeRow.total,
    budgetMyr: budget,
    remaining: budget - spent.total - scheduled.total,
    txnCount: spent.n + scheduled.n + incomeRow.n,
  };
}

function isoNextDay(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export type Period = 'monthly' | 'weekly' | 'annually';

export type DateRange = {
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  label: string; // human-readable, e.g. "2026-05" / "2026-W18" / "2026"
};

export function monthRange(yyyymm: string): DateRange {
  const [y, m] = yyyymm.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return {
    start: `${yyyymm}-01`,
    end: `${yyyymm}-${String(lastDay).padStart(2, '0')}`,
    label: yyyymm,
  };
}

export function weekRange(isoWeek: string): DateRange {
  // isoWeek like "2026-W18"
  const m = isoWeek.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return weekRange(currentISOWeek());
  const year = parseInt(m[1], 10);
  const week = parseInt(m[2], 10);
  // ISO 8601: week 1 is the week containing the year's first Thursday
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (week - 1) * 7);
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  return {
    start: monday.toISOString().slice(0, 10),
    end: sunday.toISOString().slice(0, 10),
    label: isoWeek,
  };
}

export function yearRange(yyyy: string): DateRange {
  const y = /^\d{4}$/.test(yyyy) ? yyyy : String(new Date().getUTCFullYear());
  return {
    start: `${y}-01-01`,
    end: `${y}-12-31`,
    label: y,
  };
}

export function currentISOWeek(): string {
  const d = new Date();
  const target = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
  const day = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNum =
    Math.ceil(
      ((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
    );
  return `${target.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export type RangeSummary = {
  range: DateRange;
  spentSoFar: number;
  scheduled: number;
  income: number;
  txnCount: number;
};

export function rangeSummary(userId: number, range: DateRange, anchorDate: string): RangeSummary {
  const cap =
    anchorDate >= range.start && anchorDate <= range.end
      ? anchorDate
      : anchorDate < range.start
        ? range.start
        : range.end;

  const sumByType = (type: 'expense' | 'income', from: string, to: string) =>
    db
      .select({
        total: sql<number>`COALESCE(SUM(${schema.transactions.amountMyr}), 0)`,
        n: sql<number>`COUNT(*)`,
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          eq(schema.transactions.type, type),
          gte(schema.transactions.date, from),
          lte(schema.transactions.date, to),
        ),
      )
      .get()!;

  const spent = sumByType('expense', range.start, cap);
  const scheduled =
    cap < range.end
      ? sumByType('expense', isoNextDayStr(cap), range.end)
      : { total: 0, n: 0 };
  const income = sumByType('income', range.start, range.end);

  return {
    range,
    spentSoFar: spent.total,
    scheduled: scheduled.total,
    income: income.total,
    txnCount: spent.n + scheduled.n + income.n,
  };
}

function isoNextDayStr(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function rangeCategoryBreakdown(
  userId: number,
  range: DateRange,
  type: 'expense' | 'income' = 'expense',
): CategoryRow[] {
  const isIncome = type === 'income';
  const rows = db
    .select({
      id: schema.categories.id,
      name: schema.categories.name,
      isIncome: schema.categories.isIncome,
      budget: schema.categories.monthlyBudgetMyr,
      icon: schema.categories.icon,
      color: schema.categories.color,
      spent: sql<number>`COALESCE(SUM(${schema.transactions.amountMyr}), 0)`,
      txnCount: sql<number>`COUNT(${schema.transactions.id})`,
    })
    .from(schema.categories)
    .leftJoin(
      schema.transactions,
      and(
        eq(schema.transactions.userId, userId),
        eq(schema.transactions.categoryId, schema.categories.id),
        gte(schema.transactions.date, range.start),
        lte(schema.transactions.date, range.end),
        eq(schema.transactions.type, type),
      ),
    )
    .where(
      and(
        eq(schema.categories.userId, userId),
        eq(schema.categories.isIncome, isIncome),
      ),
    )
    .groupBy(schema.categories.id)
    .orderBy(desc(sql`COALESCE(SUM(${schema.transactions.amountMyr}), 0)`))
    .all();

  return rows.filter(
    (r) => r.spent > 0 || (!isIncome && r.budget),
  ) as CategoryRow[];
}

export type CategoryRow = {
  id: number;
  name: string;
  spent: number;
  txnCount: number;
  budget: number | null;
  isIncome: boolean;
  icon: string | null;
  color: string | null;
};

export function categoryBreakdown(
  userId: number,
  month: string,
  type: 'expense' | 'income' = 'expense',
): CategoryRow[] {
  const start = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${month}-${String(lastDay).padStart(2, '0')}`;
  const isIncome = type === 'income';

  const rows = db
    .select({
      id: schema.categories.id,
      name: schema.categories.name,
      isIncome: schema.categories.isIncome,
      budget: schema.categories.monthlyBudgetMyr,
      icon: schema.categories.icon,
      color: schema.categories.color,
      spent: sql<number>`COALESCE(SUM(${schema.transactions.amountMyr}), 0)`,
      txnCount: sql<number>`COUNT(${schema.transactions.id})`,
    })
    .from(schema.categories)
    .leftJoin(
      schema.transactions,
      and(
        eq(schema.transactions.userId, userId),
        eq(schema.transactions.categoryId, schema.categories.id),
        gte(schema.transactions.date, start),
        lte(schema.transactions.date, end),
        eq(schema.transactions.type, type),
      ),
    )
    .where(
      and(
        eq(schema.categories.userId, userId),
        eq(schema.categories.isIncome, isIncome),
      ),
    )
    .groupBy(schema.categories.id)
    .orderBy(desc(sql`COALESCE(SUM(${schema.transactions.amountMyr}), 0)`))
    .all();

  return rows.filter(
    (r) => r.spent > 0 || (!isIncome && r.budget),
  ) as CategoryRow[];
}

export type MonthlyTotal = {
  month: string;
  income: number;
  expense: number;
};

/** Returns income+expense totals for the last `n` months ending at `endMonth` (YYYY-MM). */
export function monthlyTotals(userId: number, endMonth: string, n: number): MonthlyTotal[] {
  const months = lastNMonths(endMonth, n);
  const start = `${months[0]}-01`;
  const [ey, em] = endMonth.split('-').map(Number);
  const lastDay = new Date(ey, em, 0).getDate();
  const end = `${endMonth}-${String(lastDay).padStart(2, '0')}`;

  const rows = db
    .select({
      month: sql<string>`substr(${schema.transactions.date}, 1, 7)`,
      type: schema.transactions.type,
      total: sql<number>`SUM(${schema.transactions.amountMyr})`,
    })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.userId, userId),
        gte(schema.transactions.date, start),
        lte(schema.transactions.date, end),
      ),
    )
    .groupBy(sql`substr(${schema.transactions.date}, 1, 7)`, schema.transactions.type)
    .all();

  const byMonth = new Map<string, MonthlyTotal>();
  for (const m of months) byMonth.set(m, { month: m, income: 0, expense: 0 });
  for (const r of rows) {
    const slot = byMonth.get(r.month);
    if (!slot) continue;
    if (r.type === 'income') slot.income = r.total;
    else if (r.type === 'expense') slot.expense = r.total;
  }
  return months.map((m) => byMonth.get(m)!);
}

export type NetFlowPoint = {
  month: string;
  income: number;
  expense: number;
  net: number;
  cumulative: number;
};

export function cumulativeNetFlow(
  userId: number,
  endMonth: string,
  n: number = 24,
): NetFlowPoint[] {
  const totals = monthlyTotals(userId, endMonth, n);
  let cum = 0;
  return totals.map((t) => {
    const net = t.income - t.expense;
    cum += net;
    return {
      month: t.month,
      income: t.income,
      expense: t.expense,
      net,
      cumulative: cum,
    };
  });
}

export type CategorySeriesPoint = { month: string } & Record<string, number | string>;

export type CategorySeries = {
  categories: { id: number; name: string; icon: string | null; color: string | null }[];
  data: CategorySeriesPoint[];
};

/** Returns monthly expense per category. Either pick `topN` automatically, or specify `ids` to track specific categories. */
export function monthlyCategorySeries(
  userId: number,
  endMonth: string,
  n: number,
  topN = 5,
  ids?: number[],
): CategorySeries {
  const months = lastNMonths(endMonth, n);
  const start = `${months[0]}-01`;
  const [ey, em] = endMonth.split('-').map(Number);
  const lastDay = new Date(ey, em, 0).getDate();
  const end = `${endMonth}-${String(lastDay).padStart(2, '0')}`;

  // Find selected categories — either by explicit ids or top N by spending
  let top: { id: number; name: string; icon: string | null; color: string | null }[];
  if (ids && ids.length > 0) {
    top = db
      .select({
        id: schema.categories.id,
        name: schema.categories.name,
        icon: schema.categories.icon,
        color: schema.categories.color,
      })
      .from(schema.categories)
      .where(
        and(
          eq(schema.categories.userId, userId),
          sql`${schema.categories.id} IN (${sql.raw(ids.map((i) => parseInt(String(i), 10)).filter(Number.isFinite).join(',') || '0')})`,
        ),
      )
      .all();
  } else {
    top = db
      .select({
        id: schema.categories.id,
        name: schema.categories.name,
        icon: schema.categories.icon,
        color: schema.categories.color,
      })
      .from(schema.transactions)
      .innerJoin(
        schema.categories,
        eq(schema.categories.id, schema.transactions.categoryId),
      )
      .where(
        and(
          eq(schema.transactions.userId, userId),
          eq(schema.categories.userId, userId),
          eq(schema.transactions.type, 'expense'),
          gte(schema.transactions.date, start),
          lte(schema.transactions.date, end),
        ),
      )
      .groupBy(schema.categories.id)
      .orderBy(desc(sql`SUM(${schema.transactions.amountMyr})`))
      .limit(topN)
      .all();
  }

  if (top.length === 0) {
    return { categories: [], data: months.map((m) => ({ month: m })) };
  }

  const topIds = top.map((c) => c.id);
  const fallback = db
    .select({
      month: sql<string>`substr(${schema.transactions.date}, 1, 7)`,
      categoryId: schema.transactions.categoryId,
      total: sql<number>`SUM(${schema.transactions.amountMyr})`,
    })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.userId, userId),
        eq(schema.transactions.type, 'expense'),
        gte(schema.transactions.date, start),
        lte(schema.transactions.date, end),
      ),
    )
    .groupBy(
      sql`substr(${schema.transactions.date}, 1, 7)`,
      schema.transactions.categoryId,
    )
    .all();

  const matrix = new Map<string, Record<number, number>>();
  for (const m of months) matrix.set(m, {});
  for (const r of fallback) {
    if (!r.categoryId || !topIds.includes(r.categoryId)) continue;
    const slot = matrix.get(r.month);
    if (!slot) continue;
    slot[r.categoryId] = r.total;
  }

  const data: CategorySeriesPoint[] = months.map((m) => {
    const slot = matrix.get(m) ?? {};
    const point: CategorySeriesPoint = { month: m };
    for (const c of top) {
      point[c.name] = slot[c.id] ?? 0;
    }
    return point;
  });

  return {
    categories: top.map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      color: c.color,
    })),
    data,
  };
}

/** Account-perspective version of monthTransactions:
 * includes both `account_id=X` (outflows) and `to_account_id=X` (transfer-ins),
 * computes deposits/withdrawals (transfer-aware) instead of income/expense.
 */
export function accountMonthLog(
  userId: number,
  accountId: number,
  month: string,
): MonthTransactions {
  const start = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${month}-${String(lastDay).padStart(2, '0')}`;

  const accountNameById = new Map(
    db
      .select({ id: schema.accounts.id, name: schema.accounts.name })
      .from(schema.accounts)
      .where(eq(schema.accounts.userId, userId))
      .all()
      .map((a) => [a.id, a.name]),
  );

  const rows = db
    .select({
      id: schema.transactions.id,
      date: schema.transactions.date,
      amount: schema.transactions.amount,
      amountMyr: schema.transactions.amountMyr,
      currency: schema.transactions.currency,
      type: schema.transactions.type,
      description: schema.transactions.description,
      accountId: schema.transactions.accountId,
      toAccountId: schema.transactions.toAccountId,
      paidBy: schema.transactions.paidBy,
      category: schema.categories.name,
      icon: schema.categories.icon,
      color: schema.categories.color,
    })
    .from(schema.transactions)
    .leftJoin(
      schema.categories,
      eq(schema.categories.id, schema.transactions.categoryId),
    )
    .where(
      and(
        eq(schema.transactions.userId, userId),
        gte(schema.transactions.date, start),
        lte(schema.transactions.date, end),
        sql`(${schema.transactions.accountId} = ${accountId} OR ${schema.transactions.toAccountId} = ${accountId})`,
      ),
    )
    .orderBy(desc(schema.transactions.date), desc(schema.transactions.id))
    .all();

  const days: DayGroup[] = [];
  let cur: DayGroup | null = null;
  let totalDeposit = 0;
  let totalWithdrawal = 0;
  const paidByOthers: Record<string, number> = {};

  for (const r of rows) {
    if (!cur || cur.date !== r.date) {
      cur = {
        date: r.date,
        weekday: new Date(`${r.date}T00:00:00Z`).toLocaleString('en-US', {
          weekday: 'short',
          timeZone: 'UTC',
        }),
        income: 0,
        expense: 0,
        items: [],
      };
      days.push(cur);
    }

    // Determine direction from this account's perspective
    let direction: 'in' | 'out';
    if (r.toAccountId === accountId && r.type === 'transfer') {
      direction = 'in';
    } else if (r.accountId === accountId) {
      direction = r.type === 'income' ? 'in' : 'out';
    } else {
      continue;
    }

    const txn: RecentTxn = {
      id: r.id,
      date: r.date,
      amount: r.amount,
      amountMyr: r.amountMyr,
      currency: r.currency,
      type: r.type as RecentTxn['type'],
      description: r.description,
      account: accountNameById.get(r.accountId) ?? `#${r.accountId}`,
      toAccount: r.toAccountId
        ? accountNameById.get(r.toAccountId) ?? null
        : null,
      category: r.category,
      icon: r.icon,
      color: r.color,
      paidBy: r.paidBy,
      direction,
    };
    cur.items.push(txn);

    // For account-perspective view, aggregate in native amount (matches the txn currency).
    // For transfer-in from another currency, fall back to amountMyr — this is rare.
    const native = r.amount;

    if (direction === 'in') {
      cur.income += native;
      totalDeposit += native;
    } else {
      cur.expense += native;
      totalWithdrawal += native;
      if (r.paidBy && r.paidBy !== 'me' && r.type === 'expense') {
        paidByOthers[r.paidBy] = (paidByOthers[r.paidBy] ?? 0) + native;
      }
    }
  }

  return {
    days,
    // Reuse fields semantically: income = deposit, expense = withdrawal
    totalIncome: totalDeposit,
    totalExpense: totalWithdrawal,
    totalCount: rows.length,
    paidByOthers,
  };
}

function lastNMonths(endMonth: string, n: number): string[] {
  const [y, m] = endMonth.split('-').map(Number);
  const arr: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    arr.push(d.toISOString().slice(0, 7));
  }
  return arr;
}

export type AccountBalance = {
  id: number;
  name: string;
  type: 'bank' | 'credit_card' | 'ewallet' | 'cash' | 'investment';
  currency: string;
  active: boolean;
  startingBalance: number;
  startingBalanceDate: string | null;
  statementDay: number | null;
  paymentDay: number | null;
  txnCount: number;
  netDelta: number;
  current: number;
  /** `current` converted to MYR at the latest available FX rate (== current for MYR accounts). */
  currentMyr: number;
  ccCycle?: CCCycle;
};

export type CCCycle = {
  lastStmtDate: string;     // most recent statement closing date
  nextStmtDate: string;     // upcoming statement closing
  nextPaymentDate: string;  // upcoming payment due
  daysToPayment: number;
  billedThisCycle: number;  // charges - refunds in (prevStmt, lastStmt]
  paymentsSinceStmt: number; // transfers TO this card after lastStmt
  balancePayable: number;   // what's due at next payment
  outstanding: number;      // charges - refunds since lastStmt
};

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function lastStatementDate(today: Date, statementDay: number): Date {
  // statement closes on `statementDay` of each month
  const yr = today.getUTCFullYear();
  const mo = today.getUTCMonth();
  // Cap statementDay to last day of month to handle Feb 30 etc.
  const cap = (y: number, m: number, d: number) =>
    Math.min(d, new Date(Date.UTC(y, m + 1, 0)).getUTCDate());
  let stmt = new Date(Date.UTC(yr, mo, cap(yr, mo, statementDay)));
  if (stmt > today) {
    stmt = new Date(Date.UTC(yr, mo - 1, cap(yr, mo - 1, statementDay)));
  }
  return stmt;
}

function nextDateOnDay(today: Date, day: number): Date {
  const yr = today.getUTCFullYear();
  const mo = today.getUTCMonth();
  const cap = (y: number, m: number, d: number) =>
    Math.min(d, new Date(Date.UTC(y, m + 1, 0)).getUTCDate());
  let next = new Date(Date.UTC(yr, mo, cap(yr, mo, day)));
  if (next < today) {
    next = new Date(Date.UTC(yr, mo + 1, cap(yr, mo + 1, day)));
  }
  return next;
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + n);
  return out;
}

function ccCycle(
  userId: number,
  accountId: number,
  statementDay: number,
  paymentDay: number,
  todayIso: string,
  startingBalance: number = 0,
): CCCycle {
  const today = new Date(`${todayIso}T00:00:00Z`);
  const lastStmt = lastStatementDate(today, statementDay);
  const prevStmt = lastStatementDate(addDays(lastStmt, -1), statementDay);
  const nextStmt = (() => {
    const yr = lastStmt.getUTCFullYear();
    const mo = lastStmt.getUTCMonth() + 1;
    const cap = Math.min(
      statementDay,
      new Date(Date.UTC(yr, mo + 1, 0)).getUTCDate(),
    );
    return new Date(Date.UTC(yr, mo, cap));
  })();
  const nextPayment = nextDateOnDay(today, paymentDay);
  const daysToPayment = Math.round(
    (nextPayment.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
  );

  const dayAfterPrev = isoDate(addDays(prevStmt, 1));
  const lastStmtIso = isoDate(lastStmt);
  const dayAfterLast = isoDate(addDays(lastStmt, 1));

  // Billed in last cycle (this single cycle): (prevStmt, lastStmt]
  const billed = db
    .select({
      expense: sql<number>`COALESCE(SUM(CASE WHEN ${schema.transactions.type}='expense' THEN ${schema.transactions.amount} ELSE 0 END), 0)`,
      income: sql<number>`COALESCE(SUM(CASE WHEN ${schema.transactions.type}='income' THEN ${schema.transactions.amount} ELSE 0 END), 0)`,
      transferOut: sql<number>`COALESCE(SUM(CASE WHEN ${schema.transactions.type}='transfer' THEN ${schema.transactions.amount} ELSE 0 END), 0)`,
    })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.userId, userId),
        eq(schema.transactions.accountId, accountId),
        gte(schema.transactions.date, dayAfterPrev),
        lte(schema.transactions.date, lastStmtIso),
      ),
    )
    .get()!;
  const billedThisCycle = billed.expense - billed.income + billed.transferOut;

  // Total billed since account inception through lastStmt (carries forward unpaid balances).
  const billedAll = db
    .select({
      expense: sql<number>`COALESCE(SUM(CASE WHEN ${schema.transactions.type}='expense' THEN ${schema.transactions.amount} ELSE 0 END), 0)`,
      income: sql<number>`COALESCE(SUM(CASE WHEN ${schema.transactions.type}='income' THEN ${schema.transactions.amount} ELSE 0 END), 0)`,
      transferOut: sql<number>`COALESCE(SUM(CASE WHEN ${schema.transactions.type}='transfer' THEN ${schema.transactions.amount} ELSE 0 END), 0)`,
    })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.userId, userId),
        eq(schema.transactions.accountId, accountId),
        lte(schema.transactions.date, lastStmtIso),
      ),
    )
    .get()!;
  const totalBilledThroughLastStmt =
    billedAll.expense - billedAll.income + billedAll.transferOut;

  // All payments to this CC, ever (through today).
  const allPayments = db
    .select({
      total: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)`,
    })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.userId, userId),
        eq(schema.transactions.toAccountId, accountId),
        eq(schema.transactions.type, 'transfer'),
        lte(schema.transactions.date, todayIso),
      ),
    )
    .get()!;

  // Payments since lastStmt (used for "paymentsSinceStmt" stat).
  const payments = db
    .select({
      total: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)`,
    })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.userId, userId),
        eq(schema.transactions.toAccountId, accountId),
        eq(schema.transactions.type, 'transfer'),
        gte(schema.transactions.date, dayAfterLast),
        lte(schema.transactions.date, todayIso),
      ),
    )
    .get()!;

  // Outstanding (current cycle): (lastStmt, today]
  // For CC: include transferOut (e.g. cash advance / passthrough) since those add to debt too.
  const cur = db
    .select({
      expense: sql<number>`COALESCE(SUM(CASE WHEN ${schema.transactions.type}='expense' THEN ${schema.transactions.amount} ELSE 0 END), 0)`,
      income: sql<number>`COALESCE(SUM(CASE WHEN ${schema.transactions.type}='income' THEN ${schema.transactions.amount} ELSE 0 END), 0)`,
      transferOut: sql<number>`COALESCE(SUM(CASE WHEN ${schema.transactions.type}='transfer' THEN ${schema.transactions.amount} ELSE 0 END), 0)`,
    })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.userId, userId),
        eq(schema.transactions.accountId, accountId),
        gte(schema.transactions.date, dayAfterLast),
        lte(schema.transactions.date, todayIso),
      ),
    )
    .get()!;
  const outstanding = cur.expense - cur.income + cur.transferOut;

  return {
    lastStmtDate: lastStmtIso,
    nextStmtDate: isoDate(nextStmt),
    nextPaymentDate: isoDate(nextPayment),
    daysToPayment,
    billedThisCycle,
    paymentsSinceStmt: payments.total,
    // Balance Payable = startingBalance + total billed (all-time, through lastStmt) - total paid (all-time)
    // startingBalance acts as a manual adjustment for incomplete historical data.
    // For our user, set CC starting_balance to a NEGATIVE value to absorb cumulative imbalance.
    balancePayable: Math.max(0, startingBalance + totalBilledThroughLastStmt - allPayments.total),
    outstanding,
  };
}

export function accountBalances(userId: number): AccountBalance[] {
  const todayIso = new Date().toISOString().slice(0, 10);
  const accts = db
    .select()
    .from(schema.accounts)
    .where(eq(schema.accounts.userId, userId))
    .orderBy(schema.accounts.displayOrder, schema.accounts.id)
    .all();

  // Compute net delta per account from transactions on or after startingBalanceDate
  // (or from beginning if no date set).
  // expense → -amount, income → +amount, transfer out → -, transfer in → +
  const out: AccountBalance[] = [];
  for (const a of accts) {
    const dateClause = a.startingBalanceDate
      ? gte(schema.transactions.date, a.startingBalanceDate)
      : sql`1=1`;

    // Outflows: this account is the source
    const outflow = db
      .select({
        income: sql<number>`COALESCE(SUM(CASE WHEN ${schema.transactions.type}='income' THEN ${schema.transactions.amount} ELSE 0 END), 0)`,
        expense: sql<number>`COALESCE(SUM(CASE WHEN ${schema.transactions.type}='expense' THEN ${schema.transactions.amount} ELSE 0 END), 0)`,
        transferOut: sql<number>`COALESCE(SUM(CASE WHEN ${schema.transactions.type}='transfer' THEN ${schema.transactions.amount} ELSE 0 END), 0)`,
        n: sql<number>`COUNT(*)`,
      })
      .from(schema.transactions)
      .where(and(eq(schema.transactions.userId, userId), eq(schema.transactions.accountId, a.id), dateClause))
      .get()!;

    // Inflows: this account is the transfer destination
    const transferIn = db
      .select({
        amount: sql<number>`COALESCE(SUM(${schema.transactions.amount}), 0)`,
        n: sql<number>`COUNT(*)`,
      })
      .from(schema.transactions)
      .where(
        and(
          eq(schema.transactions.userId, userId),
          eq(schema.transactions.toAccountId, a.id),
          eq(schema.transactions.type, 'transfer'),
          dateClause,
        ),
      )
      .get()!;

    // For credit cards: expense INCREASES debt, income (cashback/rebate) decreases debt.
    // The "balance" of a CC is the outstanding amount owed (positive = you owe).
    // For banks/ewallet/cash: expense decreases balance, income increases.
    const isCC = a.type === 'credit_card';
    const netDelta = isCC
      ? outflow.expense - outflow.income + outflow.transferOut - transferIn.amount
      : outflow.income - outflow.expense - outflow.transferOut + transferIn.amount;

    const ccCycleData =
      a.type === 'credit_card' && a.statementDay && a.paymentDay
        ? ccCycle(userId, a.id, a.statementDay, a.paymentDay, todayIso, a.startingBalance)
        : undefined;

    // For CC: Current = Balance Payable + Outstanding (real-time debt).
    // For others: Current = starting + cumulative netΔ.
    const current = ccCycleData
      ? ccCycleData.balancePayable + ccCycleData.outstanding
      : a.startingBalance + netDelta;

    // Snapshot value in MYR: convert the current native balance at today's rate
    // (falls back to the most recent prior rate). MYR accounts pass through 1:1.
    const currentMyr = current * fxToMyr(a.currency, todayIso).rate;

    out.push({
      id: a.id,
      name: a.name,
      type: a.type as AccountBalance['type'],
      currency: a.currency,
      active: a.active,
      startingBalance: a.startingBalance,
      startingBalanceDate: a.startingBalanceDate,
      statementDay: a.statementDay,
      paymentDay: a.paymentDay,
      txnCount: outflow.n + transferIn.n,
      netDelta,
      current,
      currentMyr,
      ccCycle: ccCycleData,
    });
  }
  return out;
}

export type RecentTxn = {
  id: number;
  date: string;
  amount: number;
  amountMyr: number;
  currency: string;
  type: 'expense' | 'income' | 'transfer';
  description: string | null;
  account: string;
  toAccount: string | null;
  category: string | null;
  icon: string | null;
  color: string | null;
  paidBy: string;
  /** Set only in account-perspective views; determines +/- sign + color regardless of type. */
  direction?: 'in' | 'out';
};

export type DayGroup = {
  date: string; // YYYY-MM-DD
  weekday: string; // 'Sat'
  income: number;
  expense: number;
  items: RecentTxn[];
};

export type MonthTransactions = {
  days: DayGroup[];
  totalIncome: number;
  totalExpense: number;
  totalCount: number;
  paidByOthers: Record<string, number>; // e.g. { mom: 200.55 }
};

export type TxnFilter = {
  categoryId?: number;
  accountId?: number;
  type?: 'expense' | 'income' | 'transfer';
  paidBy?: string;
  q?: string;
};

export function monthTransactions(
  userId: number,
  month: string,
  filters: TxnFilter = {},
): MonthTransactions {
  const start = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const end = `${month}-${String(lastDay).padStart(2, '0')}`;

  const accountNameById = new Map(
    db
      .select({ id: schema.accounts.id, name: schema.accounts.name })
      .from(schema.accounts)
      .where(eq(schema.accounts.userId, userId))
      .all()
      .map((a) => [a.id, a.name]),
  );

  const rows = db
    .select({
      id: schema.transactions.id,
      date: schema.transactions.date,
      amount: schema.transactions.amount,
      amountMyr: schema.transactions.amountMyr,
      currency: schema.transactions.currency,
      type: schema.transactions.type,
      description: schema.transactions.description,
      accountId: schema.transactions.accountId,
      toAccountId: schema.transactions.toAccountId,
      paidBy: schema.transactions.paidBy,
      category: schema.categories.name,
      icon: schema.categories.icon,
      color: schema.categories.color,
    })
    .from(schema.transactions)
    .leftJoin(
      schema.categories,
      eq(schema.categories.id, schema.transactions.categoryId),
    )
    .where(
      and(
        eq(schema.transactions.userId, userId),
        gte(schema.transactions.date, start),
        lte(schema.transactions.date, end),
        filters.categoryId
          ? eq(schema.transactions.categoryId, filters.categoryId)
          : undefined,
        filters.accountId
          ? eq(schema.transactions.accountId, filters.accountId)
          : undefined,
        filters.type ? eq(schema.transactions.type, filters.type) : undefined,
        filters.paidBy
          ? eq(schema.transactions.paidBy, filters.paidBy)
          : undefined,
        filters.q
          ? sql`(LOWER(${schema.transactions.description}) LIKE ${'%' + filters.q.toLowerCase() + '%'} OR LOWER(${schema.transactions.payee}) LIKE ${'%' + filters.q.toLowerCase() + '%'} OR LOWER(${schema.transactions.notes}) LIKE ${'%' + filters.q.toLowerCase() + '%'})`
          : undefined,
      ),
    )
    .orderBy(desc(schema.transactions.date), desc(schema.transactions.id))
    .all();

  const days: DayGroup[] = [];
  let cur: DayGroup | null = null;
  let totalIncome = 0;
  let totalExpense = 0;
  const paidByOthers: Record<string, number> = {};

  for (const r of rows) {
    if (!cur || cur.date !== r.date) {
      cur = {
        date: r.date,
        weekday: new Date(`${r.date}T00:00:00Z`).toLocaleString('en-US', {
          weekday: 'short',
          timeZone: 'UTC',
        }),
        income: 0,
        expense: 0,
        items: [],
      };
      days.push(cur);
    }
    const txn: RecentTxn = {
      id: r.id,
      date: r.date,
      amount: r.amount,
      amountMyr: r.amountMyr,
      currency: r.currency,
      type: r.type as RecentTxn['type'],
      description: r.description,
      account: accountNameById.get(r.accountId) ?? `#${r.accountId}`,
      toAccount: r.toAccountId
        ? accountNameById.get(r.toAccountId) ?? null
        : null,
      category: r.category,
      icon: r.icon,
      color: r.color,
      paidBy: r.paidBy,
    };
    cur.items.push(txn);
    if (r.type === 'income') {
      cur.income += r.amountMyr;
      totalIncome += r.amountMyr;
    } else if (r.type === 'expense') {
      cur.expense += r.amountMyr;
      totalExpense += r.amountMyr;
      if (r.paidBy && r.paidBy !== 'me') {
        paidByOthers[r.paidBy] = (paidByOthers[r.paidBy] ?? 0) + r.amountMyr;
      }
    }
  }

  return {
    days,
    totalIncome,
    totalExpense,
    totalCount: rows.length,
    paidByOthers,
  };
}

export type RecurringHit = {
  amount: number;
  description: string | null;
  accountName: string;
  categoryName: string | null;
  monthsSeen: number;
  totalPaid: number;
  firstSeen: string;
  lastSeen: string;
};

/** Find expenses that look like recurring monthly subscriptions: same (account, amount, desc) appearing in 3+ different months. */
export function recurringDetections(userId: number, monthsBack = 12, minMonths = 3): RecurringHit[] {
  const cutoffDate = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - monthsBack);
    return d.toISOString().slice(0, 10);
  })();

  const rows = rawDb
    .prepare(
      `SELECT
         t.amount AS amount,
         COALESCE(t.description, '') AS description,
         a.name AS accountName,
         c.name AS categoryName,
         COUNT(DISTINCT substr(t.date, 1, 7)) AS monthsSeen,
         ROUND(SUM(t.amount_myr), 2) AS totalPaid,
         MIN(t.date) AS firstSeen,
         MAX(t.date) AS lastSeen
       FROM transactions t
       JOIN accounts a ON a.id = t.account_id
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = ?
         AND t.type='expense'
         AND t.date >= ?
       GROUP BY ROUND(t.amount, 2), COALESCE(t.description, ''), t.account_id
       HAVING monthsSeen >= ?
       ORDER BY monthsSeen DESC, totalPaid DESC`,
    )
    .all(userId, cutoffDate, minMonths) as RecurringHit[];

  return rows;
}

export function searchTransactions(userId: number, q: string, limit = 100): RecentTxn[] {
  const trimmed = q.trim().toLowerCase();
  if (!trimmed) return [];

  const accountNameById = new Map(
    db
      .select({ id: schema.accounts.id, name: schema.accounts.name })
      .from(schema.accounts)
      .where(eq(schema.accounts.userId, userId))
      .all()
      .map((a) => [a.id, a.name]),
  );

  const pattern = `%${trimmed}%`;
  const rows = db
    .select({
      id: schema.transactions.id,
      date: schema.transactions.date,
      amount: schema.transactions.amount,
      amountMyr: schema.transactions.amountMyr,
      currency: schema.transactions.currency,
      type: schema.transactions.type,
      description: schema.transactions.description,
      accountId: schema.transactions.accountId,
      toAccountId: schema.transactions.toAccountId,
      paidBy: schema.transactions.paidBy,
      category: schema.categories.name,
      icon: schema.categories.icon,
      color: schema.categories.color,
      accountName: schema.accounts.name,
    })
    .from(schema.transactions)
    .leftJoin(
      schema.categories,
      eq(schema.categories.id, schema.transactions.categoryId),
    )
    .innerJoin(
      schema.accounts,
      eq(schema.accounts.id, schema.transactions.accountId),
    )
    .where(
      and(
        eq(schema.transactions.userId, userId),
        sql`(
        LOWER(${schema.transactions.description}) LIKE ${pattern}
        OR LOWER(${schema.transactions.payee}) LIKE ${pattern}
        OR LOWER(${schema.transactions.notes}) LIKE ${pattern}
        OR LOWER(${schema.accounts.name}) LIKE ${pattern}
        OR LOWER(${schema.categories.name}) LIKE ${pattern}
      )`,
      ),
    )
    .orderBy(desc(schema.transactions.date), desc(schema.transactions.id))
    .limit(limit)
    .all();

  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    amount: r.amount,
    amountMyr: r.amountMyr,
    currency: r.currency,
    type: r.type as RecentTxn['type'],
    description: r.description,
    account: accountNameById.get(r.accountId) ?? `#${r.accountId}`,
    toAccount: r.toAccountId ? accountNameById.get(r.toAccountId) ?? null : null,
    category: r.category,
    icon: r.icon,
    color: r.color,
    paidBy: r.paidBy,
  }));
}

export function recentTransactions(userId: number, limit = 20): RecentTxn[] {
  const accountNameById = new Map(
    db
      .select({ id: schema.accounts.id, name: schema.accounts.name })
      .from(schema.accounts)
      .where(eq(schema.accounts.userId, userId))
      .all()
      .map((a) => [a.id, a.name]),
  );

  const rows = db
    .select({
      id: schema.transactions.id,
      date: schema.transactions.date,
      amount: schema.transactions.amount,
      amountMyr: schema.transactions.amountMyr,
      currency: schema.transactions.currency,
      type: schema.transactions.type,
      description: schema.transactions.description,
      accountId: schema.transactions.accountId,
      toAccountId: schema.transactions.toAccountId,
      paidBy: schema.transactions.paidBy,
      category: schema.categories.name,
      icon: schema.categories.icon,
      color: schema.categories.color,
    })
    .from(schema.transactions)
    .leftJoin(
      schema.categories,
      eq(schema.categories.id, schema.transactions.categoryId),
    )
    .where(eq(schema.transactions.userId, userId))
    .orderBy(desc(schema.transactions.date), desc(schema.transactions.id))
    .limit(limit)
    .all();

  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    amount: r.amount,
    amountMyr: r.amountMyr,
    currency: r.currency,
    type: r.type as RecentTxn['type'],
    description: r.description,
    account: accountNameById.get(r.accountId) ?? `#${r.accountId}`,
    toAccount: r.toAccountId ? accountNameById.get(r.toAccountId) ?? null : null,
    category: r.category,
    icon: r.icon,
    color: r.color,
    paidBy: r.paidBy,
  }));
}
