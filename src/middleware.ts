import { NextResponse, type NextRequest } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/auth';

export const config = {
  matcher: [
    // Run on everything except Next internals, the manifest, and image assets.
    '/((?!_next/|favicon\\.ico|icon\\.png|apple-icon\\.png|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml).*)',
  ],
};

const ADMIN_ONLY_RE = /^\/more\/(ai|reminders|admin|backup)(\/|$)/;

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // /api/* handles its own auth (Bearer token for Luna; cookie-or-Bearer for
  // export and backups via checkAuthOrSession). Don't redirect API callers to
  // an HTML login page.
  if (pathname.startsWith('/api/')) return NextResponse.next();

  if (pathname === '/login') return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const session = await verifySessionToken(token);
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = '/login';
    url.search = '';
    if (pathname !== '/')
      url.searchParams.set('next', pathname + req.nextUrl.search);
    return NextResponse.redirect(url);
  }

  if (ADMIN_ONLY_RE.test(pathname) && session.role !== 'admin') {
    const url = req.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}
