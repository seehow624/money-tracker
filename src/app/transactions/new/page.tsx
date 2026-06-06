import { AppBar } from '@/components/AppBar';
import { TransactionForm } from '@/components/TransactionForm';
import { db, schema } from '@/db';
import { eq, isNull, and, sql } from 'drizzle-orm';
import { requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function NewTransactionPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; type?: string; accountId?: string; toAccountId?: string; amount?: string; returnTo?: string }>;
}) {
  const { userId } = await requireSession();
  const params = await searchParams;
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
        eq(schema.accounts.active, true),
        eq(schema.accounts.userId, userId),
      ),
    )
    .orderBy(schema.accounts.displayOrder, schema.accounts.id)
    .all();
  const categories = db
    .select({
      id: schema.categories.id,
      name: schema.categories.name,
      isIncome: schema.categories.isIncome,
      icon: schema.categories.icon,
      color: schema.categories.color,
    })
    .from(schema.categories)
    .where(
      and(
        eq(schema.categories.active, true),
        isNull(schema.categories.parentId),
        eq(schema.categories.userId, userId),
      ),
    )
    .all();

  const customPaidBy = (
    db
      .select({ paidBy: schema.transactions.paidBy })
      .from(schema.transactions)
      .where(
        and(
          sql`paid_by NOT IN ('me', 'mom', 'dad')`,
          eq(schema.transactions.userId, userId),
        ),
      )
      .groupBy(schema.transactions.paidBy)
      .all() as { paidBy: string }[]
  ).map((r) => r.paidBy);

  const today = params.date ?? new Date().toISOString().slice(0, 10);
  const initialType: 'expense' | 'income' | 'transfer' =
    params.type === 'income'
      ? 'income'
      : params.type === 'transfer'
        ? 'transfer'
        : 'expense';
  const initialAccountId = params.accountId ? parseInt(params.accountId, 10) : null;
  const initialToAccountId = params.toAccountId ? parseInt(params.toAccountId, 10) : null;
  const initialAmount = params.amount ? parseFloat(params.amount) : null;
  const safeReturnTo =
    params.returnTo &&
    params.returnTo.startsWith('/') &&
    !params.returnTo.startsWith('//') &&
    !params.returnTo.includes('://')
      ? params.returnTo
      : undefined;

  return (
    <div>
      <AppBar
        title="New Transaction"
        back={{ href: safeReturnTo ?? '/', label: safeReturnTo ? 'Back' : 'Home' }}
      />
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-32 min-h-[calc(100vh-3.5rem)]">
        <TransactionForm
          initial={{
            type: initialType,
            date: today,
            amount: initialAmount && Number.isFinite(initialAmount) ? initialAmount : null,
            accountId: Number.isFinite(initialAccountId) ? initialAccountId : null,
            toAccountId: Number.isFinite(initialToAccountId) ? initialToAccountId : null,
            categoryId: null,
            description: '',
            paidBy: 'me',
            notes: '',
          }}
          accounts={accounts}
          categories={categories}
          customPaidByOptions={customPaidBy}
          returnTo={safeReturnTo}
        />
      </div>
    </div>
  );
}
