import React from 'react';
import { useTranslation } from 'react-i18next';
import GenericKanbanView from './GenericKanbanView';
import { useTimesheets } from '@/hooks/useTimesheets';

const STATUS_COLORS = {
  draft: 'bg-gray-500/20 text-gray-300',
  in_progress: 'bg-blue-500/20 text-blue-300',
  approved: 'bg-green-500/20 text-green-300',
  invoiced: 'bg-purple-500/20 text-purple-300',
};

const TimesheetKanbanView = ({ timesheets = [], onEdit, onRefresh }) => {
  const { t } = useTranslation();
  const { updateTimesheet } = useTimesheets();

  const columns = [
    { id: 'draft', title: t('timesheets.status.draft'), color: STATUS_COLORS.draft },
    { id: 'in_progress', title: t('timesheets.status.in_progress'), color: STATUS_COLORS.in_progress },
    { id: 'approved', title: t('timesheets.status.approved'), color: STATUS_COLORS.approved },
    { id: 'invoiced', title: t('timesheets.status.invoiced'), color: STATUS_COLORS.invoiced },
  ];

  const formatDuration = (minutes) => {
    if (!minutes) return '0h 0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const items = timesheets.map((ts) => ({
    id: ts.id,
    title: `${ts.start_time?.slice(0, 5) || '??:??'} - ${ts.end_time?.slice(0, 5) || '??:??'}`,
    subtitle: ts.project?.name || ts.client?.company_name || t('timesheets.noClient'),
    date: ts.date,
    status: ts.status || 'draft',
    statusLabel: t(`timesheets.status.${ts.status || 'draft'}`),
    statusColor: STATUS_COLORS[ts.status || 'draft'],
    amount: formatDuration(ts.duration_minutes),
    _original: ts,
  }));

  const handleStatusChange = async (itemId, newStatus) => {
    try {
      await updateTimesheet(itemId, { status: newStatus });
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Failed to update timesheet status:', error);
    }
  };

  const handleEdit = (item) => {
    if (onEdit && item._original) {
      onEdit(item._original);
    }
  };

  return (
    <GenericKanbanView
      columns={columns}
      items={items}
      onStatusChange={handleStatusChange}
      onEdit={handleEdit}
      emptyMessage={t('common.kanbanDropHere')}
    />
  );
};

export default TimesheetKanbanView;
