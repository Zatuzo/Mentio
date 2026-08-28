'use client';

import { useEffect } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app error]', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-6">
      <div className="w-12 h-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center mb-4">
        <AlertTriangle className="h-6 w-6" />
      </div>
      <h2 className="text-2xl font-semibold mb-2">Something went wrong</h2>
      <p className="text-sm text-muted-foreground max-w-md mb-6">
        {error.message || 'An unexpected error occurred while loading this page.'}
        {error.digest && (
          <span className="block mt-2 font-mono text-xs opacity-60">
            ref: {error.digest}
          </span>
        )}
      </p>
      <Button onClick={reset} variant="outline" size="sm">
        <RotateCcw className="h-3.5 w-3.5 mr-2" />
        Try again
      </Button>
    </div>
  );
}
