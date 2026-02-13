import React, { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, FileSpreadsheet, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { parseCSV } from '@/utils/csvParser';
import * as XLSX from 'xlsx';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_EXTENSIONS = ['.xlsx', '.xls', '.csv'];

const STANDARD_COLUMNS = [
  { key: 'account_code', label: 'import.columns.code' },
  { key: 'account_name', label: 'import.columns.name' },
  { key: 'account_type', label: 'import.columns.type' },
  { key: 'parent_code',  label: 'import.columns.parentCode' },
];

// ---------------------------------------------------------------------------
// Helper: parse Excel file to array of rows
// ---------------------------------------------------------------------------

function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheet];
        // Convert to array of arrays
        const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        resolve(rows);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsArrayBuffer(file);
  });
}

// ---------------------------------------------------------------------------
// Helper: guess account type from code (PCG/PCMN convention)
// ---------------------------------------------------------------------------

function guessAccountType(code) {
  if (!code) return 'asset';
  const c = String(code).charAt(0);
  switch (c) {
    case '1': return 'equity';
    case '2': return 'asset';
    case '3': return 'asset';
    case '4': return 'asset';
    case '5': return 'asset';
    case '6': return 'expense';
    case '7': return 'revenue';
    case '8': return 'expense';
    case '9': return 'expense';
    default: return 'asset';
  }
}

// ---------------------------------------------------------------------------
// Column mapping dropdown
// ---------------------------------------------------------------------------

const ColumnMapSelect = ({ value, onChange, options, label }) => {
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 min-w-[80px]">{label}</span>
      <select
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))}
        className="flex-1 bg-gray-800/80 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
      >
        <option value="">-- ignorer --</option>
        {options.map((opt, idx) => (
          <option key={idx} value={idx}>{opt}</option>
        ))}
      </select>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

