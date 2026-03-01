Plan : Ecosysteme de Pilotage d'Entreprise
Contexte
CashPilot dispose deja d'un riche ecosysteme comptable (hooks, composants, utilitaires de calcul) mais ces elements sont disperses dans la page Comptabilite. L'utilisateur souhaite un centre de pilotage strategique unifie qui agrege toutes les donnees comptables et financieres en temps reel pour permettre des diagnostics et analyses a la fois comptables et financiers. Les specifications proviennent de 6 documents dans le dossier Analyse Comptable Et Financiere/.

Architecture
Page unique /app/pilotage avec 6 onglets internes (Radix UI Tabs) — c'est le pattern etabli dans l'app (cf. AccountingIntegration.jsx avec 12 tabs).

Navigation : Lien direct dans le sidebar, juste apres Dashboard (avant Peppol).

Structure des fichiers a creer

src/
  pages/
    PilotagePage.jsx                         # Page principale avec 6 onglets

  components/pilotage/
    PilotageHeader.jsx                       # Selecteurs region/secteur/periode
    PilotageOverviewTab.jsx                  # Onglet 1 : Vue d'Ensemble
    PilotageAccountingTab.jsx                # Onglet 2 : Analyse Comptable
    PilotageFinancialTab.jsx                 # Onglet 3 : Analyse Financiere
    PilotageTaxValuationTab.jsx              # Onglet 4 : Fiscalite & Valorisation
    PilotageSimulatorTab.jsx                 # Onglet 5 : Simulateur
    PilotageAuditTab.jsx                     # Onglet 6 : Audit IA

    # Sous-composants Tab 1 (Vue d'Ensemble)
    KPICardGrid.jsx                          # Grille KPIs : CA, EBITDA, RN, FCF, Valorisation
    PerformanceComposedChart.jsx             # ComposedChart Recharts (CA Area + RN Bar + CF Line)
    RatioStatusGrid.jsx                      # 4 mini-cards ratio avec icones statut
    AlertsPanel.jsx                          # Panneau d'alertes financieres

    # Sous-composants Tab 2 (Analyse Comptable)
    StructureRatiosSection.jsx               # Independance financiere, Gearing, Couverture emplois stables
    ActivityRatiosSection.jsx                # DSO, DPO, Rotation stocks, CCC

    # Sous-composants Tab 4 (Fiscalite & Valorisation)
    TaxSynthesisCard.jsx                     # Calcul IS par zone geographique
    ValuationCard.jsx                        # Valorisation entreprise (multiples + DCF)
    WACCSensitivityChart.jsx                 # Sensibilite WACC (BarChart horizontal)
    SectorBenchmark.jsx                      # Tableau comparatif secteur

  hooks/
    usePilotageData.js                       # Hook orchestrateur combinant les sources

  utils/
    pilotageCalculations.js                  # Ratios supplementaires (DSO, DPO, CCC, ROA, EVA, etc.)
    sectorBenchmarks.js                      # Donnees benchmarks par secteur
    taxCalculations.js                       # Moteur fiscal multi-zones (France/Belgique/OHADA)
    valuationCalculations.js                 # Methode multiples + DCF simplifie
