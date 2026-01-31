
/**
 * Bank Statement Parser — PDF, Excel, CSV
 * Extracts transaction lines from bank statement files.
 * Returns a uniform ParsedStatement structure regardless of input format.
 */

import * as XLSX from 'xlsx';

// ============================================================================
// FRENCH DATE & AMOUNT HELPERS
// ============================================================================

const DATE_PATTERNS = [
  /(\d{2})[\/\-.](\d{2})[\/\-.](\d{4})/,  // DD/MM/YYYY
  /(\d{2})[\/\-.](\d{2})[\/\-.](\d{2})/,   // DD/MM/YY
];

/**
 * Parse a French-formatted date string to ISO YYYY-MM-DD
 */
export function parseFrenchDate(str) {
  if (!str) return null;
  const s = String(str).trim();

  // Try ISO format first (already YYYY-MM-DD)
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Try Excel numeric date (serial number)
  if (/^\d{5}$/.test(s)) {
    const date = new Date((parseInt(s) - 25569) * 86400 * 1000);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  for (const pattern of DATE_PATTERNS) {
    const match = s.match(pattern);
    if (match) {
      let [, day, month, year] = match;
      if (year.length === 2) {
        year = parseInt(year) > 50 ? `19${year}` : `20${year}`;
      }
      const d = parseInt(day), m = parseInt(month), y = parseInt(year);
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2100) {
        return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      }
    }
  }

  // Try Date.parse as last resort
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return null;
}

/**
 * Parse a French-formatted amount string (e.g. "1 234,56" or "-1.234,56")
 */
export function parseFrenchAmount(str) {
  if (str === null || str === undefined) return null;
  if (typeof str === 'number') return isNaN(str) ? null : str;

  let s = String(str).trim();
  if (!s) return null;

  // Remove currency symbols
  s = s.replace(/[€$£]/g, '').trim();

  // Detect French format: spaces as thousands separator, comma as decimal
  // Also handle: 1.234,56 (European) and 1,234.56 (US)
  const hasCommaDecimal = /,\d{1,2}$/.test(s);
  const hasDotDecimal = /\.\d{1,2}$/.test(s);

  if (hasCommaDecimal) {
    // French/European: remove dots and spaces (thousands), replace comma with dot
    s = s.replace(/[\s.]/g, '').replace(',', '.');
  } else if (hasDotDecimal) {
    // US format: remove commas and spaces (thousands)
    s = s.replace(/[\s,]/g, '');
  } else {
    // No decimal: remove all separators
    s = s.replace(/[\s.,]/g, '');
  }

  const num = parseFloat(s);
  return isNaN(num) ? null : num;
}

// ============================================================================
// COLUMN ALIAS MAPPING (for Excel/CSV)
// ============================================================================

const BANK_COLUMN_ALIASES = {
  date: ['date', 'date_operation', 'date_op', 'date_comptable', 'date opération', 'date comptable', 'date operation', 'dt_op', 'date_mouvement'],
  value_date: ['date_valeur', 'date valeur', 'value_date', 'dt_val', 'date de valeur'],
  description: ['libelle', 'libellé', 'description', 'label', 'intitule', 'intitulé', 'operation', 'opération', 'motif', 'communication', 'libellé opération', 'libelle operation', 'détail', 'detail'],
  reference: ['reference', 'référence', 'ref', 'num_operation', 'n° opération', 'numero', 'numéro', 'ref_operation'],
  debit: ['debit', 'débit', 'montant_debit', 'sortie', 'retrait', 'debit (eur)', 'débit (eur)', 'montant débit'],
  credit: ['credit', 'crédit', 'montant_credit', 'entree', 'entrée', 'versement', 'credit (eur)', 'crédit (eur)', 'montant crédit'],
  amount: ['montant', 'amount', 'somme', 'valeur', 'montant (eur)', 'montant eur'],
  balance: ['solde', 'balance', 'solde_apres', 'solde après', 'solde comptable', 'solde (eur)']
};

/**
 * Map header names to standard field names using aliases
 */
function mapBankColumns(headers) {
  const mapping = {};
  const normalizedHeaders = headers.map(h =>
    String(h || '').toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  );

  for (const [standardName, aliases] of Object.entries(BANK_COLUMN_ALIASES)) {
    const normalizedAliases = aliases.map(a =>
      a.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    );

    for (let i = 0; i < normalizedHeaders.length; i++) {
      const header = normalizedHeaders[i];
      if (normalizedAliases.some(alias => header === alias || header.includes(alias))) {
        if (!mapping[standardName]) {
          mapping[standardName] = i;
        }
        break;
      }
    }
  }

  return mapping;
}

