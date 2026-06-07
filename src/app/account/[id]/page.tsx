import { AppBar } from '@/components/AppBar';
import { DailyLog } from '@/components/DailyLog';
import { MonthPicker, MonthTodayButton } from '@/components/MonthPicker';
import { SwipeMonth } from '@/components/SwipeMonth';
import { db, schema } from '@/db';
import { accountMonthLog, accountBalances } from '@/lib/queries';
import { thisMonth, fmtNum, currencySymbol } from '@/lib/format';
import { AccountTypeIcon } from '@/lib/icons';
import { requireSession } from '@/lib/auth';
import { eq, and } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { CreditCard } from 'lucide-react';

export const dynamic = 'force-dynamic';

const MONTH_RE = /^\d{4}-\d{2}$/;

const TYPE_TINT: Record<string, { tint: string; bg: string }> = {
  bank: { tint: '#dbeafe', bg: '#3b82f6' },
  credit_card: { tint: '#ffe4e6', bg: '#f43f5e' },
  ewallet: { tint: '#ede9fe', bg: '#8b5cf6' },
  cash: { tint: '#d1fae5', bg: '#10b981' },
  investment: { tint: '#fef3c7', bg: '#f59e0b' },
};

export default async function AccountPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { userId } = await requireSession();
  const { id: idStr } = await props.params;
  const { month: monthParam } = await props.searchParams;
  const id = parseInt(idStr, 10);
  if (!Number.isFinite(id)) notFound();

  const acct = db
    .select()
    .from(schema.accounts)
    .where(
      and(
        eq(schema.accounts.id, id),
        eq(schema.accounts.userId, userId),
      ),
    )
    .get();
  if (!acct) notFound();

  const month =
    monthParam && MONTH_RE.test(monthParam) ? monthParam : thisMonth();

  const log = accountMonthLog(userId, acct.id, month);
  const allBal = accountBalances(userId);
  const bal = allBal.find((a) => a.id === acct.id);
  const tint = TYPE_TINT[acct.type] ?? TYPE_TINT.bank;

  return (
    <div>
      <AppBar
        title={
          <div className="flex flex-col items-center leading-tight">
            <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-semibold">
              {acct.name}
            </span>
            <MonthPicker
              value={month}
              routeBase={`/account/${acct.id}`}
              compact
            />
          </div>
        }
        back={{ href: '/balances' }}
        trailing={
          <MonthTodayButton
            value={month}
            routeBase={`/account/${acct.id}`}
          />
        }
      />
      <SwipeMonth month={month} basePath={`/account/${acct.id}`}>
        <div className="max-w-3xl mx-auto px-4 pt-4 pb-32 space-y-4 min-h-[calc(100vh-3.5rem)]">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-5">
            <div className="flex items-center gap-3">
              <span
                className="w-12 h-12 rounded-full flex items-center justify-center"
                style={{ backgroundColor: tint.tint, color: tint.bg }}
              >
                <AccountTypeIcon
                  type={acct.type}
                  className="w-6 h-6"
                  strokeWidth={2.25}
                />
              </span>
              <div className="flex-1">
                <div className="text-xs text-zinc-500 uppercase tracking-wide">
                  Current balance
                </div>
                <div
                  className={
                    'text-2xl font-bold tabular-nums ' +
                    (bal && bal.current < 0 ? 'text-rose-600' : '')
                  }
                >
                  {currencySymbol(acct.currency)}{' '}
                  {bal ? fmtNum(bal.current) : '—'}
                </div>
                {bal && bal.ccCycle ? (
                  <div className="text-xs text-zinc-400 tabular-nums mt-0.5">
                    payable {fmtNum(bal.ccCycle.balancePayable)}
                    {' · '}
                    outstanding {fmtNum(bal.ccCycle.outstanding)}
                  </div>
                ) : bal && (
                  <div className="text-xs text-zinc-400 tabular-nums mt-0.5">
                    starting {fmtNum(bal.startingBalance)}
                    {' · '}
                    {bal.netDelta >= 0 ? '+' : ''}
                    {fmtNum(bal.netDelta)} all-time
                  </div>
                )}
              </div>
            </div>
            {acct.type === 'credit_card' && bal?.ccCycle && (
              <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-2 gap-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                    Balance Payable
                  </div>
                  <div
                    className={
                      'text-base font-semibold tabular-nums ' +
                      (bal.ccCycle.balancePayable > 0 ? 'text-rose-600' : '')
                    }
                  >
                    {currencySymbol(acct.currency)} {fmtNum(bal.ccCycle.balancePayable)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wide text-zinc-500">
                    Outstanding
                  </div>
                  <div
                    className={
                      'text-base font-semibold tabular-nums ' +
                      (bal.ccCycle.outstanding > 0 ? 'text-rose-500' : '')
                    }
                  >
                    {currencySymbol(acct.currency)} {fmtNum(bal.ccCycle.outstanding)}
                  </div>
                </div>
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
            labels={{ positive: 'Deposit', negative: 'Withdrawal' }}
            linkReturnTo={`/account/${acct.id}?month=${month}`}
            aggregateCurrency={acct.currency}
          />
        </div>
      </SwipeMonth>
      {acct.type === 'credit_card' && bal?.ccCycle && bal.ccCycle.balancePayable > 0 && (
        <PayButton
          ccId={acct.id}
          amount={bal.ccCycle.balancePayable}
          returnTo={`/account/${acct.id}?month=${month}`}
        />
      )}
    </div>
  );
}

function PayButton({
  ccId,
  amount,
  returnTo,
}: {
  ccId: number;
  amount: number;
  returnTo: string;
}) {
  // Default source: the first account (id=1)
  const params = new URLSearchParams({
    type: 'transfer',
    accountId: '1',
    toAccountId: String(ccId),
    amount: amount.toFixed(2),
    returnTo,
  });
  return (
    <Link
      href={`/transactions/new?${params}`}
      aria-label="Pay credit card"
      className="fixed right-4 z-30 px-4 h-14 rounded-full bg-rose-600 hover:bg-rose-700 active:bg-rose-800 active:scale-95 text-white font-semibold flex items-center gap-2 shadow-lg shadow-rose-600/40 transition"
      style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom) + 4rem)' }}
    >
      <CreditCard className="w-5 h-5" strokeWidth={2.5} />
      Pay {fmtNum(amount)}
    </Link>
  );
}
