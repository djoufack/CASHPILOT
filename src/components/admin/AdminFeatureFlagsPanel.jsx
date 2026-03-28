import { useMemo, useState } from 'react';
import { SlidersHorizontal, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAdminFeatureFlags } from '@/hooks/useAdminFeatureFlags';
import { buildAdminFeatureFlagInsights } from '@/services/adminFeatureFlagInsights';

const ROLLOUT_OPTIONS = [25, 50, 75, 100];

const formatDateTime = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString();
};

const statusBadgeClass = {
  ready: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  attention: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  critical: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const statusText = {
  ready: 'Stable',
  attention: 'Sous surveillance',
  critical: 'Action requise',
};

const enabledBadgeClass = {
  true: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  false: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

const AdminFeatureFlagsPanel = () => {
  const { flags, loading, error, refresh, toggleFlag, setRolloutPercentage } = useAdminFeatureFlags();
  const [pendingFlagId, setPendingFlagId] = useState(null);

  const insights = useMemo(() => buildAdminFeatureFlagInsights(flags), [flags]);

  const updateFlag = async (flagId, action) => {
    setPendingFlagId(flagId);
    try {
      await action();
    } finally {
      setPendingFlagId(null);
    }
  };

  return (
    <Card className="bg-gray-900 border-gray-800" data-testid="admin-feature-flags-panel">
      <CardHeader className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-orange-300" />
              Feature flags admin
            </CardTitle>
            <p className="text-sm text-gray-400 mt-1">
              Activez progressivement les fonctions sensibles par module et suivez le niveau de couverture.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={refresh}
            disabled={loading}
            className="border-gray-700 text-gray-300 hover:bg-gray-800"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <FeatureFlagKpi label="Flags" value={insights.totalCount} hint="catalogue actif" />
          <FeatureFlagKpi label="Actifs" value={insights.enabledCount} hint="flags actives" />
          <FeatureFlagKpi label="Inactifs" value={insights.disabledCount} hint="flags desactivees" />
          <FeatureFlagKpi label="Rollout moyen" value={`${insights.rolloutAverage.toFixed(1)}%`} hint="couverture" />
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-950/50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-300">Etat:</span>
            <Badge className={statusBadgeClass[insights.status] || statusBadgeClass.attention}>
              {statusText[insights.status] || statusText.attention}
            </Badge>
          </div>
          {insights.recommendations.length > 0 && (
            <ul className="mt-2 text-xs text-gray-400 space-y-1">
              {insights.recommendations.map((entry) => (
                <li key={entry}>- {entry}</li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            Erreur chargement feature flags: {error}
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {['Flag', 'Zone', 'Rollout', 'Etat', 'Dernier changement', 'Actions'].map((header, index) => (
                  <th
                    key={header}
                    className={`py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide ${index === 5 ? 'text-right' : 'text-left'}`}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {flags.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    Aucun feature flag configure pour cette societe.
                  </td>
                </tr>
              ) : (
                flags.map((flag) => {
                  const pending = pendingFlagId === flag.id;
                  return (
                    <tr key={flag.id} className="hover:bg-gray-800/40 align-top">
                      <td className="py-3 px-4">
                        <p className="text-sm font-medium text-gray-100">{flag.flag_name}</p>
                        <p className="text-xs text-gray-500 mt-1">{flag.flag_key}</p>
                        {flag.flag_description && <p className="text-xs text-gray-400 mt-2">{flag.flag_description}</p>}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="border-gray-700 text-gray-300">
                          {flag.target_area || 'admin'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={Number(flag.rollout_percentage || 0)}
                          onChange={(event) =>
                            updateFlag(flag.id, () => setRolloutPercentage(flag.id, Number(event.target.value)))
                          }
                          disabled={pending}
                          className="rounded-md border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-gray-200"
                        >
                          {ROLLOUT_OPTIONS.map((option) => (
                            <option key={`${flag.id}-${option}`} value={option}>
                              {option}%
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4">
                        <Badge className={enabledBadgeClass[String(Boolean(flag.is_enabled))]}>
                          {flag.is_enabled ? 'active' : 'inactive'}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-gray-400 text-xs">{formatDateTime(flag.last_changed_at)}</td>
                      <td className="py-3 px-4">
                        <div className="flex justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={pending}
                            className="border-gray-700 text-gray-300 hover:bg-gray-800"
                            onClick={() => updateFlag(flag.id, () => toggleFlag(flag.id, !flag.is_enabled))}
                          >
                            {flag.is_enabled ? 'Desactiver' : 'Activer'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

const FeatureFlagKpi = ({ label, value, hint }) => (
  <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
    <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
    <p className="text-xl font-semibold text-white mt-1">{value}</p>
    <p className="text-xs text-gray-500 mt-1">{hint}</p>
  </div>
);

export default AdminFeatureFlagsPanel;
