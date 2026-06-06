import { config } from 'dotenv';
import Database from 'better-sqlite3';
import path from 'node:path';

config({ path: '.env.local' });
config(); // fall back to .env

const DB_PATH =
  process.env.MONEY_TRACKER_DB_PATH ??
  path.join(process.cwd(), 'data', 'money.db');

const username = process.env.APP_USERNAME;
const password = process.env.APP_PASSWORD;
if (!username || !password) {
  console.error('APP_USERNAME and APP_PASSWORD must be set in .env.local');
  process.exit(1);
}

async function hashPassword(pw: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const km = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(pw) as BufferSource,
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 100_000,
      hash: 'SHA-256',
    },
    km,
    256,
  );
  const b64u = (b: ArrayBuffer | Uint8Array) =>
    Buffer.from(b instanceof Uint8Array ? b : new Uint8Array(b)).toString(
      'base64url',
    );
  return `pbkdf2$100000$${b64u(salt)}$${b64u(bits)}`;
}

const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');
sqlite.pragma('foreign_keys = ON');

(async () => {
  const existing = sqlite
    .prepare('SELECT id FROM users WHERE username = ?')
    .get(username) as { id: number } | undefined;
  if (existing) {
    console.log(
      `User '${username}' already exists (id=${existing.id}). No changes.`,
    );
    sqlite.close();
    return;
  }

  const hash = await hashPassword(password);
  // Force id=1 so previously-defaulted rows (user_id=1) belong to this admin.
  const result = sqlite
    .prepare(
      `INSERT INTO users (id, username, password_hash, role, created_at)
       VALUES (?, ?, ?, 'admin', CURRENT_TIMESTAMP)`,
    )
    .run(1, username, hash);
  console.log(
    `Created admin user '${username}' (id=${result.lastInsertRowid})`,
  );
  sqlite.close();
})();
