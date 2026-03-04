
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import fr from './locales/fr.json';
import nl from './locales/nl.json';

const SUPPORTED_LANGUAGES = ['en', 'fr', 'nl'];
const LANGUAGE_STORAGE_KEY = 'cashpilot_language';

const normalizeLanguageCode = (value) => {
  const normalized = String(value || '')
    .trim()
    .toLowerCase()
    .replace('_', '-');

  const [baseLanguage] = normalized.split('-');
  return SUPPORTED_LANGUAGES.includes(baseLanguage) ? baseLanguage : 'en';
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      fr: { translation: fr },
      nl: { translation: nl }
    },
    supportedLngs: SUPPORTED_LANGUAGES,
    fallbackLng: 'en',
    load: 'languageOnly',
    cleanCode: true,
    nonExplicitSupportedLngs: true,
    interpolation: {
      escapeValue: false
    },
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
      convertDetectedLanguage: (lng) => normalizeLanguageCode(lng),
    }
  });

if (typeof document !== 'undefined') {
  document.documentElement.lang = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
}

i18n.on('languageChanged', (language) => {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = normalizeLanguageCode(language);
  }
});

export default i18n;
