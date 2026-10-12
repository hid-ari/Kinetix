import sql from 'mssql/msnodesqlv8.js';
import { generateNextEmployeeCode, getHrSettings } from './catalogs.repo.js';

export async function listEmployees(pool, {
  companyId,
  userId,
  isGlobal = false,
  isCompanyAdmin = false,
  canViewSalary = false,
  canViewSensitive = false,
  page = 1,
  pageSize = 20,
  search = '',
  status = '',
  departmentId = null,
  branchId = null,
  positionId = null,
  contractTypeId = null
}) {
  const offset = (Math.max(1, page) - 1) * pageSize;

  let where = `WHERE e.CompanyId = @companyId`;

  if (!isGlobal && !isCompanyAdmin) {
    where += ` AND e.Id IN (SELECT EmployeeId FROM dbo.fn_HrVisibleEmployees(@userId, 0, 0))`;
  }

  if (status) {
    where += ` AND e.Status = @status`;
  }
  if (departmentId) {
    where += ` AND e.DepartmentId = @departmentId`;
  }
  if (branchId) {
    where += ` AND e.BranchId = @branchId`;
  }
  if (positionId) {
    where += ` AND e.PositionId = @positionId`;
  }
  if (contractTypeId) {
    where += ` AND e.ContractTypeId = @contractTypeId`;
  }
  if (search) {
    where += ` AND (
      e.FirstName LIKE @search OR
      e.LastName LIKE @search OR
      e.EmployeeCode LIKE @search OR
      e.Email LIKE @search OR
      e.DocumentNumber LIKE @search
    )`;
  }

  const countQuery = `SELECT COUNT(*) AS total FROM dbo.HrEmployees e ${where};`;

  const dataQuery = `
    SELECT e.Id, e.CompanyId, e.BranchId, e.EmployeeCode, e.FirstName, e.LastName,
           CONCAT(e.FirstName, N' ', e.LastName) AS FullName,
           e.DocumentType, e.DocumentNumber, e.Email, e.Phone,
           e.HireDate, e.Status, e.DepartmentId, e.PositionId, e.SupervisorEmployeeId,
           e.ContractTypeId, e.WorkModalityId, e.BaseSalary, e.SalaryCurrency, e.PayFrequency,
           e.PhotoFileId, e.UserId, e.CreatedAt,
           b.Name AS BranchName,
           d.Name AS DepartmentName,
           p.Title AS PositionTitle,
           CONCAT(s.FirstName, N' ', s.LastName) AS SupervisorName,
           c.Name AS ContractTypeName,
           w.Name AS WorkModalityName
    FROM dbo.HrEmployees e
    LEFT JOIN dbo.Branches b ON b.Id = e.BranchId
    LEFT JOIN dbo.HrDepartments d ON d.Id = e.DepartmentId
    LEFT JOIN dbo.HrPositions p ON p.Id = e.PositionId
    LEFT JOIN dbo.HrEmployees s ON s.Id = e.SupervisorEmployeeId
    LEFT JOIN dbo.HrCatalogItems c ON c.Id = e.ContractTypeId
    LEFT JOIN dbo.HrCatalogItems w ON w.Id = e.WorkModalityId
    ${where}
    ORDER BY e.LastName ASC, e.FirstName ASC
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
  `;

  const req = pool.request()
    .input('companyId', sql.Int, companyId)
    .input('userId', sql.NVarChar(450), userId)
    .input('offset', sql.Int, offset)
    .input('pageSize', sql.Int, pageSize);

  if (status) req.input('status', sql.NVarChar(20), status);
  if (departmentId) req.input('departmentId', sql.Int, Number(departmentId));
  if (branchId) req.input('branchId', sql.Int, Number(branchId));
  if (positionId) req.input('positionId', sql.Int, Number(positionId));
  if (contractTypeId) req.input('contractTypeId', sql.Int, Number(contractTypeId));
  if (search) req.input('search', sql.NVarChar(100), `%${search.trim()}%`);

  const [countRes, dataRes] = await Promise.all([
    req.query(countQuery),
    req.query(dataQuery)
  ]);

  const total = countRes.recordset[0].total;

  // Mask sensitive and salary fields if not authorized
  const data = dataRes.recordset.map(emp => sanitizeEmployee(emp, canViewSalary, canViewSensitive));

  return { total, data, page, pageSize };
}

