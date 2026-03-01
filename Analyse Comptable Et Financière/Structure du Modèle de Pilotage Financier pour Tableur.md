Structure du Modèle de Pilotage Financier (Excel/Tableur)

Ce document détaille l'organisation des onglets et les formules à copier dans votre tableur pour une analyse automatisée.

Onglet 1 : Paramétrage (Settings)

Définissez ici les variables globales pour les calculs.

Cellule

Description

Valeurs Possibles

B2

Zone Géographique

France / Belgique / Zone OHADA

B3

Secteur d'Activité

Industrie / Retail / Services / SaaS / Construction

B4

Taux IS Standard

=SI(B2="Zone OHADA"; 0,28; 0,25)

B5

Taux IS Réduit PME

=SI(B2="France"; 0,15; SI(B2="Belgique"; 0,20; 0))

B6

Plafond IS Réduit

=SI(B2="France"; 42500; SI(B2="Belgique"; 100000; 0))

Onglet 2 : Saisie des Données (Données_Brutes)

A. Compte de Résultat

Réf

Poste

Année N

Année N-1

P1

Chiffre d'Affaires (HT)

[Saisie]

[Saisie]

P2

Achats consommés

[Saisie]

[Saisie]

P3

Charges de Personnel

[Saisie]

[Saisie]

P4

Autres Charges Externes

[Saisie]

[Saisie]

P5

Impôts et Taxes (hors IS)

[Saisie]

[Saisie]

P6

Dotations aux Amortissements

[Saisie]

[Saisie]

P7

Charges Financières (Intérêts)

[Saisie]

[Saisie]

P8

Dépenses R&D Éligibles

[Saisie]

[Saisie]

B. Bilan

Réf

Poste

Valeur Actuelle

Valeur N-1

B1

Actif Immobilisé Net

[Saisie]

[Saisie]

B2

Stocks

[Saisie]

[Saisie]

B3

Créances Clients

[Saisie]

[Saisie]

B4

Trésorerie & Équivalents

[Saisie]

[Saisie]

B5

Capitaux Propres

[Saisie]

[Saisie]

B6

Dettes Financières (LMT)

[Saisie]

[Saisie]

B7

Dettes Fournisseurs

[Saisie]

[Saisie]

Onglet 3 : Calculs Automatisés (Moteur)

1. Résultats Intermédiaires

EBITDA : =P1 - P2 - P3 - P4 - P5

EBIT (REX) : =EBITDA - P6

Résultat Avant Impôt (RCAI) : =EBIT - P7

2. Fiscalité & Incitations

Impôt (IS) théorique : =MIN(RCAI; Plafond_IS)*Taux_Réduit + MAX(0; RCAI-Plafond_IS)*Taux_Standard

Impôt Minimum (OHADA) : =SI(B2="Zone OHADA"; P1 * 0,005; 0)

IS Final : =MAX(IS_Théorique; Impôt_Minimum)

Crédit d'Impôt (CIR/CII) : =SI(B2="France"; P8 * 0,30; SI(B2="Belgique"; P8 * 0,15; 0))

Résultat Net : =RCAI - IS_Final + Crédit_Impôt

Onglet 4 : Tableau de Bord des Ratios

Famille

Ratio

Formule

Référence Normale

Rentabilité

Marge Net %

Résultat Net / CA

5% à 15% selon secteur

Rentabilité

ROE

Résultat Net / B5

> 10% (Cible 15%)

Structure

Indépendance

B5 / Total_Bilan

> 25%

Structure

Gearing

B6 / B5

< 1,0 (Idéal 0,5)

Activité

DSO (Clients)

(B3 / (P1*1,2)) * 360

< 60 jours (France LME)

Activité

Rotation Stock

(B2 / P2) * 360

Variable (Retail < 30j)

Liquidité

Liquidité Générale

(B2+B3+B4) / (B7+Dettes_Fiscales)

> 1,2

Onglet 5 : Valorisation & Flux (Output Final)

A. Flux de Trésorerie (Méthode Indirecte)

Capacité d'Autofinancement (CAF) : Résultat Net + Amortissements - Crédit_Impôt_Non_Encaissé

Variation BFR : Varia_Stocks + Varia_Clients - Varia_Fournisseurs

Flux de Trésorerie d'Exploitation (FTE) : CAF - Varia_BFR

B. Valorisation

Approche Multiples : EBITDA * Multiple_Sectoriel (Multiples : SaaS 10x, Industrie 6x)

Approche DCF : FTE_Projeté / (WACC - Croissance)

WACC Europe : 9%

WACC OHADA : 18% (Risque pays + inflation)