Vérification des 4 implémentations - Résultats
Tableau récapitulatif
Implémentation	Statut	Score	Verdict
Xero/QuickBooks	Skeleton UI	25%	UI presente, AUCUN OAuth ni sync reel
Report Builder	MVP fonctionnel	65%	Presets/export marchent, manque polish et i18n
Factur-X PDF+XML	Non conforme	40%	XML valide, mais PAS d'embedding dans le PDF
Workflow approbation	Quasi-complet	85%	Workflow solide, manque RLS + i18n
1. Connecteurs Xero/QuickBooks - SKELETON ONLY (25%)
Ce qui existe
UI composant AccountingConnectors.jsx avec glassmorphism
Hook useAccountingIntegrations.js avec CRUD Supabase
Migration avec table, indexes, CHECK constraints, trigger auto-timestamp
Ce qui manque (CRITIQUE)
Aucun flux OAuth - Le bouton "Preparer OAuth" met juste le status a "pending" et... rien
Aucune Edge Function pour callback OAuth, token exchange, sync
Aucun SDK Xero/QuickBooks dans package.json
Aucune sync - requestSync() ne fait que mettre a jour last_sync_at
Aucun mapping de comptes entre Xero/QB et CashPilot
Colonnes manquantes en DB: access_token, refresh_token, token_expires_at
i18n: 10+ strings hard-codees en francais
Effort estime pour production
60-80 heures (OAuth + API clients + sync engine + mapping + tests)

2. Report Builder Custom - MVP FONCTIONNEL (65%)
Ce qui fonctionne
3 presets (Executive, Operations, Compliance) + Custom
5 sections togglables (Overview, Cashflow, Factures clients/fournisseurs, TVA)
Export PDF (3 credits), HTML (2 credits), JSON (gratuit)
Templates sauvegardables dans localStorage
Data fetching avec filtrage par periode et company scope
UI dark theme coherente avec CashPilot
Ce qui ne fonctionne pas / manque
Pas de preview avant export (generation a l'aveugle)
Pas de validation dates (end < start accepte)
Templates en localStorage seulement (perdus au logout)
Pas de reordonnancement des sections (drag-and-drop)
Donnees tronquees a 12 lignes (.slice(0, 12) hard-code)
i18n incomplet: noms de sections hard-codes en francais
Pas de graphiques/visualisations dans les rapports
3. Factur-X PDF+XML - NON CONFORME (40%)
Ce qui fonctionne
XML CII (CrossIndustryInvoice) valide avec schema EN16931 correct
3 profils supportes (MINIMUM, BASIC, EN16931)
Donnees vendeur/acheteur, TVA, IBAN/BIC, dates au format correct
Bouton present dans InvoicePreview et InvoicesPage
Validation pre-export (numero, date, vendeur, acheteur, montant)
Ce qui NE fonctionne PAS (CRITIQUE)
Le standard Factur-X exige l'XML EMBARQUE dans le PDF comme attachment stream
L'implementation actuelle genere 2 fichiers separes : un XML + un PDF independant
Aucune lib d'embedding PDF (pas de pdf-lib ni pdfkit dans package.json)
Le bouton dit "PDF+XML" mais livre 2 fichiers non lies = label trompeur
Aucune metadata Factur-X dans le PDF
MCP tool export_facturx retourne du texte, pas un blob binaire
Fix recommande

Option A: Installer pdf-lib, embedder XML dans PDF (8-16h)
Option B: Renommer le bouton "Export XML (format Factur-X)" (15min)
4. Workflow Approbation Fournisseurs - QUASI-COMPLET (85%)
Ce qui fonctionne bien
Migration excellente: colonnes approval_status (CHECK pending/approved/rejected), approved_by, approved_at, rejected_reason
Trigger DB: synchronise automatiquement les metadonnees (clear rejected_reason si approved, etc.)
Backfill intelligent: factures deja payees auto-approuvees a la migration
Page complete: dropdown approbation, modale de rejet avec motif, badges colores, KPIs, filtre par statut
Hook propre: updateApprovalStatus() avec logique idempotente
Index performance sur (company_id, approval_status)
Ce qui manque
PAS de RLS pour l'approbation - N'importe quel user authentifie peut approuver (critique securite)
9+ cles i18n manquantes - fallbacks francais hard-codes
Composant SupplierInvoices.jsx: pas de modale de rejet (dropdown direct seulement)
Pas de notifications email pour approbations en attente
Pas d'approbation en masse
Pas d'historique des changements d'approbation
Fix prioritaires
Ajouter RLS restrictive (role admin/accountant requis) - 2-3h
Ajouter les cles i18n en FR/EN/NL - 1h
Extraire la modale de rejet en composant partage - 1-2h
Actions prioritaires globales
Immediat (cette semaine)
Factur-X: Soit implementer l'embedding PDF (pdf-lib), soit renommer le bouton honnetement
Approbation: Ajouter les politiques RLS + cles i18n manquantes
Xero/QB: Ajouter un bandeau "Coming Soon" ou desactiver le composant
Court terme (2 semaines)
Report Builder: Ajouter validation dates, preview avant export, templates en DB
Approbation: Notifications email, approbation en masse
Factur-X: Validation XML contre schema XSD
Moyen terme (1 mois+)
Xero/QB: Implementation reelle OAuth + sync (60-80h d'effort)
Report Builder: Graphiques, drag-and-drop sections, pagination complete