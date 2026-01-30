
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
    let backgroundColor = '#374151'; // default gray
    const status = event.resource.status;
    
    if (status === 'completed') backgroundColor = '#10b981';
    if (status === 'in_progress') backgroundColor = '#3b82f6';
    if (status === 'on_hold') backgroundColor = '#f59e0b';
    if (status === 'cancelled') backgroundColor = '#ef4444';

    return {
      style: {
        backgroundColor,
        borderRadius: '4px',
        opacity: 0.8,
        color: 'white',
        border: '0px',
        display: 'block'
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
        .rbc-off-range-bg { background: #111827; }
        .rbc-today { background: #1f2937; }
        .rbc-header { border-bottom: 1px solid #374151; padding: 10px; font-weight: 600; color: #e5e7eb; }
        .rbc-month-view, .rbc-time-view, .rbc-agenda-view { border: 1px solid #374151; }
        .rbc-day-bg + .rbc-day-bg { border-left: 1px solid #374151; }
        .rbc-month-row + .rbc-month-row { border-top: 1px solid #374151; }
        .rbc-day-bg { border-left: 1px solid #374151; }
        .rbc-off-range { color: #4b5563; }
        .rbc-toolbar button { color: #e5e7eb; border: 1px solid #374151; }
        .rbc-toolbar button:hover { background: #374151; }
        .rbc-toolbar button.rbc-active { background: #3b82f6; border-color: #3b82f6; }
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
