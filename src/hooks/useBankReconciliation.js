import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { isMissingColumnError } from '@/lib/supabaseCompatibility';
import { autoMatchLines, normalizeTransactions, getReconciliationSummary } from '@/utils/reconciliationMatcher';

const toLineExternalId = (statementId, lineNumber, fallbackIndex = 0) =>
  `${statementId}:${lineNumber ?? fallbackIndex + 1}`;

const toBankReconciliationStatus = (lineStatus) => {
  if (lineStatus === 'matched') return 'matched';
  if (lineStatus === 'ignored') return 'ignored';
  return 'unreconciled';
};

export const useBankReconciliation = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { applyCompanyScope, withCompanyScope } = useCompanyScope();
  const stripCompanyId = useCallback((payload = {}) => {
    const { company_id: _ignoredCompanyId, ...withoutCompany } = payload;
    return withoutCompany;
  }, []);

  const [statements, setStatements] = useState([]);
  const [lines, setLines] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  const syncLinkedBankTransactionStatus = useCallback(
    async (line, lineStatus, matchedSourceType = null, matchedSourceId = null, confidence = null) => {
      if (!user || !supabase || !line?.statement_id) return;
      const externalId = toLineExternalId(line.statement_id, line.line_number);
      const reconciliationStatus = toBankReconciliationStatus(lineStatus);

      try {
        const payload = {
          reconciliation_status: reconciliationStatus,
          matched_at: reconciliationStatus === 'matched' ? new Date().toISOString() : null,
          match_confidence: reconciliationStatus === 'matched' ? confidence : null,
          invoice_id: matchedSourceType === 'invoice' ? matchedSourceId : null,
        };

        let query = supabase
          .from('bank_transactions')
          .update(payload)
          .eq('user_id', user.id)
          .eq('external_id', externalId);
        query = applyCompanyScope(query);
        let { error } = await query;

        if (error && isMissingColumnError(error, 'company_id')) {
          ({ error } = await supabase
            .from('bank_transactions')
            .update(payload)
            .eq('user_id', user.id)
            .eq('external_id', externalId));
        }

        if (error) {
          throw error;
        }
      } catch (err) {
        console.warn('Failed to sync linked bank transaction status:', err);
      }
    },
    [user, applyCompanyScope]
  );

  // ========================================================================
  // STATEMENTS CRUD
  // ========================================================================

  const fetchStatements = useCallback(async () => {
    if (!user || !supabase) return;
    try {
      setLoading(true);
      const buildBaseQuery = () =>
        supabase.from('bank_statements').select('*').eq('user_id', user.id).order('created_at', { ascending: false });

      let query = buildBaseQuery();
      query = applyCompanyScope(query);
      let { data, error } = await query;

      if (error && isMissingColumnError(error, 'company_id')) {
        ({ data, error } = await buildBaseQuery());
      }

      if (error) throw error;
      setStatements(data || []);
    } catch (err) {
      console.error('Error fetching statements:', err);
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user, toast, applyCompanyScope]);

  useEffect(() => {
    fetchStatements();
  }, [fetchStatements]);

  const uploadStatement = useCallback(
    async (file, metadata = {}) => {
      if (!user || !supabase) return null;

      try {
        setUploading(true);
        const ext = file.name.split('.').pop().toLowerCase();
        const filePath = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;

        // Upload file to Storage
        const { error: uploadError } = await supabase.storage
          .from('bank-statements')
          .upload(filePath, file, { upsert: false, contentType: file.type });

        if (uploadError) throw uploadError;

        // Create DB record
        const scopedPayload = withCompanyScope({
          user_id: user.id,
          file_name: file.name,
          file_path: filePath,
          file_type: ext,
          file_size: file.size,
          bank_name: metadata.bankName || null,
          account_number: metadata.accountNumber || null,
          period_start: metadata.periodStart || null,
          period_end: metadata.periodEnd || null,
          opening_balance: metadata.openingBalance || null,
          closing_balance: metadata.closingBalance || null,
          payment_instrument_id: metadata.paymentInstrumentId || null,
          parse_status: 'pending',
          line_count: 0,
        });

        let { data, error } = await supabase.from('bank_statements').insert([scopedPayload]).select().single();

        if (error && scopedPayload.company_id && isMissingColumnError(error, 'company_id')) {
          ({ data, error } = await supabase
            .from('bank_statements')
            .insert([stripCompanyId(scopedPayload)])
            .select()
            .single());
        }

        if (error) throw error;

        setStatements((prev) => [data, ...prev]);
        toast({ title: 'Succès', description: 'Relevé bancaire importé avec succès.' });
        return data;
      } catch (err) {
        console.error('Error uploading statement:', err);
        toast({ title: 'Erreur', description: `Erreur d'import : ${err.message}`, variant: 'destructive' });
        return null;
      } finally {
        setUploading(false);
      }
    },
    [user, toast, withCompanyScope, stripCompanyId]
  );

  const deleteStatement = useCallback(
    async (id) => {
      if (!user || !supabase) return;
      try {
        const statement = statements.find((s) => s.id === id);

        // Delete file from storage
        if (statement?.file_path) {
          await supabase.storage.from('bank-statements').remove([statement.file_path]);
        }

        // Delete from DB (cascade deletes lines)
        const { error } = await supabase.from('bank_statements').delete().eq('id', id);
        if (error) throw error;

        setStatements((prev) => prev.filter((s) => s.id !== id));
        setLines([]);
        toast({ title: 'Succès', description: 'Relevé supprimé.' });
      } catch (err) {
        console.error('Error deleting statement:', err);
        toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
      }
    },
    [user, statements, toast]
  );

  // ========================================================================
  // LINES
  // ========================================================================

  const fetchLines = useCallback(
    async (statementId) => {
      if (!user || !supabase || !statementId) return;
      try {
        setLoading(true);
        const buildBaseQuery = () =>
          supabase
            .from('bank_statement_lines')
            .select('*')
            .eq('statement_id', statementId)
            .eq('user_id', user.id)
            .order('line_number', { ascending: true });

        let query = buildBaseQuery();
        query = applyCompanyScope(query);
        let { data, error } = await query;

        if (error && isMissingColumnError(error, 'company_id')) {
          ({ data, error } = await buildBaseQuery());
        }

        if (error) throw error;
        setLines(data || []);
      } catch (err) {
        console.error('Error fetching lines:', err);
        toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
      } finally {
        setLoading(false);
      }
    },
    [user, toast, applyCompanyScope]
  );

  const importParsedLines = useCallback(
    async (statementId, parsedLines, parseErrors = [], options = {}) => {
      if (!user || !supabase || !statementId) return false;
      try {
        setLoading(true);

        // Bulk insert lines
        const records = parsedLines.map((line) =>
          withCompanyScope({
            statement_id: statementId,
            user_id: user.id,
            line_number: line.lineNumber,
            transaction_date: line.date,
            value_date: line.valueDate || null,
            description: line.description || '',
            reference: line.reference || null,
            amount: line.amount,
            balance_after: line.balance || null,
            raw_data: line.rawData || null,
            reconciliation_status: 'unmatched',
            matched_by: 'manual',
          })
        );

        let { error: insertError } = await supabase.from('bank_statement_lines').insert(records);

        if (
          insertError &&
          records.some((record) => record.company_id) &&
          isMissingColumnError(insertError, 'company_id')
        ) {
          ({ error: insertError } = await supabase
            .from('bank_statement_lines')
            .insert(records.map((record) => stripCompanyId(record))));
        }

        if (insertError) throw insertError;

        const ensureManualConnectionForInstrument = async () => {
          if (!options.paymentInstrumentId) return null;

          let existingQuery = supabase
            .from('bank_connections')
            .select('id')
            .eq('user_id', user.id)
            .eq('payment_instrument_id', options.paymentInstrumentId)
            .order('created_at', { ascending: false })
            .limit(1);
          existingQuery = applyCompanyScope(existingQuery);

          let { data: existing, error: existingError } = await existingQuery;

          if (existingError && isMissingColumnError(existingError, 'payment_instrument_id')) {
            const fallbackInstitutionId = `manual-${options.paymentInstrumentId}`;
            let fallbackQuery = supabase
              .from('bank_connections')
              .select('id')
              .eq('user_id', user.id)
              .eq('institution_id', fallbackInstitutionId)
              .order('created_at', { ascending: false })
              .limit(1);
            fallbackQuery = applyCompanyScope(fallbackQuery);
            ({ data: existing, error: existingError } = await fallbackQuery);
          }

          if (existingError && isMissingColumnError(existingError, 'company_id')) {
            ({ data: existing, error: existingError } = await supabase
              .from('bank_connections')
              .select('id')
              .eq('user_id', user.id)
              .eq('payment_instrument_id', options.paymentInstrumentId)
              .order('created_at', { ascending: false })
              .limit(1));
          }

          if (existingError) throw existingError;
          if (existing?.[0]?.id) return existing[0].id;

          const { data: instrument } = await supabase
            .from('company_payment_instruments')
            .select('id, label, currency, payment_instrument_bank_accounts(bank_name, iban_encrypted, account_holder)')
            .eq('id', options.paymentInstrumentId)
            .eq('user_id', user.id)
            .maybeSingle();

          const bankDetails = instrument?.payment_instrument_bank_accounts?.[0] || {};
          const connectionPayload = withCompanyScope({
            user_id: user.id,
            institution_id: `manual-${options.paymentInstrumentId}`,
            institution_name: options.bankName || bankDetails.bank_name || instrument?.label || 'Banque virtuelle',
            status: 'active',
            account_id: instrument?.id || options.paymentInstrumentId,
            account_iban: options.accountNumber || bankDetails.iban_encrypted || null,
            account_name: bankDetails.account_holder || instrument?.label || 'Compte manuel',
            account_currency: options.statementCurrency || instrument?.currency || 'EUR',
            account_balance: null,
            payment_instrument_id: options.paymentInstrumentId,
            last_sync_at: new Date().toISOString(),
          });

          let { data: createdConnection, error: createConnectionError } = await supabase
            .from('bank_connections')
            .insert([connectionPayload])
            .select('id')
            .single();

          if (createConnectionError && isMissingColumnError(createConnectionError, 'payment_instrument_id')) {
            const { payment_instrument_id: _ignoredPaymentInstrumentId, ...withoutInstrument } = connectionPayload;
            ({ data: createdConnection, error: createConnectionError } = await supabase
              .from('bank_connections')
              .insert([withoutInstrument])
              .select('id')
              .single());
          }

          if (
            createConnectionError &&
            connectionPayload.company_id &&
            isMissingColumnError(createConnectionError, 'company_id')
          ) {
            ({ data: createdConnection, error: createConnectionError } = await supabase
              .from('bank_connections')
              .insert([stripCompanyId(connectionPayload)])
              .select('id')
              .single());
          }

          if (createConnectionError) throw createConnectionError;
          return createdConnection?.id || null;
        };

        const bankConnectionId = await ensureManualConnectionForInstrument();

        if (bankConnectionId) {
          const bankTransactionRows = parsedLines.map((line, index) =>
            withCompanyScope({
              user_id: user.id,
              bank_connection_id: bankConnectionId,
              payment_instrument_id: options.paymentInstrumentId || null,
              external_id: toLineExternalId(statementId, line.lineNumber, index),
              date: line.date,
              booking_date: line.date,
              value_date: line.valueDate || null,
              amount: Number(line.amount || 0),
              currency: (line.currency || options.statementCurrency || 'EUR').toUpperCase(),
              description: line.description || '',
              reference: line.reference || null,
              reconciliation_status: 'unreconciled',
              raw_data: {
                ...(line.rawData || {}),
                statement_id: statementId,
                line_number: line.lineNumber ?? index + 1,
              },
            })
          );

          let { data: bankTransactions, error: bankTransactionsError } = await supabase
            .from('bank_transactions')
            .upsert(bankTransactionRows, { onConflict: 'bank_connection_id,external_id', ignoreDuplicates: false })
            .select('id, external_id, date, booking_date, value_date, amount, currency, description, reference');

          if (
            bankTransactionsError &&
            bankTransactionRows.some((row) => row.payment_instrument_id) &&
            isMissingColumnError(bankTransactionsError, 'payment_instrument_id')
          ) {
            ({ data: bankTransactions, error: bankTransactionsError } = await supabase
              .from('bank_transactions')
              .upsert(
                bankTransactionRows.map(({ payment_instrument_id: _ignoredPaymentInstrumentId, ...row }) => row),
                { onConflict: 'bank_connection_id,external_id', ignoreDuplicates: false }
              )
              .select('id, external_id, date, booking_date, value_date, amount, currency, description, reference'));
          }

          if (
            bankTransactionsError &&
            bankTransactionRows.some((row) => row.company_id) &&
            isMissingColumnError(bankTransactionsError, 'company_id')
          ) {
            ({ data: bankTransactions, error: bankTransactionsError } = await supabase
              .from('bank_transactions')
              .upsert(
                bankTransactionRows.map((row) => stripCompanyId(row)),
                {
                  onConflict: 'bank_connection_id,external_id',
                  ignoreDuplicates: false,
                }
              )
              .select('id, external_id, date, booking_date, value_date, amount, currency, description, reference'));
          }

          if (bankTransactionsError) throw bankTransactionsError;

          const bankTransactionIds = (bankTransactions || []).map((tx) => tx.id).filter(Boolean);
          if (options.paymentInstrumentId && bankTransactionIds.length > 0) {
            let existingPaymentTxQuery = supabase
              .from('payment_transactions')
              .select('id, source_id')
              .eq('user_id', user.id)
              .eq('source_module', 'bank_transactions')
              .in('source_id', bankTransactionIds);
            existingPaymentTxQuery = applyCompanyScope(existingPaymentTxQuery);
            let { data: existingPaymentTransactions, error: existingPaymentTransactionsError } =
              await existingPaymentTxQuery;

            if (
              existingPaymentTransactionsError &&
              isMissingColumnError(existingPaymentTransactionsError, 'company_id')
            ) {
              ({ data: existingPaymentTransactions, error: existingPaymentTransactionsError } = await supabase
                .from('payment_transactions')
                .select('id, source_id')
                .eq('user_id', user.id)
                .eq('source_module', 'bank_transactions')
                .in('source_id', bankTransactionIds));
            }

            if (existingPaymentTransactionsError) throw existingPaymentTransactionsError;

            const existingBySource = new Set((existingPaymentTransactions || []).map((tx) => tx.source_id));

            const paymentTransactionRows = (bankTransactions || [])
              .filter((tx) => !existingBySource.has(tx.id))
              .map((tx) =>
                withCompanyScope({
                  user_id: user.id,
                  payment_instrument_id: options.paymentInstrumentId,
                  transaction_kind: Number(tx.amount) >= 0 ? 'deposit' : 'withdrawal',
                  flow_direction: Number(tx.amount) >= 0 ? 'inflow' : 'outflow',
                  source_module: 'bank_transactions',
                  source_table: 'bank_transactions',
                  source_id: tx.id,
                  transaction_date: tx.value_date || tx.booking_date || tx.date,
                  posting_date: tx.booking_date || tx.date,
                  value_date: tx.value_date || tx.booking_date || tx.date,
                  amount: Math.abs(Number(tx.amount || 0)),
                  currency: (tx.currency || options.statementCurrency || 'EUR').toUpperCase(),
                  description: tx.description || 'Import relevé bancaire',
                  reference: tx.reference || tx.external_id || null,
                  status: 'posted',
                  created_by: user.id,
                  updated_by: user.id,
                })
              );

            if (paymentTransactionRows.length > 0) {
              let { data: createdPaymentTransactions, error: paymentTransactionsError } = await supabase
                .from('payment_transactions')
                .insert(paymentTransactionRows)
                .select('id, source_id');

              if (
                paymentTransactionsError &&
                paymentTransactionRows.some((row) => row.company_id) &&
                isMissingColumnError(paymentTransactionsError, 'company_id')
              ) {
                ({ data: createdPaymentTransactions, error: paymentTransactionsError } = await supabase
                  .from('payment_transactions')
                  .insert(paymentTransactionRows.map((row) => stripCompanyId(row)))
                  .select('id, source_id'));
              }

              if (paymentTransactionsError) throw paymentTransactionsError;

              for (const paymentTransaction of createdPaymentTransactions || []) {
                if (!paymentTransaction?.source_id) continue;
                await supabase
                  .from('bank_transactions')
                  .update({ payment_transaction_id: paymentTransaction.id })
                  .eq('id', paymentTransaction.source_id)
                  .eq('user_id', user.id);
              }
            }
          }
        }

        // Update statement status
        const { error: updateError } = await supabase
          .from('bank_statements')
          .update({
            parse_status: parseErrors.length > 0 ? 'parsed' : 'confirmed',
            parse_errors: parseErrors,
            line_count: parsedLines.length,
          })
          .eq('id', statementId);

        if (updateError) throw updateError;

        // Refresh data
        await fetchLines(statementId);
        await fetchStatements();

        toast({ title: 'Succès', description: `${parsedLines.length} opérations importées.` });
        return true;
      } catch (err) {
        console.error('Error importing lines:', err);
        toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
        return false;
      } finally {
        setLoading(false);
      }
    },
    [user, toast, fetchLines, fetchStatements, withCompanyScope, stripCompanyId, applyCompanyScope]
  );

  // ========================================================================
  // RECONCILIATION
  // ========================================================================

  const runAutoMatch = useCallback(
    async (statementId, invoices, expenses, supplierInvoices) => {
      if (!user || !supabase || !statementId) return null;
      try {
        setLoading(true);

        // Get unmatched lines
        const unmatchedLines = lines.filter((l) => l.reconciliation_status === 'unmatched');
        if (unmatchedLines.length === 0) {
          toast({ title: 'Info', description: 'Toutes les lignes sont déjà rapprochées ou ignorées.' });
          return null;
        }

        // Normalize transactions
        const transactions = normalizeTransactions(invoices, expenses, supplierInvoices);

        // Run auto-matching
        const matchResults = autoMatchLines(unmatchedLines, transactions);

        // Apply auto-matches to DB
        let matchCount = 0;
        for (const result of matchResults) {
          if (result.matched && result.autoMatched) {
            const { error } = await supabase
              .from('bank_statement_lines')
              .update({
                reconciliation_status: 'matched',
                matched_source_type: result.matchedSourceType,
                matched_source_id: result.matchedSourceId,
                matched_at: new Date().toISOString(),
                matched_by: 'auto',
                match_confidence: result.confidence,
              })
              .eq('id', result.bankLineId);

            if (!error) {
              matchCount++;
              const matchedLine = unmatchedLines.find((line) => line.id === result.bankLineId);
              if (matchedLine) {
                await syncLinkedBankTransactionStatus(
                  matchedLine,
                  'matched',
                  result.matchedSourceType,
                  result.matchedSourceId,
                  result.confidence
                );
              }
            }
          }
        }

        // Refresh lines
        await fetchLines(statementId);

        const summary = `${matchCount} ligne${matchCount > 1 ? 's' : ''} rapprochée${matchCount > 1 ? 's' : ''} automatiquement sur ${unmatchedLines.length}.`;
        toast({ title: 'Rapprochement automatique terminé', description: summary });

        return { matchCount, totalUnmatched: unmatchedLines.length, results: matchResults };
      } catch (err) {
        console.error('Error in auto-match:', err);
        toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [user, lines, toast, fetchLines, syncLinkedBankTransactionStatus]
  );

  const matchLine = useCallback(
    async (lineId, sourceType, sourceId) => {
      if (!user || !supabase) return;
      try {
        const { error } = await supabase
          .from('bank_statement_lines')
          .update({
            reconciliation_status: 'matched',
            matched_source_type: sourceType,
            matched_source_id: sourceId,
            matched_at: new Date().toISOString(),
            matched_by: 'manual',
            match_confidence: 1.0,
          })
          .eq('id', lineId);

        if (error) throw error;

        setLines((prev) =>
          prev.map((l) =>
            l.id === lineId
              ? {
                  ...l,
                  reconciliation_status: 'matched',
                  matched_source_type: sourceType,
                  matched_source_id: sourceId,
                  matched_at: new Date().toISOString(),
                  matched_by: 'manual',
                  match_confidence: 1.0,
                }
              : l
          )
        );

        toast({ title: 'Rapproché', description: 'Ligne rapprochée avec succès.' });

        const matchedLine = lines.find((l) => l.id === lineId);
        if (matchedLine) {
          await syncLinkedBankTransactionStatus(matchedLine, 'matched', sourceType, sourceId, 1.0);
        }
      } catch (err) {
        console.error('Error matching line:', err);
        toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
      }
    },
    [user, toast, lines, syncLinkedBankTransactionStatus]
  );

  const unmatchLine = useCallback(
    async (lineId) => {
      if (!user || !supabase) return;
      try {
        const { error } = await supabase
          .from('bank_statement_lines')
          .update({
            reconciliation_status: 'unmatched',
            matched_source_type: null,
            matched_source_id: null,
            matched_at: null,
            matched_by: 'manual',
            match_confidence: null,
          })
          .eq('id', lineId);

        if (error) throw error;

        setLines((prev) =>
          prev.map((l) =>
            l.id === lineId
              ? {
                  ...l,
                  reconciliation_status: 'unmatched',
                  matched_source_type: null,
                  matched_source_id: null,
                  matched_at: null,
                  match_confidence: null,
                }
              : l
          )
        );

        const unmatchedLine = lines.find((l) => l.id === lineId);
        if (unmatchedLine) {
          await syncLinkedBankTransactionStatus(unmatchedLine, 'unmatched');
        }
      } catch (err) {
        console.error('Error unmatching line:', err);
        toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
      }
    },
    [user, toast, lines, syncLinkedBankTransactionStatus]
  );

  const ignoreLine = useCallback(
    async (lineId) => {
      if (!user || !supabase) return;
      try {
        const { error } = await supabase
          .from('bank_statement_lines')
          .update({
            reconciliation_status: 'ignored',
            matched_source_type: null,
            matched_source_id: null,
            matched_at: null,
            match_confidence: null,
          })
          .eq('id', lineId);

        if (error) throw error;

        setLines((prev) =>
          prev.map((l) =>
            l.id === lineId
              ? {
                  ...l,
                  reconciliation_status: 'ignored',
                  matched_source_type: null,
                  matched_source_id: null,
                }
              : l
          )
        );

        const ignoredLine = lines.find((l) => l.id === lineId);
        if (ignoredLine) {
          await syncLinkedBankTransactionStatus(ignoredLine, 'ignored');
        }
      } catch (err) {
        console.error('Error ignoring line:', err);
        toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
      }
    },
    [user, toast, lines, syncLinkedBankTransactionStatus]
  );

  const bulkIgnoreLines = useCallback(
    async (lineIds) => {
      if (!user || !supabase || !lineIds.length) return;
      try {
        const { error } = await supabase
          .from('bank_statement_lines')
          .update({
            reconciliation_status: 'ignored',
            matched_source_type: null,
            matched_source_id: null,
            matched_at: null,
            match_confidence: null,
          })
          .in('id', lineIds);

        if (error) throw error;

        setLines((prev) =>
          prev.map((l) =>
            lineIds.includes(l.id)
              ? {
                  ...l,
                  reconciliation_status: 'ignored',
                  matched_source_type: null,
                  matched_source_id: null,
                }
              : l
          )
        );

        const lineLookup = new Map(lines.map((line) => [line.id, line]));
        for (const lineId of lineIds) {
          const line = lineLookup.get(lineId);
          if (line) {
            await syncLinkedBankTransactionStatus(line, 'ignored');
          }
        }

        toast({ title: 'Succès', description: `${lineIds.length} lignes ignorées.` });
      } catch (err) {
        console.error('Error bulk ignoring:', err);
        toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
      }
    },
    [user, toast, lines, syncLinkedBankTransactionStatus]
  );

  // ========================================================================
  // SESSIONS
  // ========================================================================

  const createSession = useCallback(
    async (statementId) => {
      if (!user || !supabase) return null;
      try {
        const summary = getReconciliationSummary(lines);
        const scopedPayload = withCompanyScope({
          user_id: user.id,
          statement_id: statementId,
          status: 'in_progress',
          ...summary,
        });

        let { data, error } = await supabase
          .from('bank_reconciliation_sessions')
          .insert([scopedPayload])
          .select()
          .single();

        if (error && scopedPayload.company_id && isMissingColumnError(error, 'company_id')) {
          ({ data, error } = await supabase
            .from('bank_reconciliation_sessions')
            .insert([stripCompanyId(scopedPayload)])
            .select()
            .single());
        }

        if (error) throw error;
        setSessions((prev) => [data, ...prev]);
        return data;
      } catch (err) {
        console.error('Error creating session:', err);
        return null;
      }
    },
    [user, lines, withCompanyScope, stripCompanyId]
  );

  const completeSession = useCallback(
    async (sessionId) => {
      if (!user || !supabase) return;
      try {
        const summary = getReconciliationSummary(lines);
        const { error } = await supabase
          .from('bank_reconciliation_sessions')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            ...summary,
          })
          .eq('id', sessionId);

        if (error) throw error;
        toast({ title: 'Succès', description: 'Rapprochement terminé.' });
      } catch (err) {
        console.error('Error completing session:', err);
        toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
      }
    },
    [user, lines, toast]
  );

  return {
    // State
    statements,
    lines,
    sessions,
    loading,
    uploading,
    // Statements
    fetchStatements,
    uploadStatement,
    deleteStatement,
    // Lines
    fetchLines,
    importParsedLines,
    // Reconciliation
    runAutoMatch,
    matchLine,
    unmatchLine,
    ignoreLine,
    bulkIgnoreLines,
    // Sessions
    createSession,
    completeSession,
  };
};
