import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Sparkles, FileText, PiggyBank, Rocket, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';

const FEATURES = [
  {
    icon: Sparkles,
    color: '#DAA520',
    bgColor: 'rgba(218, 165, 32, 0.15)',
    titleKey: 'onboarding.welcome.step1',
    titleDefault: 'Informations de votre entreprise',
    descKey: 'onboarding.welcome.step1Desc',
    descDefault: 'Nom, adresse, numero de TVA...',
  },
  {
    icon: FileText,
    color: '#3B82F6',
    bgColor: 'rgba(59, 130, 246, 0.15)',
    titleKey: 'onboarding.welcome.step2',
    titleDefault: 'Choix de votre plan comptable',
    descKey: 'onboarding.welcome.step2Desc',
    descDefault: 'France, Belgique, OHADA ou importez le votre.',
  },
  {
    icon: PiggyBank,
    color: '#22C55E',
    bgColor: 'rgba(34, 197, 94, 0.15)',
    titleKey: 'onboarding.welcome.step3',
    titleDefault: 'Vos soldes actuels',
    descKey: 'onboarding.welcome.step3Desc',
    descDefault: 'Quelques chiffres simples pour demarrer votre comptabilite.',
  },
];

const containerVariants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const Step1Welcome = ({ onNext }) => {
  const { t } = useTranslation();

  return (
    <div className="text-center space-y-6" role="region" aria-label={t('onboarding.welcome.title', 'Bienvenue sur CashPilot !')}>
      {/* Illustration icon */}
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, type: 'spring', stiffness: 200 }}
        className="mx-auto w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: 'linear-gradient(135deg, rgba(218,165,32,0.2), rgba(34,197,94,0.2))' }}
      >
        <Rocket className="w-8 h-8" style={{ color: '#DAA520' }} />
      </motion.div>

      <div className="space-y-2">
        <h2 className="text-2xl sm:text-3xl font-bold" style={{ color: '#e8eaf0' }}>
          {t('onboarding.welcome.title', 'Bienvenue sur CashPilot !')}
        </h2>
        <p style={{ color: '#8b92a8' }}>
          {t('onboarding.welcome.subtitle', 'Nous allons preparer votre espace comptable en quelques minutes.')}
        </p>
      </div>

      {/* Feature bullets */}
      <motion.div
        className="grid gap-3 text-left"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {FEATURES.map((feature) => (
          <motion.div
            key={feature.titleKey}
            variants={itemVariants}
            className="flex items-start gap-4 rounded-xl p-4 transition-all hover:scale-[1.01]"
            style={{
              background: 'rgba(15, 21, 40, 0.5)',
              border: '1px solid #1e293b',
            }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ background: feature.bgColor }}
            >
              <feature.icon className="w-5 h-5" style={{ color: feature.color }} />
            </div>
            <div>
              <h3 className="font-medium text-sm" style={{ color: '#e8eaf0' }}>
                {t(feature.titleKey, feature.titleDefault)}
              </h3>
              <p className="text-xs mt-1" style={{ color: '#8b92a8' }}>
                {t(feature.descKey, feature.descDefault)}
              </p>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* CTA Button */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
      >
        <Button
          onClick={onNext}
          className="w-full font-bold py-3 text-white transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#0a0e1a] focus:ring-[#DAA520]"
          style={{
            background: 'linear-gradient(135deg, #DAA520, #22C55E)',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'translateY(0)'; }}
          aria-label={t('onboarding.welcome.start', 'Commencer')}
        >
          {t('onboarding.welcome.start', 'Commencer')}
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </motion.div>
    </div>
  );
};

export default Step1Welcome;
