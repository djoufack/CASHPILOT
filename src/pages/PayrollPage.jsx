import { useMemo, useState, useCallback } from 'react';
import { Helmet } from 'react-helmet';
import {
  CalendarDays,
  Calculator,
  FileText,
  History,
  Link2,
  Plus,
  Download,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Info,
  RefreshCw,
  ChevronRight,
  X,
} from 'lucide-react';
import { usePayroll } from '@/hooks/usePayroll';
import { useCompany } from '@/hooks/useCompany';
import { usePayrollCountryConnectors } from '@/hooks/usePayrollCountryConnectors';
import { buildPayrollCountryConnectorInsights } from '@/services/hrPayrollCountryConnectorInsights';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { PAYROLL_STATUSES } from '@/config/statusMappings';

/* ---- Helpers ---- */

const fmtCur = (v, c = 'EUR') =>
  new Intl.NumberFormat('fr-FR', { style: 'currency', currency: c }).format(Number(v || 0));

const fmtDate = (v) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('fr-FR');
};

const fmtMonth = (v) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
};

const empLabel = (e) => e?.full_name || `${e?.first_name || ''} ${e?.last_name || ''}`.trim() || e?.id || '-';

const STATUS = PAYROLL_STATUSES;

const SEVERITY = {
  error: { label: 'Erreur', icon: AlertCircle, bg: 'bg-red-500/15', text: 'text-red-400', border: 'border-red-500/30' },
  warning: {
    label: 'Avertissement',
    icon: AlertTriangle,
    bg: 'bg-amber-500/15',
    text: 'text-amber-400',
    border: 'border-amber-500/30',
  },
  info: { label: 'Info', icon: Info, bg: 'bg-blue-500/15', text: 'text-blue-400', border: 'border-blue-500/30' },
};

const CONNECTOR_CATEGORY_LABEL = {
  payroll: 'Paie',
  compliance: 'Conformite',
};

const CONNECTOR_STATUS_OPTIONS = [
  ['not_connected', 'Non connecte'],
  ['attention', 'Attention'],
  ['connected', 'Connecte'],
];

const CONNECTOR_STATUS_STYLE = {
  not_connected: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  attention: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  connected: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
};

const CONNECTOR_COMPLIANCE_OPTIONS = [
  ['unknown', 'Inconnu'],
  ['compliant', 'Conforme'],
  ['warning', 'A surveiller'],
  ['non_compliant', 'Non conforme'],
];

const CONNECTOR_COMPLIANCE_STYLE = {
  unknown: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  compliant: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
  warning: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
  non_compliant: 'bg-red-500/20 text-red-300 border-red-500/30',
};

const StatusBadge = ({ status }) => {
  const c = STATUS[status] || STATUS.draft;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${c.bg} ${c.text} border ${c.border}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
};

/* ---- Tab 1 : Periodes ---- */

