import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useToast } from '@/components/ui/use-toast';

const DEFAULT_PACK_TEMPLATES = [
  {
    provider: 'zapier',
    pack_code: 'zapier_invoice_status_to_slack',
    pack_name: 'Factures impayees -> Slack Finance',
    description: 'Diffuse automatiquement les factures en retard dans un canal finance Slack.',
    trigger_event: 'invoice.overdue',
    target_module: 'Ventes',
    endpoint_path: '/api/v1/webhooks/invoices/overdue',
    sample_payload: {
      invoice_number: 'FAC-2026-001',
      client_name: 'ACME',
      total_amount: 2450,
      currency: 'EUR',
      status: 'overdue',
    },
    setup_steps: [
      'Creer un Zap avec trigger Webhooks by Zapier',
      'Coller l endpoint CashPilot',
      'Mapper client, montant et echeance vers Slack',
    ],
    tags: ['sales', 'dunning', 'slack'],
  },
  {
    provider: 'make',
    pack_code: 'make_supplier_invoice_approval',
    pack_name: 'Validation facture fournisseur -> Teams',
    description: 'Declenche une notification Teams pour les factures fournisseurs depassant le seuil manager.',
    trigger_event: 'supplier_invoice.awaiting_approval',
    target_module: 'Achats',
    endpoint_path: '/api/v1/webhooks/supplier-invoices/approval',
    sample_payload: {
      invoice_number: 'FNS-2026-014',
      supplier: 'Fournisseur Demo',
      amount: 3980,
      currency: 'EUR',
      approval_level: 'n2',
    },
    setup_steps: [
      'Importer le template Make (Custom webhook + Microsoft Teams)',
      'Connecter votre webhook CashPilot',
      'Activer le scenario et verifier la notification',
    ],
    tags: ['purchases', 'approval', 'teams'],
  },
  {
    provider: 'zapier',
    pack_code: 'zapier_payroll_validation_to_drive',
    pack_name: 'Validation paie -> Archivage Drive',
    description: 'Archive automatiquement les exports paie valides dans Google Drive avec naming standardise.',
    trigger_event: 'payroll.period.validated',
    target_module: 'RH',
    endpoint_path: '/api/v1/webhooks/payroll/validated',
    sample_payload: {
      period_label: 'Mars 2026',
      country: 'FR',
      validated_by: 'DRH',
      gross_total: 128500,
      net_total: 96400,
    },
    setup_steps: [
      'Configurer un Zap Webhooks + Google Drive',
      'Mapper periode, pays et montants',
      'Activer le dossier cible d archivage',
    ],
    tags: ['hr', 'payroll', 'drive'],
  },
  {
    provider: 'make',
    pack_code: 'make_accounting_close_to_email',
    pack_name: 'Cloture comptable -> diffusion email',
    description: 'Envoie un recap de cloture comptable aux parties prenantes des qu une periode est finalisee.',
    trigger_event: 'accounting.close.completed',
    target_module: 'Comptabilite',
    endpoint_path: '/api/v1/webhooks/accounting/close',
    sample_payload: {
      period: '2026-03',
      status: 'closed',
      debit_total: 54000,
      credit_total: 54000,
    },
    setup_steps: [
      'Ajouter un module webhook Make',
      'Mapper les indicateurs de cloture',
      'Connecter la passerelle email transactionnelle',
    ],
    tags: ['accounting', 'closing', 'email'],
  },
];

export function useIntegrationAutomationPacks() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { activeCompanyId, applyCompanyScope, withCompanyScope } = useCompanyScope();

  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const ensureDefaultPacks = useCallback(async () => {
    if (!user?.id || !activeCompanyId) return;

    const rows = DEFAULT_PACK_TEMPLATES.map((template) =>
      withCompanyScope({
        user_id: user.id,
        provider: template.provider,
        pack_code: template.pack_code,
        pack_name: template.pack_name,
        description: template.description,
        trigger_event: template.trigger_event,
        target_module: template.target_module,
        endpoint_path: template.endpoint_path,
        sample_payload: template.sample_payload,
        setup_steps: template.setup_steps,
        tags: template.tags,
        status: 'ready',
      })
    );

    const { error: insertError } = await supabase
      .from('integration_automation_packs')
      .upsert(rows, { onConflict: 'company_id,provider,pack_code' });

    if (insertError) throw insertError;
  }, [activeCompanyId, user?.id, withCompanyScope]);

  const fetchPacks = useCallback(async () => {
    if (!user?.id || !activeCompanyId || !supabase) {
      setPacks([]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('integration_automation_packs')
        .select('*')
        .order('provider', { ascending: true })
        .order('pack_name', { ascending: true });
      query = applyCompanyScope(query);

      let { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;

      if (!data || data.length === 0) {
        await ensureDefaultPacks();

        let retryQuery = supabase
          .from('integration_automation_packs')
          .select('*')
          .order('provider', { ascending: true })
          .order('pack_name', { ascending: true });
        retryQuery = applyCompanyScope(retryQuery);

        const retry = await retryQuery;
        if (retry.error) throw retry.error;
        data = retry.data || [];
      }

      setPacks(data || []);
    } catch (err) {
      const message = err?.message || 'Impossible de charger les packs d integration.';
      setError(message);
      toast({
        title: 'Erreur packs integration',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId, applyCompanyScope, ensureDefaultPacks, toast, user?.id]);

  const updatePack = useCallback(async (packId, updates) => {
    if (!packId || !supabase) return null;

    const { data, error: updateError } = await supabase
      .from('integration_automation_packs')
      .update(updates)
      .eq('id', packId)
      .select('*')
      .single();

    if (updateError) throw updateError;

    setPacks((previous) => previous.map((pack) => (pack.id === packId ? { ...pack, ...data } : pack)));
    return data;
  }, []);

  const markPackInstalled = useCallback(
    (packId) =>
      updatePack(packId, {
        status: 'installed',
        installed_at: new Date().toISOString(),
      }),
    [updatePack]
  );

  const setPackStatus = useCallback(
    (packId, status) => {
      const updates = {
        status,
      };
      if (status !== 'installed') {
        updates.installed_at = null;
      }
      return updatePack(packId, updates);
    },
    [updatePack]
  );

  useEffect(() => {
    fetchPacks();
  }, [fetchPacks]);

  return {
    packs,
    loading,
    error,
    refresh: fetchPacks,
    markPackInstalled,
    setPackStatus,
  };
}

export default useIntegrationAutomationPacks;
