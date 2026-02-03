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

/**
 * Generic Calendar View for any CRUD page
 * @param {Array} events - Array of { id, title, date, status, color, resource }
 * @param {Function} onSelectDate - Callback when clicking empty date slot
 * @param {Function} onSelectEvent - Callback when clicking an event
 * @param {Object} statusColors - Map of status to { bg, border, textColor } colors
 * @param {Array} legend - Array of { label, color } for legend display
 */
const GenericCalendarView = ({
  events = [],
  onSelectDate,
  onSelectEvent,
  statusColors = {},
  legend = [],
  defaultColor = '#f97316',
}) => {
  const { t } = useTranslation();

  const calendarEvents = events.map(e => ({
    id: e.id,
    title: e.title,
    start: new Date(e.date),
    end: new Date(e.date),
    allDay: true,
    resource: e.resource || e,
  }));

  const eventStyleGetter = (event) => {
    const resource = event.resource;
    const status = resource.status || resource.payment_status || '';
    const colorSet = statusColors[status];

    return {
      style: {
        backgroundColor: colorSet?.bg || defaultColor,
        borderRadius: '6px',
        opacity: status === 'paid' || status === 'cancelled' ? 0.5 : 0.9,
        color: colorSet?.text || '#fff',
        border: `1px solid ${colorSet?.border || defaultColor}`,
        display: 'block',
        fontWeight: 500,
        fontSize: '0.75rem',
        padding: '1px 4px',
      },
    };
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-[400px] md:h-[550px] lg:h-[650px] bg-gray-900 border border-gray-800 rounded-xl p-2 md:p-4"
    >
      <style>{`
        .gcv .rbc-calendar { color: #9ca3af; }
        .gcv .rbc-off-range-bg { background: #0a0a0f; }
        .gcv .rbc-today { background: rgba(245, 158, 11, 0.1); }
        .gcv .rbc-header { border-bottom: 1px solid #1f2937; padding: 10px; font-weight: 600; color: #e5e7eb; background: #111827; }
        .gcv .rbc-month-view, .gcv .rbc-time-view, .gcv .rbc-agenda-view { border: 1px solid #1f2937; border-radius: 8px; overflow: hidden; }
        .gcv .rbc-day-bg + .rbc-day-bg { border-left: 1px solid #1f2937; }
        .gcv .rbc-month-row + .rbc-month-row { border-top: 1px solid #1f2937; }
        .gcv .rbc-day-bg { border-left: 1px solid #1f2937; }
        .gcv .rbc-off-range { color: #374151; }
        .gcv .rbc-toolbar { margin-bottom: 16px; }
        .gcv .rbc-toolbar button { color: #e5e7eb; border: 1px solid #374151; background: #111827; border-radius: 8px; padding: 6px 16px; font-weight: 500; transition: all 0.2s; }
        .gcv .rbc-toolbar button:hover { background: #1f2937; border-color: #F59E0B; color: #F59E0B; }
        .gcv .rbc-toolbar button.rbc-active { background: #F59E0B; border-color: #F59E0B; color: #000; font-weight: 600; }
        .gcv .rbc-toolbar .rbc-toolbar-label { color: #fff; font-weight: 700; font-size: 1.25rem; }
        .gcv .rbc-show-more { color: #F59E0B; font-weight: 500; }
        .gcv .rbc-date-cell { color: #9ca3af; padding: 4px 8px; }
        .gcv .rbc-date-cell.rbc-now { color: #F59E0B; font-weight: 700; }
        .gcv .rbc-event { cursor: pointer; }
        .gcv .rbc-agenda-view table { color: #e5e7eb; }
        .gcv .rbc-agenda-view table thead th { border-bottom: 1px solid #374151; }
        .gcv .rbc-agenda-view table tbody tr { border-bottom: 1px solid #1f2937; }
        @media (max-width: 767px) {
          .gcv .rbc-toolbar { flex-wrap: wrap; gap: 8px; justify-content: center; }
          .gcv .rbc-toolbar .rbc-toolbar-label { width: 100%; text-align: center; font-size: 1rem; }
          .gcv .rbc-toolbar button { padding: 4px 10px; font-size: 0.75rem; }
          .gcv .rbc-header { padding: 6px 2px; font-size: 0.75rem; }
        }
      `}</style>

      {/* Legend */}
      {legend.length > 0 && (
        <div className="flex flex-wrap gap-4 mb-3 px-2">
          {legend.map((item, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-gray-400">{item.label}</span>
            </div>
          ))}
        </div>
      )}

      <div className="gcv" style={{ height: legend.length > 0 ? 'calc(100% - 40px)' : '100%' }}>
        <Calendar
          localizer={localizer}
          events={calendarEvents}
          startAccessor="start"
          endAccessor="end"
          style={{ height: '100%' }}
          eventPropGetter={eventStyleGetter}
          onSelectEvent={(event) => onSelectEvent && onSelectEvent(event.resource)}
          onSelectSlot={(slotInfo) => onSelectDate && onSelectDate(slotInfo.start)}
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

export default GenericCalendarView;
