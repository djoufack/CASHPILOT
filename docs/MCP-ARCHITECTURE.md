# CashPilot MCP Server — Architecture

> Version 1.0.0 | `mcp-server/` | 449 tools total (82 hand-written + ~375 generated CRUD)

---

## Overview

The CashPilot MCP server exposes all business operations of the CashPilot SaaS as Model Context Protocol (MCP) tools. It is built with the official `@modelcontextprotocol/sdk` and uses `@supabase/supabase-js` as the sole data layer. There is **no Express, Hono, or other HTTP framework** — the transport layer is implemented with Node's built-in `http` module and the SDK's `StreamableHTTPServerTransport`.

```
mcp-server/
├── src/
│   ├── index.ts          # stdio entry point (Claude Desktop / Claude Code)
│   ├── http.ts           # HTTP entry point (web clients, per-session isolation)
│   ├── server.ts         # Tool registration orchestrator (shared factory)
│   ├── supabase.ts       # Auth, session state, AsyncLocalStorage context
│   ├── tools/            # 19 tool modules (16 hand-written + 3 generated CRUD)
│   └── utils/            # sanitize, validation, cache, errors
└── package.json          # Runtime: tsx (dev), tsc (build). No vitest devDep here.
```

---

## Entry Points

### stdio mode — `src/index.ts`

Used by Claude Desktop and Claude Code CLI. Starts a single MCP server instance connected to a `StdioServerTransport`. Single-user; auth state is held in a module-level singleton (`stdioState`).

```
npm start   →   tsx src/index.ts
```

### HTTP mode — `src/http.ts`

Used by web clients (e.g. the CashPilot frontend AI assistant). Listens on `MCP_HTTP_PORT` (default `3100`). Exposes three routes:

| Method   | Path      | Purpose                                                                              |
| -------- | --------- | ------------------------------------------------------------------------------------ |
| `POST`   | `/mcp`    | Main JSON-RPC endpoint (initialize, tool calls)                                      |
| `GET`    | `/mcp`    | SSE stream for server-to-client notifications (requires `mcp-session-id` header)     |
| `DELETE` | `/mcp`    | Graceful session termination                                                         |
| `GET`    | `/health` | Health check — returns `{ status: "ok", server: "cashpilot-mcp", version: "1.0.0" }` |

```
npm run start:http   →   tsx src/http.ts
```

**Per-session isolation:** each new `POST /mcp` without an existing `mcp-session-id` creates a fresh `SessionEntry` containing its own `StreamableHTTPServerTransport` and its own `SessionState` (Supabase client + auth state). Two simultaneous HTTP clients never share credentials.

CORS is configured to allow `APP_ORIGIN` (default `https://cashpilot.tech`), exposing the `mcp-session-id` response header.

---

## Authentication

Authentication is handled entirely in `src/supabase.ts` using `AsyncLocalStorage` to provide per-session isolation.

### Session lifecycle

```
login tool call
  → supabase.auth.signInWithPassword()
  → stores session + userId in current SessionState
  → all subsequent tool calls in same session use that user's JWT

logout tool call
  → supabase.auth.signOut()
  → clears session, userId, companyId, memoryStorage
```

### SessionState (per session)

| Field           | Type                     | Purpose                                          |
| --------------- | ------------------------ | ------------------------------------------------ |
| `supabase`      | `SupabaseClient`         | Isolated client with in-memory token storage     |
| `memoryStorage` | `Record<string, string>` | In-memory auth token store (no cookies, no disk) |
| `userId`        | `string \| null`         | Cached authenticated user ID                     |
| `session`       | `Session \| null`        | Supabase JWT session object                      |
| `companyId`     | `string \| null`         | Lazily resolved and cached company ID            |

### Token refresh

`ensureSessionValid()` is called before operations that require a valid token. It proactively refreshes the session if it expires within 5 minutes. If the session has already expired and refresh fails, it throws a clear error prompting re-login.

### Company resolution

