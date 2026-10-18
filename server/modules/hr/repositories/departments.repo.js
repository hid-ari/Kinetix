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

export async function deleteDepartment(pool, departmentId, companyId) {
  const dept = await getDepartmentById(pool, departmentId, companyId);
  if (!dept) {
    const err = new Error('Departamento no encontrado.');
    err.status = 404;
    throw err;
  }

  // Verificar si tiene subdepartamentos
  const subDeptRes = await pool.request()
    .input('id', sql.Int, departmentId)
    .query('SELECT COUNT(*) AS count FROM dbo.HrDepartments WHERE ParentDepartmentId = @id;');
  if (subDeptRes.recordset[0]?.count > 0) {
    const count = subDeptRes.recordset[0].count;
    const err = new Error(`No se puede eliminar el departamento porque tiene ${count} subdepartamento(s) dependiente(s). Reasigne o elimine primero los subdepartamentos.`);
    err.status = 400;
    throw err;
  }

  // Verificar si tiene empleados asignados
  const empRes = await pool.request()
    .input('id', sql.Int, departmentId)
    .query('SELECT COUNT(*) AS count FROM dbo.HrEmployees WHERE DepartmentId = @id;');
  if (empRes.recordset[0]?.count > 0) {
    const count = empRes.recordset[0].count;
    const err = new Error(`No se puede eliminar el departamento porque tiene ${count} colaborador(es) asignado(s). Reasigne primero a los colaboradores.`);
    err.status = 400;
    throw err;
  }

  // Verificar si tiene cargos asociados
  const posRes = await pool.request()
    .input('id', sql.Int, departmentId)
    .query('SELECT COUNT(*) AS count FROM dbo.HrPositions WHERE DepartmentId = @id;');
  if (posRes.recordset[0]?.count > 0) {
    const count = posRes.recordset[0].count;
    const err = new Error(`No se puede eliminar el departamento porque tiene ${count} cargo(s) vinculado(s). Reasigne o elimine primero los cargos.`);
    err.status = 400;
    throw err;
  }

  // Verificar flujos de aprobación
  const flowRes = await pool.request()
    .input('id', sql.Int, departmentId)
    .query('SELECT COUNT(*) AS count FROM dbo.HrApprovalFlows WHERE DepartmentId = @id;');
  if (flowRes.recordset[0]?.count > 0) {
    const err = new Error('No se puede eliminar el departamento porque tiene flujos de aprobación asociados.');
    err.status = 400;
    throw err;
  }

  // Limpiar alcances de acceso asociados
  await pool.request()
    .input('id', sql.Int, departmentId)
    .query('DELETE FROM dbo.HrAccessScopes WHERE DepartmentId = @id;');

  // Eliminar departamento
  await pool.request()
    .input('id', sql.Int, departmentId)
    .query('DELETE FROM dbo.HrDepartments WHERE Id = @id;');

  return { id: departmentId, code: dept.Code, name: dept.Name };
}
