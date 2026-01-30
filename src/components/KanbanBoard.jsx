
import React, { useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useTaskStatus } from '@/hooks/useTaskStatus';
import TaskCard from './TaskCard';
import { Loader2, Plus, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';

const COLUMNS = [
  { id: 'pending', title: 'Pending', color: 'bg-gray-500/20 text-gray-400' },
  { id: 'in_progress', title: 'In Progress', color: 'bg-blue-500/20 text-blue-400' },
  { id: 'on_hold', title: 'On Hold', color: 'bg-orange-500/20 text-orange-400' },
  { id: 'completed', title: 'Completed', color: 'bg-green-500/20 text-green-400' },
  { id: 'cancelled', title: 'Cancelled', color: 'bg-red-500/20 text-red-400' }
];

// Sortable Task Item Wrapper
const SortableTaskItem = ({ task, onEdit, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: task.id, data: { task } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="mb-3 relative group">
       <div {...attributes} {...listeners} className="absolute left-2 top-6 z-10 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing text-gray-500">
         <GripVertical className="w-4 h-4" />
       </div>
       <div className="pl-0"> 
          <TaskCard task={task} onEdit={onEdit} onDelete={onDelete} />
       </div>
    </div>
  );
};

const KanbanColumn = ({ column, tasks, onEdit, onDelete }) => {
  const { setNodeRef } = useDroppable({ id: column.id });
  
  return (
    <div className="flex flex-col h-full bg-gray-900/30 rounded-xl border border-gray-800 min-w-[300px] w-full md:w-[350px]">
      <div className={`p-4 border-b border-gray-800 flex justify-between items-center rounded-t-xl ${column.color}`}>
        <h3 className="font-semibold">{column.title}</h3>
        <span className="bg-gray-900/50 px-2 py-0.5 rounded text-xs">{tasks.length}</span>
      </div>
      
      <div ref={setNodeRef} className="p-3 flex-1 overflow-y-auto min-h-[200px]">
        <SortableContext items={tasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map(task => (
            <SortableTaskItem key={task.id} task={task} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <div className="h-20 flex items-center justify-center text-gray-600 text-sm italic border-2 border-dashed border-gray-800 rounded-lg">
            Drop tasks here
          </div>
        )}
      </div>
    </div>
  );
};

// Droppable wrapper for dnd-kit
import { useDroppable } from '@dnd-kit/core';

const KanbanBoard = ({ tasks, onEdit, onDelete, onStatusChange }) => {
  const { updateTaskStatus } = useTaskStatus();
  const [localTasks, setLocalTasks] = useState(tasks);
  const [activeTask, setActiveTask] = useState(null);

  useEffect(() => {
    setLocalTasks(tasks);
  }, [tasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event) => {
    const { active } = event;
    const task = localTasks.find(t => t.id === active.id);
    setActiveTask(task);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveTask(null);

    if (!over) return;

    const taskId = active.id;
    const activeTask = localTasks.find(t => t.id === taskId);
    
    // Find dropped column
    // The 'over' id could be a column ID OR a task ID within that column
    let newStatus = over.id;
    
    // If over a task, find that task's status
    const overTask = localTasks.find(t => t.id === over.id);
    if (overTask) {
      newStatus = overTask.status;
    }

    if (activeTask.status !== newStatus && COLUMNS.some(c => c.id === newStatus)) {
      // Optimistic update
      const updatedTasks = localTasks.map(t => 
        t.id === taskId ? { ...t, status: newStatus } : t
      );
      setLocalTasks(updatedTasks);
      
      // Persist
      await updateTaskStatus(taskId, newStatus, activeTask);
      if (onStatusChange) onStatusChange({ ...activeTask, status: newStatus });
    }
  };

  return (
    <DndContext 
      sensors={sensors} 
      collisionDetection={closestCorners} 
      onDragStart={handleDragStart} 
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-250px)]">
        {COLUMNS.map(col => (
          <KanbanColumn 
            key={col.id} 
            column={col} 
            tasks={localTasks.filter(t => t.status === col.id)}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </div>
      
      <DragOverlay>
        {activeTask ? <TaskCard task={activeTask} /> : null}
      </DragOverlay>
    </DndContext>
  );
};

export default KanbanBoard;
