import 'dotenv/config';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import path from 'node:path';
import fs from 'node:fs';

const DB_PATH =
  process.env.MONEY_TRACKER_DB_PATH ??
  path.join(process.cwd(), 'data', 'money.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

const db = drizzle(sqlite);

console.log(`[migrate] DB: ${DB_PATH}`);
migrate(db, { migrationsFolder: path.join(process.cwd(), 'drizzle') });
console.log('[migrate] done');
sqlite.close();
