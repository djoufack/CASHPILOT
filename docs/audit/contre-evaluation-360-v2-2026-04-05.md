# Contre-Evaluation 360 v2 - CashPilot (Etat `main` verifie)

- Date: 2026-04-05
- Heure (Europe/Brussels): 2026-04-05 01:07:56 +02:00
- Branche analysee: `main`
- Commit analyse: `31b156313da35202ecd691284a047efd4a2a0596`

## 1) Verdict executif

- Note globale revisee: **8.3 / 10**
- Decision globale: **GO CONDITIONNEL**

CashPilot est **production-ready** pour TPE/PME, mais reste conditionnel pour Enterprise (charge, SLO/SLA, observabilite formalisee).

## 2) Reconciliation avec l'audit externe (7.9/10)

| Point de l'audit externe       | Statut v2 verifie  | Preuve                                        |
| ------------------------------ | ------------------ | --------------------------------------------- | -------- |
| Status page manquante          | Faux               | route `/status` + `StatusPage` presentes      |
| 449 outils MCP                 | A mettre a jour    | README MCP annonce 461 outils                 |
| 72 edge functions              | A mettre a jour    | `supabase/functions` = 76 dossiers            |
| 122 fichiers de test           | A mettre a jour    | 173 fichiers `\*.test                         | \*.spec` |
| Smoke tests non bloquants      | Partiellement vrai | smoke en CI mais conditionnes par secrets/env |
| `xlsx` vulnerable              | Corrige            | dependency `npm:@e965/xlsx@^0.20.3`           |
| `react-signature-canvas` alpha | Vrai               | `^1.1.0-alpha.2`                              |

## 3) Scoring revise

| Axe                      |         Note | Justification                                                     |
| ------------------------ | -----------: | ----------------------------------------------------------------- |
| Architecture & Stack     |          8.5 | Stack moderne, separation claire, MCP fort; attention lib alpha   |
| Couverture fonctionnelle |          9.0 | Perimetre tres large, multi-reglementaire, IA native              |
| Securite                 |          8.5 | RLS + guards + CI + headers; maintien des revues scope necessaire |
| Tests & fiabilite        |          8.0 | Couverture tests elevee en volume; smoke CI depend de secrets     |
| Infra & maturite ops     |          7.5 | Deploy solide, mais charge/SLA enterprise encore a formaliser     |
| **Global**               | **8.3 / 10** | **GO conditionnel**                                               |

## 4) Decision par segment

- TPE/PME FR/BE: **GO**
- PME Afrique (OHADA/Maroc): **GO**
- Grandes entreprises (>100 users): **GO CONDITIONNEL**

Conditions prealables pour GO inconditionnel enterprise:

1. Bench charge documente (API + DB + front) avec objectifs p95/p99.
2. Budget performance front contractualise (TTI/LCP/INP) et suivi release.
3. Cadre SLA/SLO et incident communication formalise (runbook + status governance).

## 5) Preuves CLI (annexe)

### 5.1 Branche et hash

```powershell
git rev-parse --abbrev-ref HEAD
git rev-parse HEAD
git rev-parse origin/main
```

Sortie:

```text
main
31b156313da35202ecd691284a047efd4a2a0596
31b156313da35202ecd691284a047efd4a2a0596
```

### 5.2 Status page

```powershell
rg -n 'path="/status"|StatusPage' src/routes.jsx src/pages/StatusPage.jsx
```

Sortie (extrait):

```text
src/routes.jsx:186:      <Route path="/status" element={page(StatusPage)} />
src/pages/StatusPage.jsx:183:export default function StatusPage() {
```

### 5.3 Volumetrie code/tests

```powershell
Get-ChildItem supabase/functions -Directory | Measure-Object | Select-Object -ExpandProperty Count
Get-ChildItem src/hooks -File -Filter use*.js | Measure-Object | Select-Object -ExpandProperty Count
Get-ChildItem src/pages -File -Filter *.jsx | Measure-Object | Select-Object -ExpandProperty Count
Get-ChildItem src -Recurse -File -Include *.test.js,*.test.jsx,*.spec.js,*.spec.jsx | Measure-Object | Select-Object -ExpandProperty Count
```

Sortie:

```text
76
169
92
173
```

### 5.4 MCP tools

```powershell
rg -n "Total :|outils|hand-written|CRUD" mcp-server/README.md
```

Sortie (extrait):

```text
- **86 outils hand-written**
- **375 outils CRUD générés**
- **Total : 461 outils**
```

### 5.5 CI gates

```powershell
rg -n "verify:local|verify:smoke-ui|remote-smoke-ui|Run guards|npm test|test:coverage" .github/workflows/guards.yml .github/workflows/vercel-prebuilt-prod.yml
```

Sortie (extrait):

```text
.github/workflows/guards.yml:41:      - name: Run guards
.github/workflows/guards.yml:48:        run: npm test
.github/workflows/guards.yml:127:  remote-smoke-ui:
.github/workflows/guards.yml:152:        run: npm run verify:smoke-ui
.github/workflows/vercel-prebuilt-prod.yml:35:        run: npm run verify:local
.github/workflows/vercel-prebuilt-prod.yml:38:        run: npm run test:coverage
```

### 5.6 Dependances sensibles

```powershell
rg -n "react-signature-canvas|xlsx" package.json
```

Sortie:

```text
"react-signature-canvas": "^1.1.0-alpha.2"
"xlsx": "npm:@e965/xlsx@^0.20.3"
```

### 5.7 Production live

```powershell
npx vercel inspect cashpilot.tech
Invoke-WebRequest -Uri https://cashpilot.tech -Method Head
```

Sortie (extrait):

```text
id      dpl_4XEgef39Nm2m4G1HGZPXkcdHENDe
status  Ready
alias   https://cashpilot.tech
StatusCode=200
```

## 6) Signature

Je certifie que cette contre-evaluation v2 est basee sur des commandes CLI executees sur le workspace `main` courant.

- Signe par: Codex (GPT-5)
- Role: Engineering Audit & Compliance
- Date: 2026-04-05
