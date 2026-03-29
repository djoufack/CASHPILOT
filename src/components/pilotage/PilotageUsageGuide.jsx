import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  AlertTriangle,
  BookOpenText,
  Database,
  LineChart,
  ShieldCheck,
} from 'lucide-react';

const SECTION_ICONS = {
  functioning: LineChart,
  data: Database,
  conditions: ShieldCheck,
  limits: AlertTriangle,
};

const STATUS_TONE = {
  ready: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  warning: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  blocked: 'border-red-500/30 bg-red-500/10 text-red-200',
  empty: 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  setup: 'border-gray-700 bg-gray-900/70 text-gray-200',
};

const VALUATION_TONE = {
  full: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200',
  'multiples-only': 'border-amber-500/30 bg-amber-500/10 text-amber-200',
  unavailable: 'border-gray-700 bg-gray-900/70 text-gray-200',
};

const PilotageUsageGuide = ({ data }) => {
  const { t } = useTranslation();
  const quality = data?.dataQuality || {};
  const datasetStatus = quality.datasetStatus || 'setup';
  const valuationMode = quality.valuationMode || 'unavailable';

  const sections = useMemo(() => ([
    {
      id: 'functioning',
      title: t('pilotage.guide.sections.functioning.title'),
      intro: t('pilotage.guide.sections.functioning.intro'),
      bullets: [
        t('pilotage.guide.sections.functioning.points.0'),
        t('pilotage.guide.sections.functioning.points.1'),
        t('pilotage.guide.sections.functioning.points.2'),
      ],
    },
    {
      id: 'data',
      title: t('pilotage.guide.sections.data.title'),
      intro: t('pilotage.guide.sections.data.intro'),
      bullets: [
        t('pilotage.guide.sections.data.points.0'),
        t('pilotage.guide.sections.data.points.1'),
        t('pilotage.guide.sections.data.points.2'),
        t('pilotage.guide.sections.data.points.3'),
      ],
    },
    {
      id: 'conditions',
      title: t('pilotage.guide.sections.conditions.title'),
      intro: t('pilotage.guide.sections.conditions.intro'),
      bullets: [
        t('pilotage.guide.sections.conditions.points.0'),
        t('pilotage.guide.sections.conditions.points.1'),
        t('pilotage.guide.sections.conditions.points.2'),
        t('pilotage.guide.sections.conditions.points.3'),
      ],
    },
    {
      id: 'limits',
      title: t('pilotage.guide.sections.limits.title'),
      intro: t('pilotage.guide.sections.limits.intro'),
      bullets: [
        t('pilotage.guide.sections.limits.points.0'),
        t('pilotage.guide.sections.limits.points.1'),
        t('pilotage.guide.sections.limits.points.2'),
        t('pilotage.guide.sections.limits.points.3'),
      ],
    },
  ]), [t]);

  return (
    <div className="rounded-2xl border border-gray-800/70 bg-gray-900/60 p-5 shadow-[0_20px_60px_-30px_rgba(0,0,0,0.8)]">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-orange-500/20 bg-orange-500/10">
              <BookOpenText className="h-5 w-5 text-orange-300" />
            </div>
            <div>
              <p className="text-lg font-semibold text-gray-100">
                {t('pilotage.guide.title')}
              </p>
              <p className="text-sm text-gray-400">
                {t('pilotage.guide.subtitle')}
              </p>
            </div>
          </div>
          <p className="mt-4 max-w-3xl text-sm leading-relaxed text-gray-300">
            {t('pilotage.guide.summary')}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:min-w-[340px]">
          <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-gray-500">
              {t('pilotage.guide.currentStatusLabel')}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_TONE[datasetStatus] || STATUS_TONE.setup}`}>
                {t(`pilotage.signal.status.${datasetStatus}`)}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-gray-400">
              {t('pilotage.guide.currentStatusHelp')}
            </p>
          </div>

          <div className="rounded-xl border border-gray-800 bg-gray-950/70 p-3">
            <p className="text-[11px] uppercase tracking-[0.16em] text-gray-500">
              {t('pilotage.guide.currentValuationLabel')}
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-medium ${VALUATION_TONE[valuationMode] || VALUATION_TONE.unavailable}`}>
                {t(`pilotage.signal.valuationMode.${valuationMode}`)}
              </span>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-gray-400">
              {t('pilotage.guide.currentValuationHelp')}
            </p>
          </div>
        </div>
      </div>

      <Accordion type="single" collapsible defaultValue="functioning" className="mt-5 rounded-xl border border-gray-800 bg-gray-950/50 px-4">
        {sections.map((section) => {
          const Icon = SECTION_ICONS[section.id];

          return (
            <AccordionItem key={section.id} value={section.id} className="border-gray-800">
              <AccordionTrigger className="py-4 text-left text-gray-100 hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 bg-white/5">
                    <Icon className="h-4 w-4 text-orange-300" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{section.title}</p>
                    <p className="text-xs text-gray-500">{section.intro}</p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                <ul className="space-y-2 pl-12 text-sm leading-relaxed text-gray-300">
                  {section.bullets.map((bullet) => (
                    <li key={bullet} className="list-disc marker:text-orange-400">
                      {bullet}
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          );
        })}
      </Accordion>
    </div>
  );
};

export default PilotageUsageGuide;
