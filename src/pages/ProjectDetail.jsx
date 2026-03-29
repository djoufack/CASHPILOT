import { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProjects } from '@/hooks/useProjects';
import { useTasksForProject } from '@/hooks/useTasksForProject';
import { useProjectStatus } from '@/hooks/useProjectStatus';
import { useProjectProfitability } from '@/hooks/useProjectProfitability';
import { buildProjectGanttDependencyInsights } from '@/services/projectGanttDependencyInsights';
import { buildProjectBudgetVsActualInsights } from '@/services/projectBudgetVsActualInsights';
import GanttView from '@/components/GanttView';
import TaskManager from '@/components/TaskManager';
import ProjectStatistics from '@/components/ProjectStatistics';
import ProjectControlCenter from '@/components/ProjectControlCenter';
import KanbanBoard from '@/components/KanbanBoard';
import CalendarView from '@/components/CalendarView';
import AgendaView from '@/components/AgendaView';
import TaskForm from '@/components/TaskForm';
import ProjectBillingDialog from '@/components/ProjectBillingDialog';
import { useClientQuotes } from '@/hooks/useClientQuotes';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/components/ui/use-toast';
import {
  ArrowLeft,
  BarChart2,
  Briefcase,
  Calendar as CalendarIcon,
  Clock,
  LayoutList,
  PieChart,
  Kanban,
  List,
  CalendarDays,
  Receipt,
  TrendingUp,
} from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';