/**
 * Detect header row in an array of rows (scan first 15 rows)
 */
function detectHeaderRow(rows, maxScan = 15) {
  const keywords = ['date', 'libelle', 'libellé', 'montant', 'debit', 'débit', 'credit', 'crédit', 'description', 'amount', 'solde', 'balance', 'operation', 'opération'];

  for (let i = 0; i < Math.min(rows.length, maxScan); i++) {
    const row = rows[i];
    if (!row || !Array.isArray(row)) continue;

    const cellTexts = row.map(c => String(c || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''));
    const matchCount = cellTexts.filter(t => keywords.some(k => t.includes(k))).length;

    if (matchCount >= 2) {
      return i;
    }
  }

  return -1;
}

// ============================================================================
// NORMALIZE LINE TO UNIFIED FORMAT
// ============================================================================

function normalizeAmount(debit, credit, amount) {
  // If we have separate debit/credit columns
  const deb = parseFrenchAmount(debit);
  const cred = parseFrenchAmount(credit);
  const amt = parseFrenchAmount(amount);

  if (deb !== null && deb !== 0) return -Math.abs(deb);
  if (cred !== null && cred !== 0) return Math.abs(cred);
  if (amt !== null) return amt;
  if (deb === 0 && cred === 0) return 0;
  return null;
}

// ============================================================================
// EXCEL PARSER
// ============================================================================

export async function parseBankStatementExcel(file) {
  const errors = [];
  const lines = [];
  const metadata = { bankName: null, accountNumber: null, periodStart: null, periodEnd: null, openingBalance: null, closingBalance: null };

  try {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });

    // Pick best sheet
    const sheetNames = workbook.SheetNames;
    const targetNames = ['opérations', 'operations', 'relevé', 'releve', 'mouvements', 'compte', 'extrait'];
    let sheetName = sheetNames.find(name =>
      targetNames.some(t => name.toLowerCase().includes(t))
    ) || sheetNames[0];

    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

    if (rawRows.length < 2) {
      errors.push({ line: 0, message: 'Le fichier semble vide ou ne contient pas assez de lignes.' });
      return { lines, errors, metadata };
    }

    // Detect header row
    const headerRowIdx = detectHeaderRow(rawRows);
    if (headerRowIdx === -1) {
      errors.push({ line: 0, message: 'Impossible de détecter la ligne d\'en-tête. Vérifiez que le fichier contient des colonnes Date, Libellé, Montant.' });
      return { lines, errors, metadata };
    }

    const headers = rawRows[headerRowIdx];
    const columnMap = mapBankColumns(headers);

    // Validate minimum required columns
    if (columnMap.date === undefined) {
      errors.push({ line: headerRowIdx + 1, message: 'Colonne "Date" non détectée.' });
      return { lines, errors, metadata };
    }

    if (columnMap.amount === undefined && columnMap.debit === undefined && columnMap.credit === undefined) {
      errors.push({ line: headerRowIdx + 1, message: 'Aucune colonne de montant détectée (Montant, Débit, Crédit).' });
      return { lines, errors, metadata };
    }

    // Parse data rows
    for (let i = headerRowIdx + 1; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || row.every(c => !c && c !== 0)) continue;

      const dateRaw = row[columnMap.date];
      let date;

      // Handle Date objects from xlsx cellDates
      if (dateRaw instanceof Date) {
        date = dateRaw.toISOString().split('T')[0];
      } else {
        date = parseFrenchDate(dateRaw);
      }

      if (!date) {
        // Skip rows without valid dates (likely summary rows)
        continue;
      }

      const description = columnMap.description !== undefined ? String(row[columnMap.description] || '').trim() : '';
      const reference = columnMap.reference !== undefined ? String(row[columnMap.reference] || '').trim() : '';
      const balance = columnMap.balance !== undefined ? parseFrenchAmount(row[columnMap.balance]) : null;

      let valueDateRaw = columnMap.value_date !== undefined ? row[columnMap.value_date] : null;
      let valueDate = null;
      if (valueDateRaw instanceof Date) {
        valueDate = valueDateRaw.toISOString().split('T')[0];
      } else if (valueDateRaw) {
        valueDate = parseFrenchDate(valueDateRaw);
      }

      const debitRaw = columnMap.debit !== undefined ? row[columnMap.debit] : undefined;
      const creditRaw = columnMap.credit !== undefined ? row[columnMap.credit] : undefined;
      const amountRaw = columnMap.amount !== undefined ? row[columnMap.amount] : undefined;

      const amount = normalizeAmount(debitRaw, creditRaw, amountRaw);

      if (amount === null) {
        errors.push({ line: i + 1, message: `Montant invalide à la ligne ${i + 1}` });
        continue;
      }

      lines.push({
        lineNumber: lines.length + 1,
        date,
        valueDate,
        description,
        reference: reference || null,
        amount,
        balance,
        rawData: Object.fromEntries(headers.map((h, idx) => [h, row[idx]]))
      });
    }

    // Extract metadata from dates
    if (lines.length > 0) {
      const dates = lines.map(l => l.date).sort();
      metadata.periodStart = dates[0];
      metadata.periodEnd = dates[dates.length - 1];

      // Try to get opening/closing balance
      if (lines[0].balance !== null) {
        metadata.openingBalance = lines[0].balance - lines[0].amount;
      }
      if (lines[lines.length - 1].balance !== null) {
        metadata.closingBalance = lines[lines.length - 1].balance;
      }
    }

  } catch (err) {
    errors.push({ line: 0, message: `Erreur de lecture du fichier Excel : ${err.message}` });
  }

  return { lines, errors, metadata };
}

