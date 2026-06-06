import { NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken, type Session } from '@/lib/auth';
import { db, schema } from '@/db';
import { eq } from 'drizzle-orm';

export function checkAuth(req: Request): NextResponse | null {
  const expected = process.env.MONEY_TRACKER_API_TOKEN;
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'API token not configured on server' },
      { status: 500 },
    );
  }
  const auth = req.headers.get('authorization') ?? '';
  const provided = auth.replace(/^Bearer\s+/i, '');
  if (!provided || provided !== expected) {
    return NextResponse.json(
      { ok: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }
  return null;
}

// Allow same-origin browser requests (the in-app UI) without a Bearer token,
// while still requiring the token for any cross-origin or non-browser caller.
// We treat a request as same-origin when its Origin or Referer points at the
// host that received it. The Host header is set by the platform; an attacker
// cross-origin can't forge Origin/Referer because browsers control them.
export function checkAuthOrSameOrigin(req: Request): NextResponse | null {
  const host = req.headers.get('host');
  const originHeader = req.headers.get('origin');
  const referer = req.headers.get('referer');

  const matchesHost = (raw: string | null): boolean => {
    if (!raw || !host) return false;
    try {
      return new URL(raw).host === host;
    } catch {
      return false;
    }
  };

  if (matchesHost(originHeader) || matchesHost(referer)) return null;
  return checkAuth(req);
}

// Accept either a Bearer token (Luna / scripts) or a valid session cookie
// (browser after login). Used for endpoints that the UI links to directly
// (CSV export, backup download) and that Luna might also call.
export async function checkAuthOrSession(
  req: Request,
): Promise<NextResponse | null> {
  // Try Bearer first.
  const bearerErr = checkAuth(req);
  if (bearerErr === null) return null;

  // Try session cookie. Parse from the raw Cookie header so this works in
  // both route handlers (which have NextRequest) and plain Request.
  const session = await readSessionFromRequest(req);
  if (session) return null;

  return NextResponse.json(
    { ok: false, error: 'Unauthorized' },
    { status: 401 },
  );
}

// Like checkAuthOrSession, but a session cookie only counts when the user
// has the admin role. Bearer-token callers (Luna) are implicitly admin.
// Used for endpoints that should remain admin-only even with multi-user.
export async function checkAuthOrAdminSession(
  req: Request,
): Promise<NextResponse | null> {
  const bearerErr = checkAuth(req);
  if (bearerErr === null) return null;

  const session = await readSessionFromRequest(req);
  if (session && session.role === 'admin') return null;
  if (session) {
    return NextResponse.json(
      { ok: false, error: 'Forbidden' },
      { status: 403 },
    );
  }

  return NextResponse.json(
    { ok: false, error: 'Unauthorized' },
    { status: 401 },
  );
}

// Parse + verify the session cookie from a raw Request, without touching
// next/headers (so this works in plain Request handlers too).
export async function readSessionFromRequest(
  req: Request,
): Promise<Session | null> {
  const cookieHeader = req.headers.get('cookie') ?? '';
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`),
  );
  if (!match) return null;
  return verifySessionToken(decodeURIComponent(match[1]));
}

// Look up the admin user's id. Bearer-token callers (Luna) are treated as
// "the admin user" — this is the userId we attach to their writes / scope
// their reads by. Returns null if no admin row exists (misconfiguration).
export function getAdminUserId(): number | null {
  const row = db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(eq(schema.users.role, 'admin'))
    .orderBy(schema.users.id)
    .get();
  return row?.id ?? null;
}

// Resolve the effective userId for a request:
//   1. Valid session cookie -> session.userId (browser UI).
//   2. Valid Bearer token   -> admin's userId (Luna / scripts).
//   3. Otherwise             -> null (caller should 401).
//
// Returns 'no_admin' as a sentinel when a valid Bearer token is present but
// no admin user exists in the DB — callers should 500 in that case.
export async function resolveUserId(
  req: Request,
): Promise<number | 'no_admin' | null> {
  const session = await readSessionFromRequest(req);
  if (session) return session.userId;

  const expected = process.env.MONEY_TRACKER_API_TOKEN;
  if (expected) {
    const auth = req.headers.get('authorization') ?? '';
    const provided = auth.replace(/^Bearer\s+/i, '');
    if (provided && provided === expected) {
      const adminId = getAdminUserId();
      return adminId ?? 'no_admin';
    }
  }

  return null;
}
