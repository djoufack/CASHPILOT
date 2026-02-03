import React from 'react';
import { isToday, isTomorrow, isThisWeek, parseISO, isBefore, format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { AlertTriangle, Clock, Calendar, Eye, Trash2, Edit } from 'lucide-react';
import { Button } from '@/components/ui/button';

const groupConfig = {
  overdue: { icon: AlertTriangle, color: 'border-red-500 text-red-400' },
  today: { icon: Clock, color: 'border-orange-500 text-orange-400' },
  tomorrow: { icon: Calendar, color: 'border-yellow-500 text-yellow-400' },
  thisWeek: { icon: Calendar, color: 'border-blue-500 text-blue-400' },
  later: { icon: Calendar, color: 'border-gray-500 text-gray-400' },
};

/**
 * Generic Agenda View for any CRUD page
 * @param {Array} items - Array of objects with at least { id, date, title, subtitle, status, statusLabel, statusColor }
 * @param {Function} onEdit - Callback when clicking edit
 * @param {Function} onDelete - Callback when clicking delete
 * @param {Function} onView - Callback when clicking view
 * @param {Function} renderBadge - Optional custom badge renderer
 * @param {string} dateField - The field name for the date (default: 'date')
 * @param {Array} paidStatuses - Statuses that count as "completed" and won't be in overdue (default: ['paid', 'cancelled'])
 */
const GenericAgendaView = ({
  items = [],
  onEdit,
  onDelete,
  onView,
  renderBadge,
  dateField = 'date',
  paidStatuses = ['paid', 'cancelled', 'completed', 'accepted', 'converted'],
}) => {
  const { t } = useTranslation();

  const sorted = [...items].sort((a, b) => {
    const dateA = a[dateField] ? new Date(a[dateField]) : new Date(8640000000000000);
    const dateB = b[dateField] ? new Date(b[dateField]) : new Date(8640000000000000);
    return dateA - dateB;
  });

  const now = new Date();
  const isDone = (item) => paidStatuses.includes(item.status) || paidStatuses.includes(item.payment_status);

  const overdue = sorted.filter(r => r[dateField] && isBefore(parseISO(r[dateField]), now) && !isToday(parseISO(r[dateField])) && !isDone(r));
  const today = sorted.filter(r => r[dateField] && isToday(parseISO(r[dateField])));
  const tomorrow = sorted.filter(r => r[dateField] && isTomorrow(parseISO(r[dateField])));
  const thisWeek = sorted.filter(r => r[dateField] && isThisWeek(parseISO(r[dateField]), { weekStartsOn: 1 }) && !isToday(parseISO(r[dateField])) && !isTomorrow(parseISO(r[dateField])) && !isBefore(parseISO(r[dateField]), now));
  const later = sorted.filter(r => !r[dateField] || (!isBefore(parseISO(r[dateField]), now) && !isThisWeek(parseISO(r[dateField]), { weekStartsOn: 1 })));

  const AgendaGroup = ({ groupKey, title, records }) => {
    if (records.length === 0) return null;
    const { icon: Icon, color } = groupConfig[groupKey];

    return (
      <div className="mb-8">
        <h3 className={`text-lg font-bold mb-4 pl-3 border-l-4 ${color} flex items-center gap-2`}>
          <Icon className="w-5 h-5" />
          {title}
          <span className="text-xs bg-gray-800 px-2 py-0.5 rounded-full text-gray-400 ml-2">{records.length}</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {records.map(item => (
            <AgendaCard key={item.id} item={item} dateField={dateField} onEdit={onEdit} onView={onView} onDelete={onDelete} renderBadge={renderBadge} isDone={isDone} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
      <AgendaGroup groupKey="overdue" title={t('debtManager.agendaOverdue') || 'Overdue'} records={overdue} />
      <AgendaGroup groupKey="today" title={t('debtManager.agendaToday') || 'Today'} records={today} />
      <AgendaGroup groupKey="tomorrow" title={t('debtManager.agendaTomorrow') || 'Tomorrow'} records={tomorrow} />
      <AgendaGroup groupKey="thisWeek" title={t('debtManager.agendaThisWeek') || 'This Week'} records={thisWeek} />
      <AgendaGroup groupKey="later" title={t('debtManager.agendaLater') || 'Later'} records={later} />
      {items.length === 0 && (
        <div className="text-center py-20 text-gray-500">{t('debtManager.noItems') || 'No items found'}</div>
      )}
    </motion.div>
  );
};

const AgendaCard = ({ item, dateField, onEdit, onView, onDelete, renderBadge, isDone }) => {
  const done = isDone(item);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gray-800 rounded-lg border border-gray-700 p-4 hover:bg-gray-750 transition-colors ${done ? 'opacity-60' : ''}`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{item.title}</p>
          {item.subtitle && <p className="text-xs text-gray-500 truncate">{item.subtitle}</p>}
        </div>
        {renderBadge ? renderBadge(item) : (
          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ml-2 ${item.statusColor || 'bg-gray-500/20 text-gray-400'}`}>
            {item.statusLabel || item.status}
          </span>
        )}
      </div>

      {item.amount && (
        <p className="text-sm font-bold text-orange-400 mb-1">{item.amount}</p>
      )}

      {item[dateField] && (
        <p className="text-xs text-gray-500 mb-3">
          <Calendar className="w-3 h-3 inline mr-1" />
          {format(new Date(item[dateField]), 'dd/MM/yyyy')}
        </p>
      )}

      <div className="flex items-center gap-1 pt-2 border-t border-gray-700/50">
        {onEdit && !done && (
          <Button size="sm" variant="ghost" className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10 h-7 px-2 text-xs"
            onClick={() => onEdit(item)}>
            <Edit className="w-3 h-3 mr-1" />Edit
          </Button>
        )}
        {onView && (
          <Button size="sm" variant="ghost" className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 h-7 px-2 text-xs ml-auto"
            onClick={() => onView(item)}>
            <Eye className="w-3 h-3" />
          </Button>
        )}
        {onDelete && (
          <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 px-2 text-xs"
            onClick={() => onDelete(item)}>
            <Trash2 className="w-3 h-3" />
          </Button>
        )}
      </div>
    </motion.div>
  );
};

export default GenericAgendaView;
