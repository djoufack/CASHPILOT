# Audit de compatibilité Peppol - CASHPILOT

**Date :** 8 février 2026
**Version :** main (dernier commit)
**Fichiers examinés :** 50+ fichiers sources, 10+ fichiers documentation

---

## Verdict : PARTIELLEMENT COMPATIBLE

Fondation technique existante, intégration incomplète.

---

## 1. Ce qui EST implémenté

| Composant | Fichier | Statut |
|-----------|---------|--------|
| Génération XML CII (Factur-X/ZUGFeRD 2.1) | `src/services/exportFacturX.js` | Implémenté |
| Profils EN16931, BASIC, MINIMUM | `src/services/exportFacturX.js` | Implémenté |
| Types de documents (facture, avoir, acompte...) | `src/services/exportFacturX.js` | Implémenté |
| Gestion TVA / N° TVA / SIRET | Composants factures | Implémenté |
| IBAN/BIC pour paiements | `src/services/exportFacturX.js` | Implémenté |
| Export FEC / SAF-T comptable | `src/services/exportFEC.js`, `src/services/exportSAFT.js` | Implémenté |

### Détails de l'implémentation Factur-X

**Fichier :** `src/services/exportFacturX.js` (260 lignes)

#### Profils supportés :
- `MINIMUM` : `urn:factur-x.eu:1p0:minimum`
- `BASIC` : `urn:factur-x.eu:1p0:basic`
- `EN16931` : `urn:cen.eu:en16931:2017`

#### Types de documents :
- INVOICE (380)
- CREDIT_NOTE (381)
- DEBIT_NOTE (383)
- CORRECTED_INVOICE (384)
- PREPAYMENT_INVOICE (386)
- SELF_BILLED_INVOICE (389)

#### Fonctionnalités du service XML :
- Génération XML conforme CrossIndustryInvoice (CII)
- Espaces de noms XML corrects (rsm, ram, qdt, udt)
- Informations vendeur/acheteur (nom, SIRET, TVA, adresse)
- Détails facture (numéro, date, devise EUR par défaut)
- Calcul et taux TVA
- Conditions de paiement et date d'échéance
- Informations bancaires IBAN/BIC
- Échappement XML des caractères spéciaux
- Formatage dates au standard Factur-X (YYYYMMDD)
- Formatage montants (2 décimales)

#### Validations :
- Numéro de facture requis
- Date de facture requise
- Nom vendeur requis
- Nom acheteur requis
- Total TTC requis

---

## 2. Architecture facturation existante

```
src/components/
├── InvoiceGenerator.jsx          - Formulaire création factures
├── InvoicePreview.jsx            - Export PDF uniquement (PAS d'export XML)
├── QuickInvoice.jsx
├── UploadInvoiceModal.jsx
├── settings/InvoiceCustomization.jsx
└── suppliers/SupplierInvoices.jsx

src/pages/
├── InvoicesPage.jsx              - Gestion principale factures
└── RecurringInvoicesPage.jsx

src/hooks/
├── useInvoices.js                - Opérations CRUD
├── useInvoiceExtraction.js       - Parsing IA factures
├── useInvoiceSettings.js         - Préférences templates
├── useInvoiceUpload.js
└── useRecurringInvoices.js

src/services/
├── exportFacturX.js              - XML Factur-X (NON INTÉGRÉ À L'UI)
├── exportDocuments.js            - Export PDF/HTML
├── exportPDF.js
├── exportHTML.js
├── exportFEC.js                  - Export comptable français
└── exportSAFT.js                 - Export comptable SAF-T
```

### Colonnes table factures en base :
- `invoice_number`, `invoice_date`, `due_date`
- `client_id`, `user_id`
- `total_ht`, `total_vat`, `total_ttc`
- `payment_status` (unpaid, partial, paid, overpaid)
- `discount_type`, `discount_value`, `discount_amount`
- `shipping_fee`, `adjustment`, `adjustment_label`
- `header_note`, `footer_note`, `terms_and_conditions`
- `internal_remark`, `attached_image_url`
- `custom_fields` (JSONB)
- `reference`

**Note :** Aucune colonne spécifique e-invoicing (peppol_endpoint_id, electronic_format, transmission_status).

---

