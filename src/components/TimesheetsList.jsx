
import React, { useState } from "react";
import { format, parseISO, isValid } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit, Trash2, Clock, CalendarDays, Briefcase, User } from 'lucide-react';
import { CheckSquare, Square, FileText, DollarSign } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import TimesheetEditModal from './TimesheetEditModal';

const STATUS_COLORS = {
  draft: 'bg-gray-500/20 text-gray-400 border-gray-600',
  in_progress: 'bg-blue-500/20 text-blue-400 border-blue-600',
  approved: 'bg-green-500/20 text-green-400 border-green-600',
  invoiced: 'bg-purple-500/20 text-purple-400 border-purple-600',
};

const TimesheetsList = ({ timesheets, loading, onEdit, onDelete, onGenerateInvoice }) => {
  const { t } = useTranslation();
  const [selectedTimesheet, setSelectedTimesheet] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const billableIds = timesheets.filter(ts => ts.billable !== false && !ts.invoice_id).map(ts => ts.id);
    setSelectedIds(new Set(billableIds));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const handleEditClick = (timesheet) => {
    setSelectedTimesheet(timesheet);
    setIsEditModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
      </div>
    );
  }

  if (!timesheets || timesheets.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500 bg-gray-900/50 rounded-xl border border-gray-800 border-dashed">
        <CalendarDays className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p className="text-lg font-medium">No timesheets found</p>
        <p className="text-sm">Start by adding a new time entry above.</p>
      </div>
    );
  }

  // Group by date
  const groupedTimesheets = timesheets.reduce((acc, ts) => {
    const dateStr = ts.date;
    if (!acc[dateStr]) acc[dateStr] = [];
    acc[dateStr].push(ts);
    return acc;
  }, {});

  // Sort dates descending
  const sortedDates = Object.keys(groupedTimesheets).sort((a, b) => new Date(b) - new Date(a));

  return (
    <div className="space-y-6">
      {/* Billing toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-4 mb-4 bg-orange-500/10 border border-orange-500/30 rounded-xl">
          <span className="text-orange-300 font-medium">
            {selectedIds.size} entrée(s) sélectionnée(s)
          </span>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={clearSelection} className="border-gray-600 text-gray-300">
              Annuler
            </Button>
            <Button
              size="sm"
              onClick={() => onGenerateInvoice && onGenerateInvoice([...selectedIds])}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <FileText className="w-4 h-4 mr-2" />
              Générer une facture
            </Button>
          </div>
        </div>
      )}

      {/* Select All bar */}
      {timesheets?.length > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <Button size="sm" variant="ghost" onClick={selectedIds.size > 0 ? clearSelection : selectAll} className="text-gray-400 hover:text-white">
            {selectedIds.size > 0 ? <CheckSquare className="w-4 h-4 mr-2" /> : <Square className="w-4 h-4 mr-2" />}
            {selectedIds.size > 0 ? 'Tout désélectionner' : 'Sélectionner les facturables'}
          </Button>
        </div>
      )}

      <TimesheetEditModal 
        isOpen={isEditModalOpen} 
        onClose={() => setIsEditModalOpen(false)} 
        timesheet={selectedTimesheet} 
      />

      {sortedDates.map((dateStr) => {
        const entries = groupedTimesheets[dateStr];
        const dateObj = parseISO(dateStr);
        const isValidDate = isValid(dateObj);

        return (
          <div key={dateStr} className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden shadow-sm">
            <div className="bg-gray-800/50 px-6 py-3 border-b border-gray-800 flex justify-between items-center">
              <h3 className="font-semibold text-gray-200 flex items-center">
                <CalendarDays className="w-4 h-4 mr-2 text-orange-400" />
                {isValidDate ? format(dateObj, 'EEEE, MMMM d, yyyy') : dateStr}
              </h3>
              <span className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded-full border border-gray-700">
                {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
              </span>
            </div>
            
            <div className="divide-y divide-gray-800">
              <AnimatePresence>
                {entries.map((ts) => (
                  <motion.div
                    key={ts.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="p-4 hover:bg-gray-800/30 transition-colors"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        {/* Selection checkbox */}
                        {!ts.invoice_id && ts.billable !== false && (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleSelect(ts.id); }}
                            className="mr-3 text-gray-400 hover:text-orange-400 transition-colors flex-shrink-0"
                          >
                            {selectedIds.has(ts.id)
                              ? <CheckSquare className="w-5 h-5 text-orange-400" />
                              : <Square className="w-5 h-5" />
                            }
                          </button>
                        )}
                        {ts.invoice_id && (
                          <span className="mr-3 text-xs font-medium px-2 py-0.5 rounded-full bg-green-900/30 text-green-300 border border-green-800 flex-shrink-0">
                            Facturé
                          </span>
                        )}
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          {ts.project?.name && (
                            <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-purple-900/30 text-purple-300 border border-purple-800">
                              {ts.project.name}
                            </span>
                          )}
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-900/30 text-blue-300 border border-blue-800">
                            {ts.client?.company_name || 'No Client'}
                          </span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${STATUS_COLORS[ts.status || 'draft'] || STATUS_COLORS.draft}`}>
                            {t(`timesheets.status.${ts.status || 'draft'}`)}
                          </span>
                          {ts.billable === false && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/20 text-red-400 border border-red-800">
                              {t('timesheets.notBillable')}
                            </span>
                          )}
                        </div>
                        <p className="text-gray-300 text-sm whitespace-pre-wrap">
                          {ts.notes || <span className="text-gray-600 italic">No description</span>}
                        </p>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right min-w-[100px]">
                          <div className="flex items-center justify-end text-gradient font-medium">
                            <Clock className="w-3.5 h-3.5 mr-1.5 text-green-400" />
                            {ts.start_time?.slice(0, 5)} - {ts.end_time?.slice(0, 5)}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5 font-mono">
                            {Math.floor((ts.duration_minutes || 0) / 60)}h {(ts.duration_minutes || 0) % 60}m
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleEditClick(ts)}
                            className="h-8 w-8 text-gray-400 hover:text-white hover:bg-gray-700"
                          >
                            <Edit className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default TimesheetsList;
