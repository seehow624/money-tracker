'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { fmtNum } from '@/lib/format';
import { colorFor } from '@/lib/colors';
import { CategoryIcon, TransferIcon } from '@/lib/icons';
import { CheckSquare, Square, Trash2, Heart, Tag, X } from 'lucide-react';
import { bulkUpdate } from '@/app/transactions/actions';
import type { RecentTxn } from '@/lib/queries';

type Cat = { id: number; name: string; isIncome: boolean };

export function SearchResults({
  results,
  expenseCats,
  incomeCats,
}: {
  results: RecentTxn[];
  expenseCats: Cat[];
  incomeCats: Cat[];
}) {
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, start] = useTransition();
  const [showCatPicker, setShowCatPicker] = useState(false);
  const [showPaidByPicker, setShowPaidByPicker] = useState(false);

  const toggle = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const exitMode = () => {
    setSelectMode(false);
    setSelected(new Set());
    setShowCatPicker(false);
    setShowPaidByPicker(false);
  };

  const submit = (action: string, value: string) => {
    if (selected.size === 0) return;
    const fd = new FormData();
    fd.append('action', action);
    fd.append('value', value);
    selected.forEach((id) => fd.append('ids', String(id)));
    start(() => {
      bulkUpdate(fd).then(() => exitMode());
    });
  };

  const onDelete = () => {
    if (selected.size === 0) return;
    if (!confirm(`Delete ${selected.size} transaction${selected.size === 1 ? '' : 's'}?`))
      return;
    const fd = new FormData();
    fd.append('action', 'delete');
    fd.append('value', '');
    selected.forEach((id) => fd.append('ids', String(id)));
    start(() => {
      bulkUpdate(fd).then(() => exitMode());
    });
  };

  return (
    <>
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>{results.length} hits</span>
        {!selectMode ? (
          <button
            type="button"
            onClick={() => setSelectMode(true)}
            className="text-emerald-600 dark:text-emerald-400 font-semibold"
          >
            Select multiple
          </button>
        ) : (
          <button
            type="button"
            onClick={exitMode}
            className="text-zinc-500 font-medium"
          >
            Cancel
          </button>
        )}
      </div>

      <ul className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden divide-y divide-zinc-100 dark:divide-zinc-800">
        {results.map((t) => {
          const isTransfer = t.type === 'transfer';
          const { tint, bg } = colorFor(t.color);
          const isSelected = selected.has(t.id);

          const Inner = (
            <div className="px-4 py-3 flex items-center gap-3">
              {selectMode && (
                <span
                  className={
                    'w-5 h-5 rounded shrink-0 flex items-center justify-center ' +
                    (isSelected
                      ? 'bg-emerald-500 text-white'
                      : 'border-2 border-zinc-300 dark:border-zinc-600')
                  }
                >
                  {isSelected ? (
                    <CheckSquare className="w-3 h-3" />
                  ) : null}
                </span>
              )}
              <span
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: isTransfer ? '#e4e4e7' : tint,
                  color: isTransfer ? '#52525b' : bg,
                }}
              >
                {isTransfer ? (
                  <TransferIcon
                    className="w-[18px] h-[18px]"
                    strokeWidth={2.25}
                  />
                ) : (
                  <CategoryIcon
                    name={t.category}
                    className="w-[18px] h-[18px]"
                    strokeWidth={2.25}
                  />
                )}
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate flex items-center gap-1.5">
                  {isTransfer
                    ? 'Transfer'
                    : t.description ?? '(no description)'}
                  {t.paidBy && t.paidBy !== 'me' && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-pink-100 dark:bg-pink-900/40 text-pink-700 dark:text-pink-300 text-[10px] font-semibold uppercase tracking-wide shrink-0">
                      <Heart
                        className="w-2.5 h-2.5"
                        strokeWidth={2.5}
                        fill="currentColor"
                      />
                      {t.paidBy}
                    </span>
                  )}
                </div>
                <div className="text-xs text-zinc-500 truncate">
                  {t.date} ·{' '}
                  {isTransfer ? (
                    <>
                      {t.account} → {t.toAccount ?? '?'}
                    </>
                  ) : (
                    <>
                      {t.account}
                      {t.category ? ` · ${t.category}` : ''}
                    </>
                  )}
                </div>
              </div>
              <span
                className={
                  'tabular-nums text-sm font-medium shrink-0 ' +
                  (t.type === 'income'
                    ? 'text-sky-500'
                    : isTransfer
                      ? 'text-zinc-500'
                      : 'text-rose-500')
                }
              >
                {t.type === 'income' ? '+' : t.type === 'expense' ? '−' : ''}
                RM {fmtNum(t.amountMyr)}
              </span>
            </div>
          );

          return (
            <li key={t.id}>
              {selectMode ? (
                <button
                  type="button"
                  onClick={() => toggle(t.id)}
                  className="w-full text-left active:bg-zinc-50 dark:active:bg-zinc-800/50"
                >
                  {Inner}
                </button>
              ) : (
                <Link
                  href={`/transactions/edit/${t.id}`}
                  className="block active:bg-zinc-50 dark:active:bg-zinc-800/50 transition"
                >
                  {Inner}
                </Link>
              )}
            </li>
          );
        })}
      </ul>

      {/* Bulk action bar */}
      {selectMode && selected.size > 0 && (
        <div
          className="fixed left-3 right-3 z-40 bg-zinc-900 dark:bg-zinc-800 text-white rounded-2xl shadow-xl shadow-zinc-900/30 p-3 max-w-md mx-auto"
          style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-sm font-semibold">
              {selected.size} selected
            </span>
            <button
              type="button"
              onClick={exitMode}
              className="ml-auto text-zinc-400 p-1"
              aria-label="Cancel"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setShowPaidByPicker(true);
                setShowCatPicker(false);
              }}
              disabled={pending}
              className="flex items-center gap-1 bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-500 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60"
            >
              <Heart className="w-3.5 h-3.5" fill="currentColor" />
              Paid by…
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCatPicker(true);
                setShowPaidByPicker(false);
              }}
              disabled={pending}
              className="flex items-center gap-1 bg-zinc-700 hover:bg-zinc-600 active:bg-zinc-500 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60"
            >
              <Tag className="w-3.5 h-3.5" />
              Category…
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={pending}
              className="flex items-center gap-1 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Delete
            </button>
          </div>

          {showPaidByPicker && (
            <div className="mt-3 pt-3 border-t border-zinc-700 flex flex-wrap gap-1.5">
              {['me', 'mom', 'dad'].map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => submit('paid_by', p)}
                  disabled={pending}
                  className="px-2.5 py-1 rounded-full bg-pink-500 hover:bg-pink-600 text-white text-xs font-semibold capitalize disabled:opacity-60"
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {showCatPicker && (
            <div className="mt-3 pt-3 border-t border-zinc-700 max-h-56 overflow-y-auto">
              <div className="text-[10px] uppercase tracking-wide text-zinc-400 mb-1">
                Expense
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {expenseCats.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => submit('category', String(c.id))}
                    disabled={pending}
                    className="px-2.5 py-1 rounded-full bg-zinc-700 hover:bg-zinc-600 text-white text-xs disabled:opacity-60"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-zinc-400 mb-1">
                Income
              </div>
              <div className="flex flex-wrap gap-1.5">
                {incomeCats.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => submit('category', String(c.id))}
                    disabled={pending}
                    className="px-2.5 py-1 rounded-full bg-emerald-700 hover:bg-emerald-600 text-white text-xs disabled:opacity-60"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

// Filler — to satisfy the unused Square import
export const _Square = Square;
