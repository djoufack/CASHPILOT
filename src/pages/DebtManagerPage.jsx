import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useReceivables } from '@/hooks/useReceivables';
import { usePayables } from '@/hooks/usePayables';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus, Search, Trash2, ArrowDownCircle, ArrowUpCircle, Wallet,
  AlertTriangle, CheckCircle2, Clock, TrendingUp, TrendingDown,
  Phone, Mail, CreditCard, DollarSign, Calendar, Eye,
  CalendarDays, CalendarClock
} from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import DebtCalendarView from '@/components/DebtCalendarView';
import DebtAgendaView from '@/components/DebtAgendaView';

const statusColors = {
  pending: 'bg-yellow-500/20 text-yellow-400',
  partial: 'bg-blue-500/20 text-blue-400',
  paid: 'bg-green-500/20 text-green-400',
  overdue: 'bg-red-500/20 text-red-400',
  cancelled: 'bg-gray-500/20 text-gray-400',
};

const categoryOptions = ['personal', 'business', 'family', 'friend', 'other'];
const paymentMethods = ['cash', 'bank_transfer', 'mobile_money', 'cheque', 'other'];

const emptyReceivableForm = {
  debtor_name: '', debtor_phone: '', debtor_email: '', description: '',
  amount: '', currency: 'EUR', date_lent: new Date().toISOString().slice(0, 10),
  due_date: '', category: 'personal', notes: '',
};

const emptyPayableForm = {
  creditor_name: '', creditor_phone: '', creditor_email: '', description: '',
  amount: '', currency: 'EUR', date_borrowed: new Date().toISOString().slice(0, 10),
  due_date: '', category: 'personal', notes: '',
};

