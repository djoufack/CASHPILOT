import React, { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Activity,
  AlertTriangle,
  ArrowDown,
  ArrowRightLeft,
  ArrowUp,
  BarChart3,
  Calendar,
  CreditCard,
  DollarSign,
  Droplets,
  FileDown,
  FileText,
  LayoutGrid,
  List,
  MoveDown,
  MoveUp,
  PanelRightOpen,
  Scale,
  Settings2,
  Sparkles,
  Target,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import RatioInfoPopover from './RatioInfoPopover';
import MarginAnalysisSection from './MarginAnalysisSection';
import FinancingAnalysisSection from './FinancingAnalysisSection';
import KeyRatiosSection from './KeyRatiosSection';

const STORAGE_KEY = 'cashpilot.financial-diagnostic-layout.v3';

const COMPARISON_OPTIONS = {
  yoy: { label: 'N/N-1', sourceKey: 'yearOverYear' },
  mom: { label: 'M/M', sourceKey: 'monthOverMonth' },
  qoq: { label: 'T/T', sourceKey: 'quarterOverQuarter' },
};

const SECTION_FILTERS = [
  { value: 'all', label: 'Toutes categories' },
  { value: 'margins', label: 'Marges' },
  { value: 'financing', label: 'Financement' },
  { value: 'ratios', label: 'Ratios' },
];

const SORT_OPTIONS = [
  { value: 'custom', label: 'Ordre personnalise' },
  { value: 'priority', label: 'Priorite alertes' },
  { value: 'value', label: 'Valeur decroissante' },
  { value: 'alpha', label: 'Alphabetique' },
];

const SECTOR_BENCHMARKS = {
  services: {
    grossMarginPercent: 42,
    ebitdaMargin: 14,
    operatingMargin: 11,
    netMargin: 8,
    roe: 15,
    roce: 11,
    currentRatio: 1.4,
    quickRatio: 1.1,
    cashRatio: 0.25,
    financialLeverage: 1.1,
    debtRatio: 1.1,
    autonomyRatio: 48,
    bfr: 25000,
    caf: 50000,
    operatingCashFlow: 32000,
  },
  commerce: {
    grossMarginPercent: 30,
    ebitdaMargin: 9,
    operatingMargin: 6,
    netMargin: 4,
    roe: 12,
    roce: 8,
    currentRatio: 1.2,
    quickRatio: 0.9,
    cashRatio: 0.2,
    financialLeverage: 1.4,
    debtRatio: 1.5,
    autonomyRatio: 41,
    bfr: 35000,
    caf: 42000,
    operatingCashFlow: 21000,
  },
  industrie: {
    grossMarginPercent: 36,
    ebitdaMargin: 13,
    operatingMargin: 9,
    netMargin: 6,
    roe: 13,
    roce: 10,
    currentRatio: 1.5,
    quickRatio: 1.0,
    cashRatio: 0.2,
    financialLeverage: 1.7,
    debtRatio: 1.8,
    autonomyRatio: 37,
    bfr: 50000,
    caf: 72000,
    operatingCashFlow: 38000,
  },
};

const asNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const shiftDateInput = (dateInput, { years = 0, months = 0, days = 0 } = {}) => {
  if (!dateInput) return null;
  const shifted = new Date(`${dateInput}T00:00:00`);
  shifted.setFullYear(shifted.getFullYear() + years);
  shifted.setMonth(shifted.getMonth() + months);
  shifted.setDate(shifted.getDate() + days);
  return shifted;
};

const formatMoney = (value, currency) => new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency,
}).format(asNumber(value));

const formatMetric = (value, formatType, currency) => {
  const number = asNumber(value);
  if (formatType === 'currency') return formatMoney(number, currency);
  if (formatType === 'percentage') return `${number.toFixed(1)}%`;
  return number.toFixed(2);
};

