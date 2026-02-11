import React from 'react';
import { useTranslation } from 'react-i18next';
import GenericAgendaView from './GenericAgendaView';

const STATUS_COLORS = {
  draft: 'bg-gray-500/20 text-gray-400',
  in_progress: 'bg-blue-500/20 text-blue-400',
  approved: 'bg-green-500/20 text-green-400',
  invoiced: 'bg-purple-500/20 text-purple-400',
};

const TimesheetAgendaView = ({ timesheets = [], onEdit, onDelete }) => {
  const { t } = useTranslation();

  const formatDuration = (minutes) => {
    if (!minutes) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const renderBadge = (item) => {
    const ts = item._original;
    return (
      <div className="flex flex-col items-end gap-1">
        <span className={`text-xs px-2 py-0.5 rounded-full ${item.statusColor || 'bg-gray-500/20 text-gray-400'}`}>
          {item.statusLabel || item.status}
        </span>
        {ts?.invoice_id && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-900/30 text-purple-300 border border-purple-800">
            {t('timesheets.invoiced')}
          </span>
        )}
        {ts?.billable === false && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/20 text-red-400 border border-red-800">
            {t('timesheets.notBillable')}
          </span>
        )}
      </div>
    );
  };

  const items = timesheets.map((ts) => ({
    id: ts.id,
    title: ts.project?.name || ts.client?.company_name || t('timesheets.noClient'),
    subtitle: `${ts.start_time?.slice(0, 5) || '??:??'} - ${ts.end_time?.slice(0, 5) || '??:??'}`,
    date: ts.date,
    status: ts.status || 'draft',
    statusLabel: t(`timesheets.status.${ts.status || 'draft'}`),
    statusColor: STATUS_COLORS[ts.status || 'draft'],
    amount: formatDuration(ts.duration_minutes),
    payment_status: ts.invoice_id ? 'invoiced' : undefined,
    _original: ts,
  }));

  const handleEdit = (item) => {
    if (onEdit && item._original) {
      onEdit(item._original);
    }
  };

  const handleDelete = (item) => {
    if (onDelete && item._original) {
      onDelete(item._original.id);
    }
  };

  return (
    <GenericAgendaView
      items={items}
      onEdit={handleEdit}
      onDelete={handleDelete}
      dateField="date"
      paidStatuses={['approved', 'invoiced']}
      renderBadge={renderBadge}
    />
  );
};

export default TimesheetAgendaView;
