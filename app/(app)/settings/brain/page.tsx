import { redirect } from 'next/navigation';
import { getSession } from '@/app/lib/session';
import { WebClipperSettings } from '@/app/components/WebClipperSettings';

export const dynamic = 'force-dynamic';

export default async function BrainSettingsPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const baseUrl = process.env.BETTER_AUTH_URL ?? 'https://mentio.space';

  return <WebClipperSettings baseUrl={baseUrl} />;
}
