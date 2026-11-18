import type { Language } from './i18n.ts';

export type Preferences = { language: Language; theme: 'system' | 'light' | 'dark' };
export const defaultPreferences: Preferences = { language: 'zh', theme: 'system' };
export function parsePreferences(value: string | null): Preferences {
  try {
    const parsed: unknown = JSON.parse(value ?? 'null');
    if (parsed && typeof parsed === 'object' && 'language' in parsed && 'theme' in parsed) {
      const { language, theme } = parsed;
      if ((language === 'zh' || language === 'en') && (theme === 'system' || theme === 'light' || theme === 'dark')) return { language, theme };
    }
  } catch { /* Invalid local preferences use defaults, never block startup. */ }
  return { ...defaultPreferences };
}
