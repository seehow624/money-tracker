'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useArrowKeyNav } from '@/lib/use-arrow-key-nav';

function shiftWeek(week: string, delta: number): string {
  const m = week.match(/^(\d{4})-W(\d{2})$/);
  if (!m) return week;
  const year = parseInt(m[1], 10);
  const w = parseInt(m[2], 10);
  // Approximate: just shift by 7 days from the week's Monday and recompute
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - jan4Day + 1 + (w - 1 + delta) * 7);
  // Recompute ISO week
  const target = new Date(monday);
  target.setUTCDate(target.getUTCDate() + 3); // Thursday of that week
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil(
    ((target.getTime() - yearStart.getTime()) / 86400000 + 1) / 7,
  );
  return `${target.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

export function WeekPicker({
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

  const go = (w: string) => {
    const params = new URLSearchParams({ week: w, ...(extraParams ?? {}) });
    if (!params.has('period')) params.set('period', 'weekly');
    start(() => router.push(`${routeBase}?${params.toString()}`, { scroll: false }));
  };

  useArrowKeyNav(
    () => go(shiftWeek(value, -1)),
    () => go(shiftWeek(value, 1)),
  );

  return (
    <div
      className={
        'inline-flex items-center gap-0.5 ' + (pending ? 'opacity-60' : '')
      }
    >
      <button
        type="button"
        onClick={() => go(shiftWeek(value, -1))}
        className="w-8 h-8 rounded-full active:bg-zinc-100 dark:active:bg-zinc-800 text-zinc-500 flex items-center justify-center"
        aria-label="Previous week"
      >
        <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
      </button>
      <input
        type="week"
        value={value}
        onChange={(e) => go(e.target.value)}
        className="bg-transparent text-sm tabular-nums w-[150px] px-1 text-center"
        aria-label="Pick week"
      />
      <button
        type="button"
        onClick={() => go(shiftWeek(value, 1))}
        className="w-8 h-8 rounded-full active:bg-zinc-100 dark:active:bg-zinc-800 text-zinc-500 flex items-center justify-center"
        aria-label="Next week"
      >
        <ChevronRight className="w-5 h-5" strokeWidth={2.5} />
      </button>
    </div>
  );
}

export function YearPicker({
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

  const go = (y: string) => {
    if (!/^\d{4}$/.test(y)) return;
    const params = new URLSearchParams({ year: y, ...(extraParams ?? {}) });
    if (!params.has('period')) params.set('period', 'annually');
    start(() => router.push(`${routeBase}?${params.toString()}`, { scroll: false }));
  };

  const shift = (delta: number) => {
    const y = parseInt(value, 10) + delta;
    go(String(y));
  };

  useArrowKeyNav(() => shift(-1), () => shift(1));

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
        aria-label="Previous year"
      >
        <ChevronLeft className="w-5 h-5" strokeWidth={2.5} />
      </button>
      <input
        type="number"
        value={value}
        min={2020}
        max={2100}
        onChange={(e) => go(e.target.value)}
        className="bg-transparent text-base font-semibold tabular-nums w-[70px] px-1 text-center"
        aria-label="Pick year"
      />
      <button
        type="button"
        onClick={() => shift(1)}
        className="w-8 h-8 rounded-full active:bg-zinc-100 dark:active:bg-zinc-800 text-zinc-500 flex items-center justify-center"
        aria-label="Next year"
      >
        <ChevronRight className="w-5 h-5" strokeWidth={2.5} />
      </button>
    </div>
  );
}