export async function getEmployeeById(pool, employeeId, {
  canViewSalary = false,
  canViewSensitive = false
} = {}) {
  const result = await pool.request()
    .input('id', sql.Int, Number(employeeId))
    .query(`
      SELECT e.Id, e.CompanyId, e.BranchId, e.EmployeeCode, e.FirstName, e.LastName,
             CONCAT(e.FirstName, N' ', e.LastName) AS FullName,
             e.DocumentType, e.DocumentNumber, e.BirthDate, e.Sex, e.Nationality,
             e.MaritalStatus, e.Phone, e.Email, e.Address, e.PhotoFileId,
             e.DepartmentId, e.PositionId, e.SupervisorEmployeeId, e.HireDate,
             e.ContractTypeId, e.WorkModalityId, e.BaseSalary, e.SalaryCurrency, e.PayFrequency,
             e.Status, e.StatusChangedAt, e.TerminationDate, e.TerminationReasonId, e.TerminationNotes,
             e.UserId, e.CreatedAt, e.UpdatedAt,
             b.Name AS BranchName,
             d.Name AS DepartmentName,
             p.Title AS PositionTitle,
             p.HierarchyLevel,
             CONCAT(s.FirstName, N' ', s.LastName) AS SupervisorName,
             c.Name AS ContractTypeName,
             w.Name AS WorkModalityName,
             tr.Name AS TerminationReasonName,
             u.Email AS UserAccountEmail
      FROM dbo.HrEmployees e
      LEFT JOIN dbo.Branches b ON b.Id = e.BranchId
      LEFT JOIN dbo.HrDepartments d ON d.Id = e.DepartmentId
      LEFT JOIN dbo.HrPositions p ON p.Id = e.PositionId
      LEFT JOIN dbo.HrEmployees s ON s.Id = e.SupervisorEmployeeId
      LEFT JOIN dbo.HrCatalogItems c ON c.Id = e.ContractTypeId
      LEFT JOIN dbo.HrCatalogItems w ON w.Id = e.WorkModalityId
      LEFT JOIN dbo.HrCatalogItems tr ON tr.Id = e.TerminationReasonId
      LEFT JOIN dbo.UserOrganizations u ON u.UserId = e.UserId
      WHERE e.Id = @id;
    `);

  const employee = result.recordset[0];
  if (!employee) return null;

  // Emergency contacts
  const contacts = await pool.request()
    .input('employeeId', sql.Int, Number(employeeId))
    .query(`
      SELECT Id, FullName, Relationship, Phone, AltPhone, IsPrimary
      FROM dbo.HrEmergencyContacts
      WHERE EmployeeId = @employeeId
      ORDER BY IsPrimary DESC, FullName ASC;
    `);

  employee.emergencyContacts = contacts.recordset;

  return sanitizeEmployee(employee, canViewSalary, canViewSensitive);
}

export function sanitizeEmployee(emp, canViewSalaryOrOpts, canViewSensitiveArg) {
  let canViewSalary = false;
  let canViewSensitive = false;
  if (typeof canViewSalaryOrOpts === 'object' && canViewSalaryOrOpts !== null) {
    canViewSalary = !!canViewSalaryOrOpts.canViewSalary;
    canViewSensitive = !!canViewSalaryOrOpts.canViewSensitive;
  } else {
    canViewSalary = !!canViewSalaryOrOpts;
    canViewSensitive = !!canViewSensitiveArg;
  }

  const item = { ...emp };
  if (!canViewSalary) {
    delete item.BaseSalary;
    delete item.SalaryCurrency;
    delete item.PayFrequency;
  }
  if (!canViewSensitive) {
    if (item.DocumentNumber) {
      item.DocumentNumber = maskDocument(item.DocumentNumber);
    }
    if (item.Phone) {
      item.Phone = maskPhone(item.Phone);
    }
    delete item.Address;
    delete item.BirthDate;
    delete item.MaritalStatus;
    if (item.emergencyContacts) {
      item.emergencyContacts = item.emergencyContacts.map(c => ({
        ...c,
        Phone: maskPhone(c.Phone),
        AltPhone: c.AltPhone ? maskPhone(c.AltPhone) : null
      }));
    }
  }
  return item;
}

function maskDocument(val) {
  const str = String(val || '');
  if (str.length <= 4) return '****';
  return str.slice(0, 2) + '*'.repeat(str.length - 4) + str.slice(-2);
}

function maskPhone(val) {
  const str = String(val || '');
  if (str.length <= 4) return '****';
  return str.slice(0, 3) + '***' + str.slice(-4);
}

/**
 * Creates an employee with generated or provided unique code and initial hire movement.
 */
