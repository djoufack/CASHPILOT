import React from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Landmark, Activity, BookOpen } from 'lucide-react';
import KeyRatiosSection from '@/components/accounting/KeyRatiosSection';
import StructureRatiosSection from './StructureRatiosSection';
import ActivityRatiosSection from './ActivityRatiosSection';
import PilotageUnavailableState from './PilotageUnavailableState';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
};

const PilotageAccountingTab = ({ data, sector }) => {
  const { t } = useTranslation();
  const availability = data?.analysisAvailability?.accounting;

  const trialBalance = data?.trialBalance ?? [];
  const displayedRows = trialBalance.slice(0, 20);

  const formatNumber = (val) => {
    if (val === null || val === undefined) return '-';
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(val);
  };

  return (
    <motion.div
      className="space-y-8"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      {/* Section 1 — Structure Ratios */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-2 mb-4">
          <Landmark className="w-5 h-5 text-orange-400" />
          <h2 className="text-xl font-bold text-gray-100">
            {t('pilotage.ratios.structure')}
          </h2>
        </div>
        {availability?.structure?.status === 'unavailable' ? (
          null
        ) : (
          <StructureRatiosSection data={data} sector={sector} />
        )}
      </motion.div>

      {/* Section 2 — Liquidity Ratios (reused KeyRatiosSection) */}
      <motion.div variants={itemVariants}>
        {availability?.liquidity?.status === 'unavailable' ? (
          null
        ) : (
          <KeyRatiosSection data={data?.financialDiagnostic?.ratios} />
        )}
      </motion.div>

      {/* Section 3 — Activity Ratios */}
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-5 h-5 text-orange-400" />
          <h2 className="text-xl font-bold text-gray-100">
            {t('pilotage.ratios.activity')}
          </h2>
        </div>
        {availability?.activity?.status === 'unavailable' ? (
          null
        ) : (
          <ActivityRatiosSection data={data} sector={sector} />
        )}
      </motion.div>

      {/* Section 4 — Trial Balance Summary */}
      <motion.div variants={itemVariants}>
        {availability?.trialBalance?.status === 'unavailable' ? (
          null
        ) : (
        <Card className="bg-gray-900/50 border border-gray-800/50 rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-100">
              <BookOpen className="w-5 h-5 text-orange-400" />
              {t('pilotage.trialBalanceSummary')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {displayedRows.length === 0 ? (
              <p className="text-sm text-gray-400">
                {t('pilotage.noData')}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-700">
                      <th className="text-left py-2 px-3">Compte</th>
                      <th className="text-right py-2 px-3">Debit</th>
                      <th className="text-right py-2 px-3">Credit</th>
                      <th className="text-right py-2 px-3">Solde</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800/50">
                    {displayedRows.map((row, idx) => (
                      <tr
                        key={row.account_code || idx}
                        className="hover:bg-gray-800/30 transition-colors"
                      >
                        <td className="py-2 px-3 text-gray-300">
                          <span className="font-mono text-xs text-gray-500 mr-2">
                            {row.account_code}
                          </span>
                          {row.account_name}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-300 font-mono">
                          {formatNumber(row.totalDebit)}
                        </td>
                        <td className="py-2 px-3 text-right text-gray-300 font-mono">
                          {formatNumber(row.totalCredit)}
                        </td>
                        <td
                          className={`py-2 px-3 text-right font-mono font-semibold ${
                            row.balance >= 0 ? 'text-green-400' : 'text-red-400'
                          }`}
                        >
                          {formatNumber(row.balance)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {trialBalance.length > 20 && (
                  <p className="mt-3 text-xs text-gray-500 text-center">
                    {trialBalance.length - 20} lignes supplementaires non affichees
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
        )}
      </motion.div>
    </motion.div>
  );
};

export default PilotageAccountingTab;
