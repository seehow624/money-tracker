import { AppBar } from '@/components/AppBar';
import { ScheduledRuleForm } from '@/components/ScheduledRuleForm';
import { db, schema } from '@/db';
import { and, eq, isNull } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function EditScheduledRulePage(props: {
  params: Promise<{ id: string }>;
}) {
  const { userId } = await requireSession();
  const { id: idStr } = await props.params;
  const id = parseInt(idStr, 10);
  if (!Number.isFinite(id)) notFound();

  const rule = db
    .select()
    .from(schema.scheduledRules)
    .where(
      and(
        eq(schema.scheduledRules.id, id),
        eq(schema.scheduledRules.userId, userId),
      ),
    )
    .get();
  if (!rule) notFound();

  const accounts = db
    .select({
      id: schema.accounts.id,
      name: schema.accounts.name,
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

  return (
    <div>
      <AppBar
        title="Edit Rule"
        back={{ href: '/more/scheduled', label: 'Scheduled' }}
      />
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-32 min-h-[calc(100vh-3.5rem)]">
        <ScheduledRuleForm
          initial={{
            id: rule.id,
            name: rule.name,
            type: rule.type as 'expense' | 'income' | 'transfer',
            amount: rule.amount,
            accountId: rule.accountId,
            toAccountId: rule.toAccountId,
            categoryId: rule.categoryId,
            description: rule.description ?? '',
            paidBy: rule.paidBy,
            dayOfMonth: rule.dayOfMonth,
            startDate: rule.startDate,
            endDate: rule.endDate ?? '',
            active: rule.active,
          }}
          accounts={accounts}
          categories={categories}
        />
      </div>
    </div>
  );
}
