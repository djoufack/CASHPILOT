
import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useToast } from '@/components/ui/use-toast';
import { useAuth } from '@/context/AuthContext';

export const useInvoiceUpload = () => {
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const validateFile = (file) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    const isTypeValid = allowedTypes.includes(file.type);
    const isSizeValid = file.size <= 10 * 1024 * 1024; // 10MB

    if (!isTypeValid) throw new Error("Only PDF, JPG and PNG files are allowed");
    if (!isSizeValid) throw new Error("File size must be less than 10MB");
  };

  const uploadInvoice = async (file, invoiceId, supplierId) => {
    if (!user) return;
    setLoading(true);
    setProgress(0);
    setError(null);

    try {
      validateFile(file);

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${user.id}/${supplierId}/${invoiceId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('supplier-invoices')
        .upload(filePath, file, {
          upsert: false,
          contentType: file.type
        });

      if (uploadError) throw uploadError;

      // Get signed URL for access (since bucket is private)
      // Note: We'll store the public path but generate signed URLs on demand for download
      // For record keeping, we store the path or a "public" url if we decide to make it public.
      // Since it's private, we just store the path in metadata.
      
      const { data: fileRecord, error: dbError } = await supabase
        .from('supplier_invoice_files')
        .insert([{
          invoice_id: invoiceId,
          file_url: filePath, // Storing the path as key
          file_name: file.name,
          file_size: file.size
        }])
        .select()
        .single();

      if (dbError) throw dbError;

      toast({
        title: "Upload Successful",
        description: "Invoice file has been uploaded."
      });
      
      return fileRecord;

    } catch (err) {
      console.error(err);
      setError(err.message);
      toast({
        title: "Upload Failed",
        description: err.message,
        variant: "destructive"
      });
      throw err;
    } finally {
      setLoading(false);
      setProgress(100);
    }
  };

  const downloadInvoice = async (filePath) => {
    try {
      const { data, error } = await supabase.storage
        .from('supplier-invoices')
        .createSignedUrl(filePath, 60); // 60 seconds validity

      if (error) throw error;
      window.open(data.signedUrl, '_blank');
    } catch (err) {
      toast({
        title: "Download Failed",
        description: err.message,
        variant: "destructive"
      });
    }
  };
  
  const getInvoiceFiles = async (invoiceId) => {
      try {
          const { data, error } = await supabase
            .from('supplier_invoice_files')
            .select('*')
            .eq('invoice_id', invoiceId);
            
          if(error) throw error;
          return data;
      } catch (err) {
          console.error(err);
          return [];
      }
  };

  const deleteInvoiceFile = async (fileId, filePath) => {
      try {
          // Delete from storage
          const { error: storageError } = await supabase.storage
             .from('supplier-invoices')
             .remove([filePath]);
             
          if(storageError) throw storageError;
          
          // Delete from DB
          const { error: dbError } = await supabase
             .from('supplier_invoice_files')
             .delete()
             .eq('id', fileId);
             
          if(dbError) throw dbError;
          
          toast({ title: "Deleted", description: "File deleted successfully" });
          return true;
      } catch (err) {
          toast({ title: "Error", description: err.message, variant: "destructive" });
          return false;
      }
  };

  return {
    uploadInvoice,
    downloadInvoice,
    getInvoiceFiles,
    deleteInvoiceFile,
    loading,
    progress,
    error
  };
};
