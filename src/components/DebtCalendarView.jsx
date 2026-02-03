import React from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import enUS from 'date-fns/locale/en-US';
import fr from 'date-fns/locale/fr';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const locales = { 'en-US': enUS, 'fr': fr };

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: (date) => startOfWeek(date, { weekStartsOn: 1 }),
  getDay,
  locales,
});

const DebtCalendarView = ({ receivables = [], payables = [], onSelectDate, onSelectRecord }) => {
  const { t } = useTranslation();

  // Transform receivables into calendar events
  const receivableEvents = receivables.map(r => ({
    id: r.id,
    title: `↓ ${r.debtor_name} — ${parseFloat(r.amount).toFixed(2)}€`,
    start: r.due_date ? new Date(r.due_date) : new Date(r.date_lent),
    end: r.due_date ? new Date(r.due_date) : new Date(r.date_lent),
    allDay: true,
    resource: { ...r, type: 'receivable' },
  }));

  // Transform payables into calendar events
  const payableEvents = payables.map(p => ({
    id: p.id,
    title: `↑ ${p.creditor_name} — ${parseFloat(p.amount).toFixed(2)}€`,
    start: p.due_date ? new Date(p.due_date) : new Date(p.date_borrowed),
    end: p.due_date ? new Date(p.due_date) : new Date(p.date_borrowed),
    allDay: true,
    resource: { ...p, type: 'payable' },
  }));

  const allEvents = [...receivableEvents, ...payableEvents];

  const eventStyleGetter = (event) => {
    const record = event.resource;
    const isOverdue = record.status === 'overdue';
    const isPaid = record.status === 'paid';
    const isReceivable = record.type === 'receivable';

    let backgroundColor, borderColor;

    if (isPaid) {
      backgroundColor = '#6B7280';
      borderColor = '#4B5563';
    } else if (isOverdue) {
      backgroundColor = '#F59E0B';
      borderColor = '#D97706';
    } else if (isReceivable) {
      backgroundColor = '#10b981';
      borderColor = '#059669';
    } else {
      backgroundColor = '#ef4444';
      borderColor = '#dc2626';
    }

    return {
      style: {
        backgroundColor,
        borderRadius: '6px',
        opacity: isPaid ? 0.5 : 0.9,
        color: isOverdue ? '#000' : '#fff',
        border: `1px solid ${borderColor}`,
        display: 'block',
        fontWeight: 500,
        fontSize: '0.75rem',
        padding: '1px 4px',
      },
    };
  };

  const handleSelectSlot = (slotInfo) => {
    if (onSelectDate) {
      onSelectDate(slotInfo.start);
    }
  };

  const handleSelectEvent = (event) => {
    if (onSelectRecord) {
      onSelectRecord(event.resource);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-[400px] md:h-[550px] lg:h-[650px] bg-gray-900 border border-gray-800 rounded-xl p-2 md:p-4"
    >
      {/* Dark Mode CSS */}
      <style>{`
        .debt-calendar .rbc-calendar { color: #9ca3af; }
        .debt-calendar .rbc-off-range-bg { background: #0a0a0f; }
        .debt-calendar .rbc-today { background: rgba(245, 158, 11, 0.1); }
        .debt-calendar .rbc-header { border-bottom: 1px solid #1f2937; padding: 10px; font-weight: 600; color: #e5e7eb; background: #111827; }
        .debt-calendar .rbc-month-view, .debt-calendar .rbc-time-view, .debt-calendar .rbc-agenda-view { border: 1px solid #1f2937; border-radius: 8px; overflow: hidden; }
        .debt-calendar .rbc-day-bg + .rbc-day-bg { border-left: 1px solid #1f2937; }
        .debt-calendar .rbc-month-row + .rbc-month-row { border-top: 1px solid #1f2937; }
        .debt-calendar .rbc-day-bg { border-left: 1px solid #1f2937; }
        .debt-calendar .rbc-off-range { color: #374151; }
        .debt-calendar .rbc-toolbar { margin-bottom: 16px; }
        .debt-calendar .rbc-toolbar button { color: #e5e7eb; border: 1px solid #374151; background: #111827; border-radius: 8px; padding: 6px 16px; font-weight: 500; transition: all 0.2s; }
        .debt-calendar .rbc-toolbar button:hover { background: #1f2937; border-color: #F59E0B; color: #F59E0B; }
        .debt-calendar .rbc-toolbar button.rbc-active { background: #F59E0B; border-color: #F59E0B; color: #000; font-weight: 600; }
        .debt-calendar .rbc-toolbar .rbc-toolbar-label { color: #fff; font-weight: 700; font-size: 1.25rem; }
        .debt-calendar .rbc-show-more { color: #F59E0B; font-weight: 500; }
        .debt-calendar .rbc-date-cell { color: #9ca3af; padding: 4px 8px; }
        .debt-calendar .rbc-date-cell.rbc-now { color: #F59E0B; font-weight: 700; }
        .debt-calendar .rbc-event { cursor: pointer; }
        .debt-calendar .rbc-day-slot .rbc-time-slot { border-top: 1px solid #1f2937; }
        .debt-calendar .rbc-time-content { border-top: 1px solid #1f2937; }
        .debt-calendar .rbc-time-header-content { border-left: 1px solid #1f2937; }
        .debt-calendar .rbc-agenda-view table { color: #e5e7eb; }
        .debt-calendar .rbc-agenda-view table thead th { border-bottom: 1px solid #374151; }
        .debt-calendar .rbc-agenda-view table tbody tr { border-bottom: 1px solid #1f2937; }
        @media (max-width: 767px) {
          .debt-calendar .rbc-toolbar { flex-wrap: wrap; gap: 8px; justify-content: center; }
          .debt-calendar .rbc-toolbar .rbc-toolbar-label { width: 100%; text-align: center; font-size: 1rem; }
          .debt-calendar .rbc-toolbar button { padding: 4px 10px; font-size: 0.75rem; }
          .debt-calendar .rbc-header { padding: 6px 2px; font-size: 0.75rem; }
        }
      `}</style>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-3 px-2">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span className="text-xs text-gray-400">{t('debtManager.receivables')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-500" />
          <span className="text-xs text-gray-400">{t('debtManager.payables')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-yellow-500" />
          <span className="text-xs text-gray-400">{t('debtManager.status.overdue')}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-gray-500 opacity-50" />
          <span className="text-xs text-gray-400">{t('debtManager.status.paid')}</span>
        </div>
      </div>

      <div className="debt-calendar" style={{ height: 'calc(100% - 40px)' }}>
        <Calendar
          localizer={localizer}
          events={allEvents}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          eventPropGetter={eventStyleGetter}
          onSelectEvent={handleSelectEvent}
          onSelectSlot={handleSelectSlot}
          selectable
          views={['month', 'week', 'day']}
          messages={{
            today: t('debtManager.calendarToday') || 'Today',
            previous: '‹',
            next: '›',
            month: t('debtManager.calendarMonth') || 'Month',
            week: t('debtManager.calendarWeek') || 'Week',
            day: t('debtManager.calendarDay') || 'Day',
          }}
          popup
          popupOffset={{ x: 30, y: 20 }}
        />
      </div>
    </motion.div>
  );
};

export default DebtCalendarView;
