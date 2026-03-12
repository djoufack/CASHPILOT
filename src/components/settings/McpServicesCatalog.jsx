import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  FileText, Users, CreditCard, Calculator, BarChart3, Download,
  Truck, Landmark, FileCheck, PieChart, Database, Search,
  Eye, Pencil, Trash2, ChevronDown, ChevronRight, Shield, Wallet, Briefcase
} from 'lucide-react';

const TOOL_CATEGORIES = [
  {
    id: 'auth',
    icon: Shield,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10',
    tools: [
      { name: 'login', desc: 'Se connecter avec email et mot de passe CashPilot', type: 'write' },
      { name: 'logout', desc: 'Se déconnecter et fermer la session', type: 'write' },
      { name: 'whoami', desc: "Vérifier le statut d'authentification", type: 'read' },
    ]
  },
  {
    id: 'invoicing',
    icon: FileText,
    color: 'text-blue-400',
    bg: 'bg-blue-500/10',
    tools: [
      { name: 'list_invoices', desc: 'Lister les factures avec filtres optionnels (statut, client, limite)', type: 'read' },
      { name: 'get_invoice', desc: "Détails complets d'une facture : articles, paiements, client", type: 'read' },
      { name: 'create_invoice', desc: 'Créer une nouvelle facture', type: 'write' },
      { name: 'delete_invoice', desc: 'Supprimer une facture', type: 'delete' },
      { name: 'update_invoice_status', desc: "Mettre à jour le statut d'une facture", type: 'write' },
      { name: 'search_invoices', desc: 'Rechercher des factures par texte (numéro, notes, client)', type: 'read' },
      { name: 'get_invoice_stats', desc: 'Statistiques factures : totaux facturés, payés, impayés, en retard', type: 'read' },
      { name: 'get_dunning_candidates', desc: 'Factures en retard pour relance avec historique de relance', type: 'read' },
      { name: 'list_invoice_items', desc: "Lister les lignes d'une facture", type: 'read' },
      { name: 'create_invoice_items', desc: "Ajouter des lignes à une facture", type: 'write' },
      { name: 'get_invoice_items', desc: "Détails d'une ligne de facture", type: 'read' },
      { name: 'update_invoice_items', desc: 'Modifier une ligne de facture', type: 'write' },
      { name: 'delete_invoice_items', desc: 'Supprimer une ligne de facture', type: 'delete' },
      { name: 'list_invoice_settings', desc: 'Lister les paramètres de facturation', type: 'read' },
      { name: 'create_invoice_settings', desc: 'Créer des paramètres de facturation', type: 'write' },
      { name: 'get_invoice_settings', desc: 'Détails des paramètres de facturation', type: 'read' },
      { name: 'update_invoice_settings', desc: 'Modifier les paramètres de facturation', type: 'write' },
      { name: 'delete_invoice_settings', desc: 'Supprimer des paramètres de facturation', type: 'delete' },
      { name: 'list_recurring_invoices', desc: 'Lister les factures récurrentes', type: 'read' },
      { name: 'create_recurring_invoices', desc: 'Créer une facture récurrente', type: 'write' },
      { name: 'get_recurring_invoices', desc: "Détails d'une facture récurrente", type: 'read' },
      { name: 'update_recurring_invoices', desc: 'Modifier une facture récurrente', type: 'write' },
      { name: 'delete_recurring_invoices', desc: 'Supprimer une facture récurrente', type: 'delete' },
    ]
  },
  {
    id: 'clients',
    icon: Users,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    tools: [
      { name: 'list_clients', desc: 'Lister tous les clients avec recherche optionnelle', type: 'read' },
      { name: 'get_client', desc: 'Détails client avec factures récentes', type: 'read' },
      { name: 'create_client', desc: 'Créer un nouveau client', type: 'write' },
      { name: 'update_client', desc: 'Mettre à jour un client', type: 'write' },
      { name: 'delete_client', desc: 'Archiver un client (soft-delete)', type: 'delete' },
      { name: 'restore_client', desc: 'Restaurer un client archivé', type: 'write' },
      { name: 'list_archived_clients', desc: 'Lister les clients archivés', type: 'read' },
      { name: 'get_client_balance', desc: 'Solde client : factures dues, paiements reçus, encours', type: 'read' },
    ]
  },
  {
    id: 'payments',
    icon: CreditCard,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    tools: [
      { name: 'list_payments', desc: 'Lister les paiements avec filtres optionnels', type: 'read' },
      { name: 'create_payment', desc: "Enregistrer un paiement pour une facture", type: 'write' },
      { name: 'get_unpaid_invoices', desc: 'Factures impayées triées par ancienneté', type: 'read' },
      { name: 'get_receivables_summary', desc: 'Résumé créances : total dû, encaissé, en attente, en retard', type: 'read' },
      { name: 'list_payment_terms', desc: 'Lister les conditions de paiement', type: 'read' },
      { name: 'create_payment_terms', desc: 'Créer des conditions de paiement', type: 'write' },
      { name: 'get_payment_terms', desc: 'Détails conditions de paiement', type: 'read' },
      { name: 'update_payment_terms', desc: 'Modifier conditions de paiement', type: 'write' },
      { name: 'delete_payment_terms', desc: 'Supprimer conditions de paiement', type: 'delete' },
      { name: 'list_payment_reminder_rules', desc: 'Lister les règles de relance', type: 'read' },
      { name: 'create_payment_reminder_rules', desc: 'Créer une règle de relance', type: 'write' },
      { name: 'get_payment_reminder_rules', desc: "Détails d'une règle de relance", type: 'read' },
      { name: 'update_payment_reminder_rules', desc: 'Modifier une règle de relance', type: 'write' },
      { name: 'delete_payment_reminder_rules', desc: 'Supprimer une règle de relance', type: 'delete' },
      { name: 'list_dunning_steps', desc: 'Lister les étapes de relance', type: 'read' },
      { name: 'create_dunning_steps', desc: 'Créer une étape de relance', type: 'write' },
      { name: 'get_dunning_steps', desc: "Détails d'une étape de relance", type: 'read' },
      { name: 'update_dunning_steps', desc: 'Modifier une étape de relance', type: 'write' },
      { name: 'delete_dunning_steps', desc: 'Supprimer une étape de relance', type: 'delete' },
      { name: 'list_dunning_history', desc: "Lister l'historique de relance", type: 'read' },
      { name: 'create_dunning_history', desc: 'Créer un enregistrement de relance', type: 'write' },
      { name: 'get_dunning_history', desc: "Détails d'un enregistrement de relance", type: 'read' },
      { name: 'update_dunning_history', desc: 'Modifier un enregistrement de relance', type: 'write' },
      { name: 'delete_dunning_history', desc: 'Supprimer un enregistrement de relance', type: 'delete' },
    ]
  },
  {
    id: 'suppliers',
    icon: Truck,
    color: 'text-orange-400',
    bg: 'bg-orange-500/10',
    tools: [
      { name: 'list_supplier_invoices', desc: 'Lister les factures fournisseurs avec filtres', type: 'read' },
      { name: 'get_supplier_invoice', desc: 'Détails facture fournisseur avec lignes', type: 'read' },
      { name: 'extract_supplier_invoice', desc: 'Extraire les données via IA (Gemini) — coûte 3 crédits', type: 'write' },
      { name: 'download_supplier_invoice', desc: 'URL temporaire de téléchargement (1h)', type: 'read' },
      { name: 'update_supplier_invoice_status', desc: 'Mettre à jour le statut de paiement', type: 'write' },
      { name: 'get_supplier_balance', desc: 'Solde fournisseur : facturé, payé, encours, en retard', type: 'read' },
      { name: 'list_suppliers', desc: 'Lister les fournisseurs', type: 'read' },
      { name: 'create_suppliers', desc: 'Créer un fournisseur', type: 'write' },
      { name: 'get_suppliers', desc: "Détails d'un fournisseur", type: 'read' },
      { name: 'update_suppliers', desc: 'Modifier un fournisseur', type: 'write' },
      { name: 'delete_suppliers', desc: 'Supprimer un fournisseur', type: 'delete' },
      { name: 'list_supplier_orders', desc: 'Lister les commandes fournisseurs', type: 'read' },
      { name: 'create_supplier_orders', desc: 'Créer une commande fournisseur', type: 'write' },
      { name: 'get_supplier_orders', desc: "Détails d'une commande fournisseur", type: 'read' },
      { name: 'update_supplier_orders', desc: 'Modifier une commande fournisseur', type: 'write' },
      { name: 'delete_supplier_orders', desc: 'Supprimer une commande fournisseur', type: 'delete' },
      { name: 'list_supplier_order_items', desc: "Lister les lignes d'une commande fournisseur", type: 'read' },
      { name: 'create_supplier_order_items', desc: 'Ajouter une ligne de commande fournisseur', type: 'write' },
      { name: 'get_supplier_order_items', desc: "Détails d'une ligne de commande", type: 'read' },
      { name: 'update_supplier_order_items', desc: 'Modifier une ligne de commande', type: 'write' },
      { name: 'delete_supplier_order_items', desc: 'Supprimer une ligne de commande', type: 'delete' },
    ]
  },
  {
    id: 'accounting',
    icon: Calculator,
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    tools: [
      { name: 'get_chart_of_accounts', desc: 'Plan comptable filtrable par catégorie', type: 'read' },
      { name: 'get_accounting_entries', desc: 'Écritures comptables avec filtres', type: 'read' },
      { name: 'get_trial_balance', desc: 'Balance générale : somme débits/crédits par compte', type: 'read' },
      { name: 'get_tax_summary', desc: 'Résumé TVA : collectée vs déductible', type: 'read' },
      { name: 'init_accounting', desc: 'Initialiser le plan comptable (FR, BE, OHADA)', type: 'write' },
      { name: 'run_accounting_audit', desc: 'Audit comptable complet avec score et grade', type: 'read' },
      { name: 'list_accounting_tax_rates', desc: 'Lister les taux de TVA', type: 'read' },
      { name: 'create_accounting_tax_rates', desc: 'Créer un taux de TVA', type: 'write' },
      { name: 'get_accounting_tax_rates', desc: "Détails d'un taux de TVA", type: 'read' },
      { name: 'update_accounting_tax_rates', desc: 'Modifier un taux de TVA', type: 'write' },
      { name: 'delete_accounting_tax_rates', desc: 'Supprimer un taux de TVA', type: 'delete' },
    ]
  },
  {
    id: 'banking',
    icon: Landmark,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    tools: [
      { name: 'auto_reconcile', desc: 'Rapprochement intelligent automatique (scoring montant, référence, client)', type: 'write' },
      { name: 'match_bank_line', desc: 'Rapprocher manuellement une ligne bancaire à un document', type: 'write' },
      { name: 'unmatch_bank_line', desc: 'Annuler un rapprochement bancaire', type: 'write' },
      { name: 'ignore_bank_lines', desc: 'Ignorer des lignes bancaires (frais, virements internes)', type: 'write' },
      { name: 'get_reconciliation_summary', desc: 'Statistiques rapprochement : lignes matchées/non-matchées', type: 'read' },
      { name: 'search_match_candidates', desc: 'Trouver des candidats de rapprochement par score', type: 'read' },
      { name: 'import_bank_statement', desc: 'Importer un relevé bancaire parsé', type: 'write' },
      { name: 'list_bank_connections', desc: 'Lister les connexions bancaires', type: 'read' },
      { name: 'create_bank_connections', desc: 'Créer une connexion bancaire', type: 'write' },
      { name: 'get_bank_connections', desc: "Détails d'une connexion bancaire", type: 'read' },
      { name: 'update_bank_connections', desc: 'Modifier une connexion bancaire', type: 'write' },
      { name: 'delete_bank_connections', desc: 'Supprimer une connexion bancaire', type: 'delete' },
      { name: 'list_bank_statements', desc: 'Lister les relevés bancaires', type: 'read' },
      { name: 'create_bank_statements', desc: 'Créer un relevé bancaire', type: 'write' },
      { name: 'get_bank_statements', desc: "Détails d'un relevé bancaire", type: 'read' },
      { name: 'update_bank_statements', desc: 'Modifier un relevé bancaire', type: 'write' },
      { name: 'delete_bank_statements', desc: 'Supprimer un relevé bancaire', type: 'delete' },
      { name: 'list_bank_statement_lines', desc: "Lister les lignes d'un relevé", type: 'read' },
      { name: 'create_bank_statement_lines', desc: "Ajouter une ligne de relevé", type: 'write' },
      { name: 'get_bank_statement_lines', desc: "Détails d'une ligne de relevé", type: 'read' },
      { name: 'update_bank_statement_lines', desc: 'Modifier une ligne de relevé', type: 'write' },
      { name: 'delete_bank_statement_lines', desc: 'Supprimer une ligne de relevé', type: 'delete' },
      { name: 'list_bank_transactions', desc: 'Lister les transactions bancaires', type: 'read' },
      { name: 'create_bank_transactions', desc: 'Créer une transaction bancaire', type: 'write' },
      { name: 'get_bank_transactions', desc: "Détails d'une transaction", type: 'read' },
      { name: 'update_bank_transactions', desc: 'Modifier une transaction', type: 'write' },
      { name: 'delete_bank_transactions', desc: 'Supprimer une transaction', type: 'delete' },
      { name: 'list_bank_reconciliation_sessions', desc: 'Lister les sessions de rapprochement', type: 'read' },
      { name: 'create_bank_reconciliation_sessions', desc: 'Créer une session de rapprochement', type: 'write' },
      { name: 'get_bank_reconciliation_sessions', desc: "Détails d'une session", type: 'read' },
      { name: 'update_bank_reconciliation_sessions', desc: 'Modifier une session', type: 'write' },
      { name: 'delete_bank_reconciliation_sessions', desc: 'Supprimer une session', type: 'delete' },
    ]
  },
  {
    id: 'financial_instruments',
    icon: Wallet,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    tools: [
      { name: 'list_payment_instruments', desc: 'Lister les comptes bancaires, cartes et caisses', type: 'read' },
      { name: 'create_payment_instrument', desc: "Créer un instrument avec détails et auto-génération du code comptable", type: 'write' },
      { name: 'update_payment_instrument', desc: 'Modifier un instrument financier', type: 'write' },
      { name: 'delete_payment_instrument', desc: 'Supprimer un instrument (refusé si transactions liées)', type: 'delete' },
      { name: 'create_payment_transaction', desc: 'Enregistrer une transaction sur un instrument', type: 'write' },
      { name: 'list_payment_transactions', desc: "Transactions d'un instrument ou d'une période", type: 'read' },
      { name: 'create_payment_transfer', desc: 'Virement entre instruments (crée 2 transactions liées)', type: 'write' },
      { name: 'get_instrument_balance_history', desc: "Historique des soldes d'un instrument", type: 'read' },
      { name: 'get_payment_volume_stats', desc: "Statistiques de volume par type d'instrument", type: 'read' },
      { name: 'get_portfolio_consolidated_summary', desc: 'Vue consolidée multi-instruments', type: 'read' },
      { name: 'list_payment_instrument_bank_accounts', desc: 'Lister les détails de comptes bancaires', type: 'read' },
      { name: 'create_payment_instrument_bank_accounts', desc: 'Créer les détails bancaires', type: 'write' },
      { name: 'get_payment_instrument_bank_accounts', desc: 'Détails bancaires par instrument', type: 'read' },
      { name: 'update_payment_instrument_bank_accounts', desc: 'Modifier les détails bancaires', type: 'write' },
      { name: 'delete_payment_instrument_bank_accounts', desc: 'Supprimer les détails bancaires', type: 'delete' },
      { name: 'list_payment_instrument_cards', desc: 'Lister les détails de cartes', type: 'read' },
      { name: 'create_payment_instrument_cards', desc: 'Créer les détails carte', type: 'write' },
      { name: 'get_payment_instrument_cards', desc: 'Détails carte par instrument', type: 'read' },
      { name: 'update_payment_instrument_cards', desc: 'Modifier les détails carte', type: 'write' },
      { name: 'delete_payment_instrument_cards', desc: 'Supprimer les détails carte', type: 'delete' },
      { name: 'list_payment_instrument_cash_accounts', desc: 'Lister les détails de caisses', type: 'read' },
      { name: 'create_payment_instrument_cash_accounts', desc: 'Créer les détails caisse', type: 'write' },
      { name: 'get_payment_instrument_cash_accounts', desc: 'Détails caisse par instrument', type: 'read' },
      { name: 'update_payment_instrument_cash_accounts', desc: 'Modifier les détails caisse', type: 'write' },
      { name: 'delete_payment_instrument_cash_accounts', desc: 'Supprimer les détails caisse', type: 'delete' },
      { name: 'list_payment_transaction_allocations', desc: 'Lister les ventilations de transactions', type: 'read' },
      { name: 'create_payment_transaction_allocations', desc: 'Créer une ventilation', type: 'write' },
      { name: 'get_payment_transaction_allocations', desc: "Détails d'une ventilation", type: 'read' },
      { name: 'update_payment_transaction_allocations', desc: 'Modifier une ventilation', type: 'write' },
      { name: 'delete_payment_transaction_allocations', desc: 'Supprimer une ventilation', type: 'delete' },
      { name: 'list_payment_alerts', desc: 'Lister les alertes de paiement', type: 'read' },
      { name: 'create_payment_alerts', desc: 'Créer une alerte', type: 'write' },
      { name: 'get_payment_alerts', desc: "Détails d'une alerte", type: 'read' },
      { name: 'update_payment_alerts', desc: 'Modifier une alerte', type: 'write' },
      { name: 'delete_payment_alerts', desc: 'Supprimer une alerte', type: 'delete' },
      { name: 'list_company_portfolios', desc: 'Lister les portefeuilles de sociétés', type: 'read' },
      { name: 'create_company_portfolios', desc: 'Créer un portefeuille', type: 'write' },
      { name: 'get_company_portfolios', desc: "Détails d'un portefeuille", type: 'read' },
      { name: 'update_company_portfolios', desc: 'Modifier un portefeuille', type: 'write' },
      { name: 'delete_company_portfolios', desc: 'Supprimer un portefeuille', type: 'delete' },
      { name: 'list_company_portfolio_members', desc: "Lister les membres d'un portefeuille", type: 'read' },
      { name: 'create_company_portfolio_members', desc: 'Ajouter une société au portefeuille', type: 'write' },
      { name: 'get_company_portfolio_members', desc: "Détails d'un membre", type: 'read' },
      { name: 'update_company_portfolio_members', desc: 'Modifier un membre', type: 'write' },
      { name: 'delete_company_portfolio_members', desc: 'Retirer une société du portefeuille', type: 'delete' },
    ]
  },
  {
    id: 'documents',
    icon: FileCheck,
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10',
    tools: [
      { name: 'create_quote', desc: 'Créer un devis avec lignes — calcul auto totaux et TVA', type: 'write' },
      { name: 'convert_quote_to_invoice', desc: 'Convertir un devis accepté en facture', type: 'write' },
      { name: 'create_credit_note', desc: 'Créer un avoir lié à une facture (partiel ou total)', type: 'write' },
      { name: 'create_expense', desc: 'Enregistrer une dépense — calcul auto HT/TVA depuis TTC', type: 'write' },
      { name: 'list_quotes', desc: 'Lister les devis', type: 'read' },
      { name: 'get_quotes', desc: "Détails d'un devis", type: 'read' },
      { name: 'create_quotes', desc: 'Créer un devis (CRUD)', type: 'write' },
      { name: 'update_quotes', desc: 'Modifier un devis', type: 'write' },
      { name: 'delete_quotes', desc: 'Supprimer un devis', type: 'delete' },
      { name: 'list_credit_notes', desc: 'Lister les avoirs', type: 'read' },
      { name: 'get_credit_notes', desc: "Détails d'un avoir", type: 'read' },
      { name: 'create_credit_notes', desc: 'Créer un avoir (CRUD)', type: 'write' },
      { name: 'update_credit_notes', desc: 'Modifier un avoir', type: 'write' },
      { name: 'delete_credit_notes', desc: 'Supprimer un avoir', type: 'delete' },
      { name: 'list_expenses', desc: 'Lister les dépenses', type: 'read' },
      { name: 'get_expenses', desc: "Détails d'une dépense", type: 'read' },
      { name: 'create_expenses', desc: 'Créer une dépense (CRUD)', type: 'write' },
      { name: 'update_expenses', desc: 'Modifier une dépense', type: 'write' },
      { name: 'delete_expenses', desc: 'Supprimer une dépense', type: 'delete' },
      { name: 'list_purchase_orders', desc: 'Lister les bons de commande', type: 'read' },
      { name: 'create_purchase_orders', desc: 'Créer un bon de commande', type: 'write' },
      { name: 'get_purchase_orders', desc: "Détails d'un bon de commande", type: 'read' },
      { name: 'update_purchase_orders', desc: 'Modifier un bon de commande', type: 'write' },
      { name: 'delete_purchase_orders', desc: 'Supprimer un bon de commande', type: 'delete' },
    ]
  },
  {
    id: 'projects',
    icon: Briefcase,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10',
    tools: [
      { name: 'list_projects', desc: 'Lister les projets par société (filtres client/statut)', type: 'read' },
      { name: 'create_projects', desc: 'Créer un projet', type: 'write' },
      { name: 'get_projects', desc: "Détails d'un projet", type: 'read' },
      { name: 'update_projects', desc: 'Modifier un projet', type: 'write' },
      { name: 'delete_projects', desc: 'Supprimer un projet', type: 'delete' },
      { name: 'list_tasks', desc: 'Lister les tâches projet par société/projet', type: 'read' },
      { name: 'create_tasks', desc: 'Créer une tâche projet', type: 'write' },
      { name: 'get_tasks', desc: "Détails d'une tâche projet", type: 'read' },
      { name: 'update_tasks', desc: 'Modifier une tâche projet', type: 'write' },
      { name: 'delete_tasks', desc: 'Supprimer une tâche projet', type: 'delete' },
      { name: 'list_timesheets', desc: 'Lister les feuilles de temps', type: 'read' },
      { name: 'create_timesheets', desc: 'Créer une entrée de temps', type: 'write' },
      { name: 'get_timesheets', desc: "Détails d'une entrée de temps", type: 'read' },
      { name: 'update_timesheets', desc: 'Modifier une entrée de temps', type: 'write' },
      { name: 'delete_timesheets', desc: 'Supprimer une entrée de temps', type: 'delete' },
    ]
  },
  {
    id: 'crm',
    icon: Users,
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    tools: [
      { name: 'list_crm_leads', desc: 'Lister les leads CRM par société', type: 'read' },
      { name: 'get_crm_pipeline_summary', desc: 'Résumé du pipeline CRM (leads/opportunités/support)', type: 'read' },
      { name: 'list_crm_support_tickets', desc: 'Lister les tickets CRM/SLA', type: 'read' },
      { name: 'create_crm_support_tickets', desc: 'Créer un ticket CRM/SLA', type: 'write' },
      { name: 'get_crm_support_tickets', desc: "Détails d'un ticket CRM/SLA", type: 'read' },
      { name: 'update_crm_support_tickets', desc: 'Modifier un ticket CRM/SLA', type: 'write' },
      { name: 'delete_crm_support_tickets', desc: 'Supprimer un ticket CRM/SLA', type: 'delete' },
      { name: 'list_crm_support_sla_policies', desc: 'Lister les politiques SLA', type: 'read' },
      { name: 'create_crm_support_sla_policies', desc: 'Créer une politique SLA', type: 'write' },
      { name: 'get_crm_support_sla_policies', desc: "Détails d'une politique SLA", type: 'read' },
      { name: 'update_crm_support_sla_policies', desc: 'Modifier une politique SLA', type: 'write' },
      { name: 'delete_crm_support_sla_policies', desc: 'Supprimer une politique SLA', type: 'delete' },
    ]
  },
  {
    id: 'company_finance',
    icon: BarChart3,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    tools: [
      { name: 'list_user_companies', desc: 'Lister toutes les sociétés du user (company_id, nom, pays, devise)', type: 'read' },
      { name: 'get_company_kpis', desc: "KPIs d'UNE société : CA, dépenses, marge, impayés (≠ get_dashboard_kpis qui agrège tout)", type: 'read' },
      { name: 'get_company_cash_flow', desc: "Flux de trésorerie mensuel d'UNE société", type: 'read' },
      { name: 'get_company_financial_summary', desc: "Snapshot financier complet d'UNE société : factures, dépenses par catégorie, créances, dettes", type: 'read' },
      { name: 'get_company_profit_and_loss', desc: "Compte de résultat d'UNE société (écritures comptables classe 6/7)", type: 'read' },
      { name: 'get_company_balance_sheet', desc: "Bilan comptable d'UNE société à une date donnée", type: 'read' },
      { name: 'compare_companies_kpis', desc: 'Comparer les KPIs de TOUTES les sociétés du user — analyse portefeuille', type: 'read' },
    ]
  },
  {
    id: 'reporting',
    icon: PieChart,
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    tools: [
      { name: 'get_profit_and_loss', desc: 'Compte de résultat global par période avec sous-totaux', type: 'read' },
      { name: 'get_balance_sheet', desc: 'Bilan comptable global : actifs, passifs, capitaux propres', type: 'read' },
      { name: 'get_aging_report', desc: 'Balance âgée créances/dettes (30/60/90/120+ jours)', type: 'read' },
      { name: 'get_cash_flow', desc: 'Flux de trésorerie global mensuel : revenus, dépenses, solde net', type: 'read' },
      { name: 'get_dashboard_kpis', desc: 'KPIs globaux : CA mensuel, factures en attente, dépenses, marge', type: 'read' },
      { name: 'get_top_clients', desc: 'Top clients classés par CA total', type: 'read' },
    ]
  },
  {
    id: 'exports',
    icon: Download,
    color: 'text-teal-400',
    bg: 'bg-teal-500/10',
    tools: [
      { name: 'export_fec', desc: 'FEC — Fichier des Écritures Comptables (conformité fiscale FR)', type: 'read' },
      { name: 'export_saft', desc: 'SAF-T XML — Standard Audit File for Tax', type: 'read' },
      { name: 'export_facturx', desc: "Factur-X (CII) XML pour une facture", type: 'read' },
      { name: 'export_ubl', desc: "Peppol BIS Billing 3.0 UBL 2.1 XML", type: 'read' },
      { name: 'backup_all_data', desc: 'Export complet des données en JSON', type: 'read' },
    ]
  },
  {
    id: 'config',
    icon: Database,
    color: 'text-slate-400',
    bg: 'bg-slate-500/10',
    tools: [
      { name: 'list_company', desc: 'Lister les sociétés', type: 'read' },
      { name: 'create_company', desc: 'Créer une société', type: 'write' },
      { name: 'get_company', desc: "Détails d'une société", type: 'read' },
      { name: 'update_company', desc: 'Modifier une société', type: 'write' },
      { name: 'delete_company', desc: 'Supprimer une société', type: 'delete' },
      { name: 'list_service_categories', desc: 'Lister les catégories de services', type: 'read' },
      { name: 'create_service_categories', desc: 'Créer une catégorie de service', type: 'write' },
      { name: 'get_service_categories', desc: "Détails d'une catégorie", type: 'read' },
      { name: 'update_service_categories', desc: 'Modifier une catégorie', type: 'write' },
      { name: 'delete_service_categories', desc: 'Supprimer une catégorie', type: 'delete' },
      { name: 'list_services', desc: 'Lister les services', type: 'read' },
      { name: 'create_services', desc: 'Créer un service', type: 'write' },
      { name: 'get_services', desc: "Détails d'un service", type: 'read' },
      { name: 'update_services', desc: 'Modifier un service', type: 'write' },
      { name: 'delete_services', desc: 'Supprimer un service', type: 'delete' },
      { name: 'list_payables', desc: 'Lister les dettes', type: 'read' },
      { name: 'create_payables', desc: 'Créer une dette', type: 'write' },
      { name: 'get_payables', desc: "Détails d'une dette", type: 'read' },
      { name: 'update_payables', desc: 'Modifier une dette', type: 'write' },
      { name: 'delete_payables', desc: 'Supprimer une dette', type: 'delete' },
      { name: 'list_receivables', desc: 'Lister les créances', type: 'read' },
      { name: 'create_receivables', desc: 'Créer une créance', type: 'write' },
      { name: 'get_receivables', desc: "Détails d'une créance", type: 'read' },
      { name: 'update_receivables', desc: 'Modifier une créance', type: 'write' },
      { name: 'delete_receivables', desc: 'Supprimer une créance', type: 'delete' },
      { name: 'list_products', desc: 'Lister les produits', type: 'read' },
      { name: 'create_products', desc: 'Créer un produit', type: 'write' },
      { name: 'get_products', desc: "Détails d'un produit", type: 'read' },
      { name: 'update_products', desc: 'Modifier un produit', type: 'write' },
      { name: 'delete_products', desc: 'Supprimer un produit', type: 'delete' },
    ]
  },
];

