import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRightLeft, LayoutGrid, List, Settings2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { COMPARISON_OPTIONS, SECTION_FILTERS, SORT_OPTIONS } from './diagnosticConstants';

const DiagnosticToolbar = ({
  viewMode,
  setViewMode,
  sectionFilter,
  setSectionFilter,
  sortMode,
  setSortMode,
  comparisonMode,
  setComparisonMode,
  benchmarkSector,
  setBenchmarkSector,
  onOpenLayoutDialog,
}) => {
  const { t } = useTranslation();

  return (
    <Card className="sticky top-2 z-30 border border-gray-700 bg-[#0b1328]/95 backdrop-blur">
      <CardContent className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-gray-700 p-1 bg-gray-900/70">
            <button
              type="button"
              onClick={() => setViewMode('gallery')}
              aria-pressed={viewMode === 'gallery'}
              className={cn(
                'h-10 px-3 text-xs sm:text-sm rounded-md flex items-center gap-1.5 min-w-[92px] justify-center',
                viewMode === 'gallery' ? 'bg-blue-500/20 text-blue-200' : 'text-gray-300 hover:bg-gray-800'
              )}
            >
              <LayoutGrid className="w-4 h-4" />
              {t('financial_diagnostic.view_gallery')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('detail')}
              aria-pressed={viewMode === 'detail'}
              className={cn(
                'h-10 px-3 text-xs sm:text-sm rounded-md flex items-center gap-1.5 min-w-[92px] justify-center',
                viewMode === 'detail' ? 'bg-blue-500/20 text-blue-200' : 'text-gray-300 hover:bg-gray-800'
              )}
            >
              <List className="w-4 h-4" />
              {t('financial_diagnostic.view_detail')}
            </button>
            <button
              type="button"
              onClick={() => setViewMode('comparative')}
              aria-pressed={viewMode === 'comparative'}
              className={cn(
                'h-10 px-3 text-xs sm:text-sm rounded-md flex items-center gap-1.5 min-w-[92px] justify-center',
                viewMode === 'comparative' ? 'bg-blue-500/20 text-blue-200' : 'text-gray-300 hover:bg-gray-800'
              )}
            >
              <ArrowRightLeft className="w-4 h-4" />
              {t('financial_diagnostic.view_comparative')}
            </button>
          </div>

          <label className="sr-only" htmlFor="diag-filter">
            {t('financial_diagnostic.filter_cards_label')}
          </label>
          <select
            id="diag-filter"
            value={sectionFilter}
            onChange={(event) => setSectionFilter(event.target.value)}
            className="h-10 px-3 rounded-md border border-gray-700 bg-gray-900 text-sm text-gray-200 min-w-[170px]"
            aria-label={t('financial_diagnostic.filter_cards_label')}
          >
            {SECTION_FILTERS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="diag-sort">
            {t('financial_diagnostic.sort_cards_label')}
          </label>
          <select
            id="diag-sort"
            value={sortMode}
            onChange={(event) => setSortMode(event.target.value)}
            className="h-10 px-3 rounded-md border border-gray-700 bg-gray-900 text-sm text-gray-200 min-w-[165px]"
            aria-label={t('financial_diagnostic.sort_cards_label')}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="diag-compare">
            {t('financial_diagnostic.period_comparator_label')}
          </label>
          <select
            id="diag-compare"
            value={comparisonMode}
            onChange={(event) => setComparisonMode(event.target.value)}
            className="h-10 px-3 rounded-md border border-gray-700 bg-gray-900 text-sm text-gray-200 min-w-[130px]"
            aria-label={t('financial_diagnostic.period_comparator_label')}
          >
            {Object.entries(COMPARISON_OPTIONS).map(([value, option]) => (
              <option key={value} value={value}>
                {option.label}
              </option>
            ))}
          </select>

          <label className="sr-only" htmlFor="diag-sector">
            {t('financial_diagnostic.benchmark_sector_label')}
          </label>
          <select
            id="diag-sector"
            value={benchmarkSector}
            onChange={(event) => setBenchmarkSector(event.target.value)}
            className="h-10 px-3 rounded-md border border-gray-700 bg-gray-900 text-sm text-gray-200 min-w-[160px]"
            aria-label={t('financial_diagnostic.benchmark_sector_label')}
          >
            <option value="services">{t('financial_diagnostic.sector_services')}</option>
            <option value="commerce">{t('financial_diagnostic.sector_commerce')}</option>
            <option value="industrie">{t('financial_diagnostic.sector_industry')}</option>
          </select>

          <Button
            variant="outline"
            onClick={onOpenLayoutDialog}
            aria-label={t('financial_diagnostic.customize_cards_aria')}
            className="h-10 border-gray-700 text-gray-200"
          >
            <Settings2 className="w-4 h-4 mr-2" />
            {t('financial_diagnostic.customize')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default DiagnosticToolbar;
