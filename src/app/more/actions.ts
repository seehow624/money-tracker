'use server';

import { rawDb } from '@/db';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { DB_PATH, DB_BACKUPS_DIR } from '@/lib/backup-path';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/auth';

export type BackupEntry = {
  name: string;
  size: number;
  created: string;
};

export async function createBackup(): Promise<{ ok: boolean; name?: string; error?: string }> {
  await requireAdmin();
  const tmpPath = path.join(os.tmpdir(), `money-tracker-backup-${Date.now()}.db`);
  try {
    await rawDb.backup(tmpPath);
    const buf = fs.readFileSync(tmpPath);

    const now = new Date();
    const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupName = `backup-${ts}.db`;
    if (!fs.existsSync(DB_BACKUPS_DIR)) fs.mkdirSync(DB_BACKUPS_DIR, { recursive: true });
    fs.writeFileSync(path.join(DB_BACKUPS_DIR, backupName), buf);

    // Keep max 20
    const files = fs
      .readdirSync(DB_BACKUPS_DIR)
      .filter((f) => f.startsWith('backup-') && f.endsWith('.db'))
      .map((f) => ({ name: f, mtime: fs.statSync(path.join(DB_BACKUPS_DIR, f)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
    for (const f of files.slice(20)) {
      fs.unlinkSync(path.join(DB_BACKUPS_DIR, f.name));
    }

    revalidatePath('/more');
    return { ok: true, name: backupName };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  } finally {
    try { fs.unlinkSync(tmpPath); } catch {}
  }
}

export async function deleteBackup(name: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  if (!name || name.includes('/') || name.includes('\\') || !name.endsWith('.db')) {
    return { ok: false, error: 'Invalid backup name' };
  }
  const backupPath = path.join(DB_BACKUPS_DIR, name);
  if (!fs.existsSync(backupPath)) {
    return { ok: false, error: `Backup not found: ${name}` };
  }
  try {
    fs.unlinkSync(backupPath);
    revalidatePath('/more/backup/restore');
    revalidatePath('/more');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

export async function restoreBackup(name: string): Promise<{ ok: boolean; error?: string }> {
  await requireAdmin();
  if (!name || name.includes('/') || name.includes('\\') || !name.endsWith('.db')) {
    return { ok: false, error: 'Invalid backup name' };
  }

  const backupPath = path.join(DB_BACKUPS_DIR, name);
  if (!fs.existsSync(backupPath)) {
    return { ok: false, error: `Backup not found: ${name}` };
  }

  // Save current before overwriting
  const now = new Date();
  const ts = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const preRestoreBackup = `pre-restore-${ts}.db`;
  fs.copyFileSync(DB_PATH, path.join(DB_BACKUPS_DIR, preRestoreBackup));

  // Delete WAL/SHM
  for (const ext of ['-wal', '-shm']) {
    try { fs.unlinkSync(`${DB_PATH}${ext}`); } catch {}
  }

  fs.copyFileSync(backupPath, DB_PATH);

  revalidatePath('/');
  revalidatePath('/stats');
  revalidatePath('/balances');
  revalidatePath('/more');

  return { ok: true };
}
