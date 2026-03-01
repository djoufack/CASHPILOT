Voici le modèle Excel demandé (saisie Bilan / Compte de résultat / Cash-flow + calcul automatique des ratios + comparaison à des références par **secteur** et **zone**).

[Télécharger le modèle Excel](sandbox:/mnt/data/Modele_Ratios_Entreprise_FR_BE_OHADA.xlsx)

---

## 1) Contenu du modèle (onglets)

* **Paramètres** : choix *Secteur* (Industrie, Retail, Services, SaaS, Construction) + *Pays/Zone* (Belgique, France, Zone Comptable OHADA)
* **Saisie_Bilan** : N-1 et N (cellules jaunes à remplir)
* **Saisie_CR** : N-1 et N
* **Saisie_CF** : N-1 et N
* **Ratios** : ratios calculés automatiquement + **statut** (OK / Attention / Alerte)
* **Références** : seuils “bas/haut” par ratio, secteur, zone (facilement modifiables)
* **Guide** : rappel d’utilisation + liens sources

---

## 2) Tableau structuré des ratios (description, formule, interprétation, “bon/mauvais”)

> Les formules ci‑dessous utilisent les postes standards : CA, COGS, EBITDA, EBIT, RN, Trésorerie, Créances clients, Stocks, Fournisseurs, Dettes financières CT/LT, Capitaux propres, Actifs/Passifs courants, CFO, Capex, etc.
> Les **références** (seuils bas/haut) sont déjà dans l’onglet **Références** et varient selon secteur/zone.

| Famille     | Ratio                    | Formule (standard)                            | Lecture du résultat                               | Signal santé                                                         |
| ----------- | ------------------------ | --------------------------------------------- | ------------------------------------------------- | -------------------------------------------------------------------- |
| Marges      | Marge brute              | (CA − COGS) / CA                              | Pouvoir de pricing + structure de coûts directs   | ↑ positif, ↓ pression concurrentielle/coûts                          |
| Marges      | Marge EBITDA             | EBITDA / CA                                   | Performance opérationnelle “avant amortissements” | ↑ positif (attention à la qualité du CA)                             |
| Marges      | Marge EBIT               | EBIT / CA                                     | Rentabilité après amortissements                  | ↑ positif, ↓ base d’actifs lourde / coûts fixes                      |
| Marges      | Marge nette              | RN / CA                                       | Profit final après financier + impôts             | ↑ positif, ↓ risque de modèle non rentable                           |
| Croissance  | Croissance CA            | (CA_N − CA_N−1) / CA_N−1                      | Dynamique commerciale                             | ↑ positif si rentable, ↓ possible perte de parts                     |
| Croissance  | Croissance RN            | (RN_N − RN_N−1) / |RN_N−1|                    | Dynamique de profit                               | ↑ positif, mais volatil si RN_N−1 faible                             |
| BFR         | Jours de stocks          | Stocks moyens / COGS × 365                    | Vitesse de rotation des stocks                    | ↓ positif (sauf risque de rupture)                                   |
| BFR         | DSO (jours clients)      | Créances moyennes / CA × 365                  | Rapidité d’encaissement                           | ↓ positif, ↑ risque impayés/tension cash                             |
| BFR         | DPO (jours fournisseurs) | Fournisseurs moyens / Achats(ou COGS) × 365   | Crédit fournisseurs                               | “Trop bas” = cash consommé; “trop haut” = tension/risque fournisseur |
| BFR         | CCC (cycle cash)         | DSO + Jours stocks − DPO                      | Temps de conversion en cash                       | ↓ positif (voire négatif en retail)                                  |
| BFR         | BFR / CA                 | (Stocks + Créances − Fournisseurs) / CA       | Intensité du besoin en fonds de roulement         | ↓ positif (attention sous‑investissement / litiges)                  |
| Liquidité   | Current ratio            | Actifs courants / Passifs courants            | Couverture du court terme                         | <1 alerte; trop haut = capital immobilisé                            |
| Liquidité   | Quick ratio              | (Actifs courants − Stocks) / Passifs courants | Liquidité sans dépendre des stocks                | ↑ positif (à secteur comparable)                                     |
| Liquidité   | Cash ratio               | Trésorerie / Passifs courants                 | Liquidité immédiate                               | ↑ positif (mais excès = cash “dormant”)                              |
| Structure   | Autonomie financière     | Capitaux propres / Total bilan                | Solidité financière                               | ↑ positif, ↓ dépendance aux dettes                                   |
| Structure   | Gearing                  | Dette nette / Capitaux propres                | Levier net                                        | ↓ positif; >1–2 souvent plus risqué (selon secteur)                  |
| Endettement | Dette nette / EBITDA     | Dette nette / EBITDA                          | Années d’EBITDA “théoriques” pour rembourser      | ↓ positif; trop haut = risque de refinancement                       |
| Endettement | Dette / Capitaux propres | (Dettes financières CT+LT) / CP               | Levier brut                                       | ↓ positif; attention si CP faibles                                   |
| Couverture  | Couverture intérêts      | EBIT / Charges d’intérêts                     | Capacité à payer les intérêts                     | >2–3 rassurant; <1 alerte                                            |
| Couverture  | DSCR                     | (CFO + Capex) / (Principal + intérêts cash)   | Capacité à servir la dette en cash                | >1 requis; >1,2–1,5 confortable (selon secteur)                      |
| Cash        | CFO / RN                 | CFO / RN                                      | Qualité du résultat (conversion en cash)          | ≈1 normal; <<1 = besoin de comprendre                                |
| Rentabilité | ROA                      | RN / Actifs moyens                            | Rendement des actifs                              | ↑ positif (attention effets de levier)                               |
| Rentabilité | ROE                      | RN / CP moyens                                | Rendement des capitaux propres                    | ↑ positif; trop haut peut signaler sur‑levier                        |
| Rentabilité | ROCE                     | EBIT / Capital engagé moyen                   | Rendement du capital opérationnel                 | ↑ positif; à comparer au coût du capital                             |

