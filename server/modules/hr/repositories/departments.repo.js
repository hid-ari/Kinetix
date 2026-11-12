
export async function listDepartments(pool, companyId, filters = {}) {
  let query = `
    SELECT d.Id, d.CompanyId, d.BranchId, d.ParentDepartmentId, d.Code, d.Name,
           d.Description, d.ManagerEmployeeId, d.IsActive, d.CreatedAt,
           b.Name AS BranchName,
           p.Name AS ParentDepartmentName,
           CASE WHEN m.Id IS NOT NULL THEN CONCAT(m.FirstName, ' ', m.LastName) ELSE NULL END AS ManagerName,
           (SELECT COUNT(*) FROM HrPositions pos WHERE pos.DepartmentId = d.Id AND pos.IsActive = TRUE) AS PositionsCount,
           (SELECT COUNT(*) FROM HrEmployees e WHERE e.DepartmentId = d.Id AND e.Status = 'Activo') AS ActiveEmployeesCount,
           (SELECT COUNT(*) FROM HrEmployees e WHERE e.DepartmentId = d.Id) AS TotalEmployeesCount
    FROM HrDepartments d
    LEFT JOIN Branches b ON b.Id = d.BranchId
    LEFT JOIN HrDepartments p ON p.Id = d.ParentDepartmentId
    LEFT JOIN HrEmployees m ON m.Id = d.ManagerEmployeeId
    WHERE d.CompanyId = @companyId
  `;

  const req = pool.request().input('companyId', companyId);

  if (filters.isActive !== undefined) {
    query += ' AND d.IsActive = @isActive';
    req.input('isActive', filters.isActive);
  }
  if (filters.branchId) {
    query += ' AND d.BranchId = @branchId';
    req.input('branchId', Number(filters.branchId));
  }
  if (filters.search) {
    query += ' AND (d.Name ILIKE @search OR d.Code ILIKE @search)';
    req.input('search', `%${filters.search.trim()}%`);
  }

  query += ' ORDER BY d.Name ASC;';
  const result = await req.query(query);
  return result.recordset;
}

export async function getDepartmentById(pool, departmentId, companyId) {
  const result = await pool.request()
    .input('id', departmentId)
    .input('companyId', companyId || null)
    .query(`
      SELECT d.Id, d.CompanyId, d.BranchId, d.ParentDepartmentId, d.Code, d.Name,
             d.Description, d.ManagerEmployeeId, d.IsActive, d.CreatedAt,
             b.Name AS BranchName,
             p.Name AS ParentDepartmentName,
             CASE WHEN m.Id IS NOT NULL THEN CONCAT(m.FirstName, ' ', m.LastName) ELSE NULL END AS ManagerName
      FROM HrDepartments d
      LEFT JOIN Branches b ON b.Id = d.BranchId
      LEFT JOIN HrDepartments p ON p.Id = d.ParentDepartmentId
      LEFT JOIN HrEmployees m ON m.Id = d.ManagerEmployeeId
      WHERE d.Id = @id AND (@companyId::int IS NULL OR d.CompanyId = @companyId);
    `);
  return result.recordset[0] || null;
}

export async function checkDepartmentCycle(pool, departmentId, proposedParentId) {
  if (!proposedParentId || Number(departmentId) === Number(proposedParentId)) return true; // cycle with itself

  const result = await pool.request()
    .input('deptId', departmentId)
    .input('targetParentId', proposedParentId)
    .query(`
      WITH RECURSIVE DepartmentHierarchy AS (
        SELECT Id, ParentDepartmentId FROM HrDepartments WHERE Id = @targetParentId
        UNION ALL
        SELECT d.Id, d.ParentDepartmentId
        FROM HrDepartments d
        INNER JOIN DepartmentHierarchy h ON d.Id = h.ParentDepartmentId
      )
      SELECT 1 AS isCycle FROM DepartmentHierarchy WHERE Id = @deptId;
    `);

  return result.recordset.length > 0;
}

export async function createDepartment(pool, data, userId) {
  return pool.insert('HrDepartments', {
    CompanyId: data.companyId,
    BranchId: data.branchId ? Number(data.branchId) : null,
    ParentDepartmentId: data.parentDepartmentId ? Number(data.parentDepartmentId) : null,
    Code: data.code.trim().toUpperCase(),
    Name: data.name.trim(),
    Description: data.description?.trim() || null,
    ManagerEmployeeId: data.managerEmployeeId ? Number(data.managerEmployeeId) : null,
    CreatedBy: userId || null
  }, { returning: 'Id, Code, Name, CompanyId' });
}

export async function updateDepartment(pool, departmentId, data, userId) {
  return pool.update('HrDepartments', departmentId, {
    BranchId: data.branchId ? Number(data.branchId) : null,
    ParentDepartmentId: data.parentDepartmentId ? Number(data.parentDepartmentId) : null,
    Code: data.code.trim().toUpperCase(),
    Name: data.name.trim(),
    Description: data.description?.trim() || null,
    ManagerEmployeeId: data.managerEmployeeId ? Number(data.managerEmployeeId) : null,
    UpdatedAt: new Date(),
    UpdatedBy: userId || null
  }, { returning: 'Id, Code, Name, CompanyId' });
}

export async function toggleDepartmentStatus(pool, departmentId, isActive, userId) {
  return pool.update('HrDepartments', departmentId, {
    IsActive: !!isActive,
    UpdatedAt: new Date(),
    UpdatedBy: userId || null
  }, { returning: 'Id, IsActive' });
}

export async function deleteDepartment(pool, departmentId, companyId) {
  const dept = await getDepartmentById(pool, departmentId, companyId);
  if (!dept) {
    const err = new Error('Departamento no encontrado.');
    err.status = 404;
    throw err;
  }

  // Verificar si tiene subdepartamentos
  const subCount = await pool.count('HrDepartments', { ParentDepartmentId: departmentId });
  if (subCount > 0) {
    const err = new Error(`No se puede eliminar el departamento porque tiene ${subCount} subdepartamento(s) dependiente(s). Reasigne o elimine primero los subdepartamentos.`);
    err.status = 400;
    throw err;
  }

  // Verificar si tiene empleados asignados
  const empCount = await pool.count('HrEmployees', { DepartmentId: departmentId });
  if (empCount > 0) {
    const err = new Error(`No se puede eliminar el departamento porque tiene ${empCount} colaborador(es) asignado(s). Reasigne primero a los colaboradores.`);
    err.status = 400;
    throw err;
  }

  // Verificar si tiene cargos asociados
  const posCount = await pool.count('HrPositions', { DepartmentId: departmentId });
  if (posCount > 0) {
    const err = new Error(`No se puede eliminar el departamento porque tiene ${posCount} cargo(s) vinculado(s). Reasigne o elimine primero los cargos.`);
    err.status = 400;
    throw err;
  }

  // Verificar flujos de aprobación
  const flowCount = await pool.count('HrApprovalFlows', { DepartmentId: departmentId });
  if (flowCount > 0) {
    const err = new Error('No se puede eliminar el departamento porque tiene flujos de aprobación asociados.');
    err.status = 400;
    throw err;
  }

  // Limpiar alcances de acceso asociados y eliminar departamento
  await pool.delete('HrAccessScopes', { DepartmentId: departmentId });
  await pool.delete('HrDepartments', departmentId);

  return { id: departmentId, code: dept.Code, name: dept.Name };
}
