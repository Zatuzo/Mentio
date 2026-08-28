import { getSession } from '@/app/lib/session';
import { prisma } from '@/app/lib/db';
import { notFound } from 'next/navigation';
import nextDynamic from 'next/dynamic';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

const CanvasEditor = nextDynamic(
  () => import('@/app/components/CanvasEditor').then((m) => m.CanvasEditor),
  { ssr: false },
);

interface Props {
  params: { id: string };
  searchParams: { token?: string };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const canvas = await prisma.canvas.findUnique({
    where: { id: params.id },
    select: { name: true },
  });
  return { title: canvas?.name ?? 'Canvas' };
}

export default async function CanvasViewPage({ params, searchParams }: Props) {
  const canvas = await prisma.canvas.findUnique({
    where: { id: params.id },
    select: { id: true, name: true, ownerId: true, shareToken: true, entityId: true },
  });
  if (!canvas) notFound();

  const session = await getSession();
  const isOwner = !!session && session.user.id === canvas.ownerId;
  const hasToken = !!canvas.shareToken && searchParams.token === canvas.shareToken;

  // Access: owner always, or valid shareToken
  if (!isOwner && !hasToken) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
        Link ini tidak valid atau sudah tidak aktif.
      </div>
    );
  }

  const currentUser = session
    ? { id: session.user.id, name: session.user.name }
    : { id: `guest-${Math.random().toString(36).slice(2, 8)}`, name: 'Guest' };

  return (
    <div className="-m-6 md:-m-8 overflow-hidden" style={{ height: 'calc(100vh - 3.5rem)' }}>
      <CanvasEditor
        canvasId={canvas.id}
        entityId={canvas.entityId}
        name={canvas.name ?? 'Untitled Canvas'}
        isOwner={isOwner}
        shareToken={canvas.shareToken}
        currentUser={currentUser}
      />
    </div>
  );
}