---

## 3) “Références normales” : comment j’ai géré Secteur × Zone (FR / BE / OHADA)

### A) Secteurs (Industrie, Retail, Services, SaaS, Construction)

* Le modèle applique des **fourchettes différentes** selon secteur (marges, BFR, leverage, liquidité).
* Ces repères sont **génériques** (bon point de départ) et s’inspirent des ordres de grandeur observés par secteur (ex. données de marges par industrie publiées par Damodaran). ([Stern Business School Pages][1])

### B) France

* Pour des références “officielles” très fines, vous pouvez remplacer les seuils par les **médianes/quartiles** des *Fascicules d’indicateurs sectoriels* (Banque de France, FIBEN : 30 ratios par secteur). ([Banque de France][2])
* Délais de paiement inter‑entreprises : cadre 45 j fin de mois ou 60 j (selon conditions), utile pour calibrer DSO/DPO. ([Service Public Entreprendre][3])

### C) Belgique

* La Banque Nationale de Belgique (Central Balance Sheet Office) met à disposition des statistiques/ratios par secteur (NBB.Stat) : parfait pour “remplacer” les seuils génériques. ([NBB][4])
* Délais de paiement B2B : base légale 30 jours, généralement plafonné à 60 jours (cadre pratique/usages). ([Justice Belgium][5])

### D) Zone Comptable OHADA

* Le modèle contient des repères **prudents** (notamment sur DSO/CCC), mais l’idéal est de calibrer via comparables locaux/banques/secteur.
* Référence comptable : SYSCOHADA révisé / droit comptable et information financière (cadre de présentation, pas des “normes de ratios”). ([OHADA][6])

### E) Point commun UE (utile pour FR/BE)

