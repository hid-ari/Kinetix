
export async function listPositions(pool, companyId, filters = {}) {
  let query = `
    SELECT p.Id, p.CompanyId, p.DepartmentId, p.Code, p.Title,
           p.Description, p.Responsibilities, p.HierarchyLevel,
           p.SalaryMin, p.SalaryMax, p.IsActive, p.CreatedAt,
           d.Name AS DepartmentName,
           d.Code AS DepartmentCode,
           (SELECT COUNT(*) FROM HrEmployees e WHERE e.PositionId = p.Id AND e.Status = 'Activo') AS ActiveEmployeesCount,
           (SELECT COUNT(*) FROM HrEmployees e WHERE e.PositionId = p.Id) AS TotalEmployeesCount
    FROM HrPositions p
    INNER JOIN HrDepartments d ON d.Id = p.DepartmentId
    WHERE p.CompanyId = @companyId
  `;

  const req = pool.request().input('companyId', companyId);

  if (filters.isActive !== undefined) {
    query += ' AND p.IsActive = @isActive';
    req.input('isActive', filters.isActive);
  }
  if (filters.departmentId) {
    query += ' AND p.DepartmentId = @departmentId';
    req.input('departmentId', Number(filters.departmentId));
  }
  if (filters.search) {
    query += ' AND (p.Title ILIKE @search OR p.Code ILIKE @search)';
    req.input('search', `%${filters.search.trim()}%`);
  }

  query += ' ORDER BY p.HierarchyLevel ASC, p.Title ASC;';
  const result = await req.query(query);
  return result.recordset;
}

export async function getPositionById(pool, positionId, companyId) {
  const result = await pool.request()
    .input('id', positionId)
    .input('companyId', companyId || null)
    .query(`
      SELECT p.Id, p.CompanyId, p.DepartmentId, p.Code, p.Title,
             p.Description, p.Responsibilities, p.HierarchyLevel,
             p.SalaryMin, p.SalaryMax, p.IsActive, p.CreatedAt,
             d.Name AS DepartmentName
      FROM HrPositions p
      INNER JOIN HrDepartments d ON d.Id = p.DepartmentId
      WHERE p.Id = @id AND (@companyId::int IS NULL OR p.CompanyId = @companyId);
    `);
  return result.recordset[0] || null;
}

export async function createPosition(pool, data, userId) {
  return pool.insert('HrPositions', {
    CompanyId: data.companyId,
    DepartmentId: Number(data.departmentId),
    Code: data.code.trim().toUpperCase(),
    Title: data.title.trim(),
    Description: data.description?.trim() || null,
    Responsibilities: data.responsibilities?.trim() || null,
    HierarchyLevel: data.hierarchyLevel ? Number(data.hierarchyLevel) : 5,
    SalaryMin: data.salaryMin != null ? Number(data.salaryMin) : null,
    SalaryMax: data.salaryMax != null ? Number(data.salaryMax) : null,
    CreatedBy: userId || null
  }, { returning: 'Id, Code, Title, CompanyId' });
}

export async function updatePosition(pool, positionId, data, userId) {
  return pool.update('HrPositions', positionId, {
    DepartmentId: Number(data.departmentId),
    Code: data.code.trim().toUpperCase(),
    Title: data.title.trim(),
    Description: data.description?.trim() || null,
    Responsibilities: data.responsibilities?.trim() || null,
    HierarchyLevel: data.hierarchyLevel ? Number(data.hierarchyLevel) : 5,
    SalaryMin: data.salaryMin != null ? Number(data.salaryMin) : null,
    SalaryMax: data.salaryMax != null ? Number(data.salaryMax) : null,
    UpdatedAt: new Date(),
    UpdatedBy: userId || null
  }, { returning: 'Id, Code, Title, CompanyId' });
}

export async function togglePositionStatus(pool, positionId, isActive, userId) {
  return pool.update('HrPositions', positionId, {
    IsActive: !!isActive,
    UpdatedAt: new Date(),
    UpdatedBy: userId || null
  }, { returning: 'Id, IsActive' });
}

export async function deletePosition(pool, positionId, companyId) {
  const pos = await getPositionById(pool, positionId, companyId);
  if (!pos) {
    const err = new Error('Cargo no encontrado.');
    err.status = 404;
    throw err;
  }

  // Verificar si tiene colaboradores asignados a este cargo
  const count = await pool.count('HrEmployees', { PositionId: positionId });
  if (count > 0) {
    const err = new Error(`No se puede eliminar el cargo porque tiene ${count} colaborador(es) asignado(s). Reasigne primero a los colaboradores.`);
    err.status = 400;
    throw err;
  }

  // Eliminar cargo
  await pool.delete('HrPositions', positionId);
  return { id: positionId, code: pos.Code, title: pos.Title };
}
