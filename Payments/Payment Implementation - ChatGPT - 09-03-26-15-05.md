# Proposition exacte de base de données — extension CashPilot pour les modes de paiement

## Principe de conception

En regardant votre schéma actuel, il y a déjà des briques utiles :

* `company`
* `payments`
* `payment_methods`
* `expenses`
* `debt_payments`
* `bank_connections`
* `bank_transactions`
* `bank_statements`
* `accounting_entries`
* `report_templates`
* `data_export_requests`
* `dashboard_snapshots`

Le problème principal aujourd’hui est que :

* `payment_methods` est trop léger
* `payments.payment_method`, `expenses.payment_method`, `debt_payments.payment_method` sont encore des champs `text`
* il n’existe pas de **registre transactionnel unifié**
* il n’existe pas de notion explicite de **portefeuille de sociétés**
* la traçabilité multi-comptes / multi-cartes / cash reste fragmentée

La meilleure option, **sans casser l’architecture actuelle**, est de :

1. **ajouter une couche centrale de “payment instruments”**
2. **ajouter une table de transactions unifiées**
3. **lier progressivement les tables existantes à cette couche**
4. **introduire la notion de portefeuille**
5. **préparer les exports et statistiques sur une base analytique propre**

---

# 1) Stratégie recommandée

## Choix de compatibilité

Je recommande de :

* **conserver** la table existante `payment_methods`
* **ne pas la surcharger**
* créer plutôt une nouvelle table métier :
  **`company_payment_instruments`**

Pourquoi :

* `payment_methods` actuelle ressemble plutôt à un catalogue ou paramétrage UI
* la transformer en table transactionnelle casserait trop de logique existante
* une nouvelle table évite les régressions

---

# 2) Nouvelles tables proposées

## A. Portefeuilles de sociétés

Votre schéma actuel ne contient pas de portefeuille. Il faut l’introduire proprement.

### Table `company_portfolios`

```sql
create table public.company_portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_name text not null,
  description text,
  base_currency character varying(3) not null default 'EUR'
    check (base_currency ~ '^[A-Z]{3}$'),
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
```

### Table `company_portfolio_members`

```sql
create table public.company_portfolio_members (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.company_portfolios(id) on delete cascade,
  company_id uuid not null references public.company(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  unique (portfolio_id, company_id)
);
```

### Index

```sql
create index idx_company_portfolios_user_id
  on public.company_portfolios(user_id);

create index idx_company_portfolio_members_portfolio_id
  on public.company_portfolio_members(portfolio_id);

create index idx_company_portfolio_members_company_id
  on public.company_portfolio_members(company_id);
```

---

## B. Instruments de paiement réels par société

### Table `company_payment_instruments`

Cette table est le cœur métier.

```sql
create table public.company_payment_instruments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.company(id) on delete cascade,
  portfolio_id uuid references public.company_portfolios(id) on delete set null,

  instrument_type text not null check (
    instrument_type in ('bank_account', 'card', 'cash')
  ),

  instrument_subtype text check (
    instrument_subtype in (
      'checking',
      'savings',
      'credit_card',
      'debit_card',
      'petty_cash',
      'cash_register',
      'mobile_money',
      'other'
    )
  ),

  code text not null,
  label text not null,
  display_name text,
  description text,

  currency character varying(3) not null default 'EUR'
    check (currency ~ '^[A-Z]{3}$'),

  status text not null default 'active' check (
    status in ('active', 'inactive', 'archived', 'blocked')
  ),

  is_default boolean not null default false,
  allow_incoming boolean not null default true,
  allow_outgoing boolean not null default true,
  include_in_dashboard boolean not null default true,

  opening_balance numeric(18,2) not null default 0,
  current_balance numeric(18,2) not null default 0,

  external_provider text,
  external_reference text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  archived_at timestamp with time zone,

  unique (company_id, code)
);
```

### Index

```sql
create index idx_company_payment_instruments_user_id
  on public.company_payment_instruments(user_id);

create index idx_company_payment_instruments_company_id
  on public.company_payment_instruments(company_id);

create index idx_company_payment_instruments_portfolio_id
  on public.company_payment_instruments(portfolio_id);

create index idx_company_payment_instruments_type
  on public.company_payment_instruments(instrument_type);

create index idx_company_payment_instruments_status
  on public.company_payment_instruments(status);
```

---

## C. Détails spécifiques comptes bancaires

### Table `payment_instrument_bank_accounts`

```sql
create table public.payment_instrument_bank_accounts (
  instrument_id uuid primary key references public.company_payment_instruments(id) on delete cascade,

  bank_connection_id uuid references public.bank_connections(id) on delete set null,

  bank_name text,
  account_holder text,
  iban_masked text,
  iban_encrypted text,
  bic_swift text,
  account_number_masked text,
  institution_country text,

  account_kind text check (
    account_kind in ('checking', 'savings', 'business', 'escrow', 'other')
  ),

  statement_import_enabled boolean not null default false,
  api_sync_enabled boolean not null default false,

  last_sync_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
```

---

## D. Détails spécifiques cartes

### Table `payment_instrument_cards`

```sql
create table public.payment_instrument_cards (
  instrument_id uuid primary key references public.company_payment_instruments(id) on delete cascade,

  card_brand text,
  card_type text not null check (
    card_type in ('debit', 'credit', 'prepaid', 'virtual')
  ),

  holder_name text,
  last4 text check (char_length(last4) <= 4),
  expiry_month integer check (expiry_month between 1 and 12),
  expiry_year integer,
  issuer_name text,

  billing_cycle_day integer check (billing_cycle_day between 1 and 31),
  statement_due_day integer check (statement_due_day between 1 and 31),

  credit_limit numeric(18,2),
  available_credit numeric(18,2),

  network_token text,
  is_virtual boolean not null default false,

  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
```

> Ici, on ne stocke **jamais** le PAN complet ni le CVV.

---

## E. Détails spécifiques cash / caisse

### Table `payment_instrument_cash_accounts`

```sql
create table public.payment_instrument_cash_accounts (
  instrument_id uuid primary key references public.company_payment_instruments(id) on delete cascade,

  cash_point_name text not null,
  custodian_user_id uuid references auth.users(id) on delete set null,
  location text,
  max_authorized_balance numeric(18,2),
  reconciliation_frequency text check (
    reconciliation_frequency in ('daily', 'weekly', 'monthly', 'manual')
  ) default 'manual',

  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);
```

---

## F. Table centrale des transactions de paiement

### Table `payment_transactions`

C’est la table la plus importante.

```sql
create table public.payment_transactions (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.company(id) on delete cascade,
  portfolio_id uuid references public.company_portfolios(id) on delete set null,

  payment_instrument_id uuid not null
    references public.company_payment_instruments(id) on delete restrict,

  transaction_kind text not null check (
    transaction_kind in (
      'income',
      'expense',
      'transfer_in',
      'transfer_out',
      'refund_in',
      'refund_out',
      'fee',
      'adjustment',
      'withdrawal',
      'deposit'
    )
  ),

  flow_direction text not null check (
    flow_direction in ('inflow', 'outflow')
  ),

  status text not null default 'posted' check (
    status in ('draft', 'pending', 'posted', 'reconciled', 'cancelled')
  ),

  source_module text not null check (
    source_module in (
      'payments',
      'expenses',
      'debt_payments',
      'bank_transactions',
      'manual',
      'supplier_invoices',
      'receivables',
      'payables',
      'transfers'
    )
  ),

  source_table text,
  source_id uuid,

  transaction_date date not null,
  posting_date date,
  value_date date,

  amount numeric(18,2) not null check (amount > 0),
  currency character varying(3) not null default 'EUR'
    check (currency ~ '^[A-Z]{3}$'),

  company_currency character varying(3)
    check (company_currency is null or company_currency ~ '^[A-Z]{3}$'),

  fx_rate numeric(18,8),
  amount_company_currency numeric(18,2),

  counterparty_name text,
  description text,
  reference text,
  external_reference text,

  category text,
  subcategory text,

  analytical_axis_id uuid references public.accounting_analytical_axes(id) on delete set null,

  attachment_url text,
  notes text,

  is_internal_transfer boolean not null default false,
  transfer_group_id uuid,

  matched_bank_transaction_id uuid references public.bank_transactions(id) on delete set null,

  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,

  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone
);
```

### Index

```sql
create index idx_payment_transactions_user_id
  on public.payment_transactions(user_id);

create index idx_payment_transactions_company_id
  on public.payment_transactions(company_id);

create index idx_payment_transactions_portfolio_id
  on public.payment_transactions(portfolio_id);

create index idx_payment_transactions_payment_instrument_id
  on public.payment_transactions(payment_instrument_id);

create index idx_payment_transactions_transaction_date
  on public.payment_transactions(transaction_date desc);

create index idx_payment_transactions_source
  on public.payment_transactions(source_module, source_id);

create index idx_payment_transactions_transfer_group_id
  on public.payment_transactions(transfer_group_id);

create index idx_payment_transactions_status
  on public.payment_transactions(status);
```

---

## G. Affectation d’une transaction à un document métier

Certaines transactions pourront être liées à plusieurs pièces métier.

### Table `payment_transaction_allocations`

```sql
create table public.payment_transaction_allocations (
  id uuid primary key default gen_random_uuid(),

  payment_transaction_id uuid not null
    references public.payment_transactions(id) on delete cascade,

  allocation_type text not null check (
    allocation_type in (
      'invoice',
      'expense',
      'supplier_invoice',
      'receivable',
      'payable',
      'credit_note',
      'manual'
    )
  ),

  target_id uuid not null,
  allocated_amount numeric(18,2) not null check (allocated_amount > 0),
  notes text,
  created_at timestamp with time zone not null default now()
);
```

### Index

```sql
create index idx_payment_transaction_allocations_payment_transaction_id
  on public.payment_transaction_allocations(payment_transaction_id);

create index idx_payment_transaction_allocations_target
  on public.payment_transaction_allocations(allocation_type, target_id);
```

---

## H. Transferts entre instruments

### Table `payment_transfers`

```sql
create table public.payment_transfers (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.company(id) on delete cascade,
  portfolio_id uuid references public.company_portfolios(id) on delete set null,

  from_instrument_id uuid not null
    references public.company_payment_instruments(id) on delete restrict,

  to_instrument_id uuid not null
    references public.company_payment_instruments(id) on delete restrict,

  transfer_date date not null,
  amount numeric(18,2) not null check (amount > 0),
  currency character varying(3) not null default 'EUR'
    check (currency ~ '^[A-Z]{3}$'),

  fee_amount numeric(18,2) not null default 0 check (fee_amount >= 0),
  reference text,
  notes text,

  status text not null default 'posted' check (
    status in ('draft', 'pending', 'posted', 'cancelled')
  ),

  transfer_group_id uuid not null default gen_random_uuid(),

  outflow_transaction_id uuid references public.payment_transactions(id) on delete set null,
  inflow_transaction_id uuid references public.payment_transactions(id) on delete set null,

  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  check (from_instrument_id <> to_instrument_id)
);
```

---

## I. Historique / audit métier des moyens de paiement

### Table `payment_instrument_audit_log`

```sql
create table public.payment_instrument_audit_log (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references auth.users(id) on delete set null,
  company_id uuid references public.company(id) on delete set null,
  payment_instrument_id uuid references public.company_payment_instruments(id) on delete cascade,

  action text not null check (
    action in (
      'created',
      'updated',
      'status_changed',
      'archived',
      'unarchived',
      'balance_adjusted',
      'exported'
    )
  ),

  old_data jsonb,
  new_data jsonb,
  context jsonb not null default '{}'::jsonb,

  created_at timestamp with time zone not null default now()
);
```

---

## J. Exports de rapports de paiement

Pour ne pas détourner `data_export_requests`, je recommande une table spécialisée.

### Table `payment_report_exports`

```sql
create table public.payment_report_exports (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.company(id) on delete set null,
  portfolio_id uuid references public.company_portfolios(id) on delete set null,

  export_scope text not null check (
    export_scope in ('company', 'portfolio', 'instrument', 'transaction_list')
  ),

  export_format text not null check (
    export_format in ('pdf', 'html')
  ),

  status text not null default 'pending' check (
    status in ('pending', 'processing', 'completed', 'failed')
  ),

  filters jsonb not null default '{}'::jsonb,
  file_url text,
  file_size bigint,
  generated_at timestamp with time zone,
  expires_at timestamp with time zone,
  error_message text,

  created_at timestamp with time zone not null default now()
);
```

---

# 3) Modifications exactes sur les tables existantes

## A. Ajouter la notion de portefeuille à `company`

```sql
alter table public.company
add column portfolio_id uuid references public.company_portfolios(id) on delete set null;
```

### Index

```sql
create index idx_company_portfolio_id
  on public.company(portfolio_id);
```

---

## B. Faire évoluer `payments`

Aujourd’hui `payments.payment_method` est un `text`.
Il faut garder la compatibilité, mais ajouter la vraie relation.

```sql
alter table public.payments
add column payment_instrument_id uuid
  references public.company_payment_instruments(id) on delete set null,
add column payment_transaction_id uuid
  references public.payment_transactions(id) on delete set null;
```

### Index

```sql
create index idx_payments_payment_instrument_id
  on public.payments(payment_instrument_id);

create index idx_payments_payment_transaction_id
  on public.payments(payment_transaction_id);
```

---

## C. Faire évoluer `expenses`

```sql
alter table public.expenses
add column payment_instrument_id uuid
  references public.company_payment_instruments(id) on delete set null,
add column payment_transaction_id uuid
  references public.payment_transactions(id) on delete set null;
```

### Index

```sql
create index idx_expenses_payment_instrument_id
  on public.expenses(payment_instrument_id);

create index idx_expenses_payment_transaction_id
  on public.expenses(payment_transaction_id);
```

---

## D. Faire évoluer `debt_payments`

```sql
alter table public.debt_payments
add column payment_instrument_id uuid
  references public.company_payment_instruments(id) on delete set null,
add column payment_transaction_id uuid
  references public.payment_transactions(id) on delete set null;
```

### Index

```sql
create index idx_debt_payments_payment_instrument_id
  on public.debt_payments(payment_instrument_id);

create index idx_debt_payments_payment_transaction_id
  on public.debt_payments(payment_transaction_id);
```

---

## E. Relier `bank_transactions` à l’instrument bancaire

```sql
alter table public.bank_transactions
add column payment_instrument_id uuid
  references public.company_payment_instruments(id) on delete set null,
add column payment_transaction_id uuid
  references public.payment_transactions(id) on delete set null;
```

### Index

```sql
create index idx_bank_transactions_payment_instrument_id
  on public.bank_transactions(payment_instrument_id);

create index idx_bank_transactions_payment_transaction_id
  on public.bank_transactions(payment_transaction_id);
```

---

## F. Relier `bank_statements` au compte bancaire réel

```sql
alter table public.bank_statements
add column payment_instrument_id uuid
  references public.company_payment_instruments(id) on delete set null,
add column company_id uuid
  references public.company(id) on delete set null;
```

### Index

```sql
create index idx_bank_statements_payment_instrument_id
  on public.bank_statements(payment_instrument_id);

create index idx_bank_statements_company_id
  on public.bank_statements(company_id);
```

---

## G. Étendre `bank_connections`

La table existe déjà et est très utile.
Je recommande de lier explicitement chaque connexion à un instrument bancaire.

```sql
alter table public.bank_connections
add column payment_instrument_id uuid
  references public.company_payment_instruments(id) on delete set null;
```

### Index

```sql
create index idx_bank_connections_payment_instrument_id
  on public.bank_connections(payment_instrument_id);
```

---

# 4) Vues analytiques recommandées

## A. Vue synthèse par instrument

```sql
create or replace view public.v_payment_instrument_stats as
select
  pi.id as payment_instrument_id,
  pi.user_id,
  pi.company_id,
  pi.portfolio_id,
  pi.instrument_type,
  pi.instrument_subtype,
  pi.label,
  pi.currency,
  count(pt.id) as transaction_count,
  coalesce(sum(case when pt.flow_direction = 'inflow' then pt.amount else 0 end), 0) as total_inflow,
  coalesce(sum(case when pt.flow_direction = 'outflow' then pt.amount else 0 end), 0) as total_outflow,
  coalesce(sum(case
    when pt.flow_direction = 'inflow' then pt.amount
    when pt.flow_direction = 'outflow' then -pt.amount
    else 0
  end), 0) as net_flow
from public.company_payment_instruments pi
left join public.payment_transactions pt
  on pt.payment_instrument_id = pi.id
 and pt.deleted_at is null
 and pt.status in ('posted', 'reconciled')
group by
  pi.id, pi.user_id, pi.company_id, pi.portfolio_id,
  pi.instrument_type, pi.instrument_subtype, pi.label, pi.currency;
```

---

## B. Vue synthèse par société

```sql
create or replace view public.v_company_payment_stats as
select
  pt.user_id,
  pt.company_id,
  pt.portfolio_id,
  count(pt.id) as transaction_count,
  coalesce(sum(case when pt.flow_direction = 'inflow' then pt.amount else 0 end), 0) as total_inflow,
  coalesce(sum(case when pt.flow_direction = 'outflow' then pt.amount else 0 end), 0) as total_outflow,
  coalesce(sum(case
    when pt.flow_direction = 'inflow' then pt.amount
    when pt.flow_direction = 'outflow' then -pt.amount
    else 0
  end), 0) as net_flow
from public.payment_transactions pt
where pt.deleted_at is null
  and pt.status in ('posted', 'reconciled')
group by pt.user_id, pt.company_id, pt.portfolio_id;
```

---

## C. Vue synthèse par portefeuille

```sql
create or replace view public.v_portfolio_payment_stats as
select
  pt.user_id,
  pt.portfolio_id,
  count(pt.id) as transaction_count,
  coalesce(sum(case when pt.flow_direction = 'inflow' then pt.amount else 0 end), 0) as total_inflow,
  coalesce(sum(case when pt.flow_direction = 'outflow' then pt.amount else 0 end), 0) as total_outflow,
  coalesce(sum(case
    when pt.flow_direction = 'inflow' then pt.amount
    when pt.flow_direction = 'outflow' then -pt.amount
    else 0
  end), 0) as net_flow
from public.payment_transactions pt
where pt.deleted_at is null
  and pt.status in ('posted', 'reconciled')
  and pt.portfolio_id is not null
group by pt.user_id, pt.portfolio_id;
```

---

# 5) RLS Supabase recommandée

## Principe

Toutes les nouvelles tables doivent être protégées par RLS sur :

* `user_id`
* ou appartenance à une `company` appartenant au `user_id`

Exemple de base :

```sql
alter table public.company_portfolios enable row level security;
alter table public.company_portfolio_members enable row level security;
alter table public.company_payment_instruments enable row level security;
alter table public.payment_instrument_bank_accounts enable row level security;
alter table public.payment_instrument_cards enable row level security;
alter table public.payment_instrument_cash_accounts enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.payment_transaction_allocations enable row level security;
alter table public.payment_transfers enable row level security;
alter table public.payment_instrument_audit_log enable row level security;
alter table public.payment_report_exports enable row level security;
```

### Exemple de policy

```sql
create policy "users_can_manage_their_portfolios"
on public.company_portfolios
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());
```

Même logique pour les autres tables.

---

# 6) Règles métiers à implémenter en base

## Contraintes importantes

### Un seul moyen par défaut par type et par société

Option recommandée via index partiel :

```sql
create unique index uq_company_default_instrument_per_type
on public.company_payment_instruments(company_id, instrument_type)
where is_default = true and status = 'active';
```

---

### Cohérence compagnie / portefeuille

Mettre un trigger pour :

* récupérer `portfolio_id` depuis `company.portfolio_id`
* le recopier automatiquement dans :

  * `company_payment_instruments`
  * `payment_transactions`
  * `payment_transfers`

---

### Cohérence sur les transferts

Un transfert doit créer :

* une transaction `transfer_out`
* une transaction `transfer_in`

liées par le même `transfer_group_id`.

---

# 7) Plan de migration depuis l’existant

## Étape 1 — création des nouvelles tables

Créer toutes les nouvelles tables sans toucher aux usages existants.

## Étape 2 — peuplement initial des instruments

### Depuis `company`

Créer automatiquement pour chaque société :

* un instrument bancaire par défaut si `company.iban` ou `company.bank_account` existe
* un instrument cash par défaut

### Depuis `bank_connections`

Créer ou relier les instruments bancaires réels

### Depuis `payment_methods`

Migrer les valeurs métier existantes en alias ou mapping UI si nécessaire

---

## Étape 3 — backfill transactionnel

### `payments`

Pour chaque ligne :

* créer une ligne dans `payment_transactions`
* lier `payments.payment_transaction_id`

### `expenses`

Même logique

### `debt_payments`

Même logique

### `bank_transactions`

Associer ou créer les transactions unifiées correspondantes

---

## Étape 4 — dépréciation progressive des champs texte

À terme, ces champs deviennent hérités :

