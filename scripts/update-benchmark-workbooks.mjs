import * as XLSX from 'xlsx';
import * as fs from 'node:fs';
import path from 'node:path';

XLSX.set_fs(fs);

const POST_UPDATE_SHEET = 'Post-MAJ 2026-03-03';

const postUpdateRows = [
  ['POST-MAJ 2026-03-03 - Verification benchmark CashPilot'],
  ['Le score 172.5/172.5 reste un indicateur de couverture fonctionnelle. Cette feuille ajoute une lecture maturite/runtime apres les mises a jour du 3 mars 2026.'],
  [],
  ['Point de faiblesse ou promesse benchmark', 'Source benchmark', 'Etat au 2026-03-03', 'Verdict', 'Preuves code/runtime', 'Reste a faire'],
  ['Paiement en ligne client', 'Benchmark: "Paiements et recus" / "Portail client"', 'Stripe Payment Link operationnel, route de succes presente, flux smoke prod valide.', 'Remedie', 'src/pages/InvoicesPage.jsx; supabase/functions/stripe-invoice-link/index.ts; src/App.jsx; src/pages/PaymentSuccessPage.jsx; scripts/smoke-runtime-features.mjs', 'Etendre au besoin les PSP / abonnements / relances de paiement.'],
  ['Webhooks HMAC exploitables', 'Benchmark: "Webhooks" / "Facilite d integration"', 'Page UI visible, HMAC cote serveur, logs et declencheurs runtime branches.', 'Remedie', 'src/pages/WebhooksPage.jsx; src/components/MainLayout.jsx; src/components/Sidebar.jsx; supabase/functions/_shared/webhooks.ts; src/utils/webhookTrigger.js', 'Ajouter a terme des connecteurs natifs et une marketplace.'],
  ['Multi-societes runtime', 'Benchmark: "Admin et gouvernance"', 'Switcher desktop/mobile et scoping runtime des donnees livrés.', 'Partiellement remedie', 'src/hooks/useCompanyScope.js; src/hooks/useCompany.js; src/components/TopNavBar.jsx; src/components/MobileMenu.jsx; src/hooks/useInvoices.js; src/hooks/useAccountingData.js', 'Completer les workflows cabinet / multi-dossiers avances.'],
  ['Pilotage projet: rentabilite + Gantt', 'Benchmark: "Projets"', 'Onglets rentabilite et Gantt operationnels, dates alimentees depuis le formulaire de taches.', 'Remedie', 'src/hooks/useProjectProfitability.js; src/pages/ProjectDetail.jsx; src/components/TaskForm.jsx; src/components/GanttView.jsx', 'Etendre si besoin au capacity planning ou dependances avancees.'],
  ['Signature publique des devis', 'Lacune produit post-benchmark, necessaire pour rester au niveau marche', 'Flux demande de signature, page publique et soumission securisee valides.', 'Remedie', 'src/pages/QuotesPage.jsx; src/pages/QuoteSignPage.jsx; supabase/functions/quote-sign-request/index.ts; supabase/functions/quote-sign-submit/index.ts; scripts/smoke-runtime-features.mjs', 'Ajouter option de preuve juridique renforcee si cible grands comptes.'],
  ['Profondeur comptable: immobilisations + analytique', 'Benchmark: "Conformite locale (BE)" / "Bilan / P&L / TVA / Journal / GL"', 'Immobilisations, amortissements et axes analytiques presents, ce qui renforce la profondeur comptable reelle.', 'Partiellement remedie', 'src/components/accounting/FixedAssets.jsx; src/hooks/useFixedAssets.js; src/components/accounting/AnalyticalAccounting.jsx; src/pages/AccountingIntegration.jsx', 'Renforcer les parcours fiduciaires et les exports/certifications locales.'],
  ['Dashboards / rapports face a QuickBooks et WinBooks', 'Benchmark: "Analytics"', 'Pilotage tres riche, mais largeur des rapports prepackes et maturite dashboard encore perfectibles.', 'Partiellement remedie', 'src/pages/AnalyticsPage.jsx; src/pages/Dashboard.jsx; src/components/pilotage; src/pages/ProjectDetail.jsx', 'Ajouter plus de rapports standards, comparatifs et builder dashboard.'],
  ['Stock industriel', 'Benchmark: "Stock"', 'Stock operationnel present, mais pas de multi-depots ni FIFO/LIFO/CMUP visibles.', 'Ouvert', 'src/pages/StockManagement.jsx; src/hooks/useStockHistory.js; absence de code FIFO/LIFO/CMUP/multi-depot', 'Priorite si cible retail, negoce ou industrie.'],
  ['Ecosysteme integrations tiers', 'Benchmark: "Facilite d integration" / "Top 3 faiblesses CashPilot"', 'API, webhooks et MCP sont forts, mais l ecosysteme applicatif reste plus petit que QuickBooks.', 'Ouvert', 'src/components/settings/ConnectionSettings.jsx; src/pages/WebhooksPage.jsx; supabase/functions/api-v1/index.ts', 'Construire connecteurs natifs, Zapier/Make templates, et partenariats.'],
  ['Notoriete / part de marche', 'Benchmark: "Observations cles" / "Top 3 faiblesses CashPilot"', 'Sujet distribution et confiance marche, pas resolu par le code seul.', 'Ouvert', 'Constat benchmark, non measurable dans le code', 'Travailler references clients, distribution, cabinets pilotes et preuve sociale.'],
  [],
  ['Synthese'],
  ['CashPilot est maintenant aligne avec ses principales promesses produit. Les ecarts restants sont surtout des ecarts de maturite marche et d ecosysteme, pas des trous fonctionnels critiques.'],
];

