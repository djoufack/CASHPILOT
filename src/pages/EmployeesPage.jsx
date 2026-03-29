import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { Building2, ChevronRight, Loader2, Pencil, Plus, Search, Trash2, UserCircle, Users } from 'lucide-react';
import { useEmployees } from '@/hooks/useEmployees';
import { formatDate as formatDateLocale } from '@/utils/dateLocale';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import HrCrossNav from '@/components/hr/HrCrossNav';

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const fmtDate = (v) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '-' : formatDateLocale(d);
};

const STATUS_CLS = {
  active: 'bg-green-500/20 text-green-400 border-green-500/30',
  inactive: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  terminated: 'bg-red-500/20 text-red-400 border-red-500/30',
};

const Badge = ({ status }) => (
  <span
    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${STATUS_CLS[status] || STATUS_CLS.inactive}`}
  >
    {status || 'inconnu'}
  </span>
);

const Info = ({ label, children }) => (
  <div>
    <p className="text-xs text-gray-400">{label}</p>
    <p className="text-white">{children || '-'}</p>
  </div>
);

const Field = ({ label, children }) => (
  <div className="space-y-1.5">
    <Label className="text-gray-400">{label}</Label>
    {children}
  </div>
);

const inputCls = 'bg-white/5 border-white/10 text-white placeholder:text-gray-500';
const tabCls = 'data-[state=active]:bg-orange-500/20 data-[state=active]:text-orange-400';

const EMPTY = {
  employee_number: '',
  first_name: '',
  last_name: '',
  work_email: '',
  phone: '',
  job_title: '',
  status: 'active',
  hire_date: '',
  termination_date: '',
  department_id: '',
  cost_center_id: '',
  manager_employee_id: '',
};

/* ------------------------------------------------------------------ */
/*  Page                                                              */
/* ------------------------------------------------------------------ */

const EmployeesPage = () => {
  const { toast } = useToast();
  const { loading, employees, departments, createEmployee, updateEmployee, deleteEmployee } = useEmployees();

  const [activeTab, setActiveTab] = useState('list');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [deptFilter, setDeptFilter] = useState('all');
  const [selectedId, setSelectedId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  /* Derived data */
  const filtered = useMemo(() => {
    let list = employees;
    if (statusFilter !== 'all') list = list.filter((e) => e.status === statusFilter);
    if (deptFilter !== 'all') list = list.filter((e) => e.department_id === deptFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          (e.full_name || '').toLowerCase().includes(q) ||
          (e.employee_number || '').toLowerCase().includes(q) ||
          (e.job_title || '').toLowerCase().includes(q)
      );
    }
    return list;
  }, [employees, statusFilter, deptFilter, search]);

  const selected = useMemo(() => employees.find((e) => e.id === selectedId) || null, [employees, selectedId]);
  const selContracts = selected?.contracts ?? [];
  const selSkills = selected?.skills ?? [];

  const orgTree = useMemo(() => {
    const tree = {};
    const none = { id: '__none__', name: 'Sans departement' };
    for (const emp of employees) {
      const dept = emp.department || none;
      const key = dept.id || '__none__';
      if (!tree[key]) tree[key] = { dept, emps: [] };
      tree[key].emps.push(emp);
    }
    return Object.values(tree).sort((a, b) => a.dept.name.localeCompare(b.dept.name));
  }, [employees]);

  /* Actions */
  const openDetail = (emp) => {
    setSelectedId(emp.id);
    setActiveTab('detail');
  };

  const openEdit = (emp) => {
    setEditingId(emp.id);
    const f = {};
    for (const k of Object.keys(EMPTY)) f[k] = emp[k] || '';
    setForm(f);
    setActiveTab('form');
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...EMPTY });
    setActiveTab('form');
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cet employe ?')) return;
    try {
      await deleteEmployee(id);
      toast({ title: 'Employe supprime' });
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.first_name.trim() && !form.last_name.trim()) {
      toast({ title: 'Nom requis', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        ...form,
        department_id: form.department_id || null,
        cost_center_id: form.cost_center_id || null,
        termination_date: form.termination_date || null,
        manager_employee_id: form.manager_employee_id || null,
      };
      if (editingId) {
        await updateEmployee(editingId, payload);
        toast({ title: 'Employe mis a jour' });
      } else {
        await createEmployee(payload);
        toast({ title: 'Employe cree' });
      }
      setForm({ ...EMPTY });
      setEditingId(null);
      setActiveTab('list');
    } catch (err) {
      toast({ title: 'Erreur', description: err.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  /* ---------------------------------------------------------------- */
  /*  Render                                                          */
  /* ---------------------------------------------------------------- */

  return (
    <div className="min-h-screen bg-[#0a0e1a] p-4 md:p-8">
      <Helmet>
        <title>Employes | CashPilot</title>
      </Helmet>

      <HrCrossNav variant="drh" />

      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Employes</h1>
          <p className="text-sm text-gray-400">{employees.length} employe(s) enregistre(s)</p>
        </div>
        <Button onClick={openCreate} className="bg-orange-500 hover:bg-orange-600 text-white">
          <Plus className="mr-2 h-4 w-4" /> Nouvel employe
        </Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
        </div>
      )}

      {!loading && (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6 bg-white/5 border border-white/10">
            <TabsTrigger value="list" className={tabCls}>
              Liste
            </TabsTrigger>
            <TabsTrigger value="detail" className={tabCls} disabled={!selected}>
              Fiche employe
            </TabsTrigger>
            <TabsTrigger value="org" className={tabCls}>
              Organigramme
            </TabsTrigger>
            <TabsTrigger value="form" className={tabCls}>
              Formulaire
            </TabsTrigger>
          </TabsList>

          {/* ====== TAB: Liste ====== */}
          <TabsContent value="list">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Rechercher un employe..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className={`pl-10 ${inputCls}`}
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[160px] bg-white/5 border-white/10">
                  <SelectValue placeholder="Statut" />
                </SelectTrigger>
                <SelectContent>
                  {[
                    ['all', 'Tous les statuts'],
                    ['active', 'Actif'],
                    ['inactive', 'Inactif'],
                    ['terminated', 'Termine'],
                  ].map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={deptFilter} onValueChange={setDeptFilter}>
                <SelectTrigger className="w-[200px] bg-white/5 border-white/10">
                  <SelectValue placeholder="Departement" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les departements</SelectItem>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Card className="bg-white/5 border-white/10">
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left">
                        {['N', 'Nom complet', 'Poste', 'Departement', 'Statut', 'Date embauche'].map((h) => (
                          <th key={h} className="px-4 py-3 font-medium text-gray-400">
                            {h}
                          </th>
                        ))}
                        <th className="px-4 py-3 font-medium text-gray-400 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                            Aucun employe trouve.
                          </td>
                        </tr>
                      )}
                      {filtered.map((emp) => (
                        <tr
                          key={emp.id}
                          className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                          onClick={() => openDetail(emp)}
                        >
                          <td className="px-4 py-3 text-white font-mono">{emp.employee_number || '-'}</td>
                          <td className="px-4 py-3 text-white font-medium">{emp.full_name || '-'}</td>
                          <td className="px-4 py-3 text-gray-300">{emp.job_title || '-'}</td>
                          <td className="px-4 py-3 text-gray-300">{emp.department?.name || '-'}</td>
                          <td className="px-4 py-3">
                            <Badge status={emp.status} />
                          </td>
                          <td className="px-4 py-3 text-gray-300">{fmtDate(emp.hire_date)}</td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-400 hover:text-orange-400"
                                onClick={() => openEdit(emp)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-gray-400 hover:text-red-400"
                                onClick={() => handleDelete(emp.id)}
                              >
                                <Trash2 className="h-4 w-4" />
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
          </TabsContent>

          {/* ====== TAB: Fiche employe ====== */}
          <TabsContent value="detail">
            {!selected ? (
              <Card className="bg-white/5 border-white/10">
                <CardContent className="py-16 text-center text-gray-500">
                  Selectionnez un employe dans la liste pour voir sa fiche.
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Personal info */}
                <Card className="bg-white/5 border-white/10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <UserCircle className="h-5 w-5 text-orange-400" />
                      Informations personnelles
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="grid grid-cols-2 gap-4">
                    <Info label="Numero">{selected.employee_number}</Info>
                    <Info label="Nom complet">
                      <span className="font-medium">{selected.full_name}</span>
                    </Info>
                    <Info label="Prenom">{selected.first_name}</Info>
                    <Info label="Nom">{selected.last_name}</Info>
                    <Info label="Email pro">{selected.work_email}</Info>
                    <Info label="Telephone">{selected.phone}</Info>
                    <Info label="Poste">{selected.job_title}</Info>
                    <div>
                      <p className="text-xs text-gray-400">Statut</p>
                      <Badge status={selected.status} />
                    </div>
                    <Info label="Date embauche">{fmtDate(selected.hire_date)}</Info>
                    <Info label="Date fin">{fmtDate(selected.termination_date)}</Info>
                    {selected.manager && (
                      <Info label="Responsable">
                        <span className="text-gray-200">{selected.manager.full_name || '-'}</span>
                        {selected.manager.job_title && (
                          <span className="text-gray-500 ml-1 text-xs">({selected.manager.job_title})</span>
                        )}
                      </Info>
                    )}
                  </CardContent>
                </Card>

                {/* Department */}
                <Card className="bg-white/5 border-white/10">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Building2 className="h-5 w-5 text-orange-400" />
                      Departement
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selected.department ? (
                      <div className="space-y-3">
                        <Info label="Nom">
                          <span className="font-medium">{selected.department.name}</span>
                        </Info>
                        <Info label="Description">
                          <span className="text-gray-300">{selected.department.description || '-'}</span>
                        </Info>
                      </div>
                    ) : (
                      <p className="text-gray-500">Aucun departement assigne.</p>
                    )}
                  </CardContent>
                </Card>

                {/* Contracts */}
                <Card className="bg-white/5 border-white/10">
                  <CardHeader>
                    <CardTitle className="text-white">Contrats ({selContracts.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selContracts.length === 0 ? (
                      <p className="text-gray-500">Aucun contrat enregistre.</p>
                    ) : (
                      <div className="space-y-3">
                        {selContracts.map((c) => (
                          <div key={c.id} className="rounded-lg border border-white/10 bg-white/5 p-3">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium text-white uppercase">{c.contract_type || '-'}</span>
                              <Badge status={c.status} />
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-gray-400">Debut : </span>
                                <span className="text-gray-300">{fmtDate(c.start_date)}</span>
                              </div>
                              <div>
                                <span className="text-gray-400">Fin : </span>
                                <span className="text-gray-300">{fmtDate(c.end_date)}</span>
                              </div>
                              <div>
                                <span className="text-gray-400">Base : </span>
                                <span className="text-gray-300">{c.pay_basis || '-'}</span>
                              </div>
                              <div>
                                <span className="text-gray-400">Taux : </span>
                                <span className="text-gray-300">
                                  {c.pay_basis === 'hourly' ? `${c.hourly_rate} EUR/h` : `${c.monthly_salary} EUR/mois`}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Skills */}
                <Card className="bg-white/5 border-white/10">
                  <CardHeader>
                    <CardTitle className="text-white">Competences ({selSkills.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {selSkills.length === 0 ? (
                      <p className="text-gray-500">Aucune competence enregistree.</p>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {selSkills.map((s) => (
                          <div
                            key={s.id}
                            className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs"
                          >
                            <span className="text-white">{s.skill_name}</span>
                            {s.skill_level && <span className="text-gray-400">({s.skill_level})</span>}
                            {s.certified && <span className="text-orange-400 font-medium">Certifie</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Action buttons */}
                <div className="lg:col-span-2 flex gap-3">
                  <Button onClick={() => openEdit(selected)} className="bg-orange-500 hover:bg-orange-600 text-white">
                    <Pencil className="mr-2 h-4 w-4" /> Modifier
                  </Button>
                  <Button
                    variant="outline"
                    className="border-white/10 text-gray-300 hover:text-white"
                    onClick={() => setActiveTab('list')}
                  >
                    Retour a la liste
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ====== TAB: Organigramme ====== */}
          <TabsContent value="org">
            {orgTree.length === 0 ? (
              <Card className="bg-white/5 border-white/10">
                <CardContent className="py-16 text-center text-gray-500">Aucun employe enregistre.</CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {orgTree.map((node) => (
                  <Card key={node.dept.id} className="bg-white/5 border-white/10">
                    <CardHeader className="pb-2">
                      <CardTitle className="flex items-center gap-2 text-white text-base">
                        <Building2 className="h-4 w-4 text-orange-400" />
                        {node.dept.name}
                        <span className="text-xs text-gray-400 font-normal">({node.emps.length})</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-1">
                        {node.emps.map((emp) => (
                          <div
                            key={emp.id}
                            className="flex items-center gap-3 rounded-md px-3 py-2 hover:bg-white/5 cursor-pointer transition-colors"
                            onClick={() => openDetail(emp)}
                          >
                            <ChevronRight className="h-3 w-3 text-gray-600" />
                            <Users className="h-4 w-4 text-gray-400" />
                            <span className="text-white text-sm">{emp.full_name || '-'}</span>
                            <span className="text-gray-500 text-xs">{emp.job_title || ''}</span>
                            <span className="ml-auto">
                              <Badge status={emp.status} />
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* ====== TAB: Formulaire ====== */}
          <TabsContent value="form">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle className="text-white">{editingId ? 'Modifier un employe' : 'Nouvel employe'}</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="grid gap-5 sm:grid-cols-2">
                  <Field label="Numero employe">
                    <Input
                      value={form.employee_number}
                      onChange={(e) => set('employee_number', e.target.value)}
                      placeholder="EMP-001"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Prenom *">
                    <Input
                      value={form.first_name}
                      onChange={(e) => set('first_name', e.target.value)}
                      placeholder="Jean"
                      className={inputCls}
                      required
                    />
                  </Field>
                  <Field label="Nom *">
                    <Input
                      value={form.last_name}
                      onChange={(e) => set('last_name', e.target.value)}
                      placeholder="Dupont"
                      className={inputCls}
                      required
                    />
                  </Field>
                  <Field label="Email professionnel">
                    <Input
                      type="email"
                      value={form.work_email}
                      onChange={(e) => set('work_email', e.target.value)}
                      placeholder="jean.dupont@entreprise.fr"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Telephone">
                    <Input
                      value={form.phone}
                      onChange={(e) => set('phone', e.target.value)}
                      placeholder="+33 6 12 34 56 78"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Poste / Fonction">
                    <Input
                      value={form.job_title}
                      onChange={(e) => set('job_title', e.target.value)}
                      placeholder="Developpeur senior"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Departement">
                    <Select
                      value={form.department_id || 'none'}
                      onValueChange={(v) => set('department_id', v === 'none' ? '' : v)}
                    >
                      <SelectTrigger className="bg-white/5 border-white/10">
                        <SelectValue placeholder="Aucun" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
                        {departments.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Statut">
                    <Select value={form.status} onValueChange={(v) => set('status', v)}>
                      <SelectTrigger className="bg-white/5 border-white/10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Actif</SelectItem>
                        <SelectItem value="inactive">Inactif</SelectItem>
                        <SelectItem value="terminated">Termine</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Date d'embauche">
                    <Input
                      type="date"
                      value={form.hire_date}
                      onChange={(e) => set('hire_date', e.target.value)}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </Field>
                  <Field label="Date de fin">
                    <Input
                      type="date"
                      value={form.termination_date}
                      onChange={(e) => set('termination_date', e.target.value)}
                      className="bg-white/5 border-white/10 text-white"
                    />
                  </Field>
                  <Field label="Centre de cout (ID)">
                    <Input
                      value={form.cost_center_id}
                      onChange={(e) => set('cost_center_id', e.target.value)}
                      placeholder="UUID du centre de cout (optionnel)"
                      className={inputCls}
                    />
                  </Field>
                  <Field label="Responsable hierarchique">
                    <Select
                      value={form.manager_employee_id || 'none'}
                      onValueChange={(v) => set('manager_employee_id', v === 'none' ? '' : v)}
                    >
                      <SelectTrigger className="bg-white/5 border-white/10">
                        <SelectValue placeholder="Aucun" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucun</SelectItem>
                        {employees
                          .filter((e) => e.status === 'active' && e.id !== editingId)
                          .map((e) => (
                            <SelectItem key={e.id} value={e.id}>
                              {e.full_name || `${e.first_name || ''} ${e.last_name || ''}`.trim() || e.id}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <div className="sm:col-span-2 flex gap-3 pt-2">
                    <Button type="submit" disabled={saving} className="bg-orange-500 hover:bg-orange-600 text-white">
                      {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {editingId ? 'Enregistrer' : 'Creer'}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="border-white/10 text-gray-300 hover:text-white"
                      onClick={() => {
                        setForm({ ...EMPTY });
                        setEditingId(null);
                        setActiveTab('list');
                      }}
                    >
                      Annuler
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default EmployeesPage;
