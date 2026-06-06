import { NextResponse } from 'next/server';
import { checkAuth } from '@/lib/api-auth';
import { monthSummary, categoryBreakdown } from '@/lib/queries';
import { thisMonth, daysInMonth } from '@/lib/format';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';

const MONTH_RE = /^\d{4}-\d{2}$/;

export async function GET(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  const url = new URL(req.url);
  const month = url.searchParams.get('month') ?? thisMonth();
  if (!MONTH_RE.test(month)) {
    return NextResponse.json(
      { ok: false, error: 'month must be YYYY-MM' },
      { status: 400 },
    );
  }

  const admin = db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.role, 'admin'))
    .orderBy(schema.users.id)
    .get();
  if (!admin) {
    return NextResponse.json(
      { ok: false, error: 'No admin user' },
      { status: 500 },
    );
  }
  const userId = admin.id;

  const today = new Date().toISOString().slice(0, 10);
  const isCurrent = month === thisMonth();
  const anchor = isCurrent
    ? today
    : `${month}-${String(daysInMonth(month)).padStart(2, '0')}`;

  const summary = monthSummary(userId, month, anchor);
  const cats = categoryBreakdown(userId, month).slice(0, 10);

  return NextResponse.json({
    ok: true,
    month,
    spent: summary.spentSoFar,
    scheduled: summary.scheduled,
    income: summary.income,
    budget: summary.budgetMyr,
    remaining: summary.remaining,
    txn_count: summary.txnCount,
    top_categories: cats.map((c) => ({
      id: c.id,
      name: c.name,
      spent: c.spent,
      txn_count: c.txnCount,
      budget: c.budget,
    })),
  });
}
