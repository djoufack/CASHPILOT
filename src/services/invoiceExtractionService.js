/**
 * Invoice Extraction Service
 * Calls the extract-invoice Edge Function to extract structured data
 * from supplier invoices using Google Gemini AI.
 */

import { supabaseUrl, supabaseAnonKey } from '@/lib/customSupabaseClient';

/**
 * Extract structured data from a supplier invoice file
 * @param {Object} params
 * @param {string} params.filePath - Storage path of the uploaded file
 * @param {string} params.fileType - MIME type (application/pdf, image/jpeg, image/png)
 * @param {string} params.userId - User ID
 * @returns {Promise<Object>} Extracted invoice data
 */
export const extractInvoiceData = async ({ filePath, fileType, userId }) => {
  if (!supabaseUrl) {
    throw new Error('Supabase URL not configured');
  }

  const response = await fetch(`${supabaseUrl}/functions/v1/extract-invoice`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({ filePath, fileType, userId }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Extraction failed' }));

    if (response.status === 402) {
      throw new Error('insufficient_credits');
    }
    if (response.status === 404) {
      throw new Error('File not found in storage');
    }
    if (response.status === 422) {
      throw new Error('extraction_failed');
    }
    if (response.status === 502) {
      throw new Error('AI service temporarily unavailable');
    }

    throw new Error(error.error || error.message || 'Invoice extraction failed');
  }

  const result = await response.json();
  return result.data;
};
