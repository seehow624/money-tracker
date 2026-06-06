import { NextResponse } from 'next/server';
import { checkAuth, getAdminUserId } from '@/lib/api-auth';
import { db, schema } from '@/db';
import { eq, desc, and, gte, lte } from 'drizzle-orm';
import { resolveAccount, resolveCategory } from '@/lib/fuzzy';
import { convertToMyr } from '@/lib/fx';
import { revalidatePath } from 'next/cache';
import crypto from 'node:crypto';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function resolveDate(d: string | undefined): string {
  if (!d) return new Date().toISOString().slice(0, 10);
  const lower = d.toLowerCase().trim();
  if (lower === 'today' || lower === '今天') return new Date().toISOString().slice(0, 10);
  if (lower === 'yesterday' || lower === '昨天') {
    const x = new Date();
    x.setUTCDate(x.getUTCDate() - 1);
    return x.toISOString().slice(0, 10);
  }
  if (DATE_RE.test(d)) return d;
  return new Date().toISOString().slice(0, 10);
}

export async function POST(req: Request) {
  const authErr = checkAuth(req);
  if (authErr) return authErr;

  // Bearer token = admin user (Luna). All writes get attributed to the
  // admin's userId so the row appears under their data.
  const userId = getAdminUserId();
  if (userId === null) {
    return NextResponse.json(
      { ok: false, error: 'No admin user' },
      { status: 500 },
    );
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { ok: false, error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const type = String(body.type ?? '').toLowerCase();
  if (!['expense', 'income', 'transfer'].includes(type)) {
    return NextResponse.json(
      {
        ok: false,
        error: `type must be 'expense' | 'income' | 'transfer', got ${JSON.stringify(body.type)}`,
      },
      { status: 400 },
    );
  }

  const amount = typeof body.amount === 'number' ? body.amount : parseFloat(String(body.amount));
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json(
      { ok: false, error: 'amount must be a positive number' },
      { status: 400 },
    );
  }

  const accountHint = String(body.account ?? '').trim();
  if (!accountHint) {
    return NextResponse.json(
      { ok: false, error: 'account is required' },
      { status: 400 },
    );
  }

  const accounts = db
    .select({
      id: schema.accounts.id,
      name: schema.accounts.name,
      type: schema.accounts.type,
      currency: schema.accounts.currency,
      active: schema.accounts.active,
    })
    .from(schema.accounts)
    .where(
      and(
        eq(schema.accounts.userId, userId),
        eq(schema.accounts.active, true),
      ),
    )
    .all();

  const accountResult = resolveAccount(accountHint, accounts);
  if (!accountResult.match) {
    return NextResponse.json(
      {
        ok: false,
        error: accountResult.ambiguous
          ? `Ambiguous account '${accountHint}'`
          : `Account not found: '${accountHint}'`,
        candidates: accountResult.candidates.map((a) => a.name),
      },
      { status: 400 },
    );
  }
  const account = accountResult.match;

  let toAccount: typeof account | null = null;
  if (type === 'transfer') {
    const toHint = String(body.to_account ?? body.toAccount ?? '').trim();
    if (!toHint) {
      return NextResponse.json(
        { ok: false, error: "to_account is required for type='transfer'" },
        { status: 400 },
      );
    }
    const r = resolveAccount(toHint, accounts);
    if (!r.match) {
      return NextResponse.json(
        {
          ok: false,
          error: r.ambiguous
            ? `Ambiguous to_account '${toHint}'`
            : `Account not found for to_account: '${toHint}'`,
          candidates: r.candidates.map((a) => a.name),
        },
        { status: 400 },
      );
    }
    toAccount = r.match;
    if (toAccount.id === account.id) {
      return NextResponse.json(
        { ok: false, error: 'account and to_account are the same' },
        { status: 400 },
      );
    }
  }

  // Category (optional for transfer; auto-fill if hint given)
  const categoryHint = String(body.category ?? '').trim();
  let categoryId: number | null = null;
  let categoryMatched: { id: number; name: string } | null = null;
  if (categoryHint && type !== 'transfer') {
    const allCats = db
      .select({
        id: schema.categories.id,
        name: schema.categories.name,
        isIncome: schema.categories.isIncome,
        active: schema.categories.active,
      })
      .from(schema.categories)
      .where(
        and(
          eq(schema.categories.userId, userId),
          eq(schema.categories.active, true),
        ),
      )
      .all();
    const r = resolveCategory(
      categoryHint,
      allCats.filter((c) => c.active),
      type as 'expense' | 'income',
    );
    if (!r.match) {
      return NextResponse.json(
        {
          ok: false,
          error: r.ambiguous
            ? `Ambiguous category '${categoryHint}'`
            : `Category not found: '${categoryHint}'`,
          candidates: r.candidates.map((c) => c.name),
        },
        { status: 400 },
      );
    }
    categoryId = r.match.id;
    categoryMatched = { id: r.match.id, name: r.match.name };
  }

  const date = resolveDate(typeof body.date === 'string' ? body.date : undefined);
  const description = (body.description ? String(body.description) : '').trim();
  const paidBy = (body.paid_by ? String(body.paid_by) : 'me').trim() || 'me';
  const notes = body.notes ? String(body.notes).trim() : '';
  const currency = body.currency ? String(body.currency) : account.currency;
  const { amountMyr, fxRate } = convertToMyr(amount, currency, date);

  const fingerprint = `luna:${Date.now()}:${crypto.randomBytes(6).toString('hex')}`;

  const inserted = db
    .insert(schema.transactions)
    .values({
      userId,
      date,
      amount,
      currency,
      amountMyr,
      fxRate,
      type: type as 'expense' | 'income' | 'transfer',
      categoryId,
      accountId: account.id,
      toAccountId: toAccount?.id ?? null,
      description: description || null,
      paidBy,
      notes: notes || null,
      source: typeof body.source === 'string' ? body.source : 'telegram:luna',
      isBusiness: false,
      isRecurring: false,
      rawData: JSON.stringify(body),
      fingerprint,
    })
    .returning()
    .get();

  revalidatePath('/');
  revalidatePath('/stats');
  revalidatePath('/balances');

  return NextResponse.json({
    ok: true,
    id: inserted.id,
    matched: {
      account: { id: account.id, name: account.name, currency: account.currency },
      to_account: toAccount
        ? { id: toAccount.id, name: toAccount.name, currency: toAccount.currency }
        : null,
      category: categoryMatched,
      date,
      paid_by: paidBy,
    },
  });
}

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

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20', 10), 200);
  const month = url.searchParams.get('month');

  const accountById = new Map(
    db
      .select({ id: schema.accounts.id, name: schema.accounts.name })
      .from(schema.accounts)
      .where(eq(schema.accounts.userId, userId))
      .all()
      .map((a) => [a.id, a.name]),
  );

  const conds = [eq(schema.transactions.userId, userId)];
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const start = `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate();
    const end = `${month}-${String(lastDay).padStart(2, '0')}`;
    conds.push(gte(schema.transactions.date, start));
    conds.push(lte(schema.transactions.date, end));
  }

  const rows = db
    .select({
      id: schema.transactions.id,
      date: schema.transactions.date,
      type: schema.transactions.type,
      amount: schema.transactions.amount,
      amountMyr: schema.transactions.amountMyr,
      currency: schema.transactions.currency,
      description: schema.transactions.description,
      accountId: schema.transactions.accountId,
      toAccountId: schema.transactions.toAccountId,
      paidBy: schema.transactions.paidBy,
      categoryName: schema.categories.name,
    })
    .from(schema.transactions)
    .leftJoin(
      schema.categories,
      eq(schema.categories.id, schema.transactions.categoryId),
    )
    .where(and(...conds))
    .orderBy(desc(schema.transactions.date), desc(schema.transactions.id))
    .limit(limit)
    .all();

  return NextResponse.json({
    ok: true,
    transactions: rows.map((r) => ({
      id: r.id,
      date: r.date,
      type: r.type,
      amount: r.amount,
      amount_myr: r.amountMyr,
      currency: r.currency,
      description: r.description,
      account: accountById.get(r.accountId) ?? `#${r.accountId}`,
      to_account: r.toAccountId ? accountById.get(r.toAccountId) ?? null : null,
      paid_by: r.paidBy,
      category: r.categoryName,
    })),
  });
}
