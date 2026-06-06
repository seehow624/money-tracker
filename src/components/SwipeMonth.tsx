'use client';

import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition, type ReactNode } from 'react';

const SWIPE_THRESHOLD = 60; // px — minimum horizontal travel
const HORIZONTAL_RATIO = 1.5; // |dx| must exceed |dy| * this to count

export function SwipeMonth({
  month,
  basePath = '/',
  extraParams,
  children,
}: {
  month: string;
  basePath?: string;
  extraParams?: Record<string, string>;
  children: ReactNode;
}) {
  const router = useRouter();
  const start = useRef<{ x: number; y: number; t: number } | null>(null);
  const [pending, startTransition] = useTransition();
  const [hint, setHint] = useState<'prev' | 'next' | null>(null);

  function shift(delta: number) {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    const next = d.toISOString().slice(0, 7);
    const params = new URLSearchParams({
      month: next,
      ...(extraParams ?? {}),
    });
    startTransition(() => {
      router.push(`${basePath}?${params.toString()}`, { scroll: false });
    });
  }

  function onTouchStart(e: React.TouchEvent<HTMLDivElement>) {
    if (e.touches.length !== 1) return;
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    setHint(null);
  }

  function onTouchMove(e: React.TouchEvent<HTMLDivElement>) {
    if (!start.current || e.touches.length !== 1) return;
    const t = e.touches[0];
    const dx = t.clientX - start.current.x;
    const dy = t.clientY - start.current.y;
    if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy) * HORIZONTAL_RATIO) {
      setHint(dx < 0 ? 'next' : 'prev');
    } else {
      setHint(null);
    }
  }

  function onTouchEnd(e: React.TouchEvent<HTMLDivElement>) {
    const s = start.current;
    start.current = null;
    setHint(null);
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    const dt = Date.now() - s.t;

    if (dt > 800) return; // too slow, probably not a swipe
    if (Math.abs(dx) < SWIPE_THRESHOLD) return;
    if (Math.abs(dx) < Math.abs(dy) * HORIZONTAL_RATIO) return;

    shift(dx < 0 ? 1 : -1);
  }

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="relative"
    >
      {children}

      {hint && (
        <div
          className={
            'pointer-events-none fixed top-1/2 -translate-y-1/2 z-30 px-3 py-2 rounded-full bg-zinc-900/80 text-white text-xs font-semibold shadow-xl backdrop-blur ' +
            (hint === 'prev' ? 'left-3' : 'right-3')
          }
        >
          {hint === 'prev' ? '‹ Previous month' : 'Next month ›'}
        </div>
      )}

      {pending && (
        <div className="pointer-events-none fixed top-16 left-1/2 -translate-x-1/2 z-30 px-3 py-1 rounded-full bg-emerald-600/90 text-white text-xs font-semibold shadow-lg backdrop-blur">
          Loading…
        </div>
      )}
    </div>
  );
}
