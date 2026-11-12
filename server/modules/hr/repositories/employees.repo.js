import crypto from 'node:crypto';
import { generateNextEmployeeCode, getHrSettings } from './catalogs.repo.js';
import { formatCedula } from '../validators.js';
import { createPasswordHash } from '../../../core/auth.js';
import { badRequest, notFound } from '../../../core/http.js';

/**
 * Resolves a role ID by name or Spanish alias, strictly preventing privilege escalation to Super Admin.
 */
async function resolveAssignableRoleId(client, roleName = 'Employee') {
  const requested = String(roleName || 'Employee').trim();
  const roleRes = await client.request()
    .input('rName', requested)
    .query(`
      SELECT Id FROM Roles
      WHERE IsActive = TRUE
        AND Name <> 'Super Admin'
        AND (
          Name = @rName
          OR (Name = 'Employee' AND @rName IN ('Empleado', 'Employee'))
          OR (Name = 'Company Admin' AND @rName IN ('Administrador', 'Administrador de Empresa', 'Company Admin'))
        )
      LIMIT 1;
    `);
  return roleRes.recordset[0]?.Id || 4;
}

async function assignUserRole(client, userId, roleId) {
  await client.request()
    .input('uid', userId)
    .input('rid', roleId)
    .query(`
      DELETE FROM UserRoles WHERE UserId = @uid;
      INSERT INTO UserRoles (UserId, RoleId) VALUES (@uid, @rid);
    `);
}

