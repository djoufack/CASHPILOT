# PLAN D'IMPLEMENTATION - 28 FONCTIONNALITES CASHPILOT
## Document Technique - 5 fevrier 2026

---

# RESUME EXECUTIF

**28 fonctionnalites** selectionnees pour implementation, organisees en **6 sprints** sur une periode estimee.

| Sprint | Theme | Fonctionnalites | Complexite |
|--------|-------|-----------------|------------|
| 1 | Performance & PWA | 5 | Faible-Moyen |
| 2 | Securite & Conformite | 4 | Moyen |
| 3 | Compliance Internationale | 5 | Moyen |
| 4 | IA Avancee | 5 | Moyen-Eleve |
| 5 | Fonctionnalites Differenciantes | 5 | Eleve |
| 6 | Marche & Integrations | 4 | Moyen-Eleve |

---

# SPRINT 1 : PERFORMANCE & PWA

## 1.1 Code Splitting React.lazy (5.1)
**Effort**: Faible | **Impact**: Performance

### Fichiers a modifier
- `src/App.jsx` - Convertir 30+ imports statiques en React.lazy()

### Implementation
```javascript
// AVANT
import ClientsPage from './pages/ClientsPage';

// APRES
const ClientsPage = React.lazy(() => import('./pages/ClientsPage'));
```

### Pages a convertir (actuellement statiques)
- ClientsPage, ProjectsPage, InvoicesPage, QuotesPage
- ExpensesPage, TimesheetsPage, DebtManagerPage
- StockManagement, SuppliersPage, AnalyticsPage
- ScenarioBuilder, NotificationCenter, AdminPages (5+)

### Verification
- `npm run build` - Verifier chunks separes
- Lighthouse Performance score > 90

---

## 1.2 Virtualisation Listes react-window (5.2)
**Effort**: Moyen | **Impact**: Performance listes

### Pattern existant
- `src/components/VirtualizedTable.jsx` - Deja implemente avec FixedSizeList

### Pages a integrer
| Page | Fichier | Lignes estimees |
|------|---------|-----------------|
| InvoicesPage | `src/pages/InvoicesPage.jsx` | 100-1000+ |
| ClientsPage | `src/pages/ClientsPage.jsx` | 50-500+ |
| ExpensesPage | `src/pages/ExpensesPage.jsx` | 100-1000+ |
| TimesheetsPage | `src/pages/TimesheetsPage.jsx` | 100-500+ |
| QuotesPage | `src/pages/QuotesPage.jsx` | 50-200+ |

### Implementation
```jsx
import VirtualizedTable from '@/components/VirtualizedTable';

// Remplacer les tables standard par VirtualizedTable
<VirtualizedTable
  data={invoices}
  columns={columns}
  rowHeight={48}
  maxHeight={600}
  onRowClick={handleRowClick}
/>
```

---

## 1.3 PWA Complete avec Service Worker (5.3)
**Effort**: Moyen | **Impact**: Offline-first

### Fichiers existants
- `public/sw.js` - Service Worker avec caching
- `public/manifest.json` - Manifest PWA
- `src/main.jsx` - Registration SW

### Ameliorations requises
1. **Icons manquants** - Creer `icon-192.png`, `icon-512.png`
2. **Offline page** - Creer `public/offline.html`
3. **Cache strategies** - Etendre les routes cachees
4. **Background sync** - Completer integration avec `useOfflineSync.js`

### Nouveau fichier: `public/offline.html`
```html
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>CashPilot - Hors ligne</title>
  <style>/* Styles inline */</style>
</head>
<body>
  <h1>Vous etes hors ligne</h1>
  <p>Verifiez votre connexion internet.</p>
</body>
</html>
```

---

## 1.4 Edge Caching CDN (5.4)
**Effort**: Faible | **Impact**: Latence globale

### Fichier a modifier
- `vercel.json` - Ajouter headers de cache

### Configuration
```json
{
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    },
    {
      "source": "/(.*).js",
      "headers": [
        { "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }
      ]
    }
  ]
}
```

---

## 1.5 Database Sharding (5.5)
**Effort**: Eleve | **Impact**: Scalabilite

### Approche recommandee
- **Supabase**: Utiliser les partitions PostgreSQL
- **Strategie**: Partitionnement par `user_id` hash ou date

