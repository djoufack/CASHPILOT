import { useState } from 'react';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const normalize = (value) => {
  if (value == null) {
    return '';
  }
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(' ');
  }
  return String(value).trim();
};

const InfoSection = ({ label, value }) => {
  if (!value) {
    return null;
  }

  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-wide text-gray-400">{label}</p>
      <p className="text-xs text-gray-200 leading-relaxed">{value}</p>
    </div>
  );
};

const PanelInfoPopover = ({
  title,
  definition,
  dataSource,
  formula,
  calculationMethod,
  filters,
  notes,
  expertDefinition,
  expertDataSource,
  expertFormula,
  expertCalculationMethod,
  expertFilters,
  expertNotes,
  ariaLabel,
  triggerClassName = '',
}) => {
  const [showExpert, setShowExpert] = useState(false);
  const normalizedTitle = normalize(title) || 'Information composant';
  const normalizedDefinition = normalize(definition);
  const normalizedDataSource = normalize(dataSource);
  const normalizedFormula = normalize(formula);
  const normalizedCalculationMethod = normalize(calculationMethod);
  const normalizedFilters = normalize(filters);
  const normalizedNotes = normalize(notes);
  const normalizedExpertDefinition = normalize(expertDefinition);
  const normalizedExpertDataSource = normalize(expertDataSource);
  const normalizedExpertFormula = normalize(expertFormula);
  const normalizedExpertCalculationMethod = normalize(expertCalculationMethod);
  const normalizedExpertFilters = normalize(expertFilters);
  const normalizedExpertNotes = normalize(expertNotes);
  const hasExpertContent = Boolean(
    normalizedExpertDefinition ||
    normalizedExpertDataSource ||
    normalizedExpertFormula ||
    normalizedExpertCalculationMethod ||
    normalizedExpertFilters ||
    normalizedExpertNotes
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className={`h-7 w-7 p-0 shrink-0 rounded-full border border-orange-300/60 bg-orange-500/20 text-orange-100 shadow-sm shadow-orange-500/20 ring-1 ring-orange-400/25 hover:bg-orange-500/35 hover:text-white transition-colors ${triggerClassName}`.trim()}
          aria-label={ariaLabel || `Informations sur ${normalizedTitle}`}
        >
          <Info className="h-[18px] w-[18px]" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className="w-[360px] max-w-[90vw] bg-gray-900 border-gray-700 text-gray-200"
      >
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-white">{normalizedTitle}</h4>
          <InfoSection label="Definition" value={normalizedDefinition} />
          <InfoSection label="Source des donnees" value={normalizedDataSource} />
          <InfoSection label="Formule" value={normalizedFormula} />
          <InfoSection label="Methode de calcul" value={normalizedCalculationMethod} />
          <InfoSection label="Filtres" value={normalizedFilters} />
          <InfoSection label="Notes" value={normalizedNotes} />
          {hasExpertContent && (
            <div className="pt-1 border-t border-gray-700/80">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[11px] text-orange-300 hover:text-orange-200 hover:bg-orange-500/10"
                onClick={() => setShowExpert((previous) => !previous)}
              >
                {showExpert ? 'Masquer detail expert' : 'Voir detail expert'}
              </Button>
            </div>
          )}
          {showExpert && hasExpertContent && (
            <div className="space-y-3 border-t border-gray-700/80 pt-2">
              <p className="text-[11px] uppercase tracking-wide text-orange-300">Niveau expert</p>
              <InfoSection label="Definition (expert)" value={normalizedExpertDefinition} />
              <InfoSection label="Source des donnees (expert)" value={normalizedExpertDataSource} />
              <InfoSection label="Formule (expert)" value={normalizedExpertFormula} />
              <InfoSection label="Methode de calcul (expert)" value={normalizedExpertCalculationMethod} />
              <InfoSection label="Filtres (expert)" value={normalizedExpertFilters} />
              <InfoSection label="Notes (expert)" value={normalizedExpertNotes} />
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default PanelInfoPopover;
