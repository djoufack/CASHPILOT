import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, AlertTriangle, CheckCircle2, CircleOff } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatCurrency } from '@/utils/calculations';
import PanelInfoPopover from '@/components/ui/PanelInfoPopover';

const STATUS_STYLES = {
  attention: {
    badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    icon: AlertTriangle,
    labelKey: 'consolidation.entityStatusAttention',
    fallbackLabel: 'Attention',
  },
  active: {
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    icon: CheckCircle2,
    labelKey: 'consolidation.entityStatusActive',
    fallbackLabel: 'Active',
  },
  inactive: {
    badge: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
    icon: CircleOff,
    labelKey: 'consolidation.entityStatusInactive',
    fallbackLabel: 'Inactive',
  },
};

const SCOPE_OPTIONS = [
  { value: 'all', labelKey: 'consolidation.scopeAll', fallback: 'Toutes les entites' },
  { value: 'active', labelKey: 'consolidation.scopeActive', fallback: 'Entites actives' },
  { value: 'attention', labelKey: 'consolidation.scopeAttention', fallback: 'Entites en attention' },
];

const CONSOLIDATION_METHOD_LABELS = {
  full: {
    labelKey: 'consolidation.methodFull',
    fallbackLabel: 'Integrale',
  },
  proportional: {
    labelKey: 'consolidation.methodProportional',
    fallbackLabel: 'Proportionnelle',
  },
  equity: {
    labelKey: 'consolidation.methodEquity',
    fallbackLabel: 'Mise en equivalence',
  },
  exclude: {
    labelKey: 'consolidation.methodExclude',
    fallbackLabel: 'Hors perimetre',
  },
};

function toPercent(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatPercent(value) {
  const percent = toPercent(value);
  if (percent == null) return '—';
  return `${percent.toFixed(2)}%`;
}

function formatWeight(value) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) return '—';
  const normalized = numericValue <= 1 ? numericValue * 100 : numericValue;
  return `${normalized.toFixed(2)}%`;
}

function getConsolidationMethodLabel(method, t) {
  const normalizedMethod = String(method || 'full').toLowerCase();
  const label = CONSOLIDATION_METHOD_LABELS[normalizedMethod] || CONSOLIDATION_METHOD_LABELS.full;
  return t(label.labelKey, label.fallbackLabel);
}

function getScopeStatus(row, t) {
  const inScope = row?.isInScope ?? row?.is_in_scope;
  if (inScope === false) {
    return {
      label: t('consolidation.scopeOutOfScope', 'Hors perimetre'),
      className: 'bg-slate-500/15 text-slate-300 border-slate-500/30',
    };
  }

  return {
    label: t('consolidation.scopeInScope', 'Dans le perimetre'),
    className: 'bg-emerald-500/15 text-emerald-200 border-emerald-500/30',
  };
}

