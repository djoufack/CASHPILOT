# CashPilot GED HUB Federée

## Objectif

Mettre en place une GED federée professionnelle, visible dans la navbar sous **GED HUB**, qui centralise les documents de tous les modules sans dupliquer la logique metier existante.

## Principes non negociables (ENF)

- **ENF-1 (zero hardcode metier)**: toutes les donnees du hub viennent de Supabase (tables metier + table metadata GED).
- **ENF-2 (ownership user -> company -> donnee)**: toute table ajoutee contient `company_id UUID NOT NULL REFERENCES public.company(id) ON DELETE CASCADE`; RLS stricte par `company.user_id = auth.uid()`.
- **ENF-3 (journalisation comptable automatique)**: aucun contournement de triggers comptables existants; les generations de documents financiers passent par les tables metier existantes.

## Portee V1 (federation + operations)

- Aggregation centralisee des documents:
  - `invoices`
  - `quotes`
  - `credit_notes`
  - `delivery_notes`
  - `purchase_orders`
  - `supplier_invoices` (lecture/ouverture)
- Metadonnees avancees par document (tags, confidentialite, retention, favori, notes).
- Recherche globale et filtres (type module, statut, presence de fichier, texte).
- Actions depuis GED HUB:
  - Ouvrir le document (URL signee ou URL existante)
  - Ouvrir le module source
  - Generer PDF pour documents supportes, en preservant le lien avec la table metier source.

## Architecture cible

### 1) Federation des sources

- Le GED HUB ne remplace pas les modules; il les federes.
- Les enregistrements restent dans leurs tables metier d’origine.
- Le hook GED interroge chaque table source scopee `company_id`, puis normalise dans un modele commun `GedHubDocument`.

### 2) Couche metadata GED

- Nouvelle table: `public.document_hub_metadata`.
- Cle metier unique: `(company_id, source_table, source_id)`.
- Permet d’ajouter des capacites transverses sans modifier chaque module.

Schema fonctionnel:

- `company_id`, `source_table`, `source_id`
- `tags text[]`
- `doc_category text`
- `confidentiality_level text`
- `retention_until date`
- `is_starred boolean`
- `notes text`
- `created_by`, `updated_by`, `created_at`, `updated_at`

### 3) Securite/RLS

- RLS activee sur `document_hub_metadata`.
- Policies CRUD limitees aux societes appartenant au user authentifie.
- Index sur `company_id`, `(company_id, source_table)`, `GIN(tags)`.

### 4) UX GED HUB

- Nouvelle page `/app/ged-hub`.
- Ajout menu **GED HUB** dans `Sidebar` + `MobileMenu`.
- Interface:
  - KPIs rapides (total docs, docs avec fichier, favoris)
  - Barre de recherche globale
  - Filtres
  - Tableau documents + actions
  - Edition metadata inline (tags/notes/favori/confidentialite)

### 5) Generation de documents depuis le hub

- Reutilisation des services d’export existants.
- Pour types supportes:
  - Facture, Devis, Avoir, Bon de livraison, Bon de commande.
- Resultat attendu:
  - generation PDF
  - upload storage selon service existant
  - mise a jour `file_url` / `file_generated_at` sur l’enregistrement source.

## Plan d’implementation (ordre)

1. **DB**
   - migration `document_hub_metadata` + indexes + trigger `updated_at` + RLS.
2. **Data access**
   - hook `useGedHub`:
     - fetch federé multi-tables
     - normalisation `GedHubDocument`
     - merge metadata
     - open signed URL
     - upsert metadata
     - generate PDF via services existants.
3. **Frontend**
   - page `GedHubPage.jsx` (tableau, filtres, actions).
   - route `/app/ged-hub`.
   - menu **GED HUB** (desktop + mobile).
4. **Validation**
   - tests lint + unit + build.
   - verification manuelle des flows critiques.
5. **Delivery**
   - commit sur `main`.
   - deploiement Vercel CLI.

## Criteres d’acceptation V1

- Le menu **GED HUB** est visible sur desktop/tablette/mobile.
- Le hub liste les documents de la societe active uniquement.
- Les metadata modifiees dans le hub sont persistantes et relues.
- Ouvrir document fonctionne (URL signee pour buckets prives).
- Generer PDF depuis hub fonctionne pour types supportes et met a jour la source.
- Aucun hardcode metier; aucun contournement RLS/company scope.

## Limites V1 (phase suivante)

- Workflow d’approbation documentaire complet.
- Versioning multi-revisions natif.
- OCR/indexation plein texte cross-document.
- Corbeille/restore dediee GED.
- SSO partage externe signe/evidence.

## Risques et mitigations

- Heterogeneite des schemas metier:
  - Mitigation: normalisation stricte dans `useGedHub`.
- URL legacy (`file_url` parfois URL, parfois path storage):
  - Mitigation: resolver URL tolerant (signed URL si path; passthrough si URL).
- Performance sur gros volumes:
  - Mitigation: pagination et filtres server-side en V2.
