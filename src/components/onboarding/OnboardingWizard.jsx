import React, { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import Step1Welcome from './steps/Step1Welcome';
import Step2CompanyInfo from './steps/Step2CompanyInfo';
import Step3AccountingPlan from './steps/Step3AccountingPlan';
import Step4OpeningBalances from './steps/Step4OpeningBalances';
import Step5Confirmation from './steps/Step5Confirmation';

const STEPS = [
  { key: 'welcome', labelKey: 'onboarding.steps.welcome', label: 'Bienvenue' },
  { key: 'company', labelKey: 'onboarding.steps.company', label: 'Entreprise' },
  { key: 'plan', labelKey: 'onboarding.steps.plan', label: 'Plan comptable' },
  { key: 'balances', labelKey: 'onboarding.steps.balances', label: 'Soldes' },
  { key: 'confirm', labelKey: 'onboarding.steps.confirm', label: 'Confirmation' },
];

const OnboardingWizard = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const {
    currentStep,
    wizardData,
    updateWizardData,
    nextStep,
    prevStep,
    completeOnboarding,
  } = useOnboarding();

  const handleSkip = useCallback(() => {
    navigate('/app');
  }, [navigate]);

  const handleComplete = useCallback(async () => {
    await completeOnboarding();
    navigate('/app');
  }, [completeOnboarding, navigate]);

  // Keyboard navigation: Escape to skip
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && currentStep < 4) {
        handleSkip();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentStep, handleSkip]);

  const renderStep = () => {
    switch (currentStep) {
      case 0:
        return <Step1Welcome onNext={nextStep} onSkip={handleSkip} />;
      case 1:
        return <Step2CompanyInfo onNext={nextStep} onBack={prevStep} wizardData={wizardData} updateWizardData={updateWizardData} />;
      case 2:
        return <Step3AccountingPlan onNext={nextStep} onBack={prevStep} wizardData={wizardData} updateWizardData={updateWizardData} />;
      case 3:
        return <Step4OpeningBalances onNext={nextStep} onBack={prevStep} wizardData={wizardData} updateWizardData={updateWizardData} />;
      case 4:
        return <Step5Confirmation onComplete={handleComplete} onBack={prevStep} wizardData={wizardData} />;
      default:
        return <Step1Welcome onNext={nextStep} onSkip={handleSkip} />;
    }
  };

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-4 relative overflow-hidden"
      style={{ background: '#0a0e1a' }}
      role="main"
      aria-label={t('onboarding.wizard.ariaLabel', 'Assistant de configuration comptable')}
    >
      {/* Background ambient glows */}
      <div className="absolute top-[-15%] left-[-10%] w-[45%] h-[45%] rounded-full blur-[120px] pointer-events-none" style={{ background: 'rgba(218, 165, 32, 0.08)' }} />
      <div className="absolute bottom-[-15%] right-[-10%] w-[45%] h-[45%] rounded-full blur-[120px] pointer-events-none" style={{ background: 'rgba(34, 197, 94, 0.06)' }} />
      <div className="absolute top-[40%] left-[60%] w-[30%] h-[30%] rounded-full blur-[100px] pointer-events-none" style={{ background: 'rgba(139, 92, 246, 0.05)' }} />

      <div className="relative w-full max-w-2xl z-10">
        {/* Header with animated gradient title */}
        <div className="text-center mb-6">
          <h1 className="text-3xl sm:text-4xl font-bold">
            <span
              className="bg-clip-text text-transparent animate-gradient-shift"
              style={{
                backgroundImage: 'linear-gradient(90deg, #DAA520, #22C55E, #8B5CF6, #DAA520)',
                backgroundSize: '300% 100%',
              }}
            >
              CashPilot
            </span>
          </h1>
          <p className="text-sm mt-1" style={{ color: '#8b92a8' }}>
            {t('onboarding.wizard.subtitle', 'Configuration de votre espace comptable')}
          </p>
        </div>

        {/* Horizontal Stepper */}
        <nav
          aria-label={t('onboarding.wizard.stepperAriaLabel', 'Etapes de configuration')}
          className="flex items-center justify-center gap-1 sm:gap-2 mb-8"
          role="tablist"
        >
          {STEPS.map((step, idx) => {
            const isCompleted = idx < currentStep;
            const isCurrent = idx === currentStep;
            const isFuture = idx > currentStep;

            return (
              <div key={step.key} className="flex items-center gap-1 sm:gap-2">
                <div className="flex flex-col items-center gap-1">
                  <div
                    role="tab"
                    aria-selected={isCurrent}
                    aria-label={`${t(step.labelKey, step.label)} - ${
                      isCompleted
                        ? t('onboarding.wizard.completed', 'Termine')
                        : isCurrent
                          ? t('onboarding.wizard.current', 'En cours')
                          : t('onboarding.wizard.upcoming', 'A venir')
                    }`}
                    tabIndex={isCurrent ? 0 : -1}
                    className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300 ${
                      isCompleted
                        ? 'bg-green-500 text-white shadow-lg shadow-green-500/30'
                        : isCurrent
                          ? 'text-white ring-2 ring-offset-2 ring-offset-[#0a0e1a] shadow-lg'
                          : 'text-gray-600'
                    }`}
                    style={{
                      ...(isCurrent
                        ? { background: 'linear-gradient(135deg, #DAA520, #22C55E)', ringColor: 'rgba(218,165,32,0.5)' }
                        : isFuture
                          ? { background: 'rgba(15, 21, 40, 0.6)', border: '1px solid #1e293b' }
                          : {}),
                    }}
                  >
                    {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                  </div>
                  <span
                    className={`hidden sm:block text-[10px] font-medium transition-colors ${
                      isCurrent ? 'text-[#e8eaf0]' : isCompleted ? 'text-green-400' : 'text-gray-600'
                    }`}
                  >
                    {t(step.labelKey, step.label)}
                  </span>
                </div>
                {idx < STEPS.length - 1 && (
                  <div
                    className={`w-6 sm:w-10 h-0.5 rounded-full transition-all duration-500 mt-[-16px] sm:mt-[-12px] ${
                      isCompleted ? 'bg-green-500' : 'bg-[#1e293b]'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </nav>

        {/* Progress bar */}
        <div className="w-full h-1 rounded-full mb-6 overflow-hidden" style={{ background: 'rgba(30, 41, 59, 0.5)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, #DAA520, #22C55E)' }}
            initial={false}
            animate={{ width: `${((currentStep) / (STEPS.length - 1)) * 100}%` }}
            transition={{ duration: 0.4, ease: 'easeInOut' }}
          />
        </div>

        {/* Step label for mobile */}
        <p className="sm:hidden text-center text-sm mb-4" style={{ color: '#8b92a8' }}>
          {t('onboarding.wizard.stepOf', 'Etape {{current}} sur {{total}}', { current: currentStep + 1, total: STEPS.length })}
          {' - '}
          {t(STEPS[currentStep]?.labelKey, STEPS[currentStep]?.label)}
        </p>

        {/* Step content card - glassmorphism */}
        <div
          className="rounded-2xl shadow-2xl overflow-hidden"
          style={{
            background: 'rgba(15, 21, 40, 0.6)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid #1e293b',
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.25 }}
              className="p-6 sm:p-8"
              role="tabpanel"
              aria-label={t(STEPS[currentStep]?.labelKey, STEPS[currentStep]?.label)}
            >
              {renderStep()}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Skip link */}
        {currentStep < 4 && (
          <div className="text-center mt-4">
            <button
              onClick={handleSkip}
              className="text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-[#DAA520]/50 rounded px-2 py-1"
              style={{ color: '#8b92a8' }}
              onMouseEnter={(e) => { e.target.style.color = '#e8eaf0'; }}
              onMouseLeave={(e) => { e.target.style.color = '#8b92a8'; }}
            >
              {t('onboarding.skipForNow', "Passer pour l'instant")}
            </button>
          </div>
        )}
      </div>

      {/* CSS animation for gradient title */}
      <style>{`
        @keyframes gradient-shift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient-shift {
          animation: gradient-shift 4s ease infinite;
        }
      `}</style>
    </div>
  );
};

export default OnboardingWizard;
