'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  House,
  BarChart3,
  Wallet,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react';

type Tab = {
  base: string;
  label: string;
  Icon: LucideIcon;
  match: (path: string) => boolean;
  carriesMonth: boolean;
};

const TABS: Tab[] = [
  { base: '/', label: 'Home', Icon: House, match: (p) => p === '/', carriesMonth: true },
  { base: '/stats', label: 'Stats', Icon: BarChart3, match: (p) => p.startsWith('/stats'), carriesMonth: true },
  { base: '/balances', label: 'Accounts', Icon: Wallet, match: (p) => p.startsWith('/balances'), carriesMonth: false },
  { base: '/more', label: 'More', Icon: MoreHorizontal, match: (p) => p.startsWith('/more'), carriesMonth: false },
];

export function BottomNav() {
  const pathname = usePathname() ?? '/';
  const searchParams = useSearchParams();
  const month = searchParams.get('month');

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white/85 dark:bg-zinc-900/85 backdrop-blur-md border-t border-zinc-200/60 dark:border-zinc-800/60 safe-bottom">
      <div className="grid grid-cols-4 max-w-3xl mx-auto">
        {TABS.map(({ base, label, Icon, match, carriesMonth }) => {
          const active = match(pathname);
          const href =
            carriesMonth && month
              ? `${base}${base.includes('?') ? '&' : '?'}month=${month}`
              : base;
          return (
            <Link
              key={base}
              href={href}
              prefetch
              className={
                'flex flex-col items-center justify-center gap-1 py-2.5 active:scale-95 transition ' +
                (active
                  ? 'text-tangerine dark:text-tangerine-400'
                  : 'text-zinc-400 dark:text-zinc-500')
              }
            >
              <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
              <span className="text-[10px] font-semibold uppercase tracking-wide">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
