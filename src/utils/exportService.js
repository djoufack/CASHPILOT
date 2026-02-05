import * as XLSX from 'xlsx';

/**
 * Export data to CSV format and trigger download
 */
export const exportToCSV = (data, filename = 'export') => {
  if (!data || data.length === 0) return;

  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row =>
      headers.map(h => {
        const val = row[h];
        if (val === null || val === undefined) return '';
        const str = String(val);
        // Escape quotes and wrap in quotes if contains comma/newline/quote
        if (str.includes(',') || str.includes('\n') || str.includes('"')) {
          return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
      }).join(',')
    ),
  ].join('\n');

  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
  downloadBlob(blob, `${filename}.csv`);
};

/**
 * Export data to Excel (XLSX) format and trigger download
 */
export const exportToExcel = (data, filename = 'export', sheetName = 'Data') => {
  if (!data || data.length === 0) return;

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

  // Auto-size columns
  const colWidths = Object.keys(data[0]).map(key => {
    const maxLen = Math.max(
      key.length,
      ...data.map(row => String(row[key] || '').length)
    );
    return { wch: Math.min(maxLen + 2, 50) };
  });
  worksheet['!cols'] = colWidths;

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  downloadBlob(blob, `${filename}.xlsx`);
};

/**
 * Export data to JSON format and trigger download
 */
export const exportToJSON = (data, filename = 'export') => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  downloadBlob(blob, `${filename}.json`);
};

/**
 * Generic export function that accepts format parameter
 */
export const exportData = (data, filename, format = 'xlsx') => {
  switch (format) {
    case 'csv':
      return exportToCSV(data, filename);
    case 'xlsx':
    case 'excel':
      return exportToExcel(data, filename);
    case 'json':
      return exportToJSON(data, filename);
    default:
      console.error(`Unsupported export format: ${format}`);
  }
};

/**
 * Prepare entity data for export (flatten nested objects, format dates)
 */
export const prepareForExport = (items, columns) => {
  return items.map(item => {
    const row = {};
    columns.forEach(col => {
      const value = col.accessor ? col.accessor(item) : item[col.key];
      row[col.label || col.key] = value ?? '';
    });
    return row;
  });
};

// Helper: trigger file download
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export default { exportToCSV, exportToExcel, exportToJSON, exportData, prepareForExport };
