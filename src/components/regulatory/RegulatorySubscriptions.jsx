import { useState, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, Power, Loader2 } from 'lucide-react';

const ALL_DOMAINS = ['tax', 'labor', 'accounting', 'corporate'];

const DOMAIN_COLORS = {
  tax: {
    active: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    inactive: 'bg-gray-800/30 text-gray-600 border-gray-700/30',
  },
  labor: {
    active: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
    inactive: 'bg-gray-800/30 text-gray-600 border-gray-700/30',
  },
  accounting: {
    active: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30',
    inactive: 'bg-gray-800/30 text-gray-600 border-gray-700/30',
  },
  corporate: {
    active: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
    inactive: 'bg-gray-800/30 text-gray-600 border-gray-700/30',
  },
};

/**
 * RegulatorySubscriptions - Manage country subscriptions with domain toggles.
 *
 * @param {{ subscriptions: Array, availableCountries: Array<{code: string, name: string}>, onUpdate: Function }} props
 */
const RegulatorySubscriptions = ({ subscriptions, availableCountries = [], onUpdate }) => {
  const { t } = useTranslation();
  const [updatingCountry, setUpdatingCountry] = useState(null);

  // Build a lookup from subscriptions array
  const subLookup = useMemo(() => {
    const lookup = {};
    for (const sub of subscriptions || []) {
      lookup[sub.country_code] = sub;
    }
    return lookup;
  }, [subscriptions]);

  const handleToggleActive = useCallback(
    async (countryCode) => {
      setUpdatingCountry(countryCode);
      const existing = subLookup[countryCode];
      const newIsActive = existing ? !existing.is_active : true;
      const domains = existing?.domains || ALL_DOMAINS;

      await onUpdate?.(countryCode, {
        is_active: newIsActive,
        domains,
      });
      setUpdatingCountry(null);
    },
    [subLookup, onUpdate]
  );

  const handleToggleDomain = useCallback(
    async (countryCode, domain) => {
      setUpdatingCountry(countryCode);
      const existing = subLookup[countryCode];
      const currentDomains = existing?.domains || ALL_DOMAINS;

      let newDomains;
      if (currentDomains.includes(domain)) {
        newDomains = currentDomains.filter((d) => d !== domain);
        // Prevent empty domain list
        if (newDomains.length === 0) {
          setUpdatingCountry(null);
          return;
        }
      } else {
        newDomains = [...currentDomains, domain];
      }

      await onUpdate?.(countryCode, {
        is_active: existing?.is_active ?? true,
        domains: newDomains,
      });
      setUpdatingCountry(null);
    },
    [subLookup, onUpdate]
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {availableCountries.map((country) => {
        const sub = subLookup[country.code];
        const isActive = sub?.is_active ?? false;
        const domains = sub?.domains || ALL_DOMAINS;
        const isUpdating = updatingCountry === country.code;

        return (
          <div
            key={country.code}
            className={`bg-[#0f1528]/80 border rounded-2xl p-4 backdrop-blur-sm transition-all ${
              isActive ? 'border-blue-500/30' : 'border-gray-800/50'
            }`}
          >
            {/* Header: Country + Toggle */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isActive ? 'bg-blue-500/20' : 'bg-gray-800/40'
                  }`}
                >
                  <Globe className={`w-4 h-4 ${isActive ? 'text-blue-400' : 'text-gray-600'}`} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">{country.name}</h4>
                  <span className="text-[10px] text-gray-500">{country.code}</span>
                </div>
              </div>

              <button
                onClick={() => handleToggleActive(country.code)}
                disabled={isUpdating}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors border ${
                  isActive
                    ? 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
                    : 'border-gray-700/50 text-gray-500 hover:text-white hover:border-gray-600/50'
                }`}
              >
                {isUpdating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Power className="w-3 h-3" />}
                {isActive
                  ? t('regulatory.subscriptions.active', 'Actif')
                  : t('regulatory.subscriptions.inactive', 'Inactif')}
              </button>
            </div>

            {/* Domain toggles */}
            <div className="flex flex-wrap gap-1.5">
              {ALL_DOMAINS.map((domain) => {
                const isDomainActive = isActive && domains.includes(domain);
                const colors = DOMAIN_COLORS[domain] || DOMAIN_COLORS.tax;
                const colorClass = isDomainActive ? colors.active : colors.inactive;

                return (
                  <button
                    key={domain}
                    onClick={() => isActive && handleToggleDomain(country.code, domain)}
                    disabled={!isActive || isUpdating}
                    className={`px-2 py-1 rounded-md text-[10px] font-medium border transition-colors disabled:cursor-not-allowed ${colorClass}`}
                  >
                    {t(`regulatory.domain.${domain}`, domain)}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RegulatorySubscriptions;
