'use client';

import { useState, useTransition } from 'react';
import { DollarSign } from 'lucide-react';
import { changeBaseCurrency } from '@/app/more/currency/actions';

export function BaseCurrencySelect({
  current,
  options,
  hasData,
}: {
  current: string;
  options: { code: string; symbol: string }[];
  hasData: boolean;
}) {
  const [pending, start] = useTransition();
  const [value, setValue] = useState(current);

  function onChange(next: string) {
    if (next === current) return;
    if (
      hasData &&
      !confirm(
        `Switch base currency to ${next}?\n\nAll balances and totals will be ` +
          `re-converted using the latest FX rates. This recomputes every ` +
          `transaction's stored value.`,
      )
    ) {
      return;
    }
    setValue(next);
    const fd = new FormData();
    fd.append('currency', next);
    start(() => {
      changeBaseCurrency(fd);
    });
  }

  return (
    <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-800 flex items-center gap-3">
      <DollarSign className="w-5 h-5 text-zinc-400 shrink-0" strokeWidth={2} />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium">Main Currency</div>
        <div className="text-xs text-zinc-500">
          {pending ? 'Converting…' : 'Everything is shown in this currency'}
        </div>
      </div>
      <select
        value={value}
        disabled={pending}
        onChange={(e) => onChange(e.target.value)}
        className="bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-1.5 text-sm font-medium tabular-nums disabled:opacity-50"
      >
        {options.map((o) => (
          <option key={o.code} value={o.code}>
            {o.code} ({o.symbol})
          </option>
        ))}
      </select>
    </div>
  );
}
