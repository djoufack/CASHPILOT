import { useTranslation } from 'react-i18next';
import { formatCurrency } from '@/utils/calculations';
import { Mail, MessageSquare, Phone, FileText, Loader2 } from 'lucide-react';

const CHANNEL_ICONS = {
  email: Mail,
  sms: Phone,
  whatsapp: MessageSquare,
  letter: FileText,
};

const PIPELINE_COLUMNS = [
  { key: 'pending', color: 'border-gray-500/30', headerBg: 'bg-gray-500/20', headerText: 'text-gray-400' },
  { key: 'sent', color: 'border-blue-500/30', headerBg: 'bg-blue-500/20', headerText: 'text-blue-400' },
  { key: 'delivered', color: 'border-cyan-500/30', headerBg: 'bg-cyan-500/20', headerText: 'text-cyan-400' },
  { key: 'opened', color: 'border-purple-500/30', headerBg: 'bg-purple-500/20', headerText: 'text-purple-400' },
  { key: 'responded', color: 'border-amber-500/30', headerBg: 'bg-amber-500/20', headerText: 'text-amber-400' },
  { key: 'paid', color: 'border-emerald-500/30', headerBg: 'bg-emerald-500/20', headerText: 'text-emerald-400' },
];

const getScoreColor = (score) => {
  if (score >= 80) return 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30';
  if (score >= 60) return 'text-blue-400 bg-blue-500/20 border-blue-500/30';
  if (score >= 30) return 'text-amber-400 bg-amber-500/20 border-amber-500/30';
  return 'text-red-400 bg-red-500/20 border-red-500/30';
};

/**
 * DunningPipeline - Kanban-style pipeline view showing dunning executions
 * by status columns: Pending | Sent | Delivered | Opened | Responded | Paid
 *
 * @param {{ executions: Array, loading?: boolean }} props
 */
const DunningPipeline = ({ executions = [], loading = false }) => {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl p-6 backdrop-blur-sm">
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        </div>
      </div>
    );
  }

  // Group executions by status
  const grouped = PIPELINE_COLUMNS.reduce((acc, col) => {
    acc[col.key] = executions.filter((e) => e.status === col.key);
    return acc;
  }, {});

  return (
    <div className="bg-[#0f1528]/80 border border-gray-800/50 rounded-2xl p-6 backdrop-blur-sm">
      <h3 className="text-lg font-bold text-white mb-5">{t('dunning.pipeline.title', 'Pipeline de relances')}</h3>

      {executions.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-12">
          {t('dunning.pipeline.empty', 'Aucune relance en cours. Lancez une campagne pour commencer.')}
        </p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 overflow-x-auto">
          {PIPELINE_COLUMNS.map((col) => {
            const items = grouped[col.key] || [];

            return (
              <div key={col.key} className="min-w-[180px]">
                {/* Column Header */}
                <div
                  className={`flex items-center justify-between px-3 py-2 rounded-lg ${col.headerBg} border ${col.color} mb-3`}
                >
                  <span className={`text-xs font-semibold uppercase ${col.headerText}`}>
                    {t(`dunning.pipeline.${col.key}`, col.key)}
                  </span>
                  <span className={`text-xs font-bold ${col.headerText}`}>{items.length}</span>
                </div>

                {/* Cards */}
                <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                  {items.map((exec) => {
                    const ChannelIcon = CHANNEL_ICONS[exec.channel] || Mail;
                    const clientName =
                      exec.clients?.company_name || t('dunning.pipeline.unknownClient', 'Client inconnu');
                    const invoiceNum = exec.invoices?.invoice_number || '-';
                    const amount = exec.invoices?.balance_due ?? exec.invoices?.total_ttc ?? 0;
                    const aiScore = exec.ai_score;

                    return (
                      <div
                        key={exec.id}
                        className={`bg-[#0a0e1a]/60 rounded-xl p-3 border ${col.color} hover:border-opacity-80 transition-all cursor-default`}
                      >
                        {/* Client name */}
                        <p className="text-sm font-medium text-white truncate mb-1">{clientName}</p>

                        {/* Invoice number */}
                        <p className="text-xs text-gray-500 mb-2">{invoiceNum}</p>

                        {/* Amount + Channel icon */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-white">{formatCurrency(amount)}</span>
                          <ChannelIcon className="w-3.5 h-3.5 text-gray-400" />
                        </div>

                        {/* AI Score badge */}
                        {aiScore != null && (
                          <div className="mt-2">
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border ${getScoreColor(aiScore)}`}
                            >
                              {t('dunning.pipeline.score', 'Score')}: {aiScore}%
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {items.length === 0 && (
                    <div className="text-xs text-gray-600 text-center py-4">
                      {t('dunning.pipeline.noItems', 'Aucun')}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default DunningPipeline;
