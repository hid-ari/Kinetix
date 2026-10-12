import sql from 'mssql/msnodesqlv8.js';
import { createApprovalRequest } from './approvals.repo.js';

/**
 * Lists work shifts for a company
 */
export async function listWorkShifts(pool, companyId) {
  const result = await pool.request()
    .input('companyId', sql.Int, companyId)
    .query(`
      SELECT Id, CompanyId, Code, Name, ShiftType,
             CONVERT(VARCHAR(8), StartTime, 108) AS StartTime,
             CONVERT(VARCHAR(8), EndTime, 108) AS EndTime,
             GraceMinutes, BreakMinutes, WorkDaysMask, IsActive, CreatedAt
      FROM dbo.HrWorkShifts
      WHERE CompanyId = @companyId
      ORDER BY IsActive DESC, Name ASC;
    `);
  return result.recordset;
}

/**
 * Creates or updates a work shift
 */
export async function saveWorkShift(pool, companyId, data, shiftId = null) {
  const req = pool.request()
    .input('companyId', sql.Int, companyId)
    .input('code', sql.NVarChar(30), data.code.trim())
    .input('name', sql.NVarChar(100), data.name.trim())
    .input('type', sql.NVarChar(30), data.shiftType || 'Regular')
    .input('start', sql.VarChar(8), data.startTime)
    .input('end', sql.VarChar(8), data.endTime)
    .input('grace', sql.Int, Number(data.graceMinutes || 15))
    .input('break', sql.Int, Number(data.breakMinutes || 60))
    .input('days', sql.VarChar(7), data.workDaysMask || '1111100');

  if (shiftId) {
    req.input('id', sql.Int, Number(shiftId));
    const result = await req.query(`
      UPDATE dbo.HrWorkShifts
      SET Code = @code, Name = @name, ShiftType = @type,
          StartTime = CAST(@start AS TIME), EndTime = CAST(@end AS TIME),
          GraceMinutes = @grace, BreakMinutes = @break, WorkDaysMask = @days
      OUTPUT INSERTED.Id, INSERTED.Code, INSERTED.Name
      WHERE Id = @id AND CompanyId = @companyId;
    `);
    return result.recordset[0];
  } else {
    const result = await req.query(`
      INSERT INTO dbo.HrWorkShifts (CompanyId, Code, Name, ShiftType, StartTime, EndTime, GraceMinutes, BreakMinutes, WorkDaysMask)
      OUTPUT INSERTED.Id, INSERTED.Code, INSERTED.Name
      VALUES (@companyId, @code, @name, @type, CAST(@start AS TIME), CAST(@end AS TIME), @grace, @break, @days);
    `);
    return result.recordset[0];
  }
}

/**
 * Gets effective shift for an employee on a given date
 */
export async function getEmployeeShift(pool, employeeId, companyId) {
  const shiftRes = await pool.request()
    .input('empId', sql.Int, employeeId)
    .input('compId', sql.Int, companyId)
    .query(`
      SELECT TOP 1 s.Id, s.Code, s.Name, s.StartTime, s.EndTime, s.GraceMinutes, s.BreakMinutes, s.WorkDaysMask
      FROM dbo.HrEmployeeShifts es
      JOIN dbo.HrWorkShifts s ON s.Id = es.ShiftId
      WHERE es.EmployeeId = @empId AND es.IsActive = 1 AND s.IsActive = 1
      ORDER BY es.EffectiveDate DESC;
    `);

  if (shiftRes.recordset[0]) return shiftRes.recordset[0];

  // Default company shift
  const defaultRes = await pool.request()
    .input('compId', sql.Int, companyId)
    .query(`
      SELECT TOP 1 Id, Code, Name, StartTime, EndTime, GraceMinutes, BreakMinutes, WorkDaysMask
      FROM dbo.HrWorkShifts
      WHERE CompanyId = @compId AND IsActive = 1
      ORDER BY Id ASC;
    `);

  return defaultRes.recordset[0] || null;
}

/**
 * Records employee check-in (Marca de Entrada)
 */
