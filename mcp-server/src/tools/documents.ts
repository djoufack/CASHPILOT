import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase, getUserId } from '../supabase.js';

export function registerDocumentTools(server: McpServer) {

  // ── 1. create_quote ───────────────────────────────────────
  server.tool(
    'create_quote',
    'Create a new quote (devis) with line items. Auto-calculates totals and tax.',
    {
      client_id: z.string().describe('Client UUID'),
      quote_number: z.string().optional().describe('Quote number (auto-generated if omitted)'),
      valid_until: z.string().optional().describe('Validity date (YYYY-MM-DD)'),
      notes: z.string().optional().describe('Notes or terms'),
      tax_rate: z.number().optional().describe('Tax rate in % (default 20)'),
      items: z.array(z.object({
        description: z.string().describe('Item description'),
        quantity: z.number().describe('Quantity'),
        unit_price: z.number().describe('Unit price HT')
      })).describe('Quote line items')
    },
    async ({ client_id, quote_number, valid_until, notes, tax_rate, items }) => {
      const userId = getUserId();
      const rate = tax_rate ?? 20;

      const totalHt = items.reduce((s, i) => s + i.quantity * i.unit_price, 0);
      const taxAmount = totalHt * (rate / 100);
      const totalTtc = totalHt + taxAmount;

      const quoteNum = quote_number || `DEV-${Date.now().toString(36).toUpperCase()}`;

      const { data: quote, error } = await supabase
        .from('quotes')
        .insert([{
          user_id: userId,
          client_id,
          quote_number: quoteNum,
          date: new Date().toISOString().split('T')[0],
          valid_until: valid_until || null,
          total_ht: Math.round(totalHt * 100) / 100,
          total_ttc: Math.round(totalTtc * 100) / 100,
          tax_rate: rate,
          tax_amount: Math.round(taxAmount * 100) / 100,
          status: 'draft',
          notes: notes || null,
          items
        }])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: 'text' as const, text: `Quote created: ${quoteNum}\n${JSON.stringify(quote, null, 2)}` }] };
    }
  );

  // ── 2. convert_quote_to_invoice ───────────────────────────
  server.tool(
    'convert_quote_to_invoice',
    'Convert an accepted quote into an invoice. Copies all details and marks the quote as converted.',
    {
      quote_id: z.string().describe('Quote UUID to convert')
    },
    async ({ quote_id }) => {
      const userId = getUserId();

      const { data: quote, error: qErr } = await supabase
        .from('quotes')
        .select('*')
        .eq('id', quote_id)
        .eq('user_id', userId)
        .single();

      if (qErr || !quote) return { content: [{ type: 'text' as const, text: `Error: ${qErr?.message || 'Quote not found'}` }] };

      const invoiceNumber = `FAC-${Date.now().toString(36).toUpperCase()}`;
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 30);

      const { data: invoice, error: invErr } = await supabase
        .from('invoices')
        .insert([{
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
          quote_id: quote.id
        }])
        .select()
        .single();

      if (invErr) return { content: [{ type: 'text' as const, text: `Error creating invoice: ${invErr.message}` }] };

      await supabase
        .from('quotes')
        .update({ status: 'converted', converted_invoice_id: invoice.id })
        .eq('id', quote_id);

      return {
        content: [{ type: 'text' as const, text: `Quote ${quote.quote_number} converted to invoice ${invoiceNumber}\n${JSON.stringify(invoice, null, 2)}` }]
      };
    }
  );

  // ── 3. create_credit_note ─────────────────────────────────
  server.tool(
    'create_credit_note',
    'Create a credit note (avoir) linked to an invoice. Partial or full refund.',
    {
      invoice_id: z.string().describe('Original invoice UUID'),
      amount: z.number().optional().describe('Credit amount TTC (defaults to full invoice amount)'),
      reason: z.string().optional().describe('Reason for credit note')
    },
    async ({ invoice_id, amount, reason }) => {
      const userId = getUserId();

      const { data: invoice, error: invErr } = await supabase
        .from('invoices')
        .select('*')
        .eq('id', invoice_id)
        .eq('user_id', userId)
        .single();

      if (invErr || !invoice) return { content: [{ type: 'text' as const, text: `Error: ${invErr?.message || 'Invoice not found'}` }] };

      const creditAmount = amount ?? parseFloat(invoice.total_ttc) ?? 0;
      const creditNumber = `AV-${Date.now().toString(36).toUpperCase()}`;

      const { data: creditNote, error } = await supabase
        .from('credit_notes')
        .insert([{
          user_id: userId,
          invoice_id,
          client_id: invoice.client_id,
          credit_note_number: creditNumber,
          date: new Date().toISOString().split('T')[0],
          amount: Math.round(creditAmount * 100) / 100,
          reason: reason || null,
          status: 'draft'
        }])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };
      return { content: [{ type: 'text' as const, text: `Credit note created: ${creditNumber} for ${creditAmount} EUR\n${JSON.stringify(creditNote, null, 2)}` }] };
    }
  );

  // ── 4. create_expense ─────────────────────────────────────
  server.tool(
    'create_expense',
    'Record an expense with automatic HT/TVA calculation from TTC amount',
    {
      amount_ttc: z.number().describe('Total amount TTC (tax included)'),
      tax_rate: z.number().optional().describe('Tax rate % (default 20)'),
      category: z.string().optional().describe('Expense category'),
      description: z.string().optional().describe('Description'),
      expense_date: z.string().optional().describe('Date (YYYY-MM-DD), default today'),
      client_id: z.string().optional().describe('Client UUID if billable expense'),
      receipt_url: z.string().optional().describe('URL to receipt image'),
      refacturable: z.boolean().optional().describe('Whether expense can be billed to client')
    },
    async ({ amount_ttc, tax_rate, category, description, expense_date, client_id, receipt_url, refacturable }) => {
      const userId = getUserId();
      const rate = tax_rate ?? 20;
      const amountHt = amount_ttc / (1 + rate / 100);
      const taxAmount = amount_ttc - amountHt;

      const { data, error } = await supabase
        .from('expenses')
        .insert([{
          user_id: userId,
          amount: Math.round(amount_ttc * 100) / 100,
          amount_ht: Math.round(amountHt * 100) / 100,
          tax_amount: Math.round(taxAmount * 100) / 100,
          tax_rate: rate,
          category: category || null,
          description: description || null,
          expense_date: expense_date || new Date().toISOString().split('T')[0],
          client_id: client_id || null,
          receipt_url: receipt_url || null,
          refacturable: refacturable ?? false
        }])
        .select()
        .single();

      if (error) return { content: [{ type: 'text' as const, text: `Error: ${error.message}` }] };
      return {
        content: [{ type: 'text' as const, text: `Expense recorded: ${Math.round(amount_ttc * 100) / 100} EUR TTC (${Math.round(amountHt * 100) / 100} HT + ${Math.round(taxAmount * 100) / 100} TVA)\n${JSON.stringify(data, null, 2)}` }]
      };
    }
  );

  // ── 5. get_supplier_balance ───────────────────────────────
  server.tool(
    'get_supplier_balance',
    'Get a supplier balance summary: total invoiced, paid, outstanding, overdue',
    {
      supplier_id: z.string().describe('Supplier UUID')
    },
    async ({ supplier_id }) => {
      const userId = getUserId();

      const [supplierRes, invoicesRes] = await Promise.all([
        supabase.from('suppliers').select('name, email').eq('id', supplier_id).eq('user_id', userId).single(),
        supabase.from('supplier_invoices').select('total_amount, vat_amount, payment_status, due_date')
          .eq('user_id', userId).eq('supplier_id', supplier_id)
      ]);

      if (supplierRes.error) return { content: [{ type: 'text' as const, text: `Error: ${supplierRes.error.message}` }] };

      const invoices = invoicesRes.data ?? [];
      const totalInvoiced = invoices.reduce((s, i) => s + (parseFloat(i.total_amount) || 0), 0);
      const totalPaid = invoices.filter(i => i.payment_status === 'paid').reduce((s, i) => s + (parseFloat(i.total_amount) || 0), 0);
      const outstanding = totalInvoiced - totalPaid;
      const today = new Date().toISOString().split('T')[0];
      const overdue = invoices
        .filter(i => i.payment_status !== 'paid' && i.due_date && i.due_date < today)
        .reduce((s, i) => s + (parseFloat(i.total_amount) || 0), 0);

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          supplier: supplierRes.data,
          invoice_count: invoices.length,
          total_invoiced: Math.round(totalInvoiced * 100) / 100,
          total_paid: Math.round(totalPaid * 100) / 100,
          outstanding: Math.round(outstanding * 100) / 100,
          overdue: Math.round(overdue * 100) / 100
        }, null, 2) }]
      };
    }
  );
}
