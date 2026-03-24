# CVPilot Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a standalone React + Vite + Supabase application that automates CV and cover letter generation for Georges Eric Djoufack, with full CRUD, search, batch import, email export, and dashboard.

**Architecture:** React SPA with Vite, Tailwind CSS, and shadcn/ui for the frontend. Supabase handles auth, PostgreSQL database, file storage, and Edge Functions for .docx generation and URL scraping. Deployed on Vercel.

**Tech Stack:** React 18, Vite, Tailwind CSS, shadcn/ui, Recharts, Supabase (Auth, DB, Storage, Edge Functions), `docx` library (Deno-compatible), Vercel.

**Design doc:** `docs/plans/2026-03-18-cvpilot-design.md`

**CV Skill reference:** `~/.claude/skills/cv-eric-djoufack/` (SKILL.md, references/eric-profile.md, references/docx-template.md, scripts/generate_docs.js)

---

## Sprint 1: Project Scaffold & Database (Tasks 1-3)

### Task 1: Scaffold Vite + React + Tailwind project

**Files:**

- Create: `cv-pilot/package.json`
- Create: `cv-pilot/vite.config.js`
- Create: `cv-pilot/tailwind.config.js`
- Create: `cv-pilot/postcss.config.js`
- Create: `cv-pilot/index.html`
- Create: `cv-pilot/src/main.jsx`
- Create: `cv-pilot/src/App.jsx`
- Create: `cv-pilot/src/index.css`
- Create: `cv-pilot/.env.example`
- Create: `cv-pilot/.gitignore`

**Step 1: Create project directory**

```bash
mkdir -p ~/Github-Desktop/cv-pilot && cd ~/Github-Desktop/cv-pilot
```

**Step 2: Initialize project with Vite**

```bash
npm create vite@latest . -- --template react
```

Select: React, JavaScript

**Step 3: Install core dependencies**

```bash
npm install react-router-dom @supabase/supabase-js @tanstack/react-query recharts lucide-react clsx tailwind-merge date-fns
npm install -D tailwindcss @tailwindcss/vite
```

**Step 4: Configure Tailwind**

Replace `src/index.css` with:

```css
@import 'tailwindcss';

@theme {
  --color-background: #0a0e1a;
  --color-foreground: #e2e8f0;
  --color-card: #0f1528;
  --color-card-foreground: #e2e8f0;
  --color-primary: #3b82f6;
  --color-primary-foreground: #ffffff;
  --color-secondary: #1e293b;
  --color-secondary-foreground: #e2e8f0;
  --color-muted: #1e293b;
  --color-muted-foreground: #94a3b8;
  --color-accent: #1e293b;
  --color-accent-foreground: #e2e8f0;
  --color-destructive: #ef4444;
  --color-border: #1e293b;
  --color-input: #1e293b;
  --color-ring: #3b82f6;
  --radius: 0.5rem;
}
```

**Step 5: Configure Vite with path alias**

Update `vite.config.js`:

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

**Step 6: Create .env.example**

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

**Step 7: Create minimal App.jsx with router**

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-background text-foreground">
        <h1 className="text-2xl p-8">CVPilot</h1>
      </div>
    </BrowserRouter>
  );
}

export default App;
```

**Step 8: Verify dev server starts**

```bash
npm run dev
```

Expected: Vite dev server at http://localhost:5173, shows "CVPilot" on dark background.

**Step 9: Init git and commit**

```bash
git init && git add -A && git commit -m "chore: scaffold CVPilot with Vite + React + Tailwind"
```

---

### Task 2: Initialize Supabase & create database schema

**Files:**

- Create: `cv-pilot/supabase/config.toml`
- Create: `cv-pilot/supabase/migrations/00001_initial_schema.sql`
- Create: `cv-pilot/src/lib/supabase.js`

**Step 1: Init Supabase project**

```bash
cd ~/Github-Desktop/cv-pilot
npx supabase init
```

**Step 2: Create a new Supabase project via dashboard**

Go to https://supabase.com/dashboard → New Project → name: `cvpilot`
Copy the URL and anon key to `.env.local`:

```
VITE_SUPABASE_URL=https://xxxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOi...
```

**Step 3: Write the migration file**

Create `supabase/migrations/00001_initial_schema.sql`:

```sql
-- Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Applications table
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

