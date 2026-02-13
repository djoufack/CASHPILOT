import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from 'react-i18next';

const CONSENT_STORAGE_KEY = 'cashpilot_gdpr_consent';

const DEFAULT_CONSENT = {
  necessary: true,
  cookies: false,
  analytics: false,
  marketing: false,
};

export const useGDPR = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [consentStatus, setConsentStatus] = useState(DEFAULT_CONSENT);
  const [exportStatus, setExportStatus] = useState('idle'); // 'idle' | 'pending' | 'completed' | 'failed'
  const [exportUrl, setExportUrl] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load consent from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setConsentStatus({ ...DEFAULT_CONSENT, ...parsed, necessary: true });
      }
    } catch {
      // Invalid JSON, ignore
    }
    setLoading(false);
  }, []);

  // Check if the user has already consented
  const hasConsented = useCallback(() => {
    try {
      const stored = localStorage.getItem(CONSENT_STORAGE_KEY);
      return stored !== null;
    } catch {
      return false;
    }
  }, []);

  // Save consent to localStorage and to the consent_logs table
  const saveConsent = useCallback(async (consents) => {
    const finalConsent = {
      ...consents,
      necessary: true, // Always required
    };

    // Save to localStorage
    try {
      localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(finalConsent));
    } catch {
      // localStorage might be full, continue
    }

    setConsentStatus(finalConsent);

    // Save to database if user is authenticated
    if (user && supabase) {
      const consentTypes = ['necessary', 'cookies', 'analytics', 'marketing'];

      for (const type of consentTypes) {
        try {
          await supabase.from('consent_logs').insert([{
            user_id: user.id,
            consent_type: type,
            granted: finalConsent[type] || false,
            ip_address: null, // Privacy-safe: we don't track IP client-side
            user_agent: navigator.userAgent,
            granted_at: finalConsent[type] ? new Date().toISOString() : null,
            revoked_at: !finalConsent[type] ? new Date().toISOString() : null,
          }]);
        } catch (err) {
          console.error(`Failed to log consent for ${type}:`, err);
        }
      }
    }
  }, [user]);

  // Request data export via Edge Function
  const requestDataExport = useCallback(async () => {
    if (!user || !supabase) {
      toast({
        title: t('common.error'),
        description: t('gdpr.exportError'),
        variant: 'destructive',
      });
      return;
    }

    setExportStatus('pending');
    setExportUrl(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/export-user-data`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Export failed');
      }

      const result = await response.json();

      if (result.success) {
        setExportStatus('completed');

        if (result.file_url) {
          setExportUrl(result.file_url);
        }

        // If there's direct data (fallback when storage upload fails), download it
        if (result.data && !result.file_url) {
          const blob = new Blob([JSON.stringify(result.data, null, 2)], {
            type: 'application/json',
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `cashpilot-data-export-${new Date().toISOString().split('T')[0]}.json`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }

        toast({
          title: t('gdpr.settings.exportReady'),
          description: t('gdpr.exportSuccessDesc'),
        });
      } else {
        throw new Error('Export returned unsuccessful result');
      }
    } catch (err) {
      console.error('Data export error:', err);
      setExportStatus('failed');
      toast({
        title: t('common.error'),
        description: t('gdpr.exportError'),
        variant: 'destructive',
      });
    }
  }, [user, toast, t]);

  return {
    consentStatus,
    saveConsent,
    hasConsented,
    requestDataExport,
    exportStatus,
    exportUrl,
    loading,
  };
};
