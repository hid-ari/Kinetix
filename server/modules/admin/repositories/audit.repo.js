import { db } from '../../../core/db.js';

/** Límite de seguridad para no devolver tablas de auditoría completas al navegador. */
export const AUDIT_LIST_LIMIT = 500;
export const AUDIT_EXPORT_LIMIT = 50000;

export async function listAuditLogs({ search, module, action }, { companyId, isGlobal }, limit = AUDIT_LIST_LIMIT) {
  const res = await db.query(`
    SELECT a.Id AS id, a.CreatedAt, a.ActionName AS action,
           a.ModuleName AS module, a.EntityName AS entity,
           a.EntityId AS record, a.IpAddress AS ip,
           COALESCE(NULLIF(TRIM(CONCAT(u.FirstName, ' ', u.LastName)), ''), 'Sistema') AS "userName"
    FROM AuditLogs AS a
    LEFT JOIN UserOrganizations AS u ON u.UserId = a.UserId
    WHERE (@isGlobal = TRUE OR a.CompanyId = @companyId)
      AND (@search = '' OR CONCAT_WS(' ', u.FirstName, u.LastName, a.EntityId) ILIKE '%' || @search || '%')
      AND (@module::text IS NULL OR a.ModuleName = @module)
      AND (@action::text IS NULL OR a.ActionName = @action)
    ORDER BY a.CreatedAt DESC
    LIMIT @limit;`,
    { search, module, action, companyId: companyId || null, isGlobal, limit });
  return res.recordset;
}

const csvEscape = value => `"${String(value ?? '').replace(/"/g, '""')}"`;

export function toAuditCsv(rows) {
  const header = 'ID,Fecha,Usuario,Acción,Módulo,Entidad,Registro,IP';
  const lines = rows.map(r =>
    [r.id, r.CreatedAt?.toISOString?.() ?? '', r.userName, r.action, r.module, r.entity, r.record, r.ip]
      .map(csvEscape).join(','));
  return '\uFEFF' + [header, ...lines].join('\n');
}

