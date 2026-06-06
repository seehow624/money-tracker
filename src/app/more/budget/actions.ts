'use server';

import { db, schema, rawDb } from '@/db';
import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';

const MONTH_RE = /^\d{4}-\d{2}$/;

function nextMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split('-').map(Number);
  const d = new Date(Date.UTC(y, m, 1));
  return d.toISOString().slice(0, 7);
}

export async function saveBudget(formData: FormData): Promise<void> {
  const { userId } = await requireSession();
  const startMonth = String(formData.get('startMonth') ?? '');
  const totalRaw = String(formData.get('total') ?? '');
  const applyMonths = parseInt(String(formData.get('applyMonths') ?? '1'), 10);

  if (!MONTH_RE.test(startMonth)) return;
  const total = parseFloat(totalRaw.replace(/,/g, ''));
  if (!Number.isFinite(total) || total < 0) return;
  const months = Math.min(Math.max(applyMonths, 1), 24);

  rawDb.exec('BEGIN');
  try {
    let m = startMonth;
    for (let i = 0; i < months; i++) {
      db.insert(schema.monthlyBudgets)
        .values({ userId, month: m, totalMyr: total })
        .onConflictDoUpdate({
          target: [
            schema.monthlyBudgets.userId,
            schema.monthlyBudgets.month,
          ],
          set: { totalMyr: total },
        })
        .run();
      m = nextMonth(m);
    }
    rawDb.exec('COMMIT');
  } catch (e) {
    rawDb.exec('ROLLBACK');
    throw e;
  }

  revalidatePath('/more/budget');
  revalidatePath('/more');
  revalidatePath('/');
}
