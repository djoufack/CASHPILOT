# Rapport de test - OHADA (SYSCOHADA)

Date: 2026-04-02
Compte: pilotage.ohada.demo@cashpilot.cloud
Referentiel: SYSCOHADA

## Couverture

- Modules detectes et testes: 65
- OK: 35
- Partiel: 30
- KO: 0

## Notes importantes

- Les modules supplementaires SYSCOHADA sont presents et ouvrent correctement:
  - Bilan SYSCOHADA
  - Resultat SYSCOHADA
  - TAFIRE
- Une partie des statuts Partiel provient de pages chargees avec donnees/configuration incomplètes (classification conservative), sans blocage de navigation.

## Anomalies techniques concretes relevees

- Fournisseurs: erreurs console 400
- Cartographie: warnings CSP sur tuiles OSM
- Banner WebGL au pre-login (non bloquant apres authentification)

## Conclusion

- Navigation globale fonctionnelle
- Aucun module KO
- Compte OHADA expose bien les modules specifiques SYSCOHADA
