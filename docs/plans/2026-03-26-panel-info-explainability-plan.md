# Plan Implementation - Panel Info Explainability

Date: 2026-03-26
Owner: CashPilot frontend team
Related skill: $panel-info-explainability

## 1. Objectif
Ajouter un petit bouton d'information avant l'intitule de chaque panneau (KPI, bloc, graphe, section) afin d'expliquer:
- ce que le panneau affiche,
- la source des donnees,
- la formule (si calcul),
- la methode de calcul (regles d'aggregation et filtres).

## 2. Perimetre initial (phase 1)
- `src/pages/Dashboard.jsx`
- `src/components/pilotage/PilotageOverviewTab.jsx` + composants enfants de la vue
- `src/pages/PortfolioPage.jsx`
- `src/pages/ConsolidationDashboardPage.jsx` + `src/components/consolidation/*`

## 3. Standard technique unique
### 3.1 Composant partage
Utiliser un composant info popover unique et reutilisable pour tous les modules cibles.

### 3.2 Positionnement UI
Le trigger info est place immediatement avant le texte du titre du panneau.

### 3.3 Contrat de contenu
Chaque panneau doit avoir une specification metadata:
- `title`
- `definition`
- `dataSource`
- `formula` (optionnel)
- `calculationMethod`
- `filters` (optionnel)
- `notes` (optionnel)

### 3.4 Regles de contenu
- Si une metrique est calculee, la formule doit etre explicite.
- La methode de calcul doit decrire les regles (sum, moyenne, exclusions, periode).
- Aucune donnee metier hardcodee en UI (ENF-1).

## 4. Strategie d'implementation
1. Inventorier tous les panneaux de la page cible.
2. Creer le registre des explications (metadata) pour la page.
3. Connecter le composant info a chaque titre.
4. Verifier clavier, aria-label, responsive desktop/mobile.
5. Verifier absence de regression visuelle.

## 5. Protocole essaim d'agents
Regle obligatoire: 1 agent = 1 tache.

Exemples valides:
- Agent A: ajouter les info-buttons dans `Dashboard.jsx`
- Agent B: ajouter les info-buttons dans `PortfolioPage.jsx`
- Agent C: ajouter les info-buttons dans `ConsolidationKpiCards.jsx`

Exemple interdit:
- Un agent unique qui modifie plusieurs modules a la fois.

## 6. Criteres d'acceptation
- Chaque panneau cible affiche un bouton info avant son intitule.
- Le popover fournit definition + source + formule (si applicable) + methode de calcul.
- Le contenu est coherent avec les hooks/donnees reellement utilises.
- Le comportement est accessible (focus clavier, aria-label lisible).
- Le rendu reste correct en mobile et desktop.

## 7. Extension aux prochains modules
Pour chaque nouveau module:
1. Recenser les panneaux visibles.
2. Repliquer le meme contrat metadata.
3. Injecter le composant info standard.
4. Passer la checklist d'acceptation.

## 8. Commande de reutilisation
Nom du skill a appeler: `$panel-info-explainability`

Prompt recommande:
`Use $panel-info-explainability to implement info buttons before panel titles with definitions, data source, formulas, and calculation method.`
