import sql from 'mssql/msnodesqlv8.js';

export async function listDepartments(pool, companyId, filters = {}) {
  let query = `
    SELECT d.Id, d.CompanyId, d.BranchId, d.ParentDepartmentId, d.Code, d.Name,
           d.Description, d.ManagerEmployeeId, d.IsActive, d.CreatedAt,
           b.Name AS BranchName,
           p.Name AS ParentDepartmentName,
           CASE WHEN m.Id IS NOT NULL THEN CONCAT(m.FirstName, N' ', m.LastName) ELSE NULL END AS ManagerName,
           (SELECT COUNT(*) FROM dbo.HrEmployees e WHERE e.DepartmentId = d.Id AND e.Status = N'Activo') AS ActiveEmployeesCount,
           (SELECT COUNT(*) FROM dbo.HrEmployees e WHERE e.DepartmentId = d.Id) AS TotalEmployeesCount
    FROM dbo.HrDepartments d
    LEFT JOIN dbo.Branches b ON b.Id = d.BranchId
    LEFT JOIN dbo.HrDepartments p ON p.Id = d.ParentDepartmentId
    LEFT JOIN dbo.HrEmployees m ON m.Id = d.ManagerEmployeeId
    WHERE d.CompanyId = @companyId
  `;

  const req = pool.request().input('companyId', sql.Int, companyId);

  if (filters.isActive !== undefined) {
    query += ' AND d.IsActive = @isActive';
    req.input('isActive', sql.Bit, filters.isActive);
  }
  if (filters.branchId) {
    query += ' AND d.BranchId = @branchId';
    req.input('branchId', sql.Int, Number(filters.branchId));
  }
  if (filters.search) {
    query += ' AND (d.Name LIKE @search OR d.Code LIKE @search)';
    req.input('search', sql.NVarChar(100), `%${filters.search.trim()}%`);
  }

  query += ' ORDER BY d.Name ASC;';
  const result = await req.query(query);
  return result.recordset;
}

export async function getDepartmentById(pool, departmentId, companyId) {
  const result = await pool.request()
    .input('id', sql.Int, departmentId)
    .input('companyId', sql.Int, companyId || null)
    .query(`
      SELECT d.Id, d.CompanyId, d.BranchId, d.ParentDepartmentId, d.Code, d.Name,
             d.Description, d.ManagerEmployeeId, d.IsActive, d.CreatedAt,
             b.Name AS BranchName,
             p.Name AS ParentDepartmentName,
             CASE WHEN m.Id IS NOT NULL THEN CONCAT(m.FirstName, N' ', m.LastName) ELSE NULL END AS ManagerName
      FROM dbo.HrDepartments d
      LEFT JOIN dbo.Branches b ON b.Id = d.BranchId
      LEFT JOIN dbo.HrDepartments p ON p.Id = d.ParentDepartmentId
      LEFT JOIN dbo.HrEmployees m ON m.Id = d.ManagerEmployeeId
      WHERE d.Id = @id AND (@companyId IS NULL OR d.CompanyId = @companyId);
    `);
  return result.recordset[0] || null;
}

export async function checkDepartmentCycle(pool, departmentId, proposedParentId) {
  if (!proposedParentId || Number(departmentId) === Number(proposedParentId)) return true; // cycle with itself

  const result = await pool.request()
    .input('deptId', sql.Int, departmentId)
    .input('targetParentId', sql.Int, proposedParentId)
    .query(`
      WITH DepartmentHierarchy AS (
        SELECT Id, ParentDepartmentId FROM dbo.HrDepartments WHERE Id = @targetParentId
        UNION ALL
        SELECT d.Id, d.ParentDepartmentId
        FROM dbo.HrDepartments d
        INNER JOIN DepartmentHierarchy h ON d.Id = h.ParentDepartmentId
      )
      SELECT 1 AS isCycle FROM DepartmentHierarchy WHERE Id = @deptId;
    `);

  return result.recordset.length > 0;
}

export async function createDepartment(pool, data, userId) {
  const result = await pool.request()
    .input('companyId', sql.Int, data.companyId)
    .input('branchId', sql.Int, data.branchId ? Number(data.branchId) : null)
    .input('parentDepartmentId', sql.Int, data.parentDepartmentId ? Number(data.parentDepartmentId) : null)
    .input('code', sql.NVarChar(30), data.code.trim().toUpperCase())
    .input('name', sql.NVarChar(150), data.name.trim())
    .input('description', sql.NVarChar(500), data.description?.trim() || null)
    .input('managerEmployeeId', sql.Int, data.managerEmployeeId ? Number(data.managerEmployeeId) : null)
    .input('createdBy', sql.NVarChar(450), userId || null)
    .query(`
      INSERT INTO dbo.HrDepartments (CompanyId, BranchId, ParentDepartmentId, Code, Name, Description, ManagerEmployeeId, CreatedBy)
      OUTPUT INSERTED.Id, INSERTED.Code, INSERTED.Name, INSERTED.CompanyId
      VALUES (@companyId, @branchId, @parentDepartmentId, @code, @name, @description, @managerEmployeeId, @createdBy);
    `);
  return result.recordset[0];
}

export async function updateDepartment(pool, departmentId, data, userId) {
  const result = await pool.request()
    .input('id', sql.Int, departmentId)
    .input('branchId', sql.Int, data.branchId ? Number(data.branchId) : null)
    .input('parentDepartmentId', sql.Int, data.parentDepartmentId ? Number(data.parentDepartmentId) : null)
    .input('code', sql.NVarChar(30), data.code.trim().toUpperCase())
    .input('name', sql.NVarChar(150), data.name.trim())
    .input('description', sql.NVarChar(500), data.description?.trim() || null)
    .input('managerEmployeeId', sql.Int, data.managerEmployeeId ? Number(data.managerEmployeeId) : null)
    .input('updatedBy', sql.NVarChar(450), userId || null)
    .query(`
      UPDATE dbo.HrDepartments
      SET BranchId = @branchId,
          ParentDepartmentId = @parentDepartmentId,
          Code = @code,
          Name = @name,
          Description = @description,
          ManagerEmployeeId = @managerEmployeeId,
          UpdatedAt = SYSUTCDATETIME(),
          UpdatedBy = @updatedBy
      OUTPUT INSERTED.Id, INSERTED.Code, INSERTED.Name, INSERTED.CompanyId
      WHERE Id = @id;
    `);
  return result.recordset[0];
}

export async function toggleDepartmentStatus(pool, departmentId, isActive, userId) {
  const result = await pool.request()
    .input('id', sql.Int, departmentId)
    .input('isActive', sql.Bit, !!isActive)
    .input('updatedBy', sql.NVarChar(450), userId || null)
    .query(`
      UPDATE dbo.HrDepartments
      SET IsActive = @isActive, UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @updatedBy
      OUTPUT INSERTED.Id, INSERTED.IsActive
      WHERE Id = @id;
    `);
  return result.recordset[0];
}
