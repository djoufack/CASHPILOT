# BUGS — Task 03: Clients, Client Portal, Smart Dunning

**Date:** 2026-03-29
**Branch:** audit/task-03-clients
**Agent:** Claude Sonnet 4.6

---

## Files audited

| File                                             | Role                                          |
| ------------------------------------------------ | --------------------------------------------- |
| `src/pages/ClientsPage.jsx`                      | Client list page (delegates to ClientManager) |
| `src/pages/ClientProfile.jsx`                    | Individual client profile + invoice history   |
| `src/pages/ClientPortal.jsx`                     | External client-facing portal                 |
| `src/pages/SmartDunningPage.jsx`                 | AI-powered dunning campaign page              |
| `src/hooks/useClients.js`                        | CRUD hook for clients table                   |
| `src/hooks/useSmartDunning.js`                   | Hook for dunning campaigns/executions         |
| `src/components/ClientManager.jsx`               | Client list/search/form orchestrator          |
| `src/components/dunning/DunningCampaignForm.jsx` | Campaign creation form                        |

---

## BUG-03-01 — CRITICAL: ClientPortal shows hardcoded fake invoices (ENF-1 violation)

**File:** `src/pages/ClientPortal.jsx`
**Severity:** CRITICAL
**Type:** ENF-1 violation (hardcoded data displayed to user)

### Description

The Client Portal page displayed two fully hardcoded invoice rows in its JSX:

```jsx
<p className="text-gradient font-medium">INV-2026-001</p>
<p className="text-gray-400 text-sm">Jan 28, 2026</p>
...
<p className="text-gradient font-medium">INV-2026-002</p>
<p className="text-gray-400 text-sm">Feb 15, 2026</p>
```

Every user who accessed the Client Portal — regardless of their company or whether
they had any invoices at all — would always see these two fake static invoices. This
is a direct violation of ENF-1 (no hardcoded business data; all data must come from DB).

Additionally, there was no Supabase query, no loading state, no error handling, and
no company_id scoping on the invoices section.

### Fix

Replaced the hardcoded block with:

- A `useEffect` that queries `supabase.from('invoices')` filtered via `applyCompanyScope()`
- Proper loading spinner, error message, and "no invoices" empty state
- Dynamic `getStatusBadge()` helper covering paid/overdue/due states
- `formatCurrency(invoice.total_ttc)` for the amount column
- `invoice.issue_date` for the date column

**Commit:** `ac15b87` — fix(clients): replace hardcoded invoice data in ClientPortal with live Supabase query (ENF-1)

---

## BUG-03-02 — HIGH: ClientProfile uses `inv.total` instead of `inv.total_ttc`

**File:** `src/pages/ClientProfile.jsx`
**Severity:** HIGH
**Type:** Wrong field reference (silent data error)

### Description

The ClientProfile page computed `totalRevenue` and `pendingAmount` using `inv.total`:

```jsx
.reduce((sum, inv) => sum + (inv.total || 0), 0);
```

However, `total` is not a column in the `invoices` table. The canonical DB field is
`total_ttc`. Because `inv.total` is always `undefined`, both KPIs always displayed
`0.00` regardless of real invoice amounts — a silent data error.

Additionally, the status filter only checked `inv.status` (the workflow status), not
`inv.payment_status` (the payment state column). This caused paid invoices to still
appear in the "pending" total if their `status` was `'sent'` rather than `'paid'`.

The invoice badge also showed `inv.status` without checking `inv.payment_status`,
and had no visual indicator for overdue invoices.

### Fix

- Changed `inv.total` → `inv.total_ttc` in both revenue/pending reductions
- Updated status filters to check `payment_status === 'paid' || status === 'paid'`
- Updated badge to show `payment_status || status` with overdue → red styling
- Removed unused imports: `React`, `useState`, `useEffect`, `Building2`
- Removed unused `invoicesLoading` destructure

**Commit:** `603c20a` — fix(clients): use total_ttc and payment_status in ClientProfile invoice calculations

---

## BUG-03-03 — HIGH: deleteClient and restoreClient lack company_id guard (ENF-2 violation)

**File:** `src/hooks/useClients.js`
**Severity:** HIGH
**Type:** ENF-2 violation (missing company ownership scope on mutation)

### Description

Both `deleteClient` and `restoreClient` filtered only by `id`:

```js
// deleteClient
await supabase.from('clients').update({ deleted_at: new Date().toISOString() }).eq('id', id);

// restoreClient
await supabase.from('clients').update({ deleted_at: null }).eq('id', id)...
```