* `payments.payment_method`
* `expenses.payment_method`
* `debt_payments.payment_method`

Ils peuvent être gardés temporairement pour compatibilité UI/API.

---

# 8) Pourquoi cette proposition colle bien à votre schéma actuel

## Compatibilité forte avec l’existant

Elle s’intègre naturellement avec :

* `company`
* `bank_connections`
* `bank_transactions`
* `bank_statements`
* `payments`
* `expenses`
* `debt_payments`
* `accounting_entries`
* `dashboard_snapshots`
* `data_export_requests`

## Avantages

* pas de refonte destructrice
* traçabilité unifiée
* multi-comptes bancaires natif
* multi-cartes natif
* cash natif
* portefeuille multi-sociétés natif
* analytics propres
* exports PDF/HTML faciles

---

# 9) Suggestions à forte valeur ajoutée à intégrer dès la base

## A. Table de rapprochement explicite

```sql
create table public.payment_reconciliations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.company(id) on delete cascade,
  payment_transaction_id uuid not null references public.payment_transactions(id) on delete cascade,
  bank_transaction_id uuid references public.bank_transactions(id) on delete set null,
  statement_line_id uuid references public.bank_statement_lines(id) on delete set null,
  reconciliation_status text not null check (
    reconciliation_status in ('matched', 'partial', 'manual', 'rejected')
  ),
  matched_amount numeric(18,2),
  confidence_score numeric(5,2),
  notes text,
  created_at timestamp with time zone not null default now(),
  reconciled_by uuid references auth.users(id) on delete set null
);
```

Très utile pour l’audit et les stats de rapprochement.

---

## B. Table d’alertes de paiement

```sql
create table public.payment_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.company(id) on delete cascade,
  payment_instrument_id uuid references public.company_payment_instruments(id) on delete cascade,
  alert_type text not null check (
    alert_type in (
      'low_balance',
      'negative_balance',
      'credit_limit_reached',
      'large_cash_movement',
      'sync_failed',
      'reconciliation_gap'
    )
  ),
  severity text not null check (severity in ('info', 'warning', 'critical')),
  title text not null,
  message text,
  is_resolved boolean not null default false,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);
```

---

# 10) Recommandation finale

## Modèle cible

Je recommande officiellement :

* **nouvelle entité centrale** : `company_payment_instruments`
* **nouvelle table centrale** : `payment_transactions`
* **nouvelle dimension organisationnelle** : `company_portfolios`
* **migration progressive** des tables existantes
* **maintien de compatibilité** avec `payments`, `expenses`, `debt_payments`, `bank_transactions`

## Ce qu’il ne faut pas faire

Je déconseille de :

* transformer brutalement `payment_methods` actuelle en table métier principale
* garder uniquement des champs `payment_method text`
* faire les stats directement depuis `payments + expenses + bank_transactions` sans registre central

---

# 11) Ordre de livraison conseillé

## Sprint 1

* `company_portfolios`
* `company_portfolio_members`
* `company_payment_instruments`
* tables détails bank/card/cash

## Sprint 2

* `payment_transactions`
* `payment_transfers`
* migration `payments`, `expenses`, `debt_payments`

## Sprint 3

* liaison `bank_connections`, `bank_transactions`, `bank_statements`
* rapprochement
* vues analytiques

## Sprint 4

* exports PDF/HTML
* alertes
* dashboards portefeuille

---

Je peux maintenant vous fournir la **version complète prête à exécuter en SQL Supabase/PostgreSQL**, avec :

* `CREATE TABLE`
* `ALTER TABLE`
* `INDEX`
* `RLS`
* `TRIGGERS`
* et **scripts de migration de données depuis les tables existantes**.
# SQL complet prêt pour Supabase/PostgreSQL

Ci-dessous, je vous propose une **version exécutable** et cohérente avec votre schéma actuel CashPilot.

## Objectif couvert

Cette migration ajoute :

* les **portefeuilles de sociétés**
* les **instruments de paiement réels** par société
* la **traçabilité unifiée** de toutes les transactions
* les **transferts internes**
* les **exports**
* les **vues statistiques**
* les **triggers de cohérence**
* les **policies RLS**
* un **backfill initial** depuis l’existant

---

# 1) Migration SQL — structure complète

```sql
begin;

-- =========================================================
-- 0. EXTENSIONS / HELPERS
-- =========================================================

create extension if not exists pgcrypto;

-- =========================================================
-- 1. PORTEFEUILLES
-- =========================================================

create table if not exists public.company_portfolios (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  portfolio_name text not null,
  description text,
  base_currency character varying(3) not null default 'EUR'
    check (base_currency ~ '^[A-Z]{3}$'),
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create unique index if not exists uq_company_portfolios_default_per_user
  on public.company_portfolios(user_id)
  where is_default = true;

create index if not exists idx_company_portfolios_user_id
  on public.company_portfolios(user_id);

create table if not exists public.company_portfolio_members (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.company_portfolios(id) on delete cascade,
  company_id uuid not null references public.company(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamp with time zone not null default now(),
  unique (portfolio_id, company_id)
);

create index if not exists idx_company_portfolio_members_portfolio_id
  on public.company_portfolio_members(portfolio_id);

create index if not exists idx_company_portfolio_members_company_id
  on public.company_portfolio_members(company_id);

create index if not exists idx_company_portfolio_members_user_id
  on public.company_portfolio_members(user_id);

-- =========================================================
-- 2. LIEN PORTEFEUILLE SUR COMPANY
-- =========================================================

alter table public.company
  add column if not exists portfolio_id uuid references public.company_portfolios(id) on delete set null;

create index if not exists idx_company_portfolio_id
  on public.company(portfolio_id);

-- =========================================================
-- 3. INSTRUMENTS DE PAIEMENT
-- =========================================================

create table if not exists public.company_payment_instruments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.company(id) on delete cascade,
  portfolio_id uuid references public.company_portfolios(id) on delete set null,

  instrument_type text not null check (
    instrument_type in ('bank_account', 'card', 'cash')
  ),

  instrument_subtype text check (
    instrument_subtype in (
      'checking',
      'savings',
      'credit_card',
      'debit_card',
      'petty_cash',
      'cash_register',
      'mobile_money',
      'other'
    )
  ),

  code text not null,
  label text not null,
  display_name text,
  description text,

  currency character varying(3) not null default 'EUR'
    check (currency ~ '^[A-Z]{3}$'),

  status text not null default 'active' check (
    status in ('active', 'inactive', 'archived', 'blocked')
  ),

  is_default boolean not null default false,
  allow_incoming boolean not null default true,
  allow_outgoing boolean not null default true,
  include_in_dashboard boolean not null default true,

  opening_balance numeric(18,2) not null default 0,
  current_balance numeric(18,2) not null default 0,

  external_provider text,
  external_reference text,

  metadata jsonb not null default '{}'::jsonb,

  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  archived_at timestamp with time zone,

  unique (company_id, code)
);

create index if not exists idx_company_payment_instruments_user_id
  on public.company_payment_instruments(user_id);

create index if not exists idx_company_payment_instruments_company_id
  on public.company_payment_instruments(company_id);

create index if not exists idx_company_payment_instruments_portfolio_id
  on public.company_payment_instruments(portfolio_id);

create index if not exists idx_company_payment_instruments_type
  on public.company_payment_instruments(instrument_type);

create index if not exists idx_company_payment_instruments_status
  on public.company_payment_instruments(status);

create unique index if not exists uq_company_default_instrument_per_type
  on public.company_payment_instruments(company_id, instrument_type)
  where is_default = true and status = 'active';

-- =========================================================
-- 4. DETAILS BANCAIRES
-- =========================================================

create table if not exists public.payment_instrument_bank_accounts (
  instrument_id uuid primary key references public.company_payment_instruments(id) on delete cascade,

  bank_connection_id uuid references public.bank_connections(id) on delete set null,

  bank_name text,
  account_holder text,
  iban_masked text,
  iban_encrypted text,
  bic_swift text,
  account_number_masked text,
  institution_country text,

  account_kind text check (
    account_kind in ('checking', 'savings', 'business', 'escrow', 'other')
  ),

  statement_import_enabled boolean not null default false,
  api_sync_enabled boolean not null default false,

  last_sync_at timestamp with time zone,
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- =========================================================
-- 5. DETAILS CARTES
-- =========================================================

create table if not exists public.payment_instrument_cards (
  instrument_id uuid primary key references public.company_payment_instruments(id) on delete cascade,

  card_brand text,
  card_type text not null check (
    card_type in ('debit', 'credit', 'prepaid', 'virtual')
  ),

  holder_name text,
  last4 text check (char_length(last4) <= 4),
  expiry_month integer check (expiry_month between 1 and 12),
  expiry_year integer,
  issuer_name text,

  billing_cycle_day integer check (billing_cycle_day between 1 and 31),
  statement_due_day integer check (statement_due_day between 1 and 31),

  credit_limit numeric(18,2),
  available_credit numeric(18,2),

  network_token text,
  is_virtual boolean not null default false,

  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- =========================================================
-- 6. DETAILS CASH / CAISSE
-- =========================================================

create table if not exists public.payment_instrument_cash_accounts (
  instrument_id uuid primary key references public.company_payment_instruments(id) on delete cascade,

  cash_point_name text not null,
  custodian_user_id uuid references auth.users(id) on delete set null,
  location text,
  max_authorized_balance numeric(18,2),
  reconciliation_frequency text not null default 'manual' check (
    reconciliation_frequency in ('daily', 'weekly', 'monthly', 'manual')
  ),

  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

-- =========================================================
-- 7. TRANSACTIONS UNIFIEES
-- =========================================================

create table if not exists public.payment_transactions (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.company(id) on delete cascade,
  portfolio_id uuid references public.company_portfolios(id) on delete set null,

  payment_instrument_id uuid not null
    references public.company_payment_instruments(id) on delete restrict,

  transaction_kind text not null check (
    transaction_kind in (
      'income',
      'expense',
      'transfer_in',
      'transfer_out',
      'refund_in',
      'refund_out',
      'fee',
      'adjustment',
      'withdrawal',
      'deposit'
    )
  ),

  flow_direction text not null check (
    flow_direction in ('inflow', 'outflow')
  ),

  status text not null default 'posted' check (
    status in ('draft', 'pending', 'posted', 'reconciled', 'cancelled')
  ),

  source_module text not null check (
    source_module in (
      'payments',
      'expenses',
      'debt_payments',
      'bank_transactions',
      'manual',
      'supplier_invoices',
      'receivables',
      'payables',
      'transfers'
    )
  ),

  source_table text,
  source_id uuid,

  transaction_date date not null,
  posting_date date,
  value_date date,

  amount numeric(18,2) not null check (amount > 0),
  currency character varying(3) not null default 'EUR'
    check (currency ~ '^[A-Z]{3}$'),

  company_currency character varying(3)
    check (company_currency is null or company_currency ~ '^[A-Z]{3}$'),

  fx_rate numeric(18,8),
  amount_company_currency numeric(18,2),

  counterparty_name text,
  description text,
  reference text,
  external_reference text,

  category text,
  subcategory text,

  analytical_axis_id uuid references public.accounting_analytical_axes(id) on delete set null,

  attachment_url text,
  notes text,

  is_internal_transfer boolean not null default false,
  transfer_group_id uuid,

  matched_bank_transaction_id uuid references public.bank_transactions(id) on delete set null,

  created_by uuid references auth.users(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,

  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),
  deleted_at timestamp with time zone
);

create index if not exists idx_payment_transactions_user_id
  on public.payment_transactions(user_id);

create index if not exists idx_payment_transactions_company_id
  on public.payment_transactions(company_id);

create index if not exists idx_payment_transactions_portfolio_id
  on public.payment_transactions(portfolio_id);

create index if not exists idx_payment_transactions_payment_instrument_id
  on public.payment_transactions(payment_instrument_id);

create index if not exists idx_payment_transactions_transaction_date
  on public.payment_transactions(transaction_date desc);

create index if not exists idx_payment_transactions_source
  on public.payment_transactions(source_module, source_id);

create index if not exists idx_payment_transactions_transfer_group_id
  on public.payment_transactions(transfer_group_id);

create index if not exists idx_payment_transactions_status
  on public.payment_transactions(status);

-- =========================================================
-- 8. ALLOCATIONS
-- =========================================================

create table if not exists public.payment_transaction_allocations (
  id uuid primary key default gen_random_uuid(),

  payment_transaction_id uuid not null
    references public.payment_transactions(id) on delete cascade,

  allocation_type text not null check (
    allocation_type in (
      'invoice',
      'expense',
      'supplier_invoice',
      'receivable',
      'payable',
      'credit_note',
      'manual'
    )
  ),

  target_id uuid not null,
  allocated_amount numeric(18,2) not null check (allocated_amount > 0),
  notes text,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_payment_transaction_allocations_payment_transaction_id
  on public.payment_transaction_allocations(payment_transaction_id);

create index if not exists idx_payment_transaction_allocations_target
  on public.payment_transaction_allocations(allocation_type, target_id);

-- =========================================================
-- 9. TRANSFERTS INTERNES
-- =========================================================

create table if not exists public.payment_transfers (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.company(id) on delete cascade,
  portfolio_id uuid references public.company_portfolios(id) on delete set null,

  from_instrument_id uuid not null
    references public.company_payment_instruments(id) on delete restrict,

  to_instrument_id uuid not null
    references public.company_payment_instruments(id) on delete restrict,

  transfer_date date not null,
  amount numeric(18,2) not null check (amount > 0),
  currency character varying(3) not null default 'EUR'
    check (currency ~ '^[A-Z]{3}$'),

  fee_amount numeric(18,2) not null default 0 check (fee_amount >= 0),
  reference text,
  notes text,

  status text not null default 'posted' check (
    status in ('draft', 'pending', 'posted', 'cancelled')
  ),

  transfer_group_id uuid not null default gen_random_uuid(),

  outflow_transaction_id uuid references public.payment_transactions(id) on delete set null,
  inflow_transaction_id uuid references public.payment_transactions(id) on delete set null,

  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now(),

  check (from_instrument_id <> to_instrument_id)
);

create index if not exists idx_payment_transfers_user_id
  on public.payment_transfers(user_id);

create index if not exists idx_payment_transfers_company_id
  on public.payment_transfers(company_id);

create index if not exists idx_payment_transfers_portfolio_id
  on public.payment_transfers(portfolio_id);

create index if not exists idx_payment_transfers_group_id
  on public.payment_transfers(transfer_group_id);

-- =========================================================
-- 10. AUDIT
-- =========================================================

create table if not exists public.payment_instrument_audit_log (
  id uuid primary key default gen_random_uuid(),

  user_id uuid references auth.users(id) on delete set null,
  company_id uuid references public.company(id) on delete set null,
  payment_instrument_id uuid references public.company_payment_instruments(id) on delete cascade,

  action text not null check (
    action in (
      'created',
      'updated',
      'status_changed',
      'archived',
      'unarchived',
      'balance_adjusted',
      'exported'
    )
  ),

  old_data jsonb,
  new_data jsonb,
  context jsonb not null default '{}'::jsonb,

  created_at timestamp with time zone not null default now()
);

create index if not exists idx_payment_instrument_audit_log_instrument_id
  on public.payment_instrument_audit_log(payment_instrument_id);

-- =========================================================
-- 11. EXPORTS
-- =========================================================

create table if not exists public.payment_report_exports (
  id uuid primary key default gen_random_uuid(),

  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.company(id) on delete set null,
  portfolio_id uuid references public.company_portfolios(id) on delete set null,

  export_scope text not null check (
    export_scope in ('company', 'portfolio', 'instrument', 'transaction_list')
  ),

  export_format text not null check (
    export_format in ('pdf', 'html')
  ),

  status text not null default 'pending' check (
    status in ('pending', 'processing', 'completed', 'failed')
  ),

  filters jsonb not null default '{}'::jsonb,
  file_url text,
  file_size bigint,
  generated_at timestamp with time zone,
  expires_at timestamp with time zone,
  error_message text,

  created_at timestamp with time zone not null default now()
);

create index if not exists idx_payment_report_exports_user_id
  on public.payment_report_exports(user_id);

create index if not exists idx_payment_report_exports_company_id
  on public.payment_report_exports(company_id);

create index if not exists idx_payment_report_exports_portfolio_id
  on public.payment_report_exports(portfolio_id);

-- =========================================================
-- 12. TABLE DE RAPPROCHEMENT
-- =========================================================

create table if not exists public.payment_reconciliations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid not null references public.company(id) on delete cascade,
  payment_transaction_id uuid not null references public.payment_transactions(id) on delete cascade,
  bank_transaction_id uuid references public.bank_transactions(id) on delete set null,
  statement_line_id uuid references public.bank_statement_lines(id) on delete set null,
  reconciliation_status text not null check (
    reconciliation_status in ('matched', 'partial', 'manual', 'rejected')
  ),
  matched_amount numeric(18,2),
  confidence_score numeric(5,2),
  notes text,
  created_at timestamp with time zone not null default now(),
  reconciled_by uuid references auth.users(id) on delete set null
);

create index if not exists idx_payment_reconciliations_payment_transaction_id
  on public.payment_reconciliations(payment_transaction_id);

-- =========================================================
-- 13. ALERTES
-- =========================================================

create table if not exists public.payment_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  company_id uuid references public.company(id) on delete cascade,
  payment_instrument_id uuid references public.company_payment_instruments(id) on delete cascade,
  alert_type text not null check (
    alert_type in (
      'low_balance',
      'negative_balance',
      'credit_limit_reached',
      'large_cash_movement',
      'sync_failed',
      'reconciliation_gap'
    )
  ),
  severity text not null check (
    severity in ('info', 'warning', 'critical')
  ),
  title text not null,
  message text,
  is_resolved boolean not null default false,
  resolved_at timestamp with time zone,
  created_at timestamp with time zone not null default now()
);

create index if not exists idx_payment_alerts_user_id
  on public.payment_alerts(user_id);

-- =========================================================
-- 14. ALTER TABLES EXISTANTES
-- =========================================================

alter table public.payments
  add column if not exists payment_instrument_id uuid references public.company_payment_instruments(id) on delete set null,
  add column if not exists payment_transaction_id uuid references public.payment_transactions(id) on delete set null;

create index if not exists idx_payments_payment_instrument_id
  on public.payments(payment_instrument_id);

create index if not exists idx_payments_payment_transaction_id
  on public.payments(payment_transaction_id);

alter table public.expenses
  add column if not exists payment_instrument_id uuid references public.company_payment_instruments(id) on delete set null,
  add column if not exists payment_transaction_id uuid references public.payment_transactions(id) on delete set null;

create index if not exists idx_expenses_payment_instrument_id
  on public.expenses(payment_instrument_id);

create index if not exists idx_expenses_payment_transaction_id
  on public.expenses(payment_transaction_id);

alter table public.debt_payments
  add column if not exists payment_instrument_id uuid references public.company_payment_instruments(id) on delete set null,
  add column if not exists payment_transaction_id uuid references public.payment_transactions(id) on delete set null;

create index if not exists idx_debt_payments_payment_instrument_id
  on public.debt_payments(payment_instrument_id);

create index if not exists idx_debt_payments_payment_transaction_id
  on public.debt_payments(payment_transaction_id);

alter table public.bank_transactions
  add column if not exists payment_instrument_id uuid references public.company_payment_instruments(id) on delete set null,
  add column if not exists payment_transaction_id uuid references public.payment_transactions(id) on delete set null;

create index if not exists idx_bank_transactions_payment_instrument_id
  on public.bank_transactions(payment_instrument_id);

create index if not exists idx_bank_transactions_payment_transaction_id
  on public.bank_transactions(payment_transaction_id);

alter table public.bank_statements
  add column if not exists payment_instrument_id uuid references public.company_payment_instruments(id) on delete set null,
  add column if not exists company_id uuid references public.company(id) on delete set null;

create index if not exists idx_bank_statements_payment_instrument_id
  on public.bank_statements(payment_instrument_id);

create index if not exists idx_bank_statements_company_id
  on public.bank_statements(company_id);

alter table public.bank_connections
  add column if not exists payment_instrument_id uuid references public.company_payment_instruments(id) on delete set null;

create index if not exists idx_bank_connections_payment_instrument_id
  on public.bank_connections(payment_instrument_id);

-- =========================================================
-- 15. TRIGGERS / FUNCTIONS
-- =========================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.sync_portfolio_from_company()
returns trigger
language plpgsql
as $$
begin
  if new.company_id is not null and new.portfolio_id is null then
    select c.portfolio_id
      into new.portfolio_id
    from public.company c
    where c.id = new.company_id;
  end if;
  return new;
end;
$$;

create or replace function public.ensure_instrument_company_consistency()
returns trigger
language plpgsql
as $$
declare
  v_company_id uuid;
  v_user_id uuid;
begin
  select company_id, user_id
    into v_company_id, v_user_id
  from public.company_payment_instruments
  where id = new.payment_instrument_id;

  if v_company_id is null then
    raise exception 'Payment instrument % introuvable', new.payment_instrument_id;
  end if;

  if new.company_id <> v_company_id then
    raise exception 'Incohérence company_id entre transaction et instrument';
  end if;

  if new.user_id <> v_user_id then
    raise exception 'Incohérence user_id entre transaction et instrument';
  end if;

  return new;
end;
$$;

create or replace function public.apply_payment_transaction_balance()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    update public.company_payment_instruments
    set current_balance = current_balance +
      case
        when new.flow_direction = 'inflow' then new.amount
        when new.flow_direction = 'outflow' then -new.amount
        else 0
      end,
      updated_at = now()
    where id = new.payment_instrument_id
      and new.status in ('posted', 'reconciled')
      and new.deleted_at is null;

    return new;
  elsif tg_op = 'UPDATE' then
    if old.status in ('posted', 'reconciled') and old.deleted_at is null then
      update public.company_payment_instruments
      set current_balance = current_balance -
        case
          when old.flow_direction = 'inflow' then old.amount
          when old.flow_direction = 'outflow' then -old.amount
          else 0
        end,
        updated_at = now()
      where id = old.payment_instrument_id;
    end if;

    if new.status in ('posted', 'reconciled') and new.deleted_at is null then
      update public.company_payment_instruments
      set current_balance = current_balance +
        case
          when new.flow_direction = 'inflow' then new.amount
          when new.flow_direction = 'outflow' then -new.amount
          else 0
        end,
        updated_at = now()
      where id = new.payment_instrument_id;
    end if;

    return new;
  elsif tg_op = 'DELETE' then
    if old.status in ('posted', 'reconciled') and old.deleted_at is null then
      update public.company_payment_instruments
      set current_balance = current_balance -
        case
          when old.flow_direction = 'inflow' then old.amount
          when old.flow_direction = 'outflow' then -old.amount
          else 0
        end,
        updated_at = now()
      where id = old.payment_instrument_id;
    end if;
    return old;
  end if;

  return null;
end;
$$;

create or replace function public.log_payment_instrument_changes()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.payment_instrument_audit_log (
      user_id, company_id, payment_instrument_id, action, new_data
    )
    values (
      new.user_id, new.company_id, new.id, 'created', to_jsonb(new)
    );
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.payment_instrument_audit_log (
      user_id, company_id, payment_instrument_id, action, old_data, new_data
    )
    values (
      new.user_id,
      new.company_id,
      new.id,
      case
        when old.status is distinct from new.status then 'status_changed'
        else 'updated'
      end,
      to_jsonb(old),
      to_jsonb(new)
    );
    return new;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_company_portfolios_updated_at on public.company_portfolios;
create trigger trg_company_portfolios_updated_at
before update on public.company_portfolios
for each row execute function public.set_updated_at();

drop trigger if exists trg_company_payment_instruments_updated_at on public.company_payment_instruments;
create trigger trg_company_payment_instruments_updated_at
before update on public.company_payment_instruments
for each row execute function public.set_updated_at();

drop trigger if exists trg_payment_transactions_updated_at on public.payment_transactions;
create trigger trg_payment_transactions_updated_at
before update on public.payment_transactions
for each row execute function public.set_updated_at();

drop trigger if exists trg_payment_transfers_updated_at on public.payment_transfers;
create trigger trg_payment_transfers_updated_at
before update on public.payment_transfers
for each row execute function public.set_updated_at();

drop trigger if exists trg_payment_report_exports_updated_at on public.payment_report_exports;
-- pas de updated_at dans cette table, donc pas de trigger

drop trigger if exists trg_sync_portfolio_company_payment_instruments on public.company_payment_instruments;
create trigger trg_sync_portfolio_company_payment_instruments
before insert or update on public.company_payment_instruments
for each row execute function public.sync_portfolio_from_company();

drop trigger if exists trg_sync_portfolio_payment_transactions on public.payment_transactions;
create trigger trg_sync_portfolio_payment_transactions
before insert or update on public.payment_transactions
for each row execute function public.sync_portfolio_from_company();

drop trigger if exists trg_sync_portfolio_payment_transfers on public.payment_transfers;
create trigger trg_sync_portfolio_payment_transfers
before insert or update on public.payment_transfers
for each row execute function public.sync_portfolio_from_company();

drop trigger if exists trg_ensure_instrument_company_consistency on public.payment_transactions;
create trigger trg_ensure_instrument_company_consistency
before insert or update on public.payment_transactions
for each row execute function public.ensure_instrument_company_consistency();

drop trigger if exists trg_apply_payment_transaction_balance on public.payment_transactions;
create trigger trg_apply_payment_transaction_balance
after insert or update or delete on public.payment_transactions
for each row execute function public.apply_payment_transaction_balance();

drop trigger if exists trg_log_payment_instrument_changes on public.company_payment_instruments;
create trigger trg_log_payment_instrument_changes
after insert or update on public.company_payment_instruments
for each row execute function public.log_payment_instrument_changes();

-- =========================================================
-- 16. VUES ANALYTIQUES
-- =========================================================

create or replace view public.v_payment_instrument_stats as
select
  pi.id as payment_instrument_id,
  pi.user_id,
  pi.company_id,
  pi.portfolio_id,
  pi.instrument_type,
  pi.instrument_subtype,
  pi.label,
  pi.currency,
  count(pt.id) as transaction_count,
  coalesce(sum(case when pt.flow_direction = 'inflow' then pt.amount else 0 end), 0) as total_inflow,
  coalesce(sum(case when pt.flow_direction = 'outflow' then pt.amount else 0 end), 0) as total_outflow,
  coalesce(sum(case
    when pt.flow_direction = 'inflow' then pt.amount
    when pt.flow_direction = 'outflow' then -pt.amount
    else 0
  end), 0) as net_flow
from public.company_payment_instruments pi
left join public.payment_transactions pt
  on pt.payment_instrument_id = pi.id
 and pt.deleted_at is null
 and pt.status in ('posted', 'reconciled')
group by
  pi.id, pi.user_id, pi.company_id, pi.portfolio_id,
  pi.instrument_type, pi.instrument_subtype, pi.label, pi.currency;

create or replace view public.v_company_payment_stats as
select
  pt.user_id,
  pt.company_id,
  pt.portfolio_id,
  count(pt.id) as transaction_count,
  coalesce(sum(case when pt.flow_direction = 'inflow' then pt.amount else 0 end), 0) as total_inflow,
  coalesce(sum(case when pt.flow_direction = 'outflow' then pt.amount else 0 end), 0) as total_outflow,
  coalesce(sum(case
    when pt.flow_direction = 'inflow' then pt.amount
    when pt.flow_direction = 'outflow' then -pt.amount
    else 0
  end), 0) as net_flow
from public.payment_transactions pt
where pt.deleted_at is null
  and pt.status in ('posted', 'reconciled')
group by pt.user_id, pt.company_id, pt.portfolio_id;

create or replace view public.v_portfolio_payment_stats as
select
  pt.user_id,
  pt.portfolio_id,
  count(pt.id) as transaction_count,
  coalesce(sum(case when pt.flow_direction = 'inflow' then pt.amount else 0 end), 0) as total_inflow,
  coalesce(sum(case when pt.flow_direction = 'outflow' then pt.amount else 0 end), 0) as total_outflow,
  coalesce(sum(case
    when pt.flow_direction = 'inflow' then pt.amount
    when pt.flow_direction = 'outflow' then -pt.amount
    else 0
  end), 0) as net_flow
from public.payment_transactions pt
where pt.deleted_at is null
  and pt.status in ('posted', 'reconciled')
  and pt.portfolio_id is not null
group by pt.user_id, pt.portfolio_id;

commit;
```

