---
name: cashpilot-vercel-prebuilt-deploy
description: Use this skill when deploying CashPilot to Vercel with minimal upload size and faster CI/CD. Trigger for requests about ".vercelignore", "prebuilt deploy", production Vercel rollout, or repeated slow/full uploads.
---

# CashPilot Vercel Prebuilt Deploy

## Overview

This skill standardizes CashPilot production deployment on Vercel using `--prebuilt`.
It avoids large source uploads by sending prebuilt output and enforces a repeatable workflow.

## When To Use

- User asks for faster/leaner Vercel deployment.
- `vercel deploy --prod --yes` uploads too many files or times out.
- Team needs a consistent local + CI deployment workflow.

## Workflow

1. Ensure the repository is on the intended commit (`main` for production release).
2. Run validation before deploy:
   - `npm run verify:local`
   - Optional: `npm run verify:remote` when credentials are available.
3. Run prebuilt deployment:
   - `npm run vercel:prebuilt:prod`
4. Confirm deployment:
   - `vercel inspect cashpilot.tech`
   - check alias + latest production URL.

## Guardrails

- Prefer `--prebuilt` over raw `vercel deploy --prod --yes` on this repository.
- Keep `.vercelignore` current when new large non-runtime folders appear.
- Do not deploy if required env/secrets are missing in CI.
- Never commit `.env` or secrets.

## Local Commands

```bash
npm run vercel:pull:prod
npm run vercel:build:prod
npm run vercel:deploy:prebuilt:prod
```

One-shot local deploy:

```bash
npm run vercel:prebuilt:prod
```

PowerShell helper from this skill:

```powershell
pwsh -File skills/cashpilot-vercel-prebuilt-deploy/scripts/deploy_prebuilt.ps1
```

## CI Workflow

Use `.github/workflows/vercel-prebuilt-prod.yml`.
Required GitHub secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## References

- `references/prebuilt-checklist.md`
- Root `.vercelignore`
- Root `.github/workflows/vercel-prebuilt-prod.yml`
