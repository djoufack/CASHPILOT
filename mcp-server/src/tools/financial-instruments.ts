import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { supabase, getUserId } from '../supabase.js';
import { optionalDate } from '../utils/validation.js';
import { safeError } from '../utils/errors.js';

// ── Flow direction mapping ──────────────────────────────────
const INFLOW_KINDS = ['income', 'refund_in', 'deposit', 'transfer_in'];
const OUTFLOW_KINDS = ['expense', 'refund_out', 'fee', 'adjustment', 'withdrawal', 'transfer_out'];
const ALL_TRANSACTION_KINDS = [...INFLOW_KINDS, ...OUTFLOW_KINDS] as const;

function resolveFlowDirection(kind: string): 'inflow' | 'outflow' {
  if (INFLOW_KINDS.includes(kind)) return 'inflow';
  return 'outflow';
}

// ── Code slug generator ─────────────────────────────────────
function generateCodeSlug(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

export function registerFinancialInstrumentTools(server: McpServer) {

  // ── 1. list_payment_instruments ───────────────────────────
  server.tool(
    'list_payment_instruments',
    'List payment instruments (bank accounts, cards, cash registers) with optional filters. Set include_details=true to join detail tables.',
    {
      company_id: z.string().uuid().optional().describe('Filter by company UUID'),
      instrument_type: z.enum(['bank_account', 'card', 'cash']).optional().describe('Filter by instrument type'),
      status: z.enum(['active', 'inactive', 'archived', 'blocked']).optional().describe('Filter by status'),
      include_details: z.boolean().optional().describe('Join detail tables (default true)')
    },
    async ({ company_id, instrument_type, status, include_details }) => {
      const userId = getUserId();
      const withDetails = include_details !== false;

      let selectCols = '*';
      if (withDetails) {
        selectCols = '*, bank_account_details(*), card_details(*), cash_register_details(*)';
      }

      let query = supabase
        .from('payment_instruments')
        .select(selectCols)
        .eq('user_id', userId)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });

      if (company_id) query = query.eq('company_id', company_id);
      if (instrument_type) query = query.eq('instrument_type', instrument_type);
      if (status) query = query.eq('status', status);

      const { data, error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list payment instruments') }] };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ count: data?.length ?? 0, instruments: data }, null, 2) }]
      };
    }
  );

  // ── 2. create_payment_instrument ──────────────────────────
  server.tool(
    'create_payment_instrument',
    'Create a new payment instrument (bank account, card, or cash register) with its detail record. Auto-generates account_code via RPC and a code slug from the label.',
    {
      company_id: z.string().uuid().describe('Company UUID'),
      instrument_type: z.enum(['bank_account', 'card', 'cash']).describe('Type of instrument'),
      label: z.string().min(1).describe('Display label (e.g. "Compte courant BNP")'),
      instrument_subtype: z.string().optional().describe('Subtype (e.g. "checking", "savings", "visa", "mastercard", "petty_cash")'),
      display_name: z.string().optional().describe('Short display name for dashboards'),
      description: z.string().optional().describe('Free-text description'),
      currency: z.string().optional().describe('ISO 4217 currency code (default EUR)'),
      is_default: z.boolean().optional().describe('Set as default instrument for this company'),
      opening_balance: z.number().optional().describe('Opening balance (default 0)'),
      account_code: z.string().optional().describe('Override auto-generated accounting code'),
      journal_code: z.string().optional().describe('Journal code for accounting entries'),
      bank_details: z.object({
        bank_name: z.string().optional(),
        iban: z.string().optional(),
        bic: z.string().optional(),
        account_number: z.string().optional(),
        branch_code: z.string().optional(),
        bank_address: z.string().optional(),
        contact_name: z.string().optional(),
        contact_phone: z.string().optional(),
        contact_email: z.string().optional()
      }).optional().describe('Bank account details (only for bank_account type)'),
      card_details: z.object({
        card_network: z.string().optional(),
        card_last_four: z.string().optional(),
        card_holder_name: z.string().optional(),
        expiry_month: z.number().optional(),
        expiry_year: z.number().optional(),
        credit_limit: z.number().optional(),
        billing_cycle_day: z.number().optional(),
        issuing_bank: z.string().optional()
      }).optional().describe('Card details (only for card type)'),
      cash_details: z.object({
        location: z.string().optional(),
        custodian_name: z.string().optional(),
        max_balance: z.number().optional(),
        requires_dual_signature: z.boolean().optional()
      }).optional().describe('Cash register details (only for cash type)')
    },
    async (args) => {
      const userId = getUserId();
      const codeSlug = generateCodeSlug(args.label);

      // Auto-generate account_code via RPC if not provided
      let accountCode = args.account_code ?? null;
      if (!accountCode) {
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('generate_instrument_account_code', {
            p_company_id: args.company_id,
            p_instrument_type: args.instrument_type
          });
        if (rpcError) return { content: [{ type: 'text' as const, text: safeError(rpcError, 'generate account code') }] };
        accountCode = rpcData;
      }

      // If is_default, unset other defaults for this company + type
      if (args.is_default) {
        await supabase
          .from('payment_instruments')
          .update({ is_default: false })
          .eq('user_id', userId)
          .eq('company_id', args.company_id)
          .eq('instrument_type', args.instrument_type)
          .eq('is_default', true);
      }

      // Insert main instrument
      const { data: instrument, error: insError } = await supabase
        .from('payment_instruments')
        .insert([{
          user_id: userId,
          company_id: args.company_id,
          instrument_type: args.instrument_type,
          instrument_subtype: args.instrument_subtype ?? null,
          label: args.label,
          code: codeSlug,
          display_name: args.display_name ?? args.label,
          description: args.description ?? null,
          currency: args.currency ?? 'EUR',
          is_default: args.is_default ?? false,
          opening_balance: args.opening_balance ?? 0,
          current_balance: args.opening_balance ?? 0,
          account_code: accountCode,
          journal_code: args.journal_code ?? null,
          status: 'active'
        }])
        .select()
        .single();

      if (insError) return { content: [{ type: 'text' as const, text: safeError(insError, 'create payment instrument') }] };

      // Insert detail record based on type
      let detailError: any = null;
      if (args.instrument_type === 'bank_account' && args.bank_details) {
        const { error } = await supabase
          .from('bank_account_details')
          .insert([{ payment_instrument_id: instrument.id, user_id: userId, ...args.bank_details }]);
        detailError = error;
      } else if (args.instrument_type === 'card' && args.card_details) {
        const { error } = await supabase
          .from('card_details')
          .insert([{ payment_instrument_id: instrument.id, user_id: userId, ...args.card_details }]);
        detailError = error;
      } else if (args.instrument_type === 'cash' && args.cash_details) {
        const { error } = await supabase
          .from('cash_register_details')
          .insert([{ payment_instrument_id: instrument.id, user_id: userId, ...args.cash_details }]);
        detailError = error;
      }

      if (detailError) {
        return { content: [{ type: 'text' as const, text: safeError(detailError, 'create instrument detail') }] };
      }

      return {
        content: [{ type: 'text' as const, text: `Payment instrument "${args.label}" created (${instrument.id}), account_code=${accountCode}.\n${JSON.stringify(instrument, null, 2)}` }]
      };
    }
  );

  // ── 3. update_payment_instrument ──────────────────────────
  server.tool(
    'update_payment_instrument',
    'Update a payment instrument and optionally its detail table (bank_details, card_details, cash_details).',
    {
      id: z.string().uuid().describe('Payment instrument UUID'),
      label: z.string().optional().describe('New label'),
      display_name: z.string().optional().describe('New display name'),
      description: z.string().optional().describe('New description'),
      status: z.enum(['active', 'inactive', 'archived', 'blocked']).optional().describe('New status'),
      is_default: z.boolean().optional().describe('Set as default'),
      allow_incoming: z.boolean().optional().describe('Allow incoming transactions'),
      allow_outgoing: z.boolean().optional().describe('Allow outgoing transactions'),
      include_in_dashboard: z.boolean().optional().describe('Show on dashboard'),
      account_code: z.string().optional().describe('Accounting code'),
      journal_code: z.string().optional().describe('Journal code'),
      bank_details: z.object({
        bank_name: z.string().optional(),
        iban: z.string().optional(),
        bic: z.string().optional(),
        account_number: z.string().optional(),
        branch_code: z.string().optional(),
        bank_address: z.string().optional(),
        contact_name: z.string().optional(),
        contact_phone: z.string().optional(),
        contact_email: z.string().optional()
      }).optional().describe('Update bank account details'),
      card_details: z.object({
        card_network: z.string().optional(),
        card_last_four: z.string().optional(),
        card_holder_name: z.string().optional(),
        expiry_month: z.number().optional(),
        expiry_year: z.number().optional(),
        credit_limit: z.number().optional(),
        billing_cycle_day: z.number().optional(),
        issuing_bank: z.string().optional()
      }).optional().describe('Update card details'),
      cash_details: z.object({
        location: z.string().optional(),
        custodian_name: z.string().optional(),
        max_balance: z.number().optional(),
        requires_dual_signature: z.boolean().optional()
      }).optional().describe('Update cash register details')
    },
    async (args) => {
      const userId = getUserId();

      // Build update payload — only include provided fields
      const updates: Record<string, any> = {};
      if (args.label !== undefined) updates.label = args.label;
      if (args.display_name !== undefined) updates.display_name = args.display_name;
      if (args.description !== undefined) updates.description = args.description;
      if (args.status !== undefined) updates.status = args.status;
      if (args.is_default !== undefined) updates.is_default = args.is_default;
      if (args.allow_incoming !== undefined) updates.allow_incoming = args.allow_incoming;
      if (args.allow_outgoing !== undefined) updates.allow_outgoing = args.allow_outgoing;
      if (args.include_in_dashboard !== undefined) updates.include_in_dashboard = args.include_in_dashboard;
      if (args.account_code !== undefined) updates.account_code = args.account_code;
      if (args.journal_code !== undefined) updates.journal_code = args.journal_code;

      // If setting as default, unset others first
      if (args.is_default) {
        const { data: existing } = await supabase
          .from('payment_instruments')
          .select('company_id, instrument_type')
          .eq('id', args.id)
          .eq('user_id', userId)
          .single();

        if (existing) {
          await supabase
            .from('payment_instruments')
            .update({ is_default: false })
            .eq('user_id', userId)
            .eq('company_id', existing.company_id)
            .eq('instrument_type', existing.instrument_type)
            .eq('is_default', true);
        }
      }

      // Update main record
      if (Object.keys(updates).length > 0) {
        const { error } = await supabase
          .from('payment_instruments')
          .update(updates)
          .eq('id', args.id)
          .eq('user_id', userId);

        if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update payment instrument') }] };
      }

      // Update detail tables if provided
      if (args.bank_details) {
        const { error } = await supabase
          .from('bank_account_details')
          .update(args.bank_details)
          .eq('payment_instrument_id', args.id)
          .eq('user_id', userId);
        if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update bank details') }] };
      }

      if (args.card_details) {
        const { error } = await supabase
          .from('card_details')
          .update(args.card_details)
          .eq('payment_instrument_id', args.id)
          .eq('user_id', userId);
        if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update card details') }] };
      }

      if (args.cash_details) {
        const { error } = await supabase
          .from('cash_register_details')
          .update(args.cash_details)
          .eq('payment_instrument_id', args.id)
          .eq('user_id', userId);
        if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'update cash details') }] };
      }

      // Fetch updated record
      const { data, error: fetchErr } = await supabase
        .from('payment_instruments')
        .select('*, bank_account_details(*), card_details(*), cash_register_details(*)')
        .eq('id', args.id)
        .eq('user_id', userId)
        .single();

      if (fetchErr) return { content: [{ type: 'text' as const, text: safeError(fetchErr, 'fetch updated instrument') }] };

      return {
        content: [{ type: 'text' as const, text: `Instrument updated.\n${JSON.stringify(data, null, 2)}` }]
      };
    }
  );

  // ── 4. delete_payment_instrument ──────────────────────────
  server.tool(
    'delete_payment_instrument',
    'Delete or archive a payment instrument. If transactions exist and force=true, archives instead of deleting. If no transactions, hard-deletes.',
    {
      id: z.string().uuid().describe('Payment instrument UUID'),
      force: z.boolean().optional().describe('Force: archive if transactions exist (default false)')
    },
    async ({ id, force }) => {
      const userId = getUserId();

      // Verify ownership
      const { data: instrument, error: fetchErr } = await supabase
        .from('payment_instruments')
        .select('id, label, status')
        .eq('id', id)
        .eq('user_id', userId)
        .single();

      if (fetchErr || !instrument) {
        return { content: [{ type: 'text' as const, text: 'Instrument not found or access denied.' }] };
      }

      // Count linked transactions
      const { count, error: countErr } = await supabase
        .from('payment_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('payment_instrument_id', id)
        .eq('user_id', userId);

      if (countErr) return { content: [{ type: 'text' as const, text: safeError(countErr, 'count transactions') }] };

      const txCount = count ?? 0;

      if (txCount > 0) {
        if (!force) {
          return {
            content: [{ type: 'text' as const, text: `Cannot delete: ${txCount} linked transaction(s). Use force=true to archive instead.` }]
          };
        }

        // Archive instead of delete
        const { error: archiveErr } = await supabase
          .from('payment_instruments')
          .update({ status: 'archived' })
          .eq('id', id)
          .eq('user_id', userId);

        if (archiveErr) return { content: [{ type: 'text' as const, text: safeError(archiveErr, 'archive instrument') }] };

        return {
          content: [{ type: 'text' as const, text: `Instrument "${instrument.label}" archived (${txCount} linked transactions preserved).` }]
        };
      }

      // No transactions — hard delete (detail tables cascade)
      const { error: delErr } = await supabase
        .from('payment_instruments')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (delErr) return { content: [{ type: 'text' as const, text: safeError(delErr, 'delete instrument') }] };

      return {
        content: [{ type: 'text' as const, text: `Instrument "${instrument.label}" permanently deleted.` }]
      };
    }
  );

  // ── 5. create_payment_transaction ─────────────────────────
  server.tool(
    'create_payment_transaction',
    'Create a transaction in the unified payment register. Auto-determines flow_direction from transaction_kind. Retrieves company_id from the instrument.',
    {
      payment_instrument_id: z.string().uuid().describe('Payment instrument UUID'),
      transaction_kind: z.enum(['income', 'refund_in', 'deposit', 'transfer_in', 'expense', 'refund_out', 'fee', 'adjustment', 'withdrawal', 'transfer_out']).describe('Kind of transaction'),
      amount: z.number().min(0.01).max(999999999.99).describe('Transaction amount (positive)'),
      transaction_date: z.string().describe('Transaction date (YYYY-MM-DD)'),
      counterparty_name: z.string().optional().describe('Name of the counterparty'),
      description: z.string().optional().describe('Description'),
      reference: z.string().optional().describe('Internal reference'),
      external_reference: z.string().optional().describe('External reference (bank ref, check number)'),
      category: z.string().optional().describe('Category'),
      subcategory: z.string().optional().describe('Subcategory'),
      notes: z.string().optional().describe('Notes'),
      currency: z.string().optional().describe('Currency (default from instrument)'),
      fx_rate: z.number().optional().describe('Exchange rate if different currency'),
      allocations: z.array(z.object({
        target_type: z.string().describe('e.g. invoice, expense, supplier_invoice'),
        target_id: z.string().uuid().describe('UUID of the allocated entity'),
        amount: z.number().describe('Allocated amount')
      })).optional().describe('Allocations to invoices/expenses'),
      source_module: z.string().optional().describe('Originating module (e.g. invoices, expenses, transfers)'),
      source_id: z.string().uuid().optional().describe('Source record UUID')
    },
    async (args) => {
      const userId = getUserId();

      // Validate date
      const validatedDate = optionalDate(args.transaction_date);
      if (!validatedDate) {
        return { content: [{ type: 'text' as const, text: "Parameter 'transaction_date' must be a valid date (YYYY-MM-DD)" }] };
      }

      // Get instrument to retrieve company_id and currency
      const { data: instrument, error: instErr } = await supabase
        .from('payment_instruments')
        .select('id, company_id, currency, status, allow_incoming, allow_outgoing')
        .eq('id', args.payment_instrument_id)
        .eq('user_id', userId)
        .single();

      if (instErr || !instrument) {
        return { content: [{ type: 'text' as const, text: 'Payment instrument not found or access denied.' }] };
      }

      if (instrument.status !== 'active') {
        return { content: [{ type: 'text' as const, text: `Instrument is ${instrument.status}. Only active instruments can receive transactions.` }] };
      }

      const flowDirection = resolveFlowDirection(args.transaction_kind);

      // Check flow permissions
      if (flowDirection === 'inflow' && instrument.allow_incoming === false) {
        return { content: [{ type: 'text' as const, text: 'This instrument does not allow incoming transactions.' }] };
      }
      if (flowDirection === 'outflow' && instrument.allow_outgoing === false) {
        return { content: [{ type: 'text' as const, text: 'This instrument does not allow outgoing transactions.' }] };
      }

      const txCurrency = args.currency ?? instrument.currency ?? 'EUR';

      const { data: transaction, error: txErr } = await supabase
        .from('payment_transactions')
        .insert([{
          user_id: userId,
          company_id: instrument.company_id,
          payment_instrument_id: args.payment_instrument_id,
          transaction_kind: args.transaction_kind,
          flow_direction: flowDirection,
          amount: args.amount,
          currency: txCurrency,
          fx_rate: args.fx_rate ?? (txCurrency === instrument.currency ? 1 : args.fx_rate),
          transaction_date: validatedDate,
          counterparty_name: args.counterparty_name ?? null,
          description: args.description ?? null,
          reference: args.reference ?? null,
          external_reference: args.external_reference ?? null,
          category: args.category ?? null,
          subcategory: args.subcategory ?? null,
          notes: args.notes ?? null,
          source_module: args.source_module ?? null,
          source_id: args.source_id ?? null,
          status: 'confirmed'
        }])
        .select()
        .single();

      if (txErr) return { content: [{ type: 'text' as const, text: safeError(txErr, 'create payment transaction') }] };

      // Insert allocations if provided
      if (args.allocations && args.allocations.length > 0) {
        const allocRows = args.allocations.map(a => ({
          user_id: userId,
          payment_transaction_id: transaction.id,
          target_type: a.target_type,
          target_id: a.target_id,
          amount: a.amount
        }));

        const { error: allocErr } = await supabase
          .from('payment_transaction_allocations')
          .insert(allocRows);

        if (allocErr) {
          return { content: [{ type: 'text' as const, text: `Transaction created but allocation failed: ${safeError(allocErr, 'allocations')}.\n${JSON.stringify(transaction, null, 2)}` }] };
        }
      }

      return {
        content: [{ type: 'text' as const, text: `Transaction ${flowDirection} of ${args.amount} ${txCurrency} created (${transaction.id}).\n${JSON.stringify(transaction, null, 2)}` }]
      };
    }
  );

  // ── 6. list_payment_transactions ──────────────────────────
  server.tool(
    'list_payment_transactions',
    'List payment transactions with filters: instrument, direction, kind, status, date range, counterparty, category, source module.',
    {
      company_id: z.string().uuid().optional().describe('Filter by company UUID'),
      payment_instrument_id: z.string().uuid().optional().describe('Filter by instrument UUID'),
      flow_direction: z.enum(['inflow', 'outflow']).optional().describe('Filter by flow direction'),
      transaction_kind: z.enum(['income', 'refund_in', 'deposit', 'transfer_in', 'expense', 'refund_out', 'fee', 'adjustment', 'withdrawal', 'transfer_out']).optional().describe('Filter by kind'),
      status: z.string().optional().describe('Filter by status (confirmed, pending, cancelled, reversed)'),
      date_from: z.string().optional().describe('Start date (YYYY-MM-DD)'),
      date_to: z.string().optional().describe('End date (YYYY-MM-DD)'),
      counterparty_name: z.string().optional().describe('Search counterparty name (partial match)'),
      category: z.string().optional().describe('Filter by category'),
      source_module: z.string().optional().describe('Filter by source module'),
      limit: z.number().optional().describe('Max results (default 50)'),
      offset: z.number().optional().describe('Offset for pagination (default 0)')
    },
    async (args) => {
      const userId = getUserId();

      let query = supabase
        .from('payment_transactions')
        .select('*, payment_instrument:payment_instruments(id, label, instrument_type, currency)')
        .eq('user_id', userId)
        .order('transaction_date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(args.offset ?? 0, (args.offset ?? 0) + (args.limit ?? 50) - 1);

      if (args.company_id) query = query.eq('company_id', args.company_id);
      if (args.payment_instrument_id) query = query.eq('payment_instrument_id', args.payment_instrument_id);
      if (args.flow_direction) query = query.eq('flow_direction', args.flow_direction);
      if (args.transaction_kind) query = query.eq('transaction_kind', args.transaction_kind);
      if (args.status) query = query.eq('status', args.status);
      if (args.category) query = query.eq('category', args.category);
      if (args.source_module) query = query.eq('source_module', args.source_module);

      if (args.date_from) {
        const d = optionalDate(args.date_from);
        if (d) query = query.gte('transaction_date', d);
      }
      if (args.date_to) {
        const d = optionalDate(args.date_to);
        if (d) query = query.lte('transaction_date', d);
      }
      if (args.counterparty_name) {
        query = query.ilike('counterparty_name', `%${args.counterparty_name}%`);
      }

      const { data, error } = await query;
      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'list payment transactions') }] };

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ count: data?.length ?? 0, transactions: data }, null, 2) }]
      };
    }
  );

  // ── 7. create_payment_transfer ────────────────────────────
  server.tool(
    'create_payment_transfer',
    'Transfer funds between two payment instruments. Creates matching outflow + inflow transactions linked by a transfer_group_id. Optionally creates a fee transaction.',
    {
      from_instrument_id: z.string().uuid().describe('Source instrument UUID'),
      to_instrument_id: z.string().uuid().describe('Destination instrument UUID'),
      amount: z.number().min(0.01).max(999999999.99).describe('Transfer amount'),
      transfer_date: z.string().describe('Transfer date (YYYY-MM-DD)'),
      fee_amount: z.number().optional().describe('Fee amount (creates a 3rd fee transaction if > 0)'),
      currency: z.string().optional().describe('Currency (default EUR)'),
      reference: z.string().optional().describe('Transfer reference'),
      notes: z.string().optional().describe('Notes')
    },
    async (args) => {
      const userId = getUserId();

      if (args.from_instrument_id === args.to_instrument_id) {
        return { content: [{ type: 'text' as const, text: 'Source and destination instruments must be different.' }] };
      }

      const validatedDate = optionalDate(args.transfer_date);
      if (!validatedDate) {
        return { content: [{ type: 'text' as const, text: "Parameter 'transfer_date' must be a valid date (YYYY-MM-DD)" }] };
      }

      // Verify both instruments exist and belong to user
      const [fromRes, toRes] = await Promise.all([
        supabase.from('payment_instruments').select('id, company_id, currency, label, status')
          .eq('id', args.from_instrument_id).eq('user_id', userId).single(),
        supabase.from('payment_instruments').select('id, company_id, currency, label, status')
          .eq('id', args.to_instrument_id).eq('user_id', userId).single()
      ]);

      if (fromRes.error || !fromRes.data) {
        return { content: [{ type: 'text' as const, text: 'Source instrument not found or access denied.' }] };
      }
      if (toRes.error || !toRes.data) {
        return { content: [{ type: 'text' as const, text: 'Destination instrument not found or access denied.' }] };
      }

      if (fromRes.data.status !== 'active') {
        return { content: [{ type: 'text' as const, text: `Source instrument "${fromRes.data.label}" is ${fromRes.data.status}.` }] };
      }
      if (toRes.data.status !== 'active') {
        return { content: [{ type: 'text' as const, text: `Destination instrument "${toRes.data.label}" is ${toRes.data.status}.` }] };
      }

      const txCurrency = args.currency ?? fromRes.data.currency ?? 'EUR';
      const transferGroupId = crypto.randomUUID();

      // Create outflow transaction (from source)
      const { data: outflowTx, error: outErr } = await supabase
        .from('payment_transactions')
        .insert([{
          user_id: userId,
          company_id: fromRes.data.company_id,
          payment_instrument_id: args.from_instrument_id,
          transaction_kind: 'transfer_out',
          flow_direction: 'outflow',
          amount: args.amount,
          currency: txCurrency,
          fx_rate: 1,
          transaction_date: validatedDate,
          counterparty_name: toRes.data.label,
          description: `Transfer to ${toRes.data.label}`,
          reference: args.reference ?? null,
          notes: args.notes ?? null,
          transfer_group_id: transferGroupId,
          source_module: 'transfers',
          status: 'confirmed'
        }])
        .select()
        .single();

      if (outErr) return { content: [{ type: 'text' as const, text: safeError(outErr, 'create outflow transaction') }] };

      // Create inflow transaction (to destination)
      const { data: inflowTx, error: inErr } = await supabase
        .from('payment_transactions')
        .insert([{
          user_id: userId,
          company_id: toRes.data.company_id,
          payment_instrument_id: args.to_instrument_id,
          transaction_kind: 'transfer_in',
          flow_direction: 'inflow',
          amount: args.amount,
          currency: txCurrency,
          fx_rate: 1,
          transaction_date: validatedDate,
          counterparty_name: fromRes.data.label,
          description: `Transfer from ${fromRes.data.label}`,
          reference: args.reference ?? null,
          notes: args.notes ?? null,
          transfer_group_id: transferGroupId,
          source_module: 'transfers',
          status: 'confirmed'
        }])
        .select()
        .single();

      if (inErr) return { content: [{ type: 'text' as const, text: safeError(inErr, 'create inflow transaction') }] };

      // Create fee transaction if applicable
      let feeTx: { id: string } | null = null;
      if (args.fee_amount && args.fee_amount > 0) {
        const { data: feeData, error: feeErr } = await supabase
          .from('payment_transactions')
          .insert([{
            user_id: userId,
            company_id: fromRes.data.company_id,
            payment_instrument_id: args.from_instrument_id,
            transaction_kind: 'fee',
            flow_direction: 'outflow',
            amount: args.fee_amount,
            currency: txCurrency,
            fx_rate: 1,
            transaction_date: validatedDate,
            counterparty_name: 'Bank fee',
            description: `Transfer fee for ${args.reference ?? transferGroupId}`,
            transfer_group_id: transferGroupId,
            source_module: 'transfers',
            status: 'posted'
          }])
          .select()
          .single();

        if (feeErr) {
          return { content: [{ type: 'text' as const, text: `Transfer created but fee transaction failed: ${safeError(feeErr, 'fee transaction')}` }] };
        }
        feeTx = feeData;
      }

      // Create payment_transfers record
      const { error: transferErr } = await supabase
        .from('payment_transfers')
        .insert([{
          user_id: userId,
          transfer_group_id: transferGroupId,
          from_instrument_id: args.from_instrument_id,
          to_instrument_id: args.to_instrument_id,
          outflow_transaction_id: outflowTx.id,
          inflow_transaction_id: inflowTx.id,
          amount: args.amount,
          fee_amount: args.fee_amount ?? 0,
          currency: txCurrency,
          transfer_date: validatedDate,
          reference: args.reference ?? null,
          notes: args.notes ?? null,
          status: 'posted'
        }]);

      if (transferErr) {
        return { content: [{ type: 'text' as const, text: `Transactions created but transfer record failed: ${safeError(transferErr, 'payment transfer record')}` }] };
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          message: `Transfer of ${args.amount} ${txCurrency} from "${fromRes.data.label}" to "${toRes.data.label}" completed.`,
          transfer_group_id: transferGroupId,
          outflow_transaction_id: outflowTx.id,
          inflow_transaction_id: inflowTx.id,
          fee_transaction_id: feeTx?.id ?? null,
          fee_amount: args.fee_amount ?? 0
        }, null, 2) }]
      };
    }
  );

  // ── 8. get_instrument_balance_history ──────────────────────
  server.tool(
    'get_instrument_balance_history',
    'Get balance history for a payment instrument via RPC. Monthly granularity uses rpc_account_cash_flow, daily uses rpc_account_balance_evolution.',
    {
      instrument_id: z.string().uuid().describe('Payment instrument UUID'),
      months: z.number().optional().describe('Number of months of history (default 6)'),
      granularity: z.enum(['daily', 'monthly']).optional().describe('Granularity: daily or monthly (default monthly)')
    },
    async ({ instrument_id, months, granularity }) => {
      const userId = getUserId();
      const periodMonths = months ?? 6;
      const gran = granularity ?? 'monthly';

      // Verify ownership
      const { data: instrument, error: instErr } = await supabase
        .from('payment_instruments')
        .select('id, label, currency, current_balance')
        .eq('id', instrument_id)
        .eq('user_id', userId)
        .single();

      if (instErr || !instrument) {
        return { content: [{ type: 'text' as const, text: 'Instrument not found or access denied.' }] };
      }

      if (gran === 'monthly') {
        const { data, error } = await supabase
          .rpc('rpc_account_cash_flow', {
            p_instrument_id: instrument_id,
            p_months: periodMonths
          });

        if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'instrument balance history (monthly)') }] };

        return {
          content: [{ type: 'text' as const, text: JSON.stringify({
            instrument_id,
            label: instrument.label,
            currency: instrument.currency,
            current_balance: instrument.current_balance,
            granularity: 'monthly',
            months: periodMonths,
            history: data
          }, null, 2) }]
        };
      } else {
        // Daily granularity
        const days = periodMonths * 30;
        const { data, error } = await supabase
          .rpc('rpc_account_balance_evolution', {
            p_instrument_id: instrument_id,
            p_days: days
          });

        if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'instrument balance history (daily)') }] };

        return {
          content: [{ type: 'text' as const, text: JSON.stringify({
            instrument_id,
            label: instrument.label,
            currency: instrument.currency,
            current_balance: instrument.current_balance,
            granularity: 'daily',
            days,
            history: data
          }, null, 2) }]
        };
      }
    }
  );

  // ── 9. get_payment_volume_stats ───────────────────────────
  server.tool(
    'get_payment_volume_stats',
    'Get payment volume statistics grouped by payment method/instrument type via RPC. Useful for understanding which instruments handle the most volume.',
    {
      company_id: z.string().uuid().optional().describe('Filter by company UUID (optional, defaults to all)'),
      start_date: z.string().describe('Start date (YYYY-MM-DD)'),
      end_date: z.string().describe('End date (YYYY-MM-DD)')
    },
    async ({ company_id, start_date, end_date }) => {
      const userId = getUserId();

      const validStart = optionalDate(start_date);
      const validEnd = optionalDate(end_date);
      if (!validStart) return { content: [{ type: 'text' as const, text: "Parameter 'start_date' must be a valid date (YYYY-MM-DD)" }] };
      if (!validEnd) return { content: [{ type: 'text' as const, text: "Parameter 'end_date' must be a valid date (YYYY-MM-DD)" }] };

      const rpcParams: Record<string, any> = {
        p_user_id: userId,
        p_start_date: validStart,
        p_end_date: validEnd
      };
      if (company_id) rpcParams.p_company_id = company_id;

      const { data, error } = await supabase
        .rpc('rpc_payment_volume_by_method', rpcParams);

      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'payment volume stats') }] };

      // Compute totals
      const totalVolume = (data ?? []).reduce((s: number, r: any) => s + parseFloat(r.total_volume || '0'), 0);
      const totalCount = (data ?? []).reduce((s: number, r: any) => s + parseInt(r.transaction_count || '0', 10), 0);

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          period: { start: validStart, end: validEnd },
          company_id: company_id ?? 'all',
          by_method: data,
          totals: {
            total_volume: Math.round(totalVolume * 100) / 100,
            total_transactions: totalCount
          }
        }, null, 2) }]
      };
    }
  );

  // ── 10. get_portfolio_consolidated_summary ─────────────────
  server.tool(
    'get_portfolio_consolidated_summary',
    'Get consolidated balance summary across all payment instruments via RPC. Optionally filter by portfolio (company group). Returns totals by currency, type, and status.',
    {
      portfolio_id: z.string().uuid().optional().describe('Filter by portfolio/company UUID (optional, defaults to all companies)')
    },
    async ({ portfolio_id }) => {
      const userId = getUserId();

      const rpcParams: Record<string, any> = {
        p_user_id: userId
      };
      if (portfolio_id) rpcParams.p_portfolio_id = portfolio_id;

      const { data, error } = await supabase
        .rpc('rpc_portfolio_consolidated_balances', rpcParams);

      if (error) return { content: [{ type: 'text' as const, text: safeError(error, 'portfolio consolidated summary') }] };

      // Aggregate totals across all rows
      const rows = data ?? [];
      const totalsByCurrency: Record<string, { currency: string; total_balance: number; instrument_count: number }> = {};

      for (const row of rows) {
        const cur = row.currency || 'EUR';
        if (!totalsByCurrency[cur]) {
          totalsByCurrency[cur] = { currency: cur, total_balance: 0, instrument_count: 0 };
        }
        totalsByCurrency[cur].total_balance += parseFloat(row.current_balance || '0');
        totalsByCurrency[cur].instrument_count += 1;
      }

      // Round totals
      for (const key of Object.keys(totalsByCurrency)) {
        totalsByCurrency[key].total_balance = Math.round(totalsByCurrency[key].total_balance * 100) / 100;
      }

      return {
        content: [{ type: 'text' as const, text: JSON.stringify({
          portfolio_id: portfolio_id ?? 'all',
          instruments: rows,
          totals_by_currency: Object.values(totalsByCurrency),
          total_instruments: rows.length
        }, null, 2) }]
      };
    }
  );
}