### Migration SQL
```sql
-- Partitionnement de la table invoices par date
CREATE TABLE invoices_partitioned (
  LIKE invoices INCLUDING ALL
) PARTITION BY RANGE (created_at);

CREATE TABLE invoices_2024 PARTITION OF invoices_partitioned
  FOR VALUES FROM ('2024-01-01') TO ('2025-01-01');

CREATE TABLE invoices_2025 PARTITION OF invoices_partitioned
  FOR VALUES FROM ('2025-01-01') TO ('2026-01-01');

CREATE TABLE invoices_2026 PARTITION OF invoices_partitioned
  FOR VALUES FROM ('2026-01-01') TO ('2027-01-01');
```

### Tables a partitionner
- `invoices` (volume eleve)
- `expenses` (volume eleve)
- `audit_log` (croissance rapide)
- `credit_transactions` (haute frequence)

---

# SPRINT 2 : SECURITE & CONFORMITE

## 2.1 CSP Headers Complets (1.2)
**Effort**: Faible | **Impact**: Protection XSS/injection

### Fichier existant
- `vercel.json` - CSP deja configure

### Ameliorations
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https://*.supabase.co; connect-src 'self' https://*.supabase.co wss://*.supabase.co https://generativelanguage.googleapis.com https://api.stripe.com; frame-ancestors 'none'; form-action 'self'; base-uri 'self'; upgrade-insecure-requests"
        },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "X-XSS-Protection", "value": "1; mode=block" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(self), payment=()" }
      ]
    }
  ]
}
```

**Note**: Retirer `'unsafe-eval'` du script-src (actuellement present)

---

## 2.2 Certification SOC 2 Type II (1.3)
**Effort**: Eleve | **Impact**: Confiance entreprises

### Actions techniques requises
1. **Audit logging complet** - Verifier `useAuditLog.js` couvre toutes les operations
2. **Access control** - Documenter RBAC dans `useUserRole.js`
3. **Encryption** - Voir section suivante
4. **Incident response** - Creer documentation

### Fichiers de documentation a creer
- `docs/security/SOC2-controls.md`
- `docs/security/access-control-policy.md`
- `docs/security/incident-response.md`
- `docs/security/data-retention.md`

### Integration audit log
```javascript
// Verifier que tous les hooks CRUD utilisent useAuditLog
// src/hooks/useInvoices.js, useClients.js, useExpenses.js, etc.
const { logAction } = useAuditLog();

const createInvoice = async (data) => {
  const result = await supabase.from('invoices').insert(data);
  await logAction('create', 'invoice', null, result.data);
  return result;
};
```

---

## 2.3 Chiffrement Donnees au Repos (1.4)
**Effort**: Moyen | **Impact**: Conformite bancaire

### Supabase
- **Par defaut**: Chiffrement AES-256 au repos (PostgreSQL + Storage)
- **Action**: Verifier configuration dans Supabase Dashboard

### Champs sensibles supplementaires
```sql
-- Extension pgcrypto pour chiffrement applicatif
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Exemple pour IBAN dans suppliers
ALTER TABLE suppliers ADD COLUMN iban_encrypted BYTEA;

-- Fonction de chiffrement
CREATE OR REPLACE FUNCTION encrypt_iban(iban TEXT, key TEXT)
RETURNS BYTEA AS $$
  SELECT pgp_sym_encrypt(iban, key);
$$ LANGUAGE SQL;
```

### Champs a chiffrer
- `suppliers.iban`, `suppliers.bic`
- `bank_connections.account_id`
- `profiles.tax_id` (si present)

---

## 2.4 Journalisation Centralisee (1.5)
**Effort**: Moyen | **Impact**: Monitoring, debug

### Option 1: Datadog (Recommande)
```javascript
// src/lib/logger.js
import { datadogLogs } from '@datadog/browser-logs';

datadogLogs.init({
  clientToken: import.meta.env.VITE_DATADOG_CLIENT_TOKEN,
  site: 'datadoghq.eu',
  service: 'cashpilot',
  env: import.meta.env.MODE,
  forwardErrorsToLogs: true,
  sampleRate: 100,
});

