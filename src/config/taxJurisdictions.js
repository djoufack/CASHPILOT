import {
  getReferenceDataSnapshot,
  getTaxJurisdictionMetadata,
  loadReferenceData,
} from '@/services/referenceDataService';

/**
 * Loads tax jurisdictions from Supabase into the shared reference snapshot.
 */
export const loadTaxJurisdictions = async () => {
  const snapshot = await loadReferenceData();
  return snapshot.taxJurisdictions;
};

/**
 * Get jurisdiction by code
 */
export const getJurisdiction = (code) => {
  return getTaxJurisdictionMetadata(code);
};

/**
 * Get all jurisdiction codes
 */
export const getJurisdictionCodes = () =>
  Object.keys(getReferenceDataSnapshot().taxJurisdictionsByCode);

/**
 * Get VAT rates for a jurisdiction
 */
export const getVatRates = (jurisdictionCode) => {
  const jurisdiction = getJurisdiction(jurisdictionCode);
  return jurisdiction?.vatRates || [];
};

/**
 * Get default VAT rate for a jurisdiction
 */
export const getDefaultVatRate = (jurisdictionCode) => {
  const jurisdiction = getJurisdiction(jurisdictionCode);
  return jurisdiction?.defaultVatRate || 0;
};

/**
 * Validate VAT number format
 */
export const validateVatNumber = (vatNumber, jurisdictionCode) => {
  const jurisdiction = getJurisdiction(jurisdictionCode);
  if (!jurisdiction?.vatNumberPattern) return true;

  try {
    return new RegExp(jurisdiction.vatNumberPattern).test(vatNumber);
  } catch {
    return true;
  }
};

/**
 * Get export formats for a jurisdiction
 */
export const getExportFormats = (jurisdictionCode) => {
  const jurisdiction = getJurisdiction(jurisdictionCode);
  return jurisdiction?.exportFormats || [];
};

export default getReferenceDataSnapshot().taxJurisdictionsByCode;
