import { useMemo } from 'react';
import { Helmet } from 'react-helmet';
import {
  Users,
  TrendingUp,
  TrendingDown,
  Clock,
  UserCheck,
  Calendar,
  GraduationCap,
  ThumbsUp,
  Printer,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { useBilanSocial } from '@/hooks/useBilanSocial';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

const fmt = (v, decimals = 1) => {
  const n = Number(v || 0);
  return Number.isFinite(n) ? n.toFixed(decimals) : '0.0';
};

const fmtInt = (v) => {
  const n = Number(v || 0);
  return Number.isFinite(n) ? Math.round(n).toLocaleString('fr-FR') : '0';
};

const fmtCurrency = (v) =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(Number(v || 0));

const fmtMonth = (dateStr) => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
};

const delta = (current, previous, key) => {
  const c = Number(current?.[key] || 0);
  const p = Number(previous?.[key] || 0);
  if (p === 0) return null;
  return ((c - p) / Math.abs(p)) * 100;
};

/* -------------------------------------------------------------------------- */
/*  Trend Arrow                                                               */
/* -------------------------------------------------------------------------- */

function TrendArrow({ value, inverse = false }) {
  if (value === null || value === undefined) return null;
  const positive = inverse ? value < 0 : value > 0;
  const Icon = value >= 0 ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${positive ? 'text-emerald-400' : 'text-red-400'}`}
    >
      <Icon className="h-3 w-3" />
      {fmt(Math.abs(value))}%
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/*  Gradient Bar                                                              */
/* -------------------------------------------------------------------------- */

function GradientBar({ value, max, color = 'from-orange-500 to-orange-300' }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="mt-2 h-1.5 w-full rounded-full bg-white/5">
      <div className={`h-full rounded-full bg-gradient-to-r ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  KPI Card                                                                  */
/* -------------------------------------------------------------------------- */

function KpiCard({ icon: Icon, label, value, unit, trend, inverse, barValue, barMax, barColor }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <div className="flex items-start justify-between">
        <div className="rounded-lg bg-orange-400/10 p-2">
          <Icon className="h-5 w-5 text-orange-400" />
        </div>
        <TrendArrow value={trend} inverse={inverse} />
      </div>
      <p className="mt-3 text-2xl font-bold text-white">
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-white/50">{unit}</span>}
      </p>
      <p className="mt-1 text-xs text-white/50">{label}</p>
      {barValue !== undefined && <GradientBar value={barValue} max={barMax || 100} color={barColor} />}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  SVG Line Chart                                                            */
/* -------------------------------------------------------------------------- */

function SvgLineChart({ data, label, color = '#fb923c', height = 160, valueFormatter }) {
  const W = 400;
  const H = height;
  const PAD = { top: 20, right: 16, bottom: 32, left: 48 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const values = data.map((d) => d.value);
  const minV = Math.min(...values, 0);
  const maxV = Math.max(...values, 1);
  const range = maxV - minV || 1;

  const points = data.map((d, i) => ({
    x: PAD.left + (data.length > 1 ? (i / (data.length - 1)) * innerW : innerW / 2),
    y: PAD.top + innerH - ((d.value - minV) / range) * innerH,
    date: d.date,
    value: d.value,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaPath = `${linePath} L${points[points.length - 1]?.x || PAD.left},${PAD.top + innerH} L${PAD.left},${PAD.top + innerH} Z`;

  const yTicks = 4;
  const yLines = Array.from({ length: yTicks + 1 }, (_, i) => {
    const val = minV + (range / yTicks) * i;
    return {
      y: PAD.top + innerH - (i / yTicks) * innerH,
      label: valueFormatter ? valueFormatter(val) : fmt(val),
    };
  });

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm">
      <h3 className="mb-3 text-sm font-semibold text-white/70">{label}</h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* Grid lines */}
        {yLines.map((yl, i) => (
          <g key={i}>
            <line x1={PAD.left} y1={yl.y} x2={W - PAD.right} y2={yl.y} stroke="rgba(255,255,255,0.06)" />
            <text x={PAD.left - 6} y={yl.y + 4} textAnchor="end" fill="rgba(255,255,255,0.35)" fontSize="9">
              {yl.label}
            </text>
          </g>
        ))}
        {/* Area fill */}
        {points.length > 1 && <path d={areaPath} fill={color} fillOpacity="0.08" />}
        {/* Line */}
        {points.length > 1 && (
          <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        )}
        {/* Dots */}
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill={color} stroke="#0a0e1a" strokeWidth="1.5" />
        ))}
        {/* X-axis labels */}
        {points.map((p, i) => {
          if (data.length <= 6 || i % Math.ceil(data.length / 6) === 0) {
            return (
              <text key={`xl-${i}`} x={p.x} y={H - 6} textAnchor="middle" fill="rgba(255,255,255,0.35)" fontSize="8">
                {fmtMonth(p.date)}
              </text>
            );
          }
          return null;
        })}
      </svg>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  SVG Horizontal Bar Chart (Age Pyramid)                                    */
/* -------------------------------------------------------------------------- */

function AgePyramidChart({ data }) {
  const W = 400;
  const barH = 28;
  const gap = 6;
  const H = data.length * (barH + gap) + 40;
  const midX = W / 2;
  const sideW = midX - 50;

  const maxCount = Math.max(...data.flatMap((d) => [d.female, d.male]), 1);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
      {/* Headers */}
      <text x={midX - sideW / 2} y="14" textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="10" fontWeight="600">
        Femmes
      </text>
      <text
        x={midX + sideW / 2 + 50}
        y="14"
        textAnchor="middle"
        fill="rgba(255,255,255,0.5)"
        fontSize="10"
        fontWeight="600"
      >
        Hommes
      </text>

      {data.map((bracket, i) => {
        const y = 28 + i * (barH + gap);
        const femaleW = (bracket.female / maxCount) * sideW;
        const maleW = (bracket.male / maxCount) * sideW;

        return (
          <g key={bracket.label}>
            {/* Label in the center */}
            <text
              x={midX}
              y={y + barH / 2 + 4}
              textAnchor="middle"
              fill="rgba(255,255,255,0.7)"
              fontSize="10"
              fontWeight="500"
            >
              {bracket.label}
            </text>

            {/* Female bar (grows left from center) */}
            <rect x={midX - 30 - femaleW} y={y} width={femaleW} height={barH} rx="4" fill="#f472b6" fillOpacity="0.7" />
            {bracket.female > 0 && (
              <text
                x={midX - 34 - femaleW}
                y={y + barH / 2 + 4}
                textAnchor="end"
                fill="rgba(255,255,255,0.5)"
                fontSize="9"
              >
                {bracket.female}
              </text>
            )}

            {/* Male bar (grows right from center) */}
            <rect x={midX + 30} y={y} width={maleW} height={barH} rx="4" fill="#60a5fa" fillOpacity="0.7" />
            {bracket.male > 0 && (
              <text
                x={midX + 34 + maleW}
                y={y + barH / 2 + 4}
                textAnchor="start"
                fill="rgba(255,255,255,0.5)"
                fontSize="9"
              >
                {bracket.male}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*  Index Egalite H/F Card                                                    */
/* -------------------------------------------------------------------------- */

const EGALITE_INDICATORS = [
  { key: 'ecart_remuneration', label: 'Ecart de remuneration', max: 40 },
  { key: 'ecart_augmentation', label: 'Ecart taux augmentation', max: 20 },
  { key: 'ecart_promotion', label: 'Ecart taux promotion', max: 15 },
  { key: 'retour_conge_mat', label: 'Retour de conge maternite', max: 15 },
  { key: 'hautes_remunerations', label: 'Hautes remunerations', max: 10 },
];

function EgaliteIndexCard({ snapshot }) {
  // Compute a simple score based on gender ratio proximity to 0.5
  const ratio = Number(snapshot?.gender_ratio_f || 0);
  const proximity = 1 - Math.abs(ratio - 0.5) * 2; // 1 = perfect parity, 0 = all one gender
  const totalScore = Math.round(proximity * 100);

  // Distribute score proportionally across indicators
  const indicators = EGALITE_INDICATORS.map((ind) => {
    const score = Math.round((proximity * ind.max * 100) / 100);
    return { ...ind, score: Math.min(score, ind.max) };
  });

  const scoreColor = totalScore >= 75 ? 'text-emerald-400' : totalScore >= 50 ? 'text-orange-400' : 'text-red-400';

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/70">Index egalite professionnelle H/F</h3>
        <span className={`text-3xl font-bold ${scoreColor}`}>
          {totalScore}
          <span className="text-base font-normal text-white/40">/100</span>
        </span>
      </div>
      <div className="space-y-3">
        {indicators.map((ind) => (
          <div key={ind.key}>
            <div className="flex items-center justify-between text-xs">
              <span className="text-white/50">{ind.label}</span>
              <span className="font-medium text-white/70">
                {ind.score}/{ind.max}
              </span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full bg-white/5">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-500 to-orange-300"
                style={{ width: `${ind.max > 0 ? (ind.score / ind.max) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[10px] text-white/30">
        Calcul indicatif base sur le ratio H/F du dernier snapshot. A completer avec les donnees detaillees conformement
        a la loi.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Main Page                                                                 */
/* -------------------------------------------------------------------------- */

export default function BilanSocialPage() {
  const {
    loading,
    error,
    latestSnapshot,
    previousSnapshot,
    activeEmployees,
    departmentBreakdown,
    agePyramid,
    genderIndex,
    trends,
    fetchData,
  } = useBilanSocial();

  /* ---------- KPI definitions --------- */

  const kpis = useMemo(() => {
    const s = latestSnapshot || {};
    const p = previousSnapshot || {};

    const headcount = Number(s.headcount || activeEmployees.length || 0);
    const turnover = Number(s.turnover_rate || 0);
    const absenteeism = Number(s.absenteeism_rate || 0);
    const avgTenure = Number(s.avg_tenure_months || 0) / 12;
    const ratioF = Number(s.gender_ratio_f || 0);
    const avgAge = Number(s.avg_age || 0);
    const trainingHours = Number(s.training_hours || 0);
    const enps = Number(s.enps_score || 0);

    return [
      {
        icon: Users,
        label: 'Effectif total',
        value: fmtInt(headcount),
        trend: delta(s, p, 'headcount'),
        barValue: headcount,
        barMax: headcount * 1.2 || 100,
        barColor: 'from-blue-500 to-blue-300',
      },
      {
        icon: TrendingUp,
        label: 'Turnover',
        value: fmt(turnover),
        unit: '%',
        trend: delta(s, p, 'turnover_rate'),
        inverse: true,
        barValue: turnover,
        barMax: 30,
        barColor: 'from-red-500 to-red-300',
      },
      {
        icon: Calendar,
        label: 'Absenteisme',
        value: fmt(absenteeism),
        unit: '%',
        trend: delta(s, p, 'absenteeism_rate'),
        inverse: true,
        barValue: absenteeism,
        barMax: 15,
        barColor: 'from-amber-500 to-amber-300',
      },
      {
        icon: Clock,
        label: 'Tenure moyenne',
        value: fmt(avgTenure),
        unit: 'ans',
        trend: delta(s, p, 'avg_tenure_months'),
        barValue: avgTenure,
        barMax: 15,
        barColor: 'from-emerald-500 to-emerald-300',
      },
      {
        icon: UserCheck,
        label: 'Ratio H/F',
        value: `${genderIndex.female}/${genderIndex.male}`,
        trend: delta(s, p, 'gender_ratio_f'),
        barValue: ratioF * 100,
        barMax: 100,
        barColor: 'from-pink-500 to-pink-300',
      },
      {
        icon: Users,
        label: 'Age moyen',
        value: fmt(avgAge, 0),
        unit: 'ans',
        trend: delta(s, p, 'avg_age'),
        barValue: avgAge,
        barMax: 65,
        barColor: 'from-violet-500 to-violet-300',
      },
      {
        icon: GraduationCap,
        label: 'Heures formation',
        value: fmtInt(trainingHours),
        unit: 'h',
        trend: delta(s, p, 'training_hours'),
        barValue: trainingHours,
        barMax: trainingHours * 1.3 || 100,
        barColor: 'from-cyan-500 to-cyan-300',
      },
      {
        icon: ThumbsUp,
        label: 'eNPS',
        value: fmtInt(enps),
        trend: delta(s, p, 'enps_score'),
        barValue: Math.max(enps + 100, 0),
        barMax: 200,
        barColor: 'from-orange-500 to-orange-300',
      },
    ];
  }, [latestSnapshot, previousSnapshot, activeEmployees.length, genderIndex]);

  /* ---------- Department totals ---------- */

  const deptTotals = useMemo(() => {
    return departmentBreakdown.reduce(
      (acc, d) => ({
        headcount: acc.headcount + d.headcount,
        planned: acc.planned + d.plannedHeadcount,
        actual: acc.actual + d.actualHeadcount,
        plannedPayroll: acc.plannedPayroll + d.plannedPayroll,
        actualPayroll: acc.actualPayroll + d.actualPayroll,
      }),
      { headcount: 0, planned: 0, actual: 0, plannedPayroll: 0, actualPayroll: 0 }
    );
  }, [departmentBreakdown]);

  /* ---------- Render ---------- */

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#0a0e1a' }}>
        <Helmet>
          <title>Bilan Social | CashPilot</title>
        </Helmet>
        <div className="flex flex-col items-center gap-3">
          <RefreshCw className="h-8 w-8 animate-spin text-orange-400" />
          <p className="text-sm text-white/50">Chargement du bilan social...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: '#0a0e1a' }}>
        <Helmet>
          <title>Bilan Social | CashPilot</title>
        </Helmet>
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertTriangle className="h-8 w-8 text-red-400" />
          <p className="text-sm text-white/70">{error}</p>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            className="mt-2 border-white/10 text-white/70 hover:text-white"
          >
            Reessayer
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen p-4 md:p-6 lg:p-8 print:bg-white print:p-0"
      style={{ background: 'linear-gradient(180deg, #0a0e1a 0%, #0f1528 40%, #141c33 100%)' }}
    >
      <Helmet>
        <title>Bilan Social | CashPilot</title>
      </Helmet>

      {/* ------------------------------------------------------------------ */}
      {/*  Header                                                             */}
      {/* ------------------------------------------------------------------ */}
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white print:text-black">Bilan Social</h1>
          <p className="mt-1 text-sm text-white/50 print:text-gray-500">
            Tableau de bord des indicateurs sociaux
            {latestSnapshot?.snapshot_date && (
              <span className="ml-2 text-white/30 print:text-gray-400">
                - Derniere mise a jour : {new Date(latestSnapshot.snapshot_date).toLocaleDateString('fr-FR')}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            className="border-white/10 text-white/70 hover:text-white"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Actualiser
          </Button>
          <Button size="sm" onClick={() => window.print()} className="bg-orange-500 text-white hover:bg-orange-600">
            <Printer className="mr-2 h-4 w-4" />
            Exporter PDF
          </Button>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/*  Section 1 : KPI Cards                                              */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-8">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {kpis.map((kpi) => (
            <KpiCard key={kpi.label} {...kpi} />
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  Section 2 : Effectifs par departement                              */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-8">
        <Card className="border-white/10 bg-white/5 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-white/80">Effectifs par departement</CardTitle>
          </CardHeader>
          <CardContent>
            {departmentBreakdown.length === 0 ? (
              <p className="text-sm text-white/40">Aucun departement configure.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="border-white/10 hover:bg-white/5">
                    <TableHead className="text-white/50">Departement</TableHead>
                    <TableHead className="text-right text-white/50">Effectif</TableHead>
                    <TableHead className="text-right text-white/50">Budget prevu</TableHead>
                    <TableHead className="text-right text-white/50">Budget reel</TableHead>
                    <TableHead className="text-right text-white/50">Masse salariale prevue</TableHead>
                    <TableHead className="text-right text-white/50">Masse salariale reelle</TableHead>
                    <TableHead className="text-right text-white/50">Ecart</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {departmentBreakdown.map((dept) => {
                    const ecart = dept.actualPayroll - dept.plannedPayroll;
                    const ecartPct = dept.plannedPayroll > 0 ? ((ecart / dept.plannedPayroll) * 100).toFixed(1) : '-';
                    return (
                      <TableRow key={dept.id} className="border-white/5 hover:bg-white/5">
                        <TableCell className="font-medium text-white/80">{dept.name}</TableCell>
                        <TableCell className="text-right text-white/70">{dept.headcount}</TableCell>
                        <TableCell className="text-right text-white/70">{dept.plannedHeadcount}</TableCell>
                        <TableCell className="text-right text-white/70">{dept.actualHeadcount}</TableCell>
                        <TableCell className="text-right text-white/70">{fmtCurrency(dept.plannedPayroll)}</TableCell>
                        <TableCell className="text-right text-white/70">{fmtCurrency(dept.actualPayroll)}</TableCell>
                        <TableCell
                          className={`text-right font-medium ${
                            ecart > 0 ? 'text-red-400' : ecart < 0 ? 'text-emerald-400' : 'text-white/50'
                          }`}
                        >
                          {ecartPct !== '-' ? `${ecart > 0 ? '+' : ''}${ecartPct}%` : '-'}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
                {/* Table footer with totals */}
                <tfoot>
                  <TableRow className="border-white/10 bg-white/5 font-semibold hover:bg-white/5">
                    <TableCell className="text-white/80">Total</TableCell>
                    <TableCell className="text-right text-white/80">{deptTotals.headcount}</TableCell>
                    <TableCell className="text-right text-white/80">{deptTotals.planned}</TableCell>
                    <TableCell className="text-right text-white/80">{deptTotals.actual}</TableCell>
                    <TableCell className="text-right text-white/80">{fmtCurrency(deptTotals.plannedPayroll)}</TableCell>
                    <TableCell className="text-right text-white/80">{fmtCurrency(deptTotals.actualPayroll)}</TableCell>
                    <TableCell className="text-right text-white/80">
                      {deptTotals.plannedPayroll > 0
                        ? `${(((deptTotals.actualPayroll - deptTotals.plannedPayroll) / deptTotals.plannedPayroll) * 100).toFixed(1)}%`
                        : '-'}
                    </TableCell>
                  </TableRow>
                </tfoot>
              </Table>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  Section 3 & 4 : Age Pyramid + Egalite H/F                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-8 grid gap-6 lg:grid-cols-2">
        {/* Age Pyramid */}
        <Card className="border-white/10 bg-white/5 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-white/80">Pyramide des ages</CardTitle>
          </CardHeader>
          <CardContent>
            {agePyramid.length === 0 ? (
              <p className="text-sm text-white/40">Donnees insuffisantes.</p>
            ) : (
              <AgePyramidChart data={agePyramid} />
            )}
            <div className="mt-3 flex items-center justify-center gap-6 text-xs text-white/40">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-pink-400/70" /> Femmes
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-blue-400/70" /> Hommes
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Egalite H/F Index */}
        <EgaliteIndexCard snapshot={latestSnapshot} />
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  Section 5 : Tendances (12 mois)                                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="mb-8">
        <h2 className="mb-4 text-lg font-semibold text-white/80">Tendances sur 12 mois</h2>
        <div className="grid gap-6 md:grid-cols-3">
          <SvgLineChart
            data={trends.turnover}
            label="Turnover (%)"
            color="#f87171"
            valueFormatter={(v) => `${fmt(v)}%`}
          />
          <SvgLineChart
            data={trends.absenteeism}
            label="Absenteisme (%)"
            color="#fbbf24"
            valueFormatter={(v) => `${fmt(v)}%`}
          />
          <SvgLineChart data={trends.enps} label="eNPS" color="#34d399" valueFormatter={(v) => fmtInt(v)} />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  Section 6 : Export (print)                                         */}
      {/* ------------------------------------------------------------------ */}
      <section className="print:hidden">
        <div className="flex items-center justify-center rounded-xl border border-dashed border-white/10 bg-white/[0.02] py-8">
          <div className="text-center">
            <Printer className="mx-auto mb-2 h-8 w-8 text-white/20" />
            <p className="text-sm text-white/40">
              Cliquez sur <strong className="text-orange-400">Exporter PDF</strong> pour generer le bilan social au
              format imprimable.
            </p>
            <Button
              size="sm"
              onClick={() => window.print()}
              className="mt-4 bg-orange-500 text-white hover:bg-orange-600"
            >
              <Printer className="mr-2 h-4 w-4" />
              Imprimer / Exporter
            </Button>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/*  Print styles (inline for portability)                              */}
      {/* ------------------------------------------------------------------ */}
      <style>{`
        @media print {
          body { background: white !important; }
          .print\\:hidden { display: none !important; }
          .print\\:bg-white { background: white !important; }
          .print\\:text-black { color: black !important; }
          .print\\:text-gray-500 { color: #6b7280 !important; }
          .print\\:text-gray-400 { color: #9ca3af !important; }
          .print\\:p-0 { padding: 0 !important; }
          .print\\:mb-4 { margin-bottom: 1rem !important; }
        }
      `}</style>
    </div>
  );
}
