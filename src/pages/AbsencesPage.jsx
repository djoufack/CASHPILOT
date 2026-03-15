import { useState, useMemo } from 'react';
import { Helmet } from 'react-helmet';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Clock,
  Filter,
  Loader2,
  PlusCircle,
  Send,
  Wallet,
} from 'lucide-react';
import { useAbsences } from '@/hooks/useAbsences';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';

/* ---------- helpers ---------- */
const formatDate = (v) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('fr-FR');
};
const empName = (e) => e?.full_name || `${e?.first_name || ''} ${e?.last_name || ''}`.trim() || '-';
const STATUS = {
  pending: {
    label: 'En attente',
    dot: 'bg-yellow-400',
    text: 'text-yellow-300',
    bg: 'bg-yellow-400/10 border-yellow-400/30',
  },
  approved: {
    label: 'Approuvé',
    dot: 'bg-green-400',
    text: 'text-green-300',
    bg: 'bg-green-400/10 border-green-400/30',
  },
  rejected: { label: 'Refusé', dot: 'bg-red-400', text: 'text-red-300', bg: 'bg-red-400/10 border-red-400/30' },
  cancelled: { label: 'Annulé', dot: 'bg-gray-400', text: 'text-gray-300', bg: 'bg-gray-400/10 border-gray-400/30' },
};
const LT_COLORS = [
  'bg-orange-400',
  'bg-blue-400',
  'bg-emerald-400',
  'bg-purple-400',
  'bg-pink-400',
  'bg-cyan-400',
  'bg-amber-400',
  'bg-indigo-400',
];
const daysIn = (y, m) => new Date(y, m + 1, 0).getDate();
const diffDays = (a, b) => Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000) + 1);

function StatusBadge({ status }) {
  const c = STATUS[status] || STATUS.pending;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${c.bg} ${c.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {c.label}
    </span>
  );
}

