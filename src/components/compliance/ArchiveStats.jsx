import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, Archive, AlertTriangle } from 'lucide-react';

const FORMAT_COLORS = {
  facturx: { bg: 'bg-purple-500', label: 'Factur-X' },
  ubl: { bg: 'bg-blue-500', label: 'UBL' },
  pdf: { bg: 'bg-emerald-500', label: 'PDF' },
};

const ArchiveStats = ({ stats, loading }) => {
  const { t } = useTranslation();

  const formatEntries = useMemo(() => {
    if (!stats?.byFormat) return [];
    return Object.entries(stats.byFormat).map(([format, count]) => ({
      format,
      count,
      config: FORMAT_COLORS[format] || { bg: 'bg-gray-500', label: format },
    }));
  }, [stats?.byFormat]);

  const totalForPie = useMemo(() => formatEntries.reduce((sum, e) => sum + e.count, 0), [formatEntries]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* Total archived */}
      <div className="rounded-xl border border-gray-800 bg-[#0f1528]/80 backdrop-blur-sm p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-500/15">
            <Archive className="h-4.5 w-4.5 text-indigo-300" />
          </div>
          <div>
            <p className="text-xs text-gray-400">{t('compliance.archive.totalArchived')}</p>
            <p className="text-2xl font-bold text-white">{stats?.total || 0}</p>
          </div>
        </div>
      </div>

      {/* Format distribution (div-based pie) */}
      <div className="rounded-xl border border-gray-800 bg-[#0f1528]/80 backdrop-blur-sm p-5">
        <p className="text-xs text-gray-400 mb-3">{t('compliance.archive.byFormat')}</p>
        {formatEntries.length === 0 ? (
          <p className="text-sm text-gray-500">{t('compliance.archive.noArchives')}</p>
        ) : (
          <div className="space-y-2">
            {formatEntries.map(({ format, count, config }) => {
              const pct = totalForPie > 0 ? Math.round((count / totalForPie) * 100) : 0;
              return (
                <div key={format}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${config.bg}`} />
                      <span className="text-xs text-gray-300">{config.label}</span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${config.bg} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Retention status */}
      <div className="rounded-xl border border-gray-800 bg-[#0f1528]/80 backdrop-blur-sm p-5">
        <p className="text-xs text-gray-400 mb-3">{t('compliance.archive.retentionStatus')}</p>
        {(stats?.expiringSoon || 0) > 0 ? (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/15">
              <AlertTriangle className="h-4.5 w-4.5 text-amber-300" />
            </div>
            <div>
              <p className="text-lg font-bold text-amber-300">{stats.expiringSoon}</p>
              <p className="text-xs text-gray-400">{t('compliance.archive.expiringSoon')}</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-emerald-400 text-sm">
            <div className="h-2 w-2 rounded-full bg-emerald-500" />
            {t('compliance.archive.allRetained')}
          </div>
        )}
      </div>
    </div>
  );
};

export default ArchiveStats;
