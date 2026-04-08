const toText = (value) => String(value ?? '').trim();

export const looksLikePeppolId = (value) => /^\d{4}\s*:\s*[A-Za-z0-9][A-Za-z0-9 .\-_/]*$/.test(toText(value));

export const looksLikeVatNumber = (value) => {
  const compact = toText(value)
    .replace(/[^A-Za-z0-9]/g, '')
    .toUpperCase();
  if (!compact || compact.length < 8 || compact.length > 20) return false;
  const digitCount = (compact.match(/\d/g) || []).length;
  return digitCount >= 6;
};

export const detectModeFromQuery = (query) => {
  const lowered = toText(query).toLowerCase();
  if (lowered.startsWith('id:') || lowered.startsWith('peppol:')) return 'peppol_id';
  if (lowered.startsWith('vat:') || lowered.startsWith('tva:')) return 'vat_number';
  if (lowered.startsWith('name:') || lowered.startsWith('societe:') || lowered.startsWith('entreprise:')) {
    return 'company_name';
  }
  if (looksLikePeppolId(query)) return 'peppol_id';
  if (looksLikeVatNumber(query)) return 'vat_number';
  return 'company_name';
};

export const stripPrefixes = (query) => {
  const normalized = toText(query);
  const lowered = normalized.toLowerCase();
  const prefixes = ['id:', 'peppol:', 'vat:', 'tva:', 'name:', 'societe:', 'entreprise:'];
  for (const prefix of prefixes) {
    if (lowered.startsWith(prefix)) {
      return normalized.slice(prefix.length).trim();
    }
  }
  return normalized;
};

export const resolvePeppolCheckPayload = (input) => {
  if (typeof input === 'string') {
    const cleaned = stripPrefixes(input);
    const query_type = detectModeFromQuery(input);
    if (!cleaned) return null;
    if (query_type === 'peppol_id') return { query_type, peppol_id: cleaned, query: cleaned };
    if (query_type === 'vat_number') return { query_type, vat_number: cleaned, query: cleaned };
    return { query_type, company_name: cleaned, query: cleaned };
  }

  if (!input || typeof input !== 'object') return null;

  const rawQueryType = toText(input.query_type).toLowerCase();
  const forcedType =
    rawQueryType === 'peppol_id' || rawQueryType === 'vat_number' || rawQueryType === 'company_name'
      ? rawQueryType
      : null;

  const peppolId = stripPrefixes(toText(input.peppol_id || input.peppolId || ''));
  const vatNumber = stripPrefixes(toText(input.vat_number || input.vatNumber || ''));
  const companyName = stripPrefixes(toText(input.company_name || input.companyName || ''));
  const query = stripPrefixes(toText(input.query || ''));
  const country = toText(input.country || '').toUpperCase();

  const query_type =
    forcedType ||
    (peppolId ? 'peppol_id' : vatNumber ? 'vat_number' : companyName ? 'company_name' : detectModeFromQuery(query));

  const payload = { query_type };

  if (query_type === 'peppol_id') {
    const value = peppolId || query;
    if (!value) return null;
    return { ...payload, peppol_id: value, query: value, ...(country ? { country } : {}) };
  }

  if (query_type === 'vat_number') {
    const value = vatNumber || query;
    if (!value) return null;
    return { ...payload, vat_number: value, query: value, ...(country ? { country } : {}) };
  }

  const value = companyName || query;
  if (!value) return null;
  return { ...payload, company_name: value, query: value, ...(country ? { country } : {}) };
};
