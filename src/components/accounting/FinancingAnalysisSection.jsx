import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, TrendingUp, DollarSign, ArrowRightLeft, CreditCard, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/utils/calculations';
import RatioInfoPopover from './RatioInfoPopover';

/**
 * Section Analyse du Financement
 * Affichage galerie 4 colonnes desktop sans perte d'information.
 */
const FinancingAnalysisSection = ({ data, currency = 'EUR' }) => {
  if (!data) {
    return (
      <Card className="bg-gray-900/50 border border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-100">
            <Wallet className="w-5 h-5" />
            Analyse du Financement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400">Aucune donnee disponible</p>
        </CardContent>
      </Card>
    );
  }

  const {
    caf,
    workingCapital,
    bfr,
    bfrVariation,
    operatingCashFlow,
    netDebt,
    equity,
    totalDebt
  } = data;

  const FinanceMetricCard = ({ icon: Icon, label, value, subLabel, colorClass, badge, info }) => (
    <Card className="h-full min-w-0 bg-gray-900/50 border border-gray-800">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="p-2 bg-gray-800 rounded-lg">
            <Icon className={`w-5 h-5 ${colorClass || 'text-purple-400'}`} />
          </div>
          {badge && (
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${badge.className}`}>
              {badge.text}
            </span>
          )}
        </div>
        <p className="text-sm text-gray-400 mb-1">
          <span className="flex items-start gap-1 min-w-0">
            {info && <RatioInfoPopover {...info} />}
            <span className="min-w-0 break-words leading-5">{label}</span>
          </span>
        </p>
        <p className={`text-2xl font-bold ${value >= 0 ? 'text-gray-100' : 'text-red-400'}`}>
          {formatCurrency(value, currency)}
        </p>
        {subLabel && <p className="text-xs text-gray-500 mt-1">{subLabel}</p>}
      </CardContent>
    </Card>
  );

  const getBFRVariationBadge = () => {
    if (bfrVariation === 0) return { text: 'Stable', className: 'bg-gray-700 text-gray-300' };
    if (bfrVariation < 0) return { text: 'Amelioration', className: 'bg-green-500/20 text-green-400' };
    return { text: 'Augmentation', className: 'bg-orange-500/20 text-orange-400' };
  };

  const debtRatio = equity !== 0 ? totalDebt / equity : 0;
  const debtShare = equity + totalDebt !== 0 ? (totalDebt / (equity + totalDebt)) * 100 : 0;

  const recommendations = [];
  if (caf < 0) {
    recommendations.push({
      key: 'caf-negative',
      level: 'critical',
      text: "La CAF est negative. L'entreprise ne genere pas suffisamment de ressources par son activite.",
    });
  }
  if (bfrVariation > 0 && bfrVariation > caf * 0.5) {
    recommendations.push({
      key: 'bfr-consume',
      level: 'warning',
      text: "L'augmentation du BFR consomme une part importante de la CAF. Optimisez vos delais clients/fournisseurs.",
    });
  }
  if (operatingCashFlow < 0) {
    recommendations.push({
      key: 'cashflow-negative',
      level: 'critical',
      text: "Le flux de tresorerie d'exploitation est negatif. L'activite consomme de la tresorerie.",
    });
  }
  if (debtRatio > 2) {
    recommendations.push({
      key: 'debt-high',
      level: 'warning',
      text: "Le ratio d'endettement est eleve (> 2). Surveillez votre capacite de remboursement.",
    });
  }
  if (caf > 0 && operatingCashFlow > 0 && bfrVariation <= 0) {
    recommendations.push({
      key: 'healthy',
      level: 'success',
      text: 'Votre activite genere de la tresorerie et votre BFR est maitrise. Situation financiere saine.',
    });
  }
  if (recommendations.length === 0) {
    recommendations.push({
      key: 'neutral',
      level: 'success',
      text: 'Aucun signal critique detecte sur la periode.',
    });
  }

  const recommendationClass = (level) => {
    if (level === 'critical') return 'border-red-500/30 bg-red-500/10 text-red-300';
    if (level === 'warning') return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300';
    return 'border-green-500/30 bg-green-500/10 text-green-300';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Wallet className="w-6 h-6 text-purple-400" />
        <h2 className="text-2xl font-bold text-gray-100">Analyse du Financement</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <FinanceMetricCard
          icon={DollarSign}
          label="Capacite d'Autofinancement (CAF)"
          value={caf}
          subLabel="Ressources generees par l'activite"
          colorClass={caf >= 0 ? 'text-green-400' : 'text-red-400'}
          info={{
            title: "Capacite d'Autofinancement (CAF)",
            formula: 'CAF = resultat net + charges calculees - produits calcules',
            definition: "La CAF mesure la capacite de l'entreprise a generer du cash via son activite.",
            utility: 'Elle aide a estimer la capacite a rembourser la dette, investir, ou distribuer des dividendes.',
            interpretation: 'CAF positive: creation de ressources internes. CAF negative: dependance au financement externe.',
          }}
        />
        <FinanceMetricCard
          icon={ArrowRightLeft}
          label="Besoin en Fonds de Roulement (BFR)"
          value={bfr}
          subLabel="Besoin de financement du cycle d'exploitation"
          colorClass={bfr >= 0 ? 'text-orange-400' : 'text-green-400'}
          badge={getBFRVariationBadge()}
          info={{
            title: 'Besoin en Fonds de Roulement (BFR)',
            formula: 'BFR = stocks + creances clients - dettes fournisseurs',
            definition: "Le BFR represente le cash immobilise dans l'exploitation courante.",
            utility: 'Il permet de piloter les delais de paiement clients/fournisseurs et la gestion des stocks.',
            interpretation: "BFR eleve: l'activite consomme du cash. BFR faible ou negatif: cycle d'exploitation plus favorable.",
          }}
        />
        <FinanceMetricCard
          icon={TrendingUp}
          label="Flux de Tresorerie d'Exploitation"
          value={operatingCashFlow}
          subLabel="CAF - Variation BFR"
          colorClass={operatingCashFlow >= 0 ? 'text-green-400' : 'text-red-400'}
          info={{
            title: "Flux de Tresorerie d'Exploitation",
            formula: "Flux d'exploitation = CAF - variation du BFR",
            definition: "Ce flux indique la tresorerie generee ou consommee par le coeur d'activite.",
            utility: "Il aide a verifier si l'activite finance ses besoins sans recourir systematiquement a la dette.",
            interpretation: "Flux positif: activite saine en cash. Flux negatif: tension de tresorerie a surveiller rapidement.",
          }}
        />

        <Card className="h-full bg-gray-900/50 border border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-gray-100">
              <CreditCard className="w-4 h-4" />
              Endettement Net
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-bold text-gray-100">{formatCurrency(netDebt, currency)}</p>
            <p className="text-xs text-gray-500">Dettes financieres - Tresorerie</p>
            <div className="pt-2 border-t border-gray-800 space-y-1">
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">Dettes totales</span>
                <span className="text-xs font-semibold text-red-400">{formatCurrency(totalDebt, currency)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-gray-400">Capitaux propres</span>
                <span className="text-xs font-semibold text-green-400">{formatCurrency(equity, currency)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full bg-gray-900/50 border border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-100">Structure financiere</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1">
                <RatioInfoPopover
                  title="Ratio d'endettement"
                  formula="Ratio = dettes totales / capitaux propres"
                  definition="Ce ratio mesure le poids de la dette par rapport aux fonds propres."
                  utility="Il sert a evaluer le risque financier et la marge de manoeuvre pour emprunter."
                  interpretation="Au-dela de 1, la dette depasse les fonds propres. Plus il monte, plus la structure est sensible aux chocs."
                />
                <span className="text-sm text-gray-300">Ratio d'endettement</span>
              </div>
              <span className={`text-sm font-bold ${debtRatio > 1 ? 'text-orange-400' : 'text-green-400'}`}>
                {equity !== 0 ? debtRatio.toFixed(2) : '-'}
              </span>
            </div>
            <div className="flex justify-between text-xs text-gray-500">
              <span>Part de dette</span>
              <span>{debtShare.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
              <div className="h-2 bg-red-500" style={{ width: `${Math.min(Math.max(debtShare, 0), 100)}%` }} />
            </div>
          </CardContent>
        </Card>

        <Card className="h-full bg-gray-900/50 border border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-100">Analyse de la Tresorerie</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">Fonds de Roulement</span>
              <span className={`text-sm font-semibold ${workingCapital >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(workingCapital, currency)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">BFR</span>
              <span className={`text-sm font-semibold ${bfr >= 0 ? 'text-orange-400' : 'text-green-400'}`}>
                {formatCurrency(bfr, currency)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-400">Variation du BFR</span>
              <span className={`text-sm font-semibold ${bfrVariation <= 0 ? 'text-green-400' : 'text-orange-400'}`}>
                {bfrVariation >= 0 ? '+' : ''}{formatCurrency(bfrVariation, currency)}
              </span>
            </div>
            <div className="pt-2 border-t border-gray-800">
              <p className="text-xs text-gray-500">Tresorerie Nette Theorique (FDR - BFR)</p>
              <p className={`text-lg font-bold ${(workingCapital - bfr) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(workingCapital - bfr, currency)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full bg-gray-900/50 border border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-100">Lecture financement</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-300">
            <p>CAF positive: l'activite finance une partie de sa croissance.</p>
            <p>BFR en hausse: le cycle d'exploitation absorbe du cash.</p>
            <p>Flux d'exploitation positif: meilleure resilience de tresorerie.</p>
          </CardContent>
        </Card>

        {recommendations.map((rec) => (
          <Card key={rec.key} className={`h-full border ${recommendationClass(rec.level)}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                {rec.level === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 mt-0.5" />
                )}
                <p className="text-sm">{rec.text}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default FinancingAnalysisSection;