const AccountingPlanImport = ({ onImportComplete, onCancel }) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const fileInputRef = useRef(null);

  // State
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState(null);
  const [rawHeaders, setRawHeaders] = useState([]);
  const [rawRows, setRawRows] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  const [parsedAccounts, setParsedAccounts] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState(null);
  const [step, setStep] = useState('upload'); // 'upload' | 'mapping' | 'preview'

  // ---------------------------------------------------------------------------
  // File handling
  // ---------------------------------------------------------------------------

  const resetState = () => {
    setFile(null);
    setRawHeaders([]);
    setRawRows([]);
    setColumnMapping({});
    setParsedAccounts([]);
    setParseErrors([]);
    setImportError(null);
    setStep('upload');
  };

  const validateFile = (f) => {
    if (!f) return 'No file selected';
    if (f.size > MAX_FILE_SIZE) return t('import.fileTooLarge', 'File exceeds 5 MB');
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!ACCEPTED_EXTENSIONS.includes(ext)) return t('import.invalidFormat', 'Invalid format. Accepted: .xlsx, .xls, .csv');
    return null;
  };

  const processFile = useCallback(async (selectedFile) => {
    const error = validateFile(selectedFile);
    if (error) {
      setImportError(error);
      return;
    }

    setFile(selectedFile);
    setImportError(null);

    try {
      const ext = selectedFile.name.split('.').pop().toLowerCase();
      let headers = [];
      let dataRows = [];

      if (ext === 'csv') {
        // Use existing csvParser for CSV
        const text = await selectedFile.text();
        const result = parseCSV(text);
        if (result.errors.length > 0 && result.accounts.length === 0) {
          setParseErrors(result.errors);
          setImportError(result.errors[0]?.message || 'Parse error');
          return;
        }
        // For CSV, we already have parsed accounts via csvParser
        // But we also need raw data for the mapping UI
        const lines = text.replace(/^\uFEFF/, '').trim().split(/\r?\n/).filter(l => l.trim());
        const delimiter = text.includes(';') ? ';' : text.includes('\t') ? '\t' : ',';
        headers = lines[0]?.split(delimiter).map(h => h.trim()) || [];
        dataRows = lines.slice(1).map(l => l.split(delimiter).map(c => c.trim()));
      } else {
        // Excel parsing
        const rows = await parseExcelFile(selectedFile);
        if (!rows || rows.length < 2) {
          setImportError(t('import.emptyFile', 'File is empty or has no data rows'));
          return;
        }
        headers = rows[0].map(h => String(h || '').trim());
        dataRows = rows.slice(1).filter(r => r.some(cell => cell !== ''));
      }

      setRawHeaders(headers);
      setRawRows(dataRows);

      // Auto-detect column mapping
      const autoMap = autoDetectColumns(headers);
      setColumnMapping(autoMap);
      setStep('mapping');
    } catch (err) {
      console.error('File parse error:', err);
      setImportError(err.message || 'Failed to parse file');
    }
  }, [t]);

  // ---------------------------------------------------------------------------
  // Auto-detect columns
  // ---------------------------------------------------------------------------

  const autoDetectColumns = (headers) => {
    const normalized = headers.map(h => h.toLowerCase().replace(/[^a-z0-9_]/g, '_'));
    const mapping = {};

    const codeAliases = ['account_code', 'code', 'numero', 'num', 'compte', 'account_number', 'code_compte'];
    const nameAliases = ['account_name', 'name', 'nom', 'libelle', 'label', 'intitule', 'designation'];
    const typeAliases = ['account_type', 'type', 'classe', 'class', 'category_type'];
    const parentAliases = ['parent_code', 'parent', 'code_parent', 'parent_account'];

    const findIdx = (aliases) => normalized.findIndex(h => aliases.includes(h));

    const codeIdx = findIdx(codeAliases);
    const nameIdx = findIdx(nameAliases);
    const typeIdx = findIdx(typeAliases);
    const parentIdx = findIdx(parentAliases);

    if (codeIdx !== -1) mapping.account_code = codeIdx;
    if (nameIdx !== -1) mapping.account_name = nameIdx;
    if (typeIdx !== -1) mapping.account_type = typeIdx;
    if (parentIdx !== -1) mapping.parent_code = parentIdx;

    return mapping;
  };

  // ---------------------------------------------------------------------------
  // Apply column mapping to generate accounts
  // ---------------------------------------------------------------------------

  const applyMapping = useCallback(() => {
    if (columnMapping.account_code === undefined || columnMapping.account_code === null) {
      setImportError(t('import.missingCodeColumn', 'Please map the "Code" column'));
      return;
    }
    if (columnMapping.account_name === undefined || columnMapping.account_name === null) {
      setImportError(t('import.missingNameColumn', 'Please map the "Name" column'));
      return;
    }

    const accounts = [];
    const errors = [];

    for (let i = 0; i < rawRows.length; i++) {
      const row = rawRows[i];
      const code = String(row[columnMapping.account_code] || '').trim();
      const name = String(row[columnMapping.account_name] || '').trim();

      if (!code) {
        errors.push({ line: i + 2, message: `Missing account code` });
        continue;
      }
      if (!name) {
        errors.push({ line: i + 2, message: `Missing account name for code "${code}"` });
        continue;
      }

      let accountType = '';
      if (columnMapping.account_type !== undefined && columnMapping.account_type !== null) {
        accountType = String(row[columnMapping.account_type] || '').trim().toLowerCase();
      }
      if (!accountType || !['asset', 'liability', 'equity', 'revenue', 'expense'].includes(accountType)) {
        accountType = guessAccountType(code);
      }

      const parentCode = (columnMapping.parent_code !== undefined && columnMapping.parent_code !== null)
        ? String(row[columnMapping.parent_code] || '').trim()
        : '';

      accounts.push({
        account_code: code,
        account_name: name,
        account_type: accountType,
        parent_code: parentCode,
        is_active: true,
      });
    }

    setParsedAccounts(accounts);
    setParseErrors(errors);
    setImportError(null);
    setStep('preview');
  }, [rawRows, columnMapping, t]);

  // ---------------------------------------------------------------------------
  // Import to Supabase
  // ---------------------------------------------------------------------------

  const handleImport = async () => {
    if (!user || !supabase || parsedAccounts.length === 0) return;

    setImporting(true);
    setImportError(null);

    try {
      // 1. Create a new accounting plan
      const { data: plan, error: planErr } = await supabase
        .from('accounting_plans')
        .insert({
          name: file.name.replace(/\.\w+$/, ''),
          source: 'user_upload',
          uploaded_by: user.id,
          is_global: false,
          accounts_count: parsedAccounts.length,
          status: 'active',
        })
        .select()
        .single();

      if (planErr) throw planErr;

      // 2. Insert accounts in batches
      const BATCH_SIZE = 200;
      for (let i = 0; i < parsedAccounts.length; i += BATCH_SIZE) {
        const batch = parsedAccounts.slice(i, i + BATCH_SIZE).map(a => ({
          plan_id: plan.id,
          account_code: a.account_code,
          account_name: a.account_name,
          account_type: a.account_type,
          parent_code: a.parent_code || null,
          is_active: true,
        }));

        const { error: batchErr } = await supabase
          .from('accounting_plan_accounts')
          .insert(batch);

        if (batchErr) {
          console.error(`Batch insert error (${i}-${i + BATCH_SIZE}):`, batchErr.message);
        }
      }

      // 3. Upload original file to Supabase Storage
      try {
        const filePath = `${user.id}/${plan.id}/${file.name}`;
        await supabase.storage
          .from('accounting-plans')
          .upload(filePath, file, { upsert: true });
      } catch (storageErr) {
        // Storage upload is non-critical; log but don't fail the import
        console.warn('File upload to storage failed (non-critical):', storageErr);
      }

      // 4. Notify parent
      if (onImportComplete) {
        onImportComplete(plan);
      }
    } catch (err) {
      console.error('Import error:', err);
      setImportError(err.message || 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // Drag & drop handlers
  // ---------------------------------------------------------------------------

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const droppedFile = e.dataTransfer?.files?.[0];
    if (droppedFile) processFile(droppedFile);
  }, [processFile]);

  const handleBrowse = () => {
    fileInputRef.current?.click();
  };

  const handleFileInput = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) processFile(selectedFile);
  };

  // ---------------------------------------------------------------------------
  // Render: Upload step
  // ---------------------------------------------------------------------------

  const renderUpload = () => (
    <div className="space-y-4">
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={handleBrowse}
        className={`relative border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          dragActive
            ? 'border-orange-500 bg-orange-500/10'
            : 'border-gray-700 bg-gray-800/30 hover:border-gray-600 hover:bg-gray-800/50'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileInput}
          className="hidden"
        />
        <Upload className={`w-10 h-10 mx-auto mb-3 ${dragActive ? 'text-orange-400' : 'text-gray-500'}`} />
        <p className="text-sm text-gray-300 font-medium">
          {t('import.dropzone', 'Glissez-deposez votre fichier ici')}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {t('import.or', 'ou')}
        </p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 border-gray-600 text-gray-300 hover:bg-gray-700"
          onClick={(e) => { e.stopPropagation(); handleBrowse(); }}
        >
          {t('import.browse', 'Parcourir')}
        </Button>
        <p className="text-xs text-gray-600 mt-3">
          .xlsx, .xls, .csv &mdash; {t('import.maxSize', 'Max 5 Mo')}
        </p>
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render: Mapping step
  // ---------------------------------------------------------------------------

  const renderMapping = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileSpreadsheet className="w-5 h-5 text-orange-400" />
          <span className="text-sm text-white font-medium">{file?.name}</span>
        </div>
        <button onClick={resetState} className="text-gray-500 hover:text-gray-300">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="bg-gray-800/50 rounded-xl border border-gray-700 p-4 space-y-3">
        <h3 className="text-sm font-medium text-white">
          {t('import.mapping', 'Associez les colonnes')}
        </h3>
        <p className="text-xs text-gray-500">
          {t('import.mappingDesc', 'Indiquez quelle colonne de votre fichier correspond a chaque champ.')}
        </p>

        {STANDARD_COLUMNS.map((col) => (
          <ColumnMapSelect
            key={col.key}
            label={t(col.label, col.key)}
            value={columnMapping[col.key] ?? null}
            onChange={(val) => setColumnMapping(prev => ({ ...prev, [col.key]: val }))}
            options={rawHeaders}
          />
        ))}
      </div>

      {/* Quick preview of raw data */}
      <div className="bg-gray-900/50 rounded-lg overflow-hidden max-h-40 overflow-y-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-800/80 sticky top-0">
              {rawHeaders.map((h, i) => (
                <th key={i} className="px-2 py-1.5 text-left text-gray-400 font-medium whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rawRows.slice(0, 5).map((row, rIdx) => (
              <tr key={rIdx} className="border-t border-gray-800/50">
                {rawHeaders.map((_, cIdx) => (
                  <td key={cIdx} className="px-2 py-1 text-gray-400 whitespace-nowrap">{String(row[cIdx] || '')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={resetState} className="text-gray-400 hover:text-white">
          {t('common.cancel', 'Annuler')}
        </Button>
        <Button
          size="sm"
          onClick={applyMapping}
          className="bg-orange-500 hover:bg-orange-600 text-white"
        >
          {t('import.preview', 'Apercu')}
        </Button>
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Render: Preview step
  // ---------------------------------------------------------------------------

  const renderPreview = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-400" />
          <span className="text-sm text-white font-medium">
            {t('import.accounts_found', '{{count}} comptes trouves', { count: parsedAccounts.length })}
          </span>
        </div>
        <button onClick={() => setStep('mapping')} className="text-xs text-gray-500 hover:text-gray-300">
          {t('import.editMapping', 'Modifier le mapping')}
        </button>
      </div>

      {parseErrors.length > 0 && (
        <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            <span className="text-xs text-yellow-400 font-medium">
              {parseErrors.length} {t('import.errorsDetected', 'erreur(s) detectee(s)')}
            </span>
          </div>
          <div className="text-xs text-yellow-500/80 space-y-0.5 max-h-20 overflow-y-auto">
            {parseErrors.slice(0, 5).map((err, i) => (
              <p key={i}>Ligne {err.line}: {err.message}</p>
            ))}
          </div>
        </div>
      )}

      {/* Accounts preview table */}
      <div className="bg-gray-900/50 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-800/80 sticky top-0">
              <th className="px-3 py-2 text-left text-gray-400 font-medium">{t('import.columns.code', 'Code')}</th>
              <th className="px-3 py-2 text-left text-gray-400 font-medium">{t('import.columns.name', 'Nom')}</th>
              <th className="px-3 py-2 text-left text-gray-400 font-medium">{t('import.columns.type', 'Type')}</th>
              <th className="px-3 py-2 text-left text-gray-400 font-medium">{t('import.columns.parentCode', 'Parent')}</th>
            </tr>
          </thead>
          <tbody>
            {parsedAccounts.slice(0, 20).map((acc, i) => (
              <tr key={i} className="border-t border-gray-800/50 hover:bg-gray-800/30">
                <td className="px-3 py-1.5 text-orange-400 font-mono">{acc.account_code}</td>
                <td className="px-3 py-1.5 text-white">{acc.account_name}</td>
                <td className="px-3 py-1.5">
                  <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    acc.account_type === 'asset' ? 'bg-blue-500/20 text-blue-400' :
                    acc.account_type === 'liability' ? 'bg-red-500/20 text-red-400' :
                    acc.account_type === 'equity' ? 'bg-purple-500/20 text-purple-400' :
                    acc.account_type === 'revenue' ? 'bg-green-500/20 text-green-400' :
                    acc.account_type === 'expense' ? 'bg-yellow-500/20 text-yellow-400' :
                    'bg-gray-500/20 text-gray-400'
                  }`}>
                    {acc.account_type}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-gray-500 font-mono">{acc.parent_code || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {parsedAccounts.length > 20 && (
          <p className="text-center text-xs text-gray-600 py-2">
            ... {t('import.andMore', 'et {{count}} autres', { count: parsedAccounts.length - 20 })}
          </p>
        )}
      </div>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={resetState} className="text-gray-400 hover:text-white">
          {t('common.cancel', 'Annuler')}
        </Button>
        <Button
          size="sm"
          onClick={handleImport}
          disabled={importing || parsedAccounts.length === 0}
          className="bg-orange-500 hover:bg-orange-600 text-white disabled:opacity-50"
        >
          {importing
            ? t('import.importing', 'Import en cours...')
            : t('import.import_button', `Importer ${parsedAccounts.length} comptes`)
          }
        </Button>
      </div>
    </div>
  );

  // ---------------------------------------------------------------------------
  // Main render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-orange-400" />
          {t('import.title', 'Importer un plan comptable')}
        </h3>
        {onCancel && (
          <button onClick={onCancel} className="text-gray-500 hover:text-gray-300">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {importError && (
        <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
          <span className="text-xs text-red-400">{importError}</span>
        </div>
      )}

      {step === 'upload' && renderUpload()}
      {step === 'mapping' && renderMapping()}
      {step === 'preview' && renderPreview()}
    </div>
  );
};

export default AccountingPlanImport;
