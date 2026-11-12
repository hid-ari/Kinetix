import { db } from '../../../core/db.js';
import { notFound } from '../../../core/http.js';

export async function getCompanySummary(companyId) {
  const res = await db.query(`
    SELECT Id, Name, Rnc, ContactEmail, Phone, Address, LogoUrl, IsActive, CreatedAt,
           UserCount, BranchCount, ActiveUserCount, InactiveUserCount
    FROM vw_CompaniesList
    WHERE Id = @companyId
    LIMIT 1;`, { companyId });
  return res.recordset;
}

export async function updateCompany(companyId, values) {
  const updated = await db.update('Companies', companyId, { ...values, UpdatedAt: new Date() },
    { returning: 'Id AS id, Name AS name, Rnc AS rnc, ContactEmail AS email' });
  if (!updated) throw notFound('Empresa no encontrada.');
  return updated;
}

