import React from 'react';
import { format, isToday, isTomorrow, isThisWeek, parseISO, isBefore } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  ArrowDownCircle, ArrowUpCircle, DollarSign, Eye, Trash2,
  AlertTriangle, Clock, Calendar, CheckCircle2
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const statusColors = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  partial: 'bg-blue-500/20 text-blue-400',
  paid: 'bg-green-500/20 text-green-400',
  overdue: 'bg-red-500/20 text-red-400',
  cancelled: 'bg-gray-500/20 text-gray-400',
};

const groupIcons = {
  overdue: AlertTriangle,
  today: Clock,
  tomorrow: Calendar,
  thisWeek: Calendar,
  later: Calendar,
};

const groupColors = {
  overdue: 'border-red-500 text-red-400',
  today: 'border-orange-500 text-orange-400',
  tomorrow: 'border-yellow-500 text-yellow-400',
  thisWeek: 'border-blue-500 text-blue-400',
  later: 'border-gray-500 text-gray-400',
};

const DebtAgendaView = ({ receivables = [], payables = [], onPay, onView, onDelete }) => {
  const { t } = useTranslation();

  // Combine all records with type
  const allRecords = [
    ...receivables.map(r => ({ ...r, type: 'receivable', personName: r.debtor_name, dateKey: r.due_date || r.date_lent })),
    ...payables.map(p => ({ ...p, type: 'payable', personName: p.creditor_name, dateKey: p.due_date || p.date_borrowed })),
  ].sort((a, b) => {
    const dateA = a.dateKey ? new Date(a.dateKey) : new Date(8640000000000000);
    const dateB = b.dateKey ? new Date(b.dateKey) : new Date(8640000000000000);
    return dateA - dateB;
  });

  const now = new Date();
  const overdue = allRecords.filter(r => r.dateKey && isBefore(parseISO(r.dateKey), now) && !isToday(parseISO(r.dateKey)) && r.status !== 'paid' && r.status !== 'cancelled');
  const today = allRecords.filter(r => r.dateKey && isToday(parseISO(r.dateKey)));
  const tomorrow = allRecords.filter(r => r.dateKey && isTomorrow(parseISO(r.dateKey)));
  const thisWeek = allRecords.filter(r => r.dateKey && isThisWeek(parseISO(r.dateKey), { weekStartsOn: 1 }) && !isToday(parseISO(r.dateKey)) && !isTomorrow(parseISO(r.dateKey)) && !isBefore(parseISO(r.dateKey), now));
  const later = allRecords.filter(r => !r.dateKey || (!isBefore(parseISO(r.dateKey), now) && !isThisWeek(parseISO(r.dateKey), { weekStartsOn: 1 })));

  const formatAmount = (amount, currency = 'EUR') => {
    const symbols = { EUR: '\u20ac', USD: '$', GBP: '\u00a3', XAF: 'FCFA', XOF: 'FCFA' };
    return `${parseFloat(amount || 0).toFixed(2)} ${symbols[currency] || currency}`;
  };

  const AgendaGroup = ({ groupKey, title, records }) => {
    if (records.length === 0) return null;
    const Icon = groupIcons[groupKey];
    const colorClass = groupColors[groupKey];

    return (
      <div className="mb-8">
        <h3 className={`text-lg font-bold mb-4 pl-3 border-l-4 ${colorClass} flex items-center gap-2`}>
          <Icon className="w-5 h-5" />
          {title}
          <span className="text-xs bg-gray-800 px-2 py-0.5 rounded-full text-gray-400 ml-2">{records.length}</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {records.map(record => (
            <DebtCard key={`${record.type}-${record.id}`} record={record} onPay={onPay} onView={onView} onDelete={onDelete} formatAmount={formatAmount} t={t} />
          ))}
        </div>
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
      <AgendaGroup groupKey="overdue" title={t('debtManager.agendaOverdue')} records={overdue} />
      <AgendaGroup groupKey="today" title={t('debtManager.agendaToday')} records={today} />
      <AgendaGroup groupKey="tomorrow" title={t('debtManager.agendaTomorrow')} records={tomorrow} />
      <AgendaGroup groupKey="thisWeek" title={t('debtManager.agendaThisWeek')} records={thisWeek} />
      <AgendaGroup groupKey="later" title={t('debtManager.agendaLater')} records={later} />

      {allRecords.length === 0 && (
        <div className="text-center py-20 text-gray-500">{t('debtManager.noItems')}</div>
      )}
    </motion.div>
  );
};

const DebtCard = ({ record, onPay, onView, onDelete, formatAmount, t }) => {
  const isReceivable = record.type === 'receivable';
  const remaining = parseFloat(record.amount) - parseFloat(record.amount_paid);
  const progress = record.amount > 0 ? (parseFloat(record.amount_paid) / parseFloat(record.amount)) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-gray-800 rounded-lg border p-4 hover:bg-gray-750 transition-colors ${
        isReceivable ? 'border-green-500/30' : 'border-red-500/30'
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          {isReceivable ? (
            <ArrowDownCircle className="w-4 h-4 text-green-400 shrink-0" />
          ) : (
            <ArrowUpCircle className="w-4 h-4 text-red-400 shrink-0" />
          )}
          <div>
            <p className="text-sm font-medium text-white truncate max-w-[160px]">{record.personName}</p>
            {record.description && <p className="text-xs text-gray-500 truncate max-w-[160px]">{record.description}</p>}
          </div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${statusColors[record.status]}`}>
          {t(`debtManager.status.${record.status}`)}
        </span>
      </div>

      {/* Amount + Progress */}
      <div className="mb-3">
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-400">{formatAmount(record.amount_paid, record.currency)}</span>
          <span className={`font-medium ${isReceivable ? 'text-green-400' : 'text-red-400'}`}>{formatAmount(record.amount, record.currency)}</span>
        </div>
        <div className="w-full bg-gray-700 rounded-full h-1.5">
          <div
            className={`h-1.5 rounded-full ${isReceivable ? 'bg-green-500' : 'bg-red-500'}`}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        {remaining > 0 && (
          <p className="text-xs text-orange-400 mt-1">{t('debtManager.remaining')}: {formatAmount(remaining, record.currency)}</p>
        )}
      </div>

      {/* Date */}
      {record.dateKey && (
        <p className="text-xs text-gray-500 mb-3">
          <Calendar className="w-3 h-3 inline mr-1" />
          {format(new Date(record.dateKey), 'dd/MM/yyyy')}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 pt-2 border-t border-gray-700/50">
        {record.status !== 'paid' && record.status !== 'cancelled' && (
          <Button size="sm" variant="ghost" className="text-green-400 hover:text-green-300 hover:bg-green-500/10 h-7 px-2 text-xs"
            onClick={() => onPay && onPay(record.type, record)}>
            <DollarSign className="w-3 h-3 mr-1" />{t('debtManager.recordPayment')}
          </Button>
        )}
        <Button size="sm" variant="ghost" className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 h-7 px-2 text-xs ml-auto"
          onClick={() => onView && onView(record.type, record)}>
          <Eye className="w-3 h-3" />
        </Button>
        <Button size="sm" variant="ghost" className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-7 px-2 text-xs"
          onClick={() => onDelete && onDelete(record.type, record)}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </motion.div>
  );
};

export default DebtAgendaView;
