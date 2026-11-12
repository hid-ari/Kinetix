import { db } from '../../../core/db.js';
import { badRequest, conflict, forbidden, notFound } from '../../../core/http.js';
import { SUPER_ADMIN_ROLE } from '../validators.js';

const SYSTEM_ROLE_TYPE = 'Sistema';
const CUSTOM_ROLE_TYPE = 'Personalizado';

const toDto = (role, userCount) => ({
  id: role.Id,
  name: role.Name,
  description: role.Description,
  type: role.RoleType,
  isSystem: role.RoleType === SYSTEM_ROLE_TYPE ? 1 : 0,
  ...(userCount !== undefined ? { userCount } : {})
});

export async function listRoles({ isGlobal }) {
  const res = await db.query(`
    SELECT r.Id AS id, r.Name AS name, r.Description AS description, r.RoleType AS type,
           CASE WHEN r.RoleType = '${SYSTEM_ROLE_TYPE}' THEN 1 ELSE 0 END AS "isSystem",
           COUNT(ur.UserId)::int AS "userCount"
    FROM Roles AS r
    LEFT JOIN UserRoles AS ur ON ur.RoleId = r.Id
    WHERE r.IsActive = TRUE AND (@isGlobal = TRUE OR r.Name <> '${SUPER_ADMIN_ROLE}')
    GROUP BY r.Id, r.Name, r.Description, r.RoleType
    ORDER BY r.Name;`, { isGlobal });
  return res.recordset;
}

export async function listPermissions() {
  const res = await db.query('SELECT Id AS id, ModuleName AS module, PermissionName AS name FROM Permissions ORDER BY ModuleName, PermissionName;');
  return res.recordset;
}

/** Rol activo gestionable por el solicitante (Super Admin solo para administradores globales). */
async function findManageableRole(roleId, isGlobal, runner = db) {
  const res = await runner.query('SELECT Id, Name, Description, RoleType FROM Roles WHERE Id = @roleId AND IsActive = TRUE;', { roleId });
  const role = res.recordset[0];
  if (!role) throw notFound('El rol no existe.');
  if (role.Name === SUPER_ADMIN_ROLE && !isGlobal) throw forbidden('No puedes administrar el rol Super Admin.');
  return role;
}

async function assertNameAvailable(tx, name, excludeId = 0) {
  const res = await tx.query('SELECT 1 FROM Roles WHERE LOWER(Name) = LOWER(@name) AND Id <> @excludeId AND IsActive = TRUE;',
    { name, excludeId });
  if (res.recordset[0]) throw conflict('Ya existe un rol con ese nombre.');
}

async function replacePermissions(tx, roleId, permissionIds) {
  await tx.query('DELETE FROM RolePermissions WHERE RoleId = @roleId;', { roleId });
  if (!permissionIds.length) return;
  // Inserción en lote: una sola sentencia en lugar de N round-trips.
  await tx.query(`
    INSERT INTO RolePermissions (RoleId, PermissionId)
    SELECT @roleId, p.Id FROM Permissions AS p WHERE p.Id = ANY(@ids::int[]);`,
    { roleId, ids: permissionIds });
}

export async function getRolePermissionIds(roleId, isGlobal) {
  await findManageableRole(roleId, isGlobal);
  const res = await db.query('SELECT PermissionId AS id FROM RolePermissions WHERE RoleId = @roleId ORDER BY PermissionId;', { roleId });
  return res.recordset.map(p => p.id);
}

export async function createRole({ name, description, roleType, permissionIds }, isGlobal) {
  if (name.toLowerCase() === SUPER_ADMIN_ROLE.toLowerCase()) throw forbidden('El rol Super Admin es reservado del sistema.');
  return db.withTransaction(async tx => {
    await assertNameAvailable(tx, name);
    const created = await tx.insert('Roles', {
      Name: name,
      Description: description,
      RoleType: roleType === SYSTEM_ROLE_TYPE && isGlobal ? SYSTEM_ROLE_TYPE : CUSTOM_ROLE_TYPE,
      IsActive: true
    });
    if (permissionIds?.length) await replacePermissions(tx, created.Id, permissionIds);
    return toDto(created, 0);
  });
}

export async function updateRole(roleId, { name, description, permissionIds }, isGlobal) {
  return db.withTransaction(async tx => {
    const role = await findManageableRole(roleId, isGlobal, tx);
    const isSystem = role.RoleType === SYSTEM_ROLE_TYPE;
    let targetName = role.Name;

    if (name && name !== role.Name) {
      if (isSystem) throw badRequest('No se puede cambiar el nombre de un rol esencial del sistema.');
      await assertNameAvailable(tx, name, roleId);
      targetName = name;
    }
    const targetDescription = description !== undefined ? description : role.Description;

    await tx.update('Roles', roleId, { Name: targetName, Description: targetDescription }, { returning: false });
    if (permissionIds) await replacePermissions(tx, roleId, permissionIds);
    return toDto({ ...role, Name: targetName, Description: targetDescription });
  });
}

export async function setRolePermissions(roleId, permissionIds, isGlobal) {
  return db.withTransaction(async tx => {
    await findManageableRole(roleId, isGlobal, tx);
    await replacePermissions(tx, roleId, permissionIds);
  });
}

export async function deleteRole(roleId, isGlobal) {
  return db.withTransaction(async tx => {
    const role = await findManageableRole(roleId, isGlobal, tx);
    if (role.RoleType === SYSTEM_ROLE_TYPE || role.Name === SUPER_ADMIN_ROLE) {
      throw forbidden(`El rol "${role.Name}" es esencial para el funcionamiento del sistema y no puede ser eliminado.`);
    }
    const { count } = (await tx.query('SELECT COUNT(*)::int AS count FROM UserRoles WHERE RoleId = @roleId;', { roleId })).recordset[0];
    if (count > 0) {
      throw badRequest(`No se puede eliminar el rol "${role.Name}" porque tiene ${count} usuario(s) asignado(s). Desasigne los usuarios antes de eliminarlo.`);
    }
    await tx.query('DELETE FROM RolePermissions WHERE RoleId = @roleId;', { roleId });
    await tx.query('DELETE FROM Roles WHERE Id = @roleId;', { roleId });
    return role;
  });
}

