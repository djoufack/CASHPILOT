import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, ChevronDown, Check, Plus } from 'lucide-react';

export default function CompanySwitcher({ companies = [], activeCompany, onSwitch, onCreateNew }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (!companies.length) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm transition-colors"
      >
        <Building2 className="w-4 h-4 text-indigo-400" />
        <span className="max-w-[120px] truncate">
          {activeCompany?.company_name || activeCompany?.name || t('company.selectCompany', 'Société')}
        </span>
        {companies.length > 1 && <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* Dropdown */}
          <div className="absolute left-0 mt-1 w-56 z-50 bg-[#0f1528] border border-white/10 rounded-xl shadow-xl overflow-hidden">
            <div className="py-1">
              {companies.map(co => {
                const displayName = co.company_name || co.name || '?';
                const initials = displayName.slice(0, 2).toUpperCase();
                const isActive = activeCompany?.id === co.id;
                return (
                  <button
                    key={co.id}
                    onClick={() => { onSwitch?.(co.id); setOpen(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center text-xs font-semibold text-indigo-300 shrink-0">
                      {initials}
                    </div>
                    <span className="flex-1 truncate text-left">{displayName}</span>
                    {isActive && <Check className="w-3.5 h-3.5 text-indigo-400 shrink-0" />}
                  </button>
                );
              })}
            </div>
            <div className="border-t border-white/10 py-1">
              <button
                onClick={() => { onCreateNew?.(); setOpen(false); }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
              >
                <Plus className="w-4 h-4 shrink-0" />
                {t('company.addCompany', 'Ajouter une société')}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
