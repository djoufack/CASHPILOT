import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useOnboarding } from '@/hooks/useOnboarding';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Step1Welcome from './steps/Step1Welcome';
import Step2CompanyInfo from './steps/Step2CompanyInfo';
import Step3AccountingPlan from './steps/Step3AccountingPlan';
import Step4OpeningBalances from './steps/Step4OpeningBalances';
import Step5Confirmation from './steps/Step5Confirmation';

const STEPS = [
  { key: 'welcome', label: 'Bienvenue' },
  { key: 'company', label: 'Entreprise' },
  { key: 'plan', label: 'Plan comptable' },
  { key: 'balances', label: 'Soldes' },
  { key: 'confirm', label: 'Confirmation' },
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

  const handleSkip = () => {
    navigate('/app');
  };

  const handleComplete = async () => {
    await completeOnboarding();
    navigate('/app');
  };

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
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-orange-900/20 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-amber-900/20 rounded-full blur-[100px]" />

      <div className="relative w-full max-w-2xl z-10">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold">
            <span className="text-orange-400">Cash</span><span className="text-white">Pilot</span>
          </h1>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((step, idx) => (
            <div key={step.key} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                idx < currentStep
                  ? 'bg-green-500 text-white'
                  : idx === currentStep
                    ? 'bg-orange-500 text-white ring-2 ring-orange-400/50'
                    : 'bg-gray-800 text-gray-500'
              }`}>
                {idx < currentStep ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
              </div>
              {idx < STEPS.length - 1 && (
                <div className={`w-8 h-0.5 ${idx < currentStep ? 'bg-green-500' : 'bg-gray-800'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step label */}
        <p className="text-center text-sm text-gray-400 mb-4">
          {t(`onboarding.steps.${STEPS[currentStep]?.key}`, STEPS[currentStep]?.label)}
        </p>

        {/* Step content */}
        <div className="bg-gray-900/80 backdrop-blur-xl rounded-2xl shadow-2xl border border-gray-800/50 overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="p-8"
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
              className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
            >
              {t('onboarding.skipForNow', 'Passer pour l\'instant')}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default OnboardingWizard;
