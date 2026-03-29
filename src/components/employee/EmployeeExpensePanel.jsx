import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Receipt, PlusCircle, CheckCircle, Clock, XCircle, X, Loader2, Send, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/calculations';
import { formatDate } from '@/utils/dateLocale';

const STATUS_COLORS = {
  draft: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
  submitted: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
  reimbursed: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
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

const EmployeeExpensePanel = ({ expenseReports, onCreateReport, loading }) => {
  const { t } = useTranslation();
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');

  const reports = expenseReports || [];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !onCreateReport) return;

    setSubmitting(true);
    try {
      await onCreateReport({ title: title.trim(), notes: notes.trim() || null });
      setTitle('');
      setNotes('');
      setShowForm(false);
    } catch {
      // Error handled by hook
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl backdrop-blur-sm p-5">
      {/* Header */}
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

      {/* New expense report form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-[#141c33]/80 rounded-lg p-4 border border-purple-500/20 space-y-4 mb-4"
        >
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

          <Button
            type="submit"
            disabled={submitting || !title.trim()}
            className="w-full bg-purple-600 hover:bg-purple-700 text-white"
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
            {t('employee.expense.submit', 'Soumettre la note de frais')}
          </Button>
        </form>
      )}

      {/* Expense reports list */}
      {reports.length > 0 ? (
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {reports.map((report) => {
            const itemCount = report.items?.length || 0;
            return (
              <div
                key={report.id}
                className="flex items-center justify-between bg-[#141c33]/60 rounded-lg p-3 border border-white/5 hover:border-white/10 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <StatusIcon status={report.status} />
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{report.title}</p>
                    <p className="text-xs text-gray-400">
                      {itemCount} {t('employee.expense.items', 'poste(s)')}
                      {report.submitted_at
                        ? ` - ${formatDate(report.submitted_at)}`
                        : report.created_at
                          ? ` - ${formatDate(report.created_at)}`
                          : ''}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm font-semibold text-white">
                    {formatCurrency(report.total_amount, report.currency || 'EUR')}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[report.status] || STATUS_COLORS.draft}`}
                  >
                    {t(`employee.expense.status.${report.status}`, report.status)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        !loading &&
        !showForm && (
          <div className="text-center py-6">
            <DollarSign className="w-8 h-8 text-gray-600 mx-auto mb-2" />
            <p className="text-sm text-gray-400">{t('employee.expense.empty', 'Aucune note de frais.')}</p>
            <p className="text-xs text-gray-500 mt-1">
              {t('employee.expense.emptyHint', 'Creez votre premiere note de frais ci-dessus.')}
            </p>
          </div>
        )
      )}

      {loading && (
        <div className="flex justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-purple-400" />
        </div>
      )}
    </div>
  );
};

export default EmployeeExpensePanel;
