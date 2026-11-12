import { getHrSettings } from './catalogs.repo.js';

export async function getHrDashboardSummary(pool, companyId, { canViewSalary = false } = {}) {
  const [
    settings,
    statusRes,
    deptRes,
    branchRes,
    contractRes,
    movementsSummary,
    payrollRes,
    birthdaysRes
  ] = await Promise.all([
    getHrSettings(pool, companyId),
    pool.request()
      .input('companyId', companyId)
      .query(`
        SELECT Status, COUNT(*) AS Total
        FROM HrEmployees
        WHERE CompanyId = @companyId
        GROUP BY Status;
      `),
    pool.request()
      .input('companyId', companyId)
      .query(`
        SELECT d.Name AS DepartmentName, COUNT(e.Id) AS Count
        FROM HrDepartments d
        LEFT JOIN HrEmployees e ON e.DepartmentId = d.Id AND e.Status = 'Activo'
        WHERE d.CompanyId = @companyId AND d.IsActive = TRUE
        GROUP BY d.Id, d.Name
        ORDER BY Count DESC, d.Name ASC;
      `),
    pool.request()
      .input('companyId', companyId)
      .query(`
        SELECT b.Name AS BranchName, COUNT(e.Id) AS Count
        FROM Branches b
        LEFT JOIN HrEmployees e ON e.BranchId = b.Id AND e.Status = 'Activo'
        WHERE b.CompanyId = @companyId AND b.IsActive = TRUE
        GROUP BY b.Id, b.Name
        ORDER BY Count DESC, b.Name ASC;
      `),
    pool.request()
      .input('companyId', companyId)
      .query(`
        SELECT COALESCE(c.Name, 'No especificado') AS ContractTypeName, COUNT(e.Id) AS Count
        FROM HrEmployees e
        LEFT JOIN HrCatalogItems c ON c.Id = e.ContractTypeId
        WHERE e.CompanyId = @companyId AND e.Status = 'Activo'
        GROUP BY c.Name
        ORDER BY Count DESC;
      `),
    pool.request()
      .input('companyId', companyId)
      .query(`
        SELECT
          COUNT(CASE WHEN MovementType = 'Ingreso' AND EffectiveDate >= (CURRENT_DATE - 30) THEN 1 END) AS RecentHires,
          COUNT(CASE WHEN MovementType = 'Desvinculacion' AND EffectiveDate >= (CURRENT_DATE - 30) THEN 1 END) AS RecentTerminations
        FROM HrEmployeeMovements
        WHERE CompanyId = @companyId;
      `),
    canViewSalary
      ? pool.request()
          .input('companyId', companyId)
          .query(`
            SELECT SUM(BaseSalary) AS TotalBaseSalary, SalaryCurrency
            FROM HrEmployees
            WHERE CompanyId = @companyId AND Status = 'Activo'
            GROUP BY SalaryCurrency;
          `)
      : Promise.resolve(null),
    pool.request()
      .input('companyId', companyId)
      .query(`
        SELECT e.Id, e.FirstName, e.LastName, e.EmployeeCode, e.BirthDate,
               d.Name AS DepartmentName,
               EXTRACT(DAY FROM e.BirthDate)::int AS BirthDay,
               EXTRACT(MONTH FROM e.BirthDate)::int AS BirthMonth
        FROM HrEmployees e
        LEFT JOIN HrDepartments d ON d.Id = e.DepartmentId
        WHERE e.CompanyId = @companyId
          AND e.Status = 'Activo'
          AND e.BirthDate IS NOT NULL
          AND EXTRACT(MONTH FROM e.BirthDate)::int = EXTRACT(MONTH FROM now())::int
        ORDER BY EXTRACT(DAY FROM e.BirthDate)::int ASC;
      `)
  ]);

  const statusMap = {
    Activo: 0,
    Suspendido: 0,
    Licencia: 0,
    Desvinculado: 0
  };
  let totalEmployees = 0;
  for (const row of statusRes.recordset) {
    statusMap[row.Status] = row.Total;
    totalEmployees += row.Total;
  }

  const summary = {
    totalEmployees,
    activeEmployees: statusMap.Activo || 0,
    suspendedEmployees: statusMap.Suspendido || 0,
    leaveEmployees: statusMap.Licencia || 0,
    terminatedEmployees: statusMap.Desvinculado || 0,
    recentHires: movementsSummary.recordset[0]?.RecentHires || 0,
    recentTerminations: movementsSummary.recordset[0]?.RecentTerminations || 0,
    byDepartment: deptRes.recordset,
    byBranch: branchRes.recordset,
    byContractType: contractRes.recordset,
    birthdaysEnabled: settings.BirthdaysEnabled
  };

  if (canViewSalary && payrollRes) {
    summary.payroll = payrollRes.recordset;
  }

  if (settings.BirthdaysEnabled && birthdaysRes) {
    summary.upcomingBirthdays = birthdaysRes.recordset;
  }

  return summary;
}

export async function getOrgChartData(pool, companyId) {
  const [depts, employees] = await Promise.all([
    pool.request()
      .input('companyId', companyId)
      .query(`
        SELECT d.Id, d.ParentDepartmentId, d.Code, d.Name, d.ManagerEmployeeId,
               CONCAT(m.FirstName, ' ', m.LastName) AS ManagerName,
               p.Title AS ManagerPositionTitle
        FROM HrDepartments d
        LEFT JOIN HrEmployees m ON m.Id = d.ManagerEmployeeId
        LEFT JOIN HrPositions p ON p.Id = m.PositionId
        WHERE d.CompanyId = @companyId AND d.IsActive = TRUE
        ORDER BY d.Name;
      `),
    pool.request()
      .input('companyId', companyId)
      .query(`
        SELECT e.Id, e.EmployeeCode, e.FirstName, e.LastName,
               CONCAT(e.FirstName, ' ', e.LastName) AS FullName,
               e.DepartmentId, e.PositionId, e.SupervisorEmployeeId,
               p.Title AS PositionTitle,
               p.HierarchyLevel,
               e.PhotoFileId
        FROM HrEmployees e
        LEFT JOIN HrPositions p ON p.Id = e.PositionId
        WHERE e.CompanyId = @companyId AND e.Status = 'Activo'
        ORDER BY p.HierarchyLevel ASC, e.LastName ASC;
      `)
  ]);

  return {
    departments: depts.recordset,
    employees: employees.recordset
  };
}
