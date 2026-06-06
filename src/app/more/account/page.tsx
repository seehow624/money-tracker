import { eq } from 'drizzle-orm';
import { AppBar } from '@/components/AppBar';
import { db, schema } from '@/db';
import { requireSession } from '@/lib/auth';
import { changePassword } from './actions';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Account',
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const { userId } = await requireSession();
  const { error, ok } = await searchParams;

  const user = db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .get();

  return (
    <div>
      <AppBar title="Account" back={{ href: '/more', label: 'More' }} />
      <div className="max-w-2xl mx-auto px-4 pt-4 pb-32 space-y-4 min-h-[calc(100vh-3.5rem)]">
        <section className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-5">
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
                Signed in as
              </div>
              <div className="text-lg font-semibold truncate mt-0.5">
                {user?.username ?? '—'}
              </div>
            </div>
            <span
              className={
                'text-[11px] uppercase tracking-wider font-semibold px-2 py-1 rounded-full ' +
                (user?.role === 'admin'
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400')
              }
            >
              {user?.role ?? 'member'}
            </span>
          </div>
        </section>

        <form
          action={changePassword}
          className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-5 space-y-4"
        >
          <div>
            <h2 className="font-semibold text-base">Change password</h2>
            <p className="text-xs text-zinc-500 mt-1">
              Minimum 8 characters. You stay signed in after updating.
            </p>
          </div>

          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
              Current password
            </span>
            <input
              name="current"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1 w-full px-3 py-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-[15px]"
            />
          </label>

          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
              New password
            </span>
            <input
              name="new"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="mt-1 w-full px-3 py-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-[15px]"
            />
          </label>

          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
              Confirm new password
            </span>
            <input
              name="confirm"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              className="mt-1 w-full px-3 py-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-[15px]"
            />
          </label>

          {error === 'invalid' && (
            <div className="text-sm text-red-600 dark:text-red-400">
              Current password is incorrect.
            </div>
          )}
          {error === 'mismatch' && (
            <div className="text-sm text-red-600 dark:text-red-400">
              New password and confirmation do not match.
            </div>
          )}
          {error === 'too_short' && (
            <div className="text-sm text-red-600 dark:text-red-400">
              New password must be at least 8 characters.
            </div>
          )}
          {ok === '1' && (
            <div className="text-sm text-emerald-600 dark:text-emerald-400">
              Password updated.
            </div>
          )}

          <button
            type="submit"
            className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-[15px] font-semibold transition"
          >
            Update password
          </button>
        </form>
      </div>
    </div>
  );
}