Without a `company_id` constraint, if a user managed multiple companies and the id
happened to exist in another company's client list, or if a bug passed the wrong id,
the operation could affect a client record in a different company — violating the ENF-2
ownership chain requirement (user → company → data).

Note: Supabase RLS policies provide a last-resort guard, but defence-in-depth at the
application layer is required and missing here.

### Fix

- Destructured `activeCompanyId` from `useCompanyScope()` (was already calling the
  hook but only using `applyCompanyScope` and `withCompanyScope`)
- Added `.eq('company_id', activeCompanyId)` to both the delete and restore queries
  (guarded with `if (activeCompanyId)` for backward compatibility during onboarding)

**Commit:** `2f18999` — fix(clients): add company_id guard to deleteClient and restoreClient (ENF-2)

---

## BUG-03-04 — MEDIUM: SmartDunning "Launch Campaign" only fires for first overdue client

**File:** `src/pages/SmartDunningPage.jsx`
**Severity:** MEDIUM
**Type:** Logic bug (incomplete feature implementation)

### Description

`handleLaunchCampaign` only dispatched dunning for `clientScores[0]`:

```js
if (clientScores.length > 0) {
  const firstScore = clientScores[0];
  await launchDunning({ ... firstScore ... });
}
```

A comment in the code acknowledged this: _"In a real scenario, this would batch-send
to all matching clients. For now, trigger for the first overdue client score"_. However,
this "for now" state had shipped — clicking "Launch" on a campaign with 50 overdue
clients would only send 1 dunning reminder.

### Fix

- Replaced the single-score logic with a filtered array of all scores whose
  `recommendedChannel` matches the campaign's supported channels
- Used `Promise.allSettled()` to fire all dunning requests in parallel (non-blocking,
  partial failures don't abort the rest)
- Added a guard: if no scores match the campaign channels, return early

**Commit:** `2967699` — fix(clients): SmartDunning launch campaign for all matching scores, not just first

---

## Items verified as CORRECT (no fix needed)

### useClients.js — ENF-1 compliance

- `useSupabaseQuery` is used with a real `supabase.from('clients').select('*')` query
- `applyCompanyScope(query)` is called to filter by `company_id`
- `createClient` uses `withCompanyScope(sanitizedData)` + `user_id: user.id`
- `updateClient` uses `withCompanyScope(sanitizedData)`
- No hardcoded client arrays anywhere in the hook

### ClientsPage.jsx — ENF-1 compliance

- The page is a thin wrapper delegating to `<ClientManager />`
- No data is hardcoded; all client data flows through `useClients` hook

### ClientManager.jsx — ENF-1 compliance

- Calls `useClients()` hook for all CRUD operations
- Search is client-side filtering of DB data
- No hardcoded client objects or arrays

### useClients.js — Cross-company read isolation (ENF-2)

- `fetchClients` and `fetchDeletedClients` both call `applyCompanyScope(query)`
- This ensures BE account cannot see FR clients

### useSmartDunning.js — ENF-1/ENF-2 compliance

- `fetchCampaigns` uses `applyCompanyScope(query)`
- `fetchExecutions` uses `applyCompanyScope(query)`
- `buildFallbackSuggestions` filters by `eq('user_id', user.id)` + `eq('company_id', activeCompanyId)`
- No hardcoded message templates — templates have `subject` and `body` as empty strings by default,
  filled by the user in `DunningCampaignForm`

### DunningCampaignForm.jsx — ENF-1 compliance

- Template `subject` and `body` fields default to `''` (empty, user-provided)
- No hardcoded message templates
- `STRATEGY_OPTIONS`, `CHANNEL_OPTIONS`, `TONE_OPTIONS` are UI labels/enum keys, not business data

### ClientPortal.jsx — Token-based access

- Access is gated by route guard: `user.role === 'client' || user.role === 'admin'`
- After the fix, data is further scoped by `applyCompanyScope()` which enforces `company_id`
- No token-based per-client isolation needed at this layer (portal shows the company's invoices)

### Client deletion CASCADE

- Soft delete (set `deleted_at`) is used instead of hard delete — orphaned invoices/quotes are safe
- Hard delete would rely on DB-level `ON DELETE CASCADE` defined in Supabase migrations

---

## Summary

| Bug ID    | Severity | File                 | Fixed |
| --------- | -------- | -------------------- | ----- |
| BUG-03-01 | CRITICAL | ClientPortal.jsx     | ✅    |
| BUG-03-02 | HIGH     | ClientProfile.jsx    | ✅    |
| BUG-03-03 | HIGH     | useClients.js        | ✅    |
| BUG-03-04 | MEDIUM   | SmartDunningPage.jsx | ✅    |
