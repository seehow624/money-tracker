'use client';

import { useState, useTransition } from 'react';
import {
  RotateCcw,
  Download,
  Loader2,
  CheckCircle2,
  AlertCircle,
  HardDrive,
  Trash2,
  Share2,
} from 'lucide-react';
import { restoreBackup, deleteBackup } from '@/app/more/actions';
import type { BackupEntry } from '@/app/more/actions';

export function RestoreClient({
  initialBackups,
}: {
  initialBackups: BackupEntry[];
}) {
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [restoring, setRestoring] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [pending] = useTransition();

  const handleRestore = (name: string) => {
    if (
      !confirm(
        `Restore from "${name}"?\n\nThis will replace your current database. A backup of the current state will be saved first.\n\nRestart the dev server afterwards.`,
      )
    ) {
      return;
    }

    setRestoring(name);
    setMessage(null);
    restoreBackup(name).then((result) => {
      if (result.ok) {
        setMessage({ ok: true, text: 'Restored! Restart dev server to apply.' });
        setTimeout(() => window.location.reload(), 1000);
      } else {
        setMessage({
          ok: false,
          text: result.error ?? 'Restore failed',
        });
      }
      setRestoring(null);
    });
  };

  const handleDelete = (name: string) => {
    if (!confirm(`Delete "${name}"?\n\nThis cannot be undone.`)) return;

    setDeleting(name);
    setMessage(null);
    deleteBackup(name).then((result) => {
      if (result.ok) {
        setMessage({ ok: true, text: `Deleted: ${name}` });
        setTimeout(() => window.location.reload(), 800);
      } else {
        setMessage({
          ok: false,
          text: result.error ?? 'Delete failed',
        });
        setDeleting(null);
      }
    });
  };

  const handleShare = async (name: string) => {
    const url = `${window.location.origin}/api/backups/${name}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Backup: ${name}`, url });
      } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(url);
        setMessage({ ok: true, text: 'Link copied!' });
        setTimeout(() => setMessage(null), 2000);
      } catch {
        setMessage({ ok: false, text: 'Could not copy link' });
        setTimeout(() => setMessage(null), 3000);
      }
    }
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    const date = d.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const time = d.toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
    return `${date} ${time}`;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    const kb = bytes / 1024;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    const mb = kb / 1024;
    return `${mb.toFixed(1)} MB`;
  };

  if (initialBackups.length === 0) {
    return (
      <div className="px-5 py-8 text-center text-sm text-zinc-500">
        <HardDrive
          className="w-10 h-10 mx-auto mb-3 text-zinc-400"
          strokeWidth={1.5}
        />
        <p className="font-medium">No backups found.</p>
        <p className="text-xs mt-1">
          Go back and tap &quot;Save Backup&quot; to create one.
        </p>
      </div>
    );
  }

  return (
    <div>
      {message && (
        <div
          className={`mx-5 mt-3 p-3 rounded-lg text-sm flex items-center gap-2 ${
            message.ok
              ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'
              : 'bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300'
          }`}
        >
          {message.ok ? (
            <CheckCircle2 className="w-4 h-4 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 shrink-0" />
          )}
          {message.text}
        </div>
      )}

      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {initialBackups.map((b) => (
          <div
            key={b.name}
            className="flex items-start justify-between px-5 py-3.5 gap-2"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{b.name}</div>
              <div className="text-[11px] text-zinc-500 mt-0.5">
                {formatDate(b.created)} · {formatSize(b.size)}
              </div>

              <div className="flex items-center gap-1.5 mt-2">
                <a
                  href={`/api/backups/${b.name}`}
                  download
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 active:bg-zinc-200 dark:active:bg-zinc-700"
                  title="Download backup"
                >
                  <Download className="w-4 h-4" />
                </a>
                <button
                  onClick={() => handleShare(b.name)}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 active:bg-zinc-200 dark:active:bg-zinc-700"
                  title="Share backup link"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(b.name)}
                  disabled={deleting === b.name}
                  className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 active:bg-rose-100 dark:active:bg-rose-950/50 active:text-rose-600 disabled:opacity-50"
                  title="Delete backup"
                >
                  {deleting === b.name ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>

            <button
              onClick={() => handleRestore(b.name)}
              disabled={restoring === b.name || !!pending}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 active:bg-emerald-200 dark:active:bg-emerald-950/60 disabled:opacity-50 shrink-0"
            >
              {restoring === b.name ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Restoring…
                </>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  Restore
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
