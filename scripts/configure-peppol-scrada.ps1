param(
  [string]$ProjectRef = "",
  [ValidateSet("test", "prod")]
  [string]$ScradaEnvironment = "test",
  [string]$AppOrigin = "https://cashpilot.tech",
  [string]$EncryptionKey = "",
  [string]$WebhookSecret = "",
  [switch]$AllowInsecureWebhooks,
  [switch]$ApplyMigrations
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Assert-SupabaseCli {
  if (-not (Get-Command supabase -ErrorAction SilentlyContinue)) {
    throw "Supabase CLI introuvable. Installez-le puis relancez le script."
  }
}

function New-RandomBase64([int]$length) {
  $bytes = New-Object byte[] $length
  [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
  return [Convert]::ToBase64String($bytes)
}

function Assert-Base64Key32([string]$key) {
  try {
    $decoded = [Convert]::FromBase64String($key)
  } catch {
    throw "COMPANY_SECRETS_ENCRYPTION_KEY doit etre en base64 valide."
  }
  if ($decoded.Length -ne 32) {
    throw "COMPANY_SECRETS_ENCRYPTION_KEY doit decoder en 32 bytes (actuel: $($decoded.Length))."
  }
}

function Invoke-Supabase([string[]]$cliArgs) {
  Write-Host ">> supabase $($cliArgs -join ' ')" -ForegroundColor Cyan
  & supabase @cliArgs
}

Assert-SupabaseCli

if ([string]::IsNullOrWhiteSpace($EncryptionKey)) {
  $EncryptionKey = New-RandomBase64 32
  Write-Host "COMPANY_SECRETS_ENCRYPTION_KEY genere automatiquement." -ForegroundColor Yellow
}
Assert-Base64Key32 $EncryptionKey

if ([string]::IsNullOrWhiteSpace($WebhookSecret)) {
  $WebhookSecret = New-RandomBase64 32
  Write-Host "SCRADA_WEBHOOK_SECRET genere automatiquement." -ForegroundColor Yellow
}

$scradaApiUrl = if ($ScradaEnvironment -eq "prod") { "https://api.scrada.be/v1" } else { "https://apitest.scrada.be/v1" }
$allowInsecure = if ($AllowInsecureWebhooks.IsPresent) { "true" } else { "false" }

$projectArgs = @()
if (-not [string]::IsNullOrWhiteSpace($ProjectRef)) {
  $projectArgs = @("--project-ref", $ProjectRef)
}

if ($ApplyMigrations.IsPresent) {
  Invoke-Supabase (@("db", "push") + $projectArgs)
}

Invoke-Supabase (@(
  "secrets", "set",
  "APP_ORIGIN=$AppOrigin",
  "SCRADA_API_URL=$scradaApiUrl",
  "COMPANY_SECRETS_ENCRYPTION_KEY=$EncryptionKey",
  "SCRADA_WEBHOOK_SECRET=$WebhookSecret",
  "ALLOW_INSECURE_WEBHOOKS=$allowInsecure"
) + $projectArgs)

$functions = @(
  "peppol-save-credentials",
  "peppol-configure",
  "peppol-check",
  "peppol-send",
  "peppol-poll-status",
  "peppol-inbound",
  "peppol-account-info",
  "peppol-webhook"
)

foreach ($fn in $functions) {
  Invoke-Supabase (@("functions", "deploy", $fn) + $projectArgs)
}

Write-Host ""
Write-Host "Configuration Peppol/Scrada terminee." -ForegroundColor Green
Write-Host "Scrada API URL: $scradaApiUrl"
Write-Host "ALLOW_INSECURE_WEBHOOKS: $allowInsecure"
Write-Host "Ensuite, configurez les credentials Scrada dans l'UI CashPilot (Settings > Peppol)." -ForegroundColor Green
