/**
 * HR Data Access & Scope Resolution.
 * Integrates functional permissions with organizational data scope (Company, Branch, Department, Team, Self).
 */
import { badRequest, forbidden } from '../../core/http.js';

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
 * Checks if user has a specific functional permission.
 */
export async function hasPermission(pool, userId, moduleName, permissionName, req) {
  if (isGlobalAdmin(req)) return true;
  if (!userId) return false;
  const result = await pool.request()
    .input('userId', userId)
    .input('moduleName', moduleName)
    .input('permissionName', permissionName)
    .query(`
      SELECT 1 AS allowed
      FROM UserRoles AS ur
      INNER JOIN RolePermissions AS rp ON rp.RoleId = ur.RoleId
      INNER JOIN Permissions AS p ON p.Id = rp.PermissionId
      WHERE ur.UserId = @userId AND p.ModuleName = @moduleName AND p.PermissionName = @permissionName LIMIT 1;
    `);
  return !!result.recordset[0];
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
      SELECT 1 AS scoped
      FROM HrAccessScopes
      WHERE UserId = @userId AND ScopeType IN ('Sucursal', 'Departamento') LIMIT 1;
    `);
  return !restricted.recordset[0];
}

/**
 * Resolves salary, sensitive-data, and company-wide visibility flags in parallel.
 */
export async function resolveEmployeeVisibilityFlags(pool, req) {
  const isAdmin = isGlobalAdmin(req) || isCompanyAdmin(req);
  if (isAdmin) {
    return { canViewSalary: true, canViewSensitive: true, canViewAll: true };
  }
  const [canViewSalary, canViewSensitive, canViewAll] = await Promise.all([
    hasPermission(pool, req.user?.userId, 'RRHH Empleados', 'Ver información salarial', req),
    hasPermission(pool, req.user?.userId, 'RRHH Empleados', 'Ver datos sensibles', req),
    canViewAllCompanyEmployees(pool, req)
  ]);
  return { canViewSalary, canViewSensitive, canViewAll };
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
  if (!Number.isFinite(targetId) || targetId <= 0) {
    throw badRequest('Identificador de empresa inválido.');
  }
  if (req.user?.companyId === targetId) return true;

  const check = await pool.request()
    .input('userId', req.user.userId)
    .input('companyId', targetId)
    .query('SELECT 1 FROM fn_HrAccessibleCompanies(@userId, FALSE) WHERE CompanyId = @companyId;');

  if (!check.recordset[0]) {
    throw forbidden('No tienes acceso a los recursos de esta empresa.');
  }
  return true;
}

/**
 * Resolves target company ID and asserts user access in one step.
 */
export async function resolveCompanyScope(pool, req) {
  const companyId = resolveTargetCompanyId(req);
  if (!companyId) {
    throw badRequest('Se requiere especificar la empresa.');
  }
  await assertCompanyAccess(pool, req, companyId);
  return companyId;
}

/**
 * Ensures user has access to a specific employee ID.
 */
export async function assertEmployeeAccess(pool, req, employeeId) {
  const empId = Number(employeeId);
  if (!Number.isInteger(empId) || empId <= 0) {
    throw badRequest('Identificador de empleado inválido.');
  }
  if (isGlobalAdmin(req)) return true;
  const canViewAll = await canViewAllCompanyEmployees(pool, req);

  const check = await pool.request()
    .input('userId', req.user.userId)
    .input('isGlobal', false)
    .input('isCompanyAdmin', Boolean(canViewAll))
    .input('employeeId', empId)
    .query(`
      SELECT 1 FROM fn_HrVisibleEmployees(@userId, @isGlobal::boolean, @isCompanyAdmin::boolean)
      WHERE EmployeeId = @employeeId;
    `);

  if (!check.recordset[0]) {
    throw forbidden('No tienes autorización para acceder a este empleado.');
  }
  return true;
}
