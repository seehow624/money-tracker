'use client';

import { useState } from 'react';
import { BASE_SYMBOL } from '@/lib/format';
import {
  saveScheduledRule,
  deleteScheduledRule,
  toggleScheduledRule,
} from '@/app/more/scheduled/actions';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  Save,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

type Account = { id: number; name: string; currency: string };
type Category = { id: number; name: string; isIncome: boolean };

type Initial = {
  id?: number;
  name: string;
  type: 'expense' | 'income' | 'transfer';
  amount: number | null;
  accountId: number | null;
  toAccountId: number | null;
  categoryId: number | null;
  description: string;
  paidBy: string;
  dayOfMonth: number;
  startDate: string;
  endDate: string;
  active: boolean;
};

const TYPE_META: Record<
  Initial['type'],
  { label: string; Icon: LucideIcon; color: string; bg: string }
> = {
  expense: { label: 'Expense', Icon: ArrowUpCircle, color: 'text-rose-700', bg: 'bg-rose-50 dark:bg-rose-950/30' },
  income: { label: 'Income', Icon: ArrowDownCircle, color: 'text-emerald-700', bg: 'bg-emerald-50 dark:bg-emerald-950/30' },
  transfer: { label: 'Transfer', Icon: ArrowLeftRight, color: 'text-zinc-700', bg: 'bg-zinc-100 dark:bg-zinc-800/50' },
};

export function ScheduledRuleForm({
  initial,
  accounts,
  categories,
}: {
  initial: Initial;
  accounts: Account[];
  categories: Category[];
}) {
  const [type, setType] = useState(initial.type);
  const [endless, setEndless] = useState(initial.endDate === '');
  const isEdit = initial.id != null;

  const filteredCats = categories
    .filter((c) => c.isIncome === (type === 'income'))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <form action={saveScheduledRule} className="space-y-4">
      {initial.id != null && <input type="hidden" name="id" value={initial.id} />}

      {/* Type */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 grid grid-cols-3 divide-x divide-zinc-100 dark:divide-zinc-800 overflow-hidden">
        {(['expense', 'income', 'transfer'] as const).map((t) => {
          const m = TYPE_META[t];
          const active = type === t;
          return (
            <label
              key={t}
              className={
                'cursor-pointer py-3 flex flex-col items-center gap-1 transition ' +
                (active ? m.bg + ' ' + m.color : 'text-zinc-400')
              }
            >
              <input
                type="radio"
                name="type"
                value={t}
                checked={active}
                onChange={() => setType(t)}
                className="sr-only"
              />
              <m.Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
              <span className="text-xs font-semibold">{m.label}</span>
            </label>
          );
        })}
      </div>

      {/* Main fields */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-5 space-y-4">
        <Field label="Name">
          <input
            type="text"
            name="name"
            defaultValue={initial.name}
            required
            placeholder="e.g. Phone bill / Netflix / Salary / CC payment"
            className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2 text-base"
          />
        </Field>

        <Field label="Amount">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 text-sm">{BASE_SYMBOL}</span>
            <input
              type="number"
              name="amount"
              step="0.01"
              min="0.01"
              defaultValue={initial.amount ?? ''}
              required
              placeholder="0.00"
              className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2 text-2xl font-semibold tabular-nums"
            />
          </div>
        </Field>

        <Field label={type === 'transfer' ? 'From account' : 'Account'}>
          <select
            name="accountId"
            defaultValue={initial.accountId ?? ''}
            required
            className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2 text-base"
          >
            <option value="">— Select —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </select>
        </Field>

        {type === 'transfer' && (
          <Field label="To account">
            <select
              name="toAccountId"
              defaultValue={initial.toAccountId ?? ''}
              required
              className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2 text-base"
            >
              <option value="">— Select —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.currency})
                </option>
              ))}
            </select>
          </Field>
        )}

        {type !== 'transfer' && (
          <Field label="Category (optional)">
            <select
              name="categoryId"
              defaultValue={initial.categoryId ?? ''}
              className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2 text-base"
            >
              <option value="">— None —</option>
              {filteredCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        <Field label="Description (optional)">
          <input
            type="text"
            name="description"
            defaultValue={initial.description}
            placeholder="Defaults to rule name"
            className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2 text-base"
          />
        </Field>

        {type === 'expense' && (
          <Field label="Paid by">
            <select
              name="paidBy"
              defaultValue={initial.paidBy}
              className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2 text-base"
            >
              <option value="me">Me</option>
              <option value="mom">Mom</option>
              <option value="dad">Dad</option>
            </select>
          </Field>
        )}
      </div>

      {/* Schedule */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-5 space-y-4">
        <h2 className="text-sm font-semibold">Schedule</h2>

        <Field label="Day of month (1-31)">
          <input
            type="number"
            name="dayOfMonth"
            min="1"
            max="31"
            defaultValue={initial.dayOfMonth}
            required
            className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2 text-base tabular-nums"
          />
          <p className="text-xs text-zinc-500 mt-1">
            If month has fewer days (e.g. Feb 30 → Feb 28), it caps to last
            day.
          </p>
        </Field>

        <Field label="Starts on">
          <input
            type="date"
            name="startDate"
            defaultValue={initial.startDate}
            required
            className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2 text-base tabular-nums"
          />
        </Field>

        <Field label="Ends">
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={endless}
                onChange={(e) => setEndless(e.target.checked)}
                className="w-4 h-4 accent-emerald-500"
              />
              <span className="text-sm">Forever (no end date)</span>
            </label>
            {!endless && (
              <input
                type="date"
                name="endDate"
                defaultValue={initial.endDate}
                className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2 text-base tabular-nums"
              />
            )}
          </div>
        </Field>

        <label className="flex items-center gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
          <input
            type="checkbox"
            name="active"
            defaultChecked={initial.active}
            className="w-4 h-4 accent-emerald-500"
          />
          <span className="text-sm font-medium">Active</span>
        </label>
      </div>

      <div
        className="flex gap-3 sticky z-30 pt-2"
        style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      >
        <Link
          href="/more/scheduled"
          className="flex-1 flex items-center justify-center gap-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl py-3 text-sm font-medium active:opacity-70"
        >
          <X className="w-4 h-4" /> Cancel
        </Link>
        <button
          type="submit"
          className="flex-[2] flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-xl py-3 shadow-lg shadow-emerald-600/30 transition"
        >
          <Save className="w-4 h-4" />
          {isEdit ? 'Save changes' : 'Create rule'}
        </button>
      </div>

      {isEdit && (
        <DeleteForm id={initial.id!} />
      )}
    </form>
  );
}

function DeleteForm({ id }: { id: number }) {
  return (
    <form
      action={(fd) => {
        if (!confirm('Delete this scheduled rule?')) return;
        return deleteScheduledRule(fd);
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        className="w-full flex items-center justify-center gap-1.5 text-rose-600 dark:text-rose-400 text-sm font-medium py-3 active:opacity-70"
      >
        <Trash2 className="w-4 h-4" /> Delete rule
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}
