import { useTranslation } from 'react-i18next';
import { RefreshCw } from 'lucide-react';

const statusBadge = {
  draft: 'bg-yellow-500/20 text-yellow-300',
  applied: 'bg-green-500/20 text-green-300',
  reversed: 'bg-red-500/20 text-red-300',
};

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const EliminationSummary = ({ eliminations, loading }) => {
  const { t } = useTranslation();

  if (loading && (!eliminations || eliminations.length === 0)) {
    return (
      <div className="flex items-center justify-center py-8 text-gray-400 text-sm">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
        {t('loading.data', 'Chargement...')}
      </div>
    );
  }

  if (!eliminations || eliminations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400 text-sm">
        {t('intercompany.eliminations.empty', 'Aucune elimination enregistree.')}
      </div>
    );
  }

  // Summary
  const totalEliminated = eliminations.reduce((sum, e) => sum + (Number(e.eliminated_amount) || 0), 0);
  const totalEntries = eliminations.reduce((sum, e) => sum + (Number(e.entries_count) || 0), 0);

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-[#141c33]/60 rounded-xl border border-white/10 p-4">
          <p className="text-xs text-gray-400 mb-1">
            {t('intercompany.eliminations.totalEliminated', 'Total elimine')}
          </p>
          <p className="text-lg font-bold text-white font-mono">{formatCurrency(totalEliminated)} EUR</p>
        </div>
        <div className="bg-[#141c33]/60 rounded-xl border border-white/10 p-4">
          <p className="text-xs text-gray-400 mb-1">
            {t('intercompany.eliminations.totalEntries', 'Ecritures eliminees')}
          </p>
          <p className="text-lg font-bold text-white font-mono">{totalEntries}</p>
        </div>
        <div className="bg-[#141c33]/60 rounded-xl border border-white/10 p-4">
          <p className="text-xs text-gray-400 mb-1">
            {t('intercompany.eliminations.periodsCount', 'Periodes traitees')}
          </p>
          <p className="text-lg font-bold text-white font-mono">{eliminations.length}</p>
        </div>
      </div>

      {/* Breakdown table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left text-gray-400 font-medium py-2 px-3">
                {t('intercompany.eliminations.period', 'Periode')}
              </th>
              <th className="text-right text-gray-400 font-medium py-2 px-3">
                {t('intercompany.eliminations.amount', 'Montant')}
              </th>
              <th className="text-right text-gray-400 font-medium py-2 px-3">
                {t('intercompany.eliminations.entries', 'Ecritures')}
              </th>
              <th className="text-center text-gray-400 font-medium py-2 px-3">{t('common.status', 'Statut')}</th>
              <th className="text-right text-gray-400 font-medium py-2 px-3">
                {t('intercompany.eliminations.createdAt', 'Date')}
              </th>
            </tr>
          </thead>
          <tbody>
            {eliminations.map((elim) => {
              const badge = statusBadge[elim.status] || statusBadge.draft;
              return (
                <tr key={elim.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                  <td className="py-2 px-3 text-white">
                    {new Date(elim.period_start).toLocaleDateString('fr-FR')}
                    {' - '}
                    {new Date(elim.period_end).toLocaleDateString('fr-FR')}
                  </td>
                  <td className="py-2 px-3 text-right text-white font-mono">
                    {formatCurrency(elim.eliminated_amount)} EUR
                  </td>
                  <td className="py-2 px-3 text-right text-gray-300 font-mono">{elim.entries_count}</td>
                  <td className="py-2 px-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${badge}`}>
                      {t(`intercompany.eliminationStatus.${elim.status}`, elim.status)}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-right text-gray-400 text-xs">
                    {new Date(elim.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                    })}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EliminationSummary;
