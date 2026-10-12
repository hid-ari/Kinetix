import sql from 'mssql/msnodesqlv8.js';

export async function listEmployeeMovements(pool, employeeId) {
  const result = await pool.request()
    .input('employeeId', sql.Int, Number(employeeId))
    .query(`
      SELECT m.Id, m.EmployeeId, m.CompanyId, m.MovementType, m.EffectiveDate,
             m.FromBranchId, m.ToBranchId,
             m.FromDepartmentId, m.ToDepartmentId,
             m.FromPositionId, m.ToPositionId,
             m.FromSupervisorId, m.ToSupervisorId,
             m.FromSalary, m.ToSalary,
             m.FromStatus, m.ToStatus,
             m.Reason, m.CreatedAt,
             fb.Name AS FromBranchName, tb.Name AS ToBranchName,
             fd.Name AS FromDepartmentName, td.Name AS ToDepartmentName,
             fp.Title AS FromPositionTitle, tp.Title AS ToPositionTitle,
             CONCAT(fs.FirstName, N' ', fs.LastName) AS FromSupervisorName,
             CONCAT(ts.FirstName, N' ', ts.LastName) AS ToSupervisorName,
             u.Email AS CreatedByEmail
      FROM dbo.HrEmployeeMovements m
      LEFT JOIN dbo.Branches fb ON fb.Id = m.FromBranchId
      LEFT JOIN dbo.Branches tb ON tb.Id = m.ToBranchId
      LEFT JOIN dbo.HrDepartments fd ON fd.Id = m.FromDepartmentId
      LEFT JOIN dbo.HrDepartments td ON td.Id = m.ToDepartmentId
      LEFT JOIN dbo.HrPositions fp ON fp.Id = m.FromPositionId
      LEFT JOIN dbo.HrPositions tp ON tp.Id = m.ToPositionId
      LEFT JOIN dbo.HrEmployees fs ON fs.Id = m.FromSupervisorId
      LEFT JOIN dbo.HrEmployees ts ON ts.Id = m.ToSupervisorId
      LEFT JOIN dbo.UserOrganizations u ON u.UserId = m.CreatedBy
      WHERE m.EmployeeId = @employeeId
      ORDER BY m.EffectiveDate DESC, m.Id DESC;
    `);
  return result.recordset;
}

/**
 * Executes a structured labor movement inside a transaction and updates the employee record.
 */
