'use client';

import { useRouter } from 'next/navigation';
import { useRef, useTransition } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useArrowKeyNav } from '@/lib/use-arrow-key-nav';

function formatMonthLabel(value: string): string {
  const [y, m] = value.split('-').map(Number);
  if (!y || !m) return value;
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function MonthPicker({
  value,
  routeBase = '/',
  extraParams,
  compact = false,
}: {
  value: string;
  routeBase?: string;
  extraParams?: Record<string, string>;
  compact?: boolean;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();

  const go = (m: string) => {
    const params = new URLSearchParams({ month: m, ...(extraParams ?? {}) });
    start(() => {
      router.push(`${routeBase}?${params.toString()}`, { scroll: false });
    });
  };

  const shift = (delta: number) => {
    const [y, mo] = value.split('-').map(Number);
    const d = new Date(Date.UTC(y, mo - 1 + delta, 1));
    go(d.toISOString().slice(0, 7));
  };

  useArrowKeyNav(() => shift(-1), () => shift(1));

  const todayMonth = new Date().toISOString().slice(0, 7);
  const isCurrent = value === todayMonth;

  const hiddenInputRef = useRef<HTMLInputElement>(null);

  if (compact) {
    return (
      <div
        className={
          'inline-flex items-center gap-0.5 ' + (pending ? 'opacity-60' : '')
        }
      >
        <button
          type="button"
          onClick={() => shift(-1)}
          className="w-8 h-8 rounded-full active:bg-zinc-100 dark:active:bg-zinc-800 text-zinc-500 flex items-center justify-center"
          aria-label="Previous month"
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={() => {
              const el = hiddenInputRef.current;
              try {
                el?.showPicker?.();
              } catch {
                el?.focus();
              }
            }}
            className="px-3 py-1 text-sm font-medium tabular-nums rounded-md active:bg-zinc-100 dark:active:bg-zinc-800 min-w-[8.5rem] text-center"
          >
            {formatMonthLabel(value)}
          </button>
          <input
            ref={hiddenInputRef}
            type="month"
            value={value}
            onChange={(e) => go(e.target.value)}
            className="absolute inset-0 opacity-0 pointer-events-none"
            tabIndex={-1}
            aria-hidden
          />
        </div>
        <button
          type="button"
          onClick={() => shift(1)}
          className="w-8 h-8 rounded-full active:bg-zinc-100 dark:active:bg-zinc-800 text-zinc-500 flex items-center justify-center"
          aria-label="Next month"
        >
          <ChevronRight className="w-5 h-5" strokeWidth={2.5} />
        </button>
        <button
          type="button"
          onClick={() => go(todayMonth)}
          className={
            'ml-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-all duration-300 ' +
            (isCurrent
              ? 'text-zinc-400 dark:text-zinc-500'
              : 'bg-tangerine-100 dark:bg-tangerine-900/40 text-tangerine-700 dark:text-tangerine-400 shadow-sm shadow-tangerine-500/20')
          }
        >
          Today
        </button>
      </div>
    );
  }

  return (
    <div
      className={
        'flex items-center gap-1 ' + (pending ? 'opacity-60' : '')
      }
    >
      <button
        type="button"
        onClick={() => shift(-1)}
        className="w-9 h-9 rounded-full active:bg-zinc-100 dark:active:bg-zinc-800 text-zinc-500 flex items-center justify-center"
        aria-label="Previous month"
      >
        <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
      </button>
      <input
        type="month"
        value={value}
        onChange={(e) => go(e.target.value)}
        className="bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-1.5 text-sm tabular-nums"
      />
      <button
        type="button"
        onClick={() => shift(1)}
        className="w-9 h-9 rounded-full active:bg-zinc-100 dark:active:bg-zinc-800 text-zinc-500 flex items-center justify-center"
        aria-label="Next month"
      >
        <ChevronRight className="w-5 h-5" strokeWidth={2.5} />
      </button>
      {!isCurrent && (
        <button
          type="button"
          onClick={() => go(todayMonth)}
          className="ml-1 text-xs font-medium text-emerald-600 dark:text-emerald-400 active:opacity-60 px-2"
        >
          Today
        </button>
      )}
    </div>
  );
}

export function MonthTodayButton({
  value,
  routeBase = '/',
  extraParams,
}: {
  value: string;
  routeBase?: string;
  extraParams?: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const todayMonth = new Date().toISOString().slice(0, 7);
  if (value === todayMonth) return null;

  const go = () => {
    const params = new URLSearchParams({
      month: todayMonth,
      ...(extraParams ?? {}),
    });
    start(() => {
      router.push(`${routeBase}?${params.toString()}`, { scroll: false });
    });
  };

  return (
    <button
      type="button"
      onClick={go}
      disabled={pending}
      className="px-2.5 py-1 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-xs font-semibold active:opacity-70 disabled:opacity-60"
    >
      Today
    </button>
  );
}
