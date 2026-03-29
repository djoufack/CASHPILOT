# CashPilot

**CashPilot** is a modern, AI-native ERP SaaS for SMEs — built for Belgium, France, Morocco, and Africa (OHADA).

🌐 **Production:** https://cashpilot.tech

---

## ✨ Features

- 📊 **Finance & Accounting** — Invoices, credit notes, cash flow, tax filing, PEPPOL/Chorus Pro
- 👥 **HR** — Payroll, absences, performance, recruitment, skills matrix
- 🛒 **Purchases** — Supplier invoices, purchase orders, expense management
- 📦 **Inventory** — Stock management, FIFO/CMUP, multi-warehouse
- 🏦 **Banking** — GoCardless, Yapily open banking, bank reconciliation
- 🤖 **AI CFO** — Forecasting, anomaly detection, scenario builder
- 🌍 **Multi-regulatory** — PCG/PCMN (Belgium), OHADA, TAFIR (Morocco), PEPPOL (EU)
- 🔌 **MCP Server** — 449 AI agent tools for external integrations
- 💳 **Payments** — Stripe subscriptions, Mobile Money (Africa)

---

## 🛠️ Tech Stack

| Layer        | Technology                                   |
| ------------ | -------------------------------------------- |
| Frontend     | React 18 + Vite + TailwindCSS + Radix UI     |
| Backend      | Supabase (PostgreSQL + RLS + Edge Functions) |
| Auth         | Supabase Auth (JWT, MFA TOTP)                |
| Hosting      | Vercel (auto-deploy from `main`)             |
| Monitoring   | Sentry                                       |
| Payments     | Stripe                                       |
| Open Banking | GoCardless + Yapily                          |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 20+
- npm 10+
- Supabase project (or use the shared dev instance)

### Local Setup

```bash
git clone https://github.com/your-org/cashpilot.git
cd cashpilot
npm install
cp .env.example .env
# Fill in VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
npm run dev
```

App runs at: http://localhost:3001

### Available Scripts

| Script                 | Description                                    |
| ---------------------- | ---------------------------------------------- |
| `npm run dev`          | Start dev server                               |
| `npm run build`        | Production build                               |
| `npm test`             | Run all tests (769 tests)                      |
| `npm run guard`        | Run all 4 quality guards                       |
| `npm run verify:local` | Full local verification (guard + build + test) |
| `npm run lint`         | ESLint check                                   |

---

## 🏗️ Architecture

```
src/
├── pages/          # 93 page components
├── hooks/          # 168 custom hooks (Supabase queries)
├── components/     # 123 reusable UI components
├── services/       # External service integrations
├── i18n/           # Translations (FR/EN/NL)
└── utils/          # Shared utilities

supabase/
├── functions/      # 72 Edge Functions (Deno)
└── migrations/     # 323 DB migrations

mcp-server/         # MCP server with 449 tools
api/                # Vercel serverless functions
.github/workflows/  # CI/CD (guards, security, deploy)
```

---

## 🔒 Security

See [SECURITY.md](./SECURITY.md) for the security policy and vulnerability reporting.

- JWT authentication via Supabase Auth
- Row-Level Security (RLS) on all tables
- Company-scoped data isolation (multi-tenant)
- MFA (TOTP) supported
- CSP, HSTS, X-Frame-Options headers in production

---

## 🌍 Internationalization

- 🇫🇷 Français (4,659 keys)
- 🇬🇧 English (4,672 keys)
- 🇧🇪 Nederlands (5,525 keys)

---

## 📄 License

Proprietary — © 2026 CashPilot. All rights reserved.
