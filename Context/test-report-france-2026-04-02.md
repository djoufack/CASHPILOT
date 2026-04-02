# Rapport de test - France (PCG)

Date: 2026-04-02
Compte: pilotage.fr.demo@cashpilot.cloud
Referentiel: PCG

## Couverture

- Modules detectes et testes: 62
- OK: 54
- Partiel: 8
- KO: 0

## Modules en Partiel (anomalies concretes)

- Fournisseurs: erreurs console 400
- Cartographie: CSP bloque les tuiles OpenStreetMap, h1 absent
- Connexions Bancaires: erreurs 401
- Banking integre: erreurs 401
- Produits & Stock: echec WebSocket Supabase realtime
- Scanner: h1 absent
- Rapports: h1 absent
- Portail comptable: erreur 403

## Conclusion

- Navigation globale fonctionnelle
- Aucun module KO
- 8 modules a investiguer en priorite (reseau/CSP/permissions/UI)
