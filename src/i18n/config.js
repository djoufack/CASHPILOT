import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

const SUPPORTED_LANGUAGES = ['en', 'fr', 'nl'];
const LANGUAGE_STORAGE_KEY = 'cashpilot_language';
const RTL_LANGUAGES = new Set(['ar', 'he', 'fa', 'ur']);
const NAMESPACE = 'translation';

const localeLoaders = {
  en: () => import('./locales/en.json'),
  fr: () => import('./locales/fr.json'),
  nl: () => import('./locales/nl.json'),
};

const normalizeLanguageCode = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace('_', '-');

  const [baseLanguage] = normalized.split('-');
  return SUPPORTED_LANGUAGES.includes(baseLanguage) ? baseLanguage : 'en';
};

const localeBackend = {
  type: 'backend',
  read(language, _namespace, callback) {
    const normalizedLanguage = normalizeLanguageCode(language);
    const loadLocale = localeLoaders[normalizedLanguage] || localeLoaders.en;

    loadLocale()
      .then((module) => {
        callback(null, module.default || module);
      })
      .catch((error) => {
        callback(error, false);
      });
  },
};

i18n
  .use(localeBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    supportedLngs: SUPPORTED_LANGUAGES,
    fallbackLng: 'en',
    ns: [NAMESPACE],
    defaultNS: NAMESPACE,
    load: 'languageOnly',
    cleanCode: true,
    nonExplicitSupportedLngs: true,
    partialBundledLanguages: true,
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
    saveMissing: import.meta.env.DEV,
    saveMissingTo: 'all',
    missingKeyHandler: (_lngs, _ns, key) => {
      if (import.meta.env.DEV) {
        console.warn(`[i18n] Missing translation: ${_lngs.join(',')} > ${_ns} > ${key}`);
      }
    },
    parseMissingKeyHandler: (key) => {
      const parts = key.split('.');
      return parts[parts.length - 1];
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
      convertDetectedLanguage: (lng) => normalizeLanguageCode(lng),
    },
  });

if (typeof document !== 'undefined') {
  const lang = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
  document.documentElement.lang = lang;
  document.documentElement.dir = RTL_LANGUAGES.has(lang) ? 'rtl' : 'ltr';
}

i18n.on('languageChanged', (language) => {
  if (typeof document !== 'undefined') {
    const lang = normalizeLanguageCode(language);
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL_LANGUAGES.has(lang) ? 'rtl' : 'ltr';
  }
});

export default i18n;
