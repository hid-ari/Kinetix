import { assertEmployeeAccess, isGlobalAdmin, isCompanyAdmin } from './access.js';

/**
 * Finds the employee record that belongs to the logged-in user.
 * 1) explicit link (HrEmployees.UserId) 2) same e-mail inside the user's company.
 * Never falls back to an arbitrary employee.
 */
export async function findOwnEmployee(pool, req) {
  const byUser = await pool.request()
    .input('uid', req.user.userId)
    .query('SELECT TOP 1 Id, CompanyId FROM dbo.HrEmployees WHERE UserId = @uid;');
  if (byUser.recordset[0]) return byUser.recordset[0];

  if (req.user.email && req.user.companyId) {
    const byEmail = await pool.request()
      .input('email', req.user.email)
      .input('companyId', req.user.companyId)
      .query('SELECT TOP 1 Id, CompanyId FROM dbo.HrEmployees WHERE Email = @email AND CompanyId = @companyId;');
    if (byEmail.recordset[0]) return byEmail.recordset[0];
  }
  return null;
}

/**
 * Resolves which employee an operation targets.
 * - No explicit id: the user's own employee record (or null).
 * - Explicit id: must belong to `companyId`, be visible to the user, and acting on behalf of
 *   somebody else is reserved for administrators.
 * Throws errors with `.status` for the route handlers.
 */
export async function resolveActingEmployeeId(pool, req, companyId, explicitId = null) {
  const own = await findOwnEmployee(pool, req);

  if (!explicitId) return own?.Id ?? null;

  const targetId = Number(explicitId);
  if (!Number.isInteger(targetId) || targetId <= 0) {
    const err = new Error('Identificador de empleado inválido.');
    err.status = 400;
    throw err;
  }
  if (own && own.Id === targetId) return targetId;

  const empRes = await pool.request()
    .input('id', targetId)
    .query('SELECT Id, CompanyId FROM dbo.HrEmployees WHERE Id = @id;');
  const emp = empRes.recordset[0];
  if (!emp || (companyId && emp.CompanyId !== Number(companyId))) {
    const err = new Error('Empleado no encontrado.');
    err.status = 404;
    throw err;
  }

  if (!isGlobalAdmin(req) && !isCompanyAdmin(req)) {
    const err = new Error('Solo un administrador puede registrar operaciones en nombre de otro empleado.');
    err.status = 403;
    throw err;
  }
  await assertEmployeeAccess(pool, req, targetId);
  return targetId;
}

export const NO_EMPLOYEE_MESSAGE = 'Su usuario no está vinculado a un expediente de empleado. Vincule el usuario desde el perfil del empleado.';
