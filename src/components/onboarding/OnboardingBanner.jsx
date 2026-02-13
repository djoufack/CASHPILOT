import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useOnboarding } from '@/hooks/useOnboarding';
import { ArrowRight, X, Settings2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const OnboardingBanner = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { loading, onboardingCompleted, currentStep } = useOnboarding();
  const [dismissed, setDismissed] = useState(() => {
    return sessionStorage.getItem('onboarding_banner_dismissed') === 'true';
  });

  if (loading || onboardingCompleted || dismissed) return null;

  const handleDismiss = () => {
    sessionStorage.setItem('onboarding_banner_dismissed', 'true');
    setDismissed(true);
  };

  const handleResume = () => {
    navigate('/app/onboarding');
  };

  // Map step number to human-readable label
  const stepLabels = [
    t('onboarding.steps.welcome', 'Bienvenue'),
    t('onboarding.steps.company', 'Entreprise'),
    t('onboarding.steps.plan', 'Plan comptable'),
    t('onboarding.steps.balances', 'Soldes'),
    t('onboarding.steps.confirm', 'Confirmation'),
  ];
  const currentStepLabel = stepLabels[currentStep] || stepLabels[0];

  return (
    <div
      className="relative overflow-hidden"
      role="banner"
      aria-label={t('onboarding.banner.ariaLabel', 'Configuration de la comptabilite')}
    >
      {/* Animated gradient border at top */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px]"
        style={{
          background: 'linear-gradient(90deg, #DAA520, #22C55E, #8B5CF6, #DAA520)',
          backgroundSize: '300% 100%',
          animation: 'gradient-border-shift 4s ease infinite',
        }}
      />

      {/* Banner body - glassmorphism */}
      <div
        className="px-4 py-3"
        style={{
          background: 'rgba(15, 21, 40, 0.6)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: '1px solid rgba(218, 165, 32, 0.15)',
        }}
      >
        <div className="flex items-center justify-between max-w-7xl mx-auto gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: 'rgba(218, 165, 32, 0.15)' }}
            >
              <Settings2 className="w-4 h-4" style={{ color: '#DAA520' }} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: '#e8eaf0' }}>
                {t('onboarding.banner.title', 'Finalisez la configuration de votre comptabilite')}
              </p>
              <p className="text-xs hidden sm:block" style={{ color: '#8b92a8' }}>
                {t('onboarding.banner.stepInfo', 'Etape en cours : {{step}}', { step: currentStepLabel })}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              onClick={handleResume}
              className="text-white text-xs h-7 px-3 font-medium focus:ring-2 focus:ring-offset-1 focus:ring-[#DAA520]"
              style={{ background: 'linear-gradient(135deg, #DAA520, #22C55E)' }}
            >
              {t('onboarding.banner.resume', 'Reprendre')} <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
            <button
              onClick={handleDismiss}
              className="p-1 rounded transition-colors focus:outline-none focus:ring-1 focus:ring-[#DAA520]/50"
              style={{ color: 'rgba(139, 146, 168, 0.6)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#e8eaf0'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(139, 146, 168, 0.6)'; }}
              aria-label={t('onboarding.banner.dismiss', 'Fermer temporairement')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* CSS for animated gradient border */}
      <style>{`
        @keyframes gradient-border-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
    </div>
  );
};

export default OnboardingBanner;