## 3. Ce qui MANQUE pour la conformité Peppol

### Critique (bloquant)

| # | Composant manquant | Description |
|---|-------------------|-------------|
| 1 | **Intégration UI** | Le service `exportFacturX.js` existe mais n'est appelé nulle part. `InvoicePreview.jsx` n'exporte qu'en PDF. |
| 2 | **Point d'accès Peppol (PAP)** | Peppol nécessite la transmission via un Access Point certifié. Aucune intégration (Chorus Pro, Basware, Pagero...). |
| 3 | **Enveloppe SBDH** | Le Standard Business Document Header est requis pour la transmission Peppol. |
| 4 | **Signature électronique qualifiée** | Obligatoire pour la transmission Peppol. |

### Important (fonctionnel)

| # | Composant manquant | Description |
|---|-------------------|-------------|
| 5 | **Format UBL** | Seul le format CII est implémenté. Peppol accepte aussi UBL (Universal Business Language), format le plus courant sur le réseau. |
| 6 | **PDF/XML hybride** | Factur-X = PDF avec XML embarqué. Le service ne génère que le XML brut. |
| 7 | **Identifiants Peppol** | Aucun champ `peppol_endpoint_id` sur les clients/fournisseurs en base de données. |
| 8 | **Librairies Peppol** | Aucune librairie Peppol dans `package.json` (pas de client Peppol, pas de signature XML). |

### Librairies manquantes dans package.json :

```json
// Librairies actuelles (PDF/Excel)
"@react-pdf/renderer": "^3.1.14"
"html2pdf.js": "^0.10.1"
"jspdf": "^2.5.1"
"html2canvas": "^1.4.1"
"xlsx": "^0.18.5"

// Manquantes pour Peppol :
// - Client Peppol (node-peppol ou équivalent)
// - Signature XML (xmldsig)
// - Génération UBL
// - Embarquement XML dans PDF
```

---

## 4. Plan de mise en conformité recommandé

### Phase 1 - Court terme (1 semaine)

- [ ] Connecter `exportFacturX.js` au bouton d'export dans `InvoicePreview.jsx`
- [ ] Ajouter le champ `peppol_endpoint_id` aux tables clients/fournisseurs
- [ ] Implémenter la génération PDF/XML hybride (Factur-X complet)
- [ ] Ajouter un bouton "Exporter Factur-X" dans l'interface factures

### Phase 2 - Moyen terme (2-3 semaines)

- [ ] Implémenter la génération UBL 2.1
- [ ] Intégrer un fournisseur Peppol Access Point (API)
- [ ] Ajouter la génération d'enveloppe SBDH
- [ ] Implémenter la signature électronique qualifiée
- [ ] Ajouter les colonnes e-invoicing en base de données

### Phase 3 - Long terme

- [ ] Workflow complet d'envoi/réception Peppol
- [ ] Conformité XRechnung (B2G Allemagne)
- [ ] Journal de transmission et gestion des erreurs
- [ ] Certification auprès des autorités fiscales
- [ ] Tests de conformité avec les validateurs Peppol officiels

---

## 5. Risque réglementaire

L'obligation EU de facturation électronique B2B (2024+) rend cette mise en conformité **urgente**.

- **France :** Obligation progressive de facturation électronique B2B via Chorus Pro (PPF) et PDP certifiées
- **Allemagne :** XRechnung obligatoire pour le B2G
- **Italie :** SDI obligatoire depuis 2019
- **Réseau Peppol :** Standard paneuropéen de plus en plus adopté

La base technique (XML CII / Factur-X) est posée mais le service n'est ni exposé à l'utilisateur, ni connecté au réseau Peppol.

---

## 6. Conclusion

CASHPILOT dispose d'une **fondation technique solide** avec le service `exportFacturX.js` qui génère du XML conforme CII/EN16931. Cependant, pour être réellement compatible Peppol, il manque :

1. L'intégration dans l'interface utilisateur
2. La couche de transmission Peppol (Access Point, SBDH, signatures)
3. Le support du format UBL
4. Le format hybride PDF/XML
5. La gestion des identifiants Peppol

**Effort estimé pour la conformité complète :** Phases 1 et 2 réalisables en 3-4 semaines de développement.
