
import React from 'react';
import TaskCard from './TaskCard';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const TaskList = ({ tasks, loading, onEdit, onDelete, onStatusChange }) => {
  if (loading && tasks.length === 0) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <div key={i} className="h-48 bg-gray-900/50 rounded-xl border border-gray-800 animate-pulse" />
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-20 bg-gray-900/30 rounded-xl border border-gray-800 border-dashed">
        <p className="text-gray-400 text-lg">No tasks found matching your filters.</p>
        <p className="text-gray-500 text-sm">Try clearing filters or create a new task.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      <AnimatePresence>
        {tasks.map(task => (
          <TaskCard 
            key={task.id} 
            task={task} 
            onEdit={onEdit} 
            onDelete={onDelete} 
            onStatusChange={onStatusChange}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

export default TaskList;
