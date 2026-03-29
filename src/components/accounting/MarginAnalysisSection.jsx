
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, DollarSign, Activity, Target, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '@/utils/calculations';
import RatioInfoPopover from './RatioInfoPopover';

/**
 * Section Analyse des Marges
 * Affichage galerie: 4 colonnes desktop, 2 tablette, 1 mobile.
 * Toutes les informations precedentes sont conservees, recomposees en cartes.
 */
const MarginAnalysisSection = ({ data, currency = 'EUR' }) => {
  if (!data) {
    return (
      <Card className="bg-gray-900/50 border border-gray-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-gray-100">
            <TrendingUp className="w-5 h-5" />
            Analyse des Marges
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-gray-400">Aucune donnee disponible</p>
        </CardContent>
      </Card>
    );
  }

  const {
    revenue,
    grossMargin,
    grossMarginPercent,
    ebitda,
    ebitdaMargin,
    operatingResult,
    operatingMargin
  } = data;

  const MetricCard = ({ icon: Icon, label, value, percentage, colorClass, info }) => (
    <Card className="h-full min-w-0 bg-gray-900/50 border border-gray-800">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="p-2 bg-gray-800 rounded-lg">
            <Icon className={`w-5 h-5 ${colorClass || 'text-blue-400'}`} />
          </div>
          {percentage !== undefined && (
            <span className={`text-sm font-semibold ${percentage >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {percentage.toFixed(1)}%
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
        {percentage !== undefined && (
          <p className="text-xs text-gray-500 mt-1">{percentage.toFixed(1)}% du CA</p>
        )}
      </CardContent>
    </Card>
  );

  const ProgressRow = ({ label, value, successThreshold, warningThreshold }) => (
    <div>
      <div className="flex justify-between items-center mb-2">
        <span className="text-sm text-gray-400">{label}</span>
        <span className="text-sm font-semibold text-gray-200">{value.toFixed(1)}%</span>
      </div>
      <div className="w-full bg-gray-700 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full ${
            value >= successThreshold ? 'bg-green-500' : value >= warningThreshold ? 'bg-yellow-500' : 'bg-red-500'
          }`}
          style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
        />
      </div>
    </div>
  );

  const advisories = [];
  if (ebitdaMargin < 10) {
    advisories.push({
      key: 'ebitda-low',
      type: 'warning',
      title: 'Attention',
      text: 'Votre marge EBITDA est inferieure a 10%. Envisagez d optimiser vos charges d exploitation.',
    });
  }
  if (operatingMargin < 0) {
    advisories.push({
      key: 'op-negative',
      type: 'critical',
      title: 'Alerte',
      text: 'Votre resultat d exploitation est negatif. Une analyse approfondie des couts est recommandee.',
    });
  }
  if (advisories.length === 0) {
    advisories.push({
      key: 'healthy',
      type: 'success',
      title: 'Situation saine',
      text: 'Les marges operationnelles restent dans une zone favorable sur la periode.',
    });
  }

  const advisoryClass = (type) => {
    if (type === 'critical') return 'border-red-500/30 bg-red-500/10 text-red-300';
    if (type === 'warning') return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300';
    return 'border-green-500/30 bg-green-500/10 text-green-300';
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <TrendingUp className="w-6 h-6 text-blue-400" />
        <h2 className="text-2xl font-bold text-gray-100">Analyse des Marges</h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          icon={DollarSign}
          label="Chiffre d'affaires"
          value={revenue}
          colorClass="text-blue-400"
          info={{
            title: "Chiffre d'affaires",
            formula: 'Somme des ventes HT sur la periode',
            definition: "Le chiffre d'affaires mesure le total des ventes realisees sur la periode.",
            utility: "Il sert a suivre la croissance commerciale et a comparer la performance d'une periode a l'autre.",
            interpretation: "Si le CA augmente de facon reguliere, l'activite progresse. S'il baisse, analysez volume, prix et perte clients.",
          }}
        />
        <MetricCard
          icon={Target}
          label="Marge brute"
          value={grossMargin}
          percentage={grossMarginPercent}
          colorClass={grossMargin >= 0 ? 'text-green-400' : 'text-red-400'}
          info={{
            title: 'Marge brute',
            formula: "Marge brute = CA - couts directs",
            definition: "La marge brute represente ce qu'il reste apres avoir paye les couts directement lies aux ventes.",
            utility: 'Elle permet de verifier si les prix couvrent correctement les couts de production/achat.',
            interpretation: 'Une marge brute elevee indique une bonne capacite a degager de la valeur. Une baisse signale souvent une pression sur les prix ou des couts en hausse.',
          }}
        />
        <MetricCard
          icon={Activity}
          label="EBE / EBITDA"
          value={ebitda}
          percentage={ebitdaMargin}
          colorClass={ebitda >= 0 ? 'text-purple-400' : 'text-red-400'}
          info={{
            title: 'EBE / EBITDA',
            formula: "EBITDA = resultat d'exploitation avant amortissements et provisions",
            definition: "L'EBITDA mesure la performance operationnelle pure, avant elements non cash.",
            utility: "Il sert a juger la rentabilite reelle de l'activite et a comparer des entreprises de taille differente.",
            interpretation: 'Un EBITDA positif et stable est un signal de robustesse. Une baisse continue indique une deterioration de la performance operationnelle.',
          }}
        />
        <MetricCard
          icon={TrendingUp}
          label="Resultat d'exploitation"
          value={operatingResult}
          percentage={operatingMargin}
          colorClass={operatingResult >= 0 ? 'text-green-400' : 'text-red-400'}
          info={{
            title: "Resultat d'exploitation",
            formula: "Resultat d'exploitation = produits d'exploitation - charges d'exploitation",
            definition: "Ce resultat montre le profit issu du coeur du metier, hors elements financiers et exceptionnels.",
            utility: "Il permet de savoir si l'entreprise gagne de l'argent sur son activite principale.",
            interpretation: 'Positif: activite rentable. Negatif: le modele operationnel doit etre corrige (prix, couts, efficacite).',
          }}
        />

        <Card className="h-full bg-gray-900/50 border border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-100">Analyse de la rentabilite</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <ProgressRow
              label="Marge brute"
              value={grossMarginPercent}
              successThreshold={30}
              warningThreshold={15}
            />
            <ProgressRow
              label="Marge EBITDA"
              value={ebitdaMargin}
              successThreshold={20}
              warningThreshold={10}
            />
            <ProgressRow
              label="Marge operationnelle"
              value={operatingMargin}
              successThreshold={15}
              warningThreshold={5}
            />
          </CardContent>
        </Card>

        <Card className="h-full bg-gray-900/50 border border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-100">Indicateurs cles</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-xs text-gray-500">CA genere</p>
              <p className="text-sm font-semibold text-gray-100">{formatCurrency(revenue, currency)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Benefice d'exploitation</p>
              <p className={`text-sm font-semibold ${operatingResult >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {formatCurrency(operatingResult, currency)}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="h-full bg-gray-900/50 border border-gray-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-gray-100">Lecture rapide</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-gray-300">
            <p>Marge brute: mesure la valeur creee apres couts directs.</p>
            <p>EBITDA: mesure la performance operationnelle avant elements non cash.</p>
            <p>Marge operationnelle: montre l'efficacite du modele d'exploitation.</p>
          </CardContent>
        </Card>

        {advisories.map((advisory) => (
          <Card key={advisory.key} className={`h-full border ${advisoryClass(advisory.type)}`}>
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                {advisory.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 mt-0.5" />
                )}
                <p className="text-sm">
                  <strong>{advisory.title}:</strong> {advisory.text}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default MarginAnalysisSection;
