import React, { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useExpenses } from '@/hooks/useExpenses';
import { useSuppliers } from '@/hooks/useSuppliers';
import { useDebounce } from '@/hooks/useDebounce';
import { useCompany } from '@/hooks/useCompany';
import { formatDate } from '@/utils/dateLocale';
import { getCurrencySymbol } from '@/utils/currencyService';
import { resolveAccountingCurrency } from '@/services/databaseCurrencyService';
import { useCreditsGuard, CREDIT_COSTS } from '@/hooks/useCreditsGuard';
import CreditsGuardModal from '@/components/CreditsGuardModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Plus,
  Search,
  Receipt,
  Loader2,
  Trash2,
  List,
  CalendarDays,
  CalendarClock,
  Download,
  FileText,
  Eye,
  Pencil,
  MoreHorizontal,
} from 'lucide-react';
import { formatCurrency } from '@/utils/calculations';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import GenericCalendarView from '@/components/GenericCalendarView';
import GenericAgendaView from '@/components/GenericAgendaView';
import { exportExpensesListPDF, exportExpensesListHTML } from '@/services/exportListsPDF';
import ExportButton from '@/components/ExportButton';
import { usePagination } from '@/hooks/usePagination';
import PaginationControls from '@/components/PaginationControls';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { formatDateInput } from '@/utils/dateFormatting';
import VirtualizedTable from '@/components/VirtualizedTable';
import SectionErrorBoundary from '@/components/SectionErrorBoundary';

