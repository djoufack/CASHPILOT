# Fix 09 — StockManagement and SharedSnapshotPage Test Failures

**Date:** 2026-03-29
**Branch:** fix/09-stock-snapshot-tests
**Agent:** FIX-09

---

## Summary

Fixed 4 failing tests across 2 test files after the i18n migration introduced in fix/01.

---

## Bug 1 — StockManagement: 3 tests searching for stale French hard-coded strings

**File:** `src/test/pages/StockManagement.test.jsx`
**Affected tests (3):**

- `renders FIFO/CMUP/COGS valuation panel`
- `renders multi-warehouse and lot/serial tab content`
- `renders smart replenishment recommendation panel`

### Root Cause

After the i18n migration (fix/01), `StockManagement.jsx` replaced all hard-coded French strings with `t()` calls:

| Component text before i18n                             | i18n key used after migration                |
| ------------------------------------------------------ | -------------------------------------------- |
| "Valorisation FIFO / CMUP et COGS"                     | `stockManagement.cockpit.valuationTitle`     |
| "Entrepôts & lots"                                     | `stockManagement.tabs.warehouses`            |
| "Recommandations de réapprovisionnement intelligentes" | `stockManagement.cockpit.replenishmentTitle` |

The global test setup (`src/test/setup.js`) mocks `react-i18next` with `t: (key) => key`, which means `t('some.key')` returns the key string literally. The tests still used the old French regex patterns to find these strings, which no longer appear in the DOM.

Note: the translation keys `stockManagement.cockpit.valuationTitle`, `stockManagement.cockpit.replenishmentTitle`, and `stockManagement.tabs.warehouses` are not yet present in the locale JSON files (`fr.json`, `en.json`), which is a separate issue. The test mock returns keys as-is, so using the key string as the expected value is the correct approach.

### Fix

Updated the 3 failing assertions to match the i18n key strings rendered by the mocked `t()` function:

```js
// Before (stale French text)
expect(screen.getByText(/Valorisation FIFO \/ CMUP et COGS/i)).toBeTruthy();
expect(screen.getByText(/Entrepôts & lots/i)).toBeTruthy();
expect(screen.getByText(/Recommandations de réapprovisionnement intelligentes/i)).toBeTruthy();

// After (i18n key strings)
expect(screen.getByText('stockManagement.cockpit.valuationTitle')).toBeTruthy();
expect(screen.getByText('stockManagement.tabs.warehouses')).toBeTruthy();
expect(screen.getByText('stockManagement.cockpit.replenishmentTitle')).toBeTruthy();
```

---

## Bug 2 — SharedSnapshotPage: async data load race condition in test

**File:** `src/test/pages/SharedSnapshotPage.test.jsx`
**Affected test (1):**

- `renders a pilotage snapshot view with the shared payload`

### Root Cause

The component fetches snapshot data asynchronously from Supabase in a `useEffect`. The test used a two-step assertion pattern:

1. `await waitFor(() => expect(screen.getByText('Pilotage partagé')).toBeInTheDocument())`
2. Then immediately (synchronously): `expect(screen.getByText('Test Company')).toBeInTheDocument()`

The `waitFor` resolves as soon as `'Pilotage partagé'` appears in the DOM. This text is rendered in the page header from `snapshot?.title`, which is set on the React state before the `loading` state is cleared. Due to React 18 batching, there can be an intermediate render where `snapshot.title` is set but the `SharedPilotageSnapshot` sub-component (which contains `data.companyName` = `'Test Company'`) is not yet rendered (because `loading` is still `true`).

The synchronous assertions after `waitFor` fire before the subsequent re-render clears the loading state, causing them to fail.

### Fix

Moved all assertions inside a single `waitFor` call to ensure they are retried until all async state updates have settled:

```js
// Before (race condition)
await waitFor(() => {
  expect(screen.getByText('Pilotage partagé')).toBeInTheDocument();
});
expect(screen.getByText('Test Company')).toBeInTheDocument(); // could fail

// After (all assertions retried within waitFor)
await waitFor(() => {
  expect(screen.getByText('Pilotage partagé')).toBeInTheDocument();
  expect(screen.getByText('Test Company')).toBeInTheDocument();
  expect(screen.getByText(/france/i)).toBeInTheDocument();
  expect(screen.getByText(/b2b_services/i)).toBeInTheDocument();
  expect(screen.getByText('Revenus')).toBeInTheDocument();
  expect(screen.getByText('Flux de tresorerie operationnel negatif')).toBeInTheDocument();
});
```

---

## Additional Observations

1. **Missing i18n translation keys:** The keys `stockManagement.cockpit.valuationTitle`, `stockManagement.cockpit.replenishmentTitle`, `stockManagement.tabs.warehouses`, and others added during fix/01 are not yet defined in `src/i18n/locales/fr.json` or `src/i18n/locales/en.json`. This means the production UI renders the raw key string instead of a translated label. These should be added in a follow-up task.

2. **No code changes were made** to production source files — only test files were updated.

---

## Test Results After Fix

```
✓ src/test/pages/StockManagement.test.jsx  (11 tests, 0 failed)
✓ src/test/pages/SharedSnapshotPage.test.jsx  (1 test, 0 failed)
```

Build: ✅ 0 errors
Lint: ✅ 0 errors (199 pre-existing warnings, unchanged)
