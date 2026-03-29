
import { useTranslation } from 'react-i18next';
import RatioGauge from '@/components/accounting/RatioGauge';

const StructureRatiosSection = ({ data, sector }) => {
  const { t } = useTranslation();

  const structure = data?.pilotageRatios?.structure;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {/* 1. Financial Independence */}
      <RatioGauge
        label={t('pilotage.ratios.financialIndependence')}
        value={structure?.financialIndependence}
        thresholds={{ excellent: 50, good: 35, warning: 25, poor: 15 }}
        format="percentage"
        description="Capitaux propres / Total bilan"
        info={{
          title: 'Independance financiere',
          formula: 'Independance = capitaux propres / total bilan',
          definition: "Ce ratio mesure la part des actifs financee par les fonds propres de l'entreprise.",
          utility: "Il permet d'evaluer le degre d'autonomie financiere vis-a-vis des creanciers.",
          interpretation: "Plus le ratio est eleve, plus l'entreprise est independante. En dessous de 25%, la dependance aux financements externes devient significative.",
        }}
      />

      {/* 2. Gearing */}
      <RatioGauge
        label={t('pilotage.ratios.gearing')}
        value={structure?.gearing}
        thresholds={{ excellent: 0.3, good: 0.5, warning: 0.8, poor: 1.0 }}
        format="number"
        inverse={true}
        description="Dettes / Capitaux propres"
        info={{
          title: 'Levier (Gearing)',
          formula: 'Gearing = dettes financieres / capitaux propres',
          definition: "Le gearing mesure le rapport entre l'endettement et les fonds propres.",
          utility: "Il indique le niveau de risque financier lie a l'endettement de l'entreprise.",
          interpretation: "Un gearing inferieur a 0.5 est excellent. Au-dela de 1, l'entreprise est plus financee par la dette que par ses fonds propres.",
        }}
      />

      {/* 3. Stable Asset Coverage */}
      <RatioGauge
        label={t('pilotage.ratios.stableAssetCoverage')}
        value={structure?.stableAssetCoverage}
        thresholds={{ excellent: 1.5, good: 1.2, warning: 1.0, poor: 0.8 }}
        format="number"
        description="Capitaux permanents / Immobilisations"
        info={{
          title: 'Couverture des emplois stables',
          formula: 'Couverture = capitaux permanents / immobilisations nettes',
          definition: 'Ce ratio verifie que les investissements long terme sont finances par des ressources durables.',
          utility: "Il permet de s'assurer de l'equilibre financier entre emplois stables et ressources stables.",
          interpretation: "Au-dessus de 1.2, l'equilibre est bon. En dessous de 1, les immobilisations sont partiellement financees par des dettes court terme, ce qui est risque.",
        }}
      />
    </div>
  );
};

export default StructureRatiosSection;
