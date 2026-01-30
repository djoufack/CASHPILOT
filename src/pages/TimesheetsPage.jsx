
import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useTranslation } from 'react-i18next';
import { Plus, ListFilter, Calendar as CalendarIcon } from 'lucide-react';
import { useTimesheets } from '@/hooks/useTimesheets';
import TimesheetForm from '@/components/TimesheetForm';
import TimesheetsList from '@/components/TimesheetsList';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const locales = {
  'en-US': import('date-fns/locale/en-US'),
  'fr': import('date-fns/locale/fr')
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const TimesheetsPage = () => {
  const { t } = useTranslation();
  const { timesheets, loading, fetchTimesheets } = useTimesheets();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(null);
  const [view, setView] = useState('list'); // Default to list for mobile safety

  useEffect(() => {
    fetchTimesheets();
    // Set default view based on screen size
    if (window.innerWidth >= 768) {
      setView('calendar');
    }
  }, []);

  const events = timesheets.map(ts => ({
    id: ts.id,
    title: `${ts.project?.name || 'Work'} - ${ts.client?.company_name || 'Client'}`,
    start: new Date(`${ts.date}T${ts.start_time}`),
    end: new Date(`${ts.date}T${ts.end_time}`),
    resource: ts
  }));

  const handleSelectSlot = ({ start }) => {
    const dateStr = format(start, 'yyyy-MM-dd');
    setSelectedDate(dateStr);
    setIsAddModalOpen(true);
  };

  const handleSelectEvent = (event) => {
    // Logic for editing event could go here
  };

  const handleSuccess = () => {
    setIsAddModalOpen(false);
    fetchTimesheets();
  };

  return (
    <>
      <Helmet>
        <title>{t('timesheets.title')} - {t('app.name')}</title>
      </Helmet>
      
        <div className="container mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-yellow-400 via-green-400 to-purple-400 bg-clip-text text-transparent">
                      {t('timesheets.title')}
                  </h1>
                  <p className="text-gray-400 mt-2 text-sm md:text-base">Manage your time entries and track billable hours</p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                  <Tabs value={view} onValueChange={setView} className="bg-gray-900 rounded-lg p-1 border border-gray-800 w-full sm:w-auto">
                    <TabsList className="bg-transparent border-0 w-full justify-between sm:justify-start">
                      {/* Hide Calendar view trigger on extremely small screens if unusable, but we'll leave it responsive */}
                      <TabsTrigger value="calendar" className="data-[state=active]:bg-gray-800 data-[state=active]:text-white text-gray-400 flex-1 sm:flex-none">
                        <CalendarIcon className="w-4 h-4 mr-2" />
                        <span className="hidden sm:inline">Calendar</span>
                      </TabsTrigger>
                      <TabsTrigger value="list" className="data-[state=active]:bg-gray-800 data-[state=active]:text-white text-gray-400 flex-1 sm:flex-none">
                        <ListFilter className="w-4 h-4 mr-2" />
                        <span className="hidden sm:inline">List View</span>
                        <span className="sm:hidden">List</span>
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <Button 
                    onClick={() => { setSelectedDate(null); setIsAddModalOpen(true); }}
                    className="bg-gradient-to-r from-yellow-500 to-green-500 hover:from-yellow-600 hover:to-green-600 text-black font-semibold w-full sm:w-auto"
                  >
                      <Plus className="mr-2 h-4 w-4" /> New Entry
                  </Button>
                </div>
            </div>

            {/* Add Modal */}
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
              <DialogContent className="w-full sm:max-w-[90%] md:max-w-[600px] bg-gray-900 border-gray-800 text-white p-4 md:p-6 overflow-y-auto max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle className="text-xl md:text-2xl font-bold text-white">Add Time Entry</DialogTitle>
                </DialogHeader>
                <div className="mt-4">
                  <TimesheetForm 
                    onSuccess={handleSuccess} 
                    onCancel={() => setIsAddModalOpen(false)}
                    defaultDate={selectedDate}
                  />
                </div>
              </DialogContent>
            </Dialog>

            <div className="space-y-8">
              {view === 'calendar' ? (
                <div className="bg-gray-900 p-2 md:p-6 rounded-xl border border-gray-800 shadow-xl h-[500px] md:h-[700px] calendar-dark-theme overflow-x-auto">
                  <style>{`
                    .calendar-dark-theme .rbc-off-range-bg { background-color: #111827; }
                    .calendar-dark-theme .rbc-calendar { color: #9ca3af; min-width: 600px; } /* Force width for scroll on mobile */
                    .calendar-dark-theme .rbc-today { background-color: rgba(59, 130, 246, 0.1); }
                    .calendar-dark-theme .rbc-event { background-color: #3b82f6; border-color: #2563eb; }
                    .calendar-dark-theme .rbc-header { border-bottom: 1px solid #374151; padding: 10px; font-weight: 600; color: #e5e7eb; }
                    .calendar-dark-theme .rbc-month-view, .calendar-dark-theme .rbc-time-view, .calendar-dark-theme .rbc-agenda-view { border: 1px solid #374151; }
                    .calendar-dark-theme .rbc-day-bg + .rbc-day-bg { border-left: 1px solid #374151; }
                    .calendar-dark-theme .rbc-month-row + .rbc-month-row { border-top: 1px solid #374151; }
                    .calendar-dark-theme .rbc-day-slot .rbc-time-slot { border-top: 1px solid #374151; }
                    .calendar-dark-theme .rbc-time-header-content { border-left: 1px solid #374151; }
                    .calendar-dark-theme .rbc-timeslot-group { border-bottom: 1px solid #374151; }
                    .calendar-dark-theme .rbc-time-content { border-top: 2px solid #374151; }
                    .calendar-dark-theme .rbc-time-gutter .rbc-timeslot-group { border-bottom: 1px solid #374151; }
                    .calendar-dark-theme .rbc-day-slot .rbc-events-container { margin-right: 0; }
                    .calendar-dark-theme .rbc-day-slot .rbc-event { border: 1px solid #2563eb; background-color: rgba(37, 99, 235, 0.2); color: #fff; }
                    .calendar-dark-theme .rbc-event-label { display: none; }
                    .calendar-dark-theme .rbc-time-view .rbc-header { border-bottom: 1px solid #374151; }
                    .calendar-dark-theme .rbc-day-slot .rbc-time-slot { border-top: 1px solid #1f2937; }
                  `}</style>
                  <Calendar
                      localizer={localizer}
                      events={events}
                      startAccessor="start"
                      endAccessor="end"
                      style={{ height: '100%' }}
                      selectable
                      onSelectSlot={handleSelectSlot}
                      onSelectEvent={handleSelectEvent}
                      className="text-gray-200"
                      views={['month', 'week', 'day', 'agenda']}
                  />
                </div>
              ) : null}

              <div className={view === 'calendar' ? "mt-12" : ""}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl md:text-2xl font-bold text-white">
                    {view === 'calendar' ? 'Recent Entries' : 'All Entries'}
                  </h2>
                  {view === 'calendar' && (
                    <Button variant="link" onClick={() => setView('list')} className="text-blue-400">
                      View All
                    </Button>
                  )}
                </div>
                <TimesheetsList timesheets={timesheets} loading={loading} />
              </div>
            </div>
        </div>
    </>
  );
};

export default TimesheetsPage;
