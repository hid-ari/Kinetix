import crypto from 'node:crypto';
import { db } from '../../../core/db.js';
import { createPasswordHash } from '../../../core/auth.js';
import { badRequest, conflict, forbidden, notFound } from '../../../core/http.js';
import { SUPER_ADMIN_ROLE } from '../validators.js';

/** Rol principal de un usuario (uno por usuario en el modelo actual). */
const PRIMARY_ROLE_JOIN = `
  LEFT JOIN LATERAL (
    SELECT r.Id, r.Name
    FROM UserRoles AS ur
    INNER JOIN Roles AS r ON r.Id = ur.RoleId
    WHERE ur.UserId = u.UserId
    ORDER BY r.Name
    LIMIT 1
  ) AS r ON TRUE`;

const SCOPE_FILTER = `
  (@isGlobal = TRUE OR u.CompanyId = @companyId)
  AND (@isGlobal = TRUE OR COALESCE(r.Name, '') <> '${SUPER_ADMIN_ROLE}')
  AND (@statusFilter::text IS NULL OR (CASE WHEN u.IsActive THEN 'Activa' ELSE 'Inactiva' END) = @statusFilter)`;

/** Historial que impide el borrado físico (se aplica baja lógica). */
const HISTORY_CHECK_SQL = `
  SELECT EXISTS (SELECT 1 FROM AuditLogs WHERE UserId = @uid)
      OR EXISTS (SELECT 1 FROM InventoryMovements WHERE CreatedBy = @uid)
      OR EXISTS (SELECT 1 FROM FinanceTransactions WHERE CreatedBy = @uid)
      OR EXISTS (SELECT 1 FROM FinanceInvoices WHERE CreatedBy = @uid) AS "hasHistory";`;

export async function listUsers({ companyId, isGlobal, page, pageSize, statusFilter }) {
  const params = { companyId: companyId || null, isGlobal, statusFilter: statusFilter || null };
  const [data, count] = await Promise.all([
    db.query(`
      SELECT u.UserId AS id,
             CONCAT(u.FirstName, ' ', u.LastName) AS name,
             u.FirstName AS "firstName", u.LastName AS "lastName",
             u.Email AS email, u.Phone AS phone,
             u.CompanyId AS "companyId", c.Name AS company,
             u.BranchId AS "branchId", b.Name AS branch,
             u.IsActive, u.LastLoginAt, u.CreatedAt,
             COALESCE(r.Name, 'Sin rol') AS role, r.Id AS "roleId",
             emp.Id AS "employeeId", emp.EmployeeCode AS "employeeCode",
             CONCAT(emp.FirstName, ' ', emp.LastName) AS "employeeName"
      FROM UserOrganizations AS u
      INNER JOIN Companies AS c ON c.Id = u.CompanyId
      LEFT JOIN Branches AS b ON b.Id = u.BranchId
      ${PRIMARY_ROLE_JOIN}
      LEFT JOIN LATERAL (
        SELECT e.Id, e.EmployeeCode, e.FirstName, e.LastName
        FROM HrEmployees AS e WHERE e.UserId = u.UserId LIMIT 1
      ) AS emp ON TRUE
      WHERE ${SCOPE_FILTER}
      ORDER BY u.LastName, u.FirstName
      LIMIT @pageSize OFFSET @offset;`,
      { ...params, pageSize, offset: (page - 1) * pageSize }),
    db.query(`
      SELECT COUNT(*)::int AS total
      FROM UserOrganizations AS u
      ${PRIMARY_ROLE_JOIN}
      WHERE ${SCOPE_FILTER};`, params)
  ]);
  return { data: data.recordset, total: count.recordset[0]?.total || 0 };
}

/** Usuario con su rol principal; null si no existe. */
export async function findUserWithRole(userId, runner = db) {
  const result = await runner.query(`
    SELECT u.UserId, u.FirstName, u.LastName, u.Email, u.CompanyId, COALESCE(r.Name, 'Sin rol') AS "RoleName"
    FROM UserOrganizations AS u
    ${PRIMARY_ROLE_JOIN}
    WHERE u.UserId = @uid;`, { uid: userId });
  return result.recordset[0] || null;
}

/**
 * Verifica que el usuario objetivo exista y sea gestionable por el solicitante:
 * misma empresa y, si no es Super Admin, que el objetivo tampoco lo sea.
 */