export async function listEmployees(pool, {
  companyId,
  userId,
  isGlobal = false,
  isCompanyAdmin = false,
  canViewAll = false,
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
  const safePage = Math.max(1, Number(page) || 1);
  const safePageSize = Math.min(5000, Math.max(1, Number(pageSize) || 20));
  const offset = (safePage - 1) * safePageSize;

  let where = `WHERE e.CompanyId = @companyId`;

  if (!isGlobal && !isCompanyAdmin && !canViewAll) {
    where += ` AND e.Id IN (SELECT EmployeeId FROM fn_HrVisibleEmployees(@userId, FALSE, FALSE))`;
  }

  if (status) where += ` AND e.Status = @status`;
  if (departmentId) where += ` AND e.DepartmentId = @departmentId`;
  if (branchId) where += ` AND e.BranchId = @branchId`;
  if (positionId) where += ` AND e.PositionId = @positionId`;
  if (contractTypeId) where += ` AND e.ContractTypeId = @contractTypeId`;
  if (search) {
    where += ` AND (
      e.FirstName ILIKE @search OR
      e.LastName ILIKE @search OR
      CONCAT(e.FirstName, ' ', e.LastName) ILIKE @search OR
      e.EmployeeCode ILIKE @search OR
      e.Email ILIKE @search OR
      e.DocumentNumber ILIKE @search
    )`;
  }

  const countQuery = `SELECT COUNT(*) AS total FROM HrEmployees e ${where};`;

  const dataQuery = `
    SELECT e.Id, e.CompanyId, e.BranchId, e.EmployeeCode, e.FirstName, e.LastName,
           CONCAT(e.FirstName, ' ', e.LastName) AS FullName,
           e.DocumentType, e.DocumentNumber, e.Email, e.Phone,
           e.HireDate, e.Status, e.DepartmentId, e.PositionId, e.SupervisorEmployeeId,
           e.ContractTypeId, e.WorkModalityId, e.BaseSalary, e.SalaryCurrency, e.PayFrequency,
           e.PhotoFileId, e.UserId, e.CreatedAt,
           b.Name AS BranchName,
           d.Name AS DepartmentName,
           p.Title AS PositionTitle,
           CONCAT(s.FirstName, ' ', s.LastName) AS SupervisorName,
           c.Name AS ContractTypeName,
           w.Name AS WorkModalityName,
           uo.Email AS UserAccountEmail,
           CASE WHEN uo.IsActive = TRUE THEN 'Activa' WHEN uo.UserId IS NOT NULL THEN 'Inactiva' ELSE NULL END AS AccountStatus,
           COALESCE(ur_role.Name, 'Sin cuenta') AS UserRole
    FROM HrEmployees e
    LEFT JOIN Branches b ON b.Id = e.BranchId
    LEFT JOIN HrDepartments d ON d.Id = e.DepartmentId
    LEFT JOIN HrPositions p ON p.Id = e.PositionId
    LEFT JOIN HrEmployees s ON s.Id = e.SupervisorEmployeeId
    LEFT JOIN HrCatalogItems c ON c.Id = e.ContractTypeId
    LEFT JOIN HrCatalogItems w ON w.Id = e.WorkModalityId
    LEFT JOIN UserOrganizations uo ON uo.UserId = e.UserId
    LEFT JOIN LATERAL (
      SELECT r.Name FROM UserRoles ur
      INNER JOIN Roles r ON r.Id = ur.RoleId
      WHERE ur.UserId = e.UserId ORDER BY r.Name
      LIMIT 1
    ) ur_role ON TRUE
    ${where}
    ORDER BY e.LastName ASC, e.FirstName ASC
    LIMIT @pageSize OFFSET @offset;
  `;

  const req = pool.request()
    .input('companyId', companyId)
    .input('userId', userId)
    .input('offset', offset)
    .input('pageSize', safePageSize);

  if (status) req.input('status', status);
  if (departmentId) req.input('departmentId', Number(departmentId));
  if (branchId) req.input('branchId', Number(branchId));
  if (positionId) req.input('positionId', Number(positionId));
  if (contractTypeId) req.input('contractTypeId', Number(contractTypeId));
  if (search) req.input('search', `%${search.trim()}%`);

  const [countRes, dataRes] = await Promise.all([
    req.query(countQuery),
    req.query(dataQuery)
  ]);

  const total = countRes.recordset[0].total;
  const data = dataRes.recordset.map(emp => sanitizeEmployee(emp, canViewSalary, canViewSensitive));

  return { total, data, page: safePage, pageSize: safePageSize };
}

export async function getEmployeeById(pool, employeeId, {
  canViewSalary = false,
  canViewSensitive = false
} = {}) {
  const empId = Number(employeeId);
  if (!Number.isInteger(empId) || empId <= 0) return null;

  const [result, contacts] = await Promise.all([
    pool.request()
      .input('id', empId)
      .query(`
        SELECT e.Id, e.CompanyId, e.BranchId, e.EmployeeCode, e.FirstName, e.LastName,
               CONCAT(e.FirstName, ' ', e.LastName) AS FullName,
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
               CONCAT(s.FirstName, ' ', s.LastName) AS SupervisorName,
               c.Name AS ContractTypeName,
               w.Name AS WorkModalityName,
               tr.Name AS TerminationReasonName,
               u.Email AS UserAccountEmail,
               CASE WHEN u.IsActive = TRUE THEN 'Activa' WHEN u.UserId IS NOT NULL THEN 'Inactiva' ELSE NULL END AS AccountStatus,
               COALESCE(ur_role.Name, 'Empleado') AS UserRole
        FROM HrEmployees e
        LEFT JOIN Branches b ON b.Id = e.BranchId
        LEFT JOIN HrDepartments d ON d.Id = e.DepartmentId
        LEFT JOIN HrPositions p ON p.Id = e.PositionId
        LEFT JOIN HrEmployees s ON s.Id = e.SupervisorEmployeeId
        LEFT JOIN HrCatalogItems c ON c.Id = e.ContractTypeId
        LEFT JOIN HrCatalogItems w ON w.Id = e.WorkModalityId
        LEFT JOIN HrCatalogItems tr ON tr.Id = e.TerminationReasonId
        LEFT JOIN UserOrganizations u ON u.UserId = e.UserId
        LEFT JOIN LATERAL (
          SELECT r.Name FROM UserRoles ur
          INNER JOIN Roles r ON r.Id = ur.RoleId
          WHERE ur.UserId = e.UserId ORDER BY r.Name
          LIMIT 1
        ) ur_role ON TRUE
        WHERE e.Id = @id;
      `),
    pool.request()
      .input('employeeId', empId)
      .query(`
        SELECT Id, FullName, Relationship, Phone, AltPhone, IsPrimary
        FROM HrEmergencyContacts
        WHERE EmployeeId = @employeeId
        ORDER BY IsPrimary DESC, FullName ASC;
      `)
  ]);

  const employee = result.recordset[0];
  if (!employee) return null;

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
 * Supports atomic linking or creation of Kinetix user account in a single transaction.
 */
export async function createEmployee(pool, data, userId) {
  return pool.withTransaction(async transaction => {
    let employeeCode = data.employeeCode?.trim().toUpperCase();

    if (employeeCode) {
      const settings = await getHrSettings(pool, data.companyId);
      if (!settings.AllowManualEmployeeCode) {
        employeeCode = await generateNextEmployeeCode(transaction, data.companyId);
      }
    } else {
      employeeCode = await generateNextEmployeeCode(transaction, data.companyId);
    }

    let assignedUserId = data.userId || null;

    if (data.existingUserId) {
      assignedUserId = data.existingUserId;
      if (data.userRole) {
        const roleId = await resolveAssignableRoleId(transaction, data.userRole);
        await assignUserRole(transaction, assignedUserId, roleId);
      }
    } else if (data.createUserAccount === true || data.createUserAccount === 'true') {
      const email = data.email?.trim();
      if (!email) {
        throw badRequest('Se requiere un correo electrónico para crear la cuenta de acceso.');
      }

      const existingUserRes = await transaction.request()
        .input('email', email)
        .query('SELECT UserId FROM UserOrganizations WHERE LOWER(Email) = LOWER(@email) LIMIT 1;');
      const existingUser = existingUserRes.recordset[0];
      const roleId = await resolveAssignableRoleId(transaction, data.userRole || 'Employee');

      if (existingUser) {
        assignedUserId = existingUser.UserId;
        await assignUserRole(transaction, assignedUserId, roleId);
      } else {
        assignedUserId = crypto.randomUUID();
        const rawPassword = data.userPassword?.trim() || crypto.randomBytes(16).toString('hex');
        const passHash = createPasswordHash(rawPassword);

        await transaction.insert('UserOrganizations', {
          UserId: assignedUserId,
          CompanyId: data.companyId,
          BranchId: data.branchId ? Number(data.branchId) : null,
          FirstName: data.firstName.trim(),
          LastName: data.lastName.trim(),
          Email: email,
          PasswordHash: passHash,
          Phone: data.phone?.trim() || null,
          IsActive: true
        });

        await transaction.insert('UserRoles', {
          UserId: assignedUserId,
          RoleId: roleId
        }, { returning: false });
      }
    }

    const created = await transaction.insert('HrEmployees', {
      CompanyId: data.companyId,
      BranchId: data.branchId ? Number(data.branchId) : null,
      EmployeeCode: employeeCode,
      FirstName: data.firstName.trim(),
      LastName: data.lastName.trim(),
      DocumentType: data.documentType || 'Cedula',
      DocumentNumber: (data.documentType === 'Cedula' || !data.documentType) ? formatCedula(data.documentNumber) : data.documentNumber.trim(),
      BirthDate: data.birthDate ? new Date(data.birthDate) : null,
      Sex: data.sex || null,
      Nationality: data.nationality?.trim() || null,
      MaritalStatus: data.maritalStatus || null,
      Phone: data.phone?.trim() || null,
      Email: data.email?.trim() || null,
      Address: data.address?.trim() || null,
      DepartmentId: data.departmentId ? Number(data.departmentId) : null,
      PositionId: data.positionId ? Number(data.positionId) : null,
      SupervisorEmployeeId: data.supervisorEmployeeId ? Number(data.supervisorEmployeeId) : null,
      HireDate: new Date(data.hireDate),
      ContractTypeId: data.contractTypeId ? Number(data.contractTypeId) : null,
      WorkModalityId: data.workModalityId ? Number(data.workModalityId) : null,
      BaseSalary: data.baseSalary != null ? Number(data.baseSalary) : 0,
      SalaryCurrency: data.salaryCurrency || 'DOP',
      PayFrequency: data.payFrequency || 'Mensual',
      UserId: assignedUserId,
      CreatedBy: userId || null
    }, { returning: 'Id, EmployeeCode, FirstName, LastName, CompanyId, UserId' });

    await transaction.insert('HrEmployeeMovements', {
      EmployeeId: created.Id,
      CompanyId: data.companyId,
      MovementType: 'Ingreso',
      EffectiveDate: new Date(data.hireDate),
      ToBranchId: data.branchId ? Number(data.branchId) : null,
      ToDepartmentId: data.departmentId ? Number(data.departmentId) : null,
      ToPositionId: data.positionId ? Number(data.positionId) : null,
      ToSupervisorId: data.supervisorEmployeeId ? Number(data.supervisorEmployeeId) : null,
      ToSalary: data.baseSalary != null ? Number(data.baseSalary) : 0,
      ToStatus: 'Activo',
      Reason: 'Ingreso inicial a la organización',
      CreatedBy: userId || null
    });

    if (Array.isArray(data.emergencyContacts) && data.emergencyContacts.length > 0) {
      for (const contact of data.emergencyContacts) {
        if (!contact.fullName?.trim() || !contact.phone?.trim()) continue;
        await transaction.insert('HrEmergencyContacts', {
          EmployeeId: created.Id,
          FullName: contact.fullName.trim(),
          Relationship: contact.relationship?.trim() || null,
          Phone: contact.phone.trim(),
          AltPhone: contact.altPhone?.trim() || null,
          IsPrimary: !!contact.isPrimary
        });
      }
    }

    return created;
  });
}

/**
 * Updates employee personal, contract, and linked user account atomically inside a transaction.
 */
export async function updateEmployee(pool, employeeId, data, userId) {
  const empId = Number(employeeId);
  return pool.withTransaction(async tx => {
    const current = await tx.findOne('HrEmployees', { Id: empId });
    if (!current) throw notFound('Empleado no encontrado.');

    let assignedUserId = current.UserId;

    if (data.existingUserId) {
      assignedUserId = data.existingUserId;
      if (data.userRole) {
        const roleId = await resolveAssignableRoleId(tx, data.userRole);
        await assignUserRole(tx, assignedUserId, roleId);
      }
    } else if (!current.UserId && (data.createUserAccount === true || data.createUserAccount === 'true')) {
      const email = (data.email || current.Email)?.trim();
      if (email) {
        const existingUserRes = await tx.request()
          .input('email', email)
          .query('SELECT UserId FROM UserOrganizations WHERE LOWER(Email) = LOWER(@email) LIMIT 1;');
        const existingUser = existingUserRes.recordset[0];
        const roleId = await resolveAssignableRoleId(tx, data.userRole || 'Employee');

        if (existingUser) {
          assignedUserId = existingUser.UserId;
          await assignUserRole(tx, assignedUserId, roleId);
        } else {
          assignedUserId = crypto.randomUUID();
          const passHash = createPasswordHash(data.userPassword?.trim() || crypto.randomBytes(16).toString('hex'));
          await tx.insert('UserOrganizations', {
            UserId: assignedUserId,
            CompanyId: current.CompanyId,
            BranchId: current.BranchId,
            FirstName: data.firstName?.trim() || current.FirstName,
            LastName: data.lastName?.trim() || current.LastName,
            Email: email,
            PasswordHash: passHash,
            Phone: data.phone?.trim() || current.Phone,
            IsActive: true
          });
          await tx.insert('UserRoles', { UserId: assignedUserId, RoleId: roleId }, { returning: false });
        }
      }
    } else if (current.UserId) {
      if (data.userRole) {
        const roleId = await resolveAssignableRoleId(tx, data.userRole);
        await assignUserRole(tx, current.UserId, roleId);
      }
      if (data.userPassword?.trim() && data.userPassword.trim().length >= 8) {
        await tx.update('UserOrganizations', { UserId: current.UserId }, {
          PasswordHash: createPasswordHash(data.userPassword.trim()),
          UpdatedAt: new Date()
        });
      }
      await tx.update('UserOrganizations', { UserId: current.UserId }, {
        FirstName: data.firstName ? data.firstName.trim() : current.FirstName,
        LastName: data.lastName ? data.lastName.trim() : current.LastName,
        Email: data.email ? data.email.trim() : current.Email,
        Phone: data.phone ? data.phone.trim() : current.Phone,
        UpdatedAt: new Date()
      });
    }

    return tx.update('HrEmployees', empId, {
      FirstName: data.firstName ? data.firstName.trim() : current.FirstName,
      LastName: data.lastName ? data.lastName.trim() : current.LastName,
      DocumentType: data.documentType || current.DocumentType,
      DocumentNumber: data.documentNumber ? ((data.documentType === 'Cedula' || !data.documentType) ? formatCedula(data.documentNumber) : data.documentNumber.trim()) : current.DocumentNumber,
      BirthDate: data.birthDate ? new Date(data.birthDate) : current.BirthDate,
      Sex: data.sex !== undefined ? data.sex : current.Sex,
      Nationality: data.nationality !== undefined ? data.nationality.trim() : current.Nationality,
      MaritalStatus: data.maritalStatus !== undefined ? data.maritalStatus : current.MaritalStatus,
      Phone: data.phone !== undefined ? data.phone.trim() : current.Phone,
      Email: data.email !== undefined ? data.email.trim() : current.Email,
      Address: data.address !== undefined ? data.address.trim() : current.Address,
      ContractTypeId: data.contractTypeId ? Number(data.contractTypeId) : current.ContractTypeId,
      WorkModalityId: data.workModalityId ? Number(data.workModalityId) : current.WorkModalityId,
      PayFrequency: data.payFrequency || current.PayFrequency,
      UserId: assignedUserId,
      UpdatedAt: new Date(),
      UpdatedBy: userId || null
    }, { returning: 'Id, EmployeeCode, FirstName, LastName, CompanyId, UserId' });
  });
}

export async function setEmployeePhoto(pool, employeeId, fileId) {
  return pool.update('HrEmployees', Number(employeeId), {
    PhotoFileId: fileId,
    UpdatedAt: new Date()
  }, { returning: 'Id, PhotoFileId' });
}

export async function linkUserAccount(pool, employeeId, targetUserId, updatedBy) {
  return pool.update('HrEmployees', Number(employeeId), {
    UserId: targetUserId || null,
    UpdatedAt: new Date(),
    UpdatedBy: updatedBy || null
  }, { returning: 'Id, UserId' });
}
