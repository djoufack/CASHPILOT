# CashPilot - Historique de resolution des problemes

---

## Probleme #1 — Login casse apres deploiement de l'audit de securite

**Date :** 04/02/2026
**Severite :** CRITIQUE
**Symptome :** Page de login affiche une erreur, impossible de se connecter.

### Contexte

Lors de l'audit de securite du projet, la **Task 1** a externalise les credentials Supabase qui etaient hardcodees dans `src/lib/customSupabaseClient.js`. Le code est passe de :

```js
// AVANT (credentials en dur — risque de securite)
const supabaseUrl = 'https://rfzvrezrcigzmldgvntz.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIs...';
```

a :

```js
// APRES (variables d'environnement)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
```

Le commit a ete pousse sur `main` et deploye automatiquement sur Vercel. Mais les variables d'environnement n'existaient pas encore dans Vercel.

### Erreur console

```
Auth init failed: Supabase not configured. VITE_SUPABASE_URL
```

Le client Supabase retournait `null` car `import.meta.env.VITE_SUPABASE_URL` etait `undefined` en production.

### Diagnostic

1. Le code dans `customSupabaseClient.js` verifie si `supabaseUrl` et `supabaseAnonKey` existent avant de creer le client :
   ```js
   const customSupabaseClient = supabaseUrl && supabaseAnonKey
     ? createClient(supabaseUrl, supabaseAnonKey)
     : null;
   ```
2. Sans ces variables, le client est `null`, ce qui fait echouer toute l'authentification.
3. Verification via `vercel env ls` : aucune variable `VITE_*` n'etait configuree dans le projet Vercel.

### Solution appliquee

#### Etape 1 — Lier le projet au CLI Vercel

```bash
vercel link --yes
```

Cela a connecte le repo local au projet Vercel `djoufack-gmailcoms-projects/cashpilot`.

> **Attention :** `vercel link` ecrase le fichier `.env.local` avec les variables de l'environnement "development" de Vercel. Si le fichier contenait deja des variables locales, il faut le restaurer apres.

#### Etape 2 — Restaurer `.env.local` (dev local)

Le fichier `.env.local` a ete recree avec les 3 variables necessaires :

```env
# Supabase
VITE_SUPABASE_URL=https://rfzvrezrcigzmldgvntz.supabase.co
VITE_SUPABASE_ANON_KEY=<clef-anon-jwt>

# Push Notifications
VITE_VAPID_PUBLIC_KEY=<clef-vapid-publique>
```

Ce fichier est dans `.gitignore` et ne sera jamais commite.

#### Etape 3 — Ajouter les variables dans Vercel (3 environnements)

Pour chaque variable, ajout dans les 3 environnements (production, preview, development) :

```bash
echo "<valeur>" | vercel env add VITE_SUPABASE_URL production
echo "<valeur>" | vercel env add VITE_SUPABASE_URL preview
echo "<valeur>" | vercel env add VITE_SUPABASE_URL development

echo "<valeur>" | vercel env add VITE_SUPABASE_ANON_KEY production
echo "<valeur>" | vercel env add VITE_SUPABASE_ANON_KEY preview
echo "<valeur>" | vercel env add VITE_SUPABASE_ANON_KEY development

echo "<valeur>" | vercel env add VITE_VAPID_PUBLIC_KEY production
echo "<valeur>" | vercel env add VITE_VAPID_PUBLIC_KEY preview
echo "<valeur>" | vercel env add VITE_VAPID_PUBLIC_KEY development
```

Verification :

```bash
vercel env ls
```

Resultat : 9 entries (3 variables x 3 environnements).

#### Etape 4 — Redeployer en production

```bash
vercel --prod
```

Le build a reussi (0 erreurs, 13.26s) et le site a ete deploye sur `https://cashpilot.tech`.

### Verification

- Le login fonctionne a nouveau sur https://cashpilot.tech
- L'erreur "Supabase not configured" a disparu de la console

### Lecon retenue

> **Regle :** Quand on externalise des credentials hardcodees vers des variables d'environnement, il faut **configurer ces variables dans tous les environnements de deploiement AVANT de deployer le changement de code.** L'ordre correct est :
> 1. Ajouter les env vars dans Vercel (ou autre hebergeur)
> 2. Commiter et pousser le code qui utilise `import.meta.env.*`
> 3. Verifier que le deploiement fonctionne

---
