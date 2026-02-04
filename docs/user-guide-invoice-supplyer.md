# Guide utilisateur : Factures fournisseurs avec extraction IA

## Table des matieres

1. [Vue d'ensemble](#1-vue-densemble)
2. [Architecture technique](#2-architecture-technique)
3. [Comment la fonctionnalite a ete implementee](#3-comment-la-fonctionnalite-a-ete-implementee)
4. [Guide d'utilisation](#4-guide-dutilisation)
5. [Credits et couts](#5-credits-et-couts)
6. [Donnees extraites par l'IA](#6-donnees-extraites-par-lia)
7. [Indicateur de confiance](#7-indicateur-de-confiance)
8. [Integration comptable](#8-integration-comptable)
9. [Gestion des erreurs et remboursements](#9-gestion-des-erreurs-et-remboursements)
10. [FAQ](#10-faq)

---

## 1. Vue d'ensemble

CashPilot integre une fonctionnalite d'extraction automatique des factures fournisseurs par intelligence artificielle. Au lieu de saisir manuellement chaque champ d'une facture (numero, date, montants, TVA, lignes de detail...), l'utilisateur uploade un document (PDF, photo JPG ou PNG) et l'IA extrait toutes les donnees structurees en quelques secondes.

**LLM utilise** : Google Gemini 2.0 Flash — choisi pour son support natif des PDF (pas de conversion necessaire), son cout 20x inferieur a Mistral Pixtral, et sa capacite a retourner du JSON structure de maniere fiable.

---

## 2. Architecture technique

```
Utilisateur (navigateur)
  |
  |  1. Selectionne un fichier (PDF / JPG / PNG, max 10 Mo)
  |  2. Clique "Extraire avec l'IA"
  |
  v
Client React (UploadInvoiceModal.jsx)
  |
  |  3. Upload du fichier vers Supabase Storage (bucket: supplier-invoices)
  |  4. Appel POST vers l'Edge Function via invoiceExtractionService.js
  |
  v
Supabase Edge Function (extract-invoice/index.ts)
  |
  |  5. Verifie les credits de l'utilisateur (>= 3)
  |  6. Deduit 3 credits
  |  7. Telecharge le fichier depuis le Storage
  |  8. Encode en base64
  |  9. Envoie a Google Gemini 2.0 Flash avec le prompt d'extraction
  | 10. Retourne les donnees structurees en JSON
  |
  v
Client React
  |
  | 11. Pre-remplit le formulaire avec les donnees extraites
  | 12. Affiche le badge de confiance et les lignes de facture
  | 13. L'utilisateur verifie, corrige si besoin, et sauvegarde
  |
  v
Base de donnees Supabase (PostgreSQL)
  |
  | 14. Insert dans supplier_invoices (avec colonnes AI)
  | 15. Insert des lignes dans supplier_invoice_line_items
```

### Fichiers impliques

| Fichier | Role |
|---------|------|
| `supabase/functions/extract-invoice/index.ts` | Edge Function Deno — appel Gemini, gestion credits, refunds |
| `src/services/invoiceExtractionService.js` | Service client — appel HTTP vers l'Edge Function |
| `src/hooks/useInvoiceExtraction.js` | Hook React — gestion d'etat de l'extraction (loading, data, error) |
| `src/hooks/useSupplierInvoices.js` | Hook React — CRUD factures + insertion des lignes de facture |
| `src/hooks/useInvoiceUpload.js` | Hook React — validation fichier (types, taille) |
| `src/hooks/useCreditsGuard.js` | Hook React — verification et consommation des credits |
| `src/components/UploadInvoiceModal.jsx` | Composant UI — modal d'upload avec extraction IA |
| `src/components/suppliers/SupplierInvoices.jsx` | Composant UI — liste des factures d'un fournisseur |
| `migrations/027_ai_invoice_extraction.sql` | Migration SQL — colonnes AI + table line_items + RLS |

---

## 3. Comment la fonctionnalite a ete implementee

### 3.1. Schema de base de donnees (Migration 027)

**13 nouvelles colonnes** ajoutees a la table `supplier_invoices` :

| Colonne | Type | Description |
|---------|------|-------------|
| `total_ht` | DECIMAL(14,2) | Montant hors taxes |
| `total_ttc` | DECIMAL(14,2) | Montant toutes taxes comprises |
| `currency` | TEXT (defaut: EUR) | Devise de la facture |
| `supplier_name_extracted` | TEXT | Nom du fournisseur extrait par l'IA |
| `supplier_address_extracted` | TEXT | Adresse du fournisseur extraite |
| `supplier_vat_number` | TEXT | Numero de TVA intracommunautaire |
| `payment_terms` | TEXT | Conditions de paiement |
| `iban` | TEXT | IBAN bancaire |
| `bic` | TEXT | Code BIC/SWIFT |
| `ai_extracted` | BOOLEAN (defaut: false) | Indique si la facture a ete extraite par IA |
| `ai_confidence` | DECIMAL(3,2) | Score de confiance de 0.00 a 1.00 |
| `ai_raw_response` | JSONB | Reponse brute complete de Gemini |
| `ai_extracted_at` | TIMESTAMPTZ | Horodatage de l'extraction |

**Nouvelle table `supplier_invoice_line_items`** pour les lignes de detail :

| Colonne | Type | Description |
|---------|------|-------------|
| `id` | UUID | Identifiant unique |
| `invoice_id` | UUID (FK) | Reference vers la facture parente (CASCADE) |
| `description` | TEXT | Description de la ligne |
| `quantity` | DECIMAL(10,3) | Quantite |
| `unit_price` | DECIMAL(14,2) | Prix unitaire |
| `total` | DECIMAL(14,2) | Total de la ligne |
| `sort_order` | INTEGER | Ordre d'affichage |
| `created_at` | TIMESTAMPTZ | Date de creation |

**Securite** : Les policies RLS (Row Level Security) garantissent qu'un utilisateur ne peut acceder qu'aux lignes de facture de ses propres fournisseurs, via la chaine `line_items -> invoices -> suppliers -> user_id`.

### 3.2. Edge Function (Backend)

L'Edge Function `extract-invoice` tourne sur Deno (runtime Supabase). Elle :

1. Verifie que l'utilisateur dispose d'au moins 3 credits
2. Deduit les 3 credits **avant** l'appel a Gemini (avec refund en cas d'echec)
3. Telecharge le fichier depuis Supabase Storage
4. L'encode en base64
5. Appelle l'API Gemini 2.0 Flash avec :
   - Le document en `inlineData` (base64 + mimeType)
   - Un prompt d'extraction structure
   - `responseMimeType: "application/json"` pour forcer une reponse JSON
   - `temperature: 0.1` pour maximiser la coherence
6. Parse la reponse et retourne les donnees structurees

### 3.3. Service et Hook client

- **`invoiceExtractionService.js`** : envoie la requete HTTP vers l'Edge Function avec le JWT utilisateur et gere les codes d'erreur (402, 404, 422, 502)
- **`useInvoiceExtraction.js`** : hook React qui expose `extractInvoice()`, `extracting` (boolean loading), `extractedData`, `extractionError`, et `clearExtraction()`

### 3.4. Interface utilisateur

Le composant `UploadInvoiceModal` a ete entierement refait pour supporter :

- **Drag & drop** ou selection de fichier (PDF, JPG, PNG)
- **Bouton "Extraire avec l'IA"** (violet, icone Sparkles) qui apparait apres selection du fichier
- **Spinner anime** pendant l'extraction avec message "Analyse de la facture..."
- **Pre-remplissage automatique** de tous les champs du formulaire
- **Badge de confiance** colore (vert/jaune/rouge)
- **Section "Details avances"** (accordeon) : montant HT, TVA, devise, numero TVA, IBAN, BIC
- **Tableau des lignes de facture** (lecture seule) si l'IA en a detecte
- **Tous les champs restent editables** pour correction manuelle avant sauvegarde

---

## 4. Guide d'utilisation

### Etape 1 : Acceder aux factures d'un fournisseur

1. Connectez-vous a CashPilot sur https://cashpilot.tech
2. Allez dans la section **Fournisseurs** (menu lateral)
3. Cliquez sur un fournisseur pour ouvrir son profil
4. L'onglet **Factures** affiche la liste des factures existantes

### Etape 2 : Uploader une facture

1. Cliquez sur le bouton **"Upload Invoice"** (bleu, icone +)
2. Le modal d'upload s'ouvre
3. **Glissez-deposez** un fichier ou cliquez pour selectionner :
   - Formats acceptes : **PDF**, **JPG**, **PNG**
   - Taille maximale : **10 Mo**

### Etape 3 : Extraction par IA (optionnelle)

1. Apres avoir selectionne le fichier, un bouton violet **"Extraire avec l'IA"** apparait
   - Le cout en credits est affiche a cote : **(3 credits)**
2. Cliquez sur le bouton
3. Un spinner s'affiche avec le message *"Analyse de la facture..."*
4. Apres quelques secondes, le formulaire se pre-remplit automatiquement :
   - Numero de facture
   - Date de facture et date d'echeance
   - Montant total (TTC)
   - Taux de TVA
5. Un **badge de confiance** s'affiche (voir section 7)

### Etape 4 : Verifier et completer

1. **Verifiez** chaque champ pre-rempli — l'IA peut faire des erreurs
2. Cliquez sur **"Details avances"** pour voir/modifier :
   - Montant HT
   - Montant TVA
   - Devise (EUR, USD, GBP...)
   - Numero TVA du fournisseur
   - Conditions de paiement
   - IBAN et BIC
3. Si des **lignes de facture** ont ete detectees, elles apparaissent dans un tableau sous le formulaire
4. Corrigez si necessaire

### Etape 5 : Sauvegarder

1. Cliquez sur **"Save Invoice"** (ou "Sauvegarder la facture")
2. La facture est enregistree en base de donnees avec :
   - Toutes les donnees du formulaire
   - Le flag `ai_extracted: true` si l'IA a ete utilisee
   - Le score de confiance
   - La reponse brute de l'IA (pour audit)
   - Les lignes de facture dans une table separee

### Etape 6 : Gerer les factures

Dans la liste des factures du fournisseur :

- **Badge AI** (violet, icone Sparkles) : indique les factures extraites par IA
- **Statut de paiement** : modifiable directement via le menu deroulant (Pending / Paid / Overdue)
- **Suppression** : bouton corbeille rouge

### Saisie manuelle (sans IA)

Si vous ne souhaitez pas utiliser l'extraction IA :
1. Uploadez le fichier
2. **Ignorez** le bouton "Extraire avec l'IA"
3. Remplissez les champs manuellement
4. Sauvegardez — aucun credit n'est consomme

---

## 5. Credits et couts

### Cout de l'extraction IA

| Operation | Cout en credits |
|-----------|----------------|
| Extraction IA d'une facture | **3 credits** |
| Upload sans extraction (saisie manuelle) | **0 credit** |

### Comment les credits sont consommes

1. L'utilisateur clique sur "Extraire avec l'IA"
2. Le systeme verifie que le solde est >= 3 credits
3. Si insuffisant : un message d'erreur s'affiche, **aucun credit n'est deduit**
4. Si suffisant : 3 credits sont deduits **immediatement**
5. La transaction est enregistree dans `credit_transactions` :
   - `amount: -3`
   - `type: 'usage'`
   - `description: 'AI Invoice Extraction'`

### Remboursement automatique

Si l'extraction echoue **apres** la deduction des credits, ceux-ci sont automatiquement rembourses :

| Situation d'echec | Credits rembourses | Transaction enregistree |
|-------------------|-------------------|------------------------|
| Fichier introuvable dans le storage | 3 credits | `type: 'refund'` |
| Erreur de l'API Gemini (indisponible) | 3 credits | `type: 'refund'` |
| Echec du parsing de la reponse IA | 3 credits | `type: 'refund'` |
| Credits insuffisants | Aucune deduction | Pas de transaction |

Le remboursement est **automatique et instantane** — l'utilisateur n'a rien a faire.

### Verifier son solde de credits

Le solde de credits est visible dans l'interface CashPilot. Chaque consommation et remboursement est trace dans l'historique des transactions de credits.

---

## 6. Donnees extraites par l'IA

L'IA extrait les 16 champs suivants a partir du document :

### Informations principales

| Champ | Description | Exemple |
|-------|-------------|---------|
| Numero de facture | Reference unique de la facture | `FAC-2026-0042` |
| Date de facture | Date d'emission (format YYYY-MM-DD) | `2026-01-15` |
| Date d'echeance | Date limite de paiement | `2026-02-15` |
| Nom du fournisseur | Raison sociale extraite du document | `ACME Corp SRL` |
| Adresse du fournisseur | Adresse complete | `Rue de la Loi 42, 1000 Bruxelles` |

### Montants financiers

| Champ | Description | Exemple |
|-------|-------------|---------|
| Total HT | Montant hors taxes | `1 250.00` |
| Total TVA | Montant de la TVA | `262.50` |
| Total TTC | Montant toutes taxes comprises | `1 512.50` |
| Taux de TVA | Pourcentage de TVA | `21` |
| Devise | Code devise ISO | `EUR` |

### Informations bancaires et conditions

| Champ | Description | Exemple |
|-------|-------------|---------|
| Numero TVA | TVA intracommunautaire du fournisseur | `BE0123.456.789` |
| Conditions de paiement | Termes de paiement | `30 jours fin de mois` |
| IBAN | Compte bancaire | `BE68 5390 0754 7034` |
| BIC/SWIFT | Code bancaire | `BBRUBEBB` |

### Lignes de facture

L'IA detecte les lignes individuelles de la facture :

| Colonne | Description | Exemple |
|---------|-------------|---------|
| Description | Designation du produit/service | `Maintenance serveur Q1 2026` |
| Quantite | Nombre d'unites | `3` |
| Prix unitaire | Prix par unite | `416.67` |
| Total | Total de la ligne | `1 250.00` |

---

## 7. Indicateur de confiance

Apres chaque extraction, l'IA attribue un score de confiance global entre 0 et 1 :

| Niveau | Score | Badge | Signification |
|--------|-------|-------|---------------|
| **Elevee** | > 0.80 | Vert | Document clair, donnees fiables. Verifiez rapidement. |
| **Moyenne** | 0.50 - 0.80 | Jaune | Certaines donnees peuvent etre imprecises. Verifiez attentivement. |
| **Faible** | < 0.50 | Rouge | Document de mauvaise qualite ou atypique. Verifiez chaque champ. |

**Conseils pour maximiser la confiance :**

- Utilisez des **PDF natifs** (pas des scans) quand c'est possible
- Pour les photos, assurez-vous que le document est **bien eclaire et net**
- Evitez les documents **partiellement coupes** ou **plies**
- Les factures avec un **format standard** (tabulaire) donnent de meilleurs resultats

---

## 8. Integration comptable

Les donnees extraites sont automatiquement disponibles dans les modules comptables de CashPilot :

### Rapprochement bancaire

Le module **Bank Reconciliation** (`BankReconciliation.jsx`) utilise les factures fournisseurs pour le rapprochement automatique des transactions bancaires. Les montants `total_amount` et `total_ttc` sont utilises pour matcher les mouvements bancaires avec les factures.

### Mappings comptables

Le module **Accounting Mappings** (`AccountingMappings.jsx`) reference le type source `supplier_invoice` pour permettre l'association des factures fournisseurs aux comptes comptables.

### Donnees disponibles

Tous les modules utilisant `SELECT *` sur la table `supplier_invoices` beneficient automatiquement des nouvelles colonnes AI, notamment :
- `useAccountingData.js` — donnees comptables globales
- `reconciliationMatcher.js` — algorithme de rapprochement

Aucune modification supplementaire n'est necessaire dans les modules comptables existants.

---

## 9. Gestion des erreurs et remboursements

### Codes d'erreur

| Code | Message | Cause | Action utilisateur |
|------|---------|-------|-------------------|
| **402** | Credits insuffisants | Solde < 3 credits | Acheter des credits |
| **404** | Fichier introuvable | Le fichier n'a pas pu etre telecharge du storage | Re-essayer l'upload |
| **422** | Extraction echouee | L'IA n'a pas pu extraire de donnees structurees | Saisir manuellement |
| **502** | Service IA indisponible | L'API Gemini ne repond pas | Re-essayer plus tard |

### Messages affiches a l'utilisateur

- **Credits insuffisants** : "Not enough credits for AI extraction" / "Credits insuffisants pour l'extraction IA"
- **Extraction echouee** : "Could not extract data from this document. Please fill in the fields manually." / "Impossible d'extraire les donnees. Veuillez remplir manuellement."
- **Service indisponible** : "AI service temporarily unavailable. Please try again later." / "Service IA temporairement indisponible."

### Politique de remboursement

Le principe est simple : **si l'extraction ne produit pas de resultat, les credits sont rembourses**. Seules les extractions reussies consomment des credits.

---

## 10. FAQ

**Q : L'extraction IA est-elle obligatoire pour uploader une facture ?**
Non. Le bouton "Extraire avec l'IA" est optionnel. Vous pouvez toujours saisir les donnees manuellement sans consommer de credits.

**Q : Puis-je modifier les donnees extraites par l'IA ?**
Oui. Tous les champs pre-remplis restent entierement editables. L'IA pre-remplit le formulaire, mais c'est vous qui validez et sauvegardez.

**Q : Quels formats de fichier sont acceptes ?**
PDF, JPG et PNG, avec une taille maximale de 10 Mo.

**Q : Combien coute une extraction ?**
3 credits par extraction. La saisie manuelle est gratuite.

**Q : Que se passe-t-il si l'extraction echoue ?**
Vos 3 credits sont automatiquement rembourses. Vous pouvez re-essayer ou saisir les donnees manuellement.

**Q : Les donnees extraites sont-elles envoyees a un serveur externe ?**
Le contenu du document est envoye a l'API Google Gemini pour analyse. Le traitement se fait via une Edge Function Supabase securisee. Le document reste stocke dans votre bucket Supabase prive.

**Q : L'IA fonctionne-t-elle avec des factures dans toutes les langues ?**
Google Gemini 2.0 Flash est multilingue et traite les factures en francais, anglais, neerlandais, allemand, espagnol, et la plupart des langues europeennes.

**Q : Comment fonctionne le badge AI dans la liste des factures ?**
Un badge violet avec l'icone Sparkles et le texte "AI" apparait a cote des factures dont les donnees ont ete extraites par intelligence artificielle. Cela permet d'identifier rapidement quelles factures ont beneficie de l'extraction automatique.

---

*Document genere le 04 fevrier 2026 — CashPilot v1.0.0*
