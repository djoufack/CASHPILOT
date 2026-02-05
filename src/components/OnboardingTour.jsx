import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronRight, ChevronLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STEPS = [
  {
    title: 'Bienvenue sur CashPilot !',
    description: 'Votre solution complète de gestion financière et comptable. Suivez ce guide rapide pour découvrir les fonctionnalités principales.',
    icon: '🚀',
  },
  {
    title: 'Tableau de bord',
    description: 'Visualisez vos KPIs en temps réel : chiffre d\'affaires, dépenses, factures impayées et trésorerie.',
    icon: '📊',
  },
  {
    title: 'Factures & Devis',
    description: 'Créez et gérez vos factures et devis. Export PDF, envoi par email, et suivi des paiements automatique.',
    icon: '📄',
  },
  {
    title: 'Intelligence Artificielle',
    description: 'Extraction automatique de factures, catégorisation des dépenses, détection d\'anomalies et chatbot comptable.',
    icon: '🤖',
  },
  {
    title: 'C\'est parti !',
    description: 'Commencez par ajouter vos premiers clients et créez votre première facture. Bon pilotage !',
    icon: '✨',
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
              Précédent
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
