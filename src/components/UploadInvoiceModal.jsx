
import React, { useState } from 'react';
import { useInvoiceUpload } from '@/hooks/useInvoiceUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Upload, X, FileText } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

const UploadInvoiceModal = ({ isOpen, onClose, supplierId, onUploadSuccess }) => {
  const { uploadInvoice, loading, progress, error } = useInvoiceUpload();
  const [file, setFile] = useState(null);
  const [formData, setFormData] = useState({
    invoice_number: '',
    invoice_date: new Date().toISOString().split('T')[0],
    due_date: '',
    total_amount: '',
    vat_rate: '20',
    payment_status: 'pending'
  });

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type !== 'application/pdf') {
        alert("Only PDF files are allowed");
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        alert("File size too large (max 10MB)");
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const selectedFile = e.dataTransfer.files[0];
    if (selectedFile) {
        if (selectedFile.type !== 'application/pdf') return;
        setFile(selectedFile);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return;

    try {
      // Note: We need to create the invoice record first to get an ID, 
      // or we can generate an ID here if we used UUID v4 client side, 
      // but usually we call an API to create the record.
      // For this implementation, we'll assume the onUploadSuccess callback expects data 
      // to create the record, OR we create it here via a passed function.
      // Let's assume onUploadSuccess handles the DB creation and we just pass the file and metadata.
      
      // But wait, useInvoiceUpload expects invoiceId. 
      // So we must create the invoice record first.
      
      if (onUploadSuccess) {
          await onUploadSuccess(formData, file);
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
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-gray-800 border-gray-700 text-white max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Supplier Invoice</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Invoice Number</Label>
                    <Input 
                        value={formData.invoice_number}
                        onChange={(e) => setFormData({...formData, invoice_number: e.target.value})}
                        required
                        className="bg-gray-700 border-gray-600"
                    />
                </div>
                 <div className="space-y-2">
                    <Label>Payment Status</Label>
                    <Select 
                        value={formData.payment_status}
                        onValueChange={(val) => setFormData({...formData, payment_status: val})}
                    >
                        <SelectTrigger className="bg-gray-700 border-gray-600">
                            <SelectValue />
                        </SelectTrigger>
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
                    <Input 
                        type="date"
                        value={formData.invoice_date}
                        onChange={(e) => setFormData({...formData, invoice_date: e.target.value})}
                        required
                        className="bg-gray-700 border-gray-600"
                    />
                </div>
                 <div className="space-y-2">
                    <Label>Due Date</Label>
                    <Input 
                        type="date"
                        value={formData.due_date}
                        onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                        className="bg-gray-700 border-gray-600"
                    />
                </div>
                 <div className="space-y-2">
                    <Label>Total Amount</Label>
                    <Input 
                        type="number"
                        step="0.01"
                        value={formData.total_amount}
                        onChange={(e) => setFormData({...formData, total_amount: e.target.value})}
                        required
                        className="bg-gray-700 border-gray-600"
                    />
                </div>
            </div>

            {/* File Upload Area */}
            <div 
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${file ? 'border-green-500 bg-green-900/10' : 'border-gray-600 hover:border-blue-500 hover:bg-gray-700/50'}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
            >
                {file ? (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <FileText className="h-8 w-8 text-green-500" />
                            <div className="text-left">
                                <p className="font-medium text-white">{file.name}</p>
                                <p className="text-xs text-gray-400">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                            </div>
                        </div>
                        <Button 
                            type="button" 
                            variant="ghost" 
                            size="sm"
                            onClick={() => setFile(null)}
                            className="text-gray-400 hover:text-red-400"
                        >
                            <X className="h-4 w-4" />
                        </Button>
                    </div>
                ) : (
                    <div className="space-y-2">
                        <Upload className="h-10 w-10 text-gray-400 mx-auto" />
                        <p className="text-sm text-gray-300">Drag & drop your invoice PDF here</p>
                        <p className="text-xs text-gray-500">or</p>
                        <label className="cursor-pointer">
                            <span className="bg-blue-600 text-white px-3 py-1.5 rounded-md text-sm hover:bg-blue-700 transition">Browse Files</span>
                            <input 
                                type="file" 
                                className="hidden" 
                                accept="application/pdf"
                                onChange={handleFileChange}
                            />
                        </label>
                        <p className="text-xs text-gray-500 mt-2">PDF only, max 10MB</p>
                    </div>
                )}
            </div>

            {loading && (
                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-gray-400">
                        <span>Uploading...</span>
                        <span>{progress}%</span>
                    </div>
                    <Progress value={progress} className="h-1 bg-gray-700" indicatorClassName="bg-blue-500" />
                </div>
            )}
            
            {error && <p className="text-sm text-red-400">{error}</p>}

            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose} className="border-gray-600 text-gray-400 hover:bg-gray-700 hover:text-white">
                    Cancel
                </Button>
                <Button type="submit" disabled={!file || loading} className="bg-blue-600 hover:bg-blue-700">
                    {loading ? 'Uploading...' : 'Save Invoice'}
                </Button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default UploadInvoiceModal;
