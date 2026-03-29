# FIX-04 — i18n Toasts/Messages Hooks : Rapport de bugs

**Branche :** `fix/04-toast-i18n`
**Date :** 2026-03-29
**Statut :** ✅ Tous les messages migrés — Build OK, 0 erreur lint

## Résumé

Migration complète des messages toast hardcodés (FR/EN mélangés) dans 21 hooks vers i18n.

## Bugs identifiés / Corrections spéciales

### BUG-04-1 : Variable `t` en conflit avec arrow function dans useAccounting.js et usePaymentTerms.js

`prev.map((t) => ...)` masquait la fonction de traduction. Renommé en `rate`/`term`.

### BUG-04-2 : Pattern `toastRef` + `tRef` dans useOfflineSync.js

Toasts appelés depuis event listeners hors scope React. Solution : `tRef = useRef(t)`.

### BUG-04-3 : String "Info" non traduite dans useBillingSettings.js

Terme universel, conservé comme littéral. Description traduite via `hooks.billing.paymentIntegrationInfo`.

### BUG-04-5 : Clé `common.deleted` manquante

Ajoutée : `Supprimé` / `Deleted` / `Verwijderd` dans les 3 fichiers locale.

## Build & Lint

```
✓ Build : succès (36.05s, 0 erreur) — 2026-03-29
✓ Lint  : 0 erreur (249 warnings pré-existants, non liés à ce fix)
```