---

# 2) RLS Supabase

Voici une base propre pour les nouvelles tables.

```sql
alter table public.company_portfolios enable row level security;
alter table public.company_portfolio_members enable row level security;
alter table public.company_payment_instruments enable row level security;
alter table public.payment_instrument_bank_accounts enable row level security;
alter table public.payment_instrument_cards enable row level security;
alter table public.payment_instrument_cash_accounts enable row level security;
alter table public.payment_transactions enable row level security;
alter table public.payment_transaction_allocations enable row level security;
alter table public.payment_transfers enable row level security;
alter table public.payment_instrument_audit_log enable row level security;
alter table public.payment_report_exports enable row level security;
alter table public.payment_reconciliations enable row level security;
alter table public.payment_alerts enable row level security;
```

## Policies minimales

```sql
create policy "cp_portfolios_owner_all"
on public.company_portfolios
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "cp_portfolio_members_owner_all"
on public.company_portfolio_members
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "cp_payment_instruments_owner_all"
on public.company_payment_instruments
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "cp_bank_account_details_owner_all"
on public.payment_instrument_bank_accounts
for all
using (
  exists (
    select 1
    from public.company_payment_instruments pi
    where pi.id = instrument_id
      and pi.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.company_payment_instruments pi
    where pi.id = instrument_id
      and pi.user_id = auth.uid()
  )
);

create policy "cp_card_details_owner_all"
on public.payment_instrument_cards
for all
using (
  exists (
    select 1
    from public.company_payment_instruments pi
    where pi.id = instrument_id
      and pi.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.company_payment_instruments pi
    where pi.id = instrument_id
      and pi.user_id = auth.uid()
  )
);

create policy "cp_cash_details_owner_all"
on public.payment_instrument_cash_accounts
for all
using (
  exists (
    select 1
    from public.company_payment_instruments pi
    where pi.id = instrument_id
      and pi.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.company_payment_instruments pi
    where pi.id = instrument_id
      and pi.user_id = auth.uid()
  )
);

create policy "cp_payment_transactions_owner_all"
on public.payment_transactions
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "cp_payment_allocations_owner_all"
on public.payment_transaction_allocations
for all
using (
  exists (
    select 1
    from public.payment_transactions pt
    where pt.id = payment_transaction_id
      and pt.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.payment_transactions pt
    where pt.id = payment_transaction_id
      and pt.user_id = auth.uid()
  )
);

create policy "cp_payment_transfers_owner_all"
on public.payment_transfers
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "cp_payment_audit_owner_read"
on public.payment_instrument_audit_log
for select
using (
  exists (
    select 1
    from public.company_payment_instruments pi
    where pi.id = payment_instrument_id
      and pi.user_id = auth.uid()
  )
);

create policy "cp_payment_exports_owner_all"
on public.payment_report_exports
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "cp_payment_reconciliations_owner_all"
on public.payment_reconciliations
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "cp_payment_alerts_owner_all"
on public.payment_alerts
for all
using (user_id = auth.uid())
with check (user_id = auth.uid());
```

---

# 3) Migration initiale des données

## A. Créer un portefeuille par défaut par user

```sql
insert into public.company_portfolios (
  user_id,
  portfolio_name,
  description,
  base_currency,
  is_default,
  is_active
)
select distinct
  c.user_id,
  'Portfolio principal',
  'Portefeuille généré automatiquement',
  coalesce(c.currency, 'EUR'),
  true,
  true
from public.company c
where not exists (
  select 1
  from public.company_portfolios p
  where p.user_id = c.user_id
    and p.is_default = true
);
```

## B. Attacher chaque société à son portefeuille par défaut

```sql
update public.company c
set portfolio_id = p.id
from public.company_portfolios p
where p.user_id = c.user_id
  and p.is_default = true
  and c.portfolio_id is null;
```

## C. Alimenter `company_portfolio_members`

```sql
insert into public.company_portfolio_members (
  portfolio_id,
  company_id,
  user_id
)
select
  c.portfolio_id,
  c.id,
  c.user_id
from public.company c
where c.portfolio_id is not null
on conflict (portfolio_id, company_id) do nothing;
```

---

## D. Créer les instruments bancaires depuis `company`

```sql
insert into public.company_payment_instruments (
  user_id,
  company_id,
  portfolio_id,
  instrument_type,
  instrument_subtype,
  code,
  label,
  display_name,
  currency,
  status,
  is_default,
  opening_balance,
  current_balance,
  metadata
)
select
  c.user_id,
  c.id,
  c.portfolio_id,
  'bank_account',
  'checking',
  'BANK-MAIN-' || substr(c.id::text, 1, 8),
  coalesce(c.bank_name, 'Compte bancaire principal'),
  coalesce(c.bank_name, 'Compte bancaire principal'),
  coalesce(c.currency, 'EUR'),
  'active',
  true,
  0,
  0,
  jsonb_build_object(
    'source', 'company',
    'legacy_iban', c.iban,
    'legacy_bank_account', c.bank_account
  )
from public.company c
where (c.iban is not null or c.bank_account is not null)
  and not exists (
    select 1
    from public.company_payment_instruments pi
    where pi.company_id = c.id
      and pi.instrument_type = 'bank_account'
      and pi.is_default = true
  );
```

## E. Détail bancaire associé

```sql
insert into public.payment_instrument_bank_accounts (
  instrument_id,
  bank_name,
  account_holder,
  iban_masked,
  bic_swift,
  account_kind,
  statement_import_enabled,
  api_sync_enabled
)
select
  pi.id,
  c.bank_name,
  c.company_name,
  case
    when c.iban is null then null
    when length(c.iban) <= 8 then c.iban
    else left(c.iban, 4) || '****' || right(c.iban, 4)
  end,
  c.swift,
  'business',
  false,
  false
from public.company_payment_instruments pi
join public.company c on c.id = pi.company_id
where pi.instrument_type = 'bank_account'
  and not exists (
    select 1
    from public.payment_instrument_bank_accounts b
    where b.instrument_id = pi.id
  );
```

---

## F. Créer une caisse par défaut par société

```sql
insert into public.company_payment_instruments (
  user_id,
  company_id,
  portfolio_id,
  instrument_type,
  instrument_subtype,
  code,
  label,
  display_name,
  currency,
  status,
  is_default,
  opening_balance,
  current_balance,
  metadata
)
select
  c.user_id,
  c.id,
  c.portfolio_id,
  'cash',
  'petty_cash',
  'CASH-MAIN-' || substr(c.id::text, 1, 8),
  'Caisse principale',
  'Caisse principale',
  coalesce(c.currency, 'EUR'),
  'active',
  true,
  0,
  0,
  jsonb_build_object('source', 'system_default')
from public.company c
where not exists (
  select 1
  from public.company_payment_instruments pi
  where pi.company_id = c.id
    and pi.instrument_type = 'cash'
    and pi.is_default = true
);
```

## G. Détail caisse associé

```sql
insert into public.payment_instrument_cash_accounts (
  instrument_id,
  cash_point_name,
  reconciliation_frequency
)
select
  pi.id,
  'Caisse principale',
  'manual'
from public.company_payment_instruments pi
where pi.instrument_type = 'cash'
  and not exists (
    select 1
    from public.payment_instrument_cash_accounts ca
    where ca.instrument_id = pi.id
  );
```

---

## H. Créer les instruments bancaires depuis `bank_connections`

```sql
insert into public.company_payment_instruments (
  user_id,
  company_id,
  portfolio_id,
  instrument_type,
  instrument_subtype,
  code,
  label,
  display_name,
  currency,
  status,
  is_default,
  opening_balance,
  current_balance,
  external_provider,
  external_reference,
  metadata
)
select
  bc.user_id,
  bc.company_id,
  c.portfolio_id,
  'bank_account',
  'checking',
  'BANK-CONN-' || substr(bc.id::text, 1, 8),
  coalesce(bc.account_name, bc.institution_name, 'Compte bancaire synchronisé'),
  coalesce(bc.account_name, bc.institution_name, 'Compte bancaire synchronisé'),
  coalesce(bc.account_currency, 'EUR'),
  case
    when bc.status in ('active', 'pending') then 'active'
    when bc.status = 'revoked' then 'blocked'
    else 'inactive'
  end,
  false,
  0,
  coalesce(bc.account_balance, 0),
  'bank_connection',
  bc.id::text,
  jsonb_build_object(
    'institution_id', bc.institution_id,
    'institution_name', bc.institution_name,
    'account_id', bc.account_id
  )
from public.bank_connections bc
join public.company c on c.id = bc.company_id
where not exists (
  select 1
  from public.company_payment_instruments pi
  where pi.external_provider = 'bank_connection'
    and pi.external_reference = bc.id::text
);
```

## I. Relier `bank_connections` à l’instrument créé

```sql
update public.bank_connections bc
set payment_instrument_id = pi.id
from public.company_payment_instruments pi
where pi.external_provider = 'bank_connection'
  and pi.external_reference = bc.id::text
  and bc.payment_instrument_id is null;
```

## J. Détails bancaires pour `bank_connections`

```sql
insert into public.payment_instrument_bank_accounts (
  instrument_id,
  bank_connection_id,
  bank_name,
  account_holder,
  iban_masked,
  account_number_masked,
  account_kind,
  statement_import_enabled,
  api_sync_enabled,
  last_sync_at
)
select
  pi.id,
  bc.id,
  bc.institution_name,
  bc.account_name,
  case
    when bc.account_iban is null then null
    when length(bc.account_iban) <= 8 then bc.account_iban
    else left(bc.account_iban, 4) || '****' || right(bc.account_iban, 4)
  end,
  case
    when bc.account_id is null then null
    when length(bc.account_id) <= 4 then bc.account_id
    else '****' || right(bc.account_id, 4)
  end,
  'business',
  true,
  true,
  bc.last_sync_at
from public.bank_connections bc
join public.company_payment_instruments pi
  on pi.external_provider = 'bank_connection'
 and pi.external_reference = bc.id::text
where not exists (
  select 1
  from public.payment_instrument_bank_accounts d
  where d.instrument_id = pi.id
);
```

---

# 4) Backfill des transactions existantes

## A. Paiements clients (`payments`)

```sql
with default_instruments as (
  select distinct on (company_id)
    company_id,
    id as payment_instrument_id
  from public.company_payment_instruments
  where instrument_type in ('bank_account', 'cash', 'card')
    and status = 'active'
  order by company_id,
           case when is_default then 0 else 1 end,
           created_at
),
inserted as (
  insert into public.payment_transactions (
    user_id,
    company_id,
    portfolio_id,
    payment_instrument_id,
    transaction_kind,
    flow_direction,
    status,
    source_module,
    source_table,
    source_id,
    transaction_date,
    posting_date,
    amount,
    currency,
    company_currency,
    counterparty_name,
    description,
    reference,
    notes,
    created_by
  )
  select
    p.user_id,
    p.company_id,
    c.portfolio_id,
    coalesce(p.payment_instrument_id, di.payment_instrument_id),
    'income',
    'inflow',
    'posted',
    'payments',
    'payments',
    p.id,
    p.payment_date,
    p.payment_date,
    p.amount,
    coalesce(i.currency, c.currency, 'EUR'),
    c.accounting_currency,
    cl.company_name,
    coalesce(p.notes, 'Paiement client'),
    p.reference,
    p.notes,
    p.user_id
  from public.payments p
  join public.company c on c.id = p.company_id
  left join public.invoices i on i.id = p.invoice_id
  left join public.clients cl on cl.id = p.client_id
  left join default_instruments di on di.company_id = p.company_id
  where p.payment_transaction_id is null
    and coalesce(p.deleted_at, null) is null
  returning id, source_id
)
update public.payments p
set payment_transaction_id = ins.id
from inserted ins
where p.id = ins.source_id;
```

---

## B. Dépenses (`expenses`)

```sql
with default_instruments as (
  select distinct on (company_id)
    company_id,
    id as payment_instrument_id
  from public.company_payment_instruments
  where instrument_type in ('bank_account', 'cash', 'card')
    and status = 'active'
  order by company_id,
           case when is_default then 0 else 1 end,
           created_at
),
inserted as (
  insert into public.payment_transactions (
    user_id,
    company_id,
    portfolio_id,
    payment_instrument_id,
    transaction_kind,
    flow_direction,
    status,
    source_module,
    source_table,
    source_id,
    transaction_date,
    posting_date,
    amount,
    currency,
    company_currency,
    counterparty_name,
    description,
    reference,
    category,
    notes,
    created_by
  )
  select
    e.user_id,
    e.company_id,
    c.portfolio_id,
    coalesce(e.payment_instrument_id, di.payment_instrument_id),
    'expense',
    'outflow',
    'posted',
    'expenses',
    'expenses',
    e.id,
    coalesce(e.expense_date, e.created_at::date),
    coalesce(e.expense_date, e.created_at::date),
    e.amount,
    coalesce(c.currency, 'EUR'),
    c.accounting_currency,
    s.company_name,
    coalesce(e.description, 'Dépense'),
    null,
    e.category,
    e.description,
    e.user_id
  from public.expenses e
  join public.company c on c.id = e.company_id
  left join public.suppliers s on s.id = e.supplier_id
  left join default_instruments di on di.company_id = e.company_id
  where e.payment_transaction_id is null
    and e.deleted_at is null
  returning id, source_id
)
update public.expenses e
set payment_transaction_id = ins.id
from inserted ins
where e.id = ins.source_id;
```

---

