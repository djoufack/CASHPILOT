import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  getCurrencyMetadata,
  getReferenceDataSnapshot,
  loadReferenceData,
} from '@/services/referenceDataService';

const ReferenceDataContext = createContext(null);

function buildViewModel(snapshot, loading, error) {
  return {
    ...snapshot,
    loading,
    error,
    countryOptions: snapshot.countries.map((country) => ({
      value: country.code,
      label: country.label,
    })),
    currencyOptions: snapshot.currencies.map((currency) => ({
      value: currency.code,
      label: `${currency.symbol} ${currency.code} - ${currency.name}`,
      description: currency.name,
    })),
  };
}

export const ReferenceDataProvider = ({ children }) => {
  const initialSnapshot = getReferenceDataSnapshot();
  const [state, setState] = useState(() =>
    buildViewModel(initialSnapshot, !initialSnapshot.ready, null)
  );

  const hydrate = useCallback(async ({ force = false } = {}) => {
    setState((previous) => ({
      ...previous,
      loading: true,
      error: null,
    }));

    try {
      const snapshot = await loadReferenceData({ force });
      const nextState = buildViewModel(snapshot, false, null);
      setState(nextState);
      return nextState;
    } catch (error) {
      const message = error?.message || 'Unable to load reference data';
      setState((previous) => ({
        ...previous,
        loading: false,
        error: message,
      }));
      throw error;
    }
  }, []);

  useEffect(() => {
    const snapshot = getReferenceDataSnapshot();
    if (snapshot.ready) {
      setState(buildViewModel(snapshot, false, null));
      return;
    }

    hydrate().catch((error) => {
      console.error('Reference data bootstrap failed:', error);
    });
  }, [hydrate]);

  const value = useMemo(() => ({
    ...state,
    refreshReferenceData: () => hydrate({ force: true }),
    getCurrencySymbol: (currencyCode) => getCurrencyMetadata(currencyCode)?.symbol || currencyCode || '',
    getCurrencyName: (currencyCode) => getCurrencyMetadata(currencyCode)?.name || currencyCode || '',
    getCurrency: (currencyCode) => getCurrencyMetadata(currencyCode),
  }), [hydrate, state]);

  return (
    <ReferenceDataContext.Provider value={value}>
      {children}
    </ReferenceDataContext.Provider>
  );
};

export const useReferenceData = () => {
  const context = useContext(ReferenceDataContext);
  if (!context) {
    throw new Error('useReferenceData must be used within a ReferenceDataProvider');
  }
  return context;
};

export default ReferenceDataContext;