const workbookConfigs = [
  {
    file: 'docs/benchmark_cashpilot.xlsx',
    updates: [
      ['B24', 'Oui, suivi des niveaux, mouvements, valorisation simple, alertes et barcode'],
      ['F24', 'Sage et WinBooks restent plus matures en stock industriel. CashPilot couvre le stock operationnel, mais pas encore le multi-depots ou la valorisation avancee type FIFO/CMUP.'],
      ['F39', 'QuickBooks et WinBooks gardent des dashboards tres matures. CashPilot a renforce le pilotage avec rentabilite projet, Gantt et scenarios, mais peut encore elargir ses rapports prepackes.'],
      ['F53', 'CashPilot dispose maintenant d un socle multi-entreprises runtime. WinBooks et Sage restent plus matures sur les usages fiduciaires multi-dossiers.'],
      ['F61', 'QuickBooks = ecosysteme. CashPilot = API + Webhooks + MCP tres forts, mais ecosysteme tiers encore plus restreint.'],
      ['F62', 'WinBooks reste la reference belge historique. CashPilot a renforce sa profondeur comptable et reste un challenger tres credible.'],
    ],
  },
  {
    file: 'docs/scoring_benchmark_cashpilot.xlsx',
    updates: [
      ['F5', 'Leader en couverture fonctionnelle. Les mises a jour du 3 mars 2026 ont aligne le produit reel sur plusieurs promesses fortes du benchmark: paiement en ligne, webhooks, multi-societes runtime, signature devis, Gantt et profondeur comptable. Les ecarts restants sont surtout la notoriete, l ecosysteme d integrations tiers, le stock/logistique avances et certains workflows cabinet.'],
      ['D27', '1. Ecosysteme integrations tiers a elargir\n2. Stock / logistique avances a industrialiser\n3. Notoriete et part de marche a construire'],
      ['F27', 'Challenger disruptif avec l offre la plus complete sur la couverture fonctionnelle. Pour devenir une reference, CashPilot doit maintenant consolider ecosysteme, distribution et profondeur metier sur quelques verticales.'],
    ],
  },
];

function replaceSheet(workbook, name, rows) {
  if (workbook.SheetNames.includes(name)) {
    workbook.SheetNames = workbook.SheetNames.filter((sheetName) => sheetName !== name);
    delete workbook.Sheets[name];
  }

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  worksheet['!cols'] = [
    { wch: 34 },
    { wch: 34 },
    { wch: 36 },
    { wch: 18 },
    { wch: 56 },
    { wch: 40 },
  ];

  workbook.SheetNames.push(name);
  workbook.Sheets[name] = worksheet;
}

function setTextCell(worksheet, address, value) {
  worksheet[address] = { t: 's', v: value };
}

for (const config of workbookConfigs) {
  const absoluteFile = path.resolve(process.cwd(), config.file);
  const workbook = XLSX.readFile(absoluteFile);
  replaceSheet(workbook, POST_UPDATE_SHEET, postUpdateRows);

  for (const [address, value] of config.updates) {
    if (config.file.endsWith('scoring_benchmark_cashpilot.xlsx')) {
      const scoringSheet = workbook.Sheets['Classement & Observations'];
      setTextCell(scoringSheet, address, value);
    } else {
      const benchmarkSheet = workbook.Sheets['Benchmark CashPilot'];
      setTextCell(benchmarkSheet, address, value);
    }
  }

  XLSX.writeFile(workbook, absoluteFile, { compression: true });
  console.log(`Updated ${config.file}`);
}
