
import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Upload, FileSpreadsheet, FileText, AlertTriangle, CheckCircle, Loader2, X } from 'lucide-react';
import { parseBankStatement, getBankStatementPreview } from '@/utils/bankStatementParser';
import { formatCurrency } from '@/utils/calculations';

const FRENCH_BANKS = [
  { value: 'credit_mutuel', label: 'Crédit Mutuel' },
  { value: 'bnp_paribas', label: 'BNP Paribas' },
  { value: 'societe_generale', label: 'Société Générale' },
  { value: 'credit_agricole', label: 'Crédit Agricole' },
  { value: 'la_banque_postale', label: 'La Banque Postale' },
  { value: 'caisse_epargne', label: "Caisse d'Épargne" },
  { value: 'boursorama', label: 'Boursorama' },
  { value: 'lcl', label: 'LCL' },
  { value: 'hsbc', label: 'HSBC France' },
  { value: 'qonto', label: 'Qonto' },
  { value: 'shine', label: 'Shine' },
  { value: 'other', label: 'Autre' },
];

const ACCEPTED_TYPES = '.pdf,.xlsx,.xls,.csv';
const MAX_SIZE = 10 * 1024 * 1024; // 10 MB

const BankStatementUploadModal = ({ open, onOpenChange, onUploadComplete }) => {
  const [step, setStep] = useState('upload'); // upload, parsing, preview, result
  const [file, setFile] = useState(null);
  const [bankName, setBankName] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parsedData, setParsedData] = useState(null);
  const [preview, setPreview] = useState(null);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const reset = () => {
    setStep('upload');
    setFile(null);
    setBankName('');
    setParsing(false);
    setParsedData(null);
    setPreview(null);
    setImporting(false);
    setResult(null);
    setDragOver(false);
  };

  const handleClose = () => {
    reset();
    onOpenChange(false);
  };

  const validateFile = (f) => {
    if (!f) return 'Aucun fichier sélectionné';
    if (f.size > MAX_SIZE) return 'Le fichier dépasse 10 Mo';
    const ext = f.name.split('.').pop().toLowerCase();
    if (!['pdf', 'xlsx', 'xls', 'csv'].includes(ext)) return 'Format non supporté';
    return null;
  };

  const handleFileSelect = async (f) => {
    const error = validateFile(f);
    if (error) {
      setResult({ success: false, message: error });
      setStep('result');
      return;
    }
    setFile(f);
    setStep('parsing');
    setParsing(true);

    try {
      const parsed = await parseBankStatement(f);
      setParsedData(parsed);
      const prev = getBankStatementPreview(parsed);
      setPreview(prev);

      // Auto-detect bank name from metadata
      if (parsed.metadata?.bankName && !bankName) {
        const match = FRENCH_BANKS.find(b =>
          b.label.toLowerCase().includes(parsed.metadata.bankName.toLowerCase())
        );
        if (match) setBankName(match.value);
      }

      if (parsed.lines.length === 0 && parsed.errors.length > 0) {
        setResult({ success: false, message: parsed.errors[0].message });
        setStep('result');
      } else {
        setStep('preview');
      }
    } catch (err) {
      setResult({ success: false, message: `Erreur de parsing : ${err.message}` });
      setStep('result');
    } finally {
      setParsing(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFileSelect(f);
  };

  const handleImport = async () => {
    if (!parsedData || !file) return;
    setImporting(true);
    try {
      const selectedBank = FRENCH_BANKS.find(b => b.value === bankName);
      const metadata = {
        bankName: selectedBank?.label || bankName || parsedData.metadata?.bankName || null,
        accountNumber: parsedData.metadata?.accountNumber || null,
        periodStart: parsedData.metadata?.periodStart || null,
        periodEnd: parsedData.metadata?.periodEnd || null,
        openingBalance: parsedData.metadata?.openingBalance || null,
        closingBalance: parsedData.metadata?.closingBalance || null,
      };

      const success = await onUploadComplete(file, parsedData, metadata);
      setResult({
        success: !!success,
        message: success
          ? `${parsedData.lines.length} opérations importées avec succès.`
          : "Erreur lors de l'import."
      });
      setStep('result');
    } catch (err) {
      setResult({ success: false, message: err.message });
      setStep('result');
    } finally {
      setImporting(false);
    }
  };

  const getFileIcon = () => {
    if (!file) return <Upload className="w-10 h-10 text-gray-500" />;
    const ext = file.name.split('.').pop().toLowerCase();
    if (ext === 'pdf') return <FileText className="w-10 h-10 text-red-400" />;
    return <FileSpreadsheet className="w-10 h-10 text-green-400" />;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="bg-gray-900 border-gray-800 text-white sm:max-w-[700px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-gradient">Importer un relevé bancaire</DialogTitle>
        </DialogHeader>

        {/* STEP 1: Upload */}
        {step === 'upload' && (
          <div className="space-y-4">
            {/* Bank selector */}
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Banque (optionnel)</label>
              <Select value={bankName} onValueChange={setBankName}>
                <SelectTrigger className="bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Sélectionner votre banque" />
                </SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700">
                  {FRENCH_BANKS.map(b => (
                    <SelectItem key={b.value} value={b.value} className="text-white">{b.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Drop zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                dragOver ? 'border-orange-400 bg-orange-500/10' : 'border-gray-700 hover:border-gray-600'
              }`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-10 h-10 mx-auto mb-3 text-gray-500" />
              <p className="text-sm text-gray-300">Glissez votre relevé bancaire ici ou cliquez pour parcourir</p>
              <p className="text-xs text-gray-500 mt-2">Formats acceptés : PDF, Excel (.xlsx, .xls), CSV</p>
              <p className="text-xs text-gray-600 mt-1">Taille maximum : 10 Mo</p>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                className="hidden"
                onChange={e => { if (e.target.files[0]) handleFileSelect(e.target.files[0]); }}
              />
            </div>
          </div>
        )}

        {/* STEP 2: Parsing */}
        {step === 'parsing' && (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-orange-400 mb-4" />
            <p className="text-gray-400">Analyse du relevé en cours...</p>
            {file && <p className="text-xs text-gray-600 mt-2">{file.name}</p>}
          </div>
        )}

        {/* STEP 3: Preview */}
        {step === 'preview' && preview && (
          <div className="space-y-4">
            {/* File info */}
            <div className="flex items-center gap-3 p-3 bg-gray-800 rounded-lg">
              {getFileIcon()}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{file?.name}</p>
                <p className="text-xs text-gray-500">
                  {preview.totalLines} opérations détectées
                  {preview.metadata?.periodStart && ` • ${preview.metadata.periodStart} au ${preview.metadata.periodEnd}`}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={reset}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            {/* Errors */}
            {preview.errorCount > 0 && (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <div className="flex items-center gap-2 text-amber-400 text-sm font-medium">
                  <AlertTriangle className="w-4 h-4" />
                  {preview.errorCount} erreur{preview.errorCount > 1 ? 's' : ''} de lecture
                </div>
                <ul className="mt-1 text-xs text-gray-400 space-y-0.5">
                  {preview.errors.slice(0, 3).map((e, i) => (
                    <li key={i}>Ligne {e.line} : {e.message}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Crédits</p>
                <p className="text-sm font-mono text-green-400">+{formatCurrency(preview.totalCredits)}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Débits</p>
                <p className="text-sm font-mono text-red-400">{formatCurrency(preview.totalDebits)}</p>
              </div>
              <div className="bg-gray-800 rounded-lg p-3 text-center">
                <p className="text-xs text-gray-500">Solde net</p>
                <p className={`text-sm font-mono ${preview.netAmount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(preview.netAmount)}
                </p>
              </div>
            </div>

            {/* Preview table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-700 text-gray-500">
                    <th className="py-2 px-2 text-left">#</th>
                    <th className="py-2 px-2 text-left">Date</th>
                    <th className="py-2 px-2 text-left">Libellé</th>
                    <th className="py-2 px-2 text-right">Montant</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.previewLines.map((line, i) => (
                    <tr key={i} className="border-b border-gray-800/50">
                      <td className="py-1.5 px-2 text-gray-600">{line.lineNumber}</td>
                      <td className="py-1.5 px-2 text-gray-300">{new Date(line.date).toLocaleDateString('fr-FR')}</td>
                      <td className="py-1.5 px-2 text-gray-300 max-w-[300px] truncate">{line.description}</td>
                      <td className={`py-1.5 px-2 text-right font-mono ${line.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {line.amount >= 0 ? '+' : ''}{formatCurrency(line.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {preview.hasMore && (
                <p className="text-xs text-gray-600 text-center mt-2">
                  ... et {preview.totalLines - preview.previewLines.length} autres opérations
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={reset} className="border-gray-700 text-gray-300">
                Annuler
              </Button>
              <Button
                onClick={handleImport}
                disabled={importing}
                className="bg-orange-500 hover:bg-orange-600 text-white"
              >
                {importing ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Import en cours...</>
                ) : (
                  `Importer ${preview.totalLines} opérations`
                )}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: Result */}
        {step === 'result' && result && (
          <div className="py-8 text-center">
            {result.success ? (
              <>
                <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-400" />
                <p className="text-green-400 font-medium">{result.message}</p>
              </>
            ) : (
              <>
                <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-red-400" />
                <p className="text-red-400 font-medium">{result.message}</p>
              </>
            )}
            <Button
              variant="outline"
              className="mt-6 border-gray-700 text-gray-300"
              onClick={result.success ? handleClose : reset}
            >
              {result.success ? 'Fermer' : 'Réessayer'}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BankStatementUploadModal;
