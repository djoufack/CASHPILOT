import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileDown, AlertTriangle, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import MarginAnalysisSection from './MarginAnalysisSection';
import FinancingAnalysisSection from './FinancingAnalysisSection';
import KeyRatiosSection from './KeyRatiosSection';

/**
 * Composant principal de Diagnostic Financier
 * Affiche les 3 sections: Marges, Financement, Ratios Clés
 */
const FinancialDiagnostic = ({ diagnostic, period, onExportPDF }) => {
  // Vérifier si le diagnostic est valide
  if (!diagnostic) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Données insuffisantes pour le diagnostic
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Pour générer un diagnostic financier complet, assurez-vous d'avoir:
          </p>
          <ul className="text-sm text-gray-600 text-left max-w-md mx-auto space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-blue-600">•</span>
              <span>Importé votre plan comptable OHADA</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600">•</span>
              <span>Créé des écritures comptables (manuelles ou automatiques)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600">•</span>
              <span>Un bilan équilibré avec des données cohérentes</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    );
  }

  // Si le diagnostic n'est pas valide, afficher les erreurs
  if (!diagnostic.valid) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-500 mt-1" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Impossible de générer le diagnostic
              </h3>
              <p className="text-sm text-gray-600 mb-3">
                Les erreurs suivantes ont été détectées:
              </p>
              <ul className="space-y-1">
                {diagnostic.errors.map((error, idx) => (
                  <li key={idx} className="text-sm text-red-600 flex items-start gap-2">
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

  // Formater la période
  const formatPeriod = () => {
    if (!period || !period.startDate || !period.endDate) return '';

    try {
      const start = format(new Date(period.startDate), 'dd MMMM yyyy', { locale: fr });
      const end = format(new Date(period.endDate), 'dd MMMM yyyy', { locale: fr });
      return `${start} - ${end}`;
    } catch (e) {
      return `${period.startDate} - ${period.endDate}`;
    }
  };

  return (
    <div className="space-y-6">
      {/* En-tête avec période et bouton export */}
      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Diagnostic Financier
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>Période: {formatPeriod()}</span>
              </div>
            </div>

            {onExportPDF && (
              <Button
                onClick={onExportPDF}
                variant="outline"
                className="flex items-center gap-2"
              >
                <FileDown className="w-4 h-4" />
                Exporter en PDF
              </Button>
            )}
          </div>

          {/* Résumé rapide */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <p className="text-xs text-gray-500 mb-1">CA de la période</p>
              <p className="text-xl font-bold text-blue-600">
                {new Intl.NumberFormat('fr-FR', {
                  style: 'currency',
                  currency: 'EUR'
                }).format(diagnostic.margins.revenue)}
              </p>
            </div>
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <p className="text-xs text-gray-500 mb-1">Marge EBITDA</p>
              <p className={`text-xl font-bold ${
                diagnostic.margins.ebitdaMargin >= 10
                  ? 'text-green-600'
                  : diagnostic.margins.ebitdaMargin >= 5
                  ? 'text-yellow-600'
                  : 'text-red-600'
              }`}>
                {diagnostic.margins.ebitdaMargin.toFixed(1)}%
              </p>
            </div>
            <div className="bg-white rounded-lg p-3 shadow-sm">
              <p className="text-xs text-gray-500 mb-1">Flux de trésorerie</p>
              <p className={`text-xl font-bold ${
                diagnostic.financing.operatingCashFlow >= 0
                  ? 'text-green-600'
                  : 'text-red-600'
              }`}>
                {new Intl.NumberFormat('fr-FR', {
                  style: 'currency',
                  currency: 'EUR',
                  signDisplay: 'always'
                }).format(diagnostic.financing.operatingCashFlow)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 1: Analyse des Marges */}
      <MarginAnalysisSection data={diagnostic.margins} />

      {/* Séparateur */}
      <div className="border-t border-gray-200 my-8" />

      {/* Section 2: Analyse du Financement */}
      <FinancingAnalysisSection data={diagnostic.financing} />

      {/* Séparateur */}
      <div className="border-t border-gray-200 my-8" />

      {/* Section 3: Ratios Clés */}
      <KeyRatiosSection data={diagnostic.ratios} />

      {/* Footer informatif */}
      <Card className="bg-gray-50">
        <CardContent className="p-4">
          <p className="text-xs text-gray-600">
            <strong>Note:</strong> Ce diagnostic financier est basé sur les données comptables
            selon les normes OHADA. Les ratios et indicateurs sont calculés automatiquement et
            doivent être interprétés dans le contexte spécifique de votre activité et de votre secteur.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancialDiagnostic;
