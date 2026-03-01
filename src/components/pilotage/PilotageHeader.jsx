import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, CardContent } from '@/components/ui/card';
import { Globe, Briefcase, Calendar } from 'lucide-react';

const PilotageHeader = ({
  startDate, endDate, onStartDateChange, onEndDateChange,
  region, onRegionChange, sector, onSectorChange
}) => {
  const { t } = useTranslation();

  const regions = [
    { value: 'france', label: t('pilotage.regions.france') },
    { value: 'belgium', label: t('pilotage.regions.belgium') },
    { value: 'ohada', label: t('pilotage.regions.ohada') },
  ];

  const sectors = [
    { value: 'saas', label: t('pilotage.sectors.saas') },
    { value: 'industry', label: t('pilotage.sectors.industry') },
    { value: 'retail', label: t('pilotage.sectors.retail') },
    { value: 'construction', label: t('pilotage.sectors.construction') },
    { value: 'b2b_services', label: t('pilotage.sectors.b2bServices') },
  ];

  return (
    <Card className="bg-gray-900/50 border border-gray-800/50">
      <CardContent className="p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Region */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
              <Globe className="w-3.5 h-3.5" />
              {t('pilotage.selectors.region')}
            </label>
            <select
              value={region}
              onChange={(e) => onRegionChange(e.target.value)}
              className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/50 outline-none"
            >
              {regions.map(r => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>

          {/* Sector */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
              <Briefcase className="w-3.5 h-3.5" />
              {t('pilotage.selectors.sector')}
            </label>
            <select
              value={sector}
              onChange={(e) => onSectorChange(e.target.value)}
              className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/50 outline-none"
            >
              {sectors.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Start Date */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
              <Calendar className="w-3.5 h-3.5" />
              {t('pilotage.selectors.startDate')}
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => onStartDateChange(e.target.value)}
              className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/50 outline-none"
            />
          </div>

          {/* End Date */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400">
              <Calendar className="w-3.5 h-3.5" />
              {t('pilotage.selectors.endDate')}
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => onEndDateChange(e.target.value)}
              className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:ring-1 focus:ring-orange-500/50 focus:border-orange-500/50 outline-none"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PilotageHeader;
