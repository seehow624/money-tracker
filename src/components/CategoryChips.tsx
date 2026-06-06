'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useTransition } from 'react';
import { colorFor } from '@/lib/colors';

type Cat = {
  id: number;
  name: string;
  color: string | null;
};

export function CategoryChips({
  all,
  selectedIds,
}: {
  all: Cat[];
  selectedIds: number[];
}) {
  const router = useRouter();
  const pathname = usePathname() ?? '/stats';
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();

  const selected = new Set(selectedIds);
  const isAuto = selectedIds.length === 0;

  const setCats = (next: number[] | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (next === null || next.length === 0) {
      params.delete('cats');
    } else {
      params.set('cats', next.join(','));
    }
    start(() => router.push(`${pathname}?${params.toString()}`, { scroll: false }));
  };

  const toggle = (id: number) => {
    if (isAuto) {
      // Auto mode (top 5): clicking starts custom mode with just this id
      setCats([id]);
      return;
    }
    const next = selected.has(id)
      ? selectedIds.filter((x) => x !== id)
      : [...selectedIds, id];
    setCats(next);
  };

  return (
    <div className={'space-y-2 ' + (pending ? 'opacity-60' : '')}>
      <div className="flex items-center justify-between text-xs">
        <span className="text-zinc-500">
          {isAuto
            ? 'Showing top 5 by spending'
            : `${selectedIds.length} selected`}
        </span>
        {!isAuto && (
          <button
            type="button"
            onClick={() => setCats(null)}
            className="text-emerald-600 dark:text-emerald-400 font-medium"
          >
            Reset to top 5
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {all.map((c) => {
          const active = selected.has(c.id);
          const { bg } = colorFor(c.color);
          return (
            <button
              key={c.id}
              type="button"
              onClick={() => toggle(c.id)}
              className={
                'px-2.5 py-1 rounded-full text-xs font-medium border transition active:opacity-70 ' +
                (active
                  ? 'border-transparent text-white'
                  : 'border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 bg-transparent')
              }
              style={active ? { backgroundColor: bg } : undefined}
            >
              {c.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}
