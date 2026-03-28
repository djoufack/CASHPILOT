import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { BellRing } from 'lucide-react';
import {
  PILOTAGE_ALERT_DEFAULT_SETTINGS,
  PILOTAGE_ALERT_RULES,
  PILOTAGE_ALERT_TYPE_ORDER,
  normalizePilotageAlertSettings,
} from '@/hooks/usePilotageAlertSubscriptions';

const formatThreshold = (value) => {
  if (value == null || value === '') return '';
  const numeric = Number(value);
  return Number.isFinite(numeric) ? String(numeric) : '';
};

const formatDisplayedValue = (value) => {
  return Number.isFinite(value) ? String(value) : '—';
};

const AlertSubscriptionRow = ({ type, value, onChange, setting }) => {
  const { t } = useTranslation();
  const rule = PILOTAGE_ALERT_RULES[type];
  const enabled = setting?.enabled !== false;
  const thresholdValue = formatThreshold(setting?.threshold ?? rule.defaultThreshold);

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-gray-100">{t(rule.labelKey)}</h4>
            <Badge
              variant={enabled ? 'default' : 'secondary'}
              className={enabled ? 'bg-emerald-500/15 text-emerald-200' : ''}
            >
              {enabled ? t('pilotage.alertSubscriptions.enabled') : t('pilotage.alertSubscriptions.disabled')}
            </Badge>
          </div>
          <p className="text-sm text-gray-400">{t(rule.descriptionKey)}</p>
        </div>
        <Switch checked={enabled} onCheckedChange={(nextValue) => onChange(type, { enabled: nextValue })} />
      </div>
      <div className="grid gap-2 sm:grid-cols-[1fr_140px] sm:items-end">
        <div className="space-y-1">
          <Label
            htmlFor={`pilotage-alert-threshold-${type}`}
            className="text-xs uppercase tracking-[0.18em] text-gray-500"
          >
            {t('pilotage.alertSubscriptions.threshold')}
          </Label>
          <Input
            id={`pilotage-alert-threshold-${type}`}
            type="number"
            inputMode="decimal"
            step="any"
            value={thresholdValue}
            onChange={(event) => onChange(type, { threshold: event.target.value })}
            className="bg-gray-950/60 border-white/10 text-gray-100"
          />
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-xs text-gray-400">
          <p className="uppercase tracking-[0.18em] text-gray-500">{t('pilotage.alertSubscriptions.currentValue')}</p>
          <p className="mt-1 text-sm text-gray-200">{formatDisplayedValue(value)}</p>
        </div>
      </div>
    </div>
  );
};

const PilotageAlertSubscriptionDialog = ({
  open,
  onOpenChange,
  settings,
  onSave,
  loading = false,
  saving = false,
  data = {},
}) => {
  const { t } = useTranslation();
  const currentSettings = useMemo(
    () => normalizePilotageAlertSettings(settings || PILOTAGE_ALERT_DEFAULT_SETTINGS),
    [settings]
  );
  const [draftSettings, setDraftSettings] = useState(currentSettings);

  useEffect(() => {
    if (!open) return;
    setDraftSettings(currentSettings);
  }, [currentSettings, open]);

  const handleTypeChange = (type, patch) => {
    setDraftSettings((prev) => ({
      ...prev,
      [type]: {
        ...(prev[type] || PILOTAGE_ALERT_DEFAULT_SETTINGS[type]),
        ...(patch.enabled === undefined ? {} : { enabled: patch.enabled }),
        ...(patch.threshold === undefined ? {} : { threshold: patch.threshold }),
      },
    }));
  };

  const previewValues = useMemo(() => {
    const companyId = data?.company?.id || null;
    return PILOTAGE_ALERT_TYPE_ORDER.reduce((acc, type) => {
      const rule = PILOTAGE_ALERT_RULES[type];
      const key = companyId ? `${companyId}.${type}` : type;
      acc[key] = rule.value(data);
      return acc;
    }, {});
  }, [data]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-gray-700 bg-gray-950 text-gray-100 sm:max-w-3xl">
        <DialogHeader className="text-left">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <BellRing className="h-5 w-5 text-orange-400" />
            {t('pilotage.alertSubscriptions.title')}
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            {t('pilotage.alertSubscriptions.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3">
          {PILOTAGE_ALERT_TYPE_ORDER.map((type) => (
            <AlertSubscriptionRow
              key={type}
              type={type}
              value={previewValues[data?.company?.id ? `${data.company.id}.${type}` : type]}
              setting={draftSettings[type]}
              onChange={handleTypeChange}
            />
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-3">
          <Button
            type="button"
            variant="outline"
            className="border-gray-700 bg-transparent text-gray-200 hover:bg-gray-800"
            onClick={() => {
              setDraftSettings(PILOTAGE_ALERT_DEFAULT_SETTINGS);
              onSave(PILOTAGE_ALERT_DEFAULT_SETTINGS);
            }}
            disabled={loading || saving}
          >
            {t('pilotage.alertSubscriptions.reset')}
          </Button>
          <Button
            type="button"
            className="bg-orange-500 text-white hover:bg-orange-400"
            onClick={async () => {
              await onSave(normalizePilotageAlertSettings(draftSettings));
              onOpenChange(false);
            }}
            disabled={loading || saving}
          >
            {saving ? t('pilotage.alertSubscriptions.saving') : t('pilotage.alertSubscriptions.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PilotageAlertSubscriptionDialog;
