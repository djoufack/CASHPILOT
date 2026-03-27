import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import PanelInfoPopover from '@/components/ui/PanelInfoPopover';
import { resolveAccountingCurrency } from '@/services/databaseCurrencyService';
import { formatCurrency } from '@/utils/currencyService';
import {
  TrendingUp,
  BarChart3,
  Wallet,
  ArrowUpDown,
  Gem,
} from 'lucide-react';

const KPI_CONFIG = [
  {
    key: 'revenue',
    icon: TrendingUp,
    labelKey: 'pilotage.kpis.revenue',
    color: 'blue',
    getValue: (data) => data.revenue,
  },
  {
    key: 'ebitda',
    icon: BarChart3,
    labelKey: 'pilotage.kpis.ebitda',
    color: 'emerald',
    getValue: (data) => data.financialDiagnostic?.margins?.ebitda,
  },
  {
    key: 'netResult',
    icon: Wallet,
    labelKey: 'pilotage.kpis.netResult',
    color: 'orange',
    getValue: (data) => data.netIncome,
  },
  {
    key: 'freeCashFlow',
    icon: ArrowUpDown,
    labelKey: 'pilotage.kpis.freeCashFlow',
    color: 'purple',
    getValue: (data) => data.pilotageRatios?.cashFlow?.freeCashFlow,
  },
  {
    key: 'valuation',
    icon: Gem,
    labelKey: 'pilotage.kpis.valuation',
    color: 'amber',
    getValue: (data) => data.valuation?.multiples?.midValue,
  },
];

const COLOR_MAP = {
  blue: {
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/20',
  },
  emerald: {
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/20',
  },
  orange: {
    bg: 'bg-orange-500/10',
    text: 'text-orange-400',
    border: 'border-orange-500/20',
  },
  purple: {
    bg: 'bg-purple-500/10',
    text: 'text-purple-400',
    border: 'border-purple-500/20',
  },
  amber: {
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/20',
  },
};

const KPI_INFO = {
  revenue: {
    title: 'Chiffre d’affaires',
    definition: 'Montant total du chiffre d’affaires consolidé pour la période sélectionnée.',
    dataSource: 'Données pilotage issues des revenus consolidés et des factures prises en compte par le module pilotage.',
    formula: 'Chiffre d’affaires = somme des revenus comptabilisés sur la période.',
    calculationMethod: 'Agrége les revenus disponibles pour la période courante et les formate dans la devise de la société.',
    notes: 'Le détail des règles de consolidation est calculé en amont dans les hooks pilotage.',
  },
  ebitda: {
    title: 'EBITDA',
    definition: 'Résultat opérationnel avant intérêts, impôts, dépréciations et amortissements.',
    dataSource: 'Diagnostic financier pilotage, basé sur les agrégats comptables calculés par le module financier.',
    formula: 'EBITDA = résultat opérationnel + dotations aux amortissements + dotations aux provisions.',
    calculationMethod: 'Utilise la valeur EBITDA exposée par `financialDiagnostic.margins.ebitda` pour la société et la période active.',
    notes: 'Lorsque certaines données sont absentes, la valeur peut être affichée comme non disponible.',
  },
  netResult: {
    title: 'Résultat net',
    definition: 'Bénéfice ou perte nette après prise en compte de l’ensemble des charges et produits.',
    dataSource: 'Calcul pilotage provenant du résultat net consolidé de la période.',
    formula: 'Résultat net = produits - charges - impôts - éléments exceptionnels.',
    calculationMethod: 'S’appuie sur `data.netIncome`, calculé en amont à partir des données comptables du périmètre actif.',
  },
  freeCashFlow: {
    title: 'Free cash flow',
    definition: 'Trésorerie libre générée après investissements nécessaires au maintien de l’activité.',
    dataSource: 'Flux de trésorerie pilotage calculés à partir des mouvements de cash et des investissements.',
    formula: 'FCF = cash flow opérationnel - investissements nets.',
    calculationMethod: 'Extrait la valeur `data.pilotageRatios.cashFlow.freeCashFlow` calculée sur la période sélectionnée.',
  },
  valuation: {
    title: 'Valorisation',
    definition: 'Estimation de la valeur de l’entreprise à partir des multiples appliqués au périmètre pilotage.',
    dataSource: 'Module de valorisation pilotage, basé sur les multiples financiers calculés en amont.',
    formula: 'Valorisation = multiple retenu × base de référence économique.',
    calculationMethod: 'Utilise la valeur médiane de `data.valuation.multiples.midValue` exposée par le moteur de valorisation.',
    notes: 'La valorisation dépend des hypothèses de marché et du périmètre analysé.',
  },
};

const KPICard = ({ icon: Icon, label, info, value, color, currency }) => {
  const colors = COLOR_MAP[color];
  const formattedValue =
    value != null ? formatCurrency(value, currency) : '--';

  return (
    <Card className="bg-gray-900/50 border border-gray-800/50 rounded-xl">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div
            className={`flex-shrink-0 w-10 h-10 rounded-lg ${colors.bg} ${colors.border} border flex items-center justify-center`}
          >
            <Icon className={`w-5 h-5 ${colors.text}`} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 min-w-0">
              <PanelInfoPopover
                title={info?.title || label}
                definition={info?.definition}
                dataSource={info?.dataSource}
                formula={info?.formula}
                calculationMethod={info?.calculationMethod}
                notes={info?.notes}
              />
              <p className="text-xs font-medium text-gray-400 truncate">
                {label}
              </p>
            </div>
            <p className={`text-lg font-bold text-gray-100 mt-0.5 truncate`}>
              {formattedValue}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

const KPICardGrid = ({ data }) => {
  const { t } = useTranslation();
  const currency = resolveAccountingCurrency(data?.company);

  const kpis = useMemo(
    () =>
      KPI_CONFIG.map((cfg) => ({
        ...cfg,
        label: t(cfg.labelKey),
        info: KPI_INFO[cfg.key],
        value: cfg.getValue(data),
      })),
    [data, t]
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {kpis.map((kpi) => (
        <KPICard
          key={kpi.key}
          icon={kpi.icon}
          label={kpi.label}
          info={kpi.info}
          value={kpi.value}
          color={kpi.color}
          currency={currency}
        />
      ))}
    </div>
  );
};

export default KPICardGrid;
