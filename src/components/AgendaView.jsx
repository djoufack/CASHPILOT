
import React from 'react';
import { format, isToday, isTomorrow, isThisWeek, parseISO, isAfter } from 'date-fns';
import TaskCard from './TaskCard';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';

const AgendaGroup = ({ title, tasks, onEdit, onDelete }) => {
  if (tasks.length === 0) return null;
  return (
    <div className="mb-8">
      <h3 className="text-xl font-bold text-gradient mb-4 pl-2 border-l-4 border-orange-500">{title}</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {tasks.map(task => (
           <TaskCard key={task.id} task={task} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </div>
    </div>
  );
};

const AgendaView = ({ tasks, onEdit, onDelete }) => {
  const { t } = useTranslation();
  // Sort tasks by date
  const sortedTasks = [...tasks].sort((a, b) => {
    const dateA = a.due_date ? new Date(a.due_date) : new Date(8640000000000000); // Far future if no date
    const dateB = b.due_date ? new Date(b.due_date) : new Date(8640000000000000);
    return dateA - dateB;
  });

  const todayTasks = sortedTasks.filter(t => t.due_date && isToday(parseISO(t.due_date)));
  const tomorrowTasks = sortedTasks.filter(t => t.due_date && isTomorrow(parseISO(t.due_date)));
  const thisWeekTasks = sortedTasks.filter(t => 
    t.due_date && isThisWeek(parseISO(t.due_date)) && !isToday(parseISO(t.due_date)) && !isTomorrow(parseISO(t.due_date))
  );
  const laterTasks = sortedTasks.filter(t => 
    !t.due_date || (isAfter(parseISO(t.due_date), new Date()) && !isThisWeek(parseISO(t.due_date)))
  );
  const overdueTasks = sortedTasks.filter(t => 
    t.due_date && isAfter(new Date(), parseISO(t.due_date)) && !isToday(parseISO(t.due_date)) && t.status !== 'completed'
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
      <AgendaGroup title={t('tasks.agenda.overdue')} tasks={overdueTasks} onEdit={onEdit} onDelete={onDelete} />
      <AgendaGroup title={t('tasks.agenda.today')} tasks={todayTasks} onEdit={onEdit} onDelete={onDelete} />
      <AgendaGroup title={t('tasks.agenda.tomorrow')} tasks={tomorrowTasks} onEdit={onEdit} onDelete={onDelete} />
      <AgendaGroup title={t('tasks.agenda.thisWeek')} tasks={thisWeekTasks} onEdit={onEdit} onDelete={onDelete} />
      <AgendaGroup title={t('tasks.agenda.laterNoDate')} tasks={laterTasks} onEdit={onEdit} onDelete={onDelete} />
      
      {tasks.length === 0 && (
         <div className="text-center py-20 text-gray-500">{t('tasks.emptyAgenda')}</div>
      )}
    </motion.div>
  );
};

export default AgendaView;
