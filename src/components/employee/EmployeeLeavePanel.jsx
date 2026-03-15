import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, PlusCircle, Clock, CheckCircle, XCircle, Send, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

const STATUS_COLORS = {
  draft: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  submitted: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  validated: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const STATUS_ICONS = {
  draft: Clock,
  submitted: Send,
  approved: CheckCircle,
  validated: CheckCircle,
  rejected: XCircle,
};

const LeaveBalanceBar = ({ label, used, total }) => {
  const remaining = Math.max(0, total - used);
  const pct = total > 0 ? Math.min(100, (remaining / total) * 100) : 0;
  const barColor = pct > 50 ? 'bg-emerald-500' : pct > 20 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="bg-[#141c33]/60 rounded-lg p-3 border border-white/5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-white truncate">{label}</span>
        <span className="text-xs text-gray-400">
          {remaining}/{total}
        </span>
      </div>
      <div className="w-full bg-white/5 rounded-full h-2">
        <div className={`h-2 rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const EmployeeLeavePanel = ({ leaveRequests, leaveBalance, onCreateRequest, loading }) => {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    leaveTypeId: '',
    startDate: '',
    endDate: '',
    reason: '',
  });

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const computeTotalDays = () => {
    if (!form.startDate || !form.endDate) return 0;
    const start = new Date(form.startDate);
    const end = new Date(form.endDate);
    if (end < start) return 0;
    let days = 0;
    const current = new Date(start);
    while (current <= end) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) days++;
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const totalDays = computeTotalDays();
    if (!form.leaveTypeId || totalDays <= 0 || !onCreateRequest) return;

    setSubmitting(true);
    try {
      await onCreateRequest({
        leaveTypeId: form.leaveTypeId,
        startDate: form.startDate,
        endDate: form.endDate,
        totalDays,
        reason: form.reason,
      });
      setForm({ leaveTypeId: '', startDate: '', endDate: '', reason: '' });
      setShowForm(false);
    } catch {
      // Error handled by hook
    } finally {
      setSubmitting(false);
    }
  };

  const totalDays = computeTotalDays();
  const balanceItems = leaveBalance || [];
  const requests = leaveRequests || [];

  return (
    <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl backdrop-blur-sm p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-blue-400" />
          <h3 className="text-sm font-semibold text-white">{t('employee.leave.title', 'Mes conges')}</h3>
        </div>
        {!showForm && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowForm(true)}
            className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
          >
            <PlusCircle className="w-4 h-4 mr-1" />
            {t('employee.leave.request', 'Demander')}
          </Button>
        )}
      </div>

      {/* Leave balance progress bars */}
      {balanceItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {balanceItems.map((item) => (
            <LeaveBalanceBar
              key={item.leave_type_id}
              label={item.leave_type_name}
              used={Number(item.days_taken) || 0}
              total={Number(item.total_allowance) || 0}
            />
          ))}
        </div>
      )}

      {/* New request form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-[#141c33]/80 rounded-lg p-4 border border-blue-500/20 space-y-4 mb-4"
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white">{t('employee.leave.newRequest', 'Nouvelle demande')}</h4>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">{t('employee.leave.type', 'Type de conge')}</label>
            <select
              value={form.leaveTypeId}
              onChange={handleChange('leaveTypeId')}
              className="w-full bg-[#0a0e1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              required
            >
              <option value="">{t('employee.leave.selectType', 'Selectionner...')}</option>
              {balanceItems.map((lt) => (
                <option key={lt.leave_type_id} value={lt.leave_type_id}>
                  {lt.leave_type_name} ({lt.days_remaining ?? 0} {t('employee.leave.remaining', 'restants')})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('employee.leave.startDate', 'Debut')}</label>
              <input
                type="date"
                value={form.startDate}
                onChange={handleChange('startDate')}
                className="w-full bg-[#0a0e1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                required
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">{t('employee.leave.endDate', 'Fin')}</label>
              <input
                type="date"
                value={form.endDate}
                onChange={handleChange('endDate')}
                min={form.startDate}
                className="w-full bg-[#0a0e1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                required
              />
            </div>
          </div>

          {totalDays > 0 && (
            <div className="text-xs text-blue-300 bg-blue-500/5 rounded-lg px-3 py-2">
              {totalDays} {t('employee.leave.workingDays', 'jour(s) ouvrable(s)')}
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-400 mb-1">
              {t('employee.leave.reason', 'Motif (optionnel)')}
            </label>
            <textarea
              value={form.reason}
              onChange={handleChange('reason')}
              rows={2}
              className="w-full bg-[#0a0e1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
              placeholder={t('employee.leave.reasonPlaceholder', 'Raison de votre demande...')}
            />
          </div>

          <Button
            type="submit"
            disabled={submitting || !form.leaveTypeId || totalDays <= 0}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {t('employee.leave.submit', 'Soumettre la demande')}
          </Button>
        </form>
      )}

      {/* Recent leave requests list */}
      {requests.length > 0 ? (
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          <h4 className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-2">
            {t('employee.leave.recentRequests', 'Demandes recentes')}
          </h4>
          {requests.map((req) => {
            const StatusIcon = STATUS_ICONS[req.status] || Clock;
            return (
              <div
                key={req.id}
                className="flex items-center justify-between bg-[#141c33]/60 rounded-lg p-3 border border-white/5 hover:border-white/10 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <StatusIcon className="w-4 h-4 flex-shrink-0 text-gray-400" />
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">
                      {req.hr_leave_types?.name || t('employee.leave.leaveRequest', 'Conge')}
                    </p>
                    <p className="text-xs text-gray-400">
                      {req.start_date} - {req.end_date} ({req.total_days} {t('employee.leave.days', 'jours')})
                    </p>
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border flex-shrink-0 ${STATUS_COLORS[req.status] || STATUS_COLORS.draft}`}
                >
                  {t(`employee.leave.status.${req.status}`, req.status)}
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        !loading && (
          <div className="text-center py-6">
            <Calendar className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-400">{t('employee.leave.noRequests', 'Aucune demande de conge.')}</p>
          </div>
        )
      )}

      {loading && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
        </div>
      )}
    </div>
  );
};

export default EmployeeLeavePanel;
