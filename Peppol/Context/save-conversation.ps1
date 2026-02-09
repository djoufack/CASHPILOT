# =============================================================
# Agent Sauvegarde Conversation Peppol - CashPilot
# =============================================================
# Usage :
#   powershell -File "c:\Github-Desktop\CASHPILOT\Peppol\Context\save-conversation.ps1"
#   ou directement : .\save-conversation.ps1
#
# Cree un fichier conversation_peppol_JJ-MM-AA-HH-MM.md
# dans le dossier Peppol\Context\ avec un squelette pre-rempli.
# =============================================================

$contextDir = "c:\Github-Desktop\CASHPILOT\Peppol\Context"

# Generer le nom du fichier avec date/heure
$now = Get-Date
$timestamp = $now.ToString("dd-MM-yy-HH-mm")
$filename = "conversation_peppol_$timestamp.md"
$filepath = Join-Path $contextDir $filename

# Verifier que le dossier existe
if (-not (Test-Path $contextDir)) {
    New-Item -ItemType Directory -Path $contextDir -Force | Out-Null
    Write-Host "[OK] Dossier cree : $contextDir"
}

# Generer le contenu squelette
$dateFormatted = $now.ToString("dd MMMM yyyy", [System.Globalization.CultureInfo]::GetCultureInfo("fr-FR"))
$timeFormatted = $now.ToString("HH\hmm")

$content = @"
# Conversation Peppol - CashPilot
**Date :** $dateFormatted, $timeFormatted
**Participants :** Utilisateur + Claude (Opus 4.6)
**Raison de sauvegarde :** Compaction imminente / Fin de session

---

## Resume de la session

<!-- Claude : remplir cette section avec un resume de la conversation -->

### Sujets abordes
-

### Decisions prises
-

### Fichiers modifies
| Fichier | Action |
|---------|--------|
|  |  |

### Fichiers analyses
| Fichier | Raison |
|---------|--------|
|  |  |

---

## Contexte pour la prochaine session

### Etat d'avancement Peppol
<!-- Ou en est-on dans le Plan Implementation Peppol.md ? -->
- Phase en cours :
- Prochaine etape :

### Points en suspens
-

### Notes importantes
-

---

## Contenu detaille de la conversation

<!-- Claude : coller ici les echanges importants de la conversation -->

"@

# Ecrire le fichier
Set-Content -Path $filepath -Value $content -Encoding UTF8

Write-Host ""
Write-Host "=============================================="
Write-Host " Conversation Peppol sauvegardee"
Write-Host "=============================================="
Write-Host " Fichier : $filename"
Write-Host " Chemin  : $filepath"
Write-Host " Date    : $dateFormatted $timeFormatted"
Write-Host "=============================================="
Write-Host ""

# Retourner le chemin pour usage par Claude
Write-Output $filepath
