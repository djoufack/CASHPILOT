import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase, getUserId } from '../supabase.js';
import { optionalDate } from '../utils/validation.js';
import { safeError } from '../utils/errors.js';

const GED_SOURCE_TABLES = [
  'invoices',
  'quotes',
  'credit_notes',
  'delivery_notes',
  'purchase_orders',
  'supplier_invoices',
] as const;

const GED_SOURCE_CONFIG: Record<(typeof GED_SOURCE_TABLES)[number], { bucket: string }> = {
  invoices: { bucket: 'invoices' },
  quotes: { bucket: 'quotes' },
  credit_notes: { bucket: 'credit-notes' },
  delivery_notes: { bucket: 'delivery-notes' },
  purchase_orders: { bucket: 'purchase-orders' },
  supplier_invoices: { bucket: 'supplier-invoices' },
};

const sanitizeFileName = (value: string): string =>
  String(value || 'document')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_');

export function registerDocumentTools(server: McpServer) {
  // ── 1. upload_ged_document ─────────────────────────────────
  server.tool(
    'upload_ged_document',
    'Upload and attach a file to an existing GED HUB business document (invoice, quote, credit note, delivery note, purchase order, or supplier invoice). ' +
      'Stores the file in Supabase Storage, updates file_url on the source record, and optionally upserts GED metadata.',
    {
      source_table: z.enum(GED_SOURCE_TABLES).describe('Source table of the business document'),
      source_id: z.string().describe('UUID of the source document record'),
      file_data: z.string().describe('Base64-encoded file content'),
      file_name: z.string().describe('Original file name (example: "invoice-2026-003.pdf")'),
      file_type: z.string().optional().describe('MIME type (example: "application/pdf")'),
      upsert_metadata: z.boolean().optional().describe('Whether to upsert GED metadata (default true)'),
      metadata_tags: z.array(z.string()).optional().describe('Optional GED tags'),
      metadata_doc_category: z.string().optional().describe('Optional GED doc_category (default "general")'),
      metadata_confidentiality: z
        .enum(['public', 'internal', 'confidential', 'restricted'])
        .optional()
        .describe('Optional confidentiality level (default "internal")'),
      metadata_retention_until: z.string().optional().describe('Optional retention end date (YYYY-MM-DD)'),
      metadata_is_starred: z.boolean().optional().describe('Optional starred flag'),
      metadata_notes: z.string().optional().describe('Optional metadata notes'),
    },
    async ({
      source_table,
      source_id,
      file_data,
      file_name,
      file_type,
      upsert_metadata,
      metadata_tags,
      metadata_doc_category,
      metadata_confidentiality,
      metadata_retention_until,
      metadata_is_starred,
      metadata_notes,
    }) => {
      const userId = getUserId();
      const sourceConfig = GED_SOURCE_CONFIG[source_table];
      const safeFileName = sanitizeFileName(file_name);

      let base64Payload = String(file_data || '').trim();
      const dataPrefixIndex = base64Payload.indexOf('base64,');
      if (dataPrefixIndex >= 0) {
        base64Payload = base64Payload.slice(dataPrefixIndex + 7);
      }

      let fileBuffer: Buffer;
      try {
        fileBuffer = Buffer.from(base64Payload, 'base64');
      } catch (_err) {
        return { content: [{ type: 'text' as const, text: 'Parameter "file_data" is not valid base64.' }] };
      }

      if (!fileBuffer || fileBuffer.length === 0) {
        return { content: [{ type: 'text' as const, text: 'Parameter "file_data" is empty after base64 decoding.' }] };
      }

      const { data: sourceRecord, error: sourceError } = await supabase
        .from(source_table)
        .select('id, user_id, company_id')
        .eq('id', source_id)
        .eq('user_id', userId)
        .single();

      if (sourceError || !sourceRecord) {
        return {
          content: [
            {
              type: 'text' as const,
              text: safeError(sourceError || 'Source record not found', 'upload GED document - load source'),
            },
          ],
        };
      }

      const storagePath = `${userId}/${source_table}/${source_id}/${Date.now()}-${safeFileName}`;
      const contentType = file_type || 'application/octet-stream';

      const { error: uploadError } = await supabase.storage.from(sourceConfig.bucket).upload(storagePath, fileBuffer, {
        contentType,
        upsert: false,
      });

      if (uploadError) {
        return {
          content: [{ type: 'text' as const, text: safeError(uploadError, 'upload GED document - storage upload') }],
        };
      }

      let { error: updateError } = await supabase
        .from(source_table)
        .update({
          file_url: storagePath,
          file_generated_at: new Date().toISOString(),
        })
        .eq('id', source_id)
        .eq('user_id', userId);

      if (updateError && String(updateError.message || '').includes('file_generated_at')) {
        const retry = await supabase
          .from(source_table)
          .update({ file_url: storagePath })
          .eq('id', source_id)
          .eq('user_id', userId);
        updateError = retry.error;
      }

      if (updateError) {
        return {
          content: [
            { type: 'text' as const, text: safeError(updateError, 'upload GED document - update source record') },
          ],
        };
      }

      const shouldUpsertMetadata = upsert_metadata ?? true;
      let metadataStatus = 'skipped';

      if (shouldUpsertMetadata) {
        const companyId = sourceRecord.company_id;
        if (companyId) {
          const retentionDate = optionalDate(metadata_retention_until);
          if (metadata_retention_until && !retentionDate) {
            return {
              content: [
                {
                  type: 'text' as const,
                  text: 'Parameter "metadata_retention_until" must be a valid date (YYYY-MM-DD)',
                },
              ],
            };
          }

          const metadataPayload = {
            company_id: companyId,
            source_table,
            source_id,
            doc_category: metadata_doc_category || 'general',
            confidentiality_level: metadata_confidentiality || 'internal',
            tags: metadata_tags || [],
            retention_until: retentionDate || null,
            is_starred: metadata_is_starred ?? false,
            notes: metadata_notes || null,
          };

          const { error: metadataError } = await supabase
            .from('document_hub_metadata')
            .upsert(metadataPayload, { onConflict: 'company_id,source_table,source_id' });

          if (metadataError?.code === 'PGRST205') {
            metadataStatus = 'table_missing';
          } else if (metadataError) {
            metadataStatus = `error:${metadataError.message}`;
          } else {
            metadataStatus = 'upserted';
          }
        } else {
          metadataStatus = 'missing_company_id';
        }
      }

      const { data: signedData } = await supabase.storage.from(sourceConfig.bucket).createSignedUrl(storagePath, 3600);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                success: true,
                source_table,
                source_id,
                bucket: sourceConfig.bucket,
                storage_path: storagePath,
                content_type: contentType,
                signed_url_1h: signedData?.signedUrl || null,
                metadata_status: metadataStatus,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // ── 2. create_quote ───────────────────────────────────────
  server.tool(
    'create_quote',
    'Create a new quote (devis) with line items. Auto-calculates totals and tax.',
    {
      client_id: z.string().describe('Client UUID'),
      quote_number: z.string().optional().describe('Quote number (auto-generated if omitted)'),
      valid_until: z.string().optional().describe('Validity date (YYYY-MM-DD)'),
      notes: z.string().optional().describe('Notes or terms'),
      tax_rate: z.number().min(0).max(100).multipleOf(0.01).optional().describe('Tax rate in % (default 20)'),
      items: z
        .array(
          z.object({
            description: z.string().describe('Item description'),
            quantity: z.number().min(0).describe('Quantity'),
            unit_price: z.number().min(0).max(999999999.99).multipleOf(0.01).describe('Unit price HT'),
          })
        )
        .describe('Quote line items'),
    },
    async ({ client_id, quote_number, valid_until, notes, tax_rate, items }) => {
      const validUntilDate = optionalDate(valid_until);
      if (valid_until && !validUntilDate)
        return {
          content: [{ type: 'text' as const, text: "Parameter 'valid_until' must be a valid date (YYYY-MM-DD)" }],
        };

      const userId = getUserId();
      const rate = tax_rate ?? 20;

      const totalHt = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
      const taxAmount = totalHt * (rate / 100);
      const totalTtc = totalHt + taxAmount;

      const quoteNum = quote_number || `DEV-${Date.now().toString(36).toUpperCase()}`;

      const { data: quote, error } = await supabase
        .from('quotes')
        .insert([
          {
            user_id: userId,
            client_id,
            quote_number: quoteNum,
            date: new Date().toISOString().split('T')[0],
            valid_until: validUntilDate || null,
            total_ht: Math.round(totalHt * 100) / 100,
            total_ttc: Math.round(totalTtc * 100) / 100,
            tax_rate: rate,
            tax_amount: Math.round(taxAmount * 100) / 100,
            status: 'draft',
            notes: notes || null,
            items,
          },
        ])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create quote') }] };
      return {
        content: [{ type: 'text' as const, text: `Quote created: ${quoteNum}\n${JSON.stringify(quote, null, 2)}` }],
      };
    }
  );

  // ── 3. convert_quote_to_invoice ───────────────────────────
  server.tool(
    'convert_quote_to_invoice',
    'Convert an accepted quote into an invoice. Copies all details and marks the quote as converted.',
    {
      quote_id: z.string().describe('Quote UUID to convert'),
    },
    async ({ quote_id }) => {
      const userId = getUserId();

      const { data: quote, error: qErr } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', quote_id)
        .eq('user_id', userId)
        .single();

      if (qErr || !quote)
        return {
          content: [{ type: 'text' as const, text: safeError(qErr || 'Quote not found', 'convert quote to invoice') }],
        };

      const invoiceNumber = `FAC-${Date.now().toString(36).toUpperCase()}`;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const { data: invoice, error: invErr } = await supabase
        .from('invoices')
        .insert([
          {
            user_id: userId,
            client_id: quote.client_id,
            invoice_number: invoiceNumber,
            date: new Date().toISOString().split('T')[0],
            due_date: dueDate.toISOString().split('T')[0],
            total_ht: quote.total_ht,
            total_ttc: quote.total_ttc,
            tax_rate: quote.tax_rate,
            status: 'draft',
            payment_status: 'unpaid',
            notes: quote.notes,
            quote_id: quote.id,
          },
        ])
        .select()
        .single();

      if (invErr) return { content: [{ type: 'text' as const, text: safeError(invErr, 'convert quote to invoice') }] };

      await supabase
        .from('quotes')
        .update({ status: 'converted', converted_invoice_id: invoice.id })
        .eq('id', quote_id);

      return {
        content: [
          {
            type: 'text' as const,
            text: `Quote ${quote.quote_number} converted to invoice ${invoiceNumber}\n${JSON.stringify(invoice, null, 2)}`,
          },
        ],
      };
    }
  );

  // ── 4. create_credit_note ─────────────────────────────────
  server.tool(
    'create_credit_note',
    'Create a credit note (avoir) linked to an invoice. Partial or full refund.',
    {
      invoice_id: z.string().describe('Original invoice UUID'),
      amount: z
        .number()
        .min(0)
        .max(999999999.99)
        .multipleOf(0.01)
        .optional()
        .describe('Credit amount TTC (defaults to full invoice amount)'),
      reason: z.string().optional().describe('Reason for credit note'),
    },
    async ({ invoice_id, amount, reason }) => {
      const userId = getUserId();

      const [{ data: invoice, error: invErr }, { data: companyData }] = await Promise.all([
        supabase.from('invoices').select('*').eq('id', invoice_id).eq('user_id', userId).single(),
        supabase.from('company').select('currency').eq('user_id', userId).limit(1).single(),
      ]);
      const currency = companyData?.currency || 'EUR';

      if (invErr || !invoice)
        return {
          content: [{ type: 'text' as const, text: safeError(invErr || 'Invoice not found', 'create credit note') }],
        };

      const creditAmount = amount ?? parseFloat(invoice.total_ttc) ?? 0;
      const creditNumber = `AV-${Date.now().toString(36).toUpperCase()}`;

      const { data: creditNote, error } = await supabase
        .from('credit_notes')
        .insert([
          {
            user_id: userId,
            invoice_id,
            client_id: invoice.client_id,
            credit_note_number: creditNumber,
            date: new Date().toISOString().split('T')[0],
            amount: Math.round(creditAmount * 100) / 100,
            reason: reason || null,
            status: 'draft',
          },
        ])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create credit note') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: `Credit note created: ${creditNumber} for ${creditAmount} ${currency}\n${JSON.stringify(creditNote, null, 2)}`,
          },
        ],
      };
    }
  );

  // ── 5. create_expense ─────────────────────────────────────
  server.tool(
    'create_expense',
    'Record an expense with automatic HT/TVA calculation from TTC amount',
    {
      amount_ttc: z.number().min(0).max(999999999.99).multipleOf(0.01).describe('Total amount TTC (tax included)'),
      tax_rate: z.number().min(0).max(100).multipleOf(0.01).optional().describe('Tax rate % (default 20)'),
      category: z.string().optional().describe('Expense category'),
      description: z.string().optional().describe('Description'),
      expense_date: z.string().optional().describe('Date (YYYY-MM-DD), default today'),
      client_id: z.string().optional().describe('Client UUID if billable expense'),
      receipt_url: z.string().optional().describe('URL to receipt image'),
      refacturable: z.boolean().optional().describe('Whether expense can be billed to client'),
    },
    async ({ amount_ttc, tax_rate, category, description, expense_date, client_id, receipt_url, refacturable }) => {
      const validExpenseDate = optionalDate(expense_date);
      if (expense_date && !validExpenseDate)
        return {
          content: [{ type: 'text' as const, text: "Parameter 'expense_date' must be a valid date (YYYY-MM-DD)" }],
        };

      const userId = getUserId();
      const rate = tax_rate ?? 20;
      const amountHt = amount_ttc / (1 + rate / 100);
      const taxAmount = amount_ttc - amountHt;

      // Fetch company currency for display
      const { data: companyData } = await supabase
        .from('company')
        .select('currency')
        .eq('user_id', userId)
        .limit(1)
        .single();
      const currency = companyData?.currency || 'EUR';

      const { data, error } = await supabase
        .from('expenses')
        .insert([
          {
            user_id: userId,
            amount: Math.round(amount_ttc * 100) / 100,
            amount_ht: Math.round(amountHt * 100) / 100,
            tax_amount: Math.round(taxAmount * 100) / 100,
            tax_rate: rate,
            category: category || null,
            description: description || null,
            expense_date: validExpenseDate || new Date().toISOString().split('T')[0],
            client_id: client_id || null,
            receipt_url: receipt_url || null,
            refacturable: refacturable ?? false,
          },
        ])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'create expense') }] };
      return {
        content: [
          {
            type: 'text' as const,
            text: `Expense recorded: ${Math.round(amount_ttc * 100) / 100} ${currency} TTC (${Math.round(amountHt * 100) / 100} HT + ${Math.round(taxAmount * 100) / 100} TVA)\n${JSON.stringify(data, null, 2)}`,
          },
        ],
      };
    }
  );

  // ── 6. get_supplier_balance ───────────────────────────────
  server.tool(
    'get_supplier_balance',
    'Get a supplier balance summary: total invoiced, paid, outstanding, overdue',
    {
      supplier_id: z.string().describe('Supplier UUID'),
    },
    async ({ supplier_id }) => {
      const userId = getUserId();

      const [supplierRes, invoicesRes] = await Promise.all([
        supabase.from('suppliers').select('name, email').eq('id', supplier_id).eq('user_id', userId).single(),
        supabase
          .from('supplier_invoices')
          .select('total_amount, vat_amount, payment_status, due_date')
          .eq('user_id', userId)
          .eq('supplier_id', supplier_id),
      ]);

      if (supplierRes.error)
        return { content: [{ type: 'text' as const, text: safeError(supplierRes.error, 'get supplier balance') }] };

      const invoices = invoicesRes.data ?? [];
      const totalInvoiced = invoices.reduce((s, i) => s + (parseFloat(i.total_amount) || 0), 0);
      const totalPaid = invoices
        .filter((i) => i.payment_status === 'paid')
        .reduce((s, i) => s + (parseFloat(i.total_amount) || 0), 0);
      const outstanding = totalInvoiced - totalPaid;
      const today = new Date().toISOString().split('T')[0];
      const overdue = invoices
        .filter((i) => i.payment_status !== 'paid' && i.due_date && i.due_date < today)
        .reduce((s, i) => s + (parseFloat(i.total_amount) || 0), 0);

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify(
              {
                supplier: supplierRes.data,
                invoice_count: invoices.length,
                total_invoiced: Math.round(totalInvoiced * 100) / 100,
                total_paid: Math.round(totalPaid * 100) / 100,
                outstanding: Math.round(outstanding * 100) / 100,
                overdue: Math.round(overdue * 100) / 100,
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );
}
