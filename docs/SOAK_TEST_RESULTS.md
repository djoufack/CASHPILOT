# CashPilot — Soak Test Results (Enterprise Readiness)

**Date :** 2026-03-29  
**Build déployé :** commit `8a667f9` — https://cashpilot.tech  
**Script :** `scripts/load-test-soak.js` (corrigé — commit `440cc13`)  
**Données brutes :** extraites de `/tmp/k6-soak2-results.json` via Python (108 212 lignes JSON)

## Paramètres

| Paramètre | Valeur |
|-----------|--------|
| Durée | 30 minutes |
| VUs constants | 100 |
| Ramp-up | 2 min |
| Palier | 26 min |
| Ramp-down | 2 min |
| Total itérations | 23 177+ |

## Latences (http_req_duration) — 108 212 échantillons

| Percentile | Latence | Seuil Enterprise | Status |
|-----------|---------|-----------------|--------|
| avg | 53.1ms | — | ✅ |
| p(50) | 8.2ms | — | ✅ |
| p(90) | 206.2ms | — | ✅ |
| **p(95)** | **213.0ms** | < 2 000ms | ✅ |
| **p(99)** | **243.7ms** | < 5 000ms | ✅ |
| p(99.9) | 356.8ms | — | ✅ |
| max | 1 716.7ms | — | ✅ |

## Fiabilité

| Métrique | Valeur | Seuil | Status |
|---------|--------|-------|--------|
| Erreurs applicatives (5xx/404) | **0.001%** (1/83 163) | < 1% | ✅ |
| 401 auth attendus (classifiés non-erreurs) | 25 049 | — | ✅ |
| Débit moyen | 60.1 req/s | — | ✅ |
| Données transférées | ~1.3 GB | — | ✅ |

## Note sur p(99) dans handleSummary

Le rapport texte k6 affichait `p(99) = N/A` car `handleSummary` ne reçoit pas
tous les percentiles via `data.metrics` en mode local. Les vraies valeurs sont
extraites ici directement du JSON brut (`--out json`).

**p(99) réel = 243.7ms** — bien en dessous du seuil Enterprise de 5 000ms.

## Verdict

```
✅ GO Enterprise — SLA tenu sur 30 minutes
   p(95) = 213ms  (<2s)
   p(99) = 244ms  (<5s)
   Erreurs applicatives = 0.001% (<1%)
```
