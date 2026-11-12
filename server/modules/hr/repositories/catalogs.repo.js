
export async function getCatalogs(pool, companyId) {
  const result = await pool.request()
    .input('companyId', companyId || null)
    .query(`
      SELECT Id, CompanyId, CatalogType, Code, Name, SortOrder, IsActive
      FROM HrCatalogItems
      WHERE IsActive = TRUE
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
  const row = await pool.findOne('HrSettings', { CompanyId: companyId });
  if (row) return row;

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
    .input('companyId', companyId)
    .input('prefix', settings.prefix || 'EMP-')
    .input('digits', settings.digits || 5)
    .input('allowManual', !!settings.allowManual)
    .input('birthdays', settings.birthdays !== false)
    .input('userId', userId || null)
    .query(`
      INSERT INTO HrSettings (CompanyId, EmployeeCodePrefix, EmployeeCodeDigits, NextEmployeeNumber, AllowManualEmployeeCode, BirthdaysEnabled, UpdatedBy)
      VALUES (@companyId, @prefix, @digits, 1, @allowManual, @birthdays, @userId)
      ON CONFLICT (CompanyId) DO UPDATE SET
        EmployeeCodePrefix = EXCLUDED.EmployeeCodePrefix,
        EmployeeCodeDigits = EXCLUDED.EmployeeCodeDigits,
        AllowManualEmployeeCode = EXCLUDED.AllowManualEmployeeCode,
        BirthdaysEnabled = EXCLUDED.BirthdaysEnabled,
        UpdatedAt = now(),
        UpdatedBy = EXCLUDED.UpdatedBy;
    `);
}

/**
 * Generates next unique employee code atomically inside an existing transaction
 */
export async function generateNextEmployeeCode(transaction, companyId) {
  const req = transaction.request();
  const result = await req
    .input('companyId', companyId)
    .query(`
      SELECT EmployeeCodePrefix, EmployeeCodeDigits, NextEmployeeNumber
      FROM HrSettings
      WHERE CompanyId = @companyId FOR UPDATE;
    `);

  let prefix = 'EMP-';
  let digits = 5;
  let nextNum = 1;

  if (result.recordset[0]) {
    prefix = result.recordset[0].EmployeeCodePrefix;
    digits = result.recordset[0].EmployeeCodeDigits;
    nextNum = result.recordset[0].NextEmployeeNumber;

    await transaction.request()
      .input('companyId', companyId)
      .query('UPDATE HrSettings SET NextEmployeeNumber = NextEmployeeNumber + 1 WHERE CompanyId = @companyId;');
  } else {
    // Insert default settings with Next = 2
    await transaction.insert('HrSettings', { CompanyId: companyId, NextEmployeeNumber: 2 });
  }

  const padded = String(nextNum).padStart(digits, '0');
  return `${prefix}${padded}`;
}
