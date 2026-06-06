import { AppBar } from '@/components/AppBar';
import { db, schema } from '@/db';
import { fmtMyr, fmtNum, thisMonth, daysInMonth } from '@/lib/format';
import { sql, eq } from 'drizzle-orm';
import Link from 'next/link';
import { saveBudget } from './actions';
import { categoryBreakdown, monthSummary } from '@/lib/queries';
import { CategoryIcon } from '@/lib/icons';
import { colorFor } from '@/lib/colors';
import { requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function BudgetPage() {
  const { userId } = await requireSession();
  const month = thisMonth();
  const allBudgets = db
    .select()
    .from(schema.monthlyBudgets)
    .where(eq(schema.monthlyBudgets.userId, userId))
    .orderBy(sql`month DESC`)
    .all();
  const current = allBudgets.find((b) => b.month === month);
  const today = new Date().toISOString().slice(0, 10);
  const monthEnd = `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;
  const summary = monthSummary(userId, month, today < monthEnd ? today : monthEnd);
  const cats = categoryBreakdown(userId, month).filter((c) => c.budget && c.budget > 0);
  const usedTotal = summary.spentSoFar + summary.scheduled;
  const overallPct = current ? usedTotal / current.totalMyr : 0;

  return (
    <div>
      <AppBar
        title="Budget"
        back={{ href: '/more', label: 'More' }}
      />
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-32 space-y-4 min-h-[calc(100vh-3.5rem)]">
        <form action={saveBudget} className="space-y-4">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">
                Monthly Total
              </label>
              <div className="flex items-center gap-2">
                <span className="text-zinc-500 text-sm">RM</span>
                <input
                  type="number"
                  name="total"
                  step="0.01"
                  min="0"
                  defaultValue={current?.totalMyr ?? 5000}
                  required
                  className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2 text-base tabular-nums"
                />
              </div>
              <p className="text-xs text-zinc-500 mt-1.5">
                Total monthly spending budget across all categories.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Starting Month
              </label>
              <input
                type="month"
                name="startMonth"
                defaultValue={month}
                required
                className="bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2 text-base tabular-nums"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1.5">
                Apply to how many months?
              </label>
              <select
                name="applyMonths"
                defaultValue="12"
                className="bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2 text-base"
              >
                <option value="1">Just this month</option>
                <option value="3">3 months</option>
                <option value="6">6 months</option>
                <option value="12">12 months</option>
                <option value="24">24 months</option>
              </select>
              <p className="text-xs text-zinc-500 mt-1.5">
                Same total applied to N consecutive months. Existing budgets
                are overwritten.
              </p>
            </div>

            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-xl py-3 transition"
            >
              Save Budget
            </button>
          </div>
        </form>

        {current && (
          <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-5">
            <header className="flex items-baseline justify-between mb-3">
              <h2 className="font-medium text-sm">{month} usage</h2>
              <span
                className={
                  'text-xs font-semibold tabular-nums ' +
                  (overallPct > 1
                    ? 'text-rose-600'
                    : overallPct > 0.8
                      ? 'text-amber-600'
                      : 'text-emerald-600')
                }
              >
                {(overallPct * 100).toFixed(0)}%
              </span>
            </header>
            <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden mb-1">
              <div
                className={
                  'h-full ' +
                  (overallPct > 1
                    ? 'bg-rose-500'
                    : overallPct > 0.8
                      ? 'bg-amber-500'
                      : 'bg-emerald-500')
                }
                style={{ width: `${Math.min(overallPct, 1) * 100}%` }}
              />
            </div>
            <div className="text-xs text-zinc-500 tabular-nums">
              {fmtMyr(usedTotal)} of {fmtMyr(current.totalMyr)}
              {summary.scheduled > 0 && (
                <span className="text-amber-600">
                  {' · incl. '}
                  {fmtMyr(summary.scheduled)} scheduled
                </span>
              )}
            </div>
          </section>
        )}

        {cats.length > 0 && (
          <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden">
            <header className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-baseline justify-between">
              <h2 className="font-medium text-sm">Per-category</h2>
              <Link
                href="/more/categories?type=expense"
                className="text-xs text-emerald-600 dark:text-emerald-400 font-medium"
              >
                Edit →
              </Link>
            </header>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {cats.map((c) => {
                const budget = c.budget ?? 0;
                const pct = budget > 0 ? c.spent / budget : 0;
                const { tint, bg } = colorFor(c.color);
                return (
                  <li
                    key={c.id}
                    className="px-5 py-3 flex items-center gap-3"
                  >
                    <span
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: tint, color: bg }}
                    >
                      <CategoryIcon
                        name={c.name}
                        className="w-4 h-4"
                        strokeWidth={2.25}
                      />
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {c.name}
                      </div>
                      <div className="h-1.5 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden mt-1">
                        <div
                          className={
                            'h-full ' +
                            (pct > 1
                              ? 'bg-rose-500'
                              : pct > 0.8
                                ? 'bg-amber-500'
                                : 'bg-emerald-500')
                          }
                          style={{ width: `${Math.min(pct, 1) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div
                        className={
                          'text-sm font-medium tabular-nums ' +
                          (pct > 1 ? 'text-rose-600' : '')
                        }
                      >
                        {fmtNum(c.spent)}
                      </div>
                      <div className="text-[11px] text-zinc-400 tabular-nums">
                        / {fmtNum(budget)}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden">
          <header className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-baseline justify-between">
            <h2 className="font-medium text-sm">Existing budgets</h2>
            <span className="text-xs text-zinc-400">
              {allBudgets.length} month{allBudgets.length === 1 ? '' : 's'}
            </span>
          </header>
          {allBudgets.length === 0 ? (
            <div className="p-5 text-center text-sm text-zinc-500">
              No budgets set yet.
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800 max-h-72 overflow-y-auto">
              {allBudgets.map((b) => (
                <li
                  key={b.month}
                  className={
                    'px-5 py-2.5 flex items-center justify-between text-sm ' +
                    (b.month === month
                      ? 'bg-emerald-50/50 dark:bg-emerald-950/20'
                      : '')
                  }
                >
                  <span className="font-medium tabular-nums">{b.month}</span>
                  <span className="tabular-nums">{fmtMyr(b.totalMyr)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-xs text-zinc-500 text-center">
          Per-category budgets are managed in{' '}
          <Link
            href="/more/categories?type=expense"
            className="text-emerald-600 dark:text-emerald-400 font-medium"
          >
            Categories
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
