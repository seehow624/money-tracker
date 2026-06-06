import { AppBar } from '@/components/AppBar';
import { db, schema } from '@/db';
import { eq, isNull, and, asc } from 'drizzle-orm';
import Link from 'next/link';
import { CategoryIcon } from '@/lib/icons';
import { colorFor } from '@/lib/colors';
import { saveCategories } from './actions';
import { requireSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const PALETTE = [
  'amber', 'orange', 'red', 'rose', 'pink', 'fuchsia',
  'violet', 'indigo', 'blue', 'sky', 'teal', 'emerald',
  'lime', 'slate', 'gray', 'zinc', 'stone',
];

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { userId } = await requireSession();
  const params = await searchParams;
  const type: 'income' | 'expense' =
    params.type === 'income' ? 'income' : 'expense';
  const isIncome = type === 'income';

  const cats = db
    .select()
    .from(schema.categories)
    .where(
      and(
        eq(schema.categories.isIncome, isIncome),
        isNull(schema.categories.parentId),
        eq(schema.categories.userId, userId),
      ),
    )
    .orderBy(asc(schema.categories.displayOrder), asc(schema.categories.id))
    .all();

  return (
    <div>
      <AppBar
        title={`${isIncome ? 'Income' : 'Expense'} Categories`}
        back={{ href: '/more', label: 'More' }}
      />
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-32 space-y-4 min-h-[calc(100vh-3.5rem)]">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 grid grid-cols-2 overflow-hidden">
          <Link
            href="/more/categories?type=expense"
            className={
              'py-3 text-center text-sm font-medium transition ' +
              (!isIncome
                ? 'bg-rose-50 dark:bg-rose-950/30 text-rose-700'
                : 'text-zinc-500 active:bg-zinc-100 dark:active:bg-zinc-800')
            }
          >
            Expense ({!isIncome ? cats.length : '—'})
          </Link>
          <Link
            href="/more/categories?type=income"
            className={
              'py-3 text-center text-sm font-medium transition ' +
              (isIncome
                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700'
                : 'text-zinc-500 active:bg-zinc-100 dark:active:bg-zinc-800')
            }
          >
            Income ({isIncome ? cats.length : '—'})
          </Link>
        </div>

        <form action={saveCategories} className="space-y-3">
          {cats.map((c) => {
            const { tint, bg } = colorFor(c.color);
            return (
              <div
                key={c.id}
                className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-4 space-y-3"
              >
                <input type="hidden" name="id" value={c.id} />

                <div className="flex items-center gap-3">
                  <span
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: tint, color: bg }}
                  >
                    <CategoryIcon
                      name={c.name}
                      className="w-5 h-5"
                      strokeWidth={2.25}
                    />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{c.name}</div>
                    {!c.active && (
                      <div className="text-xs text-zinc-400">Inactive</div>
                    )}
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer shrink-0">
                    <input
                      type="checkbox"
                      name={`active_${c.id}`}
                      defaultChecked={c.active}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-6 bg-zinc-300 dark:bg-zinc-700 peer-checked:bg-emerald-500 rounded-full transition" />
                    <div className="absolute left-0.5 top-0.5 w-5 h-5 bg-white rounded-full transition peer-checked:translate-x-4" />
                  </label>
                </div>

                {!isIncome && (
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">
                      Monthly budget
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 text-sm">RM</span>
                      <input
                        type="number"
                        name={`budget_${c.id}`}
                        step="0.01"
                        min="0"
                        defaultValue={c.monthlyBudgetMyr ?? ''}
                        placeholder="—"
                        className="flex-1 bg-zinc-100 dark:bg-zinc-800 rounded-lg px-3 py-1.5 text-sm tabular-nums"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-xs text-zinc-500 mb-1.5">
                    Color
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {PALETTE.map((name) => {
                      const checked = (c.color ?? 'gray') === name;
                      return (
                        <label
                          key={name}
                          className="cursor-pointer"
                          aria-label={name}
                        >
                          <input
                            type="radio"
                            name={`color_${c.id}`}
                            value={name}
                            defaultChecked={checked}
                            className="sr-only peer"
                          />
                          <span
                            className="block w-7 h-7 rounded-full ring-2 ring-transparent peer-checked:ring-zinc-900 dark:peer-checked:ring-zinc-100 transition"
                            style={{ backgroundColor: colorFor(name).bg }}
                          />
                        </label>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}

          <div
            className="sticky z-30 pt-2"
            style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
          >
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-xl py-3 shadow-lg shadow-emerald-600/30 transition"
            >
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
