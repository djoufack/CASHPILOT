import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STEPS = [
  {
    title: 'Bienvenue sur CashPilot !',
    description: 'Votre solution compl\u00e8te de gestion financi\u00e8re et comptable. Suivez ce guide rapide pour d\u00e9couvrir les fonctionnalit\u00e9s principales.',
    icon: '\u{1F680}',
  },
  {
    title: 'Tableau de bord',
    description: 'Visualisez vos KPIs en temps r\u00e9el : chiffre d\'affaires, d\u00e9penses, factures impay\u00e9es et tr\u00e9sorerie.',
    icon: '\u{1F4CA}',
  },
  {
    title: 'Factures & Devis',
    description: 'Cr\u00e9ez et g\u00e9rez vos factures et devis. Export PDF, envoi par email, et suivi des paiements automatique.',
    icon: '\u{1F4C4}',
  },
  {
    title: 'Intelligence Artificielle',
    description: 'Extraction automatique de factures, cat\u00e9gorisation des d\u00e9penses, d\u00e9tection d\'anomalies et chatbot comptable.',
    icon: '\u{1F916}',
  },
  {
    title: 'C\'est parti !',
    description: 'Commencez par ajouter vos premiers clients et cr\u00e9ez votre premi\u00e8re facture. Bon pilotage !',
    icon: '\u2728',
  },
];

const OnboardingTour = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const hasSeenTour = localStorage.getItem('cashpilot-onboarding-done');
    if (!hasSeenTour) {
      setIsVisible(true);
    }
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    localStorage.setItem('cashpilot-onboarding-done', 'true');
  };

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(s => s + 1);
    } else {
      handleClose();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(s => s - 1);
  };

  if (!isVisible) return null;

  const step = STEPS[currentStep];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-gray-900 border border-gray-700 rounded-2xl max-w-md w-full p-8 relative shadow-2xl"
        >
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 text-gray-500 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="text-center mb-6">
            <div className="text-5xl mb-4">{step.icon}</div>
            <h2 className="text-xl font-bold text-white mb-2">{step.title}</h2>
            <p className="text-gray-400 text-sm leading-relaxed">{step.description}</p>
          </div>

          {/* Progress dots */}
          <div className="flex justify-center gap-2 mb-6">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === currentStep ? 'bg-orange-500' : 'bg-gray-700'
                }`}
              />
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={handlePrev}
              disabled={currentStep === 0}
              className="text-gray-400 hover:text-white"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Pr\u00e9c\u00e9dent
            </Button>

            <button
              onClick={handleClose}
              className="text-xs text-gray-500 hover:text-gray-300"
            >
              Passer
            </button>

            <Button
              onClick={handleNext}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {currentStep === STEPS.length - 1 ? (
                <>
                  <Sparkles className="w-4 h-4 mr-1" />
                  Commencer
                </>
              ) : (
                <>
                  Suivant
                  <ChevronRight className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default OnboardingTour;
