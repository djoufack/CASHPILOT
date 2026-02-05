import React, { useEffect } from 'react';
import { useAnomalyDetection } from '@/hooks/useAnomalyDetection';
import { AlertTriangle, X, RefreshCw, ShieldAlert, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const severityColors = {
  critical: 'border-red-500 bg-red-500/10 text-red-200',
  high: 'border-orange-500 bg-orange-500/10 text-orange-200',
  medium: 'border-yellow-500 bg-yellow-500/10 text-yellow-200',
  low: 'border-blue-500 bg-blue-500/10 text-blue-200',
};

const AnomalyAlerts = ({ autoScan = false }) => {
  const { anomalies, loading, lastScan, detectAnomalies, dismissAnomaly } = useAnomalyDetection();

  useEffect(() => {
    if (autoScan) detectAnomalies();
  }, [autoScan, detectAnomalies]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-5 h-5 text-orange-400" />
          <h3 className="text-lg font-semibold text-white">Détection d'anomalies</h3>
          {anomalies.length > 0 && (
            <span className="bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full">
              {anomalies.length}
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={detectAnomalies}
          disabled={loading}
          className="text-gray-400 hover:text-white"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          <span className="ml-1 text-sm">Scanner</span>
        </Button>
      </div>

      {lastScan && (
        <p className="text-xs text-gray-500">
          Dernier scan: {new Date(lastScan).toLocaleString('fr-FR')}
        </p>
      )}

      {anomalies.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-500">
          <ShieldAlert className="w-10 h-10 mx-auto mb-2 text-green-500/50" />
          <p className="text-sm">Aucune anomalie détectée</p>
        </div>
      )}

      <div className="space-y-2">
        {anomalies.map((anomaly, index) => (
          <div
            key={index}
            className={`border rounded-lg p-3 ${severityColors[anomaly.severity] || severityColors.low}`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-sm">{anomaly.title}</p>
                  <p className="text-xs mt-1 opacity-80">{anomaly.description}</p>
                  {anomaly.amount && (
                    <p className="text-xs mt-1 font-mono">{anomaly.amount.toFixed(2)}&euro;</p>
                  )}
                </div>
              </div>
              <button onClick={() => dismissAnomaly(index)} className="opacity-60 hover:opacity-100">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AnomalyAlerts;
