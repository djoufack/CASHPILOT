import { useMemo, useState } from 'react';
import { Activity, RefreshCw } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useAdminOperationalHealth } from '@/hooks/useAdminOperationalHealth';
import { buildAdminOperationalHealthInsights } from '@/services/adminOperationalHealthInsights';

const STATUS_OPTIONS = ['healthy', 'degraded', 'down', 'unknown'];

const statusBadgeClass = {
  healthy: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  degraded: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  down: 'bg-red-500/20 text-red-300 border-red-500/30',
  unknown: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
};

const boardStatusClass = {
  ready: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  attention: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  critical: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const boardStatusText = {
  ready: 'Stable',
  attention: 'A surveiller',
  critical: 'Critique',
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString();
};

const AdminOperationalHealthPanel = () => {
  const { edgeFunctions, webhookSummary, loading, error, refresh, updateEdgeStatus } = useAdminOperationalHealth();
  const [pendingEdgeId, setPendingEdgeId] = useState(null);

  const insights = useMemo(
    () =>
      buildAdminOperationalHealthInsights({
        edgeFunctions,
        webhookSummary,
      }),
    [edgeFunctions, webhookSummary]
  );

  const applyStatus = async (edgeId, status) => {
    setPendingEdgeId(edgeId);
    try {
      await updateEdgeStatus(edgeId, status);
    } finally {
      setPendingEdgeId(null);
    }
  };

  return (
    <Card className="bg-gray-900 border-gray-800" data-testid="admin-operational-health-panel">
      <CardHeader className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="w-5 h-5 text-cyan-300" />
              Sante operationnelle (Edge + webhooks)
            </CardTitle>
            <p className="text-sm text-gray-400 mt-1">
              Consolide la disponibilite des fonctions Edge et la fiabilite des livraisons webhook.
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
          <HealthKpi label="Edge functions" value={insights.totalFunctions} hint="en supervision" />
          <HealthKpi label="Disponibilite" value={`${insights.availabilityPct.toFixed(1)}%`} hint="healthy ratio" />
          <HealthKpi label="Webhooks 24h" value={insights.deliveryTotal24h} hint="livraisons" />
          <HealthKpi
            label="Succes webhook"
            value={`${insights.webhookSuccessRatePct.toFixed(1)}%`}
            hint={`${insights.deliveryFailure24h} echecs`}
          />
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-950/50 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-gray-300">Etat global:</span>
            <Badge className={boardStatusClass[insights.status] || boardStatusClass.attention}>
              {boardStatusText[insights.status] || boardStatusText.attention}
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

        <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-4">
          <p className="text-sm font-medium text-gray-200">Webhooks (24h)</p>
          <div className="mt-2 grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
            <WebhookMetric label="Endpoints" value={webhookSummary.totalEndpoints} />
            <WebhookMetric label="Actifs" value={webhookSummary.activeEndpoints} />
            <WebhookMetric label="Echecs 24h" value={webhookSummary.deliveryFailure24h} />
            <WebhookMetric label="Failure count cumule" value={webhookSummary.totalFailureCount} />
            <WebhookMetric label="Dernier trigger" value={formatDateTime(webhookSummary.lastTriggeredAt)} />
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            Erreur chargement sante operationnelle: {error}
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {['Function', 'Etat', 'Latence', 'Erreur', 'Succes', 'Dernier check', 'Action'].map((header, index) => (
                  <th
                    key={header}
                    className={`py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide ${index === 6 ? 'text-right' : 'text-left'}`}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {edgeFunctions.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    Aucun registre Edge function disponible pour cette societe.
                  </td>
                </tr>
              ) : (
                edgeFunctions.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-800/40 align-top">
                    <td className="py-3 px-4">
                      <p className="text-sm font-medium text-gray-100">{entry.function_name}</p>
                      <p className="text-xs text-gray-500 mt-1">{entry.check_source || 'synthetic'}</p>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={statusBadgeClass[entry.status] || statusBadgeClass.unknown}>
                        {entry.status || 'unknown'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-gray-300">{entry.avg_latency_ms ?? 0} ms</td>
                    <td className="py-3 px-4 text-gray-300">{Number(entry.error_rate_pct || 0).toFixed(2)}%</td>
                    <td className="py-3 px-4 text-gray-400 text-xs">{formatDateTime(entry.last_success_at)}</td>
                    <td className="py-3 px-4 text-gray-400 text-xs">{formatDateTime(entry.last_checked_at)}</td>
                    <td className="py-3 px-4">
                      <div className="flex justify-end">
                        <select
                          value={entry.status || 'unknown'}
                          onChange={(event) => applyStatus(entry.id, event.target.value)}
                          disabled={pendingEdgeId === entry.id}
                          className="rounded-md border border-gray-700 bg-gray-950 px-2 py-1 text-xs text-gray-200"
                        >
                          {STATUS_OPTIONS.map((status) => (
                            <option key={`${entry.id}-${status}`} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};

const HealthKpi = ({ label, value, hint }) => (
  <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
    <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
    <p className="text-xl font-semibold text-white mt-1">{value}</p>
    <p className="text-xs text-gray-500 mt-1">{hint}</p>
  </div>
);

const WebhookMetric = ({ label, value }) => (
  <div className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-2">
    <p className="text-[11px] uppercase tracking-wide text-gray-500">{label}</p>
    <p className="text-sm text-gray-200 mt-1">{value}</p>
  </div>
);

export default AdminOperationalHealthPanel;