ALTER TABLE applications ADD COLUMN fts tsvector
  GENERATED ALWAYS AS (
    to_tsvector('french', coalesce(company,'') || ' ' || coalesce(job_title,'') || ' ' || coalesce(job_description,''))
  ) STORED;

CREATE INDEX idx_applications_fts ON applications USING gin(fts);
CREATE INDEX idx_applications_user ON applications(user_id);
CREATE INDEX idx_applications_status ON applications(user_id, status);
CREATE INDEX idx_applications_created ON applications(user_id, created_at DESC);

-- Application versions
CREATE TABLE application_versions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  version         INT NOT NULL,
  cv_path         TEXT,
  cover_path      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_versions_app ON application_versions(application_id, version DESC);

-- Batch imports
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

-- Email log
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

-- User settings
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

-- RLS
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

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', false);

CREATE POLICY "users_own_documents" ON storage.objects FOR ALL USING (
  bucket_id = 'documents' AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_applications_updated_at BEFORE UPDATE ON applications
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_user_settings_updated_at BEFORE UPDATE ON user_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

**Step 4: Push migration to remote**

```bash
npx supabase link --project-ref <your-project-ref>
npx supabase db push
```

Expected: Migration applied successfully.

**Step 5: Create Supabase client**

Create `src/lib/supabase.js`:

```javascript
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);
```

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add Supabase schema with applications, versions, batch, email_log, settings"
```

---

### Task 3: Install shadcn/ui components

**Files:**

- Create: `cv-pilot/src/lib/utils.js`
- Create: `cv-pilot/src/components/ui/*.jsx` (multiple)
- Create: `cv-pilot/components.json`

**Step 1: Install shadcn/ui CLI and init**

```bash
npx shadcn@latest init
```

Select: Default style, CSS variables, `src/` alias.

**Step 2: Add required components**

```bash
npx shadcn@latest add button card input label select tabs table dialog badge dropdown-menu textarea toast popover command scroll-area separator switch tooltip alert
```

**Step 3: Verify utils.js exists at `src/lib/utils.js`**

Should contain:

```javascript
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
```

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add shadcn/ui components library"
```

---

## Sprint 2: Auth & Layout (Tasks 4-5)

### Task 4: Auth flow (login/signup)

**Files:**

- Create: `cv-pilot/src/context/AuthContext.jsx`
- Create: `cv-pilot/src/pages/LoginPage.jsx`
- Create: `cv-pilot/src/components/ProtectedRoute.jsx`
- Modify: `cv-pilot/src/App.jsx`

**Step 1: Create AuthContext**

Create `src/context/AuthContext.jsx`:

```jsx
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext({});

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = (email, password) => supabase.auth.signInWithPassword({ email, password });
  const signUp = (email, password) => supabase.auth.signUp({ email, password });
  const signOut = () => supabase.auth.signOut();

  return <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
```

**Step 2: Create LoginPage**

Create `src/pages/LoginPage.jsx`:

```jsx
import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';

export default function LoginPage() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error } = isSignUp ? await signUp(email, password) : await signIn(email, password);
    if (error) setError(error.message);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">CVPilot</CardTitle>
          <CardDescription>{isSignUp ? 'Créer un compte' : 'Se connecter'}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-destructive text-sm">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '...' : isSignUp ? 'Créer le compte' : 'Se connecter'}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => setIsSignUp(!isSignUp)}>
              {isSignUp ? 'Déjà un compte ? Se connecter' : 'Pas de compte ? Créer'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Step 3: Create ProtectedRoute**

Create `src/components/ProtectedRoute.jsx`:

```jsx
import { useAuth } from '@/context/AuthContext';
import LoginPage from '@/pages/LoginPage';

export default function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading)
    return (
      <div className="min-h-screen bg-background flex items-center justify-center text-foreground">Chargement...</div>
    );
  if (!user) return <LoginPage />;
  return children;
}
```

**Step 4: Wire auth into App.jsx**

Update `src/App.jsx` to wrap routes with AuthProvider + ProtectedRoute.

**Step 5: Verify login flow works**

Create a test user in Supabase Dashboard → Auth → Users → Invite.
Expected: Login page shown, successful login redirects to app.

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add Supabase auth with login/signup flow"
```

---

### Task 5: App layout with sidebar navigation

**Files:**

- Create: `cv-pilot/src/components/layout/Sidebar.jsx`
- Create: `cv-pilot/src/components/layout/AppLayout.jsx`
- Create: `cv-pilot/src/pages/DashboardPage.jsx` (placeholder)
- Create: `cv-pilot/src/pages/ApplicationsPage.jsx` (placeholder)
- Create: `cv-pilot/src/pages/NewApplicationPage.jsx` (placeholder)
- Create: `cv-pilot/src/pages/BatchImportPage.jsx` (placeholder)
- Create: `cv-pilot/src/pages/EmailsPage.jsx` (placeholder)
- Create: `cv-pilot/src/pages/SettingsPage.jsx` (placeholder)
- Modify: `cv-pilot/src/App.jsx`

**Step 1: Create Sidebar component**

Create `src/components/layout/Sidebar.jsx` with navigation links:

- Dashboard (`/`)
- Nouvelle candidature (`/new`)
- Mes candidatures (`/applications`)
- Import batch (`/batch`)
- Envois (`/emails`)
- Paramètres (`/settings`)

Use Lucide icons: `LayoutDashboard`, `FilePlus`, `FileStack`, `Upload`, `Mail`, `Settings`, `LogOut`.

Dark navy sidebar (`bg-card`), active link highlighted with `bg-primary/10 text-primary`.

**Step 2: Create AppLayout wrapper**

Create `src/components/layout/AppLayout.jsx`:

```jsx
import Sidebar from './Sidebar';

export default function AppLayout({ children }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 p-6 overflow-auto">{children}</main>
    </div>
  );
}
```

**Step 3: Create placeholder pages**

Each page is a simple component with the page title:

```jsx
export default function DashboardPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold">Dashboard</h1>
    </div>
  );
}
```

Create all 6 pages as placeholders.

**Step 4: Wire routes in App.jsx**

```jsx
<AuthProvider>
  <BrowserRouter>
    <ProtectedRoute>
      <AppLayout>
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/new" element={<NewApplicationPage />} />
          <Route path="/applications" element={<ApplicationsPage />} />
          <Route path="/applications/:id" element={<ApplicationDetailPage />} />
          <Route path="/batch" element={<BatchImportPage />} />
          <Route path="/emails" element={<EmailsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
      </AppLayout>
    </ProtectedRoute>
  </BrowserRouter>
</AuthProvider>
```

**Step 5: Verify navigation works**

Expected: Sidebar shows on all pages, clicking links navigates, active link highlighted.

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add app layout with sidebar navigation and placeholder pages"
```

---

## Sprint 3: Edge Functions (Tasks 6-7)

### Task 6: Edge Function `scrape-job`

**Files:**

- Create: `cv-pilot/supabase/functions/scrape-job/index.ts`

**Step 1: Create the Edge Function**

Create `supabase/functions/scrape-job/index.ts`:

```typescript
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Language detection by word frequency
function detectLanguage(text: string): string {
  const frWords = [
    'le',
    'la',
    'les',
    'de',
    'des',
    'du',
    'un',
    'une',
    'et',
    'en',
    'est',
    'pour',
    'dans',
    'avec',
    'nous',
    'vous',
    'qui',
    'que',
    'sur',
    'son',
  ];
  const enWords = [
    'the',
    'and',
    'is',
    'in',
    'to',
    'of',
    'for',
    'with',
    'on',
    'at',
    'by',
    'an',
    'are',
    'we',
    'you',
    'our',
    'your',
    'this',
    'that',
    'from',
  ];
  const lower = text.toLowerCase();
  const frCount = frWords.filter((w) => lower.includes(` ${w} `)).length;
  const enCount = enWords.filter((w) => lower.includes(` ${w} `)).length;
  return frCount > enCount ? 'fr' : 'en';
}

// Sector detection from keywords
function detectSector(text: string): string {
  const lower = text.toLowerCase();
  const sectors: Record<string, string[]> = {
    healthcare: ['santé', 'health', 'médical', 'medical', 'pharma', 'hospital', 'clinical', 'patient'],
    fintech: ['finance', 'banking', 'banque', 'fintech', 'payment', 'paiement', 'comptab', 'account'],
    energy: ['energy', 'énergie', 'oil', 'gas', 'pétrole', 'mining'],
    ai: [
      'machine learning',
      'deep learning',
      'artificial intelligence',
      'intelligence artificielle',
      'nlp',
      'llm',
      'neural',
    ],
    public: ['commission', 'gouvernement', 'government', 'public', 'administration', 'european'],
  };
  for (const [sector, words] of Object.entries(sectors)) {
    if (words.some((w) => lower.includes(w))) return sector;
  }
  return 'general';
}

// Extract top keywords (stopword-filtered)
function extractKeywords(text: string, lang: string): string[] {
  const stopwordsFr = new Set([
    'le',
    'la',
    'les',
    'de',
    'des',
    'du',
    'un',
    'une',
    'et',
    'en',
    'est',
    'pour',
    'dans',
    'avec',
    'nous',
    'vous',
    'qui',
    'que',
    'sur',
    'son',
    'ce',
    'il',
    'se',
    'ne',
    'ou',
    'par',
    'plus',
    'pas',
    'au',
    'aux',
    'ces',
    'mais',
    'si',
    'sa',
    'ses',
    'ont',
    'été',
    'être',
    'avoir',
    'fait',
    'tout',
    'aussi',
    'bien',
    'peut',
    'même',
    'entre',
    'autre',
    'comme',
    'très',
    'après',
    'avant',
    'sans',
    'chez',
    'sous',
  ]);
  const stopwordsEn = new Set([
    'the',
    'and',
    'is',
    'in',
    'to',
    'of',
    'for',
    'with',
    'on',
    'at',
    'by',
    'an',
    'are',
    'we',
    'you',
    'our',
    'your',
    'this',
    'that',
    'from',
    'it',
    'be',
    'as',
    'or',
    'was',
    'has',
    'had',
    'have',
    'will',
    'would',
    'can',
    'could',
    'not',
    'but',
    'all',
    'also',
    'been',
    'which',
    'their',
    'they',
    'do',
    'if',
    'so',
    'no',
    'more',
    'its',
    'into',
    'than',
    'any',
    'may',
    'each',
    'some',
    'such',
    'only',
    'other',
    'over',
    'very',
    'when',
    'up',
    'out',
    'about',
    'then',
  ]);
  const stops = lang === 'fr' ? stopwordsFr : stopwordsEn;
  const words = text
    .toLowerCase()
    .replace(/[^a-zàâäéèêëïîôùûüç\s-]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stops.has(w));
  const freq: Record<string, number> = {};
  words.forEach((w) => {
    freq[w] = (freq[w] || 0) + 1;
  });
  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w]) => w);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { url, text, file } = await req.json();
    let jobText = '';

    if (text) {
      jobText = text;
    } else if (url) {
      const resp = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; CVPilot/1.0)' } });
      const html = await resp.text();
      // Strip HTML tags, decode entities
      jobText = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/\s+/g, ' ')
        .trim();
    }

    if (!jobText) {
      return new Response(JSON.stringify({ error: 'No job description provided' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const language = detectLanguage(jobText);
    const sector = detectSector(jobText);
    const keywords = extractKeywords(jobText, language);

    // Heuristic extraction of company name (first capitalized multi-word or after patterns)
    const companyPatterns = [
      /(?:chez|at|@|pour|for|company:|entreprise:|société:)\s*([A-Z][A-Za-zÀ-ÿ\s&.-]+)/,
      /^([A-Z][A-Za-zÀ-ÿ&.-]+(?:\s[A-Z][A-Za-zÀ-ÿ&.-]+)*)\s+(?:recrute|is hiring|recherche|cherche|seeks)/m,
    ];
    let company = '';
    for (const pat of companyPatterns) {
      const m = jobText.match(pat);
      if (m) {
        company = m[1].trim();
        break;
      }
    }

    // Job title extraction
    const titlePatterns = [
      /(?:poste|position|titre|title|role|profil)[:\s]+([^\n.]+)/i,
      /(?:recrute|hiring|recherche)\s+(?:un|une|a|an)?\s*([^\n.]+)/i,
    ];
    let jobTitle = '';
    for (const pat of titlePatterns) {
      const m = jobText.match(pat);
      if (m) {
        jobTitle = m[1].trim().slice(0, 100);
        break;
      }
    }

    // Contact extraction
    const emailMatch = jobText.match(/[\w.-]+@[\w.-]+\.\w+/);
    const contactEmail = emailMatch ? emailMatch[0] : '';

    const confidence =
      (company ? 25 : 0) + (jobTitle ? 25 : 0) + (keywords.length > 5 ? 25 : 10) + (jobText.length > 200 ? 25 : 10);

    return new Response(
      JSON.stringify({
        company: company || 'À compléter',
        job_title: jobTitle || 'À compléter',
        sector,
        language,
        keywords,
        contact_name: '',
        contact_email: contactEmail,
        job_description: jobText.slice(0, 10000),
        confidence,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
```

**Step 2: Deploy and test**

```bash
npx supabase functions deploy scrape-job --no-verify-jwt
curl -X POST https://<project>.supabase.co/functions/v1/scrape-job \
  -H "Content-Type: application/json" \
  -d '{"text": "CGI Finance recherche un Data Engineer senior pour notre équipe à Bruxelles. Compétences requises: Python, SQL, Airflow, AWS."}'
```

Expected: JSON with company="CGI Finance", job_title contains "Data Engineer", sector="fintech", language="fr".

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add scrape-job edge function with URL parsing and NLP extraction"
```

---

### Task 7: Edge Function `generate-cv`

**Files:**

- Create: `cv-pilot/supabase/functions/generate-cv/index.ts`
- Create: `cv-pilot/supabase/functions/generate-cv/eric-profile.json`
- Create: `cv-pilot/supabase/functions/generate-cv/docx-helpers.ts`

**Step 1: Convert eric-profile.md to JSON**

Read `~/.claude/skills/cv-eric-djoufack/references/eric-profile.md` and create a structured JSON at `supabase/functions/generate-cv/eric-profile.json` with:

- `contact`: name, phone, email, address, linkedin
- `education`: array of { institution, degree, period }
- `certifications`: array of strings
- `currentProjects`: array of { name, description, achievements[], tools[] }
- `previousExperience`: array of { company, title, period, location, highlights[] }
- `skills`: object by category (data_engineering, big_data, ai_ml, etc.)
- `achievements`: array of { metric, value, context }

**Step 2: Create docx-helpers.ts**

Port the helper functions from `~/.claude/skills/cv-eric-djoufack/references/docx-template.md` to Deno-compatible TypeScript. Key helpers:

- `tr()` — TextRun builder
- `sidebarTitle()`, `sidebarText()`, `sidebarSkill()`
- `sectionTitle()`, `bulletPoint()`
- `matchTable()` — job requirement vs Eric's proof
- `twoColumnLayout()` — sidebar + main

Use `import { Document, Packer, ... } from "https://esm.sh/docx@8.5.0"`

**Step 3: Create the main Edge Function**

Create `supabase/functions/generate-cv/index.ts`:

```typescript
// Pseudocode structure — full code adapted from scripts/generate_docs.js
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Document, Packer } from 'https://esm.sh/docx@8.5.0';
import profile from './eric-profile.json' with { type: 'json' };
import { buildCvDocument, buildCoverDocument, calculateMatchScore } from './docx-helpers.ts';

serve(async (req) => {
  // 1. Read application from DB
  // 2. Calculate match score (keywords overlap with profile skills)
  // 3. Build CV document (two-column layout, adapted by sector)
  // 4. Build cover letter document
  // 5. Pack both to Buffer via Packer.toBuffer()
  // 6. Upload to Supabase Storage: documents/{user_id}/{app_id}/v{version}/cv.docx
  // 7. Save version in application_versions
  // 8. Update application: cv_path, cover_path, cv_version++, match_score, status='generated'
  // 9. Return signed URLs
});
```

The full implementation follows the patterns from `scripts/generate_docs.js` with:

- Sector-based color theming
- Adaptation strategy table from SKILL.md
- Two-column layout (navy sidebar + white main)
- Match table, skills reordering, keyword echoing

**Step 4: Deploy and test**

```bash
npx supabase functions deploy generate-cv
```

Test by inserting a test application in the DB, then calling the function.

**Step 5: Commit**

```bash
git add -A && git commit -m "feat: add generate-cv edge function with docx generation and storage upload"
```

---

## Sprint 4: Core UI Pages (Tasks 8-11)

### Task 8: New Application page (the heart of the app)

**Files:**

- Create: `cv-pilot/src/pages/NewApplicationPage.jsx`
- Create: `cv-pilot/src/hooks/useApplications.js`

**Step 1: Create useApplications hook**

Create `src/hooks/useApplications.js` with functions:

- `scrapeJob({ url?, text?, file? })` — calls scrape-job Edge Function
- `createApplication(data)` — inserts into applications table
- `generateDocuments(applicationId)` — calls generate-cv Edge Function
- `useApplicationsList(filters)` — React Query hook for listing with filters
- `useApplication(id)` — React Query hook for single application

**Step 2: Build NewApplicationPage**

3 tabs: URL | Texte | Fichier

Each tab has:

- Input field (URL input, textarea, or file dropzone)
- "Analyser" button → calls `scrapeJob()` → shows loading → populates preview form

Preview form (editable):

- Company, Job Title, Sector (select), Language (select), Keywords (tag input), Contact email
- Full job description (textarea, readonly by default, expandable)
- Match score badge (calculated after analysis)

Actions:

- "Générer CV + Lettre" button → calls `createApplication()` then `generateDocuments()`
- "Sauvegarder brouillon" → creates application with status='draft'
- Loading state during generation with progress feedback

After generation:

- Show download buttons for CV and cover letter
- Show "Envoyer par email" button
- Show "Voir la candidature" link

**Step 3: Verify the full flow**

1. Paste a job description text
2. Click "Analyser" → fields populate
3. Click "Générer" → documents created in Supabase Storage
4. Download buttons work

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add new application page with scrape + generate flow"
```

---

### Task 9: Applications list page with filters and search

**Files:**

- Create: `cv-pilot/src/pages/ApplicationsPage.jsx`
- Create: `cv-pilot/src/components/ApplicationsTable.jsx`
- Create: `cv-pilot/src/components/SearchBar.jsx`
- Create: `cv-pilot/src/components/StatusBadge.jsx`

**Step 1: Create StatusBadge**

Map status to colors:

- draft → gray, generated → blue, sent → yellow, interview → purple, rejected → red, accepted → green

**Step 2: Create SearchBar**

Full-text search input that calls Supabase with `.textSearch('fts', query)`.
Debounce 300ms.

**Step 3: Create ApplicationsTable**

Table columns: Date | Entreprise | Poste | Secteur | Score | Statut | Actions

- Sortable by date, company, score
- Filter dropdowns: status, sector, language, date range
- Actions dropdown per row: Voir, Télécharger CV, Télécharger Lettre, Dupliquer, Changer statut, Supprimer

**Step 4: Build ApplicationsPage**

Combines SearchBar + filter bar + ApplicationsTable.
Uses `useApplicationsList()` hook with React Query pagination.
"Export CSV" button in header.

**Step 5: Verify**

- Search finds applications by keywords
- Filters narrow results
- Sort works
- Actions (download, delete, duplicate) work

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add applications list with full-text search, filters, sort, and actions"
```

---

### Task 10: Application detail page

**Files:**

- Create: `cv-pilot/src/pages/ApplicationDetailPage.jsx`
- Create: `cv-pilot/src/components/DocumentPreview.jsx`
- Create: `cv-pilot/src/components/ApplicationTimeline.jsx`
- Create: `cv-pilot/src/components/VersionHistory.jsx`
- Create: `cv-pilot/src/components/GwsExportDialog.jsx`

**Step 1: Create DocumentPreview**

Downloads .docx from Supabase Storage, uses `mammoth` library to render as HTML in an iframe/div.

```bash
npm install mammoth
```

Shows a preview pane with tabs: CV | Lettre de motivation.

**Step 2: Create ApplicationTimeline**

Vertical timeline showing: created → generated → sent → interview → result
With dates and status changes.

**Step 3: Create VersionHistory**

List of previous versions from `application_versions` table.
Each version has: date, download buttons, "restore" button.

**Step 4: Create GwsExportDialog**

Dialog that shows the pre-formatted `gws` CLI command:

```bash
gws gmail send --to "email" --subject "Candidature..." --body-file body.txt --attach cv.docx --attach cover.docx
```

With "Copy to clipboard" button.
Also generates downloadable `send.sh` script.

**Step 5: Build ApplicationDetailPage**

Layout:

- Left: Job info (company, title, description, keywords, score)
- Right: Document preview tabs
- Bottom: Timeline + Version history
- Action bar: Re-générer, Télécharger, Dupliquer, Envoyer (→ GwsExportDialog), Supprimer, Modifier statut

**Step 6: Commit**

```bash
git add -A && git commit -m "feat: add application detail with preview, timeline, versions, and gws export"
```

---

### Task 11: Batch import page

**Files:**

- Create: `cv-pilot/src/pages/BatchImportPage.jsx`
- Create: `cv-pilot/src/components/BatchProgressTable.jsx`
- Create: `cv-pilot/src/hooks/useBatchImport.js`

**Step 1: Create useBatchImport hook**

- `startBatch(urls: string[])` — creates batch_imports row, then processes each URL sequentially:
  1. Call scrape-job for URL
  2. Create application with job_source='batch'
  3. Call generate-cv
  4. Update batch_imports (processed++, or failed++)
- Uses React state to track progress in real-time

**Step 2: Build BatchImportPage**

- Textarea for pasting URLs (one per line)
- OR file upload (.txt, .csv) that extracts URLs
- "Importer et Générer" button
- Progress table: URL | Entreprise (extracted) | Statut (pending/processing/done/failed) | Actions
- Summary bar: X/Y processed, Z failed

**Step 3: Verify batch of 3 URLs**

Expected: All 3 processed, applications created, documents generated.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add batch import with sequential URL processing and progress tracking"
```

---

## Sprint 5: Dashboard, Email, Settings (Tasks 12-14)

### Task 12: Dashboard with KPIs and charts

**Files:**

- Create: `cv-pilot/src/pages/DashboardPage.jsx`
- Create: `cv-pilot/src/hooks/useDashboardStats.js`
- Create: `cv-pilot/src/components/KpiCard.jsx`

**Step 1: Create useDashboardStats hook**

Queries:

- Total applications count
- Count by status (for donut chart)
- Applications per week (for bar chart, last 8 weeks)
- Follow-up reminders due (followup_at <= now AND status = 'sent')
- Recent 5 applications

**Step 2: Build KpiCard component**

Reusable card with: icon, label, value, trend indicator.

**Step 3: Build DashboardPage**

Layout:

- Row 1: 4 KPI cards (Total, En attente, Entretiens, Taux de réponse)
- Row 2: Bar chart (candidatures/semaine) + Donut chart (répartition statut)
- Row 3: Follow-up reminders (applications to follow up, with "Relancer" button)
- Row 4: 5 dernières candidatures (mini table)

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add dashboard with KPIs, charts, and follow-up reminders"
```

---

### Task 13: Emails page and follow-up system

**Files:**

- Create: `cv-pilot/src/pages/EmailsPage.jsx`
- Create: `cv-pilot/src/hooks/useEmails.js`
- Create: `cv-pilot/src/hooks/useFollowups.js`

**Step 1: Create useEmails hook**

- `listEmails()` — query email_log joined with applications
- `logEmail(applicationId, recipient, subject, method)` — insert email_log

**Step 2: Create useFollowups hook**

- `getDueFollowups()` — applications WHERE status='sent' AND followup_at <= now()
- `snoozeFollowup(id, days)` — UPDATE followup_at = now() + interval days
- `markFollowedUp(id)` — UPDATE status to appropriate next step

**Step 3: Build EmailsPage**

- Table: Date | Entreprise | Poste | Destinataire | Méthode | Statut
- Filter by method (gws_cli / gmail_api)
- Follow-up section at top with due reminders and actions

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add emails history page and follow-up reminder system"
```

---

### Task 14: Settings page

**Files:**

- Create: `cv-pilot/src/pages/SettingsPage.jsx`
- Create: `cv-pilot/src/hooks/useSettings.js`

**Step 1: Create useSettings hook**

- `getSettings()` — query user_settings, create default row if not exists
- `updateSettings(data)` — upsert user_settings

**Step 2: Build SettingsPage**

Sections:

1. **Email** — Default subject template, body template (with {job_title}, {company} placeholders)
2. **Relances** — Follow-up delay in days (default 7)
3. **gws CLI** — Instructions for installing gws, test command
4. **Thème** — Dark/Light toggle
5. **Compte** — Email, sign out button
6. **V2 placeholders** — Gmail OAuth setup (disabled), Embeddings API key (disabled)

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add settings page with email templates, follow-up config, and theme"
```

---

## Sprint 6: Polish & Deploy (Tasks 15-17)

### Task 15: Export CSV and duplicate features

**Files:**

- Create: `cv-pilot/src/lib/exportCsv.js`
- Modify: `cv-pilot/src/pages/ApplicationsPage.jsx`
- Modify: `cv-pilot/src/hooks/useApplications.js`

**Step 1: Create CSV export utility**

```javascript
export function exportApplicationsCsv(applications) {
  const headers = ['Date', 'Entreprise', 'Poste', 'Secteur', 'Statut', 'Score', 'URL', 'Contact'];
  const rows = applications.map((a) => [
    new Date(a.created_at).toLocaleDateString('fr-BE'),
    a.company,
    a.job_title,
    a.sector,
    a.status,
    a.match_score || '',
    a.job_url || '',
    a.contact_email || '',
  ]);
  const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cvpilot-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
}
```

**Step 2: Add duplicate function to useApplications**

```javascript
async function duplicateApplication(id) {
  const { data: original } = await supabase.from('applications').select('*').eq('id', id).single();
  const {
    id: _,
    created_at,
    updated_at,
    cv_path,
    cover_path,
    cv_version,
    status,
    sent_at,
    followup_at,
    ...rest
  } = original;
  return supabase
    .from('applications')
    .insert({ ...rest, status: 'draft', cv_version: 1 })
    .select()
    .single();
}
```

**Step 3: Wire into ApplicationsPage**

Add "Export CSV" button in page header.
Add "Dupliquer" in row actions dropdown.

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add CSV export and application duplication"
```

---

### Task 16: Dark mode toggle and responsive design

**Files:**

- Modify: `cv-pilot/src/components/layout/Sidebar.jsx` (responsive)
- Modify: `cv-pilot/src/index.css` (light theme variables)
- Create: `cv-pilot/src/hooks/useTheme.js`

**Step 1: Create useTheme hook**

Reads from user_settings.theme, applies `dark` class on `<html>`.
Falls back to localStorage for pre-auth state.

**Step 2: Add light mode CSS variables**

Add a `.light` variant in `index.css` with light background/foreground colors.

**Step 3: Make sidebar responsive**

- Mobile: hamburger menu, sidebar slides in as overlay
- Tablet: collapsed sidebar (icons only)
- Desktop: full sidebar

**Step 4: Commit**

```bash
git add -A && git commit -m "feat: add dark/light theme toggle and responsive sidebar"
```

---

### Task 17: Deploy to Vercel

**Files:**

- Create: `cv-pilot/vercel.json`

**Step 1: Configure Vercel**

Create `vercel.json`:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "rewrites": [{ "source": "/(.*)", "destination": "/" }]
}
```

**Step 2: Deploy**

```bash
cd ~/Github-Desktop/cv-pilot
npx vercel link
npx vercel env add VITE_SUPABASE_URL
npx vercel env add VITE_SUPABASE_ANON_KEY
npx vercel deploy --prod
```

**Step 3: Verify production**

- Login works
- Create application from text → generates documents
- Download .docx files
- Search and filter works

**Step 4: Commit**

```bash
git add -A && git commit -m "chore: add Vercel deployment config"
```

---

## Summary

| Sprint | Tasks | Description                              |
| ------ | ----- | ---------------------------------------- |
| 1      | 1-3   | Scaffold, DB schema, shadcn/ui           |
| 2      | 4-5   | Auth flow, layout + routing              |
| 3      | 6-7   | Edge Functions (scrape-job, generate-cv) |
| 4      | 8-11  | Core pages (new, list, detail, batch)    |
| 5      | 12-14 | Dashboard, emails, settings              |
| 6      | 15-17 | CSV export, dark mode, Vercel deploy     |

**Total: 17 tasks across 6 sprints.**
