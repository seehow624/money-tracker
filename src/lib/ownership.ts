import { db, schema } from '@/db';
import { and, eq, inArray } from 'drizzle-orm';

/**
 * Verify that all supplied ids on `table` belong to `userId`.
 * Throws if any id is missing or owned by another user.
 *
 * Use as defense-in-depth when accepting foreign-key ids from user input,
 * to prevent member-A from referencing member-B's accounts/categories.
 */
export function assertOwnedAccounts(ids: number[], userId: number): void {
  if (ids.length === 0) return;
  const rows = db
    .select({ id: schema.accounts.id })
    .from(schema.accounts)
    .where(
      and(
        inArray(schema.accounts.id, ids),
        eq(schema.accounts.userId, userId),
      ),
    )
    .all();
  if (rows.length !== ids.length) {
    throw new Error('Forbidden: foreign account id');
  }
}

export function assertOwnedCategories(ids: number[], userId: number): void {
  if (ids.length === 0) return;
  const rows = db
    .select({ id: schema.categories.id })
    .from(schema.categories)
    .where(
      and(
        inArray(schema.categories.id, ids),
        eq(schema.categories.userId, userId),
      ),
    )
    .all();
  if (rows.length !== ids.length) {
    throw new Error('Forbidden: foreign category id');
  }
}
