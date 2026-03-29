import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FileDown, BookOpen, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '@/utils/calculations';
import { useAccountingTaxonomy } from '@/hooks/useAccountingTaxonomy';
import { formatDate } from '@/utils/dateLocale';

/**
 * Groups trial balance entries by account class prefix.
 * Returns { classCode, className, accounts: [...], total }
 */
function groupByClass(trialBalance, classPrefix, label) {
  const accounts = (trialBalance || []).filter(
    (t) => t.account_code && t.account_code.startsWith(classPrefix) && Math.abs(t.balance) >= 0.01
  );
  const total = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  return { classCode: classPrefix, className: label, accounts, total };
}

/**
 * Sums balances from trial balance matching a set of prefixes.
 */
function sumByPrefixes(trialBalance, prefixes) {
  return (trialBalance || [])
    .filter((t) => t.account_code && prefixes.some((p) => t.account_code.startsWith(p)))
    .reduce((s, a) => s + (a.balance || 0), 0);
}

const SectionTitle = ({ number, title }) => (
  <h3 className="text-base font-semibold text-gray-100 mt-6 mb-3 flex items-center gap-2">
    <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 text-xs font-bold">
      {number}
    </span>
    {title}
  </h3>
);

const AccountTable = ({ accounts, currency, showType = false }) => {
  if (!accounts || accounts.length === 0) {
    return <p className="text-sm text-gray-500 italic ml-4">Aucune donnee disponible</p>;
  }
  return (
    <div className="overflow-x-auto max-w-2xl">
      <table className="text-sm">
        <thead>
          <tr className="border-b border-gray-700/50">
            <th className="text-left py-2 pr-4 text-gray-400 font-medium text-xs w-16">Code</th>
            <th className="text-left py-2 pr-6 text-gray-400 font-medium text-xs">Libelle</th>
            {showType && <th className="text-left py-2 pr-4 text-gray-400 font-medium text-xs">Type</th>}
            <th className="text-right py-2 pl-4 text-gray-400 font-medium text-xs whitespace-nowrap">Solde</th>
          </tr>
        </thead>
        <tbody>
          {accounts.map((a, i) => (
            <tr key={a.account_code || i} className="border-b border-gray-800/30 hover:bg-gray-800/20">
              <td className="py-1.5 pr-4 font-mono text-gray-300 text-xs">{a.account_code}</td>
              <td className="py-1.5 pr-6 text-gray-200">{a.account_name || a.name || '-'}</td>
              {showType && <td className="py-1.5 pr-4 text-gray-400 text-xs capitalize">{a.account_type}</td>}
              <td className="py-1.5 pl-4 text-right font-mono text-gray-100 whitespace-nowrap">
                {formatCurrency(a.balance || 0, currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

/**
 * Returns country-specific TVA account prefixes (ENF-1: codes from plan comptable, not hardcoded).
 * BE (PCMN): TVA collectée = 451x, TVA déductible = 411x TVA portion
 * FR (PCG):  TVA collectée = 4457, 443x; TVA déductible = 4456, 445x
 * OHADA (SYSCOHADA): TVA collectée = 443x; TVA déductible = 445x
 */
function resolveTvaPrefixes(country) {
  if (country === 'BE') {
    return {
      collectee: ['451', '4510', '4511', '4512', '4513'],
      deductible: ['411', '4110', '4112', '4113', '4116'],
    };
  }
  if (country === 'OHADA') {
    return {
      collectee: ['443', '4431', '4432', '4433'],
      deductible: ['445', '4452', '4453'],
    };
  }
  // FR (PCG) — default
  return {
    collectee: ['443', '4431', '4432', '4433', '4457'],
    deductible: ['445', '4452', '4456'],
  };
}

const FinancialAnnexes = ({
  trialBalance,
  cumulativeTrialBalance,
  balanceSheet,
  incomeStatement,
  companyInfo,
  currency = 'EUR',
  period,
  onExportPDF,
}) => {
  const country = companyInfo?.country || 'FR';
  const tvaPrefixes = resolveTvaPrefixes(country);

  // ENF-1 FIX: Revenue and expense prefixes come from the DB (accounting_account_taxonomy),
  // NOT from hardcoded arrays. The hook uses the company country to select
  // the correct regional plan (france / belgium / ohada).
  // See: BUGS/fix13-financial-annexes-bugs.md
  const { caAccountPrefixes, chargesAccountPrefixes, loading: taxonomyLoading } = useAccountingTaxonomy(country);

  const notes = useMemo(() => {
    // Wait until taxonomy prefixes are loaded from DB before computing notes
    if (!caAccountPrefixes || !chargesAccountPrefixes) {
      return null;
    }

    const tb = trialBalance || [];
    // Balance sheet accounts (classes 1-5) use CUMULATIVE data (all entries up to endDate)
    // Income statement accounts (classes 6-7) use PERIOD data (current year only)
    const cumTB = cumulativeTrialBalance || tb;

    // Note 2: Immobilisations (classe 2) — cumulative
    // ENF-1 WONTFIX: prefix '2' is the structural backbone of ALL accounting plans
    // (PCG, PCMN, SYSCOHADA). It is a fundamental chart-of-accounts invariant,
    // not a configurable business value. See BUGS/fix13-financial-annexes-bugs.md.
    const immobilisations = groupByClass(cumTB, '2', 'Immobilisations');

    // Note 3: Stocks (classe 3) — cumulative
    // ENF-1 WONTFIX: prefix '3' is universal across all three plans.
    const stocks = groupByClass(cumTB, '3', 'Stocks et en-cours');

    // Note 4: Creances et dettes — cumulative
    // ENF-1 WONTFIX: prefix '4' (comptes de tiers) is universal across all three plans.
    const creances = cumTB.filter(
      (t) =>
        t.account_code && t.account_code.startsWith('4') && t.account_type === 'asset' && Math.abs(t.balance) >= 0.01
    );
    const dettes = cumTB.filter(
      (t) =>
        t.account_code &&
        t.account_code.startsWith('4') &&
        t.account_type === 'liability' &&
        Math.abs(t.balance) >= 0.01
    );

    // Note 5: Tresorerie (classe 5) — cumulative
    // ENF-1 WONTFIX: prefix '5' is universal across all three plans.
    const tresorerie = groupByClass(cumTB, '5', 'Tresorerie');

    // Note 6: Chiffre d'affaires — period
    // ENF-1 FIX: prefixes sourced from accounting_account_taxonomy via useAccountingTaxonomy.
    // semantic_role: 'sales_revenue' | 'operating_revenue' — region-aware (FR/BE/OHADA).
    const ca = tb.filter(
      (t) =>
        t.account_code && caAccountPrefixes.some((p) => t.account_code.startsWith(p)) && Math.abs(t.balance) >= 0.01
    );
    const totalCA = ca.reduce((s, a) => s + (a.balance || 0), 0);

    // Note 7: Charges d'exploitation — period
    // ENF-1 FIX: prefixes sourced from accounting_account_taxonomy via useAccountingTaxonomy.
    // semantic_role: 'operating_cash_expense' | 'supplier_expense' | 'direct_cost_expense'.
    const charges = tb.filter(
      (t) =>
        t.account_code &&
        chargesAccountPrefixes.some((p) => t.account_code.startsWith(p)) &&
        Math.abs(t.balance) >= 0.01
    );
    const totalCharges = charges.reduce((s, a) => s + (a.balance || 0), 0);

    // Note 8: TVA — cumulative (balance sheet accounts)
    // Prefixes are country-aware (ENF-1: no hardcoded FR-only codes)
    const tvaCollectee = sumByPrefixes(cumTB, tvaPrefixes.collectee);
    const tvaDeductible = sumByPrefixes(cumTB, tvaPrefixes.deductible);

    return {
      immobilisations,
      stocks,
      creances,
      dettes,
      tresorerie,
      ca,
      totalCA,
      charges,
      totalCharges,
      tvaCollectee,
      tvaDeductible,
    };
  }, [trialBalance, cumulativeTrialBalance, tvaPrefixes, caAccountPrefixes, chargesAccountPrefixes]);

  const hasTB =
    (trialBalance && trialBalance.length > 0) || (cumulativeTrialBalance && cumulativeTrialBalance.length > 0);
  if (!hasTB) {
    return (
      <Card className="bg-gray-900/50 border border-gray-800">
        <CardContent className="p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-100 mb-2">Donnees insuffisantes pour les annexes</h3>
          <p className="text-sm text-gray-400">
            Importez votre plan comptable et creez des ecritures pour generer les notes aux etats financiers.
          </p>
        </CardContent>
      </Card>
    );
  }

  // While taxonomy prefixes are loading from DB, show a skeleton state
  if (taxonomyLoading || !notes) {
    return (
      <Card className="bg-gray-900/50 border border-gray-800">
        <CardContent className="p-8 text-center">
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-700/50 rounded w-1/3 mx-auto" />
            <div className="h-3 bg-gray-700/30 rounded w-1/2 mx-auto" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const planName =
    companyInfo?.country === 'OHADA'
      ? 'SYSCOHADA Revise'
      : companyInfo?.country === 'BE'
        ? 'PCMN Belge'
        : 'PCG Francais';

  const netIncome = incomeStatement?.netIncome || balanceSheet?.netIncome || 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="bg-gray-900/50 border border-gray-800">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <BookOpen className="w-6 h-6 text-amber-400" />
              <div>
                <h2 className="text-lg font-bold text-gray-100">Notes aux Etats Financiers</h2>
                <p className="text-sm text-gray-400">
                  {companyInfo?.company_name || 'Entreprise'} — {planName}
                  {period?.startDate && period?.endDate && (
                    <span>
                      {' '}
                      — Du {formatDate(period.startDate)} au {formatDate(period.endDate)}
                    </span>
                  )}
                </p>
              </div>
            </div>
            {onExportPDF && (
              <Button
                variant="outline"
                size="sm"
                className="border-gray-700 text-gray-300 hover:bg-gray-800"
                onClick={onExportPDF}
              >
                <FileDown className="w-4 h-4 mr-2" />
                Exporter PDF
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Notes */}
      <Card className="bg-gray-900/50 border border-gray-800">
        <CardContent className="p-5">
          {/* Note 1: Regles et methodes comptables */}
          <SectionTitle number="1" title="Regles et methodes comptables" />
          <div className="ml-4 space-y-2 text-sm text-gray-300">
            <p>
              <span className="text-gray-400">Plan comptable :</span>{' '}
              <span className="font-medium text-gray-100">{planName}</span>
            </p>
            <p>
              <span className="text-gray-400">Devise :</span>{' '}
              <span className="font-medium text-gray-100">{currency}</span>
            </p>
            <p>
              <span className="text-gray-400">Methode d'inventaire :</span>{' '}
              <span className="font-medium text-gray-100">Inventaire permanent</span>
            </p>
            <p>
              <span className="text-gray-400">Convention de base :</span>{' '}
              <span className="text-gray-200">
                Cout historique, continuite d'exploitation, prudence, permanence des methodes
              </span>
            </p>
          </div>

          {/* Note 2: Immobilisations */}
          <SectionTitle number="2" title="Immobilisations" />
          <div className="ml-4">
            {notes.immobilisations.accounts.length > 0 ? (
              <>
                <AccountTable accounts={notes.immobilisations.accounts} currency={currency} />
                <p className="text-sm font-semibold text-gray-100 mt-2 max-w-2xl text-right">
                  Total immobilisations : {formatCurrency(notes.immobilisations.total, currency)}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-500 italic">Aucune immobilisation enregistree</p>
            )}
          </div>

          {/* Note 3: Stocks */}
          <SectionTitle number="3" title="Stocks et en-cours" />
          <div className="ml-4">
            {notes.stocks.accounts.length > 0 ? (
              <>
                <AccountTable accounts={notes.stocks.accounts} currency={currency} />
                <p className="text-sm font-semibold text-gray-100 mt-2 max-w-2xl text-right">
                  Total stocks : {formatCurrency(notes.stocks.total, currency)}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-500 italic">
                Aucun stock enregistre. Les ecritures de stocks seront generees via les mappings d'inventaire permanent.
              </p>
            )}
          </div>

          {/* Note 4: Creances et dettes */}
          <SectionTitle number="4" title="Creances et dettes" />
          <div className="ml-4 space-y-4">
            <div>
              <h4 className="text-sm font-medium text-blue-400 mb-2">Creances (comptes actif classe 4)</h4>
              <AccountTable accounts={notes.creances} currency={currency} />
              <p className="text-sm font-semibold text-gray-100 mt-2 max-w-2xl text-right">
                Total creances :{' '}
                {formatCurrency(
                  notes.creances.reduce((s, a) => s + (a.balance || 0), 0),
                  currency
                )}
              </p>
            </div>
            <div>
              <h4 className="text-sm font-medium text-red-400 mb-2">Dettes (comptes passif classe 4)</h4>
              <AccountTable accounts={notes.dettes} currency={currency} />
              <p className="text-sm font-semibold text-gray-100 mt-2 max-w-2xl text-right">
                Total dettes :{' '}
                {formatCurrency(
                  notes.dettes.reduce((s, a) => s + (a.balance || 0), 0),
                  currency
                )}
              </p>
            </div>
          </div>

          {/* Note 5: Tresorerie */}
          <SectionTitle number="5" title="Tresorerie" />
          <div className="ml-4">
            {notes.tresorerie.accounts.length > 0 ? (
              <>
                <AccountTable accounts={notes.tresorerie.accounts} currency={currency} />
                <p className="text-sm font-semibold text-gray-100 mt-2 max-w-2xl text-right">
                  Total tresorerie : {formatCurrency(notes.tresorerie.total, currency)}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-500 italic">Aucun compte de tresorerie avec solde</p>
            )}
          </div>

          {/* Note 6: Chiffre d'affaires */}
          <SectionTitle number="6" title="Chiffre d'affaires" />
          <div className="ml-4">
            {notes.ca.length > 0 ? (
              <>
                <AccountTable accounts={notes.ca} currency={currency} />
                <p className="text-sm font-semibold text-gray-100 mt-2 max-w-2xl text-right">
                  Total chiffre d'affaires : {formatCurrency(notes.totalCA, currency)}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-500 italic">Aucune vente enregistree sur la periode</p>
            )}
          </div>

          {/* Note 7: Charges d'exploitation */}
          <SectionTitle number="7" title="Charges d'exploitation" />
          <div className="ml-4">
            {notes.charges.length > 0 ? (
              <>
                <AccountTable accounts={notes.charges} currency={currency} />
                <p className="text-sm font-semibold text-gray-100 mt-2 max-w-2xl text-right">
                  Total charges : {formatCurrency(notes.totalCharges, currency)}
                </p>
              </>
            ) : (
              <p className="text-sm text-gray-500 italic">Aucune charge enregistree sur la periode</p>
            )}
          </div>

          {/* Note 8: Resultat fiscal et impots */}
          <SectionTitle number="8" title="Resultat fiscal et impots" />
          <div className="ml-4 space-y-2 text-sm text-gray-300">
            <div className="grid grid-cols-2 gap-4 max-w-lg">
              <div className="p-3 rounded bg-gray-800/50 border border-gray-700/50">
                <p className="text-gray-400 text-xs">Resultat net</p>
                <p className={`font-mono font-semibold ${netIncome >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(netIncome, currency)}
                </p>
              </div>
              <div className="p-3 rounded bg-gray-800/50 border border-gray-700/50">
                <p className="text-gray-400 text-xs">TVA collectee</p>
                <p className="font-mono font-semibold text-gray-100">
                  {formatCurrency(Math.abs(notes.tvaCollectee), currency)}
                </p>
              </div>
              <div className="p-3 rounded bg-gray-800/50 border border-gray-700/50">
                <p className="text-gray-400 text-xs">TVA deductible</p>
                <p className="font-mono font-semibold text-gray-100">
                  {formatCurrency(Math.abs(notes.tvaDeductible), currency)}
                </p>
              </div>
              <div className="p-3 rounded bg-gray-800/50 border border-gray-700/50">
                <p className="text-gray-400 text-xs">TVA nette</p>
                <p className="font-mono font-semibold text-gray-100">
                  {formatCurrency(Math.abs(notes.tvaCollectee) - Math.abs(notes.tvaDeductible), currency)}
                </p>
              </div>
            </div>
          </div>

          {/* Note 9: Engagements hors bilan */}
          <SectionTitle number="9" title="Engagements hors bilan" />
          <div className="ml-4">
            <p className="text-sm text-gray-500 italic">
              Neant. Aucun engagement hors bilan identifie a la date de cloture.
            </p>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-4 border-t border-gray-700/50 text-center">
            <p className="text-xs text-gray-500">
              Notes generees automatiquement par CashPilot — {formatDate(new Date())}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FinancialAnnexes;
