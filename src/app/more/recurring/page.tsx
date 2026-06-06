import { AppBar } from '@/components/AppBar';
import { recurringDetections } from '@/lib/queries';
import { fmtMyr, fmtNum } from '@/lib/format';
import { RefreshCw, Calendar } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function RecurringPage() {
  const hits = recurringDetections(12, 3);
  const monthlyTotal = hits.reduce((s, h) => s + h.amount, 0);

  return (
    <div>
      <AppBar
        title="Recurring"
        back={{ href: '/more', label: 'More' }}
      />
      <div className="max-w-3xl mx-auto px-4 pt-4 pb-32 space-y-4 min-h-[calc(100vh-3.5rem)]">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-5">
          <div className="flex items-center gap-3">
            <span className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 flex items-center justify-center">
              <RefreshCw className="w-6 h-6" strokeWidth={2} />
            </span>
            <div className="flex-1">
              <div className="text-xs text-zinc-500 uppercase tracking-wide">
                Estimated monthly
              </div>
              <div className="text-2xl font-bold tabular-nums">
                {fmtMyr(monthlyTotal)}
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs text-zinc-500">{hits.length} subscriptions</div>
              <div className="text-xs text-zinc-400">last 12 months</div>
            </div>
          </div>
        </div>

        {hits.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-10 text-center text-sm text-zinc-500">
            No recurring patterns detected yet.
            <br />
            Need 3+ months of identical amount + description.
          </div>
        ) : (
          <ul className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800">
            {hits.map((h, i) => (
              <li
                key={`${h.accountName}-${h.amount}-${h.description}-${i}`}
                className="px-4 py-3 flex items-center gap-3"
              >
                <span className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center shrink-0">
                  <Calendar
                    className="w-4 h-4 text-zinc-500"
                    strokeWidth={2}
                  />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {h.description || '(no description)'}
                  </div>
                  <div className="text-xs text-zinc-500 truncate">
                    {h.accountName}
                    {h.categoryName ? ` · ${h.categoryName}` : ''}
                    {' · '}
                    {h.monthsSeen}/12 months
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium tabular-nums">
                    RM {fmtNum(h.amount)}
                  </div>
                  <div className="text-xs text-zinc-400 tabular-nums">
                    Σ {fmtNum(h.totalPaid)}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="text-xs text-zinc-400 text-center">
          Detection: same (account · amount · description) appearing in 3+
          distinct months over the last year.
        </p>
      </div>
    </div>
  );
}
