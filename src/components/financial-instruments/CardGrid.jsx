import React from 'react';
import { useTranslation } from 'react-i18next';
import { CreditCard, Plus, Pencil, Wifi } from 'lucide-react';
import { motion } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/utils/currencyService';

const brandGradients = {
  visa: 'from-blue-900 via-blue-800 to-blue-600',
  mastercard: 'from-red-900 via-orange-800 to-yellow-700',
  amex: 'from-gray-800 via-gray-700 to-gray-500',
  default: 'from-gray-900 via-gray-800 to-gray-600',
};

const cardTypeLabels = {
  debit: { label: 'Debit', color: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
  credit: { label: 'Credit', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
  prepaid: { label: 'Prepaid', color: 'bg-green-500/20 text-green-400 border-green-500/30' },
  virtual: { label: 'Virtual', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

export function CardGrid({ cards = [], onEdit, onAdd }) {
  const { t } = useTranslation();

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
    >
      {cards.map((instrument) => {
        const cardDetail = instrument.payment_instrument_cards?.[0] || {};
        const brand = (cardDetail.card_brand || 'default').toLowerCase();
        const gradient = brandGradients[brand] || brandGradients.default;
        const cardType = cardTypeLabels[cardDetail.card_type] || cardTypeLabels.debit;
        const last4 = cardDetail.last4 || '----';
        const expiryMonth = String(cardDetail.expiry_month || '--').padStart(2, '0');
        const expiryYear = String(cardDetail.expiry_year || '--').slice(-2);

        return (
          <motion.div key={instrument.id} variants={itemVariants}>
            <div
              className={`relative rounded-2xl bg-gradient-to-br ${gradient} p-6 shadow-xl cursor-pointer group overflow-hidden min-h-[200px] flex flex-col justify-between`}
              onClick={() => onEdit?.(instrument)}
            >
              {/* Decorative circles */}
              <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-white/5 -translate-y-8 translate-x-8" />
              <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-white/5 translate-y-6 -translate-x-6" />

              {/* Top row: Brand + Type */}
              <div className="flex items-start justify-between relative z-10">
                <div className="flex items-center gap-2">
                  <CreditCard className="h-6 w-6 text-white/80" />
                  <span className="text-white/80 text-sm font-medium uppercase tracking-wider">
                    {cardDetail.card_brand || t('financialInstruments.card', 'Carte')}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {cardDetail.is_virtual && (
                    <Wifi className="h-4 w-4 text-white/60" />
                  )}
                  <Badge variant="outline" className={`${cardType.color} text-xs`}>
                    {t(`financialInstruments.cardTypes.${cardDetail.card_type}`, cardType.label)}
                  </Badge>
                </div>
              </div>

              {/* Card number */}
              <div className="relative z-10 my-6">
                <p className="text-white/40 text-xs mb-1">{t('financialInstruments.cardNumber', 'Numero')}</p>
                <p className="text-white text-xl font-mono tracking-[0.3em]">
                  **** **** **** {last4}
                </p>
              </div>

              {/* Bottom row: Holder, Expiry, Balance */}
              <div className="flex items-end justify-between relative z-10">
                <div>
                  <p className="text-white/40 text-xs">
                    {t('financialInstruments.fields.cardHolder', 'Titulaire')}
                  </p>
                  <p className="text-white text-sm font-medium uppercase tracking-wider">
                    {cardDetail.holder_name || instrument.label}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-white/40 text-xs">
                    {t('financialInstruments.expiry', 'Expire')}
                  </p>
                  <p className="text-white text-sm font-mono">
                    {expiryMonth}/{expiryYear}
                  </p>
                </div>
              </div>

              {/* Hover edit button */}
              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                <Button
                  size="sm"
                  variant="outline"
                  className="bg-black/40 border-white/20 text-white hover:bg-black/60 h-8 w-8 p-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEdit?.(instrument);
                  }}
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              </div>

              {/* Balance overlay */}
              {(instrument.current_balance != null && instrument.current_balance !== 0) && (
                <div className="absolute bottom-3 right-3 bg-black/30 backdrop-blur-sm rounded-lg px-3 py-1.5 z-10">
                  <p className="text-white text-sm font-semibold">
                    {formatCurrency(instrument.current_balance, instrument.currency || 'EUR')}
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        );
      })}

      {/* Add card button */}
      <motion.div variants={itemVariants}>
        <div
          className="rounded-2xl border-2 border-dashed border-gray-700 hover:border-amber-500/50 min-h-[200px] flex flex-col items-center justify-center cursor-pointer transition-colors group"
          onClick={onAdd}
        >
          <div className="p-3 rounded-full bg-gray-800 group-hover:bg-amber-500/10 transition-colors mb-3">
            <Plus className="h-6 w-6 text-gray-500 group-hover:text-amber-500 transition-colors" />
          </div>
          <p className="text-gray-500 group-hover:text-amber-500 transition-colors font-medium">
            {t('financialInstruments.addCard', 'Ajouter une carte')}
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}
