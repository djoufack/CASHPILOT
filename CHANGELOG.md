# Changelog

All notable changes to this project are documented in this file.

## [Unreleased] - 2026-04-04

### Added

- Added `scripts/guard-env-files.mjs` to block committing any `.env*` file except `.env.example`.
- Added pre-commit enforcement for staged env files via `.husky/pre-commit`.

### Changed

- Integrated `guard:env-files` into the global `npm run guard` pipeline.
- Corrected critical FR/EN locale entries in:
  - `src/i18n/locales/en.json`
  - `src/i18n/locales/fr.json`
    for common labels, auth hints, invoices, stock management dialogs, client portal statuses, and settings messages.
