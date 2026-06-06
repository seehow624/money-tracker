import { NextResponse } from 'next/server';
import { checkAuth, getAdminUserId } from '@/lib/api-auth';
import { db, schema } from '@/db';
import { eq, and, isNull } from 'drizzle-orm';

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

  const categories = db
    .select({
      id: schema.categories.id,
      name: schema.categories.name,
      isIncome: schema.categories.isIncome,
      monthlyBudgetMyr: schema.categories.monthlyBudgetMyr,
    })
    .from(schema.categories)
    .where(
      and(
        eq(schema.categories.userId, userId),
        eq(schema.categories.active, true),
        isNull(schema.categories.parentId),
      ),
    )
    .orderBy(schema.categories.displayOrder, schema.categories.id)
    .all();

  return NextResponse.json({ ok: true, categories });
}
