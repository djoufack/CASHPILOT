
import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { useProjects } from '@/hooks/useProjects';
import { useClients } from '@/hooks/useClients';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Search, Briefcase, ArrowRight, Loader2, Calendar, List, CalendarDays, CalendarClock } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import GenericCalendarView from '@/components/GenericCalendarView';
import GenericAgendaView from '@/components/GenericAgendaView';
import { Progress } from '@/components/ui/progress';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ProjectCard = ({ project }) => {
  const progress = project.progress || 0;

  return (
    <Link to={`/projects/${project.id}`}>
      <motion.div
        whileHover={{ y: -5, boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}
        className="bg-gray-900 border border-gray-800 rounded-xl p-4 md:p-6 h-full flex flex-col justify-between group transition-all"
      >
        <div>
          <div className="flex justify-between items-start mb-4">
             <div className="p-3 bg-orange-500/10 rounded-lg border border-orange-500/20">
               <Briefcase className="w-6 h-6 text-orange-400" />
             </div>
             <span className={`text-[10px] md:text-xs px-2 py-1 rounded-full border capitalize ${
               project.status === 'completed' ? 'bg-green-900/20 text-green-400 border-green-800' :
               project.status === 'active' || project.status === 'in_progress' ? 'bg-orange-500/10 text-orange-400 border-orange-800' :
               'bg-gray-800 text-gray-400 border-gray-700'
             }`}>
               {project.status || 'Active'}
             </span>
          </div>

          <h3 className="text-lg md:text-xl font-bold text-gradient mb-2 group-hover:text-orange-400 transition-colors">{project.name}</h3>
          <p className="text-xs md:text-sm text-gray-400 mb-4 line-clamp-2">{project.description || 'No description provided.'}</p>

          <div className="flex flex-col gap-2 text-xs md:text-sm text-gray-500 mb-6">
            <span className="flex items-center"><Briefcase className="w-4 h-4 mr-2" /> {project.client?.company_name}</span>
            <span className="flex items-center"><Calendar className="w-4 h-4 mr-2" /> {format(parseISO(project.created_at), 'MMM d, yyyy')}</span>
          </div>
        </div>

        <div className="mb-4">
           <div className="flex justify-between text-xs text-gray-400 mb-1">
             <span>Progress</span>
             <span>{progress}%</span>
           </div>
           <Progress value={progress} className="h-2" />
        </div>

        <div className="flex items-center justify-between border-t border-gray-800 pt-4 mt-auto">
          <span className="text-sm font-medium text-gray-400">View Details</span>
          <ArrowRight className="w-4 h-4 text-orange-400 transform group-hover:translate-x-1 transition-transform" />
        </div>
      </motion.div>
    </Link>
  );
};

const initialFormData = {
  name: '',
  description: '',
  client_id: '',
  budget_hours: '',
  hourly_rate: '',
  status: 'active',
};

const ProjectsPage = () => {
  const { t } = useTranslation();
  const { projects, loading, createProject } = useProjects();
  const { clients } = useClients();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState(initialFormData);
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState('list');

  const projectCalendarStatusColors = {
    active: { bg: '#f97316', border: '#ea580c', text: '#fff' },
    in_progress: { bg: '#f97316', border: '#ea580c', text: '#fff' },
    completed: { bg: '#22c55e', border: '#16a34a', text: '#fff' },
    on_hold: { bg: '#eab308', border: '#ca8a04', text: '#000' },
    cancelled: { bg: '#ef4444', border: '#dc2626', text: '#fff' },
  };

  const projectCalendarLegend = [
    { label: 'Active', color: '#f97316' },
    { label: 'Completed', color: '#22c55e' },
    { label: 'On Hold', color: '#eab308' },
    { label: 'Cancelled', color: '#ef4444' },
  ];

  const projectCalendarEvents = projects.map(p => ({
    id: p.id,
    title: p.name,
    date: p.created_at,
    status: p.status || 'active',
    resource: p,
  }));

  const projectAgendaItems = projects.map(p => {
    const statusColorMap = {
      active: 'bg-orange-500/20 text-orange-400',
      in_progress: 'bg-orange-500/20 text-orange-400',
      completed: 'bg-green-500/20 text-green-400',
      on_hold: 'bg-yellow-500/20 text-yellow-400',
      cancelled: 'bg-red-500/20 text-red-400',
    };
    return {
      id: p.id,
      title: p.name,
      subtitle: p.client?.company_name || '',
      date: p.created_at,
      status: p.status || 'active',
      statusLabel: (p.status || 'active').replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      statusColor: statusColorMap[p.status] || 'bg-gray-500/20 text-gray-400',
    };
  });

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
                          p.client?.company_name?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' ||
                          (filter === 'active' && p.status !== 'completed' && p.status !== 'cancelled') ||
                          p.status === filter;
    return matchesSearch && matchesFilter;
  });

  const handleOpenDialog = () => {
    setFormData(initialFormData);
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    setSubmitting(true);
    try {
      await createProject({
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        client_id: formData.client_id || null,
        budget_hours: formData.budget_hours ? parseInt(formData.budget_hours, 10) : null,
        hourly_rate: formData.hourly_rate ? parseFloat(formData.hourly_rate) : null,
        status: formData.status,
      });
      setIsDialogOpen(false);
      setFormData(initialFormData);
    } catch {
      // Error handled by hook toast
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>Projects - CashPilot</title>
      </Helmet>

        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <h1 className="text-3xl md:text-4xl font-bold text-gradient mb-2">Projects</h1>
              <p className="text-gray-400 text-sm md:text-base">Manage and track your ongoing work.</p>
            </motion.div>

             <Button onClick={handleOpenDialog} className="w-full md:w-auto bg-orange-500 hover:bg-orange-600 text-white">
               <Plus className="w-4 h-4 mr-2" /> New Project
             </Button>
          </div>

          <div className="flex flex-col md:flex-row gap-4 mb-8">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
              <Input
                placeholder="Search projects..."
                className="pl-9 bg-gray-900 border-gray-800 text-white w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
              {['all', 'active', 'completed'].map(f => (
                <Button
                  key={f}
                  variant={filter === f ? 'default' : 'outline'}
                  onClick={() => setFilter(f)}
                  className={`capitalize flex-shrink-0 ${filter === f ? 'bg-orange-500' : 'border-gray-800 text-gray-400'}`}
                >
                  {f}
                </Button>
              ))}
            </div>
          </div>

          <Tabs value={viewMode} onValueChange={setViewMode} className="w-full">
            <TabsList className="bg-gray-800 border border-gray-700 mb-4">
              <TabsTrigger value="list" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400">
                <List className="w-4 h-4 mr-2" /> {t('common.list') || 'List'}
              </TabsTrigger>
              <TabsTrigger value="calendar" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400">
                <CalendarDays className="w-4 h-4 mr-2" /> {t('common.calendar') || 'Calendar'}
              </TabsTrigger>
              <TabsTrigger value="agenda" className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400">
                <CalendarClock className="w-4 h-4 mr-2" /> {t('common.agenda') || 'Agenda'}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="list">
              {loading ? (
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                   {[1, 2, 3].map(i => <div key={i} className="h-64 bg-gray-900 rounded-xl animate-pulse" />)}
                 </div>
              ) : filteredProjects.length === 0 ? (
                <div className="text-center py-20 bg-gray-900/30 rounded-xl border border-gray-800 border-dashed">
                  <p className="text-gray-400 text-lg">No projects found.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {filteredProjects.map(project => (
                    <ProjectCard key={project.id} project={project} />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="calendar">
              <GenericCalendarView
                events={projectCalendarEvents}
                statusColors={projectCalendarStatusColors}
                legend={projectCalendarLegend}
              />
            </TabsContent>

            <TabsContent value="agenda">
              <GenericAgendaView
                items={projectAgendaItems}
                dateField="date"
                paidStatuses={['completed', 'cancelled']}
              />
            </TabsContent>
          </Tabs>
        </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-gradient text-xl">New Project</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-gray-300">Project Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter project name"
                className="bg-gray-800 border-gray-700 text-white"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description" className="text-gray-300">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Project description..."
                className="bg-gray-800 border-gray-700 text-white min-h-[80px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="client" className="text-gray-300">Client</Label>
              <Select
                value={formData.client_id}
                onValueChange={(value) => setFormData({ ...formData, client_id: value })}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {clients.map(client => (
                    <SelectItem key={client.id} value={client.id} className="text-white hover:bg-gray-700">
                      {client.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="budget_hours" className="text-gray-300">Budget (hours)</Label>
                <Input
                  id="budget_hours"
                  type="number"
                  min="0"
                  value={formData.budget_hours}
                  onChange={(e) => setFormData({ ...formData, budget_hours: e.target.value })}
                  placeholder="0"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="hourly_rate" className="text-gray-300">Hourly Rate (€)</Label>
                <Input
                  id="hourly_rate"
                  type="number"
                  min="0"
                  step="0.01"
                  value={formData.hourly_rate}
                  onChange={(e) => setFormData({ ...formData, hourly_rate: e.target.value })}
                  placeholder="0.00"
                  className="bg-gray-800 border-gray-700 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status" className="text-gray-300">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  <SelectItem value="active" className="text-white hover:bg-gray-700">Active</SelectItem>
                  <SelectItem value="in_progress" className="text-white hover:bg-gray-700">In Progress</SelectItem>
                  <SelectItem value="completed" className="text-white hover:bg-gray-700">Completed</SelectItem>
                  <SelectItem value="cancelled" className="text-white hover:bg-gray-700">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} className="border-gray-700 text-gray-300 hover:bg-gray-800">
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || !formData.name.trim()} className="bg-orange-500 hover:bg-orange-600 text-white">
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                Create Project
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ProjectsPage;
