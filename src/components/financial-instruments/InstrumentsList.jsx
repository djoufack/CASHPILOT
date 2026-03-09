import React from 'react';
import { useTranslation } from 'react-i18next';
import { Wallet, CreditCard, Banknote, Building2, Pencil, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/currencyService';

const typeIcons = {
  bank_account: Wallet,
  card: CreditCard,
  cash: Banknote,
};

const statusColors = {
  active: 'bg-green-500/10 text-green-400 border-green-500/30',
  inactive: 'bg-gray-500/10 text-gray-400 border-gray-500/30',
  archived: 'bg-red-500/10 text-red-400 border-red-500/30',
  frozen: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export function InstrumentsList({ instruments = [], type, onEdit, onDelete }) {
  const { t } = useTranslation();

  const filtered = type ? instruments.filter((i) => i.instrument_type === type) : instruments;

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-gray-500">
        <Building2 className="h-12 w-12 mb-4 text-gray-600" />
        <p className="text-lg">{t('financialInstruments.noInstruments', 'Aucun instrument trouve')}</p>
        <p className="text-sm text-gray-600 mt-1">
          {t('financialInstruments.addFirst', 'Cliquez sur "Ajouter" pour creer votre premier instrument')}
        </p>
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
    >
      {filtered.map((instrument) => {
        const Icon = typeIcons[instrument.instrument_type] || Wallet;
        const bankDetail = instrument.payment_instrument_bank_accounts?.[0];

        return (
          <motion.div key={instrument.id} variants={itemVariants}>
            <Card className="bg-[#141c33] border-gray-800/50 hover:border-amber-500/30 transition-colors cursor-pointer group">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/10">
                      <Icon className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <CardTitle className="text-white text-base font-semibold">
                        {instrument.label}
                      </CardTitle>
                      {bankDetail?.bank_name && (
                        <p className="text-gray-500 text-xs mt-0.5">{bankDetail.bank_name}</p>
                      )}
                    </div>
                  </div>
                  <Badge
                    variant="outline"
                    className={statusColors[instrument.status] || statusColors.active}
                  >
                    {t(`financialInstruments.status.${instrument.status}`, instrument.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {/* Balance */}
                  <div>
                    <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">
                      {t('financialInstruments.balance', 'Solde')}
                    </p>
                    <p className="text-xl font-bold text-white">
                      {formatCurrency(instrument.current_balance || 0, instrument.currency || 'EUR')}
                    </p>
                  </div>

                  {/* Account code */}
                  {instrument.account_code && (
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-[#0f1528] text-gray-400 border-gray-700 text-xs">
                        {instrument.account_code}
                      </Badge>
                      {instrument.is_default && (
                        <Badge className="bg-amber-500/10 text-amber-500 border-amber-500/30 text-xs">
                          {t('financialInstruments.default', 'Par defaut')}
                        </Badge>
                      )}
                    </div>
                  )}

                  {/* IBAN masked */}
                  {bankDetail?.iban_masked && (
                    <p className="text-gray-500 text-xs font-mono">{bankDetail.iban_masked}</p>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-gray-700 text-gray-400 hover:text-white hover:bg-gray-800 flex-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEdit?.(instrument);
                      }}
                    >
                      <Pencil className="h-3 w-3 mr-1" />
                      {t('common.edit', 'Modifier')}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-red-900/50 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDelete?.(instrument);
                      }}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
