
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
import { Plus, ListFilter, Calendar as CalendarIcon, Download, FileText, LayoutGrid, CalendarRange } from 'lucide-react';
import { useTimesheets } from '@/hooks/useTimesheets';
import { useCompany } from '@/hooks/useCompany';
import { useCreditsGuard, CREDIT_COSTS } from '@/hooks/useCreditsGuard';
import CreditsGuardModal from '@/components/CreditsGuardModal';
import { exportTimesheetsListPDF, exportTimesheetsListHTML } from '@/services/exportListsPDF';
import TimesheetForm from '@/components/TimesheetForm';
import TimesheetEditModal from '@/components/TimesheetEditModal';
import TimesheetsList from '@/components/TimesheetsList';
import TimesheetKanbanView from '@/components/TimesheetKanbanView';
import TimesheetAgendaView from '@/components/TimesheetAgendaView';
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
  const { company } = useCompany();
  const { guardedAction, modalProps } = useCreditsGuard();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTimesheet, setSelectedTimesheet] = useState(null);
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
    setSelectedTimesheet(event.resource);
    setIsEditModalOpen(true);
  };

  const handleEditTimesheet = (timesheet) => {
    setSelectedTimesheet(timesheet);
    setIsEditModalOpen(true);
  };

  const handleEditModalClose = () => {
    setIsEditModalOpen(false);
    setSelectedTimesheet(null);
    fetchTimesheets();
  };

  const handleSuccess = () => {
    setIsAddModalOpen(false);
    fetchTimesheets();
  };

  const handleExportPDF = () => {
    guardedAction(
      CREDIT_COSTS.PDF_REPORT,
      'Timesheets List PDF',
      async () => {
        await exportTimesheetsListPDF(timesheets, company);
      }
    );
  };

  const handleExportHTML = () => {
    guardedAction(
      CREDIT_COSTS.EXPORT_HTML,
      'Timesheets List HTML',
      () => {
        exportTimesheetsListHTML(timesheets, company);
      }
    );
  };

  return (
    <>
      <CreditsGuardModal {...modalProps} />
      <Helmet>
        <title>{t('timesheets.title')} - {t('app.name')}</title>
      </Helmet>

        <div className="container mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                  <h1 className="text-3xl md:text-4xl font-bold text-gradient">
                      {t('timesheets.title')}
                  </h1>
                  <p className="text-gray-500 mt-1 text-sm">Manage your time entries and track billable hours</p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-2 w-full md:w-auto">
                  <Tabs value={view} onValueChange={setView} className="bg-gray-900 rounded-lg p-1 border border-gray-800 w-full sm:w-auto">
                    <TabsList className="bg-transparent border-0 w-full justify-between sm:justify-start">
                      <TabsTrigger value="calendar" className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400 text-gray-400 flex-1 sm:flex-none">
                        <CalendarIcon className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">{t('timesheets.views.calendar')}</span>
                      </TabsTrigger>
                      <TabsTrigger value="list" className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400 text-gray-400 flex-1 sm:flex-none">
                        <ListFilter className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">{t('timesheets.views.list')}</span>
                      </TabsTrigger>
                      <TabsTrigger value="kanban" className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400 text-gray-400 flex-1 sm:flex-none">
                        <LayoutGrid className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">{t('timesheets.views.kanban')}</span>
                      </TabsTrigger>
                      <TabsTrigger value="agenda" className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400 text-gray-400 flex-1 sm:flex-none">
                        <CalendarRange className="w-4 h-4 sm:mr-2" />
                        <span className="hidden sm:inline">{t('timesheets.views.agenda')}</span>
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <div className="flex gap-2 w-full sm:w-auto">
                    <Button
                      onClick={handleExportPDF}
                      size="sm"
                      variant="outline"
                      className="border-gray-600 hover:bg-gray-700 flex-1 sm:flex-none"
                    >
                      <Download className="w-4 h-4 mr-1" />
                      <span className="hidden sm:inline">PDF ({CREDIT_COSTS.PDF_REPORT})</span>
                      <span className="sm:hidden">PDF</span>
                    </Button>
                    <Button
                      onClick={handleExportHTML}
                      size="sm"
                      variant="outline"
                      className="border-gray-600 hover:bg-gray-700 flex-1 sm:flex-none"
                    >
                      <FileText className="w-4 h-4 mr-1" />
                      <span className="hidden sm:inline">HTML ({CREDIT_COSTS.EXPORT_HTML})</span>
                      <span className="sm:hidden">HTML</span>
                    </Button>
                  </div>

                  <Button
                    onClick={() => { setSelectedDate(null); setIsAddModalOpen(true); }}
                    className="bg-orange-500 hover:bg-orange-600 text-white font-semibold w-full sm:w-auto"
                  >
                      <Plus className="mr-2 h-4 w-4" /> New Entry
                  </Button>
                </div>
            </div>

            {/* Edit Modal (shared across all views) */}
            <TimesheetEditModal
              isOpen={isEditModalOpen}
              onClose={handleEditModalClose}
              timesheet={selectedTimesheet}
            />

            {/* Add Modal */}
            <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
              <DialogContent className="w-full sm:max-w-[90%] md:max-w-[600px] bg-gray-900 border-gray-800 text-white p-4 md:p-6 overflow-y-auto max-h-[90vh]">
                <DialogHeader>
                  <DialogTitle className="text-xl md:text-2xl font-bold text-gradient">Add Time Entry</DialogTitle>
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
              {/* Calendar View */}
              {view === 'calendar' && (
                <>
                  <div className="bg-gray-900 p-2 md:p-6 rounded-xl border border-gray-800 shadow-xl h-[500px] md:h-[700px] calendar-dark-theme overflow-x-auto">
                    <style>{`
                      .calendar-dark-theme .rbc-off-range-bg { background-color: #0a0a0f; }
                      .calendar-dark-theme .rbc-calendar { color: #9ca3af; min-width: 600px; }
                      .calendar-dark-theme .rbc-today { background-color: rgba(245, 158, 11, 0.15); }
                      .calendar-dark-theme .rbc-event { background-color: #F59E0B; border-color: #D97706; color: #000; font-weight: 500; cursor: pointer; transition: opacity 0.2s; }
                      .calendar-dark-theme .rbc-event:hover { opacity: 0.85; }
                      .calendar-dark-theme .rbc-header { border-bottom: 1px solid #1f2937; padding: 10px; font-weight: 600; color: #e5e7eb; background: #111827; }
                      .calendar-dark-theme .rbc-month-view, .calendar-dark-theme .rbc-time-view, .calendar-dark-theme .rbc-agenda-view { border: 1px solid #1f2937; border-radius: 8px; overflow: hidden; }
                      .calendar-dark-theme .rbc-day-bg + .rbc-day-bg { border-left: 1px solid #1f2937; }
                      .calendar-dark-theme .rbc-month-row + .rbc-month-row { border-top: 1px solid #1f2937; }
                      .calendar-dark-theme .rbc-day-slot .rbc-time-slot { border-top: 1px solid #1f2937; }
                      .calendar-dark-theme .rbc-time-header-content { border-left: 1px solid #1f2937; }
                      .calendar-dark-theme .rbc-timeslot-group { border-bottom: 1px solid #1f2937; }
                      .calendar-dark-theme .rbc-time-content { border-top: 2px solid #1f2937; }
                      .calendar-dark-theme .rbc-time-gutter .rbc-timeslot-group { border-bottom: 1px solid #1f2937; }
                      .calendar-dark-theme .rbc-day-slot .rbc-events-container { margin-right: 0; }
                      .calendar-dark-theme .rbc-day-slot .rbc-event { border: 1px solid #D97706; background-color: rgba(245, 158, 11, 0.2); color: #fff; }
                      .calendar-dark-theme .rbc-event-label { display: none; }
                      .calendar-dark-theme .rbc-time-view .rbc-header { border-bottom: 1px solid #1f2937; }
                      .calendar-dark-theme .rbc-day-slot .rbc-time-slot { border-top: 1px solid #111827; }
                      .calendar-dark-theme .rbc-toolbar { margin-bottom: 16px; }
                      .calendar-dark-theme .rbc-toolbar button { color: #e5e7eb; border: 1px solid #374151; background: #111827; border-radius: 8px; padding: 6px 16px; font-weight: 500; transition: all 0.2s; }
                      .calendar-dark-theme .rbc-toolbar button:hover { background: #1f2937; border-color: #F59E0B; color: #F59E0B; }
                      .calendar-dark-theme .rbc-toolbar button.rbc-active { background: #F59E0B; border-color: #F59E0B; color: #000; font-weight: 600; }
                      .calendar-dark-theme .rbc-toolbar .rbc-toolbar-label { color: #fff; font-weight: 700; font-size: 1.25rem; }
                      .calendar-dark-theme .rbc-show-more { color: #F59E0B; font-weight: 500; }
                      .calendar-dark-theme .rbc-off-range { color: #374151; }
                      .calendar-dark-theme .rbc-date-cell { color: #9ca3af; padding: 4px 8px; }
                      .calendar-dark-theme .rbc-date-cell.rbc-now { color: #F59E0B; font-weight: 700; }
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
                  <div className="mt-12">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl md:text-2xl font-bold text-gradient">Recent Entries</h2>
                      <Button variant="link" onClick={() => setView('list')} className="text-orange-400">
                        View All
                      </Button>
                    </div>
                    <TimesheetsList timesheets={timesheets} loading={loading} />
                  </div>
                </>
              )}

              {/* List View */}
              {view === 'list' && (
                <TimesheetsList timesheets={timesheets} loading={loading} />
              )}

              {/* Kanban View */}
              {view === 'kanban' && (
                <TimesheetKanbanView
                  timesheets={timesheets}
                  onEdit={handleEditTimesheet}
                  onRefresh={fetchTimesheets}
                />
              )}

              {/* Agenda View */}
              {view === 'agenda' && (
                <TimesheetAgendaView
                  timesheets={timesheets}
                  onEdit={handleEditTimesheet}
                />
              )}
            </div>
        </div>
    </>
  );
};

export default TimesheetsPage;
