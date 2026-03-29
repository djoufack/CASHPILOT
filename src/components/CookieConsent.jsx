import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Cookie } from 'lucide-react';
import { initializeErrorTracking } from '@/services/errorTracking';

const COOKIE_CONSENT_KEY = 'cookie-consent';

/**
 * Returns the current cookie consent value: 'accepted' | 'refused' | null
 */
export const getCookieConsent = () => {
  try {
    return localStorage.getItem(COOKIE_CONSENT_KEY);
  } catch {
    return null;
  }
};

const CookieConsent = () => {
  const { t } = useTranslation();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = getCookieConsent();
    if (consent === null) {
      setVisible(true);
    }
  }, []);

  // Listen for custom event to re-show the banner (from footer link)
  useEffect(() => {
    const handler = () => setVisible(true);
    window.addEventListener('show-cookie-consent', handler);
    return () => window.removeEventListener('show-cookie-consent', handler);
  }, []);

  const handleAccept = useCallback(() => {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, 'accepted');
    } catch {
      // localStorage full, continue
    }
    // Initialize Sentry now that consent is given
    initializeErrorTracking();
    setVisible(false);
  }, []);

  const handleRefuse = useCallback(() => {
    try {
      localStorage.setItem(COOKIE_CONSENT_KEY, 'refused');
    } catch {
      // localStorage full, continue
    }
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[9999] p-4 sm:p-6"
      role="region"
      aria-label={t('cookies.banner.title')}
    >
      <div
        className="max-w-3xl mx-auto rounded-2xl border border-white/10 shadow-2xl"
        style={{
          background: 'rgba(15, 21, 40, 0.95)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        <div className="p-4 sm:p-6">
          <div className="flex items-start gap-3 sm:gap-4">
            <div className="shrink-0 mt-0.5">
              <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                <Cookie className="w-5 h-5 text-orange-400" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-base sm:text-lg font-semibold text-white mb-1">
                {t('cookies.banner.title')}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {t('cookies.banner.description')}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">
            <button
              onClick={handleRefuse}
              className="px-4 py-2 text-sm font-medium rounded-lg border border-gray-600 text-gray-300 hover:bg-gray-800/50 hover:text-white transition-colors"
              aria-label={t('cookies.banner.refuse')}
            >
              {t('cookies.banner.refuse')}
            </button>
            <button
              onClick={handleAccept}
              className="px-4 py-2 text-sm font-medium rounded-lg bg-orange-500 hover:bg-orange-600 text-white transition-colors"
              aria-label={t('cookies.banner.accept')}
            >
              {t('cookies.banner.accept')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CookieConsent;
