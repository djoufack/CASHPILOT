import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, FileSignature, FileText, RefreshCw, Receipt } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PanelInfoPopover from '@/components/ui/PanelInfoPopover';
import { useObligations } from '@/hooks/useObligations';
import { formatDueDate, formatMoney } from '@/lib/obligations';

const bucketStyles = {
  overdue: 'bg-red-500/15 text-red-400 border-red-500/30',
  due_today: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  due_soon: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  upcoming: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  unscheduled: 'bg-gray-500/15 text-gray-400 border-gray-500/30',
};

const getBucketLabels = (t) => ({
  overdue: t('dashboard.obligations.buckets.overdue', 'En retard'),
  due_today: t('dashboard.obligations.buckets.dueToday', "Aujourd'hui"),
  due_soon: t('dashboard.obligations.buckets.dueSoon', 'A venir'),
  upcoming: t('dashboard.obligations.buckets.upcoming', 'Planifie'),
  unscheduled: t('dashboard.obligations.buckets.unscheduled', 'Sans date'),
});

const getCategoryConfig = (t) => ({
  receivable: {
    icon: FileText,
    label: t('dashboard.obligations.clientInvoices', 'Factures clients'),
    accent: 'text-emerald-400',
  },
  payable: {
    icon: Receipt,
    label: t('dashboard.obligations.supplierInvoices', 'Factures fournisseurs'),
    accent: 'text-orange-400',
  },
  quote_task: {
    icon: FileSignature,
    label: t('dashboard.obligations.quotesToPrepare', 'Devis a preparer'),
    accent: 'text-violet-400',
  },
});

const SummaryCard = ({ label, info, value, subtext, icon: Icon, accentClass }) => (
  <div className="rounded-xl border border-gray-800 bg-gray-900/60 p-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-xs uppercase tracking-wider text-gray-500 inline-flex items-center gap-1.5">
          {info && <PanelInfoPopover {...info} />}
          <span>{label}</span>
        </div>
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
  const { t } = useTranslation();
  const { obligations, summary, currency, loading, refresh } = useObligations();
  const bucketLabels = useMemo(() => getBucketLabels(t), [t]);
  const categoryConfig = useMemo(() => getCategoryConfig(t), [t]);
  const panelInfo = useMemo(() => ({
    title: {
      title: t('dashboard.obligations.title', 'Obligations du moment'),
      definition: 'Vue de priorisation des obligations opérationnelles de trésorerie et de suivi commercial.',
      dataSource: 'Hook `useObligations` (agrégations issues des factures clients, factures fournisseurs et tâches devis).',
      formula: 'Sans formule unique: bloc de synthèse multi-catégories.',
      calculationMethod: 'Calcule les agrégats par catégorie puis classe les obligations selon leur urgence (retard, échéance du jour, proche, planifiée).',
    },
    priorityActions: {
      title: t('dashboard.obligations.priorityActions', 'Actions prioritaires'),
      definition: 'Liste ordonnée des actions les plus urgentes à traiter.',
      dataSource: 'Liste `obligations` construite par `useObligations`.',
      formula: 'Aucune formule unique.',
      calculationMethod: 'Trie les éléments par bucket d’échéance puis limite l’affichage aux 6 premières entrées.',
      notes: 'Le compteur affiche le volume total d’obligations détectées.',
    },
    receivables: {
      title: t('dashboard.obligations.clientInvoices', 'Factures clients'),
      definition: 'Nombre et montant des créances à encaisser.',
      dataSource: 'Agrégat `summary.receivables` du hook `useObligations`.',
      formula: 'Montant = somme des soldes clients ouverts.',
      calculationMethod: 'Compte les factures clients non soldées et additionne leurs montants dus.',
    },
    payables: {
      title: t('dashboard.obligations.supplierInvoices', 'Factures fournisseurs'),
      definition: 'Nombre et montant des dettes fournisseurs à payer.',
      dataSource: 'Agrégat `summary.payables` du hook `useObligations`.',
      formula: 'Montant = somme des dettes fournisseurs ouvertes.',
      calculationMethod: 'Compte les factures fournisseurs non réglées et additionne les montants à payer.',
    },
    quoteTasks: {
      title: t('dashboard.obligations.quotesToPrepare', 'Devis à préparer'),
      definition: 'Volume des tâches devis en attente et en retard.',
      dataSource: 'Agrégat `summary.quoteTasks` du hook `useObligations`.',
      formula: 'Compteur = nombre de tâches devis ouvertes.',
      calculationMethod: 'Agrège les tâches devis ouvertes et calcule le sous-compteur des retards.',
    },
  }), [t]);

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
            <h2 className="text-xl font-semibold text-white inline-flex items-center gap-1.5">
              <PanelInfoPopover {...panelInfo.title} />
              <span>{t('dashboard.obligations.title', 'Obligations du moment')}</span>
            </h2>
          </div>
          <p className="mt-2 text-sm text-gray-400">
            {t(
              'dashboard.obligations.subtitle',
              'Vos priorites internes: encaissements, paiements fournisseurs et devis attendus.'
            )}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={refresh}
          disabled={loading}
          className="border-gray-700 text-gray-300 hover:bg-gray-800"
        >
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          {t('common.refresh', 'Actualiser')}
        </Button>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <SummaryCard
          label={t('dashboard.obligations.clientInvoices', 'Factures clients')}
          info={panelInfo.receivables}
          value={summary.receivables.count}
          subtext={`${formatMoney(summary.receivables.amount, currency)} ${t('dashboard.obligations.toCollect', 'a encaisser')}`}
          icon={FileText}
          accentClass="text-emerald-400"
        />
        <SummaryCard
          label={t('dashboard.obligations.supplierInvoices', 'Factures fournisseurs')}
          info={panelInfo.payables}
          value={summary.payables.count}
          subtext={`${formatMoney(summary.payables.amount, currency)} ${t('dashboard.obligations.toPay', 'a payer')}`}
          icon={Receipt}
          accentClass="text-orange-400"
        />
        <SummaryCard
          label={t('dashboard.obligations.quotesToPrepare', 'Devis a preparer')}
          info={panelInfo.quoteTasks}
          value={summary.quoteTasks.count}
          subtext={`${summary.quoteTasks.overdueCount} ${t('dashboard.obligations.overdue', 'en retard')}`}
          icon={FileSignature}
          accentClass="text-violet-400"
        />
      </div>

      <div className="mt-6 rounded-xl border border-gray-800 bg-gray-900/40">
        <div className="flex items-center justify-between border-b border-gray-800 px-4 py-3">
          <div className="text-sm font-medium text-white inline-flex items-center gap-1.5">
            <PanelInfoPopover {...panelInfo.priorityActions} />
            <span>{t('dashboard.obligations.priorityActions', 'Actions prioritaires')}</span>
          </div>
          <div className="text-xs text-gray-500">
            {obligations.length} {t('dashboard.obligations.elements', 'element(s)')}
          </div>
        </div>

        {topItems.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-gray-500">
            {t('dashboard.obligations.noUrgent', 'Aucune obligation urgente detectee.')}
          </div>
        ) : (
          <div className="divide-y divide-gray-800">
            {topItems.map((item) => {
              const config = categoryConfig[item.category];
              const Icon = config.icon;

              return (
                <div
                  key={item.id}
                  className="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center lg:justify-between"
                >
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
                      <span>
                        {t('dashboard.obligations.dueDate', 'Echeance')}: {formatDueDate(item.dueDate)}
                      </span>
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
