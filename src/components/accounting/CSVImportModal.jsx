
import React, { useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, FileText, AlertTriangle, CheckCircle2, Loader2, X } from 'lucide-react';
import { parseCSV, getCSVPreview } from '@/utils/csvParser';
import { validateChartOfAccountsImport } from '@/utils/accountingQualityChecks';

const CSVImportModal = ({ open, onOpenChange, onImport, existingAccounts = [] }) => {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [rawContent, setRawContent] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const reset = () => {
    setFile(null);
    setPreview(null);
    setRawContent('');
    setResult(null);
    setImporting(false);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const readFile = useCallback((f) => {
    if (!f || !f.name.endsWith('.csv')) return;
    setFile(f);
    setResult(null);

    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target.result;
      setRawContent(content);
      const parsed = parseCSV(content);
      const prev = getCSVPreview(content, 8);
      const validation = validateChartOfAccountsImport(parsed.accounts, { existingAccounts });
      setPreview({
        ...prev,
        parsedAccountsCount: parsed.accounts.length,
        validation,
      });
    };
    reader.readAsText(f, 'UTF-8');
  }, [existingAccounts]);

  const handleFileChange = (e) => {
    if (e.target.files?.[0]) readFile(e.target.files[0]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.[0]) readFile(e.dataTransfer.files[0]);
  };

  const handleImport = async () => {
    if (!rawContent) return;
    setImporting(true);
    try {
      const { accounts, errors } = parseCSV(rawContent);
      if (accounts.length === 0) {
        setResult({ success: false, imported: 0, errors: errors.length, message: 'Aucun compte valide trouvé' });
        return;
      }
      const importResult = await onImport(accounts);
      setResult({
        success: true,
        imported: importResult?.count || accounts.length,
        errors: errors.length,
        validation: importResult?.validation || preview?.validation || null,
        message: `${importResult?.count || accounts.length} comptes importés avec succès`
      });
    } catch (err) {
      setResult({
        success: false,
        imported: 0,
        errors: 1,
        validation: err.validation || preview?.validation || null,
        message: err.message,
      });
    } finally {
      setImporting(false);
    }
  };

  const typeColor = (type) => {
    switch (type) {
      case 'asset': return 'bg-blue-500/20 text-blue-400';
      case 'liability': return 'bg-red-500/20 text-red-400';
      case 'equity': return 'bg-purple-500/20 text-purple-400';
      case 'revenue': return 'bg-green-500/20 text-green-400';
      case 'expense': return 'bg-orange-500/20 text-orange-400';
      default: return 'bg-gray-500/20 text-gray-400';
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-gradient text-xl">Importer un plan comptable (CSV)</DialogTitle>
        </DialogHeader>

        {/* Drop zone */}
        {!preview && !result && (
          <div
            className={`border-2 border-dashed rounded-xl p-10 text-center transition-colors cursor-pointer ${
              dragOver ? 'border-orange-500 bg-orange-500/10' : 'border-gray-700 hover:border-gray-600'
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-500" />
            <p className="text-gray-400 mb-2">Glissez votre fichier CSV ici ou cliquez pour parcourir</p>
            <p className="text-xs text-gray-600">
              Format attendu : <code className="text-orange-400">code;nom;type;categorie</code>
            </p>
            <p className="text-xs text-gray-600 mt-1">
              Séparateurs supportés : point-virgule (;), virgule (,), tabulation
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
        )}

        {/* Preview */}
        {preview && !result && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-orange-400" />
                <span className="text-sm text-gray-300">{file?.name}</span>
                <Badge className="bg-gray-800 text-gray-300 text-xs">
                  {preview.totalRows} comptes • séparateur "{preview.delimiter}"
                </Badge>
              </div>
              <Button variant="ghost" size="icon" aria-label="Close" onClick={reset}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Errors */}
            {preview.errorCount > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2 text-red-400 text-sm font-medium mb-1">
                  <AlertTriangle className="w-4 h-4" />
                  {preview.errorCount} erreur(s) détectée(s)
                </div>
                {preview.errors.map((err, i) => (
                  <p key={i} className="text-xs text-red-300 ml-6">Ligne {err.line} : {err.message}</p>
                ))}
              </div>
            )}

            {preview.validation && (
              <div className={`rounded-lg border p-3 ${
                preview.validation.blockingIssues.length > 0
                  ? 'bg-red-500/10 border-red-500/30'
                  : preview.validation.warnings.length > 0
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-green-500/10 border-green-500/30'
              }`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className={`text-sm font-medium ${
                      preview.validation.blockingIssues.length > 0
                        ? 'text-red-300'
                        : preview.validation.warnings.length > 0
                          ? 'text-amber-300'
                          : 'text-green-300'
                    }`}>
                      Contrôle de cohérence comptable
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      Région détectée: <span className="text-gray-200">{preview.validation.region}</span> •
                      Catégories renseignées: <span className="text-gray-200"> {((preview.validation.combinedSummary?.categoryCoverage ?? 0) * 100).toFixed(0)}%</span>
                    </p>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <Badge className="bg-red-500/20 text-red-300">
                      {preview.validation.summary.blockingCount} bloquant(s)
                    </Badge>
                    <Badge className="bg-amber-500/20 text-amber-300">
                      {preview.validation.summary.warningCount} alerte(s)
                    </Badge>
                  </div>
                </div>

                {preview.validation.issues.length > 0 ? (
                  <div className="mt-3 space-y-2">
                    {preview.validation.issues.slice(0, 5).map((issue) => (
                      <div key={`${issue.code}-${issue.message}`} className="text-xs text-gray-300">
                        <span className={issue.severity === 'critical' ? 'text-red-300 font-medium' : 'text-amber-300 font-medium'}>
                          {issue.severity === 'critical' ? 'Bloquant' : 'Alerte'}:
                        </span>{' '}
                        {issue.message}
                      </div>
                    ))}
                    {preview.validation.issues.length > 5 && (
                      <p className="text-xs text-gray-500">
                        ... et {preview.validation.issues.length - 5} autre(s) point(s)
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-green-300 mt-3">
                    Le plan importé est exploitable pour le pilotage sans anomalie bloquante détectée.
                  </p>
                )}
              </div>
            )}

            {/* Table preview */}
            <div className="overflow-x-auto rounded-lg border border-gray-800">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800">
                    <th className="px-3 py-2 text-left text-gray-400 font-medium">Code</th>
                    <th className="px-3 py-2 text-left text-gray-400 font-medium">Nom</th>
                    <th className="px-3 py-2 text-left text-gray-400 font-medium">Type</th>
                    <th className="px-3 py-2 text-left text-gray-400 font-medium">Catégorie</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.preview.map((acc, i) => (
                    <tr key={i} className="border-t border-gray-800 hover:bg-gray-800/50">
                      <td className="px-3 py-2 font-mono text-orange-400">{acc.account_code}</td>
                      <td className="px-3 py-2 text-white">{acc.account_name}</td>
                      <td className="px-3 py-2">
                        <Badge className={`text-xs ${typeColor(acc.account_type)}`}>
                          {acc.account_type}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-gray-400">{acc.account_category || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.totalRows > 8 && (
                <div className="px-3 py-2 text-center text-xs text-gray-500 bg-gray-800/50">
                  ... et {preview.totalRows - 8} autres comptes
                </div>
              )}
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className={`rounded-xl p-8 text-center ${result.success ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
            {result.success ? (
              <CheckCircle2 className="w-16 h-16 mx-auto mb-4 text-green-400" />
            ) : (
              <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-400" />
            )}
            <h3 className={`text-xl font-bold mb-2 ${result.success ? 'text-green-400' : 'text-red-400'}`}>
              {result.success ? 'Import réussi !' : 'Erreur d\'import'}
            </h3>
            <p className="text-gray-400">{result.message}</p>
            {result.validation && (
              <p className="text-xs text-gray-500 mt-2">
                {result.validation.summary.blockingCount} bloquant(s) • {result.validation.summary.warningCount} alerte(s)
              </p>
            )}
            {result.errors > 0 && (
              <p className="text-xs text-gray-500 mt-2">{result.errors} ligne(s) ignorée(s)</p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {result ? (
            <Button onClick={handleClose} className="bg-orange-500 hover:bg-orange-600">
              Fermer
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={handleClose} className="border-gray-700">
                Annuler
              </Button>
              {preview && (
                <Button
                  onClick={handleImport}
                  disabled={importing || preview.totalRows === 0 || preview.validation?.blockingIssues.length > 0}
                  className="bg-orange-500 hover:bg-orange-600"
                >
                  {importing ? (
                    <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Importation...</>
                  ) : (
                    preview.validation?.blockingIssues.length > 0
                      ? 'Import bloqué'
                      : `Importer ${preview.totalRows} comptes`
                  )}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default CSVImportModal;
