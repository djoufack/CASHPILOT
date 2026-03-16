import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createAuthClient, createServiceClient, HttpError, requireAuthenticatedUser } from '../_shared/billing.ts';
import { SECURITY_HEADERS } from '../_shared/securityHeaders.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('APP_ORIGIN') ?? 'https://cashpilot.tech',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  ...SECURITY_HEADERS,
};

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Simulated regulatory update templates per country.
 * In production this would be replaced by real scraping / RSS / API integration.
 */
const REGULATORY_SOURCES: Record<
  string,
  Array<{
    domain: string;
    title: string;
    summary: string;
    source_url: string;
    severity: string;
    effective_date_offset_days: number;
  }>
> = {
  FR: [
    {
      domain: 'tax',
      title: 'Modification du taux de TVA pour les services numeriques',
      summary:
        'Le taux de TVA applicable aux services numeriques passe de 20% a 19.6% a compter du prochain trimestre. Les entreprises doivent mettre a jour leurs systemes de facturation.',
      source_url: 'https://www.legifrance.gouv.fr',
      severity: 'warning',
      effective_date_offset_days: 45,
    },
    {
      domain: 'labor',
      title: 'Nouvelle obligation de declaration des heures supplementaires',
      summary:
        'Les employeurs doivent desormais declarer mensuellement les heures supplementaires via la DSN. Penalite de 750 EUR par salarie en cas de non-conformite.',
      source_url: 'https://www.urssaf.fr',
      severity: 'critical',
      effective_date_offset_days: 30,
    },
    {
      domain: 'accounting',
      title: 'Mise a jour des normes IFRS 17 pour les assurances',
      summary:
        "Application obligatoire des normes IFRS 17 pour les contrats d'assurance. Impact sur la presentation des etats financiers.",
      source_url: 'https://www.anc.gouv.fr',
      severity: 'info',
      effective_date_offset_days: 90,
    },
    {
      domain: 'corporate',
      title: 'Reforme du code de gouvernance des entreprises',
      summary:
        'Nouvelles obligations de transparence pour les societes de plus de 250 salaries. Rapport ESG obligatoire.',
      source_url: 'https://www.economie.gouv.fr',
      severity: 'warning',
      effective_date_offset_days: 60,
    },
  ],
  SN: [
    {
      domain: 'tax',
      title: "Revision du bareme de l'impot sur les societes",
      summary:
        "Le taux d'IS passe de 30% a 28% pour les PME dont le chiffre d'affaires est inferieur a 500 millions FCFA.",
      source_url: 'https://www.impotsetdomaines.gouv.sn',
      severity: 'warning',
      effective_date_offset_days: 30,
    },
    {
      domain: 'accounting',
      title: 'Obligation de conformite SYSCOHADA revise',
      summary:
        "Toutes les entreprises doivent adopter le plan comptable SYSCOHADA revise avant la cloture de l'exercice.",
      source_url: 'https://www.ohada.com',
      severity: 'critical',
      effective_date_offset_days: 60,
    },
    {
      domain: 'labor',
      title: 'Augmentation du SMIG',
      summary:
        'Le salaire minimum interprofessionnel garanti passe a 65 000 FCFA. Mise en conformite des bulletins de paie requise.',
      source_url: 'https://www.travail.gouv.sn',
      severity: 'warning',
      effective_date_offset_days: 15,
    },
  ],
  CI: [
    {
      domain: 'tax',
      title: 'Nouvelle taxe sur les services digitaux',
      summary:
        "Introduction d'une taxe de 3% sur les revenus des services digitaux pour les entreprises dont le CA digital depasse 100 millions FCFA.",
      source_url: 'https://www.dgi.gouv.ci',
      severity: 'critical',
      effective_date_offset_days: 45,
    },
    {
      domain: 'corporate',
      title: 'Reforme du registre du commerce et du credit mobilier',
      summary: 'Digitalisation obligatoire du RCCM. Tous les actes doivent etre deposes en ligne.',
      source_url: 'https://www.justice.gouv.ci',
      severity: 'info',
      effective_date_offset_days: 90,
    },
  ],
  CM: [
    {
      domain: 'tax',
      title: "Reforme de la TVA : extension de l'assiette",
      summary:
        "Extension de l'assiette de la TVA aux services de transport interurbain et aux prestations de formation professionnelle.",
      source_url: 'https://www.impots.cm',
      severity: 'warning',
      effective_date_offset_days: 30,
    },
    {
      domain: 'labor',
      title: 'Convention collective nationale revisee',
      summary: 'Revision des grilles salariales sectorielles. Les employeurs ont 90 jours pour se conformer.',
      source_url: 'https://www.mintss.cm',
      severity: 'warning',
      effective_date_offset_days: 90,
    },
  ],
  MA: [
    {
      domain: 'tax',
      title: 'Loi de finances : nouveau regime simplifie',
      summary: "Introduction d'un regime simplifie pour les auto-entrepreneurs avec un plafond de CA de 500 000 MAD.",
      source_url: 'https://www.tax.gov.ma',
      severity: 'info',
      effective_date_offset_days: 60,
    },
    {
      domain: 'accounting',
      title: 'Obligation de facturation electronique',
      summary:
        'La facturation electronique devient obligatoire pour les entreprises assujetties a la TVA a compter du prochain exercice.',
      source_url: 'https://www.finances.gov.ma',
      severity: 'critical',
      effective_date_offset_days: 120,
    },
  ],
};

