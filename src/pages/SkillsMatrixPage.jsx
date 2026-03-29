import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { BarChart3, Target, AlertTriangle, ClipboardCheck, User, ArrowUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useTraining } from '@/hooks/useTraining';
import { useToast } from '@/components/ui/use-toast';

/* ── helpers ─────────────────────────────────────────────────── */
const empName = (e) => e?.full_name || [e?.first_name, e?.last_name].filter(Boolean).join(' ') || '-';

const levelColor = (level) => {
  if (level <= 1) return { bg: 'bg-red-500/70', text: 'text-red-300' };
  if (level === 2) return { bg: 'bg-orange-500/60', text: 'text-orange-300' };
  if (level === 3) return { bg: 'bg-yellow-500/50', text: 'text-yellow-300' };
  if (level === 4) return { bg: 'bg-lime-500/50', text: 'text-lime-300' };
  return { bg: 'bg-emerald-500/60', text: 'text-emerald-300' };
};

const gapBadge = (gap) => {
  if (gap >= 3) return 'bg-red-500/20 text-red-400 border-red-500/30';
  if (gap === 2) return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
  if (gap === 1) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
  return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
};

/* ── radar chart (pure SVG) ──────────────────────────────────── */
const RADAR_SIZE = 280;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_R = 110;
const RADAR_LEVELS = 5;

