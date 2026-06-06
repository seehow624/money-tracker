'use client';

import { useState, useEffect } from 'react';
import {
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { createBackup } from '@/app/more/actions';

export function BackupButton() {
  const [status, setStatus] = useState<'idle' | 'saving' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function handleSave() {
    setStatus('saving');
    const result = await createBackup();
    if (result.ok) {
      setStatus('ok');
      setMessage(`Saved: ${result.name}`);
    } else {
      setStatus('error');
      setMessage(result.error ?? 'Unknown error');
    }
  }

  useEffect(() => {
    if (status === 'ok' || status === 'error') {
      const t = setTimeout(() => setStatus('idle'), 3000);
      return () => clearTimeout(t);
    }
  }, [status]);

  const Icon =
    status === 'saving' ? Loader2 :
    status === 'ok' ? CheckCircle2 :
    status === 'error' ? AlertCircle :
    Save;

  const iconClass = status === 'saving' ? 'animate-spin text-emerald-600' :
    status === 'ok' ? 'text-emerald-600' :
    status === 'error' ? 'text-rose-600' :
    'text-zinc-500';

  return (
    <button
      type="button"
      onClick={handleSave}
      disabled={status === 'saving'}
      className="w-full flex items-start gap-3 px-5 py-3.5 active:bg-zinc-100 dark:active:bg-zinc-800 border-b border-zinc-100 dark:border-zinc-800 last:border-0 text-left disabled:opacity-60"
    >
      <Icon className={`w-6 h-6 mt-0.5 shrink-0 ${iconClass}`} strokeWidth={1.6} />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-[15px]">Save Backup</div>
        <div className="text-xs text-zinc-500 mt-0.5">
          {status === 'saving' ? 'Creating backup…' :
           status === 'ok' ? message :
           status === 'error' ? message :
           'Save current database to backups folder'}
        </div>
      </div>
    </button>
  );
}
