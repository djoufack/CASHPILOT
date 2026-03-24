import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { useBankConnections } from '@/hooks/useBankConnections';
import { clearPendingBankConnection, getPendingBankConnection } from '@/utils/bankConnectionRedirect';
import { Button } from '@/components/ui/button';

const BankCallbackPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { completeConnection } = useBankConnections();
  const [state, setState] = useState({
    status: 'loading',
    title: t('bankCallback.connecting', 'Bank connection in progress'),
    description: t('bankCallback.connectingDesc', 'Finalizing GoCardless authorization and initial sync...'),
  });

  useEffect(() => {
    let active = true;

    const finalizeConnection = async () => {
      const error = searchParams.get('error');
      const details = searchParams.get('details');

      if (error) {
        clearPendingBankConnection();
        if (!active) {
          return;
        }

        setState({
          status: 'error',
          title: t('bankCallback.interrupted', 'Bank connection interrupted'),
          description: details || error,
        });
        return;
      }

      const pendingConnection = getPendingBankConnection();
      if (!pendingConnection?.requisitionId) {
        if (!active) {
          return;
        }

        setState({
          status: 'error',
          title: t('bankCallback.requestNotFound', 'Bank request not found'),
          description: t(
            'bankCallback.requestNotFoundDesc',
            'The connection request was not found in this session. Restart the connection from CashPilot.'
          ),
        });
        return;
      }

      try {
        const result = await completeConnection(pendingConnection.requisitionId, pendingConnection.companyId || null);
        clearPendingBankConnection();

        if (!active) {
          return;
        }

        const accountsCount = Array.isArray(result?.accounts) ? result.accounts.length : 0;
        const syncedCount = (result?.accounts || []).reduce(
          (sum, account) => sum + Number(account?.sync?.synced || 0),
          0
        );
        const returnPath =
          typeof pendingConnection?.returnPath === 'string' ? pendingConnection.returnPath : '/app/bank-connections';

        setState({
          status: 'success',
          title: t('bankCallback.connected', 'Bank connected'),
          description: t(
            'bankCallback.connectedDesc',
            '{{accounts}} account(s) linked, {{synced}} transaction(s) synced.',
            { accounts: accountsCount, synced: syncedCount }
          ),
        });

        window.setTimeout(() => {
          navigate(`${returnPath}?linked=1&accounts=${accountsCount}&synced=${syncedCount}`, {
            replace: true,
          });
        }, 1200);
      } catch (err) {
        clearPendingBankConnection();
        if (!active) {
          return;
        }

        setState({
          status: 'error',
          title: t('bankCallback.failed', 'Bank connection failed'),
          description: err?.message || t('bankCallback.failedDesc', 'The bank connection finalization failed.'),
        });
      }
    };

    finalizeConnection();

    return () => {
      active = false;
    };
  }, [completeConnection, navigate, searchParams, t]);

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-gray-950 px-4 py-10">
      <Helmet>
        <title>{t('bankCallback.title', 'Bank Connection')} | CashPilot</title>
      </Helmet>
      <div className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-gray-800 bg-gray-900/70 p-8 text-center shadow-xl">
        {state.status === 'loading' && <Loader2 className="mb-4 h-10 w-10 animate-spin text-orange-400" />}
        {state.status === 'success' && <CheckCircle2 className="mb-4 h-10 w-10 text-green-400" />}
        {state.status === 'error' && <AlertTriangle className="mb-4 h-10 w-10 text-red-400" />}

        <h1 className="text-2xl font-semibold text-white">{state.title}</h1>
        <p className="mt-3 max-w-md text-sm text-gray-400">{state.description}</p>

        {state.status !== 'loading' && (
          <div className="mt-6 flex gap-3">
            <Button
              onClick={() => navigate('/app/bank-connections', { replace: true })}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {t('bankCallback.backToConnections', 'Back to bank connections')}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BankCallbackPage;
