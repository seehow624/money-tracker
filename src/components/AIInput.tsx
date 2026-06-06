'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, Loader2, Undo2, X } from 'lucide-react';

type Recorded = { id: number; summary: string };
type Response = { message: string; recorded: Recorded[] };

export function AIInput() {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [response, setResponse] = useState<Response | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  async function submit() {
    const t = text.trim();
    if (!t || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: t }),
      });
      const json = (await res.json()) as
        | { ok: true; message: string; recorded: Recorded[] }
        | { ok: false; error: string };
      if (!json.ok) throw new Error(json.error);
      setResponse({ message: json.message, recorded: json.recorded });
      setText('');
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'AI request failed');
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  }

  async function undo(id: number) {
    try {
      const res = await fetch('/api/ai/undo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) return;
      setResponse((r) => (r ? { ...r, recorded: r.recorded.filter((x) => x.id !== id) } : r));
      startTransition(() => router.refresh());
    } catch {
      /* swallow — UI remains in place, user can retry */
    }
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Sparkles
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-tangerine pointer-events-none"
          strokeWidth={2.2}
        />
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="AI 記帳：ramen 12, top up 300 to ewallet, 餘額…"
          disabled={busy}
          enterKeyHint="send"
          className="w-full h-11 pl-9 pr-10 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 text-sm focus:outline-none focus:border-tangerine/50 focus:ring-2 focus:ring-tangerine/15 disabled:opacity-60 transition"
        />
        {busy && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 animate-spin" />
        )}
      </div>

      {error && (
        <div className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200/60 dark:border-rose-900/40 text-xs text-rose-700 dark:text-rose-300">
          {error}
        </div>
      )}

      {response && (
        <div className="rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 px-3.5 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm text-zinc-700 dark:text-zinc-200 whitespace-pre-wrap leading-relaxed flex-1">
              {response.message}
            </div>
            <button
              onClick={() => setResponse(null)}
              className="shrink-0 p-1 -mr-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
              aria-label="dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {response.recorded.length > 0 && (
            <div className="mt-2 pt-2 border-t border-zinc-200/50 dark:border-zinc-800/50 space-y-1.5">
              {response.recorded.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between gap-2 text-xs"
                >
                  <span className="truncate text-zinc-600 dark:text-zinc-300 tabular-nums">
                    ✓ {r.summary}
                  </span>
                  <button
                    onClick={() => undo(r.id)}
                    className="shrink-0 flex items-center gap-1 px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-300 active:scale-95 transition"
                  >
                    <Undo2 className="w-3 h-3" strokeWidth={2.2} />
                    Undo
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