/* ============ TAB 1 - Demandes ============ */
function DemandesTab({
  leaveRequests,
  leaveTypes,
  employees,
  approveLeaveRequest,
  rejectLeaveRequest,
  cancelLeaveRequest,
}) {
  const [statusF, setStatusF] = useState('all');
  const [empF, setEmpF] = useState('all');
  const ltMap = useMemo(() => Object.fromEntries((leaveTypes || []).map((t) => [t.id, t])), [leaveTypes]);
  const rows = useMemo(() => {
    let l = leaveRequests || [];
    if (statusF !== 'all') l = l.filter((r) => r.status === statusF);
    if (empF !== 'all') l = l.filter((r) => r.employee_id === empF);
    return l;
  }, [leaveRequests, statusF, empF]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-gray-400" />
          <Select value={statusF} onValueChange={setStatusF}>
            <SelectTrigger className="w-[160px] bg-white/5 border-white/10 text-white">
              <SelectValue placeholder="Statut" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous les statuts</SelectItem>
              <SelectItem value="pending">En attente</SelectItem>
              <SelectItem value="approved">Approuvé</SelectItem>
              <SelectItem value="rejected">Refusé</SelectItem>
              <SelectItem value="cancelled">Annulé</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Select value={empF} onValueChange={setEmpF}>
          <SelectTrigger className="w-[200px] bg-white/5 border-white/10 text-white">
            <SelectValue placeholder="Employé" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les employés</SelectItem>
            {(employees || []).map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {empName(e)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-gray-400">
                <th className="px-4 py-3 font-medium">Employé</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Début</th>
                <th className="px-4 py-3 font-medium">Fin</th>
                <th className="px-4 py-3 font-medium text-center">Jours</th>
                <th className="px-4 py-3 font-medium">Statut</th>
                <th className="px-4 py-3 font-medium">Motif</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    Aucune demande trouvée
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-white/[0.03] transition-colors">
                    <td className="px-4 py-3 text-white font-medium">{empName(r.employee)}</td>
                    <td className="px-4 py-3 text-gray-300">{ltMap[r.leave_type_id]?.name || '-'}</td>
                    <td className="px-4 py-3 text-gray-300">{formatDate(r.start_date)}</td>
                    <td className="px-4 py-3 text-gray-300">{formatDate(r.end_date)}</td>
                    <td className="px-4 py-3 text-center text-white">{r.days_count || '-'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3 text-gray-400 max-w-[200px] truncate">{r.reason || '-'}</td>
                    <td className="px-4 py-3 text-right">
                      {r.status === 'pending' && (
                        <div className="flex gap-1 justify-end">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-green-400 hover:text-green-300 hover:bg-green-400/10 h-7 px-2 text-xs"
                            onClick={() => approveLeaveRequest(r.id)}
                          >
                            Approuver
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-400 hover:text-red-300 hover:bg-red-400/10 h-7 px-2 text-xs"
                            onClick={() => rejectLeaveRequest(r.id)}
                          >
                            Refuser
                          </Button>
                        </div>
                      )}
                      {r.status === 'approved' && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-gray-400 hover:text-gray-300 hover:bg-gray-400/10 h-7 px-2 text-xs"
                          onClick={() => cancelLeaveRequest(r.id)}
                        >
                          Annuler
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ============ TAB 2 - Calendrier ============ */
function CalendrierTab({ leaveRequests, leaveTypes, employees }) {
  const now = new Date();
  const [yr, setYr] = useState(now.getFullYear());
  const [mo, setMo] = useState(now.getMonth());
  const days = daysIn(yr, mo);
  const label = new Date(yr, mo).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const colorMap = useMemo(
    () => Object.fromEntries((leaveTypes || []).map((t, i) => [t.id, LT_COLORS[i % LT_COLORS.length]])),
    [leaveTypes]
  );

  const grid = useMemo(() => {
    const m = {};
    (employees || []).forEach((e) => {
      m[e.id] = {};
    });
    (leaveRequests || []).forEach((r) => {
      if (r.status !== 'approved' && r.status !== 'pending') return;
      if (!m[r.employee_id]) return;
      const s = new Date(r.start_date),
        e = new Date(r.end_date),
        c = new Date(s);
      while (c <= e) {
        if (c.getFullYear() === yr && c.getMonth() === mo)
          m[r.employee_id][c.getDate()] = { lt: r.leave_type_id, st: r.status };
        c.setDate(c.getDate() + 1);
      }
    });
    return m;
  }, [employees, leaveRequests, yr, mo]);

  const prev = () => {
    if (mo === 0) {
      setMo(11);
      setYr((y) => y - 1);
    } else setMo((m) => m - 1);
  };
  const next = () => {
    if (mo === 11) {
      setMo(0);
      setYr((y) => y + 1);
    } else setMo((m) => m + 1);
  };
  const dh = Array.from({ length: days }, (_, i) => i + 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={prev} className="text-gray-400 hover:text-white">
          <ChevronLeft className="h-4 w-4 mr-1" />
          Précédent
        </Button>
        <span className="text-white font-semibold capitalize">{label}</span>
        <Button variant="ghost" size="sm" onClick={next} className="text-gray-400 hover:text-white">
          Suivant
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
      <div className="flex flex-wrap gap-3 text-xs text-gray-400">
        {(leaveTypes || []).map((t, i) => (
          <span key={t.id} className="flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-sm ${LT_COLORS[i % LT_COLORS.length]}`} />
            {t.name}
          </span>
        ))}
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-white/20 border border-dashed border-white/30" />
          En attente
        </span>
      </div>
      <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur overflow-hidden overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-3 py-2 text-left text-gray-400 font-medium sticky left-0 bg-[#0f1528] z-10 min-w-[150px]">
                Employé
              </th>
              {dh.map((d) => {
                const we = [0, 6].includes(new Date(yr, mo, d).getDay());
                return (
                  <th
                    key={d}
                    className={`px-0 py-2 text-center font-medium min-w-[28px] ${we ? 'text-gray-600 bg-white/[0.02]' : 'text-gray-400'}`}
                  >
                    {d}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            {!(employees || []).length ? (
              <tr>
                <td colSpan={days + 1} className="px-4 py-8 text-center text-gray-500">
                  Aucun employé
                </td>
              </tr>
            ) : (
              (employees || []).map((emp) => (
                <tr key={emp.id} className="hover:bg-white/[0.02] transition-colors">
                  <td className="px-3 py-2 text-white font-medium sticky left-0 bg-[#0f1528] z-10 truncate max-w-[150px]">
                    {empName(emp)}
                  </td>
                  {dh.map((d) => {
                    const we = [0, 6].includes(new Date(yr, mo, d).getDay());
                    const cell = grid[emp.id]?.[d];
                    const col = cell ? colorMap[cell.lt] || 'bg-orange-400' : '';
                    return (
                      <td key={d} className={`px-0 py-1.5 text-center ${we ? 'bg-white/[0.02]' : ''}`}>
                        {cell && (
                          <span
                            className={`block mx-auto h-4 w-4 rounded-sm ${col} ${cell.st === 'pending' ? 'opacity-40 border border-dashed border-white/40' : ''}`}
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ============ TAB 3 - Soldes ============ */
function SoldesTab({ employees, leaveTypes, computeBalance }) {
  return (
    <div className="space-y-4">
      {!(employees || []).length ? (
        <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur px-4 py-8 text-center text-gray-500">
          Aucun employé actif
        </div>
      ) : (
        (employees || []).map((emp) => (
          <Card key={emp.id} className="bg-white/5 border-white/10 backdrop-blur">
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white">{empName(emp)}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {!(leaveTypes || []).length ? (
                  <p className="text-gray-500 text-sm">Aucun type de congé configuré</p>
                ) : (
                  (leaveTypes || []).map((lt) => {
                    const b = computeBalance?.[emp.id]?.[lt.id];
                    const ent = b?.entitled || 0,
                      used = b?.used || 0,
                      rem = b?.remaining ?? ent;
                    const pct = ent > 0 ? Math.min(100, Math.round((used / ent) * 100)) : 0;
                    const barColor = rem <= 2 && ent > 0 ? 'bg-red-400' : pct > 70 ? 'bg-orange-400' : 'bg-emerald-400';
                    return (
                      <div key={lt.id} className="space-y-1.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-300">{lt.name}</span>
                          <span className="text-white font-medium">
                            {rem}
                            <span className="text-gray-500 font-normal"> / {ent} j restants</span>
                          </span>
                        </div>
                        <div className="relative h-2 w-full overflow-hidden rounded-full bg-white/10">
                          <div
                            className={`h-full rounded-full transition-all ${barColor}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>{used} j utilisés</span>
                          <span>{ent} j accordés</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

/* ============ TAB 4 - Nouvelle demande ============ */
function NouvelleDemandeTab({ employees, leaveTypes, createLeaveRequest }) {
  const [form, setForm] = useState({ employee_id: '', leave_type_id: '', start_date: '', end_date: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);
  const computed = useMemo(
    () => (form.start_date && form.end_date ? diffDays(form.start_date, form.end_date) : 0),
    [form.start_date, form.end_date]
  );
  const canSubmit =
    form.employee_id && form.leave_type_id && form.start_date && form.end_date && computed > 0 && !submitting;
  const upd = (f) => (v) => setForm((p) => ({ ...p, [f]: v }));
  const updE = (f) => (e) => setForm((p) => ({ ...p, [f]: e.target.value }));

  const handleSubmit = async (ev) => {
    ev.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await createLeaveRequest({ ...form, days_count: computed });
      setForm({ employee_id: '', leave_type_id: '', start_date: '', end_date: '', reason: '' });
    } catch {
      /* hook handles toast */
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card className="bg-white/5 border-white/10 backdrop-blur max-w-2xl">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <PlusCircle className="h-5 w-5 text-orange-400" />
          Nouvelle demande de congé
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-1.5">
            <Label className="text-gray-300">Employé</Label>
            <Select value={form.employee_id} onValueChange={upd('employee_id')}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Sélectionner un employé" />
              </SelectTrigger>
              <SelectContent>
                {(employees || []).map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {empName(e)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-gray-300">Type de congé</Label>
            <Select value={form.leave_type_id} onValueChange={upd('leave_type_id')}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue placeholder="Sélectionner un type" />
              </SelectTrigger>
              <SelectContent>
                {(leaveTypes || []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-gray-300">Date de début</Label>
              <Input
                type="date"
                value={form.start_date}
                onChange={updE('start_date')}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-gray-300">Date de fin</Label>
              <Input
                type="date"
                value={form.end_date}
                onChange={updE('end_date')}
                min={form.start_date || undefined}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>
          </div>
          {computed > 0 && (
            <div className="rounded-lg bg-orange-400/10 border border-orange-400/20 px-4 py-2.5 text-sm text-orange-300 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Durée estimée :{' '}
              <span className="font-semibold text-orange-400">
                {computed} jour{computed > 1 ? 's' : ''}
              </span>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-gray-300">Motif (optionnel)</Label>
            <Textarea
              value={form.reason}
              onChange={updE('reason')}
              placeholder="Précisez le motif de votre demande..."
              rows={3}
              className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 resize-none"
            />
          </div>
          <Button type="submit" disabled={!canSubmit} className="bg-orange-500 hover:bg-orange-600 text-white gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Soumettre la
            demande
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/* ============ MAIN PAGE ============ */
export default function AbsencesPage() {
  const {
    leaveRequests,
    leaveTypes,
    employees,
    loading,
    computeBalance,
    createLeaveRequest,
    approveLeaveRequest,
    rejectLeaveRequest,
    cancelLeaveRequest,
  } = useAbsences();
  const [tab, setTab] = useState('demandes');

  const stats = useMemo(() => {
    const lr = leaveRequests || [];
    return {
      pending: lr.filter((r) => r.status === 'pending').length,
      approved: lr.filter((r) => r.status === 'approved').length,
      totalDays: lr.filter((r) => r.status === 'approved').reduce((s, r) => s + (r.days_count || 0), 0),
    };
  }, [leaveRequests]);

  return (
    <>
      <Helmet>
        <title>Absences & Congés | CashPilot</title>
      </Helmet>
      <div className="min-h-screen bg-gradient-to-b from-[#0a0e1a] via-[#0f1528] to-[#141c33] p-4 md:p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <CalendarDays className="h-7 w-7 text-orange-400" />
            Absences & Congés
          </h1>
          <p className="text-gray-400 mt-1 text-sm">
            Gérez les demandes de congé, consultez le calendrier et les soldes
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="bg-white/5 border-white/10 backdrop-blur">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-400/10">
                <Clock className="h-5 w-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">En attente</p>
                <p className="text-xl font-bold text-white">{stats.pending}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10 backdrop-blur">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-400/10">
                <ClipboardList className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Approuvées</p>
                <p className="text-xl font-bold text-white">{stats.approved}</p>
              </div>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10 backdrop-blur">
            <CardContent className="flex items-center gap-4 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-400/10">
                <Wallet className="h-5 w-5 text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-gray-400">Jours pris (année)</p>
                <p className="text-xl font-bold text-white">{stats.totalDays}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
            <span className="ml-3 text-gray-400">Chargement des données...</span>
          </div>
        ) : (
          <Tabs value={tab} onValueChange={setTab} className="space-y-4">
            <TabsList className="bg-white/5 border border-white/10 p-1">
              <TabsTrigger
                value="demandes"
                className="data-[state=active]:bg-orange-400/20 data-[state=active]:text-orange-400 text-gray-400"
              >
                <ClipboardList className="h-4 w-4 mr-2" />
                Demandes
              </TabsTrigger>
              <TabsTrigger
                value="calendrier"
                className="data-[state=active]:bg-orange-400/20 data-[state=active]:text-orange-400 text-gray-400"
              >
                <CalendarDays className="h-4 w-4 mr-2" />
                Calendrier
              </TabsTrigger>
              <TabsTrigger
                value="soldes"
                className="data-[state=active]:bg-orange-400/20 data-[state=active]:text-orange-400 text-gray-400"
              >
                <Wallet className="h-4 w-4 mr-2" />
                Soldes
              </TabsTrigger>
              <TabsTrigger
                value="nouvelle"
                className="data-[state=active]:bg-orange-400/20 data-[state=active]:text-orange-400 text-gray-400"
              >
                <PlusCircle className="h-4 w-4 mr-2" />
                Nouvelle demande
              </TabsTrigger>
            </TabsList>

            <TabsContent value="demandes">
              <DemandesTab
                leaveRequests={leaveRequests}
                leaveTypes={leaveTypes}
                employees={employees}
                approveLeaveRequest={approveLeaveRequest}
                rejectLeaveRequest={rejectLeaveRequest}
                cancelLeaveRequest={cancelLeaveRequest}
              />
            </TabsContent>

            <TabsContent value="calendrier">
              <CalendrierTab leaveRequests={leaveRequests} leaveTypes={leaveTypes} employees={employees} />
            </TabsContent>

            <TabsContent value="soldes">
              <SoldesTab employees={employees} leaveTypes={leaveTypes} computeBalance={computeBalance} />
            </TabsContent>

            <TabsContent value="nouvelle">
              <NouvelleDemandeTab
                employees={employees}
                leaveTypes={leaveTypes}
                createLeaveRequest={createLeaveRequest}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </>
  );
}
