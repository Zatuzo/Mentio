import './globals.css';
import type { ReactNode } from 'react';
import { Providers } from './providers';
import { Toaster } from '@/components/ui/sonner';
import { Plus_Jakarta_Sans } from 'next/font/google';
import { cn } from '@/lib/utils';

const inter = Plus_Jakarta_Sans({ subsets: ['latin'], variable: '--font-sans', weight: ['400', '500', '600', '700'] });

export const metadata = {
  title: 'Mentio',
  description: 'Capture WhatsApp mentions. Turn them into tasks.',
};

// Bare root layout — the sidebar belongs to the (app) route group, so auth
// pages (/login, /register) render clean here with no app chrome.
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable} suppressHydrationWarning>
      <body className="overflow-x-hidden">
        <Providers>{children}</Providers>
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: 'bg-card border border-border text-foreground text-sm shadow-lg',
              description: 'text-muted-foreground',
              success: 'border-border',
              error: 'border-destructive/40',
              icon: 'text-foreground',
            },
          }}
        />
      </body>
    </html>
  );
}