* La directive UE sur les retards de paiement encadre les pratiques (repère “max ~60 jours” en B2B, avec exceptions/conditions), ce qui aide à donner du sens aux DSO/DPO. ([EUR-Lex][7])

---

## 4) Suggestions d’amélioration (faciles à ajouter au modèle)

### Ratios “plus avancés” (selon secteur)

* **SaaS** : churn, NRR/GRR, CAC payback, LTV/CAC, Rule of 40
* **Retail** : like-for-like sales, taux de démarque, rotation par catégorie, marge contributive
* **Construction** : carnet de commandes, % avancement (WIP), cautions/retentions, sinistralité
* **Tous secteurs** : ROIC vs WACC (si vous avez le coût du capital), marge contributive par segment, sensibilité (prix/volume/coûts)

### Qualité & risques (diagnostic)

* “**Pont** RN → CFO” (variation BFR, provisions, non-cash)
* Indicateurs d’alerte : **CP négatifs**, ICR < 1, DSCR < 1, CCC qui dérive, hausse DSO

---

## 5) Questions pertinentes (et réponses)

### “Quels ratios regarder en priorité ?”

* **TPE/PME** : Trésorerie, CCC (DSO/DPO/stocks), Current/Quick, Dette nette/EBITDA, ICR, DSCR.
* **Croissance** : CA + marge EBITDA (croissance rentable), CFO/RN (qualité).
* **Risque** : CP/Total bilan, CP négatifs, covenants (si dette bancaire).

### “Comment remplacer les références génériques par des références ‘marché’ ?”

1. Gardez Secteur + Zone dans **Paramètres**
2. Allez sur **Références**
3. Filtrez (Zone, Secteur), puis remplacez **Bas/Haut** par vos médianes/quartiles (BdF pour France, NBB pour Belgique, comparables locaux pour OHADA). ([Banque de France][2])

### “Un ratio est en alerte : je fais quoi ?”

* **BFR en dérive (DSO↑ / stocks↑)** : actions recouvrement, politique d’acompte, réduction stocks, revue litiges.
* **Levier trop haut (Dette nette/EBITDA↑)** : plan de désendettement, capex ciblé, renégociation maturités, amélioration marge.
* **Liquidité faible (Current/Quick↓)** : sécuriser cash, lignes CT, réduire cycle cash, prioriser marges/cash over croissance.

---

Si vous me donnez un mini-exemple (quelques chiffres de bilan/CR/CF), je peux aussi **interpréter les ratios** et proposer un plan d’actions concret (BFR, marge, dette) à partir de votre cas.

[1]: https://pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/margin.html?utm_source=chatgpt.com "Operating and Net Margins"
[2]: https://www.banque-france.fr/fr/publications-et-statistiques/statistiques/fascicules-dindicateurs-sectoriels "https://www.banque-france.fr/fr/publications-et-statistiques/statistiques/fascicules-dindicateurs-sectoriels"
[3]: https://entreprendre.service-public.gouv.fr/vosdroits/F23211 "https://entreprendre.service-public.gouv.fr/vosdroits/F23211"
[4]: https://www.nbb.be/en/central-balance-sheet-office/consultation/statistics-annual-accounts-nbbstat "https://www.nbb.be/en/central-balance-sheet-office/consultation/statistics-annual-accounts-nbbstat"
[5]: https://justice.belgium.be/fr/nouvelles/communiques_de_presse/lutte_contre_le_retard_de_paiement_dans_les_transactions_0 "https://justice.belgium.be/fr/nouvelles/communiques_de_presse/lutte_contre_le_retard_de_paiement_dans_les_transactions_0"
[6]: https://www.ohada.org/en/ohada-accounting-law/ "https://www.ohada.org/en/ohada-accounting-law/"
[7]: https://eur-lex.europa.eu/EN/legal-content/summary/combating-late-payment-in-business-dealings.html "https://eur-lex.europa.eu/EN/legal-content/summary/combating-late-payment-in-business-dealings.html"