export async function assertManageableUser(userId, { companyId, isGlobal }, runner = db) {
  const user = await findUserWithRole(userId, runner);
  if (!user) throw notFound('Usuario no encontrado.');
  if (!isGlobal && user.CompanyId !== companyId) throw forbidden('No puedes gestionar usuarios de otra empresa.');
  if (!isGlobal && user.RoleName === SUPER_ADMIN_ROLE) throw forbidden('No puedes gestionar al Super Admin.');
  return user;
}

async function resolveRoleId(tx, roleName, isGlobal) {
  if (!roleName) return null;
  if (roleName === SUPER_ADMIN_ROLE && !isGlobal) throw forbidden('Solo un Super Admin puede asignar el rol Super Admin.');
  const res = await tx.query('SELECT Id FROM Roles WHERE Name = @name AND IsActive = TRUE LIMIT 1;', { name: roleName });
  const roleId = res.recordset[0]?.Id;
  if (!roleId) throw badRequest(`El rol "${roleName}" no existe o está inactivo.`);
  return roleId;
}

async function resolveBranchId(tx, branchName, companyId) {
  if (!branchName) return null;
  const res = await tx.query('SELECT Id FROM Branches WHERE Name = @name AND CompanyId = @companyId LIMIT 1;',
    { name: branchName, companyId });
  const branchId = res.recordset[0]?.Id;
  if (!branchId) throw badRequest(`La sucursal "${branchName}" no existe en la empresa.`);
  return branchId;
}

export const DUPLICATE_EMAIL_MESSAGE = 'Ese correo electrónico ya está registrado en el sistema. Utilice otro correo.';

/** Unicidad de email sin distinguir mayúsculas (la restricción de BD puede ser sensible a ellas). */
async function assertEmailAvailable(tx, email, excludeUserId = null) {
  const res = await tx.query(`
    SELECT 1 FROM UserOrganizations
    WHERE LOWER(Email) = LOWER(@email) AND (@exclude::text IS NULL OR UserId <> @exclude::text) LIMIT 1;`,
    { email, exclude: excludeUserId });
  if (res.recordset[0]) throw conflict(DUPLICATE_EMAIL_MESSAGE);
}

async function replaceUserRole(tx, userId, roleId) {
  await tx.query('DELETE FROM UserRoles WHERE UserId = @uid;', { uid: userId });
  await tx.query('INSERT INTO UserRoles (UserId, RoleId) VALUES (@uid, @rid);', { uid: userId, rid: roleId });
}

/** Vincula (o desvincula con null) un expediente de RRHH al usuario. */
async function linkEmployee(tx, userId, employeeId, companyId) {
  await tx.query('UPDATE HrEmployees SET UserId = NULL, UpdatedAt = now() WHERE UserId = @uid AND Id IS DISTINCT FROM @empId::int;',
    { uid: userId, empId: employeeId });
  if (!employeeId) return null;
  const res = await tx.query(`
    UPDATE HrEmployees SET UserId = @uid, UpdatedAt = now()
    WHERE Id = @empId AND CompanyId = @companyId AND (UserId IS NULL OR UserId = @uid)
    RETURNING Id;`, { uid: userId, empId: employeeId, companyId });
  const linked = res.recordset[0]?.Id;
  if (!linked) throw conflict('El expediente seleccionado no existe o ya está vinculado a otro usuario.');
  return linked;
}

export async function createUser(input, { companyId, isGlobal }) {
  if (!companyId) throw badRequest('La sesión no tiene una empresa asignada.');
  return db.withTransaction(async tx => {
    await assertEmailAvailable(tx, input.email);
    const roleId = await resolveRoleId(tx, input.roleName, isGlobal);
    const branchId = await resolveBranchId(tx, input.branchName, companyId);
    const userId = crypto.randomUUID();

    const created = await tx.insert('UserOrganizations', {
      UserId: userId,
      CompanyId: companyId,
      BranchId: branchId,
      FirstName: input.firstName,
      LastName: input.lastName,
      Email: input.email,
      PasswordHash: createPasswordHash(input.password),
      Phone: input.phone,
      IsActive: true
    }, { returning: 'UserId AS id, FirstName AS "firstName", LastName AS "lastName", Email AS email, Phone AS phone, CompanyId AS "companyId", BranchId AS "branchId"' });

    await tx.insert('UserRoles', { UserId: userId, RoleId: roleId }, { returning: false });
    const employeeId = input.employeeId ? await linkEmployee(tx, userId, input.employeeId, companyId) : null;
    return { ...created, employeeId };
  });
}

