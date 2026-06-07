'use client';

import { useState, useTransition } from 'react';
import { currencySymbol } from '@/lib/format';
import {
  saveTransaction,
  deleteTransaction,
  suggestCategory,
  type CategorySuggestion,
} from '@/app/transactions/actions';
import {
  ArrowDownCircle,
  ArrowUpCircle,
  ArrowLeftRight,
  Trash2,
  Save,
  X,
  type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';

type Account = { id: number; name: string; type: string; currency: string };
type Category = {
  id: number;
  name: string;
  isIncome: boolean;
  icon: string | null;
  color: string | null;
};

export type TransactionInitial = {
  id?: number;
  type: 'expense' | 'income' | 'transfer';
  date: string;
  amount: number | null;
  accountId: number | null;
  toAccountId: number | null;
  categoryId: number | null;
  description: string;
  paidBy: string;
  notes: string;
};

const PAID_BY_OPTIONS = ['me', 'mom', 'dad'];

const TYPE_META: Record<
  TransactionInitial['type'],
  { label: string; Icon: LucideIcon; color: string; bg: string }
> = {
  expense: {
    label: 'Expense',
    Icon: ArrowUpCircle,
    color: 'text-rose-700 dark:text-rose-400',
    bg: 'bg-rose-50 dark:bg-rose-950/30',
  },
  income: {
    label: 'Income',
    Icon: ArrowDownCircle,
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
  },
  transfer: {
    label: 'Transfer',
    Icon: ArrowLeftRight,
    color: 'text-zinc-700 dark:text-zinc-300',
    bg: 'bg-zinc-100 dark:bg-zinc-800/50',
  },
};

export function TransactionForm({
  initial,
  accounts,
  categories,
  customPaidByOptions = [],
  returnTo,
  baseCurrency,
}: {
  initial: TransactionInitial;
  accounts: Account[];
  categories: Category[];
  customPaidByOptions?: string[];
  returnTo?: string;
  baseCurrency: string;
}) {
  const [type, setType] = useState(initial.type);
  const [paidBy, setPaidBy] = useState(initial.paidBy);
  const [categoryId, setCategoryId] = useState<number | null>(initial.categoryId);
  const [suggestion, setSuggestion] = useState<CategorySuggestion | null>(null);
  const [pending, start] = useTransition();
  const [deleting, setDeleting] = useState(false);
  const [accountId, setAccountId] = useState<number | null>(initial.accountId);
  const [toAccountId, setToAccountId] = useState<number | null>(initial.toAccountId);

  const swapAccounts = () => {
    setAccountId(toAccountId);
    setToAccountId(accountId);
  };

  async function onDescriptionBlur(e: React.FocusEvent<HTMLInputElement>) {
    if (initial.id != null) return; // skip on edit
    if (categoryId != null) return; // user already chose
    if (type === 'transfer') return;
    const desc = e.target.value.trim();
    if (desc.length < 2) {
      setSuggestion(null);
      return;
    }
    const s = await suggestCategory(desc, type);
    setSuggestion(s);
  }

  const paidByOpts = Array.from(
    new Set([...PAID_BY_OPTIONS, ...customPaidByOptions, paidBy].filter(Boolean)),
  );

  const filteredCats = categories
    .filter((c) => c.isIncome === (type === 'income'))
    .sort((a, b) => a.name.localeCompare(b.name));

  const isEdit = initial.id != null;

  return (
    <>
    <form
      action={(fd) => start(() => saveTransaction(fd))}
      className="space-y-4"
    >
      {initial.id != null && (
        <input type="hidden" name="id" value={initial.id} />
      )}
      {returnTo && (
        <input type="hidden" name="returnTo" value={returnTo} />
      )}

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden">
        <div className="grid grid-cols-3 divide-x divide-zinc-100 dark:divide-zinc-800">
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
      </div>

      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-5 space-y-4">
        <Field label="Date">
          <input
            type="date"
            name="date"
            defaultValue={initial.date}
            required
            className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2 text-base tabular-nums"
          />
        </Field>

        <Field label="Amount">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 text-sm">{currencySymbol(baseCurrency)}</span>
            <input
              type="number"
              name="amount"
              step="0.01"
              min="0.01"
              defaultValue={initial.amount ?? ''}
              required
              autoFocus={!isEdit}
              placeholder="0.00"
              className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2 text-2xl font-semibold tabular-nums"
            />
          </div>
        </Field>

        <Field label={type === 'transfer' ? 'From' : 'Account'}>
          <select
            name="accountId"
            value={accountId ?? ''}
            onChange={(e) => setAccountId(e.target.value ? parseInt(e.target.value, 10) : null)}
            required
            className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2 text-base"
          >
            <option value="">— Select account —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.currency})
              </option>
            ))}
          </select>
        </Field>

        {type === 'transfer' && (
          <>
            <div className="flex justify-center -my-2">
              <button
                type="button"
                onClick={swapAccounts}
                aria-label="Swap From and To"
                className="w-9 h-9 rounded-full bg-zinc-100 dark:bg-zinc-800 active:bg-zinc-200 dark:active:bg-zinc-700 text-zinc-600 dark:text-zinc-300 flex items-center justify-center"
              >
                <ArrowLeftRight className="w-4 h-4 rotate-90" strokeWidth={2.25} />
              </button>
            </div>
            <Field label="To">
              <select
                name="toAccountId"
                value={toAccountId ?? ''}
                onChange={(e) => setToAccountId(e.target.value ? parseInt(e.target.value, 10) : null)}
                required
                className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2 text-base"
              >
                <option value="">— Select account —</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.currency})
                  </option>
                ))}
              </select>
            </Field>
          </>
        )}

        <Field label="Description">
          <input
            type="text"
            name="description"
            defaultValue={initial.description}
            onBlur={onDescriptionBlur}
            placeholder="e.g. Eating out, Petrol, Phone bill"
            className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2 text-base"
          />
        </Field>

        {type !== 'transfer' && (
          <Field label="Category">
            <select
              name="categoryId"
              value={categoryId ?? ''}
              onChange={(e) =>
                setCategoryId(e.target.value ? parseInt(e.target.value, 10) : null)
              }
              required
              className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2 text-base"
            >
              <option value="" disabled>— Select category —</option>
              {filteredCats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {suggestion && categoryId == null && (
              <button
                type="button"
                onClick={() => {
                  setCategoryId(suggestion.id);
                  setSuggestion(null);
                }}
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400 active:opacity-60"
              >
                ✨ Suggest:{' '}
                <span className="font-semibold">{suggestion.name}</span>
                <span className="text-zinc-400">
                  · {(suggestion.confidence * 100).toFixed(0)}%
                </span>
              </button>
            )}
          </Field>
        )}

        {type === 'expense' && (
          <Field label="Paid by">
            <div className="flex flex-wrap gap-2">
              {paidByOpts.map((p) => {
                const checked = paidBy === p;
                return (
                  <label
                    key={p}
                    className={
                      'cursor-pointer px-3 py-1.5 rounded-full text-sm font-medium border transition ' +
                      (checked
                        ? 'bg-pink-100 dark:bg-pink-900/40 border-pink-400 text-pink-700 dark:text-pink-300'
                        : 'bg-zinc-100 dark:bg-zinc-800 border-transparent text-zinc-600')
                    }
                  >
                    <input
                      type="radio"
                      name="paidBy"
                      value={p}
                      checked={checked}
                      onChange={() => setPaidBy(p)}
                      className="sr-only"
                    />
                    {p === 'me' ? 'Me' : p}
                  </label>
                );
              })}
            </div>
          </Field>
        )}

        <Field label="Notes (optional)">
          <textarea
            name="notes"
            defaultValue={initial.notes}
            rows={2}
            placeholder="Any extra context"
            className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-2 text-sm resize-none"
          />
        </Field>
      </div>

      <div
        className="flex gap-3 sticky z-30 pt-2"
        style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
      >
        <Link
          href={returnTo || '/'}
          className="flex-1 flex items-center justify-center gap-1.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl py-3 text-sm font-medium active:opacity-70"
        >
          <X className="w-4 h-4" /> Cancel
        </Link>
        <button
          type="submit"
          disabled={pending || deleting}
          className="flex-[2] flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-xl py-3 shadow-lg shadow-emerald-600/30 disabled:opacity-60 transition"
        >
          <Save className="w-4 h-4" />
          {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Add transaction'}
        </button>
      </div>

    </form>
    {isEdit && (
      <DeleteButton
        id={initial.id!}
        returnTo={returnTo}
        onSubmitting={() => setDeleting(true)}
        disabled={pending}
      />
    )}
    </>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wide">
        {label}
      </label>
      {children}
    </div>
  );
}

function DeleteButton({
  id,
  returnTo,
  onSubmitting,
  disabled,
}: {
  id: number;
  returnTo?: string;
  onSubmitting: () => void;
  disabled: boolean;
}) {
  return (
    <form
      action={(fd) => {
        if (!confirm('Delete this transaction?')) return;
        onSubmitting();
        return deleteTransaction(fd);
      }}
    >
      <input type="hidden" name="id" value={id} />
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
      <button
        type="submit"
        disabled={disabled}
        className="w-full flex items-center justify-center gap-1.5 text-rose-600 dark:text-rose-400 text-sm font-medium py-3 active:opacity-70 disabled:opacity-40"
      >
        <Trash2 className="w-4 h-4" /> Delete transaction
      </button>
    </form>
  );
}
