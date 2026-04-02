import { sanitizeText } from '@/utils/sanitize';

const SEVERITY_BLOCKING = 'blocking';
const SEVERITY_WARNING = 'warning';

const ENTITY_LABELS = {
  invoice: 'facture',
  invoice_item: 'ligne de facture',
  expense: 'depense',
  payable: 'dette fournisseur',
  receivable: 'creance client',
  debt_payment: 'paiement',
};

const NUMERIC_FIELDS = ['amount', 'amount_paid', 'total', 'total_ht', 'total_ttc', 'balance_due', 'tax_rate'];

const toNumber = (value) => {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = String(value).replace(/\s/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const isValidIsoDate = (value) => {
  if (!value) return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
};

const normalizeStringValue = (value) => {
  if (typeof value !== 'string') return value;
  return sanitizeText(value).trim();
};

const issue = (severity, code, field, message, howToFix) => ({
  severity,
  code,
  field,
  message,
  howToFix,
});

const correction = (field, message) => ({ field, message });

const normalizePayload = (payload = {}) => {
  const normalized = { ...payload };

  Object.keys(normalized).forEach((key) => {
    normalized[key] = normalizeStringValue(normalized[key]);
  });

  return normalized;
};

const normalizeNumericFields = (payload, { blockingIssues, warnings, corrections }) => {
  NUMERIC_FIELDS.forEach((field) => {
    if (payload[field] === undefined || payload[field] === null || payload[field] === '') return;

    const parsed = toNumber(payload[field]);
    if (parsed === null) {
      blockingIssues.push(
        issue(
          SEVERITY_BLOCKING,
          'invalid_number',
          field,
          `Le champ ${field} contient une valeur numerique invalide.`,
          'Utilisez uniquement des chiffres avec un separateur decimal (ex: 1250.50).'
        )
      );
      return;
    }

    if (payload[field] !== parsed) {
      corrections.push(correction(field, `${field} a ete normalise en valeur numerique.`));
      payload[field] = parsed;
    }

    if (parsed < 0) {
      blockingIssues.push(
        issue(
          SEVERITY_BLOCKING,
          'negative_amount',
          field,
          `Le champ ${field} ne peut pas etre negatif.`,
          'Saisissez une valeur positive ou nulle selon le cas.'
        )
      );
    }
  });

  if (payload.tax_rate !== undefined && payload.tax_rate !== null && payload.tax_rate !== '') {
    const taxRate = toNumber(payload.tax_rate);
    if (taxRate === null) {
      blockingIssues.push(
        issue(
          SEVERITY_BLOCKING,
          'invalid_tax_rate',
          'tax_rate',
          'Le taux de TVA est invalide.',
          'Saisissez un taux compris entre 0 et 100 (ex: 21).'
        )
      );
      return;
    }

    if (taxRate > 0 && taxRate <= 1) {
      payload.tax_rate = Number((taxRate * 100).toFixed(4));
      corrections.push(correction('tax_rate', 'Taux TVA converti automatiquement en pourcentage (x100).'));
    }

    if (payload.tax_rate < 0 || payload.tax_rate > 100) {
      blockingIssues.push(
        issue(
          SEVERITY_BLOCKING,
          'tax_rate_out_of_range',
          'tax_rate',
          'Le taux de TVA doit etre compris entre 0 et 100.',
          'Corrigez le taux TVA avant de sauvegarder.'
        )
      );
    }
  }

  if (payload.total_ttc != null && payload.total_ht != null && payload.total_ttc < payload.total_ht) {
    blockingIssues.push(
      issue(
        SEVERITY_BLOCKING,
        'totals_inconsistent',
        'total_ttc',
        'Le total TTC ne peut pas etre inferieur au total HT.',
        'Verifiez le montant HT et le taux TVA.'
      )
    );
  }

  if (payload.amount != null && payload.amount <= 0) {
    blockingIssues.push(
      issue(
        SEVERITY_BLOCKING,
        'amount_must_be_positive',
        'amount',
        'Le montant doit etre strictement positif.',
        'Saisissez un montant superieur a zero.'
      )
    );
  }

  if (payload.amount_paid != null && payload.amount_paid < 0) {
    blockingIssues.push(
      issue(
        SEVERITY_BLOCKING,
        'amount_paid_negative',
        'amount_paid',
        'Le montant deja paye ne peut pas etre negatif.',
        'Saisissez un montant paye positif ou nul.'
      )
    );
  }

  if (payload.amount != null && payload.amount_paid != null && payload.amount_paid > payload.amount) {
    blockingIssues.push(
      issue(
        SEVERITY_BLOCKING,
        'amount_paid_exceeds_amount',
        'amount_paid',
        'Le montant deja paye depasse le montant total.',
        'Reduisez le montant paye ou ajustez le montant total.'
      )
    );
  }

  if (payload.currency) {
    const normalizedCurrency = String(payload.currency).toUpperCase();
    if (payload.currency !== normalizedCurrency) {
      payload.currency = normalizedCurrency;
      corrections.push(correction('currency', 'Devise normalisee en majuscules.'));
    }
    if (normalizedCurrency.length !== 3) {
      warnings.push(
        issue(
          SEVERITY_WARNING,
          'currency_format',
          'currency',
          'Le code devise semble invalide.',
          'Utilisez un code ISO a 3 lettres (EUR, USD, XAF...).'
        )
      );
    }
  }
};

const validateDates = (payload, { blockingIssues }) => {
  const pairs = [
    ['issue_date', 'due_date'],
    ['invoice_date', 'due_date'],
    ['expense_date', 'due_date'],
  ];

  ['issue_date', 'invoice_date', 'expense_date', 'due_date', 'payment_date'].forEach((field) => {
    if (!payload[field]) return;
    if (!isValidIsoDate(payload[field])) {
      blockingIssues.push(
        issue(
          SEVERITY_BLOCKING,
          'invalid_date',
          field,
          `La date ${field} est invalide.`,
          'Utilisez le format AAAA-MM-JJ.'
        )
      );
    }
  });

  pairs.forEach(([startField, endField]) => {
    if (!payload[startField] || !payload[endField]) return;
    if (!isValidIsoDate(payload[startField]) || !isValidIsoDate(payload[endField])) return;
    const start = new Date(payload[startField]);
    const end = new Date(payload[endField]);
    if (end < start) {
      blockingIssues.push(
        issue(
          SEVERITY_BLOCKING,
          'date_range_invalid',
          endField,
          `La date ${endField} ne peut pas etre avant ${startField}.`,
          'Corrigez la periode avant sauvegarde.'
        )
      );
    }
  });
};

const validateInvoice = ({ payload, items, operation, blockingIssues, warnings, corrections }) => {
  if (operation === 'create' && !payload.client_id) {
    blockingIssues.push(
      issue(
        SEVERITY_BLOCKING,
        'missing_client',
        'client_id',
        'Une facture doit etre rattachee a un client.',
        'Selectionnez un client avant de sauvegarder.'
      )
    );
  }

  if (items.length === 0 && !(payload.total_ttc > 0 || payload.total > 0)) {
    blockingIssues.push(
      issue(
        SEVERITY_BLOCKING,
        'empty_invoice',
        'items',
        'La facture ne contient aucune ligne ni total valide.',
        'Ajoutez au moins une ligne de facture ou un total TTC positif.'
      )
    );
  }

  const sanitizedItems = items.map((rawItem, index) => {
    const item = normalizePayload(rawItem || {});
    const line = index + 1;
    const quantity = toNumber(item.quantity);
    const unitPrice = toNumber(item.unit_price ?? item.unitPrice);

    if (quantity === null || quantity <= 0) {
      blockingIssues.push(
        issue(
          SEVERITY_BLOCKING,
          'invoice_item_quantity',
          'quantity',
          `Ligne ${line}: la quantite doit etre strictement positive.`,
          'Saisissez une quantite superieure a zero.'
        )
      );
    } else {
      item.quantity = quantity;
    }

    if (unitPrice === null || unitPrice < 0) {
      blockingIssues.push(
        issue(
          SEVERITY_BLOCKING,
          'invoice_item_unit_price',
          'unit_price',
          `Ligne ${line}: le prix unitaire est invalide.`,
          'Saisissez un prix unitaire positif ou nul.'
        )
      );
    } else {
      if (item.unit_price !== unitPrice) {
        corrections.push(correction(`items[${index}].unit_price`, `Ligne ${line}: prix unitaire normalise.`));
      }
      item.unit_price = unitPrice;
    }

    if (!item.description) {
      warnings.push(
        issue(
          SEVERITY_WARNING,
          'invoice_item_description',
          'description',
          `Ligne ${line}: description vide.`,
          'Ajoutez une description explicite pour faciliter le controle comptable.'
        )
      );
    }

    return item;
  });

  return sanitizedItems;
};

const validateDebtPayment = ({ payload, blockingIssues, warnings, corrections, options }) => {
  if (!(payload.amount > 0)) {
    blockingIssues.push(
      issue(
        SEVERITY_BLOCKING,
        'payment_amount_invalid',
        'amount',
        'Le montant du paiement doit etre strictement positif.',
        'Saisissez un montant superieur a zero.'
      )
    );
  }

  if (!payload.payment_method) {
    payload.payment_method = 'cash';
    corrections.push(correction('payment_method', 'Mode de paiement renseigne automatiquement sur "cash".'));
  }

  if (options.maxAmount != null && payload.amount > options.maxAmount) {
    blockingIssues.push(
      issue(
        SEVERITY_BLOCKING,
        'payment_above_remaining',
        'amount',
        'Le paiement depasse le solde restant.',
        'Saisissez un montant inferieur ou egal au solde restant.'
      )
    );
  }

  if (payload.notes && payload.notes.length > 500) {
    warnings.push(
      issue(
        SEVERITY_WARNING,
        'payment_notes_length',
        'notes',
        'La note de paiement est tres longue.',
        'Raccourcissez la note pour faciliter les revues.'
      )
    );
  }
};

export const runDataEntryGuard = ({
  entity,
  operation = 'upsert',
  payload = {},
  items = [],
  referencePayload = null,
  options = {},
} = {}) => {
  const blockingIssues = [];
  const warnings = [];
  const corrections = [];
  let sanitizedPayload = normalizePayload(payload);
  const mergedPayload = referencePayload ? { ...referencePayload, ...sanitizedPayload } : sanitizedPayload;

  normalizeNumericFields(sanitizedPayload, { blockingIssues, warnings, corrections });
  validateDates(sanitizedPayload, { blockingIssues });

  if (entity === 'invoice') {
    if (operation === 'create' && !sanitizedPayload.invoice_number) {
      warnings.push(
        issue(
          SEVERITY_WARNING,
          'invoice_number_auto',
          'invoice_number',
          'Le numero de facture sera genere automatiquement.',
          'Vous pouvez le renseigner manuellement si votre procedure l exige.'
        )
      );
    }
  }

  if (entity === 'payable' || entity === 'receivable' || entity === 'expense') {
    if (operation === 'create' && sanitizedPayload.amount == null) {
      blockingIssues.push(
        issue(
          SEVERITY_BLOCKING,
          'missing_amount',
          'amount',
          `Le montant est obligatoire pour cette ${ENTITY_LABELS[entity] || entity}.`,
          'Saisissez un montant avant de sauvegarder.'
        )
      );
    }

    const mergedAmount = toNumber(mergedPayload.amount);
    const mergedAmountPaid = toNumber(mergedPayload.amount_paid);
    if (mergedAmount != null && mergedAmountPaid != null && mergedAmountPaid > mergedAmount) {
      blockingIssues.push(
        issue(
          SEVERITY_BLOCKING,
          'paid_above_total',
          'amount_paid',
          'Le montant paye depasse le total du document.',
          'Corrigez le montant paye ou le total.'
        )
      );
    }
  }

  let sanitizedItems = Array.isArray(items) ? items : [];
  if (entity === 'invoice') {
    sanitizedItems = validateInvoice({
      payload: sanitizedPayload,
      items: sanitizedItems,
      operation,
      blockingIssues,
      warnings,
      corrections,
    });
  }

  if (entity === 'invoice_item') {
    sanitizedItems = validateInvoice({
      payload: {},
      items: [sanitizedPayload],
      operation,
      blockingIssues,
      warnings,
      corrections,
    });
    sanitizedPayload = sanitizedItems[0] || sanitizedPayload;
  }

  if (entity === 'debt_payment') {
    validateDebtPayment({
      payload: sanitizedPayload,
      blockingIssues,
      warnings,
      corrections,
      options,
    });
  }

  return {
    entity,
    operation,
    isValid: blockingIssues.length === 0,
    blockingIssues,
    warnings,
    corrections,
    sanitizedPayload,
    sanitizedItems: entity === 'invoice_item' ? sanitizedItems[0] || sanitizedPayload : sanitizedItems,
  };
};
