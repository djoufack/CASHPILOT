# CVPilot — Design Document

**Date** : 2026-03-18
**Statut** : Validé
**Type** : Application standalone

---

## 1. Objectif

Plateforme d'automatisation de création et gestion de CV et lettres de motivation pour Georges Eric Djoufack. Génère des documents .docx professionnels adaptés à chaque offre d'emploi, avec gestion complète du cycle de candidature.

## 2. Décisions d'architecture

| Question         | Décision                                             | Justification                                         |
| ---------------- | ---------------------------------------------------- | ----------------------------------------------------- |
| Projet           | Standalone (nouveau repo `cv-pilot/`)                | Découplé de CashPilot, maintenance indépendante       |
| Database         | Supabase (nouveau projet)                            | Auth, DB, Storage, Edge Functions intégrés            |
| Génération .docx | Edge Function Supabase                               | Lib `docx` compatible Deno, zéro infra supplémentaire |
| Scraping URLs    | Fetch + parsing HTML, fallback texte manuel          | Simple, gratuit, pas de dépendance externe            |
| Envoi email      | gws CLI export (V1) + Gmail API directe (V2)         | Livraison rapide V1 sans OAuth                        |
| Recherche        | Full-text PostgreSQL (V1) + pgvector embeddings (V2) | Natif Supabase, pgvector en upgrade                   |

## 3. Stack technique

- **Frontend** : React 18 + Vite + Tailwind CSS + shadcn/ui + Recharts
- **Backend** : Supabase (Auth, PostgreSQL, Storage, Edge Functions)
- **Déploiement** : Vercel
- **Recherche V1** : `tsvector` / full-text search PostgreSQL
- **Recherche V2** : pgvector (extension `vector`)
- **Email V1** : Export commande gws CLI
- **Email V2** : Gmail API (OAuth2)

## 4. Modèle de données

### Table `applications`

```sql
CREATE TABLE applications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company       TEXT NOT NULL,
  job_title     TEXT NOT NULL,
  job_url       TEXT,
  job_source    TEXT CHECK (job_source IN ('url', 'text', 'file', 'batch')),
  job_description TEXT NOT NULL,
  language      TEXT DEFAULT 'fr' CHECK (language IN ('fr', 'en', 'nl')),
  sector        TEXT,
  status        TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'sent', 'interview', 'rejected', 'accepted')),
  keywords      TEXT[],
  cv_path       TEXT,
  cover_path    TEXT,
  cv_version    INT DEFAULT 1,
  contact_name  TEXT,
  contact_email TEXT,
  match_score   INT,
  sent_at       TIMESTAMPTZ,
  followup_at   TIMESTAMPTZ,
  notes         TEXT,
  embedding     vector(1536),
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Full-text search index
ALTER TABLE applications ADD COLUMN fts tsvector
  GENERATED ALWAYS AS (
    to_tsvector('french', coalesce(company,'') || ' ' || coalesce(job_title,'') || ' ' || coalesce(job_description,''))
  ) STORED;
CREATE INDEX idx_applications_fts ON applications USING gin(fts);
CREATE INDEX idx_applications_user ON applications(user_id);
CREATE INDEX idx_applications_status ON applications(user_id, status);
CREATE INDEX idx_applications_created ON applications(user_id, created_at DESC);
CREATE INDEX idx_applications_embedding ON applications USING ivfflat(embedding vector_cosine_ops) WITH (lists = 50);
```

### Table `application_versions`

```sql
CREATE TABLE application_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  version         INT NOT NULL,
  cv_path         TEXT,
  cover_path      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_versions_app ON application_versions(application_id, version DESC);
```

### Table `batch_imports`

