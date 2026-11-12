import { notFound } from '../../../core/http.js';

export async function listEmployeeMovements(pool, employeeId) {
  const result = await pool.request()
    .input('employeeId', Number(employeeId))
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
             CONCAT(fs.FirstName, ' ', fs.LastName) AS FromSupervisorName,
             CONCAT(ts.FirstName, ' ', ts.LastName) AS ToSupervisorName,
             u.Email AS CreatedByEmail
      FROM HrEmployeeMovements m
      LEFT JOIN Branches fb ON fb.Id = m.FromBranchId
      LEFT JOIN Branches tb ON tb.Id = m.ToBranchId
      LEFT JOIN HrDepartments fd ON fd.Id = m.FromDepartmentId
      LEFT JOIN HrDepartments td ON td.Id = m.ToDepartmentId
      LEFT JOIN HrPositions fp ON fp.Id = m.FromPositionId
      LEFT JOIN HrPositions tp ON tp.Id = m.ToPositionId
      LEFT JOIN HrEmployees fs ON fs.Id = m.FromSupervisorId
      LEFT JOIN HrEmployees ts ON ts.Id = m.ToSupervisorId
      LEFT JOIN UserOrganizations u ON u.UserId = m.CreatedBy
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
  return pool.withTransaction(async transaction => {
    const currentRes = await transaction.request()
      .input('id', Number(employeeId))
      .query(`
        SELECT Id, CompanyId, BranchId, DepartmentId, PositionId,
               SupervisorEmployeeId, BaseSalary, Status
        FROM HrEmployees
        WHERE Id = @id FOR UPDATE;
      `);

    const current = currentRes.recordset[0];
    if (!current) {
      throw notFound('Empleado no encontrado.');
    }

    const effDate = effectiveDate ? new Date(effectiveDate) : new Date();

    const fromBranchId = current.BranchId;
    const fromDepartmentId = current.DepartmentId;
    const fromPositionId = current.PositionId;
    const fromSupervisorId = current.SupervisorEmployeeId;
    const fromSalary = current.BaseSalary;
    const fromStatus = current.Status;

    const targetBranchId = toBranchId !== undefined ? (toBranchId ? Number(toBranchId) : null) : fromBranchId;
    const targetDepartmentId = toDepartmentId !== undefined ? (toDepartmentId ? Number(toDepartmentId) : null) : fromDepartmentId;
    const targetPositionId = toPositionId !== undefined ? (toPositionId ? Number(toPositionId) : null) : fromPositionId;
    const targetSupervisorId = toSupervisorId !== undefined ? (toSupervisorId ? Number(toSupervisorId) : null) : fromSupervisorId;
    const targetSalary = toSalary !== undefined ? Number(toSalary) : fromSalary;
    const targetStatus = toStatus || fromStatus;

    const movResult = await transaction.insert('HrEmployeeMovements', {
      EmployeeId: current.Id,
      CompanyId: current.CompanyId,
      MovementType: movementType,
      EffectiveDate: effDate,
      FromBranchId: fromBranchId,
      ToBranchId: targetBranchId,
      FromDepartmentId: fromDepartmentId,
      ToDepartmentId: targetDepartmentId,
      FromPositionId: fromPositionId,
      ToPositionId: targetPositionId,
      FromSupervisorId: fromSupervisorId,
      ToSupervisorId: targetSupervisorId,
      FromSalary: fromSalary,
      ToSalary: targetSalary,
      FromStatus: fromStatus,
      ToStatus: targetStatus,
      Reason: reason || null,
      CreatedBy: userId || null
    }, { returning: 'Id, MovementType, EffectiveDate' });

    const updReq = transaction.request()
      .input('id', current.Id)
      .input('branchId', targetBranchId)
      .input('deptId', targetDepartmentId)
      .input('posId', targetPositionId)
      .input('supId', targetSupervisorId)
      .input('sal', targetSalary)
      .input('stat', targetStatus)
      .input('statChangedAt', new Date())
      .input('termDate', targetStatus === 'Desvinculado' ? effDate : null)
      .input('termReasonId', targetStatus === 'Desvinculado' && terminationReasonId ? Number(terminationReasonId) : null)
      .input('termNotes', targetStatus === 'Desvinculado' ? (terminationNotes || reason || null) : null)
      .input('userId', userId || null);

    await updReq.query(`
      UPDATE HrEmployees
      SET BranchId = @branchId::int,
          DepartmentId = @deptId::int,
          PositionId = @posId::int,
          SupervisorEmployeeId = @supId::int,
          BaseSalary = @sal::numeric,
          Status = @stat::varchar,
          StatusChangedAt = @statChangedAt::timestamptz,
          TerminationDate = CASE WHEN @stat::varchar = 'Desvinculado' THEN @termDate::date ELSE TerminationDate END,
          TerminationReasonId = CASE WHEN @stat::varchar = 'Desvinculado' THEN @termReasonId::int ELSE TerminationReasonId END,
          TerminationNotes = CASE WHEN @stat::varchar = 'Desvinculado' THEN @termNotes::text ELSE TerminationNotes END,
          UpdatedAt = now(),
          UpdatedBy = @userId::varchar
      WHERE Id = @id;
    `);

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
      movement: movResult,
      oldValues,
      newValues
    };
  });
}
