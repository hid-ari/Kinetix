import { notFound } from '../../../core/http.js';

export async function listEmployeeDocuments(pool, employeeId, { canViewConfidential = false } = {}) {
  let query = `
    SELECT d.Id, d.EmployeeId, d.CompanyId, d.DocumentTypeId, d.Title, d.Description,
           d.FileId, d.VersionNumber, d.RootDocumentId, d.IsCurrent, d.IsConfidential,
           d.IssueDate, d.ExpiryDate, d.CreatedAt,
           t.Name AS DocumentTypeName,
           f.OriginalName, f.MimeType, f.SizeBytes, f.Sha256,
           u.Email AS CreatedByEmail
    FROM HrEmployeeDocuments d
    INNER JOIN HrCatalogItems t ON t.Id = d.DocumentTypeId
    INNER JOIN HrFiles f ON f.Id = d.FileId
    LEFT JOIN UserOrganizations u ON u.UserId = d.CreatedBy
    WHERE d.EmployeeId = @employeeId
      AND d.IsDeleted = FALSE
  `;

  if (!canViewConfidential) {
    query += ' AND d.IsConfidential = FALSE';
  }

  query += ' ORDER BY d.CreatedAt DESC;';

  const result = await pool.request()
    .input('employeeId', Number(employeeId))
    .query(query);

  return result.recordset;
}

export async function getDocumentById(pool, documentId) {
  const result = await pool.request()
    .input('id', Number(documentId))
    .query(`
      SELECT d.Id, d.EmployeeId, d.CompanyId, d.DocumentTypeId, d.Title, d.Description,
             d.FileId, d.VersionNumber, d.RootDocumentId, d.IsCurrent, d.IsConfidential,
             d.IssueDate, d.ExpiryDate, d.IsDeleted,
             f.StorageKey, f.OriginalName, f.MimeType, f.SizeBytes
      FROM HrEmployeeDocuments d
      INNER JOIN HrFiles f ON f.Id = d.FileId
      WHERE d.Id = @id;
    `);
  return result.recordset[0] || null;
}

export async function addEmployeeDocument(pool, {
  employeeId,
  companyId,
  documentTypeId,
  title,
  description,
  fileId,
  isConfidential = false,
  issueDate = null,
  expiryDate = null,
  userId
}) {
  return pool.insert('HrEmployeeDocuments', {
    EmployeeId: Number(employeeId),
    CompanyId: Number(companyId),
    DocumentTypeId: Number(documentTypeId),
    Title: title.trim(),
    Description: description?.trim() || null,
    FileId: fileId,
    VersionNumber: 1,
    IsCurrent: true,
    IsConfidential: !!isConfidential,
    IssueDate: issueDate ? new Date(issueDate) : null,
    ExpiryDate: expiryDate ? new Date(expiryDate) : null,
    CreatedBy: userId || null
  }, { returning: 'Id, Title, VersionNumber, CreatedAt' });
}

export async function addDocumentVersion(pool, {
  rootDocId,
  fileId,
  title,
  description,
  userId
}) {
  return pool.withTransaction(async transaction => {
    const parentRes = await transaction.request()
      .input('id', Number(rootDocId))
      .query(`
        SELECT Id, EmployeeId, CompanyId, DocumentTypeId, Title, Description,
               VersionNumber, RootDocumentId, IsConfidential, IssueDate, ExpiryDate
        FROM HrEmployeeDocuments
        WHERE Id = @id AND IsDeleted = FALSE FOR UPDATE;
      `);

    const parent = parentRes.recordset[0];
    if (!parent) throw notFound('Documento base no encontrado.');

    const rootId = parent.RootDocumentId || parent.Id;

    await transaction.request()
      .input('rootId', rootId)
      .query('UPDATE HrEmployeeDocuments SET IsCurrent = FALSE WHERE Id = @rootId OR RootDocumentId = @rootId;');

    const newVersionNum = parent.VersionNumber + 1;

    return transaction.insert('HrEmployeeDocuments', {
      EmployeeId: parent.EmployeeId,
      CompanyId: parent.CompanyId,
      DocumentTypeId: parent.DocumentTypeId,
      Title: title?.trim() || parent.Title,
      Description: description?.trim() || parent.Description,
      FileId: fileId,
      VersionNumber: newVersionNum,
      RootDocumentId: rootId,
      IsCurrent: true,
      IsConfidential: parent.IsConfidential,
      IssueDate: parent.IssueDate,
      ExpiryDate: parent.ExpiryDate,
      CreatedBy: userId || null
    }, { returning: 'Id, Title, VersionNumber, CreatedAt' });
  });
}

export async function softDeleteDocument(pool, documentId, userId) {
  const res = await pool.update('HrEmployeeDocuments', { Id: Number(documentId), IsDeleted: false }, {
    IsDeleted: true,
    DeletedAt: new Date(),
    DeletedBy: userId || null
  }, { returning: 'Id, Title, EmployeeId, CompanyId' });
  return Array.isArray(res) ? res[0] : (res || null);
}
