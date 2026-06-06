import { cookies } from 'next/headers';

export const SESSION_COOKIE = 'mt_session';
export const SESSION_MAX_AGE_SEC = 30 * 24 * 60 * 60; // 30 days
const PBKDF2_ITERATIONS = 100_000;

const encoder = new TextEncoder();

export type Role = 'admin' | 'member';
export type Session = { userId: number; role: Role };

function getSecretBytes(): Uint8Array {
  const s = process.env.APP_SESSION_SECRET;
  if (!s || s.length < 16) {
    throw new Error('APP_SESSION_SECRET must be set (>=16 chars)');
  }
  return encoder.encode(s);
}

async function getSigningKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    getSecretBytes() as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

function b64u(bytes: ArrayBuffer | Uint8Array): string {
  const u = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < u.length; i++) s += String.fromCharCode(u[i]);
  return btoa(s).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function b64uDecode(s: string): Uint8Array {
  const n = s.replace(/-/g, '+').replace(/_/g, '/');
  const p = n.length % 4 ? n + '='.repeat(4 - (n.length % 4)) : n;
  const bin = atob(p);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function createSessionToken(
  userId: number,
  role: Role,
): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SEC;
  const payload = `${userId}.${role}.${exp}`;
  const key = await getSigningKey();
  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(payload) as BufferSource,
  );
  return `${payload}.${b64u(sig)}`;
}

export async function verifySessionToken(
  token: string | undefined,
): Promise<Session | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 4) return null;
  const [userIdStr, role, expStr, sigB64] = parts;
  if (role !== 'admin' && role !== 'member') return null;
  const userId = Number.parseInt(userIdStr, 10);
  const exp = Number.parseInt(expStr, 10);
  if (!Number.isFinite(userId) || !Number.isFinite(exp)) return null;
  if (exp < Math.floor(Date.now() / 1000)) return null;
  let sig: Uint8Array;
  try {
    sig = b64uDecode(sigB64);
  } catch {
    return null;
  }
  const key = await getSigningKey();
  const valid = await crypto.subtle.verify(
    'HMAC',
    key,
    sig as BufferSource,
    encoder.encode(`${userIdStr}.${role}.${expStr}`) as BufferSource,
  );
  return valid ? { userId, role } : null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const km = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password) as BufferSource,
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    km,
    256,
  );
  return `pbkdf2$${PBKDF2_ITERATIONS}$${b64u(salt)}$${b64u(bits)}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
  const iter = Number.parseInt(parts[1], 10);
  if (!Number.isFinite(iter)) return false;
  let salt: Uint8Array;
  let expected: Uint8Array;
  try {
    salt = b64uDecode(parts[2]);
    expected = b64uDecode(parts[3]);
  } catch {
    return false;
  }
  const km = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password) as BufferSource,
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = new Uint8Array(
    await crypto.subtle.deriveBits(
      {
        name: 'PBKDF2',
        salt: salt as BufferSource,
        iterations: iter,
        hash: 'SHA-256',
      },
      km,
      expected.length * 8,
    ),
  );
  if (bits.length !== expected.length) return false;
  let res = 0;
  for (let i = 0; i < bits.length; i++) res |= bits[i] ^ expected[i];
  return res === 0;
}

export async function getServerSession(): Promise<Session | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  return verifySessionToken(token);
}

// For server components / actions where the middleware should already have
// guaranteed a session. Throws if not (i.e. shouldn't happen in practice).
export async function requireSession(): Promise<Session> {
  const s = await getServerSession();
  if (!s) throw new Error('Unauthenticated');
  return s;
}

export async function requireAdmin(): Promise<Session> {
  const s = await requireSession();
  if (s.role !== 'admin') throw new Error('Forbidden');
  return s;
}
