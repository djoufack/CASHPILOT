
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { checkAccountingInitialized, initializeAccounting } from '@/services/accountingInitService';

/**
 * Hook to manage accounting auto-initialization
 * - Checks if user has initialized their accounting settings
 * - Provides method to initialize for a given country (BE/FR)
 * - Used in AccountingIntegration.jsx to show wizard or dashboard
 */
export const useAccountingInit = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isInitialized, setIsInitialized] = useState(null); // null = loading
  const [isInitializing, setIsInitializing] = useState(false);
  const [country, setCountry] = useState(null);
  const [settings, setSettings] = useState(null);

  const checkInit = useCallback(async () => {
    if (!user) return;
    try {
      const result = await checkAccountingInitialized(user.id);
      setIsInitialized(result.isInitialized);
      setCountry(result.country);
      setSettings(result.settings);
    } catch (err) {
      console.error('Error checking accounting init:', err);
      setIsInitialized(false);
    }
  }, [user]);

  useEffect(() => {
    checkInit();
  }, [checkInit]);

  const initializeForCountry = async (selectedCountry) => {
    if (!user || isInitializing) return;
    setIsInitializing(true);
    try {
      const result = await initializeAccounting(user.id, selectedCountry);
      if (result.success) {
        setIsInitialized(true);
        setCountry(selectedCountry);
        toast({
          title: 'Comptabilité initialisée',
          description: `${result.accountsCount} comptes, ${result.mappingsCount} mappings, ${result.taxRatesCount} taux TVA`,
        });
      } else {
        throw new Error(result.error || 'Initialization failed');
      }
    } catch (err) {
      toast({
        title: 'Erreur d\'initialisation',
        description: err.message,
        variant: 'destructive',
      });
    } finally {
      setIsInitializing(false);
    }
  };

  const toggleAutoJournal = async (enabled) => {
    if (!user) return;
    try {
      const { error } = await supabase
        .from('user_accounting_settings')
        .update({ auto_journal_enabled: enabled, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
      if (error) throw error;
      setSettings(prev => prev ? { ...prev, auto_journal_enabled: enabled } : prev);
      toast({
        title: enabled ? 'Écritures automatiques activées' : 'Écritures automatiques désactivées',
      });
    } catch (err) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    }
  };

  return {
    isInitialized,
    isInitializing,
    country,
    settings,
    initializeForCountry,
    toggleAutoJournal,
    refresh: checkInit,
  };
};
