# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue, please report it responsibly.

**Email:** [security@cashpilot.tech](mailto:security@cashpilot.tech)

**Expected response time:** We will acknowledge your report within **48 hours** and provide an initial assessment within 5 business days.

### What to include in your report

- A clear description of the vulnerability
- Steps to reproduce the issue
- Affected component(s) (frontend, Supabase backend, MCP server, Edge Functions)
- Impact assessment (data exposure, privilege escalation, etc.)
- Any proof-of-concept code or screenshots
- Your suggested fix, if applicable

### What to expect

1. **Acknowledgement** within 48 hours of submission
2. **Triage and assessment** within 5 business days
3. **Fix development and testing** — timeline depends on severity
4. **Coordinated disclosure** — we will credit you (unless you prefer anonymity) once the fix is released

Please **do not** open public GitHub issues for security vulnerabilities.

## Security Model Overview

### Authentication

- **JWT-based authentication** via Supabase Auth with short-lived access tokens and refresh token rotation
- **Multi-Factor Authentication (MFA)** support using TOTP (Time-based One-Time Passwords)
- **Rate limiting** on authentication endpoints to prevent brute-force attacks

### Authorization

- **Row-Level Security (RLS)** enforced on all Supabase tables, ensuring users can only access data belonging to their company
- Company-scoped access control — all queries are filtered by the authenticated user's `company_id`

### Data Validation

- **Input validation** using [Zod](https://zod.dev/) schemas on both client and server side
- **Database-level constraints** — CHECK constraints, FK constraints, and GENERATED columns enforce business rules at the PostgreSQL layer

### XSS and Injection Prevention

- **DOMPurify** used to sanitize any user-generated HTML content before rendering
- **Content Security Policy (CSP)** headers restrict script and resource loading (see Security Headers below)
- **Parameterized queries** via Supabase client — no raw SQL concatenation in application code

## Security Headers

The following security headers are configured via `vercel.json` and applied to all routes (`/(.*)`):

| Header | Value |
| ------ | ----- |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` |
| `Content-Security-Policy` | Restricts `default-src`, `script-src`, `style-src`, `connect-src`, `frame-src`; blocks `object-src` and `frame-ancestors` |
| `X-Content-Type-Options` | `nosniff` |
| `X-Frame-Options` | `DENY` |
| `X-XSS-Protection` | `1; mode=block` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=(self), payment=()` |
| `Access-Control-Allow-Origin` | `https://cashpilot.tech` (strict origin, not wildcard) |

## Known Limitations

- **Client-side rate limiting** — Auth endpoint rate limiting is enforced at the Supabase level, but some application-level rate limiting is implemented client-side and can be bypassed by a determined attacker. Server-side rate limiting via Supabase Edge Functions is planned.
- **No field-level encryption** — Sensitive data is protected by RLS and TLS in transit, but individual database fields are not encrypted at rest beyond Supabase's default disk encryption. Field-level encryption for PII (e.g., bank account details) is on the roadmap.
