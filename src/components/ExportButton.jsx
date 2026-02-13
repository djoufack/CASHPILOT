import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Download, FileSpreadsheet, FileText, Loader2, ChevronDown } from 'lucide-react';
import { exportToExcel, exportToCSV } from '@/utils/excelExport';

/**
 * Reusable export dropdown button for Excel/CSV exports.
 *
 * @param {Object[]} data - Array of data objects to export
 * @param {Object[]} columns - Column definitions [{ key, header, type, width, accessor }]
 * @param {string} filename - Filename without extension
 * @param {string} [sheetName] - Excel sheet name
 * @param {string} [className] - Additional CSS classes
 * @param {boolean} [disabled] - Disable the button
 * @param {string} [size='sm'] - Button size
 */
const ExportButton = ({
  data,
  columns,
  filename = 'export',
  sheetName,
  className = '',
  disabled = false,
  size = 'sm',
}) => {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleExport = async (format) => {
    if (!data || data.length === 0) return;

    setIsExporting(true);
    setIsOpen(false);

    try {
      // Use requestAnimationFrame to ensure UI updates before heavy export
      await new Promise((resolve) => requestAnimationFrame(resolve));

      const locale = i18n.language || 'en';

      if (format === 'xlsx') {
        exportToExcel(data, {
          filename,
          sheetName: sheetName || filename,
          columns,
        });
      } else {
        exportToCSV(data, {
          filename,
          columns,
          locale,
        });
      }
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const hasData = data && data.length > 0;

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <Button
        size={size}
        variant="outline"
        disabled={disabled || !hasData || isExporting}
        onClick={() => setIsOpen(!isOpen)}
        className={`
          border-gray-600 text-gray-300 hover:bg-gray-700
          backdrop-blur-sm bg-gray-800/50
          ${className}
        `}
      >
        {isExporting ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Download className="w-4 h-4 mr-2" />
        )}
        {isExporting ? t('export.exporting') : t('export.title', 'Export')}
        <ChevronDown className={`w-3 h-3 ml-1 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </Button>

      {isOpen && (
        <div
          className="
            absolute right-0 top-full mt-1 z-50
            min-w-[180px] py-1
            bg-gray-800 border border-gray-700 rounded-lg shadow-xl
            backdrop-blur-md bg-gray-800/95
            animate-in fade-in slide-in-from-top-1 duration-150
          "
        >
          <button
            onClick={() => handleExport('xlsx')}
            className="
              w-full flex items-center gap-3 px-4 py-2.5
              text-sm text-gray-200 hover:bg-gray-700/80 hover:text-white
              transition-colors
            "
          >
            <FileSpreadsheet className="w-4 h-4 text-green-400" />
            <span>{t('export.excel', 'Excel (.xlsx)')}</span>
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="
              w-full flex items-center gap-3 px-4 py-2.5
              text-sm text-gray-200 hover:bg-gray-700/80 hover:text-white
              transition-colors
            "
          >
            <FileText className="w-4 h-4 text-blue-400" />
            <span>{t('export.csv', 'CSV (.csv)')}</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default ExportButton;