// ============================================================================
// PDF PARSER
// ============================================================================

export async function parseBankStatementPDF(file) {
  const errors = [];
  const lines = [];
  const metadata = { bankName: null, accountNumber: null, periodStart: null, periodEnd: null, openingBalance: null, closingBalance: null };

  try {
    // Dynamic import to avoid bundling issues if pdfjs-dist not available
    const { pdfjsLib } = await import('./pdfWorkerSetup.js');

    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

    let allTextLines = [];
    let hasTextLayer = false;

    // Extract text from all pages
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();

      if (textContent.items.length > 0) hasTextLayer = true;

      // Group text items by Y coordinate to reconstruct lines
      const lineMap = new Map();
      for (const item of textContent.items) {
        const y = Math.round(item.transform[5]); // Y coordinate
        if (!lineMap.has(y)) lineMap.set(y, []);
        lineMap.get(y).push({
          text: item.str,
          x: item.transform[4] // X coordinate for ordering
        });
      }

      // Sort by Y descending (top to bottom), then X ascending (left to right)
      const sortedYs = [...lineMap.keys()].sort((a, b) => b - a);
      for (const y of sortedYs) {
        const items = lineMap.get(y).sort((a, b) => a.x - b.x);
        const lineText = items.map(i => i.text).join(' ').trim();
        if (lineText) {
          allTextLines.push(lineText);
        }
      }
    }

    if (!hasTextLayer) {
      errors.push({
        line: 0,
        message: 'Ce PDF semble être une image scannée et ne peut pas être lu automatiquement. Veuillez utiliser un export Excel de votre banque.'
      });
      return { lines, errors, metadata };
    }

    if (allTextLines.length < 3) {
      errors.push({ line: 0, message: 'Pas assez de contenu textuel détecté dans le PDF.' });
      return { lines, errors, metadata };
    }

    // Try to extract bank name from first few lines
    const headerLines = allTextLines.slice(0, 10).join(' ').toLowerCase();
    const bankPatterns = [
      { pattern: /cr[ée]dit mutuel/i, name: 'Crédit Mutuel' },
      { pattern: /bnp paribas/i, name: 'BNP Paribas' },
      { pattern: /soci[ée]t[ée] g[ée]n[ée]rale/i, name: 'Société Générale' },
      { pattern: /cr[ée]dit agricole/i, name: 'Crédit Agricole' },
      { pattern: /banque postale/i, name: 'La Banque Postale' },
      { pattern: /caisse d'[ée]pargne/i, name: "Caisse d'Épargne" },
      { pattern: /boursorama/i, name: 'Boursorama' },
      { pattern: /lcl/i, name: 'LCL' },
      { pattern: /qonto/i, name: 'Qonto' },
      { pattern: /shine/i, name: 'Shine' },
    ];
    for (const bp of bankPatterns) {
      if (bp.pattern.test(headerLines)) {
        metadata.bankName = bp.name;
        break;
      }
    }

    // Try to extract IBAN
    const ibanMatch = allTextLines.join(' ').match(/[A-Z]{2}\d{2}[\s]?[\d\s]{10,30}/);
    if (ibanMatch) {
      metadata.accountNumber = ibanMatch[0].replace(/\s/g, '').slice(0, 4) + '****' + ibanMatch[0].replace(/\s/g, '').slice(-4);
    }

    // Parse transaction lines using heuristics
    // A transaction line typically starts with a date DD/MM or DD/MM/YYYY
    const dateRegex = /^(\d{2}[\/\-\.]\d{2}(?:[\/\-\.]\d{2,4})?)/;
    const amountRegex = /(-?\d[\d\s]*[.,]\d{2})\s*$/;

    for (let i = 0; i < allTextLines.length; i++) {
      const line = allTextLines[i].trim();
      if (!line) continue;

      const dateMatch = line.match(dateRegex);
      if (!dateMatch) continue;

      const date = parseFrenchDate(dateMatch[1]);
      if (!date) continue;

      // Remove date from line to get the rest
      let rest = line.substring(dateMatch[0].length).trim();

      // Check if there's a second date (value_date) right after
      let valueDate = null;
      const secondDateMatch = rest.match(dateRegex);
      if (secondDateMatch) {
        valueDate = parseFrenchDate(secondDateMatch[1]);
        rest = rest.substring(secondDateMatch[0].length).trim();
      }

      // Extract amounts from the end of the line
      // Try to find 1 or 2 amounts at the end
      const amounts = [];
      let tempRest = rest;

      // Greedy: try to find amounts from the right
      for (let attempt = 0; attempt < 3; attempt++) {
        const amtMatch = tempRest.match(/(-?\s*\d[\d\s]*[.,]\d{2})\s*$/);
        if (amtMatch) {
          const val = parseFrenchAmount(amtMatch[1]);
          if (val !== null) {
            amounts.unshift(val);
            tempRest = tempRest.substring(0, amtMatch.index).trim();
          } else {
            break;
          }
        } else {
          break;
        }
      }

      if (amounts.length === 0) continue;

      const description = tempRest.trim();
      let amount;

      if (amounts.length === 1) {
        amount = amounts[0];
      } else if (amounts.length === 2) {
        // Could be debit/credit or amount/balance
        // If one is 0 and other is not, it's debit/credit
        if (amounts[0] === 0 && amounts[1] !== 0) {
          amount = amounts[1]; // credit
        } else if (amounts[1] === 0 && amounts[0] !== 0) {
          amount = -Math.abs(amounts[0]); // debit
        } else {
          // Both non-zero: assume first is amount, second is balance
          amount = amounts[0];
        }
      } else {
        // 3 values: likely debit, credit, balance
        amount = normalizeAmount(amounts[0], amounts[1], null);
        if (amount === null || amount === 0) amount = amounts[0] || amounts[1];
      }

      if (amount === null || amount === undefined) continue;

      lines.push({
        lineNumber: lines.length + 1,
        date,
        valueDate,
        description,
        reference: null,
        amount: Math.round(amount * 100) / 100,
        balance: amounts.length >= 2 ? amounts[amounts.length - 1] : null,
        rawData: { originalLine: line }
      });
    }

    // Extract period metadata
    if (lines.length > 0) {
      const dates = lines.map(l => l.date).sort();
      metadata.periodStart = dates[0];
      metadata.periodEnd = dates[dates.length - 1];
    }

    if (lines.length === 0) {
      errors.push({ line: 0, message: 'Aucune opération bancaire détectée dans le PDF. Le format de ce relevé n\'est peut-être pas supporté. Essayez avec un export Excel.' });
    }

  } catch (err) {
    errors.push({ line: 0, message: `Erreur de lecture du PDF : ${err.message}` });
  }

  return { lines, errors, metadata };
}