export const logger = {
  info: (message, context) => datadogLogs.logger.info(message, context),
  error: (message, context) => datadogLogs.logger.error(message, context),
  warn: (message, context) => datadogLogs.logger.warn(message, context),
};
```

### Option 2: Supabase Edge Function + externe
```typescript
// supabase/functions/log-event/index.ts
// Centralise les logs vers ELK/Datadog
```

### Integration
```javascript
// Dans les hooks critiques
import { logger } from '@/lib/logger';

const sendMessage = async (text) => {
  logger.info('AI Chat message sent', { userId: user.id, messageLength: text.length });
  // ...
};
```

---

# SPRINT 3 : COMPLIANCE INTERNATIONALE

## 3.1 FEC Export (7.4)
**Effort**: Faible | **Impact**: Conformite France

### Nouveau fichier: `src/services/exportFEC.js`
```javascript
/**
 * Export FEC (Fichier des Ecritures Comptables)
 * Format obligatoire pour l'administration fiscale francaise
 */

const FEC_COLUMNS = [
  'JournalCode', 'JournalLib', 'EcritureNum', 'EcritureDate',
  'CompteNum', 'CompteLib', 'CompAuxNum', 'CompAuxLib',
  'PieceRef', 'PieceDate', 'EcritureLib', 'Debit', 'Credit',
  'EcritureLet', 'DateLet', 'ValidDate', 'Montantdevise', 'Idevise'
];

export const exportFEC = async (entries, startDate, endDate, companyInfo) => {
  const lines = entries.map(entry => ({
    JournalCode: entry.journal || 'OD',
    JournalLib: getJournalName(entry.journal),
    EcritureNum: entry.entry_ref,
    EcritureDate: formatFECDate(entry.transaction_date),
    CompteNum: entry.account_code,
    CompteLib: entry.account_name,
    CompAuxNum: entry.auxiliary_account || '',
    CompAuxLib: entry.auxiliary_name || '',
    PieceRef: entry.source_id || '',
    PieceDate: formatFECDate(entry.document_date),
    EcritureLib: entry.description,
    Debit: formatFECAmount(entry.debit),
    Credit: formatFECAmount(entry.credit),
    EcritureLet: entry.lettrage || '',
    DateLet: entry.lettrage_date ? formatFECDate(entry.lettrage_date) : '',
    ValidDate: formatFECDate(entry.validated_at || entry.transaction_date),
    Montantdevise: '',
    Idevise: 'EUR'
  }));

  // CSV avec separateur pipe (|) et encodage UTF-8
  const csv = [
    FEC_COLUMNS.join('|'),
    ...lines.map(l => FEC_COLUMNS.map(c => l[c]).join('|'))
  ].join('\r\n');

  return new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' });
};

const formatFECDate = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
};

const formatFECAmount = (amount) => {
  return amount ? amount.toFixed(2).replace('.', ',') : '0,00';
};
```

### Composant UI: `src/components/accounting/FECExport.jsx`

---

## 3.2 SAF-T Export (7.5)
**Effort**: Faible | **Impact**: Conformite Europe Nord

### Nouveau fichier: `src/services/exportSAFT.js`
```javascript
/**
 * SAF-T (Standard Audit File - Tax)
 * Format XML standard OCDE
 */

export const exportSAFT = async (data, period, companyInfo) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<AuditFile xmlns="urn:OECD:StandardAuditFile-Tax:FR_1.01">
  <Header>
    <AuditFileVersion>1.01</AuditFileVersion>
    <CompanyID>${companyInfo.tax_id}</CompanyID>
    <CompanyName>${companyInfo.company_name}</CompanyName>
    <SelectionCriteria>
      <SelectionStartDate>${period.start}</SelectionStartDate>
      <SelectionEndDate>${period.end}</SelectionEndDate>
    </SelectionCriteria>
  </Header>
  <MasterFiles>
    <GeneralLedgerAccounts>
      ${data.accounts.map(a => `
      <Account>
        <AccountID>${a.account_code}</AccountID>
        <AccountDescription>${a.account_name}</AccountDescription>
        <AccountType>${a.account_type}</AccountType>
      </Account>`).join('')}
    </GeneralLedgerAccounts>
    <Customers>${generateCustomers(data.clients)}</Customers>
    <Suppliers>${generateSuppliers(data.suppliers)}</Suppliers>
  </MasterFiles>
  <GeneralLedgerEntries>
    ${generateEntries(data.entries)}
  </GeneralLedgerEntries>
