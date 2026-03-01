import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, FileSignature, FileText, RefreshCw, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useObligations } from '@/hooks/useObligations';
import { formatDueDate, formatMoney } from '@/lib/obligations';

const bucketStyles = {
  overdue: 'bg-red-500/15 text-red-400 border-red-500/30',
  due_today: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  due_soon: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  upcoming: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  unscheduled: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

const bucketLabels = {
  overdue: 'En retard',
  due_today: "Aujourd'hui",
  due_soon: 'A venir',
  upcoming: 'Planifie',
  unscheduled: 'Sans date',
};

const categoryConfig = {
  receivable: {
    icon: FileText,
    label: 'Factures clients',
    accent: 'text-emerald-400',
  },
  payable: {
    icon: Receipt,
    label: 'Factures fournisseurs',
    accent: 'text-orange-400',
  },
  quote_task: {
    icon: FileSignature,
    label: 'Devis a preparer',
    accent: 'text-violet-400',
  },
};

const SummaryCard = ({ label, value, subtext, icon: Icon, accentClass }) => (
  <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-xs uppercase tracking-wider text-gray-500">{label}</div>
        <div className="mt-2 text-2xl font-bold text-white">{value}</div>
        <div className="mt-1 text-sm text-gray-400">{subtext}</div>
      </div>
      <div className="rounded-xl bg-gray-950/80 p-3">
        <Icon className={`h-5 w-5 ${accentClass}`} />
      </div>
    </div>
  </div>
);

const ObligationsPanel = () => {
  const { obligations, summary, currency, loading, refresh } = useObligations();

  const topItems = useMemo(() => obligations.slice(0, 6), [obligations]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="mb-8 rounded-2xl border border-gray-800/60 bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 p-6"
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-400" />
            <h2 className="text-xl font-semibold text-white">Obligations du moment</h2>
          </div>
          <p className="mt-2 text-sm text-gray-400">
            Vos priorites internes: encaissements, paiements fournisseurs et devis attendus.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={refresh}
          disabled={loading}
          className="border-gray-700 text-gray-300 hover:bg-gray-800"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard
          label="Factures clients"
          value={summary.receivables.count}
          subtext={`${formatMoney(summary.receivables.amount, currency)} a encaisser`}
          icon={FileText}
          accentClass="text-emerald-400"
        />
        <SummaryCard
          label="Factures fournisseurs"
          value={summary.payables.count}
          subtext={`${formatMoney(summary.payables.amount, currency)} a payer`}
          icon={Receipt}
          accentClass="text-orange-400"
        />
        <SummaryCard
          label="Devis a preparer"
          value={summary.quoteTasks.count}
          subtext={`${summary.quoteTasks.overdueCount} en retard`}
          icon={FileSignature}
          accentClass="text-violet-400"
        />
      </div>

      <div className="mt-6 rounded-xl border border-gray-800 bg-gray-900/40">
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
          <div className="text-sm font-medium text-white">Actions prioritaires</div>
          <div className="text-xs text-gray-500">{obligations.length} element(s)</div>
        </div>

        {topItems.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-gray-500">
            Aucune obligation urgente detectee.
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {topItems.map((item) => {
              const config = categoryConfig[item.category];
              const Icon = config.icon;

              return (
                <div key={item.id} className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="rounded-lg bg-gray-950/80 p-2">
                        <Icon className={`h-4 w-4 ${config.accent}`} />
                      </div>
                      <div className="font-medium text-white">{item.title}</div>
                      <Badge variant="outline" className={bucketStyles[item.dueBucket]}>
                        {bucketLabels[item.dueBucket]}
                      </Badge>
                      <Badge variant="outline" className="border-gray-700 text-gray-400">
                        {config.label}
                      </Badge>
                    </div>

                    <div className="mt-2 flex flex-col gap-1 text-sm text-gray-400 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
                      <span>{item.subtitle}</span>
                      <span>Echeance: {formatDueDate(item.dueDate)}</span>
                      {item.amount > 0 && <span>{item.amountLabel}</span>}
                    </div>
                  </div>

                  <Link
                    to={item.href}
                    className="inline-flex items-center justify-center rounded-lg border border-gray-700 px-3 py-2 text-sm font-medium text-gray-200 transition hover:bg-gray-800"
                  >
                    {item.ctaLabel}
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.section>
  );
};

export default ObligationsPanel;

