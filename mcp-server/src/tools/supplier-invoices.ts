import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase, getUserId, getAccessToken, getSupabaseUrl } from '../supabase.js';
import { sanitizeText } from '../utils/sanitize.js';

export function registerSupplierInvoiceTools(server: McpServer) {

  // ── Extract & create a supplier invoice from an image/PDF ──────────
  server.tool(
    'extract_supplier_invoice',
    'Extract structured data from a supplier invoice image or PDF using AI (Gemini). ' +
    'Uploads the file, calls AI extraction, and creates the supplier_invoice + line_items records. ' +
    'Costs 3 credits. Accepts base64-encoded file data.',
    {
      file_data: z.string().describe('Base64-encoded file content (image or PDF)'),
      file_name: z.string().describe('Original file name (e.g. "invoice-2026-001.pdf")'),
      file_type: z.enum(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
        .describe('MIME type of the file'),
      supplier_id: z.string().optional()
        .describe('Existing supplier UUID. If omitted, a new supplier is auto-created from extracted data.'),
    },
    async ({ file_data, file_name, file_type, supplier_id }) => {
      const userId = getUserId();
      const accessToken = getAccessToken();
      const supabaseUrl = getSupabaseUrl();

      // 1. Upload file to storage bucket supplier-invoices/{userId}/{filename}
      const storagePath = `${userId}/${Date.now()}-${file_name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

      const fileBuffer = Buffer.from(file_data, 'base64');

      const { error: uploadError } = await supabase.storage
        .from('supplier-invoices')
        .upload(storagePath, fileBuffer, {
          contentType: file_type,
          upsert: false,
        });

      if (uploadError) {
        return {
          content: [{ type: 'text' as const, text: `Upload failed: ${uploadError.message}` }]
        };
      }

      // 2. Call the extract-invoice Edge Function
      let extractedData: any;
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/extract-invoice`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            filePath: storagePath,
            fileType: file_type,
            userId,
          }),
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({ error: 'Extraction failed' }));

          if (response.status === 402) {
            return { content: [{ type: 'text' as const, text: 'Insufficient credits. AI extraction costs 3 credits.' }] };
          }
          if (response.status === 422) {
            return { content: [{ type: 'text' as const, text: 'Could not extract data from this document. Please create the invoice manually.' }] };
          }
          if (response.status === 502) {
            return { content: [{ type: 'text' as const, text: 'AI service temporarily unavailable. Please retry later.' }] };
          }

          return {
            content: [{ type: 'text' as const, text: `Extraction error: ${errBody.error || errBody.message || 'Unknown error'}` }]
          };
        }

        const result = await response.json();
        extractedData = result.data;
      } catch (err: any) {
        return {
          content: [{ type: 'text' as const, text: `Edge Function call failed: ${err.message}` }]
        };
      }

      // 3. Resolve or create supplier
      let resolvedSupplierId = supplier_id || null;

      if (!resolvedSupplierId && extractedData.supplier_name) {
        // Try to match an existing supplier by name
        const { data: existingSuppliers } = await supabase
          .from('suppliers')
          .select('id, company_name')
          .eq('user_id', userId)
          .ilike('company_name', extractedData.supplier_name.trim())
          .limit(1);

        if (existingSuppliers && existingSuppliers.length > 0) {
          resolvedSupplierId = existingSuppliers[0].id;
        } else {
          // Auto-create a new supplier from extracted data
          const { data: newSupplier, error: supplierError } = await supabase
            .from('suppliers')
            .insert([{
              user_id: userId,
              company_name: sanitizeText(extractedData.supplier_name),
              address: sanitizeText(extractedData.supplier_address) || null,
              tax_id: sanitizeText(extractedData.supplier_vat_number) || null,
              iban: sanitizeText(extractedData.iban) || null,
              bic_swift: sanitizeText(extractedData.bic) || null,
              currency: extractedData.currency || 'EUR',
              status: 'active',
            }])
            .select('id')
            .single();

          if (supplierError) {
            return {
              content: [{ type: 'text' as const, text: `Supplier creation failed: ${supplierError.message}. Extracted data: ${JSON.stringify(extractedData, null, 2)}` }]
            };
          }
          resolvedSupplierId = newSupplier.id;
        }
      }

      if (!resolvedSupplierId) {
        return {
          content: [{
            type: 'text' as const,
            text: `AI extraction succeeded but no supplier could be identified. Please provide a supplier_id or ensure the document contains a supplier name.\n\nExtracted data:\n${JSON.stringify(extractedData, null, 2)}`
          }]
        };
      }

      // 4. Store the storage path as file_url (bucket is private, use signed URLs for access)
      const fileUrl = storagePath;

      // 5. Insert supplier_invoice record
      const { data: invoice, error: invoiceError } = await supabase
        .from('supplier_invoices')
        .insert([{
          supplier_id: resolvedSupplierId,
          invoice_number: sanitizeText(extractedData.invoice_number) || `AI-${Date.now()}`,
          invoice_date: extractedData.invoice_date || null,
          due_date: extractedData.due_date || null,
          total_ht: extractedData.total_ht ?? null,
          vat_amount: extractedData.total_tva ?? null,
          vat_rate: extractedData.tva_rate ?? null,
          total_ttc: extractedData.total_ttc ?? null,
          total_amount: extractedData.total_ttc ?? extractedData.total_ht ?? 0,
          currency: extractedData.currency || 'EUR',
          supplier_name_extracted: sanitizeText(extractedData.supplier_name) || null,
          supplier_address_extracted: sanitizeText(extractedData.supplier_address) || null,
          supplier_vat_number: sanitizeText(extractedData.supplier_vat_number) || null,
          payment_terms: sanitizeText(extractedData.payment_terms) || null,
          iban: sanitizeText(extractedData.iban) || null,
          bic: sanitizeText(extractedData.bic) || null,
          file_url: fileUrl,
          payment_status: 'pending',
          ai_extracted: true,
          ai_confidence: extractedData.confidence ?? null,
          ai_raw_response: extractedData,
          ai_extracted_at: new Date().toISOString(),
        }])
        .select('*')
        .single();

      if (invoiceError) {
        return {
          content: [{ type: 'text' as const, text: `Invoice creation failed: ${invoiceError.message}` }]
        };
      }

      // 6. Insert line items if present
      let lineItemsCreated = 0;
      if (extractedData.line_items && Array.isArray(extractedData.line_items) && extractedData.line_items.length > 0) {
        const lineItems = extractedData.line_items.map((item: any, index: number) => ({
          invoice_id: invoice.id,
          description: sanitizeText(item.description) || 'Item',
          quantity: item.quantity ?? 1,
          unit_price: item.unit_price ?? null,
          total: item.total ?? null,
          sort_order: index,
        }));

        const { error: lineError } = await supabase
          .from('supplier_invoice_line_items')
          .insert(lineItems);

        if (lineError) {
          // Non-blocking: invoice was created, just warn about line items
          return {
            content: [{
              type: 'text' as const,
              text: `Invoice created (ID: ${invoice.id}) but line items failed: ${lineError.message}\n\nInvoice:\n${JSON.stringify(invoice, null, 2)}`
            }]
          };
        }
        lineItemsCreated = lineItems.length;
      }

      // 7. Generate a signed URL so the user can view the document
      let viewUrl = '(not available)';
      const { data: signedData } = await supabase.storage
        .from('supplier-invoices')
        .createSignedUrl(storagePath, 3600); // 1 hour expiry
      if (signedData?.signedUrl) viewUrl = signedData.signedUrl;

      // 8. Return success with full details
      return {
        content: [{
          type: 'text' as const,
          text: `Supplier invoice extracted and created successfully!\n\n` +
            `Invoice ID: ${invoice.id}\n` +
            `Invoice #: ${invoice.invoice_number}\n` +
            `Supplier: ${extractedData.supplier_name || 'Unknown'} (ID: ${resolvedSupplierId})\n` +
            `Date: ${invoice.invoice_date || 'N/A'}\n` +
            `Total HT: ${invoice.total_ht ?? 'N/A'} ${invoice.currency}\n` +
            `VAT: ${invoice.vat_amount ?? 'N/A'} ${invoice.currency} (${invoice.vat_rate ?? 'N/A'}%)\n` +
            `Total TTC: ${invoice.total_ttc ?? 'N/A'} ${invoice.currency}\n` +
            `Line items: ${lineItemsCreated}\n` +
            `AI confidence: ${extractedData.confidence ?? 'N/A'}\n\n` +
            `📄 View document (link valid 1h):\n${viewUrl}\n\n` +
            `Full data:\n${JSON.stringify(invoice, null, 2)}`
        }]
      };
    }
  );

  // ── List supplier invoices ──────────────────────────────────────────
  server.tool(
    'list_supplier_invoices',
    'List supplier invoices with optional filters',
    {
      supplier_id: z.string().optional().describe('Filter by supplier UUID'),
      payment_status: z.string().optional().describe('Filter by payment_status: pending, paid, partial, overdue'),
      limit: z.number().optional().describe('Max results (default 50)'),
    },
    async ({ supplier_id, payment_status, limit }) => {
      let query = supabase
        .from('supplier_invoices')
        .select('*, supplier:suppliers(id, company_name, contact_person)')
        .order('created_at', { ascending: false })
        .limit(limit ?? 50);

      if (supplier_id) query = query.eq('supplier_id', supplier_id);
      if (payment_status) query = query.eq('payment_status', payment_status);

      const { data, error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }]
      };
    }
  );

  // ── Get a single supplier invoice with line items ───────────────────
  server.tool(
    'get_supplier_invoice',
    'Get full details of a supplier invoice including line items',
    {
      invoice_id: z.string().describe('Supplier invoice UUID'),
    },
    async ({ invoice_id }) => {
      const { data, error } = await supabase
        .from('supplier_invoices')
        .select('*, supplier:suppliers(*), line_items:supplier_invoice_line_items(*)')
        .eq('id', invoice_id)
        .single();

      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };

      // Generate a signed URL if file_url is a storage path (not already a full URL)
      let signedFileUrl: string | null = null;
      if (data.file_url && !data.file_url.startsWith('http')) {
        const { data: signedData } = await supabase.storage
          .from('supplier-invoices')
          .createSignedUrl(data.file_url, 3600); // 1 hour expiry
        signedFileUrl = signedData?.signedUrl || null;
      }

      const result = { ...data, signed_file_url: signedFileUrl };

      // Build a human-readable summary + the raw JSON
      const summary = [
        `Invoice #: ${data.invoice_number || 'N/A'}`,
        `Supplier: ${data.supplier?.company_name || data.supplier_name_extracted || 'N/A'}`,
        `Date: ${data.invoice_date || 'N/A'} | Due: ${data.due_date || 'N/A'}`,
        `Total HT: ${data.total_ht ?? 'N/A'} ${data.currency || 'EUR'} | TVA: ${data.vat_amount ?? 'N/A'} | TTC: ${data.total_ttc ?? 'N/A'}`,
        `Status: ${data.payment_status || 'N/A'}`,
        data.line_items?.length ? `Line items: ${data.line_items.length}` : null,
        signedFileUrl ? `\n📄 View document (link valid 1h):\n${signedFileUrl}` : (data.file_url ? `File: ${data.file_url} (use download_supplier_invoice to get a viewable link)` : 'No file attached'),
      ].filter(Boolean).join('\n');

      return {
        content: [{ type: 'text' as const, text: `${summary}\n\nFull data:\n${JSON.stringify(result, null, 2)}` }]
      };
    }
  );

  // ── Download / view a supplier invoice document ────────────────────
  server.tool(
    'download_supplier_invoice',
    'Get a temporary download/view URL for a supplier invoice document (PDF or image). ' +
    'Returns a signed URL valid for 1 hour that can be opened in a browser.',
    {
      invoice_id: z.string().describe('Supplier invoice UUID'),
    },
    async ({ invoice_id }) => {
      const { data, error } = await supabase
        .from('supplier_invoices')
        .select('id, invoice_number, file_url, supplier_name_extracted')
        .eq('id', invoice_id)
        .single();

      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };

      if (!data.file_url) {
        return {
          content: [{ type: 'text' as const, text: `Invoice ${data.invoice_number || invoice_id} has no attached document.` }]
        };
      }

      // Generate signed URL (works for both storage paths and already-signed URLs)
      if (data.file_url.startsWith('http')) {
        return {
          content: [{ type: 'text' as const, text: `📄 Document for invoice ${data.invoice_number}:\n${data.file_url}` }]
        };
      }

      const { data: signedData, error: signError } = await supabase.storage
        .from('supplier-invoices')
        .createSignedUrl(data.file_url, 3600); // 1 hour

      if (signError || !signedData?.signedUrl) {
        return {
          content: [{ type: 'text' as const, text: `Could not generate download URL: ${signError?.message || 'unknown error'}. Storage path: ${data.file_url}` }]
        };
      }

      return {
        content: [{
          type: 'text' as const,
          text: `📄 Document for invoice ${data.invoice_number || 'N/A'} (${data.supplier_name_extracted || 'Unknown supplier'}):\n\n` +
            `${signedData.signedUrl}\n\n` +
            `This link is valid for 1 hour. Open it in a browser to view or download the document.`
        }]
      };
    }
  );

  // ── Update supplier invoice payment status ──────────────────────────
  server.tool(
    'update_supplier_invoice_status',
    'Update the payment status of a supplier invoice',
    {
      invoice_id: z.string().describe('Supplier invoice UUID'),
      payment_status: z.enum(['pending', 'paid', 'partial', 'overdue']).describe('New payment status'),
    },
    async ({ invoice_id, payment_status }) => {
      const { data, error } = await supabase
        .from('supplier_invoices')
        .update({ payment_status, updated_at: new Date().toISOString() })
        .eq('id', invoice_id)
        .select('id, invoice_number, payment_status')
        .single();

      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };

      return {
        content: [{ type: 'text' as const, text: `Updated invoice ${data.invoice_number} status to "${data.payment_status}"` }]
      };
    }
  );
}
