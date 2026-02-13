import { useState } from 'react';
import { extractInvoiceData } from '@/services/invoiceExtractionService';
import { useToast } from '@/components/ui/use-toast';

export const useInvoiceExtraction = () => {
  const [extracting, setExtracting] = useState(false);
  const [extractedData, setExtractedData] = useState(null);
  const [extractionError, setExtractionError] = useState(null);
  const { toast } = useToast();

  const extractInvoice = async (filePath, fileType, userId, accessToken) => {
    setExtracting(true);
    setExtractionError(null);

    try {
      const data = await extractInvoiceData({ filePath, fileType, userId, accessToken });
      setExtractedData(data);
      toast({
        title: 'Extraction complete',
        description: 'Invoice data has been extracted. Please review and confirm.',
      });
      return data;
    } catch (err) {
      const message = err.message === 'insufficient_credits'
        ? 'Not enough credits for AI extraction'
        : err.message === 'extraction_failed'
        ? 'Could not extract data from this document. Please fill in manually.'
        : err.message;

      setExtractionError(message);
      toast({
        title: 'Extraction failed',
        description: message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setExtracting(false);
    }
  };

  const clearExtraction = () => {
    setExtractedData(null);
    setExtractionError(null);
  };

  return {
    extractInvoice,
    extracting,
    extractedData,
    extractionError,
    clearExtraction,
  };
};