## C. Paiements de dettes / créances (`debt_payments`)

```sql
with default_instruments as (
  select distinct on (company_id)
    company_id,
    id as payment_instrument_id
  from public.company_payment_instruments
  where instrument_type in ('bank_account', 'cash', 'card')
    and status = 'active'
  order by company_id,
           case when is_default then 0 else 1 end,
           created_at
),
inserted as (
  insert into public.payment_transactions (
    user_id,
    company_id,
    portfolio_id,
    payment_instrument_id,
    transaction_kind,
    flow_direction,
    status,
    source_module,
    source_table,
    source_id,
    transaction_date,
    posting_date,
    amount,
    currency,
    company_currency,
    description,
    reference,
    notes,
    created_by
  )
  select
    dp.user_id,
    dp.company_id,
    c.portfolio_id,
    coalesce(dp.payment_instrument_id, di.payment_instrument_id),
    case
      when dp.record_type = 'receivable' then 'income'
      else 'expense'
    end,
    case
      when dp.record_type = 'receivable' then 'inflow'
      else 'outflow'
    end,
    'posted',
    'debt_payments',
    'debt_payments',
    dp.id,
    dp.payment_date,
    dp.payment_date,
    dp.amount,
    coalesce(c.currency, 'EUR'),
    c.accounting_currency,
    coalesce(dp.notes, 'Paiement dette/créance'),
    null,
    dp.notes,
    dp.user_id
  from public.debt_payments dp
  join public.company c on c.id = dp.company_id
  left join default_instruments di on di.company_id = dp.company_id
  where dp.payment_transaction_id is null
  returning id, source_id
)
update public.debt_payments dp
set payment_transaction_id = ins.id
from inserted ins
where dp.id = ins.source_id;
```

---

## D. Transactions bancaires (`bank_transactions`)

```sql
with inserted as (
  insert into public.payment_transactions (
    user_id,
    company_id,
    portfolio_id,
    payment_instrument_id,
    transaction_kind,
    flow_direction,
    status,
    source_module,
    source_table,
    source_id,
    transaction_date,
    posting_date,
    value_date,
    amount,
    currency,
    company_currency,
    counterparty_name,
    description,
    reference,
    external_reference,
    notes,
    matched_bank_transaction_id,
    created_by
  )
  select
    bt.user_id,
    bt.company_id,
    c.portfolio_id,
    coalesce(bt.payment_instrument_id, bc.payment_instrument_id),
    case
      when bt.amount >= 0 then 'income'
      else 'expense'
    end,
    case
      when bt.amount >= 0 then 'inflow'
      else 'outflow'
    end,
    case
      when bt.reconciliation_status = 'matched' then 'reconciled'
      else 'posted'
    end,
    'bank_transactions',
    'bank_transactions',
    bt.id,
    bt.date,
    coalesce(bt.booking_date, bt.date),
    bt.value_date,
    abs(bt.amount),
    coalesce(bt.currency, 'EUR'),
    c.accounting_currency,
    coalesce(bt.creditor_name, bt.debtor_name),
    bt.description,
    bt.reference,
    bt.external_id,
    bt.remittance_info,
    bt.id,
    bt.user_id
  from public.bank_transactions bt
  left join public.bank_connections bc on bc.id = bt.bank_connection_id
  left join public.company c on c.id = bt.company_id
  where bt.payment_transaction_id is null
  returning id, source_id
)
update public.bank_transactions bt
set payment_transaction_id = ins.id
from inserted ins
where bt.id = ins.source_id;
```

---

# 5) Vue d’usage métier simple

Pour les dashboards UI, cette vue est souvent très utile :

```sql
create or replace view public.v_payment_transactions_enriched as
select
  pt.id,
  pt.user_id,
  pt.company_id,
  c.company_name,
  pt.portfolio_id,
  cp.portfolio_name,
  pt.payment_instrument_id,
  pi.label as instrument_label,
  pi.instrument_type,
  pi.instrument_subtype,
  pt.transaction_kind,
  pt.flow_direction,
  pt.status,
  pt.transaction_date,
  pt.amount,
  pt.currency,
  pt.counterparty_name,
  pt.description,
  pt.reference,
  pt.source_module,
  pt.source_id,
  pt.created_at
from public.payment_transactions pt
join public.company c on c.id = pt.company_id
left join public.company_portfolios cp on cp.id = pt.portfolio_id
join public.company_payment_instruments pi on pi.id = pt.payment_instrument_id
where pt.deleted_at is null;
```

---

# 6) Recommandations de mise en production

## Ordre conseillé

1. exécuter la **migration structurelle**
2. activer les **RLS**
3. lancer le **backfill**
4. adapter le back-end pour écrire dans :

   * `company_payment_instruments`
   * `payment_transactions`
5. garder temporairement :

   * `payments.payment_method`
   * `expenses.payment_method`
   * `debt_payments.payment_method`
     comme champs legacy

## Très important

Pour les cartes bancaires :

* ne jamais stocker le numéro complet
* ne jamais stocker le CVV
* seulement `last4`, type, expiration, marque, token éventuel

---

# 7) Ce que cette base permet immédiatement

Avec cette structure, CashPilot pourra :

* gérer **plusieurs comptes bancaires** par société
* gérer **plusieurs cartes** par société
* gérer **plusieurs caisses**
* tracer les transactions **par société**
* consolider **par portefeuille**
* faire des stats :

  * par mode de paiement
  * par société
  * par portefeuille
* préparer facilement :

  * export **PDF**
  * export **HTML**
  * dashboards analytiques
  * rapprochement bancaire
  * alertes

---

# 8) Étape suivante recommandée

La suite la plus utile est de vous fournir maintenant le **schéma API + services Supabase Edge Functions / endpoints backend** correspondant à cette base, pour que l’implémentation applicative soit directement exploitable.
# Schéma API + services backend pour CashPilot

Voici une proposition **directement exploitable** pour brancher votre nouvelle couche :

* `company_portfolios`
* `company_payment_instruments`
* `payment_transactions`
* `payment_transfers`
* `payment_report_exports`

L’objectif est de vous donner une architecture simple, cohérente et compatible avec **Supabase + Edge Functions + PostgreSQL**.

---

# 1) Architecture recommandée

## Couches

### Base PostgreSQL / Supabase

Contient :

* tables métier
* vues analytiques
* RLS
* triggers de cohérence
* éventuelles fonctions RPC SQL

### API applicative

Deux options propres :

| Option                      | Usage                                            | Recommandation |
| --------------------------- | ------------------------------------------------ | -------------- |
| REST via PostgREST Supabase | CRUD simple                                      | Oui            |
| Edge Functions Supabase     | logique métier, transferts, exports, validations | Oui, fortement |

### Frontend

Le frontend interroge :

* directement Supabase pour les lectures simples
* les Edge Functions pour les opérations métier critiques

---

# 2) Principes d’API

## Ressources principales

Je recommande de structurer l’API autour de :

* `/portfolios`
* `/companies/:companyId/payment-instruments`
* `/companies/:companyId/payment-transactions`
* `/companies/:companyId/payment-transfers`
* `/reports/payment-exports`

## Règle importante

### CRUD direct

Pour :

* création d’un portefeuille
* lecture d’instruments
* lecture de transactions
* listes filtrées

### Fonctions métier

Via Edge Functions pour :

* créer un transfert interne
* enregistrer une transaction avec impact balance
* annuler une transaction
* générer un export PDF/HTML
* réconcilier une transaction bancaire
* recalculer les soldes

---

# 3) Contrats API recommandés

## A. Portefeuilles

### GET `/portfolios`

Retourne la liste des portefeuilles de l’utilisateur.

### POST `/portfolios`

Crée un portefeuille.

### Payload

```json
{
  "portfolio_name": "Groupe principal",
  "description": "Portefeuille Afrique de l’Ouest",
  "base_currency": "EUR",
  "is_default": false
}
```

### Réponse

```json
{
  "id": "uuid",
  "portfolio_name": "Groupe principal",
  "base_currency": "EUR",
  "is_default": false,
  "is_active": true,
  "created_at": "2026-03-09T10:00:00Z"
}
```

---

## B. Instruments de paiement

### GET `/companies/:companyId/payment-instruments`

Liste les instruments d’une société.

### Filtres utiles

* `type=bank_account|card|cash`
* `status=active`
* `include_archived=false`

### POST `/companies/:companyId/payment-instruments`

Crée un instrument.

### Payload banque

```json
{
  "instrument_type": "bank_account",
  "instrument_subtype": "checking",
  "code": "BANK-BOA-001",
  "label": "BOA Compte principal",
  "currency": "XOF",
  "is_default": true,
  "opening_balance": 2500000,
  "bank_details": {
    "bank_name": "Bank of Africa",
    "account_holder": "CashPilot SARL",
    "iban_masked": "CI12****4598",
    "bic_swift": "AFRICIABXXX",
    "account_kind": "business"
  }
}
```

### Payload carte

```json
{
  "instrument_type": "card",
  "instrument_subtype": "debit_card",
  "code": "CARD-MAIN-001",
  "label": "Carte DG",
  "currency": "EUR",
  "card_details": {
    "card_brand": "Visa",
    "card_type": "debit",
    "holder_name": "Jean Dupont",
    "last4": "4242",
    "expiry_month": 12,
    "expiry_year": 2028
  }
}
```

### Payload caisse

```json
{
  "instrument_type": "cash",
  "instrument_subtype": "petty_cash",
  "code": "CASH-HQ-001",
  "label": "Caisse siège",
  "currency": "XOF",
  "cash_details": {
    "cash_point_name": "Caisse principale",
    "location": "Abidjan - Siège",
    "reconciliation_frequency": "daily"
  }
}
```

---

## C. Transactions de paiement

### GET `/companies/:companyId/payment-transactions`

Liste paginée avec filtres.

### Filtres recommandés

* `payment_instrument_id`
* `transaction_kind`
* `flow_direction`
* `status`
* `start_date`
* `end_date`
* `source_module`
* `min_amount`
* `max_amount`

### Réponse type

```json
{
  "items": [
    {
      "id": "uuid",
      "transaction_date": "2026-03-01",
      "amount": 150000,
      "currency": "XOF",
      "flow_direction": "inflow",
      "transaction_kind": "income",
      "status": "posted",
      "instrument_label": "BOA Compte principal",
      "counterparty_name": "Client ABC",
      "description": "Paiement facture FAC-2026-0012"
    }
  ],
  "page": 1,
  "page_size": 25,
  "total": 324
}
```

### POST `/companies/:companyId/payment-transactions`

Crée une transaction métier.

### Payload

```json
{
  "payment_instrument_id": "uuid",
  "transaction_kind": "expense",
  "flow_direction": "outflow",
  "transaction_date": "2026-03-09",
  "amount": 85000,
  "currency": "XOF",
  "counterparty_name": "Fournisseur XYZ",
  "description": "Achat fournitures",
  "reference": "DEP-2026-0032",
  "source_module": "manual",
  "notes": "Paiement en caisse"
}
```

---

## D. Transferts internes

### POST `/companies/:companyId/payment-transfers`

Opération métier à faire via Edge Function.

### Payload

```json
{
  "from_instrument_id": "uuid-from",
  "to_instrument_id": "uuid-to",
  "transfer_date": "2026-03-09",
  "amount": 500000,
  "currency": "XOF",
  "fee_amount": 2500,
  "reference": "VIR-INT-2026-0005",
  "notes": "Alimentation caisse agence"
}
```

### Résultat

La fonction crée :

* un enregistrement dans `payment_transfers`
* une transaction `transfer_out`
* une transaction `transfer_in`
* éventuellement une transaction `fee`

---

## E. Exports

### POST `/reports/payment-exports`

Demande de génération d’export.

### Payload

```json
{
  "export_scope": "company",
  "export_format": "pdf",
  "company_id": "uuid",
  "filters": {
    "start_date": "2026-01-01",
    "end_date": "2026-03-31",
    "instrument_ids": [],
    "status": ["posted", "reconciled"]
  }
}
```

### Réponse

```json
{
  "id": "uuid",
  "status": "pending"
}
```

---

# 4) Edge Functions à créer

## Liste minimale

| Fonction                         | Rôle                                      |
| -------------------------------- | ----------------------------------------- |
| `create-payment-instrument`      | création d’instrument + sous-table détail |
| `create-payment-transaction`     | validation + insert transaction           |
| `create-payment-transfer`        | transfert interne complet                 |
| `cancel-payment-transaction`     | annulation métier                         |
| `reconcile-payment-transaction`  | rapprochement bancaire                    |
| `generate-payment-report`        | export PDF/HTML                           |
| `recalculate-instrument-balance` | recalcul de solde                         |
| `get-payment-dashboard`          | agrégation dashboard                      |

---

# 5) Fonction Edge critique : création d’un transfert

## Comportement attendu

La fonction :

1. valide que les deux instruments appartiennent à la même société
2. valide que l’utilisateur a accès
3. crée un `transfer_group_id`
4. crée la transaction de sortie
5. crée la transaction d’entrée
6. crée la ligne `payment_transfers`
7. crée la transaction de frais si `fee_amount > 0`

---

## Exemple TypeScript — Edge Function `create-payment-transfer`

```ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const body = await req.json();
    const {
      company_id,
      from_instrument_id,
      to_instrument_id,
      transfer_date,
      amount,
      currency,
      fee_amount = 0,
      reference,
      notes
    } = body;

    if (!company_id || !from_instrument_id || !to_instrument_id || !transfer_date || !amount) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    if (from_instrument_id === to_instrument_id) {
      return new Response(JSON.stringify({ error: "Source and destination instruments must differ" }), { status: 400 });
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid user session" }), { status: 401 });
    }

    const userId = userData.user.id;

    const { data: instruments, error: instrumentsError } = await supabase
      .from("company_payment_instruments")
      .select("id, company_id, user_id, currency, status")
      .in("id", [from_instrument_id, to_instrument_id]);

    if (instrumentsError) {
      return new Response(JSON.stringify({ error: instrumentsError.message }), { status: 400 });
    }

    if (!instruments || instruments.length !== 2) {
      return new Response(JSON.stringify({ error: "Instrument not found" }), { status: 404 });
    }

    for (const instrument of instruments) {
      if (instrument.company_id !== company_id || instrument.user_id !== userId) {
        return new Response(JSON.stringify({ error: "Access denied or company mismatch" }), { status: 403 });
      }
      if (instrument.status !== "active") {
        return new Response(JSON.stringify({ error: "Instrument must be active" }), { status: 400 });
      }
    }

    const transferGroupId = crypto.randomUUID();

    const { data: outTx, error: outError } = await supabase
      .from("payment_transactions")
      .insert({
        user_id: userId,
        company_id,
        payment_instrument_id: from_instrument_id,
        transaction_kind: "transfer_out",
        flow_direction: "outflow",
        status: "posted",
        source_module: "transfers",
        source_table: "payment_transfers",
        transaction_date: transfer_date,
        posting_date: transfer_date,
        amount,
        currency,
        reference,
        description: "Transfert interne sortant",
        notes,
        is_internal_transfer: true,
        transfer_group_id: transferGroupId,
        created_by: userId,
        updated_by: userId
      })
      .select()
      .single();

    if (outError) {
      return new Response(JSON.stringify({ error: outError.message }), { status: 400 });
    }

    const { data: inTx, error: inError } = await supabase
      .from("payment_transactions")
      .insert({
        user_id: userId,
        company_id,
        payment_instrument_id: to_instrument_id,
        transaction_kind: "transfer_in",
        flow_direction: "inflow",
        status: "posted",
        source_module: "transfers",
        source_table: "payment_transfers",
        transaction_date: transfer_date,
        posting_date: transfer_date,
        amount,
        currency,
        reference,
        description: "Transfert interne entrant",
        notes,
        is_internal_transfer: true,
        transfer_group_id: transferGroupId,
        created_by: userId,
        updated_by: userId
      })
      .select()
      .single();

    if (inError) {
      return new Response(JSON.stringify({ error: inError.message }), { status: 400 });
    }

    const { data: transfer, error: transferError } = await supabase
      .from("payment_transfers")
      .insert({
        user_id: userId,
        company_id,
        from_instrument_id,
        to_instrument_id,
        transfer_date,
        amount,
        currency,
        fee_amount,
        reference,
        notes,
        status: "posted",
        transfer_group_id: transferGroupId,
        outflow_transaction_id: outTx.id,
        inflow_transaction_id: inTx.id
      })
      .select()
      .single();

    if (transferError) {
      return new Response(JSON.stringify({ error: transferError.message }), { status: 400 });
    }

    if (fee_amount > 0) {
      const { error: feeError } = await supabase
        .from("payment_transactions")
        .insert({
          user_id: userId,
          company_id,
          payment_instrument_id: from_instrument_id,
          transaction_kind: "fee",
          flow_direction: "outflow",
          status: "posted",
          source_module: "transfers",
          source_table: "payment_transfers",
          source_id: transfer.id,
          transaction_date: transfer_date,
          posting_date: transfer_date,
          amount: fee_amount,
          currency,
          reference,
          description: "Frais de transfert interne",
          is_internal_transfer: false,
          transfer_group_id: transferGroupId,
          created_by: userId,
          updated_by: userId
        });

      if (feeError) {
        return new Response(JSON.stringify({ error: feeError.message }), { status: 400 });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      transfer_id: transfer.id,
      transfer_group_id: transferGroupId,
      outflow_transaction_id: outTx.id,
      inflow_transaction_id: inTx.id
    }), {
      status: 201,
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : "Unexpected error"
    }), { status: 500 });
  }
});
```

---

# 6) Fonction Edge : création d’un instrument

## Logique

Selon `instrument_type`, la fonction :

* crée la ligne dans `company_payment_instruments`
* crée ensuite la ligne détail :

  * `payment_instrument_bank_accounts`
  * `payment_instrument_cards`
  * `payment_instrument_cash_accounts`

## Exemple de structure de code

```ts
type CreatePaymentInstrumentPayload = {
  company_id: string;
  instrument_type: "bank_account" | "card" | "cash";
  instrument_subtype?: string;
  code: string;
  label: string;
  display_name?: string;
  currency: string;
  is_default?: boolean;
  opening_balance?: number;
  description?: string;
  metadata?: Record<string, unknown>;
  bank_details?: {
    bank_name?: string;
    account_holder?: string;
    iban_masked?: string;
    bic_swift?: string;
    account_kind?: "checking" | "savings" | "business" | "escrow" | "other";
  };
  card_details?: {
    card_brand?: string;
    card_type: "debit" | "credit" | "prepaid" | "virtual";
    holder_name?: string;
    last4?: string;
    expiry_month?: number;
    expiry_year?: number;
  };
  cash_details?: {
    cash_point_name: string;
    location?: string;
    reconciliation_frequency?: "daily" | "weekly" | "monthly" | "manual";
  };
};
```

---

# 7) RPC SQL utiles

Pour certaines opérations, des fonctions SQL sont très pratiques.

## A. Recalculer le solde d’un instrument

```sql
create or replace function public.recalculate_payment_instrument_balance(p_instrument_id uuid)
returns numeric
language plpgsql
security definer
as $$
declare
  v_balance numeric(18,2);
begin
  select
    coalesce(pi.opening_balance, 0) +
    coalesce(sum(
      case
        when pt.flow_direction = 'inflow' then pt.amount
        when pt.flow_direction = 'outflow' then -pt.amount
        else 0
      end
    ), 0)
  into v_balance
  from public.company_payment_instruments pi
  left join public.payment_transactions pt
    on pt.payment_instrument_id = pi.id
   and pt.status in ('posted', 'reconciled')
   and pt.deleted_at is null
  where pi.id = p_instrument_id
  group by pi.id, pi.opening_balance;

  update public.company_payment_instruments
  set current_balance = coalesce(v_balance, opening_balance),
      updated_at = now()
  where id = p_instrument_id;

  return coalesce(v_balance, 0);
end;
$$;
```

---

## B. Dashboard de paiements par société

```sql
create or replace function public.get_company_payment_dashboard(p_company_id uuid)
returns jsonb
language plpgsql
security definer
as $$
declare
  v_result jsonb;
begin
  select jsonb_build_object(
    'balances', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'payment_instrument_id', id,
        'label', label,
        'instrument_type', instrument_type,
        'currency', currency,
        'current_balance', current_balance
      )), '[]'::jsonb)
      from public.company_payment_instruments
      where company_id = p_company_id
        and status = 'active'
    ),
    'stats', (
      select jsonb_build_object(
        'total_inflow', coalesce(sum(case when flow_direction = 'inflow' then amount else 0 end), 0),
        'total_outflow', coalesce(sum(case when flow_direction = 'outflow' then amount else 0 end), 0),
        'net_flow', coalesce(sum(case when flow_direction = 'inflow' then amount else -amount end), 0),
        'transaction_count', count(*)
      )
      from public.payment_transactions
      where company_id = p_company_id
        and deleted_at is null
        and status in ('posted', 'reconciled')
    )
  )
  into v_result;

  return v_result;
end;
$$;
```

