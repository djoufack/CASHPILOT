# Pilotage Demo Playbook

Ce guide provisionne et utilise des comptes de démonstration dédiés pour `/app/pilotage`.

## Ce que le seed crée

- `pilotage.fr.demo@cashpilot.cloud`
- `pilotage.be.demo@cashpilot.cloud`
- `pilotage.ohada.demo@cashpilot.cloud`

Pour chaque compte :

- une société de démonstration cohérente avec la zone
- un mini plan comptable pilotage-compatible
- des clients, factures, paiements, dépenses
- des écritures équilibrées sur l'année en cours
- des ratios, alertes, cash flow et valorisation exploitables dans les 6 onglets

## Pré-requis

Variables à fournir dans le shell :

```powershell
$env:SUPABASE_URL="https://<project-ref>.supabase.co"
$env:SUPABASE_SERVICE_ROLE_KEY="<service-role>"
```

Optionnel : fixer les mots de passe de démo au lieu de les laisser être générés.

```powershell
$env:PILOTAGE_DEMO_PASSWORD_FR="..."
$env:PILOTAGE_DEMO_PASSWORD_BE="..."
$env:PILOTAGE_DEMO_PASSWORD_OHADA="..."
```

## Commandes

Prévisualisation locale :

```powershell
npm run seed:pilotage-demos
```

Provisionnement live :

```powershell
npm run seed:pilotage-demos:apply
```

Provisionnement partiel :

```powershell
node scripts/seed-pilotage-demos.mjs --apply --countries=FR,BE
```

Rotation forcée des mots de passe :

```powershell
node scripts/seed-pilotage-demos.mjs --apply --reset-passwords
```

## Comment jouer une démo

1. Connectez-vous avec le compte de la zone à démontrer.
2. Ouvrez [PilotagePage.jsx](C:/Github-Desktop/CASHPILOT/src/pages/PilotagePage.jsx) via `/app/pilotage`.
3. Laissez la période par défaut sur l'année en cours.
4. Alignez le sélecteur `Région` avec le compte :
   - `France` pour le compte FR
   - `Belgique` pour le compte BE
   - `OHADA` pour le compte OHADA
5. Gardez le secteur `B2B services` pour rester cohérent avec les benchmarks seeded.

## Parcours conseillé par compte

### France

- `Vue d'ensemble` : raconter la trajectoire de croissance, le cash flow et les alertes BFR.
- `Analyse comptable` : insister sur les créances clients et la couverture des emplois stables.
- `Fiscalité & valorisation` : montrer la fiscalité FR et la DCF avec CAPEX non nul.

### Belgique

- `Analyse financière` : montrer une structure saine mais avec encaissements partiels.
- `Fiscalité & valorisation` : illustrer les hypothèses TVA 21 % et multiples.
- `Audit IA` : faire ressortir la lecture automatique d'un jeu de données belge.

### OHADA

- `Vue d'ensemble` : mettre en avant les montants XAF et le rythme de croissance.
- `Analyse comptable` : raconter le BFR et les délais d'encaissement/paiement.
- `Fiscalité & valorisation` : illustrer le moteur multi-zone avec taux OHADA.

## Remise à zéro

Le script est idempotent pour ses comptes dédiés :

- il conserve les utilisateurs auth
- il nettoie les données métiers du compte de démo
- il réinjecte le dataset complet

Vous pouvez donc relancer le seed avant chaque session de démonstration.

## Note d'exploitation

- Ces comptes sont destinés aux démos, pas à la production métier.
- Si vous utilisez des mots de passe connus à plusieurs personnes, traitez l'environnement comme un environnement de démo partagé.
