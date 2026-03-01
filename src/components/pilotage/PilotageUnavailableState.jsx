import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Database } from 'lucide-react';

const TONE_BY_STATUS = {
  unavailable: 'border-red-500/20 bg-red-500/10 text-red-100',
  partial: 'border-amber-500/20 bg-amber-500/10 text-amber-100',
};

const PilotageUnavailableState = ({ item }) => {
  const { t } = useTranslation();

  if (!item) return null;

  const tone = TONE_BY_STATUS[item.status] || TONE_BY_STATUS.unavailable;
  const title = item.titleKey ? t(item.titleKey) : t('pilotage.dataRequirements.fallbackTitle');
  const isPartial = item.status === 'partial';
  const missingInputs = item.missingInputs || [];

  return (
    <div className={`rounded-2xl border p-5 ${tone}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-black/20">
          <AlertTriangle className="h-4 w-4" />
        </div>
        <div className="min-w-0 space-y-3">
          <div>
            <p className="text-sm font-semibold">
              {isPartial
                ? t('pilotage.dataRequirements.partialTitle', { item: title })
                : t('pilotage.dataRequirements.unavailableTitle', { item: title })}
            </p>
            <p className="mt-1 text-sm opacity-90">
              {isPartial
                ? t('pilotage.dataRequirements.partialBody')
                : t('pilotage.dataRequirements.unavailableBody')}
            </p>
          </div>

          {missingInputs.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.16em] opacity-80">
                <Database className="h-3 w-3" />
                <span>{t('pilotage.dataRequirements.missingInputsLabel')}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {missingInputs.map((inputKey) => (
                  <span
                    key={`${item.key}-${inputKey}`}
                    className="inline-flex rounded-full border border-white/10 bg-black/20 px-2.5 py-1 text-xs"
                  >
                    {t(`pilotage.dataRequirements.inputs.${inputKey}`)}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default PilotageUnavailableState;
