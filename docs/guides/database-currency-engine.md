# Database Currency Engine

## Goal

Provide a single conversion engine in Supabase so every future dashboard, chart, report, and diagnostic can rely on the same source of truth.

## Current scope

- `company.accounting_currency` becomes the canonical accounting currency.
- `public.fx_rates` stores:
  - global rates with `company_id = NULL`
  - company-specific overrides with `company_id = <company.id>`
- `public.get_exchange_rate(...)` resolves the best available rate.
- `public.convert_currency_amount(...)` converts an amount in SQL.

## Resolution order

1. company exact rate
2. global exact rate
3. company inverse rate
4. global inverse rate
5. EUR triangulation

## Important rule

This engine does **not** mean the app should blindly display everything in the user profile currency.

For accounting and steering:

- source amounts stay in the accounting currency unless a real dated FX path exists in the database
- if no path exists, the app must keep the source currency and explain why conversion is unavailable

## What comes next

1. replace frontend ad-hoc FX helpers with the database RPCs
2. mark each analysis widget with its required inputs and missing inputs
3. centralize analytics on database-backed facts instead of component-level heuristics
