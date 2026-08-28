import { getSession } from '@/app/lib/session';
import { redirect } from 'next/navigation';
import { CanvasDashboard } from '@/app/components/CanvasDashboard';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Canvas' };

export default async function CanvasPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  return <CanvasDashboard />;
}
