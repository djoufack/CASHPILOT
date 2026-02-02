
import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Landmark, Upload, ArrowLeft, Zap, Download, Trash2, Eye, Search,
  CheckCircle, XCircle, MinusCircle, FileText, ShoppingCart, Receipt,
  Loader2, AlertTriangle, ArrowUpRight, ArrowDownLeft, RotateCcw
} from 'lucide-react';
import { useBankReconciliation } from '@/hooks/useBankReconciliation';
import { useAccountingData } from '@/hooks/useAccountingData';
import { normalizeTransactions, searchMatches, getReconciliationSummary } from '@/utils/reconciliationMatcher';
import { formatCurrency } from '@/utils/calculations';
import { exportReconciliationPDF } from '@/services/exportAccountingPDF';
import { useCompany } from '@/hooks/useCompany';
import { useCreditsGuard, CREDIT_COSTS } from '@/hooks/useCreditsGuard';
import CreditsGuardModal from '@/components/CreditsGuardModal';
import BankStatementUploadModal from './BankStatementUploadModal';

const BankReconciliation = ({ period }) => {
  const [view, setView] = useState('list'); // list, workspace
  const [selectedStatement, setSelectedStatement] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [filter, setFilter] = useState('all'); // all, matched, unmatched, ignored
  const [searchText, setSearchText] = useState('');
  const [searchingLineId, setSearchingLineId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { company } = useCompany();
  const { guardedAction, modalProps } = useCreditsGuard();

  const {
    statements, lines, loading, uploading,
    fetchStatements, uploadStatement, deleteStatement,
    fetchLines, importParsedLines,
    runAutoMatch, matchLine, unmatchLine, ignoreLine, bulkIgnoreLines
  } = useBankReconciliation();

  const {
    invoices, expenses, supplierInvoices
  } = useAccountingData(period?.startDate, period?.endDate);

  // Normalized transactions for matching
  const transactions = useMemo(() =>
    normalizeTransactions(invoices, expenses, supplierInvoices),
    [invoices, expenses, supplierInvoices]
  );

  // Summary for current lines
  const summary = useMemo(() => getReconciliationSummary(lines), [lines]);

  // Filtered lines
  const filteredLines = useMemo(() => {
    let result = lines;
    if (filter === 'matched') result = result.filter(l => l.reconciliation_status === 'matched');
    else if (filter === 'unmatched') result = result.filter(l => l.reconciliation_status === 'unmatched');
    else if (filter === 'ignored') result = result.filter(l => l.reconciliation_status === 'ignored');

    if (searchText) {
      const q = searchText.toLowerCase();
      result = result.filter(l =>
        (l.description || '').toLowerCase().includes(q) ||
        (l.reference || '').toLowerCase().includes(q) ||
        String(l.amount).includes(q)
      );
    }
    return result;
  }, [lines, filter, searchText]);

  // Search results for manual matching
  const searchResults = useMemo(() => {
    if (!searchingLineId) return [];
    const line = lines.find(l => l.id === searchingLineId);
    if (!line) return [];
    return searchMatches(line, transactions, { textFilter: searchQuery });
  }, [searchingLineId, searchQuery, lines, transactions]);

  // Handle upload flow
  const handleUploadComplete = async (file, parsedData, metadata) => {
    const statement = await uploadStatement(file, metadata);
    if (statement) {
      const success = await importParsedLines(statement.id, parsedData.lines, parsedData.errors);
      return success;
    }
    return false;
  };

  // Open workspace
  const openWorkspace = async (statement) => {
    setSelectedStatement(statement);
    await fetchLines(statement.id);
    setView('workspace');
    setFilter('all');
    setSearchText('');
    setSearchingLineId(null);
  };

  const backToList = () => {
    setView('list');
    setSelectedStatement(null);
    setSearchingLineId(null);
  };

  // Auto-match handler
  const handleAutoMatch = () => {
    if (selectedStatement) {
      runAutoMatch(selectedStatement.id, invoices, expenses, supplierInvoices);
    }
  };

  // PDF export — credit-guarded
  const handleExportPDF = () => {
    if (!selectedStatement) return;
    guardedAction(CREDIT_COSTS.PDF_RECONCILIATION, 'Bank Reconciliation PDF', () => {
      const companyInfo = company ? {
        company_name: company.company_name || company.name || 'Ma Société'
      } : { company_name: 'Ma Société' };

      const data = {
        bankName: selectedStatement.bank_name,
        accountNumber: selectedStatement.account_number,
        openingBalance: selectedStatement.opening_balance,
        closingBalance: selectedStatement.closing_balance,
        ...summary,
        unmatchedDetails: lines.filter(l => l.reconciliation_status === 'unmatched')
      };

      exportReconciliationPDF(data, companyInfo, {
        startDate: selectedStatement.period_start,
        endDate: selectedStatement.period_end
      });
    });
  };

  // Source type icon
  const SourceIcon = ({ type }) => {
    if (type === 'invoice') return <FileText className="w-3.5 h-3.5 text-green-400" />;
    if (type === 'expense') return <ShoppingCart className="w-3.5 h-3.5 text-red-400" />;
    if (type === 'supplier_invoice') return <Receipt className="w-3.5 h-3.5 text-blue-400" />;
    return null;
  };

  const sourceLabel = (type) => {
    if (type === 'invoice') return 'Facture';
    if (type === 'expense') return 'Dépense';
    if (type === 'supplier_invoice') return 'Facture fournisseur';
    return 'Manuel';
  };

  // ========================================================================
  // VIEW: STATEMENT LIST
  // ========================================================================

  if (view === 'list') {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-gradient flex items-center gap-2">
              <Landmark className="w-5 h-5" /> Rapprochement Bancaire
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Importez vos relevés bancaires et rapprochez-les avec vos transactions.
            </p>
          </div>
          <Button onClick={() => setShowUploadModal(true)} className="bg-orange-500 hover:bg-orange-600 text-white">
            <Upload className="w-4 h-4 mr-2" /> Importer un relevé
          </Button>
        </div>

        {/* Statement list */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-orange-400 mr-3" />
            <span className="text-gray-400">Chargement...</span>
          </div>
        ) : statements.length === 0 ? (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="py-12 text-center">
              <Landmark className="w-12 h-12 mx-auto mb-4 text-gray-600" />
              <h3 className="text-lg font-medium text-gray-400">Aucun relevé bancaire importé</h3>
              <p className="text-sm text-gray-600 mt-2">Commencez par importer un relevé bancaire pour lancer le rapprochement.</p>
              <Button onClick={() => setShowUploadModal(true)} className="mt-4 bg-orange-500 hover:bg-orange-600 text-white">
                <Upload className="w-4 h-4 mr-2" /> Importer un relevé
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-800 text-gray-500 text-xs">
                      <th className="py-3 px-4 text-left">Banque</th>
                      <th className="py-3 px-4 text-left">Période</th>
                      <th className="py-3 px-4 text-left">Fichier</th>
                      <th className="py-3 px-4 text-center">Lignes</th>
                      <th className="py-3 px-4 text-center">Statut</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statements.map(stmt => (
                      <tr key={stmt.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                        <td className="py-3 px-4 font-medium">{stmt.bank_name || '—'}</td>
                        <td className="py-3 px-4 text-gray-400 text-xs">
                          {stmt.period_start ? (
                            `${new Date(stmt.period_start).toLocaleDateString('fr-FR')} → ${new Date(stmt.period_end).toLocaleDateString('fr-FR')}`
                          ) : '—'}
                        </td>
                        <td className="py-3 px-4 text-gray-400 text-xs max-w-[200px] truncate">{stmt.file_name}</td>
                        <td className="py-3 px-4 text-center">{stmt.line_count || 0}</td>
                        <td className="py-3 px-4 text-center">
                          <Badge className={`text-xs ${
                            stmt.parse_status === 'confirmed' ? 'bg-green-500/20 text-green-400' :
                            stmt.parse_status === 'parsed' ? 'bg-blue-500/20 text-blue-400' :
                            stmt.parse_status === 'error' ? 'bg-red-500/20 text-red-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {stmt.parse_status === 'confirmed' ? 'Confirmé' :
                             stmt.parse_status === 'parsed' ? 'Analysé' :
                             stmt.parse_status === 'error' ? 'Erreur' : 'En attente'}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex gap-1 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => openWorkspace(stmt)} className="text-orange-400 hover:text-orange-300">
                              <Eye className="w-4 h-4 mr-1" /> Voir
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteStatement(stmt.id)} className="text-red-400 hover:text-red-300">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Upload Modal */}
        <BankStatementUploadModal
          open={showUploadModal}
          onOpenChange={setShowUploadModal}
          onUploadComplete={handleUploadComplete}
        />
      </div>
    );
  }

  // ========================================================================
  // VIEW: RECONCILIATION WORKSPACE
  // ========================================================================

  return (
    <div className="space-y-4">
      <CreditsGuardModal {...modalProps} />
      {/* Workspace Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={backToList} className="text-gray-400">
            <ArrowLeft className="w-4 h-4 mr-1" /> Retour
          </Button>
          <div>
            <h2 className="text-lg font-bold text-gradient">
              {selectedStatement?.bank_name || 'Relevé bancaire'}
            </h2>
            {selectedStatement?.period_start && (
              <p className="text-xs text-gray-500">
                {new Date(selectedStatement.period_start).toLocaleDateString('fr-FR')} au {new Date(selectedStatement.period_end).toLocaleDateString('fr-FR')}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleAutoMatch} disabled={loading} className="border-gray-700 text-orange-400">
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
            Rapprochement auto
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPDF} className="border-gray-700 text-gray-300">
            <Download className="w-4 h-4 mr-2" /> PDF
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-gray-900 border-gray-800">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-gray-500">Total lignes</p>
            <p className="text-xl font-bold text-white">{summary.totalLines}</p>
          </CardContent>
        </Card>
        <Card className="bg-green-500/5 border-green-500/30">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-green-400">Rapprochées</p>
            <p className="text-xl font-bold text-green-400">{summary.matchedLines}</p>
            <p className="text-xs text-gray-500">{summary.matchRate}%</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-500/5 border-amber-500/30">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-amber-400">Non rapprochées</p>
            <p className="text-xl font-bold text-amber-400">{summary.unmatchedLines}</p>
          </CardContent>
        </Card>
        <Card className="bg-gray-800 border-gray-700">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-gray-500">Ignorées</p>
            <p className="text-xl font-bold text-gray-500">{summary.ignoredLines}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-1 bg-gray-900 rounded-lg p-1">
          {[
            { key: 'all', label: 'Toutes', count: summary.totalLines },
            { key: 'matched', label: 'Rapprochées', count: summary.matchedLines },
            { key: 'unmatched', label: 'Non rapprochées', count: summary.unmatchedLines },
            { key: 'ignored', label: 'Ignorées', count: summary.ignoredLines },
          ].map(f => (
            <Button
              key={f.key}
              variant="ghost"
              size="sm"
              onClick={() => setFilter(f.key)}
              className={`text-xs h-7 px-2 ${filter === f.key ? 'bg-orange-500/20 text-orange-400' : 'text-gray-400'}`}
            >
              {f.label} ({f.count})
            </Button>
          ))}
        </div>
        <Input
          placeholder="Rechercher..."
          value={searchText}
          onChange={e => setSearchText(e.target.value)}
          className="bg-gray-800 border-gray-700 text-white text-xs h-7 w-[200px]"
        />
      </div>

      {/* Lines list */}
      <div className="space-y-1.5">
        {filteredLines.length === 0 ? (
          <div className="py-8 text-center text-gray-500 text-sm">
            Aucune ligne correspondant aux filtres.
          </div>
        ) : (
          filteredLines.map(line => (
            <div
              key={line.id}
              className={`flex items-center gap-3 p-3 rounded-lg border text-sm ${
                line.reconciliation_status === 'matched'
                  ? 'bg-green-500/5 border-green-500/20'
                  : line.reconciliation_status === 'ignored'
                  ? 'bg-gray-800/50 border-gray-800 opacity-60'
                  : 'bg-amber-500/5 border-amber-500/20'
              }`}
            >
              {/* Status icon */}
              <div className="shrink-0">
                {line.reconciliation_status === 'matched' && <CheckCircle className="w-4 h-4 text-green-400" />}
                {line.reconciliation_status === 'unmatched' && <AlertTriangle className="w-4 h-4 text-amber-400" />}
                {line.reconciliation_status === 'ignored' && <MinusCircle className="w-4 h-4 text-gray-500" />}
              </div>

              {/* Date */}
              <div className="shrink-0 w-[70px] text-xs text-gray-400">
                {new Date(line.transaction_date).toLocaleDateString('fr-FR')}
              </div>

              {/* Amount icon */}
              <div className="shrink-0">
                {line.amount >= 0 ? (
                  <ArrowDownLeft className="w-3.5 h-3.5 text-green-400" />
                ) : (
                  <ArrowUpRight className="w-3.5 h-3.5 text-red-400" />
                )}
              </div>

              {/* Description */}
              <div className="flex-1 min-w-0 truncate text-gray-300 text-xs">
                {line.description || '—'}
              </div>

              {/* Amount */}
              <div className={`shrink-0 font-mono text-sm ${line.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {line.amount >= 0 ? '+' : ''}{formatCurrency(line.amount)}
              </div>

              {/* Match info / actions */}
              <div className="shrink-0 flex items-center gap-1.5 ml-2">
                {line.reconciliation_status === 'matched' && (
                  <>
                    <div className="flex items-center gap-1 text-xs text-gray-400 bg-gray-800 rounded px-2 py-0.5">
                      <SourceIcon type={line.matched_source_type} />
                      <span>{sourceLabel(line.matched_source_type)}</span>
                      {line.matched_by === 'auto' && (
                        <Badge className="bg-blue-500/20 text-blue-400 text-[10px] ml-1">auto</Badge>
                      )}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => unmatchLine(line.id)} className="h-6 w-6 p-0 text-gray-500 hover:text-red-400" title="Annuler le rapprochement">
                      <XCircle className="w-3.5 h-3.5" />
                    </Button>
                  </>
                )}

                {line.reconciliation_status === 'unmatched' && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearchingLineId(searchingLineId === line.id ? null : line.id);
                        setSearchQuery('');
                      }}
                      className={`h-7 text-xs ${searchingLineId === line.id ? 'text-orange-400' : 'text-gray-400'}`}
                    >
                      <Search className="w-3.5 h-3.5 mr-1" /> Chercher
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => ignoreLine(line.id)} className="h-7 text-xs text-gray-500 hover:text-gray-300">
                      Ignorer
                    </Button>
                  </>
                )}

                {line.reconciliation_status === 'ignored' && (
                  <Button variant="ghost" size="sm" onClick={() => unmatchLine(line.id)} className="h-7 text-xs text-gray-500 hover:text-amber-400">
                    <RotateCcw className="w-3.5 h-3.5 mr-1" /> Restaurer
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Search panel (appears below the list when searching) */}
      {searchingLineId && (
        <Card className="bg-gray-900 border-orange-500/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-orange-400 flex items-center gap-2">
              <Search className="w-4 h-4" />
              Rechercher une correspondance
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Filtrer par description, référence..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-gray-800 border-gray-700 text-white text-sm"
              autoFocus
            />

            {searchResults.length === 0 ? (
              <p className="text-xs text-gray-500 text-center py-4">
                Aucune correspondance trouvée. Essayez de modifier la recherche.
              </p>
            ) : (
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {searchResults.slice(0, 10).map(txn => (
                  <div key={txn.id} className="flex items-center gap-3 p-2 bg-gray-800 rounded hover:bg-gray-700 text-xs">
                    <SourceIcon type={txn.source_type} />
                    <span className="text-gray-400 w-[60px] shrink-0">
                      {txn.date ? new Date(txn.date).toLocaleDateString('fr-FR') : '—'}
                    </span>
                    <span className="flex-1 truncate text-gray-300">{txn.description}</span>
                    <span className={`font-mono shrink-0 ${txn.amount >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatCurrency(txn.amount)}
                    </span>
                    <Badge className="bg-orange-500/20 text-orange-400 text-[10px]">
                      {Math.round(txn.score)}%
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs text-green-400 hover:text-green-300"
                      onClick={() => {
                        matchLine(searchingLineId, txn.source_type, txn.id);
                        setSearchingLineId(null);
                      }}
                    >
                      Rapprocher
                    </Button>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={() => setSearchingLineId(null)} className="text-gray-400 text-xs">
                Fermer
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bottom summary */}
      <Card className="bg-gray-900 border-gray-800">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center text-xs">
            <div>
              <p className="text-gray-500">Total crédits</p>
              <p className="font-mono text-green-400 text-sm">+{formatCurrency(summary.totalCredits)}</p>
            </div>
            <div>
              <p className="text-gray-500">Total débits</p>
              <p className="font-mono text-red-400 text-sm">{formatCurrency(summary.totalDebits)}</p>
            </div>
            <div>
              <p className="text-gray-500">Crédits rapprochés</p>
              <p className="font-mono text-green-400/60 text-sm">+{formatCurrency(summary.matchedCredits)}</p>
            </div>
            <div>
              <p className="text-gray-500">Écart non rapproché</p>
              <p className={`font-mono text-sm ${summary.difference === 0 ? 'text-green-400' : 'text-amber-400'}`}>
                {formatCurrency(summary.difference)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default BankReconciliation;
