import sql from 'mssql/msnodesqlv8.js';

export async function listEmployeeDocuments(pool, employeeId, { canViewConfidential = false } = {}) {
  let query = `
    SELECT d.Id, d.EmployeeId, d.CompanyId, d.DocumentTypeId, d.Title, d.Description,
           d.FileId, d.VersionNumber, d.RootDocumentId, d.IsCurrent, d.IsConfidential,
           d.IssueDate, d.ExpiryDate, d.CreatedAt,
           t.Name AS DocumentTypeName,
           f.OriginalName, f.MimeType, f.SizeBytes, f.Sha256,
           u.Email AS CreatedByEmail
    FROM dbo.HrEmployeeDocuments d
    INNER JOIN dbo.HrCatalogItems t ON t.Id = d.DocumentTypeId
    INNER JOIN dbo.HrFiles f ON f.Id = d.FileId
    LEFT JOIN dbo.UserOrganizations u ON u.UserId = d.CreatedBy
    WHERE d.EmployeeId = @employeeId
      AND d.IsDeleted = 0
  `;

  if (!canViewConfidential) {
    query += ' AND d.IsConfidential = 0';
  }

  query += ' ORDER BY d.CreatedAt DESC;';

  const result = await pool.request()
    .input('employeeId', sql.Int, Number(employeeId))
    .query(query);

  return result.recordset;
}

export async function getDocumentById(pool, documentId) {
  const result = await pool.request()
    .input('id', sql.Int, Number(documentId))
    .query(`
      SELECT d.Id, d.EmployeeId, d.CompanyId, d.DocumentTypeId, d.Title, d.Description,
             d.FileId, d.VersionNumber, d.RootDocumentId, d.IsCurrent, d.IsConfidential,
             d.IssueDate, d.ExpiryDate, d.IsDeleted,
             f.StorageKey, f.OriginalName, f.MimeType, f.SizeBytes
      FROM dbo.HrEmployeeDocuments d
      INNER JOIN dbo.HrFiles f ON f.Id = d.FileId
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
  const result = await pool.request()
    .input('employeeId', sql.Int, Number(employeeId))
    .input('companyId', sql.Int, Number(companyId))
    .input('typeId', sql.Int, Number(documentTypeId))
    .input('title', sql.NVarChar(200), title.trim())
    .input('description', sql.NVarChar(500), description?.trim() || null)
    .input('fileId', fileId)
    .input('confidential', sql.Bit, !!isConfidential)
    .input('issueDate', sql.Date, issueDate ? new Date(issueDate) : null)
    .input('expiryDate', sql.Date, expiryDate ? new Date(expiryDate) : null)
    .input('userId', sql.NVarChar(450), userId || null)
    .query(`
      INSERT INTO dbo.HrEmployeeDocuments (
        EmployeeId, CompanyId, DocumentTypeId, Title, Description,
        FileId, VersionNumber, IsCurrent, IsConfidential, IssueDate, ExpiryDate, CreatedBy
      )
      OUTPUT INSERTED.Id, INSERTED.Title, INSERTED.VersionNumber, INSERTED.CreatedAt
      VALUES (
        @employeeId, @companyId, @typeId, @title, @description,
        @fileId, 1, 1, @confidential, @issueDate, @expiryDate, @userId
      );
    `);

  return result.recordset[0];
}

export async function addDocumentVersion(pool, {
  rootDocId,
  fileId,
  title,
  description,
  userId
}) {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const parentRes = await new sql.Request(transaction)
      .input('id', sql.Int, Number(rootDocId))
      .query(`
        SELECT Id, EmployeeId, CompanyId, DocumentTypeId, Title, Description,
               VersionNumber, RootDocumentId, IsConfidential, IssueDate, ExpiryDate
        FROM dbo.HrEmployeeDocuments WITH (UPDLOCK)
        WHERE Id = @id AND IsDeleted = 0;
      `);

    const parent = parentRes.recordset[0];
    if (!parent) throw new Error('Documento base no encontrado.');

    const rootId = parent.RootDocumentId || parent.Id;

    // Mark previous current versions as not current
    await new sql.Request(transaction)
      .input('rootId', sql.Int, rootId)
      .query('UPDATE dbo.HrEmployeeDocuments SET IsCurrent = 0 WHERE Id = @rootId OR RootDocumentId = @rootId;');

    const newVersionNum = parent.VersionNumber + 1;

    const result = await new sql.Request(transaction)
      .input('employeeId', sql.Int, parent.EmployeeId)
      .input('companyId', sql.Int, parent.CompanyId)
      .input('typeId', sql.Int, parent.DocumentTypeId)
      .input('title', sql.NVarChar(200), title?.trim() || parent.Title)
      .input('description', sql.NVarChar(500), description?.trim() || parent.Description)
      .input('fileId', fileId)
      .input('verNum', sql.Int, newVersionNum)
      .input('rootId', sql.Int, rootId)
      .input('confidential', sql.Bit, parent.IsConfidential)
      .input('issueDate', sql.Date, parent.IssueDate)
      .input('expiryDate', sql.Date, parent.ExpiryDate)
      .input('userId', sql.NVarChar(450), userId || null)
      .query(`
        INSERT INTO dbo.HrEmployeeDocuments (
          EmployeeId, CompanyId, DocumentTypeId, Title, Description,
          FileId, VersionNumber, RootDocumentId, IsCurrent, IsConfidential, IssueDate, ExpiryDate, CreatedBy
        )
        OUTPUT INSERTED.Id, INSERTED.Title, INSERTED.VersionNumber, INSERTED.CreatedAt
        VALUES (
          @employeeId, @companyId, @typeId, @title, @description,
          @fileId, @verNum, @rootId, 1, @confidential, @issueDate, @expiryDate, @userId
        );
      `);

    await transaction.commit();
    return result.recordset[0];
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function softDeleteDocument(pool, documentId, userId) {
  const result = await pool.request()
    .input('id', sql.Int, Number(documentId))
    .input('userId', sql.NVarChar(450), userId || null)
    .query(`
      UPDATE dbo.HrEmployeeDocuments
      SET IsDeleted = 1, DeletedAt = SYSUTCDATETIME(), DeletedBy = @userId
      OUTPUT INSERTED.Id, INSERTED.Title, INSERTED.EmployeeId, INSERTED.CompanyId
      WHERE Id = @id AND IsDeleted = 0;
    `);
  return result.recordset[0] || null;
}
