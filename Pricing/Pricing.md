Suggestion : Page /pricing "Premium Glassmorphism"
Probleme actuel
La page pricing actuelle est fonctionnelle mais visuellement plate comparee a la landing page (GSAP, Three.js, cursor follower, gradients animés). Elle utilise des cartes statiques basiques alors que la landing page a un design premium.

3 approches possibles
Approche	Description	Effort
A. Full landing parity	GSAP animations, mesh gradient anime, parallax hover sur cartes	Lourd (~400 lignes CSS/JS)
B. Glassmorphism + micro-interactions (Recommande)	Gradient borders animes CSS, toggle annuel/mensuel, FAQ, trust badges, animations entree	Moyen (~200 lignes)
C. Polish minimal	Meilleur spacing, quelques hovers, pas de nouvelles sections	Leger
Ma recommandation : Approche B
Voici les ameliorations concretes :

Toggle Mensuel / Annuel avec badge "-20%" sur les prix annuels
Cartes glassmorphism avec bordure gradient animee (comme le landing) et glow au hover
Animations d'entree CSS (staggered fade-in des cartes de gauche a droite)
Section FAQ accordeon en bas (questions frequentes sur les credits, remboursement, changement de plan)
Trust badges : "Paiement securise via Stripe", "Conforme RGPD", "Annulation a tout moment"
Meilleur hero : sous-titre avec gradient text + background mesh subtil
Feature comparison table : tableau comparatif des plans avec checkmarks
Le tout en gardant le dark theme #0a0e1a / #0f1528 et les accents orange/amber du design DNA CashPilot.

Voulez-vous que j'implemente cette approche B ? Ou preferez-vous un autre mix des elements proposes ?

Que proposez vous dans les 5 cartes abonnement
Voici ma proposition detaillee pour les 5 cartes :

Structure commune de chaque carte

┌─────────────────────────────┐
│  [Badge: Populaire / etc.]  │
│                             │
│  🔶 Icone + Nom du plan    │
│  "Pour qui c'est ideal"    │
│                             │
│     14,99 € /mois          │
│   (11,99 € /mois annuel)   │
│   = 0,030 €/credit         │
│                             │
│  ───── 500 credits/mois ── │
│                             │
│  ✓ Feature 1               │
│  ✓ Feature 2               │
│  ✓ Feature 3               │
│  ✓ Feature 4               │
│  ✓ Feature 5               │
│  ✗ Feature non incluse     │
│                             │
│  [ S'abonner → ]           │
└─────────────────────────────┘
Les 5 plans en detail
Free	Starter	Pro	Business	Enterprise
Icone	Coins (gris)	Zap (bleu)	Star (orange)	TrendingUp (violet)	Crown (emeraude)
Cible	"Decouvrir CashPilot"	"Freelances & independants"	"PME en croissance"	"Entreprises etablies"	"Grands comptes & groupes"
Prix	Gratuit	3,99 €/mois	14,99 €/mois	34,99 €/mois	89,99 €/mois
Prix annuel	-	3,19 €/mois	11,99 €/mois	27,99 €/mois	71,99 €/mois
Credits/mois	10	100	500	1 500	5 000
Cout/credit	-	0,040 €	0,030 €	0,023 €	0,018 €
Badge	-	-	"Populaire"	-	-
Bordure	gris subtil	bleu subtil	orange glow + ring	violet subtil	emeraude subtil
CTA	"Plan actuel" (disabled)	"S'abonner"	"S'abonner" (orange vif)	"S'abonner"	"Nous contacter"
Features par plan
Free (gris)

✓ 10 credits/mois
✓ Previsualisation HTML
✓ Exports PDF basiques
✗ Etats financiers
✗ Support
Starter (bleu)

✓ 100 credits/mois
✓ Exports PDF
✓ Etats financiers SYSCOHADA
✓ Gestion clients illimitee
✓ Support email
Pro (orange, badge "Populaire")

✓ 500 credits/mois
✓ Tout Starter inclus
✓ Rapports analytiques
✓ Simulations financieres
✓ Tableaux de bord avances
✓ Support prioritaire
Business (violet)

✓ 1 500 credits/mois
✓ Tout Pro inclus
✓ API & Webhooks
✓ Exports comptables (FEC, SAF-T)
✓ Rapprochement bancaire
✓ Multi-devise
Enterprise (emeraude)

✓ 5 000 credits/mois
✓ Tout Business inclus
✓ Peppol e-invoicing
✓ Multi-utilisateurs & roles
✓ Support dedie & onboarding
✓ SLA garanti
Nouveautes visuelles par carte
Ligne "Pour qui" sous le nom — une phrase courte en gris clair qui cible l'audience
Cout par credit affiche sous le prix — montre l'economie progressive
Features barrees sur le plan Free — montre ce qu'on gagne en upgradeant
Toggle mensuel/annuel en haut — les prix annuels affichent un badge "-20%"
Glow anime sur la carte Pro (border gradient orange pulse)
CTA "Nous contacter" sur Enterprise au lieu de checkout direct