Fichiers existants a modifier
Fichier	Modification
src/App.jsx (ligne ~78)	Ajouter const PilotagePage = lazyRetry(...) + route <Route path="pilotage">
src/components/Sidebar.jsx (ligne ~42)	Ajouter entree directe "Pilotage" apres Dashboard (avant Peppol)
src/i18n/locales/fr.json	Ajouter section pilotage (~80 cles)
src/i18n/locales/en.json	Ajouter section pilotage (~80 cles)
Composants et hooks existants reutilises (sans modification)
Element	Fichier	Usage
useAccountingData	src/hooks/useAccountingData.js	Source principale de donnees comptables
useCashFlow	src/hooks/useCashFlow.js	Cash flow + previsions
useAuditComptable	src/hooks/useAuditComptable.js	Score sante comptable
useFinancialScenarios	src/hooks/useFinancialScenarios.js	Scenarios what-if
useCompany	src/hooks/useCompany.js	Devise, parametres entreprise
RatioGauge	src/components/accounting/RatioGauge.jsx	Jauge visuelle ratios
KeyRatiosSection	src/components/accounting/KeyRatiosSection.jsx	Section ratios cles
MarginAnalysisSection	src/components/accounting/MarginAnalysisSection.jsx	Analyse marges
FinancingAnalysisSection	src/components/accounting/FinancingAnalysisSection.jsx	Analyse financement
buildFinancialDiagnostic	src/utils/financialAnalysisCalculations.js	Moteur diagnostic existant
Tabs, Card, Button, Badge, Tooltip	src/components/ui/*	Composants UI Radix/Shadcn
Detail des 6 onglets
Onglet 1 : Vue d'Ensemble
KPICardGrid : 5 cartes (CA, EBITDA, Resultat Net, Free Cash Flow, Valorisation estimee) avec tendances mois precedent
PerformanceComposedChart : Recharts ComposedChart 3 ans — CA en Area, Resultat Net en Bar, Cash Flow en Line
RatioStatusGrid : 4 mini-cartes avec icones CheckCircle/AlertTriangle — Independance Financiere %, Liquidite Generale, DSO jours, Gearing
AlertsPanel : Detection automatique d'alertes critiques (CP negatifs, ICR < 1, DSCR < 1.2, derive BFR, CF operationnel negatif, gearing > 1)
Onglet 2 : Analyse Comptable
StructureRatiosSection (NOUVEAU) : Independance financiere, Gearing (Endettement), Couverture emplois stables — avec RatioGauge
KeyRatiosSection (REUTILISE) : Liquidite generale/reduite/immediate
ActivityRatiosSection (NOUVEAU) : DSO, DPO, Rotation Stocks, Cycle Conversion Cash, BFR/CA — avec benchmarks sectoriels
Resume Balance de Verification (donnees de useAccountingData.trialBalance)
Onglet 3 : Analyse Financiere
MarginAnalysisSection (REUTILISE) : Marge brute, EBITDA, marge operationnelle
FinancingAnalysisSection (REUTILISE) : CAF, BFR, Cash Flow operationnel
Section Rentabilite : ROE, ROA, ROCE avec RatioGauge
PieChart Recharts : Structure du capital (Capitaux propres vs Dettes financieres vs Dettes exploitation)
AreaChart Recharts : Tendance rentabilite sur 4 periodes
Onglet 4 : Fiscalite & Valorisation
TaxSynthesisCard : Calcul IS dynamique par zone (France 25%/15% PME, Belgique 25%/20%, OHADA 25-30% + IMF)
Credits d'impot : CIR France 30%, Credit R&D Belgique 15%, Code Investissements OHADA
Taux effectif vs theorique
ValuationCard : Valorisation par multiples EBITDA (multiples adaptes secteur/region)
WACCSensitivityChart : BarChart horizontal montrant impact variations WACC
SectorBenchmark : Tableau comparatif ratio reel vs cible sectorielle
Onglet 5 : Simulateur
Wrapper autour de useFinancialScenarios existant
Liste des scenarios avec bouton lancer simulation
Reutilise ScenarioComparison existant pour comparer
Lien vers page ScenarioBuilder pour edition approfondie
Onglet 6 : Audit IA
Wrapper autour de useAuditComptable existant
Jauge score sante (pattern AccountingHealthWidget)
Categories d'audit avec scores individuels
Bouton lancer audit + resultats structures
Hook orchestrateur : usePilotageData

usePilotageData(startDate, endDate, sector, region)
├── useAccountingData(startDate, endDate)    // reutilise
├── useCashFlow(12, 'month')                  // reutilise
├── useCompany()                              // reutilise
├── useMemo → pilotageCalculations            // nouveaux ratios
├── useMemo → taxCalculations                 // calcul fiscal multi-zones
├── useMemo → valuationCalculations           // valorisation
├── useMemo → sectorBenchmarks                // benchmarks
└── useMemo → alertsComputation               // alertes automatiques
Utilitaires de calcul a creer
pilotageCalculations.js
Ratios non couverts par financialAnalysisCalculations.js :

calculateDSO(receivables, revenue) — Delai Client
calculateDPO(payables, purchases) — Delai Fournisseur
calculateStockRotationDays(inventory, cogs) — Rotation Stocks
calculateCCC(dso, dpo, stockDays) — Cycle Conversion Cash
calculateBFRToRevenue(bfr, revenue) — Intensite BFR
calculateROA(netIncome, totalAssets) — Return on Assets
calculateEVA(nopat, wacc, capitalEmployed) — Economic Value Added
calculateInterestCoverage(ebit, interestExpense) — Couverture Interets
calculateFreeCashFlow(cfo, capex) — Free Cash Flow
calculateFinancialIndependence(equity, totalBilan) — Autonomie financiere
calculateStableAssetCoverage(permanentCapital, fixedAssets) — Couverture Emplois Stables
computeAlerts(data, ratios) — Detection alertes critiques
sectorBenchmarks.js
Donnees statiques de reference par secteur (SaaS, Industrie, Commerce, Construction, Services B2B) :

Cibles marges, gearing, BFR, DSO, rotation stocks
Multiples de valorisation par secteur/region
taxCalculations.js
calculateIS(rcai, region, isSmallBusiness) — Impot sur les societes
calculateTaxCredits(rdExpenses, region) — Credits d'impot R&D
calculateEffectiveTaxRate(taxDue, preTaxIncome) — Taux effectif
calculateIMF(revenue) — Impot Minimum Forfaitaire (OHADA)
valuationCalculations.js
calculateMultiplesValuation(ebitda, sector, region) — Methode multiples
calculateDCFValuation(fcf, wacc, growthRate, years) — DCF simplifie
getWACCByRegion(region) — WACC par zone geographique
getSectorMultiples(sector, region) — Multiples sectoriels
Integration Sidebar
Dans src/components/Sidebar.jsx, ajouter apres le bloc Dashboard (ligne 41) :


{
  id: 'pilotage',
  label: t('nav.pilotage'),
  icon: BarChart3,  // ou Gauge de lucide-react
  type: 'direct',
  path: '/app/pilotage',
},
Integration Router
Dans src/App.jsx :

Ajouter import lazy : const PilotagePage = lazyRetry(() => import('./pages/PilotagePage'));
Ajouter route apres ligne 190 : <Route path="pilotage" element={<Suspense fallback={<PageLoader />}><PilotagePage /></Suspense>} />
i18n
Ajouter dans nav : "pilotage": "Pilotage" (FR) / "Steering" (EN)

Ajouter section pilotage avec ~80 cles couvrant :

tabs.* (noms des 6 onglets)
selectors.* (region, secteur, periode)
regions.* (France, Belgique, Zone OHADA)
sectors.* (SaaS, Industrie, Commerce, Construction, Services B2B)
kpis.* (tous les KPIs et ratios)
tax.* (synthese fiscale)
valuation.* (valorisation)
alerts.* (messages d'alerte)
benchmark.* (benchmarking)
Ordre d'implementation (3 phases parallelisables)
Phase 1 : Fondations (utilitaires + hook + i18n)
src/utils/sectorBenchmarks.js
src/utils/pilotageCalculations.js
src/utils/taxCalculations.js
src/utils/valuationCalculations.js
src/hooks/usePilotageData.js
Ajout cles i18n dans fr.json et en.json
Phase 2 : Shell page + integration nav/router
src/pages/PilotagePage.jsx — structure de base avec 6 onglets vides
src/components/pilotage/PilotageHeader.jsx
Modifier src/App.jsx — lazy import + route
Modifier src/components/Sidebar.jsx — entree directe "Pilotage"
Phase 3 : Composants des onglets (parallelisable par onglet)
Tab 1 : PilotageOverviewTab + KPICardGrid + PerformanceComposedChart + RatioStatusGrid + AlertsPanel
Tab 2 : PilotageAccountingTab + StructureRatiosSection + ActivityRatiosSection
Tab 3 : PilotageFinancialTab (reutilise MarginAnalysis + FinancingAnalysis + nouveaux charts)
Tab 4 : PilotageTaxValuationTab + TaxSynthesisCard + ValuationCard + WACCSensitivityChart + SectorBenchmark
Tab 5 : PilotageSimulatorTab (wrapper scenarios existants)
Tab 6 : PilotageAuditTab (wrapper audit existant)
Design
Theme : Dark glassmorphism (bg-gray-950, bg-gray-900/50, border-gray-800/50)
Accent : Orange (text-orange-400, bg-orange-500/10)
Charts : Recharts avec palette coherente (blue-400, emerald-400, orange-400, purple-400)
Animations : Framer Motion (motion.div avec stagger)
Responsive : grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4
Icones : Lucide React
Verification
Naviguer vers /app/pilotage via le sidebar
Verifier que les 6 onglets s'affichent et sont navigables
Verifier que les KPIs se chargent avec les donnees reelles (Supabase)
Verifier le mode responsive (mobile, tablet, desktop)
Changer de region/secteur et verifier que les benchmarks et calculs fiscaux s'adaptent
Verifier les traductions FR/EN
Tester avec un compte sans donnees comptables (etats vides, pas d'erreurs)