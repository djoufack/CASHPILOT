
import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Calendar as CalendarIcon, AlertTriangle } from 'lucide-react';
import { DialogFooter } from '@/components/ui/dialog';
import { format, isBefore, isAfter } from 'date-fns';

const TaskForm = ({ task, onSave, onCancel, loading }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    status: 'pending',
    priority: 'medium',
    assigned_to: '',
    due_date: '',
    started_at: '',
    completed_at: '',
    color: '#3b82f6',
    invoice_id: '',
    quote_id: '',
    purchase_order_id: ''
  });

  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || '',
        description: task.description || '',
        status: task.status || 'pending',
        priority: task.priority || 'medium',
        assigned_to: task.assigned_to || '',
        due_date: task.due_date ? task.due_date.split('T')[0] : '',
        started_at: task.started_at ? task.started_at.split('T')[0] : '',
        completed_at: task.completed_at ? task.completed_at.split('T')[0] : '',
        color: task.color || '#3b82f6',
        invoice_id: task.invoice_id || '',
        quote_id: task.quote_id || '',
        purchase_order_id: task.purchase_order_id || ''
      });
    }
  }, [task]);

  const validateDates = () => {
    if (formData.started_at && formData.completed_at) {
      if (isAfter(new Date(formData.started_at), new Date(formData.completed_at))) {
        setValidationError('Completed date must be after started date');
        return false;
      }
    }
    setValidationError('');
    return true;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.title.trim()) return;
    if (!validateDates()) return;
    
    // Clean up empty strings for UUIDs to null
    const cleanedData = {
      ...formData,
      invoice_id: formData.invoice_id || null,
      quote_id: formData.quote_id || null,
      purchase_order_id: formData.purchase_order_id || null,
      started_at: formData.started_at || null,
      completed_at: formData.completed_at || null,
    };
    
    onSave(cleanedData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4 text-white">
      <div className="space-y-2">
        <Label htmlFor="title" className="text-gray-300">Title <span className="text-red-500">*</span></Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
          className="bg-gray-800 border-gray-700 text-white w-full"
          placeholder="e.g. Design Homepage"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <div className="space-y-2">
          <Label htmlFor="status" className="text-gray-300">Status</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => setFormData({ ...formData, status: value })}
          >
            <SelectTrigger className="bg-gray-800 border-gray-700 text-white w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 text-white">
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="on_hold">On Hold</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority" className="text-gray-300">Priority</Label>
          <Select
            value={formData.priority}
            onValueChange={(value) => setFormData({ ...formData, priority: value })}
          >
            <SelectTrigger className="bg-gray-800 border-gray-700 text-white w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 text-white">
              <SelectItem value="low">Low</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="high">High</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="assigned_to" className="text-gray-300">Assigned To</Label>
          <Input
            id="assigned_to"
            value={formData.assigned_to}
            onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
            className="bg-gray-800 border-gray-700 text-white w-full"
            placeholder="John Doe"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="due_date" className="text-gray-300">Due Date</Label>
          <div className="relative">
            <Input
              id="due_date"
              type="date"
              value={formData.due_date}
              onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
              className="bg-gray-800 border-gray-700 text-white pl-10 w-full"
            />
            <CalendarIcon className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
          </div>
        </div>
      </div>

      {/* Extended Date Fields */}
       <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-800 pt-4">
        <div className="space-y-2">
          <Label htmlFor="started_at" className="text-gray-400 text-sm">Started At</Label>
          <Input
            id="started_at"
            type="date"
            value={formData.started_at}
            onChange={(e) => setFormData({ ...formData, started_at: e.target.value })}
            className="bg-gray-900 border-gray-700 text-white text-sm w-full"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="completed_at" className="text-gray-400 text-sm">Completed At</Label>
          <Input
            id="completed_at"
            type="date"
            value={formData.completed_at}
            onChange={(e) => setFormData({ ...formData, completed_at: e.target.value })}
            className="bg-gray-900 border-gray-700 text-white text-sm w-full"
          />
        </div>
      </div>
      
      {validationError && (
        <div className="bg-red-900/20 text-red-400 p-2 rounded text-sm flex items-center">
          <AlertTriangle className="w-4 h-4 mr-2" />
          {validationError}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="description" className="text-gray-300">Description</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={4}
          className="bg-gray-800 border-gray-700 text-white resize-none w-full min-h-[100px]"
          placeholder="Detailed description of the task..."
        />
      </div>

      <DialogFooter className="mt-6 flex-col sm:flex-row gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="border-gray-700 text-gray-300 hover:bg-gray-800 w-full sm:w-auto mt-0"
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white w-full sm:w-auto"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (task ? 'Update Task' : 'Create Task')}
        </Button>
      </DialogFooter>
    </form>
  );
};

export default TaskForm;
