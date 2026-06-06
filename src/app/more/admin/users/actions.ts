'use server';

import { db, schema, rawDb } from '@/db';
import { eq } from 'drizzle-orm';
import { requireAdmin, hashPassword } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';

const PATH = '/more/admin/users';

function fail(reason: string): never {
  redirect(`${PATH}?error=${reason}`);
}

export async function createUser(formData: FormData): Promise<void> {
  await requireAdmin();

  const username = String(formData.get('username') ?? '').trim();
  const roleRaw = String(formData.get('role') ?? 'member');
  const password = String(formData.get('password') ?? '');

  if (!username) fail('missing_username');
  const role: 'admin' | 'member' = roleRaw === 'admin' ? 'admin' : 'member';
  if (password.length < 8) fail('too_short');

  const existing = db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.username, username))
    .get();
  if (existing) fail('exists');

  const passwordHash = await hashPassword(password);

  db.insert(schema.users)
    .values({ username, passwordHash, role })
    .run();

  revalidatePath(PATH);
  redirect(PATH);
}

export async function deleteUser(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const idRaw = String(formData.get('id') ?? '');
  const id = Number.parseInt(idRaw, 10);
  if (!Number.isFinite(id)) fail('bad_id');

  if (id === session.userId) fail('self_delete');

  const exists = db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .get();
  if (!exists) fail('not_found');

  rawDb.transaction(() => {
    rawDb.prepare('DELETE FROM transactions WHERE user_id = ?').run(id);
    rawDb.prepare('DELETE FROM accounts WHERE user_id = ?').run(id);
    rawDb.prepare('DELETE FROM categories WHERE user_id = ?').run(id);
    rawDb.prepare('DELETE FROM monthly_budgets WHERE user_id = ?').run(id);
    rawDb.prepare('DELETE FROM scheduled_rules WHERE user_id = ?').run(id);
    rawDb.prepare('DELETE FROM users WHERE id = ?').run(id);
  })();

  revalidatePath(PATH);
  redirect(PATH);
}

export async function resetPassword(formData: FormData): Promise<void> {
  await requireAdmin();
  const idRaw = String(formData.get('id') ?? '');
  const id = Number.parseInt(idRaw, 10);
  const password = String(formData.get('password') ?? '');

  if (!Number.isFinite(id)) fail('bad_id');
  if (password.length < 8) fail('too_short');

  const exists = db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .get();
  if (!exists) fail('not_found');

  const passwordHash = await hashPassword(password);
  db.update(schema.users)
    .set({ passwordHash })
    .where(eq(schema.users.id, id))
    .run();

  revalidatePath(PATH);
  redirect(`${PATH}?ok=reset`);
}