export async function recordCheckIn(pool, { companyId, employeeId, checkInTime = null, notes = null }) {
  const now = checkInTime ? new Date(checkInTime) : new Date();
  const workDate = now.toISOString().slice(0, 10);

  const shift = await getEmployeeShift(pool, employeeId, companyId);
  const shiftId = shift ? shift.Id : null;

  let lateMinutes = 0;
  let status = 'Presente';

  if (shift && shift.StartTime) {
    const shiftStart = new Date(shift.StartTime);
    const startHour = shiftStart.getUTCHours();
    const startMin = shiftStart.getUTCMinutes();

    const checkHour = now.getHours();
    const checkMin = now.getMinutes();

    const shiftMinutes = (startHour * 60) + startMin;
    const checkMinutes = (checkHour * 60) + checkMin;
    const diff = checkMinutes - shiftMinutes;

    if (diff > (shift.GraceMinutes || 15)) {
      lateMinutes = diff;
      status = 'Tardanza';
    }
  }

  const result = await pool.request()
    .input('companyId', sql.Int, companyId)
    .input('empId', sql.Int, employeeId)
    .input('workDate', sql.Date, workDate)
    .input('shiftId', sql.Int, shiftId)
    .input('checkIn', sql.DateTime2(0), now)
    .input('late', sql.Int, lateMinutes)
    .input('status', sql.NVarChar(30), status)
    .input('notes', sql.NVarChar(500), notes || null)
    .query(`
      MERGE dbo.HrAttendance AS target
      USING (VALUES (@companyId, @empId, @workDate)) AS source (CompanyId, EmployeeId, WorkDate)
      ON target.EmployeeId = source.EmployeeId AND target.WorkDate = source.WorkDate
      WHEN MATCHED THEN
        UPDATE SET
          CheckInTime = ISNULL(target.CheckInTime, @checkIn),
          ShiftId = ISNULL(target.ShiftId, @shiftId),
          LateMinutes = CASE WHEN target.CheckInTime IS NULL THEN @late ELSE target.LateMinutes END,
          Status = CASE WHEN target.CheckInTime IS NULL THEN @status ELSE target.Status END,
          UpdatedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (CompanyId, EmployeeId, WorkDate, ShiftId, CheckInTime, LateMinutes, Status, Notes)
        VALUES (@companyId, @empId, @workDate, @shiftId, @checkIn, @late, @status, @notes)
      OUTPUT INSERTED.Id, INSERTED.WorkDate, INSERTED.CheckInTime, INSERTED.Status, INSERTED.LateMinutes;
    `);

  return result.recordset[0];
}

/**
 * Records employee check-out (Marca de Salida)
 */
