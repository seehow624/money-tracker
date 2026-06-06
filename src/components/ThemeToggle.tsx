'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon, Monitor, type LucideIcon } from 'lucide-react';

type Theme = 'system' | 'light' | 'dark';

const OPTIONS: { value: Theme; Icon: LucideIcon; label: string }[] = [
  { value: 'system', Icon: Monitor, label: 'System' },
  { value: 'light', Icon: Sun, label: 'Light' },
  { value: 'dark', Icon: Moon, label: 'Dark' },
];

function applyTheme(t: Theme) {
  const isDark =
    t === 'dark' ||
    (t === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.classList.remove('light', 'dark');
  document.documentElement.classList.add(isDark ? 'dark' : 'light');
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system');

  useEffect(() => {
    const stored = (localStorage.getItem('mt-theme') as Theme | null) ?? 'system';
    setTheme(stored);
    applyTheme(stored);

    if (stored === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      const onChange = () => applyTheme('system');
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
  }, []);

  const choose = (t: Theme) => {
    setTheme(t);
    localStorage.setItem('mt-theme', t);
    applyTheme(t);
  };

  return (
    <div className="grid grid-cols-3 bg-zinc-100 dark:bg-zinc-800/60 rounded-full p-1 gap-0.5 border border-zinc-200/60 dark:border-zinc-700/40">
      {OPTIONS.map(({ value, Icon, label }) => {
        const active = theme === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => choose(value)}
            className={
              'flex items-center justify-center gap-1.5 py-2 rounded-full text-xs font-semibold transition-all duration-200 ' +
              (active
                ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 shadow-sm'
                : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300')
            }
          >
            <Icon className="w-3.5 h-3.5" strokeWidth={2.25} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
