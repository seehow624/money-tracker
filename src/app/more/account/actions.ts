'use server';

import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { db, schema } from '@/db';
import { requireSession, verifyPassword, hashPassword } from '@/lib/auth';

export async function changePassword(formData: FormData): Promise<void> {
  const { userId } = await requireSession();

  const current = String(formData.get('current') ?? '');
  const next = String(formData.get('new') ?? '');
  const confirm = String(formData.get('confirm') ?? '');

  const row = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .get();

  if (!row || !(await verifyPassword(current, row.passwordHash))) {
    redirect('/more/account?error=invalid');
  }

  if (next !== confirm) {
    redirect('/more/account?error=mismatch');
  }

  if (next.length < 8) {
    redirect('/more/account?error=too_short');
  }

  const hash = await hashPassword(next);
  db.update(schema.users)
    .set({ passwordHash: hash })
    .where(eq(schema.users.id, userId))
    .run();

  redirect('/more/account?ok=1');
}
