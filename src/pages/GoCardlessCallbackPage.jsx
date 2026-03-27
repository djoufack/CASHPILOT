import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import {
  useGoCardlessPayments,
  getPendingBillingRequest,
  clearPendingBillingRequest,
} from '@/hooks/useGoCardlessPayments';

export default function GoCardlessCallbackPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { completeMandateSetup } = useGoCardlessPayments();

  const [state, setState] = useState({
    status: 'loading',
    title: t('gocardless.callback.processing', 'Finalisation du mandat...'),
    subtitle: t('gocardless.callback.pleaseWait', 'Veuillez patienter.'),
  });

  useEffect(() => {
    let active = true;

    const finalize = async () => {
      const error = searchParams.get('error');
      if (error) {
        clearPendingBillingRequest();
        if (active) {
          setState({
            status: 'error',
            title: t('gocardless.callback.errorTitle', 'Autorisation échouée'),
            subtitle: error,
          });
        }
        return;
      }

      const pending = getPendingBillingRequest();
      if (!pending?.billingRequestId) {
        if (active) {
          setState({
            status: 'error',
            title: t('gocardless.callback.noPending', 'Aucune demande en attente'),
            subtitle: t(
              'gocardless.callback.noPendingDesc',
              'Session expirée ou demande déjà traitée.'
            ),
          });
        }
        return;
      }

      try {
        const mandate = await completeMandateSetup(
          pending.billingRequestId,
          pending.companyId
        );
        clearPendingBillingRequest();

        if (active) {
          setState({
            status: 'success',
            title: t('gocardless.callback.success', 'Mandat SEPA activé'),
            subtitle: mandate?.reference
              ? `Référence : ${mandate.reference}`
              : t('gocardless.callback.successDesc', 'Le prélèvement est configuré.'),
          });

          setTimeout(() => {
            if (active) {
              navigate(
                `${pending.returnPath || '/app/financial-instruments'}?mandate=created`,
                { replace: true }
              );
            }
          }, 1500);
        }
      } catch (err) {
        clearPendingBillingRequest();
        if (active) {
          setState({
            status: 'error',
            title: t('gocardless.callback.errorTitle', 'Autorisation échouée'),
            subtitle: err instanceof Error ? err.message : 'Erreur inconnue',
          });
        }
      }
    };

    finalize();
    return () => {
      active = false;
    };
  }, [completeMandateSetup, navigate, searchParams, t]);

  const iconMap = {
    loading: <Loader2 className="h-10 w-10 text-blue-400 animate-spin" />,
    success: <CheckCircle2 className="h-10 w-10 text-green-400" />,
    error: <XCircle className="h-10 w-10 text-red-400" />,
  };

  return (
    <>
      <Helmet>
        <title>GoCardless - CashPilot</title>
      </Helmet>
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full text-center space-y-4">
          {iconMap[state.status]}
          <h1 className="text-xl font-semibold text-white">{state.title}</h1>
          <p className="text-sm text-gray-400">{state.subtitle}</p>
          {state.status === 'error' && (
            <button
              onClick={() => navigate('/app/financial-instruments', { replace: true })}
              className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm transition-colors"
            >
              {t('common.back', 'Retour')}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
