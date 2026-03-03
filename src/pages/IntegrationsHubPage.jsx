import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { Bot, Cable, Globe, Puzzle, Webhook } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ConnectionSettings from '@/components/settings/ConnectionSettings';

const integrationCards = [
  {
    title: 'REST API',
    description: 'Clés API, endpoints HTTP et scripts pour connecter CashPilot à vos outils métier.',
    icon: Globe,
    accentClass: 'text-orange-300',
    badge: 'Disponible',
  },
  {
    title: 'MCP & assistants IA',
    description: 'Connexion native pour ChatGPT, Claude, Cursor et les agents IA orientés outils.',
    icon: Bot,
    accentClass: 'text-cyan-300',
    badge: 'IA',
  },
  {
    title: 'Webhooks signés',
    description: 'Déclencheurs sortants sécurisés pour orchestrer Zapier, Make, n8n ou vos workers.',
    icon: Webhook,
    accentClass: 'text-emerald-300',
    badge: 'Automatisation',
  },
  {
    title: 'Recettes d’intégration',
    description: 'Points d’entrée prêts pour CRM, notifications, rapprochement ou reporting externe.',
    icon: Puzzle,
    accentClass: 'text-violet-300',
    badge: 'Playbooks',
  },
];

const recipeCards = [
  {
    title: 'Zapier / Make',
    description: 'Déclenchez vos workflows à la création d’une facture, d’un devis signé ou d’un paiement.',
    href: '/app/webhooks',
    cta: 'Configurer les webhooks',
  },
  {
    title: 'ChatGPT / Claude',
    description: 'Exposez les opérations CashPilot à un assistant IA via MCP ou API key.',
    href: '/app/settings?tab=connexions',
    cta: 'Gérer les connexions',
  },
  {
    title: 'n8n / scripts métier',
    description: 'Pilotez vos automatisations internes avec l’API REST et les événements signés.',
    href: '/app/settings?tab=api',
    cta: 'Créer une clé API',
  },
];

const IntegrationsHubPage = () => {
  return (
    <>
      <Helmet>
        <title>Hub intégrations - CashPilot</title>
      </Helmet>

      <div className="container mx-auto px-4 py-6 md:px-8 space-y-8 min-h-screen text-white">
        <section className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.18),_transparent_30%),linear-gradient(135deg,_rgba(2,6,23,0.98),_rgba(15,23,42,0.96))] p-6 md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3 max-w-3xl">
              <Badge className="bg-white/10 text-cyan-200 border-white/10">Hub intégrations</Badge>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-cyan-400/10 p-3 ring-1 ring-cyan-300/20">
                  <Cable className="w-7 h-7 text-cyan-300" />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">Connecter CashPilot à votre écosystème</h1>
                  <p className="mt-2 text-sm md:text-base text-slate-300">
                    API, MCP, webhooks et recettes d’automatisation au même endroit pour rendre l’ouverture produit visible et exploitable.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                <Link to="/app/webhooks">Voir les webhooks</Link>
              </Button>
              <Button asChild className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
                <Link to="/app/settings?tab=connexions">Gérer les connexions</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {integrationCards.map((card) => {
            const Icon = card.icon;
            return (
              <Card key={card.title} className="border-white/10 bg-slate-950/70 backdrop-blur">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                      <Icon className={`w-5 h-5 ${card.accentClass}`} />
                    </div>
                    <Badge className="bg-white/10 text-slate-200 border-white/10">{card.badge}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardTitle className="text-white text-lg">{card.title}</CardTitle>
                  <p className="mt-3 text-sm text-slate-400">{card.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          {recipeCards.map((recipe) => (
            <Card key={recipe.title} className="border-white/10 bg-slate-950/70 backdrop-blur">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Puzzle className="w-4 h-4 text-orange-300" />
                  {recipe.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-slate-400">{recipe.description}</p>
                <Button asChild variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                  <Link to={recipe.href}>{recipe.cta}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </section>

        <section className="space-y-4">
          <div>
            <h2 className="text-2xl font-semibold text-white">Connexions prêtes à l’emploi</h2>
            <p className="mt-2 text-sm text-slate-400">
              Le socle d’ouverture produit est centralisé ici: clés API, MCP pour assistants IA et raccordement applicatif.
            </p>
          </div>
          <ConnectionSettings />
        </section>
      </div>
    </>
  );
};

export default IntegrationsHubPage;
