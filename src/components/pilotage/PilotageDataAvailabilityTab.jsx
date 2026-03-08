import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { CheckCircle2, Database, Eye, Calculator, TrendingUp, Building2 } from 'lucide-react';
import PilotageSignalStrip from './PilotageSignalStrip';
import PilotageQualityBanner from './PilotageQualityBanner';
import PilotageUsageGuide from './PilotageUsageGuide';

const BADGE_TONE = {
  ready: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-200',
  partial: 'border-amber-500/20 bg-amber-500/10 text-amber-200',
  unavailable: 'border-red-500/20 bg-red-500/10 text-red-200',
};

const TAB_META = {
  overview: { icon: Eye, labelKey: 'pilotage.tabs.overview' },
  accounting: { icon: Calculator, labelKey: 'pilotage.tabs.accounting' },
  financial: { icon: TrendingUp, labelKey: 'pilotage.tabs.financial' },
  taxValuation: { icon: Building2, labelKey: 'pilotage.tabs.taxValuation' },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

const PilotageDataAvailabilityTab = ({ data, region, sector, startDate, endDate }) => {
  const { t } = useTranslation();
  const availability = data?.analysisAvailability;

  const sections = useMemo(() => {
    if (!availability) return [];
    return Object.entries(TAB_META)
      .filter(([key]) => availability[key])
      .map(([key, meta]) => {
        const items = Object.values(availability[key]);
        const ready = items.filter(i => i.status === 'ready').length;
        const partial = items.filter(i => i.status === 'partial').length;
        const unavailable = items.filter(i => i.status === 'unavailable').length;
        return { key, meta, items, ready, partial, unavailable, total: items.length };
      });
  }, [availability]);

  const totals = useMemo(() => {
    const all = sections.flatMap(s => s.items);
    return {
      ready: all.filter(i => i.status === 'ready').length,
      partial: all.filter(i => i.status === 'partial').length,
      unavailable: all.filter(i => i.status === 'unavailable').length,
      total: all.length,
    };
  }, [sections]);

  if (!availability) return null;

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Signal strip */}
      <motion.div variants={itemVariants}>
        <PilotageSignalStrip
          data={data}
          region={region}
          sector={sector}
          startDate={startDate}
          endDate={endDate}
        />
      </motion.div>

      {/* Quality banner */}
      <motion.div variants={itemVariants}>
        <PilotageQualityBanner data={data} />
      </motion.div>

      {/* Usage guide */}
      <motion.div variants={itemVariants}>
        <PilotageUsageGuide data={data} />
      </motion.div>

      {/* Global summary */}
      <motion.div variants={itemVariants}>
        <div className="rounded-2xl border border-gray-800/60 bg-gray-900/60 p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/20">
              <Database className="h-4 w-4 text-orange-300" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-100">
                {t('pilotage.availability.globalTitle', 'Disponibilite reelle des analyses')}
              </p>
              <p className="text-xs text-gray-400">
                {t('pilotage.availability.globalSubtitle', "CashPilot n'affiche les analyses que si les donnees necessaires existent en base.")}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-center">
              <p className="text-2xl font-bold text-emerald-300">{totals.ready}</p>
              <p className="text-xs text-emerald-200/70">{t('pilotage.availability.ready', 'Disponible')}</p>
            </div>
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-center">
              <p className="text-2xl font-bold text-amber-300">{totals.partial}</p>
              <p className="text-xs text-amber-200/70">{t('pilotage.availability.partial', 'Partiel')}</p>
            </div>
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-center">
              <p className="text-2xl font-bold text-red-300">{totals.unavailable}</p>
              <p className="text-xs text-red-200/70">{t('pilotage.availability.unavailable', 'Indisponible')}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Per-tab sections */}
      {sections.map(({ key, meta, items, ready, total }) => {
        const Icon = meta.icon;
        const allReady = ready === total;
        return (
          <motion.div key={key} variants={itemVariants}>
            <div className="rounded-2xl border border-gray-800/60 bg-gray-900/60 p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-black/20">
                  <Icon className="h-4 w-4 text-gray-300" />
                </div>
                <p className="text-sm font-semibold text-gray-100">{t(meta.labelKey)}</p>
                {allReady && <CheckCircle2 className="h-4 w-4 text-emerald-400 ml-auto" />}
                {!allReady && (
                  <span className="ml-auto text-xs text-gray-500">
                    {ready}/{total} {t('pilotage.availability.readyCount', 'disponibles')}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {items.map((item) => (
                  <div
                    key={item.key}
                    className="rounded-xl border border-gray-800 bg-gray-950/60 p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-gray-100">
                        {t(item.titleKey)}
                      </span>
                      <span className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-medium ${BADGE_TONE[item.status]}`}>
                        {t(`pilotage.dataRequirements.status.${item.status}`)}
                      </span>
                    </div>
                    {item.missingInputs?.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-[0.16em] text-gray-500">
                          <Database className="h-3 w-3" />
                          {t('pilotage.dataRequirements.missingInputsLabel')}
                        </span>
                        {item.missingInputs.map((inputKey) => (
                          <span
                            key={`${item.key}-${inputKey}`}
                            className="inline-flex rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs text-gray-300"
                          >
                            {t(`pilotage.dataRequirements.inputs.${inputKey}`)}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
};

export default PilotageDataAvailabilityTab;
