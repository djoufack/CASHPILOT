# Design : Peppol BIS Billing 3.0 — Factures belges

**Date :** 27 février 2026
**Statut :** Approuvé
**Périmètre :** Cycle complet (génération UBL + validation + transmission via AP SaaS)
**Cible :** B2B + B2G (Mercurius) — Belgique

---

## 1. Contexte

La Belgique rend obligatoire la facturation électronique B2B via Peppol à partir du 1er janvier 2026. Les factures B2G transitent déjà par la plateforme Mercurius. CashPilot doit pouvoir :

1. Générer des factures UBL 2.1 conformes Peppol BIS Billing 3.0
2. Les transmettre via un Access Point SaaS certifié
3. Recevoir les accusés de réception et mises à jour de statut
4. Recevoir des factures entrantes via Peppol

### Spécificités belges

- **Pas de CIUS national** : Peppol BIS 3.0 suffit, pas de surcouche belge
- **Schéma identifiant** : `0208` (numéro d'entreprise BCE/KBO)
- **Format** : Peppol BIS en UBL (format par défaut), CII accepté avec accord mutuel
- **B2G** : Plateforme Mercurius, accessible via les AP Peppol certifiés
- **Grace period** : 3 mois début 2026 pour la mise en conformité

### État actuel CashPilot

| Composant | Statut |
|-----------|--------|
| `exportFacturX.js` — XML CII/EN16931 | Implémenté, non connecté à l'UI |
| Modèle de données factures complet | Implémenté |
| MCP tool `export_facturx` | Implémenté |
| Génération UBL 2.1 | Manquant |
| Identifiants Peppol en DB | Manquant |
| Transmission réseau Peppol | Manquant |

---

## 2. Architecture

```
┌──────────────────────────────────────────────────────┐
│                   CASHPILOT UI                        │
│  InvoicePreview → Boutons: PDF | Factur-X | Peppol   │
│  PeppolSettings → Config AP + Endpoint entreprise    │
│  PeppolStatusBadge → Statut par facture              │
│  Client form → Champ Peppol Endpoint (BCE/KBO)       │
└───────────┬──────────────────────┬───────────────────┘
            │                      │
     ┌──────▼──────┐       ┌──────▼──────┐
     │ exportUBL.js│       │exportFacturX│
     │ (UBL 2.1)  │       │.js (CII)    │
     └──────┬──────┘       └─────────────┘
            │
     ┌──────▼───────────────────────────┐
     │  peppolAPService.js (abstrait)   │
     │  ├── storecoveAdapter.js         │
     │  └── (futurs adapters)           │
     └──────┬───────────────────────────┘
            │
     ┌──────▼───────────────────────────┐
     │  Edge Function: peppol-send      │
     │  1. Charge données facture       │
     │  2. Génère UBL 2.1               │
     │  3. Valide (EN16931 métier)      │
     │  4. Appelle AP SaaS via API      │
     │  5. Log transmission             │
     └──────┬───────────────────────────┘
            │
     ┌──────▼───────────────────────────┐
     │  Edge Function: peppol-webhook   │
     │  1. Reçoit callbacks AP          │
     │  2. Met à jour statuts           │
     │  3. Parse factures entrantes     │
     └─────────────────────────────────┘
            │
     ┌──────▼───────────────────────────┐
     │  Access Point SaaS (Storecove)   │
     │  → SBDH, Signature qualifiée     │
     │  → Réseau Peppol + Mercurius     │
     └─────────────────────────────────┘
```

### Principe de séparation des responsabilités

| Responsabilité | CashPilot | Access Point SaaS |
|---------------|-----------|-------------------|
| Génération UBL 2.1 | ✓ | |
| Validation métier (montants, champs) | ✓ | |
| Enveloppe SBDH | | ✓ |
| Signature électronique qualifiée | | ✓ |
| Routage réseau Peppol | | ✓ |
| Mercurius (B2G belge) | | ✓ |
| Suivi statuts (via webhook) | ✓ | ✓ |

---

## 3. Service de génération UBL 2.1

### Fichier : `src/services/exportUBL.js`

#### Identifiants Peppol

```
CustomizationID: urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0
ProfileID: urn:fdc:peppol.eu:2017:poacc:billing:01:1.0
```

#### Structure XML UBL cible

```xml
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>{invoice_number}</cbc:ID>
  <cbc:IssueDate>{YYYY-MM-DD}</cbc:IssueDate>
  <cbc:DueDate>{YYYY-MM-DD}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cbc:BuyerReference>{reference ou invoice_number}</cbc:BuyerReference>

  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:EndpointID schemeID="0208">{BCE vendeur}</cbc:EndpointID>
      <cac:PartyName><cbc:Name>{company_name}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>{address}</cbc:StreetName>
        <cbc:CityName>{city}</cbc:CityName>
        <cbc:PostalZone>{postal_code}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>BE</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>{vat_number}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>{company_name}</cbc:RegistrationName>
        <cbc:CompanyID schemeID="0208">{BCE}</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>

  <cac:AccountingCustomerParty>
    <!-- Structure similaire avec données acheteur -->
  </cac:AccountingCustomerParty>

  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
    <cac:PayeeFinancialAccount>
      <cbc:ID>{IBAN}</cbc:ID>
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>

  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">{total_vat}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="EUR">{total_ht}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="EUR">{vat_amount}</cbc:TaxAmount>
      <cac:TaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>{taux}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>

  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">{total_ht}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">{total_ht}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">{total_ttc}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">{total_ttc}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>

  <!-- Pour chaque invoice_item -->
  <cac:InvoiceLine>
    <cbc:ID>{index}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">{quantity}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">{line_total}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>{description}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>{tax_rate}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="EUR">{unit_price}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>
</Invoice>
```

#### Types de documents supportés

| Type | Code | UBL Root Element |
|------|------|-----------------|
| Facture | 380 | `<Invoice>` |
| Avoir (credit note) | 381 | `<CreditNote>` |

#### Fonctions

| Fonction | Description |
|----------|-------------|
| `generateUBLInvoice(invoice, seller, buyer, items)` | Génère le XML UBL complet |
| `generateUBLCreditNote(invoice, seller, buyer, items)` | Génère un avoir UBL |
| `exportUBL(invoice, seller, buyer, items)` | Export → Blob + filename |
| `validateForPeppolBE(invoice, seller, buyer, items)` | Validation belge pré-export |

#### Validation pré-export (règles EN16931)

| Règle | ID | Description |
|-------|----|-------------|
| Numéro facture | BR-01 | Obligatoire |
| Date émission | BR-02 | Obligatoire |
| Type document | BR-04 | 380 ou 381 |
| Devise | BR-05 | ISO 4217 (EUR par défaut) |
| Nom vendeur | BR-06 | Obligatoire |
| Nom acheteur | BR-07 | Obligatoire |
| N° TVA vendeur | BR-CO-09 | Si TVA applicable |
| Total lignes = Total HT | BR-12 | Somme des lignes |
| Total TVA cohérent | BR-CO-14 | Somme par taux |
| Total TTC = HT + TVA | BR-15 | Vérification |
| Au moins 1 ligne | BR-16 | Obligatoire |
| Buyer reference | PEPPOL-EN16931-R003 | BuyerReference ou OrderReference |
| Endpoint vendeur | PEPPOL-EN16931-R001 | EndpointID requis |
| Endpoint acheteur | PEPPOL-EN16931-R002 | EndpointID requis |

---

## 4. Modifications base de données

### Migration : Extension table `clients`

```sql
ALTER TABLE clients ADD COLUMN IF NOT EXISTS peppol_endpoint_id TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS peppol_scheme_id TEXT DEFAULT '0208';
ALTER TABLE clients ADD COLUMN IF NOT EXISTS electronic_invoicing_enabled BOOLEAN DEFAULT false;
```

### Migration : Extension table `invoices`

```sql
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS peppol_status TEXT DEFAULT 'none'
  CHECK (peppol_status IN ('none', 'pending', 'sent', 'delivered', 'accepted', 'rejected', 'error'));
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS peppol_sent_at TIMESTAMPTZ;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS peppol_document_id TEXT;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS peppol_error_message TEXT;
```

### Migration : Extension table `companies`

```sql
ALTER TABLE companies ADD COLUMN IF NOT EXISTS peppol_endpoint_id TEXT;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS peppol_scheme_id TEXT DEFAULT '0208';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS peppol_ap_provider TEXT DEFAULT 'storecove';
```

### Migration : Nouvelle table `peppol_transmission_log`

```sql
CREATE TABLE peppol_transmission_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'sent', 'delivered', 'accepted', 'rejected', 'error')),
  ap_provider TEXT,
  ap_document_id TEXT,
  sender_endpoint TEXT,
  receiver_endpoint TEXT,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_peppol_log_invoice ON peppol_transmission_log(invoice_id);
CREATE INDEX idx_peppol_log_user ON peppol_transmission_log(user_id);

ALTER TABLE peppol_transmission_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own logs" ON peppol_transmission_log
  FOR ALL USING (auth.uid() = user_id);
```

---

## 5. Service abstrait AP — `peppolAPService.js`

Interface commune pour tous les fournisseurs AP :

```javascript
// Interface
{
  sendDocument(ublXml, senderEndpoint, receiverEndpoint, documentType) → { documentId, status }
  getDocumentStatus(documentId) → { status, details }
  registerWebhook(callbackUrl) → { webhookId }
}
```

### Adapter Storecove — `storecoveAdapter.js`

- API REST : `https://api.storecove.com/api/v2/`
- Auth : Bearer token (API key)
- Endpoints principaux :
  - `POST /document_submissions` — envoyer un document
  - `GET /document_submissions/{guid}` — statut
  - Webhooks pour les notifications de statut

---

## 6. Edge Functions

### `peppol-send`

1. Auth JWT + vérification user_id
2. Charger facture + items + vendeur + acheteur
3. Vérifier `electronic_invoicing_enabled` sur le client
4. Générer UBL 2.1
5. Valider (règles EN16931)
6. Appeler l'AP SaaS
7. Logger dans `peppol_transmission_log`
8. Mettre à jour `invoices.peppol_status` = 'pending' → 'sent'

### `peppol-webhook`

1. Vérifier l'authenticité du callback (signature AP)
2. Si mise à jour statut : MAJ `invoices.peppol_status` + log
3. Si facture entrante : parser UBL → créer `supplier_invoices`
4. Retourner 200 OK

---

## 7. Composants UI

| Composant | Fichier | Description |
|-----------|---------|-------------|
| Bouton Peppol | `InvoicePreview.jsx` (modif) | "Envoyer via Peppol" à côté du PDF |
| Badge statut | `PeppolStatusBadge.jsx` (nouveau) | Pastille colorée: vert=delivered, jaune=pending, rouge=error |
| Log transmission | `PeppolTransmissionLog.jsx` (nouveau) | Historique envois pour une facture |
| Settings Peppol | `PeppolSettings.jsx` (nouveau) | Onglet dans SettingsPage: AP, endpoint, clé API |
| Champ client | `ClientForm` (modif) | Champ "N° entreprise Peppol (BCE)" |

---

## 8. Choix AP : Storecove

**Raisons :**
- API REST moderne, bien documentée
- Supporte schéma `0208` (BCE/KBO belge) nativement
- Couverture B2B Peppol + B2G Mercurius
- Sandbox gratuite pour tests
- ~0.20 EUR/document en production
- Architecture AP-agnostique : changement d'AP = nouveau adapter uniquement

---

## 9. i18n

Clés à ajouter dans `fr.json` et `en.json` :

```json
{
  "peppol": {
    "sendViaPeppol": "Envoyer via Peppol / Send via Peppol",
    "peppolStatus": "Statut Peppol / Peppol Status",
    "endpointId": "N° entreprise (BCE) / Enterprise number (BCE)",
    "transmissionLog": "Historique transmissions / Transmission history",
    "status": {
      "none": "Non envoyé / Not sent",
      "pending": "En attente / Pending",
      "sent": "Envoyé / Sent",
      "delivered": "Livré / Delivered",
      "accepted": "Accepté / Accepted",
      "rejected": "Rejeté / Rejected",
      "error": "Erreur / Error"
    }
  }
}
```

---

## Sources

- [Peppol BIS Billing 3.0](https://docs.peppol.eu/poacc/billing/3.0/)
- [Belgium 2025 eInvoicing Country Sheet](https://ec.europa.eu/digital-building-blocks/sites/spaces/einvoicingCFS/pages/881983566/2025+Belgium+2025+eInvoicing+Country+Sheet)
- [Belgium E-invoicing Guide (Marosa)](https://marosavat.com/vat-news/e-invoicing-b2b-belgium-complete-guide-january-2026)
- [Belgium E-invoicing (Thomson Reuters/Pagero)](https://www.pagero.com/compliance/regulatory-updates/belgium)
- [EDICOM Belgium 2026](https://edicomgroup.com/blog/belgium-will-make-b2b-electronic-invoice-mandatory)
