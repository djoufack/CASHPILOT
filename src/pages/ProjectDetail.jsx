
import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useProjects } from '@/hooks/useProjects';
import { useTasksForProject } from '@/hooks/useTasksForProject';
import { useProjectStatus } from '@/hooks/useProjectStatus';
import TaskManager from '@/components/TaskManager';
import ProjectStatistics from '@/components/ProjectStatistics';
import KanbanBoard from '@/components/KanbanBoard';
import CalendarView from '@/components/CalendarView';
import AgendaView from '@/components/AgendaView';
import TaskForm from '@/components/TaskForm';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ArrowLeft, Briefcase, Calendar as CalendarIcon, Clock, DollarSign, LayoutList, PieChart, Users, Kanban, List, CalendarDays } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { motion } from 'framer-motion';
import { Helmet } from 'react-helmet';

const ProjectDetail = () => {
  const { projectId } = useParams();
  const { projects } = useProjects();
  const [project, setProject] = useState(null);
  const { tasks, loading, createTask, updateTask, deleteTask, refreshTasks } = useTasksForProject(projectId);
  const { status: calculatedStatus, stats } = useProjectStatus(projectId);
  
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [activeTab, setActiveTab] = useState("kanban");

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
                  className="text-3xl md:text-4xl font-bold text-white mb-2"
                >
                  {project.name}
                </motion.h1>
                <div className="flex flex-wrap gap-4 text-gray-400 text-sm">
                  <span className="flex items-center"><Briefcase className="w-4 h-4 mr-1 text-blue-400" /> {project.client?.company_name}</span>
                  <span className="flex items-center"><CalendarIcon className="w-4 h-4 mr-1 text-green-400" /> Created {format(parseISO(project.created_at), 'MMM d, yyyy')}</span>
                  
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
              
              <div className="bg-gray-900 p-4 rounded-lg border border-gray-800 flex flex-wrap gap-6 text-sm w-full lg:w-auto">
                <div>
                   <p className="text-gray-500 mb-1">Budget</p>
                   <p className="text-white font-mono flex items-center gap-1"><Clock className="w-3 h-3" /> {project.budget_hours || 0}h</p>
                </div>
                <div>
                   <p className="text-gray-500 mb-1">Progress</p>
                   <p className="text-white font-mono flex items-center gap-1"><PieChart className="w-3 h-3" /> {stats.progress}%</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <div className="overflow-x-auto pb-2">
              <TabsList className="bg-gray-900 border border-gray-800 p-1 min-w-[500px] md:min-w-0 md:w-full justify-start md:justify-start">
                <TabsTrigger value="list" className="data-[state=active]:bg-gray-800 text-gray-400 data-[state=active]:text-white flex-1"><LayoutList className="w-4 h-4 mr-2" /> List</TabsTrigger>
                <TabsTrigger value="kanban" className="data-[state=active]:bg-gray-800 text-gray-400 data-[state=active]:text-white flex-1"><Kanban className="w-4 h-4 mr-2" /> Kanban</TabsTrigger>
                <TabsTrigger value="calendar" className="data-[state=active]:bg-gray-800 text-gray-400 data-[state=active]:text-white flex-1"><CalendarDays className="w-4 h-4 mr-2" /> Calendar</TabsTrigger>
                <TabsTrigger value="agenda" className="data-[state=active]:bg-gray-800 text-gray-400 data-[state=active]:text-white flex-1"><List className="w-4 h-4 mr-2" /> Agenda</TabsTrigger>
                <TabsTrigger value="stats" className="data-[state=active]:bg-gray-800 text-gray-400 data-[state=active]:text-white flex-1"><PieChart className="w-4 h-4 mr-2" /> Stats</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="list" className="focus:outline-none">
              <TaskManager projectId={projectId} />
            </TabsContent>

            <TabsContent value="kanban" className="focus:outline-none overflow-x-auto">
              <div className="flex justify-between items-center mb-4">
                 <h2 className="text-xl font-bold text-white">Board</h2>
                 <Button onClick={() => { setEditingTask(null); setIsFormOpen(true); }} className="bg-blue-600 hover:bg-blue-700">Add Task</Button>
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
                 <h2 className="text-xl font-bold text-white">Calendar</h2>
                 <Button onClick={() => { setEditingTask(null); setIsFormOpen(true); }} className="bg-blue-600 hover:bg-blue-700">Add Task</Button>
              </div>
              <div className="min-w-[700px]">
                <CalendarView tasks={tasks} onEdit={handleEdit} />
              </div>
            </TabsContent>

            <TabsContent value="agenda" className="focus:outline-none">
              <div className="flex justify-between items-center mb-4">
                 <h2 className="text-xl font-bold text-white">Agenda</h2>
                 <Button onClick={() => { setEditingTask(null); setIsFormOpen(true); }} className="bg-blue-600 hover:bg-blue-700">Add Task</Button>
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
    </>
  );
};

export default ProjectDetail;
