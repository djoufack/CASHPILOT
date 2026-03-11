const GENERIC_SERVICE_NAME_REGEX = /^(service|services|prestation|prestations|offre|item|ligne)(\s*[-#]?\s*\d+)?$/i;

const toTrimmedString = (value) => String(value || '').trim();

const toNumberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export const isGenericServiceName = (name) => GENERIC_SERVICE_NAME_REGEX.test(toTrimmedString(name));

export const validateServiceCatalogPayload = (payload = {}, options = {}) => {
  const { context = 'client' } = options;
  const errors = [];

  const serviceName = toTrimmedString(payload.service_name);
  const pricingType = toTrimmedString(payload.pricing_type || 'hourly');
  const unit = toTrimmedString(payload.unit);
  const hourlyRate = toNumberOrNull(payload.hourly_rate);
  const fixedPrice = toNumberOrNull(payload.fixed_price);
  const unitPrice = toNumberOrNull(payload.unit_price);

  if (serviceName.length < 4) {
    errors.push('Le nom du service doit contenir au moins 4 caracteres.');
  }

  if (isGenericServiceName(serviceName)) {
    const scopeLabel = context === 'supplier' ? 'service fournisseur' : 'prestation client';
    errors.push(`Nom trop generique pour une ${scopeLabel}. Utilisez un libelle explicite.`);
  }

  if (!['hourly', 'fixed', 'per_unit'].includes(pricingType)) {
    errors.push('Type de tarification invalide.');
  }

  if (pricingType === 'hourly' && !(hourlyRate > 0)) {
    errors.push('Le taux horaire doit etre strictement positif.');
  }

  if (pricingType === 'fixed' && !(fixedPrice > 0)) {
    errors.push('Le prix forfaitaire doit etre strictement positif.');
  }

  if (pricingType === 'per_unit') {
    if (!(unitPrice > 0)) {
      errors.push('Le prix unitaire doit etre strictement positif.');
    }
    if (!unit) {
      errors.push('L unite est obligatoire pour un tarif a l unite.');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

export const validateInvoiceCatalogConsistency = (items = []) => {
  const errors = [];

  items.forEach((rawItem, index) => {
    const item = rawItem || {};
    const itemType = toTrimmedString(item.item_type || item.itemType || 'manual').toLowerCase();
    const line = index + 1;

    if (itemType === 'service' && !item.service_id) {
      errors.push(`Ligne ${line}: une prestation client doit etre rattachee a un service du catalogue.`);
    }

    if (itemType === 'product' && !item.product_id) {
      errors.push(`Ligne ${line}: un produit facture doit etre rattache a une fiche produit.`);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
};

