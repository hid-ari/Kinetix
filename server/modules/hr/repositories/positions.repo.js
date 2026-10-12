import sql from 'mssql/msnodesqlv8.js';

export async function listPositions(pool, companyId, filters = {}) {
  let query = `
    SELECT p.Id, p.CompanyId, p.DepartmentId, p.Code, p.Title,
           p.Description, p.Responsibilities, p.HierarchyLevel,
           p.SalaryMin, p.SalaryMax, p.IsActive, p.CreatedAt,
           d.Name AS DepartmentName,
           d.Code AS DepartmentCode,
           (SELECT COUNT(*) FROM dbo.HrEmployees e WHERE e.PositionId = p.Id AND e.Status = N'Activo') AS ActiveEmployeesCount,
           (SELECT COUNT(*) FROM dbo.HrEmployees e WHERE e.PositionId = p.Id) AS TotalEmployeesCount
    FROM dbo.HrPositions p
    INNER JOIN dbo.HrDepartments d ON d.Id = p.DepartmentId
    WHERE p.CompanyId = @companyId
  `;

  const req = pool.request().input('companyId', sql.Int, companyId);

  if (filters.isActive !== undefined) {
    query += ' AND p.IsActive = @isActive';
    req.input('isActive', sql.Bit, filters.isActive);
  }
  if (filters.departmentId) {
    query += ' AND p.DepartmentId = @departmentId';
    req.input('departmentId', sql.Int, Number(filters.departmentId));
  }
  if (filters.search) {
    query += ' AND (p.Title LIKE @search OR p.Code LIKE @search)';
    req.input('search', sql.NVarChar(100), `%${filters.search.trim()}%`);
  }

  query += ' ORDER BY p.HierarchyLevel ASC, p.Title ASC;';
  const result = await req.query(query);
  return result.recordset;
}

export async function getPositionById(pool, positionId, companyId) {
  const result = await pool.request()
    .input('id', sql.Int, positionId)
    .input('companyId', sql.Int, companyId || null)
    .query(`
      SELECT p.Id, p.CompanyId, p.DepartmentId, p.Code, p.Title,
             p.Description, p.Responsibilities, p.HierarchyLevel,
             p.SalaryMin, p.SalaryMax, p.IsActive, p.CreatedAt,
             d.Name AS DepartmentName
      FROM dbo.HrPositions p
      INNER JOIN dbo.HrDepartments d ON d.Id = p.DepartmentId
      WHERE p.Id = @id AND (@companyId IS NULL OR p.CompanyId = @companyId);
    `);
  return result.recordset[0] || null;
}

export async function createPosition(pool, data, userId) {
  const result = await pool.request()
    .input('companyId', sql.Int, data.companyId)
    .input('departmentId', sql.Int, Number(data.departmentId))
    .input('code', sql.NVarChar(30), data.code.trim().toUpperCase())
    .input('title', sql.NVarChar(150), data.title.trim())
    .input('description', sql.NVarChar(1000), data.description?.trim() || null)
    .input('responsibilities', sql.NVarChar(sql.MAX), data.responsibilities?.trim() || null)
    .input('hierarchyLevel', sql.TinyInt, data.hierarchyLevel ? Number(data.hierarchyLevel) : 5)
    .input('salaryMin', sql.Decimal(18, 2), data.salaryMin != null ? Number(data.salaryMin) : null)
    .input('salaryMax', sql.Decimal(18, 2), data.salaryMax != null ? Number(data.salaryMax) : null)
    .input('createdBy', sql.NVarChar(450), userId || null)
    .query(`
      INSERT INTO dbo.HrPositions (CompanyId, DepartmentId, Code, Title, Description, Responsibilities, HierarchyLevel, SalaryMin, SalaryMax, CreatedBy)
      OUTPUT INSERTED.Id, INSERTED.Code, INSERTED.Title, INSERTED.CompanyId
      VALUES (@companyId, @departmentId, @code, @title, @description, @responsibilities, @hierarchyLevel, @salaryMin, @salaryMax, @createdBy);
    `);
  return result.recordset[0];
}

export async function updatePosition(pool, positionId, data, userId) {
  const result = await pool.request()
    .input('id', sql.Int, positionId)
    .input('departmentId', sql.Int, Number(data.departmentId))
    .input('code', sql.NVarChar(30), data.code.trim().toUpperCase())
    .input('title', sql.NVarChar(150), data.title.trim())
    .input('description', sql.NVarChar(1000), data.description?.trim() || null)
    .input('responsibilities', sql.NVarChar(sql.MAX), data.responsibilities?.trim() || null)
    .input('hierarchyLevel', sql.TinyInt, data.hierarchyLevel ? Number(data.hierarchyLevel) : 5)
    .input('salaryMin', sql.Decimal(18, 2), data.salaryMin != null ? Number(data.salaryMin) : null)
    .input('salaryMax', sql.Decimal(18, 2), data.salaryMax != null ? Number(data.salaryMax) : null)
    .input('updatedBy', sql.NVarChar(450), userId || null)
    .query(`
      UPDATE dbo.HrPositions
      SET DepartmentId = @departmentId,
          Code = @code,
          Title = @title,
          Description = @description,
          Responsibilities = @responsibilities,
          HierarchyLevel = @hierarchyLevel,
          SalaryMin = @salaryMin,
          SalaryMax = @salaryMax,
          UpdatedAt = SYSUTCDATETIME(),
          UpdatedBy = @updatedBy
      OUTPUT INSERTED.Id, INSERTED.Code, INSERTED.Title, INSERTED.CompanyId
      WHERE Id = @id;
    `);
  return result.recordset[0];
}

export async function togglePositionStatus(pool, positionId, isActive, userId) {
  const result = await pool.request()
    .input('id', sql.Int, positionId)
    .input('isActive', sql.Bit, !!isActive)
    .input('updatedBy', sql.NVarChar(450), userId || null)
    .query(`
      UPDATE dbo.HrPositions
      SET IsActive = @isActive, UpdatedAt = SYSUTCDATETIME(), UpdatedBy = @updatedBy
      OUTPUT INSERTED.Id, INSERTED.IsActive
      WHERE Id = @id;
    `);
  return result.recordset[0];
}