export default function ConsolidatedEntitiesTable({
  rows = [],
  scope = 'all',
  summary = { total: 0, active: 0, attention: 0, inactive: 0 },
  onScopeChange,
  currency = 'EUR',
}) {
  const { t } = useTranslation();

  const info = useMemo(
    () => ({
      title: t('consolidation.entitiesTitle', 'Entites consolidees'),
      definition: t(
        'consolidation.entitiesDefinition',
        'Vision transversale par societe pour piloter la consolidation multi-entites.'
      ),
      dataSource: t(
        'consolidation.entitiesDataSource',
        'Agregation des flux P&L, bilan, tresorerie et transactions inter-societes de la consolidation.'
      ),
      formula: t(
        'consolidation.entitiesFormula',
        'Statut = attention si eliminations en attente, sinon active si activite detectee, sinon inactive.'
      ),
      calculationMethod: t(
        'consolidation.entitiesCalculation',
        'Croisement des indicateurs par societe puis classement des entites selon le risque et le niveau d activite.'
      ),
    }),
    [t]
  );

  return (
    <Card className="bg-[#0f1528]/80 border-white/10 backdrop-blur-sm">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <CardTitle className="text-white text-base inline-flex items-center gap-1.5">
              <PanelInfoPopover {...info} />
              <span>{t('consolidation.entitiesTitle', 'Entites consolidees')}</span>
            </CardTitle>
            <p className="text-xs text-slate-400">
              {t(
                'consolidation.entitiesDescription',
                'Controlez la couverture multi-entites, les societes en risque et les eliminations en attente.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Badge className="border border-white/10 bg-white/5 text-slate-200">
              {t('consolidation.entitiesTotalCount', '{{count}} entites', { count: summary.total })}
            </Badge>
            <Badge className="border border-emerald-500/30 bg-emerald-500/15 text-emerald-200">
              {t('consolidation.entitiesActiveCount', '{{count}} actives', { count: summary.active })}
            </Badge>
            <Badge className="border border-amber-500/30 bg-amber-500/15 text-amber-200">
              {t('consolidation.entitiesAttentionCount', '{{count}} en attention', { count: summary.attention })}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap gap-2">
          {SCOPE_OPTIONS.map((option) => (
            <Button
              key={option.value}
              type="button"
              variant={scope === option.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => onScopeChange?.(option.value)}
              className={
                scope === option.value
                  ? 'bg-cyan-600 hover:bg-cyan-500 text-white'
                  : 'border-white/20 text-slate-200 hover:bg-white/10'
              }
            >
              {t(option.labelKey, option.fallback)}
            </Button>
          ))}
        </div>

        {rows.length === 0 ? (
          <div className="rounded-lg border border-white/10 bg-[#111a2f] p-6 text-center">
            <Building2 className="mx-auto mb-2 h-8 w-8 text-slate-500" />
            <p className="text-sm text-slate-300">
              {t('consolidation.noEntitiesForScope', 'Aucune entite a afficher.')}
            </p>
          </div>
        ) : (
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-slate-400 text-xs">{t('consolidation.company', 'Societe')}</TableHead>
                  <TableHead className="text-slate-400 text-xs">{t('common.status')}</TableHead>
                  <TableHead className="text-slate-400 text-xs">
                    {t('consolidation.consolidationMethod', 'Methode')}
                  </TableHead>
                  <TableHead className="text-slate-400 text-xs text-right">
                    {t('consolidation.ownershipControl', 'Ownership / control')}
                  </TableHead>
                  <TableHead className="text-slate-400 text-xs text-right">
                    {t('consolidation.consolidationWeight', 'Poids')}
                  </TableHead>
                  <TableHead className="text-slate-400 text-xs">{t('consolidation.scope', 'Perimetre')}</TableHead>
                  <TableHead className="text-slate-400 text-xs text-right">
                    {t('consolidation.consolidatedRevenue')}
                  </TableHead>
                  <TableHead className="text-slate-400 text-xs text-right">{t('consolidation.netIncome')}</TableHead>
                  <TableHead className="text-slate-400 text-xs text-right">{t('consolidation.cashPosition')}</TableHead>
                  <TableHead className="text-slate-400 text-xs text-right">
                    {t('consolidation.pendingEliminations', 'Eliminations en attente')}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const style = STATUS_STYLES[row.status] || STATUS_STYLES.inactive;
                  const StatusIcon = style.icon;
                  const scopeStatus = getScopeStatus(row, t);
                  const methodLabel = getConsolidationMethodLabel(
                    row.consolidation_method ?? row.consolidationMethod,
                    t
                  );
                  const ownershipPct = row.ownership_pct ?? row.ownershipPct;
                  const controlPct = row.control_pct ?? row.controlPct;
                  const weight = row.consolidation_weight ?? row.consolidationWeight;
                  const isOutOfScope = (row?.isInScope ?? row?.is_in_scope) === false;

                  return (
                    <TableRow
                      key={row.companyId}
                      className={`border-white/5 hover:bg-white/5 ${isOutOfScope ? 'opacity-70' : ''}`}
                    >
                      <TableCell className="text-white text-sm font-medium">{row.companyName}</TableCell>
                      <TableCell>
                        <Badge className={`gap-1 text-[10px] border ${style.badge}`}>
                          <StatusIcon className="h-3 w-3" />
                          {t(style.labelKey, style.fallbackLabel)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge className="border border-cyan-500/30 bg-cyan-500/15 text-cyan-200 text-[10px]">
                          {methodLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-white text-sm tabular-nums whitespace-nowrap">
                        {formatPercent(ownershipPct)} / {formatPercent(controlPct)}
                      </TableCell>
                      <TableCell className="text-right text-white text-sm tabular-nums whitespace-nowrap">
                        {formatWeight(weight)}
                      </TableCell>
                      <TableCell>
                        <Badge className={`text-[10px] border ${scopeStatus.className}`}>{scopeStatus.label}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-white text-sm tabular-nums">
                        {formatCurrency(row.revenue || 0, currency)}
                      </TableCell>
                      <TableCell className="text-right text-white text-sm tabular-nums">
                        {formatCurrency(row.netIncome || 0, currency)}
                      </TableCell>
                      <TableCell className="text-right text-white text-sm tabular-nums">
                        {formatCurrency(row.cashBalance || 0, currency)}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        <span className="text-amber-300 tabular-nums">
                          {formatCurrency(row.pendingEliminationAmount || 0, currency)}
                        </span>
                        <span className="ml-2 text-xs text-slate-400">({row.pendingEliminationCount || 0})</span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
