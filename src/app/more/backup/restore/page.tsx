import { AppBar } from '@/components/AppBar';
import { RestoreClient } from '@/components/RestoreClient';
import { DB_BACKUPS_DIR } from '@/lib/backup-path';
import type { BackupEntry } from '@/app/more/actions';
import fs from 'node:fs';
import path from 'node:path';

export const dynamic = 'force-dynamic';

function listBackups(): BackupEntry[] {
  const dir = DB_BACKUPS_DIR;
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => {
      if (!f.endsWith('.db')) return false;
      if (f === 'money.db') return false;
      return f.startsWith('backup-') || f.startsWith('money-') || f.startsWith('pre-restore-');
    })
    .map((f) => {
      const fp = path.join(dir, f);
      const stat = fs.statSync(fp);
      return { name: f, size: stat.size, created: stat.birthtime.toISOString() };
    })
    .sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime());
}

export default function RestorePage() {
  const backups = listBackups();

  return (
    <div>
      <AppBar title="View Backups" back={{ href: '/more/backup' }} />

      <div className="max-w-3xl mx-auto px-4 pt-2 pb-32 min-h-[calc(100vh-3.5rem)]">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden">
          <RestoreClient initialBackups={backups} />
        </div>
      </div>
    </div>
  );
}
