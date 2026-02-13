import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGDPR } from '@/hooks/useGDPR';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Shield, X, Settings2, Cookie } from 'lucide-react';

const GDPRConsentBanner = () => {
  const { t } = useTranslation();
  const { consentStatus, saveConsent, hasConsented, loading } = useGDPR();
  const [visible, setVisible] = useState(false);
  const [showCustomize, setShowCustomize] = useState(false);
  const [localConsent, setLocalConsent] = useState({
    necessary: true,
    cookies: false,
    analytics: false,
    marketing: false,
  });

  useEffect(() => {
    if (!loading && !hasConsented()) {
      setVisible(true);
    }
  }, [loading, hasConsented]);

  useEffect(() => {
    setLocalConsent({
      necessary: true,
      cookies: consentStatus.cookies || false,
      analytics: consentStatus.analytics || false,
      marketing: consentStatus.marketing || false,
    });
  }, [consentStatus]);

  const handleAcceptAll = () => {
    const allAccepted = {
      necessary: true,
      cookies: true,
      analytics: true,
      marketing: true,
    };
    saveConsent(allAccepted);
    setVisible(false);
  };

  const handleRejectAll = () => {
    const allRejected = {
      necessary: true,
      cookies: false,
      analytics: false,
      marketing: false,
    };
    saveConsent(allRejected);
    setVisible(false);
  };

  const handleSaveCustom = () => {
    saveConsent(localConsent);
    setVisible(false);
    setShowCustomize(false);
  };

  if (!visible) return null;

  return (
    <>
      {/* Backdrop overlay for customize modal */}
      {showCustomize && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9998]"
          onClick={() => setShowCustomize(false)}
          aria-hidden="true"
        />
      )}

      {/* Banner */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[9999] p-4 sm:p-6"
        role="dialog"
        aria-label={t('gdpr.banner.title')}
        aria-modal="false"
      >
        <div
          className="max-w-4xl mx-auto rounded-2xl border border-gray-700/50 shadow-2xl"
          style={{
            background: 'rgba(15, 21, 40, 0.95)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          {/* Main banner content */}
          {!showCustomize ? (
            <div className="p-4 sm:p-6">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="shrink-0 mt-0.5">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                    <Cookie className="w-5 h-5 text-orange-400" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-base sm:text-lg font-semibold text-white mb-1">
                    {t('gdpr.banner.title')}
                  </h3>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    {t('gdpr.banner.description')}
                  </p>
                </div>
              </div>

              {/* Buttons */}
              <div className="mt-4 flex flex-col sm:flex-row gap-2 sm:gap-3 sm:justify-end">
                <Button
                  variant="ghost"
                  className="text-gray-400 hover:text-white hover:bg-gray-800/50 order-3 sm:order-1"
                  onClick={() => setShowCustomize(true)}
                  aria-label={t('gdpr.banner.customize')}
                >
                  <Settings2 className="w-4 h-4 mr-2" />
                  {t('gdpr.banner.customize')}
                </Button>
                <Button
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-800/50 hover:text-white order-2 sm:order-2"
                  onClick={handleRejectAll}
                  aria-label={t('gdpr.banner.rejectAll')}
                >
                  {t('gdpr.banner.rejectAll')}
                </Button>
                <Button
                  className="bg-orange-500 hover:bg-orange-600 text-white font-medium order-1 sm:order-3"
                  onClick={handleAcceptAll}
                  aria-label={t('gdpr.banner.acceptAll')}
                >
                  {t('gdpr.banner.acceptAll')}
                </Button>
              </div>
            </div>
          ) : (
            /* Customize panel */
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/10 flex items-center justify-center">
                    <Shield className="w-5 h-5 text-orange-400" />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold text-white">
                    {t('gdpr.banner.customize')}
                  </h3>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-gray-400 hover:text-white"
                  onClick={() => setShowCustomize(false)}
                  aria-label={t('common.cancel')}
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="space-y-4">
                {/* Necessary - always on */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800/40 border border-gray-700/30">
                  <div className="flex-1 mr-4">
                    <p className="text-sm font-medium text-white">
                      {t('gdpr.categories.necessary')}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t('gdpr.categories.necessaryDesc')}
                    </p>
                  </div>
                  <Switch
                    checked={true}
                    disabled
                    aria-label={t('gdpr.categories.necessary')}
                    className="data-[state=checked]:bg-green-600 opacity-60"
                  />
                </div>

                {/* Analytics */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800/40 border border-gray-700/30">
                  <div className="flex-1 mr-4">
                    <p className="text-sm font-medium text-white">
                      {t('gdpr.categories.analytics')}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t('gdpr.categories.analyticsDesc')}
                    </p>
                  </div>
                  <Switch
                    checked={localConsent.analytics}
                    onCheckedChange={(checked) =>
                      setLocalConsent((prev) => ({ ...prev, analytics: checked }))
                    }
                    aria-label={t('gdpr.categories.analytics')}
                    className="data-[state=checked]:bg-orange-500"
                  />
                </div>

                {/* Marketing */}
                <div className="flex items-center justify-between p-3 rounded-lg bg-gray-800/40 border border-gray-700/30">
                  <div className="flex-1 mr-4">
                    <p className="text-sm font-medium text-white">
                      {t('gdpr.categories.marketing')}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {t('gdpr.categories.marketingDesc')}
                    </p>
                  </div>
                  <Switch
                    checked={localConsent.marketing}
                    onCheckedChange={(checked) =>
                      setLocalConsent((prev) => ({ ...prev, marketing: checked }))
                    }
                    aria-label={t('gdpr.categories.marketing')}
                    className="data-[state=checked]:bg-orange-500"
                  />
                </div>
              </div>

              {/* Save / back buttons */}
              <div className="mt-5 flex flex-col sm:flex-row gap-2 sm:justify-end">
                <Button
                  variant="outline"
                  className="border-gray-600 text-gray-300 hover:bg-gray-800/50 hover:text-white"
                  onClick={() => setShowCustomize(false)}
                >
                  {t('common.cancel')}
                </Button>
                <Button
                  className="bg-orange-500 hover:bg-orange-600 text-white font-medium"
                  onClick={handleSaveCustom}
                >
                  {t('common.save')}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default GDPRConsentBanner;
