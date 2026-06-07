import {
  accountBalances,
  cumulativeNetFlow,
  type AccountBalance,
} from '@/lib/queries';
import { fmtCurrency, fmtNum, thisMonth, currencySymbol } from '@/lib/format';
import { getAccountTypeOrder, getBaseCurrency } from '@/lib/settings';
import Link from 'next/link';
import { AppBar } from '@/components/AppBar';
import { AccountTypeIcon } from '@/lib/icons';
import { NetFlowChart } from '@/components/NetFlowChart';
import { CreditCard } from 'lucide-react';
import { EditForm } from './EditForm';
import { ReorderForm } from './ReorderForm';
import { ACCOUNT_TYPE_META } from '@/lib/account-meta';
import { requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const TYPE_META = ACCOUNT_TYPE_META;

export default async function BalancesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string; reorder?: string }>;
}) {
  const { userId } = await requireSession();
  const base = getBaseCurrency();
  const params = await searchParams;
  const editing = params.edit === '1';
  const reordering = params.reorder === '1';
  const typeOrder = getAccountTypeOrder(userId);

  const all = accountBalances(userId);
  const visible = all.filter((a) => a.active);

  // Group by type, with currency sub-grouping
  const grouped = new Map<
    AccountBalance['type'],
    AccountBalance[]
  >();
  for (const a of visible) {
    const list = grouped.get(a.type) ?? [];
    list.push(a);
    grouped.set(a.type, list);
  }

  // Per-currency subtotals (native amounts) for the breakdown, plus a single
  // consolidated net worth in the base currency using the daily FX rates (currentMyr).
  const totalsByCurrency = new Map<string, { assets: number; debt: number }>();
  let assetsMyr = 0;
  let debtMyr = 0;
  for (const a of visible) {
    const slot =
      totalsByCurrency.get(a.currency) ??
      ({ assets: 0, debt: 0 } as { assets: number; debt: number });
    if (a.type === 'credit_card') {
      slot.debt += a.current; // CC debt counts against net worth
      debtMyr += a.currentMyr;
    } else {
      slot.assets += a.current; // bank, cash, ewallet, investment all count as assets
      assetsMyr += a.currentMyr;
    }
    totalsByCurrency.set(a.currency, slot);
  }
  const netWorthMyr = assetsMyr - debtMyr;

  const today = new Date().toISOString().slice(0, 10);

  // Account groups in the user's chosen order, for the reorder screen.
  const groupsForReorder = typeOrder
    .map((type) => ({
      type,
      accounts: (grouped.get(type) ?? []).map((a) => ({
        id: a.id,
        name: a.name,
        currency: a.currency,
      })),
    }))
    .filter((g) => g.accounts.length > 0);

  return (
    <div>
      <AppBar
        title="Accounts"
        trailing={
          !editing &&
          !reordering && (
            <div className="flex items-center gap-2">
              <Link
                href="/balances?reorder=1"
                className="px-3 py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 text-xs font-semibold active:opacity-80"
              >
                Reorder
              </Link>
              <Link
                href="/balances?edit=1"
                className="px-3 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-semibold active:opacity-80"
              >
                Edit
              </Link>
            </div>
          )
        }
      />
      <div className="max-w-3xl mx-auto px-4 pt-4 pb-32 space-y-4 min-h-[calc(100vh-3.5rem)]">
        {editing ? (
          <EditForm accounts={visible} today={today} typeOrder={typeOrder} />
        ) : reordering ? (
          <ReorderForm initialGroups={groupsForReorder} />
        ) : (
          <>
            <NetWorthSection
              netWorthMyr={netWorthMyr}
              assetsMyr={assetsMyr}
              debtMyr={debtMyr}
              totalsByCurrency={totalsByCurrency}
              base={base}
            />

            <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-5">
              <header className="flex items-baseline justify-between mb-3">
                <h2 className="text-sm font-semibold">Cash flow trend</h2>
                <span className="text-xs text-zinc-400">last 24 months</span>
              </header>
              <NetFlowChart data={cumulativeNetFlow(userId, thisMonth(), 24)} baseCurrency={base} />
              <p className="text-xs text-zinc-400 mt-2">
                Bars show monthly income/expense. Blue line is cumulative net
                since 24 months ago.
              </p>
            </section>

            {typeOrder.map((type) => {
              const list = grouped.get(type);
              if (!list || list.length === 0) return null;
              const subtotal = list.reduce<Record<string, number>>(
                (acc, a) => ({
                  ...acc,
                  [a.currency]: (acc[a.currency] ?? 0) + a.current,
                }),
                {},
              );
              if (type === 'credit_card') {
                return <CreditCardSection key={type} list={list} base={base} />;
              }
              return (
                <section
                  key={type}
                  className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden"
                >
                  <header className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-baseline justify-between">
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-7 h-7 rounded-full flex items-center justify-center"
                        style={{
                          backgroundColor: TYPE_META[type].tint,
                          color: TYPE_META[type].color,
                        }}
                      >
                        <AccountTypeIcon
                          type={type}
                          className="w-4 h-4"
                          strokeWidth={2.25}
                        />
                      </span>
                      <h2 className="font-medium">{TYPE_META[type].label}</h2>
                      <span className="text-xs text-zinc-400">
                        {list.length} account{list.length === 1 ? '' : 's'}
                      </span>
                    </div>
                    <div className="text-sm font-medium tabular-nums">
                      {Object.entries(subtotal).map(([cur, v]) => (
                        <span key={cur} className="ml-3">
                          {currencySymbol(cur)} {fmtNum(v)}
                        </span>
                      ))}
                    </div>
                  </header>
                  <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {list.map((a) => (
                        <li key={a.id}>
                          <Link
                            href={`/account/${a.id}`}
                            className="px-5 py-3 flex items-center gap-4 text-sm active:bg-zinc-50 dark:active:bg-zinc-800/50 transition"
                          >
                          <span
                            aria-hidden
                            className="w-1 h-8 rounded-full shrink-0"
                            style={{ backgroundColor: TYPE_META[type].color }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{a.name}</div>
                            <div className="text-xs text-zinc-500">
                              {a.txnCount} txns
                              {a.startingBalanceDate
                                ? ` · since ${a.startingBalanceDate}`
                                : ' · since first import'}
                            </div>
                          </div>
                          <div className="text-right">
                            <div
                              className={
                                'tabular-nums font-medium ' +
                                (a.current < 0 ? 'text-rose-600' : '')
                              }
                            >
                              {currencySymbol(a.currency)}{' '}
                              {fmtNum(a.current)}
                            </div>
                            <div className="text-xs text-zinc-400 tabular-nums">
                              start {fmtNum(a.startingBalance)} ·{' '}
                              {a.netDelta >= 0 ? '+' : ''}
                              {fmtNum(a.netDelta)}
                            </div>
                          </div>
                          </Link>
                        </li>
                      ))}
                  </ul>
                </section>
              );
            })}

            <p className="text-xs text-zinc-400 text-center">
              Tip: 'Edit balances' lets you set today's actual balance per
              account. New transactions will adjust from there.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function CreditCardSection({ list, base }: { list: AccountBalance[]; base: string }) {
  // Custom order from the Accounts reorder screen (display_order); no re-sort.
  const sorted = list;

  const totalPayable = sorted.reduce(
    (s, a) => s + (a.ccCycle?.balancePayable ?? 0),
    0,
  );
  const totalOutstanding = sorted.reduce(
    (s, a) => s + (a.ccCycle?.outstanding ?? 0),
    0,
  );

  return (
    <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden">
      <header className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2.5">
        <span
          className="w-7 h-7 rounded-full flex items-center justify-center"
          style={{ backgroundColor: '#ffe4e6', color: '#f43f5e' }}
        >
          <CreditCard className="w-4 h-4" strokeWidth={2.25} />
        </span>
        <h2 className="font-medium">Credit Cards</h2>
        <span className="text-xs text-zinc-400">{list.length} cards</span>
      </header>

      <div className="grid grid-cols-[1fr_auto_auto] gap-x-4 px-5 py-2 text-xs uppercase tracking-wide text-zinc-500 border-b border-zinc-100 dark:border-zinc-800">
        <span>Card</span>
        <span className="text-right">Balance Payable</span>
        <span className="text-right">Outst. Balance</span>
      </div>

      <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {sorted.map((a) => {
          const c = a.ccCycle;
          if (!c) {
            return (
              <li key={a.id}>
                <Link
                  href={`/account/${a.id}`}
                  className="px-5 py-3 grid grid-cols-[1fr_auto_auto] gap-x-4 items-center active:bg-zinc-50 dark:active:bg-zinc-800/50 transition"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{a.name}</div>
                    <div className="text-xs text-zinc-400">
                      Set Stmt/Pay day in Edit
                    </div>
                  </div>
                  <span className="text-right text-zinc-400 text-sm">—</span>
                  <span className="text-right text-zinc-400 text-sm">—</span>
                </Link>
              </li>
            );
          }
          const due =
            c.daysToPayment === 0
              ? 'due today'
              : c.daysToPayment === 1
                ? 'due tomorrow'
                : `due in ${c.daysToPayment}d`;
          return (
            <li key={a.id}>
              <Link
                href={`/account/${a.id}`}
                className="px-5 py-3 grid grid-cols-[1fr_auto_auto] gap-x-4 items-center active:bg-zinc-50 dark:active:bg-zinc-800/50 transition"
              >
              <div className="min-w-0">
                <div className="font-medium truncate">{a.name}</div>
                <div className="text-xs text-zinc-500">
                  Stmt {ord(a.statementDay!)} · Pay {ord(a.paymentDay!)} ·{' '}
                  {due} ({c.nextPaymentDate})
                </div>
              </div>
              <div className="text-right">
                <div
                  className={
                    'tabular-nums font-medium ' +
                    (c.balancePayable > 0 ? 'text-rose-600' : 'text-zinc-400')
                  }
                >
                  {currencySymbol(a.currency)} {fmtNum(c.balancePayable)}
                </div>
                <div className="text-xs text-zinc-400 tabular-nums">
                  netΔ {fmtNum(a.netDelta)}
                </div>
              </div>
              <div className="text-right">
                <div
                  className={
                    'tabular-nums font-medium ' +
                    (c.outstanding > 0
                      ? 'text-rose-500'
                      : c.outstanding < 0
                        ? 'text-emerald-600'
                        : 'text-zinc-400')
                  }
                >
                  {currencySymbol(a.currency)} {fmtNum(c.outstanding)}
                </div>
                <div className="text-xs text-zinc-400 tabular-nums">
                  next stmt {c.nextStmtDate.slice(5)}
                </div>
              </div>
              </Link>
            </li>
          );
        })}
      </ul>

      <footer className="px-5 py-3 border-t border-zinc-100 dark:border-zinc-800 grid grid-cols-[1fr_auto_auto] gap-x-4 text-sm font-medium">
        <span className="text-zinc-500">Total</span>
        <span
          className={
            'text-right tabular-nums ' +
            (totalPayable > 0 ? 'text-rose-600' : '')
          }
        >
          {fmtCurrency(totalPayable, base)}
        </span>
        <span
          className={
            'text-right tabular-nums ' +
            (totalOutstanding > 0 ? 'text-rose-500' : '')
          }
        >
          {fmtCurrency(totalOutstanding, base)}
        </span>
      </footer>
    </section>
  );
}

function ord(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

function NetWorthSection({
  netWorthMyr,
  assetsMyr,
  debtMyr,
  totalsByCurrency,
  base,
}: {
  netWorthMyr: number;
  assetsMyr: number;
  debtMyr: number;
  totalsByCurrency: Map<string, { assets: number; debt: number }>;
  base: string;
}) {
  const currencies = Array.from(totalsByCurrency.entries());
  const multiCurrency = currencies.length > 1;

  return (
    <section className="space-y-3">
      {/* Consolidated net worth — every account converted to the base currency via daily FX. */}
      <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-2xl p-5 shadow-md shadow-emerald-600/20">
        <div className="text-xs uppercase tracking-wide text-emerald-50/80 mb-1">
          Net Worth{multiCurrency ? ` · all accounts in ${base}` : ''}
        </div>
        <div
          className={
            'text-3xl font-bold tabular-nums ' +
            (netWorthMyr < 0 ? 'text-rose-100' : '')
          }
        >
          {fmtCurrency(netWorthMyr, base)}
        </div>
        <div className="text-xs text-emerald-50/80 mt-1 tabular-nums">
          {fmtCurrency(assetsMyr, base)} assets − {fmtCurrency(debtMyr, base)} CC debt
          {multiCurrency ? ' · FX at latest rate' : ''}
        </div>
      </div>

      {/* Native-currency breakdown, only when holding more than one currency. */}
      {multiCurrency && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {currencies.map(([cur, t]) => {
            const net = t.assets - t.debt;
            const sym = currencySymbol(cur);
            return (
              <div
                key={cur}
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-4"
              >
                <div className="text-xs uppercase tracking-wide text-zinc-500 mb-1">
                  {cur}
                </div>
                <div
                  className={
                    'text-xl font-semibold tabular-nums ' +
                    (net < 0 ? 'text-rose-600' : '')
                  }
                >
                  {sym} {fmtNum(net)}
                </div>
                <div className="text-xs text-zinc-500 mt-1 tabular-nums">
                  {sym} {fmtNum(t.assets)} − {sym} {fmtNum(t.debt)} CC
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

