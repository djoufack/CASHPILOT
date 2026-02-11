
import React, { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import { useTimesheets } from '@/hooks/useTimesheets';
import { useClients } from '@/hooks/useClients';
import { useProjects } from '@/hooks/useProjects';
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
import { motion } from 'framer-motion';
import { calculateDuration } from '@/utils/calculations';
import { validateTimeFormat, validateTimeRange } from '@/utils/validation';
import { Clock, Loader2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

const TimesheetForm = ({ onSuccess, onCancel, defaultDate }) => {
  const { t } = useTranslation();
  const { createTimesheet } = useTimesheets();
  const { clients } = useClients();
  const { projects } = useProjects();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    date: defaultDate || new Date().toISOString().split('T')[0],
    start_time: '09:00',
    end_time: '17:00',
    client_id: '',
    project_id: '',
    notes: ''
  });
  const [calculatedDuration, setCalculatedDuration] = useState('0:00');

  useEffect(() => {
    if (formData.start_time && formData.end_time) {
      if (validateTimeFormat(formData.start_time) && validateTimeFormat(formData.end_time)) {
        const duration = calculateDuration(formData.start_time, formData.end_time);
        setCalculatedDuration(duration);
      }
    }
  }, [formData.start_time, formData.end_time]);

  // Filter projects based on selected client
  const filteredProjects = formData.client_id 
    ? projects.filter(p => p.client_id === formData.client_id)
    : projects;

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validation des champs obligatoires avec nom du champ
    const missingFields = [];
    if (!formData.date) missingFields.push(t('timesheets.date', 'Date'));
    if (!formData.client_id) missingFields.push(t('timesheets.client', 'Client'));
    if (!formData.start_time) missingFields.push(t('timesheets.startTime', 'Heure de début'));
    if (!formData.end_time) missingFields.push(t('timesheets.endTime', 'Heure de fin'));

    if (missingFields.length > 0) {
      toast({
        title: t('validation.missingFields', 'Champs obligatoires manquants'),
        description: `${t('validation.pleaseComplete', 'Veuillez remplir')} : ${missingFields.join(', ')}`,
        variant: "destructive"
      });
      return;
    }

    if (!validateTimeFormat(formData.start_time) || !validateTimeFormat(formData.end_time)) {
      toast({
        title: t('validation.invalidTimeFormat', 'Format horaire invalide'),
        description: t('validation.useHHMM', 'Veuillez utiliser le format HH:MM pour les heures de début et de fin.'),
        variant: "destructive"
      });
      return;
    }

    if (formData.start_time >= formData.end_time) {
      toast({
        title: t('validation.invalidTimeRange', 'Plage horaire invalide'),
        description: t('validation.endAfterStart', "L'heure de fin doit être postérieure à l'heure de début."),
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      await createTimesheet(formData);
      
      // Reset form
      setFormData({
        date: new Date().toISOString().split('T')[0],
        start_time: '09:00',
        end_time: '17:00',
        client_id: '',
        project_id: '',
        notes: ''
      });
      
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error('Error saving timesheet:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="date">{t('timesheets.date')}</Label>
          <Input
            id="date"
            type="date"
            value={formData.date}
            onChange={(e) => setFormData({ ...formData, date: e.target.value })}
            required
            className="bg-gray-700 border-gray-600 text-white w-full"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="client">{t('timesheets.client')}</Label>
          <Select
            value={formData.client_id}
            onValueChange={(value) => setFormData({ ...formData, client_id: value, project_id: '' })}
            required
          >
            <SelectTrigger className="bg-gray-700 border-gray-600 text-white w-full">
              <SelectValue placeholder={t('timesheets.selectClient')} />
            </SelectTrigger>
            <SelectContent className="bg-gray-700 border-gray-600 text-white">
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.company_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="project">Project</Label>
        <Select
          value={formData.project_id}
          onValueChange={(value) => setFormData({ ...formData, project_id: value })}
        >
          <SelectTrigger className="bg-gray-700 border-gray-600 text-white w-full">
            <SelectValue placeholder="Select Project (Optional)" />
          </SelectTrigger>
          <SelectContent className="bg-gray-700 border-gray-600 text-white">
            {filteredProjects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="start_time">{t('timesheets.startTime')}</Label>
          <Input
            id="start_time"
            type="time"
            value={formData.start_time}
            onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
            required
            className="bg-gray-700 border-gray-600 text-white w-full"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="end_time">{t('timesheets.endTime')}</Label>
          <Input
            id="end_time"
            type="time"
            value={formData.end_time}
            onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
            required
            className="bg-gray-700 border-gray-600 text-white w-full"
          />
        </div>
      </div>

      <div className="flex items-center space-x-2 p-3 bg-gradient-to-r from-yellow-900/20 via-green-900/20 to-purple-900/20 rounded-lg border border-yellow-500/20">
        <Clock className="w-5 h-5 text-yellow-400" />
        <span className="text-sm text-gray-300">{t('timesheets.calculatedDuration')}:</span>
        <span className="text-lg font-bold text-white">{calculatedDuration}</span>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">{t('timesheets.notes')}</Label>
        <Textarea
          id="notes"
          value={formData.notes}
          onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          rows={3}
          className="bg-gray-700 border-gray-600 text-white resize-none w-full min-h-[80px]"
          placeholder="Description of work performed..."
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 flex-col sm:flex-row">
        {onCancel && (
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="border-gray-600 text-gray-300 hover:bg-gray-800 w-full sm:w-auto"
          >
            Cancel
          </Button>
        )}
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="w-full sm:w-auto">
          <Button
            type="submit"
            disabled={loading}
            className="bg-gradient-to-r from-yellow-500 via-green-500 to-purple-600 hover:from-yellow-600 hover:via-green-600 hover:to-purple-700 text-white shadow-lg w-full sm:w-auto"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('buttons.save')}
          </Button>
        </motion.div>
      </div>
    </form>
  );
};

export default TimesheetForm;