`getCompanyId()` lazily fetches and caches the user's first company (`company` table ordered by `created_at ASC`). This cached value is cleared on logout.

### Auth tools (registered inline in `server.ts`)

| Tool     | Description                                                              |
| -------- | ------------------------------------------------------------------------ |
| `login`  | Authenticates with email/password, sets session for all subsequent calls |
| `logout` | Clears session and all cached state                                      |
| `whoami` | Returns current login status and `user_id`                               |

---

## Tool Organisation

All tools are registered via `createServer()` in `src/server.ts`, which is called once per entry point (once for stdio, once per HTTP session).

### Hand-written tools (16 modules)

| Module                | File                             | Domain                                                             |
| --------------------- | -------------------------------- | ------------------------------------------------------------------ |
| Invoices              | `tools/invoices.ts`              | Invoice CRUD, status transitions, search, stats, recurring         |
| Clients               | `tools/clients.ts`               | Client CRUD, balance, archive/restore, top clients                 |
| Payments              | `tools/payments.ts`              | Payment recording, alerts, reminders, instruments, transfers       |
| Accounting            | `tools/accounting.ts`            | Chart of accounts, entries, tax rates, journal init                |
| Analytics             | `tools/analytics.ts`             | Cash flow, dashboard KPIs, aging, payment volume, company KPIs     |
| Exports               | `tools/exports.ts`               | FEC, UBL, Factur-X, SAF-T, SYSCOHADA liasse exports                |
| Supplier Invoices     | `tools/supplier-invoices.ts`     | Supplier invoice upload, AI extraction, status                     |
| Bank Reconciliation   | `tools/bank-reconciliation.ts`   | Import statements, match/unmatch/ignore lines, summary             |
| Reporting             | `tools/reporting.ts`             | P&L, balance sheet, trial balance, tax summary, dunning            |
| Documents             | `tools/documents.ts`             | GED document upload                                                |
| Company Finance       | `tools/company-finance.ts`       | Multi-company: P&L, cash flow, balance sheet, consolidated summary |
| Financial Instruments | `tools/financial-instruments.ts` | Instrument balance history, mobile money status                    |
| CRM                   | `tools/crm.ts`                   | CRM pipeline summary, lead listing                                 |
| CFO                   | `tools/cfo.ts`                   | Health score (0-100), recommendations, risk analysis               |
| Mobile Money          | `tools/mobile_money.ts`          | MTN MoMo / Orange Money payment sending                            |
| SYSCOHADA             | `tools/syscohada.ts`             | SYSCOHADA chart lookup, entry validation                           |

### Generated CRUD tools (3 files)

These files are auto-generated and cover full CRUD (`list_*`, `get_*`, `create_*`, `update_*`, `delete_*`) for 75 tables.

| File                               | Tables covered                                                                                                                  | Approximate tool count |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------- |
| `tools/generated_crud.ts`          | 35 core tables (suppliers, quotes, expenses, bank transactions, payment instruments, receivables, payables, credit notes, etc.) | ~175 tools             |
| `tools/generated_crud_hr.ts`       | 28 HR tables (employees, contracts, departments, payroll periods, leave, training, timesheets, surveys, succession, etc.)       | ~140 tools             |
| `tools/generated_crud_projects.ts` | 12 CRM/project/material tables (projects, milestones, baselines, resource allocations, material assets, assignments, etc.)      | ~60 tools              |

**Design pattern:** each generated CRUD module defines explicit column-allow-lists (e.g. `COLS_HR_DEPARTMENTS = 'id, company_id, ...'`). No `select('*')` is ever used — this is a defense-in-depth measure against future schema changes leaking sensitive columns.

---

## Security Model

### Rate limiting (HTTP mode only)

Implemented in-memory in `src/http.ts`. Keyed by client IP (`x-forwarded-for` or socket address).

