# Swarm Agent Registry - Evaluation 27 Mars 2027

Reference roadmap: `Audit/Roadmap-Evaluation-27-03-2027-implementation.md`
Start date: `2026-03-27`

## Regle d'or

- 1 agent = 1 tache unique.
- Quand la tache est terminee et validee, l'agent passe en `DONE` puis un nouvel agent est assigne a la tache suivante.

## Agents actifs

| Agent                         | Task ID              | Mission unique                                  | Etat   |
| ----------------------------- | -------------------- | ----------------------------------------------- | ------ |
| `dash_01_worker`              | `DASH-01`            | Drill-down KPI Dashboard vers vues filtrees     | `DONE` |
| `dashboard_demo_test_harness` | `INFRA-DASH-TEST-01` | Script smoke Playwright dashboard multi-comptes | `DONE` |
| `dash_02_worker`              | `DASH-02`            | Alertes proactives marge/cash + CTA             | `DONE` |
| `dash_03_worker`              | `DASH-03`            | Vues par role DG/RAF/Comptable sur Dashboard    | `DONE` |
| `pil_01_worker`               | `PIL-01`             | Plans d'action 1 clic depuis alertes Pilotage   | `DONE` |

## Pool de missions a lancer (ordre strict roadmap)

### Dashboard

- `DASH-01`
- `DASH-02`
- `DASH-03`

### Pilotage

- `PIL-01`
- `PIL-02`
- `PIL-03`

### CFO

- `CFO-01`
- `CFO-02`
- `CFO-03`

### Mon Entreprise

- `CO-01`
- `CO-02`
- `CO-03`

### GED HUB

- `GED-01`
- `GED-02`
- `GED-03`

### Ventes

- `SAL-01`
- `SAL-02`
- `SAL-03`

### Achats & Depenses

- `BUY-01`
- `BUY-02`
- `BUY-03`

### Tresorerie & Comptabilite

- `FIN-01`
- `FIN-02`
- `FIN-03`

### Catalogue

- `CAT-01`
- `CAT-02`
- `CAT-03`

### Projets & CRM

- `PRJ-01`
- `PRJ-02`
- `PRJ-03`

### RH

- `HR-01`
- `HR-02`
- `HR-03`

### Integrations / API / Securite

- `INT-01`
- `INT-02`
- `INT-03`

### Admin

- `ADM-01`
- `ADM-02`
- `ADM-03`

## Log orchestration

### 2026-03-27

- Swarm initialise.
- 2 agents actifs lances.
- `DASH-01` termine et valide.
- `DASH-02` termine et valide.
- `DASH-03` termine et valide.
- Harness test dashboard multi-comptes disponible: `npm run smoke:dashboard-role-kpi`.
- Harness smoke ajuste pour `DASH-03` (drill-down commun + lien specifique de role).
- Reprise post-compaction: relire ce registre + la roadmap et redemarrer a la premiere tache non completee.
- `PIL-01` termine et valide (CTA d'actions sur alertes + navigation `?tab=`).
- Harness smoke pilotage alert actions disponible: `npm run smoke:pilotage-alert-action`.
- Prochaine mission a lancer: `PIL-02`.
