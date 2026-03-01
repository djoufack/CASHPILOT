const ISO_CURRENCY_CODE = /^[A-Z]{3}$/;

const normalizeCurrency = (value) => {
  if (typeof value !== 'string') return null;

  const normalized = value.trim().toUpperCase();
  return ISO_CURRENCY_CODE.test(normalized) ? normalized : null;
};

const collectCurrencyCandidates = (entity) => {
  if (!entity || typeof entity !== 'object') return [];

  return [
    entity.currency,
    entity.preferred_currency,
    entity.default_currency,
    entity.client?.preferred_currency,
    entity.client?.currency,
    entity.company?.currency,
  ];
};

export const resolveInvoiceCurrency = (invoice, ...relatedEntities) => {
  const candidates = [
    ...collectCurrencyCandidates(invoice),
    ...relatedEntities.flatMap(collectCurrencyCandidates),
    'EUR',
  ];

  for (const candidate of candidates) {
    const normalized = normalizeCurrency(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return 'EUR';
};

export default {
  resolveInvoiceCurrency,
};
