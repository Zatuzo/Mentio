'use client';

import { useLang, useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const LANGUAGES = [
  { code: 'en' as const, label: 'EN', fullLabel: 'lang_en' as const, flag: '🇬🇧' },
  { code: 'id' as const, label: 'ID', fullLabel: 'lang_id' as const, flag: '🇮🇩' },
];

export function LanguageSwitcher({ showFull = false }: { showFull?: boolean }) {
  const { lang, setLang } = useLang();
  const t = useT();

  return (
    <div className="flex gap-2">
      {LANGUAGES.map((lng) => {
        const active = lang === lng.code;
        return (
          <button
            key={lng.code}
            onClick={() => setLang(lng.code)}
            className={cn(
              'flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors border',
              active
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-transparent text-muted-foreground border-border hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <span>{lng.flag}</span>
            <span>{showFull ? t(lng.fullLabel) : lng.label}</span>
          </button>
        );
      })}
    </div>
  );
}
