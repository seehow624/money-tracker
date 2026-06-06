'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import { db, schema } from '@/db';
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SEC,
  createSessionToken,
  verifyPassword,
  type Role,
} from '@/lib/auth';

const SAFE_NEXT_RE = /^\/(?!\/)[A-Za-z0-9_\-/?&=.%:#]*$/;

export async function login(formData: FormData) {
  const username = String(formData.get('username') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const nextRaw = String(formData.get('next') ?? '/');
  const next = SAFE_NEXT_RE.test(nextRaw) ? nextRaw : '/';

  const row = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .get();

  if (!row || !(await verifyPassword(password, row.passwordHash))) {
    redirect(`/login?error=invalid&next=${encodeURIComponent(next)}`);
  }

  const token = await createSessionToken(row.id, row.role as Role);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // self-hosted over HTTP on a trusted private network (LAN/VPN). Set true if behind HTTPS.
    path: '/',
    maxAge: SESSION_MAX_AGE_SEC,
  });

  redirect(next);
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  redirect('/login');
}
