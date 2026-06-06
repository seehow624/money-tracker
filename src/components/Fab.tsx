'use client';

import Link from 'next/link';
import { Plus } from 'lucide-react';
import { usePathname, useSearchParams } from 'next/navigation';

const HIDDEN_PATHS = ['/transactions/new', '/transactions/edit'];

/** Pages where adding a transaction should return to the same page after save. */
const RETURN_TO_PREFIXES = ['/account/', '/category/', '/paid-by/'];

export function Fab() {
  const pathname = usePathname() ?? '/';
  const searchParams = useSearchParams();
  if (HIDDEN_PATHS.some((p) => pathname.startsWith(p))) return null;

  const params = new URLSearchParams();
  if (RETURN_TO_PREFIXES.some((p) => pathname.startsWith(p))) {
    const qs = searchParams.toString();
    const returnTo = qs ? `${pathname}?${qs}` : pathname;
    params.set('returnTo', returnTo);

    // Pre-fill account when on /account/[id]
    const acctMatch = pathname.match(/^\/account\/(\d+)/);
    if (acctMatch) params.set('accountId', acctMatch[1]);
  }
  const href = params.size > 0 ? `/transactions/new?${params}` : '/transactions/new';

  return (
    <Link
      href={href}
      aria-label="Add transaction"
      className="fixed right-4 z-30 w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 active:scale-95 text-white flex items-center justify-center shadow-lg shadow-emerald-600/40 transition"
      style={{ bottom: 'calc(5rem + env(safe-area-inset-bottom))' }}
    >
      <Plus className="w-7 h-7" strokeWidth={2.5} />
    </Link>
  );
}
