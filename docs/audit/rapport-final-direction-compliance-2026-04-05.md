# Rapport Final Direction/Compliance - Release CashPilot

- Date: 2026-04-05
- Heure (Europe/Brussels): 2026-04-05 00:49:36 +02:00
- Environnement: Production
- Projet: CashPilot

## 1) Decision Memo

- Statut de release: DEPLOYE EN PRODUCTION
- Branche de reference: `main`
- Integrite locale/distant: SYNCHRONISEE (`HEAD == origin/main`)
- Disponibilite prod: `https://cashpilot.tech` repond HTTP `200`

## 2) Hashes de Release

- Git commit hash (release): `3b8937c725a020a1db443749a09e86b468f729b6`
- Vercel deployment id (production): `dpl_b41sJSLAwZkeZk7U7q1Fpz7CMLMP`
- Vercel production URL: `https://cashpilot-fit5rkeky-djoufack-gmailcoms-projects.vercel.app`
- Alias production: `https://cashpilot.tech`

## 3) Preuves de Commandes (CLI)

### 3.1 Git state

Commande:

```powershell
git rev-parse --abbrev-ref HEAD
git rev-parse HEAD
git show -s --format="%H%n%an%n%ae%n%ad%n%s" --date=iso-strict HEAD
```

Sortie (extrait):

```text
main
3b8937c725a020a1db443749a09e86b468f729b6
3b8937c725a020a1db443749a09e86b468f729b6
djoufack
74061052+djoufack@users.noreply.github.com
2026-04-05T00:38:25+02:00
docs(audit): add 2026-04-05 functional map and navigation entitlement matrix
```

### 3.2 Tests de non-regression navigation

Commande:

```powershell
npm run test -- src/test/regression/navigationRouteContracts.test.js
```

Sortie (extrait):

```text
Test Files  1 passed (1)
Tests       3 passed (3)
```

### 3.3 Lint du test ajoute

Commande:

```powershell
npx eslint src/test/regression/navigationRouteContracts.test.js --max-warnings=0
```

Sortie:

```text
(exit code 0)
```

### 3.4 Verrou de synchro local/distant

Commande:

```powershell
git fetch origin --prune
git rev-parse HEAD
git rev-parse origin/main
git status --short
```

Sortie (extrait):

```text
3b8937c725a020a1db443749a09e86b468f729b6
3b8937c725a020a1db443749a09e86b468f729b6
```

(`git status --short` vide)

### 3.5 Inspection deploiement Vercel

Commande:

```powershell
npx vercel inspect cashpilot.tech
```

Sortie (extrait):

```text
id      dpl_b41sJSLAwZkeZk7U7q1Fpz7CMLMP
name    cashpilot
target  production
status  Ready
url     https://cashpilot-fit5rkeky-djoufack-gmailcoms-projects.vercel.app
aliases https://cashpilot.tech
```

### 3.6 Verification disponibilite production

Commande:

```powershell
$r = Invoke-WebRequest -Uri https://cashpilot.tech -Method Head; "StatusCode=$($r.StatusCode)"
```

Sortie:

```text
StatusCode=200
```

## 4) Artefacts inclus dans cette release

- `docs/functional-map-cashpilot-2026-04-05.md`
- `docs/inventory/navigation-entitlement-matrix-2026-04-05.csv`
- `src/test/regression/navigationRouteContracts.test.js`

## 5) Signature

Je certifie que ce rapport est base sur des executions CLI verifiees dans le workspace de production de CashPilot, avec traces de hash Git et deployment Vercel.

- Signe par: Codex (GPT-5)
- Role: Engineering Release & Compliance Agent
- Date de signature: 2026-04-05
