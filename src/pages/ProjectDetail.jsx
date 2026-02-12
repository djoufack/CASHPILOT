
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useProjects } from '@/hooks/useProjects';
import { useTasksForProject } from '@/hooks/useTasksForProject';
import { useProjectStatus } from '@/hooks/useProjectStatus';
import TaskManager from '@/components/TaskManager';
import ProjectStatistics from '@/components/ProjectStatistics';
import KanbanBoard from '@/components/KanbanBoard';
import CalendarView from '@/components/CalendarView';
import AgendaView from '@/components/AgendaView';
import TaskForm from '@/components/TaskForm';
import ProjectBillingDialog from '@/components/ProjectBillingDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Briefcase, Calendar as CalendarIcon, Clock, DollarSign, LayoutList, PieChart, Users, Kanban, List, CalendarDays, Receipt } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';

const ProjectDetail = () => {
  const { projectId } = useParams();
  const { t } = useTranslation();
  const { projects } = useProjects();
  const [project, setProject] = useState(null);
  const { tasks, loading, createTask, updateTask, deleteTask, refreshTasks } = useTasksForProject(projectId);
  const { status: calculatedStatus, stats } = useProjectStatus(projectId);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [activeTab, setActiveTab] = useState("kanban");
  const [billingOpen, setBillingOpen] = useState(false);

  useEffect(() => {
    if (projects.length > 0) {
      const found = projects.find(p => p.id === projectId);
      setProject(found);
    }
  }, [projectId, projects]);

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
            <Link to="/projects">
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
              </TabsList>
            </div>

            <TabsContent value="list" className="focus:outline-none">
              <TaskManager projectId={projectId} />
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
          </Tabs>
        </div>

        {/* Global Edit/Create Modal for views that aren't TaskManager */}
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogContent className="bg-gray-900 border-gray-800 text-white w-full sm:max-w-[90%] md:max-w-[600px] overflow-y-auto max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>{editingTask ? 'Edit Task' : 'Create New Task'}</DialogTitle>
            </DialogHeader>
            <TaskForm task={editingTask} onSave={handleSave} onCancel={() => setIsFormOpen(false)} />
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
