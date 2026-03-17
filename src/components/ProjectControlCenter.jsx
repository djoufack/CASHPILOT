import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useProjectControl } from '@/hooks/useProjectControl';
import { useTeamSettings } from '@/hooks/useTeamSettings';
import { exportProjectControlHTML, exportProjectControlPDF } from '@/services/exportProjectControlReport';
import { Download, FileText, Plus, Trash2, TrendingUp, Users, Wrench } from 'lucide-react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

const toNumber = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const toIsoDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('fr-FR');
};

const formatCurrency = (value, currency = 'EUR') => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(toNumber(value));
};

const monthKey = (value) => {
  const iso = toIsoDate(value);
  return iso ? iso.slice(0, 7) : null;
};

const computeMilestoneAdjustment = (milestone) => {
  const plannedDate = milestone?.planned_date ? new Date(milestone.planned_date) : null;
  const actualDate = milestone?.actual_date ? new Date(milestone.actual_date) : null;
  if (!plannedDate || !actualDate || Number.isNaN(plannedDate.getTime()) || Number.isNaN(actualDate.getTime()))
    return 0;

  const dayDiff = Math.round((actualDate.getTime() - plannedDate.getTime()) / (1000 * 60 * 60 * 24));
  const base = toNumber(milestone?.planned_amount);

  if (dayDiff <= 0) {
    const type = milestone?.bonus_rule_type || 'none';
    const value = toNumber(milestone?.bonus_rule_value);
    if (type === 'fixed') return value;
    if (type === 'percentage') return (base * value) / 100;
    if (type === 'day') return Math.abs(dayDiff) * value;
    return 0;
  }

  const type = milestone?.malus_rule_type || 'none';
  const value = toNumber(milestone?.malus_rule_value);
  if (type === 'fixed') return -value;
  if (type === 'percentage') return -((base * value) / 100);
  if (type === 'day') return -(dayDiff * value);
  return 0;
};

const createDefaultMilestoneForm = () => ({
  title: '',
  status: 'planned',
  planned_date: '',
  actual_date: '',
  planned_amount: '0',
  bonus_rule_type: 'none',
  bonus_rule_value: '0',
  malus_rule_type: 'none',
  malus_rule_value: '0',
});

const createDefaultBaselineForm = () => ({
  baseline_label: '',
  planned_start_date: '',
  planned_end_date: '',
  planned_budget_hours: '0',
  planned_budget_amount: '0',
  planned_tasks_count: '0',
});

const createDefaultResourceForm = () => ({
  resource_type: 'human',
  team_member_id: '',
  resource_name: '',
  unit: 'hour',
  planned_quantity: '0',
  actual_quantity: '0',
  planned_cost: '0',
  actual_cost: '0',
  status: 'planned',
});