const metricAccessors = {
  revenue: (d) => asNumber(d?.margins?.revenue),
  grossMargin: (d) => asNumber(d?.margins?.grossMargin),
  grossMarginPercent: (d) => asNumber(d?.margins?.grossMarginPercent),
  ebitda: (d) => asNumber(d?.margins?.ebitda),
  ebitdaMargin: (d) => asNumber(d?.margins?.ebitdaMargin),
  operatingResult: (d) => asNumber(d?.margins?.operatingResult),
  operatingMargin: (d) => asNumber(d?.margins?.operatingMargin),
  caf: (d) => asNumber(d?.financing?.caf),
  workingCapital: (d) => asNumber(d?.financing?.workingCapital),
  bfr: (d) => asNumber(d?.financing?.bfr),
  bfrVariation: (d) => asNumber(d?.financing?.bfrVariation),
  operatingCashFlow: (d) => asNumber(d?.financing?.operatingCashFlow),
  netDebt: (d) => asNumber(d?.financing?.netDebt),
  equity: (d) => asNumber(d?.financing?.equity),
  totalDebt: (d) => asNumber(d?.financing?.totalDebt),
  debtRatio: (d) => {
    const equity = asNumber(d?.financing?.equity);
    return equity !== 0 ? asNumber(d?.financing?.totalDebt) / equity : 0;
  },
  debtShare: (d) => {
    const equity = asNumber(d?.financing?.equity);
    const debt = asNumber(d?.financing?.totalDebt);
    return equity + debt > 0 ? (debt / (equity + debt)) * 100 : 0;
  },
  roe: (d) => asNumber(d?.ratios?.profitability?.roe),
  roa: (d) => asNumber(d?.ratios?.profitability?.roa),
  roce: (d) => asNumber(d?.ratios?.profitability?.roce),
  netMargin: (d) => asNumber(d?.ratios?.profitability?.netMargin),
  currentRatio: (d) => asNumber(d?.ratios?.liquidity?.currentRatio),
  quickRatio: (d) => asNumber(d?.ratios?.liquidity?.quickRatio),
  cashRatio: (d) => asNumber(d?.ratios?.liquidity?.cashRatio),
  financialLeverage: (d) => asNumber(d?.ratios?.leverage?.financialLeverage),
  autonomyRatio: (d) => {
    const leverage = asNumber(d?.ratios?.leverage?.financialLeverage);
    return leverage !== 0 ? (1 / (1 + leverage)) * 100 : 100;
  },
};
const CARD_DEFINITIONS = [
  {
    id: 'revenue',
    title: "Chiffre d'affaires",
    section: 'margins',
    metricKey: 'revenue',
    format: 'currency',
    betterWhen: 'higher',
    trendKey: 'revenue',
    sourceGroup: 'revenue',
    icon: DollarSign,
    colorClass: 'text-blue-300',
    info: {
      title: "Chiffre d'affaires",
      formula: 'Somme des ventes HT sur la periode',
      definition: "Le chiffre d'affaires mesure le niveau d'activite commerciale.",
      utility: 'Il sert de base a tous les ratios de performance.',
      interpretation: 'Une hausse durable est positive. Une baisse impose une analyse client/prix/volume.',
    },
    why: "Ce KPI suit directement la traction commerciale de l'entreprise.",
    how: 'Ameliorer conversion, panier moyen et retention client.',
  },
  {
    id: 'gross-margin',
    title: 'Marge brute',
    section: 'margins',
    metricKey: 'grossMargin',
    format: 'currency',
    betterWhen: 'higher',
    trendKey: 'margin',
    sourceGroup: 'expense',
    icon: Target,
    colorClass: 'text-emerald-300',
    info: {
      title: 'Marge brute',
      formula: 'Marge brute = CA - couts directs',
      definition: 'La marge brute montre la valeur creee avant charges de structure.',
      utility: 'Elle valide le couple prix/couts directs.',
      interpretation: 'Une baisse traduit souvent une pression tarifaire ou une hausse des couts directs.',
    },
    why: 'La marge brute montre la capacite a transformer les ventes en valeur.',
    how: 'Renegocier achats, ajuster pricing, prioriser les offres a meilleure contribution.',
  },
  {
    id: 'gross-margin-rate',
    title: 'Marge brute (%)',
    section: 'margins',
    metricKey: 'grossMarginPercent',
    format: 'percentage',
    betterWhen: 'higher',
    trendKey: 'margin',
    sourceGroup: 'expense',
    icon: TrendingUp,
    colorClass: 'text-emerald-300',
    why: 'Le pourcentage rend la marge comparable entre periodes.',
    how: 'Ameliorer mix produit et efficacite achat.',
  },
  {
    id: 'ebitda',
    title: 'EBE / EBITDA',
    section: 'margins',
    metricKey: 'ebitda',
    format: 'currency',
    betterWhen: 'higher',
    trendKey: 'cashFlow',
    sourceGroup: 'expense',
    icon: Activity,
    colorClass: 'text-violet-300',
    why: "L'EBITDA mesure la performance operationnelle avant elements non cash.",
    how: 'Optimiser charges recurrentes et productivite des equipes.',
  },
  {
    id: 'ebitda-margin',
    title: 'Marge EBITDA',
    section: 'margins',
    metricKey: 'ebitdaMargin',
    format: 'percentage',
    betterWhen: 'higher',
    trendKey: 'margin',
    sourceGroup: 'expense',
    icon: BarChart3,
    colorClass: 'text-violet-300',
    why: "Ce ratio montre la part de CA convertie en performance d'exploitation.",
    how: 'Automatiser process, revoir politique de remises, reduire frais fixes.',
  },
  {
    id: 'operating-result',
    title: "Resultat d'exploitation",
    section: 'margins',
    metricKey: 'operatingResult',
    format: 'currency',
    betterWhen: 'higher',
    trendKey: 'cashFlow',
    sourceGroup: 'expense',
    icon: TrendingUp,
    colorClass: 'text-green-300',
    why: "Il indique si le coeur d'activite est rentable.",
    how: 'Reallouer budget vers segments rentables et maitriser OPEX.',
  },
  {
    id: 'operating-margin',
    title: 'Marge operationnelle',
    section: 'margins',
    metricKey: 'operatingMargin',
    format: 'percentage',
    betterWhen: 'higher',
    trendKey: 'margin',
    sourceGroup: 'expense',
    icon: Sparkles,
    colorClass: 'text-green-300',
    why: 'Elle donne une vision rapide de la solidite economique.',
    how: 'Piloter prix, productivite et structure de couts.',
  },
  {
    id: 'caf',
    title: "Capacite d'autofinancement (CAF)",
    section: 'financing',
    metricKey: 'caf',
    format: 'currency',
    betterWhen: 'higher',
    trendKey: 'cashFlow',
    sourceGroup: 'cash',
    icon: Wallet,
    colorClass: 'text-emerald-300',
    why: "La CAF indique les ressources internes generees par l'activite.",
    how: 'Ameliorer rentabilite et limiter charges non productives.',
  },
  {
    id: 'working-capital',
    title: 'Fonds de roulement',
    section: 'financing',
    metricKey: 'workingCapital',
    format: 'currency',
    betterWhen: 'higher',
    trendKey: 'cashFlow',
    sourceGroup: 'liquidity',
    icon: CreditCard,
    colorClass: 'text-sky-300',
    why: 'Le FDR represente la marge de securite financiere a long terme.',
    how: 'Renforcer fonds propres ou allonger maturite de dette.',
  },
  {
    id: 'bfr',
    title: 'Besoin en fonds de roulement (BFR)',
    section: 'financing',
    metricKey: 'bfr',
    format: 'currency',
    betterWhen: 'lower',
    trendKey: 'expense',
    sourceGroup: 'liquidity',
    icon: ArrowRightLeft,
    colorClass: 'text-orange-300',
    why: 'Le BFR mesure le cash immobilise dans le cycle exploitation.',
    how: 'Accelerer encaissements, optimiser stocks, negocier fournisseurs.',
  },
  {
    id: 'bfr-variation',
    title: 'Variation BFR',
    section: 'financing',
    metricKey: 'bfrVariation',
    format: 'currency',
    betterWhen: 'lower',
    trendKey: 'expense',
    sourceGroup: 'liquidity',
    icon: MoveUp,
    colorClass: 'text-orange-300',
    why: 'Une variation positive peut absorber la tresorerie disponible.',
    how: 'Mettre en place suivi DSO/DPO et seuils de stock.',
  },
  {
    id: 'operating-cashflow',
    title: "Flux de tresorerie d'exploitation",
    section: 'financing',
    metricKey: 'operatingCashFlow',
    format: 'currency',
    betterWhen: 'higher',
    trendKey: 'cashFlow',
    sourceGroup: 'cash',
    icon: Activity,
    colorClass: 'text-emerald-300',
    why: "Ce flux valide la capacite de l'activite a generer du cash reel.",
    how: 'Augmenter CAF et reduire consommation BFR.',
  },
  {
    id: 'net-debt',
    title: 'Endettement net',
    section: 'financing',
    metricKey: 'netDebt',
    format: 'currency',
    betterWhen: 'lower',
    trendKey: 'cashFlow',
    sourceGroup: 'debt',
    icon: CreditCard,
    colorClass: 'text-amber-300',
    why: 'Il mesure le poids reel de la dette apres tresorerie disponible.',
    how: 'Desendetter, renegocier taux, renforcer cash.',
  },
  {
    id: 'debt-ratio',
    title: "Ratio d'endettement",
    section: 'financing',
    metricKey: 'debtRatio',
    format: 'number',
    betterWhen: 'lower',
    trendKey: 'expense',
    sourceGroup: 'debt',
    icon: Scale,
    colorClass: 'text-amber-300',
    why: 'Il mesure le poids dette / capitaux propres.',
    how: 'Limiter dette courte et renforcer capitaux propres.',
  },
  {
    id: 'debt-share',
    title: 'Part de dette',
    section: 'financing',
    metricKey: 'debtShare',
    format: 'percentage',
    betterWhen: 'lower',
    trendKey: 'expense',
    sourceGroup: 'debt',
    icon: MoveDown,
    colorClass: 'text-amber-300',
    why: 'Cet indicateur visualise le niveau de dependance au levier dette.',
    how: 'Diversifier financements et reduire besoins de cash circulant.',
  },
  {
    id: 'roe',
    title: 'ROE',
    section: 'ratios',
    metricKey: 'roe',
    format: 'percentage',
    betterWhen: 'higher',
    trendKey: 'margin',
    sourceGroup: 'equity',
    icon: Target,
    colorClass: 'text-green-300',
    why: 'Le ROE mesure le rendement des fonds propres.',
    how: 'Ameliorer marge nette et rotation du capital.',
  },
  {
    id: 'roce',
    title: 'ROCE',
    section: 'ratios',
    metricKey: 'roce',
    format: 'percentage',
    betterWhen: 'higher',
    trendKey: 'margin',
    sourceGroup: 'equity',
    icon: Target,
    colorClass: 'text-green-300',
    why: 'Le ROCE mesure la performance du capital employe.',
    how: 'Prioriser investissements au ROI eleve.',
  },
  {
    id: 'roa',
    title: 'ROA',
    section: 'ratios',
    metricKey: 'roa',
    format: 'percentage',
    betterWhen: 'higher',
    trendKey: 'margin',
    sourceGroup: 'equity',
    icon: Activity,
    colorClass: 'text-green-300',
    why: 'Le ROA relie profitabilite et efficacite des actifs.',
    how: 'Augmenter resultat net et optimiser usage des actifs.',
  },
  {
    id: 'net-margin',
    title: 'Marge nette',
    section: 'ratios',
    metricKey: 'netMargin',
    format: 'percentage',
    betterWhen: 'higher',
    trendKey: 'margin',
    sourceGroup: 'expense',
    icon: Sparkles,
    colorClass: 'text-cyan-300',
    why: 'La marge nette donne la profitabilite finale apres toutes charges.',
    how: 'Maitriser charges financieres/fiscales et couts indirects.',
  },
  {
    id: 'current-ratio',
    title: 'Liquidite generale',
    section: 'ratios',
    metricKey: 'currentRatio',
    format: 'number',
    betterWhen: 'higher',
    trendKey: 'cashFlow',
    sourceGroup: 'liquidity',
    icon: Droplets,
    colorClass: 'text-sky-300',
    why: 'Elle mesure la capacite a honorer les dettes CT.',
    how: 'Renforcer cash et reduire dettes court terme.',
  },
  {
    id: 'quick-ratio',
    title: 'Liquidite reduite',
    section: 'ratios',
    metricKey: 'quickRatio',
    format: 'number',
    betterWhen: 'higher',
    trendKey: 'cashFlow',
    sourceGroup: 'liquidity',
    icon: Droplets,
    colorClass: 'text-sky-300',
    why: 'Elle teste la solvabilite sans vendre les stocks.',
    how: 'Mieux collecter creances et stabiliser echeances fournisseurs.',
  },
  {
    id: 'cash-ratio',
    title: 'Liquidite immediate',
    section: 'ratios',
    metricKey: 'cashRatio',
    format: 'number',
    betterWhen: 'higher',
    trendKey: 'cashFlow',
    sourceGroup: 'cash',
    icon: Droplets,
    colorClass: 'text-sky-300',
    why: 'Elle mesure la couverture cash immediate des dettes CT.',
    how: 'Conserver matelas de tresorerie et previsions de cash hebdo.',
  },
  {
    id: 'financial-leverage',
    title: 'Levier financier',
    section: 'ratios',
    metricKey: 'financialLeverage',
    format: 'number',
    betterWhen: 'lower',
    trendKey: 'expense',
    sourceGroup: 'debt',
    icon: Scale,
    colorClass: 'text-orange-300',
    why: 'Le levier eleve augmente sensibilite au risque de remboursement.',
    how: 'Renforcer equity et reduire dette non productive.',
  },
  {
    id: 'autonomy-ratio',
    title: 'Autonomie financiere',
    section: 'ratios',
    metricKey: 'autonomyRatio',
    format: 'percentage',
    betterWhen: 'higher',
    trendKey: 'cashFlow',
    sourceGroup: 'equity',
    icon: Scale,
    colorClass: 'text-emerald-300',
    why: 'Elle mesure la part de financement interne.',
    how: 'Consolider reserves et pilotage prudent du financement externe.',
  },
];

