import sql from 'mssql/msnodesqlv8.js';
import { getHrSettings } from './catalogs.repo.js';

export async function getHrDashboardSummary(pool, companyId, { canViewSalary = false } = {}) {
  const settings = await getHrSettings(pool, companyId);

  // Status counts
  const statusRes = await pool.request()
    .input('companyId', sql.Int, companyId)
    .query(`
      SELECT Status, COUNT(*) AS Total
      FROM dbo.HrEmployees
      WHERE CompanyId = @companyId
      GROUP BY Status;
    `);

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

  // Distribution by department
  const deptRes = await pool.request()
    .input('companyId', sql.Int, companyId)
    .query(`
      SELECT d.Name AS DepartmentName, COUNT(e.Id) AS Count
      FROM dbo.HrDepartments d
      LEFT JOIN dbo.HrEmployees e ON e.DepartmentId = d.Id AND e.Status = N'Activo'
      WHERE d.CompanyId = @companyId AND d.IsActive = 1
      GROUP BY d.Id, d.Name
      ORDER BY Count DESC, d.Name ASC;
    `);

  // Distribution by branch
  const branchRes = await pool.request()
    .input('companyId', sql.Int, companyId)
    .query(`
      SELECT b.Name AS BranchName, COUNT(e.Id) AS Count
      FROM dbo.Branches b
      LEFT JOIN dbo.HrEmployees e ON e.BranchId = b.Id AND e.Status = N'Activo'
      WHERE b.CompanyId = @companyId AND b.IsActive = 1
      GROUP BY b.Id, b.Name
      ORDER BY Count DESC, b.Name ASC;
    `);

  // Distribution by contract type
  const contractRes = await pool.request()
    .input('companyId', sql.Int, companyId)
    .query(`
      SELECT COALESCE(c.Name, N'No especificado') AS ContractTypeName, COUNT(e.Id) AS Count
      FROM dbo.HrEmployees e
      LEFT JOIN dbo.HrCatalogItems c ON c.Id = e.ContractTypeId
      WHERE e.CompanyId = @companyId AND e.Status = N'Activo'
      GROUP BY c.Name
      ORDER BY Count DESC;
    `);

  // Hires and Terminations in the last 30 days
  const movementsSummary = await pool.request()
    .input('companyId', sql.Int, companyId)
    .query(`
      SELECT
        COUNT(CASE WHEN MovementType = N'Ingreso' AND EffectiveDate >= DATEADD(day, -30, CONVERT(date, SYSUTCDATETIME())) THEN 1 END) AS RecentHires,
        COUNT(CASE WHEN MovementType = N'Desvinculacion' AND EffectiveDate >= DATEADD(day, -30, CONVERT(date, SYSUTCDATETIME())) THEN 1 END) AS RecentTerminations
      FROM dbo.HrEmployeeMovements
      WHERE CompanyId = @companyId;
    `);

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

  // Monthly payroll cost if authorized
  if (canViewSalary) {
    const payrollRes = await pool.request()
      .input('companyId', sql.Int, companyId)
      .query(`
        SELECT SUM(BaseSalary) AS TotalBaseSalary, SalaryCurrency
        FROM dbo.HrEmployees
        WHERE CompanyId = @companyId AND Status = N'Activo'
        GROUP BY SalaryCurrency;
      `);
    summary.payroll = payrollRes.recordset;
  }

  // Upcoming birthdays this month if enabled
  if (settings.BirthdaysEnabled) {
    const birthdaysRes = await pool.request()
      .input('companyId', sql.Int, companyId)
      .query(`
        SELECT e.Id, e.FirstName, e.LastName, e.EmployeeCode, e.BirthDate,
               d.Name AS DepartmentName,
               DAY(e.BirthDate) AS BirthDay,
               MONTH(e.BirthDate) AS BirthMonth
        FROM dbo.HrEmployees e
        LEFT JOIN dbo.HrDepartments d ON d.Id = e.DepartmentId
        WHERE e.CompanyId = @companyId
          AND e.Status = N'Activo'
          AND e.BirthDate IS NOT NULL
          AND MONTH(e.BirthDate) = MONTH(SYSUTCDATETIME())
        ORDER BY DAY(e.BirthDate) ASC;
      `);
    summary.upcomingBirthdays = birthdaysRes.recordset;
  }

  return summary;
}

export async function getOrgChartData(pool, companyId) {
  // 1. Departments hierarchy
  const depts = await pool.request()
    .input('companyId', sql.Int, companyId)
    .query(`
      SELECT d.Id, d.ParentDepartmentId, d.Code, d.Name, d.ManagerEmployeeId,
             CONCAT(m.FirstName, N' ', m.LastName) AS ManagerName,
             p.Title AS ManagerPositionTitle
      FROM dbo.HrDepartments d
      LEFT JOIN dbo.HrEmployees m ON m.Id = d.ManagerEmployeeId
      LEFT JOIN dbo.HrPositions p ON p.Id = m.PositionId
      WHERE d.CompanyId = @companyId AND d.IsActive = 1
      ORDER BY d.Name;
    `);

  // 2. Active employees with supervisor hierarchy
  const employees = await pool.request()
    .input('companyId', sql.Int, companyId)
    .query(`
      SELECT e.Id, e.EmployeeCode, e.FirstName, e.LastName,
             CONCAT(e.FirstName, N' ', e.LastName) AS FullName,
             e.DepartmentId, e.PositionId, e.SupervisorEmployeeId,
             p.Title AS PositionTitle,
             p.HierarchyLevel,
             e.PhotoFileId
      FROM dbo.HrEmployees e
      LEFT JOIN dbo.HrPositions p ON p.Id = e.PositionId
      WHERE e.CompanyId = @companyId AND e.Status = N'Activo'
      ORDER BY p.HierarchyLevel ASC, e.LastName ASC;
    `);

  return {
    departments: depts.recordset,
    employees: employees.recordset
  };
}
