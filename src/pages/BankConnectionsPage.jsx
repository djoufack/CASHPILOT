import React, { useState } from 'react';
import { useBankConnections } from '@/hooks/useBankConnections';
import { Building2, Plus, Trash2, RefreshCw, Loader2, CheckCircle2, XCircle, Clock, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';

const statusConfig = {
  active: { color: 'text-green-400 bg-green-500/10', icon: CheckCircle2, label: 'Connecté' },
  pending: { color: 'text-yellow-400 bg-yellow-500/10', icon: Clock, label: 'En attente' },
  expired: { color: 'text-red-400 bg-red-500/10', icon: XCircle, label: 'Expiré' },
  revoked: { color: 'text-gray-400 bg-gray-500/10', icon: XCircle, label: 'Déconnecté' },
  error: { color: 'text-red-400 bg-red-500/10', icon: XCircle, label: 'Erreur' },
};

const BankConnectionsPage = () => {
  const { connections, loading, initiateConnection, disconnectBank, totalBalance, refresh } = useBankConnections();
  const { t } = useTranslation();
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      // Default to Belgian banks - could add institution picker later
      await initiateConnection('SANDBOXFINANCE_SFIN0000');
    } catch (err) {
      console.error('Connection error:', err);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-7 h-7 text-orange-400" />
            Connexions Bancaires
          </h1>
          <p className="text-gray-400 text-sm mt-1">Connectez vos comptes bancaires via GoCardless</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" onClick={refresh} className="text-gray-400 hover:text-white">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button onClick={handleConnect} disabled={connecting} className="bg-orange-500 hover:bg-orange-600">
            {connecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
            Connecter une banque
          </Button>
        </div>
      </div>

      {/* Total balance card */}
      <div className="bg-gradient-to-r from-orange-500/10 to-amber-500/10 border border-orange-500/20 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <Wallet className="w-8 h-8 text-orange-400" />
          <div>
            <p className="text-sm text-gray-400">Solde total</p>
            <p className="text-3xl font-bold text-white">{totalBalance.toFixed(2)} €</p>
          </div>
        </div>
      </div>

      {/* Connections list */}
      {loading ? (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-orange-400 mx-auto" />
        </div>
      ) : connections.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Building2 className="w-16 h-16 mx-auto mb-4 text-gray-700" />
          <p className="text-lg">Aucune banque connectée</p>
          <p className="text-sm mt-1">Connectez votre premier compte pour synchroniser vos transactions</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {connections.map(conn => {
            const status = statusConfig[conn.status] || statusConfig.error;
            const StatusIcon = status.icon;
            return (
              <div key={conn.id} className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-gray-400" />
                  </div>
                  <div>
                    <h3 className="text-white font-medium">{conn.institution_name || conn.account_name || 'Compte bancaire'}</h3>
                    <p className="text-sm text-gray-400">{conn.account_iban || 'IBAN non disponible'}</p>
                    <div className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full mt-1 ${status.color}`}>
                      <StatusIcon className="w-3 h-3" />
                      {status.label}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  {conn.account_balance != null && (
                    <p className={`text-lg font-semibold ${conn.account_balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {conn.account_balance.toFixed(2)} {conn.account_currency || '€'}
                    </p>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => disconnectBank(conn.id)}
                    className="text-gray-500 hover:text-red-400"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default BankConnectionsPage;