// ============================================================================
// CSV PARSER (for bank statements)
// ============================================================================

export async function parseBankStatementCSV(file) {
  const errors = [];
  const lines = [];
  const metadata = { bankName: null, accountNumber: null, periodStart: null, periodEnd: null, openingBalance: null, closingBalance: null };

  try {
    const content = await file.text();
    // Remove BOM
    const cleaned = content.replace(/^\uFEFF/, '');

    // Detect delimiter
    const firstLines = cleaned.split('\n').slice(0, 5);
    const delimiters = [';', ',', '\t'];
    let bestDelimiter = ';';
    let maxCount = 0;
    for (const d of delimiters) {
      const count = firstLines.reduce((sum, line) => sum + (line.split(d).length - 1), 0);
      if (count > maxCount) {
        maxCount = count;
        bestDelimiter = d;
      }
    }

    const allLines = cleaned.split('\n').map(l => l.trim()).filter(l => l);
    const rows = allLines.map(l => l.split(bestDelimiter).map(c => c.replace(/^"|"$/g, '').trim()));

    const headerRowIdx = detectHeaderRow(rows);
    if (headerRowIdx === -1) {
      errors.push({ line: 0, message: 'Impossible de détecter la ligne d\'en-tête dans le CSV.' });
      return { lines, errors, metadata };
    }

    const headers = rows[headerRowIdx];
    const columnMap = mapBankColumns(headers);

    if (columnMap.date === undefined) {
      errors.push({ line: 0, message: 'Colonne "Date" non détectée dans le CSV.' });
      return { lines, errors, metadata };
    }

    for (let i = headerRowIdx + 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length < 2) continue;

      const date = parseFrenchDate(row[columnMap.date]);
      if (!date) continue;

      const description = columnMap.description !== undefined ? row[columnMap.description] || '' : '';
      const reference = columnMap.reference !== undefined ? row[columnMap.reference] || null : null;
      const balance = columnMap.balance !== undefined ? parseFrenchAmount(row[columnMap.balance]) : null;
      const valueDate = columnMap.value_date !== undefined ? parseFrenchDate(row[columnMap.value_date]) : null;

      const debitRaw = columnMap.debit !== undefined ? row[columnMap.debit] : undefined;
      const creditRaw = columnMap.credit !== undefined ? row[columnMap.credit] : undefined;
      const amountRaw = columnMap.amount !== undefined ? row[columnMap.amount] : undefined;

      const amount = normalizeAmount(debitRaw, creditRaw, amountRaw);
      if (amount === null) {
        errors.push({ line: i + 1, message: `Montant invalide à la ligne ${i + 1}` });
        continue;
      }

      lines.push({
        lineNumber: lines.length + 1,
        date,
        valueDate,
        description,
        reference,
        amount,
        balance,
        rawData: Object.fromEntries(headers.map((h, idx) => [h, row[idx]]))
      });
    }

    if (lines.length > 0) {
      const dates = lines.map(l => l.date).sort();
      metadata.periodStart = dates[0];
      metadata.periodEnd = dates[dates.length - 1];
    }

  } catch (err) {
    errors.push({ line: 0, message: `Erreur de lecture du CSV : ${err.message}` });
  }

  return { lines, errors, metadata };
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

