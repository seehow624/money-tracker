import { NextResponse } from 'next/server';
import { checkAuth, getAdminUserId } from '@/lib/api-auth';
import { rawDb } from '@/db';
import { revalidatePath } from 'next/cache';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const userId = getAdminUserId();
  if (userId === null) {
    return NextResponse.json(
      { ok: false, error: 'No admin user' },
      { status: 500 },
    );
  }

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (!Number.isFinite(id)) {
    return NextResponse.json(
      { ok: false, error: 'Invalid id' },
      { status: 400 },
    );
  }

  const row = rawDb
    .prepare(
      'SELECT id, date, amount, description FROM transactions WHERE id=? AND user_id=?',
    )
    .get(id, userId) as
    | { id: number; date: string; amount: number; description: string }
    | undefined;

  if (!row) {
    return NextResponse.json(
      { ok: false, error: 'Transaction not found' },
      { status: 404 },
    );
  }

  rawDb
    .prepare('DELETE FROM transactions WHERE id=? AND user_id=?')
    .run(id, userId);

  revalidatePath('/');
  revalidatePath('/stats');
  revalidatePath('/balances');

  return NextResponse.json({ ok: true, deleted: row });
}
