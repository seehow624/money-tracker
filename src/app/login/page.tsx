import { redirect } from 'next/navigation';
import { getServerSession } from '@/lib/auth';
import { login } from './actions';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Sign in',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const session = await getServerSession();
  if (session) redirect(next && next.startsWith('/') ? next : '/');

  return (
    <div className="min-h-screen flex items-center justify-center px-6 bg-gradient-to-br from-zinc-50 to-zinc-100 dark:from-zinc-950 dark:to-zinc-900">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-3xl font-bold tracking-tight">Money Tracker</div>
          <div className="text-sm text-zinc-500 mt-1">Sign in to continue</div>
        </div>
        <form
          action={login}
          className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 p-6 shadow-sm space-y-4"
        >
          <input type="hidden" name="next" value={next ?? '/'} />
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
              Username
            </span>
            <input
              name="username"
              type="text"
              autoComplete="username"
              required
              autoFocus
              className="mt-1 w-full px-3 py-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-[15px]"
            />
          </label>
          <label className="block">
            <span className="text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
              Password
            </span>
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="mt-1 w-full px-3 py-2.5 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 text-[15px]"
            />
          </label>
          {error === 'invalid' && (
            <div className="text-sm text-red-600 dark:text-red-400">
              Invalid username or password.
            </div>
          )}
          <button
            type="submit"
            className="w-full py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white text-[15px] font-semibold transition"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
