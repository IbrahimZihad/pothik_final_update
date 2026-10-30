import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { translations, LANGUAGES } from './translations';

const LanguageContext = createContext(null);

function resolve(dictionary, key) {
  return key.split('.').reduce((acc, part) => (acc && acc[part] !== undefined ? acc[part] : undefined), dictionary);
}

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('pothik_lang') || 'en');

  const setLang = useCallback((next) => {
    setLangState(next);
    localStorage.setItem('pothik_lang', next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  const value = useMemo(() => {
    const dictionary = translations[lang] || translations.en;
    const fallback = translations.en;
    const t = (key) => {
      const found = resolve(dictionary, key);
      if (found !== undefined) return found;
      const backup = resolve(fallback, key);
      return backup !== undefined ? backup : key;
    };
    return { lang, setLang, t, languages: LANGUAGES, isBangla: lang === 'bn' };
  }, [lang, setLang]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useI18n() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error('useI18n must be used inside LanguageProvider');
  return context;
}

export const useLanguage = useI18n;
