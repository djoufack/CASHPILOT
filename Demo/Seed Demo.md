Le seed démo FR / BE / OHADA est en place, les comptes fonctionnent, et le mode d’emploi pour vos démonstrations est prêt dans pilotage-demo-playbook.md.


comment l'utiliser?

Oui. Le plus simple est :

Connectez-vous à https://cashpilot.tech avec l’un des comptes démo :

pilotage.fr.demo@cashpilot.cloud / PilotageFR#2026!

pilotage.be.demo@cashpilot.cloud / PilotageBE#2026!

pilotage.ohada.demo@cashpilot.cloud / PilotageOHADA#2026!

Ouvrez ensuite https://cashpilot.tech/app/pilotage.

Parcourez les 6 onglets dans cet ordre :

Vue d’ensemble
Analyse comptable
Analyse financière
Fiscalité & valorisation
Simulateur
Audit IA
Pour vos démos :

utilisez le compte FR pour montrer la lecture France et la fiscalité FR ;
utilisez le compte BE pour la lecture Belgique ;
utilisez le compte OHADA pour la lecture Afrique francophone / OHADA.
Si vous voulez réinitialiser les données démo plus tard :

aperçu sans écrire : npm run seed:pilotage-demos
réappliquer les données : npm run seed:pilotage-demos:apply
Le guide complet est ici :
pilotage-demo-playbook.md

Le script de seed est ici :
seed-pilotage-demos.mjs

Après vos démonstrations, faites tourner ces mots de passe si l’environnement reste partagé.