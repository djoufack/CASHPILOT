import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

export const useOnboarding = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [onboardingCompleted, setOnboardingCompleted] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [wizardData, setWizardData] = useState({
    companyInfo: {},
    selectedPlanId: null,
    selectedPlanCountry: null,
    openingBalances: {},
  });

  const fetchOnboardingStatus = useCallback(async () => {
    if (!user || !supabase) return;
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('onboarding_completed, onboarding_step')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setOnboardingCompleted(data?.onboarding_completed ?? false);
      setCurrentStep(data?.onboarding_step ?? 0);
    } catch (err) {
      console.warn('Error fetching onboarding status:', err.message);
      setOnboardingCompleted(false);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchOnboardingStatus();
  }, [fetchOnboardingStatus]);

  const saveStep = async (step) => {
    if (!user || !supabase) return;
    try {
      await supabase
        .from('profiles')
        .update({ onboarding_step: step })
        .eq('id', user.id);
      setCurrentStep(step);
    } catch (err) {
      console.warn('Error saving onboarding step:', err.message);
    }
  };

  const completeOnboarding = async () => {
    if (!user || !supabase) return;
    try {
      await supabase
        .from('profiles')
        .update({ onboarding_completed: true, onboarding_step: 5 })
        .eq('id', user.id);
      setOnboardingCompleted(true);
      setCurrentStep(5);
    } catch (err) {
      console.warn('Error completing onboarding:', err.message);
    }
  };

  const updateWizardData = (key, value) => {
    setWizardData(prev => ({ ...prev, [key]: value }));
  };

  const nextStep = () => {
    const next = currentStep + 1;
    saveStep(next);
  };

  const prevStep = () => {
    const prev = Math.max(0, currentStep - 1);
    saveStep(prev);
  };

  const goToStep = (step) => {
    saveStep(step);
  };

  return {
    loading,
    onboardingCompleted,
    currentStep,
    wizardData,
    updateWizardData,
    nextStep,
    prevStep,
    goToStep,
    completeOnboarding,
    refresh: fetchOnboardingStatus,
  };
};
