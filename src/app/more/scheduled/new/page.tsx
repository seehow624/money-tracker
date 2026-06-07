import { AppBar } from '@/components/AppBar';
import { ScheduledRuleForm } from '@/components/ScheduledRuleForm';
import { db, schema } from '@/db';
import { and, eq, isNull } from 'drizzle-orm';
import { requireSession } from '@/lib/auth';
import { getBaseCurrency } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export default async function NewScheduledRulePage() {
  const { userId } = await requireSession();
  const base = getBaseCurrency();
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

  const today = new Date().toISOString().slice(0, 10);
  const todayDay = new Date().getDate();

  return (
    <div>
      <AppBar
        title="New Rule"
        back={{ href: '/more/scheduled', label: 'Scheduled' }}
      />
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-32 min-h-[calc(100vh-3.5rem)]">
        <ScheduledRuleForm
          initial={{
            name: '',
            type: 'expense',
            amount: null,
            accountId: null,
            toAccountId: null,
            categoryId: null,
            description: '',
            paidBy: 'me',
            dayOfMonth: todayDay,
            startDate: today,
            endDate: '',
            active: true,
          }}
          accounts={accounts}
          categories={categories}
          baseCurrency={base}
        />
      </div>
    </div>
  );
}
