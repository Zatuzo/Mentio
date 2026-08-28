import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getSession } from '@/app/lib/session';
import { BrainSearchClient } from '@/app/components/brain/BrainSearchClient';

export const dynamic = 'force-dynamic';

export default async function BrainSearchPage({ searchParams }: { searchParams: { q?: string } }) {
  const session = await getSession();
  if (!session) redirect('/login');

  return <BrainSearchClient initialQuery={searchParams.q ?? ''} />;
}
