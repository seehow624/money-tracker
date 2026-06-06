import { fmtNum } from '@/lib/format';
import type { DayGroup } from '@/lib/queries';

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export function CalendarView({
  month,
  days,
}: {
  month: string;
  days: DayGroup[];
}) {
  const [yr, mo] = month.split('-').map(Number);
  const firstDay = new Date(Date.UTC(yr, mo - 1, 1));
  const firstWeekday = firstDay.getUTCDay();
  const lastDay = new Date(Date.UTC(yr, mo, 0)).getUTCDate();

  const dayMap = new Map(days.map((d) => [d.date, d]));
  const todayIso = new Date().toISOString().slice(0, 10);

  const cells: ({ day: number; date: string; data?: DayGroup } | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${month}-${String(d).padStart(2, '0')}`;
    cells.push({ day: d, date: dateStr, data: dayMap.get(dateStr) });
  }
  while (cells.length % 7 !== 0) cells.push(null);

  const maxExpense = Math.max(0, ...days.map((d) => d.expense));

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-3">
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAY_LABELS.map((w, i) => (
          <div
            key={w}
            className={
              'text-center text-[10px] font-semibold uppercase tracking-wide ' +
              (i === 0 || i === 6 ? 'text-sky-500' : 'text-zinc-400')
            }
          >
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) => {
          if (!c) return <div key={i} className="aspect-square" />;
          const intensity =
            maxExpense > 0 && c.data ? c.data.expense / maxExpense : 0;
          const isToday = c.date === todayIso;
          return (
            <a
              key={c.date}
              href={`#day-${c.date}`}
              className={
                'aspect-square rounded-lg flex flex-col items-center justify-between p-1 text-xs transition active:scale-95 ' +
                (isToday
                  ? 'ring-2 ring-emerald-500 '
                  : 'border border-zinc-100 dark:border-zinc-800 ')
              }
              style={{
                backgroundColor:
                  intensity > 0
                    ? `rgba(244, 63, 94, ${0.08 + intensity * 0.5})`
                    : undefined,
              }}
            >
              <span
                className={
                  'self-stretch text-left text-[10px] tabular-nums ' +
                  (isToday
                    ? 'text-emerald-700 font-bold'
                    : c.data
                      ? 'text-zinc-700 dark:text-zinc-300 font-semibold'
                      : 'text-zinc-400')
                }
              >
                {c.day}
              </span>
              {c.data && c.data.expense > 0 && (
                <span className="text-[9px] tabular-nums text-rose-600 font-medium leading-none">
                  {c.data.expense >= 100
                    ? Math.round(c.data.expense)
                    : fmtNum(c.data.expense)}
                </span>
              )}
              {c.data && c.data.income > 0 && c.data.expense === 0 && (
                <span className="text-[9px] tabular-nums text-sky-500 font-medium leading-none">
                  +{c.data.income < 100 ? fmtNum(c.data.income) : Math.round(c.data.income)}
                </span>
              )}
            </a>
          );
        })}
      </div>
    </div>
  );
}
