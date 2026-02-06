import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

/**
 * Available beta features
 */
export const BETA_FEATURES = {
  AI_ML_FORECAST: 'ai-ml-forecast',
  AI_CREDIT_SCORING: 'ai-credit-scoring',
  AI_TAX_OPTIMIZATION: 'ai-tax-optimization',
  AI_FRAUD_DETECTION: 'ai-fraud-detection',
  VOICE_INPUT: 'voice-input',
  REALTIME_COLLAB: 'realtime-collab',
  DASHBOARD_BUILDER: 'dashboard-builder',
  FACTURX_EXPORT: 'facturx-export',
  MULTI_CURRENCY: 'multi-currency',
  POS_INTEGRATION: 'pos-integration'
};

/**
 * Hook for managing beta features
 */
export const useBetaFeatures = () => {
  const { user } = useAuth();
  const [enabledFeatures, setEnabledFeatures] = useState([]);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [enrolledAt, setEnrolledAt] = useState(null);

  // Fetch beta status
  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const fetchBetaStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('beta_program')
          .select('features_enabled, enrolled_at, feedback_count')
          .eq('user_id', user.id)
          .single();

        if (error && error.code !== 'PGRST116') {
          console.error('Error fetching beta status:', error);
        }

        if (data) {
          setIsEnrolled(true);
          setEnabledFeatures(data.features_enabled || []);
          setEnrolledAt(data.enrolled_at);
          setFeedbackCount(data.feedback_count || 0);
        } else {
          setIsEnrolled(false);
          setEnabledFeatures([]);
        }
      } catch (err) {
        console.error('Error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchBetaStatus();
  }, [user]);

  /**
   * Check if a feature is enabled
   */
  const isFeatureEnabled = useCallback((featureId) => {
    return enabledFeatures.includes(featureId);
  }, [enabledFeatures]);

  /**
   * Enroll in beta program
   */
  const enrollInBeta = useCallback(async (features = []) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const { data, error } = await supabase
        .from('beta_program')
        .upsert({
          user_id: user.id,
          features_enabled: features,
          enrolled_at: new Date().toISOString(),
          feedback_count: 0
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (error) throw error;

      setIsEnrolled(true);
      setEnabledFeatures(data.features_enabled || []);
      setEnrolledAt(data.enrolled_at);

      return { success: true, data };
    } catch (err) {
      console.error('Error enrolling in beta:', err);
      return { success: false, error: err.message };
    }
  }, [user]);

  /**
   * Update enabled features
   */
  const updateFeatures = useCallback(async (features) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const { data, error } = await supabase
        .from('beta_program')
        .update({ features_enabled: features })
        .eq('user_id', user.id)
        .select()
        .single();

      if (error) throw error;

      setEnabledFeatures(data.features_enabled || []);
      return { success: true, data };
    } catch (err) {
      console.error('Error updating features:', err);
      return { success: false, error: err.message };
    }
  }, [user]);

  /**
   * Toggle a specific feature
   */
  const toggleFeature = useCallback(async (featureId) => {
    const newFeatures = enabledFeatures.includes(featureId)
      ? enabledFeatures.filter(f => f !== featureId)
      : [...enabledFeatures, featureId];

    return updateFeatures(newFeatures);
  }, [enabledFeatures, updateFeatures]);

  /**
   * Leave beta program
   */
  const leaveBeta = useCallback(async () => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      const { error } = await supabase
        .from('beta_program')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;

      setIsEnrolled(false);
      setEnabledFeatures([]);
      setEnrolledAt(null);
      setFeedbackCount(0);

      return { success: true };
    } catch (err) {
      console.error('Error leaving beta:', err);
      return { success: false, error: err.message };
    }
  }, [user]);

  /**
   * Submit feedback for a feature
   */
  const submitFeedback = useCallback(async (featureId, rating, feedback) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      // Insert feedback
      const { error: feedbackError } = await supabase
        .from('beta_feedback')
        .insert({
          user_id: user.id,
          feature_id: featureId,
          rating,
          feedback
        });

      if (feedbackError) throw feedbackError;

      // Update feedback count
      const { data, error: updateError } = await supabase
        .from('beta_program')
        .update({ feedback_count: feedbackCount + 1 })
        .eq('user_id', user.id)
        .select()
        .single();

      if (updateError) throw updateError;

      setFeedbackCount(data.feedback_count);
      return { success: true };
    } catch (err) {
      console.error('Error submitting feedback:', err);
      return { success: false, error: err.message };
    }
  }, [user, feedbackCount]);

  /**
   * Get all available features with status
   */
  const getAllFeatures = useCallback(() => {
    return Object.entries(BETA_FEATURES).map(([key, id]) => ({
      id,
      key,
      name: key.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase()),
      enabled: enabledFeatures.includes(id)
    }));
  }, [enabledFeatures]);

  return {
    // State
    loading,
    isEnrolled,
    enabledFeatures,
    enrolledAt,
    feedbackCount,

    // Checks
    isFeatureEnabled,

    // Actions
    enrollInBeta,
    leaveBeta,
    updateFeatures,
    toggleFeature,
    submitFeedback,

    // Helpers
    getAllFeatures,
    availableFeatures: BETA_FEATURES
  };
};

export default useBetaFeatures;
