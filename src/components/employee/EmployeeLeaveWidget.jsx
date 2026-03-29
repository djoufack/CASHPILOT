import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, PlusCircle, Sun, Umbrella, Heart, Briefcase, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useCompanyScope } from '@/hooks/useCompanyScope';

const LEAVE_ICONS = {
  default: Calendar,
  paid: Sun,
  sick: Heart,
  unpaid: Umbrella,
  remote: Briefcase,
};

const getLeaveIcon = (name) => {
  const lower = (name || '').toLowerCase();
  if (lower.includes('maladie') || lower.includes('sick')) return LEAVE_ICONS.sick;
  if (lower.includes('sans solde') || lower.includes('unpaid')) return LEAVE_ICONS.unpaid;
  if (lower.includes('teletravail') || lower.includes('remote')) return LEAVE_ICONS.remote;
  if (lower.includes('pay') || lower.includes('conge')) return LEAVE_ICONS.paid;
  return LEAVE_ICONS.default;
};

const BalanceCard = ({ leave }) => {
  const { t } = useTranslation();
  const Icon = getLeaveIcon(leave.leave_type_name);
  const remaining = Number(leave.days_remaining) || 0;
  const total = Number(leave.total_allowance) || 0;
  const taken = Number(leave.days_taken) || 0;
  const pct = total > 0 ? Math.max(0, Math.min(100, (remaining / total) * 100)) : 0;

  const barColor = pct > 50 ? 'bg-emerald-500' : pct > 20 ? 'bg-yellow-500' : 'bg-red-500';

  return (
    <div className="bg-[#141c33]/60 rounded-lg p-4 border border-white/5 hover:border-white/10 transition-colors">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-blue-400" />
        <span className="text-sm font-medium text-white truncate">{leave.leave_type_name}</span>
      </div>
      <div className="flex items-end justify-between mb-2">
        <div>
          <span className="text-2xl font-bold text-white">{remaining}</span>
          <span className="text-xs text-gray-400 ml-1">
            / {total} {t('employee.leave.days', 'jours')}
          </span>
        </div>
        <span className="text-xs text-gray-500">
          {taken} {t('employee.leave.taken', 'pris')}
        </span>
      </div>
      <div className="w-full bg-white/5 rounded-full h-1.5">
        <div className={`h-1.5 rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
};

const LeaveRequestForm = ({ leaveTypes, onSubmit, onClose, submitting }) => {
  const { t } = useTranslation();
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
    const _diff = (end - start) / (1000 * 60 * 60 * 24) + 1;
    // Exclude weekends (rough estimate)
    let days = 0;
    const current = new Date(start);
    while (current <= end) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) days++;
      current.setDate(current.getDate() + 1);
    }
    return days;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const totalDays = computeTotalDays();
    if (!form.leaveTypeId || totalDays <= 0) return;
    onSubmit({
      leaveTypeId: form.leaveTypeId,
      startDate: form.startDate,
      endDate: form.endDate,
      totalDays,
      reason: form.reason,
    });
  };

  const totalDays = computeTotalDays();

  return (
    <form onSubmit={handleSubmit} className="bg-[#141c33]/80 rounded-lg p-4 border border-blue-500/20 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-white">{t('employee.leave.newRequest', 'Nouvelle demande')}</h4>
        <button type="button" onClick={onClose} className="text-gray-400 hover:text-white">
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
          {leaveTypes.map((lt) => (
            <option key={lt.leave_type_id} value={lt.leave_type_id}>
              {lt.leave_type_name} ({lt.days_remaining} {t('employee.leave.remaining', 'restants')})
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
        <label className="block text-xs text-gray-400 mb-1">{t('employee.leave.reason', 'Motif (optionnel)')}</label>
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
        {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
        {t('employee.leave.submit', 'Soumettre la demande')}
      </Button>
    </form>
  );
};

const MiniCalendar = ({ events }) => {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  const firstDay = new Date(currentYear, currentMonth, 1).getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1; // Monday=0

  const eventDates = new Set(
    (events || []).filter((e) => e.event_type === 'leave_request').map((e) => e.event_date?.substring(0, 10))
  );

  const days = [];
  for (let i = 0; i < adjustedFirstDay; i++) {
    days.push(<div key={`empty-${i}`} />);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const isToday = d === today.getDate();
    const hasEvent = eventDates.has(dateStr);

    days.push(
      <div
        key={d}
        className={`
          w-7 h-7 flex items-center justify-center rounded-md text-xs
          ${isToday ? 'bg-blue-600 text-white font-bold' : 'text-gray-400'}
          ${hasEvent && !isToday ? 'bg-emerald-500/20 text-emerald-300 font-semibold' : ''}
        `}
      >
        {d}
      </div>
    );
  }

  const dayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

  return (
    <div className="mt-4">
      <div className="grid grid-cols-7 gap-1 mb-1">
        {dayLabels.map((label, i) => (
          <div key={i} className="w-7 h-5 flex items-center justify-center text-[10px] text-gray-500 font-medium">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">{days}</div>
    </div>
  );
};

const EmployeeLeaveWidget = ({ leaveBalance, upcomingEvents, onSubmitLeave }) => {
  const { t } = useTranslation();
  const { activeCompanyId } = useCompanyScope();
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [leaveTypes, setLeaveTypes] = useState([]);

  // Fetch leave types from DB for the form dropdown
  useEffect(() => {
    if (!supabase || !activeCompanyId) return;

    const fetchLeaveTypes = async () => {
      const { data } = await supabase
        .from('hr_leave_types')
        .select('id, name, is_paid')
        .eq('company_id', activeCompanyId)
        .order('name');

      if (data) {
        // Merge with balance data
        const merged = data.map((lt) => {
          const balance = (leaveBalance || []).find((b) => b.leave_type_id === lt.id);
          return {
            leave_type_id: lt.id,
            leave_type_name: lt.name,
            is_paid: lt.is_paid,
            days_remaining: balance?.days_remaining ?? 0,
            total_allowance: balance?.total_allowance ?? 0,
            days_taken: balance?.days_taken ?? 0,
          };
        });
        setLeaveTypes(merged);
      }
    };

    fetchLeaveTypes();
  }, [activeCompanyId, leaveBalance]);

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    try {
      await onSubmitLeave(payload);
      setShowForm(false);
    } catch {
      // Error already toasted in hook
    } finally {
      setSubmitting(false);
    }
  };

  const balanceItems = leaveBalance && leaveBalance.length > 0 ? leaveBalance : leaveTypes;

  return (
    <div className="bg-[#0f1528]/80 backdrop-blur-xl rounded-xl border border-white/10 p-5">
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

      {/* Leave balances */}
      {balanceItems.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {balanceItems.map((leave) => (
            <BalanceCard key={leave.leave_type_id} leave={leave} />
          ))}
        </div>
      ) : (
        <p className="text-sm text-gray-400 text-center py-4">
          {t('employee.leave.noBalance', 'Aucun type de conge configure.')}
        </p>
      )}

      {/* Request form */}
      {showForm && (
        <LeaveRequestForm
          leaveTypes={leaveTypes.length > 0 ? leaveTypes : balanceItems}
          onSubmit={handleSubmit}
          onClose={() => setShowForm(false)}
          submitting={submitting}
        />
      )}

      {/* Mini calendar */}
      <MiniCalendar events={upcomingEvents} />
    </div>
  );
};

export default EmployeeLeaveWidget;