export async function createEmployee(pool, data, userId) {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    let employeeCode = data.employeeCode?.trim().toUpperCase();

    if (employeeCode) {
      // Check if manual code allowed
      const settings = await getHrSettings(pool, data.companyId);
      if (!settings.AllowManualEmployeeCode) {
        // If not allowed, generate automated code
        employeeCode = await generateNextEmployeeCode(transaction, data.companyId);
      }
    } else {
      employeeCode = await generateNextEmployeeCode(transaction, data.companyId);
    }

    const insertReq = new sql.Request(transaction);
    const result = await insertReq
      .input('companyId', sql.Int, data.companyId)
      .input('branchId', sql.Int, data.branchId ? Number(data.branchId) : null)
      .input('code', sql.NVarChar(30), employeeCode)
      .input('firstName', sql.NVarChar(100), data.firstName.trim())
      .input('lastName', sql.NVarChar(100), data.lastName.trim())
      .input('docType', sql.NVarChar(20), data.documentType || 'Cedula')
      .input('docNum', sql.NVarChar(30), data.documentNumber.trim())
      .input('birthDate', sql.Date, data.birthDate ? new Date(data.birthDate) : null)
      .input('sex', sql.Char(1), data.sex || null)
      .input('nationality', sql.NVarChar(80), data.nationality?.trim() || null)
      .input('maritalStatus', sql.NVarChar(20), data.maritalStatus || null)
      .input('phone', sql.NVarChar(30), data.phone?.trim() || null)
      .input('email', sql.NVarChar(254), data.email?.trim() || null)
      .input('address', sql.NVarChar(400), data.address?.trim() || null)
      .input('departmentId', sql.Int, data.departmentId ? Number(data.departmentId) : null)
      .input('positionId', sql.Int, data.positionId ? Number(data.positionId) : null)
      .input('supervisorId', sql.Int, data.supervisorEmployeeId ? Number(data.supervisorEmployeeId) : null)
      .input('hireDate', sql.Date, new Date(data.hireDate))
      .input('contractTypeId', sql.Int, data.contractTypeId ? Number(data.contractTypeId) : null)
      .input('workModalityId', sql.Int, data.workModalityId ? Number(data.workModalityId) : null)
      .input('baseSalary', sql.Decimal(18, 2), data.baseSalary != null ? Number(data.baseSalary) : 0)
      .input('salaryCurrency', sql.Char(3), data.salaryCurrency || 'DOP')
      .input('payFrequency', sql.NVarChar(20), data.payFrequency || 'Mensual')
      .input('userId', sql.NVarChar(450), data.userId || null)
      .input('createdBy', sql.NVarChar(450), userId || null)
      .query(`
        INSERT INTO dbo.HrEmployees (
          CompanyId, BranchId, EmployeeCode, FirstName, LastName,
          DocumentType, DocumentNumber, BirthDate, Sex, Nationality,
          MaritalStatus, Phone, Email, Address, DepartmentId, PositionId,
          SupervisorEmployeeId, HireDate, ContractTypeId, WorkModalityId,
          BaseSalary, SalaryCurrency, PayFrequency, UserId, CreatedBy
        )
        OUTPUT INSERTED.Id, INSERTED.EmployeeCode, INSERTED.FirstName, INSERTED.LastName, INSERTED.CompanyId
        VALUES (
          @companyId, @branchId, @code, @firstName, @lastName,
          @docType, @docNum, @birthDate, @sex, @nationality,
          @maritalStatus, @phone, @email, @address, @departmentId, @positionId,
          @supervisorId, @hireDate, @contractTypeId, @workModalityId,
          @baseSalary, @salaryCurrency, @payFrequency, @userId, @createdBy
        );
      `);

    const created = result.recordset[0];

    // Initial hire movement
    await new sql.Request(transaction)
      .input('employeeId', sql.Int, created.Id)
      .input('companyId', sql.Int, data.companyId)
      .input('effectiveDate', sql.Date, new Date(data.hireDate))
      .input('toBranchId', sql.Int, data.branchId ? Number(data.branchId) : null)
      .input('toDeptId', sql.Int, data.departmentId ? Number(data.departmentId) : null)
      .input('toPositionId', sql.Int, data.positionId ? Number(data.positionId) : null)
      .input('toSupervisorId', sql.Int, data.supervisorEmployeeId ? Number(data.supervisorEmployeeId) : null)
      .input('toSalary', sql.Decimal(18, 2), data.baseSalary != null ? Number(data.baseSalary) : 0)
      .input('toStatus', sql.NVarChar(20), 'Activo')
      .input('reason', sql.NVarChar(1000), 'Ingreso inicial a la organización')
      .input('createdBy', sql.NVarChar(450), userId || null)
      .query(`
        INSERT INTO dbo.HrEmployeeMovements (
          EmployeeId, CompanyId, MovementType, EffectiveDate,
          ToBranchId, ToDepartmentId, ToPositionId, ToSupervisorId,
          ToSalary, ToStatus, Reason, CreatedBy
        ) VALUES (
          @employeeId, @companyId, N'Ingreso', @effectiveDate,
          @toBranchId, @toDeptId, @toPositionId, @toSupervisorId,
          @toSalary, @toStatus, @reason, @createdBy
        );
      `);

    // Emergency contacts if provided
    if (Array.isArray(data.emergencyContacts) && data.emergencyContacts.length > 0) {
      for (const contact of data.emergencyContacts) {
        if (!contact.fullName?.trim() || !contact.phone?.trim()) continue;
        await new sql.Request(transaction)
          .input('empId', sql.Int, created.Id)
          .input('name', sql.NVarChar(150), contact.fullName.trim())
          .input('rel', sql.NVarChar(60), contact.relationship?.trim() || null)
          .input('phone', sql.NVarChar(30), contact.phone.trim())
          .input('altPhone', sql.NVarChar(30), contact.altPhone?.trim() || null)
          .input('isPrimary', sql.Bit, !!contact.isPrimary)
          .query(`
            INSERT INTO dbo.HrEmergencyContacts (EmployeeId, FullName, Relationship, Phone, AltPhone, IsPrimary)
            VALUES (@empId, @name, @rel, @phone, @altPhone, @isPrimary);
          `);
      }
    }

    await transaction.commit();
    return created;
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function updateEmployee(pool, employeeId, data, userId) {
  const req = pool.request()
    .input('id', sql.Int, Number(employeeId))
    .input('firstName', sql.NVarChar(100), data.firstName.trim())
    .input('lastName', sql.NVarChar(100), data.lastName.trim())
    .input('docType', sql.NVarChar(20), data.documentType || 'Cedula')
    .input('docNum', sql.NVarChar(30), data.documentNumber.trim())
    .input('birthDate', sql.Date, data.birthDate ? new Date(data.birthDate) : null)
    .input('sex', sql.Char(1), data.sex || null)
    .input('nationality', sql.NVarChar(80), data.nationality?.trim() || null)
    .input('maritalStatus', sql.NVarChar(20), data.maritalStatus || null)
    .input('phone', sql.NVarChar(30), data.phone?.trim() || null)
    .input('email', sql.NVarChar(254), data.email?.trim() || null)
    .input('address', sql.NVarChar(400), data.address?.trim() || null)
    .input('contractTypeId', sql.Int, data.contractTypeId ? Number(data.contractTypeId) : null)
    .input('workModalityId', sql.Int, data.workModalityId ? Number(data.workModalityId) : null)
    .input('payFrequency', sql.NVarChar(20), data.payFrequency || 'Mensual')
    .input('updatedBy', sql.NVarChar(450), userId || null);

  const result = await req.query(`
    UPDATE dbo.HrEmployees
    SET FirstName = @firstName,
        LastName = @lastName,
        DocumentType = @docType,
        DocumentNumber = @docNum,
        BirthDate = @birthDate,
        Sex = @sex,
        Nationality = @nationality,
        MaritalStatus = @maritalStatus,
        Phone = @phone,
        Email = @email,
        Address = @address,
        ContractTypeId = @contractTypeId,
        WorkModalityId = @workModalityId,
        PayFrequency = @payFrequency,
        UpdatedAt = SYSUTCDATETIME(),
        UpdatedBy = @updatedBy
    OUTPUT INSERTED.Id, INSERTED.EmployeeCode, INSERTED.FirstName, INSERTED.LastName, INSERTED.CompanyId
    WHERE Id = @id;
  `);

  return result.recordset[0];
}

export async function setEmployeePhoto(pool, employeeId, fileId) {
  const result = await pool.request()
    .input('id', sql.Int, Number(employeeId))
    .input('photoFileId', fileId)
    .query(`
      UPDATE dbo.HrEmployees
      SET PhotoFileId = @photoFileId, UpdatedAt = SYSUTCDATETIME()
      OUTPUT INSERTED.Id, INSERTED.PhotoFileId
      WHERE Id = @id;
    `);
  return result.recordset[0];
}

export async function linkUserAccount(pool, employeeId, targetUserId, updatedBy) {
  const result = await pool.request()
    .input('id', sql.Int, Number(employeeId))
    .input('userId', targetUserId || null)
    .input('updatedBy', updatedBy || null)
    .query(`
      UPDATE dbo.HrEmployees
      SET UserId = @userId, UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @updatedBy
      OUTPUT INSERTED.Id, INSERTED.UserId
      WHERE Id = @id;
    `);
  return result.recordset[0];
}