</AuditFile>`;

  return new Blob([xml], { type: 'application/xml' });
};
```

---

## 3.3 e-Invoicing Factur-X/Peppol (7.1)
**Effort**: Moyen | **Impact**: Obligation EU 2024+

### Nouveau fichier: `src/services/exportFacturX.js`
```javascript
/**
 * Factur-X (ZUGFeRD 2.1) - PDF/A-3 avec XML embarque
 * Profils: MINIMUM, BASIC, EN16931
 */

import { jsPDF } from 'jspdf';

export const generateFacturX = async (invoice, profile = 'BASIC') => {
  // 1. Generer XML CII (Cross-Industry Invoice)
  const xml = generateCIIXml(invoice, profile);

  // 2. Generer PDF standard
  const pdf = await generateInvoicePDF(invoice);

  // 3. Embarquer XML dans PDF/A-3
  pdf.addFileToVFS('factur-x.xml', xml);
  pdf.internal.events.subscribe('putXML', () => {
    // Ajouter metadonnees Factur-X
  });

  return pdf.output('blob');
};

const generateCIIXml = (invoice, profile) => {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:${profile.toLowerCase()}</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>${invoice.invoice_number}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>${formatDateTime(invoice.invoice_date)}</ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <!-- ... reste du XML ... -->
</rsm:CrossIndustryInvoice>`;
};
```

---

## 3.4 Declaration TVA Automatique (7.3)
**Effort**: Moyen | **Impact**: Automatisation

### Fichiers existants a etendre
- `src/utils/accountingCalculations.js` - Fonctions TVA existantes
- `src/components/accounting/VATDeclaration.jsx` - UI existante

### Nouveau: `src/services/vatDeclarationService.js`
```javascript
/**
 * Generation automatique des declarations TVA
 * Formats: CA3 (France), Intervat (Belgique)
 */

export const generateVATDeclaration = async (period, country = 'FR') => {
  const vatData = await calculateVATBreakdown(period);

  if (country === 'FR') {
    return generateCA3(vatData, period);
  } else if (country === 'BE') {
    return generateIntervat(vatData, period);
  }
};

const generateCA3 = (data, period) => {
  // Format CA3 francais
  return {
    period: period,
    line01_ca_ht: data.totalRevenue,
    line08_tva_collectee: data.outputVAT.total,
    line19_tva_deductible_biens: data.inputVAT.goods,
    line20_tva_deductible_services: data.inputVAT.services,
    line28_tva_nette: data.netVAT,
    // ... autres lignes
  };
};
```

---

## 3.5 Localisation Fiscale 10+ Pays (7.2)
**Effort**: Eleve | **Impact**: Expansion internationale

### Structure de configuration
```javascript
// src/config/taxJurisdictions.js
export const TAX_JURISDICTIONS = {
  FR: {
    name: 'France',
    vatRates: [20, 10, 5.5, 2.1],
    defaultRate: 20,
    vatLabel: 'TVA',
    fiscalYear: { start: '01-01', end: '12-31' },
    formats: ['FEC', 'CA3'],
  },
  BE: {
    name: 'Belgique',
    vatRates: [21, 12, 6, 0],
    defaultRate: 21,
    vatLabel: 'BTW/TVA',
    fiscalYear: { start: '01-01', end: '12-31' },
    formats: ['SAF-T', 'Intervat'],
  },
  DE: {
    name: 'Allemagne',
    vatRates: [19, 7, 0],
    defaultRate: 19,
    vatLabel: 'MwSt',
    formats: ['SAF-T', 'ELSTER'],
  },
  // ... 7 autres pays
};
```

### Migration DB
```sql
-- Ajouter jurisdiction aux profils
ALTER TABLE profiles ADD COLUMN tax_jurisdiction VARCHAR(2) DEFAULT 'FR';
ALTER TABLE profiles ADD COLUMN vat_number VARCHAR(50);
```

---

# SPRINT 4 : IA AVANCEE

## 4.1 Previsions ML Avancees (4.1)
**Effort**: Moyen | **Cout credits**: 3

### Nouveau: `supabase/functions/ai-ml-forecast/index.ts`
```typescript
// Utilise Gemini pour des previsions type Prophet/LSTM
const CREDIT_COST = 3;

