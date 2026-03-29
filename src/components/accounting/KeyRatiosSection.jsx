
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart3, TrendingUp, Droplets, Scale, AlertTriangle, CheckCircle2 } from 'lucide-react';
import RatioGauge from './RatioGauge';
import RatioInfoPopover from './RatioInfoPopover';

const asNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const KeyRatiosSection = ({ data }) => {
  if (!data) {
    return (
      <Card className="bg-gray-900/50 border border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-100">
            <BarChart3 className="w-5 h-5" />
            Ratios Cles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400">Aucune donnee disponible</p>
        </CardContent>
      </Card>
    );
  }

  const profitability = data.profitability || {};
  const liquidity = data.liquidity || {};
  const leverage = data.leverage || {};
  const leverageValue = asNumber(leverage.financialLeverage, 0);
  const autonomyPercent = leverageValue !== 0 ? (1 / (1 + leverageValue)) * 100 : 100;

  const structureAnalysisText =
    leverageValue < 0.5
      ? "Tres faible. L'entreprise est peu endettee et dispose d'une grande solidite financiere."
      : leverageValue < 1.0
        ? 'Faible. Structure financiere saine avec une bonne autonomie.'
        : leverageValue < 2.0
          ? 'Modere. Endettement acceptable, mais a surveiller.'
          : "Eleve. L'entreprise est fortement endettee par rapport a ses capitaux propres.";

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <BarChart3 className="w-6 h-6 text-indigo-400" />
        <h2 className="text-2xl font-bold text-gray-100">Ratios Cles</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="h-full bg-gray-900/50 border border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-gray-100">
              <TrendingUp className="w-4 h-4 text-green-400" />
              Rentabilite
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-300">
            Les ratios de rentabilite mesurent la capacite de l'entreprise a generer des profits
            a partir de ses ressources.
          </CardContent>
        </Card>

        <RatioGauge
          label="Rentabilite des Capitaux Propres (ROE)"
          value={asNumber(profitability.roe, 0)}
          format="percentage"
          thresholds={{ excellent: 20, good: 15, warning: 10, poor: 5 }}
          description="Resultat net / Capitaux propres"
          info={{
            title: 'ROE (Rentabilite des capitaux propres)',
            formula: 'ROE = resultat net / capitaux propres',
            definition: 'Le ROE mesure le rendement genere pour les actionnaires.',
            utility: "Il permet d'evaluer l'efficacite de l'utilisation des fonds propres.",
            interpretation: 'Plus le ROE est eleve, plus les capitaux investis sont rentables. Un ROE faible durable peut signaler une rentabilite insuffisante.',
          }}
        />
        <RatioGauge
          label="Rentabilite du Capital Employe (ROCE)"
          value={asNumber(profitability.roce, 0)}
          format="percentage"
          thresholds={{ excellent: 15, good: 10, warning: 7, poor: 3 }}
          description="Resultat d'exploitation / Capital employe"
          info={{
            title: 'ROCE (Rentabilite du capital employe)',
            formula: "ROCE = resultat d'exploitation / capital employe",
            definition: 'Le ROCE mesure la performance des ressources durables mobilisees.',
            utility: 'Il aide a juger si les investissements creent suffisamment de valeur.',
            interpretation: 'ROCE eleve: bonne efficacite du capital. ROCE faible: capital sous-performant ou charges trop elevees.',
          }}
        />
        <RatioGauge
          label="Marge Operationnelle"
          value={asNumber(profitability.operatingMargin, 0)}
          format="percentage"
          thresholds={{ excellent: 20, good: 15, warning: 10, poor: 5 }}
          description="Resultat d'exploitation / CA"
          info={{
            title: 'Marge operationnelle',
            formula: "Marge operationnelle = resultat d'exploitation / CA",
            definition: "Elle indique la part du chiffre d'affaires qui reste apres les charges d'exploitation.",
            utility: 'Elle sert a mesurer la solidite economique du modele operationnel.',
            interpretation: 'Une marge qui progresse traduit une meilleure maitrise des charges. Une marge en baisse appelle une analyse couts/prix.',
          }}
        />
        <RatioGauge
          label="Marge Nette"
          value={asNumber(profitability.netMargin, 0)}
          format="percentage"
          thresholds={{ excellent: 15, good: 10, warning: 5, poor: 2 }}
          description="Resultat net / CA"
          info={{
            title: 'Marge nette',
            formula: 'Marge nette = resultat net / CA',
            definition: 'La marge nette represente le benefice final conserve pour 1 euro de vente.',
            utility: 'Elle donne une vision globale de la rentabilite apres toutes les charges.',
            interpretation: 'Marge nette elevee: activite rentable et bien pilotee. Faible ou negative: rentabilite finale fragile.',
          }}
        />

        <Card className="h-full bg-gray-900/50 border border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-gray-100">
              <Droplets className="w-4 h-4 text-blue-400" />
              Liquidite
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-300">
            Les ratios de liquidite evaluent la capacite de l'entreprise a faire face a ses obligations a court terme.
          </CardContent>
        </Card>

        <RatioGauge
          label="Ratio de Liquidite Generale"
          value={asNumber(liquidity.currentRatio, 0)}
          format="number"
          thresholds={{ excellent: 2.0, good: 1.5, warning: 1.0, poor: 0.75 }}
          description="Actifs circulants / Passifs courants"
          info={{
            title: 'Liquidite generale',
            formula: 'Ratio = actifs circulants / passifs courants',
            definition: 'Ce ratio mesure la capacite a payer les dettes a court terme avec les actifs a court terme.',
            utility: 'Il alerte sur le risque de tension de tresorerie immediate.',
            interpretation: 'Au-dessus de 1, la situation est generalement rassurante. En dessous de 1, le risque de paiement augmente.',
          }}
        />
        <RatioGauge
          label="Ratio de Liquidite Reduite"
          value={asNumber(liquidity.quickRatio, 0)}
          format="number"
          thresholds={{ excellent: 1.5, good: 1.0, warning: 0.75, poor: 0.5 }}
          description="(Actifs circulants - Stocks) / Passifs courants"
          info={{
            title: 'Liquidite reduite',
            formula: 'Ratio = (actifs circulants - stocks) / passifs courants',
            definition: 'Il evalue la capacite de paiement court terme sans compter la vente des stocks.',
            utility: 'Utile pour les activites ou les stocks sont peu liquides.',
            interpretation: 'Proche ou au-dessus de 1: bonne solvabilite court terme. Trop faible: dependance forte aux ventes de stocks.',
          }}
        />
        <RatioGauge
          label="Ratio de Liquidite Immediate"
          value={asNumber(liquidity.cashRatio, 0)}
          format="number"
          thresholds={{ excellent: 0.5, good: 0.3, warning: 0.2, poor: 0.1 }}
          description="Tresorerie / Passifs courants"
          info={{
            title: 'Liquidite immediate',
            formula: 'Ratio = tresorerie disponible / passifs courants',
            definition: 'Ce ratio mesure la capacite a payer immediatement les dettes court terme avec la tresorerie disponible.',
            utility: "Il permet d'anticiper les urgences de tresorerie.",
            interpretation: 'Un ratio trop bas signale une reserve de cash limitee face aux echeances proches.',
          }}
        />

        <Card className="h-full bg-gray-900/50 border border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-100">Lecture liquidite</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-xs text-gray-300">
            <div className="flex justify-between gap-3">
              <span>Liquidite Generale</span>
              <span className="font-semibold">{asNumber(liquidity.currentRatio, 0).toFixed(2)}</span>
            </div>
            <p className="text-gray-400">
              {asNumber(liquidity.currentRatio, 0) >= 1.5
                ? 'Capacite a honorer les dettes CT'
                : asNumber(liquidity.currentRatio, 0) >= 1.0
                  ? 'Situation acceptable'
                  : 'Risque de difficultes de paiement'}
            </p>
            <div className="flex justify-between gap-3">
              <span>Liquidite Reduite</span>
              <span className="font-semibold">{asNumber(liquidity.quickRatio, 0).toFixed(2)}</span>
            </div>
            <p className="text-gray-400">
              {asNumber(liquidity.quickRatio, 0) >= 1.0
                ? 'Bonne capacite de paiement rapide'
                : asNumber(liquidity.quickRatio, 0) >= 0.75
                  ? 'Capacite de paiement correcte'
                  : 'Dependance aux stocks pour payer'}
            </p>
            <div className="flex justify-between gap-3">
              <span>Liquidite Immediate</span>
              <span className="font-semibold">{asNumber(liquidity.cashRatio, 0).toFixed(2)}</span>
            </div>
            <p className="text-gray-400">
              {asNumber(liquidity.cashRatio, 0) >= 0.3
                ? 'Excellente tresorerie disponible'
                : asNumber(liquidity.cashRatio, 0) >= 0.2
                  ? 'Tresorerie suffisante'
                  : 'Tresorerie limitee'}
            </p>
          </CardContent>
        </Card>

        <Card className="h-full bg-gray-900/50 border border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-gray-100">
              <Scale className="w-4 h-4 text-orange-400" />
              Structure Financiere
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-gray-300">
            Le levier financier mesure le poids des dettes par rapport aux capitaux propres.
          </CardContent>
        </Card>

        <RatioGauge
          label="Levier Financier (Dette / Capitaux Propres)"
          value={leverageValue}
          format="number"
          inverse={true}
          thresholds={{ excellent: 0.5, good: 1.0, warning: 2.0, poor: 3.0 }}
          description="Dettes financieres / Capitaux propres"
          info={{
            title: 'Levier financier',
            formula: 'Levier = dettes financieres / capitaux propres',
            definition: 'Le levier mesure le niveau de financement par la dette par rapport aux fonds propres.',
            utility: "Il sert a evaluer le risque financier et la sensibilite de l'entreprise.",
            interpretation: 'Plus le levier est eleve, plus le risque de tension de remboursement est important.',
          }}
        />

        <Card className="h-full bg-gray-900/50 border border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-100">Ratio d'Autonomie Financiere</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-1">
              <RatioInfoPopover
                title="Ratio d'autonomie financiere"
                formula="Autonomie = capitaux propres / (capitaux propres + dettes)"
                definition="Ce ratio mesure la part des ressources financee par les fonds propres."
                utility="Il permet d'apprecier l'independance financiere de l'entreprise."
                interpretation="Plus il est eleve, plus l'entreprise est autonome et moins elle depend des creanciers."
              />
              <p className="text-sm text-gray-300">Capitaux propres / (Capitaux propres + Dettes)</p>
            </div>
            <p className="text-2xl font-bold text-gray-100">{autonomyPercent.toFixed(1)}%</p>
            <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
              <div className="h-2 bg-green-500" style={{ width: `${Math.min(Math.max(autonomyPercent, 0), 100)}%` }} />
            </div>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                leverageValue < 1.0
                  ? 'bg-green-500/20 text-green-400'
                  : leverageValue < 2.0
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : 'bg-red-500/20 text-red-400'
              }`}
            >
              {leverageValue < 1.0 ? 'Independance financiere' : leverageValue < 2.0 ? 'Endettement modere' : 'Endettement eleve'}
            </span>
          </CardContent>
        </Card>

        <Card className="h-full bg-gray-900/50 border border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-100">Analyse detaillee</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-300">
            <p>
              <strong>Levier financier:</strong> {structureAnalysisText}
            </p>

            {leverageValue > 2.0 && (
              <div className="p-2 border border-orange-500/30 bg-orange-500/10 rounded text-orange-300">
                <strong>Recommandation:</strong> Renforcez vos fonds propres ou reduisez votre endettement.
              </div>
            )}
            {leverageValue < 0.5 && (
              <div className="p-2 border border-green-500/30 bg-green-500/10 rounded text-green-300">
                <strong>Point positif:</strong> Votre faible endettement preserve votre capacite d'emprunt.
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="h-full bg-blue-500/10 border border-blue-500/30">
          <CardContent className="p-4 text-sm text-blue-200">
            <div className="flex items-start gap-2">
              {leverageValue <= 1 ? (
                <CheckCircle2 className="w-4 h-4 mt-0.5" />
              ) : (
                <AlertTriangle className="w-4 h-4 mt-0.5" />
              )}
              <p>
                <strong>Interpretation globale:</strong> un ratio inferieur a 1 indique
                generalement une bonne independance financiere.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default KeyRatiosSection;
