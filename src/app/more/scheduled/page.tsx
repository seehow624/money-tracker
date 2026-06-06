import { AppBar } from '@/components/AppBar';
import { db, schema } from '@/db';
import { fmtMyr } from '@/lib/format';
import { eq, and } from 'drizzle-orm';
import Link from 'next/link';
import { Calendar, Plus, ArrowUpCircle, ArrowDownCircle, ArrowLeftRight } from 'lucide-react';
import { requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const TYPE_META = {
  expense: { Icon: ArrowUpCircle, color: 'text-rose-500', bg: 'bg-rose-100 dark:bg-rose-900/40' },
  income:  { Icon: ArrowDownCircle, color: 'text-emerald-500', bg: 'bg-emerald-100 dark:bg-emerald-900/40' },
  transfer: { Icon: ArrowLeftRight, color: 'text-zinc-500', bg: 'bg-zinc-100 dark:bg-zinc-800' },
};

function ord(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export default async function ScheduledRulesPage() {
  const { userId } = await requireSession();
  const rules = db
    .select({
      id: schema.scheduledRules.id,
      name: schema.scheduledRules.name,
      type: schema.scheduledRules.type,
      amount: schema.scheduledRules.amount,
      currency: schema.scheduledRules.currency,
      dayOfMonth: schema.scheduledRules.dayOfMonth,
      nextDueDate: schema.scheduledRules.nextDueDate,
      endDate: schema.scheduledRules.endDate,
      active: schema.scheduledRules.active,
      accountName: schema.accounts.name,
    })
    .from(schema.scheduledRules)
    .leftJoin(
      schema.accounts,
      and(
        eq(schema.accounts.id, schema.scheduledRules.accountId),
        eq(schema.accounts.userId, userId),
      ),
    )
    .where(eq(schema.scheduledRules.userId, userId))
    .orderBy(schema.scheduledRules.active, schema.scheduledRules.dayOfMonth)
    .all();

  return (
    <div>
      <AppBar
        title="Scheduled"
        back={{ href: '/more', label: 'More' }}
        trailing={
          <Link
            href="/more/scheduled/new"
            aria-label="Add"
            className="w-9 h-9 rounded-full flex items-center justify-center bg-emerald-600 text-white active:opacity-80"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
          </Link>
        }
      />
      <div className="max-w-3xl mx-auto px-4 pt-4 pb-32 space-y-4 min-h-[calc(100vh-3.5rem)]">
        {rules.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-10 text-center">
            <Calendar className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mx-auto mb-3" />
            <h2 className="font-semibold mb-1">No scheduled rules yet</h2>
            <p className="text-sm text-zinc-500 mb-4">
              Set up automatic monthly transactions like CC payments, salary,
              subscriptions.
            </p>
            <Link
              href="/more/scheduled/new"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-emerald-600 text-white text-sm font-semibold"
            >
              <Plus className="w-4 h-4" strokeWidth={2.5} /> Add rule
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {rules.map((r) => {
              const meta = TYPE_META[r.type as keyof typeof TYPE_META];
              const sign =
                r.type === 'income' ? '+' : r.type === 'transfer' ? '↔' : '−';
              return (
                <li key={r.id}>
                  <Link
                    href={`/more/scheduled/edit/${r.id}`}
                    className={
                      'block bg-white dark:bg-zinc-900 rounded-2xl border p-4 active:bg-zinc-50 dark:active:bg-zinc-800/50 transition ' +
                      (r.active
                        ? 'border-zinc-200/60 dark:border-zinc-800/60'
                        : 'border-zinc-200/60 dark:border-zinc-800/60 opacity-50')
                    }
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={
                          'w-10 h-10 rounded-full flex items-center justify-center shrink-0 ' +
                          meta.bg
                        }
                      >
                        <meta.Icon className={'w-5 h-5 ' + meta.color} strokeWidth={2.25} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate flex items-center gap-1.5">
                          {r.name}
                          {!r.active && (
                            <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-500 font-bold">
                              Paused
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-zinc-500 truncate">
                          {r.accountName} · every {ord(r.dayOfMonth)}
                          {r.endDate ? ` until ${r.endDate}` : ' · forever'}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={'font-semibold tabular-nums ' + meta.color}>
                          {sign}{r.currency === 'MYR' ? 'RM' : r.currency} {r.amount.toFixed(2)}
                        </div>
                        {r.active && (
                          <div className="text-[11px] text-zinc-400 tabular-nums">
                            next {r.nextDueDate?.slice(5) ?? '—'}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}

        {rules.length > 0 && (
          <p className="text-xs text-zinc-400 text-center">
            Rules run automatically every day at 1:00 AM. Tap a rule to edit
            or delete.
          </p>
        )}
      </div>
    </div>
  );
}
