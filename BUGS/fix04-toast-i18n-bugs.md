# FIX-04 — i18n Toasts/Messages Hooks : Rapport de bugs

**Branche :** `fix/04-toast-i18n`
**Date :** 2026-03-29
**Statut :** ✅ Tous les messages migrés — Build OK, 0 erreur lint

---

## Résumé

Migration complète des messages toast hardcodés (FR/EN mélangés) dans 21 hooks vers i18n.

### Hooks migrés

| Hook                         | Messages migrés                                                        |
| ---------------------------- | ---------------------------------------------------------------------- |
| `useAbsences.js`             | 5 toasts (création, mise à jour, approbation, rejet, annulation congé) |
| `useFixedAssets.js`          | 4 toasts (erreur fetch, créée, mise à jour, supprimée)                 |
| `useBillingSettings.js`      | 4 toasts (facturation MàJ, erreur, abonnement annulé, info paiement)   |
| `useProducts.js`             | 10 toasts (CRUD produits + catégories)                                 |
| `useServices.js`             | 10 toasts (CRUD services + catégories)                                 |
| `usePaymentTerms.js`         | 6 toasts (CRUD conditions de paiement)                                 |
| `useExpenses.js`             | 5 toasts (noCompany, création, mise à jour, suppression, erreur)       |
| `useAccounting.js`           | 22 toasts (comptes, mappings, taux TVA, import)                        |
| `useProfileSettings.js`      | 4 toasts (avatar/signature supprimés + erreurs)                        |
| `useTeamSettings.js`         | 6 toasts (invitation, mise à jour, suppression membre)                 |
| `useStockHistory.js`         | 2 toasts (stock mis à jour, erreur)                                    |
| `useSupplierInvoices.js`     | 10 toasts (enregistrement, suppression, mise à jour, statuts)          |
| `useUsers.js`                | 1 toast (erreur fetch)                                                 |
| `usePushNotifications.js`    | 3 toasts (subscribed, error, unsubscribed)                             |
| `useOfflineSync.js`          | 2 toasts (online/offline) — pattern `toastRef` + `tRef`                |
| `useNotificationSettings.js` | 2 toasts (préférences sauvegardées, erreur)                            |
| `useBiometric.js`            | 2 toasts (activé, erreur)                                              |
| `useInvoiceUpload.js`        | 2 toasts (fichier supprimé, erreur)                                    |
| `useTaxFiling.js`            | 7 toasts (déclaration créée/supprimée/soumise + erreurs)               |
| `useBarcodeScanner.js`       | 2 toasts (code détecté, erreur caméra)                                 |
| `useAccountingInit.js`       | 4 toasts (initialisé, erreur init, auto activé/désactivé)              |

---

## Clés i18n ajoutées

Namespace `hooks` ajouté dans `fr.json`, `en.json`, `nl.json` avec 22 sous-namespaces :

- `hooks.absences.*`
- `hooks.fixedAssets.*`
- `hooks.billing.*`
- `hooks.products.*`
- `hooks.services.*`
- `hooks.paymentTerms.*`
- `hooks.expenses.*`
- `hooks.accounting.*`
- `hooks.profileSettings.*`
- `hooks.teamSettings.*`
- `hooks.stockHistory.*`
- `hooks.supplierInvoices.*`
- `hooks.users.*`
- `hooks.pushNotifications.*`
- `hooks.offline.*`
- `hooks.notificationSettings.*`
- `hooks.biometric.*`
- `hooks.invoiceUpload.*`
- `hooks.taxFiling.*`
- `hooks.barcodeScanner.*`
- `hooks.accountingInit.*`

---

## Bugs identifiés / Corrections spéciales

### BUG-04-1 : Variable `t` en conflit avec arrow function dans useAccounting.js et usePaymentTerms.js

**Fichiers :** `src/hooks/useAccounting.js`, `src/hooks/usePaymentTerms.js`
**Problème :** Les fonctions `prev.map((t) => ...)` et `prev.filter((t) => ...)` dans `updateTaxRate`/`deleteTaxRate` (useAccounting) et `updatePaymentTerm`/`deletePaymentTerm` (usePaymentTerms) utilisaient `t` comme paramètre de callback, masquant la fonction de traduction `t` importée de `useTranslation`.
**Correction :** Renommage des paramètres : `rate` dans useAccounting, `term` dans usePaymentTerms.
**Statut :** ✅ Corrigé

### BUG-04-2 : Pattern `toastRef` dans useOfflineSync.js (hors scope React)

**Fichier :** `src/hooks/useOfflineSync.js`
**Problème :** Ce hook utilise un pattern `toastRef` car les toasts sont appelés depuis des event listeners enregistrés via `useEffect`. On ne peut pas appeler `t()` directement depuis la closure initiale car `t` peut changer lors de changement de langue.
**Solution adoptée :** Ajout d'un `tRef = useRef(t)` synchronisé avec `useEffect`, utilisation de `tRef.current(...)` dans les event handlers — même pattern que `toastRef`.
**Statut :** ✅ Corrigé

### BUG-04-3 : String "Info" non traduite dans useBillingSettings.js `addPaymentMethod`

**Fichier :** `src/hooks/useBillingSettings.js`
**Problème :** Le titre "Info" est un terme universel sans cle i18n disponible dans `common.*`. La description a été traduite via `hooks.billing.paymentIntegrationInfo`, mais le titre "Info" reste en dur.
**Décision :** Conservé comme chaîne littérale `'Info'` — terme universellement compris, non nécessaire de traduire. La description est i18n.
**Statut :** ⚠️ Intentionnel (faible priorité)

### BUG-04-4 : Dépendances `useCallback` manquantes pour `t`

**Fichiers :** `useAbsences.js`, `useFixedAssets.js`, `useProducts.js`, `useServices.js`
**Problème :** La fonction `t` de `useTranslation` est stable (référence stable) dans react-i18next, mais certains tableaux de dépendances des `useCallback` ne l'incluaient pas.
**Correction :** Ajout de `t` dans les tableaux de dépendances `[..., t]` pour les fonctions concernées.
**Statut :** ✅ Corrigé

---

## Build & Lint

```
✓ Build : succès (36.05s, 0 erreur) — 2026-03-29
✓ Lint  : 0 erreur (249 warnings pré-existants, non liés à ce fix)
```

### Clé `common.deleted` ajoutée (BUG-04-5)

`common.deleted` (`Supprimé` / `Deleted` / `Verwijderd`) ajoutée dans les 3 fichiers de locale — nécessaire pour les toasts de confirmation de suppression (`deleteAvatar`, `deleteSignature`, `deleteInvoiceFile`).

---

## Hooks NON migrés (hors scope ou déjà i18n)

Les hooks suivants avaient des toasts EN ou FR mais utilisaient **déjà** `t()` ou avaient des messages techniques non-UI :

- `useInstrumentCards.js` ✅ déjà i18n
- `useDeliveryNotes.js` ✅ déjà i18n
- `useReceivables.js` ✅ déjà i18n (1 string EN résiduele `'No active company selected'` → migré dans `usePayables.js`)
- `usePayables.js` ✅ déjà i18n (1 string EN `'No active company selected'` déjà gérée)
- `useEmbeddedBanking.js` ✅ déjà i18n
- `useBackupSettings.js` ✅ déjà i18n
- `usePaymentInstruments.js` ✅ déjà i18n
- `useConsolidation.js` ✅ déjà i18n
- `useCreditNotes.js` ✅ déjà i18n