| Limit type          | Max requests | Window                  |
| ------------------- | ------------ | ----------------------- |
| General (all tools) | 60 req/min   | 1-minute sliding window |
| Login-specific      | 5 req/min    | 1-minute sliding window |

Stale rate-limit entries are cleaned up every 5 minutes to prevent memory growth.

### Multi-session auth isolation

Each HTTP session has its own `SessionState` containing its own `SupabaseClient` with in-memory token storage. Credentials from one session are never accessible to another. This is enforced via Node's `AsyncLocalStorage` — all auth helpers (`getUserId`, `getCompanyId`, `supabase`, etc.) transparently read from the context of the currently-executing request.

### Data scoping

Every tool call that reads or writes data filters by `user_id` (via `getUserId()`) or `company_id` (via `getCompanyId()`). There is no super-admin backdoor in tool handlers — data isolation is the same as for regular Supabase RLS queries.

The generated CRUD tools use explicit column allow-lists instead of `select('*')` to prevent accidental column exposure.

### Input sanitization

`src/utils/sanitize.ts` provides:

- `sanitizeText(str)` — strips `<script>` tags, `on*=` event handlers, `javascript:` URIs, and `data:text/html` URIs.
- `sanitizeRecord(record)` — applies `sanitizeText` to every string value in a flat object. Used in all `create_*` and `update_*` tool handlers before writing to Supabase.
- `escapeXml(str)` — XML-escapes strings for UBL / Factur-X export.

### CORS (HTTP mode)

Origin restricted to `APP_ORIGIN` environment variable (defaults to `https://cashpilot.tech`). The `mcp-session-id` header is explicitly exposed to the browser.

---

## Cache Strategy

`src/utils/cache.ts` provides a simple in-process, in-memory TTL cache (a `Map`).

| Function                     | Purpose                                           |
| ---------------------------- | ------------------------------------------------- |
| `getCached(key)`             | Returns cached value or `null` if missing/expired |
| `setCache(key, data, ttlMs)` | Stores value with TTL (default: **60 seconds**)   |
| `invalidateCache(prefix?)`   | Clears all keys, or only keys matching a prefix   |

The cache is **process-local** — it is not shared across HTTP sessions or server restarts. It is used in the generated CRUD tools for frequently-read reference data (e.g., tax rates, payment terms). Write operations call `invalidateCache(prefix)` on the affected table prefix to keep reads fresh.

**Important:** in the HTTP mode with multiple concurrent sessions, the in-process cache is shared across sessions. This is intentional for read-heavy reference data, but write invalidation is conservative (prefix-based).

---

## Adding New Tools

### Hand-written tool

1. Create `mcp-server/src/tools/my-feature.ts` exporting `registerMyFeatureTools(server: McpServer)`.
2. Inside the function, call `server.tool(name, description, zodSchema, handler)`.
3. In every handler: call `getUserId()` (throws if not logged in), scope DB queries to `user_id` / `company_id`.
4. Use `sanitizeRecord()` on any user-supplied write payload.
5. Import and call `registerMyFeatureTools(server)` in `src/server.ts`.

### Generated CRUD tool

The three `generated_crud*.ts` files follow a strict pattern:

1. Define a `COLS_TABLE_NAME` constant listing only the columns the tool is allowed to return.
2. Implement `list_*` (with `user_id` + optional `company_id` filter + ordering + limit), `get_*` (by id + user*id), `create*_`(with`sanitizeRecord`+`validateDatesInRecord`), `update\__`(same guards), and`delete\_\*` (by id + user_id).
3. Add the tool registrations inside the relevant `register*CrudTools` function.

### Environment variables required

| Variable            | Purpose                                                |
| ------------------- | ------------------------------------------------------ |
| `SUPABASE_URL`      | Supabase project REST URL                              |
| `SUPABASE_ANON_KEY` | Supabase anon/public key                               |
| `MCP_HTTP_PORT`     | HTTP server port (default `3100`)                      |
| `APP_ORIGIN`        | Allowed CORS origin (default `https://cashpilot.tech`) |