/** Default fallback for countries not yet mapped */
const DEFAULT_UPDATES = [
  {
    domain: 'tax',
    title: 'General Tax Update',
    summary:
      'A general tax regulatory update has been detected for your monitored jurisdiction. Please review the source for details.',
    source_url: 'https://www.oecd.org/tax/',
    severity: 'info',
    effective_date_offset_days: 60,
  },
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const user = await requireAuthenticatedUser(req);
    const authHeader = req.headers.get('Authorization') || '';
    const supabase = createAuthClient(authHeader);

    const body = await req.json();
    const { company_id, country_code } = body;

    // Validate inputs
    if (!company_id || typeof company_id !== 'string' || !UUID_REGEX.test(company_id)) {
      throw new HttpError(400, 'Invalid or missing company_id');
    }
    if (!country_code || typeof country_code !== 'string' || country_code.length < 2) {
      throw new HttpError(400, 'Invalid or missing country_code');
    }

    const normalizedCountry = country_code.toUpperCase().trim();

    // Verify company ownership
    const { data: company, error: companyError } = await supabase
      .from('company')
      .select('id')
      .eq('id', company_id)
      .eq('user_id', user.id)
      .maybeSingle();

    if (companyError || !company) {
      throw new HttpError(403, 'Company not found or access denied');
    }

    // Get the simulated updates for this country
    const templates = REGULATORY_SOURCES[normalizedCountry] || DEFAULT_UPDATES;

    // Check for active subscription to determine domains
    const { data: subscription } = await supabase
      .from('regulatory_subscriptions')
      .select('domains, is_active')
      .eq('company_id', company_id)
      .eq('country_code', normalizedCountry)
      .maybeSingle();

    const activeDomains = subscription?.is_active
      ? subscription.domains || ['tax', 'labor', 'accounting', 'corporate']
      : ['tax', 'labor', 'accounting', 'corporate'];

    // Filter by subscribed domains
    const filteredTemplates = templates.filter((t) => activeDomains.includes(t.domain));

    // Build and insert updates (avoid duplicates by checking title+company+country)
    const inserted: Array<Record<string, unknown>> = [];

    for (const tpl of filteredTemplates) {
      // Check for existing duplicate
      const { data: existing } = await supabase
        .from('regulatory_updates')
        .select('id')
        .eq('company_id', company_id)
        .eq('country_code', normalizedCountry)
        .eq('title', tpl.title)
        .maybeSingle();

      if (existing) continue;

      const effectiveDate = new Date();
      effectiveDate.setDate(effectiveDate.getDate() + tpl.effective_date_offset_days);

      const record = {
        user_id: user.id,
        company_id,
        country_code: normalizedCountry,
        domain: tpl.domain,
        title: tpl.title,
        summary: tpl.summary,
        source_url: tpl.source_url,
        effective_date: effectiveDate.toISOString().split('T')[0],
        severity: tpl.severity,
        status: 'new',
      };

      const { data: insertedRow, error: insertError } = await supabase
        .from('regulatory_updates')
        .insert(record)
        .select()
        .single();

      if (insertError) {
        console.error('Insert error:', insertError);
        continue;
      }

      inserted.push(insertedRow);

      // Auto-generate compliance checklist items for warning/critical updates
      if (tpl.severity === 'warning' || tpl.severity === 'critical') {
        const checklistItems = generateChecklistItems(tpl.domain, tpl.title);
        for (const actionText of checklistItems) {
          await supabase.from('compliance_checklists').insert({
            user_id: user.id,
            company_id,
            update_id: insertedRow.id,
            action_text: actionText,
            is_completed: false,
            due_date: effectiveDate.toISOString().split('T')[0],
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        country_code: normalizedCountry,
        updates_created: inserted.length,
        updates: inserted,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 500;
    const message = err instanceof Error ? err.message : 'Internal server error';

    return new Response(JSON.stringify({ error: message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status,
    });
  }
});

/**
 * Generate compliance checklist items based on the domain and title.
 * In production this could be AI-generated. For now, domain-based templates.
 */
function generateChecklistItems(domain: string, _title: string): string[] {
  switch (domain) {
    case 'tax':
      return [
        "Verifier l'impact sur la facturation en cours",
        'Mettre a jour les taux dans le systeme comptable',
        'Informer le cabinet comptable',
        'Planifier un audit de conformite',
      ];
    case 'labor':
      return [
        'Verifier la conformite des contrats de travail',
        'Mettre a jour les bulletins de paie',
        'Informer le service RH',
        'Former les managers sur les nouvelles obligations',
      ];
    case 'accounting':
      return [
        "Evaluer l'impact sur les etats financiers",
        'Mettre a jour le plan comptable',
        "Informer l'expert-comptable",
        'Planifier la migration des ecritures',
      ];
    case 'corporate':
      return [
        'Verifier les statuts de la societe',
        'Mettre a jour les registres legaux',
        'Convoquer une assemblee si necessaire',
        'Informer les administrateurs',
      ];
    default:
      return ["Evaluer l'impact reglementaire", 'Planifier la mise en conformite'];
  }
}
