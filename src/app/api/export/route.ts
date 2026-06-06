import { NextResponse } from 'next/server';
import { rawDb } from '@/db';
import { checkAuthOrSession, resolveUserId } from '@/lib/api-auth';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function csvEscape(v: string | number | null): string {
  if (v == null) return '';
  const s = String(v);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: Request) {
  const unauth = await checkAuthOrSession(req);
  if (unauth) return unauth;

  // Dual-auth: a session cookie -> session.userId; a Bearer token -> admin.
  // resolveUserId already checks both, in that order.
  const userId = await resolveUserId(req);
  if (userId === 'no_admin') {
    return NextResponse.json(
      { ok: false, error: 'No admin user' },
      { status: 500 },
    );
  }
  if (userId === null) {
    // Shouldn't happen — checkAuthOrSession would have returned 401 first.
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  const url = new URL(req.url);
  const from = url.searchParams.get('from');
  const to = url.searchParams.get('to');

  let where = ' AND t.user_id = ?';
  const args: (string | number)[] = [userId];
  if (from && DATE_RE.test(from)) {
    where += ` AND t.date >= ?`;
    args.push(from);
  }
  if (to && DATE_RE.test(to)) {
    where += ` AND t.date <= ?`;
    args.push(to);
  }

  const rows = rawDb
    .prepare(
      `SELECT
         t.date,
         t.type,
         t.amount,
         t.currency,
         t.amount_myr,
         t.fx_rate,
         a.name AS account,
         a2.name AS to_account,
         c.name AS category,
         c2.name AS subcategory,
         t.description,
         t.payee,
         t.paid_by,
         t.notes,
         t.source
       FROM transactions t
       LEFT JOIN accounts a ON a.id = t.account_id
       LEFT JOIN accounts a2 ON a2.id = t.to_account_id
       LEFT JOIN categories c ON c.id = t.category_id
       LEFT JOIN categories c2 ON c2.id = t.subcategory_id
       WHERE 1=1 ${where}
       ORDER BY t.date ASC, t.id ASC`,
    )
    .all(...args) as Record<string, string | number | null>[];

  const headers = [
    'date',
    'type',
    'amount',
    'currency',
    'amount_myr',
    'fx_rate',
    'account',
    'to_account',
    'category',
    'subcategory',
    'description',
    'payee',
    'paid_by',
    'notes',
    'source',
  ];

  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(headers.map((h) => csvEscape(r[h])).join(','));
  }
  const csv = lines.join('\n') + '\n';

  const today = new Date().toISOString().slice(0, 10);
  const fromTag = from ? `_${from}` : '';
  const toTag = to ? `_to_${to}` : '';
  const fileName = `money-tracker_export_${today}${fromTag}${toTag}.csv`;

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
