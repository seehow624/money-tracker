import { AppBar } from '@/components/AppBar';
import { TransactionForm } from '@/components/TransactionForm';
import { db, schema } from '@/db';
import { eq, isNull, and, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';
import { getBaseCurrency } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function EditTransactionPage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { userId } = await requireSession();
  const base = getBaseCurrency();
  const { id: idStr } = await props.params;
  const { returnTo } = await props.searchParams;
  const id = parseInt(idStr, 10);
  if (!Number.isFinite(id)) notFound();

  const txn = db
    .select()
    .from(schema.transactions)
    .where(
      and(
        eq(schema.transactions.id, id),
        eq(schema.transactions.userId, userId),
      ),
    )
    .get();
  if (!txn) notFound();

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

  return (
    <div>
      <AppBar title="Edit Transaction" back={{ href: '/', label: 'Home' }} />
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-32 min-h-[calc(100vh-3.5rem)]">
        <TransactionForm
          initial={{
            id: txn.id,
            type: txn.type as 'expense' | 'income' | 'transfer',
            date: txn.date,
            amount: txn.amount,
            accountId: txn.accountId,
            toAccountId: txn.toAccountId,
            categoryId: txn.categoryId,
            description: txn.description ?? '',
            paidBy: txn.paidBy,
            notes: txn.notes ?? '',
          }}
          accounts={accounts}
          categories={categories}
          customPaidByOptions={customPaidBy}
          returnTo={returnTo}
          baseCurrency={base}
        />
      </div>
    </div>
  );
}
