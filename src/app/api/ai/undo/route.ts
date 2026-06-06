import { NextResponse } from 'next/server';
import { db, rawDb, schema } from '@/db';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { checkAuthOrSameOrigin, resolveUserId } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const authErr = checkAuthOrSameOrigin(req);
  if (authErr) return authErr;

  // Resolve the effective userId: session cookie wins (browser UI), else
  // admin (Bearer token). Same pattern as /api/ai/chat.
  const userId = await resolveUserId(req);
  if (userId === 'no_admin') {
    return NextResponse.json(
      { ok: false, error: 'No admin user' },
      { status: 500 },
    );
  }
  if (userId === null) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  let body: { id?: number };
  try {
    body = (await req.json()) as { id?: number };
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }
  const id = Number(body.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ ok: false, error: 'invalid id' }, { status: 400 });
  }
  const existing = db
    .select()
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.id, id),
        eq(schema.transactions.userId, userId),
      ),
    )
    .get();
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }
  // Only allow undoing AI-recorded transactions, to keep this endpoint scoped.
  if (existing.source !== 'ai') {
    return NextResponse.json(
      { ok: false, error: 'undo only available for AI-recorded transactions' },
      { status: 403 },
    );
  }
  rawDb
    .prepare('DELETE FROM transactions WHERE id=? AND user_id=?')
    .run(id, userId);
  revalidatePath('/');
  revalidatePath('/stats');
  revalidatePath('/balances');
  return NextResponse.json({ ok: true });
}
