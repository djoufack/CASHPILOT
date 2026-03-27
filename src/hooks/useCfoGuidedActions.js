import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
import { supabaseAnonKey, supabaseUrl } from '@/lib/customSupabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { formatDateInput, formatStartOfYearInput } from '@/utils/dateFormatting';

const ACTION_KEYS = ['relance', 'scenario', 'audit'];
const DEFAULT_ACTION_STATE = {
  state: 'idle',
  message: null,
  error: null,
};

const DEFAULT_DUNNING_TONE = 'professional';
const DEFAULT_DUNNING_CHANNEL = 'email';
const DEFAULT_DUNNING_STEP = 1;

const normalizeDate = (value, fallback) => {
  if (!value) return fallback;
  return String(value).slice(0, 10);
};

const getInitialActionState = () =>
  ACTION_KEYS.reduce((acc, key) => {
    acc[key] = { ...DEFAULT_ACTION_STATE };
    return acc;
  }, {});

const buildActionMessage = (t, key, phase, fallback, params = {}) =>
  t(`cfo.guidedActions.${key}.${phase}`, fallback, params);

export function buildCfoAuditAutorunUrl({ periodStart, periodEnd } = {}) {
  const start = normalizeDate(periodStart, formatStartOfYearInput());
  const end = normalizeDate(periodEnd, formatDateInput());
  const searchParams = new URLSearchParams({
    autoRun: '1',
    start,
    end,
  });

  return `/app/audit-comptable?${searchParams.toString()}`;
}