export async function recordCheckOut(pool, { companyId, employeeId, checkOutTime = null, notes = null }) {
  const now = checkOutTime ? new Date(checkOutTime) : new Date();
  const workDate = now.toISOString().slice(0, 10);

  const existingRes = await pool.request()
    .input('empId', sql.Int, employeeId)
    .input('workDate', sql.Date, workDate)
    .query(`
      SELECT a.Id, a.CheckInTime, a.ShiftId, a.LateMinutes, a.Status,
             s.StartTime, s.EndTime, s.BreakMinutes
      FROM dbo.HrAttendance a
      LEFT JOIN dbo.HrWorkShifts s ON s.Id = a.ShiftId
      WHERE a.EmployeeId = @empId AND a.WorkDate = @workDate;
    `);

  const existing = existingRes.recordset[0];
  const shift = existing?.ShiftId ? { StartTime: existing.StartTime, EndTime: existing.EndTime, BreakMinutes: existing.BreakMinutes } : await getEmployeeShift(pool, employeeId, companyId);

  let earlyMinutes = 0;
  let regularMinutes = 0;
  let overtimeMinutes = 0;

  if (existing?.CheckInTime) {
    const checkIn = new Date(existing.CheckInTime);
    const totalMinutes = Math.max(0, Math.floor((now - checkIn) / 60000));
    const breakMins = shift?.BreakMinutes || 60;
    const workedMins = Math.max(0, totalMinutes - breakMins);

    // If shift exists, calculate scheduled minutes
    if (shift && shift.EndTime) {
      const shiftEnd = new Date(shift.EndTime);
      const endHour = shiftEnd.getUTCHours();
      const endMin = shiftEnd.getUTCMinutes();
      const shiftEndMinutes = (endHour * 60) + endMin;

      const outHour = now.getHours();
      const outMin = now.getMinutes();
      const outMinutes = (outHour * 60) + outMin;

      if (outMinutes < shiftEndMinutes) {
        earlyMinutes = shiftEndMinutes - outMinutes;
      }

      const standardScheduledMins = 8 * 60; // 8 hours standard
      if (workedMins > standardScheduledMins) {
        regularMinutes = standardScheduledMins;
        overtimeMinutes = workedMins - standardScheduledMins;
      } else {
        regularMinutes = workedMins;
      }
    } else {
      regularMinutes = workedMins;
    }
  }

  const result = await pool.request()
    .input('companyId', sql.Int, companyId)
    .input('empId', sql.Int, employeeId)
    .input('workDate', sql.Date, workDate)
    .input('shiftId', sql.Int, shift?.Id || null)
    .input('checkOut', sql.DateTime2(0), now)
    .input('early', sql.Int, earlyMinutes)
    .input('regular', sql.Int, regularMinutes)
    .input('overtime', sql.Int, overtimeMinutes)
    .input('notes', sql.NVarChar(500), notes || null)
    .query(`
      MERGE dbo.HrAttendance AS target
      USING (VALUES (@companyId, @empId, @workDate)) AS source (CompanyId, EmployeeId, WorkDate)
      ON target.EmployeeId = source.EmployeeId AND target.WorkDate = source.WorkDate
      WHEN MATCHED THEN
        UPDATE SET
          CheckOutTime = @checkOut,
          EarlyLeaveMinutes = @early,
          RegularMinutes = @regular,
          OvertimeMinutes = @overtime,
          Notes = CASE WHEN @notes IS NOT NULL THEN @notes ELSE target.Notes END,
          UpdatedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (CompanyId, EmployeeId, WorkDate, ShiftId, CheckOutTime, EarlyLeaveMinutes, RegularMinutes, OvertimeMinutes, Status, Notes)
        VALUES (@companyId, @empId, @workDate, @shiftId, @checkOut, @early, @regular, @overtime, N'Presente', @notes)
      OUTPUT INSERTED.Id, INSERTED.WorkDate, INSERTED.CheckInTime, INSERTED.CheckOutTime, INSERTED.RegularMinutes, INSERTED.OvertimeMinutes;
    `);

  return result.recordset[0];
}

/**
 * Lists attendance records with filters and pagination
 */
