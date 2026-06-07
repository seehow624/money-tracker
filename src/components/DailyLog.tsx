import { fmtNum, currencySymbol } from '@/lib/format';
import { getBaseCurrency } from '@/lib/settings';
import { colorFor } from '@/lib/colors';
import { CategoryIcon, TransferIcon } from '@/lib/icons';
import { Heart } from 'lucide-react';
import Link from 'next/link';
import type { DayGroup, RecentTxn } from '@/lib/queries';

const WEEKEND = new Set(['Sat', 'Sun']);

export function DailyLog({
  days,
  totalIncome,
  totalExpense,
  totalCount,
  month,
  paidByOthers = {},
  labels,
  linkReturnTo,
  aggregateCurrency = getBaseCurrency(),
}: {
  days: DayGroup[];
  totalIncome: number;
  totalExpense: number;
  totalCount: number;
  month: string;
  paidByOthers?: Record<string, number>;
  labels?: { positive: string; negative: string };
  linkReturnTo?: string;
  /** Currency code for aggregate sums (totals + day headers + paid-by). Defaults to MYR. */
  aggregateCurrency?: string;
}) {
  const aggSym = currencySymbol(aggregateCurrency);
  const net = totalIncome - totalExpense;
  const paidByEntries = Object.entries(paidByOthers).filter(([, v]) => v > 0);
  const posLabel = labels?.positive ?? 'Income';
  const negLabel = labels?.negative ?? 'Expense';

  return (
    <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden">
      <div className="grid grid-cols-3 divide-x divide-zinc-100 dark:divide-zinc-800">
        <Total
          label={posLabel}
          value={totalIncome}
          color="text-sky-500"
          sign="+"
          symbol={aggSym}
        />
        <Total
          label={negLabel}
          value={totalExpense}
          color="text-rose-500"
          sign="−"
          symbol={aggSym}
        />
        <Total
          label="Net"
          value={net}
          color={net >= 0 ? 'text-emerald-600' : 'text-rose-600'}
          sign={net >= 0 ? '+' : '−'}
          rawAbs
          symbol={aggSym}
        />
      </div>

      {paidByEntries.length > 0 && (
        <div className="px-4 py-2 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap items-center gap-2 bg-pink-50/40 dark:bg-pink-950/10">
          <Heart
            className="w-3.5 h-3.5 text-pink-500"
            strokeWidth={2.5}
            fill="currentColor"
          />
          <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
            Paid by
          </span>
          {paidByEntries.map(([who, total]) => (
            <Link
              key={who}
              href={`/paid-by/${who}`}
              className="text-xs tabular-nums active:opacity-60"
            >
              <span className="font-medium capitalize text-pink-700 dark:text-pink-300">
                {who}
              </span>
              <span className="text-zinc-500"> · </span>
              <span className="text-pink-700 dark:text-pink-300 font-medium underline decoration-pink-200 dark:decoration-pink-800 underline-offset-2">
                {aggSym} {fmtNum(total)}
              </span>
            </Link>
          ))}
        </div>
      )}

      {days.length === 0 ? (
        <div className="p-10 text-center text-sm text-zinc-500">
          No transactions in {month}.
          <br />
          {totalCount === 0 && 'Nothing logged yet.'}
        </div>
      ) : (
        <ul>
          {days.map((d) => (
            <li
              key={d.date}
              className="border-t border-zinc-100 dark:border-zinc-800"
            >
              <DayHeader day={d} symbol={aggSym} />
              <ul>
                {d.items.map((t) => (
                  <TxnRow key={t.id} t={t} returnTo={linkReturnTo} />
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Total({
  label,
  value,
  color,
  sign,
  symbol,
  rawAbs = false,
}: {
  label: string;
  value: number;
  color: string;
  sign: string;
  symbol: string;
  rawAbs?: boolean;
}) {
  const display = rawAbs ? Math.abs(value) : value;
  return (
    <div className="px-3 py-3 text-center">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-0.5">
        {label}
      </div>
      <div className={`text-base font-semibold tabular-nums ${color}`}>
        {value === 0 ? '0.00' : `${sign}${fmtNum(display)}`}
      </div>
    </div>
  );
}

function DayHeader({ day, symbol }: { day: DayGroup; symbol: string }) {
  const dayNum = day.date.slice(8, 10);
  const isWeekend = WEEKEND.has(day.weekday);
  return (
    <header className="px-4 py-2 flex items-center gap-3 bg-zinc-50/50 dark:bg-zinc-800/30">
      <div className="flex items-baseline gap-2 flex-1 min-w-0">
        <span className="text-2xl font-bold tabular-nums leading-none">
          {dayNum}
        </span>
        <span
          className={
            'text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded ' +
            (isWeekend
              ? 'bg-sky-500 text-white'
              : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300')
          }
        >
          {day.weekday}
        </span>
      </div>
      {day.income > 0 && (
        <span className="text-xs tabular-nums text-sky-500 font-medium">
          {symbol} {fmtNum(day.income)}
        </span>
      )}
      {day.expense > 0 && (
        <span className="text-xs tabular-nums text-rose-500 font-medium">
          {symbol} {fmtNum(day.expense)}
        </span>
      )}
    </header>
  );
}

function TxnRow({ t, returnTo }: { t: RecentTxn; returnTo?: string }) {
  const isTransfer = t.type === 'transfer';
  const { tint, bg } = colorFor(t.color);
  // Append #txn-{id} to returnTo so browser scrolls back to this row after save/delete.
  const returnToWithAnchor = returnTo ? `${returnTo}#txn-${t.id}` : undefined;
  const editHref = returnToWithAnchor
    ? `/transactions/edit/${t.id}?returnTo=${encodeURIComponent(returnToWithAnchor)}`
    : `/transactions/edit/${t.id}`;

  // In account-perspective views (t.direction set), use direction for sign+color.
  // Otherwise fall back to type-based logic.
  let sign: string;
  let amountClass: string;
  if (t.direction !== undefined) {
    sign = t.direction === 'in' ? '+' : '−';
    amountClass = t.direction === 'in' ? 'text-sky-500' : 'text-rose-500';
  } else {
    sign = t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '';
    amountClass =
      t.type === 'income'
        ? 'text-sky-500'
        : isTransfer
          ? 'text-zinc-500'
          : 'text-rose-500';
  }
  return (
    <li id={`txn-${t.id}`} className="scroll-mt-16">
      <Link
        href={editHref}
        className="px-4 py-2.5 flex items-center gap-3 border-t border-zinc-100 dark:border-zinc-800 active:bg-zinc-50 dark:active:bg-zinc-800/50 transition"
      >
      <span
        aria-hidden
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{
          backgroundColor: isTransfer ? '#e4e4e7' : tint,
          color: isTransfer ? '#52525b' : bg,
        }}
      >
        {isTransfer ? (
          <TransferIcon className="w-[18px] h-[18px]" strokeWidth={2.25} />
        ) : (
          <CategoryIcon
            name={t.category}
            className="w-[18px] h-[18px]"
            strokeWidth={2.25}
          />
        )}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] truncate flex items-center gap-1.5">
          <span className="truncate">
            {isTransfer
              ? 'Transfer'
              : t.description ?? <span className="text-zinc-400">—</span>}
          </span>
          {t.paidBy && t.paidBy !== 'me' && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 text-[10px] font-semibold uppercase tracking-wide shrink-0">
              <Heart className="w-2.5 h-2.5" strokeWidth={2.5} fill="currentColor" />
              {t.paidBy}
            </span>
          )}
        </div>
        <div className="text-[11px] text-zinc-500 truncate">
          {isTransfer ? (
            <>
              {t.account} <span className="text-zinc-300">→</span>{' '}
              {t.toAccount ?? '?'}
            </>
          ) : (
            <>
              <span>{t.account}</span>
              {t.category && (
                <>
                  <span className="text-zinc-300"> · </span>
                  <span>{t.category}</span>
                </>
              )}
            </>
          )}
        </div>
      </div>
      <span
        className={
          'tabular-nums text-[14px] font-medium shrink-0 ' + amountClass
        }
      >
        {sign}{currencySymbol(t.currency)} {fmtNum(t.amount)}
      </span>
      </Link>
    </li>
  );
}