const DebtManagerPage = () => {
  const { t } = useTranslation();
  const {
    receivables, loading: rLoading, stats: rStats,
    createReceivable, updateReceivable, deleteReceivable,
    addPayment: addReceivablePayment, fetchPayments: fetchReceivablePayments,
  } = useReceivables();
  const {
    payables, loading: pLoading, stats: pStats,
    createPayable, updatePayable, deletePayable,
    addPayment: addPayablePayment, fetchPayments: fetchPayablePayments,
  } = usePayables();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [search, setSearch] = useState('');
  const [showCreateReceivable, setShowCreateReceivable] = useState(false);
  const [showCreatePayable, setShowCreatePayable] = useState(false);
  const [showPayment, setShowPayment] = useState(null);
  const [showPayments, setShowPayments] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [showTypeChooser, setShowTypeChooser] = useState(null); // date for new record from calendar
  const [receivableForm, setReceivableForm] = useState(emptyReceivableForm);
  const [payableForm, setPayableForm] = useState(emptyPayableForm);
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_method: 'cash', notes: '' });

  const netBalance = rStats.totalPending - pStats.totalOwed;

  // Handlers
  const handleCreateReceivable = async () => {
    if (!receivableForm.debtor_name || !receivableForm.amount) return;
    await createReceivable({ ...receivableForm, amount: parseFloat(receivableForm.amount) });
    setReceivableForm(emptyReceivableForm);
    setShowCreateReceivable(false);
  };

  const handleCreatePayable = async () => {
    if (!payableForm.creditor_name || !payableForm.amount) return;
    await createPayable({ ...payableForm, amount: parseFloat(payableForm.amount) });
    setPayableForm(emptyPayableForm);
    setShowCreatePayable(false);
  };

  const handleAddPayment = async () => {
    if (!showPayment || !paymentForm.amount) return;
    const { type, record } = showPayment;
    if (type === 'receivable') {
      await addReceivablePayment(record.id, parseFloat(paymentForm.amount), paymentForm.payment_method, paymentForm.notes);
    } else {
      await addPayablePayment(record.id, parseFloat(paymentForm.amount), paymentForm.payment_method, paymentForm.notes);
    }
    setPaymentForm({ amount: '', payment_method: 'cash', notes: '' });
    setShowPayment(null);
  };

  const handleViewPayments = async (type, record) => {
    const payments = type === 'receivable'
      ? await fetchReceivablePayments(record.id)
      : await fetchPayablePayments(record.id);
    setPaymentHistory(payments);
    setShowPayments({ type, record });
  };

  const filterList = (list, nameField) => {
    if (!search) return list;
    const s = search.toLowerCase();
    return list.filter(item =>
      item[nameField]?.toLowerCase().includes(s) ||
      item.description?.toLowerCase().includes(s) ||
      item.category?.toLowerCase().includes(s)
    );
  };

  const formatAmount = (amount, currency = 'EUR') => {
    const symbols = { EUR: '\u20ac', USD: '$', GBP: '\u00a3', XAF: 'FCFA', XOF: 'FCFA' };
    return `${parseFloat(amount || 0).toFixed(2)} ${symbols[currency] || currency}`;
  };

  // ─── DASHBOARD TAB ─────────────────────────
  const DashboardTab = () => (
    <div className="space-y-6">
      {/* Net Balance */}
      <div className={`p-6 rounded-xl border ${netBalance >= 0 ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'}`}>
        <div className="flex items-center gap-3 mb-2">
          <Wallet className={`w-6 h-6 ${netBalance >= 0 ? 'text-green-400' : 'text-red-400'}`} />
          <span className="text-gray-400 text-sm">{t('debtManager.netBalance')}</span>
        </div>
        <p className={`text-3xl font-bold ${netBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {netBalance >= 0 ? '+' : ''}{formatAmount(netBalance)}
        </p>
        <p className="text-gray-500 text-xs mt-1">{t('debtManager.netBalanceDesc')}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={ArrowDownCircle} color="green" label={t('debtManager.totalReceivable')} value={formatAmount(rStats.totalReceivable)} />
        <StatCard icon={CheckCircle2} color="green" label={t('debtManager.totalCollected')} value={formatAmount(rStats.totalCollected)} />
        <StatCard icon={ArrowUpCircle} color="red" label={t('debtManager.totalPayable')} value={formatAmount(pStats.totalPayable)} />
        <StatCard icon={CreditCard} color="blue" label={t('debtManager.totalRepaid')} value={formatAmount(pStats.totalRepaid)} />
      </div>

      {/* Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-medium text-white">{t('debtManager.pendingReceivables')}</span>
            <span className="ml-auto bg-yellow-500/20 text-yellow-400 text-xs px-2 py-0.5 rounded-full">{rStats.countPending}</span>
          </div>
          {receivables.filter(r => r.status === 'pending' || r.status === 'partial' || r.status === 'overdue').slice(0, 5).map(r => (
            <div key={r.id} className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0">
              <div>
                <span className="text-sm text-white">{r.debtor_name}</span>
                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${statusColors[r.status]}`}>{t(`debtManager.status.${r.status}`)}</span>
              </div>
              <span className="text-sm text-green-400">{formatAmount(parseFloat(r.amount) - parseFloat(r.amount_paid), r.currency)}</span>
            </div>
          ))}
          {rStats.countPending === 0 && <p className="text-gray-500 text-sm">{t('debtManager.noItems')}</p>}
        </div>

        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-medium text-white">{t('debtManager.pendingPayables')}</span>
            <span className="ml-auto bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full">{pStats.countPending}</span>
          </div>
          {payables.filter(p => p.status === 'pending' || p.status === 'partial' || p.status === 'overdue').slice(0, 5).map(p => (
            <div key={p.id} className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0">
              <div>
                <span className="text-sm text-white">{p.creditor_name}</span>
                <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${statusColors[p.status]}`}>{t(`debtManager.status.${p.status}`)}</span>
              </div>
              <span className="text-sm text-red-400">{formatAmount(parseFloat(p.amount) - parseFloat(p.amount_paid), p.currency)}</span>
            </div>
          ))}
          {pStats.countPending === 0 && <p className="text-gray-500 text-sm">{t('debtManager.noItems')}</p>}
        </div>
      </div>

      {/* Overdue alerts */}
      {(rStats.countOverdue > 0 || pStats.countOverdue > 0) && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            <span className="text-red-400 font-medium">{t('debtManager.overdueAlert')}</span>
          </div>
          {rStats.countOverdue > 0 && (
            <p className="text-sm text-gray-300">{rStats.countOverdue} {t('debtManager.overdueReceivables')}</p>
          )}
          {pStats.countOverdue > 0 && (
            <p className="text-sm text-gray-300">{pStats.countOverdue} {t('debtManager.overduePayables')}</p>
          )}
        </div>
      )}
    </div>
  );

  // ─── RECORD ROW ─────────────────────────
  const RecordRow = ({ record, type, nameField, dateField }) => {
    const remaining = parseFloat(record.amount) - parseFloat(record.amount_paid);
    const progress = record.amount > 0 ? (parseFloat(record.amount_paid) / parseFloat(record.amount)) * 100 : 0;

    return (
      <motion.tr
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
      >
        <td className="p-4">
          <div className="font-medium text-white">{record[nameField]}</div>
          {record.description && <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{record.description}</div>}
        </td>
        <td className="p-4">
          <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">{t(`debtManager.categories.${record.category}`) || record.category}</span>
        </td>
        <td className="p-4 text-sm">{record[dateField] ? format(new Date(record[dateField]), 'dd/MM/yyyy') : '-'}</td>
        <td className="p-4 text-sm">{record.due_date ? format(new Date(record.due_date), 'dd/MM/yyyy') : '-'}</td>
        <td className="p-4">
          <div className="text-sm font-medium text-white">{formatAmount(record.amount, record.currency)}</div>
          <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
            <div className={`h-1.5 rounded-full ${type === 'receivable' ? 'bg-green-500' : 'bg-orange-500'}`} style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
          <div className="text-xs text-gray-400 mt-0.5">{formatAmount(record.amount_paid, record.currency)} / {formatAmount(record.amount, record.currency)}</div>
        </td>
        <td className="p-4">
          <span className={`text-xs px-2 py-1 rounded-full ${statusColors[record.status]}`}>
            {t(`debtManager.status.${record.status}`)}
          </span>
        </td>
        <td className="p-4">
          <div className="flex items-center gap-1">
            {record.status !== 'paid' && record.status !== 'cancelled' && (
              <Button
                size="sm"
                variant="ghost"
                className="text-green-400 hover:text-green-300 hover:bg-green-500/10 h-8 px-2"
                onClick={() => { setShowPayment({ type, record }); setPaymentForm({ amount: '', payment_method: 'cash', notes: '' }); }}
              >
                <DollarSign className="w-3.5 h-3.5" />
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 h-8 px-2"
              onClick={() => handleViewPayments(type, record)}
            >
              <Eye className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 px-2"
              onClick={() => type === 'receivable' ? deleteReceivable(record.id) : deletePayable(record.id)}
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </td>
      </motion.tr>
    );
  };

  // ─── TABLE COMPONENT ─────────────────────────
  const RecordTable = ({ data, type, nameField, dateField, loading: isLoading }) => (
    <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-700 text-gray-400 text-xs uppercase">
              <th className="text-left p-4">{type === 'receivable' ? t('debtManager.debtor') : t('debtManager.creditor')}</th>
              <th className="text-left p-4">{t('debtManager.category')}</th>
              <th className="text-left p-4">{t('debtManager.date')}</th>
              <th className="text-left p-4">{t('debtManager.dueDate')}</th>
              <th className="text-left p-4">{t('debtManager.amount')}</th>
              <th className="text-left p-4">{t('debtManager.statusLabel')}</th>
              <th className="text-left p-4">{t('debtManager.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7} className="text-center p-8 text-gray-400">{t('common.loading')}...</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={7} className="text-center p-8 text-gray-400">{t('debtManager.noItems')}</td></tr>
            ) : data.map(record => (
              <RecordRow key={record.id} record={record} type={type} nameField={nameField} dateField={dateField} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ─── CREATE FORM ─────────────────────────
  const CreateForm = ({ form, setForm, onSubmit, type }) => {
    const nameField = type === 'receivable' ? 'debtor_name' : 'creditor_name';
    const phoneField = type === 'receivable' ? 'debtor_phone' : 'creditor_phone';
    const emailField = type === 'receivable' ? 'debtor_email' : 'creditor_email';
    const dateField = type === 'receivable' ? 'date_lent' : 'date_borrowed';

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-gray-300">{type === 'receivable' ? t('debtManager.debtorName') : t('debtManager.creditorName')} *</Label>
            <Input value={form[nameField]} onChange={e => setForm({ ...form, [nameField]: e.target.value })}
              className="bg-gray-700 border-gray-600 text-white" placeholder={type === 'receivable' ? 'Jean Dupont' : 'Banque XYZ'} />
          </div>
          <div>
            <Label className="text-gray-300">{t('debtManager.category')}</Label>
            <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                {categoryOptions.map(c => (
                  <SelectItem key={c} value={c} className="text-white">{t(`debtManager.categories.${c}`)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-gray-300"><Phone className="w-3 h-3 inline mr-1" />{t('debtManager.phone')}</Label>
            <Input value={form[phoneField]} onChange={e => setForm({ ...form, [phoneField]: e.target.value })}
              className="bg-gray-700 border-gray-600 text-white" placeholder="+32 xxx" />
          </div>
          <div>
            <Label className="text-gray-300"><Mail className="w-3 h-3 inline mr-1" />{t('debtManager.email')}</Label>
            <Input type="email" value={form[emailField]} onChange={e => setForm({ ...form, [emailField]: e.target.value })}
              className="bg-gray-700 border-gray-600 text-white" placeholder="email@example.com" />
          </div>
        </div>

        <div>
          <Label className="text-gray-300">{t('debtManager.description')}</Label>
          <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
            className="bg-gray-700 border-gray-600 text-white" placeholder={t('debtManager.descriptionPlaceholder')} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-gray-300">{t('debtManager.amount')} *</Label>
            <Input type="number" step="0.01" min="0" value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })}
              className="bg-gray-700 border-gray-600 text-white" placeholder="0.00" />
          </div>
          <div>
            <Label className="text-gray-300">{t('debtManager.currency')}</Label>
            <Select value={form.currency} onValueChange={v => setForm({ ...form, currency: v })}>
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white"><SelectValue /></SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                {['EUR', 'USD', 'GBP', 'XAF', 'XOF'].map(c => (
                  <SelectItem key={c} value={c} className="text-white">{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-gray-300"><Calendar className="w-3 h-3 inline mr-1" />{type === 'receivable' ? t('debtManager.dateLent') : t('debtManager.dateBorrowed')}</Label>
            <Input type="date" value={form[dateField]} onChange={e => setForm({ ...form, [dateField]: e.target.value })}
              className="bg-gray-700 border-gray-600 text-white" />
          </div>
        </div>

        <div>
          <Label className="text-gray-300"><Calendar className="w-3 h-3 inline mr-1" />{t('debtManager.dueDate')}</Label>
          <Input type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })}
            className="bg-gray-700 border-gray-600 text-white" />
        </div>

        <div>
          <Label className="text-gray-300">{t('debtManager.notes')}</Label>
          <Textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
            className="bg-gray-700 border-gray-600 text-white" rows={2} placeholder={t('debtManager.notesPlaceholder')} />
        </div>

        <Button onClick={onSubmit} disabled={!form[nameField] || !form.amount}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white">
          <Plus className="w-4 h-4 mr-2" />{type === 'receivable' ? t('debtManager.createReceivable') : t('debtManager.createPayable')}
        </Button>
      </div>
    );
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gray-950 text-white space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gradient">{t('debtManager.title')}</h1>
          <p className="text-gray-400 text-sm mt-1">{t('debtManager.subtitle')}</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-gray-900 border-gray-800 w-full justify-start overflow-x-auto flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="dashboard" className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400">
            <Wallet className="w-4 h-4 mr-2" />{t('debtManager.dashboard')}
          </TabsTrigger>
          <TabsTrigger value="receivables" className="data-[state=active]:bg-green-500/10 data-[state=active]:text-green-400">
            <ArrowDownCircle className="w-4 h-4 mr-2" />{t('debtManager.receivables')} ({receivables.length})
          </TabsTrigger>
          <TabsTrigger value="payables" className="data-[state=active]:bg-red-500/10 data-[state=active]:text-red-400">
            <ArrowUpCircle className="w-4 h-4 mr-2" />{t('debtManager.payables')} ({payables.length})
          </TabsTrigger>
          <TabsTrigger value="calendar" className="data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-400">
            <CalendarDays className="w-4 h-4 mr-2" />{t('debtManager.calendar')}
          </TabsTrigger>
          <TabsTrigger value="agenda" className="data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-400">
            <CalendarClock className="w-4 h-4 mr-2" />{t('debtManager.agenda')}
          </TabsTrigger>
        </TabsList>

        {/* Dashboard */}
        <TabsContent value="dashboard" className="mt-6">
          <DashboardTab />
        </TabsContent>

        {/* Receivables */}
        <TabsContent value="receivables" className="mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white pl-10" placeholder={t('common.search')} />
            </div>
            <Button onClick={() => { setReceivableForm(emptyReceivableForm); setShowCreateReceivable(true); }}
              className="bg-green-600 hover:bg-green-700 text-white">
              <Plus className="w-4 h-4 mr-2" />{t('debtManager.newReceivable')}
            </Button>
          </div>
          <RecordTable data={filterList(receivables, 'debtor_name')} type="receivable" nameField="debtor_name" dateField="date_lent" loading={rLoading} />
        </TabsContent>

        {/* Payables */}
        <TabsContent value="payables" className="mt-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input value={search} onChange={e => setSearch(e.target.value)}
                className="bg-gray-800 border-gray-700 text-white pl-10" placeholder={t('common.search')} />
            </div>
            <Button onClick={() => { setPayableForm(emptyPayableForm); setShowCreatePayable(true); }}
              className="bg-red-600 hover:bg-red-700 text-white">
              <Plus className="w-4 h-4 mr-2" />{t('debtManager.newPayable')}
            </Button>
          </div>
          <RecordTable data={filterList(payables, 'creditor_name')} type="payable" nameField="creditor_name" dateField="date_borrowed" loading={pLoading} />
        </TabsContent>

        {/* Calendar */}
        <TabsContent value="calendar" className="mt-6">
          <DebtCalendarView
            receivables={receivables}
            payables={payables}
            onSelectDate={(date) => {
              const dateStr = format(date, 'yyyy-MM-dd');
              setShowTypeChooser(dateStr);
            }}
            onSelectRecord={(record) => {
              if (record.status !== 'paid' && record.status !== 'cancelled') {
                setShowPayment({ type: record.type, record });
                setPaymentForm({ amount: '', payment_method: 'cash', notes: '' });
              } else {
                handleViewPayments(record.type, record);
              }
            }}
          />
        </TabsContent>

        {/* Agenda */}
        <TabsContent value="agenda" className="mt-6">
          <DebtAgendaView
            receivables={receivables}
            payables={payables}
            onPay={(type, record) => {
              setShowPayment({ type, record });
              setPaymentForm({ amount: '', payment_method: 'cash', notes: '' });
            }}
            onView={(type, record) => handleViewPayments(type, record)}
            onDelete={(type, record) => type === 'receivable' ? deleteReceivable(record.id) : deletePayable(record.id)}
          />
        </TabsContent>
      </Tabs>

      {/* Type Chooser Dialog (from calendar click) */}
      <Dialog open={!!showTypeChooser} onOpenChange={() => setShowTypeChooser(null)}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-orange-400 flex items-center gap-2">
              <CalendarDays className="w-5 h-5" />{t('debtManager.createOnDate')} {showTypeChooser}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Button
              className="w-full bg-green-600 hover:bg-green-700 text-white justify-start"
              onClick={() => {
                setReceivableForm({ ...emptyReceivableForm, due_date: showTypeChooser });
                setShowCreateReceivable(true);
                setShowTypeChooser(null);
              }}
            >
              <ArrowDownCircle className="w-4 h-4 mr-2" />{t('debtManager.chooseReceivable')}
            </Button>
            <Button
              className="w-full bg-red-600 hover:bg-red-700 text-white justify-start"
              onClick={() => {
                setPayableForm({ ...emptyPayableForm, due_date: showTypeChooser });
                setShowCreatePayable(true);
                setShowTypeChooser(null);
              }}
            >
              <ArrowUpCircle className="w-4 h-4 mr-2" />{t('debtManager.choosePayable')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Receivable Dialog */}
      <Dialog open={showCreateReceivable} onOpenChange={setShowCreateReceivable}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-green-400 flex items-center gap-2">
              <ArrowDownCircle className="w-5 h-5" />{t('debtManager.newReceivable')}
            </DialogTitle>
          </DialogHeader>
          <CreateForm form={receivableForm} setForm={setReceivableForm} onSubmit={handleCreateReceivable} type="receivable" />
        </DialogContent>
      </Dialog>

      {/* Create Payable Dialog */}
      <Dialog open={showCreatePayable} onOpenChange={setShowCreatePayable}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-red-400 flex items-center gap-2">
              <ArrowUpCircle className="w-5 h-5" />{t('debtManager.newPayable')}
            </DialogTitle>
          </DialogHeader>
          <CreateForm form={payableForm} setForm={setPayableForm} onSubmit={handleCreatePayable} type="payable" />
        </DialogContent>
      </Dialog>

      {/* Add Payment Dialog */}
      <Dialog open={!!showPayment} onOpenChange={() => setShowPayment(null)}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="text-orange-400 flex items-center gap-2">
              <DollarSign className="w-5 h-5" />{t('debtManager.recordPayment')}
            </DialogTitle>
          </DialogHeader>
          {showPayment && (
            <div className="space-y-4">
              <div className="bg-gray-700/50 p-3 rounded-lg text-sm">
                <p className="text-gray-400">{showPayment.type === 'receivable' ? t('debtManager.debtor') : t('debtManager.creditor')}</p>
                <p className="text-white font-medium">{showPayment.record[showPayment.type === 'receivable' ? 'debtor_name' : 'creditor_name']}</p>
                <p className="text-gray-400 mt-1">{t('debtManager.remaining')}</p>
                <p className="text-orange-400 font-medium">{formatAmount(parseFloat(showPayment.record.amount) - parseFloat(showPayment.record.amount_paid), showPayment.record.currency)}</p>
              </div>
              <div>
                <Label className="text-gray-300">{t('debtManager.paymentAmount')} *</Label>
                <Input type="number" step="0.01" min="0"
                  max={parseFloat(showPayment.record.amount) - parseFloat(showPayment.record.amount_paid)}
                  value={paymentForm.amount}
                  onChange={e => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="bg-gray-700 border-gray-600 text-white" placeholder="0.00" />
              </div>
              <div>
                <Label className="text-gray-300">{t('debtManager.paymentMethod')}</Label>
                <Select value={paymentForm.payment_method} onValueChange={v => setPaymentForm({ ...paymentForm, payment_method: v })}>
                  <SelectTrigger className="bg-gray-700 border-gray-600 text-white"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-gray-700 border-gray-600">
                    {paymentMethods.map(m => (
                      <SelectItem key={m} value={m} className="text-white">{t(`debtManager.methods.${m}`)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-gray-300">{t('debtManager.notes')}</Label>
                <Input value={paymentForm.notes} onChange={e => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                  className="bg-gray-700 border-gray-600 text-white" placeholder={t('debtManager.notesPlaceholder')} />
              </div>
              <Button onClick={handleAddPayment} disabled={!paymentForm.amount}
                className="w-full bg-orange-500 hover:bg-orange-600 text-white">
                <CheckCircle2 className="w-4 h-4 mr-2" />{t('debtManager.confirmPayment')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment History Dialog */}
      <Dialog open={!!showPayments} onOpenChange={() => setShowPayments(null)}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-md max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-blue-400 flex items-center gap-2">
              <Clock className="w-5 h-5" />{t('debtManager.paymentHistory')}
            </DialogTitle>
          </DialogHeader>
          {showPayments && (
            <div className="space-y-3">
              <div className="bg-gray-700/50 p-3 rounded-lg text-sm">
                <p className="text-white font-medium">{showPayments.record[showPayments.type === 'receivable' ? 'debtor_name' : 'creditor_name']}</p>
                <p className="text-gray-400">{formatAmount(showPayments.record.amount, showPayments.record.currency)}</p>
              </div>
              {paymentHistory.length === 0 ? (
                <p className="text-gray-500 text-sm text-center py-4">{t('debtManager.noPayments')}</p>
              ) : paymentHistory.map(p => (
                <div key={p.id} className="flex items-center justify-between bg-gray-700/30 p-3 rounded-lg">
                  <div>
                    <p className="text-sm text-white">{formatAmount(p.amount)}</p>
                    <p className="text-xs text-gray-400">{t(`debtManager.methods.${p.payment_method}`)}</p>
                    {p.notes && <p className="text-xs text-gray-500 mt-0.5">{p.notes}</p>}
                  </div>
                  <span className="text-xs text-gray-400">{format(new Date(p.payment_date), 'dd/MM/yyyy')}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── STAT CARD COMPONENT ─────────────────────────
const StatCard = ({ icon: Icon, color, label, value }) => {
  const colors = {
    green: 'bg-green-500/10 border-green-500/30 text-green-400',
    red: 'bg-red-500/10 border-red-500/30 text-red-400',
    blue: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
    orange: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
  };

  return (
    <div className={`p-4 rounded-lg border ${colors[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" />
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
};

export default DebtManagerPage;
