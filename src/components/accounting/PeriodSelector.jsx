
import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Calendar } from 'lucide-react';

const PeriodSelector = ({ startDate, endDate, onChange }) => {
  const now = new Date();
  const year = now.getFullYear();

  const presets = [
    {
      label: 'Ce mois',
      start: new Date(year, now.getMonth(), 1).toISOString().split('T')[0],
      end: new Date(year, now.getMonth() + 1, 0).toISOString().split('T')[0]
    },
    {
      label: 'Ce trimestre',
      start: new Date(year, Math.floor(now.getMonth() / 3) * 3, 1).toISOString().split('T')[0],
      end: new Date(year, Math.floor(now.getMonth() / 3) * 3 + 3, 0).toISOString().split('T')[0]
    },
    {
      label: 'Cette année',
      start: `${year}-01-01`,
      end: `${year}-12-31`
    },
    {
      label: 'Année précédente',
      start: `${year - 1}-01-01`,
      end: `${year - 1}-12-31`
    }
  ];

  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-900 border border-gray-800 rounded-lg">
      <Calendar className="w-4 h-4 text-orange-400 shrink-0" />
      <span className="text-sm text-gray-400 shrink-0">Période :</span>

      {/* Presets */}
      <div className="flex gap-1 flex-wrap">
        {presets.map(p => (
          <Button
            key={p.label}
            variant="ghost"
            size="sm"
            className={`text-xs h-7 px-2 ${
              startDate === p.start && endDate === p.end
                ? 'bg-orange-500/20 text-orange-400'
                : 'text-gray-400 hover:text-white'
            }`}
            onClick={() => onChange({ startDate: p.start, endDate: p.end })}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div className="h-4 w-px bg-gray-700 hidden sm:block" />

      {/* Custom dates */}
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={startDate}
          onChange={e => onChange({ startDate: e.target.value, endDate })}
          className="bg-gray-800 border-gray-700 text-white text-xs h-7 w-[130px]"
        />
        <span className="text-gray-600 text-xs">au</span>
        <Input
          type="date"
          value={endDate}
          onChange={e => onChange({ startDate, endDate: e.target.value })}
          className="bg-gray-800 border-gray-700 text-white text-xs h-7 w-[130px]"
        />
      </div>
    </div>
  );
};

export default PeriodSelector;
