
import React, { useState } from 'react';
import { useInvoiceUpload } from '@/hooks/useInvoiceUpload';
import { useInvoiceExtraction } from '@/hooks/useInvoiceExtraction';
import { useCreditsGuard, CREDIT_COSTS } from '@/hooks/useCreditsGuard';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Upload, X, FileText, Sparkles, Loader2, ChevronDown, ChevronUp, Image } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { useTranslation } from 'react-i18next';

const UploadInvoiceModal = ({ isOpen, onClose, supplierId, onUploadSuccess }) => {
  const { loading, progress, error } = useInvoiceUpload();
  const { extractInvoice, extracting, extractedData, clearExtraction } = useInvoiceExtraction();
  const { guardedAction } = useCreditsGuard();
  const { user } = useAuth();
  const { t } = useTranslation();

  const [file, setFile] = useState(null);
  const [formData, setFormData] = useState({
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    total_amount: '',
    vat_rate: '20',
    payment_status: 'pending'
  });
  const [advancedData, setAdvancedData] = useState({
    total_ht: '', total_tva: '', currency: 'EUR',
    supplier_vat_number: '', payment_terms: '', iban: '', bic: ''
  });
  const [lineItems, setLineItems] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [uploadedFilePath, setUploadedFilePath] = useState(null);

  const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (!allowedTypes.includes(selectedFile.type)) {
        alert(t('invoiceExtraction.supportedFormats'));
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        alert("File size too large (max 10MB)");
        return;
      }
      setFile(selectedFile);
      clearExtraction();
      setLineItems([]);
      setUploadedFilePath(null);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const selectedFile = e.dataTransfer.files[0];
    if (selectedFile && allowedTypes.includes(selectedFile.type)) {
      if (selectedFile.size <= 10 * 1024 * 1024) {
        setFile(selectedFile);
        clearExtraction();
        setLineItems([]);
        setUploadedFilePath(null);
      }
    }
  };

  const handleExtract = async () => {
    if (!file || !user || !supabase) return;

    // Upload file to a temp path for extraction
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `temp-extraction/${user.id}/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('supplier-invoices')
        .upload(filePath, file, { contentType: file.type });

      if (uploadError) throw uploadError;
      setUploadedFilePath(filePath);

      await guardedAction(
        CREDIT_COSTS.AI_INVOICE_EXTRACTION,
        t('invoiceExtraction.extractWithAI'),
        async () => {
          const data = await extractInvoice(filePath, file.type, user.id);
          if (data) {
            setFormData({
              invoice_number: data.invoice_number || '',
              invoice_date: data.invoice_date || new Date().toISOString().split('T')[0],
              due_date: data.due_date || '',
              total_amount: data.total_ttc?.toString() || '',
              vat_rate: data.tva_rate?.toString() || '20',
              payment_status: 'pending',
            });
            setAdvancedData({
              total_ht: data.total_ht?.toString() || '',
              total_tva: data.total_tva?.toString() || '',
              currency: data.currency || 'EUR',
              supplier_vat_number: data.supplier_vat_number || '',
              payment_terms: data.payment_terms || '',
              iban: data.iban || '',
              bic: data.bic || '',
            });
            if (data.line_items?.length) {
              setLineItems(data.line_items);
              setShowAdvanced(true);
            }
          }
        }
      );
    } catch (err) {
      console.error('Extract error:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    try {
      const submitData = {
        ...formData,
        total_ht: advancedData.total_ht ? parseFloat(advancedData.total_ht) : null,
        total_tva: advancedData.total_tva ? parseFloat(advancedData.total_tva) : null,
        total_ttc: formData.total_amount ? parseFloat(formData.total_amount) : null,
        currency: advancedData.currency || 'EUR',
        supplier_vat_number: advancedData.supplier_vat_number || null,
        payment_terms: advancedData.payment_terms || null,
        iban: advancedData.iban || null,
        bic: advancedData.bic || null,
        supplier_name_extracted: extractedData?.supplier_name || null,
        supplier_address_extracted: extractedData?.supplier_address || null,
        ai_extracted: !!extractedData,
        ai_confidence: extractedData?.confidence || null,
        ai_raw_response: extractedData || null,
        ai_extracted_at: extractedData ? new Date().toISOString() : null,
      };

      if (onUploadSuccess) {
        await onUploadSuccess(submitData, file);
        handleClose();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleClose = () => {
    onClose();
    setFile(null);
    setFormData({
      invoice_number: '',
      invoice_date: new Date().toISOString().split('T')[0],
      due_date: '',
      total_amount: '',
      vat_rate: '20',
      payment_status: 'pending'
    });
    setAdvancedData({
      total_ht: '', total_tva: '', currency: 'EUR',
      supplier_vat_number: '', payment_terms: '', iban: '', bic: ''
    });
    setLineItems([]);
    setShowAdvanced(false);
    setUploadedFilePath(null);
    clearExtraction();
  };

  const confidence = extractedData?.confidence || 0;
  const isImage = file && (file.type === 'image/jpeg' || file.type === 'image/png');

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('suppliers.uploadInvoice') || 'Upload Supplier Invoice'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${file ? 'border-green-500 bg-green-900/10' : 'border-gray-600 hover:border-blue-500 hover:bg-gray-700/50'}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            {file ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isImage ? <Image className="h-8 w-8 text-green-500" /> : <FileText className="h-8 w-8 text-green-500" />}
                  <div className="text-left">
                    <p className="font-medium text-white">{file.name}</p>
                    <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setFile(null); clearExtraction(); setLineItems([]); }}
                  className="text-gray-400 hover:text-red-400">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-10 w-10 text-gray-400 mx-auto" />
                <p className="text-sm text-gray-300">{t('invoiceExtraction.supportedFormats') || 'Drag & drop your invoice here'}</p>
                <p className="text-xs text-gray-500">or</p>
                <label className="cursor-pointer">
                  <span className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700 transition">Browse Files</span>
                  <input type="file" className="hidden" accept="application/pdf,image/jpeg,image/png" onChange={handleFileChange} />
                </label>
                <p className="text-xs text-gray-500 mt-2">{t('invoiceExtraction.supportedFormats')}</p>
              </div>
            )}
          </div>

          {/* AI Extract Button */}
          {file && !extractedData && !extracting && (
            <Button type="button" onClick={handleExtract} className="w-full bg-purple-600 hover:bg-purple-700">
              <Sparkles className="h-4 w-4 mr-2" />
              {t('invoiceExtraction.extractWithAI')}
              <span className="ml-2 text-xs opacity-70">({CREDIT_COSTS.AI_INVOICE_EXTRACTION} {t('invoiceExtraction.creditsCost')})</span>
            </Button>
          )}

          {/* Extracting Loader */}
          {extracting && (
            <div className="flex items-center justify-center gap-3 py-4 text-purple-400">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>{t('invoiceExtraction.extracting')}</span>
            </div>
          )}

          {/* Confidence Badge */}
          {extractedData && (
            <div className="flex items-center gap-2 text-sm">
              <Badge className={confidence > 0.8 ? 'bg-green-600' : confidence > 0.5 ? 'bg-yellow-600' : 'bg-red-600'}>
                {confidence > 0.8 ? t('invoiceExtraction.confidenceHigh') : confidence > 0.5 ? t('invoiceExtraction.confidenceMedium') : t('invoiceExtraction.confidenceLow')}
              </Badge>
              <span className="text-gray-400 text-xs">{t('invoiceExtraction.reviewData')}</span>
            </div>
          )}

          {/* Main Form Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Invoice Number</Label>
              <Input value={formData.invoice_number} onChange={(e) => setFormData({...formData, invoice_number: e.target.value})}
                required className={`bg-gray-700 border-gray-600 ${extractedData ? 'border-purple-500/50' : ''}`} />
            </div>
            <div className="space-y-2">
              <Label>Payment Status</Label>
              <Select value={formData.payment_status} onValueChange={(val) => setFormData({...formData, payment_status: val})}>
                <SelectTrigger className="bg-gray-700 border-gray-600"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-gray-800 border-gray-700 text-white">
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="paid">Paid</SelectItem>
                  <SelectItem value="overdue">Overdue</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Invoice Date</Label>
              <Input type="date" value={formData.invoice_date} onChange={(e) => setFormData({...formData, invoice_date: e.target.value})}
                required className={`bg-gray-700 border-gray-600 ${extractedData ? 'border-purple-500/50' : ''}`} />
            </div>
            <div className="space-y-2">
              <Label>Due Date</Label>
              <Input type="date" value={formData.due_date} onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                className={`bg-gray-700 border-gray-600 ${extractedData ? 'border-purple-500/50' : ''}`} />
            </div>
            <div className="space-y-2">
              <Label>Total Amount</Label>
              <Input type="number" step="0.01" value={formData.total_amount} onChange={(e) => setFormData({...formData, total_amount: e.target.value})}
                required className={`bg-gray-700 border-gray-600 ${extractedData ? 'border-purple-500/50' : ''}`} />
            </div>
          </div>

          {/* Advanced Details Toggle */}
          <button type="button" onClick={() => setShowAdvanced(!showAdvanced)}
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition">
            {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {t('invoiceExtraction.advancedDetails')}
          </button>

          {showAdvanced && (
            <div className="space-y-4 border border-gray-700 rounded-lg p-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t('invoiceExtraction.preTaxAmount')}</Label>
                  <Input type="number" step="0.01" value={advancedData.total_ht}
                    onChange={(e) => setAdvancedData({...advancedData, total_ht: e.target.value})}
                    className="bg-gray-700 border-gray-600" />
                </div>
                <div className="space-y-2">
                  <Label>{t('invoiceExtraction.taxAmount')}</Label>
                  <Input type="number" step="0.01" value={advancedData.total_tva}
                    onChange={(e) => setAdvancedData({...advancedData, total_tva: e.target.value})}
                    className="bg-gray-700 border-gray-600" />
                </div>
                <div className="space-y-2">
                  <Label>{t('invoiceExtraction.currency')}</Label>
                  <Input value={advancedData.currency} onChange={(e) => setAdvancedData({...advancedData, currency: e.target.value})}
                    className="bg-gray-700 border-gray-600" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('invoiceExtraction.supplierVatNumber')}</Label>
                  <Input value={advancedData.supplier_vat_number}
                    onChange={(e) => setAdvancedData({...advancedData, supplier_vat_number: e.target.value})}
                    className="bg-gray-700 border-gray-600" />
                </div>
                <div className="space-y-2">
                  <Label>{t('invoiceExtraction.paymentTerms')}</Label>
                  <Input value={advancedData.payment_terms}
                    onChange={(e) => setAdvancedData({...advancedData, payment_terms: e.target.value})}
                    className="bg-gray-700 border-gray-600" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('invoiceExtraction.ibanLabel')}</Label>
                  <Input value={advancedData.iban} onChange={(e) => setAdvancedData({...advancedData, iban: e.target.value})}
                    className="bg-gray-700 border-gray-600" />
                </div>
                <div className="space-y-2">
                  <Label>{t('invoiceExtraction.bicLabel')}</Label>
                  <Input value={advancedData.bic} onChange={(e) => setAdvancedData({...advancedData, bic: e.target.value})}
                    className="bg-gray-700 border-gray-600" />
                </div>
              </div>
            </div>
          )}

          {/* Line Items Table */}
          {lineItems.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm">{t('invoiceExtraction.lineItems')} ({lineItems.length})</Label>
              <div className="overflow-x-auto border border-gray-700 rounded-lg">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-700 text-gray-400">
                      <th className="py-2 px-3 text-left">Description</th>
                      <th className="py-2 px-3 text-right">Qty</th>
                      <th className="py-2 px-3 text-right">Unit Price</th>
                      <th className="py-2 px-3 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineItems.map((item, i) => (
                      <tr key={i} className="border-b border-gray-800">
                        <td className="py-1.5 px-3 text-gray-300">{item.description}</td>
                        <td className="py-1.5 px-3 text-right text-gray-300">{item.quantity}</td>
                        <td className="py-1.5 px-3 text-right text-gray-300">{item.unit_price?.toFixed(2)}</td>
                        <td className="py-1.5 px-3 text-right text-white">{item.total?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {loading && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-gray-400">
                <span>Uploading...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-1 bg-gray-700" />
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} className="border-gray-600 text-gray-400 hover:bg-gray-700 hover:text-white">
              Cancel
            </Button>
            <Button type="submit" disabled={!file || loading || extracting} className="bg-blue-600 hover:bg-blue-700">
              {loading ? 'Uploading...' : 'Save Invoice'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UploadInvoiceModal;
