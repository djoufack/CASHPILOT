import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Calendar, AlertTriangle, Clock, CheckCircle2, ChevronLeft, ChevronRight, Flag } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Tax deadlines are defined per country and fetched from rules context.
// This component generates a calendar view with upcoming fiscal deadlines.

const generateDeadlines = (year, countryCode) => {
  const deadlines = [];

  if (countryCode === 'FR') {
    // France: TVA monthly (25th of following month) or quarterly
    for (let m = 1; m <= 12; m++) {
      deadlines.push({
        id: `fr-vat-${year}-${m}`,
        date: new Date(year, m, 24), // 24th of following month
        type: 'vat',
        label: `TVA - ${String(m).padStart(2, '0')}/${year}`,
        country: 'FR',
        frequency: 'monthly',
      });
    }
    // IS: 4 quarterly installments
    [3, 6, 9, 12].forEach((m, idx) => {
      deadlines.push({
        id: `fr-is-${year}-q${idx + 1}`,
        date: new Date(year, m - 1, 15),
        type: 'corporate_tax',
        label: `IS - Acompte Q${idx + 1}/${year}`,
        country: 'FR',
        frequency: 'quarterly',
      });
    });
    // IS annual: May 15
    deadlines.push({
      id: `fr-is-annual-${year}`,
      date: new Date(year, 4, 15),
      type: 'corporate_tax',
      label: `IS - Declaration annuelle ${year - 1}`,
      country: 'FR',
      frequency: 'annual',
    });
    // CFE: December 15
    deadlines.push({
      id: `fr-cfe-${year}`,
      date: new Date(year, 11, 15),
      type: 'cfe',
      label: `CFE ${year}`,
      country: 'FR',
      frequency: 'annual',
    });
  }

  if (countryCode === 'BE') {
    // Belgium: TVA quarterly (20th of following month)
    [3, 6, 9, 12].forEach((m, idx) => {
      deadlines.push({
        id: `be-vat-${year}-q${idx + 1}`,
        date: new Date(year, m, 20),
        type: 'vat',
        label: `TVA - T${idx + 1}/${year}`,
        country: 'BE',
        frequency: 'quarterly',
      });
    });
    // ISOC: quarterly installments
    [4, 7, 10].forEach((m, idx) => {
      deadlines.push({
        id: `be-isoc-${year}-${idx + 1}`,
        date: new Date(year, m - 1, 10),
        type: 'corporate_tax',
        label: `ISOC - Versement anticipé ${idx + 1}/${year}`,
        country: 'BE',
        frequency: 'quarterly',
      });
    });
  }

  if (countryCode === 'CI') {
    // Ivory Coast: TVA monthly (15th)
    for (let m = 1; m <= 12; m++) {
      deadlines.push({
        id: `ci-vat-${year}-${m}`,
        date: new Date(year, m, 15),
        type: 'vat',
        label: `TVA - ${String(m).padStart(2, '0')}/${year}`,
        country: 'CI',
        frequency: 'monthly',
      });
    }
    // Patente: March 31
    deadlines.push({
      id: `ci-patente-${year}`,
      date: new Date(year, 2, 31),
      type: 'patente',
      label: `Patente ${year}`,
      country: 'CI',
      frequency: 'annual',
    });
  }

  if (countryCode === 'CM') {
    // Cameroon: TVA monthly (15th)
    for (let m = 1; m <= 12; m++) {
      deadlines.push({
        id: `cm-vat-${year}-${m}`,
        date: new Date(year, m, 15),
        type: 'vat',
        label: `TVA - ${String(m).padStart(2, '0')}/${year}`,
        country: 'CM',
        frequency: 'monthly',
      });
    }
    // IS: March 15
    deadlines.push({
      id: `cm-is-${year}`,
      date: new Date(year, 2, 15),
      type: 'corporate_tax',
      label: `IS - Declaration annuelle ${year - 1}`,
      country: 'CM',
      frequency: 'annual',
    });
  }

  return deadlines.sort((a, b) => a.date - b.date);
};

const typeColors = {
  vat: 'bg-blue-900/40 text-blue-300 border-blue-700',
  corporate_tax: 'bg-purple-900/40 text-purple-300 border-purple-700',
  income_tax: 'bg-cyan-900/40 text-cyan-300 border-cyan-700',
  patente: 'bg-amber-900/40 text-amber-300 border-amber-700',
  cfe: 'bg-rose-900/40 text-rose-300 border-rose-700',
};

const countryOptions = [
  { code: 'FR', label: 'France' },
  { code: 'BE', label: 'Belgique' },
  { code: 'CI', label: "Cote d'Ivoire" },
  { code: 'CM', label: 'Cameroun' },
];

