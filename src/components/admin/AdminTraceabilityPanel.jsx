import { useMemo, useState } from 'react';
import { ShieldCheck, RefreshCw, Search } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAdminTraceability } from '@/hooks/useAdminTraceability';
import { buildAdminTraceabilityInsights } from '@/services/adminTraceabilityInsights';

const severityBadgeClass = {
  info: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  warning: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  critical: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const statusBadgeClass = {
  success: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  partial: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  failure: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const boardStatusClass = {
  ready: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  attention: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  critical: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString();
};

const AdminTraceabilityPanel = () => {
  const { traces, loading, error, refresh } = useAdminTraceability();
  const [searchTerm, setSearchTerm] = useState('');
  const [severityFilter, setSeverityFilter] = useState('all');

  const insights = useMemo(() => buildAdminTraceabilityInsights(traces), [traces]);

  const filteredTraces = useMemo(() => {
    const normalizedSearch = String(searchTerm || '')
      .trim()
      .toLowerCase();
    return traces.filter((entry) => {
      const matchesSeverity =
        severityFilter === 'all' || String(entry?.severity || '').toLowerCase() === severityFilter;
      if (!matchesSeverity) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }

      return [
        entry.action,
        entry.resource,
        entry.actor_name,
        entry.user_id,
        entry.correlation_id,
        entry.operation_status,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(normalizedSearch));
    });
  }, [searchTerm, severityFilter, traces]);

  return (
    <Card className="bg-gray-900 border-gray-800" data-testid="admin-traceability-panel">
      <CardHeader className="space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-300" />
              Tracabilite admin renforcee
            </CardTitle>
            <p className="text-sm text-gray-400 mt-1">
              Journal detaille des operations admin avec correlation et niveau de criticite.
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
          <TraceKpi label="Traces" value={insights.totalCount} hint="200 dernieres" />
          <TraceKpi label="Critiques" value={insights.criticalCount} hint="haute priorite" />
          <TraceKpi label="Echecs" value={insights.failureCount} hint="operation_status=failure" />
          <TraceKpi label="Succes" value={`${insights.successRatePct.toFixed(1)}%`} hint="taux de succes" />
        </div>

        <div className="rounded-xl border border-gray-700 bg-gray-950/50 p-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-300">Etat:</span>
            <Badge className={boardStatusClass[insights.status] || boardStatusClass.attention}>{insights.status}</Badge>
          </div>
          {insights.recommendations.length > 0 && (
            <ul className="mt-2 text-xs text-gray-400 space-y-1">
              {insights.recommendations.map((entry) => (
                <li key={entry}>- {entry}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="grid gap-3 md:grid-cols-[1fr_160px]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <Input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Rechercher action, ressource, correlation, acteur..."
              className="pl-10 bg-gray-950 border-gray-800 text-white"
            />
          </div>
          <select
            value={severityFilter}
            onChange={(event) => setSeverityFilter(event.target.value)}
            className="rounded-md border border-gray-700 bg-gray-950 px-2 py-2 text-sm text-gray-200"
          >
            <option value="all">Toutes severites</option>
            <option value="info">info</option>
            <option value="warning">warning</option>
            <option value="critical">critical</option>
          </select>
        </div>

        {error && (
          <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">
            Erreur chargement traceabilite: {error}
          </div>
        )}
      </CardHeader>

      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                {['Timestamp', 'Action', 'Ressource', 'Acteur', 'Severite', 'Statut', 'Correlation'].map((header) => (
                  <th
                    key={header}
                    className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wide"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {filteredTraces.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-gray-500">
                    Aucune trace admin disponible pour les filtres actifs.
                  </td>
                </tr>
              ) : (
                filteredTraces.map((entry) => (
                  <tr key={entry.id} className="hover:bg-gray-800/40 align-top">
                    <td className="py-3 px-4 text-gray-300">{formatDateTime(entry.created_at)}</td>
                    <td className="py-3 px-4 text-gray-100">{entry.action}</td>
                    <td className="py-3 px-4 text-gray-300">{entry.resource}</td>
                    <td className="py-3 px-4">
                      <div className="text-gray-100">{entry.actor_name || 'Utilisateur'}</div>
                      <div className="text-xs text-gray-500 mt-1">{entry.user_id}</div>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={severityBadgeClass[entry.severity] || severityBadgeClass.info}>
                        {entry.severity || 'info'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      <Badge className={statusBadgeClass[entry.operation_status] || statusBadgeClass.success}>
                        {entry.operation_status || 'success'}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-xs text-gray-400">{entry.correlation_id || '-'}</td>
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

const TraceKpi = ({ label, value, hint }) => (
  <div className="rounded-xl border border-gray-800 bg-gray-950/60 p-3">
    <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
    <p className="text-xl font-semibold text-white mt-1">{value}</p>
    <p className="text-xs text-gray-500 mt-1">{hint}</p>
  </div>
);

export default AdminTraceabilityPanel;
