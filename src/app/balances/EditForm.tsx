'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import type { AccountBalance } from '@/lib/queries';
import { saveBalances } from './actions';
import { AccountTypeIcon } from '@/lib/icons';
import { ACCOUNT_TYPE_META, type AccountType } from '@/lib/account-meta';

const TYPE_META = ACCOUNT_TYPE_META;

export function EditForm({
  accounts,
  today,
  typeOrder,
}: {
  accounts: AccountBalance[];
  today: string;
  typeOrder: AccountType[];
}) {
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) => startTransition(() => saveBalances(fd))}
      onChange={() => setDirty(true)}
      className="space-y-4"
    >
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-4 text-xs text-zinc-500">
        Set each account&apos;s starting balance + the date it applies from. Leave
        amount empty to skip. Today: <span className="font-medium tabular-nums">{today}</span>
      </div>

      {typeOrder.map((type) => {
        const list = accounts.filter((a) => a.type === type);
        if (list.length === 0) return null;
        return (
          <section
            key={type}
            className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden"
          >
            <header className="px-5 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2.5">
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{
                  backgroundColor: TYPE_META[type].tint,
                  color: TYPE_META[type].color,
                }}
              >
                <AccountTypeIcon type={type} className="w-4 h-4" strokeWidth={2.25} />
              </span>
              <h2 className="font-medium">{TYPE_META[type].label}</h2>
              {type === 'credit_card' && (
                <span className="text-xs text-zinc-500">
                  Enter outstanding amount owed (positive number)
                </span>
              )}
            </header>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {list.map((a) => (
                <li key={a.id} className="px-5 py-3 flex flex-wrap items-center gap-2">
                  <span className="flex-1 min-w-[8rem] text-sm">{a.name}</span>
                  <span className="text-xs text-zinc-400 w-10">{a.currency}</span>
                  <input
                    type="date"
                    name={`date_${a.id}`}
                    defaultValue={a.startingBalanceDate ?? today}
                    className="px-2 py-1 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm tabular-nums"
                  />
                  <input
                    type="number"
                    step="0.01"
                    name={`balance_${a.id}`}
                    defaultValue={a.startingBalanceDate ? a.startingBalance : ''}
                    placeholder="0.00"
                    className="px-2 py-1 w-28 rounded border border-zinc-300 dark:border-zinc-700 bg-transparent text-sm tabular-nums text-right"
                  />
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      <div className="flex gap-3 justify-end">
        <Link
          href="/balances"
          className="px-4 py-2 rounded-md border border-zinc-300 dark:border-zinc-700 text-sm active:bg-zinc-100 dark:active:bg-zinc-800"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={!dirty || pending}
          className={
            'px-4 py-2 rounded-md text-sm font-medium transition ' +
            (dirty && !pending
              ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 active:scale-95 text-white shadow-md shadow-emerald-600/30'
              : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed')
          }
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  );
}
