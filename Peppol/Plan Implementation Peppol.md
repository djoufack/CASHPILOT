# Plan d'Implémentation Peppol - CASHPILOT

**Date :** 8 février 2026
**Basé sur :** Audit de compatibilité Peppol du 08/02/2026
**Statut :** En attente d'exécution

---

## Table des matières

1. [Vue d'ensemble](#1-vue-densemble)
2. [Prérequis et état actuel](#2-prérequis-et-état-actuel)
3. [Phase 1 - Intégration UI Factur-X](#3-phase-1---intégration-ui-factur-x)
4. [Phase 2 - Base de données Peppol](#4-phase-2---base-de-données-peppol)
5. [Phase 3 - Génération UBL 2.1](#5-phase-3---génération-ubl-21)
6. [Phase 4 - PDF/XML hybride Factur-X](#6-phase-4---pdfxml-hybride-factur-x)
7. [Phase 5 - Validation et conformité](#7-phase-5---validation-et-conformité)
8. [Phase 6 - Transmission Peppol](#8-phase-6---transmission-peppol)
9. [Phase 7 - Signature électronique](#9-phase-7---signature-électronique)
10. [Phase 8 - Réception et traitement entrant](#10-phase-8---réception-et-traitement-entrant)
11. [Phase 9 - i18n et UX](#11-phase-9---i18n-et-ux)
12. [Phase 10 - Tests et certification](#12-phase-10---tests-et-certification)
13. [Dépendances techniques](#13-dépendances-techniques)
14. [Matrice de risques](#14-matrice-de-risques)
15. [Calendrier estimatif](#15-calendrier-estimatif)

---

## 1. Vue d'ensemble

### Objectif
Rendre CashPilot pleinement compatible avec le réseau Peppol pour l'envoi et la réception de factures électroniques, en conformité avec les obligations EU 2024+ et la norme EN16931.

### Périmètre
- Export Factur-X (CII) intégré à l'UI (existant mais non connecté)
- Export UBL 2.1 (à créer)
- Format hybride PDF/XML Factur-X
- Transmission via Access Point Peppol certifié
- Réception de factures Peppol entrantes
- Signature électronique qualifiée
- Validation de conformité

### Architecture cible

```
┌─────────────────────────────────────────────────────┐
│                    CASHPILOT UI                       │
│  InvoicePreview.jsx  →  Boutons Export XML/PDF/UBL   │
└──────────┬──────────────────────┬────────────────────┘
           │                      │
    ┌──────▼──────┐       ┌──────▼──────┐
    │ exportFacturX│       │ exportUBL   │
    │ .js (CII)   │       │ .js (UBL)   │
    └──────┬──────┘       └──────┬──────┘
           │                      │
    ┌──────▼──────────────────────▼──────┐
    │     peppolValidationService.js      │
    │  (Schematron / EN16931 / CIUS)      │
    └──────────────┬─────────────────────┘
                   │
    ┌──────────────▼─────────────────────┐
    │     peppolTransmissionService.js    │
    │  (SBDH + Signature + Access Point)  │
    └──────────────┬─────────────────────┘
                   │
    ┌──────────────▼─────────────────────┐
    │    Edge Function: peppol-gateway    │
    │  (Envoi/Réception via AP certifié)  │
    └────────────────────────────────────┘
```

---

## 2. Prérequis et état actuel

### Fichiers existants à exploiter

| Fichier | Rôle | Statut |
|---------|------|--------|
| `src/services/exportFacturX.js` | Génération XML CII (260 lignes) | Fonctionnel, non connecté |
| `src/components/InvoicePreview.jsx` | Preview + export PDF | À étendre |
| `src/hooks/useInvoices.js` | CRUD factures + relations | Fonctionnel |
| `src/hooks/useCompany.js` | Profil entreprise (IBAN, TVA, SIRET) | Fonctionnel |
| `src/services/exportPDF.js` | Export PDF facture | Fonctionnel |

### Schéma de données actuel

**Table `invoices`** : invoice_number, date, due_date, client_id, total_ht, tax_rate, total_ttc, status, notes, header_note, footer_note, terms_and_conditions, reference, custom_fields (JSONB)

**Table `invoice_items`** : invoice_id, description, quantity, unit_price, total

**Table `clients`** : company_name, contact_name, email, address, vat_number, preferred_currency

**Company profile** : company_name, registration_number, tax_id, address, city, postal_code, country, iban, swift, logo_url

### Manques identifiés
- Pas de champ `peppol_endpoint_id` (clients)
- Pas de table de transmission Peppol
- Pas de colonne `electronic_format` ou `peppol_status` (invoices)
- Pas de librairie UBL ou validation XML dans `package.json`

---

## 3. Phase 1 - Intégration UI Factur-X

**Priorité : HAUTE** | **Effort : 1-2 jours** | **Risque : Faible**

### Objectif
Connecter le service `exportFacturX.js` existant à l'interface utilisateur.

### Tâches

#### 1.1 Ajouter le bouton Factur-X dans InvoicePreview.jsx

**Fichier :** `src/components/InvoicePreview.jsx`

```jsx
// Ajouter l'import
import { exportFacturX, validateForFacturX } from '@/services/exportFacturX';
import { FileCode } from 'lucide-react';

// Ajouter le handler
const handleExportFacturX = async () => {
  const validation = validateForFacturX(invoice, company, client);
  if (!validation.isValid) {
    toast({ title: "Erreur", description: validation.errors.join(', '), variant: "destructive" });
    return;
  }
  const { blob, filename } = await exportFacturX(invoice, company, client, 'EN16931');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

// Ajouter le bouton à côté du bouton PDF existant
<Button onClick={handleExportFacturX} variant="outline">
  <FileCode className="w-4 h-4 mr-2" />
  {t('invoices.exportFacturX')}
</Button>
```

#### 1.2 Ajouter export Factur-X dans InvoicesPage.jsx

**Fichier :** `src/pages/InvoicesPage.jsx`

- Ajouter une option "Export Factur-X" dans le menu contextuel de chaque facture
- Permettre l'export en lot (sélection multiple → ZIP de fichiers XML)

#### 1.3 Validation visuelle

- Indicateur de conformité Factur-X sur chaque facture (icône verte/rouge)
- Tooltip listant les champs manquants pour la conformité

### Critères d'acceptation
- [ ] Bouton "Export Factur-X" visible dans InvoicePreview
- [ ] Le XML téléchargé est valide et conforme CII
- [ ] Les erreurs de validation sont affichées clairement
- [ ] L'export en lot fonctionne pour N factures sélectionnées

---

## 4. Phase 2 - Base de données Peppol

**Priorité : HAUTE** | **Effort : 1-2 jours** | **Risque : Faible**

### Objectif
Étendre le schéma Supabase pour supporter les métadonnées Peppol.

### Tâches

#### 2.1 Migration : Extension table clients

**Fichier :** `supabase/migrations/032_peppol_support.sql`

```sql
-- Ajouter les identifiants Peppol aux clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS peppol_endpoint_id TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS peppol_scheme_id TEXT DEFAULT '0009';
-- Schémas courants: 0009 (SIRET FR), 0088 (EAN), 0184 (Danish CVR),
-- 0190 (Dutch KVK), 0201 (IT Codice Fiscale), 9906 (IT Partita IVA)
ALTER TABLE clients ADD COLUMN IF NOT EXISTS electronic_invoicing_enabled BOOLEAN DEFAULT false;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS preferred_einvoice_format TEXT DEFAULT 'facturx'
  CHECK (preferred_einvoice_format IN ('facturx', 'ubl', 'cii'));

COMMENT ON COLUMN clients.peppol_endpoint_id IS 'Identifiant Peppol du destinataire (ex: SIRET pour la France)';
COMMENT ON COLUMN clients.peppol_scheme_id IS 'Schéma d identifiant Peppol (0009=SIRET, 0088=EAN, etc.)';
```

#### 2.2 Migration : Extension table invoices

```sql
-- Ajouter le statut Peppol aux factures
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS peppol_status TEXT DEFAULT 'none'
  CHECK (peppol_status IN ('none', 'pending', 'sent', 'delivered', 'accepted', 'rejected', 'error'));
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS peppol_sent_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS peppol_document_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS peppol_format TEXT
  CHECK (peppol_format IN ('facturx', 'ubl', 'cii'));
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS peppol_error_message TEXT;

COMMENT ON COLUMN invoices.peppol_status IS 'Statut de transmission Peppol';
```

#### 2.3 Migration : Table de journal de transmission

```sql
CREATE TABLE IF NOT EXISTS peppol_transmission_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  format TEXT NOT NULL CHECK (format IN ('facturx', 'ubl', 'cii')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'delivered', 'accepted', 'rejected', 'error')),
  access_point TEXT,
  document_id TEXT,
  sender_endpoint TEXT,
  receiver_endpoint TEXT,
  xml_content TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Index pour recherche rapide
CREATE INDEX idx_peppol_log_invoice ON peppol_transmission_log(invoice_id);
CREATE INDEX idx_peppol_log_user ON peppol_transmission_log(user_id);
CREATE INDEX idx_peppol_log_status ON peppol_transmission_log(status);

-- RLS
ALTER TABLE peppol_transmission_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own logs" ON peppol_transmission_log
  FOR ALL USING (auth.uid() = user_id);
```

#### 2.4 Migration : Table company Peppol

```sql
-- Extension du profil entreprise (table company_settings ou companies)
ALTER TABLE companies ADD COLUMN IF NOT EXISTS peppol_endpoint_id TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS peppol_scheme_id TEXT DEFAULT '0009';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS peppol_access_point_url TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS peppol_access_point_api_key TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS peppol_certificate TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS einvoicing_enabled BOOLEAN DEFAULT false;

COMMENT ON COLUMN companies.peppol_endpoint_id IS 'Identifiant Peppol de l entreprise (SIRET pour la France)';
```

### Critères d'acceptation
- [ ] Les migrations s'appliquent sans erreur
- [ ] Les RLS sont actifs sur la table de logs
- [ ] Les hooks existants (`useInvoices`, `useCompany`) récupèrent les nouveaux champs
- [ ] Aucune régression sur les fonctionnalités existantes

---

## 5. Phase 3 - Génération UBL 2.1

**Priorité : HAUTE** | **Effort : 3-4 jours** | **Risque : Moyen**

### Objectif
Créer un service de génération UBL 2.1 en parallèle du service CII existant.

### Tâches

#### 3.1 Créer le service UBL

**Fichier :** `src/services/exportUBL.js`

Le service doit générer du XML conforme à :
- **OASIS UBL 2.1** (ISO/IEC 19845:2015)
- **CIUS Peppol BIS Billing 3.0** (Customization ID: `urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0`)
- **Profile ID** : `urn:fdc:peppol.eu:2017:poacc:billing:01:1.0`

```
Structure XML UBL cible :
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>...</cbc:CustomizationID>
  <cbc:ProfileID>...</cbc:ProfileID>
  <cbc:ID>[invoice_number]</cbc:ID>
  <cbc:IssueDate>[YYYY-MM-DD]</cbc:IssueDate>
  <cbc:DueDate>[YYYY-MM-DD]</cbc:DueDate>
  <cbc:InvoiceTypeCode>[380]</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>[EUR]</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>...</cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>...</cac:AccountingCustomerParty>
  <cac:PaymentMeans>...</cac:PaymentMeans>
  <cac:TaxTotal>...</cac:TaxTotal>
  <cac:LegalMonetaryTotal>...</cac:LegalMonetaryTotal>
  <cac:InvoiceLine>...</cac:InvoiceLine>  <!-- Pour chaque article -->
</Invoice>
```

#### 3.2 Fonctions à implémenter

| Fonction | Description |
|----------|-------------|
| `generateUBLXml(invoice, seller, buyer, items)` | Génère le XML UBL complet |
| `generateUBLHeader(invoice)` | En-tête avec CustomizationID et ProfileID |
| `generateSupplierParty(seller)` | Bloc AccountingSupplierParty |
| `generateCustomerParty(buyer)` | Bloc AccountingCustomerParty |
| `generatePaymentMeans(seller, invoice)` | IBAN/BIC + conditions |
| `generateTaxTotal(invoice, items)` | Ventilation TVA par taux |
| `generateLegalMonetaryTotal(invoice)` | Totaux HT/TVA/TTC |
| `generateInvoiceLines(items)` | Lignes de facture individuelles |
| `exportUBL(invoice, seller, buyer, items)` | Export complet → Blob |
| `validateForUBL(invoice, seller, buyer, items)` | Validation pré-export |

#### 3.3 Différences clés CII vs UBL

| Aspect | CII (exportFacturX.js) | UBL (exportUBL.js) |
|--------|------------------------|---------------------|
| Racine | `CrossIndustryInvoice` | `Invoice` |
| Namespaces | rsm, ram, qdt, udt | cac, cbc |
| Dates | Format 102 (YYYYMMDD) | ISO 8601 (YYYY-MM-DD) |
| Lignes | IncludedSupplyChainTradeLineItem | InvoiceLine |
| Peppol | Supporté mais moins courant | Format Peppol natif |

#### 3.4 Support des lignes de facture (invoice_items)

Le service CII existant ne gère pas les lignes individuelles. Le service UBL doit les inclure car Peppol BIS Billing 3.0 les exige :

```xml
<cac:InvoiceLine>
  <cbc:ID>1</cbc:ID>
  <cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity>
  <cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount>
  <cac:Item>
    <cbc:Name>Description article</cbc:Name>
    <cac:ClassifiedTaxCategory>
      <cbc:ID>S</cbc:ID>
      <cbc:Percent>20</cbc:Percent>
      <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
    </cac:ClassifiedTaxCategory>
  </cac:Item>
  <cac:Price>
    <cbc:PriceAmount currencyID="EUR">100.00</cbc:PriceAmount>
  </cac:Price>
</cac:InvoiceLine>
```

### Critères d'acceptation
- [ ] Le XML généré est conforme UBL 2.1
- [ ] Le CustomizationID et ProfileID Peppol sont corrects
- [ ] Les lignes de facture (invoice_items) sont incluses
- [ ] Les montants correspondent aux totaux de la facture
- [ ] La ventilation TVA multi-taux fonctionne
- [ ] La validation attrape les champs obligatoires manquants

---

## 6. Phase 4 - PDF/XML hybride Factur-X

**Priorité : MOYENNE** | **Effort : 2-3 jours** | **Risque : Moyen**

### Objectif
Générer un PDF contenant le XML Factur-X embarqué (norme PDF/A-3).

### Tâches

#### 4.1 Dépendances à ajouter

```bash
npm install pdf-lib            # Manipulation PDF côté client
```

`pdf-lib` permet d'ajouter des pièces jointes à un PDF existant, ce qui est nécessaire pour créer un PDF/A-3 avec XML embarqué.

#### 4.2 Créer le service hybride

**Fichier :** `src/services/exportFacturXHybrid.js`

```
Flux de traitement :
1. Générer le PDF de la facture (via exportPDF existant)
2. Générer le XML Factur-X (via exportFacturX existant)
3. Embarquer le XML dans le PDF comme pièce jointe
4. Ajouter les métadonnées XMP requises (Factur-X conformance level)
5. Retourner le PDF hybride
```

#### 4.3 Métadonnées XMP requises

Le PDF doit contenir un bloc XMP avec :
- `fx:ConformanceLevel` : BASIC, EN16931, etc.
- `fx:DocumentFileName` : `factur-x.xml`
- `fx:DocumentType` : `INVOICE`
- `fx:Version` : `1.0`

#### 4.4 Intégration UI

- Modifier le bouton "Export PDF" pour proposer "PDF simple" ou "PDF Factur-X"
- Option par défaut configurable dans les paramètres entreprise

### Critères d'acceptation
- [ ] Le PDF hybride contient le XML en pièce jointe
- [ ] Le XML embarqué est identique au XML standalone
- [ ] Les métadonnées XMP sont correctes
- [ ] Le PDF reste lisible par tous les lecteurs PDF standard
- [ ] Le XML peut être extrait par les outils Factur-X

---

## 7. Phase 5 - Validation et conformité

**Priorité : HAUTE** | **Effort : 3-4 jours** | **Risque : Moyen**

### Objectif
Valider les documents générés contre les règles Peppol/EN16931 avant envoi.

### Tâches

#### 5.1 Créer le service de validation

**Fichier :** `src/services/peppolValidationService.js`

Niveaux de validation :

```
Niveau 1 : Syntaxique (XML bien formé)
Niveau 2 : Schéma (conforme XSD UBL 2.1 ou CII)
Niveau 3 : Sémantique (règles EN16931)
Niveau 4 : CIUS (règles spécifiques Peppol BIS 3.0)
Niveau 5 : Règles métier (cohérence montants, TVA, dates)
```

#### 5.2 Règles de validation à implémenter

| Règle | ID | Description |
|-------|----|-------------|
| Numéro facture | BR-01 | Le numéro de facture est obligatoire |
| Date émission | BR-02 | La date d'émission est obligatoire |
| Type document | BR-04 | Le code type document est valide (380, 381...) |
| Devise | BR-05 | Le code devise est ISO 4217 |
| Vendeur | BR-06 | Le nom du vendeur est obligatoire |
| Acheteur | BR-07 | Le nom de l'acheteur est obligatoire |
| TVA vendeur | BR-CO-09 | Si TVA applicable, numéro TVA vendeur requis |
| Total lignes | BR-12 | Somme des lignes = Total HT |
| Total TVA | BR-CO-14 | Somme TVA par taux = Total TVA |
| Total TTC | BR-15 | Total HT + Total TVA = Total TTC |
| Au moins 1 ligne | BR-16 | Au moins une ligne de facture |
| ID Peppol | PEPPOL-EN16931-R001 | CustomizationID présent |

#### 5.3 Edge Function de validation

**Fichier :** `supabase/functions/peppol-validate/index.ts`

- Endpoint POST acceptant du XML (UBL ou CII)
- Retourne un rapport de validation structuré
- Utilisable avant envoi pour vérification
- Log des résultats dans `peppol_transmission_log`

### Critères d'acceptation
- [ ] Les 5 niveaux de validation sont implémentés
- [ ] Les règles BR-01 à BR-16 (EN16931) sont couvertes
- [ ] Le rapport de validation est clair et actionnable
- [ ] Les factures non conformes sont bloquées avant envoi

---

## 8. Phase 6 - Transmission Peppol

**Priorité : CRITIQUE** | **Effort : 5-7 jours** | **Risque : Élevé**

### Objectif
Permettre l'envoi de factures via le réseau Peppol.

### Choix de l'Access Point

CashPilot étant une application SaaS, deux options :

#### Option A : Intégration fournisseur SaaS (RECOMMANDÉE)

Intégrer un Access Point certifié via API REST :

| Fournisseur | API | Couverture | Tarif indicatif |
|-------------|-----|------------|-----------------|
| **Chorus Pro** (FR) | API REST gratuite | France B2G | Gratuit |
| **Pagero** | REST API | Mondial | Par document |
| **Basware** | REST API | Europe | Par document |
| **Storecove** | REST API | Mondial | Par document |
| **OpenPeppol Test AP** | AS4 | Test uniquement | Gratuit |

#### Option B : Access Point propre (NON RECOMMANDÉE pour le MVP)

Nécessite la certification Peppol Authority, un serveur AS4, et une maintenance continue.

### Tâches

#### 6.1 Créer le service de transmission

**Fichier :** `src/services/peppolTransmissionService.js`

```javascript
// Interface du service
export const peppolTransmissionService = {
  // Envoyer une facture via Peppol
  async sendInvoice(invoiceId, format = 'ubl') { ... },

  // Vérifier le statut d'une transmission
  async checkStatus(transmissionId) { ... },

  // Lister l'historique des transmissions
  async getTransmissionHistory(invoiceId) { ... },

  // Tester la connectivité avec l'Access Point
  async testConnection() { ... }
};
```

#### 6.2 Générer l'enveloppe SBDH

**Fichier :** `src/services/peppolSBDHService.js`

Le Standard Business Document Header est requis pour toute transmission Peppol :

```xml
<StandardBusinessDocument xmlns="http://www.unece.org/cefact/namespaces/StandardBusinessDocumentHeader">
  <StandardBusinessDocumentHeader HeaderVersion="1.0">
    <Sender>
      <Identifier Authority="iso6523-actorid-upis">0009:SIRET_VENDEUR</Identifier>
    </Sender>
    <Receiver>
      <Identifier Authority="iso6523-actorid-upis">0009:SIRET_ACHETEUR</Identifier>
    </Receiver>
    <DocumentIdentification>
      <Standard>urn:oasis:names:specification:ubl:schema:xsd:Invoice-2</Standard>
      <TypeVersion>2.1</TypeVersion>
      <InstanceIdentifier>[UUID]</InstanceIdentifier>
      <Type>Invoice</Type>
      <CreationDateAndTime>[ISO datetime]</CreationDateAndTime>
    </DocumentIdentification>
    <BusinessScope>
      <Scope>
        <Type>DOCUMENTID</Type>
        <InstanceIdentifier>urn:oasis:names:specification:ubl:schema:xsd:Invoice-2::Invoice##urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0::2.1</InstanceIdentifier>
      </Scope>
      <Scope>
        <Type>PROCESSID</Type>
        <InstanceIdentifier>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</InstanceIdentifier>
      </Scope>
    </BusinessScope>
  </StandardBusinessDocumentHeader>
  <!-- Contenu UBL/CII ici -->
</StandardBusinessDocument>
```

#### 6.3 Edge Function : Peppol Gateway

**Fichier :** `supabase/functions/peppol-gateway/index.ts`

```
Flux sortant (envoi) :
1. Recevoir invoice_id + format
2. Charger les données facture, vendeur, acheteur
3. Générer le XML (UBL ou CII)
4. Valider (Phase 5)
5. Générer SBDH
6. Signer (Phase 7)
7. Envoyer à l'Access Point via API
8. Logger dans peppol_transmission_log
9. Mettre à jour invoices.peppol_status
10. Retourner le statut

Flux entrant (réception) :
1. Webhook depuis l'Access Point
2. Parser le SBDH
3. Extraire le XML facture
4. Valider la conformité
5. Créer l'entrée dans supplier_invoices ou invoices
6. Logger dans peppol_transmission_log
7. Notifier l'utilisateur
```

#### 6.4 Gestion des statuts et retry

```
Flux de statuts :
none → pending → sent → delivered → accepted
                    ↘ error (retry automatique 3x)
                         ↘ rejected (notification utilisateur)
```

- Retry automatique : 3 tentatives avec backoff exponentiel (1min, 5min, 30min)
- Notification par email en cas d'échec définitif
- Dashboard de suivi des transmissions

### Critères d'acceptation
- [ ] L'envoi via Access Point fonctionne en environnement de test
- [ ] L'enveloppe SBDH est conforme
- [ ] Les statuts de transmission sont suivis en temps réel
- [ ] Le retry automatique fonctionne
- [ ] Les erreurs sont loggées et l'utilisateur notifié

---

## 9. Phase 7 - Signature électronique

**Priorité : HAUTE** | **Effort : 3-4 jours** | **Risque : Élevé**

### Objectif
Signer les documents XML avant transmission selon les exigences Peppol.

### Tâches

#### 7.1 Choix de la solution de signature

| Option | Avantage | Inconvénient |
|--------|----------|--------------|
| **XAdES-BES via Edge Function** | Contrôle total | Complexe à implémenter |
| **Service tiers (DocuSign, Yousign)** | Simple, certifié eIDAS | Coût par signature |
| **Signature via Access Point** | Transparent | Dépendant du fournisseur |

**Recommandation :** Déléguer la signature à l'Access Point (Option C) pour le MVP, puis implémenter XAdES-BES en Phase 2 si nécessaire.

#### 7.2 Si signature côté serveur

**Fichier :** `supabase/functions/peppol-sign/index.ts`

- Utiliser un certificat X.509 stocké de manière sécurisée (Vault Supabase)
- Générer une signature XAdES-BES enveloppée
- Intégrer dans le flux de transmission (Phase 6)

#### 7.3 Gestion des certificats

- Stockage sécurisé via Supabase Vault (secrets)
- Rotation automatique avant expiration
- Alertes 30 jours avant expiration

### Critères d'acceptation
- [ ] Les documents transmis sont signés
- [ ] La signature est vérifiable par le destinataire
- [ ] Les certificats sont stockés de manière sécurisée
- [ ] L'expiration des certificats est surveillée

---

## 10. Phase 8 - Réception et traitement entrant

**Priorité : MOYENNE** | **Effort : 3-4 jours** | **Risque : Moyen**

### Objectif
Recevoir et traiter les factures entrantes via Peppol.

### Tâches

#### 8.1 Webhook de réception

**Fichier :** `supabase/functions/peppol-webhook/index.ts`

```
Flux de réception :
1. L'Access Point appelle le webhook avec le document
2. Vérifier l'authenticité (signature, certificat AP)
3. Parser le SBDH pour extraire les métadonnées
4. Parser le XML facture (UBL ou CII)
5. Mapper vers le modèle de données CashPilot
6. Créer l'entrée dans la table invoices (type=supplier)
7. Logger la réception
8. Envoyer une notification à l'utilisateur
9. Retourner l'accusé de réception à l'AP
```

#### 8.2 Parser UBL et CII entrants

**Fichier :** `src/services/peppolInboundParser.js`

- Détecter automatiquement le format (UBL ou CII via namespace)
- Extraire les champs vers le modèle CashPilot
- Gérer les pièces jointes éventuelles

#### 8.3 Rapprochement automatique

- Si le fournisseur est connu (par son Peppol Endpoint ID) → liaison automatique
- Si inconnu → création fournisseur proposée
- Rapprochement avec les bons de commande existants si applicable

### Critères d'acceptation
- [ ] Les factures UBL et CII entrantes sont correctement parsées
- [ ] Le fournisseur est automatiquement identifié quand possible
- [ ] L'utilisateur est notifié des nouvelles factures reçues
- [ ] L'accusé de réception est envoyé à l'Access Point

---

## 11. Phase 9 - i18n et UX

**Priorité : MOYENNE** | **Effort : 1-2 jours** | **Risque : Faible**

### Tâches

#### 9.1 Clés de traduction à ajouter

**Fichiers :** `src/i18n/locales/fr.json` et `src/i18n/locales/en.json`

```json
{
  "peppol": {
    "title": "Facturation électronique",
    "exportFacturX": "Export Factur-X (XML)",
    "exportUBL": "Export UBL Peppol",
    "exportHybridPDF": "PDF Factur-X (hybride)",
    "sendViaPeppol": "Envoyer via Peppol",
    "peppolStatus": "Statut Peppol",
    "transmissionHistory": "Historique des transmissions",
    "peppolEndpointId": "Identifiant Peppol",
    "peppolScheme": "Schéma d'identification",
    "validationReport": "Rapport de validation",
    "status": {
      "none": "Non envoyé",
      "pending": "En attente",
      "sent": "Envoyé",
      "delivered": "Livré",
      "accepted": "Accepté",
      "rejected": "Rejeté",
      "error": "Erreur"
    },
    "validation": {
      "valid": "Document conforme",
      "invalid": "Document non conforme",
      "missingFields": "Champs manquants",
      "errors": "Erreurs de validation"
    },
    "settings": {
      "enablePeppol": "Activer Peppol",
      "accessPoint": "Point d'accès Peppol",
      "certificate": "Certificat de signature",
      "defaultFormat": "Format par défaut"
    }
  }
}
```

#### 9.2 Composants UI à créer

| Composant | Description |
|-----------|-------------|
| `PeppolStatusBadge.jsx` | Badge coloré affichant le statut Peppol |
| `PeppolTransmissionLog.jsx` | Historique des envois/réceptions |
| `PeppolSettings.jsx` | Configuration (AP, certificat, endpoint) |
| `PeppolValidationReport.jsx` | Affichage du rapport de validation |
| `PeppolExportMenu.jsx` | Menu dropdown avec les options d'export |

#### 9.3 Intégration dans les paramètres

**Fichier :** `src/pages/SettingsPage.jsx`

- Nouvel onglet "Facturation électronique / Peppol"
- Configuration de l'Access Point
- Saisie de l'identifiant Peppol de l'entreprise
- Upload du certificat de signature
- Activation/désactivation par client

### Critères d'acceptation
- [ ] Toutes les chaînes sont traduites FR + EN
- [ ] Le badge de statut est visible sur chaque facture
- [ ] Les paramètres Peppol sont accessibles et fonctionnels
- [ ] L'UX est cohérente avec le reste de l'application

---

## 12. Phase 10 - Tests et certification

**Priorité : HAUTE** | **Effort : 3-5 jours** | **Risque : Moyen**

### Tâches

#### 10.1 Tests unitaires

**Fichiers :** `src/services/__tests__/`

| Test | Description |
|------|-------------|
| `exportFacturX.test.js` | Validation XML CII généré |
| `exportUBL.test.js` | Validation XML UBL généré |
| `peppolValidation.test.js` | Règles BR-01 à BR-16 |
| `peppolSBDH.test.js` | Enveloppe SBDH conforme |
| `peppolTransmission.test.js` | Flux envoi/réception |

#### 10.2 Tests d'intégration

- Envoi de facture test vers l'AP de test Peppol
- Réception de facture test depuis l'AP de test
- Validation croisée : générer en UBL, valider, envoyer, recevoir

#### 10.3 Validation externe

| Outil | Usage | URL |
|-------|-------|-----|
| **Peppol Testbed** | Test transmission bout-en-bout | testbed.peppol.org |
| **KoSIT Validator** | Validation XRechnung/EN16931 | github.com/itplr-kosit/validator |
| **Ecosio Validator** | Validation UBL/CII en ligne | ecosio.com/en/peppol-and-xml-document-validator |
| **Chorus Pro Qualif** | Test Chorus Pro France | chorus-pro.gouv.fr |

#### 10.4 Scénarios de test obligatoires

| # | Scénario | Format |
|---|----------|--------|
| T1 | Facture simple 1 ligne, TVA 20% | UBL + CII |
| T2 | Facture multi-lignes, TVA mixte (20% + 5.5%) | UBL + CII |
| T3 | Avoir (credit note) | UBL + CII |
| T4 | Facture en devise étrangère (USD) | UBL |
| T5 | Facture avec remise | UBL + CII |
| T6 | Facture avec frais de port | UBL + CII |
| T7 | Facture récurrente auto-générée | UBL |
| T8 | Réception facture entrante UBL | Parse |
| T9 | Réception facture entrante CII | Parse |
| T10 | Transmission échouée + retry | Transmission |

### Critères d'acceptation
- [ ] Couverture de tests > 80% sur les services Peppol
- [ ] Les 10 scénarios de test passent
- [ ] Validation réussie sur au moins 2 validateurs externes
- [ ] Test de transmission bout-en-bout sur le Testbed Peppol

---

## 13. Dépendances techniques

### Packages NPM à ajouter

```json
{
  "pdf-lib": "^1.17.1"
}
```

Note : Les services XML sont générés en string template (comme `exportFacturX.js` existant), pas de dépendance XML lourde nécessaire côté client.

### Services externes requis

| Service | Usage | Obligatoire |
|---------|-------|-------------|
| Access Point Peppol certifié | Transmission réseau | Oui (Phase 6) |
| Chorus Pro API (France) | B2G France | Si clients publics FR |
| Service de signature (ou certificat) | Signature QES | Oui (Phase 7) |
| Peppol Testbed | Tests | Oui (Phase 10) |

### Secrets Supabase à configurer

| Secret | Usage |
|--------|-------|
| `PEPPOL_AP_URL` | URL de l'API Access Point |
| `PEPPOL_AP_API_KEY` | Clé API Access Point |
| `PEPPOL_SIGNING_CERT` | Certificat X.509 (PEM) |
| `PEPPOL_SIGNING_KEY` | Clé privée (PEM) |

---

## 14. Matrice de risques

| Risque | Impact | Probabilité | Mitigation |
|--------|--------|-------------|------------|
| XML non conforme aux validateurs | Élevé | Moyen | Validation automatique Phase 5 avant envoi |
| Access Point indisponible | Élevé | Faible | Retry + file d'attente + AP de secours |
| Certificat expiré | Élevé | Moyen | Monitoring + alertes 30j avant |
| Changement norme Peppol | Moyen | Faible | Veille réglementaire, architecture modulaire |
| Performance XML (grosses factures) | Faible | Faible | Génération côté Edge Function si nécessaire |
| Rejet par le destinataire | Moyen | Moyen | Rapport d'erreur détaillé + correction guidée |
| Coût Access Point élevé | Moyen | Moyen | Comparatif fournisseurs, tarifs dégressifs |

---

## 15. Calendrier estimatif

```
Semaine 1 ──────────────────────────────────
  Phase 1 : Intégration UI Factur-X          [██████████] 2j
  Phase 2 : Base de données Peppol           [██████████] 2j

Semaine 2 ──────────────────────────────────
  Phase 3 : Génération UBL 2.1              [██████████████████] 4j

Semaine 3 ──────────────────────────────────
  Phase 4 : PDF/XML hybride                 [██████████████] 3j
  Phase 5 : Validation (début)              [██████] 1j

Semaine 4 ──────────────────────────────────
  Phase 5 : Validation (fin)                [██████████████] 3j
  Phase 9 : i18n et UX                      [██████] 1j

Semaine 5-6 ─────────────────────────────────
  Phase 6 : Transmission Peppol             [██████████████████████████] 6j
  Phase 7 : Signature électronique          [██████████] 2j

Semaine 7 ──────────────────────────────────
  Phase 8 : Réception entrante              [██████████████████] 4j

Semaine 8 ──────────────────────────────────
  Phase 10 : Tests et certification          [██████████████████████] 5j

Total estimé : 6-8 semaines
```

### Jalons clés

| Jalon | Phase | Livrable |
|-------|-------|----------|
| **M1** - Export XML fonctionnel | 1+3 | Boutons export CII + UBL dans l'UI |
| **M2** - Validation conforme | 5 | Validation EN16931 automatique |
| **M3** - Transmission opérationnelle | 6+7 | Envoi via Access Point avec signature |
| **M4** - Cycle complet | 8 | Envoi + réception + traitement |
| **M5** - Certifié | 10 | Validation Testbed Peppol réussie |

---

## Annexe : Références normatives

| Norme | Description | Lien |
|-------|-------------|------|
| EN16931 | Norme européenne facturation électronique | ec.europa.eu |
| Peppol BIS Billing 3.0 | Spécification Peppol factures | docs.peppol.eu |
| UBL 2.1 | OASIS Universal Business Language | docs.oasis-open.org |
| CII D16B | UN/CEFACT Cross Industry Invoice | unece.org |
| Factur-X 1.0 | Profil franco-allemand ZUGFeRD | fnfe-mpe.org |
| XRechnung | CIUS allemand pour B2G | xeinkauf.de |
| eIDAS | Règlement signatures électroniques EU | ec.europa.eu |
