import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Language, MaterialCategory } from '../data/models';
import { getDB, getSetting, setSetting } from '../data/db';
import { CATEGORY_NAMES, SPEECH_LANG, translate, type StringKey } from './strings';

interface I18n {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: StringKey, vars?: Record<string, string | number>) => string;
  categoryName: (c: MaterialCategory) => string;
  formatNumber: (n: number, maxFractionDigits?: number) => string;
  formatDateTime: (ms: number) => string;
}

const I18nContext = createContext<I18n | null>(null);

export function I18nProvider({ children, initial = 'hi' }: { children: ReactNode; initial?: Language }) {
  const [lang, setLangState] = useState<Language>(initial);

  useEffect(() => {
    void getSetting<Language>('language').then((saved) => saved && setLangState(saved));
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((next: Language) => {
    setLangState(next);
    void setSetting('language', next);
    // Keep the collector profile's preferredLanguage in step.
    void (async () => {
      const id = await getSetting<string>('collectorId');
      if (!id) return;
      const db = await getDB();
      const profile = await db.get('collectors', id);
      if (profile) await db.put('collectors', { ...profile, preferredLanguage: next });
    })();
  }, []);

  const value = useMemo<I18n>(() => {
    const locale = SPEECH_LANG[lang];
    return {
      lang,
      setLang,
      t: (key, vars) => translate(lang, key, vars),
      categoryName: (c) => CATEGORY_NAMES[lang][c],
      formatNumber: (n, maxFractionDigits = 0) =>
        new Intl.NumberFormat(locale, { maximumFractionDigits: maxFractionDigits }).format(n),
      formatDateTime: (ms) =>
        new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms)),
    };
  }, [lang, setLang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18n {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
