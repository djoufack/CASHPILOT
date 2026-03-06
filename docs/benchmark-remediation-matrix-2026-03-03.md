# Matrice de Remediation Benchmark CashPilot

Date de verification: 2026-03-03

Cette note complete les classeurs `docs/benchmark_cashpilot.xlsx` et `docs/scoring_benchmark_cashpilot.xlsx`.

Le point cle est le suivant: le score `172.5 / 172.5` du benchmark reste un indicateur de couverture fonctionnelle. Il ne mesure pas toute la maturite produit, la profondeur de l'ecosysteme, ni la traction marche.

## 1. Ce que les dernieres mises a jour ont reellement remedie

| Point benchmark ou promesse produit | Statut au 2026-03-03 | Preuves |
| --- | --- | --- |
| Paiement en ligne client | Remedie | `src/pages/InvoicesPage.jsx`, `supabase/functions/stripe-invoice-link/index.ts`, `src/App.jsx`, `src/pages/PaymentSuccessPage.jsx`, smoke prod via `scripts/smoke-runtime-features.mjs` |
| Webhooks securises avec logs | Remedie | `src/pages/WebhooksPage.jsx`, `src/components/MainLayout.jsx`, `src/components/Sidebar.jsx`, `supabase/functions/_shared/webhooks.ts`, `src/utils/webhookTrigger.js` |
| Multi-societes runtime | Remedie sur le socle | `src/hooks/useCompanyScope.js`, `src/hooks/useCompany.js`, `src/components/TopNavBar.jsx`, `src/components/MobileMenu.jsx`, `src/hooks/useInvoices.js`, `src/hooks/useAccountingData.js` |
| Rentabilite projet | Remedie | `src/hooks/useProjectProfitability.js`, `src/pages/ProjectDetail.jsx` |
| Vue Gantt projet | Remedie | `src/components/GanttView.jsx`, `src/pages/ProjectDetail.jsx`, `src/components/TaskForm.jsx` |
| Signature publique des devis | Remedie | `src/pages/QuotesPage.jsx`, `src/pages/QuoteSignPage.jsx`, `supabase/functions/quote-sign-request/index.ts`, `supabase/functions/quote-sign-submit/index.ts`, smoke prod via `scripts/smoke-runtime-features.mjs` |
| Immobilisations / amortissements | Remedie | `src/components/accounting/FixedAssets.jsx`, `src/hooks/useFixedAssets.js` |
| Comptabilite analytique | Remedie | `src/components/accounting/AnalyticalAccounting.jsx`, `src/pages/AccountingIntegration.jsx` |

## 2. Faiblesses benchmark encore ouvertes

| Faiblesse benchmark | Source benchmark | Etat actuel | Verdict | Preuves / constats |
| --- | --- | --- | --- | --- |
| Ecosysteme d'integrations tiers plus faible que QuickBooks | `Facilite d'integration`, `Top 3 faiblesses CashPilot` | API REST, webhooks et MCP sont presents, mais pas de marketplace d'integrations ni de catalogue natif large | Ouvert | `src/components/settings/ConnectionSettings.jsx`, `src/pages/WebhooksPage.jsx`, `supabase/functions/api-v1/index.ts` |
| Notoriete et part de marche naissante | `Observations cles`, `Top 3 faiblesses CashPilot` | Sujet go-to-market, non resolu par la seule roadmap technique | Ouvert | Mention explicite dans `docs/scoring_benchmark_cashpilot.xlsx` |
| Stock industriel moins mature que WinBooks / Sage | `Stock` | Stock operationnel, alertes, historique et barcode OK, mais pas de multi-depots ni FIFO/LIFO/CMUP visibles | Ouvert | `src/pages/StockManagement.jsx`, `src/hooks/useStockHistory.js`, absence de code `FIFO`, `LIFO`, `CMUP`, `multi-depot` |
| Dashboards et rapports "de reference" face a QuickBooks / WinBooks | `Analytics` | Pilotage riche et differenciant, mais la largeur des rapports prepackes et la maturite dashboard restent a renforcer | Partiellement remedie | `src/pages/AnalyticsPage.jsx`, `src/pages/Dashboard.jsx`, `src/components/pilotage/*`, `src/pages/ProjectDetail.jsx` |
| Multi-dossiers / usage fiduciaire avance | `Admin et gouvernance` | Multi-societes runtime livre, mais pas encore la profondeur cabinet/multi-portefeuille d'un leader historique | Partiellement remedie | `src/hooks/useCompanyScope.js`, `src/hooks/useCompany.js`, `src/components/CompanySwitcher.jsx` |
| Statut de reference belge face a WinBooks | `Conformite locale (BE)` | PCMN, TVA, CODA, Peppol et profondeur comptable renforces, mais WinBooks reste l'acteur historique de reference | Partiellement remedie | `src/pages/AccountingIntegration.jsx`, `src/components/accounting/FixedAssets.jsx`, `src/components/accounting/AnalyticalAccounting.jsx`, `src/pages/PeppolPage.jsx` |

## 3. Lecture honnete du benchmark apres MAJ

- CashPilot est maintenant bien plus aligne avec les promesses fortes du benchmark qu'avant les dernieres corrections runtime.
- Les principaux ecarts fermes sont des ecarts d'execution produit: paiement en ligne, webhooks exploitables, multi-societes runtime, signature devis, Gantt, profondeur comptable.
- Les ecarts restants sont surtout des ecarts de maturite marche: ecosysteme, reference locale historique, logistique avancee, multi-dossiers fiduciaires, notoriete.

## 4. Conclusion strategique

Oui, CashPilot peut combler l'essentiel des lacunes restantes, mais pas toutes de la meme facon:

- Les lacunes produit sont comblables par roadmap: stock avance, rapports prepackes, workflows cabinet, connecteurs natifs.
- Les lacunes marche ne se reglent pas uniquement par du code: notoriete, distribution, partenariats, fiduciaires pilotes, preuve sociale, certification et references clients.

Autrement dit: devenir un logiciel de reference est possible, mais cela demande une strategie double:

1. Continuer a fermer les trous de maturite produit.
2. Construire un vrai avantage de diffusion et de confiance sur le marche cible.
