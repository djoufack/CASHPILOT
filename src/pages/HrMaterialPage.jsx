import { useMemo, useState } from 'react';
import { Helmet } from 'react-helmet';
import { AlertTriangle, Banknote, Briefcase, Building2, Receipt, Users } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useHrMaterial } from '@/hooks/useHrMaterial';
import { useCompany } from '@/hooks/useCompany';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import HrCrossNav from '@/components/hr/HrCrossNav';

const formatCurrency = (value, currency = 'EUR') =>
  new Intl.NumberFormat('fr-FR', {
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
const getEmployeeLabel = (employee) =>
  employee?.full_name ||
  `${employee?.first_name || ''} ${employee?.last_name || ''}`.trim() ||
  employee?.work_email ||
  employee?.id ||
  '-';

const downloadTextAsFile = (text, filename, mimeType = 'text/plain;charset=utf-8') => {
  const blob = new Blob([text || ''], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};

const defaultAllocationForm = {
  resource_type: 'human',
  resource_origin: 'internal',
  project_id: '',
  team_member_id: '',
  supplier_id: '',
  supplier_service_id: '',
  supplier_product_id: '',
  resource_name: '',
  planned_quantity: '0',
  planned_cost: '0',
};

const defaultAssignmentForm = {
  task_id: '',
  member_id: '',
};

const defaultCompensationForm = {
  project_id: '',
  team_member_id: '',
  task_id: 'none',
  amount: '0',
  compensation_type: 'hourly',
  payment_status: 'planned',
  planned_payment_date: '',
  notes: '',
};

const defaultEmployeeForm = {
  employee_number: '',
  first_name: '',
  last_name: '',
  work_email: '',
  phone: '',
  job_title: '',
  status: 'active',
  hire_date: '',
};

const defaultContractForm = {
  employee_id: '',
  contract_type: 'cdi',
  status: 'active',
  start_date: '',
  end_date: '',
  pay_basis: 'hourly',
  hourly_rate: '0',
  monthly_salary: '0',
};

const defaultMaterialCategoryForm = {
  category_code: '',
  name: '',
  description: '',
};

const defaultMaterialAssetForm = {
  category_id: '',
  asset_code: '',
  asset_name: '',
  status: 'available',
  unit_usage_cost: '0',
  unit_of_measure: 'hour',
  acquisition_mode: 'purchase',
  supplier_id: '',
  contract_reference: '',
  contract_start_date: '',
  contract_end_date: '',
  purchase_date: '',
  purchase_cost: '0',
  rental_rate: '0',
  billing_cycle: 'monthly',
  notes: '',
};

const defaultPayrollPeriodForm = {
  period_start: '',
  period_end: '',
};

const HrMaterialPage = () => {
  const { toast } = useToast();
  const { company, companies = [] } = useCompany();
  const {
    activeCompanyId,
    loading,
    members,
    suppliers,
    projects,
    tasks,
    allocations,
    compensations,
    supplierServices,
    supplierProducts,
    accountingEntries,
    auditLogs,
    employees,
    employeeContracts,
    materialCategories,
    materialAssets,
    payrollPeriods,
    payrollVariableItems,
    payrollAnomalies,
    payrollExports,
    createAllocation,
    createSupplierFromPortfolioCompany,
    createCompensation,
    updateCompensationStatus,
    assignTaskMember,
    createEmployee,
    createEmployeeContract,
    createMaterialCategory,
    createMaterialAsset,
    createPayrollPeriod,
    calculatePayrollPeriod,
    exportPayrollCsv,
    syncEmployeeToTeamMember,
    syncAllEmployeesToTeamMembers,
  } = useHrMaterial();

  const [allocationForm, setAllocationForm] = useState(defaultAllocationForm);
  const [assignmentForm, setAssignmentForm] = useState(defaultAssignmentForm);
  const [compensationForm, setCompensationForm] = useState(defaultCompensationForm);
  const [employeeForm, setEmployeeForm] = useState(defaultEmployeeForm);
  const [contractForm, setContractForm] = useState(defaultContractForm);
  const [materialCategoryForm, setMaterialCategoryForm] = useState(defaultMaterialCategoryForm);
  const [materialAssetForm, setMaterialAssetForm] = useState(defaultMaterialAssetForm);
  const [payrollPeriodForm, setPayrollPeriodForm] = useState(defaultPayrollPeriodForm);

  const isCompanyScoped = Boolean(activeCompanyId);
  const normalizedActiveCompanyId = String(activeCompanyId || '')
    .trim()
    .toLowerCase();
  const activeCompany = useMemo(() => {
    if (!activeCompanyId) return company || null;
    if (
      String(company?.id || '')
        .trim()
        .toLowerCase() === normalizedActiveCompanyId
    )
      return company;
    return (
      companies.find(
        (entry) =>
          String(entry?.id || '')
            .trim()
            .toLowerCase() === normalizedActiveCompanyId
      ) ||
      company ||
      null
    );
  }, [activeCompanyId, companies, company, normalizedActiveCompanyId]);

  const activeCompanyName = activeCompany?.company_name || activeCompany?.name || '';

  const kpis = useMemo(() => {
    const materialAllocations = allocations.filter((row) => row.resource_type === 'material');
    const internalAllocations = allocations.filter((row) => row.resource_origin !== 'external_supplier');
    const externalAllocations = allocations.filter((row) => row.resource_origin === 'external_supplier');
    const structuredTasks = tasks.filter((task) => task.assigned_member_id).length;
    const validatedRhCosts = compensations
      .filter((row) => ['approved', 'paid'].includes(row.payment_status))
      .reduce((sum, row) => sum + Number(row.amount || 0), 0);

    return {
      employeesCount: employees.length,
      membersCount: members.length,
      suppliersCount: suppliers.length,
      materialAssetsCount: materialAssets.length,
      materialCount: materialAllocations.length,
      internalAllocations: internalAllocations.length,
      externalAllocations: externalAllocations.length,
      taskCoverage: tasks.length ? Math.round((structuredTasks / tasks.length) * 100) : 0,
      validatedRhCosts,
      accountingCount: accountingEntries.length,
      auditCount: auditLogs.length,
    };
  }, [
    accountingEntries.length,
    allocations,
    auditLogs.length,
    compensations,
    employees.length,
    materialAssets.length,
    members.length,
    suppliers.length,
    tasks,
  ]);

  const taskOptions = useMemo(
    () =>
      tasks.map((task) => ({
        id: task.id,
        title: task.title || task.name || task.id,
        projectName: task?.project?.name || 'Projet',
      })),
    [tasks]
  );

  const employeeOptions = useMemo(
    () =>
      employees.map((employee) => ({
        id: employee.id,
        name: getEmployeeLabel(employee),
      })),
    [employees]
  );

  const recentAllocations = useMemo(() => allocations.slice(0, 40), [allocations]);
  const recentCompensations = useMemo(() => compensations.slice(0, 80), [compensations]);
  const recentContracts = useMemo(() => employeeContracts.slice(0, 120), [employeeContracts]);
  const recentMaterialAssets = useMemo(() => materialAssets.slice(0, 120), [materialAssets]);
  const recentSupplierServices = useMemo(() => supplierServices.slice(0, 120), [supplierServices]);
  const recentSupplierProducts = useMemo(() => supplierProducts.slice(0, 120), [supplierProducts]);
  const supplierNameById = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier.company_name || supplier.name || '-'])),
    [suppliers]
  );
  const supplierByLinkedCompanyId = useMemo(
    () =>
      new Map(
        suppliers
          .filter((supplier) => supplier.linked_company_id)
          .map((supplier) => [supplier.linked_company_id, supplier])
      ),
    [suppliers]
  );
  const supplierServiceById = useMemo(
    () => new Map(supplierServices.map((service) => [service.id, service])),
    [supplierServices]
  );
  const supplierProductById = useMemo(
    () => new Map(supplierProducts.map((product) => [product.id, product])),
    [supplierProducts]
  );
  const employeeById = useMemo(() => new Map(employees.map((employee) => [employee.id, employee])), [employees]);
  const categoryById = useMemo(
    () => new Map(materialCategories.map((category) => [category.id, category])),
    [materialCategories]
  );
  const contractsCountByEmployee = useMemo(() => {
    const map = new Map();
    employeeContracts.forEach((contract) => {
      map.set(contract.employee_id, (map.get(contract.employee_id) || 0) + 1);
    });
    return map;
  }, [employeeContracts]);
  const teamMemberEmployeeIds = useMemo(
    () => new Set(members.map((member) => member.employee_id).filter(Boolean)),
    [members]
  );
  const intercompanyProviderOptions = useMemo(
    () =>
      companies.filter(
        (entry) =>
          String(entry?.id || '')
            .trim()
            .toLowerCase() !== normalizedActiveCompanyId
      ),
    [companies, normalizedActiveCompanyId]
  );
  const supplierServicesBySelectedSupplier = useMemo(
    () =>
      recentSupplierServices.filter(
        (service) => !allocationForm.supplier_id || service.supplier_id === allocationForm.supplier_id
      ),
    [allocationForm.supplier_id, recentSupplierServices]
  );
  const supplierProductsBySelectedSupplier = useMemo(
    () =>
      recentSupplierProducts.filter(
        (product) => !allocationForm.supplier_id || product.supplier_id === allocationForm.supplier_id
      ),
    [allocationForm.supplier_id, recentSupplierProducts]
  );

  const guardCompanyScope = () => {
    if (isCompanyScoped) return true;
    toast({
      title: 'Société active requise',
      description: 'Sélectionnez d’abord une société du portfolio.',
      variant: 'destructive',
    });
    return false;
  };

  const handleCreateIntercompanySupplier = async (providerCompany) => {
    if (!guardCompanyScope()) return;
    if (!providerCompany?.id) return;

    const providerCompanyName = providerCompany.company_name || providerCompany.name;
    if (!providerCompanyName) {
      toast({
        title: 'Société source invalide',
        description: 'Nom de société introuvable pour créer le fournisseur.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const result = await createSupplierFromPortfolioCompany({
        providerCompanyId: providerCompany.id,
        providerCompanyName,
      });

      if (result?.created) {
        toast({
          title: 'Fournisseur inter-sociétés créé',
          description: `${providerCompanyName} est maintenant un fournisseur de la société active.`,
        });
      } else {
        toast({
          title: 'Fournisseur déjà présent',
          description: `${providerCompanyName} existe déjà dans les fournisseurs de la société active.`,
        });
      }
    } catch (error) {
      toast({
        title: 'Erreur création fournisseur',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleCreateEmployee = async (event) => {
    event.preventDefault();
    if (!guardCompanyScope()) return;

    if (!employeeForm.first_name.trim() || !employeeForm.last_name.trim()) {
      toast({ title: 'Employé incomplet', description: 'Prénom et nom sont requis.', variant: 'destructive' });
      return;
    }

    try {
      await createEmployee(employeeForm);
      setEmployeeForm(defaultEmployeeForm);
      toast({ title: 'Employé RH créé', description: 'Ressource humaine interne enregistrée.' });
    } catch (error) {
      toast({ title: 'Erreur création employé', description: error.message, variant: 'destructive' });
    }
  };

  const handleCreateContract = async (event) => {
    event.preventDefault();
    if (!guardCompanyScope()) return;

    if (!contractForm.employee_id || !contractForm.start_date) {
      toast({
        title: 'Contrat incomplet',
        description: 'Employé et date de début sont requis.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createEmployeeContract(contractForm);
      setContractForm(defaultContractForm);
      toast({ title: 'Contrat RH créé', description: 'Contrat employé enregistré.' });
    } catch (error) {
      toast({ title: 'Erreur contrat RH', description: error.message, variant: 'destructive' });
    }
  };

  const handleCreateMaterialCategory = async (event) => {
    event.preventDefault();
    if (!guardCompanyScope()) return;

    if (!materialCategoryForm.name.trim()) {
      toast({ title: 'Catégorie requise', description: 'Saisissez un nom de catégorie.', variant: 'destructive' });
      return;
    }

    try {
      await createMaterialCategory(materialCategoryForm);
      setMaterialCategoryForm(defaultMaterialCategoryForm);
      toast({ title: 'Catégorie créée', description: 'Catégorie matériel enregistrée.' });
    } catch (error) {
      toast({ title: 'Erreur catégorie', description: error.message, variant: 'destructive' });
    }
  };

  const handleCreateMaterialAsset = async (event) => {
    event.preventDefault();
    if (!guardCompanyScope()) return;

    if (!materialAssetForm.asset_code.trim() || !materialAssetForm.asset_name.trim()) {
      toast({
        title: 'Matériel incomplet',
        description: 'Code et nom du matériel sont requis.',
        variant: 'destructive',
      });
      return;
    }

    if (materialAssetForm.acquisition_mode !== 'purchase' && !materialAssetForm.supplier_id) {
      toast({
        title: 'Fournisseur requis',
        description: 'Un fournisseur est requis pour location/service.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createMaterialAsset(materialAssetForm);
      setMaterialAssetForm(defaultMaterialAssetForm);
      toast({ title: 'Matériel créé', description: 'Ressource matérielle enregistrée.' });
    } catch (error) {
      toast({ title: 'Erreur création matériel', description: error.message, variant: 'destructive' });
    }
  };

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
      toast({
        title: 'Fournisseur requis',
        description: 'Sélectionnez un fournisseur externe.',
        variant: 'destructive',
      });
      return;
    }

    if (
      allocationForm.resource_origin === 'external_supplier' &&
      allocationForm.resource_type === 'human' &&
      !allocationForm.supplier_service_id
    ) {
      toast({
        title: 'Service fournisseur requis',
        description: 'Sélectionnez un service externe du fournisseur.',
        variant: 'destructive',
      });
      return;
    }

    if (
      allocationForm.resource_origin === 'external_supplier' &&
      allocationForm.resource_type === 'material' &&
      !allocationForm.supplier_product_id
    ) {
      toast({
        title: 'Produit fournisseur requis',
        description: 'Sélectionnez un produit externe du fournisseur.',
        variant: 'destructive',
      });
      return;
    }

    if (
      allocationForm.resource_type === 'human' &&
      allocationForm.resource_origin === 'internal' &&
      !allocationForm.team_member_id
    ) {
      toast({
        title: 'Collaborateur requis',
        description: 'Sélectionnez une ressource RH interne.',
        variant: 'destructive',
      });
      return;
    }

    if (
      (allocationForm.resource_type === 'material' || allocationForm.resource_origin === 'external_supplier') &&
      !allocationForm.resource_name.trim()
    ) {
      const selectedService = allocationForm.supplier_service_id
        ? supplierServiceById.get(allocationForm.supplier_service_id)
        : null;
      const selectedProduct = allocationForm.supplier_product_id
        ? supplierProductById.get(allocationForm.supplier_product_id)
        : null;

      if (!selectedService?.service_name && !selectedProduct?.product_name) {
        toast({
          title: 'Nom de ressource requis',
          description: 'Saisissez un libellé de ressource.',
          variant: 'destructive',
        });
        return;
      }
    }

    try {
      const selectedService = allocationForm.supplier_service_id
        ? supplierServiceById.get(allocationForm.supplier_service_id)
        : null;
      const selectedProduct = allocationForm.supplier_product_id
        ? supplierProductById.get(allocationForm.supplier_product_id)
        : null;

      const plannedQuantity = Number(allocationForm.planned_quantity || 0);
      const serviceUnitRate = selectedService
        ? Number(selectedService.pricing_type === 'fixed' ? selectedService.fixed_price : selectedService.hourly_rate)
        : 0;
      const productUnitRate = selectedProduct ? Number(selectedProduct.unit_price || 0) : 0;

      let derivedPlannedCost = Number(allocationForm.planned_cost || 0);
      if (derivedPlannedCost <= 0) {
        if (selectedService) {
          derivedPlannedCost =
            selectedService.pricing_type === 'fixed' ? serviceUnitRate : serviceUnitRate * plannedQuantity;
        } else if (selectedProduct) {
          derivedPlannedCost = productUnitRate * plannedQuantity;
        }
      }

      const payload = {
        ...allocationForm,
        resource_name:
          allocationForm.resource_name.trim() || selectedService?.service_name || selectedProduct?.product_name || '',
        planned_cost: String(Number.isFinite(derivedPlannedCost) ? Math.max(0, derivedPlannedCost) : 0),
      };

      await createAllocation(payload);
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

  const handleCreateCompensation = async (event) => {
    event.preventDefault();

    if (!isCompanyScoped) {
      toast({
        title: 'Société active requise',
        description: 'Sélectionnez d’abord une société du portfolio.',
        variant: 'destructive',
      });
      return;
    }

    if (!compensationForm.project_id || !compensationForm.team_member_id) {
      toast({
        title: 'Champs requis',
        description: 'Sélectionnez un projet et un collaborateur.',
        variant: 'destructive',
      });
      return;
    }

    if (Number(compensationForm.amount) <= 0) {
      toast({
        title: 'Montant invalide',
        description: 'Le montant de la paie doit être supérieur à 0.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createCompensation({
        ...compensationForm,
        task_id: compensationForm.task_id === 'none' ? null : compensationForm.task_id,
      });
      setCompensationForm(defaultCompensationForm);
      toast({ title: 'Paie projet enregistrée', description: 'La compensation projet est enregistrée.' });
    } catch (error) {
      toast({ title: 'Erreur paie projet', description: error.message, variant: 'destructive' });
    }
  };

  const handleUpdateCompensationStatus = async (compensationId, nextStatus) => {
    try {
      await updateCompensationStatus(compensationId, nextStatus);
      toast({ title: 'Statut mis à jour', description: `Paie passée en statut "${nextStatus}".` });
    } catch (error) {
      toast({ title: 'Erreur statut paie', description: error.message, variant: 'destructive' });
    }
  };

  const handleCreatePayrollPeriod = async (event) => {
    event.preventDefault();
    if (!guardCompanyScope()) return;

    if (!payrollPeriodForm.period_start || !payrollPeriodForm.period_end) {
      toast({ title: 'Période incomplète', description: 'Date de début et de fin requises.', variant: 'destructive' });
      return;
    }

    if (payrollPeriodForm.period_end < payrollPeriodForm.period_start) {
      toast({
        title: 'Période invalide',
        description: 'La date de fin doit être >= date de début.',
        variant: 'destructive',
      });
      return;
    }

    try {
      await createPayrollPeriod(payrollPeriodForm);
      setPayrollPeriodForm(defaultPayrollPeriodForm);
      toast({ title: 'Période paie créée', description: 'La période RH est enregistrée.' });
    } catch (error) {
      toast({ title: 'Erreur période paie', description: error.message, variant: 'destructive' });
    }
  };

  const handleCalculatePayroll = async (periodId, incremental = false) => {
    try {
      const result = await calculatePayrollPeriod(periodId, incremental);
      toast({
        title: incremental ? 'Recalcul incrémental terminé' : 'Calcul paie terminé',
        description: `Variables: ${result?.inserted_items || 0}, anomalies: ${result?.anomalies || 0}`,
      });
    } catch (error) {
      toast({ title: 'Erreur calcul paie', description: error.message, variant: 'destructive' });
    }
  };

  const handleExportPayrollCsv = async (periodId) => {
    try {
      const csv = await exportPayrollCsv(periodId);
      const filename = `paie-rh-${periodId}-${new Date().toISOString().slice(0, 10)}.csv`;
      downloadTextAsFile(csv, filename, 'text/csv;charset=utf-8');
      toast({ title: 'Export paie généré', description: 'Le CSV RH a été généré et téléchargé.' });
    } catch (error) {
      toast({ title: 'Erreur export paie', description: error.message, variant: 'destructive' });
    }
  };

  const handleSyncEmployee = async (employeeId) => {
    try {
      await syncEmployeeToTeamMember(employeeId);
      toast({ title: 'Synchronisation équipe OK', description: 'Employé RH lié à team_members.' });
    } catch (error) {
      toast({ title: 'Erreur synchronisation', description: error.message, variant: 'destructive' });
    }
  };

  const handleSyncAllEmployees = async () => {
    try {
      await syncAllEmployeesToTeamMembers();
      toast({ title: 'Synchronisation globale OK', description: 'Tous les employés RH sont synchronisés.' });
    } catch (error) {
      toast({ title: 'Erreur synchronisation globale', description: error.message, variant: 'destructive' });
    }
  };

  return (
    <>
      <Helmet>
        <title>RH & Matériel - CashPilot</title>
      </Helmet>

      <div className="container mx-auto space-y-6">
        <HrCrossNav variant="resources" />
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-gradient">Ressources Projets</h1>
          <p className="text-gray-400 mt-2">
            Distinction claire des ressources internes, des fournisseurs externes, des coûts projet et de la
            journalisation comptable.
          </p>
        </div>

        <Card className="bg-amber-950/20 border-amber-700/50">
          <CardContent className="pt-5 text-sm text-amber-100 space-y-2">
            <p className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <strong>Ressources internes</strong> = <code>hr_employees</code> / <code>material_assets</code> de la
              société active.
            </p>
            <p>
              <strong>Inter-sociétés</strong> = jamais en direct: l’autre société est traitée comme{' '}
              <strong>fournisseur</strong> (service/produit).
            </p>
            <p>
              <strong>Projet</strong> = ressources internes <em>ou</em> ressources externes (origine obligatoire).
            </p>
            <p>
              <strong>Stockage</strong> = allocations dans <code>project_resource_allocations</code>, paie projet dans{' '}
              <code>team_member_compensations</code>, paie RH dans <code>hr_payroll_*</code>.
            </p>
            <p className="flex items-center gap-2">
              <Building2 className="w-4 h-4" />
              Société active:{' '}
              <code>{activeCompanyName || (activeCompanyId ? 'Chargement...' : 'Aucune sélectionnée')}</code>
            </p>
          </CardContent>
        </Card>

        {!isCompanyScoped && (
          <Card className="bg-red-950/20 border-red-700/50">
            <CardContent className="pt-5 text-sm text-red-100">
              Sélectionnez une société du portfolio pour travailler dans un périmètre isolé (RH, fournisseurs,
              comptabilité, CRM, clients, finances).
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card className="bg-white/5 border-white/10">
            <CardContent className="pt-5">
              <p className="text-xs text-gray-400">Ressources RH internes</p>
              <p className="text-2xl font-bold">{kpis.employeesCount}</p>
              <p className="text-xs text-gray-500">{kpis.membersCount} synchronisées dans team_members</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="pt-5">
              <p className="text-xs text-gray-400">Matériel société</p>
              <p className="text-2xl font-bold">{kpis.materialAssetsCount}</p>
              <p className="text-xs text-gray-500">{kpis.suppliersCount} fournisseurs externes</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="pt-5">
              <p className="text-xs text-gray-400">Origine des allocations</p>
              <p className="text-2xl font-bold">
                {kpis.internalAllocations} / {kpis.externalAllocations}
              </p>
              <p className="text-xs text-gray-500">interne / externe</p>
            </CardContent>
          </Card>
          <Card className="bg-white/5 border-white/10">
            <CardContent className="pt-5">
              <p className="text-xs text-gray-400">Comptabilité RH / projet</p>
              <p className="text-2xl font-bold">{kpis.accountingCount}</p>
              <p className="text-xs text-gray-500">
                {kpis.auditCount} logs • {formatCurrency(kpis.validatedRhCosts)}
              </p>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="resources" className="space-y-4">
          <TabsList className="bg-gray-900 border border-gray-800 p-1">
            <TabsTrigger value="resources" className="data-[state=active]:text-orange-400">
              <Users className="w-4 h-4 mr-2" />
              Ressources
            </TabsTrigger>
            <TabsTrigger value="allocation" className="data-[state=active]:text-orange-400">
              <Users className="w-4 h-4 mr-2" />
              Allocation
            </TabsTrigger>
            <TabsTrigger value="tasks" className="data-[state=active]:text-orange-400">
              <Briefcase className="w-4 h-4 mr-2" />
              Tâches
            </TabsTrigger>
            <TabsTrigger value="payroll" className="data-[state=active]:text-orange-400">
              <Banknote className="w-4 h-4 mr-2" />
              Paie
            </TabsTrigger>
            <TabsTrigger value="accounting" className="data-[state=active]:text-orange-400">
              <Receipt className="w-4 h-4 mr-2" />
              Compta
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resources" className="space-y-4">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle>Inter-sociétés: sociétés du portfolio à traiter comme fournisseurs</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-gray-300">
                  Toute ressource fournie par une autre société doit passer par le flux fournisseurs (catalogue
                  services/produits, achats/AP, journalisation comptable).
                </p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-left">
                        <th className="py-2">Société source</th>
                        <th className="py-2">Statut fournisseur</th>
                        <th className="py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {intercompanyProviderOptions.length === 0 && (
                        <tr>
                          <td className="py-3 text-gray-500" colSpan={3}>
                            Aucune autre société dans le portfolio.
                          </td>
                        </tr>
                      )}
                      {intercompanyProviderOptions.map((entry) => {
                        const linkedSupplier = supplierByLinkedCompanyId.get(entry.id);
                        const entryName = entry.company_name || entry.name || entry.id;
                        return (
                          <tr key={entry.id} className="border-b border-slate-800">
                            <td className="py-2 text-gray-300">{entryName}</td>
                            <td className="py-2 text-gray-300">
                              {linkedSupplier
                                ? `Déjà fournisseur (${linkedSupplier.company_name || linkedSupplier.name || linkedSupplier.id})`
                                : 'Non créé'}
                            </td>
                            <td className="py-2 text-gray-300">
                              {!linkedSupplier ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleCreateIntercompanySupplier(entry)}
                                >
                                  Créer fournisseur
                                </Button>
                              ) : (
                                <span className="text-xs text-green-400">OK</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div>
                  <Button asChild variant="outline" size="sm">
                    <a href="/app/suppliers">Ouvrir le module Fournisseurs</a>
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle>Créer une ressource RH interne</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateEmployee} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <Label>Matricule</Label>
                    <Input
                      value={employeeForm.employee_number}
                      onChange={(e) => setEmployeeForm((prev) => ({ ...prev, employee_number: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Prénom</Label>
                    <Input
                      value={employeeForm.first_name}
                      onChange={(e) => setEmployeeForm((prev) => ({ ...prev, first_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Nom</Label>
                    <Input
                      value={employeeForm.last_name}
                      onChange={(e) => setEmployeeForm((prev) => ({ ...prev, last_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Email pro</Label>
                    <Input
                      type="email"
                      value={employeeForm.work_email}
                      onChange={(e) => setEmployeeForm((prev) => ({ ...prev, work_email: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Téléphone</Label>
                    <Input
                      value={employeeForm.phone}
                      onChange={(e) => setEmployeeForm((prev) => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Poste</Label>
                    <Input
                      value={employeeForm.job_title}
                      onChange={(e) => setEmployeeForm((prev) => ({ ...prev, job_title: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Statut RH</Label>
                    <Select
                      value={employeeForm.status}
                      onValueChange={(value) => setEmployeeForm((prev) => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Actif</SelectItem>
                        <SelectItem value="on_leave">En absence</SelectItem>
                        <SelectItem value="inactive">Inactif</SelectItem>
                        <SelectItem value="terminated">Terminé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Date embauche</Label>
                    <Input
                      type="date"
                      value={employeeForm.hire_date}
                      onChange={(e) => setEmployeeForm((prev) => ({ ...prev, hire_date: e.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-4">
                    <Button
                      className="bg-orange-500 hover:bg-orange-600"
                      type="submit"
                      disabled={!isCompanyScoped || loading}
                    >
                      Créer employé RH
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle>Créer un contrat RH</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateContract} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <Label>Employé</Label>
                    <Select
                      value={contractForm.employee_id}
                      onValueChange={(value) => setContractForm((prev) => ({ ...prev, employee_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {employeeOptions.map((employee) => (
                          <SelectItem key={employee.id} value={employee.id}>
                            {employee.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Type contrat</Label>
                    <Select
                      value={contractForm.contract_type}
                      onValueChange={(value) => setContractForm((prev) => ({ ...prev, contract_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cdi">CDI</SelectItem>
                        <SelectItem value="cdd">CDD</SelectItem>
                        <SelectItem value="freelance">Freelance</SelectItem>
                        <SelectItem value="consultant">Consultant</SelectItem>
                        <SelectItem value="interim">Intérim</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Statut contrat</Label>
                    <Select
                      value={contractForm.status}
                      onValueChange={(value) => setContractForm((prev) => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Brouillon</SelectItem>
                        <SelectItem value="signed">Signé</SelectItem>
                        <SelectItem value="active">Actif</SelectItem>
                        <SelectItem value="suspended">Suspendu</SelectItem>
                        <SelectItem value="ended">Terminé</SelectItem>
                        <SelectItem value="cancelled">Annulé</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Base de paie</Label>
                    <Select
                      value={contractForm.pay_basis}
                      onValueChange={(value) => setContractForm((prev) => ({ ...prev, pay_basis: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Horaire</SelectItem>
                        <SelectItem value="daily">Journalier</SelectItem>
                        <SelectItem value="monthly">Mensuel</SelectItem>
                        <SelectItem value="fixed">Forfait</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Début</Label>
                    <Input
                      type="date"
                      value={contractForm.start_date}
                      onChange={(e) => setContractForm((prev) => ({ ...prev, start_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Fin</Label>
                    <Input
                      type="date"
                      value={contractForm.end_date}
                      onChange={(e) => setContractForm((prev) => ({ ...prev, end_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Taux horaire</Label>
                    <Input
                      type="number"
                      min="0"
                      value={contractForm.hourly_rate}
                      onChange={(e) => setContractForm((prev) => ({ ...prev, hourly_rate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Salaire mensuel</Label>
                    <Input
                      type="number"
                      min="0"
                      value={contractForm.monthly_salary}
                      onChange={(e) => setContractForm((prev) => ({ ...prev, monthly_salary: e.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-4">
                    <Button
                      className="bg-orange-500 hover:bg-orange-600"
                      type="submit"
                      disabled={!isCompanyScoped || loading}
                    >
                      Créer contrat RH
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle>Créer une catégorie et un matériel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={handleCreateMaterialCategory} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <Label>Code catégorie</Label>
                    <Input
                      value={materialCategoryForm.category_code}
                      onChange={(e) => setMaterialCategoryForm((prev) => ({ ...prev, category_code: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Nom catégorie</Label>
                    <Input
                      value={materialCategoryForm.name}
                      onChange={(e) => setMaterialCategoryForm((prev) => ({ ...prev, name: e.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Description</Label>
                    <Input
                      value={materialCategoryForm.description}
                      onChange={(e) => setMaterialCategoryForm((prev) => ({ ...prev, description: e.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-4">
                    <Button type="submit" variant="outline" disabled={!isCompanyScoped || loading}>
                      Créer catégorie
                    </Button>
                  </div>
                </form>

                <form onSubmit={handleCreateMaterialAsset} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <Label>Catégorie</Label>
                    <Select
                      value={materialAssetForm.category_id}
                      onValueChange={(value) => setMaterialAssetForm((prev) => ({ ...prev, category_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {materialCategories.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Code matériel</Label>
                    <Input
                      value={materialAssetForm.asset_code}
                      onChange={(e) => setMaterialAssetForm((prev) => ({ ...prev, asset_code: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Nom matériel</Label>
                    <Input
                      value={materialAssetForm.asset_name}
                      onChange={(e) => setMaterialAssetForm((prev) => ({ ...prev, asset_name: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Statut</Label>
                    <Select
                      value={materialAssetForm.status}
                      onValueChange={(value) => setMaterialAssetForm((prev) => ({ ...prev, status: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="available">Disponible</SelectItem>
                        <SelectItem value="in_use">En service</SelectItem>
                        <SelectItem value="maintenance">Maintenance</SelectItem>
                        <SelectItem value="out_of_service">Hors service</SelectItem>
                        <SelectItem value="retired">Retiré</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Coût unitaire d'usage</Label>
                    <Input
                      type="number"
                      min="0"
                      value={materialAssetForm.unit_usage_cost}
                      onChange={(e) => setMaterialAssetForm((prev) => ({ ...prev, unit_usage_cost: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Unité</Label>
                    <Input
                      value={materialAssetForm.unit_of_measure}
                      onChange={(e) => setMaterialAssetForm((prev) => ({ ...prev, unit_of_measure: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Acquisition</Label>
                    <Select
                      value={materialAssetForm.acquisition_mode}
                      onValueChange={(value) => setMaterialAssetForm((prev) => ({ ...prev, acquisition_mode: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="purchase">Achat</SelectItem>
                        <SelectItem value="rental">Location</SelectItem>
                        <SelectItem value="service">Produit via fournisseur</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Fournisseur</Label>
                    <Select
                      value={materialAssetForm.supplier_id}
                      onValueChange={(value) => setMaterialAssetForm((prev) => ({ ...prev, supplier_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.id}>
                            {supplier.company_name || supplier.name || supplier.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Réf. contrat</Label>
                    <Input
                      value={materialAssetForm.contract_reference}
                      onChange={(e) =>
                        setMaterialAssetForm((prev) => ({ ...prev, contract_reference: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Début contrat</Label>
                    <Input
                      type="date"
                      value={materialAssetForm.contract_start_date}
                      onChange={(e) =>
                        setMaterialAssetForm((prev) => ({ ...prev, contract_start_date: e.target.value }))
                      }
                    />
                  </div>
                  <div>
                    <Label>Fin contrat</Label>
                    <Input
                      type="date"
                      value={materialAssetForm.contract_end_date}
                      onChange={(e) => setMaterialAssetForm((prev) => ({ ...prev, contract_end_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Date achat</Label>
                    <Input
                      type="date"
                      value={materialAssetForm.purchase_date}
                      onChange={(e) => setMaterialAssetForm((prev) => ({ ...prev, purchase_date: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Coût achat</Label>
                    <Input
                      type="number"
                      min="0"
                      value={materialAssetForm.purchase_cost}
                      onChange={(e) => setMaterialAssetForm((prev) => ({ ...prev, purchase_cost: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Tarif location</Label>
                    <Input
                      type="number"
                      min="0"
                      value={materialAssetForm.rental_rate}
                      onChange={(e) => setMaterialAssetForm((prev) => ({ ...prev, rental_rate: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Périodicité</Label>
                    <Select
                      value={materialAssetForm.billing_cycle}
                      onValueChange={(value) => setMaterialAssetForm((prev) => ({ ...prev, billing_cycle: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Horaire</SelectItem>
                        <SelectItem value="daily">Journalier</SelectItem>
                        <SelectItem value="weekly">Hebdo</SelectItem>
                        <SelectItem value="monthly">Mensuel</SelectItem>
                        <SelectItem value="yearly">Annuel</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-4">
                    <Label>Notes</Label>
                    <Input
                      value={materialAssetForm.notes}
                      onChange={(e) => setMaterialAssetForm((prev) => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-4">
                    <Button
                      className="bg-orange-500 hover:bg-orange-600"
                      type="submit"
                      disabled={!isCompanyScoped || loading}
                    >
                      Créer ressource matérielle
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle>Ressources RH créées</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mb-3">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSyncAllEmployees}
                    disabled={!isCompanyScoped || loading || employees.length === 0}
                  >
                    Synchroniser tous les employés vers team_members
                  </Button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-left">
                        <th className="py-2">Employé</th>
                        <th className="py-2">Statut</th>
                        <th className="py-2">Poste</th>
                        <th className="py-2">Contrats</th>
                        <th className="py-2">Sync équipe</th>
                        <th className="py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {employees.length === 0 && (
                        <tr>
                          <td className="py-3 text-gray-500" colSpan={6}>
                            Aucune ressource RH interne.
                          </td>
                        </tr>
                      )}
                      {employees.map((employee) => (
                        <tr key={employee.id} className="border-b border-slate-800">
                          <td className="py-2 text-gray-300">{getEmployeeLabel(employee)}</td>
                          <td className="py-2 text-gray-300">{employee.status || '-'}</td>
                          <td className="py-2 text-gray-300">{employee.job_title || '-'}</td>
                          <td className="py-2 text-gray-300">{contractsCountByEmployee.get(employee.id) || 0}</td>
                          <td className="py-2 text-gray-300">
                            {teamMemberEmployeeIds.has(employee.id) ? 'Oui' : 'Non'}
                          </td>
                          <td className="py-2 text-gray-300">
                            {!teamMemberEmployeeIds.has(employee.id) && (
                              <Button size="sm" variant="outline" onClick={() => handleSyncEmployee(employee.id)}>
                                Synchroniser
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle>Ressources matérielles créées</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-left">
                        <th className="py-2">Code</th>
                        <th className="py-2">Matériel</th>
                        <th className="py-2">Catégorie</th>
                        <th className="py-2">Statut</th>
                        <th className="py-2">Acquisition</th>
                        <th className="py-2">Fournisseur</th>
                        <th className="py-2">Coût usage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentMaterialAssets.length === 0 && (
                        <tr>
                          <td className="py-3 text-gray-500" colSpan={7}>
                            Aucune ressource matérielle.
                          </td>
                        </tr>
                      )}
                      {recentMaterialAssets.map((asset) => (
                        <tr key={asset.id} className="border-b border-slate-800">
                          <td className="py-2 text-gray-300">{asset.asset_code || '-'}</td>
                          <td className="py-2 text-gray-300">{asset.asset_name || '-'}</td>
                          <td className="py-2 text-gray-300">{categoryById.get(asset.category_id)?.name || '-'}</td>
                          <td className="py-2 text-gray-300">{asset.status || '-'}</td>
                          <td className="py-2 text-gray-300">{asset.acquisition_mode || '-'}</td>
                          <td className="py-2 text-gray-300">{supplierNameById.get(asset.supplier_id) || '-'}</td>
                          <td className="py-2 text-gray-300">{formatCurrency(asset.unit_usage_cost || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle>Services externes disponibles (catalogue fournisseurs)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-left">
                        <th className="py-2">Fournisseur</th>
                        <th className="py-2">Service</th>
                        <th className="py-2">Tarification</th>
                        <th className="py-2">Prix</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentSupplierServices.length === 0 && (
                        <tr>
                          <td className="py-3 text-gray-500" colSpan={4}>
                            Aucun service fournisseur pour cette société.
                          </td>
                        </tr>
                      )}
                      {recentSupplierServices.map((service) => (
                        <tr key={service.id} className="border-b border-slate-800">
                          <td className="py-2 text-gray-300">{supplierNameById.get(service.supplier_id) || '-'}</td>
                          <td className="py-2 text-gray-300">{service.service_name || '-'}</td>
                          <td className="py-2 text-gray-300">{service.pricing_type || '-'}</td>
                          <td className="py-2 text-gray-300">
                            {service.pricing_type === 'fixed'
                              ? formatCurrency(service.fixed_price || 0)
                              : `${formatCurrency(service.hourly_rate || 0)} / h`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle>Produits externes disponibles (catalogue fournisseurs)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-left">
                        <th className="py-2">Fournisseur</th>
                        <th className="py-2">Produit</th>
                        <th className="py-2">SKU</th>
                        <th className="py-2">Prix unitaire</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentSupplierProducts.length === 0 && (
                        <tr>
                          <td className="py-3 text-gray-500" colSpan={4}>
                            Aucun produit fournisseur pour cette société.
                          </td>
                        </tr>
                      )}
                      {recentSupplierProducts.map((product) => (
                        <tr key={product.id} className="border-b border-slate-800">
                          <td className="py-2 text-gray-300">{supplierNameById.get(product.supplier_id) || '-'}</td>
                          <td className="py-2 text-gray-300">{product.product_name || '-'}</td>
                          <td className="py-2 text-gray-300">{product.sku || '-'}</td>
                          <td className="py-2 text-gray-300">{formatCurrency(product.unit_price || 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle>Contrats RH récents</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-left">
                        <th className="py-2">Employé</th>
                        <th className="py-2">Type</th>
                        <th className="py-2">Statut</th>
                        <th className="py-2">Début</th>
                        <th className="py-2">Fin</th>
                        <th className="py-2">Base</th>
                        <th className="py-2">Taux / Salaire</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentContracts.length === 0 && (
                        <tr>
                          <td className="py-3 text-gray-500" colSpan={7}>
                            Aucun contrat RH.
                          </td>
                        </tr>
                      )}
                      {recentContracts.map((contract) => (
                        <tr key={contract.id} className="border-b border-slate-800">
                          <td className="py-2 text-gray-300">
                            {getEmployeeLabel(employeeById.get(contract.employee_id))}
                          </td>
                          <td className="py-2 text-gray-300">{contract.contract_type || '-'}</td>
                          <td className="py-2 text-gray-300">{contract.status || '-'}</td>
                          <td className="py-2 text-gray-300">{formatDate(contract.start_date)}</td>
                          <td className="py-2 text-gray-300">{formatDate(contract.end_date)}</td>
                          <td className="py-2 text-gray-300">{contract.pay_basis || '-'}</td>
                          <td className="py-2 text-gray-300">
                            {contract.pay_basis === 'monthly'
                              ? formatCurrency(contract.monthly_salary || 0)
                              : formatCurrency(contract.hourly_rate || 0)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="allocation" className="space-y-4">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle>Nouvelle allocation RH / Matériel</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateAllocation} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label>Type</Label>
                    <Select
                      value={allocationForm.resource_type}
                      onValueChange={(value) =>
                        setAllocationForm((prev) => ({
                          ...prev,
                          resource_type: value,
                          team_member_id: value === 'human' ? prev.team_member_id : '',
                          supplier_service_id: value === 'human' ? prev.supplier_service_id : '',
                          supplier_product_id: value === 'material' ? prev.supplier_product_id : '',
                          resource_name:
                            value === 'human' && prev.resource_origin === 'internal' ? '' : prev.resource_name,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
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
                      onValueChange={(value) =>
                        setAllocationForm((prev) => ({
                          ...prev,
                          resource_origin: value,
                          team_member_id: value === 'internal' ? prev.team_member_id : '',
                          supplier_id: value === 'external_supplier' ? prev.supplier_id : '',
                          supplier_service_id: value === 'external_supplier' ? prev.supplier_service_id : '',
                          supplier_product_id: value === 'external_supplier' ? prev.supplier_product_id : '',
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="internal">Interne (société)</SelectItem>
                        <SelectItem value="external_supplier">Externe (fournisseur)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Projet</Label>
                    <Select
                      value={allocationForm.project_id}
                      onValueChange={(value) => setAllocationForm((prev) => ({ ...prev, project_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {allocationForm.resource_origin === 'external_supplier' && (
                    <div>
                      <Label>Fournisseur externe</Label>
                      <Select
                        value={allocationForm.supplier_id}
                        onValueChange={(value) =>
                          setAllocationForm((prev) => ({
                            ...prev,
                            supplier_id: value,
                            supplier_service_id: '',
                            supplier_product_id: '',
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                        <SelectContent>
                          {suppliers.map((supplier) => (
                            <SelectItem key={supplier.id} value={supplier.id}>
                              {supplier.company_name || supplier.name || supplier.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {allocationForm.resource_origin === 'external_supplier' &&
                    allocationForm.resource_type === 'human' && (
                      <div>
                        <Label>Service fournisseur</Label>
                        <Select
                          value={allocationForm.supplier_service_id}
                          onValueChange={(value) => {
                            const selectedService = supplierServiceById.get(value);
                            const unitRate = Number(
                              selectedService?.pricing_type === 'fixed'
                                ? selectedService?.fixed_price
                                : selectedService?.hourly_rate
                            );
                            const quantity = Number(allocationForm.planned_quantity || 0);
                            const autoCost = selectedService?.pricing_type === 'fixed' ? unitRate : unitRate * quantity;

                            setAllocationForm((prev) => ({
                              ...prev,
                              supplier_service_id: value,
                              supplier_product_id: '',
                              resource_name: selectedService?.service_name || prev.resource_name,
                              planned_cost:
                                Number(prev.planned_cost || 0) > 0
                                  ? prev.planned_cost
                                  : String(Number.isFinite(autoCost) ? Math.max(0, autoCost) : 0),
                            }));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un service" />
                          </SelectTrigger>
                          <SelectContent>
                            {supplierServicesBySelectedSupplier.map((service) => (
                              <SelectItem key={service.id} value={service.id}>
                                {service.service_name} •{' '}
                                {service.pricing_type === 'fixed'
                                  ? formatCurrency(service.fixed_price || 0)
                                  : `${formatCurrency(service.hourly_rate || 0)} / h`}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                  {allocationForm.resource_origin === 'external_supplier' &&
                    allocationForm.resource_type === 'material' && (
                      <div>
                        <Label>Produit fournisseur</Label>
                        <Select
                          value={allocationForm.supplier_product_id}
                          onValueChange={(value) => {
                            const selectedProduct = supplierProductById.get(value);
                            const unitRate = Number(selectedProduct?.unit_price || 0);
                            const quantity = Number(allocationForm.planned_quantity || 0);
                            const autoCost = unitRate * quantity;

                            setAllocationForm((prev) => ({
                              ...prev,
                              supplier_product_id: value,
                              supplier_service_id: '',
                              resource_name: selectedProduct?.product_name || prev.resource_name,
                              planned_cost:
                                Number(prev.planned_cost || 0) > 0
                                  ? prev.planned_cost
                                  : String(Number.isFinite(autoCost) ? Math.max(0, autoCost) : 0),
                            }));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner un produit" />
                          </SelectTrigger>
                          <SelectContent>
                            {supplierProductsBySelectedSupplier.map((product) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.product_name} • {formatCurrency(product.unit_price || 0)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                  {allocationForm.resource_type === 'human' && allocationForm.resource_origin === 'internal' && (
                    <div>
                      <Label>Collaborateur interne</Label>
                      <Select
                        value={allocationForm.team_member_id}
                        onValueChange={(value) => setAllocationForm((prev) => ({ ...prev, team_member_id: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Sélectionner" />
                        </SelectTrigger>
                        <SelectContent>
                          {members.map((member) => (
                            <SelectItem key={member.id} value={member.id}>
                              {member.name || member.email}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {(allocationForm.resource_type === 'material' ||
                    allocationForm.resource_origin === 'external_supplier') && (
                    <div>
                      <Label>
                        {allocationForm.resource_type === 'human'
                          ? 'Intervenant / service externe'
                          : 'Matériel / ressource'}
                      </Label>
                      <Input
                        value={allocationForm.resource_name}
                        onChange={(e) => setAllocationForm((prev) => ({ ...prev, resource_name: e.target.value }))}
                      />
                    </div>
                  )}

                  <div>
                    <Label>Quantité planifiée</Label>
                    <Input
                      type="number"
                      min="0"
                      value={allocationForm.planned_quantity}
                      onChange={(e) => setAllocationForm((prev) => ({ ...prev, planned_quantity: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Coût planifié</Label>
                    <Input
                      type="number"
                      min="0"
                      value={allocationForm.planned_cost}
                      onChange={(e) => setAllocationForm((prev) => ({ ...prev, planned_cost: e.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Button
                      className="bg-orange-500 hover:bg-orange-600"
                      type="submit"
                      disabled={!isCompanyScoped || loading}
                    >
                      Enregistrer l'allocation
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle>Allocations récentes</CardTitle>
              </CardHeader>
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
                        <th className="py-2">Service/Produit</th>
                        <th className="py-2">Coût planifié</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentAllocations.length === 0 && (
                        <tr>
                          <td className="py-3 text-gray-500" colSpan={8}>
                            Aucune allocation enregistrée.
                          </td>
                        </tr>
                      )}
                      {recentAllocations.map((row) => (
                        <tr key={row.id} className="border-b border-slate-800">
                          <td className="py-2 text-gray-300">{formatDate(row.created_at)}</td>
                          <td className="py-2 text-gray-300">{row?.project?.name || '-'}</td>
                          <td className="py-2 text-gray-300">
                            {row.resource_type === 'material' ? 'Matériel' : 'Humain'}
                          </td>
                          <td className="py-2 text-gray-300">{getOriginLabel(row.resource_origin)}</td>
                          <td className="py-2 text-gray-300">{row?.team_member?.name || row.resource_name || '-'}</td>
                          <td className="py-2 text-gray-300">{supplierNameById.get(row.supplier_id) || '-'}</td>
                          <td className="py-2 text-gray-300">
                            {row?.supplier_service?.service_name || row?.supplier_product?.product_name || '-'}
                          </td>
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
              <CardHeader>
                <CardTitle>Affecter une tâche à une ressource RH interne</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleAssignTask} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2">
                    <Label>Tâche</Label>
                    <Select
                      value={assignmentForm.task_id}
                      onValueChange={(value) => setAssignmentForm((prev) => ({ ...prev, task_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner une tâche" />
                      </SelectTrigger>
                      <SelectContent>
                        {taskOptions.map((task) => (
                          <SelectItem key={task.id} value={task.id}>
                            {task.title} - {task.projectName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Collaborateur</Label>
                    <Select
                      value={assignmentForm.member_id}
                      onValueChange={(value) => setAssignmentForm((prev) => ({ ...prev, member_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {members.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.name || member.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-3">
                    <Button
                      className="bg-orange-500 hover:bg-orange-600"
                      type="submit"
                      disabled={!isCompanyScoped || loading}
                    >
                      Affecter la tâche
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payroll" className="space-y-4">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle>Paie RH préparatoire (hr_payroll_*)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <form onSubmit={handleCreatePayrollPeriod} className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <Label>Début période</Label>
                    <Input
                      type="date"
                      value={payrollPeriodForm.period_start}
                      onChange={(e) => setPayrollPeriodForm((prev) => ({ ...prev, period_start: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Fin période</Label>
                    <Input
                      type="date"
                      value={payrollPeriodForm.period_end}
                      onChange={(e) => setPayrollPeriodForm((prev) => ({ ...prev, period_end: e.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>&nbsp;</Label>
                    <div>
                      <Button
                        className="bg-orange-500 hover:bg-orange-600"
                        type="submit"
                        disabled={!isCompanyScoped || loading}
                      >
                        Créer période paie
                      </Button>
                    </div>
                  </div>
                </form>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-left">
                        <th className="py-2">Période</th>
                        <th className="py-2">Statut</th>
                        <th className="py-2">Version</th>
                        <th className="py-2">Calculée</th>
                        <th className="py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payrollPeriods.length === 0 && (
                        <tr>
                          <td className="py-3 text-gray-500" colSpan={5}>
                            Aucune période de paie RH.
                          </td>
                        </tr>
                      )}
                      {payrollPeriods.map((period) => (
                        <tr key={period.id} className="border-b border-slate-800">
                          <td className="py-2 text-gray-300">
                            {formatDate(period.period_start)} - {formatDate(period.period_end)}
                          </td>
                          <td className="py-2 text-gray-300">{period.status || '-'}</td>
                          <td className="py-2 text-gray-300">{period.calculation_version || 1}</td>
                          <td className="py-2 text-gray-300">{formatDate(period.calculated_at)}</td>
                          <td className="py-2 text-gray-300">
                            <div className="flex gap-2 flex-wrap">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCalculatePayroll(period.id, false)}
                              >
                                Calcul complet
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleCalculatePayroll(period.id, true)}
                              >
                                Recalcul
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleExportPayrollCsv(period.id)}>
                                Exporter CSV
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <p className="text-xs text-gray-400">
                  Variables calculées: {payrollVariableItems.length} • anomalies: {payrollAnomalies.length} • exports:{' '}
                  {payrollExports.length}
                </p>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle>Nouvelle paie projet (team_member_compensations)</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleCreateCompensation} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label>Projet</Label>
                    <Select
                      value={compensationForm.project_id}
                      onValueChange={(value) => setCompensationForm((prev) => ({ ...prev, project_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {projects.map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Collaborateur</Label>
                    <Select
                      value={compensationForm.team_member_id}
                      onValueChange={(value) => setCompensationForm((prev) => ({ ...prev, team_member_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {members.map((member) => (
                          <SelectItem key={member.id} value={member.id}>
                            {member.name || member.email}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Tâche (optionnel)</Label>
                    <Select
                      value={compensationForm.task_id}
                      onValueChange={(value) => setCompensationForm((prev) => ({ ...prev, task_id: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Aucune tâche" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Aucune tâche</SelectItem>
                        {taskOptions.map((task) => (
                          <SelectItem key={task.id} value={task.id}>
                            {task.title} - {task.projectName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Montant</Label>
                    <Input
                      type="number"
                      min="0"
                      value={compensationForm.amount}
                      onChange={(e) => setCompensationForm((prev) => ({ ...prev, amount: e.target.value }))}
                    />
                  </div>
                  <div>
                    <Label>Type</Label>
                    <Select
                      value={compensationForm.compensation_type}
                      onValueChange={(value) => setCompensationForm((prev) => ({ ...prev, compensation_type: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="hourly">Horaire</SelectItem>
                        <SelectItem value="fixed">Fixe</SelectItem>
                        <SelectItem value="bonus">Bonus</SelectItem>
                        <SelectItem value="malus">Malus</SelectItem>
                        <SelectItem value="adjustment">Ajustement</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Statut</Label>
                    <Select
                      value={compensationForm.payment_status}
                      onValueChange={(value) => setCompensationForm((prev) => ({ ...prev, payment_status: value }))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planned">Prévue</SelectItem>
                        <SelectItem value="approved">Approuvée</SelectItem>
                        <SelectItem value="paid">Payée</SelectItem>
                        <SelectItem value="cancelled">Annulée</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Date prévue de paiement</Label>
                    <Input
                      type="date"
                      value={compensationForm.planned_payment_date}
                      onChange={(e) =>
                        setCompensationForm((prev) => ({ ...prev, planned_payment_date: e.target.value }))
                      }
                    />
                  </div>
                  <div className="md:col-span-2">
                    <Label>Note</Label>
                    <Input
                      value={compensationForm.notes}
                      onChange={(e) => setCompensationForm((prev) => ({ ...prev, notes: e.target.value }))}
                    />
                  </div>
                  <div className="md:col-span-3">
                    <Button
                      className="bg-orange-500 hover:bg-orange-600"
                      type="submit"
                      disabled={!isCompanyScoped || loading}
                    >
                      Enregistrer la paie projet
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>

            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle>Journal des paies projet</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-left">
                        <th className="py-2">Date</th>
                        <th className="py-2">Projet</th>
                        <th className="py-2">Collaborateur</th>
                        <th className="py-2">Type</th>
                        <th className="py-2">Montant</th>
                        <th className="py-2">Statut</th>
                        <th className="py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentCompensations.length === 0 && (
                        <tr>
                          <td className="py-3 text-gray-500" colSpan={7}>
                            Aucune paie enregistrée.
                          </td>
                        </tr>
                      )}
                      {recentCompensations.map((row) => (
                        <tr key={row.id} className="border-b border-slate-800">
                          <td className="py-2 text-gray-300">
                            {formatDate(row.planned_payment_date || row.created_at)}
                          </td>
                          <td className="py-2 text-gray-300">{row?.project?.name || '-'}</td>
                          <td className="py-2 text-gray-300">
                            {row?.team_member?.name || row?.team_member?.email || '-'}
                          </td>
                          <td className="py-2 text-gray-300">{row.compensation_type || '-'}</td>
                          <td className="py-2 text-gray-300">{formatCurrency(row.amount || 0)}</td>
                          <td className="py-2 text-gray-300">{row.payment_status || '-'}</td>
                          <td className="py-2 text-gray-300">
                            <div className="flex gap-2">
                              {row.payment_status === 'planned' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleUpdateCompensationStatus(row.id, 'approved')}
                                >
                                  Approuver
                                </Button>
                              )}
                              {row.payment_status !== 'paid' && row.payment_status !== 'cancelled' && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleUpdateCompensationStatus(row.id, 'paid')}
                                >
                                  Marquer payé
                                </Button>
                              )}
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

          <TabsContent value="accounting" className="space-y-4">
            <Card className="bg-white/5 border-white/10">
              <CardHeader>
                <CardTitle>Dernières écritures RH / projet</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-left">
                        <th className="py-2">Date</th>
                        <th className="py-2">Source</th>
                        <th className="py-2">Compte</th>
                        <th className="py-2">Débit</th>
                        <th className="py-2">Crédit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accountingEntries.length === 0 && (
                        <tr>
                          <td className="py-3 text-gray-500" colSpan={5}>
                            Aucune écriture liée.
                          </td>
                        </tr>
                      )}
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
              <CardHeader>
                <CardTitle>Journal d'audit CRUD</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700 text-left">
                        <th className="py-2">Date</th>
                        <th className="py-2">Table source</th>
                        <th className="py-2">Action</th>
                        <th className="py-2">Société</th>
                      </tr>
                    </thead>
                    <tbody>
                      {auditLogs.length === 0 && (
                        <tr>
                          <td className="py-3 text-gray-500" colSpan={4}>
                            Aucun log d'audit pour la société active.
                          </td>
                        </tr>
                      )}
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
