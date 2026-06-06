import { AppBar } from '@/components/AppBar';
import { DailyLog } from '@/components/DailyLog';
import { MonthPicker, MonthTodayButton } from '@/components/MonthPicker';
import { SwipeMonth } from '@/components/SwipeMonth';
import { db, schema } from '@/db';
import { monthTransactions } from '@/lib/queries';
import { thisMonth, fmtMyr } from '@/lib/format';
import { CategoryIcon } from '@/lib/icons';
import { colorFor } from '@/lib/colors';
import { requireSession } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

const MONTH_RE = /^\d{4}-\d{2}$/;

function safeBack(raw: string | undefined): string | null {
  if (!raw) return null;
  const v = raw.trim();
  if (!v.startsWith('/') || v.startsWith('//') || v.includes('://')) return null;
  return v;
}

export default async function CategoryPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string; from?: string }>;
}) {
  const { userId } = await requireSession();
  const { id: idStr } = await props.params;
  const { month: monthParam, from } = await props.searchParams;
  const id = parseInt(idStr, 10);
  if (!Number.isFinite(id)) notFound();

  const cat = db
    .select()
    .from(schema.categories)
    .where(
      and(
        eq(schema.categories.id, id),
        eq(schema.categories.userId, userId),
      ),
    )
    .get();
  if (!cat) notFound();

  const month = monthParam && MONTH_RE.test(monthParam) ? monthParam : thisMonth();

  const log = monthTransactions(userId, month, {
    categoryId: cat.id,
    type: cat.isIncome ? 'income' : 'expense',
  });

  const total = cat.isIncome ? log.totalIncome : log.totalExpense;
  const budget = cat.monthlyBudgetMyr ?? 0;
  const pct = budget > 0 ? total / budget : 0;
  const { tint, bg } = colorFor(cat.color);

  return (
    <div>
      <AppBar
        title={
          <MonthPicker
            value={month}
            routeBase={`/category/${cat.id}`}
            compact
          />
        }
        back={{ href: safeBack(from) ?? `/stats?month=${month}` }}
        trailing={
          <MonthTodayButton
            value={month}
            routeBase={`/category/${cat.id}`}
          />
        }
      />
      <SwipeMonth month={month} basePath={`/category/${cat.id}`}>
        <div className="max-w-3xl mx-auto px-4 pt-4 pb-32 space-y-4 min-h-[calc(100vh-3.5rem)]">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-5">
            <div className="flex items-center gap-3 mb-4">
              <span
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: tint, color: bg }}
              >
                <CategoryIcon
                  name={cat.name}
                  className="w-6 h-6"
                  strokeWidth={2.25}
                />
              </span>
              <div className="flex-1">
                <div className="text-xs text-zinc-500 uppercase tracking-wide">
                  {cat.isIncome ? 'Earned' : 'Spent'}
                </div>
                <div className="text-2xl font-bold tabular-nums">
                  {fmtMyr(total)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs text-zinc-500">{log.totalCount} txns</div>
                {budget > 0 && (
                  <div className="text-xs text-zinc-500 tabular-nums">
                    of {fmtMyr(budget)}
                  </div>
                )}
              </div>
            </div>
            {budget > 0 && (
              <div className="h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                <div
                  className={
                    'h-full ' + (pct > 1 ? 'bg-rose-500' : 'bg-emerald-500')
                  }
                  style={{ width: `${Math.min(pct, 1) * 100}%` }}
                />
              </div>
            )}
          </div>

          <DailyLog
            days={log.days}
            totalIncome={log.totalIncome}
            totalExpense={log.totalExpense}
            totalCount={log.totalCount}
            month={month}
            paidByOthers={log.paidByOthers}
            linkReturnTo={`/category/${cat.id}?month=${month}`}
          />
        </div>
      </SwipeMonth>
    </div>
  );
}
