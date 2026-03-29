import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Wallet, CreditCard, Banknote, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/utils/currencyService';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

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

  const kpiCards = [
    {
      icon: TrendingUp,
      label: t('financialInstruments.stats.totalBalance', 'Solde total'),
      value: formatCurrency(stats.totalBalance, stats.defaultCurrency),
      sub: `${stats.activeCount} ${t('financialInstruments.stats.activeInstruments', 'instruments actifs')}`,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
    },
    {
      icon: Wallet,
      label: t('financialInstruments.stats.bankBalance', 'Solde bancaire'),
      value: formatCurrency(stats.bankBalance, stats.defaultCurrency),
      sub: `${stats.bankCount} ${t('financialInstruments.tabs.bankAccounts', 'comptes')}`,
      color: 'text-blue-400',
      bg: 'bg-blue-500/10',
    },
    {
      icon: CreditCard,
      label: t('financialInstruments.stats.cardCount', 'Cartes'),
      value: String(stats.cardCount),
      sub: t('financialInstruments.stats.registered', 'enregistrees'),
      color: 'text-purple-400',
      bg: 'bg-purple-500/10',
    },
    {
      icon: Banknote,
      label: t('financialInstruments.stats.cashBalance', 'Solde caisses'),
      value: formatCurrency(stats.cashBalance, stats.defaultCurrency),
      sub: `${stats.cashCount} ${t('financialInstruments.tabs.cash', 'caisses')}`,
      color: 'text-green-400',
      bg: 'bg-green-500/10',
    },
  ];

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((kpi, idx) => (
          <motion.div key={idx} variants={itemVariants}>
            <Card className="bg-[#141c33] border-gray-800/50">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-2">{kpi.label}</p>
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
            {t('financialInstruments.stats.breakdown', 'Repartition par type')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              { type: 'bank_account', label: t('financialInstruments.tabs.bankAccounts', 'Comptes bancaires'), count: stats.bankCount, color: 'bg-blue-500' },
              { type: 'card', label: t('financialInstruments.tabs.cards', 'Cartes'), count: stats.cardCount, color: 'bg-purple-500' },
              { type: 'cash', label: t('financialInstruments.tabs.cash', 'Caisses'), count: stats.cashCount, color: 'bg-green-500' },
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
              {t('financialInstruments.stats.allInstruments', 'Tous les instruments')}
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
                  <p className="text-white text-sm font-semibold">
                    {formatCurrency(inst.current_balance || 0, inst.currency || 'EUR')}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </motion.div>
  );
}
