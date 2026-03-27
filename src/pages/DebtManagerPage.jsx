import { useCallback, useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import { supabase } from '@/lib/supabase';
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
  Plus,
  Search,
  Trash2,
  ArrowDownCircle,
  ArrowUpCircle,
  Wallet,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Phone,
  Mail,
  CreditCard,
  DollarSign,
  Calendar,
  Eye,
  CalendarDays,
  CalendarClock,
  Download,
  FileText,
  Kanban,
} from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'framer-motion';
import DebtCalendarView from '@/components/DebtCalendarView';
import GenericKanbanView from '@/components/GenericKanbanView';
import DebtAgendaView from '@/components/DebtAgendaView';
import { useCompany } from '@/hooks/useCompany';
import { useCreditsGuard, CREDIT_COSTS } from '@/hooks/useCreditsGuard';
import CreditsGuardModal from '@/components/CreditsGuardModal';
import PanelInfoPopover from '@/components/ui/PanelInfoPopover';
import { exportDebtListPDF, exportDebtListHTML } from '@/services/exportListsPDF';
import { formatDateInput } from '@/utils/dateFormatting';

const createEmptyReceivableForm = (defaultCategory = '') => ({
  debtor_name: '',
  debtor_phone: '',
  debtor_email: '',
  description: '',
  amount: '',
  currency: 'EUR',
  date_lent: formatDateInput(),
  due_date: '',
  category: defaultCategory,
  notes: '',
});

const createEmptyPayableForm = (defaultCategory = '') => ({
  creditor_name: '',
  creditor_phone: '',
  creditor_email: '',
  description: '',
  amount: '',
  currency: 'EUR',
  date_borrowed: formatDateInput(),
  due_date: '',
  category: defaultCategory,
  notes: '',
});

