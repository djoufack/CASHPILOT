# Roadmap Implementation - Evaluation du 27 Mars 2027

Source: `Audit/Evaluation du 27 Mars 2027.md`
Date de lancement: `2026-03-27`
Statut global: `IN_PROGRESS`

## Regles d'execution obligatoires

1. Une suggestion = une tache = un agent.
2. Ne pas passer a la suggestion suivante tant que les tests de la suggestion courante ne sont pas 100% OK.
3. Chaque suggestion doit etre validee avec les 3 comptes demo:
   - `pilotage.fr.demo@cashpilot.cloud` / `PilotageFR#2026!`
   - `pilotage.be.demo@cashpilot.cloud` / `PilotageBE#2026!`
   - `pilotage.ohada.demo@cashpilot.cloud` / `PilotageOHADA#2026!`
4. Toute mise a jour doit etre consignée dans la section `Journal d'avancement`.

## Protocole de test bloqueur (a executer pour chaque suggestion)

1. Lancer tests unitaires cibles (Vitest) de la zone modifiee.
2. Verifier build local:
   - `npm run build`
3. Verifier lint zone modifiee:
   - `npm run lint`
4. Verifier scenario fonctionnel avec les 3 comptes demo:
   - connexion
   - acces au module concerne
   - execution du nouveau comportement
   - absence de regression visible

Format de validation a remplir:

```
Suggestion: <ID>
Unit tests: PASS/FAIL
Build: PASS/FAIL
Lint: PASS/FAIL
Demo FR: PASS/FAIL
Demo BE: PASS/FAIL
Demo OHADA: PASS/FAIL
Decision: GO/NOGO
```

## Backlog atomique par module (1 suggestion = 1 tache)

### 1) Dashboard

- [x] `DASH-01` Ajouter des drill-down KPI vers des vues filtrees.
- [x] `DASH-02` Ajouter des alertes proactives (derive marge/cash).
- [x] `DASH-03` Ajouter des vues par role (DG, RAF, comptable).

### 2) Pilotage

- [x] `PIL-01` Ajouter des plans d'action "1 clic" depuis les alertes.
- [ ] `PIL-02` Ajouter le partage securise de snapshots.
- [ ] `PIL-03` Ajouter l'abonnement aux alertes KPI par seuil.

### 3) CFO Agent IA

- [ ] `CFO-01` Afficher les preuves source (tables/chiffres utilises).
- [ ] `CFO-02` Ajouter l'execution guidee d'actions (relance, scenario, audit).
- [ ] `CFO-03` Ajouter un briefing CFO hebdo automatique.

### 4) Mon Entreprise (Portfolio/Peppol/PDP/Interco/Consolidation/Veille)

- [ ] `CO-01` Creer un cockpit unifie "Conformite & Groupe".
- [ ] `CO-02` Automatiser davantage les ecritures d'elimination interco.
- [ ] `CO-03` Integrer des stress-tests de portefeuille.

### 5) GED HUB

- [ ] `GED-01` Ajouter versioning + anti-doublons.
- [ ] `GED-02` Ajouter politiques de conservation auto par type de document.
- [ ] `GED-03` Ajouter workflow validation/signature.

### 6) Ventes

- [ ] `SAL-01` Ajouter signature electronique devis/contrats.
- [ ] `SAL-02` Ajouter paiement direct depuis facture (payment link).
- [ ] `SAL-03` Ajouter intelligence de conversion (motifs de perte, next best action).

### 7) Achats & Depenses

- [ ] `BUY-01` Ajouter workflow d'approbation multi-niveaux.
- [ ] `BUY-02` Ajouter 3-way match (commande/reception/facture).
- [ ] `BUY-03` Ajouter score fournisseur (qualite/delai/cout).

### 8) Tresorerie & Comptabilite

- [ ] `FIN-01` Finaliser transferts bancaires embarques.
- [ ] `FIN-02` Ajouter immobilisations/amortissements + cloture assistee.
- [ ] `FIN-03` Renforcer multi-entites consolidees.

### 9) Catalogue

- [ ] `CAT-01` Ajouter FIFO/CMUP + COGS.
- [ ] `CAT-02` Ajouter multi-entrepots + lot/serie.
- [ ] `CAT-03` Ajouter recommandations de reapprovisionnement.

### 10) Projets & CRM

- [ ] `PRJ-01` Ajouter Gantt + dependances.
- [ ] `PRJ-02` Ajouter rentabilite projet native (budget vs reel).
- [ ] `PRJ-03` Renforcer prevision pipeline commerciale.

### 11) RH

- [ ] `HR-01` Ajouter calibration talent/succession.
- [ ] `HR-02` Ajouter workflows managers plus pousses.
- [ ] `HR-03` Ajouter connecteurs paie/conformite par pays.

### 12) Parametres / Integrations / API-MCP / Open API / Mobile Money / Portail comptable / Securite

- [ ] `INT-01` Ajouter packs d'integration prets a l'emploi (Zapier/Make).
- [ ] `INT-02` Ajouter politiques de cles API fines (scope/rotation/anomalies).
- [ ] `INT-03` Ajouter espace collaboratif expert-comptable (revue + taches).

### 13) Admin

- [ ] `ADM-01` Ajouter feature flags.
- [ ] `ADM-02` Ajouter tableau de sante operationnelle (Edge Functions/webhooks).
- [ ] `ADM-03` Ajouter tracabilite admin renforcee.

## Ordre d'execution impose

1. `DASH-01` -> `DASH-02` -> `DASH-03`
2. `PIL-01` -> `PIL-02` -> `PIL-03`
3. `CFO-01` -> `CFO-02` -> `CFO-03`
4. `CO-01` -> `CO-02` -> `CO-03`
5. `GED-01` -> `GED-02` -> `GED-03`
6. `SAL-01` -> `SAL-02` -> `SAL-03`
7. `BUY-01` -> `BUY-02` -> `BUY-03`
8. `FIN-01` -> `FIN-02` -> `FIN-03`
9. `CAT-01` -> `CAT-02` -> `CAT-03`
10. `PRJ-01` -> `PRJ-02` -> `PRJ-03`
11. `HR-01` -> `HR-02` -> `HR-03`
12. `INT-01` -> `INT-02` -> `INT-03`
13. `ADM-01` -> `ADM-02` -> `ADM-03`

## Journal d'avancement

### 2026-03-27

- Roadmap creee et publiee.
- `DASH-01` implemente (liens KPI vers vues filtrees invoices/expenses/timesheets).
- Validation `DASH-01`:
  - Unit tests Dashboard: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
- `DASH-02` implemente (panneau alertes proactives marge/cash + CTA actions).
- Validation `DASH-02`:
  - Unit tests Dashboard: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
- `DASH-03` implemente (vues role DG/RAF/Comptable + persistance locale + adaptation KPI/sections/actions).
- Validation `DASH-03`:
  - Unit tests Dashboard: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
- `PIL-01` implemente (CTA "1 clic" sur alertes Pilotage + navigation ciblee + synchronisation onglet via `?tab=`).
- Validation `PIL-01`:
  - Unit tests Pilotage: PASS
  - Build: PASS
  - Lint ciblee fichiers modifies: PASS
  - Demo FR/BE/OHADA: PASS
- Prochaine tache: `PIL-02`.
