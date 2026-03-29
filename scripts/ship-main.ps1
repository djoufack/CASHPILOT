param(
  [string]$Message = "chore: sync updates",
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

function Run-Step {
  param(
    [string]$Label,
    [scriptblock]$Action
  )

  if ($DryRun) {
    Write-Host "[dry-run] $Label"
    return
  }

  & $Action
}

$branch = (git rev-parse --abbrev-ref HEAD).Trim()
if (-not $branch) {
  throw "Unable to detect current git branch."
}

if ($branch -eq "main") {
  $pushArgs = @("push", "origin", "main")
  $pushLabel = "git push origin main"
} else {
  $pushArgs = @("push", "origin", "HEAD:main")
  $pushLabel = "git push origin HEAD:main"
}

Write-Host "Current branch: $branch"

$status = git status --porcelain
if ($status) {
  Run-Step -Label "git add -A" -Action { git add -A }
  Run-Step -Label "git commit -m `"$Message`"" -Action { git commit -m $Message }
} else {
  Write-Host "No local changes to commit. Continuing with push and deploy."
}

Run-Step -Label "npm run verify:local" -Action { npm run verify:local }
Run-Step -Label "npm run test:coverage" -Action { npm run test:coverage }
Run-Step -Label "npm audit --omit=dev --audit-level=high" -Action { npm audit --omit=dev --audit-level=high }

Run-Step -Label $pushLabel -Action { git @pushArgs }
Run-Step -Label "vercel deploy --prod --yes" -Action { vercel deploy --prod --yes }

if ($DryRun) {
  Write-Host ""
  Write-Host "Dry run complete: no changes were pushed or deployed."
} else {
  Write-Host ""
  Write-Host "Done: main pushed and production deployed to Vercel."
}

