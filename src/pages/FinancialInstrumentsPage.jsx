import { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { useTranslation } from 'react-i18next';
import {
  Wallet,
  CreditCard,
  Banknote,
  Plus,
  ArrowLeftRight,
  Loader2,
  Pencil,
  Trash2,
  Download,
  ArrowDownLeft,
  ArrowUpRight,
  FileText,
  Upload,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import PanelInfoPopover from '@/components/ui/PanelInfoPopover';
import { usePaymentInstruments } from '@/hooks/usePaymentInstruments';
import { usePaymentTransactions } from '@/hooks/usePaymentTransactions';
import { InstrumentsList } from '@/components/financial-instruments/InstrumentsList';
import { BankAccountForm } from '@/components/financial-instruments/BankAccountForm';
import { CardGrid } from '@/components/financial-instruments/CardGrid';
import { CardForm } from '@/components/financial-instruments/CardForm';
import { CashRegisterPanel } from '@/components/financial-instruments/CashRegisterPanel';
import { CashForm } from '@/components/financial-instruments/CashForm';
import { TransferDialog } from '@/components/financial-instruments/TransferDialog';
import { InstrumentStatsPanel } from '@/components/financial-instruments/InstrumentStatsPanel';
import BankStatementUploadModal from '@/components/accounting/BankStatementUploadModal';
import { formatCurrency } from '@/utils/currencyService';
import { useBankReconciliation } from '@/hooks/useBankReconciliation';

const FLOW_OPTIONS = ['all', 'inflow', 'outflow'];
const STATUS_OPTIONS = ['all', 'draft', 'pending', 'posted', 'reconciled', 'cancelled'];
const KIND_OPTIONS = [
  'income',
  'expense',
  'transfer_in',
  'transfer_out',
  'refund_in',
  'refund_out',
  'fee',
  'adjustment',
  'withdrawal',
  'deposit',
];

const getFlowBadgeClass = (flow) =>
  flow === 'inflow'
    ? 'bg-green-500/20 text-green-300 border-green-500/30'
    : 'bg-red-500/20 text-red-300 border-red-500/30';

const emptyTransactionForm = {
  payment_instrument_id: '',
  transaction_kind: 'deposit',
  status: 'posted',
  amount: '',
  transaction_date: new Date().toISOString().split('T')[0],
  posting_date: new Date().toISOString().split('T')[0],
  value_date: new Date().toISOString().split('T')[0],
  reference: '',
  counterparty_name: '',
  description: '',
  notes: '',
};

const InfoLabel = ({ info, children, className = '' }) => (
  <span className={`inline-flex items-center gap-1.5 ${className}`.trim()}>
    <PanelInfoPopover
      title={info.title}
      definition={info.definition}
      dataSource={info.dataSource}
      formula={info.formula}
      calculationMethod={info.calculationMethod}
      filters={info.filters}
      notes={info.notes}
      ariaLabel={`Informations sur ${info.title}`}
      triggerClassName="h-5 w-5"
    />
    <span>{children}</span>
  </span>
);

const FinancialInstrumentsPage = () => {
  const { t } = useTranslation();
  const { instruments, loading, fetchInstruments, createInstrument, updateInstrument, deleteInstrument } =
    usePaymentInstruments();
  const {
    transactions,
    loading: transactionsLoading,
    fetchTransactions,
    createTransaction,
    updateTransaction,
    deleteTransaction,
    resolveFlowDirection,
  } = usePaymentTransactions();
  const { uploadStatement, importParsedLines } = useBankReconciliation();

  const [activeTab, setActiveTab] = useState('bank_accounts');
  const [bankFormOpen, setBankFormOpen] = useState(false);
  const [cardFormOpen, setCardFormOpen] = useState(false);
  const [cashFormOpen, setCashFormOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [editingInstrument, setEditingInstrument] = useState(null);
  const [transactionDialogOpen, setTransactionDialogOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [transactionForm, setTransactionForm] = useState(emptyTransactionForm);
  const [transactionInstrumentFilter, setTransactionInstrumentFilter] = useState('all');
  const [transactionFlowFilter, setTransactionFlowFilter] = useState('all');
  const [transactionStatusFilter, setTransactionStatusFilter] = useState('all');
  const [transactionSearch, setTransactionSearch] = useState('');
  const [statementUploadOpen, setStatementUploadOpen] = useState(false);
  const [selectedUploadInstrumentId, setSelectedUploadInstrumentId] = useState('');

  useEffect(() => {
    fetchInstruments();
  }, [fetchInstruments]);

  useEffect(() => {
    fetchTransactions({ limit: 500 });
  }, [fetchTransactions]);

  const bankAccounts = useMemo(() => instruments.filter((i) => i.instrument_type === 'bank_account'), [instruments]);
  const cards = useMemo(() => instruments.filter((i) => i.instrument_type === 'card'), [instruments]);
  const cashRegisters = useMemo(() => instruments.filter((i) => i.instrument_type === 'cash'), [instruments]);

  const handleAdd = () => {
    setEditingInstrument(null);
    if (activeTab === 'bank_accounts') setBankFormOpen(true);
    else if (activeTab === 'cards') setCardFormOpen(true);
    else if (activeTab === 'cash') setCashFormOpen(true);
  };

  const handleEdit = (instrument) => {
    setEditingInstrument(instrument);
    if (instrument.instrument_type === 'bank_account') setBankFormOpen(true);
    else if (instrument.instrument_type === 'card') setCardFormOpen(true);
    else if (instrument.instrument_type === 'cash') setCashFormOpen(true);
  };

  const handleBankSubmit = async (data) => {
    if (editingInstrument) {
      await updateInstrument(editingInstrument.id, data);
    } else {
      await createInstrument({ ...data, instrument_type: 'bank_account' });
    }
    setBankFormOpen(false);
    setEditingInstrument(null);
  };

  const handleCardSubmit = async (data) => {
    if (editingInstrument) {
      await updateInstrument(editingInstrument.id, data);
    } else {
      await createInstrument({ ...data, instrument_type: 'card' });
    }
    setCardFormOpen(false);
    setEditingInstrument(null);
  };

  const handleCashSubmit = async (data) => {
    if (editingInstrument) {
      await updateInstrument(editingInstrument.id, data);
    } else {
      await createInstrument({ ...data, instrument_type: 'cash' });
    }
    setCashFormOpen(false);
    setEditingInstrument(null);
  };

  const handleTransferSubmit = async (_transferData) => {
    const groupId = crypto.randomUUID();
    const fromInstrument = instruments.find((inst) => inst.id === _transferData.from_instrument_id);
    const toInstrument = instruments.find((inst) => inst.id === _transferData.to_instrument_id);
    const transferDate = _transferData.transfer_date || new Date().toISOString().split('T')[0];
    const transferReference = `TRF-${transferDate.replaceAll('-', '')}-${groupId.slice(0, 8)}`;

    await createTransaction({
      payment_instrument_id: _transferData.from_instrument_id,
      transaction_kind: 'transfer_out',
      flow_direction: 'outflow',
      source_module: 'transfers',
      source_table: 'payment_transfers',
      transaction_date: transferDate,
      posting_date: transferDate,
      value_date: transferDate,
      amount: Math.abs(Number(_transferData.amount || 0)),
      currency: (fromInstrument?.currency || 'EUR').toUpperCase(),
      reference: transferReference,
      counterparty_name: toInstrument?.label || null,
      description: _transferData.notes || `Virement vers ${toInstrument?.label || 'compte destination'}`,
      is_internal_transfer: true,
      transfer_group_id: groupId,
      status: 'posted',
    });

    await createTransaction({
      payment_instrument_id: _transferData.to_instrument_id,
      transaction_kind: 'transfer_in',
      flow_direction: 'inflow',
      source_module: 'transfers',
      source_table: 'payment_transfers',
      transaction_date: transferDate,
      posting_date: transferDate,
      value_date: transferDate,
      amount: Math.abs(Number(_transferData.amount || 0)),
      currency: (toInstrument?.currency || fromInstrument?.currency || 'EUR').toUpperCase(),
      reference: transferReference,
      counterparty_name: fromInstrument?.label || null,
      description: _transferData.notes || `Virement depuis ${fromInstrument?.label || 'compte source'}`,
      is_internal_transfer: true,
      transfer_group_id: groupId,
      status: 'posted',
    });

    if (Number(_transferData.fee || 0) > 0) {
      await createTransaction({
        payment_instrument_id: _transferData.from_instrument_id,
        transaction_kind: 'fee',
        flow_direction: 'outflow',
        source_module: 'transfers',
        source_table: 'payment_transfers',
        transaction_date: transferDate,
        posting_date: transferDate,
        value_date: transferDate,
        amount: Math.abs(Number(_transferData.fee || 0)),
        currency: (fromInstrument?.currency || 'EUR').toUpperCase(),
        reference: `${transferReference}-FEE`,
        counterparty_name: fromInstrument?.label || null,
        description: 'Frais de virement interne',
        is_internal_transfer: true,
        transfer_group_id: groupId,
        status: 'posted',
      });
    }

    await fetchTransactions({ limit: 500 });
    await fetchInstruments();
    setTransferOpen(false);
  };

  const handleDelete = async (instrument) => {
    if (window.confirm(t('financialInstruments.confirmDelete', { label: instrument.label }))) {
      await deleteInstrument(instrument.id);
    }
  };

  const activeInstruments = useMemo(
    () => instruments.filter((instrument) => instrument.status === 'active'),
    [instruments]
  );

  const getKindLabel = (kind) => t(`paymentTransactions.${kind}`, kind || '-');
  const getStatusLabel = (status) => t(`paymentTransactions.${status}`, status || '-');
  const getFlowLabel = (flow) =>
    flow === 'all' ? t('common.all', 'Tous') : t(`paymentTransactions.${flow}`, flow || '-');

  const transactionRows = useMemo(
    () =>
      transactions.filter((transaction) => {
        if (
          transactionInstrumentFilter !== 'all' &&
          transaction.payment_instrument_id !== transactionInstrumentFilter
        ) {
          return false;
        }
        if (transactionFlowFilter !== 'all' && transaction.flow_direction !== transactionFlowFilter) {
          return false;
        }
        if (transactionStatusFilter !== 'all' && transaction.status !== transactionStatusFilter) {
          return false;
        }
        if (!transactionSearch) return true;
        const query = transactionSearch.toLowerCase();
        return (
          (transaction.description || '').toLowerCase().includes(query) ||
          (transaction.reference || '').toLowerCase().includes(query) ||
          (transaction.counterparty_name || '').toLowerCase().includes(query)
        );
      }),
    [transactions, transactionFlowFilter, transactionInstrumentFilter, transactionSearch, transactionStatusFilter]
  );

  const transactionDashboard = useMemo(() => {
    const scopedRows =
      transactionInstrumentFilter === 'all'
        ? transactionRows
        : transactionRows.filter((row) => row.payment_instrument_id === transactionInstrumentFilter);

    const totalInflow = scopedRows
      .filter((row) => row.flow_direction === 'inflow')
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);

    const totalOutflow = scopedRows
      .filter((row) => row.flow_direction === 'outflow')
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);

    const groupedByKind = scopedRows.reduce((accumulator, row) => {
      const key = row.transaction_kind || 'unknown';
      accumulator[key] = accumulator[key] || { count: 0, amount: 0 };
      accumulator[key].count += 1;
      accumulator[key].amount += Number(row.amount || 0);
      return accumulator;
    }, {});

    const reportsByKind = Object.entries(groupedByKind)
      .map(([kind, values]) => ({ kind, ...values }))
      .sort((a, b) => b.amount - a.amount);

    const selectedInstrument = activeInstruments.find((instrument) => instrument.id === transactionInstrumentFilter);
    const currency = selectedInstrument?.currency || activeInstruments[0]?.currency || 'EUR';
    const currentBalance =
      transactionInstrumentFilter === 'all'
        ? activeInstruments.reduce((sum, instrument) => sum + Number(instrument.current_balance || 0), 0)
        : Number(selectedInstrument?.current_balance || 0);

    return {
      totalInflow,
      totalOutflow,
      netFlow: totalInflow - totalOutflow,
      operationCount: scopedRows.length,
      reportsByKind,
      currency,
      currentBalance,
    };
  }, [activeInstruments, transactionInstrumentFilter, transactionRows]);

  const selectedTransactionInstrumentLabel = useMemo(() => {
    if (transactionInstrumentFilter === 'all') return t('financialInstruments.transactions.allInstruments', 'Tous');
    return (
      activeInstruments.find((instrument) => instrument.id === transactionInstrumentFilter)?.label ||
      t('financialInstruments.transactions.selectedInstrument', 'Compte selectionne')
    );
  }, [activeInstruments, t, transactionInstrumentFilter]);

  const transactionPanelInfo = useMemo(
    () => ({
      currentBalance: {
        title: 'Solde courant',
        definition: 'Montant disponible maintenant sur le compte choisi (ou total de tous les comptes actifs).',
        dataSource: "Soldes des comptes bancaires enregistrés dans l'application.",
        formula: 'Si un compte est choisi: son solde. Sinon: somme des soldes de tous les comptes actifs.',
        calculationMethod:
          'Le solde se met à jour automatiquement quand une opération est comptabilisée ou rapprochée. Les brouillons, en attente et annulées ne changent pas ce montant.',
        expertDataSource:
          'Champ `company_payment_instruments.current_balance` lu via `usePaymentInstruments` et filtré sur les instruments actifs.',
        expertFormula:
          "Si filtre = all: somme des `current_balance` des instruments actifs ; sinon `current_balance` de l'instrument sélectionné.",
        expertCalculationMethod:
          "La fonction SQL `apply_payment_transaction_balance` ajuste `current_balance` sur INSERT/UPDATE/DELETE de `payment_transactions` quand `status IN ('posted','reconciled')` et `deleted_at IS NULL`.",
        filters: `Compte / moyen: ${selectedTransactionInstrumentLabel}`,
      },
      inflow: {
        title: 'Entrées',
        definition: 'Total des montants entrants visibles avec vos filtres actuels.',
        dataSource: 'Liste des transactions affichées à l écran.',
        formula: 'Entrées = somme des mouvements marqués en entrée.',
        calculationMethod: 'Additionne uniquement les lignes qui restent après vos filtres.',
        expertDataSource: 'Table `payment_transactions` chargée par `usePaymentTransactions`.',
        expertFormula: "Entrées = sum(amount) where `flow_direction = 'inflow'`.",
        expertCalculationMethod:
          'Agrégation exécutée côté UI après filtres Compte/Flux/Statut/Recherche appliqués sur `transactionRows`.',
      },
      outflow: {
        title: 'Sorties',
        definition: 'Total des montants sortants visibles avec vos filtres actuels.',
        dataSource: 'Liste des transactions affichées à l écran.',
        formula: 'Sorties = somme des mouvements marqués en sortie.',
        calculationMethod: 'Additionne uniquement les lignes qui restent après vos filtres.',
        expertDataSource: 'Table `payment_transactions` chargée par `usePaymentTransactions`.',
        expertFormula: "Sorties = sum(amount) where `flow_direction = 'outflow'`.",
        expertCalculationMethod:
          'Agrégation exécutée côté UI après filtres Compte/Flux/Statut/Recherche appliqués sur `transactionRows`.',
      },
      netFlow: {
        title: 'Net / operations',
        definition: 'Différence entre ce qui entre et ce qui sort dans la vue actuelle.',
        dataSource: 'Totaux Entrées et Sorties calculés sur la liste filtrée.',
        formula: 'Net = Entrées - Sorties.',
        calculationMethod: "Calcule l'écart entre les deux totaux et affiche aussi le nombre d'opérations concernées.",
        expertDataSource: 'Agrégats `totalInflow`, `totalOutflow`, `operationCount` calculés en mémoire.',
        expertFormula: 'Net = `totalInflow - totalOutflow`.',
        expertCalculationMethod:
          'Le calcul est déterministe dans `transactionDashboard` (useMemo) et dépend de `transactionRows` post-filtrage.',
      },
      reportByKind: {
        title: "Rapport par type d'operation",
        definition: 'Vue résumée des opérations classées par type (frais, transfert, encaissement, etc.).',
        dataSource: 'Transactions visibles après filtres.',
        formula: 'Par type: nombre d opérations + montant total.',
        calculationMethod: 'Regroupe les lignes par type puis trie les résultats du plus gros montant au plus faible.',
        expertDataSource: 'Regroupement par `transaction_kind` sur `scopedRows`.',
        expertFormula: 'Par type: `count(*)` et `sum(amount)`.',
        expertCalculationMethod:
          'Réduction JS vers une map `{kind: {count, amount}}`, puis tri décroissant par `amount`.',
      },
      transactionRegister: {
        title: 'Registre des transactions',
        definition: 'Liste détaillée de toutes les opérations qui correspondent à vos filtres.',
        dataSource: 'Transactions et comptes liés affichés dans le tableau.',
        calculationMethod:
          'Chaque ligne reprend date, compte, type, montant et statut pour expliquer le résultat affiché.',
        expertDataSource:
          'Select `payment_transactions` + relation `company_payment_instruments(id, label, instrument_type, currency)`.',
        expertCalculationMethod:
          'Projection ligne à ligne avec labels traduits (`transaction_kind`, `flow_direction`, `status`) et format monétaire.',
      },
    }),
    [selectedTransactionInstrumentLabel]
  );

  const openCreateTransactionDialog = () => {
    setEditingTransaction(null);
    setTransactionForm({
      ...emptyTransactionForm,
      payment_instrument_id:
        transactionInstrumentFilter !== 'all' ? transactionInstrumentFilter : activeInstruments[0]?.id || '',
    });
    setTransactionDialogOpen(true);
  };

  const openEditTransactionDialog = (transaction) => {
    setEditingTransaction(transaction);
    setTransactionForm({
      payment_instrument_id: transaction.payment_instrument_id || '',
      transaction_kind: transaction.transaction_kind || 'deposit',
      status: transaction.status || 'posted',
      amount: String(transaction.amount || ''),
      transaction_date: transaction.transaction_date || new Date().toISOString().split('T')[0],
      posting_date: transaction.posting_date || transaction.transaction_date || new Date().toISOString().split('T')[0],
      value_date: transaction.value_date || transaction.transaction_date || new Date().toISOString().split('T')[0],
      reference: transaction.reference || '',
      counterparty_name: transaction.counterparty_name || '',
      description: transaction.description || '',
      notes: transaction.notes || '',
    });
    setTransactionDialogOpen(true);
  };

  const handleTransactionFieldChange = (field, value) => {
    setTransactionForm((previous) => ({ ...previous, [field]: value }));
  };

  const handleTransactionSubmit = async (event) => {
    event.preventDefault();
    const selectedInstrument = activeInstruments.find(
      (instrument) => instrument.id === transactionForm.payment_instrument_id
    );

    const payload = {
      payment_instrument_id: transactionForm.payment_instrument_id,
      transaction_kind: transactionForm.transaction_kind,
      flow_direction: resolveFlowDirection(transactionForm.transaction_kind),
      source_module: 'manual',
      source_table: 'payment_transactions',
      transaction_date: transactionForm.transaction_date,
      posting_date: transactionForm.posting_date || transactionForm.transaction_date,
      value_date: transactionForm.value_date || transactionForm.transaction_date,
      amount: Math.abs(Number(transactionForm.amount || 0)),
      currency: (selectedInstrument?.currency || 'EUR').toUpperCase(),
      status: transactionForm.status,
      reference: transactionForm.reference || null,
      counterparty_name: transactionForm.counterparty_name || null,
      description: transactionForm.description || null,
      notes: transactionForm.notes || null,
    };

    if (editingTransaction?.id) {
      await updateTransaction(editingTransaction.id, payload);
    } else {
      await createTransaction(payload);
    }

    await fetchTransactions({ limit: 500 });
    await fetchInstruments();
    setTransactionDialogOpen(false);
    setEditingTransaction(null);
    setTransactionForm(emptyTransactionForm);
  };

  const handleDeleteTransaction = async (transactionId) => {
    if (!window.confirm(t('financialInstruments.transactions.deleteConfirm', 'Supprimer cette transaction ?'))) {
      return;
    }
    await deleteTransaction(transactionId);
    await fetchTransactions({ limit: 500 });
    await fetchInstruments();
  };

  const exportTransactionsCsv = () => {
    const header = [
      'Date',
      'Instrument',
      'Type',
      'Flux',
      'Montant',
      'Devise',
      'Statut',
      'Référence',
      'Contrepartie',
      'Description',
    ];
    const rows = transactionRows.map((row) => [
      row.transaction_date || '',
      row.company_payment_instruments?.label || '',
      getKindLabel(row.transaction_kind),
      getFlowLabel(row.flow_direction),
      String(Number(row.amount || 0).toFixed(2)),
      row.currency || '',
      getStatusLabel(row.status),
      row.reference || '',
      row.counterparty_name || '',
      row.description || '',
    ]);

    const csv = [header, ...rows]
      .map((columns) => columns.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(';'))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `cashpilot-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(downloadUrl);
  };

  const handleStatementUploadComplete = async (file, parsedData, metadata = {}, paymentInstrumentId = null) => {
    const scopedInstrumentId = paymentInstrumentId || metadata.paymentInstrumentId || null;

    const statement = await uploadStatement(file, {
      ...metadata,
      paymentInstrumentId: scopedInstrumentId,
    });
    if (!statement?.id) return false;

    const importSuccess = await importParsedLines(statement.id, parsedData?.lines || [], parsedData?.errors || [], {
      paymentInstrumentId: scopedInstrumentId,
      bankName: metadata.bankName || null,
      accountNumber: metadata.accountNumber || null,
      statementCurrency: metadata.currency || parsedData?.metadata?.currency || null,
    });

    if (importSuccess) {
      await fetchTransactions({ limit: 500 });
      await fetchInstruments();
      setStatementUploadOpen(false);
    }

    return importSuccess;
  };

  return (
    <>
      <Helmet>
        <title>{t('financialInstruments.title', 'Instruments financiers')} - CashPilot</title>
      </Helmet>

      <div className="min-h-screen bg-[#0a0e1a] p-4 md:p-6 lg:p-8">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
          {/* Header */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                <Wallet className="h-7 w-7 text-amber-500" />
                {t('financialInstruments.title', 'Instruments financiers')}
              </h1>
              <p className="text-gray-400 mt-1 text-sm">
                {t('financialInstruments.subtitle', 'Gerez vos comptes bancaires, cartes et caisses')}
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
                onClick={() => setTransferOpen(true)}
              >
                <ArrowLeftRight className="h-4 w-4 mr-2" />
                {t('financialInstruments.transfer', 'Virement')}
              </Button>
              {activeTab !== 'stats' && (
                <Button className="bg-amber-500 hover:bg-amber-600 text-black font-semibold" onClick={handleAdd}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('common.add', 'Ajouter')}
                </Button>
              )}
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="bg-[#0f1528] border border-gray-800/50 mb-6">
              <TabsTrigger
                value="bank_accounts"
                className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-500"
              >
                <Wallet className="h-4 w-4 mr-2" />
                {t('financialInstruments.tabs.bankAccounts', 'Comptes bancaires')}
              </TabsTrigger>
              <TabsTrigger
                value="cards"
                className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-500"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                {t('financialInstruments.tabs.cards', 'Cartes')}
              </TabsTrigger>
              <TabsTrigger
                value="cash"
                className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-500"
              >
                <Banknote className="h-4 w-4 mr-2" />
                {t('financialInstruments.tabs.cash', 'Caisses')}
              </TabsTrigger>
              <TabsTrigger
                value="stats"
                className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-500"
              >
                {t('financialInstruments.tabs.stats', 'Statistiques')}
              </TabsTrigger>
              <TabsTrigger
                value="transactions"
                className="data-[state=active]:bg-amber-500/10 data-[state=active]:text-amber-500"
              >
                {t('financialInstruments.tabs.transactions', 'Transactions')}
              </TabsTrigger>
            </TabsList>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
              </div>
            ) : (
              <>
                <TabsContent value="bank_accounts">
                  <InstrumentsList
                    instruments={bankAccounts}
                    type="bank_account"
                    onEdit={handleEdit}
                    onDelete={handleDelete}
                  />
                </TabsContent>

                <TabsContent value="cards">
                  <CardGrid
                    cards={cards}
                    onEdit={handleEdit}
                    onAdd={() => {
                      setEditingInstrument(null);
                      setCardFormOpen(true);
                    }}
                  />
                </TabsContent>

                <TabsContent value="cash">
                  <CashRegisterPanel
                    instruments={cashRegisters}
                    onEdit={handleEdit}
                    onAdd={() => {
                      setEditingInstrument(null);
                      setCashFormOpen(true);
                    }}
                  />
                </TabsContent>

                <TabsContent value="stats">
                  <InstrumentStatsPanel instruments={instruments} />
                </TabsContent>

                <TabsContent value="transactions" className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-sm text-gray-400">
                      {t(
                        'financialInstruments.transactions.helpText',
                        'Tableau de bord par compte/moyen de paiement, rapports et registre CRUD des opérations.'
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
                        onClick={() => {
                          setSelectedUploadInstrumentId(
                            transactionInstrumentFilter !== 'all' ? transactionInstrumentFilter : ''
                          );
                          setStatementUploadOpen(true);
                        }}
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        {t('accounting.reconciliation.importStatement', 'Importer un relevé')}
                      </Button>
                      <Button
                        variant="outline"
                        className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
                        onClick={exportTransactionsCsv}
                        disabled={transactionRows.length === 0}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        {t('financialInstruments.transactions.exportCsv', 'Export CSV')}
                      </Button>
                      <Button
                        className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                        onClick={openCreateTransactionDialog}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        {t('paymentTransactions.newTransaction', 'Nouvelle transaction')}
                      </Button>
                    </div>
                  </div>

                  <Card className="bg-[#141c33] border-gray-800/50">
                    <CardContent className="pt-6 grid gap-3 md:grid-cols-4">
                      <div className="space-y-1">
                        <Label className="text-gray-400">Compte / moyen</Label>
                        <Select value={transactionInstrumentFilter} onValueChange={setTransactionInstrumentFilter}>
                          <SelectTrigger className="bg-[#0f1528] border-gray-800/50 text-white">
                            <SelectValue placeholder="Tous les comptes" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#141c33] border-gray-800/50">
                            <SelectItem value="all">
                              {t('financialInstruments.transactions.allInstruments', 'Tous les comptes')}
                            </SelectItem>
                            {activeInstruments.map((instrument) => (
                              <SelectItem key={instrument.id} value={instrument.id}>
                                {instrument.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-gray-400">Flux</Label>
                        <Select value={transactionFlowFilter} onValueChange={setTransactionFlowFilter}>
                          <SelectTrigger className="bg-[#0f1528] border-gray-800/50 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#141c33] border-gray-800/50">
                            {FLOW_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option}>
                                {getFlowLabel(option)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-gray-400">Statut</Label>
                        <Select value={transactionStatusFilter} onValueChange={setTransactionStatusFilter}>
                          <SelectTrigger className="bg-[#0f1528] border-gray-800/50 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#141c33] border-gray-800/50">
                            {STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option} value={option}>
                                {option === 'all' ? t('common.all', 'Tous') : getStatusLabel(option)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-gray-400">Recherche</Label>
                        <Input
                          value={transactionSearch}
                          onChange={(event) => setTransactionSearch(event.target.value)}
                          placeholder="Référence, libellé, contrepartie..."
                          className="bg-[#0f1528] border-gray-800/50 text-white"
                        />
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid gap-4 md:grid-cols-4">
                    <Card className="bg-[#141c33] border-gray-800/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs text-gray-400 uppercase">
                          <InfoLabel info={transactionPanelInfo.currentBalance}>Solde courant</InfoLabel>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xl font-semibold text-white">
                          {formatCurrency(transactionDashboard.currentBalance, transactionDashboard.currency)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-[#141c33] border-gray-800/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs text-gray-400 uppercase">
                          <InfoLabel info={transactionPanelInfo.inflow}>Entrées</InfoLabel>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xl font-semibold text-green-400">
                          {formatCurrency(transactionDashboard.totalInflow, transactionDashboard.currency)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-[#141c33] border-gray-800/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs text-gray-400 uppercase">
                          <InfoLabel info={transactionPanelInfo.outflow}>Sorties</InfoLabel>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-xl font-semibold text-red-400">
                          {formatCurrency(transactionDashboard.totalOutflow, transactionDashboard.currency)}
                        </p>
                      </CardContent>
                    </Card>
                    <Card className="bg-[#141c33] border-gray-800/50">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs text-gray-400 uppercase">
                          <InfoLabel info={transactionPanelInfo.netFlow}>Net / opérations</InfoLabel>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p
                          className={`text-xl font-semibold ${
                            transactionDashboard.netFlow >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {formatCurrency(transactionDashboard.netFlow, transactionDashboard.currency)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">{transactionDashboard.operationCount} opérations</p>
                      </CardContent>
                    </Card>
                  </div>

                  <Card className="bg-[#141c33] border-gray-800/50">
                    <CardHeader>
                      <CardTitle className="text-white text-base">
                        <InfoLabel info={transactionPanelInfo.reportByKind}>
                          Rapport par type d&apos;opération
                        </InfoLabel>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {transactionDashboard.reportsByKind.length === 0 ? (
                        <p className="text-sm text-gray-500">Aucune donnée de rapport.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b border-gray-800 text-gray-500">
                                <th className="text-left py-2 pr-3">Type</th>
                                <th className="text-right py-2 pr-3">Nombre</th>
                                <th className="text-right py-2">Montant cumulé</th>
                              </tr>
                            </thead>
                            <tbody>
                              {transactionDashboard.reportsByKind.map((reportRow) => (
                                <tr key={reportRow.kind} className="border-b border-gray-800/40">
                                  <td className="py-2 pr-3 text-gray-200">{getKindLabel(reportRow.kind)}</td>
                                  <td className="py-2 pr-3 text-right text-gray-300">{reportRow.count}</td>
                                  <td className="py-2 text-right text-gray-100">
                                    {formatCurrency(reportRow.amount, transactionDashboard.currency)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card className="bg-[#141c33] border-gray-800/50">
                    <CardHeader>
                      <CardTitle className="text-white text-base">
                        <InfoLabel info={transactionPanelInfo.transactionRegister}>Registre des transactions</InfoLabel>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {transactionsLoading ? (
                        <div className="flex items-center justify-center py-10">
                          <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                        </div>
                      ) : transactionRows.length === 0 ? (
                        <p className="text-sm text-gray-500">Aucune transaction pour les filtres sélectionnés.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm min-w-[900px]">
                            <thead>
                              <tr className="border-b border-gray-800 text-gray-500">
                                <th className="text-left py-2 pr-3">Date</th>
                                <th className="text-left py-2 pr-3">Compte</th>
                                <th className="text-left py-2 pr-3">Type</th>
                                <th className="text-left py-2 pr-3">Flux</th>
                                <th className="text-right py-2 pr-3">Montant</th>
                                <th className="text-left py-2 pr-3">Statut</th>
                                <th className="text-left py-2 pr-3">Référence</th>
                                <th className="text-right py-2">Actions</th>
                              </tr>
                            </thead>
                            <tbody>
                              {transactionRows.map((transaction) => (
                                <tr key={transaction.id} className="border-b border-gray-800/30">
                                  <td className="py-2 pr-3 text-gray-300">{transaction.transaction_date}</td>
                                  <td className="py-2 pr-3 text-gray-200">
                                    {transaction.company_payment_instruments?.label || '-'}
                                  </td>
                                  <td className="py-2 pr-3 text-gray-300">
                                    {getKindLabel(transaction.transaction_kind)}
                                  </td>
                                  <td className="py-2 pr-3">
                                    <Badge className={getFlowBadgeClass(transaction.flow_direction)}>
                                      <span className="inline-flex items-center gap-1">
                                        {transaction.flow_direction === 'inflow' ? (
                                          <ArrowDownLeft className="h-3 w-3" />
                                        ) : (
                                          <ArrowUpRight className="h-3 w-3" />
                                        )}
                                        {getFlowLabel(transaction.flow_direction)}
                                      </span>
                                    </Badge>
                                  </td>
                                  <td
                                    className={`py-2 pr-3 text-right font-medium ${
                                      transaction.flow_direction === 'inflow' ? 'text-green-400' : 'text-red-400'
                                    }`}
                                  >
                                    {transaction.flow_direction === 'inflow' ? '+' : '-'}
                                    {formatCurrency(
                                      transaction.amount,
                                      transaction.currency || transactionDashboard.currency
                                    )}
                                  </td>
                                  <td className="py-2 pr-3 text-gray-300">{getStatusLabel(transaction.status)}</td>
                                  <td className="py-2 pr-3 text-gray-400">{transaction.reference || '-'}</td>
                                  <td className="py-2 text-right">
                                    <div className="inline-flex gap-1">
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-gray-400 hover:text-white"
                                        onClick={() => openEditTransactionDialog(transaction)}
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </Button>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-8 w-8 text-red-400 hover:text-red-300"
                                        onClick={() => handleDeleteTransaction(transaction.id)}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </>
            )}
          </Tabs>
        </motion.div>

        {/* Dialogs */}
        <BankAccountForm
          open={bankFormOpen}
          onOpenChange={setBankFormOpen}
          instrument={editingInstrument}
          onSubmit={handleBankSubmit}
        />

        <CardForm
          open={cardFormOpen}
          onOpenChange={setCardFormOpen}
          instrument={editingInstrument}
          onSubmit={handleCardSubmit}
        />

        <CashForm
          open={cashFormOpen}
          onOpenChange={setCashFormOpen}
          instrument={editingInstrument}
          onSubmit={handleCashSubmit}
        />

        <TransferDialog
          open={transferOpen}
          onOpenChange={setTransferOpen}
          instruments={instruments}
          onSubmit={handleTransferSubmit}
        />

        <Dialog open={transactionDialogOpen} onOpenChange={setTransactionDialogOpen}>
          <DialogContent className="bg-[#141c33] border-gray-800/50 text-white sm:max-w-2xl w-[95vw]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-white">
                <FileText className="h-5 w-5 text-amber-500" />
                {editingTransaction
                  ? t('financialInstruments.transactions.editTransaction', 'Modifier la transaction')
                  : t('paymentTransactions.newTransaction', 'Nouvelle transaction')}
              </DialogTitle>
            </DialogHeader>

            <form onSubmit={handleTransactionSubmit} className="space-y-4 mt-2">
              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-gray-400">Compte / moyen *</Label>
                  <Select
                    value={transactionForm.payment_instrument_id}
                    onValueChange={(value) => handleTransactionFieldChange('payment_instrument_id', value)}
                  >
                    <SelectTrigger className="bg-[#0f1528] border-gray-800/50 text-white">
                      <SelectValue placeholder="Sélectionner un compte" />
                    </SelectTrigger>
                    <SelectContent className="bg-[#141c33] border-gray-800/50">
                      {activeInstruments.map((instrument) => (
                        <SelectItem key={instrument.id} value={instrument.id}>
                          {instrument.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-gray-400">Type *</Label>
                  <Select
                    value={transactionForm.transaction_kind}
                    onValueChange={(value) => handleTransactionFieldChange('transaction_kind', value)}
                  >
                    <SelectTrigger className="bg-[#0f1528] border-gray-800/50 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#141c33] border-gray-800/50">
                      {KIND_OPTIONS.map((option) => (
                        <SelectItem key={option} value={option}>
                          {getKindLabel(option)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid md:grid-cols-4 gap-3">
                <div className="space-y-1.5 md:col-span-1">
                  <Label className="text-gray-400">Montant *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={transactionForm.amount}
                    onChange={(event) => handleTransactionFieldChange('amount', event.target.value)}
                    className="bg-[#0f1528] border-gray-800/50 text-white"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-1">
                  <Label className="text-gray-400">Statut</Label>
                  <Select
                    value={transactionForm.status}
                    onValueChange={(value) => handleTransactionFieldChange('status', value)}
                  >
                    <SelectTrigger className="bg-[#0f1528] border-gray-800/50 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[#141c33] border-gray-800/50">
                      {STATUS_OPTIONS.filter((option) => option !== 'all').map((option) => (
                        <SelectItem key={option} value={option}>
                          {getStatusLabel(option)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5 md:col-span-1">
                  <Label className="text-gray-400">Date opération *</Label>
                  <Input
                    type="date"
                    required
                    value={transactionForm.transaction_date}
                    onChange={(event) => handleTransactionFieldChange('transaction_date', event.target.value)}
                    className="bg-[#0f1528] border-gray-800/50 text-white"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-1">
                  <Label className="text-gray-400">Date valeur</Label>
                  <Input
                    type="date"
                    value={transactionForm.value_date}
                    onChange={(event) => handleTransactionFieldChange('value_date', event.target.value)}
                    className="bg-[#0f1528] border-gray-800/50 text-white"
                  />
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-gray-400">Référence</Label>
                  <Input
                    value={transactionForm.reference}
                    onChange={(event) => handleTransactionFieldChange('reference', event.target.value)}
                    className="bg-[#0f1528] border-gray-800/50 text-white"
                    placeholder="N° de pièce, libellé banque..."
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-gray-400">Contrepartie</Label>
                  <Input
                    value={transactionForm.counterparty_name}
                    onChange={(event) => handleTransactionFieldChange('counterparty_name', event.target.value)}
                    className="bg-[#0f1528] border-gray-800/50 text-white"
                    placeholder="Client, fournisseur, banque..."
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-400">Description</Label>
                <Input
                  value={transactionForm.description}
                  onChange={(event) => handleTransactionFieldChange('description', event.target.value)}
                  className="bg-[#0f1528] border-gray-800/50 text-white"
                  placeholder="Description de l'opération"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-gray-400">Notes</Label>
                <Textarea
                  value={transactionForm.notes}
                  onChange={(event) => handleTransactionFieldChange('notes', event.target.value)}
                  className="bg-[#0f1528] border-gray-800/50 text-white min-h-[90px]"
                  placeholder="Commentaires internes"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="border-gray-700 text-gray-300 hover:bg-gray-800 hover:text-white"
                  onClick={() => setTransactionDialogOpen(false)}
                >
                  {t('common.cancel', 'Annuler')}
                </Button>
                <Button
                  type="submit"
                  className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
                  disabled={!transactionForm.payment_instrument_id || Number(transactionForm.amount || 0) <= 0}
                >
                  {editingTransaction
                    ? t('common.save', 'Enregistrer')
                    : t('financialInstruments.transactions.create', 'Créer la transaction')}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        <BankStatementUploadModal
          open={statementUploadOpen}
          onOpenChange={setStatementUploadOpen}
          onUploadComplete={handleStatementUploadComplete}
          instruments={activeInstruments}
          selectedInstrumentId={selectedUploadInstrumentId}
          onSelectedInstrumentIdChange={setSelectedUploadInstrumentId}
        />
      </div>
    </>
  );
};

export default FinancialInstrumentsPage;
