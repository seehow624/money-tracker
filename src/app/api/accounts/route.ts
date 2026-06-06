import { NextResponse } from 'next/server';
import { checkAuth, getAdminUserId } from '@/lib/api-auth';
import { db, schema } from '@/db';
import { and, eq } from 'drizzle-orm';

export async function GET(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const userId = getAdminUserId();
  if (userId === null) {
    return NextResponse.json(
      { ok: false, error: 'No admin user' },
      { status: 500 },
    );
  }

  const accounts = db
    .select({
      id: schema.accounts.id,
      name: schema.accounts.name,
      type: schema.accounts.type,
      currency: schema.accounts.currency,
    })
    .from(schema.accounts)
    .where(
      and(
        eq(schema.accounts.userId, userId),
        eq(schema.accounts.active, true),
      ),
    )
    .orderBy(schema.accounts.displayOrder, schema.accounts.id)
    .all();

  return NextResponse.json({ ok: true, accounts });
}
