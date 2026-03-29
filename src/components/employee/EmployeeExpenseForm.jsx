import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Receipt,
  PlusCircle,
  Trash2,
  Upload,
  Loader2,
  X,
  CheckCircle,
  Clock,
  XCircle,
  DollarSign,
  Send,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getLocale, formatDate } from '@/utils/dateLocale';

const EXPENSE_CATEGORIES = [
  'transport',
  'meals',
  'accommodation',
  'office_supplies',
  'communication',
  'training',
  'subscriptions',
  'other',
];

const formatMoney = (value, currency = 'EUR') => {
  const num = Number(value);
  if (!Number.isFinite(num)) return '---';
  return new Intl.NumberFormat(getLocale(), {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(num);
};

const StatusIcon = ({ status }) => {
  switch (status) {
    case 'approved':
    case 'reimbursed':
      return <CheckCircle className="w-4 h-4 text-emerald-400" />;
    case 'submitted':
      return <Clock className="w-4 h-4 text-yellow-400" />;
    case 'rejected':
      return <XCircle className="w-4 h-4 text-red-400" />;
    default:
      return <Clock className="w-4 h-4 text-gray-400" />;
  }
};

const statusColors = {
  draft: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  submitted: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
  reimbursed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
};

const ExpenseReportCard = ({ report }) => {
  const { t } = useTranslation();
  const items = report.items || [];

  return (
    <div className="bg-[#141c33]/60 rounded-lg border border-white/5 p-4 hover:border-white/10 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <StatusIcon status={report.status} />
          <h4 className="text-sm font-medium text-white truncate max-w-[200px]">{report.title}</h4>
        </div>
        <span
          className={`text-xs px-2 py-0.5 rounded-full border ${statusColors[report.status] || statusColors.draft}`}
        >
          {t(`employee.expense.status.${report.status}`, report.status)}
        </span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-400">
          {items.length} {t('employee.expense.items', 'poste(s)')} -
          {report.submitted_at ? ` ${formatDate(report.submitted_at)}` : ''}
        </span>
        <span className="text-sm font-semibold text-white">{formatMoney(report.total_amount, report.currency)}</span>
      </div>
    </div>
  );
};

const ExpenseItemRow = ({ item, index, onChange, onRemove }) => {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-12 gap-2 items-end">
      <div className="col-span-12 sm:col-span-4">
        <label className="block text-xs text-gray-400 mb-1">{t('employee.expense.description', 'Description')}</label>
        <input
          type="text"
          value={item.description}
          onChange={(e) => onChange(index, 'description', e.target.value)}
          className="w-full bg-[#0a0e1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          placeholder={t('employee.expense.descriptionPlaceholder', 'Ex: Taxi client')}
          required
        />
      </div>
      <div className="col-span-6 sm:col-span-2">
        <label className="block text-xs text-gray-400 mb-1">{t('employee.expense.amount', 'Montant')}</label>
        <input
          type="number"
          step="0.01"
          min="0"
          value={item.amount}
          onChange={(e) => onChange(index, 'amount', e.target.value)}
          className="w-full bg-[#0a0e1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
          placeholder="0.00"
          required
        />
      </div>
      <div className="col-span-6 sm:col-span-2">
        <label className="block text-xs text-gray-400 mb-1">{t('employee.expense.category', 'Categorie')}</label>
        <select
          value={item.category}
          onChange={(e) => onChange(index, 'category', e.target.value)}
          className="w-full bg-[#0a0e1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        >
          <option value="">{t('employee.expense.selectCategory', '---')}</option>
          {EXPENSE_CATEGORIES.map((cat) => (
            <option key={cat} value={cat}>
              {t(`employee.expense.categories.${cat}`, cat)}
            </option>
          ))}
        </select>
      </div>
      <div className="col-span-6 sm:col-span-2">
        <label className="block text-xs text-gray-400 mb-1">{t('employee.expense.date', 'Date')}</label>
        <input
          type="date"
          value={item.date}
          onChange={(e) => onChange(index, 'date', e.target.value)}
          className="w-full bg-[#0a0e1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
        />
      </div>
      <div className="col-span-6 sm:col-span-2 flex items-end gap-1">
        <label className="block text-xs text-gray-400 mb-1 sm:hidden">{t('employee.expense.receipt', 'Recu')}</label>
        <button
          type="button"
          className="flex-1 bg-[#0a0e1a] border border-white/10 rounded-lg px-3 py-2 text-xs text-gray-400 hover:text-white hover:border-white/20 transition-colors flex items-center gap-1 justify-center"
          title={t('employee.expense.uploadReceipt', 'Joindre un recu')}
        >
          <Upload className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t('employee.expense.receipt', 'Recu')}</span>
        </button>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
          title={t('common.delete', 'Supprimer')}
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

const EmployeeExpenseForm = ({ expenseReports, onSubmitExpense }) => {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([{ description: '', amount: '', category: '', date: '', receiptUrl: '' }]);

  const totalAmount = items.reduce((sum, item) => sum + (Number(item.amount) || 0), 0);

  const handleItemChange = useCallback((index, field, value) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  }, []);

  const handleAddItem = () => {
    setItems((prev) => [...prev, { description: '', amount: '', category: '', date: '', receiptUrl: '' }]);
  };

  const handleRemoveItem = (index) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || items.length === 0) return;

    const validItems = items.filter((item) => item.description.trim() && Number(item.amount) > 0);
    if (validItems.length === 0) return;

    setSubmitting(true);
    try {
      await onSubmitExpense({
        title: title.trim(),
        items: validItems.map((item) => ({
          description: item.description.trim(),
          amount: Number(item.amount),
          category: item.category || null,
          date: item.date || null,
          receiptUrl: item.receiptUrl || null,
        })),
        notes: notes.trim() || null,
      });
      // Reset form
      setTitle('');
      setNotes('');
      setItems([{ description: '', amount: '', category: '', date: '', receiptUrl: '' }]);
      setShowForm(false);
    } catch {
      // Error toasted in hook
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-[#0f1528]/80 backdrop-blur-xl rounded-xl border border-white/10 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-purple-400" />
          <h3 className="text-sm font-semibold text-white">{t('employee.expense.title', 'Notes de frais')}</h3>
        </div>
        {!showForm && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowForm(true)}
            className="text-purple-400 hover:text-purple-300 hover:bg-purple-500/10"
          >
            <PlusCircle className="w-4 h-4 mr-1" />
            {t('employee.expense.new', 'Nouvelle note')}
          </Button>
        )}
      </div>

      {/* Existing reports list */}
      {expenseReports && expenseReports.length > 0 && !showForm && (
        <div className="space-y-2 mb-4 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
          {expenseReports.map((report) => (
            <ExpenseReportCard key={report.id} report={report} />
          ))}
        </div>
      )}

      {!showForm && (!expenseReports || expenseReports.length === 0) && (
        <div className="text-center py-6">
          <Receipt className="w-10 h-10 text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-400">{t('employee.expense.empty', 'Aucune note de frais.')}</p>
          <p className="text-xs text-gray-500 mt-1">
            {t('employee.expense.emptyHint', 'Creez votre premiere note de frais ci-dessus.')}
          </p>
        </div>
      )}

      {/* New expense form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-[#141c33]/80 rounded-lg p-4 border border-purple-500/20 space-y-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-semibold text-white">
              {t('employee.expense.newForm', 'Nouvelle note de frais')}
            </h4>
            <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-white">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div>
            <label className="block text-xs text-gray-400 mb-1">
              {t('employee.expense.reportTitle', 'Titre de la note')}
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-[#0a0e1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              placeholder={t('employee.expense.titlePlaceholder', 'Ex: Deplacement client Mars 2026')}
              required
            />
          </div>

          {/* Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                {t('employee.expense.lineItems', 'Lignes de depense')}
              </label>
              <button
                type="button"
                onClick={handleAddItem}
                className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                {t('employee.expense.addLine', 'Ajouter une ligne')}
              </button>
            </div>

            {items.map((item, idx) => (
              <ExpenseItemRow
                key={idx}
                item={item}
                index={idx}
                onChange={handleItemChange}
                onRemove={handleRemoveItem}
              />
            ))}
          </div>

          {/* Total */}
          <div className="flex items-center justify-between bg-[#0a0e1a]/80 rounded-lg px-4 py-3 border border-white/5">
            <div className="flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-300">{t('employee.expense.total', 'Total')}</span>
            </div>
            <span className="text-lg font-bold text-white">{formatMoney(totalAmount)}</span>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs text-gray-400 mb-1">
              {t('employee.expense.notes', 'Commentaires (optionnel)')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full bg-[#0a0e1a] border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 resize-none"
              placeholder={t('employee.expense.notesPlaceholder', 'Informations complementaires...')}
            />
          </div>

          {/* Submit */}
          <Button
            type="submit"
            disabled={submitting || !title.trim() || items.length === 0}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            {t('employee.expense.submit', 'Soumettre la note de frais')}
          </Button>
        </form>
      )}
    </div>
  );
};

export default EmployeeExpenseForm;
