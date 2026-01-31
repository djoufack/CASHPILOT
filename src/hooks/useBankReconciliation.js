
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/components/ui/use-toast';
import { autoMatchLines, normalizeTransactions, getReconciliationSummary } from '@/utils/reconciliationMatcher';

export const useBankReconciliation = () => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [statements, setStatements] = useState([]);
  const [lines, setLines] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // ========================================================================
  // STATEMENTS CRUD
  // ========================================================================

  const fetchStatements = useCallback(async () => {
    if (!user || !supabase) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bank_statements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setStatements(data || []);
    } catch (err) {
      console.error('Error fetching statements:', err);
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  useEffect(() => {
    fetchStatements();
  }, [fetchStatements]);

  const uploadStatement = useCallback(async (file, metadata = {}) => {
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
      const { data, error } = await supabase
        .from('bank_statements')
        .insert([{
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
          parse_status: 'pending',
          line_count: 0
        }])
        .select()
        .single();

      if (error) throw error;

      setStatements(prev => [data, ...prev]);
      toast({ title: 'Succès', description: 'Relevé bancaire importé avec succès.' });
      return data;
    } catch (err) {
      console.error('Error uploading statement:', err);
      toast({ title: 'Erreur', description: `Erreur d'import : ${err.message}`, variant: 'destructive' });
      return null;
    } finally {
      setUploading(false);
    }
  }, [user, toast]);

  const deleteStatement = useCallback(async (id) => {
    if (!user || !supabase) return;
    try {
      const statement = statements.find(s => s.id === id);

      // Delete file from storage
      if (statement?.file_path) {
        await supabase.storage.from('bank-statements').remove([statement.file_path]);
      }

      // Delete from DB (cascade deletes lines)
      const { error } = await supabase.from('bank_statements').delete().eq('id', id);
      if (error) throw error;

      setStatements(prev => prev.filter(s => s.id !== id));
      setLines([]);
      toast({ title: 'Succès', description: 'Relevé supprimé.' });
    } catch (err) {
      console.error('Error deleting statement:', err);
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    }
  }, [user, statements, toast]);

  // ========================================================================
  // LINES
  // ========================================================================

  const fetchLines = useCallback(async (statementId) => {
    if (!user || !supabase || !statementId) return;
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('bank_statement_lines')
        .select('*')
        .eq('statement_id', statementId)
        .order('line_number', { ascending: true });

      if (error) throw error;
      setLines(data || []);
    } catch (err) {
      console.error('Error fetching lines:', err);
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [user, toast]);

  const importParsedLines = useCallback(async (statementId, parsedLines, parseErrors = []) => {
    if (!user || !supabase || !statementId) return false;
    try {
      setLoading(true);

      // Bulk insert lines
      const records = parsedLines.map(line => ({
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
        matched_by: 'manual'
      }));

      const { error: insertError } = await supabase
        .from('bank_statement_lines')
        .insert(records);

      if (insertError) throw insertError;

      // Update statement status
      const { error: updateError } = await supabase
        .from('bank_statements')
        .update({
          parse_status: parseErrors.length > 0 ? 'parsed' : 'confirmed',
          parse_errors: parseErrors,
          line_count: parsedLines.length
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
  }, [user, toast, fetchLines, fetchStatements]);

  // ========================================================================
  // RECONCILIATION
  // ========================================================================

  const runAutoMatch = useCallback(async (statementId, invoices, expenses, supplierInvoices) => {
    if (!user || !supabase || !statementId) return null;
    try {
      setLoading(true);

      // Get unmatched lines
      const unmatchedLines = lines.filter(l => l.reconciliation_status === 'unmatched');
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
              match_confidence: result.confidence
            })
            .eq('id', result.bankLineId);

          if (!error) matchCount++;
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
  }, [user, lines, toast, fetchLines]);

  const matchLine = useCallback(async (lineId, sourceType, sourceId) => {
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
          match_confidence: 1.0
        })
        .eq('id', lineId);

      if (error) throw error;

      setLines(prev => prev.map(l => l.id === lineId ? {
        ...l,
        reconciliation_status: 'matched',
        matched_source_type: sourceType,
        matched_source_id: sourceId,
        matched_at: new Date().toISOString(),
        matched_by: 'manual',
        match_confidence: 1.0
      } : l));

      toast({ title: 'Rapproché', description: 'Ligne rapprochée avec succès.' });
    } catch (err) {
      console.error('Error matching line:', err);
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    }
  }, [user, toast]);

  const unmatchLine = useCallback(async (lineId) => {
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
          match_confidence: null
        })
        .eq('id', lineId);

      if (error) throw error;

      setLines(prev => prev.map(l => l.id === lineId ? {
        ...l,
        reconciliation_status: 'unmatched',
        matched_source_type: null,
        matched_source_id: null,
        matched_at: null,
        match_confidence: null
      } : l));
    } catch (err) {
      console.error('Error unmatching line:', err);
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    }
  }, [user, toast]);

  const ignoreLine = useCallback(async (lineId) => {
    if (!user || !supabase) return;
    try {
      const { error } = await supabase
        .from('bank_statement_lines')
        .update({
          reconciliation_status: 'ignored',
          matched_source_type: null,
          matched_source_id: null,
          matched_at: null,
          match_confidence: null
        })
        .eq('id', lineId);

      if (error) throw error;

      setLines(prev => prev.map(l => l.id === lineId ? {
        ...l, reconciliation_status: 'ignored',
        matched_source_type: null, matched_source_id: null
      } : l));
    } catch (err) {
      console.error('Error ignoring line:', err);
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    }
  }, [user, toast]);

  const bulkIgnoreLines = useCallback(async (lineIds) => {
    if (!user || !supabase || !lineIds.length) return;
    try {
      const { error } = await supabase
        .from('bank_statement_lines')
        .update({
          reconciliation_status: 'ignored',
          matched_source_type: null,
          matched_source_id: null,
          matched_at: null,
          match_confidence: null
        })
        .in('id', lineIds);

      if (error) throw error;

      setLines(prev => prev.map(l => lineIds.includes(l.id) ? {
        ...l, reconciliation_status: 'ignored',
        matched_source_type: null, matched_source_id: null
      } : l));

      toast({ title: 'Succès', description: `${lineIds.length} lignes ignorées.` });
    } catch (err) {
      console.error('Error bulk ignoring:', err);
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    }
  }, [user, toast]);

  // ========================================================================
  // SESSIONS
  // ========================================================================

  const createSession = useCallback(async (statementId) => {
    if (!user || !supabase) return null;
    try {
      const summary = getReconciliationSummary(lines);
      const { data, error } = await supabase
        .from('bank_reconciliation_sessions')
        .insert([{
          user_id: user.id,
          statement_id: statementId,
          status: 'in_progress',
          ...summary
        }])
        .select()
        .single();

      if (error) throw error;
      setSessions(prev => [data, ...prev]);
      return data;
    } catch (err) {
      console.error('Error creating session:', err);
      return null;
    }
  }, [user, lines]);

  const completeSession = useCallback(async (sessionId) => {
    if (!user || !supabase) return;
    try {
      const summary = getReconciliationSummary(lines);
      const { error } = await supabase
        .from('bank_reconciliation_sessions')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          ...summary
        })
        .eq('id', sessionId);

      if (error) throw error;
      toast({ title: 'Succès', description: 'Rapprochement terminé.' });
    } catch (err) {
      console.error('Error completing session:', err);
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    }
  }, [user, lines, toast]);

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
    completeSession
  };
};
