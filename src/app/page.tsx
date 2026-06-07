import {
  monthSummary,
  monthTransactions,
} from '@/lib/queries';
import { fmtMoney, thisMonth, daysInMonth, dayOfMonth } from '@/lib/format';
import { MonthPicker } from '@/components/MonthPicker';
import { AppBar } from '@/components/AppBar';
import { DailyLog } from '@/components/DailyLog';
import { SwipeMonth } from '@/components/SwipeMonth';
import { CalendarView } from '@/components/CalendarView';
import { AIInput } from '@/components/AIInput';
import { Search } from 'lucide-react';
import Link from 'next/link';
import { requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const MONTH_RE = /^\d{4}-\d{2}$/;

export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; view?: string }>;
}) {
  const { userId } = await requireSession();
  const params = await searchParams;
  const month =
    params.month && MONTH_RE.test(params.month) ? params.month : thisMonth();
  const view: 'daily' | 'calendar' = params.view === 'calendar' ? 'calendar' : 'daily';
  const todayMonth = thisMonth();
  const isCurrentMonth = month === todayMonth;
  const todayIso = new Date().toISOString().slice(0, 10);

  const monthAnchor = isCurrentMonth
    ? todayIso
    : `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;

  const summary = monthSummary(userId, month, monthAnchor);
  const monthLog = monthTransactions(userId, month);

  const total = daysInMonth(month);
  const today = isCurrentMonth ? dayOfMonth() : total;
  const burnRate = today > 0 ? summary.spentSoFar / today : 0;
  const projected = burnRate * total + summary.scheduled;
  const dailyBudget = summary.budgetMyr / total;
  const onTrack = burnRate <= dailyBudget;
  const usedTotal = summary.spentSoFar + summary.scheduled;
  const pct = summary.budgetMyr > 0 ? usedTotal / summary.budgetMyr : 0;

  const monthLabel = formatMonthLabel(month);

  return (
    <div>
      <AppBar
        title={<MonthPicker value={month} compact />}
        trailing={
          <Link
            href="/search"
            className="flex items-center justify-center w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 active:scale-95 transition-transform"
          >
            <Search className="w-4.5 h-4.5" strokeWidth={2} />
          </Link>
        }
      />

      <SwipeMonth month={month}>
      <div className="max-w-3xl mx-auto px-4 pt-4 pb-32 space-y-4 min-h-[calc(100vh-3.5rem)]">
        <AIInput />

        <HeroCard
          summary={summary}
          pct={pct}
          burnRate={burnRate}
          dailyBudget={dailyBudget}
          projected={projected}
          onTrack={onTrack}
          today={today}
          totalDays={total}
          isCurrentMonth={isCurrentMonth}
        />

        <ViewTabs current={view} month={month} />

        {view === 'calendar' ? (
          <CalendarView month={month} days={monthLog.days} />
        ) : (
          <DailyLog
            days={monthLog.days}
            totalIncome={monthLog.totalIncome}
            totalExpense={monthLog.totalExpense}
            totalCount={monthLog.totalCount}
            month={monthLabel}
            paidByOthers={monthLog.paidByOthers}
          />
        )}
      </div>
      </SwipeMonth>
    </div>
  );
}

function formatMonthLabel(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function HeroCard({
  summary,
  pct,
  burnRate,
  dailyBudget,
  projected,
  onTrack,
  today,
  totalDays,
  isCurrentMonth,
}: {
  summary: { spentSoFar: number; scheduled: number; budgetMyr: number; income: number; remaining: number };
  pct: number;
  burnRate: number;
  dailyBudget: number;
  projected: number;
  onTrack: boolean;
  today: number;
  totalDays: number;
  isCurrentMonth: boolean;
}) {
  const used = summary.spentSoFar + summary.scheduled;
  const pctDisplay = summary.budgetMyr > 0 ? Math.round((used / summary.budgetMyr) * 100) : 0;
  const isOver = pct >= 1;
  const isWarning = pct >= 0.8 && pct < 1;
  const remaining = summary.budgetMyr - used;
  const gradientTo = isOver ? 'rose' : isWarning ? 'amber' : 'tangerine';
  const accentColor = isOver ? '#f43f5e' : isWarning ? '#d97706' : '#F28500';

  return (
    <div className="relative overflow-hidden rounded-[24px] bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 p-6">
      {/* Glow effect */}
      <div
        className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-[0.07] pointer-events-none"
        style={{ background: `radial-gradient(circle, ${accentColor}, transparent 70%)` }}
      />
      <div
        className="dark:opacity-[0.13] absolute -bottom-10 -left-10 w-36 h-36 rounded-full opacity-[0.05] pointer-events-none"
        style={{ background: `radial-gradient(circle, ${accentColor}, transparent 70%)` }}
      />

      {/* Top row: Budget label + spent */}
      <div className="flex items-end justify-between relative z-10">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500">
            Monthly Budget
          </div>
          <div className="flex items-baseline gap-1 mt-0.5">
            <span className="text-[34px] font-extrabold tracking-tight leading-none">
              {fmtMoney(summary.budgetMyr)}
            </span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[28px] font-bold tracking-tight leading-none tabular-nums">
            {fmtMoney(summary.spentSoFar)}
          </div>
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mt-0.5">
            spent
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative z-10 mt-4">
        <div className="h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700`}
            style={{
              width: `${Math.min(pctDisplay, 100)}%`,
              background: isOver
                ? 'linear-gradient(90deg, #fb7185, #f43f5e)'
                : isWarning
                  ? 'linear-gradient(90deg, #fbbf24, #d97706)'
                  : 'linear-gradient(90deg, #F28500, #D97706)',
            }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className={`text-[11px] font-semibold tabular-nums ${isOver ? 'text-rose-500' : 'text-zinc-500'}`}>
            {pctDisplay}%
          </span>
          <span className="text-[11px] font-medium text-zinc-400 tabular-nums">
            {isOver
              ? `Over by ${fmtMoney(Math.abs(remaining))}`
              : `${fmtMoney(remaining)} left`}
          </span>
        </div>
      </div>

      {/* Bottom stats grid */}
      <div className="grid grid-cols-3 gap-3 mt-5 relative z-10">
        <MiniStat
          label="Income"
          value={summary.income}
          tone="income"
        />
        <MiniStat
          label="Avg/day"
          value={burnRate}
        />
        <MiniStat
          label="Projected"
          value={projected}
          tone={projected > summary.budgetMyr ? 'bad' : 'good'}
        />
      </div>
    </div>
  );
}