const TaxCalendar = ({ declarations }) => {
  const { t } = useTranslation();
  const now = new Date();
  const [selectedCountry, setSelectedCountry] = useState('FR');
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());

  const deadlines = useMemo(() => generateDeadlines(selectedYear, selectedCountry), [selectedYear, selectedCountry]);

  // Check which deadlines have a matching submitted declaration
  const _filedRefs = useMemo(() => {
    if (!declarations) return new Set();
    return new Set(
      declarations
        .filter((d) => ['submitted', 'accepted'].includes(d.status))
        .map((d) => `${d.country_code}-${d.declaration_type}-${d.period_start}-${d.period_end}`)
    );
  }, [declarations]);

  const upcomingDeadlines = deadlines.filter((d) => d.date >= now);
  const pastDeadlines = deadlines.filter((d) => d.date < now);

  const getDeadlineStatus = (deadline) => {
    const daysUntil = Math.ceil((deadline.date - now) / (1000 * 60 * 60 * 24));

    if (daysUntil < 0) return 'past';
    if (daysUntil <= 7) return 'urgent';
    if (daysUntil <= 30) return 'soon';
    return 'future';
  };

  const statusIcons = {
    past: <Clock className="w-4 h-4 text-gray-500" />,
    urgent: <AlertTriangle className="w-4 h-4 text-red-400" />,
    soon: <Clock className="w-4 h-4 text-amber-400" />,
    future: <Calendar className="w-4 h-4 text-gray-400" />,
  };

  const statusBorders = {
    past: 'border-gray-800',
    urgent: 'border-red-800/60',
    soon: 'border-amber-800/60',
    future: 'border-gray-800',
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-5">
        <div className="flex flex-wrap gap-4 items-center">
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('taxFiling.country', 'Country')}</label>
            <select
              value={selectedCountry}
              onChange={(e) => setSelectedCountry(e.target.value)}
              className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {countryOptions.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">{t('taxFiling.year', 'Year')}</label>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedYear((y) => y - 1)}
                className="text-gray-400 hover:text-white"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-white font-mono text-sm w-12 text-center">{selectedYear}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedYear((y) => y + 1)}
                className="text-gray-400 hover:text-white"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <div className="ml-auto flex gap-2 text-xs">
            <span className="flex items-center gap-1 text-red-400">
              <AlertTriangle className="w-3 h-3" />
              {t('taxFiling.urgent', 'Urgent (< 7 days)')}
            </span>
            <span className="flex items-center gap-1 text-amber-400">
              <Clock className="w-3 h-3" />
              {t('taxFiling.soon', 'Soon (< 30 days)')}
            </span>
          </div>
        </div>
      </div>

      {/* Upcoming deadlines */}
      {upcomingDeadlines.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Flag className="w-4 h-4" />
            {t('taxFiling.upcomingDeadlines', 'Upcoming deadlines')} ({upcomingDeadlines.length})
          </h3>
          <div className="space-y-2">
            {upcomingDeadlines.map((deadline) => {
              const status = getDeadlineStatus(deadline);
              const daysUntil = Math.ceil((deadline.date - now) / (1000 * 60 * 60 * 24));
              const typeColor = typeColors[deadline.type] || typeColors.vat;

              return (
                <div
                  key={deadline.id}
                  className={`flex items-center gap-4 bg-gray-900/50 rounded-xl border ${statusBorders[status]} p-4 hover:bg-gray-900/70 transition-colors`}
                >
                  {statusIcons[status]}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${typeColor}`}>
                        {deadline.type === 'vat'
                          ? 'TVA'
                          : deadline.type === 'corporate_tax'
                            ? 'IS'
                            : deadline.type === 'patente'
                              ? 'Patente'
                              : deadline.type === 'cfe'
                                ? 'CFE'
                                : deadline.type.toUpperCase()}
                      </span>
                      <span className="text-sm text-white">{deadline.label}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm text-white font-mono">{deadline.date.toLocaleDateString()}</p>
                    <p
                      className={`text-xs ${
                        status === 'urgent'
                          ? 'text-red-400 font-semibold'
                          : status === 'soon'
                            ? 'text-amber-400'
                            : 'text-gray-500'
                      }`}
                    >
                      {daysUntil === 0
                        ? t('taxFiling.today', 'Today')
                        : daysUntil === 1
                          ? t('taxFiling.tomorrow', 'Tomorrow')
                          : t('taxFiling.inDays', '{{count}} days', {
                              count: daysUntil,
                            })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Past deadlines (collapsed) */}
      {pastDeadlines.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4" />
            {t('taxFiling.pastDeadlines', 'Past deadlines')} ({pastDeadlines.length})
          </h3>
          <div className="space-y-2 opacity-60">
            {pastDeadlines.slice(-6).map((deadline) => {
              const typeColor = typeColors[deadline.type] || typeColors.vat;

              return (
                <div
                  key={deadline.id}
                  className="flex items-center gap-4 bg-gray-900/30 rounded-xl border border-gray-800/50 p-3"
                >
                  <CheckCircle2 className="w-4 h-4 text-gray-600" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-medium border ${typeColor} opacity-60`}>
                        {deadline.type === 'vat'
                          ? 'TVA'
                          : deadline.type === 'corporate_tax'
                            ? 'IS'
                            : deadline.type.toUpperCase()}
                      </span>
                      <span className="text-sm text-gray-500">{deadline.label}</span>
                    </div>
                  </div>
                  <span className="text-xs text-gray-600 font-mono">{deadline.date.toLocaleDateString()}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {deadlines.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <Calendar className="w-12 h-12 mb-4 opacity-50" />
          <p className="text-lg">{t('taxFiling.noDeadlines', 'No deadlines for this period')}</p>
        </div>
      )}
    </div>
  );
};

export default TaxCalendar;
