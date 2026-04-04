import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Wallet, CreditCard, Banknote, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PanelInfoPopover from '@/components/ui/PanelInfoPopover';
import { formatCurrency } from '@/utils/currencyService';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const InfoLabel = ({ info, children, className = '' }) => (
  <span className={`inline-flex items-center gap-1.5 ${className}`.trim()}>
    <PanelInfoPopover {...info} ariaLabel={`Informations sur ${info.title}`} triggerClassName="h-5 w-5" />
    <span>{children}</span>
  </span>
);

export function InstrumentStatsPanel({ instruments = [] }) {
  const { t } = useTranslation();

  const stats = useMemo(() => {
    const bankAccounts = instruments.filter((i) => i.instrument_type === 'bank_account');
    const cards = instruments.filter((i) => i.instrument_type === 'card');
    const cash = instruments.filter((i) => i.instrument_type === 'cash');

    const totalBalance = instruments.reduce((sum, i) => sum + (i.current_balance || 0), 0);
    const bankBalance = bankAccounts.reduce((sum, i) => sum + (i.current_balance || 0), 0);
    const cashBalance = cash.reduce((sum, i) => sum + (i.current_balance || 0), 0);

    const activeCount = instruments.filter((i) => i.status === 'active').length;
    const defaultCurrency = instruments[0]?.currency || 'EUR';

    return {
      totalBalance,
      bankBalance,
      cashBalance,
      bankCount: bankAccounts.length,
      cardCount: cards.length,
      cashCount: cash.length,
      totalCount: instruments.length,
      activeCount,
      defaultCurrency,
    };
  }, [instruments]);

  const statsPanelInfo = useMemo(
    () => ({
      totalBalance: {
        title: t('financialInstruments.stats.totalBalance', 'Solde total'),
        definition: 'Total des soldes de tous les instruments visibles.',
        dataSource: 'Soldes des comptes, cartes et caisses chargés dans cette page.',
        formula: 'Solde total = somme de tous les soldes affichés.',
        calculationMethod: 'Additionne tous les montants du périmètre.',
        expertDataSource: 'Table `company_payment_instruments.current_balance` chargée par `usePaymentInstruments`.',
        expertFormula: 'sum(current_balance) sur `instruments`.',
        expertCalculationMethod: 'Réduction JS `instruments.reduce((sum, i) => sum + (i.current_balance || 0), 0)`.',
      },
      bankBalance: {
        title: t('financialInstruments.stats.bankBalance', 'Solde bancaire'),
        definition: 'Total des soldes des comptes bancaires.',
        dataSource: 'Comptes bancaires affichés dans le module.',
        formula: 'Solde bancaire = somme des soldes des comptes bancaires.',
        calculationMethod: 'Additionne uniquement les comptes de type bancaire.',
        expertDataSource: 'Sous-ensemble `instrument_type = bank_account`.',
        expertFormula: 'sum(current_balance) sur `bankAccounts`.',
        expertCalculationMethod: 'Réduction JS sur le sous-ensemble bancaire.',
      },
      cardCount: {
        title: t('financialInstruments.stats.cardCount', 'Cartes'),
        definition: 'Nombre de cartes enregistrées dans le périmètre.',
        dataSource: 'Cartes affichées dans le module.',
        formula: 'Cartes = count(cartes).',
        calculationMethod: 'Compte le nombre de cartes présentes.',
        expertDataSource: 'Sous-ensemble `instrument_type = card`.',
        expertFormula: 'count(cards).',
        expertCalculationMethod: 'Longueur du tableau `cards`.',
      },
      cashBalance: {
        title: t('financialInstruments.stats.cashBalance', 'Solde caisses'),
        definition: 'Total des soldes de caisses.',
        dataSource: 'Caisses affichées dans le module.',
        formula: 'Solde caisses = somme des soldes des caisses.',
        calculationMethod: 'Additionne uniquement les caisses.',
        expertDataSource: 'Sous-ensemble `instrument_type = cash`.',
        expertFormula: 'sum(current_balance) sur `cash`.',
        expertCalculationMethod: 'Réduction JS sur le sous-ensemble caisse.',
      },
      breakdown: {
        title: t('financialInstruments.stats.breakdown', 'Repartition par type'),
        definition: 'Répartition des instruments par type (compte, carte, caisse).',
        dataSource: 'Compteurs calculés à partir des instruments affichés.',
        formula: 'Part (%) = nombre du type / nombre total x 100.',
        calculationMethod: 'Calcule la part de chaque type et l affiche en barre.',
        expertDataSource: 'Compteurs `bankCount`, `cardCount`, `cashCount`, `totalCount`.',
        expertFormula: 'pct = (count(type) / totalCount) * 100.',
        expertCalculationMethod: 'Calcul local puis rendu de la largeur de barre en pourcentage.',
      },
      allInstruments: {
        title: t('financialInstruments.stats.allInstruments', 'Tous les instruments'),
        definition: 'Liste rapide de tous les instruments et de leur solde.',
        dataSource: 'Instruments affichés sur la page Statistiques.',
        calculationMethod: 'Affiche chaque instrument avec son montant formaté.',
        expertDataSource: 'Collection `instruments` de `usePaymentInstruments`.',
        expertCalculationMethod: 'Rendu ligne à ligne avec format monétaire par devise instrument.',
      },
      unitInstrumentBalance: {
        title: t('financialInstruments.balance', 'Solde'),
        definition: "Montant actuellement disponible pour l'instrument de la ligne.",
        dataSource: "Solde enregistré dans l'application.",
        formula: "Solde = solde d'ouverture + entrées - sorties.",
        calculationMethod: 'Mis à jour automatiquement avec les opérations comptabilisées ou rapprochées.',
        expertDataSource: 'Champ `company_payment_instruments.current_balance`.',
        expertFormula: 'Solde = opening_balance + sum(inflow posted/reconciled) - sum(outflow posted/reconciled).',
        expertCalculationMethod: 'Mise à jour SQL via trigger `apply_payment_transaction_balance`.',
      },
    }),
    [t]
  );

  const kpiCards = [
    {
      icon: TrendingUp,
      label: t('financialInstruments.stats.totalBalance', 'Solde total'),
      value: formatCurrency(stats.totalBalance, stats.defaultCurrency),
      sub: `${stats.activeCount} ${t('financialInstruments.stats.activeInstruments', 'instruments actifs')}`,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      info: statsPanelInfo.totalBalance,
    },
    {
      icon: Wallet,
      label: t('financialInstruments.stats.bankBalance', 'Solde bancaire'),
      value: formatCurrency(stats.bankBalance, stats.defaultCurrency),
      sub: `${stats.bankCount} ${t('financialInstruments.tabs.bankAccounts', 'comptes')}`,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
      info: statsPanelInfo.bankBalance,
    },
    {
      icon: CreditCard,
      label: t('financialInstruments.stats.cardCount', 'Cartes'),
      value: String(stats.cardCount),
      sub: t('financialInstruments.stats.registered', 'enregistrees'),
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
      info: statsPanelInfo.cardCount,
    },
    {
      icon: Banknote,
      label: t('financialInstruments.stats.cashBalance', 'Solde caisses'),
      value: formatCurrency(stats.cashBalance, stats.defaultCurrency),
      sub: `${stats.cashCount} ${t('financialInstruments.tabs.cash', 'caisses')}`,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
      info: statsPanelInfo.cashBalance,
    },
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, idx) => (
          <motion.div key={idx} variants={itemVariants}>
            <Card className="bg-[#141c33] border-gray-800/50">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="mb-2 text-gray-500 text-xs uppercase tracking-wider">
                      <InfoLabel info={kpi.info}>{kpi.label}</InfoLabel>
                    </div>
                    <p className="text-2xl font-bold text-white">{kpi.value}</p>
                    <p className="text-gray-600 text-xs mt-1">{kpi.sub}</p>
                  </div>
                  <div className={`p-2.5 rounded-lg ${kpi.bg}`}>
                    <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Breakdown by type */}
      <Card className="bg-[#141c33] border-gray-800/50">
        <CardHeader>
          <CardTitle className="text-white text-lg">
            <InfoLabel info={statsPanelInfo.breakdown}>
              {t('financialInstruments.stats.breakdown', 'Repartition par type')}
            </InfoLabel>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              {
                type: 'bank_account',
                label: t('financialInstruments.tabs.bankAccounts', 'Comptes bancaires'),
                count: stats.bankCount,
                color: 'bg-blue-500',
              },
              {
                type: 'card',
                label: t('financialInstruments.tabs.cards', 'Cartes'),
                count: stats.cardCount,
                color: 'bg-purple-500',
              },
              {
                type: 'cash',
                label: t('financialInstruments.tabs.cash', 'Caisses'),
                count: stats.cashCount,
                color: 'bg-green-500',
              },
            ].map((item) => {
              const pct = stats.totalCount > 0 ? (item.count / stats.totalCount) * 100 : 0;
              return (
                <div key={item.type}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-gray-400 text-sm">{item.label}</span>
                    <span className="text-white text-sm font-medium">{item.count}</span>
                  </div>
                  <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full ${item.color} rounded-full`}
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, delay: 0.2 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Instruments list quick view */}
      {instruments.length > 0 && (
        <Card className="bg-[#141c33] border-gray-800/50">
          <CardHeader>
            <CardTitle className="text-white text-lg">
              <InfoLabel info={statsPanelInfo.allInstruments}>
                {t('financialInstruments.stats.allInstruments', 'Tous les instruments')}
              </InfoLabel>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {instruments.map((inst) => (
                <div
                  key={inst.id}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg bg-[#0f1528] border border-gray-800/30"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded bg-amber-500/10">
                      {inst.instrument_type === 'bank_account' && <Wallet className="h-4 w-4 text-amber-500" />}
                      {inst.instrument_type === 'card' && <CreditCard className="h-4 w-4 text-amber-500" />}
                      {inst.instrument_type === 'cash' && <Banknote className="h-4 w-4 text-amber-500" />}
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">{inst.label}</p>
                      <p className="text-gray-600 text-xs">{inst.account_code}</p>
                    </div>
                  </div>
                  <div className="inline-flex items-center gap-1.5">
                    <PanelInfoPopover
                      {...statsPanelInfo.unitInstrumentBalance}
                      ariaLabel={`Informations sur ${statsPanelInfo.unitInstrumentBalance.title}`}
                      triggerClassName="h-5 w-5"
                    />
                    <p className="text-white text-sm font-semibold">
                      {formatCurrency(inst.current_balance || 0, inst.currency || 'EUR')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
