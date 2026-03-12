
import React, { useState } from 'react';
import { useTasksForProject } from '@/hooks/useTasksForProject';
import TaskList from './TaskList';
import TaskForm from './TaskForm';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle 
} from '@/components/ui/dialog';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Plus, Search, Filter } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useTranslation } from 'react-i18next';

const TaskManager = ({ projectId, quotes = [], project = null }) => {
  const { t } = useTranslation();
  const [filters, setFilters] = useState({ status: 'all', priority: 'all', search: '' });
  const { tasks, loading, createTask, updateTask, deleteTask } = useTasksForProject(projectId, filters);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [taskToDelete, setTaskToDelete] = useState(null);

  const handleCreate = () => {
    setEditingTask(null);
    setIsFormOpen(true);
  };

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
  };

  const handleDelete = async () => {
    if (taskToDelete) {
      await deleteTask(taskToDelete);
      setTaskToDelete(null);
    }
  };

  const handleStatusChange = async (task) => {
    const newStatus = task.status === 'completed' ? 'pending' : 'completed';
    await updateTask(task.id, { status: newStatus });
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-gray-900/50 p-4 rounded-xl border border-gray-800">
        <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto flex-1">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 w-4 h-4" />
            <Input 
              placeholder={t('tasks.searchPlaceholder')} 
              className="pl-9 bg-gray-900 border-gray-700 text-white h-9 w-full"
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            />
          </div>
          <div className="flex gap-2">
            <Select value={filters.status} onValueChange={(val) => setFilters(prev => ({ ...prev, status: val }))}>
                <SelectTrigger className="w-full sm:w-[130px] bg-gray-900 border-gray-700 text-white h-9">
                <SelectValue placeholder={t('common.status')} />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                <SelectItem value="all">{t('tasks.filters.allStatuses')}</SelectItem>
                <SelectItem value="pending">{t('tasks.status.pending')}</SelectItem>
                <SelectItem value="in_progress">{t('tasks.status.inProgress')}</SelectItem>
                <SelectItem value="completed">{t('tasks.status.completed')}</SelectItem>
                </SelectContent>
            </Select>
            <Select value={filters.priority} onValueChange={(val) => setFilters(prev => ({ ...prev, priority: val }))}>
                <SelectTrigger className="w-full sm:w-[130px] bg-gray-900 border-gray-700 text-white h-9">
                <SelectValue placeholder={t('tasks.priority')} />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                <SelectItem value="all">{t('tasks.filters.allPriorities')}</SelectItem>
                <SelectItem value="high">{t('tasks.priorityValues.high')}</SelectItem>
                <SelectItem value="medium">{t('tasks.priorityValues.medium')}</SelectItem>
                <SelectItem value="low">{t('tasks.priorityValues.low')}</SelectItem>
                </SelectContent>
            </Select>
          </div>
        </div>
        <Button onClick={handleCreate} className="w-full md:w-auto bg-orange-500 hover:bg-orange-600 h-9">
          <Plus className="w-4 h-4 mr-2" /> {t('tasks.newTask')}
        </Button>
      </div>

      <TaskList 
        tasks={tasks} 
        loading={loading} 
        onEdit={handleEdit} 
        onDelete={setTaskToDelete} 
        onStatusChange={handleStatusChange}
      />

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="bg-gray-900 border-gray-800 text-white w-full sm:max-w-[90%] md:max-w-[600px] overflow-y-auto max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingTask ? t('tasks.editTask') : t('tasks.createNewTask')}</DialogTitle>
          </DialogHeader>
          <TaskForm
            task={editingTask}
            onSave={handleSave}
            onCancel={() => setIsFormOpen(false)}
            quotes={quotes}
            projectContext={project}
            availableTasks={tasks}
          />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!taskToDelete} onOpenChange={() => setTaskToDelete(null)}>
        <AlertDialogContent className="w-full sm:max-w-[90%] md:max-w-lg bg-gray-900 border-gray-800 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>{t('tasks.deleteTask')}</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {t('tasks.deleteTaskDescription')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel className="bg-gray-800 border-gray-700 hover:bg-gray-700 text-white w-full sm:w-auto mt-0">{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 border-0 text-white w-full sm:w-auto">{t('common.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TaskManager;
