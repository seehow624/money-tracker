import path from 'node:path';

export const DB_PATH =
  process.env.MONEY_TRACKER_DB_PATH ??
  path.join(process.cwd(), 'data', 'money.db');

export const DB_BACKUPS_DIR = path.join(process.cwd(), 'data');
