import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Building2, ChevronDown, Check, Plus } from 'lucide-react';
import { useActiveCompanyId } from '@/hooks/useActiveCompanyId';
import { setStoredActiveCompanyId } from '@/utils/activeCompanyStorage';

const normalizeCompanyId = (value) => (
  value == null ? null : String(value).trim().toLowerCase()
);

export default function CompanySwitcher({ companies = [], activeCompany, onSwitch, onCreateNew }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const activeCompanyId = normalizeCompanyId(activeCompany?.id);
  const storedActiveCompanyId = useActiveCompanyId();

  const effectiveActiveCompanyId = useMemo(() => {
    const normalizedStoredId = normalizeCompanyId(storedActiveCompanyId);
    if (normalizedStoredId && companies.some((company) => normalizeCompanyId(company?.id) === normalizedStoredId)) {
      return normalizedStoredId;
    }
    return activeCompanyId;
  }, [activeCompanyId, companies, storedActiveCompanyId]);

  const effectiveActiveCompany = useMemo(() => {
    if (!effectiveActiveCompanyId) return activeCompany || null;
    return (
      companies.find((company) => normalizeCompanyId(company?.id) === effectiveActiveCompanyId)
      || activeCompany
      || null
    );
  }, [activeCompany, companies, effectiveActiveCompanyId]);

  const primaryCompanyId = useMemo(() => {
    if (!companies.length) return null;

    const explicitPrimary = companies.find((company) =>
      company?.is_primary === true
      || company?.is_primary_company === true
      || company?.is_portfolio_primary === true
    );
    if (explicitPrimary?.id != null) {
      return normalizeCompanyId(explicitPrimary.id);
    }

    if (effectiveActiveCompanyId && companies.some((company) => normalizeCompanyId(company?.id) === effectiveActiveCompanyId)) {
      return effectiveActiveCompanyId;
    }

    const byCreation = [...companies].sort((left, right) => {
      const leftDate = left?.created_at ? new Date(left.created_at).getTime() : Number.MAX_SAFE_INTEGER;
      const rightDate = right?.created_at ? new Date(right.created_at).getTime() : Number.MAX_SAFE_INTEGER;
      if (leftDate !== rightDate) return leftDate - rightDate;

      const leftName = String(left?.company_name || left?.name || '').toLowerCase();
      const rightName = String(right?.company_name || right?.name || '').toLowerCase();
      return leftName.localeCompare(rightName, 'fr');
    });

    const fallbackId = byCreation[0]?.id ?? companies[0]?.id ?? null;
    return normalizeCompanyId(fallbackId);
  }, [companies, effectiveActiveCompanyId]);

  const sortedCompanies = useMemo(() => {
    const next = [...companies];
    next.sort((left, right) => {
      if (primaryCompanyId) {
        if (normalizeCompanyId(left.id) === primaryCompanyId) return -1;
        if (normalizeCompanyId(right.id) === primaryCompanyId) return 1;
      }

      if (effectiveActiveCompanyId) {
        if (normalizeCompanyId(left.id) === effectiveActiveCompanyId) return -1;
        if (normalizeCompanyId(right.id) === effectiveActiveCompanyId) return 1;
      }

      const leftName = String(left.company_name || left.name || '').toLowerCase();
      const rightName = String(right.company_name || right.name || '').toLowerCase();
      return leftName.localeCompare(rightName, 'fr');
    });
    return next;
  }, [companies, effectiveActiveCompanyId, primaryCompanyId]);

  if (!companies.length) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white text-sm transition-colors"
      >
        <Building2 className="w-4 h-4 text-indigo-400" />
        <span className="max-w-[120px] truncate">
          {effectiveActiveCompany?.company_name || effectiveActiveCompany?.name || t('company.selectCompany', 'Société')}
        </span>
        {sortedCompanies.length > 1 && <ChevronDown className="w-3.5 h-3.5 text-gray-400" />}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          {/* Dropdown */}
          <div className="absolute left-0 mt-1 w-56 z-50 bg-[#0f1528] border border-white/10 rounded-xl shadow-xl overflow-hidden">
            <div className="py-1">
              {sortedCompanies.map(co => {
                const displayName = co.company_name || co.name || '?';
                const initials = displayName.slice(0, 2).toUpperCase();
                const companyId = normalizeCompanyId(co.id);
                const isActive = effectiveActiveCompanyId === companyId;
                const isPrimary = primaryCompanyId === companyId;
                return (
                  <button
                    key={co.id}
                    onClick={() => {
                      setStoredActiveCompanyId(co.id);
                      onSwitch?.(co.id);
                      setOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2 text-sm text-white hover:bg-white/10 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center text-xs font-semibold text-indigo-300 shrink-0">
                      {initials}
                    </div>
                    <span className="flex-1 truncate text-left">
                      {displayName}
                      {isActive ? ` (${t('company.activeCompany', 'Société active')})` : ''}
                    </span>
                    {isPrimary && (
                      <span
                        title={t('company.primaryCompany', 'Société principale')}
                        className="shrink-0 rounded-full border border-amber-400/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200"
                      >
                        {t('company.primaryShort', 'Principale')}
                      </span>
                    )}
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
