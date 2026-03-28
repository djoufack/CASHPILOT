import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useToast } from '@/components/ui/use-toast';

const DEFAULT_CONNECTORS_BY_COUNTRY = {
  FR: [
    {
      connector_code: 'payfit',
      connector_name: 'PayFit DSN',
      provider_category: 'payroll',
      requirements: ['DSN mensuelle', 'Variables de paie'],
      metadata: { jurisdiction: 'FR' },
    },
    {
      connector_code: 'dsn-net',
      connector_name: 'DSN Net Entreprises',
      provider_category: 'compliance',
      requirements: ['Depot DSN', 'Historique accuses'],
      metadata: { jurisdiction: 'FR' },
    },
    {
      connector_code: 'urssaf',
      connector_name: 'URSSAF Telepaiement',
      provider_category: 'compliance',
      requirements: ['Assiettes sociales', 'Calendrier declaratif'],
      metadata: { jurisdiction: 'FR' },
    },
  ],
  BE: [
    {
      connector_code: 'sdworx',
      connector_name: 'SD Worx Payroll',
      provider_category: 'payroll',
      requirements: ['ONSS payroll run', 'Export fiches 281.10'],
      metadata: { jurisdiction: 'BE' },
    },
    {
      connector_code: 'onss',
      connector_name: 'ONSS DmfA',
      provider_category: 'compliance',
      requirements: ['Declaration DmfA', 'Controle cotisations'],
      metadata: { jurisdiction: 'BE' },
    },
    {
      connector_code: 'belcotax',
      connector_name: 'Belcotax-on-web',
      provider_category: 'compliance',
      requirements: ['Fiches fiscales annuelles', 'Validation schema'],
      metadata: { jurisdiction: 'BE' },
    },
  ],
  OHADA: [
    {
      connector_code: 'ohada-payroll',
      connector_name: 'OHADA Payroll Engine',
      provider_category: 'payroll',
      requirements: ['Journal de paie', 'Rubriques OHADA'],
      metadata: { jurisdiction: 'OHADA' },
    },
    {
      connector_code: 'cnps',
      connector_name: 'CNPS Declarations',
      provider_category: 'compliance',
      requirements: ['Cotisations CNPS', 'Salaries assujettis'],
      metadata: { jurisdiction: 'OHADA' },
    },
    {
      connector_code: 'fiscal-ohada',
      connector_name: 'Fiscalite OHADA',
      provider_category: 'compliance',
      requirements: ['Retenues source', 'Controles fiscaux pays'],
      metadata: { jurisdiction: 'OHADA' },
    },
  ],
};

const OHADA_COUNTRY_CODES = new Set([
  'AO',
  'BJ',
  'BF',
  'CM',
  'CF',
  'TD',
  'KM',
  'CG',
  'CD',
  'CI',
  'GA',
  'GN',
  'GQ',
  'GW',
  'ML',
  'NE',
  'SN',
  'TG',
  'OHADA',
]);

export const mapCountryToPayrollConnectorCountry = (country) => {
  const normalized = String(country || '')
    .trim()
    .toUpperCase();
  if (normalized === 'FR') return 'FR';
  if (normalized === 'BE') return 'BE';
  if (OHADA_COUNTRY_CODES.has(normalized)) return 'OHADA';
  return 'OHADA';
};

export function usePayrollCountryConnectors(country) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { activeCompanyId, applyCompanyScope, withCompanyScope } = useCompanyScope();
  const countryCode = useMemo(() => mapCountryToPayrollConnectorCountry(country), [country]);

  const [connectors, setConnectors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const ensureDefaultConnectors = useCallback(async () => {
    if (!user?.id || !activeCompanyId) return;

    const defaults = DEFAULT_CONNECTORS_BY_COUNTRY[countryCode] || DEFAULT_CONNECTORS_BY_COUNTRY.OHADA;
    if (!defaults.length) return;

    const rows = defaults.map((item) =>
      withCompanyScope({
        user_id: user.id,
        country_code: countryCode,
        connector_code: item.connector_code,
        connector_name: item.connector_name,
        provider_category: item.provider_category,
        status: 'not_connected',
        compliance_status: 'unknown',
        requirements: item.requirements || [],
        metadata: item.metadata || {},
      })
    );

    const { error: insertError } = await supabase
      .from('hr_payroll_country_connectors')
      .upsert(rows, { onConflict: 'company_id,country_code,connector_code' });

    if (insertError) throw insertError;
  }, [activeCompanyId, countryCode, user?.id, withCompanyScope]);

  const fetchConnectors = useCallback(async () => {
    if (!user || !supabase || !activeCompanyId) {
      setConnectors([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('hr_payroll_country_connectors')
        .select('*')
        .eq('country_code', countryCode)
        .order('provider_category', { ascending: true })
        .order('connector_name', { ascending: true });
      query = applyCompanyScope(query);

      let { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      if (!data || data.length === 0) {
        await ensureDefaultConnectors();

        let retryQuery = supabase
          .from('hr_payroll_country_connectors')
          .select('*')
          .eq('country_code', countryCode)
          .order('provider_category', { ascending: true })
          .order('connector_name', { ascending: true });
        retryQuery = applyCompanyScope(retryQuery);

        const retry = await retryQuery;
        if (retry.error) throw retry.error;
        data = retry.data || [];
      }

      setConnectors(data || []);
    } catch (err) {
      setError(err.message || 'Impossible de charger les connecteurs de paie.');
      toast({
        title: 'Erreur connecteurs paie',
        description: err.message || 'Chargement impossible pour le moment.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, applyCompanyScope, countryCode, ensureDefaultConnectors, toast, user]);

  const updateConnector = useCallback(async (connectorId, updates) => {
    if (!connectorId || !supabase) return null;

    const { data, error: updateError } = await supabase
      .from('hr_payroll_country_connectors')
      .update(updates)
      .eq('id', connectorId)
      .select('*')
      .single();

    if (updateError) throw updateError;

    setConnectors((previous) =>
      previous.map((connector) => (connector.id === connectorId ? { ...connector, ...data } : connector))
    );
    return data;
  }, []);

  const markConnectorConnected = useCallback(
    (connectorId) =>
      updateConnector(connectorId, {
        status: 'connected',
        last_sync_at: new Date().toISOString(),
      }),
    [updateConnector]
  );

  const setConnectorStatus = useCallback(
    (connectorId, status) =>
      updateConnector(connectorId, {
        status,
      }),
    [updateConnector]
  );

  const setConnectorComplianceStatus = useCallback(
    (connectorId, complianceStatus) =>
      updateConnector(connectorId, {
        compliance_status: complianceStatus,
        last_sync_at: new Date().toISOString(),
      }),
    [updateConnector]
  );

  useEffect(() => {
    fetchConnectors();
  }, [fetchConnectors]);

  return {
    countryCode,
    connectors,
    loading,
    error,
    refresh: fetchConnectors,
    markConnectorConnected,
    setConnectorStatus,
    setConnectorComplianceStatus,
  };
}

export default usePayrollCountryConnectors;
