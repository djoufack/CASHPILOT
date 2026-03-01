
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
import { Switch } from '@/components/ui/switch';
import { Loader2, Calendar as CalendarIcon, AlertTriangle } from 'lucide-react';
import { DialogFooter } from '@/components/ui/dialog';
import { isAfter } from 'date-fns';
import { useTranslation } from 'react-i18next';

const TaskForm = ({ task, onSave, onCancel, loading, services = [], quotes = [] }) => {
  const { t } = useTranslation();
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
    purchase_order_id: '',
    service_id: '',
    estimated_hours: '',
    requires_quote: false,
  });

  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (task) {
      setFormData({
        title: task.title || task.name || '',
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
        purchase_order_id: task.purchase_order_id || '',
        service_id: task.service_id || '',
        estimated_hours: task.estimated_hours || '',
        requires_quote: !!task.requires_quote,
      });
    } else {
      setFormData({
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
        purchase_order_id: '',
        service_id: '',
        estimated_hours: '',
        requires_quote: false,
      });
    }
  }, [task]);

  const validateDates = () => {
    if (formData.started_at && formData.completed_at) {
      if (isAfter(new Date(formData.started_at), new Date(formData.completed_at))) {
        setValidationError(t('tasks.validation.completedAfterStarted'));
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
      service_id: formData.service_id || null,
      estimated_hours: formData.estimated_hours ? parseFloat(formData.estimated_hours) : null,
      requires_quote: !!formData.requires_quote,
    };
    
    onSave(cleanedData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 py-4 text-white">
      <div className="space-y-2">
        <Label htmlFor="title" className="text-gray-300">{t('tasks.title')} <span className="text-red-500">*</span></Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
          className="bg-gray-800 border-gray-700 text-white w-full"
          placeholder={t('tasks.titlePlaceholder')}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
         <div className="space-y-2">
          <Label htmlFor="status" className="text-gray-300">{t('common.status')}</Label>
          <Select
            value={formData.status}
            onValueChange={(value) => setFormData({ ...formData, status: value })}
          >
            <SelectTrigger className="bg-gray-800 border-gray-700 text-white w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 text-white">
              <SelectItem value="pending">{t('tasks.status.pending')}</SelectItem>
              <SelectItem value="in_progress">{t('tasks.status.inProgress')}</SelectItem>
              <SelectItem value="completed">{t('tasks.status.completed')}</SelectItem>
              <SelectItem value="on_hold">{t('tasks.status.onHold')}</SelectItem>
              <SelectItem value="cancelled">{t('tasks.status.cancelled')}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="priority" className="text-gray-300">{t('tasks.priority')}</Label>
          <Select
            value={formData.priority}
            onValueChange={(value) => setFormData({ ...formData, priority: value })}
          >
            <SelectTrigger className="bg-gray-800 border-gray-700 text-white w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 text-white">
              <SelectItem value="low">{t('tasks.priorityValues.low')}</SelectItem>
              <SelectItem value="medium">{t('tasks.priorityValues.medium')}</SelectItem>
              <SelectItem value="high">{t('tasks.priorityValues.high')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="assigned_to" className="text-gray-300">{t('tasks.assignedTo')}</Label>
          <Input
            id="assigned_to"
            value={formData.assigned_to}
            onChange={(e) => setFormData({ ...formData, assigned_to: e.target.value })}
            className="bg-gray-800 border-gray-700 text-white w-full"
            placeholder={t('tasks.assignedToPlaceholder')}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="due_date" className="text-gray-300">{t('tasks.dueDate')}</Label>
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

      {/* Service & Estimated Hours */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="service_id" className="text-gray-300">{t('services.title')}</Label>
          <Select
            value={formData.service_id}
            onValueChange={(value) => {
              setFormData({
                ...formData,
                service_id: value === 'none' ? '' : value
              });
            }}
          >
            <SelectTrigger className="bg-gray-800 border-gray-700 text-white w-full">
              <SelectValue placeholder={t('tasks.selectService')} />
            </SelectTrigger>
            <SelectContent className="bg-gray-800 border-gray-700 text-white">
              <SelectItem value="none">{t('tasks.none')}</SelectItem>
              {services.filter(s => s.is_active).map((svc) => (
                <SelectItem key={svc.id} value={svc.id}>
                  {svc.service_name} ({svc.pricing_type === 'hourly' ? `${svc.hourly_rate}/h` : svc.pricing_type === 'fixed' ? `${svc.fixed_price} ${t('services.fixed')}` : `${svc.unit_price}/${svc.unit}`})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="estimated_hours" className="text-gray-300">{t('tasks.estimatedHours')}</Label>
          <Input
            id="estimated_hours"
            type="number"
            step="0.5"
            min="0"
            value={formData.estimated_hours}
            onChange={(e) => setFormData({ ...formData, estimated_hours: e.target.value })}
            className="bg-gray-800 border-gray-700 text-white w-full"
            placeholder={t('tasks.estimatedHoursPlaceholder')}
          />
        </div>
      </div>

      {/* Extended Date Fields */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-gray-800 pt-4">
        <div className="space-y-2">
          <Label htmlFor="started_at" className="text-gray-400 text-sm">{t('tasks.startedAt')}</Label>
          <Input
            id="started_at"
            type="date"
            value={formData.started_at}
            onChange={(e) => setFormData({ ...formData, started_at: e.target.value })}
            className="bg-gray-900 border-gray-700 text-white text-sm w-full"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="completed_at" className="text-gray-400 text-sm">{t('tasks.completedAt')}</Label>
          <Input
            id="completed_at"
            type="date"
            value={formData.completed_at}
            onChange={(e) => setFormData({ ...formData, completed_at: e.target.value })}
            className="bg-gray-900 border-gray-700 text-white text-sm w-full"
          />
        </div>
      </div>

      <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Label htmlFor="requires_quote" className="text-gray-300">{t('tasks.quoteReminder')}</Label>
            <p className="mt-1 text-sm text-gray-500">
              {t('tasks.quoteReminderDescription')}
            </p>
          </div>
          <Switch
            id="requires_quote"
            checked={!!formData.requires_quote}
            onCheckedChange={(checked) => setFormData((current) => ({
              ...current,
              requires_quote: !!checked,
              quote_id: checked ? current.quote_id : '',
            }))}
          />
        </div>

        {formData.requires_quote && (
          <div className="space-y-2">
            <Label htmlFor="quote_id" className="text-gray-300">{t('tasks.linkedQuote')}</Label>
            <Select
              value={formData.quote_id || 'none'}
              onValueChange={(value) => setFormData((current) => ({
                ...current,
                quote_id: value === 'none' ? '' : value,
              }))}
            >
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white w-full">
                <SelectValue placeholder={t('tasks.selectQuote')} />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700 text-white">
                <SelectItem value="none">{t('tasks.noQuoteLinked')}</SelectItem>
                {quotes.map((quote) => (
                  <SelectItem key={quote.id} value={quote.id}>
                    {quote.quote_number} ({quote.status || t('status.draft')})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              {t('tasks.quoteReminderHelp')}
            </p>
          </div>
        )}
      </div>
      
      {validationError && (
        <div className="bg-red-900/20 text-red-400 p-2 rounded text-sm flex items-center">
          <AlertTriangle className="w-4 h-4 mr-2" />
          {validationError}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="description" className="text-gray-300">{t('invoices.description')}</Label>
        <Textarea
          id="description"
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          rows={4}
          className="bg-gray-800 border-gray-700 text-white resize-none w-full min-h-[100px]"
          placeholder={t('tasks.descriptionPlaceholder')}
        />
      </div>

      <DialogFooter className="mt-6 flex-col sm:flex-row gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
          className="border-gray-700 text-gray-300 hover:bg-gray-800 w-full sm:w-auto mt-0"
        >
          {t('common.cancel')}
        </Button>
        <Button
          type="submit"
          disabled={loading}
          className="bg-orange-500 hover:bg-orange-600 text-white w-full sm:w-auto"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : (task ? t('tasks.updateTask') : t('tasks.createTask'))}
        </Button>
      </DialogFooter>
    </form>
  );
};

export default TaskForm;
