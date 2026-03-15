import { useState, useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  Users,
  BarChart3,
  RefreshCw,
  ChevronUp,
  ChevronDown,
  Activity,
  Target,
  Briefcase,
} from 'lucide-react';
import { usePeopleAnalytics } from '@/hooks/usePeopleAnalytics';

/* ------------------------------------------------------------------ */
/*  Palette helpers (Design DNA: dark glassmorphism)                   */
/* ------------------------------------------------------------------ */
const card = 'bg-white/5 border border-white/10 rounded-2xl backdrop-blur-md';
const activeTabCls = 'bg-orange-400/20 text-orange-400 border-orange-400/40';
const inactiveTabCls = 'bg-white/5 text-gray-400 border-white/10 hover:bg-white/10 hover:text-gray-200';

/* ------------------------------------------------------------------ */
/*  Tiny reusable bits                                                 */
/* ------------------------------------------------------------------ */
const SectionTitle = ({ icon: Icon, children }) => (
  <h2 className="flex items-center gap-2 text-xl font-semibold text-white mb-4">
    <Icon className="w-5 h-5 text-orange-400" />
    {children}
  </h2>
);

const Spinner = () => (
  <div className="flex items-center justify-center py-12">
    <RefreshCw className="w-6 h-6 text-orange-400 animate-spin" />
  </div>
);

const ErrorBox = ({ message, onRetry }) => (
  <div className="flex flex-col items-center gap-3 py-8 text-red-400">
    <AlertTriangle className="w-6 h-6" />
    <p className="text-sm">{message}</p>
    {onRetry && (
      <button onClick={onRetry} className="text-xs px-3 py-1 rounded bg-white/10 hover:bg-white/15 text-gray-300">
        Réessayer
      </button>
    )}
  </div>
);

const TrendArrow = ({ value }) => {
  if (value > 0) return <TrendingUp className="w-4 h-4 text-red-400" />;
  if (value < 0) return <TrendingDown className="w-4 h-4 text-emerald-400" />;
  return <Minus className="w-4 h-4 text-gray-500" />;
};

/* ------------------------------------------------------------------ */
/*  1. Turnover Risk Heatmap                                           */
/* ------------------------------------------------------------------ */
const riskColor = (score) => {
  if (score <= 30) return 'bg-emerald-500/80 text-emerald-100';
  if (score <= 60) return 'bg-yellow-500/80 text-yellow-100';
  return 'bg-red-500/80 text-red-100';
};

const riskBorder = (score) => {
  if (score <= 30) return 'border-emerald-500/30';
  if (score <= 60) return 'border-yellow-500/30';
  return 'border-red-500/30';
};

const SORT_KEYS = ['name', 'department', 'risk_score'];
const SORT_LABELS = { name: 'Nom', department: 'Département', risk_score: 'Score' };

