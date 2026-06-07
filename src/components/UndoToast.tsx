'use client';

import {
  useEffect,
  useState,
  useTransition,
} from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { restoreTransaction } from '@/app/transactions/actions';
import { fmtCurrency } from '@/lib/format';
import { Undo2, X } from 'lucide-react';

const AUTO_DISMISS_MS = 6000;

export function UndoToast({ baseCurrency }: { baseCurrency: string }) {
  const router = useRouter();
  const pathname = usePathname() ?? '/';
  const searchParams = useSearchParams();
  const [pending, start] = useTransition();
  const [hidden, setHidden] = useState(false);

  const undoData = searchParams.get('undo');

  useEffect(() => {
    if (!undoData) {
      setHidden(false);
      return;
    }
    const timer = setTimeout(() => {
      dismiss();
    }, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [undoData]);

  if (!undoData || hidden) return null;

  let snap: { description?: string | null; amount?: number; type?: string } = {};
  try {
    snap = JSON.parse(decodeURIComponent(undoData));
  } catch {
    // ignore
  }

  const dismiss = () => {
    setHidden(true);
    const params = new URLSearchParams(searchParams.toString());
    params.delete('undo');
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const handleUndo = () => {
    const fd = new FormData();
    fd.append('data', decodeURIComponent(undoData));
    start(() => restoreTransaction(fd));
  };

  const desc = snap.description ?? '(no description)';
  const sign =
    snap.type === 'income' ? '+' : snap.type === 'transfer' ? '↔' : '−';
  const amount = typeof snap.amount === 'number' ? snap.amount : 0;

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4"
      style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom))' }}
    >
      <form
        action={handleUndo}
        className="flex items-center gap-2.5 bg-zinc-900/95 dark:bg-zinc-800/95 backdrop-blur-md text-white rounded-2xl px-3.5 py-2.5 shadow-2xl shadow-black/40 border border-white/[0.06] animate-in fade-in slide-in-from-bottom-2"
      >
        <div className="flex-1 min-w-0">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400 leading-none mb-1">
            Deleted
          </div>
          <div className="flex items-baseline gap-2 min-w-0">
            <span className="text-[15px] font-semibold tabular-nums leading-none shrink-0">
              {sign}{fmtCurrency(amount, baseCurrency)}
            </span>
            <span className="text-xs text-zinc-400 truncate min-w-0">
              {desc}
            </span>
          </div>
        </div>
        <button
          type="submit"
          disabled={pending}
          className="shrink-0 flex items-center gap-1.5 h-8 px-3 rounded-lg bg-white/[0.08] hover:bg-white/[0.14] active:bg-white/[0.20] text-white text-xs font-semibold disabled:opacity-50 transition"
        >
          <Undo2 className="w-3.5 h-3.5" strokeWidth={2.5} />
          Undo
        </button>
        <button
          type="button"
          onClick={dismiss}
          className="shrink-0 p-1.5 -mr-1 rounded-md text-zinc-500 hover:text-zinc-200 hover:bg-white/[0.06] transition"
          aria-label="Dismiss"
        >
          <X className="w-3.5 h-3.5" strokeWidth={2.5} />
        </button>
      </form>
    </div>
  );
}
