const VERSION_KEY_SEPARATOR = ':';

export const GED_VERSION_SOURCE_TABLES = new Set([
  'invoices',
  'quotes',
  'credit_notes',
  'delivery_notes',
  'purchase_orders',
  'supplier_invoices',
]);

export const makeGedVersionKey = (sourceTable, sourceId) =>
  `${String(sourceTable || '').trim()}${VERSION_KEY_SEPARATOR}${String(sourceId || '').trim()}`;

export const sanitizeGedVersionFileName = (value) =>
  String(value || 'document')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');

export const buildGedVersionStoragePath = ({ userId, sourceTable, sourceId, version, contentHash, fileName }) => {
  const safeFileName = sanitizeGedVersionFileName(fileName || 'document.bin');
  const hashSegment = String(contentHash || 'hashless').slice(0, 12);
  return `${String(userId || 'anonymous')}/${sourceTable}/${sourceId}/v${version}-${hashSegment}-${safeFileName}`;
};

export const buildGedDocumentVersionIndex = (rows = []) => {
  const index = new Map();

  for (const row of rows || []) {
    if (!row?.source_table || !row?.source_id) continue;

    const key = makeGedVersionKey(row.source_table, row.source_id);
    const version = Number(row.version) || 0;
    const current = index.get(key);

    if (!current) {
      index.set(key, {
        sourceTable: row.source_table,
        sourceId: row.source_id,
        currentVersion: version,
        versionCount: 1,
        latestHash: row.content_hash || null,
        latestRow: row,
      });
      continue;
    }

    const nextVersion = Math.max(current.currentVersion || 0, version);
    const latestRow = nextVersion === version ? row : current.latestRow;

    index.set(key, {
      ...current,
      currentVersion: nextVersion,
      versionCount: current.versionCount + 1,
      latestHash: latestRow?.content_hash || current.latestHash || null,
      latestRow,
    });
  }

  return index;
};

export const getGedDocumentVersionSummary = (document, versionIndex = new Map()) => {
  if (!document?.sourceTable || !document?.sourceId) {
    const fallbackVersion = document?.fileUrl ? 1 : 0;
    return {
      currentVersion: fallbackVersion,
      versionCount: fallbackVersion,
      latestHash: null,
      latestRow: null,
      hasVersionHistory: false,
    };
  }

  const summary = versionIndex.get(makeGedVersionKey(document.sourceTable, document.sourceId));
  if (summary) {
    return {
      currentVersion: summary.currentVersion || 0,
      versionCount: summary.versionCount || 0,
      latestHash: summary.latestHash || null,
      latestRow: summary.latestRow || null,
      hasVersionHistory: (summary.versionCount || 0) > 1,
    };
  }

  const fallbackVersion = document.fileUrl ? 1 : 0;
  return {
    currentVersion: fallbackVersion,
    versionCount: fallbackVersion,
    latestHash: null,
    latestRow: null,
    hasVersionHistory: false,
  };
};

export const enrichDocumentsWithGedVersionInfo = (documents = [], versionIndex = new Map()) =>
  (documents || []).map((document) => ({
    ...document,
    ...getGedDocumentVersionSummary(document, versionIndex),
  }));

const toArrayBuffer = async (input) => {
  if (!input) {
    throw new Error('Impossible de lire le contenu du fichier.');
  }

  if (typeof input.arrayBuffer === 'function') {
    return input.arrayBuffer();
  }

  if (input instanceof ArrayBuffer) {
    return input;
  }

  if (ArrayBuffer.isView(input)) {
    return input.buffer.slice(input.byteOffset, input.byteOffset + input.byteLength);
  }

  throw new Error('Impossible de lire le contenu du fichier.');
};

export const computeBlobSha256Hex = async (input) => {
  const buffer = await toArrayBuffer(input);
  const digest = await globalThis.crypto?.subtle?.digest?.('SHA-256', buffer);
  if (!digest) {
    throw new Error('Le navigateur ne permet pas le calcul du hash du fichier.');
  }

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
};
