import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileDown, FileText, AlertTriangle, Calendar } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import MarginAnalysisSection from './MarginAnalysisSection';
import FinancingAnalysisSection from './FinancingAnalysisSection';
import KeyRatiosSection from './KeyRatiosSection';

const FinancialDiagnostic = ({ diagnostic, period, onExportPDF, onExportHTML }) => {
  if (!diagnostic) {
    return (
      <Card className="bg-gray-900/50 border border-gray-800">
        <CardContent className="p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-100 mb-2">
            Donnees insuffisantes pour le diagnostic
          </h3>
          <p className="text-sm text-gray-400 mb-4">
            Pour generer un diagnostic financier complet, assurez-vous d'avoir:
          </p>
          <ul className="text-sm text-gray-400 text-left max-w-md mx-auto space-y-2">
            <li className="flex items-start gap-2">
              <span className="text-blue-400">•</span>
              <span>Importe votre plan comptable OHADA</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400">•</span>
              <span>Cree des ecritures comptables (manuelles ou automatiques)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-400">•</span>
              <span>Un bilan equilibre avec des donnees coherentes</span>
            </li>
          </ul>
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
              <h3 className="text-lg font-semibold text-gray-100 mb-2">
                Impossible de generer le diagnostic
              </h3>
              <p className="text-sm text-gray-400 mb-3">
                Les erreurs suivantes ont ete detectees:
              </p>
              <ul className="space-y-1">
                {diagnostic.errors.map((error, idx) => (
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
      {/* Header */}
      <Card className="bg-gradient-to-br from-[#0f1528] to-[#141c33] border border-gray-800">
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-bold text-gray-100 mb-2">
                Diagnostic Financier
              </h1>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Calendar className="w-4 h-4" />
                <span>Periode: {formatPeriod()}</span>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              {onExportPDF && (
                <Button
                  onClick={onExportPDF}
                  variant="outline"
                  className="flex items-center gap-2 border-gray-700 text-gray-300"
                >
                  <FileDown className="w-4 h-4" />
                  Exporter en PDF
                </Button>
              )}
              {onExportHTML && (
                <Button
                  onClick={onExportHTML}
                  variant="outline"
                  className="flex items-center gap-2 border-gray-700 text-gray-300"
                >
                  <FileText className="w-4 h-4" />
                  Exporter en HTML
                </Button>
              )}
            </div>
          </div>

          {/* Summary cards */}
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">CA de la periode</p>
              <p className="text-xl font-bold text-blue-400">
                {new Intl.NumberFormat('fr-FR', {
                  style: 'currency',
                  currency: 'EUR'
                }).format(diagnostic.margins.revenue)}
              </p>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Marge EBITDA</p>
              <p className={`text-xl font-bold ${
                diagnostic.margins.ebitdaMargin >= 10
                  ? 'text-green-400'
                  : diagnostic.margins.ebitdaMargin >= 5
                  ? 'text-yellow-400'
                  : 'text-red-400'
              }`}>
                {diagnostic.margins.ebitdaMargin.toFixed(1)}%
              </p>
            </div>
            <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3">
              <p className="text-xs text-gray-500 mb-1">Flux de tresorerie</p>
              <p className={`text-xl font-bold ${
                diagnostic.financing.operatingCashFlow >= 0
                  ? 'text-green-400'
                  : 'text-red-400'
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

      <div className="border-t border-gray-800 my-8" />

      {/* Section 2: Analyse du Financement */}
      <FinancingAnalysisSection data={diagnostic.financing} />

      <div className="border-t border-gray-800 my-8" />

      {/* Section 3: Ratios Cles */}
      <KeyRatiosSection data={diagnostic.ratios} />

      {/* Footer */}
      <Card className="bg-gray-900/50 border-gray-800">
        <CardContent className="p-4">
          <p className="text-xs text-gray-400">
            <strong>Note:</strong> Ce diagnostic financier est base sur les donnees comptables
            selon les normes OHADA. Les ratios et indicateurs sont calcules automatiquement et
            doivent etre interpretes dans le contexte specifique de votre activite et de votre secteur.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancialDiagnostic;