const DebtManagerPage = () => {
  const { t } = useTranslation();
  const {
    receivables,
    loading: rLoading,
    stats: rStats,
    createReceivable,
    updateReceivable,
    deleteReceivable,
    addPayment: addReceivablePayment,
    fetchPayments: fetchReceivablePayments,
  } = useReceivables();
  const {
    payables,
    loading: pLoading,
    stats: pStats,
    createPayable,
    updatePayable,
    deletePayable,
    addPayment: addPayablePayment,
    fetchPayments: fetchPayablePayments,
  } = usePayables();
  const { company } = useCompany();
  const { guardedAction, modalProps } = useCreditsGuard();

  const [activeTab, setActiveTab] = useState('dashboard');
  const [search, setSearch] = useState('');
  const [showCreateReceivable, setShowCreateReceivable] = useState(false);
  const [showCreatePayable, setShowCreatePayable] = useState(false);
  const [showPayment, setShowPayment] = useState(null);
  const [showPayments, setShowPayments] = useState(null);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [showTypeChooser, setShowTypeChooser] = useState(null); // date for new record from calendar
  const [debtStatuses, setDebtStatuses] = useState([]);
  const [debtCategories, setDebtCategories] = useState([]);
  const [debtPaymentMethods, setDebtPaymentMethods] = useState([]);
  const defaultDebtCategory = debtCategories[0]?.code || '';
  const defaultPaymentMethod = debtPaymentMethods[0]?.code || '';
  const [receivableForm, setReceivableForm] = useState(() => createEmptyReceivableForm(defaultDebtCategory));
  const [payableForm, setPayableForm] = useState(() => createEmptyPayableForm(defaultDebtCategory));
  const [paymentForm, setPaymentForm] = useState({ amount: '', payment_method: defaultPaymentMethod, notes: '' });

  const netBalance = rStats.totalPending - pStats.totalOwed;

  const debtPanelInfo = useMemo(
    () => ({
      netBalance: {
        title: t('debtManager.netBalance'),
        definition: 'Solde net des créances et dettes encore ouvertes.',
        dataSource: 'Agrégats `rStats.totalPending` et `pStats.totalOwed` issus des hooks `useReceivables` et `usePayables`.',
        formula: 'Solde net = Créances restantes - Dettes restantes',
        calculationMethod:
          'Calcule le montant restant de chaque créance et dette, puis soustrait le total dettes au total créances.',
      },
      totalReceivable: {
        title: t('debtManager.totalReceivable'),
        definition: 'Montant total des créances enregistrées.',
        dataSource: 'Statistique `rStats.totalReceivable` calculée côté hook.',
        formula: 'Total créances = somme des montants de toutes les créances.',
        calculationMethod: 'Additionne `amount` sur la liste des créances.',
      },
      totalCollected: {
        title: t('debtManager.totalCollected'),
        definition: 'Montant total déjà encaissé sur les créances.',
        dataSource: 'Statistique `rStats.totalCollected` calculée côté hook.',
        formula: 'Total encaissé = somme des paiements reçus sur créances.',
        calculationMethod: 'Additionne `amount_paid` sur la liste des créances.',
      },
      totalPayable: {
        title: t('debtManager.totalPayable'),
        definition: 'Montant total des dettes enregistrées.',
        dataSource: 'Statistique `pStats.totalPayable` calculée côté hook.',
        formula: 'Total dettes = somme des montants de toutes les dettes.',
        calculationMethod: 'Additionne `amount` sur la liste des dettes.',
      },
      totalRepaid: {
        title: t('debtManager.totalRepaid'),
        definition: 'Montant total déjà remboursé sur les dettes.',
        dataSource: 'Statistique `pStats.totalRepaid` calculée côté hook.',
        formula: 'Total remboursé = somme des paiements effectués sur dettes.',
        calculationMethod: 'Additionne `amount_paid` sur la liste des dettes.',
      },
      pendingReceivables: {
        title: t('debtManager.pendingReceivables'),
        definition: 'Créances encore ouvertes et à suivre en priorité.',
        dataSource: 'Liste `receivablesInFollowUp` filtrée selon statut ouvert et reste à encaisser.',
        formula: 'Reste par ligne = amount - amount_paid',
        calculationMethod:
          'Filtre les créances ouvertes, trie par suivi opérationnel puis affiche les premières lignes avec leur reste dû.',
      },
      pendingPayables: {
        title: t('debtManager.pendingPayables'),
        definition: 'Dettes encore ouvertes et à suivre en priorité.',
        dataSource: 'Liste `payablesInFollowUp` filtrée selon statut ouvert et reste à payer.',
        formula: 'Reste par ligne = amount - amount_paid',
        calculationMethod:
          'Filtre les dettes ouvertes, trie par suivi opérationnel puis affiche les premières lignes avec leur reste dû.',
      },
    }),
    [t]
  );

  const resetPaymentForm = useCallback(
    () => ({
      amount: '',
      payment_method: defaultPaymentMethod,
      notes: '',
    }),
    [defaultPaymentMethod]
  );

  useEffect(() => {
    let mounted = true;

    const fetchDebtReferences = async () => {
      if (!supabase) return;
      try {
        const _debtResults = await Promise.allSettled([
          supabase
            .from('reference_debt_statuses')
            .select('code, label_key, display_color, display_bg, is_open, is_terminal, sort_order')
            .eq('is_active', true)
            .order('sort_order', { ascending: true }),
          supabase
            .from('reference_debt_categories')
            .select('code, label_key, sort_order')
            .eq('is_active', true)
            .order('sort_order', { ascending: true }),
          supabase
            .from('reference_debt_payment_methods')
            .select('code, label_key, sort_order')
            .eq('is_active', true)
            .order('sort_order', { ascending: true }),
        ]);

        const _debtLabels = ['statuses', 'categories', 'paymentMethods'];
        _debtResults.forEach((r, i) => {
          if (r.status === 'rejected') console.error(`DebtManager ref fetch "${_debtLabels[i]}" failed:`, r.reason);
        });

        const statusesRes =
          _debtResults[0].status === 'fulfilled' ? _debtResults[0].value : { data: null, error: null };
        const categoriesRes =
          _debtResults[1].status === 'fulfilled' ? _debtResults[1].value : { data: null, error: null };
        const paymentMethodsRes =
          _debtResults[2].status === 'fulfilled' ? _debtResults[2].value : { data: null, error: null };

        [statusesRes, categoriesRes, paymentMethodsRes].forEach((res, i) => {
          if (res.error) console.error(`DebtManager ref query "${_debtLabels[i]}" error:`, res.error);
        });

        if (!mounted) return;
        setDebtStatuses(statusesRes.data || []);
        setDebtCategories(categoriesRes.data || []);
        setDebtPaymentMethods(paymentMethodsRes.data || []);
      } catch (error) {
        console.warn('Failed to load debt reference catalogs:', error?.message || error);
      }
    };

    fetchDebtReferences();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (defaultDebtCategory) {
      setReceivableForm((prev) => (prev.category ? prev : { ...prev, category: defaultDebtCategory }));
      setPayableForm((prev) => (prev.category ? prev : { ...prev, category: defaultDebtCategory }));
    }
    if (defaultPaymentMethod) {
      setPaymentForm((prev) => (prev.payment_method ? prev : { ...prev, payment_method: defaultPaymentMethod }));
    }
  }, [defaultDebtCategory, defaultPaymentMethod]);

  const statusByCode = useMemo(
    () => Object.fromEntries(debtStatuses.map((status) => [status.code, status])),
    [debtStatuses]
  );
  const categoryByCode = useMemo(
    () => Object.fromEntries(debtCategories.map((category) => [category.code, category])),
    [debtCategories]
  );
  const paymentMethodByCode = useMemo(
    () => Object.fromEntries(debtPaymentMethods.map((method) => [method.code, method])),
    [debtPaymentMethods]
  );
  const statusColors = useMemo(
    () =>
      Object.fromEntries(
        debtStatuses.map((status) => [
          status.code,
          `${status.display_bg || 'bg-gray-500/20'} ${status.display_color || 'text-gray-400'}`.trim(),
        ])
      ),
    [debtStatuses]
  );

  const translateOrFallback = useCallback(
    (translationKey, fallback) => {
      if (!translationKey) return fallback;
      const translated = t(translationKey);
      return translated === translationKey ? fallback : translated;
    },
    [t]
  );

  const getStatusLabel = useCallback(
    (statusCode) => {
      const status = statusByCode[statusCode];
      if (!statusCode) return '-';
      return translateOrFallback(status?.label_key || `debtManager.status.${statusCode}`, statusCode);
    },
    [statusByCode, translateOrFallback]
  );

  const getCategoryLabel = useCallback(
    (categoryCode) => {
      const category = categoryByCode[categoryCode];
      if (!categoryCode) return '-';
      return translateOrFallback(category?.label_key || `debtManager.categories.${categoryCode}`, categoryCode);
    },
    [categoryByCode, translateOrFallback]
  );

  const getPaymentMethodLabel = useCallback(
    (methodCode) => {
      const method = paymentMethodByCode[methodCode];
      if (!methodCode) return '-';
      return translateOrFallback(method?.label_key || `debtManager.methods.${methodCode}`, methodCode);
    },
    [paymentMethodByCode, translateOrFallback]
  );

  const canRecordPayment = useCallback(
    (record) => {
      const total = parseFloat(record?.amount || 0);
      const paid = parseFloat(record?.amount_paid || 0);
      const hasBalance = paid < total;
      const status = statusByCode[record?.status];
      if (status) {
        return !status.is_terminal && hasBalance;
      }
      return hasBalance;
    },
    [statusByCode]
  );

  const openStatusCodes = useMemo(
    () => debtStatuses.filter((status) => status.is_open).map((status) => status.code),
    [debtStatuses]
  );
  const receivablesInFollowUp = useMemo(
    () =>
      openStatusCodes.length > 0
        ? receivables.filter((record) => openStatusCodes.includes(record.status))
        : receivables.filter(canRecordPayment),
    [canRecordPayment, openStatusCodes, receivables]
  );
  const payablesInFollowUp = useMemo(
    () =>
      openStatusCodes.length > 0
        ? payables.filter((record) => openStatusCodes.includes(record.status))
        : payables.filter(canRecordPayment),
    [canRecordPayment, openStatusCodes, payables]
  );

  // ─── KANBAN CONFIG ─────────────────────────
  const debtKanbanColumns = useMemo(() => {
    if (debtStatuses.length > 0) {
      return debtStatuses.map((status) => ({
        id: status.code,
        title: getStatusLabel(status.code),
        color: statusColors[status.code] || 'bg-gray-500/20 text-gray-400',
      }));
    }

    const inferredStatuses = Array.from(
      new Set([...receivables, ...payables].map((record) => record.status).filter(Boolean))
    );
    return inferredStatuses.map((statusCode) => ({
      id: statusCode,
      title: getStatusLabel(statusCode),
      color: statusColors[statusCode] || 'bg-gray-500/20 text-gray-400',
    }));
  }, [debtStatuses, getStatusLabel, payables, receivables, statusColors]);

  const receivableKanbanItems = receivables.map((r) => ({
    id: r.id,
    title: r.debtor_name || r.description,
    subtitle: r.description || r.category || '',
    date: r.due_date || r.date_lent,
    status: r.status || debtKanbanColumns[0]?.id || '',
    statusLabel: getStatusLabel(r.status),
    statusColor: statusColors[r.status] || 'bg-gray-500/20 text-gray-400',
    amount: `${parseFloat(r.amount || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${r.currency || 'EUR'}`,
  }));

  const payableKanbanItems = payables.map((p) => ({
    id: p.id,
    title: p.creditor_name || p.description,
    subtitle: p.description || p.category || '',
    date: p.due_date || p.date_borrowed,
    status: p.status || debtKanbanColumns[0]?.id || '',
    statusLabel: getStatusLabel(p.status),
    statusColor: statusColors[p.status] || 'bg-gray-500/20 text-gray-400',
    amount: `${parseFloat(p.amount || 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${p.currency || 'EUR'}`,
  }));

  // Handlers
  const handleCreateReceivable = async () => {
    if (!receivableForm.debtor_name || !receivableForm.amount) return;
    await createReceivable({ ...receivableForm, amount: parseFloat(receivableForm.amount) });
    setReceivableForm(createEmptyReceivableForm(defaultDebtCategory));
    setShowCreateReceivable(false);
  };

  const handleCreatePayable = async () => {
    if (!payableForm.creditor_name || !payableForm.amount) return;
    await createPayable({ ...payableForm, amount: parseFloat(payableForm.amount) });
    setPayableForm(createEmptyPayableForm(defaultDebtCategory));
    setShowCreatePayable(false);
  };

  const handleAddPayment = async () => {
    if (!showPayment || !paymentForm.amount) return;
    const { type, record } = showPayment;
    const selectedPaymentMethod = paymentForm.payment_method || defaultPaymentMethod;
    if (!selectedPaymentMethod) return;
    if (type === 'receivable') {
      await addReceivablePayment(record.id, parseFloat(paymentForm.amount), selectedPaymentMethod, paymentForm.notes);
    } else {
      await addPayablePayment(record.id, parseFloat(paymentForm.amount), selectedPaymentMethod, paymentForm.notes);
    }
    setPaymentForm(resetPaymentForm());
    setShowPayment(null);
  };

  const handleViewPayments = async (type, record) => {
    const payments =
      type === 'receivable' ? await fetchReceivablePayments(record.id) : await fetchPayablePayments(record.id);
    setPaymentHistory(payments);
    setShowPayments({ type, record });
  };

  const handleExportReceivablesPDF = () => {
    guardedAction(CREDIT_COSTS.PDF_REPORT, 'Receivables List PDF', async () => {
      await exportDebtListPDF(receivables, company, 'receivables');
    });
  };

  const handleExportReceivablesHTML = () => {
    guardedAction(CREDIT_COSTS.EXPORT_HTML, 'Receivables List HTML', () => {
      exportDebtListHTML(receivables, company, 'receivables');
    });
  };

  const handleExportPayablesPDF = () => {
    guardedAction(CREDIT_COSTS.PDF_REPORT, 'Payables List PDF', async () => {
      await exportDebtListPDF(payables, company, 'payables');
    });
  };

  const handleExportPayablesHTML = () => {
    guardedAction(CREDIT_COSTS.EXPORT_HTML, 'Payables List HTML', () => {
      exportDebtListHTML(payables, company, 'payables');
    });
  };

  const filterList = (list, nameField) => {
    if (!search) return list;
    const s = search.toLowerCase();
    return list.filter(
      (item) =>
        item[nameField]?.toLowerCase().includes(s) ||
        item.description?.toLowerCase().includes(s) ||
        item.category?.toLowerCase().includes(s)
    );
  };

  const formatAmount = (amount, currency = 'EUR') => {
    const symbols = { EUR: '\u20ac', USD: '$', GBP: '\u00a3', XAF: 'FCFA', XOF: 'FCFA' };
    const formatted = parseFloat(amount || 0).toLocaleString('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    return `${formatted} ${symbols[currency] || currency}`;
  };

  // ─── DASHBOARD TAB ─────────────────────────
  const DashboardTab = () => (
    <div className="space-y-6">
      {/* Net Balance */}
      <div
        className={`p-6 rounded-xl border ${netBalance >= 0 ? 'bg-green-500/5 border-green-500/30' : 'bg-red-500/5 border-red-500/30'}`}
      >
        <div className="flex items-center gap-3 mb-2">
          <Wallet className={`w-6 h-6 ${netBalance >= 0 ? 'text-green-400' : 'text-red-400'}`} />
          <span className="text-gray-400 text-sm inline-flex items-center gap-1.5">
            <PanelInfoPopover {...debtPanelInfo.netBalance} />
            <span>{t('debtManager.netBalance')}</span>
          </span>
        </div>
        <p className={`text-3xl font-bold ${netBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {netBalance >= 0 ? '+' : ''}
          {formatAmount(netBalance)}
        </p>
        <p className="text-gray-500 text-xs mt-1">{t('debtManager.netBalanceDesc')}</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={ArrowDownCircle}
          color="green"
          label={t('debtManager.totalReceivable')}
          info={debtPanelInfo.totalReceivable}
          value={formatAmount(rStats.totalReceivable)}
        />
        <StatCard
          icon={CheckCircle2}
          color="green"
          label={t('debtManager.totalCollected')}
          info={debtPanelInfo.totalCollected}
          value={formatAmount(rStats.totalCollected)}
        />
        <StatCard
          icon={ArrowUpCircle}
          color="red"
          label={t('debtManager.totalPayable')}
          info={debtPanelInfo.totalPayable}
          value={formatAmount(pStats.totalPayable)}
        />
        <StatCard
          icon={CreditCard}
          color="blue"
          label={t('debtManager.totalRepaid')}
          info={debtPanelInfo.totalRepaid}
          value={formatAmount(pStats.totalRepaid)}
        />
      </div>

      {/* Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <span className="text-sm font-medium text-white inline-flex items-center gap-1.5">
              <PanelInfoPopover {...debtPanelInfo.pendingReceivables} />
              <span>{t('debtManager.pendingReceivables')}</span>
            </span>
            <span className="ml-auto bg-yellow-500/20 text-yellow-400 text-xs px-2 py-0.5 rounded-full">
              {receivablesInFollowUp.length}
            </span>
          </div>
          {receivablesInFollowUp.slice(0, 5).map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0"
            >
              <div>
                <span className="text-sm text-white">{r.debtor_name}</span>
                <span
                  className={`ml-2 text-xs px-1.5 py-0.5 rounded ${statusColors[r.status] || 'bg-gray-500/20 text-gray-400'}`}
                >
                  {getStatusLabel(r.status)}
                </span>
              </div>
              <span className="text-sm text-green-400">
                {formatAmount(parseFloat(r.amount) - parseFloat(r.amount_paid), r.currency)}
              </span>
            </div>
          ))}
          {receivablesInFollowUp.length === 0 && <p className="text-gray-500 text-sm">{t('debtManager.noItems')}</p>}
        </div>

        <div className="bg-gray-800 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-medium text-white inline-flex items-center gap-1.5">
              <PanelInfoPopover {...debtPanelInfo.pendingPayables} />
              <span>{t('debtManager.pendingPayables')}</span>
            </span>
            <span className="ml-auto bg-red-500/20 text-red-400 text-xs px-2 py-0.5 rounded-full">
              {payablesInFollowUp.length}
            </span>
          </div>
          {payablesInFollowUp.slice(0, 5).map((p) => (
            <div
              key={p.id}
              className="flex items-center justify-between py-2 border-b border-gray-700/50 last:border-0"
            >
              <div>
                <span className="text-sm text-white">{p.creditor_name}</span>
                <span
                  className={`ml-2 text-xs px-1.5 py-0.5 rounded ${statusColors[p.status] || 'bg-gray-500/20 text-gray-400'}`}
                >
                  {getStatusLabel(p.status)}
                </span>
              </div>
              <span className="text-sm text-red-400">
                {formatAmount(parseFloat(p.amount) - parseFloat(p.amount_paid), p.currency)}
              </span>
            </div>
          ))}
          {payablesInFollowUp.length === 0 && <p className="text-gray-500 text-sm">{t('debtManager.noItems')}</p>}
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
            <p className="text-sm text-gray-300">
              {rStats.countOverdue} {t('debtManager.overdueReceivables')}
            </p>
          )}
          {pStats.countOverdue > 0 && (
            <p className="text-sm text-gray-300">
              {pStats.countOverdue} {t('debtManager.overduePayables')}
            </p>
          )}
        </div>
      )}
    </div>
  );

  // ─── RECORD ROW ─────────────────────────
  const RecordRow = ({ record, type, nameField, dateField }) => {
    const progress = record.amount > 0 ? (parseFloat(record.amount_paid) / parseFloat(record.amount)) * 100 : 0;

    return (
      <motion.tr
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-gray-700/50 hover:bg-gray-700/30 transition-colors"
      >
        <td className="p-4">
          <div className="font-medium text-white">{record[nameField]}</div>
          {record.description && (
            <div className="text-xs text-gray-400 mt-0.5 truncate max-w-[200px]">{record.description}</div>
          )}
        </td>
        <td className="p-4 hidden md:table-cell">
          <span className="text-xs bg-gray-700 text-gray-300 px-2 py-0.5 rounded">
            {getCategoryLabel(record.category)}
          </span>
        </td>
        <td className="p-4 text-sm hidden md:table-cell">
          {record[dateField] ? format(new Date(record[dateField]), 'dd/MM/yyyy') : '-'}
        </td>
        <td className="p-4 text-sm hidden md:table-cell">
          {record.due_date ? format(new Date(record.due_date), 'dd/MM/yyyy') : '-'}
        </td>
        <td className="p-4">
          <div className="text-sm font-medium text-white">{formatAmount(record.amount, record.currency)}</div>
          <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
            <div
              className={`h-1.5 rounded-full ${type === 'receivable' ? 'bg-green-500' : 'bg-orange-500'}`}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <div className="text-xs text-gray-400 mt-0.5">
            {formatAmount(record.amount_paid, record.currency)} / {formatAmount(record.amount, record.currency)}
          </div>
        </td>
        <td className="p-4">
          <span
            className={`text-xs px-2 py-1 rounded-full ${statusColors[record.status] || 'bg-gray-500/20 text-gray-400'}`}
          >
            {getStatusLabel(record.status)}
          </span>
        </td>
        <td className="p-4">
          <div className="flex items-center gap-1">
            {canRecordPayment(record) && (
              <Button
                size="sm"
                variant="ghost"
                className="text-green-400 hover:text-green-300 hover:bg-green-500/10 h-8 px-2"
                onClick={() => {
                  setShowPayment({ type, record });
                  setPaymentForm(resetPaymentForm());
                }}
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
              onClick={() => (type === 'receivable' ? deleteReceivable(record.id) : deletePayable(record.id))}
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
              <th className="text-left p-4">
                {type === 'receivable' ? t('debtManager.debtor') : t('debtManager.creditor')}
              </th>
              <th className="text-left p-4 hidden md:table-cell">{t('debtManager.category')}</th>
              <th className="text-left p-4 hidden md:table-cell">{t('debtManager.date')}</th>
              <th className="text-left p-4 hidden md:table-cell">{t('debtManager.dueDate')}</th>
              <th className="text-left p-4">{t('debtManager.amount')}</th>
              <th className="text-left p-4">{t('debtManager.statusLabel')}</th>
              <th className="text-left p-4">{t('debtManager.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={7} className="text-center p-8 text-gray-400">
                  {t('common.loading')}...
                </td>
              </tr>
            ) : data.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center p-8 text-gray-400">
                  {t('debtManager.noItems')}
                </td>
              </tr>
            ) : (
              data.map((record) => (
                <RecordRow key={record.id} record={record} type={type} nameField={nameField} dateField={dateField} />
              ))
            )}
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
            <Label className="text-gray-300">
              {type === 'receivable' ? t('debtManager.debtorName') : t('debtManager.creditorName')} *
            </Label>
            <Input
              value={form[nameField]}
              onChange={(e) => setForm({ ...form, [nameField]: e.target.value })}
              className="bg-gray-700 border-gray-600 text-white"
              placeholder={type === 'receivable' ? 'Jean Dupont' : 'Banque XYZ'}
            />
          </div>
          <div>
            <Label className="text-gray-300">{t('debtManager.category')}</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                <SelectValue placeholder={t('common.select', 'Select')} />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                {debtCategories.map((category) => (
                  <SelectItem key={category.code} value={category.code} className="text-white">
                    {getCategoryLabel(category.code)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-gray-300">
              <Phone className="w-3 h-3 inline mr-1" />
              {t('debtManager.phone')}
            </Label>
            <Input
              value={form[phoneField]}
              onChange={(e) => setForm({ ...form, [phoneField]: e.target.value })}
              className="bg-gray-700 border-gray-600 text-white"
              placeholder="+32 xxx"
            />
          </div>
          <div>
            <Label className="text-gray-300">
              <Mail className="w-3 h-3 inline mr-1" />
              {t('debtManager.email')}
            </Label>
            <Input
              type="email"
              value={form[emailField]}
              onChange={(e) => setForm({ ...form, [emailField]: e.target.value })}
              className="bg-gray-700 border-gray-600 text-white"
              placeholder="email@example.com"
            />
          </div>
        </div>

        <div>
          <Label className="text-gray-300">{t('debtManager.description')}</Label>
          <Input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            className="bg-gray-700 border-gray-600 text-white"
            placeholder={t('debtManager.descriptionPlaceholder')}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Label className="text-gray-300">{t('debtManager.amount')} *</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              className="bg-gray-700 border-gray-600 text-white"
              placeholder="0.00"
            />
          </div>
          <div>
            <Label className="text-gray-300">{t('debtManager.currency')}</Label>
            <Select value={form.currency} onValueChange={(v) => setForm({ ...form, currency: v })}>
              <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-gray-700 border-gray-600">
                {['EUR', 'USD', 'GBP', 'XAF', 'XOF'].map((c) => (
                  <SelectItem key={c} value={c} className="text-white">
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-gray-300">
              <Calendar className="w-3 h-3 inline mr-1" />
              {type === 'receivable' ? t('debtManager.dateLent') : t('debtManager.dateBorrowed')}
            </Label>
            <Input
              type="date"
              value={form[dateField]}
              onChange={(e) => setForm({ ...form, [dateField]: e.target.value })}
              className="bg-gray-700 border-gray-600 text-white"
            />
          </div>
        </div>

        <div>
          <Label className="text-gray-300">
            <Calendar className="w-3 h-3 inline mr-1" />
            {t('debtManager.dueDate')}
          </Label>
          <Input
            type="date"
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            className="bg-gray-700 border-gray-600 text-white"
          />
        </div>

        <div>
          <Label className="text-gray-300">{t('debtManager.notes')}</Label>
          <Textarea
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
            className="bg-gray-700 border-gray-600 text-white"
            rows={2}
            placeholder={t('debtManager.notesPlaceholder')}
          />
        </div>

        <Button
          onClick={onSubmit}
          disabled={!form[nameField] || !form.amount}
          className="w-full bg-orange-500 hover:bg-orange-600 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          {type === 'receivable' ? t('debtManager.createReceivable') : t('debtManager.createPayable')}
        </Button>
      </div>
    );
  };

  return (
    <>
      <Helmet>
        <title>{t('pages.debtManager', 'Debt Manager')} | CashPilot</title>
      </Helmet>
      <CreditsGuardModal {...modalProps} />
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
            <TabsTrigger
              value="dashboard"
              className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400"
            >
              <Wallet className="w-4 h-4 mr-2" />
              {t('debtManager.dashboard')}
            </TabsTrigger>
            <TabsTrigger
              value="receivables"
              className="data-[state=active]:bg-green-500/10 data-[state=active]:text-green-400"
            >
              <ArrowDownCircle className="w-4 h-4 mr-2" />
              {t('debtManager.receivables')} ({receivables.length})
            </TabsTrigger>
            <TabsTrigger
              value="payables"
              className="data-[state=active]:bg-red-500/10 data-[state=active]:text-red-400"
            >
              <ArrowUpCircle className="w-4 h-4 mr-2" />
              {t('debtManager.payables')} ({payables.length})
            </TabsTrigger>
            <TabsTrigger
              value="calendar"
              className="data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-400"
            >
              <CalendarDays className="w-4 h-4 mr-2" />
              {t('debtManager.calendar')}
            </TabsTrigger>
            <TabsTrigger
              value="agenda"
              className="data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-400"
            >
              <CalendarClock className="w-4 h-4 mr-2" />
              {t('debtManager.agenda')}
            </TabsTrigger>
            <TabsTrigger
              value="kanban"
              className="data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-400 text-gray-500"
            >
              <Kanban className="w-4 h-4 mr-1" />
              {t('common.kanban') || 'Kanban'}
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
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white pl-10"
                  placeholder={t('common.search')}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleExportReceivablesPDF}
                  size="sm"
                  variant="outline"
                  className="border-gray-600 hover:bg-gray-700"
                >
                  <Download className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">PDF ({CREDIT_COSTS.PDF_REPORT})</span>
                  <span className="sm:hidden">PDF</span>
                </Button>
                <Button
                  onClick={handleExportReceivablesHTML}
                  size="sm"
                  variant="outline"
                  className="border-gray-600 hover:bg-gray-700"
                >
                  <FileText className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">HTML ({CREDIT_COSTS.EXPORT_HTML})</span>
                  <span className="sm:hidden">HTML</span>
                </Button>
                <Button
                  onClick={() => {
                    setReceivableForm(createEmptyReceivableForm(defaultDebtCategory));
                    setShowCreateReceivable(true);
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('debtManager.newReceivable')}
                </Button>
              </div>
            </div>
            <RecordTable
              data={filterList(receivables, 'debtor_name')}
              type="receivable"
              nameField="debtor_name"
              dateField="date_lent"
              loading={rLoading}
            />
          </TabsContent>

          {/* Payables */}
          <TabsContent value="payables" className="mt-6 space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="bg-gray-800 border-gray-700 text-white pl-10"
                  placeholder={t('common.search')}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleExportPayablesPDF}
                  size="sm"
                  variant="outline"
                  className="border-gray-600 hover:bg-gray-700"
                >
                  <Download className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">PDF ({CREDIT_COSTS.PDF_REPORT})</span>
                  <span className="sm:hidden">PDF</span>
                </Button>
                <Button
                  onClick={handleExportPayablesHTML}
                  size="sm"
                  variant="outline"
                  className="border-gray-600 hover:bg-gray-700"
                >
                  <FileText className="w-4 h-4 mr-1" />
                  <span className="hidden sm:inline">HTML ({CREDIT_COSTS.EXPORT_HTML})</span>
                  <span className="sm:hidden">HTML</span>
                </Button>
                <Button
                  onClick={() => {
                    setPayableForm(createEmptyPayableForm(defaultDebtCategory));
                    setShowCreatePayable(true);
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  {t('debtManager.newPayable')}
                </Button>
              </div>
            </div>
            <RecordTable
              data={filterList(payables, 'creditor_name')}
              type="payable"
              nameField="creditor_name"
              dateField="date_borrowed"
              loading={pLoading}
            />
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
                if (canRecordPayment(record)) {
                  setShowPayment({ type: record.type, record });
                  setPaymentForm(resetPaymentForm());
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
                setPaymentForm(resetPaymentForm());
              }}
              onView={(type, record) => handleViewPayments(type, record)}
              onDelete={(type, record) =>
                type === 'receivable' ? deleteReceivable(record.id) : deletePayable(record.id)
              }
            />
          </TabsContent>

          {/* Kanban */}
          <TabsContent value="kanban" className="mt-6 space-y-8">
            <div>
              <h3 className="text-lg font-bold text-green-400 mb-4">{t('debtManager.receivables') || 'Receivables'}</h3>
              <GenericKanbanView
                columns={debtKanbanColumns}
                items={receivableKanbanItems}
                onStatusChange={async (id, status) => await updateReceivable(id, { status })}
              />
            </div>
            <div>
              <h3 className="text-lg font-bold text-red-400 mb-4">{t('debtManager.payables') || 'Payables'}</h3>
              <GenericKanbanView
                columns={debtKanbanColumns}
                items={payableKanbanItems}
                onStatusChange={async (id, status) => await updatePayable(id, { status })}
              />
            </div>
          </TabsContent>
        </Tabs>

        {/* Type Chooser Dialog (from calendar click) */}
        <Dialog open={!!showTypeChooser} onOpenChange={() => setShowTypeChooser(null)}>
          <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-orange-400 flex items-center gap-2">
                <CalendarDays className="w-5 h-5" />
                {t('debtManager.createOnDate')} {showTypeChooser}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Button
                className="w-full bg-green-600 hover:bg-green-700 text-white justify-start"
                onClick={() => {
                  setReceivableForm({ ...createEmptyReceivableForm(defaultDebtCategory), due_date: showTypeChooser });
                  setShowCreateReceivable(true);
                  setShowTypeChooser(null);
                }}
              >
                <ArrowDownCircle className="w-4 h-4 mr-2" />
                {t('debtManager.chooseReceivable')}
              </Button>
              <Button
                className="w-full bg-red-600 hover:bg-red-700 text-white justify-start"
                onClick={() => {
                  setPayableForm({ ...createEmptyPayableForm(defaultDebtCategory), due_date: showTypeChooser });
                  setShowCreatePayable(true);
                  setShowTypeChooser(null);
                }}
              >
                <ArrowUpCircle className="w-4 h-4 mr-2" />
                {t('debtManager.choosePayable')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Create Receivable Dialog */}
        <Dialog open={showCreateReceivable} onOpenChange={setShowCreateReceivable}>
          <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-green-400 flex items-center gap-2">
                <ArrowDownCircle className="w-5 h-5" />
                {t('debtManager.newReceivable')}
              </DialogTitle>
            </DialogHeader>
            <CreateForm
              form={receivableForm}
              setForm={setReceivableForm}
              onSubmit={handleCreateReceivable}
              type="receivable"
            />
          </DialogContent>
        </Dialog>

        {/* Create Payable Dialog */}
        <Dialog open={showCreatePayable} onOpenChange={setShowCreatePayable}>
          <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-red-400 flex items-center gap-2">
                <ArrowUpCircle className="w-5 h-5" />
                {t('debtManager.newPayable')}
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
                <DollarSign className="w-5 h-5" />
                {t('debtManager.recordPayment')}
              </DialogTitle>
            </DialogHeader>
            {showPayment && (
              <div className="space-y-4">
                <div className="bg-gray-700/50 p-3 rounded-lg text-sm">
                  <p className="text-gray-400">
                    {showPayment.type === 'receivable' ? t('debtManager.debtor') : t('debtManager.creditor')}
                  </p>
                  <p className="text-white font-medium">
                    {showPayment.record[showPayment.type === 'receivable' ? 'debtor_name' : 'creditor_name']}
                  </p>
                  <p className="text-gray-400 mt-1">{t('debtManager.remaining')}</p>
                  <p className="text-orange-400 font-medium">
                    {formatAmount(
                      parseFloat(showPayment.record.amount) - parseFloat(showPayment.record.amount_paid),
                      showPayment.record.currency
                    )}
                  </p>
                </div>
                <div>
                  <Label className="text-gray-300">{t('debtManager.paymentAmount')} *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max={parseFloat(showPayment.record.amount) - parseFloat(showPayment.record.amount_paid)}
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                    className="bg-gray-700 border-gray-600 text-white"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <Label className="text-gray-300">{t('debtManager.paymentMethod')}</Label>
                  <Select
                    value={paymentForm.payment_method}
                    onValueChange={(v) => setPaymentForm({ ...paymentForm, payment_method: v })}
                  >
                    <SelectTrigger className="bg-gray-700 border-gray-600 text-white">
                      <SelectValue placeholder={t('common.select', 'Select')} />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-700 border-gray-600">
                      {debtPaymentMethods.map((method) => (
                        <SelectItem key={method.code} value={method.code} className="text-white">
                          {getPaymentMethodLabel(method.code)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-gray-300">{t('debtManager.notes')}</Label>
                  <Input
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm({ ...paymentForm, notes: e.target.value })}
                    className="bg-gray-700 border-gray-600 text-white"
                    placeholder={t('debtManager.notesPlaceholder')}
                  />
                </div>
                <Button
                  onClick={handleAddPayment}
                  disabled={!paymentForm.amount || !paymentForm.payment_method}
                  className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  {t('debtManager.confirmPayment')}
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
                <Clock className="w-5 h-5" />
                {t('debtManager.paymentHistory')}
              </DialogTitle>
            </DialogHeader>
            {showPayments && (
              <div className="space-y-3">
                <div className="bg-gray-700/50 p-3 rounded-lg text-sm">
                  <p className="text-white font-medium">
                    {showPayments.record[showPayments.type === 'receivable' ? 'debtor_name' : 'creditor_name']}
                  </p>
                  <p className="text-gray-400">
                    {formatAmount(showPayments.record.amount, showPayments.record.currency)}
                  </p>
                </div>
                {paymentHistory.length === 0 ? (
                  <p className="text-gray-500 text-sm text-center py-4">{t('debtManager.noPayments')}</p>
                ) : (
                  paymentHistory.map((p) => (
                    <div key={p.id} className="flex items-center justify-between bg-gray-700/30 p-3 rounded-lg">
                      <div>
                        <p className="text-sm text-white">{formatAmount(p.amount)}</p>
                        <p className="text-xs text-gray-400">{getPaymentMethodLabel(p.payment_method)}</p>
                        {p.notes && <p className="text-xs text-gray-500 mt-0.5">{p.notes}</p>}
                      </div>
                      <span className="text-xs text-gray-400">{format(new Date(p.payment_date), 'dd/MM/yyyy')}</span>
                    </div>
                  ))
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
};

// ─── STAT CARD COMPONENT ─────────────────────────
const StatCard = ({ icon: Icon, color, label, info, value }) => {
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
        <span className="text-xs text-gray-400 inline-flex items-center gap-1.5">
          {info && <PanelInfoPopover {...info} />}
          <span>{label}</span>
        </span>
      </div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
};

export default DebtManagerPage;