function ViewTabs({
  current,
  month,
}: {
  current: 'daily' | 'calendar';
  month: string;
}) {
  return (
    <div className="inline-flex bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200/60 dark:border-zinc-800/60 p-1 gap-1">
      {(['daily', 'calendar'] as const).map((v) => {
        const active = current === v;
        return (
          <Link
            key={v}
            href={v === 'daily' ? `/?month=${month}` : `/?month=${month}&view=${v}`}
            scroll={false}
            className={
              'px-5 py-2 text-xs font-semibold rounded-lg transition-all duration-200 capitalize ' +
              (active
                ? 'bg-tangerine text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300')
            }
          >
            {v}
          </Link>
        );
      })}
    </div>
  );
}

function MiniStat({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: number;
  tone?: 'good' | 'bad' | 'income' | 'neutral';
}) {
  const colorCls =
    tone === 'income' ? 'text-emerald-600 dark:text-emerald-400' :
    tone === 'good' ? 'text-emerald-600 dark:text-emerald-400' :
    tone === 'bad' ? 'text-rose-500 dark:text-rose-400' :
    'text-zinc-700 dark:text-zinc-200';
  return (
    <div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-xl px-3 py-2.5 text-center">
      <div className={`text-[17px] font-bold tabular-nums leading-tight ${colorCls}`}>
        {fmtMoney(value)}
      </div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 mt-0.5">
        {label}
      </div>
    </div>
  );
}

