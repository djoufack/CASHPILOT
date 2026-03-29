
import { useTranslation } from 'react-i18next';
import { Banknote, Plus, Pencil, Trash2, MapPin, User, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/currencyService';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const reconciliationLabels = {
  daily: 'Quotidien',
  weekly: 'Hebdomadaire',
  monthly: 'Mensuel',
};

export function CashRegisterPanel({ instruments = [], onEdit, onAdd }) {
  const { t } = useTranslation();

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Summary bar */}
      <div className="bg-[#0f1528] border border-gray-800/50 rounded-xl p-4 flex flex-wrap items-center gap-6">
        <div>
          <p className="text-gray-500 text-xs uppercase tracking-wider">
            {t('financialInstruments.totalCash', 'Total caisses')}
          </p>
          <p className="text-xl font-bold text-white">
            {formatCurrency(
              instruments.reduce((sum, i) => sum + (i.current_balance || 0), 0),
              instruments[0]?.currency || 'EUR',
            )}
          </p>
        </div>
        <div>
          <p className="text-gray-500 text-xs uppercase tracking-wider">
            {t('financialInstruments.cashCount', 'Nombre')}
          </p>
          <p className="text-xl font-bold text-amber-500">{instruments.length}</p>
        </div>
        <div className="ml-auto">
          <Button
            className="bg-amber-500 hover:bg-amber-600 text-black font-semibold"
            onClick={onAdd}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('financialInstruments.addCash', 'Ajouter une caisse')}
          </Button>
        </div>
      </div>

      {/* Grid */}
      {instruments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <Banknote className="h-12 w-12 mb-4 text-gray-600" />
          <p className="text-lg">{t('financialInstruments.noCash', 'Aucune caisse enregistree')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {instruments.map((instrument) => {
            const cashDetail = instrument.payment_instrument_cash_accounts?.[0] || {};

            return (
              <motion.div key={instrument.id} variants={itemVariants}>
                <Card className="bg-[#141c33] border-gray-800/50 hover:border-amber-500/30 transition-colors group">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-amber-500/10">
                          <Banknote className="h-5 w-5 text-amber-500" />
                        </div>
                        <CardTitle className="text-white text-base font-semibold">
                          {instrument.label}
                        </CardTitle>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          instrument.status === 'active'
                            ? 'bg-green-500/10 text-green-400 border-green-500/30'
                            : 'bg-gray-500/10 text-gray-400 border-gray-500/30'
                        }
                      >
                        {t(`financialInstruments.status.${instrument.status}`, instrument.status)}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Balance */}
                    <div>
                      <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">
                        {t('financialInstruments.balance', 'Solde')}
                      </p>
                      <p className="text-xl font-bold text-white">
                        {formatCurrency(instrument.current_balance || 0, instrument.currency || 'EUR')}
                      </p>
                    </div>

                    {/* Details */}
                    <div className="space-y-2 text-sm">
                      {cashDetail.custodian && (
                        <div className="flex items-center gap-2 text-gray-400">
                          <User className="h-3.5 w-3.5 text-gray-600" />
                          <span>{cashDetail.custodian}</span>
                        </div>
                      )}
                      {cashDetail.location && (
                        <div className="flex items-center gap-2 text-gray-400">
                          <MapPin className="h-3.5 w-3.5 text-gray-600" />
                          <span>{cashDetail.location}</span>
                        </div>
                      )}
                      {cashDetail.reconciliation_frequency && (
                        <div className="flex items-center gap-2 text-gray-400">
                          <Calendar className="h-3.5 w-3.5 text-gray-600" />
                          <span>
                            {t(
                              `financialInstruments.reconciliation.${cashDetail.reconciliation_frequency}`,
                              reconciliationLabels[cashDetail.reconciliation_frequency] || cashDetail.reconciliation_frequency,
                            )}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Account code */}
                    {instrument.account_code && (
                      <Badge variant="outline" className="bg-[#0f1528] text-gray-400 border-gray-700 text-xs">
                        {instrument.account_code}
                      </Badge>
                    )}

                    {/* Actions */}
                    <div className="flex gap-2 pt-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800 flex-1"
                        onClick={() => onEdit?.(instrument)}
                      >
                        <Pencil className="h-3 w-3 mr-1" />
                        {t('common.edit', 'Modifier')}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