const DEFAULT_CARD_ORDER = CARD_DEFINITIONS.map((card) => card.id);

const truncate = (text, max = 120) => {
  if (!text) return '';
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}...`;
};

const getMetricValue = (diagnostic, metricKey) => {
  if (!metricKey || !metricAccessors[metricKey]) return null;
  return metricAccessors[metricKey](diagnostic);
};

const getComparisonInfo = (current, previous, betterWhen = 'higher') => {
  if (!Number.isFinite(current) || !Number.isFinite(previous)) return null;
  const delta = current - previous;
  const percent = previous !== 0 ? (delta / Math.abs(previous)) * 100 : null;
  const better = betterWhen === 'lower' ? delta <= 0 : delta >= 0;

  return {
    delta,
    percent,
    better,
  };
};

const formatDelta = (value, formatType, currency) => {
  const sign = value > 0 ? '+' : '';
  if (formatType === 'currency') return `${sign}${formatMoney(value, currency)}`;
  if (formatType === 'percentage') return `${sign}${value.toFixed(1)} pts`;
  return `${sign}${value.toFixed(2)}`;
};

const getTrendSeriesMap = (monthlyData) => {
  if (!Array.isArray(monthlyData) || monthlyData.length === 0) {
    const empty = Array.from({ length: 12 }, () => 0);
    return { revenue: empty, expense: empty, cashFlow: empty, margin: empty };
  }

  const sorted = [...monthlyData]
    .filter((row) => row && row.key)
    .sort((a, b) => a.key.localeCompare(b.key))
    .slice(-12);

  const padded = sorted.length < 12
    ? [...Array.from({ length: 12 - sorted.length }, () => ({ revenue: 0, expense: 0 })), ...sorted]
    : sorted;

  const revenue = padded.map((row) => asNumber(row.revenue));
  const expense = padded.map((row) => asNumber(row.expense));
  const cashFlow = padded.map((_, idx) => revenue[idx] - expense[idx]);
  const margin = padded.map((_, idx) => (revenue[idx] !== 0 ? ((revenue[idx] - expense[idx]) / revenue[idx]) * 100 : 0));

  return { revenue, expense, cashFlow, margin };
};

const getAccountsForSourceGroup = (trialBalance, sourceGroup) => {
  if (!Array.isArray(trialBalance)) return [];

  const predicates = {
    revenue: (row) => row.account_type === 'revenue' || String(row.account_code || '').startsWith('70'),
    expense: (row) => row.account_type === 'expense' || String(row.account_code || '').startsWith('6'),
    cash: (row) => String(row.account_code || '').startsWith('5'),
    debt: (row) =>
      row.account_type === 'liability' ||
      ['16', '17', '18', '40', '44'].some((prefix) => String(row.account_code || '').startsWith(prefix)),
    equity: (row) => row.account_type === 'equity' || ['10', '11', '12', '13'].some((prefix) => String(row.account_code || '').startsWith(prefix)),
    liquidity: (row) => ['3', '4', '5'].some((prefix) => String(row.account_code || '').startsWith(prefix)),
  };

  const predicate = predicates[sourceGroup] || (() => true);

  return trialBalance
    .filter(predicate)
    .map((row) => ({
      ...row,
      balanceAbs: Math.abs(asNumber(row.balance)),
    }))
    .sort((a, b) => b.balanceAbs - a.balanceAbs)
    .slice(0, 12);
};
const buildCriticalAlerts = (diagnostic, currency) => {
  const alerts = [];
  const ebitdaMargin = getMetricValue(diagnostic, 'ebitdaMargin');
  const operatingMargin = getMetricValue(diagnostic, 'operatingMargin');
  const currentRatio = getMetricValue(diagnostic, 'currentRatio');
  const financialLeverage = getMetricValue(diagnostic, 'financialLeverage');
  const operatingCashFlow = getMetricValue(diagnostic, 'operatingCashFlow');
  const bfrVariation = getMetricValue(diagnostic, 'bfrVariation');

  if (operatingMargin < 5) {
    alerts.push({
      id: 'alert-operating-margin',
      severity: 100,
      title: 'Marge operationnelle faible',
      description: `La marge operationnelle est a ${operatingMargin.toFixed(1)}%.`,
      action: 'Revoir structure de couts et prix des offres a faible contribution.',
      cardId: 'operating-margin',
    });
  }

  if (currentRatio < 1) {
    alerts.push({
      id: 'alert-current-ratio',
      severity: 95,
      title: 'Risque de liquidite court terme',
      description: `Le ratio de liquidite generale est a ${currentRatio.toFixed(2)}.`,
      action: 'Securiser la tresorerie immediate et accelerer les encaissements.',
      cardId: 'current-ratio',
    });
  }

  if (financialLeverage > 2) {
    alerts.push({
      id: 'alert-leverage',
      severity: 90,
      title: 'Levier financier eleve',
      description: `Le levier financier est a ${financialLeverage.toFixed(2)}.`,
      action: 'Prioriser reduction de dette et recapitalisation ciblee.',
      cardId: 'financial-leverage',
    });
  }

  if (operatingCashFlow < 0) {
    alerts.push({
      id: 'alert-cashflow',
      severity: 88,
      title: "Flux d'exploitation negatif",
      description: `Le flux de tresorerie est de ${formatMoney(operatingCashFlow, currency)}.`,
      action: 'Stopper les sorties non essentielles et corriger le BFR.',
      cardId: 'operating-cashflow',
    });
  }

  if (bfrVariation > 0) {
    alerts.push({
      id: 'alert-bfr',
      severity: 80,
      title: 'BFR en augmentation',
      description: `Variation BFR: +${formatMoney(bfrVariation, currency)}.`,
      action: 'Piloter DSO, DPO et rotation stock hebdomadairement.',
      cardId: 'bfr-variation',
    });
  }

  if (ebitdaMargin < 10) {
    alerts.push({
      id: 'alert-ebitda-margin',
      severity: 78,
      title: 'Marge EBITDA sous benchmark',
      description: `La marge EBITDA est a ${ebitdaMargin.toFixed(1)}%.`,
      action: 'Revoir process operationnels et couts fixes.',
      cardId: 'ebitda-margin',
    });
  }

  return alerts.sort((a, b) => b.severity - a.severity).slice(0, 3);
};

const Sparkline = ({ series = [], color = '#34d399' }) => {
  const values = Array.isArray(series) ? series : [];
  if (values.length === 0) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = 180;
  const height = 40;
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const range = max - min;

  const points = values.map((value, idx) => {
    const x = idx * step;
    const y = range === 0 ? height / 2 : height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-10" aria-hidden="true">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={points}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

const FinancialDiagnostic = ({
  diagnostic,
  period,
  currency = 'EUR',
  onExportPDF,
  onExportHTML,
  monthlyData = [],
  trialBalance = [],
  comparatives = null,
  onViewStateChange,
}) => {
  const [viewMode, setViewMode] = useState('gallery');
  const [sectionFilter, setSectionFilter] = useState('all');
  const [sortMode, setSortMode] = useState('custom');
  const [benchmarkSector, setBenchmarkSector] = useState('services');
  const [comparisonMode, setComparisonMode] = useState('yoy');
  const [cardOrder, setCardOrder] = useState(DEFAULT_CARD_ORDER);
  const [hiddenCardIds, setHiddenCardIds] = useState([]);
  const [layoutDialogOpen, setLayoutDialogOpen] = useState(false);
  const [activeCardId, setActiveCardId] = useState(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.viewMode) setViewMode(parsed.viewMode);
      if (parsed?.sectionFilter) setSectionFilter(parsed.sectionFilter);
      if (parsed?.sortMode) setSortMode(parsed.sortMode);
      if (parsed?.benchmarkSector) setBenchmarkSector(parsed.benchmarkSector);
      if (parsed?.comparisonMode) setComparisonMode(parsed.comparisonMode);
      if (Array.isArray(parsed?.cardOrder)) setCardOrder(parsed.cardOrder);
      if (Array.isArray(parsed?.hiddenCardIds)) setHiddenCardIds(parsed.hiddenCardIds);
    } catch (error) {
      console.warn('Unable to restore diagnostic layout preferences:', error);
    }
  }, []);

  useEffect(() => {
    const payload = {
      viewMode,
      sectionFilter,
      sortMode,
      benchmarkSector,
      comparisonMode,
      cardOrder,
      hiddenCardIds,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, [benchmarkSector, cardOrder, comparisonMode, hiddenCardIds, sectionFilter, sortMode, viewMode]);

  if (!diagnostic) {
    return (
      <Card className="bg-gray-900/50 border border-gray-800">
        <CardContent className="p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-100 mb-2">Donnees insuffisantes pour le diagnostic</h3>
          <p className="text-sm text-gray-400 mb-4">
            Pour generer un diagnostic financier complet, assurez-vous d'avoir importe le plan comptable et les ecritures.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!diagnostic.valid) {
    return (
      <Card className="bg-gray-900/50 border border-gray-800">
        <CardContent className="p-8">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-gray-100 mb-2">Impossible de generer le diagnostic</h3>
              <p className="text-sm text-gray-400 mb-3">Les erreurs suivantes ont ete detectees:</p>
              <ul className="space-y-1">
                {(diagnostic.errors || []).map((error, idx) => (
                  <li key={idx} className="text-sm text-red-400 flex items-start gap-2">
                    <span>•</span>
                    <span>{error}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatPeriodLabel = () => {
    if (!period?.startDate || !period?.endDate) return '';
    try {
      const start = format(new Date(period.startDate), 'dd MMMM yyyy', { locale: fr });
      const end = format(new Date(period.endDate), 'dd MMMM yyyy', { locale: fr });
      return `${start} - ${end}`;
    } catch {
      return `${period.startDate} - ${period.endDate}`;
    }
  };

  const comparisonDiagnostic = useMemo(() => {
    const key = COMPARISON_OPTIONS[comparisonMode]?.sourceKey;
    return key ? comparatives?.[key] || null : null;
  }, [comparatives, comparisonMode]);

  const comparisonPeriodLabel = useMemo(() => {
    if (!period?.startDate || !period?.endDate) return '';
    const shift = comparisonMode === 'yoy' ? { years: -1 } : comparisonMode === 'qoq' ? { months: -3 } : { months: -1 };
    const start = shiftDateInput(period.startDate, shift);
    const end = shiftDateInput(period.endDate, shift);
    if (!start || !end) return '';
    try {
      return `${format(start, 'dd/MM/yyyy')} - ${format(end, 'dd/MM/yyyy')}`;
    } catch {
      return '';
    }
  }, [comparisonMode, period?.endDate, period?.startDate]);

  const trendSeriesMap = useMemo(() => getTrendSeriesMap(monthlyData), [monthlyData]);
  const topAlerts = useMemo(() => buildCriticalAlerts(diagnostic, currency), [diagnostic, currency]);
  const alertSeverityByCardId = useMemo(
    () => topAlerts.reduce((acc, alert) => ({ ...acc, [alert.cardId]: alert.severity }), {}),
    [topAlerts]
  );

  const orderedIds = useMemo(() => {
    const safeIds = cardOrder.filter((id) => DEFAULT_CARD_ORDER.includes(id));
    const missingIds = DEFAULT_CARD_ORDER.filter((id) => !safeIds.includes(id));
    return [...safeIds, ...missingIds];
  }, [cardOrder]);

  const cards = useMemo(() => {
    const cardMap = CARD_DEFINITIONS.reduce((acc, card) => ({ ...acc, [card.id]: card }), {});
    return orderedIds.map((id) => cardMap[id]).filter(Boolean);
  }, [orderedIds]);

  const displayedCards = useMemo(() => {
    let list = cards.filter((card) => sectionFilter === 'all' || card.section === sectionFilter);
    list = list.filter((card) => !hiddenCardIds.includes(card.id));

    if (sortMode === 'alpha') {
      list = [...list].sort((a, b) => a.title.localeCompare(b.title, 'fr'));
    } else if (sortMode === 'value') {
      list = [...list].sort((a, b) => {
        const va = Math.abs(getMetricValue(diagnostic, a.metricKey));
        const vb = Math.abs(getMetricValue(diagnostic, b.metricKey));
        return vb - va;
      });
    } else if (sortMode === 'priority') {
      list = [...list].sort((a, b) => (alertSeverityByCardId[b.id] || 0) - (alertSeverityByCardId[a.id] || 0));
    }

    return list;
  }, [alertSeverityByCardId, cards, diagnostic, hiddenCardIds, sectionFilter, sortMode]);

  const selectedCard = useMemo(
    () => displayedCards.find((card) => card.id === activeCardId) || cards.find((card) => card.id === activeCardId) || null,
    [activeCardId, cards, displayedCards]
  );

  const selectedAccounts = useMemo(
    () => getAccountsForSourceGroup(trialBalance, selectedCard?.sourceGroup),
    [selectedCard?.sourceGroup, trialBalance]
  );

  const toggleCardVisibility = (cardId, checked) => {
    setHiddenCardIds((previous) => {
      if (checked) {
        return previous.filter((id) => id !== cardId);
      }
      return previous.includes(cardId) ? previous : [...previous, cardId];
    });
  };

  const moveCard = (cardId, direction) => {
    setCardOrder((previousOrder) => {
      const currentOrder = previousOrder.filter((id) => DEFAULT_CARD_ORDER.includes(id));
      const index = currentOrder.indexOf(cardId);
      if (index < 0) return previousOrder;

      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= currentOrder.length) return previousOrder;

      const next = [...currentOrder];
      const tmp = next[index];
      next[index] = next[target];
      next[target] = tmp;
      return next;
    });
  };

  const openCardDrilldown = (cardId) => setActiveCardId(cardId);
  const closeCardDrilldown = () => setActiveCardId(null);

  useEffect(() => {
    if (!onViewStateChange) return;

    const snapshot = {
      generatedAt: new Date().toISOString(),
      mode: viewMode,
      sectionFilter,
      sortMode,
      benchmarkSector,
      comparisonMode,
      comparisonLabel: COMPARISON_OPTIONS[comparisonMode]?.label || comparisonMode,
      period: {
        startDate: period?.startDate || null,
        endDate: period?.endDate || null,
        label: formatPeriodLabel(),
        comparedLabel: comparisonPeriodLabel,
      },
      visibleCardCount: displayedCards.length,
      hiddenCardCount: hiddenCardIds.length,
      visibleCards: displayedCards.map((card) => {
        const currentValue = getMetricValue(diagnostic, card.metricKey);
        const comparisonValue = getMetricValue(comparisonDiagnostic, card.metricKey);
        const benchmarkValue = SECTOR_BENCHMARKS[benchmarkSector]?.[card.metricKey];
        return {
          id: card.id,
          title: card.title,
          section: card.section,
          format: card.format,
          currentValue,
          formattedCurrentValue: formatMetric(currentValue, card.format, currency),
          comparisonValue,
          formattedComparisonValue: Number.isFinite(comparisonValue) ? formatMetric(comparisonValue, card.format, currency) : null,
          benchmarkValue: Number.isFinite(benchmarkValue) ? benchmarkValue : null,
          formattedBenchmarkValue: Number.isFinite(benchmarkValue) ? formatMetric(benchmarkValue, card.format, currency) : null,
          why: card.why,
          how: card.how,
        };
      }),
    };

    onViewStateChange(snapshot);
  }, [
    benchmarkSector,
    comparisonDiagnostic,
    comparisonMode,
    comparisonPeriodLabel,
    currency,
    diagnostic,
    displayedCards,
    hiddenCardIds.length,
    onViewStateChange,
    period?.endDate,
    period?.startDate,
    sectionFilter,
    sortMode,
    viewMode,
  ]);

  const renderCard = (card) => {
    const currentValue = getMetricValue(diagnostic, card.metricKey);
    const comparisonValue = getMetricValue(comparisonDiagnostic, card.metricKey);
    const comparisonInfo = getComparisonInfo(currentValue, comparisonValue, card.betterWhen);
    const benchmarkValue = SECTOR_BENCHMARKS[benchmarkSector]?.[card.metricKey];
    const benchmarkGap = Number.isFinite(benchmarkValue) ? currentValue - benchmarkValue : null;
    const trendSeries = trendSeriesMap[card.trendKey] || [];
    const Icon = card.icon || BarChart3;
    const compact = viewMode === 'gallery';
    const comparative = viewMode === 'comparative';
    const hasCardAlert = alertSeverityByCardId[card.id] > 0;

    return (
      <Card
        key={card.id}
        className={cn(
          'border border-gray-800 bg-[#0a1228]/90 hover:border-blue-500/40 transition-colors',
          hasCardAlert && 'border-orange-500/40'
        )}
      >
        <CardContent
          role="button"
          tabIndex={0}
          onClick={() => openCardDrilldown(card.id)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              openCardDrilldown(card.id);
            }
          }}
          aria-label={`Ouvrir le detail de ${card.title}`}
          className={cn('p-4 sm:p-5 cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-400 rounded-lg')}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2 min-w-0">
              <div className="h-10 w-10 rounded-lg bg-gray-800/80 flex items-center justify-center shrink-0">
                <Icon className={cn('h-5 w-5', card.colorClass || 'text-blue-300')} />
              </div>
              <div className="min-w-0">
                <div className="flex items-start gap-1.5">
                  <span onClick={(event) => event.stopPropagation()} data-ignore-drilldown="true">
                    {card.info ? <RatioInfoPopover {...card.info} /> : null}
                  </span>
                  <p className="text-sm font-medium text-gray-200 leading-5">{card.title}</p>
                </div>
                <p className="text-xl sm:text-2xl font-bold text-gray-100 mt-2">
                  {formatMetric(currentValue, card.format, currency)}
                </p>
              </div>
            </div>

            {comparisonInfo ? (
              <div
                className={cn(
                  'shrink-0 text-xs px-2 py-1 rounded-full border',
                  comparisonInfo.better
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                    : 'border-red-500/40 bg-red-500/10 text-red-300'
                )}
              >
                {COMPARISON_OPTIONS[comparisonMode].label}: {comparisonInfo.percent !== null ? `${comparisonInfo.percent >= 0 ? '+' : ''}${comparisonInfo.percent.toFixed(1)}%` : '-'}
              </div>
            ) : (
              <div className="text-xs text-gray-500">N/A</div>
            )}
          </div>

          {comparative && (
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="rounded border border-gray-800 bg-gray-900/60 p-2">
                <p className="text-[11px] text-gray-400">Periode courante</p>
                <p className="text-sm font-semibold text-gray-100">{formatMetric(currentValue, card.format, currency)}</p>
              </div>
              <div className="rounded border border-gray-800 bg-gray-900/60 p-2">
                <p className="text-[11px] text-gray-400">{COMPARISON_OPTIONS[comparisonMode].label}</p>
                <p className="text-sm font-semibold text-gray-100">{Number.isFinite(comparisonValue) ? formatMetric(comparisonValue, card.format, currency) : '-'}</p>
              </div>
            </div>
          )}

          {Number.isFinite(benchmarkValue) && (
            <div className="mt-3 rounded-md border border-blue-500/30 bg-blue-500/10 p-2">
              <p className="text-[11px] text-blue-200">
                Vous: <strong>{formatMetric(currentValue, card.format, currency)}</strong> | Mediane secteur: <strong>{formatMetric(benchmarkValue, card.format, currency)}</strong>
              </p>
              <p className={cn('text-[11px] mt-0.5', (card.betterWhen === 'lower' ? benchmarkGap <= 0 : benchmarkGap >= 0) ? 'text-emerald-300' : 'text-red-300')}>
                Ecart: {formatDelta(benchmarkGap || 0, card.format, currency)}
              </p>
            </div>
          )}

          <div className="mt-3">
            <Sparkline series={trendSeries} color={card.betterWhen === 'lower' ? '#38bdf8' : '#34d399'} />
            <p className="text-[11px] text-gray-500">Mini-tendance 12 mois</p>
          </div>

          <div className="mt-3 space-y-1">
            <p className="text-xs text-gray-300">
              <span className="text-blue-300 font-medium">Pourquoi ce score ? </span>
              {compact ? truncate(card.why, 100) : card.why}
            </p>
            <p className="text-xs text-gray-300">
              <span className="text-emerald-300 font-medium">Comment l'ameliorer ? </span>
              {compact ? truncate(card.how, 100) : card.how}
            </p>
          </div>

          {comparisonInfo && (
            <div className="mt-3 flex items-center gap-2 text-xs">
              {comparisonInfo.delta >= 0 ? (
                <ArrowUp className={cn('w-3.5 h-3.5', comparisonInfo.better ? 'text-emerald-300' : 'text-red-300')} />
              ) : (
                <ArrowDown className={cn('w-3.5 h-3.5', comparisonInfo.better ? 'text-emerald-300' : 'text-red-300')} />
              )}
              <span className={comparisonInfo.better ? 'text-emerald-300' : 'text-red-300'}>
                Variation {COMPARISON_OPTIONS[comparisonMode].label}: {formatDelta(comparisonInfo.delta, card.format, currency)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };
  return (
    <div className="space-y-6 pb-20 md:pb-4">
      <Card className="bg-gradient-to-br from-[#0f1528] to-[#141c33] border border-gray-800">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-100">Diagnostic Financier</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-gray-300">
                <Calendar className="w-4 h-4" />
                <span>Periode: {formatPeriodLabel()}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Comparatif {COMPARISON_OPTIONS[comparisonMode].label}: {comparisonPeriodLabel || 'N/A'}
              </p>
            </div>
            <div className="hidden md:flex gap-2 flex-wrap">
              {onExportPDF && (
                <Button
                  onClick={onExportPDF}
                  variant="outline"
                  aria-label="Exporter la vue en PDF"
                  className="h-11 px-4 border-gray-700 text-gray-200 hover:bg-blue-500/10"
                >
                  <FileDown className="w-4 h-4 mr-2" />
                  Export premium PDF
                </Button>
              )}
              {onExportHTML && (
                <Button
                  onClick={onExportHTML}
                  variant="outline"
                  aria-label="Exporter la vue en HTML"
                  className="h-11 px-4 border-gray-700 text-gray-200 hover:bg-blue-500/10"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Export premium HTML
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="sticky top-2 z-30 border border-gray-700 bg-[#0b1328]/95 backdrop-blur">
        <CardContent className="p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border border-gray-700 p-1 bg-gray-900/70">
              <button
                type="button"
                onClick={() => setViewMode('gallery')}
                aria-pressed={viewMode === 'gallery'}
                className={cn(
                  'h-10 px-3 text-xs sm:text-sm rounded-md flex items-center gap-1.5 min-w-[92px] justify-center',
                  viewMode === 'gallery' ? 'bg-blue-500/20 text-blue-200' : 'text-gray-300 hover:bg-gray-800'
                )}
              >
                <LayoutGrid className="w-4 h-4" />
                Galerie
              </button>
              <button
                type="button"
                onClick={() => setViewMode('detail')}
                aria-pressed={viewMode === 'detail'}
                className={cn(
                  'h-10 px-3 text-xs sm:text-sm rounded-md flex items-center gap-1.5 min-w-[92px] justify-center',
                  viewMode === 'detail' ? 'bg-blue-500/20 text-blue-200' : 'text-gray-300 hover:bg-gray-800'
                )}
              >
                <List className="w-4 h-4" />
                Detail
              </button>
              <button
                type="button"
                onClick={() => setViewMode('comparative')}
                aria-pressed={viewMode === 'comparative'}
                className={cn(
                  'h-10 px-3 text-xs sm:text-sm rounded-md flex items-center gap-1.5 min-w-[92px] justify-center',
                  viewMode === 'comparative' ? 'bg-blue-500/20 text-blue-200' : 'text-gray-300 hover:bg-gray-800'
                )}
              >
                <ArrowRightLeft className="w-4 h-4" />
                Comparatif N-1
              </button>
            </div>

            <label className="sr-only" htmlFor="diag-filter">Filtrer les cartes</label>
            <select
              id="diag-filter"
              value={sectionFilter}
              onChange={(event) => setSectionFilter(event.target.value)}
              className="h-10 px-3 rounded-md border border-gray-700 bg-gray-900 text-sm text-gray-200 min-w-[170px]"
              aria-label="Filtrer les cartes"
            >
              {SECTION_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <label className="sr-only" htmlFor="diag-sort">Tri des cartes</label>
            <select
              id="diag-sort"
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value)}
              className="h-10 px-3 rounded-md border border-gray-700 bg-gray-900 text-sm text-gray-200 min-w-[165px]"
              aria-label="Trier les cartes"
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>

            <label className="sr-only" htmlFor="diag-compare">Comparateur de periodes</label>
            <select
              id="diag-compare"
              value={comparisonMode}
              onChange={(event) => setComparisonMode(event.target.value)}
              className="h-10 px-3 rounded-md border border-gray-700 bg-gray-900 text-sm text-gray-200 min-w-[130px]"
              aria-label="Comparateur de periodes"
            >
              {Object.entries(COMPARISON_OPTIONS).map(([value, option]) => (
                <option key={value} value={value}>{option.label}</option>
              ))}
            </select>

            <label className="sr-only" htmlFor="diag-sector">Benchmark secteur</label>
            <select
              id="diag-sector"
              value={benchmarkSector}
              onChange={(event) => setBenchmarkSector(event.target.value)}
              className="h-10 px-3 rounded-md border border-gray-700 bg-gray-900 text-sm text-gray-200 min-w-[160px]"
              aria-label="Benchmark secteur"
            >
              <option value="services">Secteur: Services</option>
              <option value="commerce">Secteur: Commerce</option>
              <option value="industrie">Secteur: Industrie</option>
            </select>

            <Button
              variant="outline"
              onClick={() => setLayoutDialogOpen(true)}
              aria-label="Personnaliser les cartes"
              className="h-10 border-gray-700 text-gray-200"
            >
              <Settings2 className="w-4 h-4 mr-2" />
              Personnaliser
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className={cn('border', topAlerts.length > 0 ? 'border-orange-500/40 bg-orange-500/5' : 'border-emerald-500/40 bg-emerald-500/5')}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg text-gray-100 flex items-center gap-2">
            <AlertTriangle className={cn('w-5 h-5', topAlerts.length > 0 ? 'text-orange-300' : 'text-emerald-300')} />
            Top 3 actions critiques
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topAlerts.length === 0 ? (
            <div className="text-sm text-emerald-200">
              Aucun signal critique detecte sur cette periode. Continuez le suivi avec la vue comparative.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {topAlerts.map((alert) => (
                <div key={alert.id} className="rounded-lg border border-orange-500/40 bg-[#1f1422] p-3">
                  <p className="text-sm font-semibold text-orange-200">{alert.title}</p>
                  <p className="text-xs text-gray-300 mt-1">{alert.description}</p>
                  <p className="text-xs text-gray-400 mt-2">{alert.action}</p>
                  <Button
                    type="button"
                    size="sm"
                    className="mt-3 h-9 w-full bg-orange-500 hover:bg-orange-400 text-black font-semibold"
                    onClick={() => openCardDrilldown(alert.cardId)}
                  >
                    CTA direct: ouvrir et corriger
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className={cn(
        'grid gap-4',
        viewMode === 'detail'
          ? 'grid-cols-1'
          : 'grid-cols-1 sm:grid-cols-2 xl:grid-cols-4'
      )}>
        {displayedCards.map((card) => renderCard(card))}
      </div>

      {viewMode === 'detail' && (
        <div className="space-y-6">
          <MarginAnalysisSection data={diagnostic.margins} currency={currency} />
          <FinancingAnalysisSection data={diagnostic.financing} currency={currency} />
          <KeyRatiosSection data={diagnostic.ratios} />
        </div>
      )}

      <Card className="bg-gray-900/40 border-gray-800">
        <CardContent className="p-4">
          <p className="text-xs text-gray-300">
            <strong>Note:</strong> Vue diagnostique pilotable par mode, filtres et comparatifs. Les exports premium reprennent la vue courante (tri, filtres, periode, benchmark secteur).
          </p>
        </CardContent>
      </Card>

      <Dialog open={layoutDialogOpen} onOpenChange={setLayoutDialogOpen}>
        <DialogContent className="max-w-2xl bg-gray-950 border border-gray-700 text-gray-100">
          <DialogHeader>
            <DialogTitle>Personnaliser la galerie</DialogTitle>
            <DialogDescription className="text-gray-400">
              Masquer/reordonner les cartes. La configuration est sauvegardee pour votre prochain acces.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {orderedIds.map((cardId, index) => {
              const card = CARD_DEFINITIONS.find((item) => item.id === cardId);
              if (!card) return null;
              const isVisible = !hiddenCardIds.includes(card.id);

              return (
                <div key={card.id} className="rounded-lg border border-gray-800 bg-gray-900/50 p-3 flex items-center gap-3">
                  <Checkbox
                    checked={isVisible}
                    onCheckedChange={(checked) => toggleCardVisibility(card.id, Boolean(checked))}
                    aria-label={`Afficher la carte ${card.title}`}
                    className="h-5 w-5 border-gray-500 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-100">{card.title}</p>
                    <p className="text-xs text-gray-500">{card.section}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Monter ${card.title}`}
                      disabled={index === 0}
                      onClick={() => moveCard(card.id, 'up')}
                      className="h-8 w-8 border-gray-700 text-gray-200"
                    >
                      <MoveUp className="w-4 h-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      aria-label={`Descendre ${card.title}`}
                      disabled={index === orderedIds.length - 1}
                      onClick={() => moveCard(card.id, 'down')}
                      className="h-8 w-8 border-gray-700 text-gray-200"
                    >
                      <MoveDown className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setCardOrder(DEFAULT_CARD_ORDER);
                setHiddenCardIds([]);
              }}
              className="border-gray-700 text-gray-200"
            >
              Reinitialiser
            </Button>
            <Button type="button" onClick={() => setLayoutDialogOpen(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedCard)} onOpenChange={(open) => (!open ? closeCardDrilldown() : null)}>
        <DialogContent className="w-[95vw] max-w-3xl sm:max-w-[48rem] bg-[#070d1d] border border-gray-700 text-gray-100 sm:left-auto sm:right-0 sm:top-0 sm:translate-x-0 sm:translate-y-0 sm:h-full sm:rounded-none">
          {selectedCard && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <PanelRightOpen className="w-5 h-5 text-blue-300" />
                  Drill-down: {selectedCard.title}
                </DialogTitle>
                <DialogDescription className="text-gray-400">
                  Details des comptes/sources relies a cet indicateur.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 overflow-y-auto max-h-[70vh] pr-1">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Card className="bg-gray-900/70 border-gray-800">
                    <CardContent className="p-3">
                      <p className="text-xs text-gray-400">Valeur courante</p>
                      <p className="text-lg font-bold text-gray-100 mt-1">
                        {formatMetric(getMetricValue(diagnostic, selectedCard.metricKey), selectedCard.format, currency)}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gray-900/70 border-gray-800">
                    <CardContent className="p-3">
                      <p className="text-xs text-gray-400">{COMPARISON_OPTIONS[comparisonMode].label}</p>
                      <p className="text-lg font-bold text-gray-100 mt-1">
                        {Number.isFinite(getMetricValue(comparisonDiagnostic, selectedCard.metricKey))
                          ? formatMetric(getMetricValue(comparisonDiagnostic, selectedCard.metricKey), selectedCard.format, currency)
                          : '-'}
                      </p>
                    </CardContent>
                  </Card>
                  <Card className="bg-gray-900/70 border-gray-800">
                    <CardContent className="p-3">
                      <p className="text-xs text-gray-400">Mediane secteur</p>
                      <p className="text-lg font-bold text-gray-100 mt-1">
                        {Number.isFinite(SECTOR_BENCHMARKS[benchmarkSector]?.[selectedCard.metricKey])
                          ? formatMetric(SECTOR_BENCHMARKS[benchmarkSector]?.[selectedCard.metricKey], selectedCard.format, currency)
                          : '-'}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card className="bg-gray-900/70 border-gray-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-blue-200">Pourquoi ce score ?</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 text-sm text-gray-200">{selectedCard.why}</CardContent>
                </Card>

                <Card className="bg-gray-900/70 border-gray-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-emerald-200">Comment l'ameliorer ?</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 text-sm text-gray-200">{selectedCard.how}</CardContent>
                </Card>

                <Card className="bg-gray-900/70 border-gray-800">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm text-gray-100">Comptes sources (top 12)</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {selectedAccounts.length === 0 ? (
                      <p className="text-sm text-gray-400">Aucune source comptable disponible pour ce KPI.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-gray-400 border-b border-gray-800">
                              <th className="text-left py-2 pr-3">Code</th>
                              <th className="text-left py-2 pr-3">Compte</th>
                              <th className="text-right py-2">Solde</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedAccounts.map((account) => (
                              <tr key={account.account_code} className="border-b border-gray-900">
                                <td className="py-2 pr-3 font-mono text-gray-300">{account.account_code}</td>
                                <td className="py-2 pr-3 text-gray-200">{account.account_name}</td>
                                <td className="py-2 text-right font-semibold text-gray-100">
                                  {formatMoney(account.balance, currency)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <div className="md:hidden fixed bottom-4 right-4 z-40 flex flex-col gap-2">
        <Button
          type="button"
          size="icon"
          className="h-12 w-12 rounded-full bg-blue-600 hover:bg-blue-500"
          aria-label="Personnaliser les cartes"
          onClick={() => setLayoutDialogOpen(true)}
        >
          <Settings2 className="w-5 h-5" />
        </Button>
        {topAlerts[0] && (
          <Button
            type="button"
            size="icon"
            className="h-12 w-12 rounded-full bg-orange-500 hover:bg-orange-400 text-black"
            aria-label="Ouvrir action critique"
            onClick={() => openCardDrilldown(topAlerts[0].cardId)}
          >
            <AlertTriangle className="w-5 h-5" />
          </Button>
        )}
        {onExportPDF && (
          <Button
            type="button"
            size="icon"
            className="h-12 w-12 rounded-full bg-gray-800 hover:bg-gray-700"
            aria-label="Exporter PDF"
            onClick={onExportPDF}
          >
            <FileDown className="w-5 h-5" />
          </Button>
        )}
      </div>
    </div>
  );
};

export default FinancialDiagnostic;
