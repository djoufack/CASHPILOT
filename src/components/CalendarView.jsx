
import React from 'react';
import { Calendar, dateFnsLocalizer } from 'react-big-calendar';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import startOfWeek from 'date-fns/startOfWeek';
import getDay from 'date-fns/getDay';
import enUS from 'date-fns/locale/en-US';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { motion } from 'framer-motion';

const locales = {
  'en-US': enUS,
};

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek,
  getDay,
  locales,
});

const CalendarView = ({ tasks, onEdit }) => {
  const events = tasks.map(task => ({
    id: task.id,
    title: task.title,
    start: task.due_date ? new Date(task.due_date) : new Date(task.created_at),
    end: task.due_date ? new Date(task.due_date) : new Date(task.created_at),
    allDay: true,
    resource: task
  }));

  const eventStyleGetter = (event) => {
    let backgroundColor = '#374151';
    let borderColor = '#4B5563';
    const status = event.resource.status;

    if (status === 'completed') { backgroundColor = '#10b981'; borderColor = '#059669'; }
    if (status === 'in_progress') { backgroundColor = '#F59E0B'; borderColor = '#D97706'; }
    if (status === 'on_hold') { backgroundColor = '#6B7280'; borderColor = '#4B5563'; }
    if (status === 'cancelled') { backgroundColor = '#ef4444'; borderColor = '#dc2626'; }

    return {
      style: {
        backgroundColor,
        borderRadius: '6px',
        opacity: 0.9,
        color: status === 'in_progress' ? '#000' : '#fff',
        border: `1px solid ${borderColor}`,
        display: 'block',
        fontWeight: 500
      }
    };
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-[600px] bg-gray-900 border border-gray-800 rounded-xl p-4"
    >
      {/* Custom Styles override for Calendar Dark Mode */}
      <style>{`
        .rbc-calendar { color: #9ca3af; }
        .rbc-off-range-bg { background: #0a0a0f; }
        .rbc-today { background: rgba(245, 158, 11, 0.1); }
        .rbc-header { border-bottom: 1px solid #1f2937; padding: 10px; font-weight: 600; color: #e5e7eb; background: #111827; }
        .rbc-month-view, .rbc-time-view, .rbc-agenda-view { border: 1px solid #1f2937; border-radius: 8px; overflow: hidden; }
        .rbc-day-bg + .rbc-day-bg { border-left: 1px solid #1f2937; }
        .rbc-month-row + .rbc-month-row { border-top: 1px solid #1f2937; }
        .rbc-day-bg { border-left: 1px solid #1f2937; }
        .rbc-off-range { color: #374151; }
        .rbc-toolbar { margin-bottom: 16px; }
        .rbc-toolbar button { color: #e5e7eb; border: 1px solid #374151; background: #111827; border-radius: 8px; padding: 6px 16px; font-weight: 500; transition: all 0.2s; }
        .rbc-toolbar button:hover { background: #1f2937; border-color: #F59E0B; color: #F59E0B; }
        .rbc-toolbar button.rbc-active { background: #F59E0B; border-color: #F59E0B; color: #000; font-weight: 600; }
        .rbc-toolbar .rbc-toolbar-label { color: #fff; font-weight: 700; font-size: 1.25rem; }
        .rbc-show-more { color: #F59E0B; font-weight: 500; }
        .rbc-date-cell { color: #9ca3af; padding: 4px 8px; }
        .rbc-date-cell.rbc-now { color: #F59E0B; font-weight: 700; }
      `}</style>
      
      <Calendar
        localizer={localizer}
        events={events}
        startAccessor="start"
        endAccessor="end"
        style={{ height: '100%' }}
        eventPropGetter={eventStyleGetter}
        onSelectEvent={(event) => onEdit(event.resource)}
        views={['month', 'week', 'day']}
      />
    </motion.div>
  );
};

export default CalendarView;