serve(async (req) => {
  // ... credit check pattern standard ...

  const prompt = `Tu es un expert en analyse financiere predictive.
Analyse ces donnees historiques sur ${months} mois et genere des previsions:

DONNEES:
${JSON.stringify(historicalData)}

Genere des previsions pour les ${forecastMonths} prochains mois avec:
- Decomposition tendance/saisonnalite
- Intervalles de confiance (80%, 95%)
- Detection de points d'inflexion
- Scenarios optimiste/pessimiste/base

Reponds en JSON:
{
  "forecasts": [{ "month": "YYYY-MM", "predicted": X, "lower_80": X, "upper_80": X, "lower_95": X, "upper_95": X }],
  "trend": "increasing|decreasing|stable",
  "seasonality": { "detected": bool, "pattern": "monthly|quarterly|yearly" },
  "scenarios": { "optimistic": X, "base": X, "pessimistic": X },
  "insights": ["..."]
}`;

  // ... Gemini API call ...
});
```

---

## 4.2 Analyse Sentiment Clients (4.2)
**Effort**: Moyen | **Cout credits**: 2

### Nouveau: `supabase/functions/ai-sentiment/index.ts`
```typescript
const CREDIT_COST = 2;

serve(async (req) => {
  const { userId, clientId, texts } = await req.json();

  // Collecter notes, emails, commentaires du client
  const { data: communications } = await supabase
    .from('client_communications')
    .select('content, type, created_at')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(50);

  const prompt = `Analyse le sentiment de ces communications client:
${JSON.stringify(communications)}

Reponds en JSON:
{
  "overall_sentiment": "positive|neutral|negative",
  "score": -1 to 1,
  "trends": [{ "period": "YYYY-MM", "sentiment": X }],
  "key_topics": ["satisfaction", "prix", "delais", ...],
  "risk_indicators": ["..."],
  "recommendations": ["..."]
}`;
});
```

### Nouveau hook: `src/hooks/useClientSentiment.js`

---

## 4.3 Scoring Credit Clients (4.3)
**Effort**: Moyen | **Cout credits**: 2

### Nouveau: `supabase/functions/ai-credit-scoring/index.ts`
```typescript
const CREDIT_COST = 2;

serve(async (req) => {
  const { userId, clientId } = await req.json();

  // Collecter historique paiements
  const paymentHistory = await getClientPaymentHistory(supabase, clientId);

  const prompt = `Calcule un score de credit pour ce client:

HISTORIQUE PAIEMENTS:
${JSON.stringify(paymentHistory)}

Criteres d'evaluation:
- Ponctualite des paiements (DSO)
- Montants moyens vs payes
- Tendance sur 12 mois
- Incidents de paiement

Reponds en JSON:
{
  "score": 0-100,
  "rating": "A|B|C|D|E",
  "risk_level": "low|medium|high|critical",
  "dso_average": X,
  "payment_reliability": 0-100,
  "trend": "improving|stable|declining",
  "recommended_credit_limit": X,
  "warnings": ["..."]
}`;
});
```

---

## 4.4 Optimisation Fiscale IA (4.4)
**Effort**: Eleve | **Cout credits**: 5

### Nouveau: `supabase/functions/ai-tax-optimization/index.ts`
```typescript
const CREDIT_COST = 5;

serve(async (req) => {
  const { userId, fiscalYear, jurisdiction } = await req.json();

  // Collecter toutes les donnees financieres
  const financialData = await getComprehensiveFinancialData(supabase, userId, fiscalYear);

  const prompt = `Tu es un expert-comptable specialise en optimisation fiscale ${jurisdiction}.

DONNEES FINANCIERES:
${JSON.stringify(financialData)}

Analyse et propose des optimisations fiscales legales:
1. Deductions non utilisees
2. Credits d'impot applicables
3. Timing optimal des depenses
4. Structures fiscales avantageuses
5. Provisions deductibles

Reponds en JSON:
{
  "current_tax_liability": X,
  "optimized_tax_liability": X,
  "potential_savings": X,
  "recommendations": [
    { "type": "deduction|credit|timing|structure", "description": "...", "impact": X, "complexity": "low|medium|high", "deadline": "YYYY-MM-DD" }
  ],
  "warnings": ["..."],
  "disclaimer": "..."
}`;
});
```

---

## 4.5 Detection Fraude Avancee (4.5)
**Effort**: Moyen | **Cout credits**: 4

### Nouveau: `supabase/functions/ai-fraud-detection/index.ts`
```typescript
const CREDIT_COST = 4;

