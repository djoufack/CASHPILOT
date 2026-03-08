import { supabase } from '@/lib/supabase';

/**
 * Upload a generated document (PDF/XML/CSV) to Supabase Storage
 * and optionally update the source record with the file URL.
 *
 * @param {Object} params
 * @param {string} params.bucket - Storage bucket name (e.g., 'invoices', 'quotes')
 * @param {string} params.userId - User ID for folder isolation
 * @param {string} params.fileName - File name (e.g., 'INV-2026-001.pdf')
 * @param {Blob|ArrayBuffer} params.fileData - The file content
 * @param {string} params.contentType - MIME type (e.g., 'application/pdf')
 * @param {string} [params.table] - DB table to update (e.g., 'invoices')
 * @param {string} [params.recordId] - Record ID to update with file_url
 * @returns {Promise<{url: string, path: string}>}
 */
export async function uploadDocument({ bucket, userId, fileName, fileData, contentType, table, recordId }) {
  if (!userId || !fileName || !fileData) {
    throw new Error('uploadDocument requires userId, fileName and fileData');
  }

  const filePath = `${userId}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(filePath, fileData, {
      contentType,
      upsert: true
    });

  if (uploadError) throw uploadError;

  // Get signed URL (1 year expiry for audit trail)
  const { data: urlData } = await supabase.storage
    .from(bucket)
    .createSignedUrl(filePath, 365 * 24 * 60 * 60);

  const url = urlData?.signedUrl || filePath;

  // Update DB record with file URL if table and recordId provided
  if (table && recordId) {
    await supabase.from(table)
      .update({ file_url: url, file_generated_at: new Date().toISOString() })
      .eq('id', recordId);
  }

  return { url, path: filePath };
}
