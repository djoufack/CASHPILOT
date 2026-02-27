# Design: Modernisation UI Comptabilite CashPilot

**Date**: 2026-02-27
**Statut**: Approuve

## Probleme

4 sections de la page Comptabilite ont une UI datee:
1. Dashboard: graphiques basiques, trop larges, pas modernes
2. Diagnostic Financier: presentation ringarde, theme clair (bg-blue-50) qui clash avec le dark theme CashPilot
3. TVA: graphiques trop larges, pas modernes, pas detailles + bug NaN% dans le breakdown
4. Estimation impots: pas moderne, aucun detail

## Solution: Dark Glassmorphism Unified Redesign

### A. Dashboard Charts
- Layout 2 colonnes: BarChart (revenue vs charges) + AreaChart (tendance cumulative)
- Barres arrondies avec gradient fills
- Max-width controle, pas full-width
- Dark tooltips deja en place

### B. Diagnostic Financier (4 fichiers)

**FinancialDiagnostic.jsx (wrapper)**
- `bg-gradient-to-r from-blue-50 to-indigo-50` → `bg-gradient-to-br from-[#0f1528] to-[#141c33]`
- Cards summary: `bg-white` → `bg-gray-900/50 border-gray-800`
- Textes: `text-gray-900` → `text-gray-100`, `text-gray-500` → `text-gray-400`

**MarginAnalysisSection.jsx**
- `bg-blue-50` → `bg-gray-900/50 border border-gray-800`
- Progress bars: `bg-gray-200` → `bg-gray-700` avec fills colores
- Alerts: `bg-yellow-50` → `bg-yellow-500/10 border-yellow-500/30`
- MetricCard: fond transparent avec border-gray-800

**FinancingAnalysisSection.jsx**
- `bg-purple-50` → meme pattern dark
- Recommendations: colored left-border accent sur fond dark
- Progress bars: track `bg-gray-700`

**KeyRatiosSection.jsx + RatioGauge.jsx**
- Tables: `bg-gray-50` → `bg-gray-900/50`, `divide-gray-800`
- RatioGauge: track `bg-gray-700`, badges dark-adapted
- Explications: `bg-blue-50` → `bg-blue-500/10`

### C. TVA (VATDeclaration.jsx)

**Bug fix**: `calculateVATBreakdownFromEntries` retourne `{account, name, vat}` mais le composant attend `{rate, base, vat}` → ajouter `rate` et `base` dans la fonction.

**Graphique mensuel**: Remplacer estimation `revenue * 0.2` par donnees reelles entry-based.

**Layout moderne**:
- 2 colonnes: bar chart mensuel (collectee vs deductible stacked) + donut breakdown par taux
- Table detaillee avec codes de compte
- Dark theme unifie

### D. Estimation Impots (TaxEstimation.jsx)

- Waterfall breakdown: Revenue → Charges → Net → Tranches → Total
- Donut chart distribution par tranche
- Progress bar taux effectif
- 4 cards paiements trimestriels Q1-Q4
- Dark theme unifie

## Fichiers modifies

1. `src/components/accounting/AccountingDashboard.jsx`
2. `src/components/accounting/FinancialDiagnostic.jsx`
3. `src/components/accounting/MarginAnalysisSection.jsx`
4. `src/components/accounting/FinancingAnalysisSection.jsx`
5. `src/components/accounting/KeyRatiosSection.jsx`
6. `src/components/accounting/RatioGauge.jsx`
7. `src/components/accounting/VATDeclaration.jsx`
8. `src/components/accounting/TaxEstimation.jsx`
9. `src/utils/accountingCalculations.js` (fix VATBreakdown format)