---

# 8) Validation métier recommandée

## À imposer côté Edge Functions

### Instruments

* `code` unique par société
* un seul `is_default=true` par type si voulu
* devise obligatoire
* détail cohérent avec le type

### Transactions

* montant strictement positif
* instrument actif
* `company_id` cohérent avec l’instrument
* `flow_direction` cohérent avec `transaction_kind`

### Transferts

* instruments différents
* même société
* même utilisateur
* devise compatible ou gestion FX explicite

---

# 9) Mapping frontend recommandé

## Pages

### Portefeuilles

* liste des portefeuilles
* sociétés associées
* stats consolidées

### Instruments

* cartes “Compte bancaire”, “Carte”, “Caisse”
* solde courant
* historique rapide
* statut

### Transactions

* tableau filtrable
* regroupement par instrument
* badges source : `manual`, `payments`, `expenses`, `bank_transactions`, `transfers`

### Transferts

* formulaire source/destination
* timeline des mouvements liés
* affichage du `transfer_group_id`

---

# 10) Exemple d’accès frontend Supabase

## Lecture simple

```ts
const { data, error } = await supabase
  .from("v_payment_transactions_enriched")
  .select("*")
  .eq("company_id", companyId)
  .gte("transaction_date", "2026-01-01")
  .lte("transaction_date", "2026-03-31")
  .order("transaction_date", { ascending: false });
```

## Appel Edge Function

```ts
const { data, error } = await supabase.functions.invoke("create-payment-transfer", {
  body: {
    company_id: companyId,
    from_instrument_id: fromInstrumentId,
    to_instrument_id: toInstrumentId,
    transfer_date: "2026-03-09",
    amount: 500000,
    currency: "XOF",
    fee_amount: 2500,
    reference: "VIR-INT-0005"
  }
});
```

---

# 11) Ordre d’implémentation conseillé

## Sprint 1

* CRUD portefeuilles
* CRUD instruments
* listing transactions
* vue enrichie

## Sprint 2

* création transaction manuelle
* transfert interne
* recalcul soldes
* dashboard société

## Sprint 3

* rapprochement bancaire
* exports PDF/HTML
* alertes métier
* analytique portefeuille

---

# 12) Ce que je vous recommande maintenant

L’étape la plus utile est de produire le **pack technique complet suivant** :

## Pack suivant

* les **Edge Functions complètes** en TypeScript
* le **fichier OpenAPI YAML**
* les **types TypeScript frontend**
* les **hooks React Query / Next.js**

Je peux vous le générer directement dans le prochain message, prêt à copier-coller.
# Pack technique — CashPilot Payments

Je vous propose ci-dessous un **socle prêt à intégrer** pour :

* les **Edge Functions**
* le **contrat OpenAPI**
* les **types TypeScript**
* les **hooks React Query / Next.js**

## Contexte fonctionnel utile

Le besoin est cohérent avec la situation actuelle : CashPilot suit déjà un volume significatif d’**encours** et de **flux à tracer**, avec un **pending all time** observé à **430 227,60** dans l’environnement de démo. Cela renforce l’intérêt d’un registre unifié des moyens de paiement et des transactions.

---

# 1) OpenAPI YAML

Voici une base OpenAPI 3.1 pour les endpoints métier principaux.

```yaml
openapi: 3.1.0
info:
  title: CashPilot Payments API
  version: 1.0.0
  description: API de gestion des portefeuilles, instruments de paiement, transactions et exports.

servers:
  - url: https://<project-ref>.supabase.co/functions/v1
    description: Supabase Edge Functions
  - url: https://<project-ref>.supabase.co/rest/v1
    description: Supabase REST

components:
  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  schemas:
    Portfolio:
      type: object
      required: [id, portfolio_name, base_currency, is_default, is_active, created_at]
      properties:
        id: { type: string, format: uuid }
        portfolio_name: { type: string }
        description: { type: string, nullable: true }
        base_currency: { type: string, minLength: 3, maxLength: 3 }
        is_default: { type: boolean }
        is_active: { type: boolean }
        created_at: { type: string, format: date-time }

    PaymentInstrument:
      type: object
      required: [id, company_id, instrument_type, code, label, currency, status]
      properties:
        id: { type: string, format: uuid }
        company_id: { type: string, format: uuid }
        portfolio_id: { type: string, format: uuid, nullable: true }
        instrument_type:
          type: string
          enum: [bank_account, card, cash]
        instrument_subtype:
          type: string
          nullable: true
          enum: [checking, savings, credit_card, debit_card, petty_cash, cash_register, mobile_money, other]
        code: { type: string }
        label: { type: string }
        display_name: { type: string, nullable: true }
        currency: { type: string, minLength: 3, maxLength: 3 }
        status:
          type: string
          enum: [active, inactive, archived, blocked]
        is_default: { type: boolean }
        opening_balance: { type: number }
        current_balance: { type: number }
        metadata: { type: object, additionalProperties: true }

    CreateBankInstrumentRequest:
      type: object
      required: [company_id, instrument_type, code, label, currency, bank_details]
      properties:
        company_id: { type: string, format: uuid }
        instrument_type: { type: string, enum: [bank_account] }
        instrument_subtype: { type: string, enum: [checking, savings, other] }
        code: { type: string }
        label: { type: string }
        display_name: { type: string }
        currency: { type: string }
        is_default: { type: boolean }
        opening_balance: { type: number }
        description: { type: string }
        metadata: { type: object, additionalProperties: true }
        bank_details:
          type: object
          properties:
            bank_name: { type: string }
            account_holder: { type: string }
            iban_masked: { type: string }
            bic_swift: { type: string }
            account_kind: { type: string, enum: [checking, savings, business, escrow, other] }

    CreateCardInstrumentRequest:
      type: object
      required: [company_id, instrument_type, code, label, currency, card_details]
      properties:
        company_id: { type: string, format: uuid }
        instrument_type: { type: string, enum: [card] }
        instrument_subtype: { type: string, enum: [credit_card, debit_card, other] }
        code: { type: string }
        label: { type: string }
        display_name: { type: string }
        currency: { type: string }
        is_default: { type: boolean }
        opening_balance: { type: number }
        description: { type: string }
        metadata: { type: object, additionalProperties: true }
        card_details:
          type: object
          required: [card_type]
          properties:
            card_brand: { type: string }
            card_type: { type: string, enum: [debit, credit, prepaid, virtual] }
            holder_name: { type: string }
            last4: { type: string }
            expiry_month: { type: integer }
            expiry_year: { type: integer }

    CreateCashInstrumentRequest:
      type: object
      required: [company_id, instrument_type, code, label, currency, cash_details]
      properties:
        company_id: { type: string, format: uuid }
        instrument_type: { type: string, enum: [cash] }
        instrument_subtype: { type: string, enum: [petty_cash, cash_register, other] }
        code: { type: string }
        label: { type: string }
        display_name: { type: string }
        currency: { type: string }
        is_default: { type: boolean }
        opening_balance: { type: number }
        description: { type: string }
        metadata: { type: object, additionalProperties: true }
        cash_details:
          type: object
          required: [cash_point_name]
          properties:
            cash_point_name: { type: string }
            location: { type: string }
            reconciliation_frequency: { type: string, enum: [daily, weekly, monthly, manual] }

    PaymentTransaction:
      type: object
      required:
        [id, company_id, payment_instrument_id, transaction_kind, flow_direction, status, transaction_date, amount, currency]
      properties:
        id: { type: string, format: uuid }
        company_id: { type: string, format: uuid }
        portfolio_id: { type: string, format: uuid, nullable: true }
        payment_instrument_id: { type: string, format: uuid }
        transaction_kind:
          type: string
          enum: [income, expense, transfer_in, transfer_out, refund_in, refund_out, fee, adjustment, withdrawal, deposit]
        flow_direction:
          type: string
          enum: [inflow, outflow]
        status:
          type: string
          enum: [draft, pending, posted, reconciled, cancelled]
        transaction_date: { type: string, format: date }
        posting_date: { type: string, format: date, nullable: true }
        value_date: { type: string, format: date, nullable: true }
        amount: { type: number }
        currency: { type: string }
        counterparty_name: { type: string, nullable: true }
        description: { type: string, nullable: true }
        reference: { type: string, nullable: true }
        source_module:
          type: string
          enum: [payments, expenses, debt_payments, bank_transactions, manual, supplier_invoices, receivables, payables, transfers]
        source_id: { type: string, format: uuid, nullable: true }

    CreatePaymentTransactionRequest:
      type: object
      required:
        [company_id, payment_instrument_id, transaction_kind, flow_direction, transaction_date, amount, currency, source_module]
      properties:
        company_id: { type: string, format: uuid }
        payment_instrument_id: { type: string, format: uuid }
        transaction_kind:
          type: string
          enum: [income, expense, refund_in, refund_out, fee, adjustment, withdrawal, deposit]
        flow_direction:
          type: string
          enum: [inflow, outflow]
        transaction_date: { type: string, format: date }
        posting_date: { type: string, format: date }
        value_date: { type: string, format: date }
        amount: { type: number, minimum: 0.01 }
        currency: { type: string }
        counterparty_name: { type: string }
        description: { type: string }
        reference: { type: string }
        category: { type: string }
        notes: { type: string }
        source_module:
          type: string
          enum: [manual, payments, expenses, debt_payments, supplier_invoices, receivables, payables]

    CreatePaymentTransferRequest:
      type: object
      required: [company_id, from_instrument_id, to_instrument_id, transfer_date, amount, currency]
      properties:
        company_id: { type: string, format: uuid }
        from_instrument_id: { type: string, format: uuid }
        to_instrument_id: { type: string, format: uuid }
        transfer_date: { type: string, format: date }
        amount: { type: number, minimum: 0.01 }
        currency: { type: string }
        fee_amount: { type: number, minimum: 0 }
        reference: { type: string }
        notes: { type: string }

    PaymentExportRequest:
      type: object
      required: [export_scope, export_format, filters]
      properties:
        company_id: { type: string, format: uuid }
        portfolio_id: { type: string, format: uuid }
        export_scope:
          type: string
          enum: [company, portfolio, instrument, transaction_list]
        export_format:
          type: string
          enum: [pdf, html]
        filters:
          type: object
          additionalProperties: true

security:
  - bearerAuth: []

paths:
  /create-payment-instrument:
    post:
      summary: Créer un instrument de paiement
      requestBody:
        required: true
        content:
          application/json:
            schema:
              oneOf:
                - $ref: '#/components/schemas/CreateBankInstrumentRequest'
                - $ref: '#/components/schemas/CreateCardInstrumentRequest'
                - $ref: '#/components/schemas/CreateCashInstrumentRequest'
      responses:
        '201':
          description: Instrument créé

  /create-payment-transaction:
    post:
      summary: Créer une transaction manuelle
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreatePaymentTransactionRequest'
      responses:
        '201':
          description: Transaction créée

  /create-payment-transfer:
    post:
      summary: Créer un transfert interne
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreatePaymentTransferRequest'
      responses:
        '201':
          description: Transfert créé

  /generate-payment-report:
    post:
      summary: Générer un export PDF ou HTML
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/PaymentExportRequest'
      responses:
        '202':
          description: Export lancé
```

---

# 2) Types TypeScript

## Types cœur métier

```ts
export type UUID = string;

export type InstrumentType = "bank_account" | "card" | "cash";
export type InstrumentSubtype =
  | "checking"
  | "savings"
  | "credit_card"
  | "debit_card"
  | "petty_cash"
  | "cash_register"
  | "mobile_money"
  | "other";

export type InstrumentStatus = "active" | "inactive" | "archived" | "blocked";

export type TransactionKind =
  | "income"
  | "expense"
  | "transfer_in"
  | "transfer_out"
  | "refund_in"
  | "refund_out"
  | "fee"
  | "adjustment"
  | "withdrawal"
  | "deposit";

export type FlowDirection = "inflow" | "outflow";
export type TransactionStatus = "draft" | "pending" | "posted" | "reconciled" | "cancelled";

export type SourceModule =
  | "payments"
  | "expenses"
  | "debt_payments"
  | "bank_transactions"
  | "manual"
  | "supplier_invoices"
  | "receivables"
  | "payables"
  | "transfers";

export interface Portfolio {
  id: UUID;
  user_id: UUID;
  portfolio_name: string;
  description?: string | null;
  base_currency: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface PaymentInstrument {
  id: UUID;
  user_id: UUID;
  company_id: UUID;
  portfolio_id?: UUID | null;
  instrument_type: InstrumentType;
  instrument_subtype?: InstrumentSubtype | null;
  code: string;
  label: string;
  display_name?: string | null;
  description?: string | null;
  currency: string;
  status: InstrumentStatus;
  is_default: boolean;
  allow_incoming: boolean;
  allow_outgoing: boolean;
  include_in_dashboard: boolean;
  opening_balance: number;
  current_balance: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
}

export interface BankInstrumentDetails {
  instrument_id: UUID;
  bank_name?: string | null;
  account_holder?: string | null;
  iban_masked?: string | null;
  bic_swift?: string | null;
  account_kind?: "checking" | "savings" | "business" | "escrow" | "other" | null;
}

export interface CardInstrumentDetails {
  instrument_id: UUID;
  card_brand?: string | null;
  card_type: "debit" | "credit" | "prepaid" | "virtual";
  holder_name?: string | null;
  last4?: string | null;
  expiry_month?: number | null;
  expiry_year?: number | null;
}

export interface CashInstrumentDetails {
  instrument_id: UUID;
  cash_point_name: string;
  location?: string | null;
  reconciliation_frequency: "daily" | "weekly" | "monthly" | "manual";
}

export interface PaymentTransaction {
  id: UUID;
  user_id: UUID;
  company_id: UUID;
  portfolio_id?: UUID | null;
  payment_instrument_id: UUID;
  transaction_kind: TransactionKind;
  flow_direction: FlowDirection;
  status: TransactionStatus;
  source_module: SourceModule;
  source_table?: string | null;
  source_id?: UUID | null;
  transaction_date: string;
  posting_date?: string | null;
  value_date?: string | null;
  amount: number;
  currency: string;
  company_currency?: string | null;
  fx_rate?: number | null;
  amount_company_currency?: number | null;
  counterparty_name?: string | null;
  description?: string | null;
  reference?: string | null;
  external_reference?: string | null;
  category?: string | null;
  subcategory?: string | null;
  attachment_url?: string | null;
  notes?: string | null;
  is_internal_transfer: boolean;
  transfer_group_id?: UUID | null;
  matched_bank_transaction_id?: UUID | null;
  created_at: string;
  updated_at: string;
}

export interface PaymentTransactionEnriched extends PaymentTransaction {
  company_name: string;
  portfolio_name?: string | null;
  instrument_label: string;
  instrument_type: InstrumentType;
  instrument_subtype?: InstrumentSubtype | null;
}

export interface CreateBankInstrumentInput {
  company_id: UUID;
  instrument_type: "bank_account";
  instrument_subtype?: "checking" | "savings" | "other";
  code: string;
  label: string;
  display_name?: string;
  currency: string;
  is_default?: boolean;
  opening_balance?: number;
  description?: string;
  metadata?: Record<string, unknown>;
  bank_details: {
    bank_name?: string;
    account_holder?: string;
    iban_masked?: string;
    bic_swift?: string;
    account_kind?: "checking" | "savings" | "business" | "escrow" | "other";
  };
}

export interface CreateCardInstrumentInput {
  company_id: UUID;
  instrument_type: "card";
  instrument_subtype?: "credit_card" | "debit_card" | "other";
  code: string;
  label: string;
  display_name?: string;
  currency: string;
  is_default?: boolean;
  opening_balance?: number;
  description?: string;
  metadata?: Record<string, unknown>;
  card_details: {
    card_brand?: string;
    card_type: "debit" | "credit" | "prepaid" | "virtual";
    holder_name?: string;
    last4?: string;
    expiry_month?: number;
    expiry_year?: number;
  };
}

export interface CreateCashInstrumentInput {
  company_id: UUID;
  instrument_type: "cash";
  instrument_subtype?: "petty_cash" | "cash_register" | "other";
  code: string;
  label: string;
  display_name?: string;
  currency: string;
  is_default?: boolean;
  opening_balance?: number;
  description?: string;
  metadata?: Record<string, unknown>;
  cash_details: {
    cash_point_name: string;
    location?: string;
    reconciliation_frequency?: "daily" | "weekly" | "monthly" | "manual";
  };
}

export type CreatePaymentInstrumentInput =
  | CreateBankInstrumentInput
  | CreateCardInstrumentInput
  | CreateCashInstrumentInput;

export interface CreatePaymentTransactionInput {
  company_id: UUID;
  payment_instrument_id: UUID;
  transaction_kind: Exclude<TransactionKind, "transfer_in" | "transfer_out">;
  flow_direction: Exclude<FlowDirection, never>;
  transaction_date: string;
  posting_date?: string;
  value_date?: string;
  amount: number;
  currency: string;
  counterparty_name?: string;
  description?: string;
  reference?: string;
  category?: string;
  notes?: string;
  source_module: Exclude<SourceModule, "transfers" | "bank_transactions">;
}

export interface CreatePaymentTransferInput {
  company_id: UUID;
  from_instrument_id: UUID;
  to_instrument_id: UUID;
  transfer_date: string;
  amount: number;
  currency: string;
  fee_amount?: number;
  reference?: string;
  notes?: string;
}

export interface PaymentExportInput {
  company_id?: UUID;
  portfolio_id?: UUID;
  export_scope: "company" | "portfolio" | "instrument" | "transaction_list";
  export_format: "pdf" | "html";
  filters: Record<string, unknown>;
}
```

---

# 3) Client API TypeScript

## Wrapper simple Supabase Functions + REST

```ts
import { SupabaseClient } from "@supabase/supabase-js";
import type {
  CreatePaymentInstrumentInput,
  CreatePaymentTransactionInput,
  CreatePaymentTransferInput,
  PaymentExportInput,
  PaymentInstrument,
  PaymentTransaction,
  PaymentTransactionEnriched,
  Portfolio,
  UUID,
} from "./types";

export class CashPilotPaymentsApi {
  constructor(private supabase: SupabaseClient) {}

  async listPortfolios(): Promise<Portfolio[]> {
    const { data, error } = await this.supabase
      .from("company_portfolios")
      .select("*")
      .order("portfolio_name");

    if (error) throw error;
    return data ?? [];
  }

  async listCompanyInstruments(companyId: UUID): Promise<PaymentInstrument[]> {
    const { data, error } = await this.supabase
      .from("company_payment_instruments")
      .select("*")
      .eq("company_id", companyId)
      .order("label");

    if (error) throw error;
    return data ?? [];
  }

  async listCompanyTransactions(companyId: UUID, filters?: Record<string, unknown>): Promise<PaymentTransactionEnriched[]> {
    let query = this.supabase
      .from("v_payment_transactions_enriched")
      .select("*")
      .eq("company_id", companyId);

    if (filters?.start_date) query = query.gte("transaction_date", String(filters.start_date));
    if (filters?.end_date) query = query.lte("transaction_date", String(filters.end_date));
    if (filters?.payment_instrument_id) query = query.eq("payment_instrument_id", String(filters.payment_instrument_id));
    if (filters?.status) query = query.in("status", filters.status as string[]);
    if (filters?.flow_direction) query = query.eq("flow_direction", String(filters.flow_direction));

    const { data, error } = await query.order("transaction_date", { ascending: false });

    if (error) throw error;
    return data ?? [];
  }

  async createPaymentInstrument(input: CreatePaymentInstrumentInput) {
    const { data, error } = await this.supabase.functions.invoke("create-payment-instrument", {
      body: input,
    });
    if (error) throw error;
    return data;
  }

  async createPaymentTransaction(input: CreatePaymentTransactionInput) {
    const { data, error } = await this.supabase.functions.invoke("create-payment-transaction", {
      body: input,
    });
    if (error) throw error;
    return data as { transaction: PaymentTransaction };
  }

  async createPaymentTransfer(input: CreatePaymentTransferInput) {
    const { data, error } = await this.supabase.functions.invoke("create-payment-transfer", {
      body: input,
    });
    if (error) throw error;
    return data;
  }

  async generatePaymentReport(input: PaymentExportInput) {
    const { data, error } = await this.supabase.functions.invoke("generate-payment-report", {
      body: input,
    });
    if (error) throw error;
    return data;
  }

  async getCompanyDashboard(companyId: UUID) {
    const { data, error } = await this.supabase.rpc("get_company_payment_dashboard", {
      p_company_id: companyId,
    });
    if (error) throw error;
    return data;
  }
}
```

---

# 4) Hooks React Query

## Hooks principaux

