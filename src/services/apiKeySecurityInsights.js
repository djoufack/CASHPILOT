const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toDate = (value) => {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return null;
  return date;
};

export function buildApiKeySecurityInsights({ apiKeys = [], usageLogs = [], policy = {}, now = new Date() } = {}) {
  const keys = Array.isArray(apiKeys) ? apiKeys : [];
  const logs = Array.isArray(usageLogs) ? usageLogs : [];

  const rotationDays = Math.max(1, toNumber(policy.rotation_days, 90));
  const hourlyCallThreshold = Math.max(1, toNumber(policy.anomaly_hourly_call_threshold, 250));
  const errorRateThreshold = Math.max(1, toNumber(policy.anomaly_error_rate_threshold, 20));
  const currentDate = toDate(now) || new Date();
  const oneHourAgo = new Date(currentDate.getTime() - HOUR_MS);

  const rotationDue = keys.filter((key) => {
    const keyDate = toDate(key.created_at);
    if (!keyDate) return false;
    const ageDays = (currentDate.getTime() - keyDate.getTime()) / DAY_MS;
    return ageDays >= rotationDays;
  });

  const anomalies = [];
  for (const key of keys) {
    const keyLogs = logs.filter((log) => log.api_key_id === key.id);
    const recentLogs = keyLogs.filter((log) => {
      const logDate = toDate(log.created_at);
      return logDate && logDate >= oneHourAgo;
    });

    if (recentLogs.length > hourlyCallThreshold) {
      anomalies.push({
        apiKeyId: key.id,
        keyName: key.name || key.key_prefix || key.id,
        keyPrefix: key.key_prefix || null,
        reason: `Volume horaire eleve (${recentLogs.length}/${hourlyCallThreshold})`,
      });
      continue;
    }

    if (recentLogs.length > 0) {
      const errorCount = recentLogs.filter((log) => Number(log.status_code) >= 500).length;
      const errorRate = (errorCount / recentLogs.length) * 100;
      if (errorRate >= errorRateThreshold) {
        anomalies.push({
          apiKeyId: key.id,
          keyName: key.name || key.key_prefix || key.id,
          keyPrefix: key.key_prefix || null,
          reason: `Taux d erreur eleve (${errorRate.toFixed(1)}%)`,
        });
      }
    }
  }

  let status = 'ready';
  if (rotationDue.length > 0 || anomalies.length > 0) {
    status = 'attention';
  }
  if (anomalies.length > 0 && rotationDue.length > 0) {
    status = 'critical';
  }

  const recommendations = [];
  if (rotationDue.length > 0) {
    recommendations.push('Faire une rotation des cles API arrivees a echeance.');
  }
  if (anomalies.length > 0) {
    recommendations.push('Analyser les cles en anomalie et ajuster leurs scopes/rate-limits.');
  }

  return {
    totalKeyCount: keys.length,
    rotationDueCount: rotationDue.length,
    anomalyCount: anomalies.length,
    rotationDue,
    anomalies,
    status,
    recommendations,
  };
}

export default buildApiKeySecurityInsights;
