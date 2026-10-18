/**
 * HR Data Access & Scope Resolution.
 * Integrates functional permissions with organizational data scope (Company, Branch, Department, Team, Self).
 */

export function isGlobalAdmin(req) {
  return req.user?.role === 'Super Admin';
}

export function isCompanyAdmin(req) {
  return req.user?.role === 'Company Admin';
}

export function isHrManager(req) {
  return isGlobalAdmin(req) || isCompanyAdmin(req) || ['Director de RRHH', 'Analista de RRHH'].includes(req.user?.role);
}

/**
 * Checks if user has company-wide visibility over employees in their company.
 */
export async function canViewAllCompanyEmployees(pool, req) {
  if (isGlobalAdmin(req) || isCompanyAdmin(req)) return true;
  if (['Director de RRHH', 'Analista de RRHH'].includes(req.user?.role)) return true;
  const hasPerm = await hasPermission(pool, req.user?.userId, 'RRHH Empleados', 'Ver empleados', req);
  if (!hasPerm) return false;
  const restricted = await pool.request()
    .input('userId', req.user?.userId)
    .query(`
      SELECT TOP 1 1 AS scoped
      FROM dbo.HrAccessScopes
      WHERE UserId = @userId AND ScopeType IN (N'Sucursal', N'Departamento');
    `);
  return !restricted.recordset[0];
}

/**
 * Checks if user has a specific functional permission
 */
export async function hasPermission(pool, userId, moduleName, permissionName, req) {
  if (isGlobalAdmin(req)) return true;
  const result = await pool.request()
    .input('userId', userId)
    .input('moduleName', moduleName)
    .input('permissionName', permissionName)
    .query(`
      SELECT TOP 1 1 AS allowed
      FROM dbo.UserRoles AS ur
      INNER JOIN dbo.RolePermissions AS rp ON rp.RoleId = ur.RoleId
      INNER JOIN dbo.Permissions AS p ON p.Id = rp.PermissionId
      WHERE ur.UserId = @userId AND p.ModuleName = @moduleName AND p.PermissionName = @permissionName;
    `);
  return !!result.recordset[0];
}

/**
 * Returns effective company ID for an operation.
 * If user is Super Admin, they can target req.query.companyId or req.body.companyId;
 * Otherwise, forced to req.user.companyId.
 */
export function resolveTargetCompanyId(req) {
  if (isGlobalAdmin(req)) {
    const requested = req.query.companyId || req.body?.companyId;
    if (requested) return Number(requested);
  }
  return req.user?.companyId ? Number(req.user.companyId) : null;
}

/**
 * Ensures user has access to a specific company ID.
 */
export async function assertCompanyAccess(pool, req, companyId) {
  if (isGlobalAdmin(req)) return true;
  const targetId = Number(companyId);
  if (req.user?.companyId === targetId) return true;

  const check = await pool.request()
    .input('userId', req.user.userId)
    .input('companyId', targetId)
    .query('SELECT 1 FROM dbo.fn_HrAccessibleCompanies(@userId, 0) WHERE CompanyId = @companyId;');
  
  if (!check.recordset[0]) {
    const err = new Error('No tienes acceso a los recursos de esta empresa.');
    err.status = 403;
    throw err;
  }
  return true;
}

/**
 * Ensures user has access to a specific employee ID.
 */
export async function assertEmployeeAccess(pool, req, employeeId) {
  if (isGlobalAdmin(req)) return true;
  const empId = Number(employeeId);
  const canViewAll = await canViewAllCompanyEmployees(pool, req);

  const check = await pool.request()
    .input('userId', req.user.userId)
    .input('isGlobal', 0)
    .input('isCompanyAdmin', canViewAll ? 1 : 0)
    .input('employeeId', empId)
    .query(`
      SELECT 1 FROM dbo.fn_HrVisibleEmployees(@userId, @isGlobal, @isCompanyAdmin)
      WHERE EmployeeId = @employeeId;
    `);

  if (!check.recordset[0]) {
    const err = new Error('No tienes autorización para acceder a este empleado.');
    err.status = 403;
    throw err;
  }
  return true;
}