const CATEGORY_LABELS = {
  auth: 'Authentification',
  invoicing: 'Facturation',
  clients: 'Clients',
  payments: 'Paiements & Relances',
  suppliers: 'Fournisseurs & Achats',
  accounting: 'Comptabilité',
  banking: 'Banque & Rapprochement',
  financial_instruments: 'Instruments Financiers',
  documents: 'Documents commerciaux',
  projects: 'Projets & Tâches',
  crm: 'CRM & Support SLA',
  company_finance: 'Finance par société',
  reporting: 'Reporting global & KPIs',
  exports: 'Exports & Conformité',
  config: 'Configuration & Données',
};

const TYPE_CONFIG = {
  read: { label: 'Lecture', icon: Eye, class: 'border-blue-500/30 text-blue-400 bg-blue-500/10' },
  write: { label: 'Écriture', icon: Pencil, class: 'border-orange-500/30 text-orange-400 bg-orange-500/10' },
  delete: { label: 'Suppression', icon: Trash2, class: 'border-red-500/30 text-red-400 bg-red-500/10' },
};

function ToolTypeBadge({ type }) {
  const config = TYPE_CONFIG[type];
  if (!config) return null;
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${config.class}`}>
      <Icon className="w-2.5 h-2.5" />
      {config.label}
    </span>
  );
}

export default function McpServicesCatalog() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState(new Set());
  const [filterType, setFilterType] = useState(null);

  const totalTools = useMemo(() => TOOL_CATEGORIES.reduce((sum, cat) => sum + cat.tools.length, 0), []);

  const filteredCategories = useMemo(() => {
    return TOOL_CATEGORIES.map(cat => {
      const filtered = cat.tools.filter(tool => {
        const matchesSearch = !searchQuery ||
          tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          tool.desc.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = !filterType || tool.type === filterType;
        return matchesSearch && matchesType;
      });
      return { ...cat, tools: filtered };
    }).filter(cat => cat.tools.length > 0);
  }, [searchQuery, filterType]);

  const toggleCategory = (id) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedCategories(new Set(filteredCategories.map(c => c.id)));
  const collapseAll = () => setExpandedCategories(new Set());

  return (
    <div className="space-y-4">
      {/* Header stats */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Badge className="bg-blue-500/10 text-blue-300 border-blue-500/30">
            {totalTools} outils MCP
          </Badge>
          <Badge className="bg-white/5 text-slate-400 border-white/10">
            {TOOL_CATEGORIES.length} catégories
          </Badge>
        </div>
        <div className="flex gap-2 text-xs">
          <button onClick={expandAll} className="text-slate-400 hover:text-white transition-colors">
            Tout déplier
          </button>
          <span className="text-slate-600">|</span>
          <button onClick={collapseAll} className="text-slate-400 hover:text-white transition-colors">
            Tout replier
          </button>
        </div>
      </div>

      {/* Search + filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Rechercher un outil..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-700 bg-slate-800/50 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          />
        </div>
        <div className="flex gap-1.5">
          {[null, 'read', 'write', 'delete'].map(type => (
            <button
              key={type ?? 'all'}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${
                filterType === type
                  ? 'bg-white/10 text-white border-white/20'
                  : 'bg-slate-800/50 text-slate-400 border-slate-700 hover:border-slate-600'
              }`}
            >
              {type ? TYPE_CONFIG[type].label : 'Tous'}
            </button>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div className="space-y-2">
        {filteredCategories.map(cat => {
          const Icon = cat.icon;
          const isExpanded = expandedCategories.has(cat.id);
          return (
            <Card key={cat.id} className="border-white/10 bg-slate-950/70 backdrop-blur overflow-hidden">
              <button
                onClick={() => toggleCategory(cat.id)}
                className="w-full flex items-center gap-3 p-4 text-left hover:bg-white/[0.02] transition-colors"
              >
                <div className={`rounded-lg p-2 ${cat.bg}`}>
                  <Icon className={`w-4 h-4 ${cat.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-white text-sm">{CATEGORY_LABELS[cat.id]}</span>
                    <Badge variant="outline" className="text-[10px] border-slate-600 text-slate-400">
                      {cat.tools.length}
                    </Badge>
                  </div>
                </div>
                {isExpanded
                  ? <ChevronDown className="w-4 h-4 text-slate-500" />
                  : <ChevronRight className="w-4 h-4 text-slate-500" />
                }
              </button>

              {isExpanded && (
                <div className="border-t border-white/5 divide-y divide-white/5">
                  {cat.tools.map(tool => (
                    <div key={tool.name} className="flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.02]">
                      <code className="text-xs text-slate-300 font-mono min-w-[180px] lg:min-w-[240px] truncate">
                        {tool.name}
                      </code>
                      <span className="text-xs text-slate-500 flex-1 truncate">{tool.desc}</span>
                      <ToolTypeBadge type={tool.type} />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {filteredCategories.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <Search className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p>Aucun outil ne correspond à votre recherche</p>
        </div>
      )}
    </div>
  );
}
