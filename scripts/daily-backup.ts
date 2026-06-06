import 'dotenv/config';
import { rawDb } from '../src/db';
import fs from 'node:fs';
import path from 'node:path';

const DB_DIR = path.join(process.cwd(), 'data');
const BACKUP_DIR = path.join(DB_DIR, 'backups');
const KEEP_DAYS = 30;

fs.mkdirSync(BACKUP_DIR, { recursive: true });

const today = new Date().toISOString().slice(0, 10);
const backupPath = path.join(BACKUP_DIR, `money-${today}.db`);

async function run() {
  console.log(`[backup] writing ${backupPath}`);
  await rawDb.backup(backupPath);
  const sizeMB = (fs.statSync(backupPath).size / 1024 / 1024).toFixed(2);
  console.log(`[backup] done · ${sizeMB} MB`);

  // Prune old
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - KEEP_DAYS);
  const cutoffStr = cutoff.toISOString().slice(0, 10);
  const files = fs.readdirSync(BACKUP_DIR);
  let pruned = 0;
  for (const f of files) {
    const m = f.match(/^money-(\d{4}-\d{2}-\d{2})\.db$/);
    if (!m) continue;
    if (m[1] < cutoffStr) {
      fs.unlinkSync(path.join(BACKUP_DIR, f));
      pruned++;
    }
  }
  console.log(`[backup] pruned ${pruned} files older than ${cutoffStr}`);
}

run().catch((e) => {
  console.error('[backup] failed:', e);
  process.exit(1);
});