serve(async (req) => {
  const { userId, analysisScope } = await req.json();

  // Collecter transactions suspectes
  const transactions = await getTransactionsForAnalysis(supabase, userId, analysisScope);

  const prompt = `Analyse ces transactions pour detecter des fraudes potentielles:
${JSON.stringify(transactions)}

Patterns a detecter:
- Factures doublons ou similaires
- Montants anormaux (outliers)
- Fournisseurs fantomes
- Manipulation de dates
- Splitting de factures
- Circuits de paiement suspects

Reponds en JSON:
{
  "risk_score": 0-100,
  "alerts": [
    { "type": "duplicate|outlier|phantom|date_manipulation|splitting|circuit", "severity": "low|medium|high|critical", "transactions": [...], "description": "...", "evidence": "..." }
  ],
  "patterns_detected": ["..."],
  "recommendations": ["..."]
}`;
});
```

---

# SPRINT 5 : FONCTIONNALITES DIFFERENCIANTES

## 5.1 Application Mobile Native React Native (2.1)
**Effort**: Eleve | **Impact**: Accessibilite terrain

### Structure du projet
```
cashpilot-mobile/
├── src/
│   ├── screens/
│   │   ├── Dashboard.tsx
│   │   ├── Invoices.tsx
│   │   ├── Expenses.tsx
│   │   └── Settings.tsx
│   ├── components/
│   ├── hooks/
│   │   └── useSupabase.ts (reutiliser patterns web)
│   ├── navigation/
│   └── services/
├── app.json
└── package.json
```

### Technologies
- React Native + Expo
- @supabase/supabase-js (meme backend)
- React Navigation
- AsyncStorage pour offline

---

## 5.2 Reconnaissance Vocale Saisie Depenses (2.2)
**Effort**: Moyen | **Impact**: Innovation UX

### Nouveau composant: `src/components/VoiceExpenseInput.jsx`
```javascript
import { useState, useEffect } from 'react';

export const VoiceExpenseInput = ({ onExpenseDetected }) => {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');

  const startListening = () => {
    const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
    recognition.lang = 'fr-FR';
    recognition.continuous = false;

    recognition.onresult = async (event) => {
      const text = event.results[0][0].transcript;
      setTranscript(text);

      // Envoyer a l'IA pour extraction
      const expense = await parseVoiceToExpense(text);
      onExpenseDetected(expense);
    };

    recognition.start();
    setIsListening(true);
  };

  return (
    <button onClick={startListening}>
      {isListening ? <MicOff /> : <Mic />}
    </button>
  );
};
```

### Edge function pour parsing: `supabase/functions/ai-voice-expense/index.ts`

---

## 5.3 Smart Contracts Paiements Automatiques (2.3)
**Effort**: Eleve | **Impact**: Blockchain/DeFi

### Approche: Stripe + Webhooks (Alternative pragmatique)
```javascript
// src/services/smartPaymentService.js
export const createAutomaticPaymentRule = async (rule) => {
  // Regles de paiement automatique
  // Condition: facture echue > X jours
  // Action: prelever via Stripe

  const { data } = await supabase.from('payment_automation_rules').insert({
    user_id: user.id,
    trigger_condition: rule.condition,
    action_type: 'stripe_charge',
    payment_method_id: rule.paymentMethodId,
    max_amount: rule.maxAmount,
    is_active: true,
  });

  return data;
};
```

---

## 5.4 Tableau de Bord Personnalisable (2.4)
**Effort**: Moyen | **Impact**: UX premium

### Nouveau composant: `src/components/DashboardBuilder.jsx`
```javascript
import { Responsive, WidthProvider } from 'react-grid-layout';

const ResponsiveGridLayout = WidthProvider(Responsive);