export function useCfoGuidedActions() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeCompanyId, withCompanyScope } = useCompanyScope();
  const [actionStates, setActionStates] = useState(() => getInitialActionState());

  const updateActionState = useCallback((key, updates) => {
    setActionStates((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        ...updates,
      },
    }));
  }, []);

  const resetActionState = useCallback(
    (key) => {
      updateActionState(key, { ...DEFAULT_ACTION_STATE });
    },
    [updateActionState]
  );

  const buildActionError = useCallback(
    (key, fallback, params = {}) => {
      updateActionState(key, {
        state: 'error',
        message: buildActionMessage(t, key, 'error', fallback, {
          reason: fallback,
          ...params,
        }),
        error: fallback,
      });
    },
    [t, updateActionState]
  );

  const executeRelance = useCallback(async () => {
    const actionKey = 'relance';
    resetActionState(actionKey);

    if (!user?.id || !activeCompanyId) {
      buildActionError(actionKey, 'Impossible de lancer la relance sans société active.', { reason: 'company_scope' });
      return null;
    }

    updateActionState(actionKey, { state: 'loading', message: null, error: null });

    try {
      const todayIso = formatDateInput();
      let invoiceQuery = supabase
        .from('invoices')
        .select(
          'id, invoice_number, total_ttc, balance_due, due_date, client_id, clients ( id, company_name, email, phone )'
        )
        .eq('user_id', user.id)
        .eq('company_id', activeCompanyId)
        .in('payment_status', ['unpaid', 'partial'])
        .lt('due_date', todayIso)
        .order('due_date', { ascending: true })
        .order('created_at', { ascending: true })
        .limit(1);

      const { data, error } = await invoiceQuery;

      if (error) throw error;

      const overdueInvoice = Array.isArray(data) ? data[0] : data;
      if (!overdueInvoice) {
        throw new Error('Aucune facture impayée en retard n’a été trouvée pour votre société.');
      }

      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) {
        throw new Error('Session expirée. Veuillez vous reconnecter.');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/dunning-execute`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          apikey: supabaseAnonKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          company_id: activeCompanyId,
          invoice_id: overdueInvoice.id,
          client_id: overdueInvoice.client_id || overdueInvoice.clients?.id || null,
          channel: DEFAULT_DUNNING_CHANNEL,
          tone: DEFAULT_DUNNING_TONE,
          step_number: DEFAULT_DUNNING_STEP,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || `HTTP ${response.status}`);
      }

      updateActionState(actionKey, {
        state: 'success',
        message: buildActionMessage(
          t,
          actionKey,
          'success',
          'Relance exécutée sur la facture la plus en retard : {{invoiceNumber}}',
          {
            invoiceNumber: overdueInvoice.invoice_number || overdueInvoice.id,
          }
        ),
        error: null,
      });

      return {
        invoice: overdueInvoice,
        execution: payload,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      updateActionState(actionKey, {
        state: 'error',
        message: buildActionMessage(t, actionKey, 'error', message, {
          reason: message,
        }),
        error: message,
      });
      return null;
    }
  }, [activeCompanyId, buildActionError, resetActionState, t, updateActionState, user?.id]);

  const executeScenario = useCallback(async () => {
    const actionKey = 'scenario';
    resetActionState(actionKey);

    if (!user?.id || !activeCompanyId) {
      buildActionError(actionKey, 'Impossible de créer un scénario sans société active.');
      return null;
    }

    updateActionState(actionKey, { state: 'loading', message: null, error: null });

    try {
      const payload = withCompanyScope({
        user_id: user.id,
        name: buildActionMessage(t, actionKey, 'defaultName', 'Scénario CFO guidé'),
        description: buildActionMessage(
          t,
          actionKey,
          'defaultDescription',
          'Scénario de travail créé depuis les actions guidées du CFO.'
        ),
        base_date: formatStartOfYearInput(),
        end_date: formatDateInput(),
        status: 'draft',
        is_baseline: false,
      });

      const { data, error } = await supabase.from('financial_scenarios').insert([payload]).select('id, name').single();

      if (error) throw error;
      if (!data?.id) throw new Error('Le scénario créé ne renvoie pas d’identifiant.');

      navigate(`/app/scenarios/${data.id}`);
      updateActionState(actionKey, {
        state: 'success',
        message: buildActionMessage(t, actionKey, 'success', 'Scénario créé et ouvert : {{scenarioName}}', {
          scenarioName: data.name || payload.name,
        }),
        error: null,
      });

      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erreur inconnue';
      updateActionState(actionKey, {
        state: 'error',
        message: buildActionMessage(t, actionKey, 'error', message, { reason: message }),
        error: message,
      });
      return null;
    }
  }, [activeCompanyId, buildActionError, navigate, resetActionState, t, updateActionState, user?.id, withCompanyScope]);

  const executeAudit = useCallback(() => {
    const actionKey = 'audit';
    resetActionState(actionKey);

    const periodStart = formatStartOfYearInput();
    const periodEnd = formatDateInput();
    const url = buildCfoAuditAutorunUrl({ periodStart, periodEnd });

    updateActionState(actionKey, {
      state: 'success',
      message: buildActionMessage(
        t,
        actionKey,
        'success',
        'Audit ouvert avec lancement automatique sur la période en cours.',
        { periodStart, periodEnd }
      ),
      error: null,
    });

    navigate(url);
    return url;
  }, [navigate, resetActionState, t, updateActionState]);

  const guidedActions = useMemo(
    () => [
      {
        key: 'relance',
        title: t('cfo.guidedActions.relance.title', 'Relance'),
        description: t(
          'cfo.guidedActions.relance.description',
          'Exécuter une relance IA sur la facture impayée la plus en retard de votre société.'
        ),
        cta: t('cfo.guidedActions.relance.cta', 'Lancer la relance'),
        icon: 'bolt',
        state: actionStates.relance.state,
        message: actionStates.relance.message,
        error: actionStates.relance.error,
        loading: actionStates.relance.state === 'loading',
        run: executeRelance,
      },
      {
        key: 'scenario',
        title: t('cfo.guidedActions.scenario.title', 'Scenario'),
        description: t(
          'cfo.guidedActions.scenario.description',
          'Créer un scénario brouillon company-scoped puis ouvrir son espace dédié.'
        ),
        cta: t('cfo.guidedActions.scenario.cta', 'Créer le scénario'),
        icon: 'scenario',
        state: actionStates.scenario.state,
        message: actionStates.scenario.message,
        error: actionStates.scenario.error,
        loading: actionStates.scenario.state === 'loading',
        run: executeScenario,
      },
      {
        key: 'audit',
        title: t('cfo.guidedActions.audit.title', 'Audit'),
        description: t(
          'cfo.guidedActions.audit.description',
          'Ouvrir l’audit comptable avec autorun sur la période en cours.'
        ),
        cta: t('cfo.guidedActions.audit.cta', 'Ouvrir l’audit'),
        icon: 'shield',
        state: actionStates.audit.state,
        message: actionStates.audit.message,
        error: actionStates.audit.error,
        loading: actionStates.audit.state === 'loading',
        run: executeAudit,
      },
    ],
    [
      actionStates.audit.error,
      actionStates.audit.message,
      actionStates.audit.state,
      actionStates.relance.error,
      actionStates.relance.message,
      actionStates.relance.state,
      actionStates.scenario.error,
      actionStates.scenario.message,
      actionStates.scenario.state,
      executeAudit,
      executeRelance,
      executeScenario,
      t,
    ]
  );

  return {
    guidedActions,
  };
}

export default useCfoGuidedActions;
