# fix/10 — CfoChatPanel test failure

## Symptom

```
TestingLibraryElementError: Unable to find an element with the text: /1 500,00 EUR/i
```

Test `renders source evidence below assistant answers` in `src/test/components/cfo/CfoChatPanel.test.jsx` failed.

## Root cause

`CfoChatPanel.jsx` uses `getLocale()` from `@/utils/dateLocale` to format monetary values via `Intl.NumberFormat`.
`getLocale()` reads `i18n.resolvedLanguage || i18n.language` from the real `@/i18n/config` module.

In the test environment, `@/i18n/config` was **not mocked**, so the real i18n instance was loaded.
The LanguageDetector could not detect a browser locale in jsdom, and ultimately resolved to `'en'`.
With an `'en'` locale, `1500` formats as `"1,500.00 EUR"`, not the expected `"1 500,00 EUR"` (French).

## Fix

Added `vi.mock('@/i18n/config', ...)` in `CfoChatPanel.test.jsx` to pin the locale to `'fr'`,
consistent with the established pattern used in `src/test/utils/calculations.test.js`.

```js
vi.mock('@/i18n/config', () => ({
  default: {
    resolvedLanguage: 'fr',
    language: 'fr',
    on: vi.fn(),
  },
}));
```

## File changed

- `src/test/components/cfo/CfoChatPanel.test.jsx`
