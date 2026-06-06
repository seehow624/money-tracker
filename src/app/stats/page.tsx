import {
  rangeSummary,
  rangeCategoryBreakdown,
  monthlyCategorySeries,
  monthlyTotals,
  monthRange,
  weekRange,
  yearRange,
  currentISOWeek,
  type CategoryRow,
  type Period,
  type DateRange,
} from '@/lib/queries';
import { fmtMyr, thisMonth } from '@/lib/format';
import { colorFor } from '@/lib/colors';
import { MonthPicker, MonthTodayButton } from '@/components/MonthPicker';
import { MonthlyPie } from '@/components/MonthlyPie';
import { CategoryTrendChart } from '@/components/CategoryTrendChart';
import { YearTrendChart } from '@/components/YearTrendChart';
import { AppBar } from '@/components/AppBar';
import { SwipeMonth } from '@/components/SwipeMonth';
import { CategoryIcon } from '@/lib/icons';
import { paletteFor } from '@/lib/palette';
import { WeekPicker, YearPicker } from '@/components/PeriodPicker';
import { CategoryChips } from '@/components/CategoryChips';
import { db, schema } from '@/db';
import { eq, isNull, and } from 'drizzle-orm';
import Link from 'next/link';
import { requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MONTH_RE = /^\d{4}-\d{2}$/;
const WEEK_RE = /^\d{4}-W\d{2}$/;
const YEAR_RE = /^\d{4}$/;

type View = 'chart' | 'list' | 'trend';

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<{
    period?: string;
    month?: string;
    week?: string;
    year?: string;
    type?: string;
    view?: string;
    cats?: string;
  }>;
}) {
  const { userId } = await requireSession();
  const params = await searchParams;
  const period: Period =
    params.period === 'weekly'
      ? 'weekly'
      : params.period === 'annually'
        ? 'annually'
        : 'monthly';
  const type: 'expense' | 'income' =
    params.type === 'income' ? 'income' : 'expense';
  const view: View =
    params.view === 'list' ? 'list' : params.view === 'trend' ? 'trend' : 'chart';

  // Resolve range based on period
  let range: DateRange;
  if (period === 'monthly') {
    const m = params.month && MONTH_RE.test(params.month) ? params.month : thisMonth();
    range = monthRange(m);
  } else if (period === 'weekly') {
    const w = params.week && WEEK_RE.test(params.week) ? params.week : currentISOWeek();
    range = weekRange(w);
  } else {
    const y = params.year && YEAR_RE.test(params.year)
      ? params.year
      : String(new Date().getUTCFullYear());
    range = yearRange(y);
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const summary = rangeSummary(userId, range, todayIso);
  const cats = rangeCategoryBreakdown(userId, range, type);
  const total = type === 'expense' ? summary.spentSoFar + summary.scheduled : summary.income;

  // For annual view: 12 monthly bars of that year
  const annualMonthly =
    period === 'annually'
      ? monthlyTotals(userId, `${range.label}-12`, 12)
      : null;

  // For trend view: always show last 12 months ending at the range's end
  const trendAnchorMonth = range.end.slice(0, 7);
  const selectedCatIds = (params.cats ?? '')
    .split(',')
    .map((s) => parseInt(s, 10))
    .filter(Number.isFinite);
  const trendData =
    view === 'trend'
      ? monthlyCategorySeries(
          userId,
          trendAnchorMonth,
          12,
          5,
          selectedCatIds.length > 0 ? selectedCatIds : undefined,
        )
      : null;
  const trendAllCats =
    view === 'trend'
      ? db
          .select({
            id: schema.categories.id,
            name: schema.categories.name,
            color: schema.categories.color,
          })
          .from(schema.categories)
          .where(
            and(
              eq(schema.categories.active, true),
              isNull(schema.categories.parentId),
              eq(schema.categories.isIncome, type === 'income'),
              eq(schema.categories.userId, userId),
            ),
          )
          .orderBy(schema.categories.displayOrder, schema.categories.id)
          .all()
      : [];

  // Picker setup
  const pickerExtras: Record<string, string> = {};
  if (params.type) pickerExtras.type = type;
  if (params.view) pickerExtras.view = view;
  if (period !== 'monthly') pickerExtras.period = period;

  return (
    <div>
      <AppBar
        title={
          period === 'monthly' ? (
            <MonthPicker
              value={range.label}
              routeBase="/stats"
              extraParams={pickerExtras}
              compact
            />
          ) : period === 'weekly' ? (
            <WeekPicker
              value={range.label}
              routeBase="/stats"
              extraParams={pickerExtras}
            />
          ) : (
            <YearPicker
              value={range.label}
              routeBase="/stats"
              extraParams={pickerExtras}
            />
          )
        }
        trailing={
          period === 'monthly' ? (
            <MonthTodayButton
              value={range.label}
              routeBase="/stats"
              extraParams={pickerExtras}
            />
          ) : null
        }
      />
      <SwipeMonth
        month={period === 'monthly' ? range.label : thisMonth()}
        basePath="/stats"
        extraParams={pickerExtras}
      >
        <div className="max-w-3xl mx-auto px-4 pt-4 pb-40 space-y-4 min-h-[calc(100vh-3.5rem)]">
          <PeriodTabs current={period} type={type} view={view} />

          {annualMonthly && (
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-5">
              <h2 className="text-sm font-semibold mb-3">
                {range.label} · 12 months
              </h2>
              <YearTrendChart data={annualMonthly} />
            </div>
          )}

          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-zinc-100 dark:divide-zinc-800 border-b border-zinc-100 dark:border-zinc-800">
              <Link
                href={buildHref('/stats', { ...pickerExtras, type: 'income' }, period, range)}
                scroll={false}
                className={
                  'px-5 py-4 text-center transition-colors ' +
                  (type === 'income'
                    ? 'bg-emerald-50 dark:bg-emerald-950/30'
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50')
                }
              >
                <div
                  className={
                    'text-xs uppercase tracking-wide ' +
                    (type === 'income' ? 'text-emerald-700' : 'text-zinc-500')
                  }
                >
                  Income
                </div>
                <div
                  className={
                    'text-xl font-semibold tabular-nums ' +
                    (type === 'income'
                      ? 'text-emerald-700'
                      : 'text-zinc-700 dark:text-zinc-300')
                  }
                >
                  {fmtMyr(summary.income)}
                </div>
              </Link>
              <Link
                href={buildHref('/stats', { ...pickerExtras, type: 'expense' }, period, range)}
                scroll={false}
                className={
                  'px-5 py-4 text-center transition-colors ' +
                  (type === 'expense'
                    ? 'bg-rose-50 dark:bg-rose-950/30'
                    : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50')
                }
              >
                <div
                  className={
                    'text-xs uppercase tracking-wide ' +
                    (type === 'expense' ? 'text-rose-700' : 'text-zinc-500')
                  }
                >
                  Expense
                </div>
                <div
                  className={
                    'text-xl font-semibold tabular-nums ' +
                    (type === 'expense'
                      ? 'text-rose-700'
                      : 'text-zinc-700 dark:text-zinc-300')
                  }
                >
                  {fmtMyr(summary.spentSoFar + summary.scheduled)}
                </div>
              </Link>
            </div>

            <ViewTabs current={view} period={period} range={range} type={type} />

            {view === 'chart' && (
              <MonthlyPie
                data={cats.map((c) => ({
                  id: c.id,
                  name: c.name,
                  spent: c.spent,
                  icon: c.icon,
                  color: c.color,
                }))}
              />
            )}

            {view === 'trend' && trendData && (
              <div className="p-3 space-y-3">
                {trendData.categories.length === 0 ? (
                  <div className="h-48 flex items-center justify-center text-sm text-zinc-500">
                    No history for selected categories.
                  </div>
                ) : (
                  <CategoryTrendChart
                    data={trendData.data}
                    categories={trendData.categories}
                  />
                )}
                <p className="text-xs text-zinc-400 text-center">
                  Last 12 months ending {trendAnchorMonth}
                </p>
                <CategoryChips
                  all={trendAllCats}
                  selectedIds={selectedCatIds}
                />
              </div>
            )}
          </div>

          {(view === 'chart' || view === 'list') && (
            <CategoryList
              cats={cats}
              total={total}
              type={type}
              drillMonth={range.start.slice(0, 7)}
            />
          )}
        </div>
      </SwipeMonth>
    </div>
  );
}

function buildHref(
  base: string,
  extras: Record<string, string>,
  period: Period,
  range: DateRange,
): string {
  const params = new URLSearchParams(extras);
  if (period === 'monthly') params.set('month', range.label);
  else if (period === 'weekly') params.set('week', range.label);
  else params.set('year', range.label);
  return `${base}?${params.toString()}`;
}

function PeriodTabs({
  current,
  type,
  view,
}: {
  current: Period;
  type: string;
  view: string;
}) {
  const periods: { value: Period; label: string; build: () => Record<string, string> }[] = [
    {
      value: 'monthly',
      label: 'Monthly',
      build: () => ({ type, view, month: thisMonth() }),
    },
    {
      value: 'weekly',
      label: 'Weekly',
      build: () => ({ period: 'weekly', type, view, week: currentISOWeek() }),
    },
    {
      value: 'annually',
      label: 'Annually',
      build: () => ({
        period: 'annually',
        type,
        view,
        year: String(new Date().getUTCFullYear()),
      }),
    },
  ];

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-full border border-zinc-200/60 dark:border-zinc-800/60 grid grid-cols-3 p-1">
      {periods.map((p) => {
        const params = new URLSearchParams(p.build());
        const active = current === p.value;
        return (
          <Link
            key={p.value}
            href={`/stats?${params.toString()}`}
            scroll={false}
            className={
              'text-center py-1.5 text-xs font-semibold rounded-full transition ' +
              (active
                ? 'bg-emerald-600 text-white'
                : 'text-zinc-500 active:bg-zinc-100 dark:active:bg-zinc-800')
            }
          >
            {p.label}
          </Link>
        );
      })}
    </div>
  );
}

function ViewTabs({
  current,
  period,
  range,
  type,
}: {
  current: View;
  period: Period;
  range: DateRange;
  type: string;
}) {
  const views: { value: View; label: string }[] = [
    { value: 'chart', label: 'Chart' },
    { value: 'list', label: 'List' },
    { value: 'trend', label: 'Trend' },
  ];
  return (
    <div className="grid grid-cols-3 border-b border-zinc-100 dark:border-zinc-800">
      {views.map((v) => {
        const active = current === v.value;
        const params: Record<string, string> = { type, view: v.value };
        if (period !== 'monthly') params.period = period;
        return (
          <Link
            key={v.value}
            href={buildHref('/stats', params, period, range)}
            scroll={false}
            className={
              'py-2.5 text-center text-xs font-semibold transition ' +
              (active
                ? 'text-emerald-600 border-b-2 border-emerald-600 -mb-px'
                : 'text-zinc-500 active:bg-zinc-100 dark:active:bg-zinc-800')
            }
          >
            {v.label}
          </Link>
        );
      })}
    </div>
  );
}

function CategoryList({
  cats,
  total,
  type,
  drillMonth,
}: {
  cats: CategoryRow[];
  total: number;
  type: 'expense' | 'income';
  drillMonth: string;
}) {
  const filtered = cats.filter((c) => c.spent > 0);
  if (filtered.length === 0) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-8 text-center text-sm text-zinc-500">
        No {type} categories in this period.
      </div>
    );
  }
  // Build the "from" URL so that category drill-down's back button returns here exactly.
  const statsParams = new URLSearchParams();
  if (drillMonth) statsParams.set('month', drillMonth);
  statsParams.set('type', type);
  const fromUrl = `/stats?${statsParams.toString()}`;
  return (
    <ul className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800">
      {filtered.map((c, idx) => {
        const pct = total > 0 ? (c.spent / total) * 100 : 0;
        const { bg, tint } = colorFor(c.color);
        const sliceColor = paletteFor(idx);
        return (
          <li key={c.id}>
            <Link
              href={`/category/${c.id}?month=${drillMonth}&from=${encodeURIComponent(fromUrl)}`}
              className="px-4 py-3 flex items-center gap-3 text-sm active:bg-zinc-50 dark:active:bg-zinc-800/50 transition"
            >
              <span
                className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: tint, color: bg }}
              >
                <CategoryIcon
                  name={c.name}
                  className="w-5 h-5"
                  strokeWidth={2.25}
                />
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate flex items-center gap-1.5">
                  {c.name}
                  {!c.isIncome && c.budget && c.spent > c.budget && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
                      Over
                    </span>
                  )}
                  {!c.isIncome && c.budget && c.spent > c.budget * 0.8 && c.spent <= c.budget && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300">
                      80%
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-400 tabular-nums">
                  {c.txnCount} txns
                  {!c.isIncome && c.budget
                    ? ` · budget ${fmtMyr(c.budget)}`
                    : ''}
                </div>
              </div>
              <span
                className="px-2 py-0.5 rounded-full text-[11px] font-semibold tabular-nums shrink-0"
                style={{ backgroundColor: sliceColor, color: '#fff' }}
              >
                {pct.toFixed(0)}%
              </span>
              <div className="text-right">
                <div className="tabular-nums font-medium">{fmtMyr(c.spent)}</div>
                <div className="text-xs text-zinc-400 tabular-nums">
                  {pct.toFixed(1)}%
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
