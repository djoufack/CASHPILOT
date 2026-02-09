# Conversation Peppol - CashPilot
**Date :** 8 février 2026, 16h19
**Participants :** Utilisateur + Claude (Opus 4.6)

---

## 1. Demande initiale

**Utilisateur :**
> Vérifiez si cette application est compatible Peppol pour la gestion des factures

---

## 2. Audit de compatibilité Peppol

**Claude :**

### Verdict : PARTIELLEMENT COMPATIBLE - Fondation existante, intégration incomplète

### Ce qui EST implémenté

| Composant | Fichier | Statut |
|-----------|---------|--------|
| Génération XML CII (Factur-X/ZUGFeRD 2.1) | `src/services/exportFacturX.js` | Implémenté |
| Profils EN16931, BASIC, MINIMUM | `src/services/exportFacturX.js` | Implémenté |
| Types de documents (facture, avoir, acompte...) | `src/services/exportFacturX.js` | Implémenté |
| Gestion TVA / N° TVA / SIRET | Composants factures | Implémenté |
| IBAN/BIC pour paiements | `src/services/exportFacturX.js` | Implémenté |
| Export FEC / SAF-T comptable | `src/services/exportFEC.js`, `src/services/exportSAFT.js` | Implémenté |

### Ce qui MANQUE pour la conformité Peppol

#### Critique (bloquant)

1. **Pas d'intégration UI** - Le service `exportFacturX.js` existe mais n'est appelé nulle part dans l'interface. `InvoicePreview.jsx` n'exporte qu'en PDF.

2. **Pas de point d'accès Peppol (PAP)** - Peppol nécessite la transmission via un Access Point certifié. Aucune intégration avec un fournisseur Peppol (ex: Chorus Pro, Basware, Pagero).

3. **Pas d'enveloppe SBDH** - Le Standard Business Document Header est requis pour la transmission Peppol.

4. **Pas de signature électronique qualifiée** - Obligatoire pour la transmission Peppol.

#### Important (fonctionnel)

5. **Format UBL absent** - Seul le format CII est implémenté. Peppol accepte aussi UBL (Universal Business Language), qui est le format le plus courant dans le réseau Peppol.

6. **Pas de PDF/XML hybride** - Factur-X = PDF avec XML embarqué. Le service ne génère que le XML, pas le document hybride.

7. **Pas d'identifiants Peppol** - Aucun champ `peppol_endpoint_id` sur les clients/fournisseurs en base de données.

8. **Aucune librairie Peppol** dans `package.json` - Pas de client Peppol, pas de librairie de signature XML.

### Plan de mise en conformité recommandé

**Phase 1 - Court terme (1 semaine)**
- Connecter `exportFacturX.js` au bouton d'export dans l'UI
- Ajouter le champ `peppol_endpoint_id` aux tables clients/fournisseurs
- Implémenter la génération PDF/XML hybride (Factur-X complet)

**Phase 2 - Moyen terme (2-3 semaines)**
- Implémenter la génération UBL 2.1
- Intégrer un fournisseur Peppol Access Point (API)
- Ajouter la génération SBDH
- Implémenter la signature électronique

**Phase 3 - Long terme**
- Workflow complet d'envoi/réception Peppol
- Conformité XRechnung (B2G Allemagne)
- Journal de transmission et gestion des erreurs
- Certification auprès des autorités fiscales

### Risque réglementaire

L'obligation EU de facturation électronique B2B (2024+) rend cette mise en conformité urgente. La base technique (XML CII) est posée mais le service n'est ni exposé à l'utilisateur, ni connecté au réseau Peppol.

---

## 3. Enregistrement de l'audit

**Utilisateur :**
> Enregistrer cet audit dans le dossier Peppol, fichier Audit de compatibilité Peppol - CASHPILOT.md

**Claude :**
Fichier créé : `Peppol/Audit de compatibilité Peppol - CASHPILOT.md`

Le document contient :
- Le verdict global (partiellement compatible)
- Le détail de ce qui est implémenté (Factur-X/CII)
- L'architecture facturation existante
- Les 8 composants manquants pour Peppol (classés par criticité)
- Un plan de mise en conformité en 3 phases avec checklist
- L'analyse du risque réglementaire EU