```ts
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CashPilotPaymentsApi } from "./api";
import type {
  CreatePaymentInstrumentInput,
  CreatePaymentTransactionInput,
  CreatePaymentTransferInput,
  PaymentExportInput,
  UUID,
} from "./types";

export const paymentKeys = {
  all: ["payments"] as const,
  portfolios: () => [...paymentKeys.all, "portfolios"] as const,
  instruments: (companyId: UUID) => [...paymentKeys.all, "instruments", companyId] as const,
  transactions: (companyId: UUID, filters?: Record<string, unknown>) =>
    [...paymentKeys.all, "transactions", companyId, filters ?? {}] as const,
  dashboard: (companyId: UUID) => [...paymentKeys.all, "dashboard", companyId] as const,
};

export function usePortfolios(api: CashPilotPaymentsApi) {
  return useQuery({
    queryKey: paymentKeys.portfolios(),
    queryFn: () => api.listPortfolios(),
  });
}

export function useCompanyPaymentInstruments(api: CashPilotPaymentsApi, companyId: UUID) {
  return useQuery({
    queryKey: paymentKeys.instruments(companyId),
    queryFn: () => api.listCompanyInstruments(companyId),
    enabled: !!companyId,
  });
}

export function useCompanyPaymentTransactions(
  api: CashPilotPaymentsApi,
  companyId: UUID,
  filters?: Record<string, unknown>
) {
  return useQuery({
    queryKey: paymentKeys.transactions(companyId, filters),
    queryFn: () => api.listCompanyTransactions(companyId, filters),
    enabled: !!companyId,
  });
}

export function useCompanyPaymentDashboard(api: CashPilotPaymentsApi, companyId: UUID) {
  return useQuery({
    queryKey: paymentKeys.dashboard(companyId),
    queryFn: () => api.getCompanyDashboard(companyId),
    enabled: !!companyId,
  });
}

export function useCreatePaymentInstrument(api: CashPilotPaymentsApi, companyId: UUID) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePaymentInstrumentInput) => api.createPaymentInstrument(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: paymentKeys.instruments(companyId) });
      qc.invalidateQueries({ queryKey: paymentKeys.dashboard(companyId) });
    },
  });
}

export function useCreatePaymentTransaction(api: CashPilotPaymentsApi, companyId: UUID) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePaymentTransactionInput) => api.createPaymentTransaction(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: paymentKeys.transactions(companyId) });
      qc.invalidateQueries({ queryKey: paymentKeys.instruments(companyId) });
      qc.invalidateQueries({ queryKey: paymentKeys.dashboard(companyId) });
    },
  });
}

export function useCreatePaymentTransfer(api: CashPilotPaymentsApi, companyId: UUID) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePaymentTransferInput) => api.createPaymentTransfer(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: paymentKeys.transactions(companyId) });
      qc.invalidateQueries({ queryKey: paymentKeys.instruments(companyId) });
      qc.invalidateQueries({ queryKey: paymentKeys.dashboard(companyId) });
    },
  });
}

export function useGeneratePaymentReport(api: CashPilotPaymentsApi) {
  return useMutation({
    mutationFn: (input: PaymentExportInput) => api.generatePaymentReport(input),
  });
}
```

---

# 5) Edge Function `create-payment-instrument`

## Version complète de base

```ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401 });
    }

    const userId = userData.user.id;
    const body = await req.json();

    const {
      company_id,
      instrument_type,
      instrument_subtype,
      code,
      label,
      display_name,
      currency,
      is_default = false,
      opening_balance = 0,
      description,
      metadata = {},
      bank_details,
      card_details,
      cash_details,
    } = body;

    if (!company_id || !instrument_type || !code || !label || !currency) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    const { data: company, error: companyError } = await supabase
      .from("company")
      .select("id, user_id, portfolio_id")
      .eq("id", company_id)
      .single();

    if (companyError || !company || company.user_id !== userId) {
      return new Response(JSON.stringify({ error: "Company not accessible" }), { status: 403 });
    }

    const { data: instrument, error: instrumentError } = await supabase
      .from("company_payment_instruments")
      .insert({
        user_id: userId,
        company_id,
        portfolio_id: company.portfolio_id,
        instrument_type,
        instrument_subtype,
        code,
        label,
        display_name,
        currency,
        is_default,
        opening_balance,
        current_balance: opening_balance,
        description,
        metadata,
      })
      .select()
      .single();

    if (instrumentError) {
      return new Response(JSON.stringify({ error: instrumentError.message }), { status: 400 });
    }

    if (instrument_type === "bank_account") {
      const { error } = await supabase.from("payment_instrument_bank_accounts").insert({
        instrument_id: instrument.id,
        bank_name: bank_details?.bank_name ?? null,
        account_holder: bank_details?.account_holder ?? null,
        iban_masked: bank_details?.iban_masked ?? null,
        bic_swift: bank_details?.bic_swift ?? null,
        account_kind: bank_details?.account_kind ?? "business",
      });
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }

    if (instrument_type === "card") {
      const { error } = await supabase.from("payment_instrument_cards").insert({
        instrument_id: instrument.id,
        card_brand: card_details?.card_brand ?? null,
        card_type: card_details?.card_type,
        holder_name: card_details?.holder_name ?? null,
        last4: card_details?.last4 ?? null,
        expiry_month: card_details?.expiry_month ?? null,
        expiry_year: card_details?.expiry_year ?? null,
      });
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }

    if (instrument_type === "cash") {
      const { error } = await supabase.from("payment_instrument_cash_accounts").insert({
        instrument_id: instrument.id,
        cash_point_name: cash_details?.cash_point_name ?? "Caisse",
        location: cash_details?.location ?? null,
        reconciliation_frequency: cash_details?.reconciliation_frequency ?? "manual",
      });
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
    }

    return new Response(JSON.stringify({ instrument }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : "Unexpected error",
    }), { status: 500 });
  }
});
```

---

# 6) Edge Function `create-payment-transaction`

```ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401 });
    }

    const userId = userData.user.id;
    const body = await req.json();

    const {
      company_id,
      payment_instrument_id,
      transaction_kind,
      flow_direction,
      transaction_date,
      posting_date,
      value_date,
      amount,
      currency,
      counterparty_name,
      description,
      reference,
      category,
      notes,
      source_module,
    } = body;

    if (!company_id || !payment_instrument_id || !transaction_kind || !flow_direction || !transaction_date || !amount || !currency || !source_module) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    const { data: instrument, error: instrumentError } = await supabase
      .from("company_payment_instruments")
      .select("id, user_id, company_id, status")
      .eq("id", payment_instrument_id)
      .single();

    if (instrumentError || !instrument) {
      return new Response(JSON.stringify({ error: "Instrument not found" }), { status: 404 });
    }

    if (instrument.user_id !== userId || instrument.company_id !== company_id) {
      return new Response(JSON.stringify({ error: "Access denied or company mismatch" }), { status: 403 });
    }

    if (instrument.status !== "active") {
      return new Response(JSON.stringify({ error: "Instrument must be active" }), { status: 400 });
    }

    const { data: transaction, error: txError } = await supabase
      .from("payment_transactions")
      .insert({
        user_id: userId,
        company_id,
        payment_instrument_id,
        transaction_kind,
        flow_direction,
        status: "posted",
        source_module,
        source_table: "payment_transactions",
        transaction_date,
        posting_date: posting_date ?? transaction_date,
        value_date: value_date ?? null,
        amount,
        currency,
        counterparty_name,
        description,
        reference,
        category,
        notes,
        created_by: userId,
        updated_by: userId,
      })
      .select()
      .single();

    if (txError) {
      return new Response(JSON.stringify({ error: txError.message }), { status: 400 });
    }

    return new Response(JSON.stringify({ transaction }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : "Unexpected error",
    }), { status: 500 });
  }
});
```

---

# 7) Edge Function `generate-payment-report`

## Principe

Cette fonction :

* enregistre une ligne dans `payment_report_exports`
* récupère les transactions filtrées
* construit un HTML
* stocke le rendu HTML
* pour le PDF, passe ensuite par un moteur de rendu serveur

## Exemple de squelette

```ts
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

function buildHtmlReport(title: string, rows: Array<Record<string, unknown>>) {
  const tableRows = rows.map((row) => `
    <tr>
      <td>${row.transaction_date ?? ""}</td>
      <td>${row.instrument_label ?? ""}</td>
      <td>${row.flow_direction ?? ""}</td>
      <td>${row.amount ?? ""}</td>
      <td>${row.currency ?? ""}</td>
      <td>${row.description ?? ""}</td>
    </tr>
  `).join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; }
          table { border-collapse: collapse; width: 100%; }
          td, th { border: 1px solid #ddd; padding: 8px; font-size: 12px; }
          th { text-align: left; }
          h1 { margin-bottom: 16px; }
        </style>
      </head>
      <body>
        <h1>${title}</h1>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Instrument</th>
              <th>Sens</th>
              <th>Montant</th>
              <th>Devise</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
    </html>
  `;
}

serve(async (req) => {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: authError } = await supabase.auth.getUser();
    if (authError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), { status: 401 });
    }

    const userId = userData.user.id;
    const body = await req.json();
    const { company_id, portfolio_id, export_scope, export_format, filters } = body;

    const { data: exportRow, error: exportInsertError } = await supabase
      .from("payment_report_exports")
      .insert({
        user_id: userId,
        company_id: company_id ?? null,
        portfolio_id: portfolio_id ?? null,
        export_scope,
        export_format,
        status: "processing",
        filters,
      })
      .select()
      .single();

    if (exportInsertError) {
      return new Response(JSON.stringify({ error: exportInsertError.message }), { status: 400 });
    }

    let query = supabase
      .from("v_payment_transactions_enriched")
      .select("*");

    if (company_id) query = query.eq("company_id", company_id);
    if (portfolio_id) query = query.eq("portfolio_id", portfolio_id);
    if (filters?.start_date) query = query.gte("transaction_date", String(filters.start_date));
    if (filters?.end_date) query = query.lte("transaction_date", String(filters.end_date));

    const { data: rows, error: rowsError } = await query.order("transaction_date", { ascending: false });
    if (rowsError) {
      await supabase.from("payment_report_exports")
        .update({ status: "failed", error_message: rowsError.message })
        .eq("id", exportRow.id);

      return new Response(JSON.stringify({ error: rowsError.message }), { status: 400 });
    }

    const html = buildHtmlReport("CashPilot Payment Report", rows ?? []);

    const fileName = `payment-report-${exportRow.id}.html`;
    const { error: uploadError } = await supabase.storage
      .from("exports")
      .upload(fileName, new Blob([html], { type: "text/html" }), {
        contentType: "text/html",
        upsert: true,
      });

    if (uploadError) {
      await supabase.from("payment_report_exports")
        .update({ status: "failed", error_message: uploadError.message })
        .eq("id", exportRow.id);

      return new Response(JSON.stringify({ error: uploadError.message }), { status: 400 });
    }

    const { data: publicUrlData } = supabase.storage
      .from("exports")
      .getPublicUrl(fileName);

    await supabase.from("payment_report_exports")
      .update({
        status: "completed",
        file_url: publicUrlData.publicUrl,
        generated_at: new Date().toISOString(),
      })
      .eq("id", exportRow.id);

    return new Response(JSON.stringify({
      export_id: exportRow.id,
      status: "completed",
      file_url: publicUrlData.publicUrl,
    }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({
      error: err instanceof Error ? err.message : "Unexpected error",
    }), { status: 500 });
  }
});
```

---

# 8) Structure frontend Next.js recommandée

## Arborescence

```txt
src/
  lib/
    supabase/
      client.ts
    payments/
      api.ts
      hooks.ts
      types.ts
      validators.ts
  app/
    portfolios/
      page.tsx
    companies/
      [companyId]/
        payments/
          page.tsx
          instruments/
            page.tsx
          transfers/
            page.tsx
          reports/
            page.tsx
```

---

# 9) Validation frontend

## Zod recommandé

```ts
import { z } from "zod";

export const createPaymentTransferSchema = z.object({
  company_id: z.string().uuid(),
  from_instrument_id: z.string().uuid(),
  to_instrument_id: z.string().uuid(),
  transfer_date: z.string(),
  amount: z.number().positive(),
  currency: z.string().length(3),
  fee_amount: z.number().min(0).optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});
```

---

# 10) Valeur ajoutée à intégrer dès V1

## À inclure immédiatement

### Idempotency key

Pour les Edge Functions critiques :

* `create-payment-transaction`
* `create-payment-transfer`

Évite les doublons lors de double clic ou retry réseau.

### Export snapshot

Stocker dans `filters` :

* dates
* société
* portefeuille
* types d’instrument
* statut

Cela garantit que le PDF/HTML reste explicable en audit.

### Webhooks internes

Après création d’une transaction :

* recalcul dashboard
* création éventuelle d’alerte
* déclenchement rapprochement

---

# 11) Recommandation finale

Le meilleur enchaînement maintenant est :

## Étape suivante

1. brancher les **tables SQL**
2. déployer les **3 Edge Functions**
3. intégrer les **hooks React Query**
4. ouvrir les pages :

   * instruments
   * transactions
   * transferts
   * exports

Ensuite, le vrai gain métier viendra du module de **rapprochement bancaire** et du **dashboard consolidé par portefeuille**.

Je peux vous générer maintenant le **pack UI complet** :

* pages Next.js
* formulaires React
* tableaux de transactions
* dashboard paiements par société et portefeuille.
# Pack UI complet — Next.js / React pour CashPilot Payments

Je pars sur un pack directement exploitable pour :

* gestion des **instruments de paiement**
* saisie des **transactions**
* gestion des **transferts internes**
* **dashboard** par société
* **exports** PDF / HTML

## Contexte produit

Dans l’environnement de démo, le KPI actuel remonte un **encours total pending de 430 227,60**, ce qui confirme l’intérêt d’une UI claire pour suivre les flux, les instruments et les rapprochements.

---

# 1) Arborescence UI recommandée

```txt
src/
  app/
    companies/
      [companyId]/
        payments/
          page.tsx
          instruments/
            page.tsx
          transactions/
            page.tsx
          transfers/
            page.tsx
          reports/
            page.tsx
  components/
    payments/
      dashboard/
        PaymentKpiCards.tsx
        PaymentFlowChart.tsx
        PaymentInstrumentsSummary.tsx
      instruments/
        PaymentInstrumentTable.tsx
        CreatePaymentInstrumentDialog.tsx
        BankInstrumentForm.tsx
        CardInstrumentForm.tsx
        CashInstrumentForm.tsx
      transactions/
        PaymentTransactionTable.tsx
        CreatePaymentTransactionDialog.tsx
        TransactionFilters.tsx
      transfers/
        CreateTransferDialog.tsx
        TransferHistoryTable.tsx
      reports/
        GenerateReportDialog.tsx
        ExportHistoryTable.tsx
  lib/
    payments/
      api.ts
      hooks.ts
      types.ts
      validators.ts
      formatters.ts
```

---

# 2) Page principale — dashboard paiements

## `app/companies/[companyId]/payments/page.tsx`

```tsx id="69301"
"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CashPilotPaymentsApi } from "@/lib/payments/api";
import { useCompanyPaymentDashboard, useCompanyPaymentInstruments, useCompanyPaymentTransactions } from "@/lib/payments/hooks";
import { PaymentKpiCards } from "@/components/payments/dashboard/PaymentKpiCards";
import { PaymentInstrumentsSummary } from "@/components/payments/dashboard/PaymentInstrumentsSummary";
import { PaymentTransactionTable } from "@/components/payments/transactions/PaymentTransactionTable";

export default function CompanyPaymentsDashboardPage() {
  const params = useParams<{ companyId: string }>();
  const companyId = params.companyId;

  const api = useMemo(() => new CashPilotPaymentsApi(createClient()), []);

  const dashboardQuery = useCompanyPaymentDashboard(api, companyId);
  const instrumentsQuery = useCompanyPaymentInstruments(api, companyId);
  const transactionsQuery = useCompanyPaymentTransactions(api, companyId, {
    start_date: "2026-01-01",
  });

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Paiements</h1>
        <p className="text-sm text-muted-foreground">
          Vue consolidée des instruments, transactions et soldes.
        </p>
      </div>

      <PaymentKpiCards
        loading={dashboardQuery.isLoading}
        data={dashboardQuery.data}
      />

      <PaymentInstrumentsSummary
        loading={instrumentsQuery.isLoading}
        instruments={instrumentsQuery.data ?? []}
      />

      <PaymentTransactionTable
        loading={transactionsQuery.isLoading}
        rows={transactionsQuery.data ?? []}
      />
    </div>
  );
}
```

---

# 3) Composant KPI cards

## `components/payments/dashboard/PaymentKpiCards.tsx`

```tsx id="69302"
type DashboardData = {
  balances?: Array<{
    payment_instrument_id: string;
    label: string;
    instrument_type: string;
    currency: string;
    current_balance: number;
  }>;
  stats?: {
    total_inflow: number;
    total_outflow: number;
    net_flow: number;
    transaction_count: number;
  };
};

function formatAmount(value: number | undefined) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value ?? 0);
}

export function PaymentKpiCards({
  data,
  loading,
}: {
  data?: DashboardData;
  loading?: boolean;
}) {
  const totalBalance =
    data?.balances?.reduce((sum, item) => sum + Number(item.current_balance ?? 0), 0) ?? 0;

  const cards = [
    { label: "Encaissements", value: formatAmount(data?.stats?.total_inflow) },
    { label: "Décaissements", value: formatAmount(data?.stats?.total_outflow) },
    { label: "Net flow", value: formatAmount(data?.stats?.net_flow) },
    { label: "Solde cumulé instruments", value: formatAmount(totalBalance) },
    { label: "Transactions", value: String(data?.stats?.transaction_count ?? 0) },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className="rounded-2xl border p-4 shadow-sm">
          <div className="text-sm text-muted-foreground">{card.label}</div>
          <div className="mt-2 text-2xl font-semibold">
            {loading ? "..." : card.value}
          </div>
        </div>
      ))}
    </div>
  );
}
```

---

# 4) Résumé des instruments

## `components/payments/dashboard/PaymentInstrumentsSummary.tsx`

```tsx id="69303"
import type { PaymentInstrument } from "@/lib/payments/types";

function typeLabel(type: PaymentInstrument["instrument_type"]) {
  switch (type) {
    case "bank_account":
      return "Compte bancaire";
    case "card":
      return "Carte";
    case "cash":
      return "Cash / caisse";
    default:
      return type;
  }
}

