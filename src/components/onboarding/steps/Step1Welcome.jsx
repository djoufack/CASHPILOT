import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Sparkles, FileText, PiggyBank } from 'lucide-react';

const Step1Welcome = ({ onNext, onSkip }) => {
  const { t } = useTranslation();

  return (
    <div className="text-center space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-white">
          {t('onboarding.welcome.title', 'Bienvenue sur CashPilot !')}
        </h2>
        <p className="text-gray-400">
          {t('onboarding.welcome.subtitle', 'Nous allons préparer votre espace comptable en quelques minutes.')}
        </p>
      </div>

      <div className="grid gap-4 text-left">
        <div className="flex items-start gap-4 bg-gray-800/50 rounded-xl p-4">
          <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-orange-400" />
          </div>
          <div>
            <h3 className="text-white font-medium text-sm">
              {t('onboarding.welcome.step1', 'Informations de votre entreprise')}
            </h3>
            <p className="text-gray-500 text-xs mt-1">
              {t('onboarding.welcome.step1Desc', 'Nom, adresse, numéro de TVA...')}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 bg-gray-800/50 rounded-xl p-4">
          <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center shrink-0">
            <FileText className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h3 className="text-white font-medium text-sm">
              {t('onboarding.welcome.step2', 'Choix de votre plan comptable')}
            </h3>
            <p className="text-gray-500 text-xs mt-1">
              {t('onboarding.welcome.step2Desc', 'France, Belgique, OHADA ou importez le vôtre.')}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-4 bg-gray-800/50 rounded-xl p-4">
          <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center shrink-0">
            <PiggyBank className="w-5 h-5 text-green-400" />
          </div>
          <div>
            <h3 className="text-white font-medium text-sm">
              {t('onboarding.welcome.step3', 'Vos soldes actuels')}
            </h3>
            <p className="text-gray-500 text-xs mt-1">
              {t('onboarding.welcome.step3Desc', 'Quelques chiffres simples pour démarrer votre comptabilité.')}
            </p>
          </div>
        </div>
      </div>

      <Button
        onClick={onNext}
        className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-3"
      >
        {t('onboarding.welcome.start', 'Commencer')}
      </Button>
    </div>
  );
};

export default Step1Welcome;
