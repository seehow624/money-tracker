'use client';

import { ChevronLeft } from 'lucide-react';
import Link from 'next/link';
import React, { useEffect, useState } from 'react';

export function AppBar({
  title,
  back,
  trailing,
  compact,
}: {
  title: React.ReactNode;
  back?: { href: string; label?: string };
  trailing?: React.ReactNode;
  compact?: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div
      className={
        'sticky top-0 z-30 safe-top transition-all duration-300' +
        (scrolled
          ? ' bg-white/85 dark:bg-zinc-950/85 backdrop-blur-xl border-b border-zinc-200/60 dark:border-zinc-800/60'
          : ' bg-transparent border-b border-transparent')
      }
    >
      <div className="flex items-center gap-3 px-4 h-14">
        {back ? (
          <Link
            href={back.href}
            className="flex items-center justify-center w-9 h-9 -ml-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 active:scale-95 transition-transform"
            aria-label={back.label ?? 'Back'}
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={2} />
          </Link>
        ) : (
          <div className="w-0" />
        )}
        <div className="flex-1 min-w-0 text-[17px] font-bold tracking-tight">
          {title}
        </div>
        {trailing && (
          <div className="shrink-0">{trailing}</div>
        )}
      </div>
    </div>
  );
}