function formatAmount(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function PaymentInstrumentsSummary({
  instruments,
  loading,
}: {
  instruments: PaymentInstrument[];
  loading?: boolean;
}) {
  return (
    <div className="rounded-2xl border p-4">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Instruments de paiement</h2>
        <span className="text-sm text-muted-foreground">
          {loading ? "..." : `${instruments.length} instrument(s)`}
        </span>
      </div>

      <div className="space-y-3">
        {instruments.map((instrument) => (
          <div
            key={instrument.id}
            className="flex items-center justify-between rounded-xl border p-3"
          >
            <div>
              <div className="font-medium">{instrument.label}</div>
              <div className="text-sm text-muted-foreground">
                {typeLabel(instrument.instrument_type)} • {instrument.currency} • {instrument.status}
              </div>
            </div>
            <div className="text-right">
              <div className="font-semibold">{formatAmount(instrument.current_balance)}</div>
              <div className="text-xs text-muted-foreground">
                Ouverture {formatAmount(instrument.opening_balance)}
              </div>
            </div>
          </div>
        ))}

        {!loading && instruments.length === 0 && (
          <div className="rounded-xl border border-dashed p-6 text-sm text-muted-foreground">
            Aucun instrument de paiement.
          </div>
        )}
      </div>
    </div>
  );
}
```

---

# 5) Table des transactions

## `components/payments/transactions/PaymentTransactionTable.tsx`

```tsx id="69304"
import type { PaymentTransactionEnriched } from "@/lib/payments/types";

function formatAmount(value: number) {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function flowLabel(flow: string) {
  return flow === "inflow" ? "Entrée" : "Sortie";
}

export function PaymentTransactionTable({
  rows,
  loading,
}: {
  rows: PaymentTransactionEnriched[];
  loading?: boolean;
}) {
  return (
    <div className="rounded-2xl border">
      <div className="border-b p-4">
        <h2 className="text-lg font-semibold">Transactions</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="border-b bg-muted/30">
            <tr>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Instrument</th>
              <th className="px-4 py-3 text-left">Sens</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-left">Contrepartie</th>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-right">Montant</th>
              <th className="px-4 py-3 text-left">Statut</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td className="px-4 py-6" colSpan={8}>
                  Chargement...
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-muted-foreground" colSpan={8}>
                  Aucune transaction.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="px-4 py-3">{row.transaction_date}</td>
                  <td className="px-4 py-3">{row.instrument_label}</td>
                  <td className="px-4 py-3">{flowLabel(row.flow_direction)}</td>
                  <td className="px-4 py-3">{row.transaction_kind}</td>
                  <td className="px-4 py-3">{row.counterparty_name ?? "-"}</td>
                  <td className="px-4 py-3">{row.description ?? "-"}</td>
                  <td className="px-4 py-3 text-right">
                    {formatAmount(row.amount)} {row.currency}
                  </td>
                  <td className="px-4 py-3">{row.status}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
```

---

# 6) Formulaire création d’un instrument

## `components/payments/instruments/CreatePaymentInstrumentDialog.tsx`

```tsx id="69305"
"use client";

import { useState } from "react";
import { useCreatePaymentInstrument } from "@/lib/payments/hooks";
import { CashPilotPaymentsApi } from "@/lib/payments/api";
import type { UUID } from "@/lib/payments/types";

type InstrumentType = "bank_account" | "card" | "cash";

export function CreatePaymentInstrumentDialog({
  api,
  companyId,
}: {
  api: CashPilotPaymentsApi;
  companyId: UUID;
}) {
  const [type, setType] = useState<InstrumentType>("bank_account");
  const [code, setCode] = useState("");
  const [label, setLabel] = useState("");
  const [currency, setCurrency] = useState("EUR");

  const mutation = useCreatePaymentInstrument(api, companyId);

  const submit = async () => {
    if (type === "bank_account") {
      await mutation.mutateAsync({
        company_id: companyId,
        instrument_type: "bank_account",
        code,
        label,
        currency,
        bank_details: {
          bank_name: "Banque principale",
        },
      });
    }

    if (type === "card") {
      await mutation.mutateAsync({
        company_id: companyId,
        instrument_type: "card",
        code,
        label,
        currency,
        card_details: {
          card_type: "debit",
        },
      });
    }

    if (type === "cash") {
      await mutation.mutateAsync({
        company_id: companyId,
        instrument_type: "cash",
        code,
        label,
        currency,
        cash_details: {
          cash_point_name: "Caisse principale",
        },
      });
    }

    setCode("");
    setLabel("");
  };

  return (
    <div className="rounded-2xl border p-4">
      <h3 className="mb-4 text-lg font-semibold">Nouvel instrument</h3>

      <div className="grid gap-3 md:grid-cols-2">
        <select
          className="rounded-lg border px-3 py-2"
          value={type}
          onChange={(e) => setType(e.target.value as InstrumentType)}
        >
          <option value="bank_account">Compte bancaire</option>
          <option value="card">Carte</option>
          <option value="cash">Cash / caisse</option>
        </select>

        <input
          className="rounded-lg border px-3 py-2"
          placeholder="Code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
        />

        <input
          className="rounded-lg border px-3 py-2"
          placeholder="Libellé"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />

        <input
          className="rounded-lg border px-3 py-2"
          placeholder="Devise"
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
        />
      </div>

      <div className="mt-4">
        <button
          className="rounded-lg border px-4 py-2"
          onClick={submit}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Création..." : "Créer l’instrument"}
        </button>
      </div>
    </div>
  );
}
```

---

# 7) Formulaire création d’une transaction

## `components/payments/transactions/CreatePaymentTransactionDialog.tsx`

```tsx id="69306"
"use client";

import { useState } from "react";
import { useCreatePaymentTransaction } from "@/lib/payments/hooks";
import { CashPilotPaymentsApi } from "@/lib/payments/api";
import type { PaymentInstrument, UUID } from "@/lib/payments/types";

export function CreatePaymentTransactionDialog({
  api,
  companyId,
  instruments,
}: {
  api: CashPilotPaymentsApi;
  companyId: UUID;
  instruments: PaymentInstrument[];
}) {
  const mutation = useCreatePaymentTransaction(api, companyId);

  const [paymentInstrumentId, setPaymentInstrumentId] = useState(instruments[0]?.id ?? "");
  const [transactionKind, setTransactionKind] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("0");
  const [currency, setCurrency] = useState("EUR");
  const [transactionDate, setTransactionDate] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [counterpartyName, setCounterpartyName] = useState("");

  const submit = async () => {
    await mutation.mutateAsync({
      company_id: companyId,
      payment_instrument_id: paymentInstrumentId,
      transaction_kind: transactionKind,
      flow_direction: transactionKind === "income" ? "inflow" : "outflow",
      transaction_date: transactionDate,
      amount: Number(amount),
      currency,
      description,
      counterparty_name: counterpartyName,
      source_module: "manual",
    });
  };

  return (
    <div className="rounded-2xl border p-4">
      <h3 className="mb-4 text-lg font-semibold">Nouvelle transaction</h3>

      <div className="grid gap-3 md:grid-cols-2">
        <select
          className="rounded-lg border px-3 py-2"
          value={paymentInstrumentId}
          onChange={(e) => setPaymentInstrumentId(e.target.value)}
        >
          {instruments.map((instrument) => (
            <option key={instrument.id} value={instrument.id}>
              {instrument.label}
            </option>
          ))}
        </select>

        <select
          className="rounded-lg border px-3 py-2"
          value={transactionKind}
          onChange={(e) => setTransactionKind(e.target.value as "income" | "expense")}
        >
          <option value="expense">Dépense</option>
          <option value="income">Encaissement</option>
        </select>

        <input
          className="rounded-lg border px-3 py-2"
          type="date"
          value={transactionDate}
          onChange={(e) => setTransactionDate(e.target.value)}
        />

        <input
          className="rounded-lg border px-3 py-2"
          placeholder="Montant"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <input
          className="rounded-lg border px-3 py-2"
          placeholder="Devise"
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
        />

        <input
          className="rounded-lg border px-3 py-2"
          placeholder="Contrepartie"
          value={counterpartyName}
          onChange={(e) => setCounterpartyName(e.target.value)}
        />

        <input
          className="rounded-lg border px-3 py-2 md:col-span-2"
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div className="mt-4">
        <button
          className="rounded-lg border px-4 py-2"
          onClick={submit}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Enregistrement..." : "Créer la transaction"}
        </button>
      </div>
    </div>
  );
}
```

---

# 8) Formulaire transfert interne

## `components/payments/transfers/CreateTransferDialog.tsx`

```tsx id="69307"
"use client";

import { useState } from "react";
import { useCreatePaymentTransfer } from "@/lib/payments/hooks";
import { CashPilotPaymentsApi } from "@/lib/payments/api";
import type { PaymentInstrument, UUID } from "@/lib/payments/types";

export function CreateTransferDialog({
  api,
  companyId,
  instruments,
}: {
  api: CashPilotPaymentsApi;
  companyId: UUID;
  instruments: PaymentInstrument[];
}) {
  const mutation = useCreatePaymentTransfer(api, companyId);

  const [fromInstrumentId, setFromInstrumentId] = useState(instruments[0]?.id ?? "");
  const [toInstrumentId, setToInstrumentId] = useState(instruments[1]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("EUR");
  const [feeAmount, setFeeAmount] = useState("0");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().slice(0, 10));
  const [reference, setReference] = useState("");

  const submit = async () => {
    await mutation.mutateAsync({
      company_id: companyId,
      from_instrument_id: fromInstrumentId,
      to_instrument_id: toInstrumentId,
      transfer_date: transferDate,
      amount: Number(amount),
      currency,
      fee_amount: Number(feeAmount || 0),
      reference,
    });
  };

  return (
    <div className="rounded-2xl border p-4">
      <h3 className="mb-4 text-lg font-semibold">Nouveau transfert</h3>

      <div className="grid gap-3 md:grid-cols-2">
        <select
          className="rounded-lg border px-3 py-2"
          value={fromInstrumentId}
          onChange={(e) => setFromInstrumentId(e.target.value)}
        >
          {instruments.map((instrument) => (
            <option key={instrument.id} value={instrument.id}>
              Source — {instrument.label}
            </option>
          ))}
        </select>

        <select
          className="rounded-lg border px-3 py-2"
          value={toInstrumentId}
          onChange={(e) => setToInstrumentId(e.target.value)}
        >
          {instruments.map((instrument) => (
            <option key={instrument.id} value={instrument.id}>
              Destination — {instrument.label}
            </option>
          ))}
        </select>

        <input
          className="rounded-lg border px-3 py-2"
          type="date"
          value={transferDate}
          onChange={(e) => setTransferDate(e.target.value)}
        />

        <input
          className="rounded-lg border px-3 py-2"
          placeholder="Montant"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />

        <input
          className="rounded-lg border px-3 py-2"
          placeholder="Devise"
          value={currency}
          onChange={(e) => setCurrency(e.target.value.toUpperCase())}
        />

        <input
          className="rounded-lg border px-3 py-2"
          placeholder="Frais"
          value={feeAmount}
          onChange={(e) => setFeeAmount(e.target.value)}
        />

        <input
          className="rounded-lg border px-3 py-2 md:col-span-2"
          placeholder="Référence"
          value={reference}
          onChange={(e) => setReference(e.target.value)}
        />
      </div>

      <div className="mt-4">
        <button
          className="rounded-lg border px-4 py-2"
          onClick={submit}
          disabled={mutation.isPending}
        >
          {mutation.isPending ? "Création..." : "Créer le transfert"}
        </button>
      </div>
    </div>
  );
}
```

---

# 9) Page rapports / exports

## `app/companies/[companyId]/payments/reports/page.tsx`

```tsx id="69308"
"use client";

import { useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CashPilotPaymentsApi } from "@/lib/payments/api";
import { useGeneratePaymentReport } from "@/lib/payments/hooks";

export default function PaymentReportsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const api = useMemo(() => new CashPilotPaymentsApi(createClient()), []);
  const mutation = useGeneratePaymentReport(api);

  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState("2026-03-31");

  const generate = async (format: "pdf" | "html") => {
    await mutation.mutateAsync({
      company_id: companyId,
      export_scope: "company",
      export_format: format,
      filters: {
        start_date: startDate,
        end_date: endDate,
        status: ["posted", "reconciled"],
      },
    });
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold">Exports paiements</h1>
        <p className="text-sm text-muted-foreground">
          Génération de rapports PDF et HTML.
        </p>
      </div>

      <div className="rounded-2xl border p-4">
        <div className="grid gap-3 md:grid-cols-2">
          <input
            className="rounded-lg border px-3 py-2"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <input
            className="rounded-lg border px-3 py-2"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        <div className="mt-4 flex gap-3">
          <button className="rounded-lg border px-4 py-2" onClick={() => generate("pdf")}>
            Export PDF
          </button>
          <button className="rounded-lg border px-4 py-2" onClick={() => generate("html")}>
            Export HTML
          </button>
        </div>

        {mutation.data && (
          <div className="mt-4 rounded-lg border p-3 text-sm">
            Export généré : {mutation.data.file_url ?? "traitement en cours"}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

# 10) Suggestions UX à forte valeur ajoutée

## À ajouter très vite

### Badges couleur par type d’instrument

* banque
* carte
* cash

### Filtres rapides

* aujourd’hui
* 7 jours
* 30 jours
* mois courant

### Ligne de tendance

Sur le dashboard :

* entrées
* sorties
* net flow

### Indicateurs d’alerte

* solde négatif
* frais élevés
* caisse trop importante
* carte proche du plafond

### Journal unifié

Un seul tableau avec source :

* manuel
* paiement client
* dépense
* transaction bancaire
* transfert

---

# 11) Recommandation d’implémentation

## Ordre pratique

### Étape 1

Mettre en place :

* page dashboard
* liste instruments
* liste transactions

### Étape 2

Ajouter :

* création instrument
* création transaction
* transfert interne

### Étape 3

Ajouter :

* exports
* alertes
* rapprochement bancaire
* consolidation portefeuille

---

# 12) Ce que je vous conseille ensuite

La suite la plus utile est de vous générer le **pack complet de composants shadcn/ui + Tailwind**, avec :

* `Dialog`
* `Table`
* `Card`
* `Badge`
* `Tabs`
* `Form`

pour que l’interface soit immédiatement intégrable dans votre front actuel.
# Pack UI complet — shadcn/ui + Tailwind + React Hook Form + Zod

Je vous livre ci-dessous un **pack UI complet** pour CashPilot Payments, prêt à intégrer dans un front **Next.js + Tailwind + shadcn/ui**.

## Priorité métier

Dans l’environnement de démo, l’encours total en attente remonte à **430 227,60**. L’UI doit donc aider à :

* voir rapidement les soldes et flux
* tracer tous les paiements
* réduire les zones grises entre banque, cartes et cash
* exporter des rapports fiables

---

# 1) Stack cible

## Dépendances recommandées

```bash
npm install react-hook-form zod @hookform/resolvers @tanstack/react-query lucide-react
```

Si shadcn/ui n’est pas encore installé :

```bash
npx shadcn@latest init
npx shadcn@latest add button card dialog input select table badge tabs form textarea label
```

---

# 2) Arborescence complète

```txt
src/
  app/
    companies/
      [companyId]/
        payments/
          page.tsx
          instruments/
            page.tsx
          transactions/
            page.tsx
          transfers/
            page.tsx
          reports/
            page.tsx
  components/
    payments/
      dashboard/
        PaymentDashboard.tsx
        PaymentKpiCards.tsx
        PaymentInstrumentsSummary.tsx
      instruments/
        CreatePaymentInstrumentDialog.tsx
        BankInstrumentForm.tsx
        CardInstrumentForm.tsx
        CashInstrumentForm.tsx
        PaymentInstrumentTable.tsx
      transactions/
        CreatePaymentTransactionDialog.tsx
        PaymentTransactionTable.tsx
        TransactionFilters.tsx
      transfers/
        CreateTransferDialog.tsx
        TransferHistoryTable.tsx
      reports/
        GenerateReportDialog.tsx
        ExportHistoryTable.tsx
  lib/
    payments/
      api.ts
      hooks.ts
      types.ts
      validators.ts
      formatters.ts
```

---

# 3) Helpers UI

## `lib/payments/formatters.ts`

```ts id="72001"
export function formatAmount(value: number | null | undefined, currency = "EUR") {
  const amount = Number(value ?? 0);
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("fr-FR").format(new Date(value));
}

export function instrumentTypeLabel(type: string) {
  switch (type) {
    case "bank_account":
      return "Compte bancaire";
    case "card":
      return "Carte";
    case "cash":
      return "Cash / caisse";
    default:
      return type;
  }
}

export function transactionKindLabel(kind: string) {
  switch (kind) {
    case "income":
      return "Encaissement";
    case "expense":
      return "Dépense";
    case "transfer_in":
      return "Transfert entrant";
    case "transfer_out":
      return "Transfert sortant";
    case "fee":
      return "Frais";
    case "refund_in":
      return "Remboursement entrant";
    case "refund_out":
      return "Remboursement sortant";
    case "adjustment":
      return "Ajustement";
    case "withdrawal":
      return "Retrait";
    case "deposit":
      return "Dépôt";
    default:
      return kind;
  }
}
```

---

# 4) Validation Zod

## `lib/payments/validators.ts`

```ts id="72002"
import { z } from "zod";

export const createBankInstrumentSchema = z.object({
  company_id: z.string().uuid(),
  instrument_type: z.literal("bank_account"),
  instrument_subtype: z.enum(["checking", "savings", "other"]).optional(),
  code: z.string().min(2),
  label: z.string().min(2),
  display_name: z.string().optional(),
  currency: z.string().length(3),
  is_default: z.boolean().optional(),
  opening_balance: z.number().min(0).optional(),
  description: z.string().optional(),
  bank_details: z.object({
    bank_name: z.string().optional(),
    account_holder: z.string().optional(),
    iban_masked: z.string().optional(),
    bic_swift: z.string().optional(),
    account_kind: z.enum(["checking", "savings", "business", "escrow", "other"]).optional(),
  }),
});

export const createCardInstrumentSchema = z.object({
  company_id: z.string().uuid(),
  instrument_type: z.literal("card"),
  instrument_subtype: z.enum(["credit_card", "debit_card", "other"]).optional(),
  code: z.string().min(2),
  label: z.string().min(2),
  display_name: z.string().optional(),
  currency: z.string().length(3),
  is_default: z.boolean().optional(),
  opening_balance: z.number().min(0).optional(),
  description: z.string().optional(),
  card_details: z.object({
    card_brand: z.string().optional(),
    card_type: z.enum(["debit", "credit", "prepaid", "virtual"]),
    holder_name: z.string().optional(),
    last4: z.string().max(4).optional(),
    expiry_month: z.number().min(1).max(12).optional(),
    expiry_year: z.number().min(2024).max(2100).optional(),
  }),
});

export const createCashInstrumentSchema = z.object({
  company_id: z.string().uuid(),
  instrument_type: z.literal("cash"),
  instrument_subtype: z.enum(["petty_cash", "cash_register", "other"]).optional(),
  code: z.string().min(2),
  label: z.string().min(2),
  display_name: z.string().optional(),
  currency: z.string().length(3),
  is_default: z.boolean().optional(),
  opening_balance: z.number().min(0).optional(),
  description: z.string().optional(),
  cash_details: z.object({
    cash_point_name: z.string().min(2),
    location: z.string().optional(),
    reconciliation_frequency: z.enum(["daily", "weekly", "monthly", "manual"]).optional(),
  }),
});

export const createPaymentTransactionSchema = z.object({
  company_id: z.string().uuid(),
  payment_instrument_id: z.string().uuid(),
  transaction_kind: z.enum([
    "income",
    "expense",
    "refund_in",
    "refund_out",
    "fee",
    "adjustment",
    "withdrawal",
    "deposit",
  ]),
  flow_direction: z.enum(["inflow", "outflow"]),
  transaction_date: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3),
  counterparty_name: z.string().optional(),
  description: z.string().optional(),
  reference: z.string().optional(),
  category: z.string().optional(),
  notes: z.string().optional(),
  source_module: z.enum([
    "manual",
    "payments",
    "expenses",
    "debt_payments",
    "supplier_invoices",
    "receivables",
    "payables",
  ]),
});

export const createPaymentTransferSchema = z.object({
  company_id: z.string().uuid(),
  from_instrument_id: z.string().uuid(),
  to_instrument_id: z.string().uuid(),
  transfer_date: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().length(3),
  fee_amount: z.number().min(0).optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
});
```

---

# 5) Dashboard principal

## `components/payments/dashboard/PaymentDashboard.tsx`

```tsx id="72003"
"use client";

import { PaymentKpiCards } from "./PaymentKpiCards";
import { PaymentInstrumentsSummary } from "./PaymentInstrumentsSummary";
import { PaymentTransactionTable } from "@/components/payments/transactions/PaymentTransactionTable";
import type { PaymentInstrument, PaymentTransactionEnriched } from "@/lib/payments/types";

type DashboardData = {
  balances?: Array<{
    payment_instrument_id: string;
    label: string;
    instrument_type: string;
    currency: string;
    current_balance: number;
  }>;
  stats?: {
    total_inflow: number;
    total_outflow: number;
    net_flow: number;
    transaction_count: number;
  };
};

export function PaymentDashboard({
  dashboard,
  instruments,
  transactions,
  loading,
}: {
  dashboard?: DashboardData;
  instruments: PaymentInstrument[];
  transactions: PaymentTransactionEnriched[];
  loading?: boolean;
}) {
  return (
    <div className="space-y-6">
      <PaymentKpiCards data={dashboard} loading={loading} />
      <PaymentInstrumentsSummary instruments={instruments} loading={loading} />
      <PaymentTransactionTable rows={transactions} loading={loading} />
    </div>
  );
}
```

---

## `components/payments/dashboard/PaymentKpiCards.tsx`

```tsx id="72004"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatAmount } from "@/lib/payments/formatters";

type DashboardData = {
  balances?: Array<{
    payment_instrument_id: string;
    label: string;
    instrument_type: string;
    currency: string;
    current_balance: number;
  }>;
  stats?: {
    total_inflow: number;
    total_outflow: number;
    net_flow: number;
    transaction_count: number;
  };
};

export function PaymentKpiCards({
  data,
  loading,
}: {
  data?: DashboardData;
  loading?: boolean;
}) {
  const totalBalance =
    data?.balances?.reduce((sum, item) => sum + Number(item.current_balance ?? 0), 0) ?? 0;

  const items = [
    { title: "Encaissements", value: formatAmount(data?.stats?.total_inflow) },
    { title: "Décaissements", value: formatAmount(data?.stats?.total_outflow) },
    { title: "Net flow", value: formatAmount(data?.stats?.net_flow) },
    { title: "Solde cumulé", value: formatAmount(totalBalance) },
    { title: "Transactions", value: String(data?.stats?.transaction_count ?? 0) },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
      {items.map((item) => (
        <Card key={item.title}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {item.title}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">
              {loading ? "..." : item.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

---

## `components/payments/dashboard/PaymentInstrumentsSummary.tsx`

```tsx id="72005"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PaymentInstrument } from "@/lib/payments/types";
import { formatAmount, instrumentTypeLabel } from "@/lib/payments/formatters";

export function PaymentInstrumentsSummary({
  instruments,
  loading,
}: {
  instruments: PaymentInstrument[];
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Instruments de paiement</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {loading ? (
          <div className="text-sm text-muted-foreground">Chargement...</div>
        ) : instruments.length === 0 ? (
          <div className="text-sm text-muted-foreground">Aucun instrument trouvé.</div>
        ) : (
          instruments.map((instrument) => (
            <div
              key={instrument.id}
              className="flex items-center justify-between rounded-xl border p-4"
            >
              <div className="space-y-1">
                <div className="font-medium">{instrument.label}</div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">
                    {instrumentTypeLabel(instrument.instrument_type)}
                  </Badge>
                  <Badge variant="outline">{instrument.currency}</Badge>
                  <Badge variant="outline">{instrument.status}</Badge>
                  {instrument.is_default && <Badge>Par défaut</Badge>}
                </div>
              </div>

              <div className="text-right">
                <div className="font-semibold">
                  {formatAmount(instrument.current_balance, instrument.currency)}
                </div>
                <div className="text-xs text-muted-foreground">
                  Ouverture {formatAmount(instrument.opening_balance, instrument.currency)}
                </div>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
```

---

# 6) Table des instruments

## `components/payments/instruments/PaymentInstrumentTable.tsx`

```tsx id="72006"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { PaymentInstrument } from "@/lib/payments/types";
import { formatAmount, instrumentTypeLabel } from "@/lib/payments/formatters";

export function PaymentInstrumentTable({
  instruments,
}: {
  instruments: PaymentInstrument[];
}) {
  return (
    <div className="rounded-2xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Libellé</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Code</TableHead>
            <TableHead>Devise</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead>Défaut</TableHead>
            <TableHead className="text-right">Solde</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {instruments.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-muted-foreground">
                Aucun instrument.
              </TableCell>
            </TableRow>
          ) : (
            instruments.map((instrument) => (
              <TableRow key={instrument.id}>
                <TableCell className="font-medium">{instrument.label}</TableCell>
                <TableCell>{instrumentTypeLabel(instrument.instrument_type)}</TableCell>
                <TableCell>{instrument.code}</TableCell>
                <TableCell>{instrument.currency}</TableCell>
                <TableCell>
                  <Badge variant="outline">{instrument.status}</Badge>
                </TableCell>
                <TableCell>{instrument.is_default ? "Oui" : "Non"}</TableCell>
                <TableCell className="text-right">
                  {formatAmount(instrument.current_balance, instrument.currency)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
```

---

# 7) Dialog création instrument

## `components/payments/instruments/CreatePaymentInstrumentDialog.tsx`

```tsx id="72007"
"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BankInstrumentForm } from "./BankInstrumentForm";
import { CardInstrumentForm } from "./CardInstrumentForm";
import { CashInstrumentForm } from "./CashInstrumentForm";
import { CashPilotPaymentsApi } from "@/lib/payments/api";

export function CreatePaymentInstrumentDialog({
  api,
  companyId,
}: {
  api: CashPilotPaymentsApi;
  companyId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Nouvel instrument</Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Créer un instrument de paiement</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="bank_account" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="bank_account">Banque</TabsTrigger>
            <TabsTrigger value="card">Carte</TabsTrigger>
            <TabsTrigger value="cash">Cash</TabsTrigger>
          </TabsList>

          <TabsContent value="bank_account">
            <BankInstrumentForm api={api} companyId={companyId} onSuccess={() => setOpen(false)} />
          </TabsContent>

          <TabsContent value="card">
            <CardInstrumentForm api={api} companyId={companyId} onSuccess={() => setOpen(false)} />
          </TabsContent>

          <TabsContent value="cash">
            <CashInstrumentForm api={api} companyId={companyId} onSuccess={() => setOpen(false)} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
```

---

# 8) Form banque

## `components/payments/instruments/BankInstrumentForm.tsx`

```tsx id="72008"
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createBankInstrumentSchema } from "@/lib/payments/validators";
import { useCreatePaymentInstrument } from "@/lib/payments/hooks";
import { CashPilotPaymentsApi } from "@/lib/payments/api";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FormValues = z.infer<typeof createBankInstrumentSchema>;

export function BankInstrumentForm({
  api,
  companyId,
  onSuccess,
}: {
  api: CashPilotPaymentsApi;
  companyId: string;
  onSuccess?: () => void;
}) {
  const mutation = useCreatePaymentInstrument(api, companyId);

  const form = useForm<FormValues>({
    resolver: zodResolver(createBankInstrumentSchema),
    defaultValues: {
      company_id: companyId,
      instrument_type: "bank_account",
      instrument_subtype: "checking",
      code: "",
      label: "",
      currency: "EUR",
      opening_balance: 0,
      bank_details: {
        bank_name: "",
        account_holder: "",
        iban_masked: "",
        bic_swift: "",
        account_kind: "business",
      },
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await mutation.mutateAsync(values);
    onSuccess?.();
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-3 pt-4">
      <Input placeholder="Code" {...form.register("code")} />
      <Input placeholder="Libellé" {...form.register("label")} />
      <Input placeholder="Devise" {...form.register("currency")} />
      <Input
        type="number"
        step="0.01"
        placeholder="Solde d'ouverture"
        {...form.register("opening_balance", { valueAsNumber: true })}
      />
      <Input placeholder="Banque" {...form.register("bank_details.bank_name")} />
      <Input placeholder="Titulaire" {...form.register("bank_details.account_holder")} />
      <Input placeholder="IBAN masqué" {...form.register("bank_details.iban_masked")} />
      <Input placeholder="BIC / SWIFT" {...form.register("bank_details.bic_swift")} />

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Création..." : "Créer le compte bancaire"}
      </Button>
    </form>
  );
}
```

---

# 9) Form carte

## `components/payments/instruments/CardInstrumentForm.tsx`

```tsx id="72009"
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createCardInstrumentSchema } from "@/lib/payments/validators";
import { useCreatePaymentInstrument } from "@/lib/payments/hooks";
import { CashPilotPaymentsApi } from "@/lib/payments/api";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FormValues = z.infer<typeof createCardInstrumentSchema>;

export function CardInstrumentForm({
  api,
  companyId,
  onSuccess,
}: {
  api: CashPilotPaymentsApi;
  companyId: string;
  onSuccess?: () => void;
}) {
  const mutation = useCreatePaymentInstrument(api, companyId);

  const form = useForm<FormValues>({
    resolver: zodResolver(createCardInstrumentSchema),
    defaultValues: {
      company_id: companyId,
      instrument_type: "card",
      instrument_subtype: "debit_card",
      code: "",
      label: "",
      currency: "EUR",
      opening_balance: 0,
      card_details: {
        card_brand: "Visa",
        card_type: "debit",
        holder_name: "",
        last4: "",
      },
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await mutation.mutateAsync(values);
    onSuccess?.();
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-3 pt-4">
      <Input placeholder="Code" {...form.register("code")} />
      <Input placeholder="Libellé" {...form.register("label")} />
      <Input placeholder="Devise" {...form.register("currency")} />
      <Input placeholder="Marque" {...form.register("card_details.card_brand")} />
      <Input placeholder="Titulaire" {...form.register("card_details.holder_name")} />
      <Input placeholder="4 derniers chiffres" {...form.register("card_details.last4")} />

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Création..." : "Créer la carte"}
      </Button>
    </form>
  );
}
```

---

# 10) Form cash

## `components/payments/instruments/CashInstrumentForm.tsx`

```tsx id="72010"
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createCashInstrumentSchema } from "@/lib/payments/validators";
import { useCreatePaymentInstrument } from "@/lib/payments/hooks";
import { CashPilotPaymentsApi } from "@/lib/payments/api";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FormValues = z.infer<typeof createCashInstrumentSchema>;

export function CashInstrumentForm({
  api,
  companyId,
  onSuccess,
}: {
  api: CashPilotPaymentsApi;
  companyId: string;
  onSuccess?: () => void;
}) {
  const mutation = useCreatePaymentInstrument(api, companyId);

  const form = useForm<FormValues>({
    resolver: zodResolver(createCashInstrumentSchema),
    defaultValues: {
      company_id: companyId,
      instrument_type: "cash",
      instrument_subtype: "petty_cash",
      code: "",
      label: "",
      currency: "EUR",
      opening_balance: 0,
      cash_details: {
        cash_point_name: "Caisse principale",
        location: "",
        reconciliation_frequency: "manual",
      },
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await mutation.mutateAsync(values);
    onSuccess?.();
  });

  return (
    <form onSubmit={onSubmit} className="grid gap-3 pt-4">
      <Input placeholder="Code" {...form.register("code")} />
      <Input placeholder="Libellé" {...form.register("label")} />
      <Input placeholder="Devise" {...form.register("currency")} />
      <Input placeholder="Point de caisse" {...form.register("cash_details.cash_point_name")} />
      <Input placeholder="Localisation" {...form.register("cash_details.location")} />

      <Button type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "Création..." : "Créer la caisse"}
      </Button>
    </form>
  );
}
```

---

# 11) Transactions

## `components/payments/transactions/PaymentTransactionTable.tsx`

```tsx id="72011"
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { PaymentTransactionEnriched } from "@/lib/payments/types";
import { formatAmount, transactionKindLabel } from "@/lib/payments/formatters";

export function PaymentTransactionTable({
  rows,
  loading,
}: {
  rows: PaymentTransactionEnriched[];
  loading?: boolean;
}) {
  return (
    <div className="rounded-2xl border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Instrument</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Sens</TableHead>
            <TableHead>Contrepartie</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Statut</TableHead>
            <TableHead className="text-right">Montant</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell colSpan={8}>Chargement...</TableCell>
            </TableRow>
          ) : rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={8} className="text-muted-foreground">
                Aucune transaction.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.transaction_date}</TableCell>
                <TableCell>{row.instrument_label}</TableCell>
                <TableCell>{transactionKindLabel(row.transaction_kind)}</TableCell>
                <TableCell>{row.flow_direction === "inflow" ? "Entrée" : "Sortie"}</TableCell>
                <TableCell>{row.counterparty_name ?? "-"}</TableCell>
                <TableCell>{row.description ?? "-"}</TableCell>
                <TableCell>
                  <Badge variant="outline">{row.status}</Badge>
                </TableCell>
                <TableCell className="text-right">
                  {formatAmount(row.amount, row.currency)}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
```

---

## `components/payments/transactions/CreatePaymentTransactionDialog.tsx`

```tsx id="72012"
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createPaymentTransactionSchema } from "@/lib/payments/validators";
import { z } from "zod";
import { useCreatePaymentTransaction } from "@/lib/payments/hooks";
import { CashPilotPaymentsApi } from "@/lib/payments/api";
import type { PaymentInstrument } from "@/lib/payments/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useState } from "react";

type FormValues = z.infer<typeof createPaymentTransactionSchema>;

export function CreatePaymentTransactionDialog({
  api,
  companyId,
  instruments,
}: {
  api: CashPilotPaymentsApi;
  companyId: string;
  instruments: PaymentInstrument[];
}) {
  const [open, setOpen] = useState(false);
  const mutation = useCreatePaymentTransaction(api, companyId);

  const form = useForm<FormValues>({
    resolver: zodResolver(createPaymentTransactionSchema),
    defaultValues: {
      company_id: companyId,
      payment_instrument_id: instruments[0]?.id ?? "",
      transaction_kind: "expense",
      flow_direction: "outflow",
      transaction_date: new Date().toISOString().slice(0, 10),
      amount: 0,
      currency: "EUR",
      source_module: "manual",
      description: "",
      counterparty_name: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await mutation.mutateAsync(values);
    setOpen(false);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Nouvelle transaction</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créer une transaction</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="grid gap-3">
          <select
            className="rounded-md border px-3 py-2"
            {...form.register("payment_instrument_id")}
          >
            {instruments.map((instrument) => (
              <option key={instrument.id} value={instrument.id}>
                {instrument.label}
              </option>
            ))}
          </select>

          <select
            className="rounded-md border px-3 py-2"
            {...form.register("transaction_kind")}
            onChange={(e) => {
              const value = e.target.value as FormValues["transaction_kind"];
              form.setValue("transaction_kind", value);
              form.setValue("flow_direction", value === "income" || value === "refund_in" || value === "deposit" ? "inflow" : "outflow");
            }}
          >
            <option value="expense">Dépense</option>
            <option value="income">Encaissement</option>
            <option value="fee">Frais</option>
            <option value="deposit">Dépôt</option>
            <option value="withdrawal">Retrait</option>
          </select>

          <Input type="date" {...form.register("transaction_date")} />
          <Input type="number" step="0.01" {...form.register("amount", { valueAsNumber: true })} />
          <Input placeholder="Devise" {...form.register("currency")} />
          <Input placeholder="Contrepartie" {...form.register("counterparty_name")} />
          <Input placeholder="Description" {...form.register("description")} />
          <Input placeholder="Référence" {...form.register("reference")} />

          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Enregistrement..." : "Créer la transaction"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

---

# 12) Transferts

## `components/payments/transfers/CreateTransferDialog.tsx`

```tsx id="72013"
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createPaymentTransferSchema } from "@/lib/payments/validators";
import { z } from "zod";
import { useCreatePaymentTransfer } from "@/lib/payments/hooks";
import { CashPilotPaymentsApi } from "@/lib/payments/api";
import type { PaymentInstrument } from "@/lib/payments/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type FormValues = z.infer<typeof createPaymentTransferSchema>;

export function CreateTransferDialog({
  api,
  companyId,
  instruments,
}: {
  api: CashPilotPaymentsApi;
  companyId: string;
  instruments: PaymentInstrument[];
}) {
  const [open, setOpen] = useState(false);
  const mutation = useCreatePaymentTransfer(api, companyId);

  const form = useForm<FormValues>({
    resolver: zodResolver(createPaymentTransferSchema),
    defaultValues: {
      company_id: companyId,
      from_instrument_id: instruments[0]?.id ?? "",
      to_instrument_id: instruments[1]?.id ?? "",
      transfer_date: new Date().toISOString().slice(0, 10),
      amount: 0,
      currency: "EUR",
      fee_amount: 0,
      reference: "",
      notes: "",
    },
  });

  const onSubmit = form.handleSubmit(async (values) => {
    await mutation.mutateAsync(values);
    setOpen(false);
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Nouveau transfert</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Créer un transfert interne</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="grid gap-3">
          <select className="rounded-md border px-3 py-2" {...form.register("from_instrument_id")}>
            {instruments.map((instrument) => (
              <option key={instrument.id} value={instrument.id}>
                Source — {instrument.label}
              </option>
            ))}
          </select>

          <select className="rounded-md border px-3 py-2" {...form.register("to_instrument_id")}>
            {instruments.map((instrument) => (
              <option key={instrument.id} value={instrument.id}>
                Destination — {instrument.label}
              </option>
            ))}
          </select>

          <Input type="date" {...form.register("transfer_date")} />
          <Input type="number" step="0.01" {...form.register("amount", { valueAsNumber: true })} />
          <Input placeholder="Devise" {...form.register("currency")} />
          <Input type="number" step="0.01" {...form.register("fee_amount", { valueAsNumber: true })} />
          <Input placeholder="Référence" {...form.register("reference")} />
          <Input placeholder="Notes" {...form.register("notes")} />

          <Button type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? "Création..." : "Créer le transfert"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

---

# 13) Rapports

## `components/payments/reports/GenerateReportDialog.tsx`

```tsx id="72014"
"use client";

import { useState } from "react";
import { useGeneratePaymentReport } from "@/lib/payments/hooks";
import { CashPilotPaymentsApi } from "@/lib/payments/api";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function GenerateReportDialog({
  api,
  companyId,
}: {
  api: CashPilotPaymentsApi;
  companyId: string;
}) {
  const [open, setOpen] = useState(false);
  const mutation = useGeneratePaymentReport(api);
  const [startDate, setStartDate] = useState("2026-01-01");
  const [endDate, setEndDate] = useState("2026-03-31");

  async function generate(format: "pdf" | "html") {
    await mutation.mutateAsync({
      company_id: companyId,
      export_scope: "company",
      export_format: format,
      filters: {
        start_date: startDate,
        end_date: endDate,
        status: ["posted", "reconciled"],
      },
    });
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Générer un rapport</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Exporter les paiements</DialogTitle>
        </DialogHeader>

        <div className="grid gap-3">
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />

          <div className="flex gap-3">
            <Button type="button" onClick={() => generate("pdf")}>
              PDF
            </Button>
            <Button type="button" variant="outline" onClick={() => generate("html")}>
              HTML
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

---

# 14) Pages Next.js

## `app/companies/[companyId]/payments/instruments/page.tsx`

```tsx id="72015"
"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CashPilotPaymentsApi } from "@/lib/payments/api";
import { useCompanyPaymentInstruments } from "@/lib/payments/hooks";
import { PaymentInstrumentTable } from "@/components/payments/instruments/PaymentInstrumentTable";
import { CreatePaymentInstrumentDialog } from "@/components/payments/instruments/CreatePaymentInstrumentDialog";

export default function InstrumentsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const api = useMemo(() => new CashPilotPaymentsApi(createClient()), []);
  const instrumentsQuery = useCompanyPaymentInstruments(api, companyId);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Instruments</h1>
          <p className="text-sm text-muted-foreground">
            Comptes bancaires, cartes et caisses.
          </p>
        </div>
        <CreatePaymentInstrumentDialog api={api} companyId={companyId} />
      </div>

      <PaymentInstrumentTable instruments={instrumentsQuery.data ?? []} />
    </div>
  );
}
```

---

## `app/companies/[companyId]/payments/transactions/page.tsx`

```tsx id="72016"
"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CashPilotPaymentsApi } from "@/lib/payments/api";
import { useCompanyPaymentInstruments, useCompanyPaymentTransactions } from "@/lib/payments/hooks";
import { PaymentTransactionTable } from "@/components/payments/transactions/PaymentTransactionTable";
import { CreatePaymentTransactionDialog } from "@/components/payments/transactions/CreatePaymentTransactionDialog";

export default function TransactionsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const api = useMemo(() => new CashPilotPaymentsApi(createClient()), []);

  const instrumentsQuery = useCompanyPaymentInstruments(api, companyId);
  const transactionsQuery = useCompanyPaymentTransactions(api, companyId, {});

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Transactions</h1>
          <p className="text-sm text-muted-foreground">
            Journal unifié des flux.
          </p>
        </div>

        <CreatePaymentTransactionDialog
          api={api}
          companyId={companyId}
          instruments={instrumentsQuery.data ?? []}
        />
      </div>

      <PaymentTransactionTable
        rows={transactionsQuery.data ?? []}
        loading={transactionsQuery.isLoading}
      />
    </div>
  );
}
```

---

## `app/companies/[companyId]/payments/transfers/page.tsx`

```tsx id="72017"
"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CashPilotPaymentsApi } from "@/lib/payments/api";
import { useCompanyPaymentInstruments } from "@/lib/payments/hooks";
import { CreateTransferDialog } from "@/components/payments/transfers/CreateTransferDialog";

export default function TransfersPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const api = useMemo(() => new CashPilotPaymentsApi(createClient()), []);
  const instrumentsQuery = useCompanyPaymentInstruments(api, companyId);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Transferts internes</h1>
          <p className="text-sm text-muted-foreground">
            Déplacement de fonds entre instruments.
          </p>
        </div>

        <CreateTransferDialog
          api={api}
          companyId={companyId}
          instruments={instrumentsQuery.data ?? []}
        />
      </div>
    </div>
  );
}
```

---

## `app/companies/[companyId]/payments/reports/page.tsx`

```tsx id="72018"
"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { CashPilotPaymentsApi } from "@/lib/payments/api";
import { GenerateReportDialog } from "@/components/payments/reports/GenerateReportDialog";

export default function ReportsPage() {
  const { companyId } = useParams<{ companyId: string }>();
  const api = useMemo(() => new CashPilotPaymentsApi(createClient()), []);

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Rapports</h1>
          <p className="text-sm text-muted-foreground">
            Exports PDF et HTML des paiements.
          </p>
        </div>

        <GenerateReportDialog api={api} companyId={companyId} />
      </div>
    </div>
  );
}
```

---

# 15) Recommandations UX immédiates

## À intégrer dès la V1

* badge visuel par type d’instrument
* bouton rapide “Nouvelle transaction”
* bouton rapide “Nouveau transfert”
* tri décroissant par date
* filtre par période
* filtre par instrument
* indicateur “par défaut”
* bloc d’alerte si solde négatif

## À intégrer en V2

* vue portefeuille multi-sociétés
* timeline des transferts liés
* rapprochement bancaire visuel
* histogramme des sorties par instrument
* alertes de plafond carte

---

# 16) Point d’attention technique

Dans vos formulaires carte :

* ne jamais demander le numéro complet
* ne jamais stocker le CVV
* limiter l’UI à :

  * marque
  * type
  * titulaire
  * `last4`
  * expiration

---

# 17) Prochaine étape la plus utile

Le meilleur enchaînement maintenant est de produire le **pack backend + frontend final prêt dépôt Git**, avec :

* tous les fichiers séparés proprement
* imports cohérents
* structure `src/`
* composants `ui/`
* et éventuellement un **ZIP de code** ou des **fichiers `.ts/.tsx` générés**.
