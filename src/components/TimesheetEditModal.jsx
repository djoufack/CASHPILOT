
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { calculateDuration } from '@/utils/calculations';
import { validateTimeFormat } from '@/utils/validation';
import { Clock, Loader2, Trash2 } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

const TimesheetEditModal = ({ isOpen, onClose, timesheet }) => {
  const { t } = useTranslation();
  const { updateTimesheet, deleteTimesheet } = useTimesheets();
  const { clients } = useClients();
  const { projects } = useProjects();
  
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [formData, setFormData] = useState({
    date: '',
    start_time: '',
    end_time: '',
    client_id: '',
    project_id: '',
    notes: ''
  });
  const [calculatedDuration, setCalculatedDuration] = useState('0:00');

  useEffect(() => {
    if (timesheet) {
      setFormData({
        date: timesheet.date || '',
        start_time: timesheet.start_time || '',
        end_time: timesheet.end_time || '',
        client_id: timesheet.client_id || '',
        project_id: timesheet.project_id || '',
        notes: timesheet.notes || ''
      });
    }
  }, [timesheet]);

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
      await updateTimesheet(timesheet.id, formData);
      onClose();
    } catch (error) {
      console.error('Error updating timesheet:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleteLoading(true);
    try {
      await deleteTimesheet(timesheet.id);
      onClose();
    } catch (error) {
      console.error('Error deleting timesheet:', error);
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] bg-gray-900 border-gray-800 text-white">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-gradient">
            Edit Timesheet Entry
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-date" className="text-gray-300">Date</Label>
              <Input
                id="edit-date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                required
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-client" className="text-gray-300">Client</Label>
              <Select
                value={formData.client_id?.toString()}
                onValueChange={(value) => setFormData({ ...formData, client_id: value, project_id: '' })}
                required
              >
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Select Client" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id?.toString()}>
                      {client.company_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-project" className="text-gray-300">Project</Label>
            <Select
              value={formData.project_id?.toString() || 'none'}
              onValueChange={(value) => setFormData({ ...formData, project_id: value === 'none' ? null : value })}
            >
              <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                <SelectValue placeholder="Select Project (Optional)" />
              </SelectTrigger>
              <SelectContent className="bg-gray-800 border-gray-700 text-white">
                <SelectItem value="none">No Project</SelectItem>
                {filteredProjects.map((project) => (
                  <SelectItem key={project.id} value={project.id?.toString()}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="edit-start_time" className="text-gray-300">Start Time</Label>
              <Input
                id="edit-start_time"
                type="time"
                value={formData.start_time}
                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                required
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-end_time" className="text-gray-300">End Time</Label>
              <Input
                id="edit-end_time"
                type="time"
                value={formData.end_time}
                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                required
                className="bg-gray-800 border-gray-700 text-white"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
            <Clock className="w-5 h-5 text-orange-400" />
            <span className="text-sm text-gray-400">Duration:</span>
            <span className="text-lg font-bold text-gradient">{calculatedDuration}</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-notes" className="text-gray-300">Notes</Label>
            <Textarea
              id="edit-notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
              className="bg-gray-800 border-gray-700 text-white resize-none"
              placeholder="Description..."
            />
          </div>

          <div className="flex justify-between items-center pt-4">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button 
                  type="button" 
                  variant="destructive"
                  className="bg-red-900/50 hover:bg-red-900 text-red-200 border border-red-900"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent className="bg-gray-900 border-gray-800 text-white">
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription className="text-gray-400">
                    This action cannot be undone. This will permanently delete this timesheet entry.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel className="bg-gray-800 border-gray-700 text-white hover:bg-gray-700">Cancel</AlertDialogCancel>
                  <AlertDialogAction 
                    onClick={handleDelete}
                    className="bg-red-600 hover:bg-red-700 text-white border-0"
                    disabled={deleteLoading}
                  >
                    {deleteLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            <div className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save Changes"}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default TimesheetEditModal;
