import { useState, useMemo, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, CheckCircle2, Circle, Clock, ClipboardList, Plus, Search, UserCheck, Users } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { useRecruitment } from '@/hooks/useRecruitment';
import { useToast } from '@/components/ui/use-toast';

/* ---------- helpers ---------- */

const formatDate = (value, locale = 'fr-FR') => {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString(locale);
};

const normalize = (s = '') =>
  String(s)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const getDaysRemaining = (plan) => {
  if (!plan.start_date || !plan.duration_days) return null;
  const start = new Date(plan.start_date);
  if (Number.isNaN(start.getTime())) return null;
  const endMs = start.getTime() + plan.duration_days * 86400000;
  const remaining = Math.ceil((endMs - Date.now()) / 86400000);
  return remaining;
};

const getEmployeeLabel = (emp) =>
  emp?.full_name || `${emp?.first_name || ''} ${emp?.last_name || ''}`.trim() || emp?.work_email || '-';

const STATUS_CLS = {
  active: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  completed: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  cancelled: 'bg-red-500/20 text-red-300 border-red-500/30',
  paused: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
};

/* ---------- Main component ---------- */

const OnboardingPage = () => {
  const { t, i18n } = useTranslation();
  const { toast } = useToast();
  const { onboardingPlans, employees, loading, createOnboardingPlan, updateOnboardingTask } = useRecruitment();

  const getStatusLabel = useCallback(
    (status) => {
      const key = `employee.onboarding.status.${status}`;
      const fallbacks = { active: 'Actif', completed: 'Terminé', cancelled: 'Annulé', paused: 'En pause' };
      return t(key, fallbacks[status] || status);
    },
    [t]
  );

  const [search, setSearch] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [createDialog, setCreateDialog] = useState(false);
  const [newPlanForm, setNewPlanForm] = useState({
    employee_id: '',
    mentor_employee_id: '',
    plan_name: '',
    start_date: '',
    duration_days: '30',
    tasks: '',
  });

  /* ---------- derived data ---------- */

  const filteredPlans = useMemo(() => {
    if (!search) return onboardingPlans;
    const q = normalize(search);
    return onboardingPlans.filter((p) => {
      const emp = p.employee;
      const mentor = p.mentor;
      return (
        normalize(getEmployeeLabel(emp)).includes(q) ||
        normalize(getEmployeeLabel(mentor)).includes(q) ||
        normalize(p.plan_name).includes(q)
      );
    });
  }, [onboardingPlans, search]);

  const selectedPlan = useMemo(
    () => (selectedPlanId ? onboardingPlans.find((p) => p.id === selectedPlanId) : null),
    [selectedPlanId, onboardingPlans]
  );

  const stats = useMemo(() => {
    const active = onboardingPlans.filter((p) => p.status === 'active').length;
    const completed = onboardingPlans.filter((p) => p.status === 'completed').length;
    // DB column is `completion_pct` (not `progress_pct`) — BUG-1 fix
    const avgProgress =
      onboardingPlans.length > 0
        ? Math.round(onboardingPlans.reduce((s, p) => s + (p.completion_pct || 0), 0) / onboardingPlans.length)
        : 0;
    return { active, completed, avgProgress, total: onboardingPlans.length };
  }, [onboardingPlans]);

  /* ---------- handlers ---------- */

  const handleToggleTask = useCallback(
    async (taskIndex, currentCompleted) => {
      if (!selectedPlan) return;
      try {
        await updateOnboardingTask(selectedPlan.id, taskIndex, !currentCompleted);
      } catch (err) {
        toast({ title: t('common.error', 'Erreur'), description: err.message, variant: 'destructive' });
      }
    },
    [selectedPlan, updateOnboardingTask, toast, t]
  );

  const handleCreatePlan = useCallback(async () => {
    try {
      const taskLines = newPlanForm.tasks
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean);
      // DB column is `checklist` (not `tasks`) — BUG-1 fix
      const checklist = taskLines.map((label, i) => ({
        label,
        completed: false,
        order: i,
      }));

      await createOnboardingPlan({
        employee_id: newPlanForm.employee_id,
        mentor_employee_id: newPlanForm.mentor_employee_id || null,
        plan_name: newPlanForm.plan_name || `Onboarding ${formatDate(new Date().toISOString())}`,
        start_date: newPlanForm.start_date || new Date().toISOString().slice(0, 10),
        duration_days: Number(newPlanForm.duration_days) || 30,
        checklist,
      });

      setCreateDialog(false);
      setNewPlanForm({
        employee_id: '',
        mentor_employee_id: '',
        plan_name: '',
        start_date: '',
        duration_days: '30',
        tasks: '',
      });
    } catch (err) {
      toast({ title: t('common.error', 'Erreur'), description: err.message, variant: 'destructive' });
    }
  }, [newPlanForm, createOnboardingPlan, toast, t]);

  /* ---------- Plan detail view ---------- */

  const renderPlanDetail = () => {
    if (!selectedPlan) return null;
    const emp = selectedPlan.employee;
    const mentor = selectedPlan.mentor;
    // DB column is `checklist` (not `tasks`) — BUG-1 fix
    const tasks = Array.isArray(selectedPlan.checklist) ? selectedPlan.checklist : [];
    const daysLeft = getDaysRemaining(selectedPlan);
    const stCls = STATUS_CLS[selectedPlan.status] || STATUS_CLS.active;
    const stLabel = getStatusLabel(selectedPlan.status);

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedPlanId(null)}
            className="text-gray-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> {t('onboarding.back', 'Retour')}
          </Button>
          <h2 className="text-lg font-semibold text-white">
            {selectedPlan.plan_name || t('employee.onboarding.plan', "Plan d'onboarding")}
          </h2>
          <Badge className={`text-xs border ${stCls}`}>{stLabel}</Badge>
        </div>

        {/* Summary card */}
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-5">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
              <div>
                <p className="text-xs text-gray-500 mb-1">{t('employee.onboarding.employee', 'Employé')}</p>
                <p className="text-sm text-white font-medium">{getEmployeeLabel(emp)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">{t('employee.onboarding.mentor', 'Mentor')}</p>
                <p className="text-sm text-white font-medium">
                  {mentor ? getEmployeeLabel(mentor) : t('employee.onboarding.unassigned', 'Non assigné')}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">{t('employee.onboarding.daysLeft', 'Jours restants')}</p>
                <p
                  className={`text-sm font-medium ${daysLeft != null && daysLeft <= 5 ? 'text-red-400' : 'text-white'}`}
                >
                  {daysLeft != null
                    ? daysLeft > 0
                      ? t('employee.onboarding.daysRemaining', '{{count}} jours', { count: daysLeft })
                      : t('employee.onboarding.status.completed', 'Terminé')
                    : '-'}
                </p>
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-400">
                <span>{t('employee.onboarding.progress', 'Progression')}</span>
                {/* DB column is `completion_pct` (not `progress_pct`) — BUG-1 fix */}
                <span className="text-orange-400 font-semibold">{selectedPlan.completion_pct || 0}%</span>
              </div>
              <Progress value={selectedPlan.completion_pct || 0} className="h-2 bg-white/10" />
            </div>
          </CardContent>
        </Card>

        {/* Timeline / checklist */}
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-orange-400" /> {t('employee.onboarding.tasks', 'Tâches')} (
              {tasks.filter((tk) => tk.completed).length}/{tasks.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {tasks.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                {t('employee.onboarding.noTasks', 'Aucune tâche définie pour ce plan.')}
              </p>
            ) : (
              <div className="divide-y divide-white/5">
                {tasks.map((task, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-white/[0.03] transition-colors cursor-pointer"
                    onClick={() => handleToggleTask(idx, task.completed)}
                  >
                    {/* Timeline dot */}
                    <div className="relative flex flex-col items-center">
                      {task.completed ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <Circle className="w-5 h-5 text-gray-600" />
                      )}
                      {idx < tasks.length - 1 && <div className="absolute top-6 w-px h-4 bg-white/10" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm ${task.completed ? 'text-gray-500 line-through' : 'text-white'}`}>
                        {task.label || t('employee.onboarding.taskN', 'Tâche {{n}}', { n: idx + 1 })}
                      </p>
                    </div>
                    <Checkbox
                      checked={task.completed}
                      onCheckedChange={() => handleToggleTask(idx, task.completed)}
                      onClick={(e) => e.stopPropagation()}
                      className="border-white/20 data-[state=checked]:bg-orange-500 data-[state=checked]:border-orange-500"
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dates info */}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3" /> {t('employee.onboarding.startDate', 'Début')} :{' '}
            {formatDate(selectedPlan.start_date, i18n.language)}
          </span>
          <span>
            {t('employee.onboarding.duration', 'Durée')} : {selectedPlan.duration_days || '-'}{' '}
            {t('employee.onboarding.days', 'jours')}
          </span>
          <span>
            {t('employee.onboarding.createdOn', 'Créé le')} {formatDate(selectedPlan.created_at, i18n.language)}
          </span>
        </div>
      </div>
    );
  };

  /* ---------- Plans list view ---------- */

  const renderPlansList = () => (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            placeholder={t('employee.onboarding.searchPlan', 'Rechercher un plan...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-white/5 border-white/10 text-white placeholder:text-gray-500"
          />
        </div>
        <Button
          size="sm"
          onClick={() => setCreateDialog(true)}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          <Plus className="w-4 h-4 mr-1.5" /> {t('employee.onboarding.newPlan', 'Nouveau plan')}
        </Button>
      </div>

      {filteredPlans.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
          <ClipboardList className="w-12 h-12 mx-auto mb-3 opacity-40" />
          <p>{t('employee.onboarding.noPlans', "Aucun plan d'onboarding trouvé")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredPlans.map((plan) => {
            const emp = plan.employee;
            const mentor = plan.mentor;
            const daysLeft = getDaysRemaining(plan);
            // DB column is `checklist` (not `tasks`) — BUG-1 fix
            const tasks = Array.isArray(plan.checklist) ? plan.checklist : [];
            const completedTasks = tasks.filter((tk) => tk.completed).length;
            const stCls = STATUS_CLS[plan.status] || STATUS_CLS.active;
            const stLabel = getStatusLabel(plan.status);

            return (
              <Card
                key={plan.id}
                className="bg-white/5 border-white/10 hover:border-orange-500/30 transition-colors cursor-pointer"
                onClick={() => setSelectedPlanId(plan.id)}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base text-white leading-snug">
                      {plan.plan_name || t('employee.onboarding.plan', "Plan d'onboarding")}
                    </CardTitle>
                    <Badge className={`shrink-0 text-xs border ${stCls}`}>{stLabel}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="space-y-1.5">
                    <p className="text-sm text-gray-400 flex items-center gap-1.5">
                      <UserCheck className="w-3.5 h-3.5" /> {getEmployeeLabel(emp)}
                    </p>
                    {mentor && (
                      <p className="text-sm text-gray-500 flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5" /> {t('employee.onboarding.mentor', 'Mentor')} :{' '}
                        {getEmployeeLabel(mentor)}
                      </p>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">
                        {completedTasks}/{tasks.length} {t('employee.onboarding.tasks', 'tâches')}
                      </span>
                      <span className="text-orange-400 font-semibold">{plan.completion_pct || 0}%</span>
                    </div>
                    <Progress value={plan.completion_pct || 0} className="h-1.5 bg-white/10" />
                  </div>

                  {/* Days remaining */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-600">
                      {t('employee.onboarding.startDate', 'Début')} : {formatDate(plan.start_date, i18n.language)}
                    </span>
                    {daysLeft != null && (
                      <span
                        className={`font-medium ${daysLeft <= 5 ? 'text-red-400' : daysLeft <= 15 ? 'text-amber-400' : 'text-gray-400'}`}
                      >
                        {daysLeft > 0
                          ? t('employee.onboarding.daysRemaining', '{{count}} jours', { count: daysLeft })
                          : t('employee.onboarding.overdue', 'Délai dépassé')}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );

  /* ---------- Render ---------- */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0e1a] flex items-center justify-center">
        <div className="animate-pulse text-gray-400">{t('loading.page', 'Chargement...')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0e1a]">
      <Helmet>
        <title>{t('employee.onboarding.title', 'Onboarding')} | CashPilot</title>
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{t('employee.onboarding.title', 'Onboarding')}</h1>
            <p className="text-sm text-gray-400 mt-1">
              {t('employee.onboarding.subtitle', "Suivez l'intégration de vos nouveaux collaborateurs.")}
            </p>
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-400">
                {t('employee.onboarding.activePlans', 'Plans actifs')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-orange-400">{stats.active}</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-400">
                {t('employee.onboarding.status.completed', 'Terminés')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-emerald-400">{stats.completed}</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-400">
                {t('employee.onboarding.avgProgress', 'Progression moy.')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-white">{stats.avgProgress}%</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-gray-400">
                {t('employee.onboarding.totalPlans', 'Total plans')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-white">{stats.total}</p>
            </CardContent>
          </Card>
        </div>

        {/* Main content: either plan list or plan detail */}
        {selectedPlanId && selectedPlan ? renderPlanDetail() : renderPlansList()}
      </div>

      {/* ---------- Create Plan Dialog ---------- */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="sm:max-w-lg bg-[#0f1528] border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>{t('employee.onboarding.newPlanDialog', "Nouveau plan d'onboarding")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-gray-300">{t('employee.onboarding.planName', 'Nom du plan')}</Label>
              <Input
                value={newPlanForm.plan_name}
                onChange={(e) => setNewPlanForm((f) => ({ ...f, plan_name: e.target.value }))}
                className="bg-white/5 border-white/10 text-white mt-1"
                placeholder="Onboarding Développeur"
              />
            </div>
            <div>
              <Label className="text-gray-300">{t('employee.onboarding.employeeRequired', 'Employé *')}</Label>
              <Select
                value={newPlanForm.employee_id}
                onValueChange={(v) => setNewPlanForm((f) => ({ ...f, employee_id: v }))}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                  <SelectValue placeholder={t('employee.onboarding.selectEmployee', 'Sélectionner un employé')} />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {getEmployeeLabel(emp)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-300">{t('employee.onboarding.mentor', 'Mentor')}</Label>
              <Select
                value={newPlanForm.mentor_employee_id}
                onValueChange={(v) => setNewPlanForm((f) => ({ ...f, mentor_employee_id: v }))}
              >
                <SelectTrigger className="bg-white/5 border-white/10 text-white mt-1">
                  <SelectValue
                    placeholder={t('employee.onboarding.selectMentor', 'Sélectionner un mentor (optionnel)')}
                  />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.id} value={emp.id}>
                      {getEmployeeLabel(emp)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-300">{t('employee.onboarding.startDateLabel', 'Date de début')}</Label>
                <Input
                  type="date"
                  value={newPlanForm.start_date}
                  onChange={(e) => setNewPlanForm((f) => ({ ...f, start_date: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-300">{t('employee.onboarding.durationLabel', 'Durée (jours)')}</Label>
                <Input
                  type="number"
                  value={newPlanForm.duration_days}
                  onChange={(e) => setNewPlanForm((f) => ({ ...f, duration_days: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white mt-1"
                  min="1"
                />
              </div>
            </div>
            <div>
              <Label className="text-gray-300">{t('employee.onboarding.tasksLabel', 'Tâches (une par ligne)')}</Label>
              <textarea
                value={newPlanForm.tasks}
                onChange={(e) => setNewPlanForm((f) => ({ ...f, tasks: e.target.value }))}
                className="mt-1 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/40 min-h-[100px] resize-y"
                placeholder={
                  "Accueil et visite des locaux\nConfiguration du poste de travail\nPrésentation de l'équipe\nFormation outils internes\nPoint d'étape semaine 1"
                }
                rows={5}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setCreateDialog(false)} className="text-gray-400">
              {t('common.cancel', 'Annuler')}
            </Button>
            <Button
              onClick={handleCreatePlan}
              disabled={!newPlanForm.employee_id}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              {t('employee.onboarding.createPlan', 'Créer le plan')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OnboardingPage;
