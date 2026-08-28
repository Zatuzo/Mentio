import { redirect } from 'next/navigation';
import { getSession } from '@/app/lib/session';
import { KnowledgeGraph } from '@/app/components/brain/KnowledgeGraph';

export const dynamic = 'force-dynamic';

export default async function GraphPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  return (
    // Escape content padding (-m-6 md:-m-8) and fill viewport below sticky header (h-14 = 3.5rem)
    <div className="-m-6 md:-m-8 overflow-hidden" style={{ height: 'calc(100vh - 3.5rem)' }}>
      <KnowledgeGraph />
    </div>
  );
}
