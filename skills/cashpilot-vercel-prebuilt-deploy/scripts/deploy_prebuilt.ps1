param(
  [switch]$SkipVerifyLocal
)

$ErrorActionPreference = 'Stop'

Write-Host "== CashPilot Vercel prebuilt deploy =="

if (-not $SkipVerifyLocal) {
  Write-Host "[1/4] Running local verification..."
  npm run verify:local
}

Write-Host "[2/4] Pulling Vercel production settings..."
npm run vercel:pull:prod

Write-Host "[3/4] Building prebuilt output..."
npm run vercel:build:prod

Write-Host "[4/4] Deploying prebuilt output to production..."
npm run vercel:deploy:prebuilt:prod

Write-Host "Deployment finished."
