import { AppBar } from '@/components/AppBar';
import { db, schema } from '@/db';
import { eq, sql, asc } from 'drizzle-orm';
import { requireAdmin } from '@/lib/auth';
import { AlertCircle, CheckCircle2, ShieldCheck, User as UserIcon, Trash2, KeyRound } from 'lucide-react';
import { createUser, deleteUser, resetPassword } from './actions';

export const dynamic = 'force-dynamic';

const ERROR_MESSAGES: Record<string, string> = {
  exists: 'Username already taken.',
  too_short: 'Password must be at least 8 characters.',
  self_delete: 'You cannot delete your own account.',
  missing_username: 'Username is required.',
  bad_id: 'Invalid user id.',
  not_found: 'User not found.',
};

const OK_MESSAGES: Record<string, string> = {
  reset: 'Password reset.',
};

type UserRow = {
  id: number;
  username: string;
  role: 'admin' | 'member';
  createdAt: string;
};

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; ok?: string }>;
}) {
  const session = await requireAdmin();
  const params = await searchParams;
  const errorMsg = params.error ? ERROR_MESSAGES[params.error] ?? null : null;
  const okMsg = params.ok ? OK_MESSAGES[params.ok] ?? null : null;

  const users = db
    .select({
      id: schema.users.id,
      username: schema.users.username,
      role: schema.users.role,
      createdAt: schema.users.createdAt,
    })
    .from(schema.users)
    .orderBy(asc(schema.users.id))
    .all() as UserRow[];

  const txnCounts = new Map<number, number>();
  const counts = db
    .select({
      userId: schema.transactions.userId,
      n: sql<number>`COUNT(*)`,
    })
    .from(schema.transactions)
    .groupBy(schema.transactions.userId)
    .all();
  for (const c of counts) txnCounts.set(c.userId, c.n ?? 0);

  return (
    <div>
      <AppBar title="Users" back={{ href: '/more', label: 'More' }} />

      <div className="max-w-3xl mx-auto px-4 pt-2 pb-32 min-h-[calc(100vh-3.5rem)]">
        {errorMsg && (
          <div className="mb-3 p-3 rounded-lg text-sm flex items-center gap-2 bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="break-words">{errorMsg}</span>
          </div>
        )}
        {okMsg && (
          <div className="mb-3 p-3 rounded-lg text-sm flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="break-words">{okMsg}</span>
          </div>
        )}

        <Section title="Users">
          {users.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-zinc-500">
              No users yet.
            </div>
          ) : (
            users.map((u, i) => {
              const isSelf = u.id === session.userId;
              const count = txnCounts.get(u.id) ?? 0;
              const created = formatDate(u.createdAt);
              return (
                <div
                  key={u.id}
                  className={
                    'px-5 py-3.5 ' +
                    (i === users.length - 1
                      ? ''
                      : 'border-b border-zinc-100 dark:border-zinc-800')
                  }
                >
                  <div className="flex items-center gap-3">
                    <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 bg-zinc-100 dark:bg-zinc-800">
                      {u.role === 'admin' ? (
                        <ShieldCheck className="w-4 h-4 text-tangerine" strokeWidth={2} />
                      ) : (
                        <UserIcon className="w-4 h-4 text-zinc-500" strokeWidth={2} />
                      )}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">
                          {u.username}
                        </span>
                        <RoleBadge role={u.role} />
                        {isSelf && (
                          <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 font-semibold">
                            You
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-zinc-500 mt-0.5 tabular-nums">
                        {count.toLocaleString()} txn{count === 1 ? '' : 's'}
                        {created && <> · joined {created}</>}
                      </div>
                    </div>
                    {!isSelf && (
                      <form action={deleteUser}>
                        <input type="hidden" name="id" value={u.id} />
                        <button
                          type="submit"
                          className="p-2 text-rose-500 active:bg-rose-50 dark:active:bg-rose-950/40 rounded-lg"
                          aria-label={`Delete ${u.username}`}
                        >
                          <Trash2 className="w-4 h-4" strokeWidth={1.6} />
                        </button>
                      </form>
                    )}
                  </div>

                  <details className="group mt-2">
                    <summary className="list-none cursor-pointer text-[11px] text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 flex items-center gap-1 select-none">
                      <KeyRound className="w-3 h-3" strokeWidth={2} />
                      <span className="group-open:hidden">Reset password</span>
                      <span className="hidden group-open:inline">Cancel</span>
                    </summary>
                    <form action={resetPassword} className="mt-2 flex gap-2">
                      <input type="hidden" name="id" value={u.id} />
                      <input
                        type="text"
                        name="password"
                        required
                        minLength={8}
                        placeholder="New password (min 8 chars)"
                        autoComplete="new-password"
                        spellCheck={false}
                        className="flex-1 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-tangerine/50"
                      />
                      <button
                        type="submit"
                        className="px-3 py-1.5 rounded-lg bg-tangerine text-white text-sm font-medium active:opacity-80"
                      >
                        Save
                      </button>
                    </form>
                  </details>
                </div>
              );
            })
          )}
        </Section>

        <Section title="Add user">
          <form action={createUser} className="px-5 py-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Username
              </label>
              <input
                type="text"
                name="username"
                required
                autoComplete="off"
                spellCheck={false}
                autoCapitalize="none"
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-tangerine/50"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Role
              </label>
              <select
                name="role"
                defaultValue="member"
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm focus:outline-none focus:ring-2 focus:ring-tangerine/50"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
                Password
              </label>
              <input
                type="text"
                name="password"
                required
                minLength={8}
                autoComplete="new-password"
                spellCheck={false}
                placeholder="min 8 characters"
                className="w-full px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-tangerine/50"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-semibold rounded-xl py-2.5 transition text-sm"
            >
              Create user
            </button>
          </form>
        </Section>

        <p className="text-[11px] text-zinc-500 mt-6 leading-relaxed px-2">
          Deleting a user permanently removes all their transactions, accounts,
          categories, budgets, and scheduled rules. This cannot be undone.
        </p>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div className="px-2 pt-5 pb-2 text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
        {title}
      </div>
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 overflow-hidden">
        {children}
      </div>
    </>
  );
}

function RoleBadge({ role }: { role: 'admin' | 'member' }) {
  if (role === 'admin') {
    return (
      <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-tangerine/15 text-tangerine font-semibold">
        Admin
      </span>
    );
  }
  return (
    <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-semibold">
      Member
    </span>
  );
}

function formatDate(raw: string | null | undefined): string {
  if (!raw) return '';
  // raw is typically "YYYY-MM-DD HH:MM:SS" from sqlite CURRENT_TIMESTAMP
  return raw.slice(0, 10);
}
