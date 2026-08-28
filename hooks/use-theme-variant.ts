'use client';

import { useTheme } from 'next-themes';

export type ThemeVariant = 'default' | 'brutalism';

export function useThemeVariant(): ThemeVariant {
  const { resolvedTheme } = useTheme();
  return resolvedTheme === 'brutalism' ? 'brutalism' : 'default';
}
