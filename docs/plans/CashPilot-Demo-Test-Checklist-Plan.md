# CashPilot Demo Test Checklist Plan (FR/BE/OHADA)

## Scope

This checklist covers:

- 3 demo accounts: FR, BE, OHADA
- Every company in each account portfolio
- Every menu in left sidebar
- All tabs and actionable buttons on each page
- CRUD operations and PDF/HTML exports when available
- Immediate fix and retest loop

## Demo Accounts

- FR: `pilotage.fr.demo@cashpilot.cloud`
- BE: `pilotage.be.demo@cashpilot.cloud`
- OHADA: `pilotage.ohada.demo@cashpilot.cloud`

## Execution Matrix (mandatory)

For each account:

1. Login with demo user.
2. For each company in portfolio selector:
3. For each left sidebar menu route:
4. For each tab in the page:
5. For each main button/action:
6. Execute full CRUD + export checks if feature exists.

Use this loop strictly:
`account -> company -> menu -> tab -> action`

## Pre-Run Gates

- `node --env-file=.env scripts/audit-demo-thresholds.mjs`
- `node --env-file=.env scripts/verify-accounting-company-scope.mjs`
- `node scripts/smoke-navigation-responsive-playwright.mjs`
- `npm run build`

## Core Test Template (apply on every page)

Use this exact test sequence:

1. Open page/menu and verify no crash.
2. Iterate all tabs and verify each tab loads.
3. Click all primary actions/buttons and verify open/cancel paths.
4. CREATE one tagged record (`RUN_ID` prefix).
5. READ in list, details, filters, search, sort, pagination.
6. UPDATE at least 2 fields and verify persistence after refresh.
7. DELETE record and verify it is removed and no orphan side-effects.
8. EXPORT PDF if button exists and verify non-empty output.
9. EXPORT HTML if button exists and verify non-empty output.
10. Verify data isolation: no cross-company leakage.
11. Verify realtime/accounting/audit entries for financial flows.

## Immediate Fix Loop (when a case fails)

1. Stop progression for the failing module.
2. Log issue with: account, company, route, tab, action, payload, screenshot, console/network errors.
3. Apply fix immediately (frontend/hook/backend/db/seed).
4. Rerun failing case.
5. Rerun module smoke.
6. Rerun global gates before moving on.

## Pass/Fail Policy

- P0/P1 failure blocks progression.
- A module is complete only when:
  - All tabs/actions in module are green
  - CRUD is green
  - Exports are green when present
  - No data-scope leak observed

## Suggested Enhancements (integrated into plan)

- Add `RUN_ID` tagging in every created test record for fast cleanup.
- Keep artifacts per run in `artifacts/test-campaign/<RUN_ID>/`.
- Attach screenshot + exported files to every failed case.
- Add a daily CI gate running:
  - `audit-demo-thresholds`
  - HR CRUD smoke
  - navigation responsive smoke
  - company-scope verification
- Add automatic "feature inventory drift" check from sidebar routes vs tested checklist rows.

## Exit Criteria (100% ready)

- 100% checklist rows marked PASS across FR/BE/OHADA and all portfolio companies.
- 0 open P0 and 0 open P1.
- All pre-run gates and post-fix gates green.
- Production smoke on deployed URL green (desktop/tablet/mobile).

## Tracking File

Use this file to execute and track all tests:

- `docs/plans/cashpilot-demo-test-checklist.csv`

## Automated Orchestration Command

Run the campaign orchestrator:

- `npm run campaign:demo`

Fast mode (skip build + heavy UI smoke):

- `npm run campaign:demo:fast`

Outputs are generated in:

- `artifacts/test-campaign/<RUN_ID>/summary.json`
- `artifacts/test-campaign/<RUN_ID>/summary.md`
- `artifacts/test-campaign/<RUN_ID>/execution-matrix.csv`
