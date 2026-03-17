import { useCallback } from 'react';
import { useCompanyScope } from '@/hooks/useCompanyScope';
import { useHrMaterialAssets } from '@/hooks/useHrMaterialAssets';
import { useHrMaterialEmployees } from '@/hooks/useHrMaterialEmployees';
import { useHrMaterialPayroll } from '@/hooks/useHrMaterialPayroll';
import { useHrMaterialAllocations } from '@/hooks/useHrMaterialAllocations';
import { useHrMaterialCompensations } from '@/hooks/useHrMaterialCompensations';

/**
 * Barrel hook that composes all HR & Material sub-hooks and
 * re-exports a single unified API for backwards compatibility.
 *
 * Sub-hooks:
 *  - useHrMaterialAssets        → material categories + assets
 *  - useHrMaterialEmployees     → employees, contracts, team-member sync
 *  - useHrMaterialPayroll       → payroll periods, variable items, anomalies, exports
 *  - useHrMaterialAllocations   → allocations, suppliers, supplier services/products
 *  - useHrMaterialCompensations → compensations, members, tasks, timesheets, accounting
 */
export function useHrMaterial() {
  const { activeCompanyId } = useCompanyScope();

  const assets = useHrMaterialAssets();
  const employees = useHrMaterialEmployees();
  const payroll = useHrMaterialPayroll();
  const allocs = useHrMaterialAllocations();

  // Pass projects from the allocations sub-hook so the compensations
  // sub-hook can scope tasks/timesheets by project company link.
  const comps = useHrMaterialCompensations({ projects: allocs.projects });

  // Unified loading / error — true if ANY sub-hook is loading / has an error.
  const loading = assets.loading || employees.loading || payroll.loading || allocs.loading || comps.loading;

  const error = assets.error || employees.error || payroll.error || allocs.error || comps.error || null;

  // Unified fetchData that refreshes every sub-hook with partial failure tolerance.
  const fetchData = useCallback(async () => {
    const results = await Promise.allSettled([
      assets.fetchData(),
      employees.fetchData(),
      payroll.fetchData(),
      allocs.fetchData(),
      comps.fetchData(),
    ]);
    const labels = ['assets', 'employees', 'payroll', 'allocations', 'compensations'];
    results.forEach((r, i) => {
      if (r.status === 'rejected') console.error(`HrMaterial sub-hook "${labels[i]}" refresh failed:`, r.reason);
    });
  }, [assets.fetchData, employees.fetchData, payroll.fetchData, allocs.fetchData, comps.fetchData]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    // Scope
    activeCompanyId,

    // Unified status
    loading,
    error,

    // From useHrMaterialAssets
    materialCategories: assets.materialCategories,
    materialAssets: assets.materialAssets,
    createMaterialCategory: assets.createMaterialCategory,
    createMaterialAsset: assets.createMaterialAsset,

    // From useHrMaterialEmployees
    employees: employees.employees,
    employeeContracts: employees.employeeContracts,
    createEmployee: employees.createEmployee,
    createEmployeeContract: employees.createEmployeeContract,
    syncEmployeeToTeamMember: employees.syncEmployeeToTeamMember,
    syncAllEmployeesToTeamMembers: employees.syncAllEmployeesToTeamMembers,

    // From useHrMaterialPayroll
    payrollPeriods: payroll.payrollPeriods,
    payrollVariableItems: payroll.payrollVariableItems,
    payrollAnomalies: payroll.payrollAnomalies,
    payrollExports: payroll.payrollExports,
    createPayrollPeriod: payroll.createPayrollPeriod,
    calculatePayrollPeriod: payroll.calculatePayrollPeriod,
    exportPayrollCsv: payroll.exportPayrollCsv,

    // From useHrMaterialAllocations
    allocations: allocs.allocations,
    suppliers: allocs.suppliers,
    supplierServices: allocs.supplierServices,
    supplierProducts: allocs.supplierProducts,
    projects: allocs.projects,
    createAllocation: allocs.createAllocation,
    createSupplierFromPortfolioCompany: allocs.createSupplierFromPortfolioCompany,

    // From useHrMaterialCompensations
    members: comps.members,
    tasks: comps.tasks,
    timesheets: comps.timesheets,
    compensations: comps.compensations,
    accountingEntries: comps.accountingEntries,
    auditLogs: comps.auditLogs,
    createCompensation: comps.createCompensation,
    updateCompensationStatus: comps.updateCompensationStatus,
    assignTaskMember: comps.assignTaskMember,

    // Unified refresh
    fetchData,
  };
}
