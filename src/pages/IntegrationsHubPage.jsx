import { Helmet } from 'react-helmet';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Bot, Cable, Globe, Puzzle, Webhook } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import ConnectionSettings from '@/components/settings/ConnectionSettings';

const IntegrationsHubPage = () => {
  const { t } = useTranslation();

  const integrationCards = [
    {
      title: t('integrationsHub.cards.api.title'),
      description: t('integrationsHub.cards.api.description'),
      icon: Globe,
      accentClass: 'text-orange-300',
      badge: t('integrationsHub.cards.api.badge'),
    },
    {
      title: t('integrationsHub.cards.ai.title'),
      description: t('integrationsHub.cards.ai.description'),
      icon: Bot,
      accentClass: 'text-cyan-300',
      badge: t('integrationsHub.cards.ai.badge'),
    },
    {
      title: t('integrationsHub.cards.webhooks.title'),
      description: t('integrationsHub.cards.webhooks.description'),
      icon: Webhook,
      accentClass: 'text-emerald-300',
      badge: t('integrationsHub.cards.webhooks.badge'),
    },
    {
      title: t('integrationsHub.cards.recipes.title'),
      description: t('integrationsHub.cards.recipes.description'),
      icon: Puzzle,
      accentClass: 'text-violet-300',
      badge: t('integrationsHub.cards.recipes.badge'),
    },
  ];

  const recipeCards = [
    {
      title: t('integrationsHub.recipes.zapier.title'),
      description: t('integrationsHub.recipes.zapier.description'),
      href: '/app/webhooks',
      cta: t('integrationsHub.recipes.zapier.cta'),
    },
    {
      title: t('integrationsHub.recipes.ai.title'),
      description: t('integrationsHub.recipes.ai.description'),
      href: '/app/settings?tab=connexions',
      cta: t('integrationsHub.recipes.ai.cta'),
    },
    {
      title: t('integrationsHub.recipes.automation.title'),
      description: t('integrationsHub.recipes.automation.description'),
      href: '/app/settings?tab=api',
      cta: t('integrationsHub.recipes.automation.cta'),
    },
  ];

  return (
    <>
      <Helmet>
        <title>{`${t('integrationsHub.badge')} - CashPilot`}</title>
      </Helmet>

      <div className="container mx-auto px-4 py-6 md:px-8 space-y-8 min-h-screen text-white">
        <section className="rounded-3xl border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(45,212,191,0.18),_transparent_30%),linear-gradient(135deg,_rgba(2,6,23,0.98),_rgba(15,23,42,0.96))] p-6 md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3 max-w-3xl">
              <Badge className="bg-white/10 text-cyan-200 border-white/10">{t('integrationsHub.badge')}</Badge>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-cyan-400/10 p-3 ring-1 ring-cyan-300/20">
                  <Cable className="w-7 h-7 text-cyan-300" />
                </div>
                <div>
                  <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">{t('integrationsHub.title')}</h1>
                  <p className="mt-2 text-sm md:text-base text-slate-300">
                    {t('integrationsHub.subtitle')}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button asChild variant="outline" className="border-white/15 bg-white/5 text-white hover:bg-white/10">
                <Link to="/app/webhooks">{t('integrationsHub.viewWebhooks')}</Link>
              </Button>
              <Button asChild className="bg-cyan-500 text-slate-950 hover:bg-cyan-400">
                <Link to="/app/settings?tab=connexions">{t('integrationsHub.manageConnections')}</Link>
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
            <h2 className="text-2xl font-semibold text-white">{t('integrationsHub.readyTitle')}</h2>
            <p className="mt-2 text-sm text-slate-400">
              {t('integrationsHub.readySubtitle')}
            </p>
          </div>
          <ConnectionSettings />
        </section>
      </div>
    </>
  );
};

export default IntegrationsHubPage;
