import type { ReactNode } from 'react';

export const dynamic = 'force-dynamic';

export default function HubLayout({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[#0b0e14] text-[#e6e9ef]">{children}</div>;
}