const AVAILABLE_WIDGETS = [
  { id: 'revenue', title: 'Chiffre d\'affaires', component: RevenueWidget },
  { id: 'expenses', title: 'Depenses', component: ExpensesWidget },
  { id: 'cashflow', title: 'Tresorerie', component: CashFlowWidget },
  { id: 'invoices', title: 'Factures recentes', component: InvoicesWidget },
  { id: 'anomalies', title: 'Alertes', component: AnomaliesWidget },
];

export const DashboardBuilder = () => {
  const [layout, setLayout] = useState(loadLayout());
  const [activeWidgets, setActiveWidgets] = useState(loadActiveWidgets());

  return (
    <ResponsiveGridLayout
      layouts={{ lg: layout }}
      onLayoutChange={saveLayout}
      draggableHandle=".widget-handle"
    >
      {activeWidgets.map(widget => (
        <div key={widget.id}>
          <WidgetWrapper widget={widget} />
        </div>
      ))}
    </ResponsiveGridLayout>
  );
};
```

### Dependance: `npm install react-grid-layout`

---

## 5.5 Mode Collaboratif Temps Reel (2.5)
**Effort**: Eleve | **Impact**: Equipes

### Utiliser Supabase Realtime (deja configure)
```javascript
// src/hooks/useRealtimeCollaboration.js
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export const useRealtimeCollaboration = (documentType, documentId) => {
  const [collaborators, setCollaborators] = useState([]);
  const [cursors, setCursors] = useState({});

  useEffect(() => {
    const channel = supabase.channel(`collab:${documentType}:${documentId}`)
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        setCollaborators(Object.values(state).flat());
      })
      .on('broadcast', { event: 'cursor' }, ({ payload }) => {
        setCursors(prev => ({ ...prev, [payload.userId]: payload.position }));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ user: currentUser });
        }
      });

    return () => channel.unsubscribe();
  }, [documentType, documentId]);

  const broadcastCursor = (position) => {
    channel.send({ type: 'broadcast', event: 'cursor', payload: { userId, position }});
  };

  return { collaborators, cursors, broadcastCursor };
};
```

---

# SPRINT 6 : MARCHE & INTEGRATIONS

## 6.1 Connexion POS/Caisses (3.6)
**Effort**: Moyen | **Impact**: Retail physique

### Nouveau: `supabase/functions/pos-integration/index.ts`
```typescript
// Integration avec Square, SumUp, Zettle
serve(async (req) => {
  const { userId, posProvider, action, data } = await req.json();

  switch (posProvider) {
    case 'square':
      return handleSquareWebhook(data);
    case 'sumup':
      return handleSumUpWebhook(data);
    case 'zettle':
      return handleZettleWebhook(data);
  }
});
```

### Migration DB
```sql
CREATE TABLE pos_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  provider VARCHAR(50) NOT NULL,
  credentials_encrypted BYTEA,
  location_id VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  last_sync_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE pos_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  pos_connection_id UUID REFERENCES pos_connections(id),
  external_id VARCHAR(100),
  amount DECIMAL(15,2),
  currency VARCHAR(3),
  payment_method VARCHAR(50),
  transaction_date TIMESTAMP WITH TIME ZONE,
  synced_to_invoice_id UUID REFERENCES invoices(id)
);
```

---

## 6.2 Consolidation Comptable Groupe (6.2)
**Effort**: Eleve | **Impact**: Grands comptes

### Migration DB
```sql
CREATE TABLE company_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  parent_company_id UUID REFERENCES profiles(user_id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES company_groups(id),
  company_id UUID REFERENCES profiles(user_id),
  ownership_percentage DECIMAL(5,2),
  consolidation_method VARCHAR(20) -- 'full', 'proportional', 'equity'
);
```

### Nouveau: `src/utils/consolidationCalculations.js`
```javascript
export const consolidateFinancials = async (groupId, period) => {
  const members = await getGroupMembers(groupId);

  // Eliminations intra-groupe
  const intercompanyTransactions = await getIntercompanyTransactions(members, period);

  // Consolidation selon methode
  const consolidated = {
    assets: consolidateAssets(members, intercompanyTransactions),
    liabilities: consolidateLiabilities(members, intercompanyTransactions),
    revenue: consolidateRevenue(members, intercompanyTransactions),
    expenses: consolidateExpenses(members, intercompanyTransactions),
  };

  return consolidated;
};
```

---

## 6.3 Certifications Comptables OEC/ITAA (6.5)
**Effort**: Moyen | **Impact**: Credibilite

### Documentation a creer
- `docs/certifications/OEC-requirements.md`
- `docs/certifications/ITAA-requirements.md`
- `docs/certifications/compliance-checklist.md`

### Fonctionnalites techniques requises
1. **Export audit trail** - Deja via `audit_log`
2. **Signature numerique** - A implementer
3. **Archivage legal** - Retention 10 ans

---

## 6.4 Programme Beta Testers (6.6)
**Effort**: Faible | **Impact**: Innovation continue

### Migration DB
```sql
CREATE TABLE beta_program (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  enrolled_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  features_enabled TEXT[], -- ['ai-ml-forecast', 'collab-mode', ...]
  feedback_count INTEGER DEFAULT 0
);

