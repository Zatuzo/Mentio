/** Instruction line injected into AI prompts to force a language, or '' for "auto" (mirror input). */
export function aiLanguageInstruction(lang: string | null | undefined): string {
  if (lang === 'id') return 'Respond in Indonesian (Bahasa Indonesia), regardless of the input language.';
  if (lang === 'en') return 'Respond in English, regardless of the input language.';
  return '';
}
