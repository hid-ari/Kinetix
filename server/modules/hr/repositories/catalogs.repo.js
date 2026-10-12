import sql from 'mssql/msnodesqlv8.js';

export async function getCatalogs(pool, companyId) {
  const result = await pool.request()
    .input('companyId', sql.Int, companyId || null)
    .query(`
      SELECT Id, CompanyId, CatalogType, Code, Name, SortOrder, IsActive
      FROM dbo.HrCatalogItems
      WHERE IsActive = 1
        AND (CompanyId IS NULL OR CompanyId = @companyId)
      ORDER BY CatalogType, SortOrder, Name;
    `);

  // Group by catalog type
  const catalogs = {
    ContractType: [],
    WorkModality: [],
    DocumentType: [],
    TerminationReason: []
  };

  for (const item of result.recordset) {
    if (catalogs[item.CatalogType]) {
      catalogs[item.CatalogType].push({
        id: item.Id,
        code: item.Code,
        name: item.Name,
        isCustom: item.CompanyId !== null
      });
    }
  }

  return catalogs;
}

export async function getHrSettings(pool, companyId) {
  const result = await pool.request()
    .input('companyId', sql.Int, companyId)
    .query(`
      SELECT CompanyId, EmployeeCodePrefix, EmployeeCodeDigits, NextEmployeeNumber,
             AllowManualEmployeeCode, BirthdaysEnabled
      FROM dbo.HrSettings
      WHERE CompanyId = @companyId;
    `);

  if (result.recordset[0]) {
    return result.recordset[0];
  }

  // Defaults if not configured
  return {
    CompanyId: companyId,
    EmployeeCodePrefix: 'EMP-',
    EmployeeCodeDigits: 5,
    NextEmployeeNumber: 1,
    AllowManualEmployeeCode: false,
    BirthdaysEnabled: true
  };
}

export async function updateHrSettings(pool, companyId, settings, userId) {
  await pool.request()
    .input('companyId', sql.Int, companyId)
    .input('prefix', sql.NVarChar(10), settings.prefix || 'EMP-')
    .input('digits', sql.TinyInt, settings.digits || 5)
    .input('allowManual', sql.Bit, !!settings.allowManual)
    .input('birthdays', sql.Bit, settings.birthdays !== false)
    .input('userId', sql.NVarChar(450), userId || null)
    .query(`
      MERGE dbo.HrSettings AS target
      USING (SELECT @companyId AS CompanyId) AS source
      ON target.CompanyId = source.CompanyId
      WHEN MATCHED THEN
        UPDATE SET EmployeeCodePrefix = @prefix, EmployeeCodeDigits = @digits,
                   AllowManualEmployeeCode = @allowManual, BirthdaysEnabled = @birthdays,
                   UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @userId
      WHEN NOT MATCHED THEN
        INSERT (CompanyId, EmployeeCodePrefix, EmployeeCodeDigits, NextEmployeeNumber, AllowManualEmployeeCode, BirthdaysEnabled, UpdatedBy)
        VALUES (@companyId, @prefix, @digits, 1, @allowManual, @birthdays, @userId);
    `);
}

/**
 * Generates next unique employee code atomically inside an existing transaction
 */
export async function generateNextEmployeeCode(transaction, companyId) {
  const req = new sql.Request(transaction);
  const result = await req
    .input('companyId', sql.Int, companyId)
    .query(`
      SELECT EmployeeCodePrefix, EmployeeCodeDigits, NextEmployeeNumber
      FROM dbo.HrSettings WITH (UPDLOCK, HOLDLOCK)
      WHERE CompanyId = @companyId;
    `);

  let prefix = 'EMP-';
  let digits = 5;
  let nextNum = 1;

  if (result.recordset[0]) {
    prefix = result.recordset[0].EmployeeCodePrefix;
    digits = result.recordset[0].EmployeeCodeDigits;
    nextNum = result.recordset[0].NextEmployeeNumber;

    await new sql.Request(transaction)
      .input('companyId', sql.Int, companyId)
      .query('UPDATE dbo.HrSettings SET NextEmployeeNumber = NextEmployeeNumber + 1 WHERE CompanyId = @companyId;');
  } else {
    // Insert default settings with Next = 2
    await new sql.Request(transaction)
      .input('companyId', sql.Int, companyId)
      .query('INSERT INTO dbo.HrSettings (CompanyId, NextEmployeeNumber) VALUES (@companyId, 2);');
  }

  const padded = String(nextNum).padStart(digits, '0');
  return `${prefix}${padded}`;
}