function RadarChart({ skills }) {
  if (!skills || skills.length === 0) {
    return <p className="text-gray-500 text-sm text-center py-8">Aucune competence evaluee.</p>;
  }

  const n = skills.length;
  const angleStep = (2 * Math.PI) / n;

  const pointAt = (i, level) => {
    const angle = angleStep * i - Math.PI / 2;
    const r = (level / RADAR_LEVELS) * RADAR_R;
    return { x: RADAR_CENTER + r * Math.cos(angle), y: RADAR_CENTER + r * Math.sin(angle) };
  };

  const gridPolygons = Array.from({ length: RADAR_LEVELS }, (_, li) => {
    const lv = li + 1;
    const pts = Array.from({ length: n }, (_, si) => {
      const p = pointAt(si, lv);
      return `${p.x},${p.y}`;
    }).join(' ');
    return pts;
  });

  const currentPts = skills
    .map((s, i) => {
      const p = pointAt(i, s.current_level || 0);
      return `${p.x},${p.y}`;
    })
    .join(' ');

  const targetPts = skills
    .map((s, i) => {
      const p = pointAt(i, s.target_level || 0);
      return `${p.x},${p.y}`;
    })
    .join(' ');

  return (
    <svg viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`} className="w-full max-w-[320px] mx-auto">
      {/* grid */}
      {gridPolygons.map((pts, i) => (
        <polygon key={i} points={pts} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="1" />
      ))}
      {/* axes */}
      {skills.map((_, i) => {
        const p = pointAt(i, RADAR_LEVELS);
        return (
          <line
            key={i}
            x1={RADAR_CENTER}
            y1={RADAR_CENTER}
            x2={p.x}
            y2={p.y}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1"
          />
        );
      })}
      {/* target polygon */}
      <polygon
        points={targetPts}
        fill="rgba(251,146,60,0.12)"
        stroke="rgba(251,146,60,0.5)"
        strokeWidth="1.5"
        strokeDasharray="4 3"
      />
      {/* current polygon */}
      <polygon points={currentPts} fill="rgba(34,197,94,0.18)" stroke="rgba(34,197,94,0.7)" strokeWidth="2" />
      {/* dots + labels */}
      {skills.map((s, i) => {
        const p = pointAt(i, s.current_level || 0);
        const lp = pointAt(i, RADAR_LEVELS + 0.7);
        return (
          <g key={i}>
            <circle cx={p.x} cy={p.y} r="3.5" fill="#22c55e" />
            <text x={lp.x} y={lp.y} textAnchor="middle" dominantBaseline="central" className="fill-gray-400 text-[9px]">
              {s.skill_name?.length > 12 ? s.skill_name.slice(0, 12) + '..' : s.skill_name}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

/* ── main component ──────────────────────────────────────────── */
const SkillsMatrixPage = () => {
  const { loading, employees, skillAssessments, trainings, createSkillAssessment } = useTraining();
  const { toast } = useToast();

  const [tab, setTab] = useState('matrice');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [showEvalDialog, setShowEvalDialog] = useState(false);
  const [sortGapDir, setSortGapDir] = useState('desc');
  const [submitting, setSubmitting] = useState(false);

  const [evalForm, setEvalForm] = useState({
    employee_id: '',
    skill_name: '',
    current_level: '1',
    target_level: '3',
    recommended_training_id: '',
    notes: '',
    assessed_at: new Date().toISOString().split('T')[0],
  });

  /* ── derived data ──────────────────────────────────────────── */
  const allSkillNames = useMemo(() => {
    const s = new Set(skillAssessments.map((a) => a.skill_name).filter(Boolean));
    return [...s].sort();
  }, [skillAssessments]);

  const matrixData = useMemo(() => {
    const map = {};
    skillAssessments.forEach((a) => {
      const eid = a.employee_id;
      if (!map[eid]) map[eid] = {};
      const prev = map[eid][a.skill_name];
      if (!prev || new Date(a.assessed_at) > new Date(prev.assessed_at)) {
        map[eid][a.skill_name] = a;
      }
    });
    return map;
  }, [skillAssessments]);

  const selectedEmployee = useMemo(
    () => employees.find((e) => e.id === selectedEmployeeId) || null,
    [employees, selectedEmployeeId]
  );

  const selectedSkills = useMemo(() => {
    if (!selectedEmployeeId) return [];
    const empMap = matrixData[selectedEmployeeId] || {};
    return Object.values(empMap);
  }, [matrixData, selectedEmployeeId]);

  const gapAnalysis = useMemo(() => {
    const rows = [];
    Object.entries(matrixData).forEach(([eid, skills]) => {
      Object.values(skills).forEach((a) => {
        const gap = (a.target_level || 0) - (a.current_level || 0);
        if (gap > 0) {
          const emp = employees.find((e) => e.id === eid);
          rows.push({
            id: a.id,
            employee_id: eid,
            employee_name: empName(emp),
            skill_name: a.skill_name,
            current_level: a.current_level || 0,
            target_level: a.target_level || 0,
            gap,
            recommended_training: a.hr_training_catalog?.title || null,
          });
        }
      });
    });
    rows.sort((a, b) => (sortGapDir === 'desc' ? b.gap - a.gap : a.gap - b.gap));
    return rows;
  }, [matrixData, employees, sortGapDir]);

  /* ── handlers ──────────────────────────────────────────────── */
  const handleCreateAssessment = async () => {
    if (!evalForm.employee_id || !evalForm.skill_name.trim()) {
      toast({ title: 'Erreur', description: 'Employe et competence sont obligatoires.', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      await createSkillAssessment(evalForm);
      toast({ title: 'Evaluation enregistree' });
      setEvalForm({
        employee_id: '',
        skill_name: '',
        current_level: '1',
        target_level: '3',
        recommended_training_id: '',
        notes: '',
        assessed_at: new Date().toISOString().split('T')[0],
      });
      setShowEvalDialog(false);
    } catch (err) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  /* ── render ────────────────────────────────────────────────── */
  return (
    <>
      <Helmet>
        <title>Competences | CashPilot</title>
      </Helmet>

      <div className="container mx-auto">
        {/* header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gradient flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-orange-400" /> Competences
            </h1>
            <p className="text-gray-500 mt-1 text-sm">Matrice de competences, radar et analyse des ecarts</p>
          </div>
          <Button
            onClick={() => setShowEvalDialog(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold"
          >
            <ClipboardCheck className="mr-2 h-4 w-4" /> Nouvelle evaluation
          </Button>
        </div>

        {/* tabs */}
        <Tabs value={tab} onValueChange={setTab} className="mb-6">
          <TabsList className="bg-white/5 border border-white/10 p-1 rounded-lg">
            <TabsTrigger
              value="matrice"
              className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400 text-gray-400"
            >
              <BarChart3 className="w-4 h-4 mr-2" /> Matrice
            </TabsTrigger>
            <TabsTrigger
              value="radar"
              className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400 text-gray-400"
            >
              <Target className="w-4 h-4 mr-2" /> Radar
            </TabsTrigger>
            <TabsTrigger
              value="gaps"
              className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400 text-gray-400"
            >
              <AlertTriangle className="w-4 h-4 mr-2" /> Gap Analysis
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* ────────────────── Matrice (heatmap) ───────────────── */}
        {tab === 'matrice' && (
          <div className="space-y-4">
            {loading ? (
              <p className="text-gray-500 text-center py-12">Chargement...</p>
            ) : employees.length === 0 || allSkillNames.length === 0 ? (
              <div className="rounded-xl bg-white/5 border border-white/10 p-12 text-center">
                <p className="text-gray-500">
                  Aucune donnee de competence disponible. Creez des evaluations pour remplir la matrice.
                </p>
              </div>
            ) : (
              <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="px-4 py-3 text-left text-gray-500 text-xs uppercase tracking-wide sticky left-0 bg-[#0f1528] z-10 min-w-[180px]">
                          Employe
                        </th>
                        {allSkillNames.map((sk) => (
                          <th
                            key={sk}
                            className="px-3 py-3 text-center text-gray-500 text-[10px] uppercase tracking-wide min-w-[90px]"
                          >
                            <span className="block truncate max-w-[80px] mx-auto" title={sk}>
                              {sk}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {employees.map((emp) => {
                        const empSkills = matrixData[emp.id] || {};
                        return (
                          <tr key={emp.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="px-4 py-2.5 text-gray-200 text-sm font-medium sticky left-0 bg-[#0a0e1a] z-10">
                              <button
                                className="hover:text-orange-400 transition-colors text-left"
                                onClick={() => {
                                  setSelectedEmployeeId(emp.id);
                                  setTab('radar');
                                }}
                              >
                                {empName(emp)}
                              </button>
                            </td>
                            {allSkillNames.map((sk) => {
                              const assessment = empSkills[sk];
                              const level = assessment?.current_level;
                              if (level == null) {
                                return (
                                  <td key={sk} className="px-3 py-2.5 text-center">
                                    <span className="inline-block w-8 h-8 rounded bg-white/5 border border-white/5" />
                                  </td>
                                );
                              }
                              const lc = levelColor(level);
                              return (
                                <td key={sk} className="px-3 py-2.5 text-center">
                                  <span
                                    className={`inline-flex items-center justify-center w-8 h-8 rounded font-bold text-xs ${lc.bg} ${lc.text}`}
                                    title={`${sk}: ${level}/5 (cible: ${assessment.target_level || '-'})`}
                                  >
                                    {level}
                                  </span>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* legend */}
                <div className="flex items-center gap-3 px-4 py-3 border-t border-white/10">
                  <span className="text-xs text-gray-500">Niveau :</span>
                  {[1, 2, 3, 4, 5].map((l) => {
                    const lc = levelColor(l);
                    return (
                      <span
                        key={l}
                        className={`inline-flex items-center justify-center w-6 h-6 rounded text-[10px] font-bold ${lc.bg} ${lc.text}`}
                      >
                        {l}
                      </span>
                    );
                  })}
                  <span className="text-[10px] text-gray-600 ml-1">1=debutant - 5=expert</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ────────────────── Radar employe ────────────────────── */}
        {tab === 'radar' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <Select value={selectedEmployeeId || ''} onValueChange={(v) => setSelectedEmployeeId(v)}>
                <SelectTrigger className="w-full sm:w-72 bg-white/5 border-white/10 text-gray-100">
                  <SelectValue placeholder="Selectionner un employe" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      <span className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5" /> {empName(e)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedEmployee && (
                <span className="text-sm text-gray-400">
                  {selectedSkills.length} competence{selectedSkills.length !== 1 ? 's' : ''} evaluee
                  {selectedSkills.length !== 1 ? 's' : ''}
                </span>
              )}
            </div>

            {!selectedEmployee ? (
              <div className="rounded-xl bg-white/5 border border-white/10 p-12 text-center">
                <Target className="w-12 h-12 mx-auto text-gray-700 mb-3" />
                <p className="text-gray-500">Selectionnez un employe pour afficher son radar de competences.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* radar SVG */}
                <div className="rounded-xl bg-white/5 border border-white/10 p-6">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Target className="w-5 h-5 text-orange-400" />
                    Radar - {empName(selectedEmployee)}
                  </h3>
                  <RadarChart skills={selectedSkills} />
                  <div className="flex items-center justify-center gap-6 mt-4 text-xs">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm bg-emerald-500/60" /> Niveau actuel
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-sm bg-orange-500/40 border border-orange-500/50 border-dashed" />{' '}
                      Cible
                    </span>
                  </div>
                </div>

                {/* skill detail table */}
                <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
                  <div className="px-6 py-4 border-b border-white/10">
                    <h3 className="text-lg font-semibold text-white">Detail des competences</h3>
                  </div>
                  {selectedSkills.length === 0 ? (
                    <p className="text-gray-500 text-sm p-6">Aucune evaluation pour cet employe.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500 text-xs uppercase tracking-wide border-b border-white/10">
                            <th className="px-6 py-3">Competence</th>
                            <th className="px-6 py-3 text-center">Actuel</th>
                            <th className="px-6 py-3 text-center">Cible</th>
                            <th className="px-6 py-3 text-center">Ecart</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedSkills.map((s) => {
                            const gap = (s.target_level || 0) - (s.current_level || 0);
                            const lc = levelColor(s.current_level || 0);
                            return (
                              <tr key={s.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                <td className="px-6 py-3 text-gray-200">{s.skill_name}</td>
                                <td className="px-6 py-3 text-center">
                                  <span
                                    className={`inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold ${lc.bg} ${lc.text}`}
                                  >
                                    {s.current_level}
                                  </span>
                                </td>
                                <td className="px-6 py-3 text-center text-gray-400">{s.target_level}</td>
                                <td className="px-6 py-3 text-center">
                                  {gap > 0 ? (
                                    <Badge variant="outline" className={gapBadge(gap)}>
                                      -{gap}
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                    >
                                      OK
                                    </Badge>
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
              </div>
            )}
          </div>
        )}

        {/* ────────────────── Gap Analysis ─────────────────────── */}
        {tab === 'gaps' && (
          <div className="space-y-4">
            <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
              <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-400" />
                  Ecarts de competences
                  {gapAnalysis.length > 0 && (
                    <Badge variant="outline" className="bg-orange-500/20 text-orange-400 border-orange-500/30 ml-2">
                      {gapAnalysis.length}
                    </Badge>
                  )}
                </h3>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-gray-400 hover:text-white"
                  onClick={() => setSortGapDir((d) => (d === 'desc' ? 'asc' : 'desc'))}
                >
                  <ArrowUpDown className="w-4 h-4 mr-1" />
                  Ecart {sortGapDir === 'desc' ? 'desc.' : 'asc.'}
                </Button>
              </div>

              {loading ? (
                <p className="text-gray-500 text-sm text-center py-12">Chargement...</p>
              ) : gapAnalysis.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-12">
                  Aucun ecart detecte. Tous les employes sont a leur niveau cible.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-gray-500 text-xs uppercase tracking-wide border-b border-white/10">
                        <th className="px-6 py-3">Employe</th>
                        <th className="px-6 py-3">Competence</th>
                        <th className="px-6 py-3 text-center">Actuel</th>
                        <th className="px-6 py-3 text-center">Cible</th>
                        <th className="px-6 py-3 text-center">Ecart</th>
                        <th className="px-6 py-3">Formation recommandee</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gapAnalysis.map((row) => {
                        const lc = levelColor(row.current_level);
                        return (
                          <tr key={row.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                            <td className="px-6 py-3">
                              <button
                                className="text-gray-200 hover:text-orange-400 transition-colors"
                                onClick={() => {
                                  setSelectedEmployeeId(row.employee_id);
                                  setTab('radar');
                                }}
                              >
                                {row.employee_name}
                              </button>
                            </td>
                            <td className="px-6 py-3 text-gray-300">{row.skill_name}</td>
                            <td className="px-6 py-3 text-center">
                              <span
                                className={`inline-flex items-center justify-center w-7 h-7 rounded text-xs font-bold ${lc.bg} ${lc.text}`}
                              >
                                {row.current_level}
                              </span>
                            </td>
                            <td className="px-6 py-3 text-center text-gray-400">{row.target_level}</td>
                            <td className="px-6 py-3 text-center">
                              <Badge variant="outline" className={gapBadge(row.gap)}>
                                -{row.gap}
                              </Badge>
                            </td>
                            <td className="px-6 py-3 text-gray-400 text-xs">{row.recommended_training || '-'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ──────────── Evaluation dialog ──────────────────────── */}
        <Dialog open={showEvalDialog} onOpenChange={setShowEvalDialog}>
          <DialogContent className="sm:max-w-[550px] bg-[#0f1528] border-white/10 text-white overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold text-gradient">Nouvelle evaluation</DialogTitle>
            </DialogHeader>

            <div className="grid gap-4 mt-4">
              <div className="grid gap-2">
                <Label className="text-gray-300">Employe *</Label>
                <Select
                  value={evalForm.employee_id}
                  onValueChange={(v) => setEvalForm((p) => ({ ...p, employee_id: v }))}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-gray-100">
                    <SelectValue placeholder="Choisir un employe" />
                  </SelectTrigger>
                  <SelectContent>
                    {employees.map((e) => (
                      <SelectItem key={e.id} value={e.id}>
                        {empName(e)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label className="text-gray-300">Competence *</Label>
                <Input
                  value={evalForm.skill_name}
                  onChange={(e) => setEvalForm((p) => ({ ...p, skill_name: e.target.value }))}
                  className="bg-white/5 border-white/10 text-gray-100"
                  placeholder="Ex: React, Leadership, Excel..."
                />
                {allSkillNames.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {allSkillNames.slice(0, 8).map((sk) => (
                      <button
                        key={sk}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-400 hover:text-orange-400 hover:border-orange-400/30 transition-colors"
                        onClick={() => setEvalForm((p) => ({ ...p, skill_name: sk }))}
                      >
                        {sk}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label className="text-gray-300">Niveau actuel (1-5)</Label>
                  <Select
                    value={evalForm.current_level}
                    onValueChange={(v) => setEvalForm((p) => ({ ...p, current_level: v }))}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 text-gray-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((l) => (
                        <SelectItem key={l} value={String(l)}>
                          {l} - {['Debutant', 'Basique', 'Intermediaire', 'Avance', 'Expert'][l - 1]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label className="text-gray-300">Niveau cible (1-5)</Label>
                  <Select
                    value={evalForm.target_level}
                    onValueChange={(v) => setEvalForm((p) => ({ ...p, target_level: v }))}
                  >
                    <SelectTrigger className="bg-white/5 border-white/10 text-gray-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5].map((l) => (
                        <SelectItem key={l} value={String(l)}>
                          {l} - {['Debutant', 'Basique', 'Intermediaire', 'Avance', 'Expert'][l - 1]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label className="text-gray-300">Date evaluation</Label>
                <Input
                  type="date"
                  value={evalForm.assessed_at}
                  onChange={(e) => setEvalForm((p) => ({ ...p, assessed_at: e.target.value }))}
                  className="bg-white/5 border-white/10 text-gray-100"
                />
              </div>

              <div className="grid gap-2">
                <Label className="text-gray-300">Formation recommandee</Label>
                <Select
                  value={evalForm.recommended_training_id}
                  onValueChange={(v) => setEvalForm((p) => ({ ...p, recommended_training_id: v }))}
                >
                  <SelectTrigger className="bg-white/5 border-white/10 text-gray-100">
                    <SelectValue placeholder="Aucune" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Aucune</SelectItem>
                    {trainings.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label className="text-gray-300">Notes</Label>
                <textarea
                  value={evalForm.notes}
                  onChange={(e) => setEvalForm((p) => ({ ...p, notes: e.target.value }))}
                  rows={3}
                  className="w-full rounded-md bg-white/5 border border-white/10 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400/50"
                  placeholder="Observations, plan d'action..."
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setShowEvalDialog(false)}
                  className="text-gray-400 hover:text-white"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleCreateAssessment}
                  disabled={submitting}
                  className="bg-orange-500 hover:bg-orange-600 text-white font-semibold"
                >
                  {submitting ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

export default SkillsMatrixPage;
