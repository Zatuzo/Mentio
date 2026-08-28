'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { en, type TranslationKey } from './locales/en';
import { id } from './locales/id';

type Lang = 'en' | 'id';

const STORAGE_KEY = 'mentio-lang';
const COOKIE_KEY = 'mentio-lang';

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'en',
  setLang: () => {},
  t: (key) => en[key],
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>('en');

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY) as Lang | null;
    if (saved === 'en' || saved === 'id') {
      setLangState(saved);
    }
  }, []);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    localStorage.setItem(STORAGE_KEY, l);
    document.cookie = `${COOKIE_KEY}=${l}; path=/; max-age=31536000; SameSite=Lax`;
  }, []);

  const t = useCallback(
    (key: TranslationKey): string => {
      const dict = lang === 'id' ? id : en;
      return dict[key] ?? en[key] ?? key;
    },
    [lang]
  );

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export function useT() {
  return useContext(I18nContext).t;
}

export function useLang() {
  const { lang, setLang } = useContext(I18nContext);
  return { lang, setLang };
}
