# BUGS — FIX-03 : i18n dates hardcodées toLocaleDateString('fr-FR')

**Branche** : `fix/03-dates-i18n`
**Date** : 2026-03-29
**Statut** : ✅ Résolu et mergé sur `main`

---

## Problème initial

Toutes les fonctions de formatage de dates et de nombres utilisaient la locale
`'fr-FR'` codée en dur. Pour un utilisateur en anglais (`en`) ou néerlandais
(`nl`), les dates s'affichaient quand même au format français.

```js
// Avant — locale figée
new Date(x).toLocaleDateString('fr-FR')
new Intl.NumberFormat('fr-FR', { ... }).format(v)
```

---

## Solution

Création de `src/utils/dateLocale.js` qui lit `i18n.resolvedLanguage` à
l'appel pour renvoyer la locale active.

```js
// Après — locale dynamique
import { formatDate, getLocale } from '@/utils/dateLocale';
formatDate(x)
new Intl.NumberFormat(getLocale(), { ... }).format(v)
```

**Mapping BCP-47** : `fr → fr-FR`, `en → en-GB`, `nl → nl-BE`

---

## Étendue des changements

- **113 fichiers** modifiés (~300 occurrences remplacées)
- `src/services/export*.js` — exports PDF/HTML
- `src/components/**` — composants React
- `src/pages/**` — pages
- `src/hooks/useInterCompany.js`, `useFixedAssets.js`
- `src/lib/obligations.js` — paramètre `locale = getLocale()`
- `src/utils/calculations.js`, `currencyService.js`, `excelExport.js`

---

## Cas intentionnellement préservés

| Fichier                           | Raison                                                                         |
| --------------------------------- | ------------------------------------------------------------------------------ |
| `VoiceExpenseInput.jsx` ligne 113 | `recognition.lang = 'fr-FR'` — Web Speech API, langue de reconnaissance vocale |
| `BankAggregationView.jsx`         | Utilise déjà `i18n.resolvedLanguage \|\| i18n.language \|\| 'fr-FR'`           |
| `PurchaseOrdersPage.jsx` ligne 57 | Ternaire `i18n.language?.startsWith('fr')` déjà dynamique                      |
| `ReportGenerator.jsx`             | `localeMap` et `intlLocale` déjà dynamiques via `i18n.language`                |

---

## Bugs secondaires corrigés (pre-existing warnings)

Durant le passage des staged files au hook ESLint `--max-warnings=0`, des
avertissements pre-existants ont été corrigés dans les fichiers touchés :

- `import React from 'react'` inutilisé → supprimé (React 18 JSX transform)
- Imports inutilisés (`useMemo`, `Badge`, `CheckCircle2`, `DialogTrigger`, etc.)
- Variables de déstructuration inutilisées → préfixées `_`
- `percentFormatter` dans `SectorBenchmark.jsx` désormais utilisé dans `formatValue`

---

## Commits

- `e4ace89` — fix(i18n): replace hardcoded fr-FR locale with dynamic i18n language
- `e105aec` — Merge fix/03-dates-i18n — i18n: replace hardcoded fr-FR locale
