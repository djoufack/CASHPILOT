# Prebuilt Deployment Checklist

## Prerequisites

- Vercel CLI available (`npx vercel --version`)
- Project linked to Vercel (or `VERCEL_ORG_ID` / `VERCEL_PROJECT_ID` provided)
- `VERCEL_TOKEN` available for CI/non-interactive deploy

## Local rollout

1. Ensure target commit/branch is correct.
2. Run:
   - `npm run verify:local`
   - Optional: `npm run verify:remote`
3. Run `npm run vercel:prebuilt:prod`
4. Validate:
   - `vercel inspect cashpilot.tech`
   - open `https://cashpilot.tech`

## CI rollout

Use `.github/workflows/vercel-prebuilt-prod.yml`.
Set repository secrets:

- `VERCEL_TOKEN`
- `VERCEL_ORG_ID`
- `VERCEL_PROJECT_ID`

## Troubleshooting

- If deploy upload is huge, verify `.vercelignore` includes non-runtime folders.
- If `vercel pull` fails in CI, verify token scope and org/project IDs.
- If build differs from local, clear Vercel build cache and rerun workflow.
