'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * Auto-refreshes the current route when the window/tab regains focus.
 * Useful for catching new transactions logged from elsewhere (Telegram via Luna,
 * another device, etc.) without a manual reload.
 */
export function AutoRefresh() {
  const router = useRouter();

  useEffect(() => {
    let lastRefresh = Date.now();
    const COOLDOWN_MS = 2000;

    const onFocus = () => {
      const now = Date.now();
      if (now - lastRefresh < COOLDOWN_MS) return;
      lastRefresh = now;
      router.refresh();
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') onFocus();
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [router]);

  return null;
}
