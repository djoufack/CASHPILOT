
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProjects } from '@/hooks/useProjects';
import { useTasksForProject } from '@/hooks/useTasksForProject';
import { useProjectStatus } from '@/hooks/useProjectStatus';
import { useProjectProfitability } from '@/hooks/useProjectProfitability';
import GanttView from '@/components/GanttView';
import TaskManager from '@/components/TaskManager';
import ProjectStatistics from '@/components/ProjectStatistics';
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
import { ArrowLeft, BarChart2, Briefcase, Calendar as CalendarIcon, Clock, DollarSign, LayoutList, PieChart, Users, Kanban, List, CalendarDays, Receipt, TrendingUp } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';

const ProjectDetail = () => {
  const { projectId } = useParams();
  const { t } = useTranslation();
  const { projects } = useProjects();
  const [project, setProject] = useState(null);
  const { tasks, loading, createTask, updateTask, deleteTask, refreshTasks } = useTasksForProject(projectId);
  const { status: calculatedStatus, stats } = useProjectStatus(projectId);
  const { quotes: projectQuotes } = useClientQuotes(project?.client_id);

  const { profitability, loading: profLoading, fetchData: fetchProfitability } = useProjectProfitability(project?.id);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [activeTab, setActiveTab] = useState("kanban");
  const [billingOpen, setBillingOpen] = useState(false);
  const [ganttViewMode, setGanttViewMode] = useState('Week');

  useEffect(() => {
    if (projects.length > 0) {
      const found = projects.find(p => p.id === projectId);
      setProject(found);
    }
  }, [projectId, projects]);

  useEffect(() => {
    if (activeTab === 'profitability') {
      fetchProfitability();
    }
  }, [activeTab, fetchProfitability]);

  const handleEdit = (task) => {
    setEditingTask(task);
    setIsFormOpen(true);
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

  if (!project) return <div className="flex items-center justify-center h-full min-h-[500px] text-white">Loading Project...</div>;

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
                  <span className="flex items-center"><Briefcase className="w-4 h-4 mr-1 text-orange-400" /> {project.client?.company_name}</span>
                  <span className="flex items-center"><CalendarIcon className="w-4 h-4 mr-1 text-orange-400" /> Created {format(parseISO(project.created_at), 'MMM d, yyyy')}</span>
                  
                  {/* Status Badge */}
                  <span className={`px-3 py-0.5 rounded-full text-xs font-medium capitalize border ${
                    calculatedStatus === 'completed' ? 'bg-green-900/40 text-green-400 border-green-700' :
                    calculatedStatus === 'in_progress' ? 'bg-blue-900/40 text-blue-400 border-blue-700' :
                    calculatedStatus === 'on_hold' ? 'bg-orange-900/40 text-orange-400 border-orange-700' :
                    calculatedStatus === 'cancelled' ? 'bg-red-900/40 text-red-400 border-red-700' :
                    'bg-gray-800 text-gray-400 border-gray-700'
                  }`}>
                    {calculatedStatus.replace('_', ' ')}
                  </span>
                </div>
              </div>
              
              <div className="flex flex-col gap-3 w-full lg:w-auto">
                <div className="bg-gray-900 p-4 rounded-lg border border-gray-800 flex flex-wrap gap-6 text-sm w-full">
                  <div>
                     <p className="text-gray-500 mb-1">Budget</p>
                     <p className="text-gradient font-mono flex items-center gap-1"><Clock className="w-3 h-3" /> {project.budget_hours || 0}h</p>
                  </div>
                  <div>
                     <p className="text-gray-500 mb-1">Progress</p>
                     <p className="text-gradient font-mono flex items-center gap-1"><PieChart className="w-3 h-3" /> {stats.progress}%</p>
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
                <TabsTrigger value="list" className="data-[state=active]:bg-orange-500/10 text-gray-400 data-[state=active]:text-orange-400 flex-1"><LayoutList className="w-4 h-4 md:mr-2" /><span className="hidden md:inline">List</span></TabsTrigger>
                <TabsTrigger value="kanban" className="data-[state=active]:bg-orange-500/10 text-gray-400 data-[state=active]:text-orange-400 flex-1"><Kanban className="w-4 h-4 md:mr-2" /><span className="hidden md:inline">Kanban</span></TabsTrigger>
                <TabsTrigger value="calendar" className="data-[state=active]:bg-orange-500/10 text-gray-400 data-[state=active]:text-orange-400 flex-1"><CalendarDays className="w-4 h-4 md:mr-2" /><span className="hidden md:inline">Calendar</span></TabsTrigger>
                <TabsTrigger value="agenda" className="data-[state=active]:bg-orange-500/10 text-gray-400 data-[state=active]:text-orange-400 flex-1"><List className="w-4 h-4 md:mr-2" /><span className="hidden md:inline">Agenda</span></TabsTrigger>
                <TabsTrigger value="stats" className="data-[state=active]:bg-orange-500/10 text-gray-400 data-[state=active]:text-orange-400 flex-1"><PieChart className="w-4 h-4 md:mr-2" /><span className="hidden md:inline">Stats</span></TabsTrigger>
                <TabsTrigger value="profitability" className="data-[state=active]:bg-orange-500/10 text-gray-400 data-[state=active]:text-orange-400 flex-1"><TrendingUp className="w-4 h-4 md:mr-2" /><span className="hidden md:inline">{t('projects.profitability.title')}</span></TabsTrigger>
                <TabsTrigger value="gantt" className="data-[state=active]:bg-orange-500/10 text-gray-400 data-[state=active]:text-orange-400 flex-1"><BarChart2 className="w-4 h-4 md:mr-2" /><span className="hidden md:inline">{t('projects.gantt.title')}</span></TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="list" className="focus:outline-none">
              <TaskManager projectId={projectId} quotes={projectQuotes} />
            </TabsContent>

            <TabsContent value="kanban" className="focus:outline-none overflow-x-auto">
              <div className="flex justify-between items-center mb-4">
                 <h2 className="text-xl font-bold text-gradient">Board</h2>
                 <Button onClick={() => { setEditingTask(null); setIsFormOpen(true); }} className="bg-orange-500 hover:bg-orange-600">Add Task</Button>
              </div>
              <KanbanBoard 
                tasks={tasks} 
                onEdit={handleEdit} 
                onDelete={deleteTask} 
                onStatusChange={refreshTasks}
              />
            </TabsContent>

            <TabsContent value="calendar" className="focus:outline-none overflow-x-auto">
               <div className="flex justify-between items-center mb-4">
                 <h2 className="text-xl font-bold text-gradient">Calendar</h2>
                 <Button onClick={() => { setEditingTask(null); setIsFormOpen(true); }} className="bg-orange-500 hover:bg-orange-600">Add Task</Button>
              </div>
              <div className="min-w-0 md:min-w-[700px]">
                <CalendarView tasks={tasks} onEdit={handleEdit} />
              </div>
            </TabsContent>

            <TabsContent value="agenda" className="focus:outline-none">
              <div className="flex justify-between items-center mb-4">
                 <h2 className="text-xl font-bold text-gradient">Agenda</h2>
                 <Button onClick={() => { setEditingTask(null); setIsFormOpen(true); }} className="bg-orange-500 hover:bg-orange-600">Add Task</Button>
              </div>
              <AgendaView tasks={tasks} onEdit={handleEdit} onDelete={deleteTask} />
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
                    <p className="text-xs text-gray-500 mt-1">{profitability.billableHours}h {t('projects.profitability.billable')}</p>
                  </CardContent>
                </Card>
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-400 mb-1">{t('projects.profitability.laborCost')}</p>
                    <p className="text-2xl font-bold text-white">{profitability.laborCost.toLocaleString('fr-FR')} €</p>
                    <p className="text-xs text-gray-500 mt-1">+ {profitability.totalExpenses.toLocaleString('fr-FR')} € charges</p>
                  </CardContent>
                </Card>
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-400 mb-1">{t('projects.profitability.revenue')}</p>
                    <p className="text-2xl font-bold text-green-400">{profitability.totalRevenue.toLocaleString('fr-FR')} €</p>
                    {profitability.pendingRevenue > 0 && (
                      <p className="text-xs text-yellow-500 mt-1">+ {profitability.pendingRevenue.toLocaleString('fr-FR')} € en attente</p>
                    )}
                  </CardContent>
                </Card>
                <Card className="bg-white/5 border-white/10">
                  <CardContent className="pt-4">
                    <p className="text-xs text-gray-400 mb-1">{t('projects.profitability.grossMargin')}</p>
                    <p className={`text-2xl font-bold ${profitability.grossMargin >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {profitability.grossMarginPct}%
                    </p>
                    <p className="text-xs text-gray-500 mt-1">{profitability.grossMargin.toLocaleString('fr-FR')} €</p>
                  </CardContent>
                </Card>
              </div>

              {/* Chart: Revenue vs Cost */}
              <Card className="bg-white/5 border-white/10 mb-4">
                <CardHeader>
                  <CardTitle className="text-white text-sm">{t('projects.profitability.revenueVsCost')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={[
                      { name: t('projects.profitability.laborCost'), value: profitability.laborCost },
                      { name: t('projects.profitability.expenses'), value: profitability.totalExpenses },
                      { name: t('projects.profitability.revenue'), value: profitability.totalRevenue },
                      { name: t('projects.profitability.margin'), value: Math.max(0, profitability.grossMargin) },
                    ]}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                      <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                      <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f1528', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
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

            <TabsContent value="gantt" className="focus:outline-none">
              <div className="space-y-4">
                {/* View mode selector */}
                <div className="flex items-center gap-2">
                  {['Day', 'Week', 'Month'].map(mode => (
                    <button
                      key={mode}
                      onClick={() => setGanttViewMode(mode)}
                      className={`px-3 py-1 rounded text-sm transition-colors ${
                        ganttViewMode === mode
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                      }`}
                    >
                      {mode === 'Day' ? t('projects.gantt.day') : mode === 'Week' ? t('projects.gantt.week') : t('projects.gantt.month')}
                    </button>
                  ))}
                </div>

                {/* Gantt chart */}
                <GanttView
                  tasks={(tasks || [])
                    .filter(task => (task.start_date || task.started_at) && (task.end_date || task.completed_at || task.due_date))
                    .map(task => ({
                      id: task.id,
                      name: task.title || task.name || 'Sans titre',
                      start: task.start_date || task.started_at?.split?.('T')?.[0] || task.started_at,
                      end: task.end_date || task.completed_at?.split?.('T')?.[0] || task.completed_at || task.due_date?.split?.('T')?.[0] || task.due_date,
                      progress: task.status === 'completed' ? 100 : task.status === 'in_progress' ? 50 : 0,
                      dependencies: (task.depends_on || []).join(','),
                    }))}
                  viewMode={ganttViewMode}
                  onDateChange={async (task, start, end) => {
                    try {
                      await supabase
                        .from('tasks')
                        .update({
                          start_date: start.toISOString().split('T')[0],
                          end_date: end.toISOString().split('T')[0],
                        })
                        .eq('id', task.id);
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
            <TaskForm task={editingTask} onSave={handleSave} onCancel={() => setIsFormOpen(false)} quotes={projectQuotes} />
          </DialogContent>
        </Dialog>

        <ProjectBillingDialog
          open={billingOpen}
          onOpenChange={setBillingOpen}
          projectId={projectId}
          project={project}
          onSuccess={() => { setBillingOpen(false); }}
        />
    </>
  );
};

export default ProjectDetail;