const ProjectDetail = () => {
  const { projectId } = useParams();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { projects, loading: projectsLoading } = useProjects();
  const [project, setProject] = useState(null);
  const { tasks, createTask, updateTask, deleteTask, refreshTasks } = useTasksForProject(projectId);
  const { status: calculatedStatus, stats } = useProjectStatus(projectId);
  const { quotes: projectQuotes } = useClientQuotes(project?.client_id);

  const { profitability, fetchData: fetchProfitability } = useProjectProfitability(project?.id);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [activeTab, setActiveTab] = useState('kanban');
  const [billingOpen, setBillingOpen] = useState(false);
  const [ganttViewMode, setGanttViewMode] = useState('Week');
  const [dependencyMode, setDependencyMode] = useState(false);
  const [dependencySourceTaskId, setDependencySourceTaskId] = useState(null);

  const taskTitleMap = useMemo(() => {
    const entries = (tasks || []).map((task) => [task.id, task.title || task.name || task.id]);
    return Object.fromEntries(entries);
  }, [tasks]);

  const getSubtaskCount = (task) => {
    if (Array.isArray(task?.subtasks)) {
      if (Object.prototype.hasOwnProperty.call(task.subtasks?.[0] || {}, 'count')) {
        return Number(task.subtasks?.[0]?.count || 0);
      }
      return task.subtasks.length;
    }
    return Number(task?.subtasks_count || 0);
  };

  const taskViewsData = useMemo(() => {
    return (tasks || []).map((task) => {
      const dependencyIds = Array.isArray(task?.depends_on) ? task.depends_on : [];
      const dependencyTitles = dependencyIds.map((dependencyId) => taskTitleMap[dependencyId]).filter(Boolean);
      const subtasksCount = getSubtaskCount(task);
      const subtaskItems = Array.isArray(task?.subtasks)
        ? task.subtasks.filter((subtask) => subtask && !Object.prototype.hasOwnProperty.call(subtask, 'count'))
        : [];

      return {
        ...task,
        dependency_ids: dependencyIds,
        dependency_titles: dependencyTitles,
        dependency_tasks: dependencyIds.map((dependencyId, index) => ({
          id: dependencyId,
          title: dependencyTitles[index] || dependencyId,
        })),
        dependencies_count: dependencyIds.length,
        subtasks_count: subtasksCount,
        subtasks_items: subtaskItems,
      };
    });
  }, [tasks, taskTitleMap]);

  const ganttDependencyInsights = useMemo(() => {
    return buildProjectGanttDependencyInsights(taskViewsData);
  }, [taskViewsData]);

  const projectBudgetInsights = useMemo(() => {
    return buildProjectBudgetVsActualInsights(project, profitability);
  }, [project, profitability]);

  const subtasksForKanban = useMemo(() => {
    return taskViewsData.flatMap((task) =>
      (task?.subtasks_items || []).map((subtask) => ({
        ...subtask,
        parent_task_id: task.id,
        parent_task_title: task.title || task.name || task.id,
      }))
    );
  }, [taskViewsData]);

  useEffect(() => {
    if (projects.length > 0) {
      const found = projects.find((p) => p.id === projectId);
      setProject(found || null);
    }
  }, [projectId, projects]);

  useEffect(() => {
    if (activeTab === 'profitability') {
      fetchProfitability();
    }
  }, [activeTab, fetchProfitability]);

  useEffect(() => {
    if (!dependencyMode) {
      setDependencySourceTaskId(null);
    }
  }, [dependencyMode]);

  const handleEdit = (task) => {
    setEditingTask(task);
    setIsFormOpen(true);
  };

  const handleOpenTask = (taskId) => {
    const target = (tasks || []).find((task) => task.id === taskId);
    if (target) {
      handleEdit(target);
    }
  };

  const handleSubtaskStatusChange = async (subtaskId, nextStatus) => {
    try {
      await supabase
        .from('subtasks')
        .update({ status: nextStatus, updated_at: new Date().toISOString() })
        .eq('id', subtaskId);
      refreshTasks();
    } catch (error) {
      console.error('Failed to update subtask status:', error);
      toast({
        title: 'Erreur sous-tâche',
        description: 'Impossible de déplacer la sous-tâche.',
        variant: 'destructive',
      });
    }
  };

  const handleTaskSelectionForDependency = async (rawTaskId) => {
    const taskId = rawTaskId?.startsWith?.('subtask-') ? null : rawTaskId;
    if (!taskId) {
      toast({
        title: 'Dépendance limitée aux tâches',
        description: 'Sélectionnez une tâche principale, pas une sous-tâche.',
      });
      return;
    }

    if (!dependencyMode) {
      handleOpenTask(taskId);
      return;
    }

    if (!dependencySourceTaskId) {
      setDependencySourceTaskId(taskId);
      toast({
        title: 'Source sélectionnée',
        description: 'Cliquez maintenant sur la tâche cible pour créer la dépendance.',
      });
      return;
    }

    if (dependencySourceTaskId === taskId) {
      setDependencySourceTaskId(null);
      toast({
        title: 'Sélection annulée',
        description: 'La tâche source et la cible doivent être différentes.',
      });
      return;
    }

    const targetTask = (tasks || []).find((task) => task.id === taskId);
    if (!targetTask) return;

    const previousDependencies = Array.isArray(targetTask.depends_on) ? targetTask.depends_on : [];
    const nextDependencies = [...new Set([...previousDependencies, dependencySourceTaskId])];

    try {
      await supabase
        .from('tasks')
        .update({ depends_on: nextDependencies, updated_at: new Date().toISOString() })
        .eq('id', taskId);

      setDependencySourceTaskId(null);
      await refreshTasks();
      toast({
        title: 'Dépendance créée',
        description: 'La dépendance a été ajoutée avec succès.',
      });
    } catch (error) {
      console.error('Failed to create dependency:', error);
      toast({
        title: 'Erreur dépendance',
        description: 'Impossible de créer la dépendance.',
        variant: 'destructive',
      });
    }
  };

  const handleSave = async (data) => {
    if (editingTask) {
      await updateTask(editingTask.id, data);
    } else {
      await createTask(data);
    }
    setIsFormOpen(false);
    refreshTasks();
  };

  if (!project) {
    // If projects have loaded but this ID wasn't found, show an error instead of spinning forever
    if (!projectsLoading && projects.length > 0) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[500px] text-white gap-4">
          <p className="text-lg text-gray-400">Project not found.</p>
          <Link to="/app/projects">
            <Button variant="outline" className="border-gray-700 text-gray-300 hover:bg-gray-800">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Projects
            </Button>
          </Link>
        </div>
      );
    }
    return <div className="flex items-center justify-center h-full min-h-[500px] text-white">Loading Project...</div>;
  }

  return (
    <>
      <Helmet>
        <title>{project.name} - Project Details</title>
      </Helmet>

      <div className="container mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link to="/app/projects">
            <Button variant="ghost" className="mb-4 pl-0 text-gray-400 hover:text-white hover:bg-transparent">
              <ArrowLeft className="w-4 h-4 mr-2" /> Back to Projects
            </Button>
          </Link>

          <div className="flex flex-col lg:flex-row justify-between items-start gap-4">
            <div>
              <motion.h1
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-3xl md:text-4xl font-bold text-gradient mb-2"
              >
                {project.name}
              </motion.h1>
              <div className="flex flex-wrap gap-4 text-gray-400 text-sm">
                <span className="flex items-center">
                  <Briefcase className="w-4 h-4 mr-1 text-orange-400" /> {project.client?.company_name}
                </span>
                <span className="flex items-center">
                  <CalendarIcon className="w-4 h-4 mr-1 text-orange-400" /> Created{' '}
                  {format(parseISO(project.created_at), 'MMM d, yyyy')}
                </span>

                {/* Status Badge */}
                <span
                  className={`px-3 py-0.5 rounded-full text-xs font-medium capitalize border ${
                    calculatedStatus === 'completed'
                      ? 'bg-green-900/40 text-green-400 border-green-700'
                      : calculatedStatus === 'in_progress'
                        ? 'bg-blue-900/40 text-blue-400 border-blue-700'
                        : calculatedStatus === 'on_hold'
                          ? 'bg-orange-900/40 text-orange-400 border-orange-700'
                          : calculatedStatus === 'cancelled'
                            ? 'bg-red-900/40 text-red-400 border-red-700'
                            : 'bg-gray-800 text-gray-400 border-gray-700'
                  }`}
                >
                  {calculatedStatus.replace('_', ' ')}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-3 w-full lg:w-auto">
              <div className="bg-gray-900 p-4 rounded-lg border border-gray-800 flex flex-wrap gap-6 text-sm w-full">
                <div>
                  <p className="text-gray-500 mb-1">Budget</p>
                  <p className="text-gradient font-mono flex items-center gap-1">
                    <Clock className="w-3 h-3" /> {project.budget_hours || 0}h
                  </p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Progress</p>
                  <p className="text-gradient font-mono flex items-center gap-1">
                    <PieChart className="w-3 h-3" /> {stats.progress}%
                  </p>
                </div>
              </div>
              <Button onClick={() => setBillingOpen(true)} className="bg-orange-500 hover:bg-orange-600">
                <Receipt className="w-4 h-4 mr-2" />
                {t('projects.billProject')}
              </Button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="overflow-x-auto pb-2">
            <TabsList className="bg-gray-900 border border-gray-800 p-1 w-full justify-start">
              <TabsTrigger
                value="list"
                className="data-[state=active]:bg-orange-500/10 text-gray-400 data-[state=active]:text-orange-400 flex-1"
              >
                <LayoutList className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">List</span>
              </TabsTrigger>
              <TabsTrigger
                value="kanban"
                className="data-[state=active]:bg-orange-500/10 text-gray-400 data-[state=active]:text-orange-400 flex-1"
              >
                <Kanban className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Kanban</span>
              </TabsTrigger>
              <TabsTrigger
                value="calendar"
                className="data-[state=active]:bg-orange-500/10 text-gray-400 data-[state=active]:text-orange-400 flex-1"
              >
                <CalendarDays className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Calendar</span>
              </TabsTrigger>
              <TabsTrigger
                value="agenda"
                className="data-[state=active]:bg-orange-500/10 text-gray-400 data-[state=active]:text-orange-400 flex-1"
              >
                <List className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Agenda</span>
              </TabsTrigger>
              <TabsTrigger
                value="stats"
                className="data-[state=active]:bg-orange-500/10 text-gray-400 data-[state=active]:text-orange-400 flex-1"
              >
                <PieChart className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Stats</span>
              </TabsTrigger>
              <TabsTrigger
                value="profitability"
                className="data-[state=active]:bg-orange-500/10 text-gray-400 data-[state=active]:text-orange-400 flex-1"
              >
                <TrendingUp className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">{t('projects.profitability.title')}</span>
              </TabsTrigger>
              <TabsTrigger
                value="control"
                className="data-[state=active]:bg-orange-500/10 text-gray-400 data-[state=active]:text-orange-400 flex-1"
              >
                <TrendingUp className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Control</span>
              </TabsTrigger>
              <TabsTrigger
                value="gantt"
                className="data-[state=active]:bg-orange-500/10 text-gray-400 data-[state=active]:text-orange-400 flex-1"
              >
                <BarChart2 className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">{t('projects.gantt.title')}</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="list" className="focus:outline-none">
            <TaskManager projectId={projectId} quotes={projectQuotes} project={project} />
          </TabsContent>

          <TabsContent value="kanban" className="focus:outline-none overflow-x-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gradient">Board</h2>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={dependencyMode ? 'default' : 'outline'}
                  onClick={() => setDependencyMode((previous) => !previous)}
                  className={
                    dependencyMode
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      : 'border-gray-700 text-gray-300 hover:bg-gray-800'
                  }
                >
                  {dependencyMode ? 'Mode dépendance actif' : 'Créer dépendance'}
                </Button>
                <Button
                  onClick={() => {
                    setEditingTask(null);
                    setIsFormOpen(true);
                  }}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  Add Task
                </Button>
              </div>
            </div>
            {dependencyMode && (
              <p className="mb-3 text-xs text-indigo-300">
                {dependencySourceTaskId
                  ? 'Cliquez sur la tâche cible pour lier la dépendance.'
                  : 'Cliquez sur la tâche source, puis sur la tâche cible.'}
              </p>
            )}
            <KanbanBoard
              tasks={taskViewsData}
              onEdit={handleEdit}
              onDelete={deleteTask}
              onStatusChange={refreshTasks}
              onOpenTask={handleOpenTask}
              onTaskClick={(task) => handleTaskSelectionForDependency(task?.id)}
              subtasks={subtasksForKanban}
              onSubtaskStatusChange={handleSubtaskStatusChange}
            />
          </TabsContent>

          <TabsContent value="calendar" className="focus:outline-none overflow-x-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gradient">Calendar</h2>
              <Button
                onClick={() => {
                  setEditingTask(null);
                  setIsFormOpen(true);
                }}
                className="bg-orange-500 hover:bg-orange-600"
              >
                Add Task
              </Button>
            </div>
            <div className="min-w-0 md:min-w-[700px]">
              <CalendarView tasks={taskViewsData} onEdit={handleEdit} />
            </div>
          </TabsContent>

          <TabsContent value="agenda" className="focus:outline-none">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gradient">Agenda</h2>
              <Button
                onClick={() => {
                  setEditingTask(null);
                  setIsFormOpen(true);
                }}
                className="bg-orange-500 hover:bg-orange-600"
              >
                Add Task
              </Button>
            </div>
            <AgendaView tasks={taskViewsData} onEdit={handleEdit} onDelete={deleteTask} onOpenTask={handleOpenTask} />
          </TabsContent>

          <TabsContent value="stats" className="focus:outline-none">
            <ProjectStatistics tasks={tasks} />
          </TabsContent>

          <TabsContent value="profitability" className="focus:outline-none">
            {/* KPI Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <Card className="bg-white/5 border-white/10">
                <CardContent className="pt-4">
                  <p className="text-xs text-gray-400 mb-1">{t('projects.profitability.totalHours')}</p>
                  <p className="text-2xl font-bold text-white">{profitability.totalHours}h</p>
                  <p className="text-xs text-gray-500 mt-1">
                    {profitability.billableHours}h {t('projects.profitability.billable')}
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/10">
                <CardContent className="pt-4">
                  <p className="text-xs text-gray-400 mb-1">{t('projects.profitability.laborCost')}</p>
                  <p className="text-2xl font-bold text-white">{profitability.laborCost.toLocaleString('fr-FR')} €</p>
                  <p className="text-xs text-gray-500 mt-1">
                    + {profitability.totalExpenses.toLocaleString('fr-FR')} € charges
                  </p>
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/10">
                <CardContent className="pt-4">
                  <p className="text-xs text-gray-400 mb-1">{t('projects.profitability.revenue')}</p>
                  <p className="text-2xl font-bold text-green-400">
                    {profitability.totalRevenue.toLocaleString('fr-FR')} €
                  </p>
                  {profitability.pendingRevenue > 0 && (
                    <p className="text-xs text-yellow-500 mt-1">
                      + {profitability.pendingRevenue.toLocaleString('fr-FR')} € en attente
                    </p>
                  )}
                </CardContent>
              </Card>
              <Card className="bg-white/5 border-white/10">
                <CardContent className="pt-4">
                  <p className="text-xs text-gray-400 mb-1">{t('projects.profitability.grossMargin')}</p>
                  <p
                    className={`text-2xl font-bold ${profitability.grossMargin >= 0 ? 'text-green-400' : 'text-red-400'}`}
                  >
                    {profitability.grossMarginPct}%
                  </p>
                  <p className="text-xs text-gray-500 mt-1">{profitability.grossMargin.toLocaleString('fr-FR')} €</p>
                </CardContent>
              </Card>
            </div>

            <Card className="bg-white/5 border-white/10 mb-4" data-testid="project-budget-vs-actual-panel">
              <CardHeader>
                <CardTitle className="text-white text-sm">Rentabilité budget vs réel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {projectBudgetInsights.summary.hasBudget ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                        <p className="text-xs uppercase tracking-wider text-gray-500">Budget CA</p>
                        <p className="mt-1 text-lg font-semibold text-white">
                          {projectBudgetInsights.summary.budgetRevenue.toLocaleString('fr-FR')} €
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                        <p className="text-xs uppercase tracking-wider text-gray-500">Réel CA</p>
                        <p className="mt-1 text-lg font-semibold text-emerald-300">
                          {projectBudgetInsights.summary.actualRevenue.toLocaleString('fr-FR')} €
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                        <p className="text-xs uppercase tracking-wider text-gray-500">Écart CA</p>
                        <p
                          className={`mt-1 text-lg font-semibold ${
                            projectBudgetInsights.summary.revenueVariance >= 0 ? 'text-emerald-300' : 'text-rose-300'
                          }`}
                        >
                          {projectBudgetInsights.summary.revenueVariance.toLocaleString('fr-FR')} €
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/20 p-3">
                        <p className="text-xs uppercase tracking-wider text-gray-500">Écart marge</p>
                        <p
                          className={`mt-1 text-lg font-semibold ${
                            projectBudgetInsights.summary.marginVariance >= 0 ? 'text-emerald-300' : 'text-rose-300'
                          }`}
                        >
                          {projectBudgetInsights.summary.marginVariance.toLocaleString('fr-FR')} €
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-gray-400">
                      <div className="rounded-lg border border-white/10 bg-black/10 p-3">
                        <p className="uppercase tracking-wider text-gray-500">Taux d'atteinte budget</p>
                        <p className="mt-1 text-base text-white font-semibold">
                          {projectBudgetInsights.summary.revenueAttainmentPct}%
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/10 p-3">
                        <p className="uppercase tracking-wider text-gray-500">Marge budget</p>
                        <p className="mt-1 text-base text-white font-semibold">
                          {projectBudgetInsights.summary.budgetMarginPct}%
                        </p>
                      </div>
                      <div className="rounded-lg border border-white/10 bg-black/10 p-3">
                        <p className="uppercase tracking-wider text-gray-500">Marge réelle</p>
                        <p className="mt-1 text-base text-white font-semibold">
                          {projectBudgetInsights.summary.actualMarginPct}%
                        </p>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">
                    Budget incomplet: renseignez `Budget (hours)` et `Hourly Rate` pour suivre le budget vs réel.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Chart: Revenue vs Cost */}
            <Card className="bg-white/5 border-white/10 mb-4">
              <CardHeader>
                <CardTitle className="text-white text-sm">{t('projects.profitability.revenueVsCost')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart
                    data={[
                      { name: t('projects.profitability.laborCost'), value: profitability.laborCost },
                      { name: t('projects.profitability.expenses'), value: profitability.totalExpenses },
                      { name: t('projects.profitability.revenue'), value: profitability.totalRevenue },
                      { name: t('projects.profitability.margin'), value: Math.max(0, profitability.grossMargin) },
                    ]}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                    <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0f1528',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                      }}
                      labelStyle={{ color: '#fff' }}
                      formatter={(v) => [`${v.toLocaleString('fr-FR')} €`]}
                    />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      <Cell fill="#6366f1" />
                      <Cell fill="#8b5cf6" />
                      <Cell fill="#22c55e" />
                      <Cell fill={profitability.grossMargin >= 0 ? '#10b981' : '#ef4444'} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Utilization rate */}
            <Card className="bg-white/5 border-white/10">
              <CardContent className="pt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">{t('projects.profitability.utilizationRate')}</span>
                  <span className="text-white font-semibold">{profitability.utilizationRate}%</span>
                </div>
                <div className="w-full bg-white/10 rounded-full h-2">
                  <div
                    className="bg-indigo-500 h-2 rounded-full transition-all"
                    style={{ width: `${Math.min(100, profitability.utilizationRate)}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="control" className="focus:outline-none">
            <ProjectControlCenter project={project} tasks={tasks} />
          </TabsContent>

          <TabsContent value="gantt" className="focus:outline-none">
            <div className="space-y-4">
              <Card className="bg-gray-900 border-gray-800" data-testid="project-gantt-insights">
                <CardHeader className="pb-3">
                  <CardTitle className="text-white">Pilotage Gantt & dépendances</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                      <p className="text-xs uppercase tracking-wider text-gray-500">Tâches totales</p>
                      <p className="text-xl font-semibold text-white mt-1">
                        {ganttDependencyInsights.summary.totalTasks}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                      <p className="text-xs uppercase tracking-wider text-gray-500">Planifiées sur Gantt</p>
                      <p className="text-xl font-semibold text-blue-300 mt-1">
                        {ganttDependencyInsights.summary.tasksWithSchedule}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                      <p className="text-xs uppercase tracking-wider text-gray-500">Liens de dépendance</p>
                      <p className="text-xl font-semibold text-indigo-300 mt-1">
                        {ganttDependencyInsights.summary.dependencyLinks}
                      </p>
                    </div>
                    <div className="rounded-lg border border-gray-800 bg-gray-950/40 p-3">
                      <p className="text-xs uppercase tracking-wider text-gray-500">Tâches bloquées</p>
                      <p className="text-xl font-semibold text-rose-300 mt-1">
                        {ganttDependencyInsights.summary.blockedTasks}
                      </p>
                    </div>
                  </div>

                  {ganttDependencyInsights.rows.length === 0 ? (
                    <p className="text-sm text-gray-500">Aucune tâche disponible pour analyser les dépendances.</p>
                  ) : (
                    <div className="space-y-2">
                      {ganttDependencyInsights.rows.slice(0, 4).map((row) => (
                        <div
                          key={row.taskId}
                          className="flex items-center justify-between rounded-lg border border-gray-800 bg-gray-950/30 px-3 py-2"
                        >
                          <div>
                            <p className="text-sm text-white font-medium">{row.title}</p>
                            <p className="text-xs text-gray-500">
                              Dépendances: {row.dependencyCount} • Statut: {row.status}
                            </p>
                          </div>
                          <span
                            className={`text-xs px-2 py-1 rounded-full border ${
                              row.isBlocked
                                ? 'bg-red-500/15 text-red-300 border-red-500/30'
                                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            }`}
                          >
                            {row.isBlocked ? 'Bloquée' : 'Fluide'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* View mode selector */}
              <div className="flex items-center gap-2 flex-wrap">
                {['Day', 'Week', 'Month'].map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setGanttViewMode(mode)}
                    className={`px-3 py-1 rounded text-sm transition-colors ${
                      ganttViewMode === mode
                        ? 'bg-indigo-600 text-white'
                        : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                    }`}
                  >
                    {mode === 'Day'
                      ? t('projects.gantt.day')
                      : mode === 'Week'
                        ? t('projects.gantt.week')
                        : t('projects.gantt.month')}
                  </button>
                ))}
                <Button
                  type="button"
                  variant={dependencyMode ? 'default' : 'outline'}
                  onClick={() => setDependencyMode((previous) => !previous)}
                  className={
                    dependencyMode
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white'
                      : 'border-gray-700 text-gray-300 hover:bg-gray-800'
                  }
                >
                  {dependencyMode ? 'Mode dépendance actif' : 'Créer dépendance'}
                </Button>
              </div>
              {dependencyMode && (
                <p className="text-xs text-indigo-300">
                  {dependencySourceTaskId
                    ? 'Cliquez sur la tâche cible du Gantt pour finaliser la dépendance.'
                    : 'Cliquez sur la tâche source puis la tâche cible dans le Gantt.'}
                </p>
              )}

              {/* Gantt chart */}
              <GanttView
                tasks={(taskViewsData || []).flatMap((task) => {
                  const baseTaskStart = task.start_date || task.started_at?.split?.('T')?.[0] || task.started_at;
                  const baseTaskEnd =
                    task.end_date ||
                    task.completed_at?.split?.('T')?.[0] ||
                    task.completed_at ||
                    task.due_date?.split?.('T')?.[0] ||
                    task.due_date;
                  const taskRows =
                    baseTaskStart && baseTaskEnd
                      ? [
                          {
                            id: task.id,
                            name: task.title || task.name || 'Sans titre',
                            start: baseTaskStart,
                            end: baseTaskEnd,
                            progress: task.status === 'completed' ? 100 : task.status === 'in_progress' ? 50 : 0,
                            dependencies: (task.depends_on || []).join(','),
                            dependencies_count: task.dependencies_count || 0,
                            subtasks_count: task.subtasks_count || 0,
                            dependency_titles: task.dependency_titles || [],
                            dependency_tasks: task.dependency_tasks || [],
                            task_type: 'task',
                          },
                        ]
                      : [];

                  const subtaskRows = (task.subtasks_items || [])
                    .filter(
                      (subtask) =>
                        (subtask.started_at || subtask.created_at) &&
                        (subtask.completed_at || subtask.due_date || subtask.updated_at || subtask.created_at)
                    )
                    .map((subtask) => ({
                      id: `subtask-${subtask.id}`,
                      name: `↳ ${subtask.title || 'Sous-tâche'}`,
                      start:
                        subtask.started_at?.split?.('T')?.[0] ||
                        subtask.created_at?.split?.('T')?.[0] ||
                        subtask.created_at,
                      end:
                        subtask.completed_at?.split?.('T')?.[0] ||
                        subtask.completed_at ||
                        subtask.due_date?.split?.('T')?.[0] ||
                        subtask.due_date ||
                        subtask.updated_at?.split?.('T')?.[0] ||
                        subtask.updated_at ||
                        subtask.created_at?.split?.('T')?.[0] ||
                        subtask.created_at,
                      progress: subtask.status === 'completed' ? 100 : subtask.status === 'in_progress' ? 50 : 0,
                      dependencies: task.id,
                      dependencies_count: 1,
                      subtasks_count: 0,
                      dependency_titles: [task.title || task.name || task.id],
                      dependency_tasks: [{ id: task.id, title: task.title || task.name || task.id }],
                      task_type: 'subtask',
                      parent_task_id: task.id,
                      subtask_id: subtask.id,
                    }));

                  return [...taskRows, ...subtaskRows];
                })}
                viewMode={ganttViewMode}
                onTaskClick={(task) => {
                  const resolvedTaskId = task?.task_type === 'subtask' ? task?.parent_task_id : task?.id;
                  handleTaskSelectionForDependency(resolvedTaskId);
                }}
                onDateChange={async (task, start, end) => {
                  try {
                    const normalizedStart = start.toISOString().split('T')[0];
                    const normalizedEnd = end.toISOString().split('T')[0];

                    if (String(task?.id || '').startsWith('subtask-') || task?.task_type === 'subtask') {
                      const subtaskId = task?.subtask_id || String(task.id).replace('subtask-', '');
                      await supabase
                        .from('subtasks')
                        .update({
                          started_at: normalizedStart,
                          due_date: normalizedEnd,
                          completed_at: normalizedEnd,
                          updated_at: new Date().toISOString(),
                        })
                        .eq('id', subtaskId);
                    } else {
                      await supabase
                        .from('tasks')
                        .update({
                          start_date: normalizedStart,
                          end_date: normalizedEnd,
                          updated_at: new Date().toISOString(),
                        })
                        .eq('id', task.id);
                    }
                    refreshTasks();
                  } catch (err) {
                    console.error('Failed to update task dates:', err);
                  }
                }}
              />
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Global Edit/Create Modal for views that aren't TaskManager */}
      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white w-full sm:max-w-[90%] md:max-w-[600px] overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'Edit Task' : 'Create New Task'}</DialogTitle>
          </DialogHeader>
          <TaskForm
            task={editingTask}
            onSave={handleSave}
            onCancel={() => setIsFormOpen(false)}
            quotes={projectQuotes}
            projectContext={project}
            availableTasks={tasks}
          />
        </DialogContent>
      </Dialog>

      <ProjectBillingDialog
        open={billingOpen}
        onOpenChange={setBillingOpen}
        projectId={projectId}
        project={project}
        onSuccess={() => {
          setBillingOpen(false);
        }}
      />
    </>
  );
};

export default ProjectDetail;
