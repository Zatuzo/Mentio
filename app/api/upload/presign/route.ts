import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { isR2Configured, presignUpload, userFolder } from '@/app/lib/r2';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/gif', 'image/webp']);

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!isR2Configured()) {
    return NextResponse.json({ error: 'R2 not configured' }, { status: 501 });
  }

  const { mimeType } = await req.json();
  if (!ALLOWED_TYPES.has(mimeType)) {
    return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
  }

  const { uploadUrl, publicUrl } = await presignUpload(
    mimeType,
    userFolder(session.user.id)
  );

  return NextResponse.json({ uploadUrl, publicUrl });
}
