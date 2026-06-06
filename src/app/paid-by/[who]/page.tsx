import { AppBar } from '@/components/AppBar';
import { DailyLog } from '@/components/DailyLog';
import { MonthPicker, MonthTodayButton } from '@/components/MonthPicker';
import { SwipeMonth } from '@/components/SwipeMonth';
import { db, schema } from '@/db';
import { monthTransactions, monthlyTotals } from '@/lib/queries';
import { thisMonth, fmtMyr } from '@/lib/format';
import { sql, eq, and } from 'drizzle-orm';
import { Heart } from 'lucide-react';
import { YearTrendChart } from '@/components/YearTrendChart';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MONTH_RE = /^\d{4}-\d{2}$/;

export default async function PaidByPage(props: {
  params: Promise<{ who: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { userId } = await requireSession();
  const { who: whoRaw } = await props.params;
  const { month: monthParam } = await props.searchParams;
  const who = decodeURIComponent(whoRaw).toLowerCase();
  if (!who || !/^[a-z0-9_-]+$/.test(who)) notFound();

  // Verify exists
  const exists = db
    .select({ n: sql<number>`COUNT(*)` })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.paidBy, who),
        eq(schema.transactions.userId, userId),
      ),
    )
    .get();
  if (!exists?.n) notFound();

  const month =
    monthParam && MONTH_RE.test(monthParam) ? monthParam : thisMonth();

  // Lifetime stats
  const lifetime = db
    .select({
      total: sql<number>`COALESCE(SUM(amount_myr), 0)`,
      n: sql<number>`COUNT(*)`,
      first: sql<string>`MIN(date)`,
      last: sql<string>`MAX(date)`,
    })
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.paidBy, who),
        eq(schema.transactions.userId, userId),
      ),
    )
    .get();

  // Monthly trend (12 months ending at selected month) — only paid_by=who expenses
  // We don't have a paid_by filter on monthlyTotals, so do raw SQL
  const trendRaw = db.all<{ month: string; total: number; income_total: number }>(
    sql`
      SELECT
        substr(date, 1, 7) AS month,
        SUM(CASE WHEN type='expense' THEN amount_myr ELSE 0 END) AS total,
        SUM(CASE WHEN type='income' THEN amount_myr ELSE 0 END) AS income_total
      FROM transactions
      WHERE paid_by = ${who} AND user_id = ${userId}
      GROUP BY month
      ORDER BY month
    `,
  );

  // Build last 12 months ending at selected month
  const months = lastNMonths(month, 12);
  const trendMap = new Map(trendRaw.map((r) => [r.month, r]));
  const trendData = months.map((m) => ({
    month: m,
    expense: trendMap.get(m)?.total ?? 0,
    income: trendMap.get(m)?.income_total ?? 0,
  }));

  // Top categories (filtered by paid_by)
  const topCats = db.all<{ name: string; total: number; n: number; color: string | null }>(
    sql`
      SELECT c.name AS name, c.color AS color, SUM(t.amount_myr) AS total, COUNT(*) AS n
      FROM transactions t
      JOIN categories c ON c.id = t.category_id AND c.user_id = ${userId}
      WHERE t.paid_by = ${who} AND t.type='expense' AND t.user_id = ${userId}
      GROUP BY c.id
      ORDER BY total DESC
      LIMIT 5
    `,
  );

  // Filter daily log to this month + this paid_by
  const log = monthTransactions(userId, month);
  // Filter days/items to only paid_by=who
  const filteredDays = log.days
    .map((d) => {
      const items = d.items.filter((t) => t.paidBy === who);
      const expense = items
        .filter((t) => t.type === 'expense')
        .reduce((s, t) => s + t.amountMyr, 0);
      const income = items
        .filter((t) => t.type === 'income')
        .reduce((s, t) => s + t.amountMyr, 0);
      return { ...d, items, expense, income };
    })
    .filter((d) => d.items.length > 0);
  const monthExpense = filteredDays.reduce((s, d) => s + d.expense, 0);
  const monthIncome = filteredDays.reduce((s, d) => s + d.income, 0);

  return (
    <div>
      <AppBar
        title={
          <MonthPicker
            value={month}
            routeBase={`/paid-by/${who}`}
            compact
          />
        }
        back={{ href: '/' }}
        trailing={
          <MonthTodayButton value={month} routeBase={`/paid-by/${who}`} />
        }
      />
      <SwipeMonth month={month} basePath={`/paid-by/${who}`}>
        <div className="max-w-3xl mx-auto px-4 pt-4 pb-40 space-y-4 min-h-[calc(100vh-3.5rem)]">
          {/* Lifetime hero */}
          <div className="bg-gradient-to-br from-pink-500 to-rose-500 rounded-2xl p-6 text-white">
            <div className="flex items-center gap-2 mb-2">
              <Heart className="w-5 h-5" fill="currentColor" />
              <span className="text-sm font-semibold uppercase tracking-wide opacity-90">
                Paid by {who}
              </span>
            </div>
            <div className="text-3xl font-bold tabular-nums">
              {fmtMyr(lifetime?.total ?? 0)}
            </div>
            <div className="text-sm opacity-80 mt-1">
              {lifetime?.n ?? 0} transactions · since{' '}
              {lifetime?.first?.slice(0, 7) ?? '—'}
            </div>
          </div>

          {/* Top categories */}
          {topCats.length > 0 && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-5">
              <h2 className="text-sm font-semibold mb-3">All-time top categories</h2>
              <ul className="space-y-2">
                {topCats.map((c) => {
                  const total = lifetime?.total ?? 1;
                  const pct = (c.total / total) * 100;
                  return (
                    <li
                      key={c.name}
                      className="flex items-center gap-3 text-sm"
                    >
                      <span className="flex-1 truncate">{c.name}</span>
                      <span className="text-xs text-zinc-400 tabular-nums">
                        {c.n} txns
                      </span>
                      <span className="font-medium tabular-nums w-24 text-right">
                        {fmtMyr(c.total)}
                      </span>
                      <span className="text-xs text-zinc-500 w-12 text-right tabular-nums">
                        {pct.toFixed(0)}%
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {/* Monthly trend */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-5">
            <h2 className="text-sm font-semibold mb-3">
              Monthly spend · 12 months ending {month}
            </h2>
            <YearTrendChart data={trendData} />
          </div>

          {/* This month log */}
          <DailyLog
            days={filteredDays}
            totalIncome={monthIncome}
            totalExpense={monthExpense}
            totalCount={filteredDays.reduce((s, d) => s + d.items.length, 0)}
            month={month}
            linkReturnTo={`/paid-by/${who}?month=${month}`}
          />
        </div>
      </SwipeMonth>
    </div>
  );
}

function lastNMonths(endMonth: string, n: number): string[] {
  const [y, m] = endMonth.split('-').map(Number);
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}
