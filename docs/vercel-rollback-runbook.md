# Vercel Rollback Runbook

## Prerequisites

- Vercel CLI installed (`npm i -g vercel`) and authenticated (`vercel login`)
- Project linked (`vercel link` from repo root)

## 1. List Recent Deployments

```bash
vercel ls
```

Note the deployment URL and status of the target deployment.

## 2. Inspect a Deployment

```bash
vercel inspect <deployment-url>
```

Review build output, environment, and runtime details before promoting or rolling back.

## 3. Rollback to Previous Production Deployment

```bash
vercel rollback
```

This instantly reverts production to the last successful production deployment.

## 4. Promote a Preview Deployment to Production

```bash
vercel promote <deployment-url>
```

Use this to promote any healthy preview deployment directly to production.

## Emergency Procedures

### Production is down or broken

1. **Immediate rollback**: `vercel rollback`
2. **Verify**: open the production URL in a browser and confirm the app loads
3. **Inspect**: `vercel inspect <current-production-url>` to confirm the active deployment
4. **Notify** the team via the channels listed below

### Rollback fails or CLI is unavailable

1. Log in to [vercel.com/dashboard](https://vercel.com/dashboard)
2. Navigate to the project > Deployments tab
3. Find the last known-good deployment
4. Click the three-dot menu > "Promote to Production"

### Promoting a specific older deployment

```bash
# List deployments to find the target
vercel ls

# Promote by URL
vercel promote <deployment-url>
```

## Post-Incident Checklist

- [ ] Confirm production is healthy
- [ ] Document the root cause
- [ ] Create a fix branch and deploy to preview
- [ ] Verify the fix on preview: `vercel inspect <preview-url>`
- [ ] Promote the fix to production: `vercel promote <preview-url>` or merge to main

## Contacts

| Role               | Name        | Contact           |
|---------------------|-------------|-------------------|
| Project Lead        | TBD         | TBD               |
| DevOps / Infra      | TBD         | TBD               |
| Vercel Account Owner| TBD         | TBD               |
