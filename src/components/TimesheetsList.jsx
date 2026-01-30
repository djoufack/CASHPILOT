
import React, { useState } from "react";
import { format, parseISO, isValid } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { motion, AnimatePresence } from 'framer-motion';
import { Edit, Trash2, Clock, CalendarDays, Briefcase, User } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import TimesheetEditModal from './TimesheetEditModal';

const TimesheetsList = ({ timesheets, loading, onEdit, onDelete }) => {
  const { t } = useTranslation();
  const [selectedTimesheet, setSelectedTimesheet] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);

  const handleEditClick = (timesheet) => {
    setSelectedTimesheet(timesheet);
    setIsEditModalOpen(true);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
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
                <CalendarDays className="w-4 h-4 mr-2 text-blue-400" />
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
                        </div>
                        <p className="text-gray-300 text-sm whitespace-pre-wrap">
                          {ts.notes || <span className="text-gray-600 italic">No description</span>}
                        </p>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="text-right min-w-[100px]">
                          <div className="flex items-center justify-end text-white font-medium">
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
