
import React, { useState } from 'react';
import { Helmet } from 'react-helmet';
import { useProjects } from '@/hooks/useProjects';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Search, Briefcase, ArrowRight, Loader2, Calendar } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Progress } from '@/components/ui/progress';

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
             <div className="p-3 bg-blue-900/20 rounded-lg border border-blue-900/50">
               <Briefcase className="w-6 h-6 text-blue-400" />
             </div>
             <span className={`text-[10px] md:text-xs px-2 py-1 rounded-full border capitalize ${
               project.status === 'completed' ? 'bg-green-900/20 text-green-400 border-green-800' : 
               project.status === 'active' || project.status === 'in_progress' ? 'bg-blue-900/20 text-blue-400 border-blue-800' :
               'bg-gray-800 text-gray-400 border-gray-700'
             }`}>
               {project.status || 'Active'}
             </span>
          </div>
          
          <h3 className="text-lg md:text-xl font-bold text-white mb-2 group-hover:text-blue-400 transition-colors">{project.name}</h3>
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
          <ArrowRight className="w-4 h-4 text-blue-500 transform group-hover:translate-x-1 transition-transform" />
        </div>
      </motion.div>
    </Link>
  );
};

const ProjectsPage = () => {
  const { projects, loading } = useProjects();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');

  const filteredProjects = projects.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
                          p.client?.company_name?.toLowerCase().includes(search.toLowerCase());
    const matchesFilter = filter === 'all' || 
                          (filter === 'active' && p.status !== 'completed' && p.status !== 'cancelled') ||
                          p.status === filter;
    return matchesSearch && matchesFilter;
  });

  return (
    <>
      <Helmet>
        <title>Projects - CashPilot</title>
      </Helmet>
      
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
              <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">Projects</h1>
              <p className="text-gray-400 text-sm md:text-base">Manage and track your ongoing work.</p>
            </motion.div>
            
             <Button className="w-full md:w-auto bg-blue-600 hover:bg-blue-700 text-white">
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
                  className={`capitalize flex-shrink-0 ${filter === f ? 'bg-blue-600' : 'border-gray-800 text-gray-400'}`}
                >
                  {f}
                </Button>
              ))}
            </div>
          </div>

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
        </div>
    </>
  );
};

export default ProjectsPage;
