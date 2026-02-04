import React, { useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { GripVertical, Calendar, Eye, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';

const KanbanCard = ({ item, onView, onEdit, onDelete, isDragOverlay }) => (
  <motion.div
    initial={isDragOverlay ? false : { opacity: 0, y: 10 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-gray-800 rounded-lg border border-gray-700 p-3 hover:bg-gray-750 transition-colors group"
  >
    <div className="flex items-start justify-between mb-2">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <GripVertical className="w-4 h-4 text-gray-600 shrink-0 opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-white truncate">{item.title}</p>
          {item.subtitle && <p className="text-xs text-gray-500 truncate">{item.subtitle}</p>}
        </div>
      </div>
      <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ml-2 ${item.statusColor || 'bg-gray-500/20 text-gray-400'}`}>
        {item.statusLabel || item.status}
      </span>
    </div>

    {item.amount && (
      <p className="text-sm font-bold text-orange-400 mb-1 pl-6">{item.amount}</p>
    )}

    {item.date && (
      <p className="text-xs text-gray-500 mb-2 pl-6">
        <Calendar className="w-3 h-3 inline mr-1" />
        {format(new Date(item.date), 'dd/MM/yyyy')}
      </p>
    )}

    {(onView || onEdit || onDelete) && (
      <div className="flex items-center gap-1 pt-2 border-t border-gray-700/50 pl-6">
        {onEdit && (
          <Button size="sm" variant="ghost" className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 h-7 px-2 text-xs"
            onClick={(e) => { e.stopPropagation(); onEdit(item); }}>
            <Edit className="w-3 h-3 mr-1" />Edit
          </Button>
        )}
        {onView && (
          <Button size="sm" variant="ghost" className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 h-7 px-2 text-xs ml-auto"
            onClick={(e) => { e.stopPropagation(); onView(item); }}>
            <Eye className="w-3 h-3" />
          </Button>
        )}
        {onDelete && (
          <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 px-2 text-xs"
            onClick={(e) => { e.stopPropagation(); onDelete(item); }}>
            <Trash2 className="w-3 h-3" />
          </Button>
        )}
      </div>
    )}
  </motion.div>
);

const SortableKanbanItem = ({ item, onView, onEdit, onDelete }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, data: { item } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="mb-3">
      <KanbanCard item={item} onView={onView} onEdit={onEdit} onDelete={onDelete} />
    </div>
  );
};

const KanbanColumn = ({ column, items, onView, onEdit, onDelete, emptyMessage }) => {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div className="flex flex-col h-full bg-gray-900/30 rounded-xl border border-gray-800 min-w-[280px] w-full md:w-[320px]">
      <div className={`p-4 border-b border-gray-800 flex justify-between items-center rounded-t-xl ${column.color}`}>
        <h3 className="font-semibold">{column.title}</h3>
        <span className="bg-gray-900/50 px-2 py-0.5 rounded text-xs">{items.length}</span>
      </div>

      <div
        ref={setNodeRef}
        className={`p-3 flex-1 overflow-y-auto min-h-[200px] transition-colors ${isOver ? 'bg-gray-800/30' : ''}`}
      >
        <SortableContext items={items.map(i => i.id)} strategy={verticalListSortingStrategy}>
          {items.map(item => (
            <SortableKanbanItem key={item.id} item={item} onView={onView} onEdit={onEdit} onDelete={onDelete} />
          ))}
        </SortableContext>
        {items.length === 0 && (
          <div className="h-20 flex items-center justify-center text-gray-600 text-sm italic border-2 border-dashed border-gray-800 rounded-lg">
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Generic Kanban View for any CRUD page with multi-status entities
 * @param {Array} columns - Array of { id: string, title: string, color: string (tailwind classes) }
 * @param {Array} items - Array of { id, title, subtitle, amount, date, status, statusLabel, statusColor }
 * @param {Function} onStatusChange - async (itemId, newStatus) => void
 * @param {Function} onView - (item) => void (optional)
 * @param {Function} onEdit - (item) => void (optional)
 * @param {Function} onDelete - (item) => void (optional)
 * @param {string} emptyMessage - Text shown when a column is empty
 */
const GenericKanbanView = ({
  columns = [],
  items = [],
  onStatusChange,
  onView,
  onEdit,
  onDelete,
  emptyMessage,
}) => {
  const { t } = useTranslation();
  const [localItems, setLocalItems] = useState(items);
  const [activeItem, setActiveItem] = useState(null);

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragStart = (event) => {
    const item = localItems.find(i => i.id === event.active.id);
    setActiveItem(item);
  };

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    setActiveItem(null);

    if (!over) return;

    const itemId = active.id;
    const draggedItem = localItems.find(i => i.id === itemId);
    if (!draggedItem) return;

    // Determine target column: over.id is either a column ID or an item ID
    let newStatus = over.id;
    const overItem = localItems.find(i => i.id === over.id);
    if (overItem) {
      newStatus = overItem.status;
    }

    if (draggedItem.status !== newStatus && columns.some(c => c.id === newStatus)) {
      // Optimistic update
      const updated = localItems.map(i =>
        i.id === itemId ? { ...i, status: newStatus } : i
      );
      setLocalItems(updated);

      // Persist
      if (onStatusChange) {
        await onStatusChange(itemId, newStatus);
      }
    }
  };

  const dropMessage = emptyMessage || t('common.kanbanDropHere') || 'Drop items here';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4 h-[calc(100vh-300px)] min-h-[400px]">
          {columns.map(col => (
            <KanbanColumn
              key={col.id}
              column={col}
              items={localItems.filter(i => i.status === col.id)}
              onView={onView}
              onEdit={onEdit}
              onDelete={onDelete}
              emptyMessage={dropMessage}
            />
          ))}
        </div>

        <DragOverlay>
          {activeItem ? <KanbanCard item={activeItem} isDragOverlay /> : null}
        </DragOverlay>
      </DndContext>
    </motion.div>
  );
};

export default GenericKanbanView;