```sql
CREATE TABLE batch_imports (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type TEXT CHECK (source_type IN ('url_list', 'file')),
  total_jobs  INT DEFAULT 0,
  processed   INT DEFAULT 0,
  failed      INT DEFAULT 0,
  status      TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### Table `email_log`

```sql
CREATE TABLE email_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  recipient       TEXT NOT NULL,
  subject         TEXT NOT NULL,
  body            TEXT,
  method          TEXT CHECK (method IN ('gmail_api', 'gws_cli')),
  status          TEXT DEFAULT 'sent' CHECK (status IN ('sent', 'failed', 'bounced')),
  sent_at         TIMESTAMPTZ DEFAULT now()
);
```

### Table `user_settings`

```sql
CREATE TABLE user_settings (
  user_id           UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  default_language  TEXT DEFAULT 'fr',
  email_subject_tpl TEXT DEFAULT 'Candidature - {job_title} - Georges Eric Djoufack',
  email_body_tpl    TEXT,
  followup_days     INT DEFAULT 7,
  theme             TEXT DEFAULT 'dark',
  embeddings_api_key TEXT,
  gmail_oauth_token  JSONB,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);
```

### RLS (toutes les tables)

```sql
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE application_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE batch_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_applications" ON applications FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_versions" ON application_versions FOR ALL USING (
  application_id IN (SELECT id FROM applications WHERE user_id = auth.uid())
);
CREATE POLICY "users_own_batches" ON batch_imports FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_emails" ON email_log FOR ALL USING (
  application_id IN (SELECT id FROM applications WHERE user_id = auth.uid())
);
CREATE POLICY "users_own_settings" ON user_settings FOR ALL USING (auth.uid() = user_id);
```

### Storage

- Bucket : `documents`
- Structure : `{user_id}/{application_id}/v{version}/cv.docx`, `cover.docx`

## 5. Edge Functions

### `scrape-job`

- **Input** : `{ url?, text?, file? }`
- **Output** : `{ company, job_title, sector, language, keywords[], contact_name, contact_email, job_description, confidence }`
- Fetch HTML → parse DOM → extraction heuristique → détection langue → extraction mots-clés

### `generate-cv`

- **Input** : `{ application_id }`
- **Output** : `{ cv_url, cover_url, match_score }`
- Lit application + profil Eric → stratégie d'adaptation par secteur → génère 2 .docx via lib `docx` → upload Storage → update DB

### `send-gmail` (V2)

- **Input** : `{ application_id, recipient, subject, body }`
- **Output** : `{ message_id, status }`
- OAuth2 Gmail → compose MIME avec pièces jointes → envoie → log

### `embed-job` (V2)

- **Input** : `{ application_id }`
- **Output** : `{ embedding }`
- Appel API embeddings → UPDATE applications SET embedding

## 6. Pages UI

| Page                 | Route               | Description                                         |
| -------------------- | ------------------- | --------------------------------------------------- |
| Dashboard            | `/`                 | KPIs, graphiques, candidatures récentes             |
| Nouvelle candidature | `/new`              | Formulaire URL/texte/fichier + preview + génération |
| Mes candidatures     | `/applications`     | Table filtrable, triable, recherche full-text       |
| Détail candidature   | `/applications/:id` | Preview docs, timeline, actions, versioning         |
| Import batch         | `/batch`            | Upload liste URLs, progression, génération en masse |
| Envois               | `/emails`           | Historique emails envoyés                           |
| Paramètres           | `/settings`         | Gmail, templates, préférences                       |

## 7. Features V1

1. Génération CV + lettre depuis URL / texte / fichier
2. Import batch (liste d'URLs)
3. CRUD candidatures avec filtres, tri, recherche full-text
4. Preview / téléchargement / suppression des documents
5. Export commande gws CLI pour envoi Gmail
6. Score de matching (% correspondance profil ↔ poste)
7. Duplication rapide de candidature
8. Export CSV
9. Suivi des relances (rappels à J+7, J+14 configurables)
10. Versioning des CV (historique des générations)
11. Dashboard avec KPIs et graphiques
12. Dark mode par défaut

## 8. Features V2

- Recherche sémantique pgvector
- Envoi direct Gmail API (OAuth2)
- Templates email personnalisables (multiples)
- Parsers LinkedIn/Indeed spécialisés
- AI enhancement des lettres via LLM
- Analytics avancés (taux réponse par secteur, timeline)

## 9. Design system

- **Thème** : Dark mode par défaut (navy/slate + accent bleu)
- **Composants** : shadcn/ui (Button, Card, Table, Dialog, Tabs, Input, Badge, Select, Dropdown)
- **Charts** : Recharts
- **Icônes** : Lucide React
- **Typographie** : Inter (system font stack)