export async function updateUser(userId, input, scope) {
  return db.withTransaction(async tx => {
    const current = await assertManageableUser(userId, scope, tx);
    const companyId = current.CompanyId;
    await assertEmailAvailable(tx, input.email, userId);
    const branchId = await resolveBranchId(tx, input.branchName, companyId);

    const updates = {
      FirstName: input.firstName,
      LastName: input.lastName,
      Email: input.email,
      Phone: input.phone,
      BranchId: branchId,
      UpdatedAt: new Date()
    };
    if (input.password) updates.PasswordHash = createPasswordHash(input.password);
    await tx.update('UserOrganizations', { UserId: userId }, updates, { returning: false });

    if (input.roleName) {
      await replaceUserRole(tx, userId, await resolveRoleId(tx, input.roleName, scope.isGlobal));
    }
    if (input.employeeId !== undefined) {
      await linkEmployee(tx, userId, input.employeeId, companyId);
    }

    // Mantener sincronizados los datos de contacto del expediente vinculado.
    await tx.query(`
      UPDATE HrEmployees
      SET FirstName = @fn, LastName = @ln, Email = @email,
          Phone = COALESCE(@phone, Phone), BranchId = COALESCE(@branchId, BranchId), UpdatedAt = now()
      WHERE UserId = @uid;`,
      { uid: userId, fn: input.firstName, ln: input.lastName, email: input.email, phone: input.phone, branchId });

    return { id: userId, firstName: input.firstName, lastName: input.lastName, email: input.email, companyId };
  });
}

export async function setUserStatus(userId, isActive, scope) {
  const user = await assertManageableUser(userId, scope);
  await db.update('UserOrganizations', { UserId: userId }, { IsActive: isActive, UpdatedAt: new Date() }, { returning: false });
  if (!isActive) await db.query('DELETE FROM UserSessions WHERE UserId = @uid;', { uid: userId });
  return { id: userId, isActive, companyId: user.CompanyId };
}

export async function resetUserPassword(userId, password, scope) {
  const user = await assertManageableUser(userId, scope);
  await db.update('UserOrganizations', { UserId: userId },
    { PasswordHash: createPasswordHash(password), UpdatedAt: new Date() }, { returning: false });
  return user;
}

/**
 * Elimina un usuario. Si tiene historial operativo/auditoría se aplica baja lógica
 * para preservar la trazabilidad; en ambos casos se revocan todos sus accesos.
 */
export async function deleteUser(userId, scope) {
  return db.withTransaction(async tx => {
    const user = await assertManageableUser(userId, scope, tx);
    if (user.RoleName === SUPER_ADMIN_ROLE) throw forbidden('El usuario Super Admin es esencial y no puede ser eliminado.');

    const params = { uid: userId };
    await tx.query('UPDATE Branches SET ManagerUserId = NULL WHERE ManagerUserId = @uid;', params);
    await tx.query('UPDATE HrEmployees SET UserId = NULL WHERE UserId = @uid;', params);
    await tx.query('UPDATE HrApprovalSteps SET ApproverUserId = NULL WHERE ApproverUserId = @uid;', params);
    await tx.query('DELETE FROM HrNotifications WHERE UserId = @uid;', params);
    await tx.query('DELETE FROM HrAccessScopes WHERE UserId = @uid;', params);
    await tx.query('DELETE FROM UserSessions WHERE UserId = @uid;', params);
    await tx.query('DELETE FROM UserRoles WHERE UserId = @uid;', params);

    const { hasHistory } = (await tx.query(HISTORY_CHECK_SQL, params)).recordset[0];
    if (hasHistory) {
      await tx.query('UPDATE UserOrganizations SET IsActive = FALSE, UpdatedAt = now() WHERE UserId = @uid;', params);
    } else {
      await tx.query('DELETE FROM UserOrganizations WHERE UserId = @uid;', params);
    }
    return { user, softDeleted: Boolean(hasHistory) };
  });
}
