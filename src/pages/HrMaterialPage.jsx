import React, { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { AlertTriangle, Briefcase, Building2, Receipt, Users } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useHrMaterial } from '@/hooks/useHrMaterial';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const formatCurrency = (value, currency = 'EUR') => new Intl.NumberFormat('fr-FR', {
  style: 'currency',
  currency,
}).format(Number(value || 0));

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('fr-FR');
};

const getOriginLabel = (origin) => (origin === 'external_supplier' ? 'Externe (fournisseur)' : 'Interne');

const defaultAllocationForm = {
  resource_type: 'human',
  resource_origin: 'internal',
  project_id: '',
  team_member_id: '',
  supplier_id: '',
  resource_name: '',
  planned_quantity: '0',
  planned_cost: '0',
};

const defaultAssignmentForm = {
  task_id: '',
  member_id: '',
};

const HrMaterialPage = () => {
  const { toast } = useToast();
  const {
    activeCompanyId,
    loading,
    members,
    suppliers,
    projects,
    tasks,
    allocations,
    compensations,
    accountingEntries,
    auditLogs,
    createAllocation,
    assignTaskMember,
  } = useHrMaterial();

  const [allocationForm, setAllocationForm] = useState(defaultAllocationForm);
  const [assignmentForm, setAssignmentForm] = useState(defaultAssignmentForm);

  const isCompanyScoped = Boolean(activeCompanyId);

  const kpis = useMemo(() => {
    const materialAllocations = allocations.filter((row) => row.resource_type === 'material');
    const internalAllocations = allocations.filter((row) => row.resource_origin !== 'external_supplier');
    const externalAllocations = allocations.filter((row) => row.resource_origin === 'external_supplier');
    const structuredTasks = tasks.filter((task) => task.assigned_member_id).length;
    const validatedRhCosts = compensations
      .filter((row) => ['approved', 'paid'].includes(row.payment_status))
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);

    return {
      membersCount: members.length,
      suppliersCount: suppliers.length,
      materialCount: materialAllocations.length,
      internalAllocations: internalAllocations.length,
      externalAllocations: externalAllocations.length,
      taskCoverage: tasks.length ? Math.round((structuredTasks / tasks.length) * 100) : 0,
      validatedRhCosts,
      accountingCount: accountingEntries.length,
      auditCount: auditLogs.length,
    };
  }, [accountingEntries.length, allocations, auditLogs.length, compensations, members.length, suppliers.length, tasks]);

  const taskOptions = useMemo(() => tasks.map((task) => ({
    id: task.id,
    title: task.title || task.name || task.id,
    projectName: task?.project?.name || 'Projet',
  })), [tasks]);

  const recentAllocations = useMemo(() => allocations.slice(0, 40), [allocations]);
  const supplierNameById = useMemo(() => new Map(
    suppliers.map((supplier) => [supplier.id, supplier.company_name || '-']),
  ), [suppliers]);

  const handleCreateAllocation = async (event) => {
    event.preventDefault();

    if (!isCompanyScoped) {
      toast({
        title: 'Société active requise',
        description: 'Sélectionnez d’abord une société du portfolio.',
        variant: 'destructive',
      });
      return;
    }

    if (!allocationForm.project_id) {
      toast({ title: 'Projet requis', description: 'Sélectionnez un projet.', variant: 'destructive' });
      return;
    }

    if (allocationForm.resource_origin === 'external_supplier' && !allocationForm.supplier_id) {
      toast({ title: 'Fournisseur requis', description: 'Sélectionnez un fournisseur externe.', variant: 'destructive' });
      return;
    }

    if (allocationForm.resource_type === 'human' && allocationForm.resource_origin === 'internal' && !allocationForm.team_member_id) {
      toast({ title: 'Collaborateur requis', description: 'Sélectionnez une ressource RH interne.', variant: 'destructive' });
      return;
    }

    if (
      (allocationForm.resource_type === 'material' || allocationForm.resource_origin === 'external_supplier')
      && !allocationForm.resource_name.trim()
    ) {
      toast({ title: 'Nom de ressource requis', description: 'Saisissez un libellé de ressource.', variant: 'destructive' });
      return;
    }

    try {
      await createAllocation(allocationForm);
      setAllocationForm(defaultAllocationForm);
      toast({ title: 'Allocation créée', description: 'Allocation projet enregistrée.' });
    } catch (error) {
      toast({ title: 'Erreur allocation', description: error.message, variant: 'destructive' });
    }
  };

  const handleAssignTask = async (event) => {
    event.preventDefault();

    if (!isCompanyScoped) {
      toast({
        title: 'Société active requise',
        description: 'Sélectionnez d’abord une société du portfolio.',
        variant: 'destructive',
      });
      return;
    }

    if (!assignmentForm.task_id || !assignmentForm.member_id) {
      toast({ title: 'Champs requis', description: 'Sélectionnez tâche + collaborateur.', variant: 'destructive' });
      return;
    }

    try {
      await assignTaskMember({ taskId: assignmentForm.task_id, memberId: assignmentForm.member_id });
      setAssignmentForm(defaultAssignmentForm);
      toast({ title: 'Affectation mise à jour', description: 'La tâche est liée à la ressource RH interne.' });
    } catch (error) {
      toast({ title: 'Erreur affectation', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <>
      <Helmet>
        <title>RH & Matériel - CashPilot</title>
      </Helmet>

      <div className="container mx-auto space-y-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gradient">RH & Matériel</h1>
          <p className="text-gray-400 mt-2">
            Distinction claire des ressources internes, des fournisseurs externes, des coûts projet et de la journalisation comptable.
          </p>
        </div>

        <Card className="bg-amber-950/20 border-amber-700/50">
          <CardContent className="pt-5 text-sm text-amber-100 space-y-2">
            <p className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <strong>RH interne</strong> = <code>team_members</code> de la société active.
            </p>
            <p><strong>Fournisseurs</strong> = externes à la société et gérés séparément dans le domaine achats/AP.</p>
            <p><strong>Projet</strong> = ressources internes <em>ou</em> ressources externes (origine obligatoire).</p>
            <p className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Société active: <code>{activeCompanyId || 'Aucune sélectionnée'}</code>
            </p>
          </CardContent>
        </Card>

        {!isCompanyScoped && (
          <Card className="bg-red-950/20 border-red-700/50">
            <CardContent className="pt-5 text-sm text-red-100">
              Sélectionnez une société du portfolio pour travailler dans un périmètre isolé (RH, fournisseurs, comptabilité, CRM, clients, finances).
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card className="bg-white/5 border-white/10">
            <CardContent className="pt-5">
              <p className="text-xs text-gray-400">Ressources RH internes</p>
              <p className="text-2xl font-bold">{kpis.membersCount}</p>
              <p className="text-xs text-gray-500">{kpis.suppliersCount} fournisseurs externes</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="pt-5">
              <p className="text-xs text-gray-400">Origine des allocations</p>
              <p className="text-2xl font-bold">{kpis.internalAllocations} / {kpis.externalAllocations}</p>
              <p className="text-xs text-gray-500">interne / externe</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="pt-5">
              <p className="text-xs text-gray-400">Tâches structurées</p>
              <p className="text-2xl font-bold">{kpis.taskCoverage}%</p>
              <p className="text-xs text-gray-500">{kpis.materialCount} allocations matériel</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="pt-5">
              <p className="text-xs text-gray-400">Comptabilité RH / projet</p>
              <p className="text-2xl font-bold">{kpis.accountingCount}</p>
              <p className="text-xs text-gray-500">{kpis.auditCount} logs • {formatCurrency(kpis.validatedRhCosts)}</p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="allocation" className="space-y-4">
          <TabsList className="bg-gray-900 border border-gray-800 p-1">
            <TabsTrigger value="allocation" className="data-[state=active]:text-orange-400"><Users className="w-4 h-4 mr-2" />Allocation</TabsTrigger>
            <TabsTrigger value="tasks" className="data-[state=active]:text-orange-400"><Briefcase className="w-4 h-4 mr-2" />Tâches</TabsTrigger>
            <TabsTrigger value="accounting" className="data-[state=active]:text-orange-400"><Receipt className="w-4 h-4 mr-2" />Compta</TabsTrigger>
          </TabsList>

          <TabsContent value="allocation" className="space-y-4">
            <Card className="bg-white/5 border-white/10">
              <CardHeader><CardTitle>Nouvelle allocation RH / Matériel</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleCreateAllocation} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label>Type</Label>
                    <Select
                      value={allocationForm.resource_type}
                      onValueChange={(value) => setAllocationForm((prev) => ({
                        ...prev,
                        resource_type: value,
                        team_member_id: value === 'human' ? prev.team_member_id : '',
                        resource_name: value === 'human' && prev.resource_origin === 'internal' ? '' : prev.resource_name,
                      }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="human">Humain</SelectItem>
                        <SelectItem value="material">Matériel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Origine</Label>
                    <Select
                      value={allocationForm.resource_origin}
                      onValueChange={(value) => setAllocationForm((prev) => ({
                        ...prev,
                        resource_origin: value,
                        team_member_id: value === 'internal' ? prev.team_member_id : '',
                        supplier_id: value === 'external_supplier' ? prev.supplier_id : '',
                      }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="internal">Interne (société)</SelectItem>
                        <SelectItem value="external_supplier">Externe (fournisseur)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Projet</Label>
                    <Select value={allocationForm.project_id} onValueChange={(value) => setAllocationForm((prev) => ({ ...prev, project_id: value }))}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>

                  {allocationForm.resource_origin === 'external_supplier' && (
                    <div>
                      <Label>Fournisseur externe</Label>
                      <Select value={allocationForm.supplier_id} onValueChange={(value) => setAllocationForm((prev) => ({ ...prev, supplier_id: value }))}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                        <SelectContent>{suppliers.map((supplier) => <SelectItem key={supplier.id} value={supplier.id}>{supplier.company_name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}

                  {allocationForm.resource_type === 'human' && allocationForm.resource_origin === 'internal' && (
                    <div>
                      <Label>Collaborateur interne</Label>
                      <Select value={allocationForm.team_member_id} onValueChange={(value) => setAllocationForm((prev) => ({ ...prev, team_member_id: value }))}>
                        <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                        <SelectContent>{members.map((member) => <SelectItem key={member.id} value={member.id}>{member.name || member.email}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}

                  {(allocationForm.resource_type === 'material' || allocationForm.resource_origin === 'external_supplier') && (
                    <div>
                      <Label>
                        {allocationForm.resource_type === 'human' ? 'Intervenant / service externe' : 'Matériel / ressource'}
                      </Label>
                      <Input value={allocationForm.resource_name} onChange={(e) => setAllocationForm((prev) => ({ ...prev, resource_name: e.target.value }))} />
                    </div>
                  )}

                  <div>
                    <Label>Quantité planifiée</Label>
                    <Input type="number" min="0" value={allocationForm.planned_quantity} onChange={(e) => setAllocationForm((prev) => ({ ...prev, planned_quantity: e.target.value }))} />
                  </div>
                  <div>
                    <Label>Coût planifié</Label>
                    <Input type="number" min="0" value={allocationForm.planned_cost} onChange={(e) => setAllocationForm((prev) => ({ ...prev, planned_cost: e.target.value }))} />
                  </div>
                  <div className="md:col-span-3">
                    <Button className="bg-orange-500 hover:bg-orange-600" type="submit" disabled={!isCompanyScoped || loading}>
                      Enregistrer l'allocation
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardHeader><CardTitle>Allocations récentes</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-left">
                        <th className="py-2">Date</th>
                        <th className="py-2">Projet</th>
                        <th className="py-2">Type</th>
                        <th className="py-2">Origine</th>
                        <th className="py-2">Ressource</th>
                        <th className="py-2">Fournisseur</th>
                        <th className="py-2">Coût planifié</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentAllocations.length === 0 && <tr><td className="py-3 text-gray-500" colSpan={7}>Aucune allocation enregistrée.</td></tr>}
                      {recentAllocations.map((row) => (
                        <tr key={row.id} className="border-b border-slate-800">
                          <td className="py-2 text-gray-300">{formatDate(row.created_at)}</td>
                          <td className="py-2 text-gray-300">{row?.project?.name || '-'}</td>
                          <td className="py-2 text-gray-300">{row.resource_type === 'material' ? 'Matériel' : 'Humain'}</td>
                          <td className="py-2 text-gray-300">{getOriginLabel(row.resource_origin)}</td>
                          <td className="py-2 text-gray-300">{row?.team_member?.name || row.resource_name || '-'}</td>
                          <td className="py-2 text-gray-300">{supplierNameById.get(row.supplier_id) || '-'}</td>
                          <td className="py-2 text-gray-300">{formatCurrency(row.planned_cost || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-4">
            <Card className="bg-white/5 border-white/10">
              <CardHeader><CardTitle>Affecter une tâche à une ressource RH interne</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleAssignTask} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <Label>Tâche</Label>
                    <Select value={assignmentForm.task_id} onValueChange={(value) => setAssignmentForm((prev) => ({ ...prev, task_id: value }))}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner une tâche" /></SelectTrigger>
                      <SelectContent>{taskOptions.map((task) => <SelectItem key={task.id} value={task.id}>{task.title} - {task.projectName}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Collaborateur</Label>
                    <Select value={assignmentForm.member_id} onValueChange={(value) => setAssignmentForm((prev) => ({ ...prev, member_id: value }))}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>{members.map((member) => <SelectItem key={member.id} value={member.id}>{member.name || member.email}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-3">
                    <Button className="bg-orange-500 hover:bg-orange-600" type="submit" disabled={!isCompanyScoped || loading}>
                      Affecter la tâche
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accounting" className="space-y-4">
            <Card className="bg-white/5 border-white/10">
              <CardHeader><CardTitle>Dernières écritures RH / projet</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-slate-700 text-left"><th className="py-2">Date</th><th className="py-2">Source</th><th className="py-2">Compte</th><th className="py-2">Débit</th><th className="py-2">Crédit</th></tr></thead>
                    <tbody>
                      {accountingEntries.length === 0 && <tr><td className="py-3 text-gray-500" colSpan={5}>Aucune écriture liée.</td></tr>}
                      {accountingEntries.slice(0, 60).map((entry) => (
                        <tr key={entry.id} className="border-b border-slate-800">
                          <td className="py-2 text-gray-300">{formatDate(entry.transaction_date)}</td>
                          <td className="py-2 text-gray-300">{entry.source_type}</td>
                          <td className="py-2 text-gray-300">{entry.account_code || '-'}</td>
                          <td className="py-2 text-gray-300">{formatCurrency(entry.debit || 0)}</td>
                          <td className="py-2 text-gray-300">{formatCurrency(entry.credit || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardHeader><CardTitle>Journal d'audit CRUD</CardTitle></CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-slate-700 text-left"><th className="py-2">Date</th><th className="py-2">Table source</th><th className="py-2">Action</th><th className="py-2">Société</th></tr></thead>
                    <tbody>
                      {auditLogs.length === 0 && <tr><td className="py-3 text-gray-500" colSpan={4}>Aucun log d'audit pour la société active.</td></tr>}
                      {auditLogs.slice(0, 80).map((event) => (
                        <tr key={event.id} className="border-b border-slate-800">
                          <td className="py-2 text-gray-300">{formatDate(event.created_at)}</td>
                          <td className="py-2 text-gray-300">{event.source_table || '-'}</td>
                          <td className="py-2 text-gray-300">{event?.details?.action || event.event_type || '-'}</td>
                          <td className="py-2 text-gray-300">{event?.details?.company_id || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {loading && <p className="text-sm text-gray-500">Chargement du module RH & Matériel...</p>}
      </div>
    </>
  );
};

export default HrMaterialPage;
