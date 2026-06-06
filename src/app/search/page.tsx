import { AppBar } from '@/components/AppBar';
import { searchTransactions } from '@/lib/queries';
import { fmtNum } from '@/lib/format';
import { Search } from 'lucide-react';
import { db, schema } from '@/db';
import { eq, isNull, and } from 'drizzle-orm';
import { SearchResults } from '@/components/SearchResults';
import { requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { userId } = await requireSession();
  const { q = '' } = await searchParams;
  const results = q.trim() ? searchTransactions(userId, q, 200) : [];
  const total = results.reduce(
    (acc, t) => {
      if (t.type === 'income') acc.income += t.amountMyr;
      else if (t.type === 'expense') acc.expense += t.amountMyr;
      return acc;
    },
    { income: 0, expense: 0 },
  );

  // Categories for bulk picker
  const allCats = q.trim()
    ? db
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
        .orderBy(schema.categories.displayOrder, schema.categories.id)
        .all()
    : [];
  const expenseCats = allCats.filter((c) => !c.isIncome);
  const incomeCats = allCats.filter((c) => c.isIncome);

  return (
    <div>
      <AppBar title="Search" back={{ href: '/', label: 'Home' }} />
      <div className="max-w-3xl mx-auto px-4 pt-4 pb-32 space-y-4 min-h-[calc(100vh-3.5rem)]">
        <form action="/search" method="get" className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400 pointer-events-none"
            strokeWidth={2}
          />
          <input
            type="search"
            name="q"
            defaultValue={q}
            autoFocus
            placeholder="Search description, payee, account, category…"
            className="w-full bg-white dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 rounded-2xl pl-10 pr-4 py-3 text-base"
          />
        </form>

        {q.trim() ? (
          <>
            <div className="grid grid-cols-3 gap-3 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-4">
              <Stat label="Hits" value={String(results.length)} />
              <Stat
                label="Income"
                value={`+${fmtNum(total.income)}`}
                color="text-sky-500"
              />
              <Stat
                label="Expense"
                value={`−${fmtNum(total.expense)}`}
                color="text-rose-500"
              />
            </div>

            {results.length === 0 ? (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-10 text-center text-sm text-zinc-500">
                No matches for &ldquo;{q}&rdquo;.
              </div>
            ) : (
              <SearchResults
                results={results}
                expenseCats={expenseCats}
                incomeCats={incomeCats}
              />
            )}
          </>
        ) : (
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-10 text-center text-sm text-zinc-500">
            Type something to search across all transactions.
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  color = '',
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase tracking-wide text-zinc-500 mb-0.5">
        {label}
      </div>
      <div className={`text-base font-semibold tabular-nums ${color}`}>
        {value}
      </div>
    </div>
  );
}