const ExpenseActions = ({ expense, onView, onEdit, onDelete, onExportPDF, onExportHTML }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-1 min-w-[160px]">
            <button
              onClick={() => {
                onView(expense);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              <Eye className="w-3.5 h-3.5" /> Visualiser
            </button>
            <button
              onClick={() => {
                onEdit(expense);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              <Pencil className="w-3.5 h-3.5" /> Modifier
            </button>
            <button
              onClick={() => {
                onExportPDF(expense);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              <Download className="w-3.5 h-3.5" /> Export PDF
            </button>
            <button
              onClick={() => {
                onExportHTML(expense);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white"
            >
              <FileText className="w-3.5 h-3.5" /> Export HTML
            </button>
            <div className="border-t border-gray-700 my-1" />
            <button
              onClick={() => {
                onDelete(expense);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300"
            >
              <Trash2 className="w-3.5 h-3.5" /> Supprimer
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const ExpensesPage = () => {
  const { t } = useTranslation();
  const { expenses, loading, createExpense, updateExpense, deleteExpense } = useExpenses();
  const { suppliers } = useSuppliers();
  const { company } = useCompany();
  const { guardedAction, modalProps } = useCreditsGuard();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState('list');
  const [viewExpense, setViewExpense] = useState(null);
  const [editExpense, setEditExpense] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const companyCurrency = resolveAccountingCurrency(company);

  // Get company currency symbol
  const currencySymbol = getCurrencySymbol(companyCurrency);

  const emptyForm = {
    description: '',
    amount: '',
    category: 'general',
    expense_date: formatDateInput(),
    notes: '',
    supplier_id: '',
  };
  const [formData, setFormData] = useState(emptyForm);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createExpense({
        ...formData,
        amount: parseFloat(formData.amount),
        expense_date: formData.expense_date,
        supplier_id: formData.supplier_id || null,
      });
      setIsDialogOpen(false);
      setFormData(emptyForm);
    } catch (err) {
      console.error('Error creating expense:', err);
    }
  };

  const handleExportPDF = () => {
    guardedAction(CREDIT_COSTS.PDF_REPORT, 'Expenses List PDF', async () => {
      await exportExpensesListPDF(filteredExpenses, company, { searchTerm });
    });
  };

  const handleExportHTML = () => {
    guardedAction(CREDIT_COSTS.EXPORT_HTML, 'Expenses List HTML', () => {
      exportExpensesListHTML(filteredExpenses, company, { searchTerm });
    });
  };

  const handleView = (exp) => setViewExpense(exp);

  const handleEdit = (exp) => {
    setEditExpense(exp);
    setFormData({
      description: exp.description || '',
      amount: exp.amount || '',
      category: exp.category || 'general',
      expense_date: exp.expense_date || formatDateInput(),
      notes: exp.notes || '',
      supplier_id: exp.supplier_id || '',
    });
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      await updateExpense(editExpense.id, {
        description: formData.description,
        amount: parseFloat(formData.amount),
        category: formData.category,
        expense_date: formData.expense_date,
        notes: formData.notes,
        supplier_id: formData.supplier_id || null,
      });
      setEditExpense(null);
      setFormData(emptyForm);
    } catch (err) {
      console.error('Error updating expense:', err);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteExpense(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      console.error('Error deleting expense:', err);
    }
  };

  const handleSingleExportPDF = (exp) => {
    guardedAction(CREDIT_COSTS.PDF_REPORT, 'Single Expense PDF', async () => {
      await exportExpensesListPDF([exp], company, { searchTerm: '' });
    });
  };

  const handleSingleExportHTML = (exp) => {
    guardedAction(CREDIT_COSTS.EXPORT_HTML, 'Single Expense HTML', () => {
      exportExpensesListHTML([exp], company, { searchTerm: '' });
    });
  };

  const pagination = usePagination({ pageSize: 25 });
  const { setTotalCount } = pagination;

  const filteredExpenses = useMemo(
    () =>
      expenses.filter(
        (exp) =>
          (exp.description || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          (exp.supplier?.company_name || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          (exp.category || '').toLowerCase().includes(debouncedSearchTerm.toLowerCase())
      ),
    [expenses, debouncedSearchTerm]
  );

  // Update pagination when filtered expenses change
  React.useEffect(() => {
    setTotalCount(filteredExpenses.length);
  }, [filteredExpenses.length, setTotalCount]);

  const paginatedExpenses = useMemo(
    () => filteredExpenses.slice(pagination.from, pagination.to + 1),
    [filteredExpenses, pagination.from, pagination.to]
  );

  const expenseExportColumns = [
    { key: 'description', header: 'Description', width: 30 },
    { key: 'category', header: t('debtManager.category', 'Category'), width: 15 },
    { key: 'amount', header: t('payments.amount', 'Amount'), type: 'currency', width: 14 },
    { key: 'expense_date', header: 'Date', type: 'date', width: 12 },
    { key: 'supplier', header: 'Fournisseur', width: 20, accessor: (exp) => exp.supplier?.company_name || '' },
    { key: 'notes', header: 'Notes', width: 25 },
  ];

  const totalExpenses = useMemo(
    () => filteredExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0),
    [filteredExpenses]
  );

  const expenseCategoryColors = {
    general: { bg: '#6b7280', border: '#4b5563', text: '#fff' },
    office: { bg: '#3b82f6', border: '#2563eb', text: '#fff' },
    travel: { bg: '#8b5cf6', border: '#7c3aed', text: '#fff' },
    software: { bg: '#06b6d4', border: '#0891b2', text: '#fff' },
    hardware: { bg: '#f97316', border: '#ea580c', text: '#fff' },
    marketing: { bg: '#ec4899', border: '#db2777', text: '#fff' },
    meals: { bg: '#eab308', border: '#ca8a04', text: '#000' },
    telecom: { bg: '#14b8a6', border: '#0d9488', text: '#fff' },
    insurance: { bg: '#ef4444', border: '#dc2626', text: '#fff' },
    other: { bg: '#a855f7', border: '#9333ea', text: '#fff' },
  };

  const expenseCalendarLegend = [
    { label: 'General', color: '#6b7280' },
    { label: 'Office', color: '#3b82f6' },
    { label: 'Travel', color: '#8b5cf6' },
    { label: 'Software', color: '#06b6d4' },
    { label: 'Marketing', color: '#ec4899' },
  ];

  const expenseCalendarEvents = useMemo(
    () =>
      filteredExpenses.map((exp) => ({
        id: exp.id,
        title: exp.description || exp.category || 'Expense',
        date: exp.expense_date,
        status: exp.category || 'general',
        resource: exp,
      })),
    [filteredExpenses]
  );

  const expenseAgendaItems = useMemo(
    () =>
      filteredExpenses.map((exp) => ({
        id: exp.id,
        title: exp.description || 'Expense',
        subtitle: exp.supplier?.company_name || exp.category || '',
        date: exp.expense_date,
        status: exp.category || 'general',
        statusLabel: (exp.category || 'general').charAt(0).toUpperCase() + (exp.category || 'general').slice(1),
        statusColor: 'bg-orange-500/20 text-orange-400',
        amount: formatCurrency(exp.amount || 0, companyCurrency),
      })),
    [filteredExpenses, companyCurrency]
  );

  if (loading && expenses.length === 0) {
    return (
      <div className="flex items-center justify-center h-full min-h-[500px]">
        <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <CreditsGuardModal {...modalProps} />
      <Helmet>
        <title>Dépenses - CashPilot</title>
      </Helmet>

      <div className="p-4 sm:p-6 lg:p-8 min-h-screen bg-gray-950 text-white space-y-6">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-gradient">Dépenses</h1>
              <p className="text-gray-400 mt-1 text-sm">Gérez et suivez vos dépenses professionnelles.</p>
            </div>
            <div className="flex gap-2 flex-wrap">
              <ExportButton
                data={filteredExpenses}
                columns={expenseExportColumns}
                filename={t('export.filename.expenses', 'expenses')}
              />
              <Button
                onClick={handleExportPDF}
                size="sm"
                variant="outline"
                className="border-gray-600 hover:bg-gray-700"
              >
                <Download className="w-4 h-4 mr-2" />
                PDF ({CREDIT_COSTS.PDF_REPORT})
              </Button>
              <Button
                onClick={handleExportHTML}
                size="sm"
                variant="outline"
                className="border-gray-600 hover:bg-gray-700"
              >
                <FileText className="w-4 h-4 mr-2" />
                HTML ({CREDIT_COSTS.EXPORT_HTML})
              </Button>
              <Button onClick={() => setIsDialogOpen(true)} className="bg-orange-500 hover:bg-orange-600">
                <Plus className="w-4 h-4 mr-2" /> Nouvelle dépense
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800/50">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Total des dépenses</p>
            <p className="text-2xl font-bold text-gradient">{formatCurrency(totalExpenses, companyCurrency)}</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800/50">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Nombre de dépenses</p>
            <p className="text-2xl font-bold text-gradient">{filteredExpenses.length}</p>
          </div>
          <div className="bg-gray-900 rounded-xl p-5 border border-gray-800/50">
            <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Moyenne par dépense</p>
            <p className="text-2xl font-bold text-gradient">
              {filteredExpenses.length > 0
                ? formatCurrency(totalExpenses / filteredExpenses.length, companyCurrency)
                : formatCurrency(0, companyCurrency)}
            </p>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher une dépense..."
            className="pl-10 bg-gray-900 border-gray-800 text-white"
          />
        </div>

        <SectionErrorBoundary section="expense-views">
          <Tabs value={viewMode} onValueChange={setViewMode} className="w-full">
            <TabsList className="bg-gray-800 border border-gray-700 mb-4">
              <TabsTrigger
                value="list"
                className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400"
              >
                <List className="w-4 h-4 mr-2" /> {t('common.list') || 'Liste'}
              </TabsTrigger>
              <TabsTrigger
                value="calendar"
                className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400"
              >
                <CalendarDays className="w-4 h-4 mr-2" /> {t('common.calendar') || 'Calendrier'}
              </TabsTrigger>
              <TabsTrigger
                value="agenda"
                className="data-[state=active]:bg-orange-500 data-[state=active]:text-white text-gray-400"
              >
                <CalendarClock className="w-4 h-4 mr-2" /> {t('common.agenda') || 'Agenda'}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="list">
              {filteredExpenses.length === 0 ? (
                <div className="text-center py-16">
                  <Receipt className="w-16 h-16 mx-auto text-gray-700 mb-4" />
                  <p className="text-gray-500">Aucune dépense trouvée</p>
                  <Button onClick={() => setIsDialogOpen(true)} className="mt-4 bg-orange-500 hover:bg-orange-600">
                    <Plus className="w-4 h-4 mr-2" /> Ajouter une dépense
                  </Button>
                </div>
              ) : (
                <div className="bg-gray-900 rounded-xl border border-gray-800/50 overflow-hidden">
                  <VirtualizedTable
                    data={paginatedExpenses}
                    rowHeight={56}
                    maxHeight={700}
                    threshold={30}
                    header={
                      <div className="flex items-center border-b border-gray-800 text-sm">
                        <div className="p-4 text-gray-400 font-medium" style={{ flex: 1 }}>
                          Date
                        </div>
                        <div className="p-4 text-gray-400 font-medium" style={{ flex: 2 }}>
                          Description
                        </div>
                        <div className="p-4 text-gray-400 font-medium hidden md:block" style={{ flex: 1 }}>
                          Catégorie
                        </div>
                        <div className="p-4 text-gray-400 font-medium hidden lg:block" style={{ flex: 1.5 }}>
                          Fournisseur
                        </div>
                        <div className="p-4 text-gray-400 font-medium text-right" style={{ flex: 1 }}>
                          Montant
                        </div>
                        <div className="p-4 text-gray-400 font-medium text-right" style={{ width: 64 }}>
                          Actions
                        </div>
                      </div>
                    }
                    renderRow={(exp, index, style) => (
                      <div
                        key={exp.id}
                        style={style}
                        className="flex items-center border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors text-sm"
                      >
                        <div className="p-4 text-gray-400 truncate" style={{ flex: 1 }}>
                          {exp.expense_date ? formatDate(exp.expense_date) : '—'}
                        </div>
                        <div className="p-4 text-gradient font-medium truncate" style={{ flex: 2 }}>
                          {exp.description || '—'}
                        </div>
                        <div className="p-4 text-gray-400 capitalize truncate hidden md:block" style={{ flex: 1 }}>
                          {exp.category || '—'}
                        </div>
                        <div className="p-4 text-gray-400 truncate hidden lg:block" style={{ flex: 1.5 }}>
                          {exp.supplier?.company_name || '—'}
                        </div>
                        <div className="p-4 text-right text-gradient font-semibold truncate" style={{ flex: 1 }}>
                          {formatCurrency(exp.amount || 0, companyCurrency)}
                        </div>
                        <div className="p-4 text-right" style={{ width: 64 }}>
                          <ExpenseActions
                            expense={exp}
                            onView={handleView}
                            onEdit={handleEdit}
                            onDelete={setDeleteTarget}
                            onExportPDF={handleSingleExportPDF}
                            onExportHTML={handleSingleExportHTML}
                          />
                        </div>
                      </div>
                    )}
                  />
                  <PaginationControls
                    currentPage={pagination.currentPage}
                    totalPages={pagination.totalPages}
                    totalCount={pagination.totalCount}
                    pageSize={pagination.pageSize}
                    pageSizeOptions={pagination.pageSizeOptions}
                    hasNextPage={pagination.hasNextPage}
                    hasPrevPage={pagination.hasPrevPage}
                    onNextPage={pagination.nextPage}
                    onPrevPage={pagination.prevPage}
                    onGoToPage={pagination.goToPage}
                    onChangePageSize={pagination.changePageSize}
                  />
                </div>
              )}
            </TabsContent>

            <TabsContent value="calendar">
              <GenericCalendarView
                events={expenseCalendarEvents}
                statusColors={expenseCategoryColors}
                legend={expenseCalendarLegend}
                onSelectEvent={(exp) => handleView(exp)}
              />
            </TabsContent>

            <TabsContent value="agenda">
              <GenericAgendaView
                items={expenseAgendaItems}
                dateField="date"
                paidStatuses={[]}
                renderActions={(item) => {
                  const exp = expenses.find((e) => e.id === item.id);
                  if (!exp) return null;
                  return (
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleView(exp)}
                        className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white"
                        title="Visualiser"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleEdit(exp)}
                        className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white"
                        title="Modifier"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleSingleExportPDF(exp)}
                        className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white"
                        title="PDF"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleSingleExportHTML(exp)}
                        className="p-1.5 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-white"
                        title="HTML"
                      >
                        <FileText className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setDeleteTarget(exp)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-400 hover:text-red-300"
                        title="Supprimer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                }}
              />
            </TabsContent>
          </Tabs>
        </SectionErrorBoundary>
      </div>

      {/* View Expense Dialog */}
      <Dialog open={!!viewExpense} onOpenChange={() => setViewExpense(null)}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gradient">Détails de la dépense</DialogTitle>
          </DialogHeader>
          {viewExpense && (
            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Description</p>
                  <p className="text-white font-medium">{viewExpense.description || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Montant</p>
                  <p className="text-gradient font-bold text-lg">
                    {formatCurrency(viewExpense.amount || 0, companyCurrency)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Date</p>
                  <p className="text-white">{viewExpense.expense_date ? formatDate(viewExpense.expense_date) : '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Catégorie</p>
                  <p className="text-white capitalize">{viewExpense.category || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Fournisseur</p>
                  <p className="text-white">{viewExpense.supplier?.company_name || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase">Méthode de paiement</p>
                  <p className="text-white capitalize">{viewExpense.payment_method || '—'}</p>
                </div>
                {viewExpense.amount_ht != null && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Montant HT</p>
                    <p className="text-white">{formatCurrency(viewExpense.amount_ht, companyCurrency)}</p>
                  </div>
                )}
                {viewExpense.tax_amount != null && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase">TVA</p>
                    <p className="text-white">
                      {formatCurrency(viewExpense.tax_amount, companyCurrency)} (
                      {((viewExpense.tax_rate || 0) * 100).toFixed(0)}%)
                    </p>
                  </div>
                )}
              </div>
              {viewExpense.notes && (
                <div>
                  <p className="text-xs text-gray-500 uppercase">Notes</p>
                  <p className="text-gray-300 text-sm mt-1">{viewExpense.notes}</p>
                </div>
              )}
              <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="border-gray-600"
                  onClick={() => {
                    handleSingleExportPDF(viewExpense);
                  }}
                >
                  <Download className="w-4 h-4 mr-2" /> PDF
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="border-gray-600"
                  onClick={() => {
                    handleSingleExportHTML(viewExpense);
                  }}
                >
                  <FileText className="w-4 h-4 mr-2" /> HTML
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    handleEdit(viewExpense);
                    setViewExpense(null);
                  }}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  <Pencil className="w-4 h-4 mr-2" /> Modifier
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Expense Dialog */}
      <Dialog
        open={!!editExpense}
        onOpenChange={() => {
          setEditExpense(null);
          setFormData(emptyForm);
        }}
      >
        <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gradient">Modifier la dépense</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Description *</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  placeholder="Achat de fournitures..."
                  className="bg-gray-700 border-gray-600"
                />
              </div>
              <div className="space-y-2">
                <Label>Montant ({currencySymbol}) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                  placeholder="0.00"
                  className="bg-gray-700 border-gray-600"
                />
              </div>
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={formData.expense_date}
                  onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                  required
                  className="bg-gray-700 border-gray-600"
                />
              </div>
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Select value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val })}>
                  <SelectTrigger className="bg-gray-700 border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="general">Général</SelectItem>
                    <SelectItem value="office">Bureau</SelectItem>
                    <SelectItem value="travel">Déplacement</SelectItem>
                    <SelectItem value="software">Logiciels</SelectItem>
                    <SelectItem value="hardware">Matériel</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="meals">Repas</SelectItem>
                    <SelectItem value="telecom">Télécom</SelectItem>
                    <SelectItem value="insurance">Assurance</SelectItem>
                    <SelectItem value="rent">Loyer</SelectItem>
                    <SelectItem value="consulting">Consulting</SelectItem>
                    <SelectItem value="operations">Opérations</SelectItem>
                    <SelectItem value="other">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fournisseur</Label>
                <Select
                  value={formData.supplier_id || '__none__'}
                  onValueChange={(val) => setFormData({ ...formData, supplier_id: val === '__none__' ? '' : val })}
                >
                  <SelectTrigger className="bg-gray-700 border-gray-600">
                    <SelectValue placeholder="Sélectionner un fournisseur" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white max-h-60">
                    <SelectItem value="__none__">— Aucun —</SelectItem>
                    {(suppliers || []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Notes optionnelles..."
                  rows={2}
                  className="bg-gray-700 border-gray-600"
                />
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setEditExpense(null);
                  setFormData(emptyForm);
                }}
                className="border-gray-600 text-gray-300"
              >
                Annuler
              </Button>
              <Button type="submit" className="bg-orange-500 hover:bg-orange-600">
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent className="bg-gray-800 border-gray-700 text-white">
          <AlertDialogHeader>
            <AlertDialogTitle>Supprimer cette dépense ?</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-400">
              {deleteTarget && (
                <>
                  Vous allez supprimer <strong className="text-white">"{deleteTarget.description}"</strong> (
                  {formatCurrency(deleteTarget.amount || 0, companyCurrency)}). Cette action est irréversible.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-gray-600 text-gray-300 hover:bg-gray-700">Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-red-600 hover:bg-red-700 text-white">
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Add Expense Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold text-gradient">Nouvelle dépense</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2 sm:col-span-2">
                <Label>Description *</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  required
                  placeholder="Achat de fournitures..."
                  className="bg-gray-700 border-gray-600"
                />
              </div>
              <div className="space-y-2">
                <Label>Montant ({currencySymbol}) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  required
                  placeholder="0.00"
                  className="bg-gray-700 border-gray-600"
                />
              </div>
              <div className="space-y-2">
                <Label>Date *</Label>
                <Input
                  type="date"
                  value={formData.expense_date}
                  onChange={(e) => setFormData({ ...formData, expense_date: e.target.value })}
                  required
                  className="bg-gray-700 border-gray-600"
                />
              </div>
              <div className="space-y-2">
                <Label>Catégorie</Label>
                <Select value={formData.category} onValueChange={(val) => setFormData({ ...formData, category: val })}>
                  <SelectTrigger className="bg-gray-700 border-gray-600">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white">
                    <SelectItem value="general">Général</SelectItem>
                    <SelectItem value="office">Bureau</SelectItem>
                    <SelectItem value="travel">Déplacement</SelectItem>
                    <SelectItem value="software">Logiciels</SelectItem>
                    <SelectItem value="hardware">Matériel</SelectItem>
                    <SelectItem value="marketing">Marketing</SelectItem>
                    <SelectItem value="meals">Repas</SelectItem>
                    <SelectItem value="telecom">Télécom</SelectItem>
                    <SelectItem value="insurance">Assurance</SelectItem>
                    <SelectItem value="other">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Fournisseur</Label>
                <Select
                  value={formData.supplier_id || '__none__'}
                  onValueChange={(val) => setFormData({ ...formData, supplier_id: val === '__none__' ? '' : val })}
                >
                  <SelectTrigger className="bg-gray-700 border-gray-600">
                    <SelectValue placeholder="Sélectionner un fournisseur" />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 border-gray-700 text-white max-h-60">
                    <SelectItem value="__none__">— Aucun —</SelectItem>
                    {(suppliers || []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.company_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Notes</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Notes optionnelles..."
                  rows={2}
                  className="bg-gray-700 border-gray-600"
                />
              </div>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                className="border-gray-600 text-gray-300"
              >
                Annuler
              </Button>
              <Button type="submit" className="bg-orange-500 hover:bg-orange-600">
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ExpensesPage;