const ProjectControlCenter = ({ project, tasks = [] }) => {
  const currency = project?.client?.preferred_currency || 'EUR';
  const { toast } = useToast();
  const { members } = useTeamSettings();
  const [periodFrom, setPeriodFrom] = useState('');
  const [periodTo, setPeriodTo] = useState('');
  const {
    loading,
    baselines,
    activeBaseline,
    milestones,
    resources,
    compensations,
    timesheetOutputs,
    periodFrom: effectivePeriodFrom,
    periodTo: effectivePeriodTo,
    financialCurve,
    createBaseline,
    setBaselineActive,
    createMilestone,
    updateMilestone,
    deleteMilestone,
    createResource,
    deleteResource,
    markCompensationPaid,
  } = useProjectControl(project?.id, { periodFrom, periodTo });

  const [baselineDialogOpen, setBaselineDialogOpen] = useState(false);
  const [milestoneDialogOpen, setMilestoneDialogOpen] = useState(false);
  const [resourceDialogOpen, setResourceDialogOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState(null);
  const [baselineForm, setBaselineForm] = useState(createDefaultBaselineForm());
  const [milestoneForm, setMilestoneForm] = useState(createDefaultMilestoneForm());
  const [resourceForm, setResourceForm] = useState(createDefaultResourceForm());

  useEffect(() => {
    if (!periodFrom && project?.start_date) {
      setPeriodFrom(toIsoDate(project.start_date) || '');
    }
    if (!periodTo) {
      setPeriodTo(toIsoDate(new Date()) || '');
    }
  }, [periodFrom, periodTo, project?.start_date]);

  const taskCurve = useMemo(() => {
    const monthSet = new Set();
    const plannedByMonth = {};
    const doneByMonth = {};
    for (const task of tasks) {
      const plannedMonth = monthKey(task?.due_date || task?.end_date || task?.start_date);
      const doneMonth = monthKey(task?.completed_at || task?.end_date);
      if (plannedMonth) {
        monthSet.add(plannedMonth);
        plannedByMonth[plannedMonth] = (plannedByMonth[plannedMonth] || 0) + 1;
      }
      if (doneMonth) {
        monthSet.add(doneMonth);
        doneByMonth[doneMonth] = (doneByMonth[doneMonth] || 0) + 1;
      }
    }
    const sorted = [...monthSet].sort((a, b) => a.localeCompare(b));
    let plannedCumulative = 0;
    let doneCumulative = 0;
    return sorted.map((period) => {
      plannedCumulative += plannedByMonth[period] || 0;
      doneCumulative += doneByMonth[period] || 0;
      return { period, planned: plannedCumulative, done: doneCumulative };
    });
  }, [tasks]);

  const milestoneRows = useMemo(
    () =>
      milestones.map((milestone) => {
        const adjustment = computeMilestoneAdjustment(milestone);
        return { ...milestone, adjustment, net_amount: toNumber(milestone?.planned_amount) + adjustment };
      }),
    [milestones]
  );

  const taskCompletionRate = useMemo(() => {
    if (!tasks.length) return 0;
    const completed = tasks.filter((task) => task.status === 'completed').length;
    return Math.round((completed / tasks.length) * 100);
  }, [tasks]);

  const scheduleVarianceDays = useMemo(() => {
    const baselineEnd = toIsoDate(activeBaseline?.planned_end_date);
    const actualEnd = toIsoDate(project?.end_date);
    if (!baselineEnd || !actualEnd) return null;
    return Math.round((new Date(actualEnd).getTime() - new Date(baselineEnd).getTime()) / (1000 * 60 * 60 * 24));
  }, [activeBaseline?.planned_end_date, project?.end_date]);

  const kpi = useMemo(() => {
    const totalMilestones = milestoneRows.length;
    const milestonesAchieved = milestoneRows.filter((milestone) => milestone.status === 'achieved').length;
    const overdueMilestones = milestoneRows.filter((milestone) => {
      if (milestone.status === 'achieved' || milestone.status === 'cancelled') return false;
      const plannedDate = milestone?.planned_date ? new Date(milestone.planned_date) : null;
      return Boolean(plannedDate && !Number.isNaN(plannedDate.getTime()) && plannedDate < new Date());
    }).length;
    const latestFinancePoint = financialCurve[financialCurve.length - 1];
    const totalRevenue = latestFinancePoint?.revenue || 0;
    const totalCost = latestFinancePoint?.cost || 0;
    return {
      taskCompletionRate,
      totalMilestones,
      milestonesAchieved,
      overdueMilestones,
      totalRevenue,
      totalCost,
      netMargin: totalRevenue - totalCost,
    };
  }, [financialCurve, milestoneRows, taskCompletionRate]);

  const reportPayload = useMemo(
    () => ({
      project: {
        name: project?.name || 'Projet',
        client_name: project?.client?.company_name || 'Client non defini',
      },
      currency,
      period: {
        from: effectivePeriodFrom || null,
        to: effectivePeriodTo || null,
      },
      kpi,
      baselines,
      milestones: milestoneRows,
      resources: resources.map((resource) => ({
        ...resource,
        display_name: resource?.team_member?.name || resource.resource_name || 'Ressource',
      })),
      timesheetOutputs,
      financialCurve,
    }),
    [
      baselines,
      currency,
      effectivePeriodFrom,
      effectivePeriodTo,
      financialCurve,
      kpi,
      milestoneRows,
      project?.client?.company_name,
      project?.name,
      resources,
      timesheetOutputs,
    ]
  );

  const handleCreateBaseline = async () => {
    try {
      await createBaseline({
        ...baselineForm,
        planned_budget_hours: toNumber(baselineForm.planned_budget_hours),
        planned_budget_amount: toNumber(baselineForm.planned_budget_amount),
        planned_tasks_count: Math.round(toNumber(baselineForm.planned_tasks_count)),
      });
      setBaselineDialogOpen(false);
      setBaselineForm(createDefaultBaselineForm());
      toast({ title: 'Baseline creee', description: 'La baseline projet a ete enregistree.' });
    } catch (error) {
      toast({ title: 'Erreur baseline', description: error.message, variant: 'destructive' });
    }
  };

  const handleSaveMilestone = async () => {
    const payload = {
      ...milestoneForm,
      planned_amount: toNumber(milestoneForm.planned_amount),
      bonus_rule_value: toNumber(milestoneForm.bonus_rule_value),
      malus_rule_value: toNumber(milestoneForm.malus_rule_value),
    };
    try {
      if (editingMilestone?.id) {
        await updateMilestone(editingMilestone.id, payload);
      } else {
        await createMilestone(payload);
      }
      setEditingMilestone(null);
      setMilestoneDialogOpen(false);
      setMilestoneForm(createDefaultMilestoneForm());
      toast({ title: 'Jalon enregistre', description: 'Le jalon a ete sauvegarde.' });
    } catch (error) {
      toast({ title: 'Erreur jalon', description: error.message, variant: 'destructive' });
    }
  };

  const handleCreateResource = async () => {
    try {
      await createResource({
        ...resourceForm,
        planned_quantity: toNumber(resourceForm.planned_quantity),
        actual_quantity: toNumber(resourceForm.actual_quantity),
        planned_cost: toNumber(resourceForm.planned_cost),
        actual_cost: toNumber(resourceForm.actual_cost),
      });
      setResourceDialogOpen(false);
      setResourceForm(createDefaultResourceForm());
      toast({ title: 'Ressource ajoutee', description: 'La ressource projet est creee.' });
    } catch (error) {
      toast({ title: 'Erreur ressource', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-gradient">Project Control Center</h2>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => exportProjectControlHTML(reportPayload)}>
            <FileText className="w-4 h-4 mr-2" />
            Export HTML
          </Button>
          <Button variant="outline" onClick={() => exportProjectControlPDF(reportPayload)}>
            <Download className="w-4 h-4 mr-2" />
            Export PDF
          </Button>
          <Button className="bg-orange-500 hover:bg-orange-600" onClick={() => setBaselineDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Baseline
          </Button>
          <Button className="bg-blue-600 hover:bg-blue-700" onClick={() => setMilestoneDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Jalon
          </Button>
          <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={() => setResourceDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Ressource
          </Button>
        </div>
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="project-control-from">Période du</Label>
              <Input
                id="project-control-from"
                type="date"
                value={periodFrom}
                onChange={(event) => setPeriodFrom(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="project-control-to">Au</Label>
              <Input
                id="project-control-to"
                type="date"
                value={periodTo}
                onChange={(event) => setPeriodTo(event.target.value)}
              />
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            Sortie timesheets filtrée du {effectivePeriodFrom || 'début'} au {effectivePeriodTo || 'fin'}.
          </p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400">Avancement tâches</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">{kpi.taskCompletionRate}%</p>
            <p className="text-xs text-gray-400 mt-1">{tasks.length} tâches totales</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400">Jalons</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-white">
              {kpi.milestonesAchieved}/{kpi.totalMilestones}
            </p>
            <p className="text-xs text-gray-400 mt-1">{kpi.overdueMilestones} en retard</p>
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-gray-400">Marge projet</CardTitle>
          </CardHeader>
          <CardContent>
            <p className={`text-3xl font-bold ${kpi.netMargin >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {formatCurrency(kpi.netMargin, currency)}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              CA {formatCurrency(kpi.totalRevenue, currency)} • Coût {formatCurrency(kpi.totalCost, currency)}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Timesheets par ressource humaine</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-gray-400">Chargement des sorties timesheets...</p>
          ) : timesheetOutputs.length === 0 ? (
            <p className="text-sm text-gray-500">Aucune feuille de temps sur la période sélectionnée.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-slate-800">
                    <th className="py-2 pr-3">Ressource</th>
                    <th className="py-2 pr-3">Timesheets</th>
                    <th className="py-2 pr-3">Heures</th>
                    <th className="py-2 pr-3">Coût</th>
                    <th className="py-2 pr-3">Première date</th>
                    <th className="py-2">Dernière date</th>
                  </tr>
                </thead>
                <tbody>
                  {timesheetOutputs.map((row) => (
                    <tr key={row.memberId} className="border-b border-slate-900/70 text-gray-200">
                      <td className="py-2 pr-3">{row.memberName}</td>
                      <td className="py-2 pr-3">{row.timesheets}</td>
                      <td className="py-2 pr-3">{row.hours}</td>
                      <td className="py-2 pr-3">{formatCurrency(row.cost, currency)}</td>
                      <td className="py-2 pr-3">{formatDate(row.firstDate)}</td>
                      <td className="py-2">{formatDate(row.lastDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Courbe tâches (planifié vs réalisé)</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            {taskCurve.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-500">Aucune donnée de tâches datée</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={taskCurve}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="period" stroke="#94a3b8" />
                  <YAxis allowDecimals={false} stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155' }}
                    labelStyle={{ color: '#e2e8f0' }}
                  />
                  <Line type="monotone" dataKey="planned" stroke="#f59e0b" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="done" stroke="#10b981" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Courbe financière cumulée</CardTitle>
          </CardHeader>
          <CardContent className="h-[280px]">
            {financialCurve.length === 0 ? (
              <div className="h-full flex items-center justify-center text-gray-500">
                Aucune donnée financière projet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={financialCurve}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis dataKey="period" stroke="#94a3b8" />
                  <YAxis stroke="#94a3b8" />
                  <Tooltip
                    contentStyle={{ background: '#0f172a', border: '1px solid #334155' }}
                    labelStyle={{ color: '#e2e8f0' }}
                    formatter={(value) => formatCurrency(value, currency)}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="cost" stroke="#ef4444" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="margin" stroke="#38bdf8" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Baselines de référence</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {activeBaseline ? (
            <div className="p-3 rounded border border-slate-700 bg-slate-900/40">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-white font-semibold">
                    {activeBaseline.baseline_label} (v{activeBaseline.version})
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatDate(activeBaseline.planned_start_date)} → {formatDate(activeBaseline.planned_end_date)}
                  </p>
                </div>
                <Badge className="bg-emerald-700 text-white">Active</Badge>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Écart de délai: {scheduleVarianceDays === null ? 'N/A' : `${scheduleVarianceDays} jour(s)`}
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Aucune baseline active.</p>
          )}

          <div className="space-y-2">
            {baselines.map((baseline) => (
              <div
                key={baseline.id}
                className="flex flex-wrap items-center justify-between gap-2 p-2 rounded bg-slate-900/30 border border-slate-800"
              >
                <div>
                  <p className="text-sm text-white">
                    {baseline.baseline_label} (v{baseline.version})
                  </p>
                  <p className="text-xs text-gray-400">
                    {formatDate(baseline.planned_start_date)} → {formatDate(baseline.planned_end_date)}
                  </p>
                </div>
                {!baseline.is_active && (
                  <Button size="sm" variant="outline" onClick={() => setBaselineActive(baseline.id)}>
                    Activer
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10">
        <CardHeader>
          <CardTitle className="text-white">Jalons contractuels & financiers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-slate-700">
                  <th className="py-2">Jalon</th>
                  <th className="py-2">Prévu</th>
                  <th className="py-2">Réel</th>
                  <th className="py-2">Statut</th>
                  <th className="py-2">Base</th>
                  <th className="py-2">Bonus/Malus</th>
                  <th className="py-2">Net</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {milestoneRows.length === 0 && (
                  <tr>
                    <td className="py-3 text-gray-500" colSpan={8}>
                      Aucun jalon défini.
                    </td>
                  </tr>
                )}
                {milestoneRows.map((milestone) => (
                  <tr key={milestone.id} className="border-b border-slate-800">
                    <td className="py-2 text-white">{milestone.title}</td>
                    <td className="py-2 text-gray-300">{formatDate(milestone.planned_date)}</td>
                    <td className="py-2 text-gray-300">{formatDate(milestone.actual_date)}</td>
                    <td className="py-2">
                      <Badge variant="outline">{milestone.status}</Badge>
                    </td>
                    <td className="py-2 text-gray-300">{formatCurrency(milestone.planned_amount, currency)}</td>
                    <td className={`py-2 ${milestone.adjustment >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatCurrency(milestone.adjustment, currency)}
                    </td>
                    <td className="py-2 text-white">{formatCurrency(milestone.net_amount, currency)}</td>
                    <td className="py-2 text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditingMilestone(milestone);
                            setMilestoneForm({
                              title: milestone.title || '',
                              status: milestone.status || 'planned',
                              planned_date: toIsoDate(milestone.planned_date) || '',
                              actual_date: toIsoDate(milestone.actual_date) || '',
                              planned_amount: String(milestone.planned_amount ?? 0),
                              bonus_rule_type: milestone.bonus_rule_type || 'none',
                              bonus_rule_value: String(milestone.bonus_rule_value ?? 0),
                              malus_rule_type: milestone.malus_rule_type || 'none',
                              malus_rule_value: String(milestone.malus_rule_value ?? 0),
                            });
                            setMilestoneDialogOpen(true);
                          }}
                        >
                          Éditer
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-400"
                          onClick={() => deleteMilestone(milestone.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Users className="w-4 h-4" /> Ressources
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {resources.length === 0 && <p className="text-sm text-gray-500">Aucune ressource allouée.</p>}
            {resources.map((resource) => (
              <div
                key={resource.id}
                className="p-2 border border-slate-800 rounded bg-slate-900/30 flex items-center justify-between gap-2"
              >
                <div>
                  <p className="text-white text-sm">
                    {resource.team_member?.name || resource.resource_name || 'Ressource'} ({resource.resource_type})
                  </p>
                  <p className="text-xs text-gray-400">
                    Planifié {resource.planned_quantity} {resource.unit} / Réel {resource.actual_quantity}{' '}
                    {resource.unit}
                  </p>
                  <p className="text-xs text-gray-500">
                    Coût {formatCurrency(resource.actual_cost, currency)} ({resource.status})
                  </p>
                </div>
                <Button size="sm" variant="ghost" className="text-red-400" onClick={() => deleteResource(resource.id)}>
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-white/5 border-white/10">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Wrench className="w-4 h-4" /> Paiements exécution (équipe)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {compensations.length === 0 && <p className="text-sm text-gray-500">Aucune compensation enregistrée.</p>}
            {compensations.slice(0, 8).map((compensation) => (
              <div
                key={compensation.id}
                className="p-2 border border-slate-800 rounded bg-slate-900/30 flex items-center justify-between gap-2"
              >
                <div>
                  <p className="text-white text-sm">{compensation.team_member?.name || 'Membre'}</p>
                  <p className="text-xs text-gray-400">
                    {formatCurrency(compensation.amount, currency)} • {compensation.compensation_type}
                  </p>
                  <p className="text-xs text-gray-500">{compensation.payment_status}</p>
                </div>
                {compensation.payment_status !== 'paid' && (
                  <Button size="sm" variant="outline" onClick={() => markCompensationPaid(compensation.id)}>
                    Marquer payé
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Dialog open={baselineDialogOpen} onOpenChange={setBaselineDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>Créer une baseline</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nom baseline</Label>
              <Input
                value={baselineForm.baseline_label}
                onChange={(e) => setBaselineForm((prev) => ({ ...prev, baseline_label: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Début prévu</Label>
                <Input
                  type="date"
                  value={baselineForm.planned_start_date}
                  onChange={(e) => setBaselineForm((prev) => ({ ...prev, planned_start_date: e.target.value }))}
                />
              </div>
              <div>
                <Label>Fin prévue</Label>
                <Input
                  type="date"
                  value={baselineForm.planned_end_date}
                  onChange={(e) => setBaselineForm((prev) => ({ ...prev, planned_end_date: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Heures prévues</Label>
                <Input
                  type="number"
                  value={baselineForm.planned_budget_hours}
                  onChange={(e) => setBaselineForm((prev) => ({ ...prev, planned_budget_hours: e.target.value }))}
                />
              </div>
              <div>
                <Label>Budget prévu</Label>
                <Input
                  type="number"
                  value={baselineForm.planned_budget_amount}
                  onChange={(e) => setBaselineForm((prev) => ({ ...prev, planned_budget_amount: e.target.value }))}
                />
              </div>
              <div>
                <Label>Tâches prévues</Label>
                <Input
                  type="number"
                  value={baselineForm.planned_tasks_count}
                  onChange={(e) => setBaselineForm((prev) => ({ ...prev, planned_tasks_count: e.target.value }))}
                />
              </div>
            </div>
            <Button className="w-full bg-orange-500 hover:bg-orange-600" onClick={handleCreateBaseline}>
              Enregistrer baseline
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={milestoneDialogOpen}
        onOpenChange={(open) => {
          setMilestoneDialogOpen(open);
          if (!open) {
            setEditingMilestone(null);
            setMilestoneForm(createDefaultMilestoneForm());
          }
        }}
      >
        <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingMilestone ? 'Éditer jalon' : 'Nouveau jalon'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Titre</Label>
              <Input
                value={milestoneForm.title}
                onChange={(e) => setMilestoneForm((prev) => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Statut</Label>
                <Select
                  value={milestoneForm.status}
                  onValueChange={(value) => setMilestoneForm((prev) => ({ ...prev, status: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="planned">Planned</SelectItem>
                    <SelectItem value="in_progress">In progress</SelectItem>
                    <SelectItem value="achieved">Achieved</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Date prévue</Label>
                <Input
                  type="date"
                  value={milestoneForm.planned_date}
                  onChange={(e) => setMilestoneForm((prev) => ({ ...prev, planned_date: e.target.value }))}
                />
              </div>
              <div>
                <Label>Date réelle</Label>
                <Input
                  type="date"
                  value={milestoneForm.actual_date}
                  onChange={(e) => setMilestoneForm((prev) => ({ ...prev, actual_date: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Montant de base</Label>
              <Input
                type="number"
                value={milestoneForm.planned_amount}
                onChange={(e) => setMilestoneForm((prev) => ({ ...prev, planned_amount: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Règle bonus</Label>
                <Select
                  value={milestoneForm.bonus_rule_type}
                  onValueChange={(value) => setMilestoneForm((prev) => ({ ...prev, bonus_rule_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    <SelectItem value="fixed">Fixe</SelectItem>
                    <SelectItem value="percentage">%</SelectItem>
                    <SelectItem value="day">Par jour</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={milestoneForm.bonus_rule_value}
                  onChange={(e) => setMilestoneForm((prev) => ({ ...prev, bonus_rule_value: e.target.value }))}
                />
              </div>
              <div className="space-y-1">
                <Label>Règle malus</Label>
                <Select
                  value={milestoneForm.malus_rule_type}
                  onValueChange={(value) => setMilestoneForm((prev) => ({ ...prev, malus_rule_type: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Aucun</SelectItem>
                    <SelectItem value="fixed">Fixe</SelectItem>
                    <SelectItem value="percentage">%</SelectItem>
                    <SelectItem value="day">Par jour</SelectItem>
                  </SelectContent>
                </Select>
                <Input
                  type="number"
                  value={milestoneForm.malus_rule_value}
                  onChange={(e) => setMilestoneForm((prev) => ({ ...prev, malus_rule_value: e.target.value }))}
                />
              </div>
            </div>
            <Button className="w-full bg-blue-600 hover:bg-blue-700" onClick={handleSaveMilestone}>
              Enregistrer jalon
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resourceDialogOpen} onOpenChange={setResourceDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white">
          <DialogHeader>
            <DialogTitle>Nouvelle ressource</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Type</Label>
              <Select
                value={resourceForm.resource_type}
                onValueChange={(value) => setResourceForm((prev) => ({ ...prev, resource_type: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="human">Humaine</SelectItem>
                  <SelectItem value="material">Matérielle</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {resourceForm.resource_type === 'human' ? (
              <div>
                <Label>Membre</Label>
                <Select
                  value={resourceForm.team_member_id}
                  onValueChange={(value) => setResourceForm((prev) => ({ ...prev, team_member_id: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner membre" />
                  </SelectTrigger>
                  <SelectContent>
                    {members.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name} ({member.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>Ressource matérielle</Label>
                <Input
                  value={resourceForm.resource_name}
                  onChange={(e) => setResourceForm((prev) => ({ ...prev, resource_name: e.target.value }))}
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Quantité planifiée</Label>
                <Input
                  type="number"
                  value={resourceForm.planned_quantity}
                  onChange={(e) => setResourceForm((prev) => ({ ...prev, planned_quantity: e.target.value }))}
                />
              </div>
              <div>
                <Label>Quantité réelle</Label>
                <Input
                  type="number"
                  value={resourceForm.actual_quantity}
                  onChange={(e) => setResourceForm((prev) => ({ ...prev, actual_quantity: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label>Coût planifié</Label>
                <Input
                  type="number"
                  value={resourceForm.planned_cost}
                  onChange={(e) => setResourceForm((prev) => ({ ...prev, planned_cost: e.target.value }))}
                />
              </div>
              <div>
                <Label>Coût réel</Label>
                <Input
                  type="number"
                  value={resourceForm.actual_cost}
                  onChange={(e) => setResourceForm((prev) => ({ ...prev, actual_cost: e.target.value }))}
                />
              </div>
            </div>
            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={handleCreateResource}>
              Enregistrer ressource
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {loading && <p className="text-sm text-gray-500">Chargement des données de pilotage...</p>}
      <div className="text-xs text-gray-500 flex items-center gap-1">
        <TrendingUp className="w-3 h-3" />
        Ce tableau centralise délais de base/réels, jalons financiers, ressources et coûts opérationnels.
      </div>
    </div>
  );
};

export default ProjectControlCenter;
