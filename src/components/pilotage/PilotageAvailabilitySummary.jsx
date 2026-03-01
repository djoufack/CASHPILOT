import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, CheckCircle2, Database } from 'lucide-react';

const BADGE_TONE = {
  partial: 'border-amber-500/20 bg-amber-500/10 text-amber-200',
  unavailable: 'border-red-500/20 bg-red-500/10 text-red-200',
};

const PilotageAvailabilitySummary = ({ items = [] }) => {
  const { t } = useTranslation();

  const actionableItems = useMemo(
    () => (items || []).filter((item) => item?.status === 'partial' || item?.status === 'unavailable'),
    [items]
  );

  if (actionableItems.length === 0) {
    return (
      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/20">
            <CheckCircle2 className="h-4 w-4 text-emerald-300" />
          </div>
          <div>
            <p className="text-sm font-semibold text-emerald-100">
              {t('pilotage.dataRequirements.allReadyTitle')}
            </p>
            <p className="text-xs text-emerald-200/80">
              {t('pilotage.dataRequirements.allReadyBody')}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-800/70 bg-gray-900/60 p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/20">
          <AlertTriangle className="h-4 w-4 text-orange-300" />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div>
            <p className="text-sm font-semibold text-gray-100">
              {t('pilotage.dataRequirements.summaryTitle')}
            </p>
            <p className="mt-1 text-sm text-gray-400">
              {t('pilotage.dataRequirements.summaryBody')}
            </p>
          </div>

          <div className="space-y-2">
            {actionableItems.map((item) => (
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
                {item.missingInputs?.length ? (
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
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PilotageAvailabilitySummary;
