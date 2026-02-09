Compaction Watcher Global - Installé
3 fichiers créés/modifiés :

Fichier	Rôle
C:\Users\user\.claude\CLAUDE.md	Instructions globales chargées dans tous vos projets Claude Code
C:\Users\user\.claude\scripts\save-conversation.ps1	Script universel de sauvegarde (détecte le projet automatiquement)
C:\Github-Desktop\CASHPILOT\CLAUDE.md	Nettoyé - la logique compaction Peppol-spécifique est retirée
Comment ça fonctionne
Automatique - Le CLAUDE.md global est chargé à chaque session Claude Code, quel que soit le projet. Claude surveillera la compaction et sauvegardera proactivement.

Manuel - Vous ou Claude pouvez lancer à tout moment :


powershell -File "C:\Users\user\.claude\scripts\save-conversation.ps1" -Topic "mon_sujet"
Les fichiers sont sauvegardés dans <racine_du_projet>/Context/ avec le format conversation_<sujet>_JJ-MM-AA-HH-MM.md.

Ceci s'applique maintenant à CashPilot, HIPM, ScamGuard, et tout futur projet.