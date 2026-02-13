import * as XLSX from 'xlsx';

/**
 * Download a Blob as a file
 * @param {Blob} blob - The blob to download
 * @param {string} filename - The filename for the download
 */
export const downloadFile = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Format a value for export based on its type
 * @param {*} value - The value to format
 * @param {string} type - Optional type hint ('date', 'currency', 'number')
 * @returns {*} The formatted value
 */
const formatValue = (value, type) => {
  if (value === null || value === undefined) return '';

  switch (type) {
    case 'date': {
      if (!value) return '';
      try {
        const date = new Date(value);
        if (isNaN(date.getTime())) return String(value);
        return date.toLocaleDateString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
        });
      } catch {
        return String(value);
      }
    }
    case 'currency':
    case 'number': {
      const num = Number(value);
      if (isNaN(num)) return String(value);
      return Math.round(num * 100) / 100;
    }
    default:
      return value;
  }
};

/**
 * Format raw data array using column definitions
 * @param {Object[]} data - Array of data objects
 * @param {Object[]} columns - Column definitions [{ key, header, type, width, accessor }]
 * @returns {Object[]} Formatted data with header names as keys
 */
export const formatDataForExport = (data, columns) => {
  return data.map((row) => {
    const formattedRow = {};
    columns.forEach((col) => {
      const rawValue = col.accessor ? col.accessor(row) : row[col.key];
      formattedRow[col.header] = formatValue(rawValue, col.type);
    });
    return formattedRow;
  });
};

/**
 * Export data to an Excel (.xlsx) file
 * @param {Object[]} data - Array of objects to export
 * @param {Object} options - Export options
 * @param {string} [options.filename='export'] - Filename without extension
 * @param {string} [options.sheetName='Data'] - Sheet name
 * @param {Object[]} [options.columns] - Column definitions [{ key, header, type, width, accessor }]
 * @param {string} [options.format='xlsx'] - 'xlsx' or 'csv'
 */
export const exportToExcel = (data, options = {}) => {
  const {
    filename = 'export',
    sheetName = 'Data',
    columns,
  } = options;

  if (!data || data.length === 0) return;

  // Format data if columns are provided
  const exportData = columns ? formatDataForExport(data, columns) : data;

  // Create worksheet
  const worksheet = XLSX.utils.json_to_sheet(exportData);

  // Apply column widths
  if (columns) {
    worksheet['!cols'] = columns.map((col) => ({
      wch: col.width || Math.max(
        (col.header || '').length,
        ...exportData.map((row) => String(row[col.header] ?? '').length)
      ) + 2,
    }));
  } else {
    const keys = Object.keys(exportData[0]);
    worksheet['!cols'] = keys.map((key) => {
      const maxLen = Math.max(
        key.length,
        ...exportData.map((row) => String(row[key] ?? '').length)
      );
      return { wch: Math.min(maxLen + 2, 50) };
    });
  }

  // Style header row (bold) - xlsx library community edition has limited styling
  // but we set the cell types properly for numbers
  if (columns) {
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let C = range.s.c; C <= range.e.c; C++) {
      const col = columns[C];
      if (!col) continue;
      for (let R = range.s.r + 1; R <= range.e.r; R++) {
        const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
        const cell = worksheet[cellRef];
        if (!cell) continue;
        if (col.type === 'currency' || col.type === 'number') {
          if (typeof cell.v === 'number') {
            cell.t = 'n';
            cell.z = col.type === 'currency' ? '#,##0.00' : '#,##0.##';
          }
        }
      }
    }
  }

  // Build workbook
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Generate and download
  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  downloadFile(blob, `${filename}.xlsx`);
};

/**
 * Export data to a CSV file
 * @param {Object[]} data - Array of objects to export
 * @param {Object} options - Export options
 * @param {string} [options.filename='export'] - Filename without extension
 * @param {Object[]} [options.columns] - Column definitions [{ key, header, type, width, accessor }]
 * @param {string} [options.separator=','] - CSV separator character
 * @param {string} [options.locale='en'] - Locale for separator detection ('fr' uses ';')
 */
export const exportToCSV = (data, options = {}) => {
  const {
    filename = 'export',
    columns,
    separator: explicitSeparator,
    locale,
  } = options;

  if (!data || data.length === 0) return;

  // Determine separator: explicit > locale-based > default comma
  const separator = explicitSeparator || (locale === 'fr' ? ';' : ',');

  // Format data if columns are provided
  const exportData = columns ? formatDataForExport(data, columns) : data;

  const headers = Object.keys(exportData[0]);

  const escapeCSVValue = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(separator) || str.includes('\n') || str.includes('"')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const csvContent = [
    headers.map(escapeCSVValue).join(separator),
    ...exportData.map((row) =>
      headers.map((h) => escapeCSVValue(row[h])).join(separator)
    ),
  ].join('\n');

  // BOM for UTF-8 encoding
  const blob = new Blob(['\ufeff' + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  downloadFile(blob, `${filename}.csv`);
};

export default { exportToExcel, exportToCSV, formatDataForExport, downloadFile };
