const DEFAULT_RETENTION_CATEGORY = 'all';

const normalizeKey = (value) =>
  String(value ?? '')
    .trim()
    .toLowerCase();

const normalizeCategory = (value) => {
  const raw = normalizeKey(value);
  if (!raw || raw === '*') return DEFAULT_RETENTION_CATEGORY;
  return raw;
};

export const GED_RETENTION_DOC_CATEGORIES = new Set([DEFAULT_RETENTION_CATEGORY, 'general', 'accounting']);

export const makeGedRetentionPolicyKey = (companyId, sourceTable, docCategory = DEFAULT_RETENTION_CATEGORY) =>
  `${normalizeKey(companyId)}:${normalizeKey(sourceTable)}:${normalizeCategory(docCategory)}`;

export const normalizeGedRetentionDays = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  const rounded = Math.floor(numeric);
  return rounded > 0 ? rounded : null;
};

export const computeRetentionUntilFromDays = (baseDate, retentionDays) => {
  const days = normalizeGedRetentionDays(retentionDays);
  if (!days) return null;

  const sourceDate = baseDate ? new Date(baseDate) : new Date();
  if (Number.isNaN(sourceDate.getTime())) {
    return null;
  }

  sourceDate.setUTCDate(sourceDate.getUTCDate() + days);
  return sourceDate.toISOString().slice(0, 10);
};

export const resolveGedRetentionPolicy = (policies = [], { sourceTable, docCategory } = {}) => {
  const normalizedSourceTable = normalizeKey(sourceTable);
  const normalizedCategory = normalizeCategory(docCategory);
  const normalizedPolicies = Array.isArray(policies)
    ? policies.filter(
        (policy) => normalizeKey(policy?.source_table) === normalizedSourceTable && policy?.is_active !== false
      )
    : [];

  const exactMatch = normalizedPolicies.find(
    (policy) => normalizeCategory(policy?.doc_category) === normalizedCategory
  );
  if (exactMatch) {
    return exactMatch;
  }

  const genericMatch = normalizedPolicies.find(
    (policy) => normalizeCategory(policy?.doc_category) === DEFAULT_RETENTION_CATEGORY
  );
  if (genericMatch) {
    return genericMatch;
  }

  return null;
};

export const enrichGedDocumentsWithRetentionInfo = (documents = [], policies = []) =>
  (documents || []).map((document) => {
    const policy = resolveGedRetentionPolicy(policies, {
      sourceTable: document.sourceTable,
      docCategory: document.docCategory,
    });

    const effectiveRetentionUntil =
      document.retentionUntil ||
      computeRetentionUntilFromDays(
        document.createdAt || document.raw?.created_at || document.raw?.updated_at,
        policy?.retention_days
      );

    return {
      ...document,
      retentionPolicy: policy || null,
      retentionDays: normalizeGedRetentionDays(policy?.retention_days),
      effectiveRetentionUntil,
      isRetentionAutomatic: !document.retentionUntil && !!policy,
    };
  });

export const normalizeGedRetentionPolicyPayload = (payload = {}) => {
  const sourceTable = normalizeKey(payload.sourceTable || payload.source_table);
  const docCategory = normalizeCategory(payload.docCategory || payload.doc_category);
  const retentionDays = normalizeGedRetentionDays(payload.retentionDays || payload.retention_days);

  if (!sourceTable) {
    throw new Error('Le type de document est obligatoire.');
  }

  if (!retentionDays) {
    throw new Error('La duree de retention doit etre un nombre de jours strictement positif.');
  }

  return {
    source_table: sourceTable,
    doc_category: docCategory,
    retention_days: retentionDays,
    is_active: payload.is_active !== false,
  };
};
