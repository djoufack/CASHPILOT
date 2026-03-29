# FIX-08 — Corrections tests calculations.test.js

**Date** : 2026-03-29
**Branche** : fix/08-calculations-tests
**Tests corrigés** : 8/61 (tous dans le groupe `formatCurrency`)

---

## Problème

8 tests du groupe `formatCurrency` échouaient dans `src/test/utils/calculations.test.js`.

### Erreur type

```
AssertionError: expected '€100.00' to be '100,00 €'
Expected: "100,00 €"
Received: "€100.00"
```

### Tests affectés

1. `should format EUR correctly (fr-FR locale: comma decimal, symbol after)`
2. `should format USD correctly (fr-FR locale)`
3. `should format GBP correctly (fr-FR locale)`
4. `should default to EUR`
5. `should handle zero`
6. `should handle decimal amounts`
7. `should handle unknown currency code`
8. `should handle negative amounts`

---

## Cause racine

`formatCurrency` dans `src/utils/calculations.js` utilise `getLocale()` (de `@/utils/dateLocale`) qui lit `i18n.resolvedLanguage || i18n.language || 'fr'` depuis `@/i18n/config`.

En environnement de test (jsdom), `i18next` détecte la langue `'en'` (pas de localStorage, pas de navigator locale forcé à `fr`). Résultat : `Intl.NumberFormat('en')` produit le format anglais (`€100.00`) au lieu du format français attendu (`100,00 €`).

Les tests documentent correctement le comportement attendu (format `fr-FR`) pour cette application de comptabilité française. Le bug est dans l'absence de mock de locale dans le fichier de test.

---

## Correction appliquée

**Fichier modifié** : `src/test/utils/calculations.test.js`

Ajout d'un `vi.mock` pour `@/i18n/config` en tête du fichier de test, forçant `resolvedLanguage: 'fr'` :

```js
vi.mock('@/i18n/config', () => ({
  default: {
    resolvedLanguage: 'fr',
    language: 'fr',
    on: vi.fn(),
  },
}));
```

Ce mock intercepte l'import de `@/i18n/config` avant que `getLocale()` soit appelé, garantissant que `Intl.NumberFormat('fr')` est utilisé — ce qui produit le format `100,00 €` conforme aux attentes.

---

## Résultat

- **Avant** : 53/61 tests passants (8 échecs)
- **Après** : 61/61 tests passants (0 échec)
- **Build** : ✅ succès
- **Lint** : ✅ 0 erreur (229 warnings pre-existants inchangés)
