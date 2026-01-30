
import React from 'react';
import { useSubtasks } from '@/hooks/useSubtasks';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Loader2, Plus, GripVertical } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const SubtaskList = ({ taskId }) => {
  const { subtasks, loading, createSubtask, updateSubtask, deleteSubtask } = useSubtasks(taskId);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');
  const [adding, setAdding] = useState(false);

  const handleAddSubtask = async (e) => {
    e.preventDefault();
    if (!newSubtaskTitle.trim()) return;

    setAdding(true);
    try {
      await createSubtask({ 
        title: newSubtaskTitle,
        status: 'pending'
      });
      setNewSubtaskTitle('');
    } finally {
      setAdding(false);
    }
  };

  const toggleStatus = async (subtask) => {
    const newStatus = subtask.status === 'completed' ? 'pending' : 'completed';
    await updateSubtask(subtask.id, { status: newStatus });
  };

  if (loading && subtasks.length === 0) {
    return <div className="text-center py-4"><Loader2 className="w-4 h-4 animate-spin mx-auto text-gray-400" /></div>;
  }

  return (
    <div className="space-y-2">
      <AnimatePresence>
        {subtasks.map((subtask) => (
          <motion.div
            key={subtask.id}
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, height: 0 }}
            className="flex items-center gap-2 group p-2 rounded-md hover:bg-gray-800/50 transition-colors"
          >
            <Checkbox
              checked={subtask.status === 'completed'}
              onCheckedChange={() => toggleStatus(subtask)}
              className="border-gray-600 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
            />
            <span className={`flex-1 text-sm ${subtask.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-300'}`}>
              {subtask.title}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-red-400 hover:bg-transparent"
              onClick={() => deleteSubtask(subtask.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </motion.div>
        ))}
      </AnimatePresence>

      <form onSubmit={handleAddSubtask} className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-800">
        <Plus className="w-4 h-4 text-gray-500" />
        <Input
          value={newSubtaskTitle}
          onChange={(e) => setNewSubtaskTitle(e.target.value)}
          placeholder="Add a subtask..."
          className="h-8 bg-transparent border-none text-sm focus-visible:ring-0 px-0 placeholder:text-gray-600"
        />
        {newSubtaskTitle && (
          <Button 
            type="submit" 
            size="sm" 
            disabled={adding}
            className="h-7 px-3 bg-gray-800 hover:bg-gray-700 text-xs"
          >
            {adding ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Add'}
          </Button>
        )}
      </form>
    </div>
  );
};

export default SubtaskList;
