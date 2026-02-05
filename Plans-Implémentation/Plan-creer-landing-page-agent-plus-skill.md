Plan : Creer Landing-Page-Agent et skill create-landing-page
Objectif
Creer un agent Landing-Page-Agent et son skill create-landing-page qui permet de generer des landing pages avec le meme style visuel que celle de CashPilot (arriere-plan Three.js, animations GSAP, custom cursor, dark theme, gradients amber-green-purple, boutons magnetiques).

Fichiers a creer (2 fichiers)
1. docs/Landing-Page-Agent.md
Definition de l'agent suivant le pattern exact de docs/agent-orchestrateur.md :

Nom : Landing-Page-Agent
Role : Generateur de landing pages premium
Skill : skill-create-landing-page.md
Responsabilites : Collecter les infos du produit, generer les 2 fichiers (JSX + CSS), adapter les couleurs/textes/sections
2. docs/skill-create-landing-page.md
Skill complet suivant le pattern de docs/skill-orchestration-multi-agents.md, contenant :

Les templates JSX et CSS complets (bases sur LandingPage.jsx et landing.css)
Les placeholders parametrables (nom du produit, tagline, couleurs, sections, features, etc.)
Les instructions etape par etape pour l'agent
Le schema de configuration (quelles variables remplacer)
Architecture du skill
Entrees (parametres utilisateur)

- productName: "MonProduit"
- tagline: "La solution pour..."
- description: "Description detaillee..."
- primaryColor: "#8b5cf6" (defaut: purple)
- accentColor: "#f59e0b" (defaut: amber)
- sections: ["hero", "features", "audience", "advantages", "cta", "footer"]
- features: [{ icon, title, description }, ...]
- stats: [{ number, label }, ...]
- ctaText: "Demarrer Gratuitement"
- loginPath: "/login"
- signupPath: "/signup"
- contactEmail: "..."
- contactPhone: "..."
- website: "..."
- companyName: "..."
Sorties (fichiers generes)
LandingPage.jsx - Composant React complet
landing.css - Stylesheet complet (2000+ lignes)
Template base sur le code actuel
Le code de src/pages/LandingPage.jsx (1114 lignes) et src/styles/landing.css (2199 lignes) sont inclus dans le skill comme templates de reference, avec des marqueurs {{PLACEHOLDER}} pour les parties parametrables.

Verification
Les fichiers agents/skills sont bien formates en Markdown
Le skill contient le code JSX et CSS complet comme reference
Les placeholders sont clairement documentes
L'agent peut etre invoque via sa definition
Fichiers de reference
Fichier	Utilite
docs/agent-orchestrateur.md	Pattern de definition d'agent
docs/skill-orchestration-multi-agents.md	Pattern de definition de skill
src/pages/LandingPage.jsx	Template JSX source (1114 lignes)
src/styles/landing.css	Template CSS source (2199 lignes)
User approved the plan

-------

Les 2 fichiers ont ete crees :

1. Landing-Page-Agent.md — Definition de l'agent

Identite, responsabilites, contraintes
Parametres d'entree (obligatoires + optionnels avec defaults)
Architecture visuelle generee (Three.js, GSAP, curseur custom, etc.)
Reference vers le skill
2. skill-create-landing-page.md — Skill complet (~900 lignes)

Phase 1 : Collecte des parametres utilisateur
Phase 2 : Templates JSX + CSS complets (bases sur les 1114 lignes de LandingPage.jsx et 2199 lignes de landing.css)
Phase 3 : Table de remplacement avec 60+ placeholders {{...}} documentes (navigation, hero, sections, CTA, footer, couleurs CSS)
Phase 4 : Checklist de verification (build, responsive, animations)
Sections conditionnelles ({{IF sections.includes("...")}}), dependances npm, exemple d'utilisation
Le skill conserve fidlement tout le style visuel de CashPilot :

Arriere-plan Three.js (2000 particules WebGL + lignes)
Animations GSAP ScrollTrigger + boutons magnetiques elastiques
Curseur custom (follower + dot)
Dark theme avec 24+ CSS variables parametrables
Gradient main (amber -> green -> purple, adaptable)
Responsive 3 breakpoints (1024px, 768px, 480px)