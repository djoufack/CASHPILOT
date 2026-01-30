/**
 * CSV Parser for Chart of Accounts import
 * Supports: semicolon (;), comma (,), and tab (\t) delimiters
 * Auto-detects delimiter from first line
 */

const VALID_ACCOUNT_TYPES = ['asset', 'liability', 'equity', 'revenue', 'expense'];

const COLUMN_ALIASES = {
  account_code: ['account_code', 'code', 'numero', 'num', 'compte', 'account_number', 'code_compte'],
  account_name: ['account_name', 'name', 'nom', 'libelle', 'label', 'intitule', 'designation'],
  account_type: ['account_type', 'type', 'classe', 'class', 'category_type'],
  account_category: ['account_category', 'category', 'categorie', 'sous_classe', 'sub_class', 'group', 'groupe'],
  parent_code: ['parent_code', 'parent', 'code_parent', 'parent_account'],
  description: ['description', 'desc', 'commentaire', 'comment', 'note', 'notes']
};

/**
 * Detect the delimiter used in the CSV content
 */
export function detectDelimiter(content) {
  const firstLine = content.split('\n')[0] || '';
  const semicolons = (firstLine.match(/;/g) || []).length;
  const commas = (firstLine.match(/,/g) || []).length;
  const tabs = (firstLine.match(/\t/g) || []).length;

  if (semicolons >= commas && semicolons >= tabs) return ';';
  if (tabs >= commas && tabs >= semicolons) return '\t';
  return ',';
}

/**
 * Map header columns to standard field names using aliases
 */
export function mapColumns(headers) {
  const mapping = {};
  const normalizedHeaders = headers.map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'));

  for (const [standardName, aliases] of Object.entries(COLUMN_ALIASES)) {
    const index = normalizedHeaders.findIndex(h => aliases.includes(h));
    if (index !== -1) {
      mapping[standardName] = index;
    }
  }

  return mapping;
}

/**
 * Parse a CSV string into an array of account objects
 * @param {string} content - Raw CSV content
 * @returns {{ accounts: Array, errors: Array, headers: string[], delimiter: string }}
 */
export function parseCSV(content) {
  // Remove BOM if present
  const cleanContent = content.replace(/^\uFEFF/, '').trim();

  if (!cleanContent) {
    return { accounts: [], errors: [{ line: 0, message: 'Fichier vide' }], headers: [], delimiter: ',' };
  }

  const delimiter = detectDelimiter(cleanContent);
  const lines = cleanContent.split(/\r?\n/).filter(line => line.trim());

  if (lines.length < 2) {
    return { accounts: [], errors: [{ line: 0, message: 'Le fichier doit contenir un en-tête et au moins une ligne de données' }], headers: [], delimiter };
  }

  const headers = lines[0].split(delimiter).map(h => h.trim());
  const columnMap = mapColumns(headers);

  if (columnMap.account_code === undefined) {
    return { accounts: [], errors: [{ line: 1, message: 'Colonne "account_code" (ou "code", "numero", "compte") introuvable dans l\'en-tête' }], headers, delimiter };
  }

  if (columnMap.account_name === undefined) {
    return { accounts: [], errors: [{ line: 1, message: 'Colonne "account_name" (ou "nom", "libelle", "label") introuvable dans l\'en-tête' }], headers, delimiter };
  }

  const accounts = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = lines[i].split(delimiter).map(c => c.trim());
    const lineNum = i + 1;

    const code = cells[columnMap.account_code] || '';
    const name = cells[columnMap.account_name] || '';

    if (!code) {
      errors.push({ line: lineNum, message: `Code de compte manquant` });
      continue;
    }

    if (!name) {
      errors.push({ line: lineNum, message: `Nom de compte manquant pour le code "${code}"` });
      continue;
    }

    let accountType = columnMap.account_type !== undefined ? (cells[columnMap.account_type] || '').toLowerCase() : '';

    // Auto-detect type from account code if not specified
    if (!accountType || !VALID_ACCOUNT_TYPES.includes(accountType)) {
      accountType = guessAccountType(code);
    }

    const account = {
      account_code: code,
      account_name: name,
      account_type: accountType,
      account_category: columnMap.account_category !== undefined ? cells[columnMap.account_category] || '' : '',
      parent_code: columnMap.parent_code !== undefined ? cells[columnMap.parent_code] || '' : '',
      description: columnMap.description !== undefined ? cells[columnMap.description] || '' : '',
      is_active: true
    };

    accounts.push(account);
  }

  return { accounts, errors, headers, delimiter };
}

/**
 * Guess account type from account code (PCG/PCMN convention)
 * Class 1: equity/liability, Class 2-5: asset, Class 6: expense, Class 7: revenue
 */
function guessAccountType(code) {
  const firstDigit = code.charAt(0);
  switch (firstDigit) {
    case '1': return 'equity';
    case '2': return 'asset';       // Immobilisations
    case '3': return 'asset';       // Stocks
    case '4': return 'asset';       // Tiers (simplification)
    case '5': return 'asset';       // Trésorerie
    case '6': return 'expense';     // Charges
    case '7': return 'revenue';     // Produits
    case '8': return 'expense';     // Comptes spéciaux
    case '9': return 'expense';     // Analytique
    default: return 'asset';
  }
}

/**
 * Get a preview of the parsed CSV (first N rows)
 */
export function getCSVPreview(content, maxRows = 10) {
  const { accounts, errors, headers, delimiter } = parseCSV(content);
  return {
    headers,
    delimiter,
    preview: accounts.slice(0, maxRows),
    totalRows: accounts.length,
    errorCount: errors.length,
    errors: errors.slice(0, 5)
  };
}
