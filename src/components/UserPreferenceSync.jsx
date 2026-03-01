import { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/context/AuthContext';

const SUPPORTED_LANGUAGES = new Set(['en', 'fr', 'nl']);

const normalizeLanguageCode = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return SUPPORTED_LANGUAGES.has(normalized) ? normalized : null;
};

const UserPreferenceSync = () => {
  const { user, updateProfile } = useAuth();
  const { i18n } = useTranslation();
  const isApplyingProfileLanguage = useRef(false);

  useEffect(() => {
    const profileLanguage = normalizeLanguageCode(user?.language_code);
    if (!profileLanguage || i18n.resolvedLanguage === profileLanguage) {
      return;
    }

    isApplyingProfileLanguage.current = true;
    Promise.resolve(i18n.changeLanguage(profileLanguage))
      .catch((error) => {
        console.error('Failed to apply profile language preference:', error);
      })
      .finally(() => {
        isApplyingProfileLanguage.current = false;
      });
  }, [i18n, user?.language_code]);

  useEffect(() => {
    const currentLanguage = normalizeLanguageCode(i18n.resolvedLanguage || i18n.language);
    const profileLanguage = normalizeLanguageCode(user?.language_code);

    if (!user?.id || !currentLanguage || isApplyingProfileLanguage.current || profileLanguage === currentLanguage) {
      return;
    }

    updateProfile({ language_code: currentLanguage }, { silent: true }).catch((error) => {
      console.error('Failed to persist language preference:', error);
    });
  }, [i18n.language, i18n.resolvedLanguage, updateProfile, user?.id, user?.language_code]);

  return null;
};

export default UserPreferenceSync;
