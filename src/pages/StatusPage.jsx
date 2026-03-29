import { useEffect, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { CheckCircle, AlertTriangle, XCircle, RefreshCw, Wallet, ExternalLink } from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const REFRESH_INTERVAL_MS = 60_000;

const COMPONENTS = [
  {
    key: 'webapp',
    labelKey: 'status.components.webapp',
    url: 'https://cashpilot.tech',
    method: 'GET',
    // 200 = up
    isUp: (status) => status >= 200 && status < 400,
  },
  {
    key: 'api',
    labelKey: 'status.components.api',
    url: 'https://cashpilot.tech/api/v1/health',
    method: 'GET',
    // 200 or 401 = up (endpoint exists but requires auth)
    isUp: (status) => status === 200 || status === 401 || status === 405,
  },
  {
    key: 'database',
    labelKey: 'status.components.database',
    // Supabase health endpoint — no auth required
    url: 'https://rfzvrezrcigzmldgvntz.supabase.co/rest/v1/',
    method: 'GET',
    isUp: (status) => status >= 200 && status < 500,
  },
  {
    key: 'mcp',
    labelKey: 'status.components.mcp',
    url: 'https://cashpilot.tech/mcp',
    method: 'OPTIONS',
    // 405 Method Not Allowed = server is up but OPTIONS not supported for MCP
    isUp: (status) => status === 200 || status === 405 || status === 204,
  },
];

// ---------------------------------------------------------------------------
// Helper — check a single component
// ---------------------------------------------------------------------------
async function checkComponent(component) {
  const start = Date.now();
  try {
    const res = await fetch(component.url, {
      method: component.method,
      // no-cors can't read status → use cors; catch network errors as down
      mode: 'cors',
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    });
    const latency = Date.now() - start;
    const up = component.isUp(res.status);
    return {
      key: component.key,
      status: up ? 'operational' : 'degraded',
      latency,
      httpStatus: res.status,
    };
  } catch {
    return {
      key: component.key,
      status: 'down',
      latency: null,
      httpStatus: null,
    };
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
const StatusBadge = ({ status }) => {
  const { t } = useTranslation();
  const cfg = {
    operational: {
      icon: <CheckCircle className="w-5 h-5" />,
      label: t('status.states.operational'),
      classes: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30',
      dot: 'bg-emerald-400',
    },
    degraded: {
      icon: <AlertTriangle className="w-5 h-5" />,
      label: t('status.states.degraded'),
      classes: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
      dot: 'bg-yellow-400',
    },
    down: {
      icon: <XCircle className="w-5 h-5" />,
      label: t('status.states.down'),
      classes: 'bg-red-500/15 text-red-400 border border-red-500/30',
      dot: 'bg-red-400',
    },
    checking: {
      icon: <RefreshCw className="w-5 h-5 animate-spin" />,
      label: t('status.states.checking'),
      classes: 'bg-gray-700/50 text-gray-400 border border-gray-600/30',
      dot: 'bg-gray-400 animate-pulse',
    },
  };
  const c = cfg[status] ?? cfg.checking;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${c.classes}`}>
      {c.icon}
      {c.label}
    </span>
  );
};

const ComponentRow = ({ component, result }) => {
  const { t } = useTranslation();
  const status = result?.status ?? 'checking';

  return (
    <div className="flex items-center justify-between py-4 px-5 rounded-xl bg-gray-800/50 border border-gray-700/50 hover:bg-gray-800/70 transition-colors">
      <div className="flex items-center gap-3">
        <div
          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            status === 'operational'
              ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
              : status === 'degraded'
                ? 'bg-yellow-400 shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                : status === 'down'
                  ? 'bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.6)]'
                  : 'bg-gray-500 animate-pulse'
          }`}
        />
        <span className="text-gray-200 font-medium">{t(component.labelKey)}</span>
      </div>
      <div className="flex items-center gap-4">
        {result?.latency != null && <span className="text-xs text-gray-500 tabular-nums">{result.latency} ms</span>}
        <StatusBadge status={status} />
      </div>
    </div>
  );
};

const GlobalBanner = ({ overallStatus }) => {
  const { t } = useTranslation();
  if (overallStatus === 'checking') {
    return (
      <div className="rounded-2xl px-6 py-5 bg-gray-800/60 border border-gray-700/50 flex items-center gap-3">
        <RefreshCw className="w-6 h-6 text-gray-400 animate-spin flex-shrink-0" />
        <span className="text-lg font-semibold text-gray-300">{t('status.checking')}</span>
      </div>
    );
  }
  if (overallStatus === 'operational') {
    return (
      <div className="rounded-2xl px-6 py-5 bg-emerald-500/10 border border-emerald-500/30 flex items-center gap-3">
        <CheckCircle className="w-7 h-7 text-emerald-400 flex-shrink-0" />
        <span className="text-lg font-semibold text-emerald-300">{t('status.allOperational')}</span>
      </div>
    );
  }
  if (overallStatus === 'degraded') {
    return (
      <div className="rounded-2xl px-6 py-5 bg-yellow-500/10 border border-yellow-500/30 flex items-center gap-3">
        <AlertTriangle className="w-7 h-7 text-yellow-400 flex-shrink-0" />
        <span className="text-lg font-semibold text-yellow-300">{t('status.partialOutage')}</span>
      </div>
    );
  }
  return (
    <div className="rounded-2xl px-6 py-5 bg-red-500/10 border border-red-500/30 flex items-center gap-3">
      <XCircle className="w-7 h-7 text-red-400 flex-shrink-0" />
      <span className="text-lg font-semibold text-red-300">{t('status.majorOutage')}</span>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function StatusPage() {
  const { t } = useTranslation();

  const [results, setResults] = useState({}); // { [key]: { status, latency, httpStatus } }
  const [lastChecked, setLastChecked] = useState(null); // Date
  const [secondsAgo, setSecondsAgo] = useState(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Run all checks in parallel
  const runChecks = useCallback(async () => {
    setIsRefreshing(true);
    const checks = await Promise.all(COMPONENTS.map(checkComponent));
    const map = {};
    checks.forEach((r) => {
      map[r.key] = r;
    });
    setResults(map);
    setLastChecked(new Date());
    setSecondsAgo(0);
    setIsRefreshing(false);
  }, []);

  // Initial check + interval
  useEffect(() => {
    runChecks();
    const interval = setInterval(runChecks, REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [runChecks]);

  // "X seconds ago" ticker
  useEffect(() => {
    if (!lastChecked) return;
    const ticker = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastChecked.getTime()) / 1000));
    }, 1000);
    return () => clearInterval(ticker);
  }, [lastChecked]);

  // Compute overall status
  const overallStatus = (() => {
    const keys = COMPONENTS.map((c) => c.key);
    if (keys.some((k) => !results[k])) return 'checking';
    const statuses = keys.map((k) => results[k].status);
    if (statuses.every((s) => s === 'operational')) return 'operational';
    if (statuses.some((s) => s === 'down')) return 'down';
    return 'degraded';
  })();

  return (
    <>
      <Helmet>
        <title>{t('status.pageTitle')} — CashPilot</title>
        <meta name="description" content={t('status.metaDescription')} />
      </Helmet>

      <div className="min-h-screen bg-gray-950 text-gray-100">
        {/* ── Header ─────────────────────────────────────────────── */}
        <header className="border-b border-gray-800/60 bg-gray-900/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
            <Link to="/" className="flex items-center gap-2 text-gray-100 hover:text-white transition-colors">
              <Wallet className="w-6 h-6 text-orange-400" />
              <span className="font-bold text-lg">CashPilot</span>
            </Link>
            <span className="text-sm font-medium text-gray-400">{t('status.pageTitle')}</span>
          </div>
        </header>

        {/* ── Main ───────────────────────────────────────────────── */}
        <main className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-8">
          {/* Global banner */}
          <GlobalBanner overallStatus={overallStatus} />

          {/* Components section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-300 uppercase tracking-wider">
                {t('status.components.title')}
              </h2>
              <button
                onClick={runChecks}
                disabled={isRefreshing}
                className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-200 transition-colors disabled:opacity-50"
                aria-label={t('status.refresh')}
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {t('status.refresh')}
              </button>
            </div>
            <div className="space-y-2">
              {COMPONENTS.map((comp) => (
                <ComponentRow key={comp.key} component={comp} result={results[comp.key]} />
              ))}
            </div>
          </section>

          {/* Last checked */}
          {secondsAgo !== null && (
            <p className="text-center text-xs text-gray-500">{t('status.lastChecked', { seconds: secondsAgo })}</p>
          )}

          {/* Incidents */}
          <section>
            <h2 className="text-base font-semibold text-gray-300 uppercase tracking-wider mb-4">
              {t('status.incidents.title')}
            </h2>
            <div className="rounded-xl bg-gray-800/30 border border-gray-700/40 px-6 py-8 text-center">
              <CheckCircle className="w-8 h-8 text-emerald-400 mx-auto mb-3 opacity-70" />
              <p className="text-gray-400 text-sm">{t('status.incidents.none')}</p>
            </div>
          </section>

          {/* Back to app */}
          <div className="text-center pt-2">
            <Link
              to="/"
              className="inline-flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              {t('status.backToApp')}
            </Link>
          </div>
        </main>

        {/* ── Footer ─────────────────────────────────────────────── */}
        <footer className="border-t border-gray-800/60 mt-16 py-6">
          <p className="text-center text-xs text-gray-600">
            © 2026 CashPilot — {t('status.autoRefresh', { seconds: REFRESH_INTERVAL_MS / 1000 })}
          </p>
        </footer>
      </div>
    </>
  );
}