---

## 4. Demande de plan d'implémentation

**Utilisateur :**
> Générer un plan d'implémentation pour l'intégration de Peppol, que vous placerez dans le dossier Peppol, et que nous utiliserons en temps opportun: Plan Implementation Peppol.md

**Claude :**

Analyse approfondie du codebase effectuée :
- Lecture de `src/services/exportFacturX.js` (260 lignes - service CII existant)
- Lecture de `src/components/InvoicePreview.jsx` (92 lignes - export PDF uniquement)
- Lecture de `package.json` (dépendances actuelles)
- Exploration des hooks (`useInvoices.js`, `useCompany.js`)
- Exploration du schéma DB (tables invoices, invoice_items, clients, companies)
- Exploration des Edge Functions existantes
- Exploration des fichiers i18n

### Plan d'implémentation généré - 10 Phases

| Phase | Description | Effort | Priorité |
|-------|-------------|--------|----------|
| 1 | Connecter `exportFacturX.js` à l'UI | 1-2j | Haute |
| 2 | Migrations DB (endpoints, logs, statuts) | 1-2j | Haute |
| 3 | Génération UBL 2.1 (format natif Peppol) | 3-4j | Haute |
| 4 | PDF/XML hybride Factur-X | 2-3j | Moyenne |
| 5 | Validation EN16931 + règles Peppol BIS 3.0 | 3-4j | Haute |
| 6 | Transmission via Access Point certifié + SBDH | 5-7j | Critique |
| 7 | Signature électronique (XAdES/certificat) | 3-4j | Haute |
| 8 | Réception et traitement factures entrantes | 3-4j | Moyenne |
| 9 | i18n (FR/EN) + composants UI Peppol | 1-2j | Moyenne |
| 10 | Tests, validation externe, certification | 3-5j | Haute |

**Durée totale estimée : 6-8 semaines**

Le plan détaillé inclut :
- Architecture cible avec diagramme
- SQL des migrations (tables peppol_transmission_log, extensions clients/invoices/companies)
- Structure XML UBL 2.1 cible avec namespaces
- Comparaison CII vs UBL
- Template SBDH complet
- Règles de validation EN16931 (BR-01 à BR-16)
- Comparatif des Access Points (Chorus Pro, Pagero, Basware, Storecove)
- Options de signature électronique
- Flux de réception entrant
- Clés i18n FR/EN complètes
- 10 scénarios de test
- Matrice de risques
- Calendrier semaine par semaine avec jalons

Fichier créé : `Peppol/Plan Implementation Peppol.md`

---

## 5. Archivage de la conversation

**Utilisateur :**
> Placer toute la conversation concernant Peppol dans le dossier Context, fichier conversation_peppol_08-02-26-16-19.md

**Claude :**
Fichier créé : `Peppol/Context/conversation_peppol_08-02-26-16-19.md`

---

## Fichiers générés durant cette conversation

| Fichier | Description |
|---------|-------------|
| `Peppol/Audit de compatibilité Peppol - CASHPILOT.md` | Audit complet de compatibilité |
| `Peppol/Plan Implementation Peppol.md` | Plan d'implémentation en 10 phases |
| `Peppol/Context/conversation_peppol_08-02-26-16-19.md` | Ce fichier (archive de la conversation) |

## Fichiers analysés durant cette conversation

| Fichier | Raison |
|---------|--------|
| `src/services/exportFacturX.js` | Service CII existant (base Peppol) |
| `src/components/InvoicePreview.jsx` | UI export factures (à étendre) |
| `package.json` | Dépendances actuelles |
| `src/hooks/useInvoices.js` | Modèle de données factures |
| `src/hooks/useCompany.js` | Modèle de données entreprise |
| `src/lib/schema.sql` | Schéma base de données |
| `src/i18n/locales/fr.json` | Traductions françaises |
| `src/i18n/locales/en.json` | Traductions anglaises |
| `docs/agent-master-sprint-orchestrator.md` | Roadmap projet |
| `supabase/functions/extract-invoice/index.ts` | Edge Function extraction IA |
| `supabase/migrations/*` | Migrations existantes |
