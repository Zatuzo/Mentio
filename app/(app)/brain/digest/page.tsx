import { redirect } from 'next/navigation';
import { getSession } from '@/app/lib/session';
import DigestClient from '@/app/components/brain/DigestClient';

export const dynamic = 'force-dynamic';

export default async function DigestPage() {
  const session = await getSession();
  if (!session) redirect('/login');
  return <DigestClient />;
}
