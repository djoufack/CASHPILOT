
import React from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  AlertCircle, 
  User, 
  Calendar, 
  FileText,
  FileSignature,
  Package,
  Edit2,
  Trash2,
  CheckSquare,
  PauseCircle,
  XCircle,
  PlayCircle,
  Wrench
} from 'lucide-react';
import { format, parseISO, isPast, differenceInDays } from 'date-fns';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTaskStatus } from '@/hooks/useTaskStatus';

const TaskCard = ({ task, onEdit, onDelete, onStatusChange }) => {
  const { updateTaskStatus } = useTaskStatus();
  const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && task.status !== 'completed';

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'medium': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'low': return 'bg-green-500/10 text-green-500 border-green-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return 'border-green-500/50 bg-green-900/10';
      case 'in_progress': return 'border-blue-500/50 bg-blue-900/10';
      case 'on_hold': return 'border-orange-500/50 bg-orange-900/10';
      case 'cancelled': return 'border-red-500/50 bg-red-900/10';
      default: return 'border-gray-800 bg-gray-900/50';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed': return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'in_progress': return <PlayCircle className="w-4 h-4 text-blue-500" />;
      case 'on_hold': return <PauseCircle className="w-4 h-4 text-orange-500" />;
      case 'cancelled': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Circle className="w-4 h-4 text-gray-500" />;
    }
  };

  const handleStatusUpdate = async (newStatus) => {
    if (onStatusChange) {
      onStatusChange({ ...task, status: newStatus });
    } else {
      await updateTaskStatus(task.id, newStatus, task);
      // Ideally trigger parent refresh here if not handled by onStatusChange
    }
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ scale: 1.02, y: -2 }}
      className={`relative p-5 rounded-xl border shadow-lg transition-all ${getStatusColor(task.status)} ${isOverdue ? 'ring-2 ring-red-500/30' : ''}`}
    >
      {/* Header */}
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1 pr-4">
          <div className="flex items-center gap-2 mb-1">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="focus:outline-none hover:scale-110 transition-transform">
                  {getStatusIcon(task.status)}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-gray-900 border-gray-800 text-white">
                <DropdownMenuItem onClick={() => handleStatusUpdate('pending')}>
                  <Circle className="w-4 h-4 mr-2 text-gray-400" /> Pending
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusUpdate('in_progress')}>
                  <PlayCircle className="w-4 h-4 mr-2 text-blue-500" /> In Progress
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusUpdate('completed')}>
                  <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" /> Completed
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusUpdate('on_hold')}>
                  <PauseCircle className="w-4 h-4 mr-2 text-orange-500" /> On Hold
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleStatusUpdate('cancelled')}>
                  <XCircle className="w-4 h-4 mr-2 text-red-500" /> Cancelled
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <h3 className={`font-semibold text-lg text-gradient ${task.status === 'completed' || task.status === 'cancelled' ? 'line-through !text-gray-500' : ''}`}>
              {task.title}
            </h3>
          </div>
          {task.description && (
            <p className="text-sm text-gray-400 line-clamp-2 pl-7">
              {task.description}
            </p>
          )}
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => onEdit(task)} className="h-8 w-8 text-gray-400 hover:text-orange-400">
            <Edit2 className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => onDelete(task.id)} className="h-8 w-8 text-gray-400 hover:text-red-400">
            <Trash2 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Meta Grid */}
      <div className="grid grid-cols-2 gap-y-2 gap-x-4 pl-7 text-xs mb-4">
        <div className="flex items-center gap-1.5 text-gray-400">
          <AlertCircle className="w-3.5 h-3.5" />
          <Badge variant="outline" className={`h-5 px-1.5 font-normal capitalize ${getPriorityColor(task.priority)}`}>
            {task.priority || 'Normal'}
          </Badge>
        </div>

        {task.due_date && (
          <div className={`flex items-center gap-1.5 ${isOverdue ? 'text-red-400 font-medium' : 'text-gray-400'}`}>
            <Calendar className="w-3.5 h-3.5" />
            <span>{format(parseISO(task.due_date), 'MMM d')}</span>
            {task.status !== 'completed' && (
              <span className="text-xs opacity-75">
                ({differenceInDays(parseISO(task.due_date), new Date())}d left)
              </span>
            )}
          </div>
        )}

        {task.started_at && task.status === 'in_progress' && (
          <div className="flex items-center gap-1.5 text-blue-400 col-span-2">
             <Clock className="w-3.5 h-3.5" />
             <span>Started {format(parseISO(task.started_at), 'MMM d')}</span>
          </div>
        )}

        {task.assigned_to && (
          <div className="flex items-center gap-1.5 text-gray-400 col-span-2">
            <User className="w-3.5 h-3.5" />
            <span className="truncate">{task.assigned_to}</span>
          </div>
        )}
      </div>

      {/* Footer: Linked Docs & Subtasks */}
      <div className="flex items-center justify-between pl-7 border-t border-gray-700/50 pt-3 mt-2">
        <div className="flex gap-2">
          {task.service && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <div className="p-1.5 rounded bg-emerald-900/30 text-emerald-400 border border-emerald-800">
                    <Wrench className="w-3.5 h-3.5" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>{task.service.service_name}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {task.estimated_hours && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <div className="p-1.5 rounded bg-cyan-900/30 text-cyan-400 border border-cyan-800 text-xs font-medium">
                    {task.estimated_hours}h
                  </div>
                </TooltipTrigger>
                <TooltipContent>Estimated: {task.estimated_hours} hours</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {task.invoice_id && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger>
                  <div className="p-1.5 rounded bg-blue-900/30 text-blue-400 border border-blue-800">
                    <FileText className="w-3.5 h-3.5" />
                  </div>
                </TooltipTrigger>
                <TooltipContent>Linked Invoice</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          {task.quote_id && (
             <div className="p-1.5 rounded bg-purple-900/30 text-purple-400 border border-purple-800">
               <FileSignature className="w-3.5 h-3.5" />
             </div>
          )}
          {task.purchase_order_id && (
             <div className="p-1.5 rounded bg-orange-900/30 text-orange-400 border border-orange-800">
               <Package className="w-3.5 h-3.5" />
             </div>
          )}
        </div>

        {task.subtasks && task.subtasks[0] && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <CheckSquare className="w-3.5 h-3.5" />
            <span>{task.subtasks[0].count} Subtasks</span>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default TaskCard;