const PeriodesTab = ({ periods, selectedPeriodId, onSelectPeriod, onCreatePeriod }) => {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ period_label: '', period_start: '', period_end: '', jurisdiction: '' });
  const [busy, setBusy] = useState(false);

  const handleCreate = async () => {
    if (!form.period_start || !form.period_end) return;
    setBusy(true);
    try {
      await onCreatePeriod(form);
      setOpen(false);
      setForm({ period_label: '', period_start: '', period_end: '', jurisdiction: '' });
    } catch {
      /* hook toast */
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">Periodes de paie</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {periods.length} periode{periods.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={() => setOpen(true)} className="bg-orange-500 hover:bg-orange-600 text-white font-semibold">
          <Plus className="w-4 h-4 mr-2" />
          Nouvelle periode
        </Button>
      </div>

      {periods.length === 0 ? (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="py-16 text-center">
            <CalendarDays className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400 text-sm">Aucune periode. Creez-en une pour commencer.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {periods.map((p) => {
            const sel = selectedPeriodId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelectPeriod(p.id)}
                className={`text-left rounded-xl border p-4 transition-all ${sel ? 'bg-orange-500/10 border-orange-500/40 ring-1 ring-orange-500/30' : 'bg-white/5 border-white/10 hover:bg-white/[0.07]'}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-100 truncate">
                      {p.period_label || `Periode ${fmtMonth(p.period_start)}`}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {fmtDate(p.period_start)} - {fmtDate(p.period_end)}
                    </p>
                  </div>
                  <StatusBadge status={p.status} />
                </div>
                {p.jurisdiction && <p className="text-xs text-gray-500 mb-2">Juridiction : {p.jurisdiction}</p>}
                <div className="flex items-center justify-between mt-2 pt-2 border-t border-white/5">
                  <span className="text-xs text-gray-500">Cree le {fmtDate(p.created_at)}</span>
                  <ChevronRight className={`w-4 h-4 ${sel ? 'text-orange-400' : 'text-gray-600'}`} />
                </div>
              </button>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#141c33] border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Nouvelle periode de paie</DialogTitle>
            <DialogDescription className="text-gray-400">
              Definissez les dates et un libelle optionnel.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-gray-300 text-sm">Libelle</Label>
              <Input
                value={form.period_label}
                onChange={(e) => setForm((f) => ({ ...f, period_label: e.target.value }))}
                placeholder="ex. Janvier 2026"
                className="bg-white/5 border-white/10 text-gray-100 mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-300 text-sm">Debut *</Label>
                <Input
                  type="date"
                  value={form.period_start}
                  onChange={(e) => setForm((f) => ({ ...f, period_start: e.target.value }))}
                  className="bg-white/5 border-white/10 text-gray-100 mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-300 text-sm">Fin *</Label>
                <Input
                  type="date"
                  value={form.period_end}
                  onChange={(e) => setForm((f) => ({ ...f, period_end: e.target.value }))}
                  className="bg-white/5 border-white/10 text-gray-100 mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-gray-300 text-sm">Juridiction</Label>
              <Input
                value={form.jurisdiction}
                onChange={(e) => setForm((f) => ({ ...f, jurisdiction: e.target.value }))}
                placeholder="ex. FR, BE, CH"
                className="bg-white/5 border-white/10 text-gray-100 mt-1"
              />
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="border-white/10 text-gray-300 hover:bg-white/5"
            >
              Annuler
            </Button>
            <Button
              onClick={handleCreate}
              disabled={busy || !form.period_start || !form.period_end}
              className="bg-orange-500 hover:bg-orange-600 text-white font-semibold"
            >
              {busy ? 'Creation...' : 'Creer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ---- Tab 2 : Calcul ---- */

const CalculTab = ({
  selectedPeriod,
  employees,
  variableItems,
  anomalies,
  currency,
  // DB-sourced employee social charge preview rate (ENF-1: no hardcoded rate).
  // Comes from hr_account_code_mappings key 'payroll.preview_employee_rate'.
  previewEmployeeChargesRate,
  onCalculate,
  onValidate,
  onAddVariableItem,
  onRemoveVariableItem,
  onResolveAnomaly,
}) => {
  const [calcBusy, setCalcBusy] = useState(false);
  const [valBusy, setValBusy] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [itemForm, setItemForm] = useState({
    employee_id: '',
    item_type: 'bonus',
    label: '',
    amount: '',
    quantity: '1',
  });

  const pVI = useMemo(
    () => (variableItems || []).filter((v) => v.payroll_period_id === selectedPeriod?.id),
    [variableItems, selectedPeriod?.id]
  );
  const pAnom = useMemo(
    () => (anomalies || []).filter((a) => a.payroll_period_id === selectedPeriod?.id),
    [anomalies, selectedPeriod?.id]
  );
  const unresolved = pAnom.filter((a) => !a.resolved);

  const rows = useMemo(
    () =>
      (employees || []).map((e) => {
        const ct = e.contracts?.find((c) => c.status === 'active') || e.contracts?.[0];
        const gross = Number(ct?.monthly_salary || 0);
        // Use DB-sourced rate (ENF-1: no hardcoded social charge rate).
        const effectiveRate = Number(previewEmployeeChargesRate) || 0;
        const charges = gross * effectiveRate;
        const extras = pVI
          .filter((v) => v.employee_id === e.id)
          .reduce((s, v) => s + Number(v.amount || 0) * Number(v.quantity || 1), 0);
        return {
          ...e,
          contract: ct,
          gross,
          charges,
          extras,
          totalGross: gross + extras,
          totalNet: gross - charges + extras * (1 - effectiveRate),
        };
      }),
    [employees, pVI, previewEmployeeChargesRate]
  );

  const totals = useMemo(
    () =>
      rows.reduce(
        (a, r) => ({ gross: a.gross + r.totalGross, net: a.net + r.totalNet, charges: a.charges + r.charges }),
        { gross: 0, net: 0, charges: 0 }
      ),
    [rows]
  );

  const doCalc = async () => {
    setCalcBusy(true);
    try {
      await onCalculate(selectedPeriod.id);
    } catch (err) {
      console.error('Payroll calculation failed:', err);
    } finally {
      setCalcBusy(false);
    }
  };
  const doVal = async () => {
    setValBusy(true);
    try {
      await onValidate(selectedPeriod.id);
    } catch (err) {
      console.error('Payroll validation failed:', err);
    } finally {
      setValBusy(false);
    }
  };
  const doAdd = async () => {
    if (!itemForm.employee_id || !itemForm.amount) return;
    try {
      await onAddVariableItem({
        payroll_period_id: selectedPeriod.id,
        ...itemForm,
        amount: Number(itemForm.amount),
        quantity: Number(itemForm.quantity) || 1,
      });
      setShowAdd(false);
      setItemForm({ employee_id: '', item_type: 'bonus', label: '', amount: '', quantity: '1' });
    } catch (err) {
      console.error('Failed to add payroll variable item:', err);
    }
  };

  if (!selectedPeriod)
    return (
      <Card className="bg-white/5 border-white/10">
        <CardContent className="py-16 text-center">
          <Calculator className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Selectionnez une periode dans l'onglet "Periodes".</p>
        </CardContent>
      </Card>
    );

  return (
    <div className="space-y-6">
      {/* Period bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-xl bg-white/5 border border-white/10 p-4">
        <div className="flex items-center gap-3">
          <div>
            <p className="text-sm font-medium text-gray-100">
              {selectedPeriod.period_label || `Periode ${fmtMonth(selectedPeriod.period_start)}`}
            </p>
            <p className="text-xs text-gray-500">
              {fmtDate(selectedPeriod.period_start)} - {fmtDate(selectedPeriod.period_end)}
            </p>
          </div>
          <StatusBadge status={selectedPeriod.status} />
        </div>
        <div className="flex gap-2">
          <Button
            onClick={doCalc}
            disabled={calcBusy || selectedPeriod.status === 'exported'}
            variant="outline"
            className="border-blue-500/40 text-blue-400 hover:bg-blue-500/10"
          >
            {calcBusy ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Calculator className="w-4 h-4 mr-2" />}
            Calculer
          </Button>
          <Button
            onClick={doVal}
            disabled={valBusy || selectedPeriod.status === 'validated' || selectedPeriod.status === 'exported'}
            variant="outline"
            className="border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/10"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            {valBusy ? 'Validation...' : 'Valider'}
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          ['Brut total', totals.gross, 'text-gray-100'],
          ['Net total', totals.net, 'text-emerald-400'],
          ['Charges patronales', totals.charges, 'text-amber-400'],
        ].map(([l, v, cl]) => (
          <Card key={l} className="bg-white/5 border-white/10">
            <CardContent className="py-4 px-5">
              <p className="text-xs uppercase tracking-wide text-gray-500">{l}</p>
              <p className={`text-xl font-bold mt-1 ${cl}`}>{fmtCur(v, currency)}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Employee table */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-200">Employes ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {['Employe', 'Contrat', 'Brut', 'Charges', 'Variables', 'Net'].map((h, i) => (
                    <th
                      key={h}
                      className={`py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide ${i >= 2 ? 'text-right' : 'text-left'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500 text-sm">
                      Aucun employe actif
                    </td>
                  </tr>
                ) : (
                  rows.map((r) => (
                    <tr key={r.id} className="hover:bg-white/[0.03]">
                      <td className="py-3 px-4 text-gray-200 font-medium">{empLabel(r)}</td>
                      <td className="py-3 px-4 text-gray-400 text-xs">{r.contract?.contract_type || '-'}</td>
                      <td className="py-3 px-4 text-right text-gray-200 tabular-nums">
                        {fmtCur(r.totalGross, currency)}
                      </td>
                      <td className="py-3 px-4 text-right text-amber-400/80 tabular-nums">
                        {fmtCur(r.charges, currency)}
                      </td>
                      <td className="py-3 px-4 text-right text-blue-400/80 tabular-nums">
                        {r.extras > 0 ? fmtCur(r.extras, currency) : '-'}
                      </td>
                      <td className="py-3 px-4 text-right text-emerald-400 font-medium tabular-nums">
                        {fmtCur(r.totalNet, currency)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="border-t border-white/10 bg-white/[0.02]">
                    <td colSpan={2} className="py-3 px-4 text-gray-300 font-semibold text-sm">
                      Totaux
                    </td>
                    <td className="py-3 px-4 text-right text-gray-100 font-semibold tabular-nums">
                      {fmtCur(totals.gross, currency)}
                    </td>
                    <td className="py-3 px-4 text-right text-amber-400 font-semibold tabular-nums">
                      {fmtCur(totals.charges, currency)}
                    </td>
                    <td className="py-3 px-4" />
                    <td className="py-3 px-4 text-right text-emerald-400 font-semibold tabular-nums">
                      {fmtCur(totals.net, currency)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Variable items */}
      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-semibold text-gray-200">Elements variables ({pVI.length})</CardTitle>
          <Button
            size="sm"
            onClick={() => setShowAdd(true)}
            className="bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/30"
          >
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Ajouter
          </Button>
        </CardHeader>
        <CardContent>
          {pVI.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-6">Aucun element variable.</p>
          ) : (
            <div className="space-y-2">
              {pVI.map((vi) => {
                return (
                  <div
                    key={vi.id}
                    className="flex items-center justify-between rounded-lg bg-white/[0.03] border border-white/5 px-4 py-2.5"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">{vi.item_type}</Badge>
                      <div className="min-w-0">
                        <p className="text-sm text-gray-200 truncate">
                          {vi.label || vi.item_type} - {vi.employee?.full_name || vi.employee_id || '-'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-100 font-medium tabular-nums">
                        {fmtCur(Number(vi.amount || 0) * Number(vi.quantity || 1), currency)}
                      </span>
                      <button
                        type="button"
                        onClick={() => onRemoveVariableItem(vi.id)}
                        className="text-gray-600 hover:text-red-400"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Anomalies */}
      {pAnom.length > 0 && (
        <Card className="bg-white/5 border-white/10">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold text-gray-200 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              Anomalies ({unresolved.length} non resolue{unresolved.length !== 1 ? 's' : ''})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {pAnom.map((a) => {
                const sev = SEVERITY[a.severity] || SEVERITY.warning;
                const Icon = sev.icon;
                return (
                  <div
                    key={a.id}
                    className={`flex items-start justify-between gap-3 rounded-lg px-4 py-3 border ${sev.bg} ${sev.border} ${a.resolved ? 'opacity-50' : ''}`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${sev.text}`} />
                      <div>
                        <span className={`text-xs font-medium ${sev.text}`}>{sev.label}</span>
                        {a.resolved && (
                          <Badge className="ml-2 bg-emerald-500/20 text-emerald-300 border-emerald-500/30 text-[10px]">
                            Resolue
                          </Badge>
                        )}
                        <p className="text-sm text-gray-300 mt-0.5">
                          {a.message || a.description || 'Anomalie detectee'}
                        </p>
                      </div>
                    </div>
                    {!a.resolved && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onResolveAnomaly(a.id)}
                        className="text-gray-400 hover:text-emerald-400 flex-shrink-0"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add variable item dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="bg-[#141c33] border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Ajouter un element variable</DialogTitle>
            <DialogDescription className="text-gray-400">Prime, heures sup., acompte, retenue...</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-gray-300 text-sm">Employe *</Label>
              <select
                value={itemForm.employee_id}
                onChange={(e) => setItemForm((f) => ({ ...f, employee_id: e.target.value }))}
                className="mt-1 w-full rounded-md bg-white/5 border border-white/10 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
              >
                <option value="">Selectionner</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {empLabel(emp)}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-300 text-sm">Type</Label>
                <select
                  value={itemForm.item_type}
                  onChange={(e) => setItemForm((f) => ({ ...f, item_type: e.target.value }))}
                  className="mt-1 w-full rounded-md bg-white/5 border border-white/10 text-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                >
                  {[
                    ['bonus', 'Prime'],
                    ['overtime', 'Heures sup.'],
                    ['advance', 'Acompte'],
                    ['deduction', 'Retenue'],
                    ['other', 'Autre'],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label className="text-gray-300 text-sm">Libelle</Label>
                <Input
                  value={itemForm.label}
                  onChange={(e) => setItemForm((f) => ({ ...f, label: e.target.value }))}
                  placeholder="ex. Prime objectif"
                  className="bg-white/5 border-white/10 text-gray-100 mt-1"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-300 text-sm">Montant *</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={itemForm.amount}
                  onChange={(e) => setItemForm((f) => ({ ...f, amount: e.target.value }))}
                  placeholder="0.00"
                  className="bg-white/5 border-white/10 text-gray-100 mt-1"
                />
              </div>
              <div>
                <Label className="text-gray-300 text-sm">Quantite</Label>
                <Input
                  type="number"
                  step="1"
                  value={itemForm.quantity}
                  onChange={(e) => setItemForm((f) => ({ ...f, quantity: e.target.value }))}
                  className="bg-white/5 border-white/10 text-gray-100 mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowAdd(false)}
              className="border-white/10 text-gray-300 hover:bg-white/5"
            >
              Annuler
            </Button>
            <Button
              onClick={doAdd}
              disabled={!itemForm.employee_id || !itemForm.amount}
              className="bg-orange-500 hover:bg-orange-600 text-white font-semibold"
            >
              Ajouter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ---- Tab 3 : Bulletins ---- */

const BulletinsTab = ({ selectedPeriod, employees, currency: _currency, onExport }) => {
  const [busy, setBusy] = useState(false);
  const doExport = async (fmt = 'csv') => {
    if (!selectedPeriod) return;
    setBusy(true);
    try {
      await onExport(selectedPeriod.id, fmt);
    } catch {
    } finally {
      setBusy(false);
    }
  };

  if (!selectedPeriod)
    return (
      <Card className="bg-white/5 border-white/10">
        <CardContent className="py-16 text-center">
          <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Selectionnez une periode dans l'onglet "Periodes".</p>
        </CardContent>
      </Card>
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">Bulletins de paie</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            {selectedPeriod.period_label || fmtMonth(selectedPeriod.period_start)} - {employees.length} employe
            {employees.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={() => doExport('csv')}
            disabled={busy}
            variant="outline"
            className="border-white/10 text-gray-300 hover:bg-white/5"
          >
            <Download className="w-4 h-4 mr-2" />
            CSV
          </Button>
          <Button
            onClick={() => doExport('pdf')}
            disabled={busy}
            className="bg-orange-500 hover:bg-orange-600 text-white font-semibold"
          >
            <Download className="w-4 h-4 mr-2" />
            {busy ? 'Export...' : 'PDF'}
          </Button>
        </div>
      </div>

      {employees.length === 0 ? (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="py-12 text-center">
            <p className="text-gray-500 text-sm">Aucun employe actif.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {employees.map((emp) => (
            <Card key={emp.id} className="bg-white/5 border-white/10 hover:bg-white/[0.07] transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-100 truncate">{empLabel(emp)}</p>
                    <p className="text-xs text-gray-500 mt-0.5">Embauche le {fmtDate(emp.hire_date)}</p>
                  </div>
                  <StatusBadge status={selectedPeriod.status} />
                </div>
                <div className="flex items-center gap-3 mt-4 pt-3 border-t border-white/5">
                  <FileText className="w-5 h-5 text-gray-500" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-400">Bulletin de paie</p>
                    <p className="text-xs text-gray-600 truncate">
                      bulletin_{empLabel(emp).replace(/\s+/g, '_').toLowerCase()}_{selectedPeriod.period_start}.pdf
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-orange-400 hover:text-orange-300"
                    title="Telecharger (bientot disponible)"
                  >
                    <Download className="w-4 h-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selectedPeriod.status !== 'validated' && selectedPeriod.status !== 'exported' && (
        <div className="flex items-start gap-3 rounded-xl bg-amber-500/10 border border-amber-500/20 p-4">
          <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-amber-300">Periode non validee</p>
            <p className="text-xs text-amber-400/70 mt-0.5">
              Les bulletins definitifs ne sont generes qu'apres validation de la periode.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

/* ---- Tab 4 : Historique (SVG bar chart) ---- */

const HistoriqueTab = ({ periods, employees, currency }) => {
  const chartData = useMemo(() => {
    const sorted = [...(periods || [])]
      .filter((p) => p.period_start)
      .sort((a, b) => new Date(a.period_start) - new Date(b.period_start))
      .slice(-12);
    const monthlyTotal = (employees || []).reduce((s, emp) => {
      const ct = emp.contracts?.find((c) => c.status === 'active') || emp.contracts?.[0];
      return s + Number(ct?.monthly_salary || 0);
    }, 0);
    return sorted.map((p) => ({ label: fmtMonth(p.period_start), value: monthlyTotal * 1.22, status: p.status }));
  }, [periods, employees]);

  const maxVal = Math.max(...chartData.map((d) => d.value), 1);
  const fillMap = Object.fromEntries(Object.entries(STATUS).map(([k, v]) => [k, v.chartFill]));

  if (chartData.length === 0)
    return (
      <Card className="bg-white/5 border-white/10">
        <CardContent className="py-16 text-center">
          <History className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-sm">Pas encore de donnees historiques.</p>
        </CardContent>
      </Card>
    );

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-100">Historique des couts de paie</h2>
        <p className="text-sm text-gray-400 mt-0.5">
          Cout total (brut + charges) - {chartData.length} derniere{chartData.length !== 1 ? 's' : ''} periode
          {chartData.length !== 1 ? 's' : ''}
        </p>
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-6">
          <div className="w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${Math.max(chartData.length * 80, 400)} 280`}
              className="w-full min-w-[400px]"
              style={{ maxHeight: '320px' }}
            >
              {[0, 0.25, 0.5, 0.75, 1].map((f) => {
                const y = 240 - f * 200;
                return (
                  <g key={f}>
                    <line
                      x1="60"
                      y1={y}
                      x2={chartData.length * 80 + 10}
                      y2={y}
                      stroke="rgba(255,255,255,0.06)"
                      strokeDasharray="4 4"
                    />
                    <text
                      x="55"
                      y={y + 4}
                      textAnchor="end"
                      fill="rgba(255,255,255,0.3)"
                      fontSize="10"
                      fontFamily="system-ui"
                    >
                      {fmtCur(maxVal * f, currency)}
                    </text>
                  </g>
                );
              })}
              <line x1="60" y1="240" x2={chartData.length * 80 + 10} y2="240" stroke="rgba(255,255,255,0.1)" />
              {chartData.map((item, i) => {
                const bh = (item.value / maxVal) * 200;
                const x = 70 + i * 80,
                  bw = 40,
                  y = 240 - bh;
                return (
                  <g key={i}>
                    <rect
                      x={x}
                      y={y}
                      width={bw}
                      height={Math.max(bh, 2)}
                      rx="4"
                      fill={fillMap[item.status] || fillMap.draft}
                    />
                    <text
                      x={x + bw / 2}
                      y={y - 6}
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.5)"
                      fontSize="9"
                      fontFamily="system-ui"
                    >
                      {fmtCur(item.value, currency)}
                    </text>
                    <text
                      x={x + bw / 2}
                      y="258"
                      textAnchor="middle"
                      fill="rgba(255,255,255,0.4)"
                      fontSize="10"
                      fontFamily="system-ui"
                    >
                      {item.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t border-white/5">
            <span className="text-xs text-gray-500 font-medium">Statut :</span>
            {Object.entries(STATUS).map(([k, c]) => (
              <span key={k} className="flex items-center gap-1.5 text-xs text-gray-400">
                <span className={`w-2.5 h-2.5 rounded-sm ${c.dot}`} />
                {c.label}
              </span>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-200">Recapitulatif par periode</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {['Periode', 'Statut', 'Cout estime'].map((h, i) => (
                    <th
                      key={h}
                      className={`py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide ${i === 2 ? 'text-right' : 'text-left'}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {chartData.map((item, i) => (
                  <tr key={i} className="hover:bg-white/[0.03]">
                    <td className="py-3 px-4 text-gray-200">{item.label}</td>
                    <td className="py-3 px-4">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="py-3 px-4 text-right text-gray-100 tabular-nums font-medium">
                      {fmtCur(item.value, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/* ---- Tab 5 : Connecteurs pays ---- */

const ConnecteursPaysTab = ({
  countryCode,
  connectors,
  loading,
  error,
  insights,
  onRefresh,
  onMarkConnected,
  onSetStatus,
  onSetComplianceStatus,
}) => {
  const [pendingConnectorId, setPendingConnectorId] = useState(null);

  const statusTone =
    insights.status === 'ready'
      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200'
      : insights.status === 'attention'
        ? 'bg-amber-500/10 border-amber-500/20 text-amber-200'
        : 'bg-red-500/10 border-red-500/20 text-red-200';

  const runConnectorAction = async (connectorId, action) => {
    setPendingConnectorId(connectorId);
    try {
      await action();
    } finally {
      setPendingConnectorId(null);
    }
  };

  if (loading && connectors.length === 0) {
    return (
      <Card className="bg-white/5 border-white/10">
        <CardContent className="py-16 text-center">
          <RefreshCw className="w-8 h-8 text-gray-600 mx-auto mb-4 animate-spin" />
          <p className="text-gray-400 text-sm">Chargement des connecteurs pays...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="hr-country-connectors-panel">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-100">Connecteurs pays</h2>
          <p className="text-sm text-gray-400 mt-0.5">
            Pays actif : <span className="text-gray-200 font-medium">{countryCode}</span> · {insights.totalCount}{' '}
            connecteur{insights.totalCount !== 1 ? 's' : ''}
          </p>
        </div>
        <Button onClick={onRefresh} variant="outline" className="border-white/10 text-gray-300 hover:bg-white/5">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Actualiser
        </Button>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-xl bg-red-500/10 border border-red-500/20 p-4">
          <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-red-300">Erreur de synchronisation</p>
            <p className="text-xs text-red-400/70 mt-0.5">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="py-4 px-5">
            <p className="text-xs uppercase tracking-wide text-gray-500">Couverture</p>
            <p className="text-xl font-bold mt-1 text-gray-100">{insights.coveragePct.toFixed(2)}%</p>
            <p className="text-xs text-gray-500 mt-1">
              {insights.connectedCount}/{insights.totalCount} connectes
            </p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="py-4 px-5">
            <p className="text-xs uppercase tracking-wide text-gray-500">Conformite</p>
            <p className="text-xl font-bold mt-1 text-gray-100">{insights.compliancePct.toFixed(2)}%</p>
            <p className="text-xs text-gray-500 mt-1">{insights.complianceRiskCount} risque(s)</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="py-4 px-5">
            <p className="text-xs uppercase tracking-wide text-gray-500">Paie</p>
            <p className="text-xl font-bold mt-1 text-gray-100">{insights.payrollConnectorCount}</p>
            <p className="text-xs text-gray-500 mt-1">Connecteurs moteur paie</p>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="py-4 px-5">
            <p className="text-xs uppercase tracking-wide text-gray-500">Conformite legale</p>
            <p className="text-xl font-bold mt-1 text-gray-100">{insights.complianceConnectorCount}</p>
            <p className="text-xs text-gray-500 mt-1">Connecteurs declaratifs</p>
          </CardContent>
        </Card>
      </div>

      <div className={`rounded-xl border p-4 ${statusTone}`}>
        <p className="text-sm font-semibold">
          Statut global:{' '}
          {insights.status === 'ready' ? 'Pret' : insights.status === 'attention' ? 'Attention' : 'Critique'}
        </p>
        {insights.recommendations.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs opacity-90">
            {insights.recommendations.map((recommendation) => (
              <li key={recommendation}>• {recommendation}</li>
            ))}
          </ul>
        )}
      </div>

      <Card className="bg-white/5 border-white/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-gray-200">Registre des connecteurs</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/10">
                  {['Connecteur', 'Categorie', 'Statut', 'Conformite', 'Exigences', 'Actions'].map((header, index) => (
                    <th
                      key={header}
                      className={`py-3 px-4 text-xs font-medium text-gray-500 uppercase tracking-wide ${index === 5 ? 'text-right' : 'text-left'}`}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {connectors.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-gray-500 text-sm">
                      Aucun connecteur pour ce pays.
                    </td>
                  </tr>
                ) : (
                  connectors.map((connector) => {
                    const isPending = pendingConnectorId === connector.id;
                    const statusClass =
                      CONNECTOR_STATUS_STYLE[connector.status] || CONNECTOR_STATUS_STYLE.not_connected;
                    const complianceClass =
                      CONNECTOR_COMPLIANCE_STYLE[connector.compliance_status] || CONNECTOR_COMPLIANCE_STYLE.unknown;
                    return (
                      <tr key={connector.id} className="hover:bg-white/[0.03]">
                        <td className="py-3 px-4">
                          <p className="text-sm font-medium text-gray-100">{connector.connector_name}</p>
                          <p className="text-xs text-gray-500">{connector.connector_code}</p>
                        </td>
                        <td className="py-3 px-4">
                          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                            {CONNECTOR_CATEGORY_LABEL[connector.provider_category] || connector.provider_category}
                          </Badge>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={connector.status}
                            onChange={(event) =>
                              runConnectorAction(connector.id, () => onSetStatus(connector.id, event.target.value))
                            }
                            disabled={isPending}
                            className={`rounded-md border px-2 py-1 text-xs bg-transparent ${statusClass}`}
                          >
                            {CONNECTOR_STATUS_OPTIONS.map(([value, label]) => (
                              <option key={value} value={value} className="bg-[#141c33] text-gray-100">
                                {label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <select
                            value={connector.compliance_status}
                            onChange={(event) =>
                              runConnectorAction(connector.id, () =>
                                onSetComplianceStatus(connector.id, event.target.value)
                              )
                            }
                            disabled={isPending}
                            className={`rounded-md border px-2 py-1 text-xs bg-transparent ${complianceClass}`}
                          >
                            {CONNECTOR_COMPLIANCE_OPTIONS.map(([value, label]) => (
                              <option key={value} value={value} className="bg-[#141c33] text-gray-100">
                                {label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex flex-wrap gap-1.5">
                            {(connector.requirements || []).map((requirement) => (
                              <Badge
                                key={requirement}
                                variant="outline"
                                className="border-white/10 text-gray-400 text-[11px]"
                              >
                                {requirement}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isPending}
                            className="border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10"
                            onClick={() => runConnectorAction(connector.id, () => onMarkConnected(connector.id))}
                          >
                            <Link2 className="w-3.5 h-3.5 mr-1.5" />
                            {isPending ? '...' : connector.status === 'connected' ? 'Resynchroniser' : 'Connecter'}
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

/* ---- Main Page ---- */

const PayrollPage = () => {
  const { company } = useCompany();
  const {
    loading,
    error,
    periods,
    variableItems,
    anomalies,
    employees,
    previewEmployeeChargesRate,
    fetchData,
    createPayrollPeriod,
    addVariableItem,
    removeVariableItem,
    resolveAnomaly,
    calculatePayroll,
    validatePayroll,
    exportPayroll,
  } = usePayroll();
  const {
    countryCode: connectorCountryCode,
    connectors: payrollCountryConnectors,
    loading: payrollCountryConnectorsLoading,
    error: payrollCountryConnectorsError,
    refresh: refreshPayrollCountryConnectors,
    markConnectorConnected,
    setConnectorStatus,
    setConnectorComplianceStatus,
  } = usePayrollCountryConnectors(company?.country);

  const currency = company?.currency || 'EUR';
  const [activeTab, setActiveTab] = useState('periodes');
  const [selectedPeriodId, setSelectedPeriodId] = useState(null);
  const selectedPeriod = useMemo(
    () => periods.find((p) => p.id === selectedPeriodId) || null,
    [periods, selectedPeriodId]
  );
  const payrollCountryConnectorInsights = useMemo(
    () => buildPayrollCountryConnectorInsights(payrollCountryConnectors),
    [payrollCountryConnectors]
  );

  const handleSelectPeriod = useCallback(
    (id) => {
      setSelectedPeriodId(id);
      if (activeTab === 'periodes') setActiveTab('calcul');
    },
    [activeTab]
  );

  const handleRefresh = useCallback(() => {
    fetchData();
    refreshPayrollCountryConnectors();
  }, [fetchData, refreshPayrollCountryConnectors]);

  return (
    <>
      <Helmet>
        <title>Paie | CashPilot</title>
      </Helmet>

      <div className="container mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-gradient">Paie</h1>
            <p className="text-gray-500 mt-1 text-sm">Gestion de la paie, calcul des bulletins et suivi historique</p>
          </div>
          <Button
            onClick={handleRefresh}
            disabled={loading}
            variant="outline"
            className="border-white/10 text-gray-300 hover:bg-white/5"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualiser
          </Button>
        </div>

        {error && (
          <div className="flex items-start gap-3 rounded-xl bg-red-500/10 border border-red-500/20 p-4 mb-6">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-300">Erreur de chargement</p>
              <p className="text-xs text-red-400/70 mt-0.5">{error}</p>
            </div>
          </div>
        )}

        {loading && !periods.length && (
          <Card className="bg-white/5 border-white/10 mb-6">
            <CardContent className="py-16 text-center">
              <RefreshCw className="w-8 h-8 text-gray-600 mx-auto mb-4 animate-spin" />
              <p className="text-gray-400 text-sm">Chargement des donnees de paie...</p>
            </CardContent>
          </Card>
        )}

        {(!loading || periods.length > 0) && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="bg-[#0f1528] border border-white/10 rounded-lg p-1 mb-6 w-full sm:w-auto">
              {[
                ['periodes', CalendarDays, 'Periodes'],
                ['calcul', Calculator, 'Calcul'],
                ['bulletins', FileText, 'Bulletins'],
                ['historique', History, 'Historique'],
                ['connecteurs-pays', Link2, 'Connecteurs pays'],
              ].map(([val, Icon, label]) => (
                <TabsTrigger
                  key={val}
                  value={val}
                  className="data-[state=active]:bg-orange-500/10 data-[state=active]:text-orange-400 text-gray-400"
                >
                  <Icon className="w-4 h-4 mr-2" />
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>

            <TabsContent value="periodes">
              <PeriodesTab
                periods={periods}
                selectedPeriodId={selectedPeriodId}
                onSelectPeriod={handleSelectPeriod}
                onCreatePeriod={createPayrollPeriod}
              />
            </TabsContent>
            <TabsContent value="calcul">
              <CalculTab
                selectedPeriod={selectedPeriod}
                employees={employees}
                variableItems={variableItems}
                anomalies={anomalies}
                currency={currency}
                previewEmployeeChargesRate={previewEmployeeChargesRate}
                onCalculate={calculatePayroll}
                onValidate={validatePayroll}
                onAddVariableItem={addVariableItem}
                onRemoveVariableItem={removeVariableItem}
                onResolveAnomaly={resolveAnomaly}
              />
            </TabsContent>
            <TabsContent value="bulletins">
              <BulletinsTab
                selectedPeriod={selectedPeriod}
                employees={employees}
                currency={currency}
                onExport={exportPayroll}
              />
            </TabsContent>
            <TabsContent value="historique">
              <HistoriqueTab periods={periods} employees={employees} currency={currency} />
            </TabsContent>
            <TabsContent value="connecteurs-pays">
              <ConnecteursPaysTab
                countryCode={connectorCountryCode}
                connectors={payrollCountryConnectors}
                loading={payrollCountryConnectorsLoading}
                error={payrollCountryConnectorsError}
                insights={payrollCountryConnectorInsights}
                onRefresh={refreshPayrollCountryConnectors}
                onMarkConnected={markConnectorConnected}
                onSetStatus={setConnectorStatus}
                onSetComplianceStatus={setConnectorComplianceStatus}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </>
  );
};

export default PayrollPage;
