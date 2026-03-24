import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export const useOnboarding = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
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
      const { data, error: fetchError } = await supabase
        .from('profiles')
        .select('onboarding_completed, onboarding_step')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) throw fetchError;
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

  const buildFailureResult = useCallback((message) => {
    const normalizedMessage = message || 'Une erreur est survenue pendant la sauvegarde.';
    setError(normalizedMessage);
    return { success: false, error: normalizedMessage };
  }, []);

  const saveStep = useCallback(
    async (step) => {
      if (!user || !supabase) {
        return buildFailureResult("L'utilisateur ou Supabase n'est pas disponible.");
      }

      setSaving(true);
      setError(null);

      try {
        const { error: saveError } = await supabase
          .from('profiles')
          .update({ onboarding_step: step })
          .eq('user_id', user.id);

        if (saveError) {
          throw saveError;
        }

        setCurrentStep(step);
        return { success: true, step };
      } catch (err) {
        console.warn('Error saving onboarding step:', err.message);
        return buildFailureResult(err.message);
      } finally {
        setSaving(false);
      }
    },
    [buildFailureResult, user]
  );

  const completeOnboarding = useCallback(async () => {
    if (!user || !supabase) {
      return buildFailureResult("L'utilisateur ou Supabase n'est pas disponible.");
    }

    setSaving(true);
    setError(null);

    try {
      const { error: saveError } = await supabase
        .from('profiles')
        .update({ onboarding_completed: true, onboarding_step: 5 })
        .eq('user_id', user.id);

      if (saveError) {
        throw saveError;
      }

      setOnboardingCompleted(true);
      setCurrentStep(5);
      return { success: true, completed: true, step: 5 };
    } catch (err) {
      console.warn('Error completing onboarding:', err.message);
      return buildFailureResult(err.message);
    } finally {
      setSaving(false);
    }
  }, [buildFailureResult, user]);

  const updateWizardData = (key, value) => {
    setWizardData((prev) => ({ ...prev, [key]: value }));
  };

  const nextStep = async () => {
    const next = currentStep + 1;
    return saveStep(next);
  };

  const prevStep = async () => {
    const prev = Math.max(0, currentStep - 1);
    return saveStep(prev);
  };

  const goToStep = async (step) => {
    return saveStep(step);
  };

  return {
    loading,
    saving,
    error,
    onboardingCompleted,
    currentStep,
    wizardData,
    updateWizardData,
    nextStep,
    prevStep,
    goToStep,
    saveStep,
    completeOnboarding,
    refresh: fetchOnboardingStatus,
  };
};
