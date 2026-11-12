import { db } from '../../../core/db.js';
import { badRequest, forbidden, notFound } from '../../../core/http.js';

const BRANCH_SELECT = `
  SELECT b.Id AS id, b.CompanyId AS "companyId", b.Name AS name, b.Code AS code, c.Name AS company,
         b.Address AS address, b.Phone AS phone, b.Email AS email,
         b.ManagerUserId AS "managerUserId",
         NULLIF(TRIM(COALESCE(m.FirstName, '') || ' ' || COALESCE(m.LastName, '')), '') AS "managerName",
         b.IsActive AS "isActive", b.CreatedAt AS "createdAt",
         (SELECT COUNT(*)::int FROM UserOrganizations AS u WHERE u.BranchId = b.Id) AS "userCount"
  FROM Branches AS b
  INNER JOIN Companies AS c ON c.Id = b.CompanyId
  LEFT JOIN UserOrganizations AS m ON m.UserId = b.ManagerUserId`;

export async function listBranches({ companyId, isGlobal }) {
  const res = await db.query(`${BRANCH_SELECT}
    WHERE (@isGlobal = TRUE OR b.CompanyId = @companyId)
    ORDER BY c.Name, b.Name;`, { companyId: companyId || null, isGlobal });
  return res.recordset;
}

export async function listManagerCandidates(companyId) {
  const res = await db.query(`
    SELECT UserId AS id, (FirstName || ' ' || LastName) AS name, Email AS email
    FROM UserOrganizations
    WHERE CompanyId = @companyId AND IsActive = TRUE
    ORDER BY FirstName, LastName;`, { companyId });
  return res.recordset;
}

export async function listBranchUsers(branchId, { companyId, isGlobal }) {
  const res = await db.query(`
    SELECT u.UserId AS id, (u.FirstName || ' ' || u.LastName) AS name, u.Email AS email, u.IsActive AS "isActive"
    FROM UserOrganizations AS u
    INNER JOIN Branches AS b ON b.Id = u.BranchId
    WHERE u.BranchId = @id AND (@isGlobal = TRUE OR b.CompanyId = @companyId)
    ORDER BY u.FirstName, u.LastName;`, { id: branchId, companyId: companyId || null, isGlobal });
  return res.recordset;
}

/** Devuelve la sucursal dentro del alcance del solicitante o lanza 404. */
async function findScopedBranch(branchId, { companyId, isGlobal }) {
  const where = { Id: branchId };
  if (!isGlobal) where.CompanyId = companyId;
  const branch = await db.findOne('Branches', where, { select: 'Id, CompanyId' });
  if (!branch) throw notFound('Sucursal no encontrada.');
  return branch;
}

/** El encargado debe ser un usuario activo de la misma empresa que la sucursal. */
async function assertManager(managerUserId, companyId) {
  if (!managerUserId) return;
  const res = await db.query(
    'SELECT 1 FROM UserOrganizations WHERE UserId = @userId AND CompanyId = @companyId AND IsActive = TRUE;',
    { userId: managerUserId, companyId });
  if (!res.recordset[0]) throw badRequest('El encargado debe ser un usuario activo de la misma empresa.');
}

export async function createBranch(targetCompanyId, values, { companyId, isGlobal }) {
  const res = await db.query(
    'SELECT Id FROM Companies WHERE Id = @target AND IsActive = TRUE AND (@isGlobal = TRUE OR Id = @companyId);',
    { target: targetCompanyId, companyId: companyId || null, isGlobal });
  if (!res.recordset[0]) throw forbidden('No puedes crear sucursales en esa empresa.');
  await assertManager(values.ManagerUserId, targetCompanyId);
  return db.insert('Branches', { CompanyId: targetCompanyId, ...values },
    { returning: 'Id AS id, Name AS name, Code AS code, CompanyId AS "companyId"' });
}

export async function updateBranch(branchId, values, scope) {
  const branch = await findScopedBranch(branchId, scope);
  await assertManager(values.ManagerUserId, branch.CompanyId);
  const [updated] = await db.update('Branches', { Id: branchId }, { ...values, UpdatedAt: new Date() },
    { returning: 'Id AS id, Name AS name, Code AS code' });
  return { ...updated, companyId: branch.CompanyId };
}

export async function setBranchStatus(branchId, isActive, scope) {
  const branch = await findScopedBranch(branchId, scope);
  const [updated] = await db.update('Branches', { Id: branchId }, { IsActive: isActive, UpdatedAt: new Date() },
    { returning: 'Id AS id, IsActive AS "isActive"' });
  return { ...updated, companyId: branch.CompanyId };
}

