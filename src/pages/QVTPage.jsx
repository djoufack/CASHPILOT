import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import {
  AlertTriangle,
  BarChart3,
  Brain,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  Plus,
  Shield,
  Users,
} from 'lucide-react';
import { useQVT } from '@/hooks/useQVT';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const formatDate = (v) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('fr-FR');
};

const SURVEY_TYPE_LABELS = {
  engagement: 'Engagement',
  enps: 'eNPS',
  pulse: 'Pulse',
  exit: 'Sortie',
};

const SURVEY_TYPE_COLORS = {
  engagement: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  enps: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  pulse: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  exit: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const STATUS_LABELS = {
  draft: 'Brouillon',
  active: 'Active',
  closed: 'Terminee',
  identified: 'Identifie',
  in_progress: 'En cours',
  mitigated: 'Attenue',
  resolved: 'Resolu',
  accepted: 'Accepte',
};

const STATUS_COLORS = {
  draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  closed: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
  identified: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  mitigated: 'bg-teal-500/20 text-teal-400 border-teal-500/30',
  resolved: 'bg-green-500/20 text-green-400 border-green-500/30',
  accepted: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
};

const RISK_CATEGORIES = ['physique', 'chimique', 'biologique', 'ergonomique', 'psychosocial', 'organisationnel'];

const MATRIX_COLORS = [
  ['bg-green-600/40', 'bg-green-500/40', 'bg-yellow-500/40', 'bg-orange-500/40'],
  ['bg-green-500/40', 'bg-yellow-500/40', 'bg-orange-500/40', 'bg-orange-600/40'],
  ['bg-yellow-500/40', 'bg-orange-500/40', 'bg-orange-600/40', 'bg-red-500/40'],
  ['bg-orange-500/40', 'bg-orange-600/40', 'bg-red-500/40', 'bg-red-600/40'],
];

const MATRIX_LABELS = ['Faible', 'Modere', 'Eleve', 'Critique'];

const defaultSurveyForm = {
  title: '',
  survey_type: 'engagement',
  starts_at: '',
  ends_at: '',
};

/* ------------------------------------------------------------------ */
/*  eNPS Gauge (SVG arc)                                              */
/* ------------------------------------------------------------------ */

function ENPSGauge({ score, size = 200 }) {
  const clampedScore = Math.max(-100, Math.min(100, score ?? 0));
  const normalized = (clampedScore + 100) / 200;
  const radius = 80;
  const strokeWidth = 16;
  const cx = size / 2;
  const cy = size / 2 + 10;
  const startAngle = Math.PI;
  const endAngle = 0;
  const sweepAngle = startAngle - endAngle;
  const valueAngle = startAngle - sweepAngle * normalized;

  const arcPath = (angle) => {
    const x = cx + radius * Math.cos(angle);
    const y = cy - radius * Math.sin(angle);
    return { x, y };
  };

  const start = arcPath(startAngle);
  const end = arcPath(endAngle);
  const valuePoint = arcPath(valueAngle);

  const bgArc = `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`;

  const largeArc = normalized > 0.5 ? 1 : 0;
  const valueArc = `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArc} 1 ${valuePoint.x} ${valuePoint.y}`;

  const color =
    clampedScore >= 50 ? '#22c55e' : clampedScore >= 0 ? '#f59e0b' : clampedScore >= -50 ? '#f97316' : '#ef4444';

  return (
    <svg width={size} height={size / 2 + 40} viewBox={`0 0 ${size} ${size / 2 + 40}`}>
      <path d={bgArc} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={strokeWidth} strokeLinecap="round" />
      {score !== null && score !== undefined && (
        <path d={valueArc} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" />
      )}
      <text x={cx} y={cy - 20} textAnchor="middle" fill={color} fontSize="32" fontWeight="bold">
        {score !== null && score !== undefined ? clampedScore : '--'}
      </text>
      <text x={cx} y={cy + 5} textAnchor="middle" fill="rgba(255,255,255,0.5)" fontSize="12">
        eNPS
      </text>
      <text x={start.x + 5} y={start.y + 18} textAnchor="start" fill="rgba(255,255,255,0.4)" fontSize="10">
        -100
      </text>
      <text x={end.x - 5} y={end.y + 18} textAnchor="end" fill="rgba(255,255,255,0.4)" fontSize="10">
        +100
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Main page                                                         */
/* ------------------------------------------------------------------ */

const QVTPage = () => {
  const {
    loading,
    error,
    surveys,
    riskAssessments,
    employees: _employees,
    departments,
    createSurvey,
    createRiskAssessment: _createRiskAssessment,
    updateRiskAssessment: _updateRiskAssessment,
  } = useQVT();

  const [activeTab, setActiveTab] = useState('surveys');
  const [showSurveyDialog, setShowSurveyDialog] = useState(false);
  const [surveyForm, setSurveyForm] = useState({ ...defaultSurveyForm });
  const [selectedSurvey, setSelectedSurvey] = useState(null);

  /* DUERP filters */
  const [duerpFilterType, setDuerpFilterType] = useState('all');
  const [duerpFilterDept, setDuerpFilterDept] = useState('all');

  /* ---------------------------------------------------------------- */
  /*  Derived data                                                    */
  /* ---------------------------------------------------------------- */

  const filteredRisks = useMemo(() => {
    return riskAssessments.filter((r) => {
      if (duerpFilterType !== 'all' && r.risk_category !== duerpFilterType) return false;
      if (duerpFilterDept !== 'all' && r.department_id !== duerpFilterDept) return false;
      return true;
    });
  }, [riskAssessments, duerpFilterType, duerpFilterDept]);

  const matrixCounts = useMemo(() => {
    const counts = Array.from({ length: 4 }, () => Array(4).fill(0));
    riskAssessments.forEach((r) => {
      const p = Math.min(4, Math.max(1, r.probability || 1)) - 1;
      const s = Math.min(4, Math.max(1, r.severity || 1)) - 1;
      counts[p][s] += 1;
    });
    return counts;
  }, [riskAssessments]);

  const selectedSurveyData = useMemo(() => {
    if (!selectedSurvey) return null;
    return surveys.find((s) => s.id === selectedSurvey) || null;
  }, [selectedSurvey, surveys]);

  const questionBreakdown = useMemo(() => {
    if (!selectedSurveyData) return [];
    const questions = selectedSurveyData.questions || [];
    const responses = selectedSurveyData.responses || [];
    return questions.map((q, idx) => {
      const answers = responses
        .map((r) => (r.answers ? r.answers[idx] : undefined))
        .filter((a) => a !== undefined && a !== null);
      const numericAnswers = answers.filter((a) => typeof a === 'number');
      const avg =
        numericAnswers.length > 0 ? numericAnswers.reduce((sum, v) => sum + v, 0) / numericAnswers.length : null;
      return {
        question: q.text || q.label || `Question ${idx + 1}`,
        responseCount: answers.length,
        average: avg,
      };
    });
  }, [selectedSurveyData]);

  /* ---------------------------------------------------------------- */
  /*  Handlers                                                        */
  /* ---------------------------------------------------------------- */

  const handleCreateSurvey = async () => {
    try {
      await createSurvey(surveyForm);
      setShowSurveyDialog(false);
      setSurveyForm({ ...defaultSurveyForm });
    } catch {
      /* toast handled in hook */
    }
  };

  /* ---------------------------------------------------------------- */
  /*  Tab: Enquetes                                                   */
  /* ---------------------------------------------------------------- */

  const renderSurveys = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">Enquetes QVT</h2>
        <Button onClick={() => setShowSurveyDialog(true)} className="bg-orange-500 hover:bg-orange-600 text-white">
          <Plus className="mr-2 h-4 w-4" />
          Nouvelle enquete
        </Button>
      </div>

      {surveys.length === 0 ? (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="flex flex-col items-center justify-center py-12 text-white/50">
            <ClipboardList className="h-12 w-12 mb-4 opacity-50" />
            <p>Aucune enquete pour le moment</p>
            <p className="text-sm mt-1">Creez votre premiere enquete QVT</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {surveys.map((survey) => (
            <Card
              key={survey.id}
              className="bg-white/5 border-white/10 hover:bg-white/[0.07] transition-colors cursor-pointer"
              onClick={() => {
                setSelectedSurvey(survey.id);
                setActiveTab('results');
              }}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4 min-w-0">
                  <div className="min-w-0">
                    <p className="text-white font-medium truncate">{survey.title}</p>
                    <div className="flex items-center gap-2 mt-1 text-sm text-white/50">
                      <span>{formatDate(survey.created_at)}</span>
                      {survey.starts_at && <span>Du {formatDate(survey.starts_at)}</span>}
                      {survey.ends_at && <span>au {formatDate(survey.ends_at)}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Badge className={SURVEY_TYPE_COLORS[survey.survey_type] || SURVEY_TYPE_COLORS.engagement}>
                    {SURVEY_TYPE_LABELS[survey.survey_type] || survey.survey_type}
                  </Badge>
                  <Badge className={STATUS_COLORS[survey.status] || STATUS_COLORS.draft}>
                    {STATUS_LABELS[survey.status] || survey.status}
                  </Badge>
                  <div className="flex items-center gap-1 text-white/60 text-sm">
                    <Users className="h-3.5 w-3.5" />
                    <span>{survey.response_count || 0}</span>
                  </div>
                  {survey.enps_score !== null && survey.enps_score !== undefined && (
                    <div className="text-orange-400 font-semibold text-sm">eNPS: {survey.enps_score}</div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  /* ---------------------------------------------------------------- */
  /*  Tab: DUERP                                                      */
  /* ---------------------------------------------------------------- */

  const renderDUERP = () => (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
        <Shield className="h-5 w-5 text-orange-400" />
        Document Unique d'Evaluation des Risques (DUERP)
      </h2>

      {/* Risk Matrix */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white text-base">Matrice des risques</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex">
            {/* Y-axis label */}
            <div className="flex flex-col items-center justify-center mr-3">
              <span className="text-white/50 text-xs -rotate-90 whitespace-nowrap tracking-wider">PROBABILITE</span>
            </div>

            <div className="flex-1">
              {/* Matrix grid */}
              <div className="grid grid-cols-[auto_1fr_1fr_1fr_1fr] gap-1">
                {/* Empty top-left corner */}
                <div />
                {/* Column headers */}
                {MATRIX_LABELS.map((label) => (
                  <div key={`col-${label}`} className="text-center text-xs text-white/50 pb-1">
                    {label}
                  </div>
                ))}

                {/* Rows (from high probability to low) */}
                {[3, 2, 1, 0].map((pIdx) => (
                  <>
                    <div key={`row-label-${pIdx}`} className="flex items-center text-xs text-white/50 pr-2">
                      {MATRIX_LABELS[pIdx]}
                    </div>
                    {[0, 1, 2, 3].map((sIdx) => (
                      <div
                        key={`cell-${pIdx}-${sIdx}`}
                        className={`${MATRIX_COLORS[pIdx][sIdx]} rounded-lg flex items-center justify-center h-16 text-white font-bold text-lg border border-white/5 transition-transform hover:scale-105`}
                      >
                        {matrixCounts[pIdx][sIdx] > 0 ? matrixCounts[pIdx][sIdx] : ''}
                      </div>
                    ))}
                  </>
                ))}
              </div>

              {/* X-axis label */}
              <div className="text-center text-xs text-white/50 mt-2 tracking-wider">SEVERITE</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={duerpFilterType} onValueChange={setDuerpFilterType}>
          <SelectTrigger className="w-48 bg-white/5 border-white/10 text-white">
            <SelectValue placeholder="Type de risque" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les types</SelectItem>
            {RISK_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={duerpFilterDept} onValueChange={setDuerpFilterDept}>
          <SelectTrigger className="w-48 bg-white/5 border-white/10 text-white">
            <SelectValue placeholder="Departement" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les departements</SelectItem>
            {departments.map((dept) => (
              <SelectItem key={dept.id} value={dept.id}>
                {dept.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Risk list */}
      {filteredRisks.length === 0 ? (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="flex flex-col items-center justify-center py-12 text-white/50">
            <AlertTriangle className="h-12 w-12 mb-4 opacity-50" />
            <p>Aucun risque identifie</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredRisks.map((risk) => (
            <Card key={risk.id} className="bg-white/5 border-white/10">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-white font-medium">{risk.title}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {risk.risk_category && (
                        <Badge className="bg-white/10 text-white/70 border-white/20">
                          {risk.risk_category.charAt(0).toUpperCase() + risk.risk_category.slice(1)}
                        </Badge>
                      )}
                      {risk.department?.name && (
                        <Badge className="bg-white/10 text-white/70 border-white/20">{risk.department.name}</Badge>
                      )}
                      <Badge className={STATUS_COLORS[risk.status] || STATUS_COLORS.identified}>
                        {STATUS_LABELS[risk.status] || risk.status}
                      </Badge>
                    </div>
                    {risk.existing_controls && (
                      <p className="text-white/40 text-sm mt-2 line-clamp-2">{risk.existing_controls}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <div className="flex items-center gap-2 text-sm text-white/60">
                      <span>P: {risk.probability}</span>
                      <span>S: {risk.severity}</span>
                    </div>
                    <div
                      className={`text-xs px-2 py-0.5 rounded ${
                        MATRIX_COLORS[Math.min(3, (risk.probability || 1) - 1)][Math.min(3, (risk.severity || 1) - 1)]
                      } text-white`}
                    >
                      Niveau {(risk.probability || 1) * (risk.severity || 1)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  /* ---------------------------------------------------------------- */
  /*  Tab: Plan de prevention                                         */
  /* ---------------------------------------------------------------- */

  const risksWithActions = useMemo(
    () => riskAssessments.filter((r) => r.action_plan || r.responsible_employee_id || r.due_date),
    [riskAssessments]
  );

  const renderPrevention = () => (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-white flex items-center gap-2">
        <FileText className="h-5 w-5 text-orange-400" />
        Plan de prevention
      </h2>

      {risksWithActions.length === 0 ? (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="flex flex-col items-center justify-center py-12 text-white/50">
            <CheckCircle2 className="h-12 w-12 mb-4 opacity-50" />
            <p>Aucun plan d'action defini</p>
            <p className="text-sm mt-1">Ajoutez des plans d'action aux risques identifies dans l'onglet DUERP</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-white/5 border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  <th className="text-left p-3 text-white/60 font-medium">Risque</th>
                  <th className="text-left p-3 text-white/60 font-medium">Categorie</th>
                  <th className="text-left p-3 text-white/60 font-medium">Plan d'action</th>
                  <th className="text-left p-3 text-white/60 font-medium">Responsable</th>
                  <th className="text-left p-3 text-white/60 font-medium">Echeance</th>
                  <th className="text-left p-3 text-white/60 font-medium">Statut</th>
                  <th className="text-left p-3 text-white/60 font-medium">Niveau</th>
                </tr>
              </thead>
              <tbody>
                {risksWithActions.map((risk) => {
                  const isOverdue =
                    risk.due_date &&
                    new Date(risk.due_date) < new Date() &&
                    risk.status !== 'resolved' &&
                    risk.status !== 'mitigated';
                  return (
                    <tr key={risk.id} className="border-b border-white/5 hover:bg-white/[0.03] transition-colors">
                      <td className="p-3 text-white max-w-[200px] truncate">{risk.title}</td>
                      <td className="p-3 text-white/60">
                        {risk.risk_category
                          ? risk.risk_category.charAt(0).toUpperCase() + risk.risk_category.slice(1)
                          : '-'}
                      </td>
                      <td className="p-3 text-white/70 max-w-[250px]">
                        <p className="line-clamp-2">{risk.action_plan || '-'}</p>
                      </td>
                      <td className="p-3 text-white/60">{risk.responsible?.full_name || '-'}</td>
                      <td className={`p-3 ${isOverdue ? 'text-red-400 font-medium' : 'text-white/60'}`}>
                        <div className="flex items-center gap-1">
                          {isOverdue && <AlertTriangle className="h-3.5 w-3.5" />}
                          {formatDate(risk.due_date)}
                        </div>
                      </td>
                      <td className="p-3">
                        <Badge className={STATUS_COLORS[risk.status] || STATUS_COLORS.identified}>
                          {STATUS_LABELS[risk.status] || risk.status}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div
                          className={`text-xs px-2 py-0.5 rounded text-center ${
                            MATRIX_COLORS[Math.min(3, (risk.probability || 1) - 1)][
                              Math.min(3, (risk.severity || 1) - 1)
                            ]
                          } text-white`}
                        >
                          {(risk.probability || 1) * (risk.severity || 1)}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );

  /* ---------------------------------------------------------------- */
  /*  Tab: Resultats                                                  */
  /* ---------------------------------------------------------------- */

  const renderResults = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-orange-400" />
          Resultats d'enquete
        </h2>
        <Select value={selectedSurvey || 'none'} onValueChange={(v) => setSelectedSurvey(v === 'none' ? null : v)}>
          <SelectTrigger className="w-64 bg-white/5 border-white/10 text-white">
            <SelectValue placeholder="Selectionner une enquete" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">-- Selectionner --</SelectItem>
            {surveys.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!selectedSurveyData ? (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="flex flex-col items-center justify-center py-16 text-white/50">
            <BarChart3 className="h-12 w-12 mb-4 opacity-50" />
            <p>Selectionnez une enquete pour voir ses resultats</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Survey header */}
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-white font-semibold text-lg">{selectedSurveyData.title}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={SURVEY_TYPE_COLORS[selectedSurveyData.survey_type] || ''}>
                      {SURVEY_TYPE_LABELS[selectedSurveyData.survey_type] || selectedSurveyData.survey_type}
                    </Badge>
                    <Badge className={STATUS_COLORS[selectedSurveyData.status] || ''}>
                      {STATUS_LABELS[selectedSurveyData.status] || selectedSurveyData.status}
                    </Badge>
                    <span className="text-white/50 text-sm">{selectedSurveyData.response_count || 0} reponse(s)</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-white/50 text-sm">
                  <CalendarClock className="h-4 w-4" />
                  {selectedSurveyData.starts_at
                    ? `${formatDate(selectedSurveyData.starts_at)} - ${formatDate(selectedSurveyData.ends_at)}`
                    : formatDate(selectedSurveyData.created_at)}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* eNPS Gauge */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-base">Score eNPS</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-center pb-6">
                <ENPSGauge score={selectedSurveyData.enps_score} size={220} />
              </CardContent>
            </Card>

            {/* Stats summary */}
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-base">Synthese</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-orange-400">{selectedSurveyData.response_count || 0}</p>
                    <p className="text-xs text-white/50 mt-1">Reponses</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-orange-400">{(selectedSurveyData.questions || []).length}</p>
                    <p className="text-xs text-white/50 mt-1">Questions</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-orange-400">
                      {selectedSurveyData.enps_score !== null && selectedSurveyData.enps_score !== undefined
                        ? selectedSurveyData.enps_score
                        : '--'}
                    </p>
                    <p className="text-xs text-white/50 mt-1">eNPS</p>
                  </div>
                  <div className="bg-white/5 rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-orange-400">
                      {SURVEY_TYPE_LABELS[selectedSurveyData.survey_type] || '-'}
                    </p>
                    <p className="text-xs text-white/50 mt-1">Type</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Question breakdown */}
          {questionBreakdown.length > 0 && (
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white text-base">Detail par question</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {questionBreakdown.map((q, idx) => (
                    <div key={idx} className="flex items-center justify-between bg-white/5 rounded-lg p-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-white text-sm truncate">{q.question}</p>
                        <p className="text-white/40 text-xs mt-0.5">{q.responseCount} reponse(s)</p>
                      </div>
                      {q.average !== null && (
                        <div className="shrink-0 ml-4">
                          <div className="flex items-center gap-2">
                            <div className="w-24 h-2 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full rounded-full bg-orange-400 transition-all"
                                style={{ width: `${Math.min(100, (q.average / 10) * 100)}%` }}
                              />
                            </div>
                            <span className="text-orange-400 font-semibold text-sm w-10 text-right">
                              {q.average.toFixed(1)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* AI Analysis */}
          <Card className="bg-white/5 border-white/10">
            <CardHeader>
              <CardTitle className="text-white text-base flex items-center gap-2">
                <Brain className="h-5 w-5 text-orange-400" />
                Analyse IA
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selectedSurveyData.ai_analysis ? (
                <div className="text-white/80 text-sm whitespace-pre-wrap leading-relaxed">
                  {typeof selectedSurveyData.ai_analysis === 'string'
                    ? selectedSurveyData.ai_analysis
                    : JSON.stringify(selectedSurveyData.ai_analysis, null, 2)}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-white/40">
                  <Brain className="h-10 w-10 mb-3 opacity-40" />
                  <p className="text-sm">Aucune analyse IA disponible pour cette enquete</p>
                  <p className="text-xs mt-1">
                    L'analyse sera generee lorsque suffisamment de reponses seront collectees
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );

  /* ---------------------------------------------------------------- */
  /*  Create Survey Dialog                                            */
  /* ---------------------------------------------------------------- */

  const renderSurveyDialog = () => (
    <Dialog open={showSurveyDialog} onOpenChange={setShowSurveyDialog}>
      <DialogContent className="bg-[#141c33] border-white/10 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Nouvelle enquete QVT</DialogTitle>
          <DialogDescription className="text-white/50">
            Creez une enquete pour mesurer la qualite de vie au travail
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-white/70">Titre</Label>
            <Input
              value={surveyForm.title}
              onChange={(e) => setSurveyForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Ex: Enquete satisfaction Q1 2026"
              className="bg-white/5 border-white/10 text-white mt-1"
            />
          </div>

          <div>
            <Label className="text-white/70">Type</Label>
            <Select
              value={surveyForm.survey_type}
              onValueChange={(v) => setSurveyForm((f) => ({ ...f, survey_type: v }))}
            >
              <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(SURVEY_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-white/70">Date de debut</Label>
              <Input
                type="date"
                value={surveyForm.starts_at}
                onChange={(e) => setSurveyForm((f) => ({ ...f, starts_at: e.target.value }))}
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
            <div>
              <Label className="text-white/70">Date de fin</Label>
              <Input
                type="date"
                value={surveyForm.ends_at}
                onChange={(e) => setSurveyForm((f) => ({ ...f, ends_at: e.target.value }))}
                className="bg-white/5 border-white/10 text-white mt-1"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setShowSurveyDialog(false)}
            className="border-white/10 text-white/70 hover:bg-white/5"
          >
            Annuler
          </Button>
          <Button
            onClick={handleCreateSurvey}
            disabled={!surveyForm.title.trim()}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            Creer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <Helmet>
          <title>QVT & Risques | CashPilot</title>
        </Helmet>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
          <p className="text-white/50 text-sm">Chargement du module QVT...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <Helmet>
          <title>QVT & Risques | CashPilot</title>
        </Helmet>
        <Card className="bg-white/5 border-white/10 max-w-md">
          <CardContent className="flex flex-col items-center py-8 text-center">
            <AlertTriangle className="h-10 w-10 text-red-400 mb-3" />
            <p className="text-white font-medium">Erreur de chargement</p>
            <p className="text-white/50 text-sm mt-1">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a]">
      <Helmet>
        <title>QVT & Risques | CashPilot</title>
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Page header */}
        <div>
          <h1 className="text-2xl font-bold text-white">QVT & Risques Professionnels</h1>
          <p className="text-white/50 text-sm mt-1">Qualite de vie au travail, DUERP et plans de prevention</p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-white/5 border border-white/10">
            <TabsTrigger
              value="surveys"
              className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"
            >
              <ClipboardList className="h-4 w-4 mr-2" />
              Enquetes
            </TabsTrigger>
            <TabsTrigger
              value="duerp"
              className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"
            >
              <Shield className="h-4 w-4 mr-2" />
              DUERP
            </TabsTrigger>
            <TabsTrigger
              value="prevention"
              className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"
            >
              <FileText className="h-4 w-4 mr-2" />
              Plan de prevention
            </TabsTrigger>
            <TabsTrigger
              value="results"
              className="data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400"
            >
              <BarChart3 className="h-4 w-4 mr-2" />
              Resultats
            </TabsTrigger>
          </TabsList>

          <TabsContent value="surveys">{renderSurveys()}</TabsContent>
          <TabsContent value="duerp">{renderDUERP()}</TabsContent>
          <TabsContent value="prevention">{renderPrevention()}</TabsContent>
          <TabsContent value="results">{renderResults()}</TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      {renderSurveyDialog()}
    </div>
  );
};

export default QVTPage;
