import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';
import { getSession } from '@/app/lib/session';
import { isR2Configured, uploadToR2, userFolder } from '@/app/lib/r2';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
};

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file' }, { status: 400 });

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());

  if (isR2Configured()) {
    const url = await uploadToR2(buffer, file.type, userFolder(session.user.id));
    return NextResponse.json({ url }, { status: 201 });
  }

  // Fallback: local filesystem
  const userId = session.user.id;
  const filename = `${randomUUID()}.${ext}`;
  const dir = path.join(process.cwd(), 'public', 'uploads', userId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), buffer);
  return NextResponse.json({ url: `/uploads/${userId}/${filename}` }, { status: 201 });
}