export async function executeLaborMovement(pool, {
  employeeId,
  companyId,
  movementType,
  effectiveDate,
  toBranchId,
  toDepartmentId,
  toPositionId,
  toSupervisorId,
  toSalary,
  toStatus,
  terminationReasonId,
  terminationNotes,
  reason,
  userId
}) {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    // 1. Fetch current employee state with lock
    const currentRes = await new sql.Request(transaction)
      .input('id', sql.Int, Number(employeeId))
      .query(`
        SELECT Id, CompanyId, BranchId, DepartmentId, PositionId,
               SupervisorEmployeeId, BaseSalary, Status
        FROM dbo.HrEmployees WITH (UPDLOCK, HOLDLOCK)
        WHERE Id = @id;
      `);

    const current = currentRes.recordset[0];
    if (!current) {
      throw new Error('Empleado no encontrado.');
    }

    const effDate = effectiveDate ? new Date(effectiveDate) : new Date();

    const fromBranchId = current.BranchId;
    const fromDepartmentId = current.DepartmentId;
    const fromPositionId = current.PositionId;
    const fromSupervisorId = current.SupervisorEmployeeId;
    const fromSalary = current.BaseSalary;
    const fromStatus = current.Status;

    // Determine target values (if not specified, keep current)
    const targetBranchId = toBranchId !== undefined ? (toBranchId ? Number(toBranchId) : null) : fromBranchId;
    const targetDepartmentId = toDepartmentId !== undefined ? (toDepartmentId ? Number(toDepartmentId) : null) : fromDepartmentId;
    const targetPositionId = toPositionId !== undefined ? (toPositionId ? Number(toPositionId) : null) : fromPositionId;
    const targetSupervisorId = toSupervisorId !== undefined ? (toSupervisorId ? Number(toSupervisorId) : null) : fromSupervisorId;
    const targetSalary = toSalary !== undefined ? Number(toSalary) : fromSalary;
    const targetStatus = toStatus || fromStatus;

    // 2. Insert into movements history
    const movReq = new sql.Request(transaction)
      .input('employeeId', sql.Int, current.Id)
      .input('companyId', sql.Int, current.CompanyId)
      .input('type', sql.NVarChar(30), movementType)
      .input('date', sql.Date, effDate)
      .input('fromBranch', sql.Int, fromBranchId)
      .input('toBranch', sql.Int, targetBranchId)
      .input('fromDept', sql.Int, fromDepartmentId)
      .input('toDept', sql.Int, targetDepartmentId)
      .input('fromPos', sql.Int, fromPositionId)
      .input('toPos', sql.Int, targetPositionId)
      .input('fromSup', sql.Int, fromSupervisorId)
      .input('toSup', sql.Int, targetSupervisorId)
      .input('fromSal', sql.Decimal(18, 2), fromSalary)
      .input('toSal', sql.Decimal(18, 2), targetSalary)
      .input('fromStat', sql.NVarChar(20), fromStatus)
      .input('toStat', sql.NVarChar(20), targetStatus)
      .input('reason', sql.NVarChar(1000), reason || null)
      .input('userId', sql.NVarChar(450), userId || null);

    const movResult = await movReq.query(`
      INSERT INTO dbo.HrEmployeeMovements (
        EmployeeId, CompanyId, MovementType, EffectiveDate,
        FromBranchId, ToBranchId, FromDepartmentId, ToDepartmentId,
        FromPositionId, ToPositionId, FromSupervisorId, ToSupervisorId,
        FromSalary, ToSalary, FromStatus, ToStatus, Reason, CreatedBy
      )
      OUTPUT INSERTED.Id, INSERTED.MovementType, INSERTED.EffectiveDate
      VALUES (
        @employeeId, @companyId, @type, @date,
        @fromBranch, @toBranch, @fromDept, @toDept,
        @fromPos, @toPos, @fromSup, @toSup,
        @fromSal, @toSal, @fromStat, @toStat, @reason, @userId
      );
    `);

    // 3. Update employee record
    const updReq = new sql.Request(transaction)
      .input('id', sql.Int, current.Id)
      .input('branchId', sql.Int, targetBranchId)
      .input('deptId', sql.Int, targetDepartmentId)
      .input('posId', sql.Int, targetPositionId)
      .input('supId', sql.Int, targetSupervisorId)
      .input('sal', sql.Decimal(18, 2), targetSalary)
      .input('stat', sql.NVarChar(20), targetStatus)
      .input('statChangedAt', sql.DateTime2, new Date())
      .input('termDate', sql.Date, targetStatus === 'Desvinculado' ? effDate : null)
      .input('termReasonId', sql.Int, targetStatus === 'Desvinculado' && terminationReasonId ? Number(terminationReasonId) : null)
      .input('termNotes', sql.NVarChar(1000), targetStatus === 'Desvinculado' ? (terminationNotes || reason || null) : null)
      .input('userId', sql.NVarChar(450), userId || null);

    await updReq.query(`
      UPDATE dbo.HrEmployees
      SET BranchId = @branchId,
          DepartmentId = @deptId,
          PositionId = @posId,
          SupervisorEmployeeId = @supId,
          BaseSalary = @sal,
          Status = @stat,
          StatusChangedAt = @statChangedAt,
          TerminationDate = CASE WHEN @stat = N'Desvinculado' THEN @termDate ELSE TerminationDate END,
          TerminationReasonId = CASE WHEN @stat = N'Desvinculado' THEN @termReasonId ELSE TerminationReasonId END,
          TerminationNotes = CASE WHEN @stat = N'Desvinculado' THEN @termNotes ELSE TerminationNotes END,
          UpdatedAt = SYSUTCDATETIME(),
          UpdatedBy = @userId
      WHERE Id = @id;
    `);

    await transaction.commit();

    const oldValues = {
      branchId: fromBranchId,
      departmentId: fromDepartmentId,
      positionId: fromPositionId,
      supervisorId: fromSupervisorId,
      baseSalary: fromSalary,
      status: fromStatus
    };

    const newValues = {
      branchId: targetBranchId,
      departmentId: targetDepartmentId,
      positionId: targetPositionId,
      supervisorId: targetSupervisorId,
      baseSalary: targetSalary,
      status: targetStatus,
      movementType,
      reason
    };

    return {
      movement: movResult.recordset[0],
      oldValues,
      newValues
    };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}
