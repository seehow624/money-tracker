'use server';

import { db, schema, rawDb } from '@/db';
import { and, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';

const VALID_COLORS = new Set([
  'amber', 'orange', 'red', 'rose', 'pink', 'fuchsia', 'violet', 'indigo',
  'blue', 'sky', 'teal', 'emerald', 'lime', 'slate', 'gray', 'zinc', 'stone',
]);

export async function saveCategories(formData: FormData): Promise<void> {
  const { userId } = await requireSession();
  const ids = formData.getAll('id').map((v) => parseInt(String(v), 10));

  rawDb.exec('BEGIN');
  try {
    for (const id of ids) {
      if (!Number.isFinite(id)) continue;

      const budgetRaw = formData.get(`budget_${id}`);
      const colorRaw = formData.get(`color_${id}`);
      const activeRaw = formData.get(`active_${id}`);

      const update: Partial<typeof schema.categories.$inferInsert> = {
        active: activeRaw === 'on',
      };

      if (budgetRaw !== null && String(budgetRaw).trim() !== '') {
        const v = parseFloat(String(budgetRaw).replace(/,/g, ''));
        if (Number.isFinite(v) && v >= 0) {
          update.monthlyBudgetMyr = v;
        }
      } else {
        update.monthlyBudgetMyr = null;
      }

      if (colorRaw && VALID_COLORS.has(String(colorRaw))) {
        update.color = String(colorRaw);
      }

      db.update(schema.categories)
        .set(update)
        .where(
          and(
            eq(schema.categories.id, id),
            eq(schema.categories.userId, userId),
          ),
        )
        .run();
    }
    rawDb.exec('COMMIT');
  } catch (e) {
    rawDb.exec('ROLLBACK');
    throw e;
  }

  revalidatePath('/more/categories');
  revalidatePath('/more');
  revalidatePath('/');
  revalidatePath('/stats');
}
