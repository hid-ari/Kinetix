/**
 * Data Access Layer para Contactos Financieros (Clientes y Proveedores).
 */

export async function getContacts(pool, { companyId, isGlobal }) {
  const result = await pool.request()
    .input('companyId', companyId)
    .input('isGlobal', isGlobal)
    .query(`
      SELECT Id AS id, ContactType AS type, Name AS name, TaxId AS taxId, Email AS email, Phone AS phone, IsActive AS isActive
      FROM FinanceContacts
      WHERE IsActive = TRUE AND (@isGlobal = TRUE OR CompanyId = @companyId)
      ORDER BY Name;
    `);
  return result.recordset;
}

export async function createContact(pool, { companyId, type, name, taxId, email, phone }) {
  return pool.insert('FinanceContacts', {
    CompanyId: companyId,
    ContactType: type,
    Name: name.trim(),
    TaxId: taxId?.trim() || null,
    Email: email?.trim() || null,
    Phone: phone?.trim() || null
  }, { returning: 'Id AS id, ContactType AS type, Name AS name' });
}
