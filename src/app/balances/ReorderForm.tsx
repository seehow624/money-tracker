'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronUp, ChevronDown, GripVertical } from 'lucide-react';
import { AccountTypeIcon } from '@/lib/icons';
import { ACCOUNT_TYPE_META, type AccountType } from '@/lib/account-meta';
import { saveAccountOrder } from './actions';

type Item = { id: number; name: string; currency: string };
type Group = { type: AccountType; accounts: Item[] };

export function ReorderForm({ initialGroups }: { initialGroups: Group[] }) {
  const [groups, setGroups] = useState<Group[]>(initialGroups);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function moveGroup(idx: number, dir: -1 | 1) {
    const j = idx + dir;
    if (j < 0 || j >= groups.length) return;
    const next = groups.slice();
    [next[idx], next[j]] = [next[j], next[idx]];
    setGroups(next);
    setDirty(true);
  }

  function moveAccount(gIdx: number, aIdx: number, dir: -1 | 1) {
    const accounts = groups[gIdx].accounts;
    const j = aIdx + dir;
    if (j < 0 || j >= accounts.length) return;
    const nextAccounts = accounts.slice();
    [nextAccounts[aIdx], nextAccounts[j]] = [nextAccounts[j], nextAccounts[aIdx]];
    const next = groups.slice();
    next[gIdx] = { ...next[gIdx], accounts: nextAccounts };
    setGroups(next);
    setDirty(true);
  }

  function save() {
    const typeOrder = groups.map((g) => g.type);
    const accountIds = groups.flatMap((g) => g.accounts.map((a) => a.id));
    startTransition(async () => {
      await saveAccountOrder({ typeOrder, accountIds });
      router.push('/balances');
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-4 text-xs text-zinc-500">
        Use the arrows to reorder the account groups and the accounts inside each
        one. The order you set here is what the Accounts page shows.
      </div>

      {groups.map((group, gIdx) => {
        const meta = ACCOUNT_TYPE_META[group.type];
        return (
          <section
            key={group.type}
            className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden"
          >
            <header className="px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-2.5">
              <span
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: meta.tint, color: meta.color }}
              >
                <AccountTypeIcon
                  type={group.type}
                  className="w-4 h-4"
                  strokeWidth={2.25}
                />
              </span>
              <h2 className="font-medium flex-1">{meta.label}</h2>
              <MoveBtn
                dir={-1}
                disabled={gIdx === 0}
                onClick={() => moveGroup(gIdx, -1)}
                label={`Move ${meta.label} up`}
              />
              <MoveBtn
                dir={1}
                disabled={gIdx === groups.length - 1}
                onClick={() => moveGroup(gIdx, 1)}
                label={`Move ${meta.label} down`}
              />
            </header>
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {group.accounts.map((a, aIdx) => (
                <li
                  key={a.id}
                  className="px-4 py-2.5 flex items-center gap-3 text-sm"
                >
                  <GripVertical className="w-4 h-4 text-zinc-300 dark:text-zinc-600 shrink-0" />
                  <span className="flex-1 min-w-0 truncate font-medium">
                    {a.name}
                  </span>
                  <span className="text-xs text-zinc-400 w-10 text-right tabular-nums">
                    {a.currency}
                  </span>
                  <MoveBtn
                    dir={-1}
                    disabled={aIdx === 0}
                    onClick={() => moveAccount(gIdx, aIdx, -1)}
                    label={`Move ${a.name} up`}
                  />
                  <MoveBtn
                    dir={1}
                    disabled={aIdx === group.accounts.length - 1}
                    onClick={() => moveAccount(gIdx, aIdx, 1)}
                    label={`Move ${a.name} down`}
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
          type="button"
          onClick={save}
          disabled={!dirty || pending}
          className={
            'px-4 py-2 rounded-md text-sm font-medium transition ' +
            (dirty && !pending
              ? 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 active:scale-95 text-white shadow-md shadow-emerald-600/30'
              : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500 cursor-not-allowed')
          }
        >
          {pending ? 'Saving…' : 'Save order'}
        </button>
      </div>
    </div>
  );
}

function MoveBtn({
  dir,
  disabled,
  onClick,
  label,
}: {
  dir: -1 | 1;
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  const Icon = dir < 0 ? ChevronUp : ChevronDown;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={
        'w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition ' +
        (disabled
          ? 'text-zinc-300 dark:text-zinc-700 cursor-not-allowed'
          : 'text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 active:scale-90')
      }
    >
      <Icon className="w-4 h-4" strokeWidth={2.5} />
    </button>
  );
}