CREATE TABLE beta_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  feature_id VARCHAR(50),
  rating INTEGER CHECK (rating BETWEEN 1 AND 5),
  feedback TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Nouveau hook: `src/hooks/useBetaFeatures.js`
```javascript
export const useBetaFeatures = () => {
  const [enabledFeatures, setEnabledFeatures] = useState([]);

  useEffect(() => {
    const fetchBetaStatus = async () => {
      const { data } = await supabase
        .from('beta_program')
        .select('features_enabled')
        .eq('user_id', user.id)
        .single();

      setEnabledFeatures(data?.features_enabled || []);
    };
    fetchBetaStatus();
  }, [user]);

  const isFeatureEnabled = (featureId) => enabledFeatures.includes(featureId);

  return { enabledFeatures, isFeatureEnabled };
};
```

---

# VERIFICATION & TESTS

## Par Sprint

### Sprint 1 - Performance
- [ ] `npm run build` - Chunks < 250KB
- [ ] Lighthouse Performance > 90
- [ ] VirtualizedTable render 1000+ lignes fluide
- [ ] PWA installable sur mobile

### Sprint 2 - Securite
- [ ] CSP headers valides (securityheaders.com)
- [ ] Audit log complet pour toutes operations CRUD
- [ ] Chiffrement IBAN verifie en DB

### Sprint 3 - Compliance
- [ ] FEC valide (testeur DGFiP)
- [ ] SAF-T schema valide
- [ ] Factur-X niveau BASIC valide

### Sprint 4 - IA
- [ ] Chaque fonction decompte credits correctement
- [ ] Refund sur erreur API
- [ ] Reponses JSON parsables

### Sprint 5 - Differenciantes
- [ ] Dashboard drag & drop fonctionnel
- [ ] Reconnaissance vocale sur Chrome/Safari
- [ ] Realtime collaboration 3+ users

### Sprint 6 - Marche
- [ ] Webhook POS recoit transactions
- [ ] Consolidation elimine intra-groupe

---

# RESUME DES FICHIERS A CREER

| Sprint | Fichiers | Type |
|--------|----------|------|
| 1 | - | Modifications uniquement |
| 2 | `src/lib/logger.js`, `docs/security/*` | 5 fichiers |
| 3 | `src/services/exportFEC.js`, `exportSAFT.js`, `exportFacturX.js`, `vatDeclarationService.js`, `src/config/taxJurisdictions.js` | 5 fichiers |
| 4 | `supabase/functions/ai-ml-forecast/`, `ai-sentiment/`, `ai-credit-scoring/`, `ai-tax-optimization/`, `ai-fraud-detection/` | 5 Edge Functions |
| 5 | `cashpilot-mobile/` (nouveau projet), `src/components/VoiceExpenseInput.jsx`, `DashboardBuilder.jsx`, `src/hooks/useRealtimeCollaboration.js` | 4+ fichiers |
| 6 | `supabase/functions/pos-integration/`, `src/utils/consolidationCalculations.js`, `src/hooks/useBetaFeatures.js` | 3 fichiers |

**Total**: ~25 nouveaux fichiers + modifications

---

*Plan genere le 5 fevrier 2026*
*Pour implementation des 28 fonctionnalites selectionnees*
