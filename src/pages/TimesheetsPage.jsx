
import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { Plus, ListFilter, Calendar as CalendarIcon, Download, FileText, LayoutGrid, CalendarRange, Printer, X } from 'lucide-react';
import { useTimesheets } from '@/hooks/useTimesheets';
import { useCompany } from '@/hooks/useCompany';
import { useCreditsGuard, CREDIT_COSTS } from '@/hooks/useCreditsGuard';
import { useToast } from '@/components/ui/use-toast';
import CreditsGuardModal from '@/components/CreditsGuardModal';
import { exportTimesheetsListPDF, exportTimesheetsListHTML } from '@/services/exportListsPDF';
import TimesheetForm from '@/components/TimesheetForm';
import TimesheetEditModal from '@/components/TimesheetEditModal';
import TimesheetsList from '@/components/TimesheetsList';
import TimesheetKanbanView from '@/components/TimesheetKanbanView';
import TimesheetAgendaView from '@/components/TimesheetAgendaView';
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

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
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedTimesheet, setSelectedTimesheet] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [view, setView] = useState('list'); // Default to list for mobile safety
  const [projectFilter, setProjectFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [resourceFilter, setResourceFilter] = useState('all');

  useEffect(() => {
    fetchTimesheets();
    // Set default view based on screen size
    if (window.innerWidth >= 768) {
      setView('calendar');
    }
  }, [fetchTimesheets]);

  const projectOptions = useMemo(() => {
    const map = new Map();
    (timesheets || []).forEach((timesheet) => {
      if (timesheet?.project_id && timesheet?.project?.name) {
        map.set(timesheet.project_id, timesheet.project.name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [timesheets]);

  const clientOptions = useMemo(() => {
    const map = new Map();
    (timesheets || []).forEach((timesheet) => {
      if (timesheet?.client_id && timesheet?.client?.company_name) {
        map.set(timesheet.client_id, timesheet.client.company_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [timesheets]);

  const resourceOptions = useMemo(() => {
    const map = new Map();
    (timesheets || []).forEach((timesheet) => {
      if (timesheet?.executed_by_member_id && timesheet?.executed_by_member?.name) {
        map.set(timesheet.executed_by_member_id, timesheet.executed_by_member.name);
        return;
      }
      if (timesheet?.user_id) {
        map.set(timesheet.user_id, timesheet.executed_by_member?.name || 'Ressource non assignée');
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [timesheets]);

  const filteredTimesheets = useMemo(() => {
    return (timesheets || []).filter((timesheet) => {
      const matchesProject = projectFilter === 'all' || timesheet.project_id === projectFilter;
      const matchesClient = clientFilter === 'all' || timesheet.client_id === clientFilter;
      const effectiveResourceId = timesheet.executed_by_member_id || timesheet.user_id;
      const matchesResource = resourceFilter === 'all' || effectiveResourceId === resourceFilter;
      return matchesProject && matchesClient && matchesResource;
    });
  }, [timesheets, projectFilter, clientFilter, resourceFilter]);

  const events = filteredTimesheets.map(ts => ({
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

  const handleGenerateInvoice = (selectedTimesheetIds) => {
    // Store selected IDs in sessionStorage for InvoiceGenerator to pick up
    if (selectedTimesheetIds && selectedTimesheetIds.length > 0) {
      sessionStorage.setItem('selectedTimesheetIds', JSON.stringify(selectedTimesheetIds));
      navigate('/app/invoices?tab=generator');
    }
  };

  const getInvoiceCandidateIds = (sourceTimesheets = filteredTimesheets) => {
    return (sourceTimesheets || [])
      .filter((timesheet) => timesheet.billable !== false && !timesheet.invoice_id)
      .map((timesheet) => timesheet.id);
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
        await exportTimesheetsListPDF(filteredTimesheets, company);
      }
    );
  };

  const handleExportHTML = () => {
    guardedAction(
      CREDIT_COSTS.EXPORT_HTML,
      'Timesheets List HTML',
      () => {
        exportTimesheetsListHTML(filteredTimesheets, company);
      }
    );
  };

  const handlePrint = () => {
    const rows = filteredTimesheets || [];
    const totalMinutes = rows.reduce((sum, timesheet) => sum + Number(timesheet.duration_minutes || 0), 0);
    const printWindow = window.open('', '_blank', 'width=1200,height=800');

    if (!printWindow) {
      toast({
        title: 'Impression bloquee',
        description: 'Veuillez autoriser les popups pour imprimer les timesheets filtrees.',
        variant: 'destructive'
      });
      return;
    }

    const body = `
      <html>
        <head>
          <title>Timesheets - Impression</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #111827; }
            h1 { margin: 0 0 8px 0; }
            p { margin: 0 0 16px 0; color: #4b5563; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #e5e7eb; padding: 8px; font-size: 12px; text-align: left; }
            th { background: #f9fafb; font-weight: 700; }
            .amount { text-align: right; }
            .meta { margin-top: 12px; font-size: 13px; color: #374151; }
          </style>
        </head>
        <body>
          <h1>Feuilles de temps</h1>
          <p>${company?.name || 'CashPilot'} - ${new Date().toLocaleString('fr-FR')}</p>
          <div class="meta">Entrees filtrees: ${rows.length}</div>
          <div class="meta">Duree totale: ${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m</div>
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Projet</th>
                <th>Client</th>
                <th>Ressource</th>
                <th>Statut</th>
                <th class="amount">Duree</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map((timesheet) => `
                <tr>
                  <td>${timesheet.date ? new Date(timesheet.date).toLocaleDateString('fr-FR') : '-'}</td>
                  <td>${timesheet.project?.name || '-'}</td>
                  <td>${timesheet.client?.company_name || '-'}</td>
                  <td>${timesheet.executed_by_member?.name || '-'}</td>
                  <td>${timesheet.status || 'draft'}</td>
                  <td class="amount">${Math.floor(Number(timesheet.duration_minutes || 0) / 60)}h ${Number(timesheet.duration_minutes || 0) % 60}m</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `;

    printWindow.document.write(body);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const handleGenerateInvoiceFromFilters = () => {
    const ids = getInvoiceCandidateIds(filteredTimesheets);

    if (ids.length === 0) {
      toast({
        title: 'Aucune entree facturable',
        description: 'Aucune timesheet facturable non deja invoicee pour ce filtre.',
      });
      return;
    }

    handleGenerateInvoice(ids);
  };

  const clearFilters = () => {
    setProjectFilter('all');
    setClientFilter('all');
    setResourceFilter('all');
  };

  const eventPropGetter = (event) => {
    const status = event.resource?.status || 'draft';
    const statusColors = {
      draft: { backgroundColor: 'rgba(107, 114, 128, 0.7)', borderColor: '#4b5563' },
      in_progress: { backgroundColor: 'rgba(59, 130, 246, 0.7)', borderColor: '#2563eb' },
      approved: { backgroundColor: 'rgba(34, 197, 94, 0.7)', borderColor: '#16a34a' },
      invoiced: { backgroundColor: 'rgba(168, 85, 247, 0.7)', borderColor: '#9333ea' },
    };
    return {
      style: {
        ...(statusColors[status] || { backgroundColor: 'rgba(245, 158, 11, 0.7)', borderColor: '#D97706' }),
        color: '#fff',
        fontWeight: 500,
        cursor: 'pointer',
        borderWidth: '2px',
        borderStyle: 'solid',
        borderRadius: '4px',
      }
    };
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
                      onClick={handlePrint}
                      size="sm"
                      variant="outline"
                      className="border-gray-600 hover:bg-gray-700 flex-1 sm:flex-none"
                    >
                      <Printer className="w-4 h-4 mr-1" />
                      <span className="hidden sm:inline">Imprimer</span>
                      <span className="sm:hidden">Print</span>
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
                    onClick={handleGenerateInvoiceFromFilters}
                    variant="outline"
                    className="border-orange-500/50 text-orange-400 hover:bg-orange-500/10 font-semibold w-full sm:w-auto"
                  >
                    <FileText className="mr-2 h-4 w-4" /> Facturer filtre
                  </Button>
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
              <div className="bg-gray-900/70 border border-gray-800 rounded-xl p-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Projet</p>
                    <Select value={projectFilter} onValueChange={setProjectFilter}>
                      <SelectTrigger className="bg-gray-950 border-gray-700 text-gray-100">
                        <SelectValue placeholder="Tous les projets" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les projets</SelectItem>
                        {projectOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Client</p>
                    <Select value={clientFilter} onValueChange={setClientFilter}>
                      <SelectTrigger className="bg-gray-950 border-gray-700 text-gray-100">
                        <SelectValue placeholder="Tous les clients" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tous les clients</SelectItem>
                        {clientOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-400 mb-2">Ressource humaine</p>
                    <Select value={resourceFilter} onValueChange={setResourceFilter}>
                      <SelectTrigger className="bg-gray-950 border-gray-700 text-gray-100">
                        <SelectValue placeholder="Toutes les ressources" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Toutes les ressources</SelectItem>
                        {resourceOptions.map((option) => (
                          <SelectItem key={option.id} value={option.id}>{option.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
                  <p className="text-sm text-gray-400">
                    {filteredTimesheets.length} entree(s) sur {timesheets.length}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-gray-300 hover:text-white"
                    onClick={clearFilters}
                  >
                    <X className="w-4 h-4 mr-2" />
                    Reinitialiser les filtres
                  </Button>
                </div>
              </div>

              {/* Calendar View */}
              {view === 'calendar' && (
                <>
                  <div className="bg-gray-900 p-2 md:p-6 rounded-xl border border-gray-800 shadow-xl h-[500px] md:h-[700px] calendar-dark-theme overflow-x-auto">
                    <style>{`
                      .calendar-dark-theme .rbc-off-range-bg { background-color: #0a0a0f; }
                      .calendar-dark-theme .rbc-calendar { color: #9ca3af; min-width: 600px; }
                      .calendar-dark-theme .rbc-today { background-color: rgba(245, 158, 11, 0.15); }
                      .calendar-dark-theme .rbc-event { cursor: pointer; transition: opacity 0.2s; }
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
                      .calendar-dark-theme .rbc-day-slot .rbc-event { color: #fff; }
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
                        eventPropGetter={eventPropGetter}
                        className="text-gray-200"
                        views={['month', 'week', 'day', 'agenda']}
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-4 mt-4 px-2">
                    <span className="text-xs text-gray-400 font-medium">{t('common.status')}:</span>
                    {[
                      { status: 'draft', color: 'bg-gray-500', label: t('timesheets.status.draft') },
                      { status: 'in_progress', color: 'bg-blue-500', label: t('timesheets.status.in_progress') },
                      { status: 'approved', color: 'bg-green-500', label: t('timesheets.status.approved') },
                      { status: 'invoiced', color: 'bg-purple-500', label: t('timesheets.status.invoiced') },
                    ].map(({ status, color, label }) => (
                      <span key={status} className="flex items-center gap-1.5 text-xs text-gray-300">
                        <span className={`w-3 h-3 rounded-sm ${color}`} />
                        {label}
                      </span>
                    ))}
                  </div>
                  <div className="mt-12">
                    <div className="flex items-center justify-between mb-6">
                      <h2 className="text-xl md:text-2xl font-bold text-gradient">Recent Entries</h2>
                      <Button variant="link" onClick={() => setView('list')} className="text-orange-400">
                        View All
                      </Button>
                    </div>
                    <TimesheetsList timesheets={filteredTimesheets} loading={loading} onGenerateInvoice={handleGenerateInvoice} />
                  </div>
                </>
              )}

              {/* List View */}
              {view === 'list' && (
                <TimesheetsList timesheets={filteredTimesheets} loading={loading} onGenerateInvoice={handleGenerateInvoice} />
              )}

              {/* Kanban View */}
              {view === 'kanban' && (
                <TimesheetKanbanView
                  timesheets={filteredTimesheets}
                  onEdit={handleEditTimesheet}
                  onRefresh={fetchTimesheets}
                />
              )}

              {/* Agenda View */}
              {view === 'agenda' && (
                <TimesheetAgendaView
                  timesheets={filteredTimesheets}
                  onEdit={handleEditTimesheet}
                />
              )}
            </div>
        </div>
    </>
  );
};

export default TimesheetsPage;
