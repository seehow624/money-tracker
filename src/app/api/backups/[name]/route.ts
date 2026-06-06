import { NextResponse, type NextRequest } from 'next/server';
import fs from 'node:fs';
import path from 'node:path';
import { DB_BACKUPS_DIR } from '@/lib/backup-path';
import { checkAuthOrAdminSession } from '@/lib/api-auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> },
) {
  // DB-level backups contain every user's data — admin-only.
  // Bearer token (Luna) bypasses the role check (implicitly admin); a
  // member session is rejected with 403.
  const unauth = await checkAuthOrAdminSession(req);
  if (unauth) return unauth;

  const { name } = await params;
  if (name.includes('/') || name.includes('\\') || !name.endsWith('.db')) {
    return NextResponse.json({ ok: false, error: 'Invalid name' }, { status: 400 });
  }

  const filePath = path.join(DB_BACKUPS_DIR, name);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ ok: false, error: 'Not found' }, { status: 404 });
  }

  const buf = fs.readFileSync(filePath);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/x-sqlite3',
      'Content-Disposition': `attachment; filename="${name}"`,
      'Content-Length': String(buf.byteLength),
      'Cache-Control': 'no-store',
    },
  });
}
