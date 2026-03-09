import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import RatioInfoPopover from '@/components/accounting/RatioInfoPopover';

const getStatusColor = (evaluation) => {
  if (!evaluation) return 'bg-gray-500';
  const val = typeof evaluation === 'string' ? evaluation : evaluation.status;
  switch (val) {
    case 'excellent':
    case 'good':
      return 'bg-green-400';
    case 'average':
      return 'bg-yellow-400';
    case 'poor':
    case 'critical':
      return 'bg-red-400';
    default:
      return 'bg-gray-500';
  }
};

const ActivityRatioCard = ({ label, value, suffix, benchmark, evaluation, info }) => {
  const displayValue =
    value === null || value === undefined
      ? '-'
      : `${typeof value === 'number' ? value.toFixed(1) : value}${suffix}`;

  const statusDotClass = getStatusColor(evaluation);

  return (
    <Card className="bg-gray-900/50 border border-gray-800/50 rounded-xl">
      <CardContent className="p-4 flex flex-col gap-2">
        {/* Label */}
        <p className="text-xs font-medium text-gray-400 leading-tight flex items-start gap-1">
          {info && <RatioInfoPopover {...info} />}
          <span>{label}</span>
        </p>

        {/* Value + status dot */}
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-gray-100">{displayValue}</span>
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDotClass}`} />
        </div>

        {/* Benchmark target */}
        {benchmark?.target !== null && benchmark?.target !== undefined && (
          <p className="text-xs text-gray-500">
            Cible&nbsp;: {benchmark.target}{suffix}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

const ActivityRatiosSection = ({ data, sector }) => {
  const { t } = useTranslation();

  const activity = data?.pilotageRatios?.activity;
  const benchmarks = data?.benchmarks ?? {};
  const evaluations = data?.ratioEvaluations ?? {};

  const daysSuffix = ` ${t('pilotage.ratios.days')}`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
      {/* 1. DSO */}
      <ActivityRatioCard
        label={t('pilotage.ratios.dso')}
        value={activity?.dso}
        suffix={daysSuffix}
        benchmark={benchmarks.dso}
        evaluation={evaluations.dso}
        info={{
          title: 'DSO (Delai moyen de recouvrement clients)',
          formula: 'DSO = (creances clients / CA TTC) x 365',
          definition: "Le DSO mesure le nombre moyen de jours pour encaisser les paiements clients.",
          utility: "Il permet de piloter l'efficacite du recouvrement et d'anticiper les tensions de tresorerie.",
          interpretation: "Un DSO faible indique des encaissements rapides. Un DSO eleve signale des retards de paiement ou des conditions trop souples.",
        }}
      />

      {/* 2. DPO */}
      <ActivityRatioCard
        label={t('pilotage.ratios.dpo')}
        value={activity?.dpo}
        suffix={daysSuffix}
        benchmark={benchmarks.dpo}
        evaluation={evaluations.dpo}
        info={{
          title: 'DPO (Delai moyen de paiement fournisseurs)',
          formula: 'DPO = (dettes fournisseurs / achats TTC) x 365',
          definition: "Le DPO mesure le nombre moyen de jours pour payer les fournisseurs.",
          utility: "Il aide a evaluer la politique de paiement et son impact sur la tresorerie.",
          interpretation: "Un DPO eleve preserve la tresorerie mais peut deteriorer les relations fournisseurs. Un DPO trop court peut peser sur le cash.",
        }}
      />

      {/* 3. Stock Rotation */}
      <ActivityRatioCard
        label={t('pilotage.ratios.stockRotation')}
        value={activity?.stockRotationDays ?? null}
        suffix={daysSuffix}
        benchmark={benchmarks.stockRotationDays}
        evaluation={evaluations.stockRotationDays}
        info={{
          title: 'Rotation des stocks',
          formula: 'Rotation = (stocks moyens / cout des ventes) x 365',
          definition: "Ce ratio mesure le nombre de jours pendant lesquels les stocks restent en entrepot avant d'etre vendus.",
          utility: "Il permet d'optimiser la gestion des stocks et de limiter le capital immobilise.",
          interpretation: "Une rotation rapide (peu de jours) est positive. Une rotation lente peut signaler des surstocks ou des invendus.",
        }}
      />

      {/* 4. Cash Conversion Cycle */}
      <ActivityRatioCard
        label={t('pilotage.ratios.cashConversionCycle')}
        value={activity?.ccc}
        suffix={daysSuffix}
        benchmark={benchmarks.ccc}
        evaluation={evaluations.ccc}
        info={{
          title: 'Cycle de Conversion de Tresorerie (CCC)',
          formula: 'CCC = DSO + rotation stocks - DPO',
          definition: "Le CCC mesure le temps entre le paiement des fournisseurs et l'encaissement des clients.",
          utility: "Il synthetise l'efficacite globale du cycle d'exploitation en termes de cash.",
          interpretation: "Un CCC court ou negatif est excellent: l'entreprise encaisse avant de payer. Un CCC long signale un besoin de financement du cycle.",
        }}
      />

      {/* 5. BFR / Revenue */}
      <ActivityRatioCard
        label={t('pilotage.ratios.bfrToRevenue')}
        value={activity?.bfrToRevenue}
        suffix="%"
        benchmark={benchmarks.bfrToRevenue}
        evaluation={evaluations.bfrToRevenue}
        info={{
          title: "BFR / Chiffre d'affaires",
          formula: "BFR / CA = (BFR / chiffre d'affaires) x 100",
          definition: "Ce ratio exprime le BFR en proportion du chiffre d'affaires.",
          utility: "Il permet de comparer le poids du BFR entre periodes et entre entreprises, independamment de la taille.",
          interpretation: "Un ratio faible est favorable. Un ratio en hausse indique que le BFR croit plus vite que l'activite.",
        }}
      />
    </div>
  );
};

export default ActivityRatiosSection;
