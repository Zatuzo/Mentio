import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';
import { decryptText } from '@/app/lib/crypto';
import { classifyMessage } from '@/app/lib/watsonx';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Manual trigger for the watsonx classification the listener normally does
// automatically on ingest — useful for re-tagging an older mention, or for
// verifying the integration is wired up correctly without the listener running.
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const mention = await prisma.mention.findUnique({ where: { id: params.id } });
  if (!mention || mention.userId !== session.user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const category = await classifyMessage(decryptText(mention.text));
  if (!category) {
    return NextResponse.json({ error: 'watsonx not configured or classification failed' }, { status: 503 });
  }

  const updated = await prisma.mention.update({ where: { id: mention.id }, data: { category } });
  return NextResponse.json({ id: updated.id, category: updated.category });
}
