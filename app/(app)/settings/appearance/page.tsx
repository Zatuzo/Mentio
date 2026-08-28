'use client';

import { ThemeSwitcher } from '@/components/theme-switcher';
import { LanguageSwitcher } from '@/components/language-switcher';
import { useT } from '@/lib/i18n';
import { Separator } from '@/components/ui/separator';

export default function AppearancePage() {
  const t = useT();

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h3 className="text-lg font-semibold">{t('appearance_title')}</h3>
        <p className="text-sm text-muted-foreground mt-1">{t('appearance_desc')}</p>
      </div>

      <Separator />

      {/* Theme */}
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-semibold">{t('appearance_theme')}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{t('appearance_theme_desc')}</p>
        </div>
        <ThemeSwitcher />
      </div>

      <Separator />

      {/* Language */}
      <div className="space-y-4">
        <div>
          <h4 className="text-sm font-semibold">{t('appearance_language')}</h4>
          <p className="text-xs text-muted-foreground mt-0.5">{t('appearance_language_desc')}</p>
        </div>
        <LanguageSwitcher showFull />
      </div>
    </div>
  );
}