function TurnoverRiskSection({ state, onRefresh }) {
  const [sortKey, setSortKey] = useState('risk_score');
  const [sortAsc, setSortAsc] = useState(false);

  const employees = useMemo(() => {
    const list = state.data?.employees || state.data?.data?.employees || [];
    const sorted = [...list].sort((a, b) => {
      const aVal = a[sortKey] ?? '';
      const bVal = b[sortKey] ?? '';
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortAsc ? aVal - bVal : bVal - aVal;
      }
      return sortAsc ? String(aVal).localeCompare(String(bVal)) : String(bVal).localeCompare(String(aVal));
    });
    return sorted;
  }, [state.data, sortKey, sortAsc]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortAsc((p) => !p);
    } else {
      setSortKey(key);
      setSortAsc(key !== 'risk_score');
    }
  };

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return null;
    return sortAsc ? <ChevronUp className="w-3 h-3 inline ml-1" /> : <ChevronDown className="w-3 h-3 inline ml-1" />;
  };

  if (state.loading) return <Spinner />;
  if (state.error) return <ErrorBox message={state.error} onRetry={onRefresh} />;
  if (!employees.length) {
    return <p className="text-gray-500 text-sm py-6">Aucune donnée de turnover disponible.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-gray-400 border-b border-white/10">
            {SORT_KEYS.map((k) => (
              <th
                key={k}
                onClick={() => toggleSort(k)}
                className="py-3 px-4 cursor-pointer select-none hover:text-gray-200 transition-colors"
              >
                {SORT_LABELS[k]}
                <SortIcon col={k} />
              </th>
            ))}
            <th className="py-3 px-4">Risque</th>
            <th className="py-3 px-4">Facteurs</th>
          </tr>
        </thead>
        <tbody>
          {employees.map((emp, idx) => (
            <tr key={emp.id ?? idx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
              <td className="py-3 px-4 text-white font-medium">{emp.name || emp.employee_name || '—'}</td>
              <td className="py-3 px-4 text-gray-300">{emp.department || emp.department_name || '—'}</td>
              <td className="py-3 px-4">
                <span
                  className={`inline-flex items-center justify-center w-12 h-7 rounded-md text-xs font-bold ${riskColor(
                    emp.risk_score ?? 0
                  )}`}
                >
                  {emp.risk_score ?? 0}
                </span>
              </td>
              <td className="py-3 px-4">
                <div
                  className={`${card} border ${riskBorder(
                    emp.risk_score ?? 0
                  )} px-3 py-1.5 text-xs text-gray-300 max-w-xs`}
                >
                  {emp.risk_score <= 30 && <span className="text-emerald-400 font-medium">Faible risque</span>}
                  {emp.risk_score > 30 && emp.risk_score <= 60 && (
                    <span className="text-yellow-400 font-medium">Risque modéré</span>
                  )}
                  {emp.risk_score > 60 && <span className="text-red-400 font-medium">Risque élevé</span>}
                  {emp.risk_factors && (
                    <span className="ml-2 text-gray-400">
                      — {Array.isArray(emp.risk_factors) ? emp.risk_factors.join(', ') : emp.risk_factors}
                    </span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  2. Absentéisme                                                     */
/* ------------------------------------------------------------------ */
function AbsenteeismSection({ state, onRefresh }) {
  if (state.loading) return <Spinner />;
  if (state.error) return <ErrorBox message={state.error} onRetry={onRefresh} />;

  const departments = state.data?.departments || state.data?.data?.departments || [];

  if (!departments.length) {
    return <p className="text-gray-500 text-sm py-6">Aucune donnée d'absentéisme disponible.</p>;
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {departments.map((dept, idx) => {
        const rate = dept.current_rate ?? dept.rate ?? 0;
        const forecast = dept.forecast_3m ?? dept.forecast ?? null;
        const trend = dept.trend ?? 0;

        return (
          <div key={dept.department || idx} className={`${card} p-5 flex flex-col gap-3`}>
            <div className="flex items-center justify-between">
              <h3 className="text-white font-medium text-sm truncate">
                {dept.department || dept.department_name || 'Département'}
              </h3>
              <TrendArrow value={trend} />
            </div>

            <div className="flex items-end gap-1">
              <span className="text-3xl font-bold text-white">{typeof rate === 'number' ? rate.toFixed(1) : rate}</span>
              <span className="text-gray-400 text-sm mb-1">%</span>
            </div>

            <p className="text-xs text-gray-400">Taux actuel d'absentéisme</p>

            {forecast !== null && (
              <div className="mt-auto pt-3 border-t border-white/10">
                <p className="text-xs text-gray-500">Prévision 3 mois</p>
                <p className="text-sm text-gray-200 font-medium">
                  {typeof forecast === 'number' ? forecast.toFixed(1) : forecast}%
                </p>
              </div>
            )}

            {typeof trend === 'number' && trend !== 0 && (
              <p className={`text-xs font-medium ${trend > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {trend > 0 ? '+' : ''}
                {trend.toFixed(1)} pts vs mois précédent
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  3. Prévision effectifs                                             */
/* ------------------------------------------------------------------ */
const SCENARIOS = [
  { key: 'optimistic', label: 'Optimiste' },
  { key: 'baseline', label: 'Base' },
  { key: 'pessimistic', label: 'Pessimiste' },
];

function HeadcountSection({ state, fetchForecast }) {
  const [activeScenario, setActiveScenario] = useState('baseline');

  useEffect(() => {
    fetchForecast(activeScenario);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeScenario]);

  const departments = state.data?.departments || state.data?.data?.departments || [];

  return (
    <div>
      {/* Scenario tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {SCENARIOS.map((s) => (
          <button
            key={s.key}
            onClick={() => setActiveScenario(s.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
              activeScenario === s.key ? activeTabCls : inactiveTabCls
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {state.loading && <Spinner />}
      {state.error && <ErrorBox message={state.error} onRetry={() => fetchForecast(activeScenario)} />}

      {!state.loading && !state.error && departments.length === 0 && (
        <p className="text-gray-500 text-sm py-6">
          Aucune prévision disponible pour le scénario <span className="text-orange-400">{activeScenario}</span>.
        </p>
      )}

      {!state.loading && !state.error && departments.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-400 border-b border-white/10">
                <th className="py-3 px-4">Département</th>
                <th className="py-3 px-4">Effectif actuel</th>
                <th className="py-3 px-4">Prévision M+3</th>
                <th className="py-3 px-4">Prévision M+6</th>
                <th className="py-3 px-4">Prévision M+12</th>
                <th className="py-3 px-4">Variation</th>
              </tr>
            </thead>
            <tbody>
              {departments.map((dept, idx) => {
                const current = dept.current ?? dept.headcount ?? 0;
                const m3 = dept.forecast_3m ?? dept.m3 ?? '—';
                const m6 = dept.forecast_6m ?? dept.m6 ?? '—';
                const m12 = dept.forecast_12m ?? dept.m12 ?? '—';
                const variation = dept.variation ?? null;

                return (
                  <tr
                    key={dept.department || idx}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                  >
                    <td className="py-3 px-4 text-white font-medium">
                      {dept.department || dept.department_name || '—'}
                    </td>
                    <td className="py-3 px-4 text-gray-300">{current}</td>
                    <td className="py-3 px-4 text-gray-300">{m3}</td>
                    <td className="py-3 px-4 text-gray-300">{m6}</td>
                    <td className="py-3 px-4 text-gray-300">{m12}</td>
                    <td className="py-3 px-4">
                      {variation !== null ? (
                        <span
                          className={`text-xs font-medium ${
                            variation > 0 ? 'text-emerald-400' : variation < 0 ? 'text-red-400' : 'text-gray-500'
                          }`}
                        >
                          {variation > 0 ? '+' : ''}
                          {variation}%
                        </span>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  4. Benchmark Salaires                                              */
/* ------------------------------------------------------------------ */
function SalaryBenchmarkSection({ state, onRefresh }) {
  useEffect(() => {
    if (!state.data && !state.loading && !state.error) {
      onRefresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const jobs = state.data?.jobs || state.data?.data?.jobs || [];

  /* Compute global max for scale — must be called before any early return */
  const globalMax = useMemo(() => {
    if (!jobs.length) return 1;
    let mx = 0;
    jobs.forEach((j) => {
      const val = j.max ?? j.p100 ?? 0;
      if (val > mx) mx = val;
    });
    return mx || 1;
  }, [state.data]); // eslint-disable-line react-hooks/exhaustive-deps

  if (state.loading) return <Spinner />;
  if (state.error) return <ErrorBox message={state.error} onRetry={onRefresh} />;

  if (!jobs.length) {
    return <p className="text-gray-500 text-sm py-6">Aucune donnée de benchmark disponible.</p>;
  }

  return (
    <div className="space-y-4">
      {jobs.map((job, idx) => {
        const min = job.min ?? job.p0 ?? 0;
        const p25 = job.p25 ?? 0;
        const p50 = job.p50 ?? job.median ?? 0;
        const p75 = job.p75 ?? 0;
        const max = job.max ?? job.p100 ?? 0;

        const pct = (v) => `${((v / globalMax) * 100).toFixed(1)}%`;

        return (
          <div key={job.title || job.job_title || idx} className={`${card} p-5`}>
            <h4 className="text-white font-medium text-sm mb-3">{job.title || job.job_title || 'Poste'}</h4>

            {/* Bar visualisation */}
            <div className="relative h-8 rounded-lg overflow-hidden bg-white/5">
              {/* Full range bar (min-max) */}
              <div
                className="absolute top-0 h-full bg-gray-600/40 rounded-lg"
                style={{ left: pct(min), width: pct(max - min) }}
              />
              {/* IQR bar (p25-p75) */}
              <div
                className="absolute top-1 h-6 bg-orange-400/50 rounded-md"
                style={{ left: pct(p25), width: pct(p75 - p25) }}
              />
              {/* Median line */}
              <div className="absolute top-0 h-full w-0.5 bg-orange-400" style={{ left: pct(p50) }} />
            </div>

            {/* Labels */}
            <div className="flex justify-between mt-2 text-[11px] text-gray-500">
              <span>Min {min.toLocaleString('fr-FR')} &euro;</span>
              <span>P25 {p25.toLocaleString('fr-FR')} &euro;</span>
              <span className="text-orange-400 font-medium">P50 {p50.toLocaleString('fr-FR')} &euro;</span>
              <span>P75 {p75.toLocaleString('fr-FR')} &euro;</span>
              <span>Max {max.toLocaleString('fr-FR')} &euro;</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                          */
/* ------------------------------------------------------------------ */
const TABS = [
  { key: 'turnover', label: 'Turnover Risk', icon: AlertTriangle },
  { key: 'absenteeism', label: 'Absentéisme', icon: Activity },
  { key: 'headcount', label: 'Prévision effectifs', icon: Users },
  { key: 'salary', label: 'Benchmark salaires', icon: Briefcase },
];

export default function PeopleAnalyticsPage() {
  const {
    turnoverRisk,
    absenteeism,
    headcountForecast,
    salaryBenchmark,
    fetchTurnoverRisk,
    fetchAbsenteeism,
    fetchHeadcountForecast,
    fetchSalaryBenchmark,
  } = usePeopleAnalytics();

  const [activeTab, setActiveTab] = useState('turnover');

  return (
    <>
      <Helmet>
        <title>People Analytics | CashPilot</title>
      </Helmet>

      <div className="min-h-screen bg-[#0a0e1a] text-white p-6 lg:p-10">
        {/* -------- Header -------- */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-orange-400" />
              People Analytics
            </h1>
            <p className="text-gray-400 text-sm mt-1">Analyse prédictive RH et benchmarks</p>
          </div>

          <button
            onClick={() => {
              fetchTurnoverRisk();
              fetchAbsenteeism();
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10
                       text-gray-300 hover:bg-white/10 hover:text-white transition-colors text-sm"
          >
            <RefreshCw className="w-4 h-4" />
            Rafraîchir
          </button>
        </div>

        {/* -------- Tabs -------- */}
        <div className="flex gap-2 mb-6 flex-wrap">
          {TABS.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  activeTab === t.key ? activeTabCls : inactiveTabCls
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {/* -------- Content -------- */}
        <div className={`${card} p-6`}>
          {activeTab === 'turnover' && (
            <>
              <SectionTitle icon={AlertTriangle}>Turnover Risk Heatmap</SectionTitle>
              <TurnoverRiskSection state={turnoverRisk} onRefresh={fetchTurnoverRisk} />
            </>
          )}

          {activeTab === 'absenteeism' && (
            <>
              <SectionTitle icon={Activity}>Absentéisme par département</SectionTitle>
              <AbsenteeismSection state={absenteeism} onRefresh={fetchAbsenteeism} />
            </>
          )}

          {activeTab === 'headcount' && (
            <>
              <SectionTitle icon={Users}>Prévision des effectifs</SectionTitle>
              <HeadcountSection state={headcountForecast} fetchForecast={fetchHeadcountForecast} />
            </>
          )}

          {activeTab === 'salary' && (
            <>
              <SectionTitle icon={Target}>Benchmark salaires</SectionTitle>
              <SalaryBenchmarkSection state={salaryBenchmark} onRefresh={fetchSalaryBenchmark} />
            </>
          )}
        </div>
      </div>
    </>
  );
}
