# Changelog

All notable changes to this project are documented in this file.

## [Unreleased] - 2026-04-04

### Added

- Added `scripts/guard-env-files.mjs` to block committing any `.env*` file except `.env.example`.
- Added pre-commit enforcement for staged env files via `.husky/pre-commit`.
- Added `scripts/guard-i18n-language-quality.mjs` to detect EN/FR language regressions in locale files.
- Added `scripts/guard-git-history-env.mjs` to fail if `.env*` files (except `.env.example`) exist in Git history.
- Added `test:coverage:enterprise` command with enforced 100% line coverage on enterprise-critical guard/snapshot modules.

### Changed

- Integrated `guard:env-files` into the global `npm run guard` pipeline.
- Integrated `guard:i18n-language-quality` into the global `npm run guard` pipeline.
- Integrated `guard:git-history-env` into the global `npm run guard` pipeline.
- Integrated `test:coverage:enterprise` into the global `npm run guard` pipeline.
- Corrected critical FR/EN locale entries in:
  - `src/i18n/locales/en.json`
  - `src/i18n/locales/fr.json`
    for common labels, auth hints, invoices, stock management dialogs, client portal statuses, and settings messages.
- Removed pseudo-secret examples (`eyJ...`) from documentation and replaced them with non-sensitive placeholders.
- Replaced remaining inline `TODO` markers in runtime code/migrations with explicit `NOTE` documentation.
