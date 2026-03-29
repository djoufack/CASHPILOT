# CashPilot — Plan de correction essaim

**Date :** 2026-03-29  
**Source :** Audit GenPilot (7.9/10) + Audit Codex 5.3 (NO GO)  
**Objectif :** Passer de NO GO → GO entreprise

---

## P0 — CRITIQUES (bloquants GO/NO GO)

### FIX-P0-01 — MCP endpoint production cassé

**Problème :** `/api/` est dans `.vercelignore` → `api/mcp.js` n'est jamais déployé → `POST /mcp` retourne 405
**Fichiers :** `.vercelignore`, `vercel.json`, `api/mcp.js`
**Action :** Retirer `/api/` du `.vercelignore` OU reécrire le rewrite `/mcp` vers la Supabase Edge Function directement
**Critère de succès :** `POST https://cashpilot.tech/mcp` retourne JSON-RPC valide (pas 405)

### FIX-P0-02 — Vulnérabilité critique jsPDF

**Problème :** `jspdf ^4.2.0` → CVE critique (PDF Object Injection + HTML Injection). Fix disponible via `npm audit fix`
**Fichiers :** `package.json`, `package-lock.json`
**Action :** `npm audit fix` pour jsPDF + vérifier que les usages ne sont pas impactés
**Critère de succès :** `npm audit --omit=dev` ne remonte plus de critical

### FIX-P0-03 — Vulnérabilité high xlsx + remplacement

**Problème :** `xlsx ^0.18.5` → Prototype Pollution + ReDoS. Pas de fix npm direct
**Fichiers :** `package.json`, tous les fichiers qui importent `xlsx`
**Action :** Remplacer `xlsx` par `ExcelJS` dans toutes les pages/hooks concernés
**Critère de succès :** `npm audit --omit=dev` ne remonte plus de high sur xlsx

---

## P1 — MAJEURS (à corriger pour readiness enterprise)

### FIX-P1-04 — Gouvernance release : security job non bloquant

**Problème :** `continue-on-error: true` sur le job sécurité dans `guards.yml` → les failles sécurité ne bloquent pas le pipeline
**Fichiers :** `.github/workflows/guards.yml`, `.github/workflows/vercel-prebuilt-prod.yml`
**Action :** Retirer `continue-on-error: true` du job sécurité + ajouter `needs: guards` sur le deploy workflow
**Critère de succès :** Une faille sécurité bloque le pipeline CI

### FIX-P1-05 — Coverage vitest manquante

**Problème :** `@vitest/coverage-v8` absent → `npm run test:coverage` échoue
**Fichiers :** `package.json`, `vitest.config.js`
**Action :** `npm install --save-dev @vitest/coverage-v8` + configurer seuils minimum (branches: 60%, functions: 70%)
**Critère de succès :** `npm run test:coverage` génère un rapport sans erreur

---

## P2 — MOYENS (qualité et performance)

### FIX-P2-06 — Performance bundle : lazy-load Three.js + GSAP

**Problème :** Three.js + GSAP chargés pour tous les utilisateurs alors qu'utilisés uniquement sur LandingPage → ~800kB inutile pour les utilisateurs connectés. Chargement initial 3.5s
**Fichiers :** `src/pages/LandingPage.jsx`, `vite.config.js`
**Action :** `React.lazy()` + `Suspense` sur LandingPage + dynamic import pour Three.js/GSAP
**Critère de succès :** Bundle JS initial réduit de >500kB, TTI < 2.5s

### FIX-P2-07 — console.error non strippé en prod

**Problème :** `vite.config.js` strip uniquement `console.log/warn/debug/info` mais pas `console.error` → ~142 appels console dans le dist
**Fichiers :** `vite.config.js`
**Action :** Ajouter `console.error` à la liste `esbuild.pure` en production (ou utiliser Sentry pour capturer les erreurs)
**Critère de succès :** 0 `console.*` dans le bundle de production

### FIX-P2-08 — README manquant

**Problème :** Pas de README.md à la racine — barrière pour les développeurs et intégrateurs
**Fichiers :** `README.md` (à créer)
**Action :** Créer un README complet (présentation, stack, setup local, architecture, scripts, liens)
**Critère de succès :** README présent, clair, complet

---

## Tableau de bord des tâches agents

| Fix                          | Priorité    | Agent   | Statut |
| ---------------------------- | ----------- | ------- | ------ |
| FIX-P0-01 MCP prod cassé     | 🔴 CRITIQUE | agent-1 | ⏳     |
| FIX-P0-02 jsPDF CVE          | 🔴 CRITIQUE | agent-2 | ⏳     |
| FIX-P0-03 xlsx → ExcelJS     | 🔴 CRITIQUE | agent-3 | ⏳     |
| FIX-P1-04 CI gouvernance     | 🟡 MAJEUR   | agent-4 | ⏳     |
| FIX-P1-05 Coverage vitest    | 🟡 MAJEUR   | agent-5 | ⏳     |
| FIX-P2-06 Bundle performance | 🟠 MOYEN    | agent-6 | ⏳     |
| FIX-P2-07 console.error prod | 🟠 MOYEN    | agent-7 | ⏳     |
| FIX-P2-08 README             | 🟠 MOYEN    | agent-8 | ⏳     |