/**
 * Auto-detect file type and parse
 */
export async function parseBankStatement(file) {
  const name = file.name.toLowerCase();
  const type = file.type;

  if (name.endsWith('.xlsx') || name.endsWith('.xls') || type.includes('spreadsheet') || type.includes('excel')) {
    return parseBankStatementExcel(file);
  }

  if (name.endsWith('.pdf') || type === 'application/pdf') {
    return parseBankStatementPDF(file);
  }

  if (name.endsWith('.csv') || type === 'text/csv') {
    return parseBankStatementCSV(file);
  }

  return {
    lines: [],
    errors: [{ line: 0, message: `Format de fichier non supporté : ${name}. Utilisez PDF, Excel (.xlsx) ou CSV.` }],
    metadata: {}
  };
}

/**
 * Get a preview of parsed data (first N rows + summary)
 */
export function getBankStatementPreview(parsed, maxRows = 15) {
  const { lines, errors, metadata } = parsed;

  const totalCredits = lines.filter(l => l.amount > 0).reduce((s, l) => s + l.amount, 0);
  const totalDebits = lines.filter(l => l.amount < 0).reduce((s, l) => s + l.amount, 0);

  return {
    previewLines: lines.slice(0, maxRows),
    totalLines: lines.length,
    totalCredits: Math.round(totalCredits * 100) / 100,
    totalDebits: Math.round(totalDebits * 100) / 100,
    netAmount: Math.round((totalCredits + totalDebits) * 100) / 100,
    errorCount: errors.length,
    errors: errors.slice(0, 10),
    metadata,
    hasMore: lines.length > maxRows
  };
}
