import React from 'react';
import { Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

const RatioInfoPopover = ({
  title,
  definition,
  utility,
  interpretation,
  formula,
}) => {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
          aria-label={`Informations sur ${title}`}
        >
          <Info className="w-4 h-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] max-w-[90vw] bg-gray-900 border-gray-700 text-gray-200">
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-white">{title}</h4>

          {formula && (
            <div className="rounded-md border border-blue-500/30 bg-blue-500/10 p-2">
              <p className="text-xs text-blue-300">
                <span className="font-semibold">Formule:</span> {formula}
              </p>
            </div>
          )}

          {definition && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Definition</p>
              <p className="text-xs text-gray-200 leading-relaxed">{definition}</p>
            </div>
          )}

          {utility && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Utilite</p>
              <p className="text-xs text-gray-200 leading-relaxed">{utility}</p>
            </div>
          )}

          {interpretation && (
            <div>
              <p className="text-[11px] uppercase tracking-wide text-gray-400 mb-1">Interpretation</p>
              <p className="text-xs text-gray-200 leading-relaxed">{interpretation}</p>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default RatioInfoPopover;
