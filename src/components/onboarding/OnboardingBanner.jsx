import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useOnboarding } from '@/hooks/useOnboarding';
import { AlertCircle, ArrowRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

const OnboardingBanner = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { loading, onboardingCompleted } = useOnboarding();
  const [dismissed, setDismissed] = useState(() => {
    return sessionStorage.getItem('onboarding_banner_dismissed') === 'true';
  });

  if (loading || onboardingCompleted || dismissed) return null;

  const handleDismiss = () => {
    sessionStorage.setItem('onboarding_banner_dismissed', 'true');
    setDismissed(true);
  };

  return (
    <div className="bg-orange-500/10 border-b border-orange-500/30 px-4 py-3">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        <div className="flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-orange-400 shrink-0" />
          <p className="text-sm text-orange-200">
            {t('onboarding.banner.message', 'Votre comptabilité n\'est pas encore configurée.')}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => navigate('/app/onboarding')}
            className="bg-orange-500 hover:bg-orange-600 text-white text-xs h-7 px-3"
          >
            {t('onboarding.banner.action', 'Configurer')} <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
          <button
            onClick={handleDismiss}
            className="text-orange-400/60 hover:text-orange-300 p-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default OnboardingBanner;
