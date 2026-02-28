Plan : Cash Flow hebdomadaire avec toggle Mois/Semaine
Contexte
Le graphique Cash Flow affiche actuellement les donnees par mois (2025-08, 2025-09, etc.). L'utilisateur veut une granularite plus fine : subdiviser chaque mois en semaines (S1, S2, S3, S4) avec un toggle pour basculer entre vue mensuelle et hebdomadaire.

Fichiers a modifier
src/hooks/useCashFlow.js — ajouter le groupement par semaine
src/pages/Dashboard.jsx — ajouter le toggle et adapter le chart
Implementation
Etape 1 : useCashFlow.js — support weekly grouping
Ajouter un parametre granularity ('month' | 'week') au hook :

Mode month (existant) : grouper par YYYY-MM comme actuellement
Mode week : grouper par YYYY-MM-SN (ex: 2025-10-S1, 2025-10-S2)
S1 = jours 1-7, S2 = 8-14, S3 = 15-21, S4 = 22-fin du mois
Extraire la semaine depuis la date : Math.ceil(day / 7) (cap a 4)
Changements concrets :

Ajouter granularity en parametre du hook (default: 'month')
Fonction getGroupKey(dateStr, granularity) qui retourne la cle de groupement
Fonction buildEmptyBuckets(periodMonths, granularity) qui genere les buckets vides
Le label X-axis : Oct S1, Oct S2 etc. en mode semaine vs 2025-10 en mode mois
Ajouter un champ label dans chaque data point pour un affichage plus lisible
Etape 2 : Dashboard.jsx — toggle + chart adapte
Ajouter un toggle au-dessus du graphique Cash Flow :

Utiliser le pattern PeriodSelector.jsx (button group ghost avec orange active)
2 boutons : Mois | Semaines
State local : const [cfGranularity, setCfGranularity] = useState('month')
Passer cfGranularity au hook : useCashFlow(6, cfGranularity)
Le chart utilise dataKey="label" au lieu de "month" pour le XAxis
Reduire la fontSize du XAxis a 9 en mode semaine (plus de labels)
Etape 3 : Formatage compact des axes Y
Les axes Y du Cash Flow montrent actuellement 38000000. Appliquer le format compact :

tickFormatter sur YAxis : (val) => formatCompactCurrency(val, cc).replace(symbol, '') pour afficher 38M au lieu de 38000000
Reutiliser formatCompactCurrency de currencyService.js (deja importe dans Dashboard)
Verification
npm run build — zero erreurs
Deployer sur Vercel
Verifier visuellement : toggle Mois/Semaines fonctionne, les donnees changent de granularite
Verifier que le tooltip custom affiche toujours Income/Expenses/Net correctement
Verifier que l'axe Y affiche des labels compacts (38M au lieu de 38000000)