export async function listAttendance(pool, {
  companyId,
  startDate,
  endDate,
  departmentId = null,
  branchId = null,
  employeeId = null,
  status = null,
  page = 1,
  pageSize = 20
}) {
  const offset = (Math.max(1, page) - 1) * pageSize;
  let where = `WHERE a.CompanyId = @companyId`;

  if (startDate) where += ` AND a.WorkDate >= @startDate`;
  if (endDate) where += ` AND a.WorkDate <= @endDate`;
  if (departmentId) where += ` AND e.DepartmentId = @deptId`;
  if (branchId) where += ` AND e.BranchId = @branchId`;
  if (employeeId) where += ` AND a.EmployeeId = @empId`;
  if (status) where += ` AND a.Status = @status`;

  const req = pool.request().input('companyId', sql.Int, companyId);
  if (startDate) req.input('startDate', sql.Date, startDate);
  if (endDate) req.input('endDate', sql.Date, endDate);
  if (departmentId) req.input('deptId', sql.Int, Number(departmentId));
  if (branchId) req.input('branchId', sql.Int, Number(branchId));
  if (employeeId) req.input('empId', sql.Int, Number(employeeId));
  if (status) req.input('status', sql.NVarChar(30), status);

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM dbo.HrAttendance a
    JOIN dbo.HrEmployees e ON e.Id = a.EmployeeId
    ${where};
  `;

  const dataQuery = `
    SELECT a.Id, a.CompanyId, a.EmployeeId, a.WorkDate, a.ShiftId,
           a.CheckInTime, a.CheckOutTime, a.LateMinutes, a.EarlyLeaveMinutes,
           a.RegularMinutes, a.OvertimeMinutes, a.Status, a.Notes,
           CONCAT(e.FirstName, N' ', e.LastName) AS EmployeeName,
           e.EmployeeCode,
           d.Name AS DepartmentName,
           b.Name AS BranchName,
           s.Name AS ShiftName
    FROM dbo.HrAttendance a
    JOIN dbo.HrEmployees e ON e.Id = a.EmployeeId
    LEFT JOIN dbo.HrDepartments d ON d.Id = e.DepartmentId
    LEFT JOIN dbo.Branches b ON b.Id = e.BranchId
    LEFT JOIN dbo.HrWorkShifts s ON s.Id = a.ShiftId
    ${where}
    ORDER BY a.WorkDate DESC, e.LastName ASC, e.FirstName ASC
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
  `;

  req.input('offset', sql.Int, offset);
  req.input('pageSize', sql.Int, pageSize);

  const [countRes, dataRes] = await Promise.all([
    req.query(countQuery),
    req.query(dataQuery)
  ]);

  return {
    total: countRes.recordset[0].total,
    data: dataRes.recordset,
    page,
    pageSize
  };
}

/**
 * Creates an attendance correction request linked to approval flow
 */
export async function requestAttendanceCorrection(pool, {
  companyId,
  employeeId,
  workDate,
  requestedCheckIn,
  requestedCheckOut,
  reason
}) {
  // Check if attendance record exists
  const attRes = await pool.request()
    .input('empId', sql.Int, employeeId)
    .input('date', sql.Date, workDate)
    .query('SELECT Id, CheckInTime, CheckOutTime FROM dbo.HrAttendance WHERE EmployeeId = @empId AND WorkDate = @date;');
  const existing = attRes.recordset[0];

  const corrRes = await pool.request()
    .input('attId', sql.BigInt, existing?.Id || null)
    .input('empId', sql.Int, employeeId)
    .input('workDate', sql.Date, workDate)
    .input('origIn', sql.DateTime2(0), existing?.CheckInTime || null)
    .input('origOut', sql.DateTime2(0), existing?.CheckOutTime || null)
    .input('reqIn', sql.DateTime2(0), requestedCheckIn ? new Date(requestedCheckIn) : null)
    .input('reqOut', sql.DateTime2(0), requestedCheckOut ? new Date(requestedCheckOut) : null)
    .input('reason', sql.NVarChar(500), reason.trim())
    .query(`
      INSERT INTO dbo.HrAttendanceCorrections (
        AttendanceId, EmployeeId, WorkDate,
        OriginalCheckIn, OriginalCheckOut,
        RequestedCheckIn, RequestedCheckOut, Reason
      )
      OUTPUT INSERTED.Id, INSERTED.EmployeeId, INSERTED.WorkDate, INSERTED.Status
      VALUES (
        @attId, @empId, @workDate,
        @origIn, @origOut,
        @reqIn, @reqOut, @reason
      );
    `);

  const correction = corrRes.recordset[0];

  // Initiate approval flow
  const approval = await createApprovalRequest(pool, {
    companyId,
    requestType: 'CorreccionAsistencia',
    entityName: 'HrAttendanceCorrections',
    entityId: correction.Id,
    requesterEmployeeId: employeeId
  });

  await pool.request()
    .input('id', sql.Int, correction.Id)
    .input('appId', sql.Int, approval.Id)
    .query('UPDATE dbo.HrAttendanceCorrections SET ApprovalRequestId = @appId WHERE Id = @id;');

  return { correction, approval };
}

/**
 * Applies approved attendance correction
 */
export async function applyAttendanceCorrection(pool, correctionId) {
  const corrRes = await pool.request()
    .input('id', sql.Int, correctionId)
    .query('SELECT * FROM dbo.HrAttendanceCorrections WHERE Id = @id;');
  const corr = corrRes.recordset[0];
  if (!corr) return;

  const empRes = await pool.request()
    .input('id', sql.Int, corr.EmployeeId)
    .query('SELECT CompanyId FROM dbo.HrEmployees WHERE Id = @id;');
  const companyId = empRes.recordset[0]?.CompanyId;

  // Record check in and check out
  if (corr.RequestedCheckIn) {
    await recordCheckIn(pool, {
      companyId,
      employeeId: corr.EmployeeId,
      checkInTime: corr.RequestedCheckIn,
      notes: `Corrección aprobada: ${corr.Reason}`
    });
  }

  if (corr.RequestedCheckOut) {
    await recordCheckOut(pool, {
      companyId,
      employeeId: corr.EmployeeId,
      checkOutTime: corr.RequestedCheckOut,
      notes: `Corrección aprobada: ${corr.Reason}`
    });
  }

  await pool.request()
    .input('id', sql.Int, correctionId)
    .query("UPDATE dbo.HrAttendanceCorrections SET Status = N'Aprobada' WHERE Id = @id;");
}
