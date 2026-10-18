import sql from 'mssql/msnodesqlv8.js';
import { createApprovalRequest } from './approvals.repo.js';

/**
 * Local calendar date (YYYY-MM-DD). Using toISOString() would yield the UTC date,
 * which flips to "tomorrow" after 8 PM in UTC-4 (Dominican Republic).
 */
export function localDateStr(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Minutes since midnight for a SQL TIME value (string "HH:mm:ss" or Date from the driver). */
function timeToMinutes(t) {
  if (t == null) return null;
  if (typeof t === 'string') {
    const [h, m] = t.split(':');
    return Number(h) * 60 + Number(m);
  }
  const d = new Date(t);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/**
 * Computes lateness / early leave / regular & overtime minutes for a shift and a pair of punches.
 */
export function computeAttendanceMetrics(shift, checkIn, checkOut) {
  let late = 0;
  let early = 0;
  let regular = 0;
  let overtime = 0;
  let status = 'Presente';

  const ci = checkIn ? new Date(checkIn) : null;
  const co = checkOut ? new Date(checkOut) : null;
  const startM = timeToMinutes(shift?.StartTime);
  const endM = timeToMinutes(shift?.EndTime);
  const grace = shift?.GraceMinutes ?? 15;

  if (ci && startM != null) {
    const diff = ci.getHours() * 60 + ci.getMinutes() - startM;
    if (diff > grace) {
      late = diff;
      status = 'Tardanza';
    }
  }

  if (ci && co) {
    const total = Math.max(0, Math.floor((co - ci) / 60000));
    const breakMins = shift?.BreakMinutes ?? 60;
    const worked = Math.max(0, total - breakMins);

    if (endM != null) {
      const outM = co.getHours() * 60 + co.getMinutes();
      if (outM < endM) early = endM - outM;
    }

    const standard = 8 * 60;
    if (worked > standard) {
      regular = standard;
      overtime = worked - standard;
    } else {
      regular = worked;
    }
  }

  return { late, early, regular, overtime, status };
}

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
    .input('grace', sql.Int, Number(data.graceMinutes ?? 15))
    .input('break', sql.Int, Number(data.breakMinutes ?? 60))
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
 * Today's attendance row (if any) for an employee
 */
export async function getAttendanceForDate(pool, employeeId, workDate) {
  const res = await pool.request()
    .input('empId', sql.Int, employeeId)
    .input('workDate', sql.Date, workDate)
    .query(`
      SELECT Id, EmployeeId, WorkDate, ShiftId, CheckInTime, CheckOutTime, LateMinutes, EarlyLeaveMinutes,
             RegularMinutes, OvertimeMinutes, Status, Notes
      FROM dbo.HrAttendance
      WHERE EmployeeId = @empId AND WorkDate = @workDate;
    `);
  return res.recordset[0] || null;
}

/**
 * Records employee check-in (Marca de Entrada)
 */
export async function recordCheckIn(pool, { companyId, employeeId, checkInTime = null, notes = null }) {
  const now = checkInTime ? new Date(checkInTime) : new Date();
  const workDate = localDateStr(now);

  const shift = await getEmployeeShift(pool, employeeId, companyId);
  const shiftId = shift ? shift.Id : null;
  const { late: lateMinutes, status } = computeAttendanceMetrics(shift, now, null);

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
 * Records employee check-out (Marca de Salida). Requires a prior check-in for the day.
 */
export async function recordCheckOut(pool, { companyId, employeeId, checkOutTime = null, notes = null }) {
  const now = checkOutTime ? new Date(checkOutTime) : new Date();
  const workDate = localDateStr(now);

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
  if (!existing?.CheckInTime) {
    const err = new Error('No existe una marca de entrada para hoy. Registre primero su entrada.');
    err.status = 409;
    throw err;
  }

  const shift = existing.ShiftId
    ? { Id: existing.ShiftId, StartTime: existing.StartTime, EndTime: existing.EndTime, BreakMinutes: existing.BreakMinutes }
    : await getEmployeeShift(pool, employeeId, companyId);

  const { early, regular, overtime } = computeAttendanceMetrics(shift, existing.CheckInTime, now);

  const result = await pool.request()
    .input('id', sql.BigInt, existing.Id)
    .input('checkOut', sql.DateTime2(0), now)
    .input('early', sql.Int, early)
    .input('regular', sql.Int, regular)
    .input('overtime', sql.Int, overtime)
    .input('notes', sql.NVarChar(500), notes || null)
    .query(`
      UPDATE dbo.HrAttendance
      SET CheckOutTime = @checkOut,
          EarlyLeaveMinutes = @early,
          RegularMinutes = @regular,
          OvertimeMinutes = @overtime,
          Notes = CASE WHEN @notes IS NOT NULL THEN @notes ELSE Notes END,
          UpdatedAt = SYSUTCDATETIME()
      OUTPUT INSERTED.Id, INSERTED.WorkDate, INSERTED.CheckInTime, INSERTED.CheckOutTime, INSERTED.RegularMinutes, INSERTED.OvertimeMinutes
      WHERE Id = @id;
    `);

  return result.recordset[0];
}

/**
 * Overwrites punches of a day (used when an approved correction is applied) and recomputes metrics.
 */
export async function setAttendanceTimes(pool, { companyId, employeeId, workDate, checkIn = null, checkOut = null, notes = null }) {
  const shift = await getEmployeeShift(pool, employeeId, companyId);
  const existing = await getAttendanceForDate(pool, employeeId, workDate);

  const ci = checkIn ? new Date(checkIn) : (existing?.CheckInTime ? new Date(existing.CheckInTime) : null);
  const co = checkOut ? new Date(checkOut) : (existing?.CheckOutTime ? new Date(existing.CheckOutTime) : null);
  const m = computeAttendanceMetrics(shift, ci, co);

  const result = await pool.request()
    .input('companyId', sql.Int, companyId)
    .input('empId', sql.Int, employeeId)
    .input('workDate', sql.Date, workDate)
    .input('shiftId', sql.Int, shift?.Id || null)
    .input('checkIn', sql.DateTime2(0), ci)
    .input('checkOut', sql.DateTime2(0), co)
    .input('late', sql.Int, m.late)
    .input('early', sql.Int, m.early)
    .input('regular', sql.Int, m.regular)
    .input('overtime', sql.Int, m.overtime)
    .input('status', sql.NVarChar(30), m.status)
    .input('notes', sql.NVarChar(500), notes || null)
    .query(`
      MERGE dbo.HrAttendance AS target
      USING (VALUES (@empId, @workDate)) AS source (EmployeeId, WorkDate)
      ON target.EmployeeId = source.EmployeeId AND target.WorkDate = source.WorkDate
      WHEN MATCHED THEN
        UPDATE SET CheckInTime = @checkIn, CheckOutTime = @checkOut, ShiftId = ISNULL(@shiftId, target.ShiftId),
                   LateMinutes = @late, EarlyLeaveMinutes = @early, RegularMinutes = @regular,
                   OvertimeMinutes = @overtime, Status = @status,
                   Notes = ISNULL(@notes, target.Notes), UpdatedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (CompanyId, EmployeeId, WorkDate, ShiftId, CheckInTime, CheckOutTime, LateMinutes, EarlyLeaveMinutes,
                RegularMinutes, OvertimeMinutes, Status, Notes)
        VALUES (@companyId, @empId, @workDate, @shiftId, @checkIn, @checkOut, @late, @early, @regular, @overtime, @status, @notes)
      OUTPUT INSERTED.Id;
    `);
  return result.recordset[0];
}

/**
 * Lists attendance records with filters and pagination.
 * When `visibleFor` is provided, only employees visible to that user (scope rules) are returned.
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
  pageSize = 20,
  visibleFor = null
}) {
  page = Math.max(1, Number(page) || 1);
  pageSize = Math.min(10000, Math.max(1, Number(pageSize) || 20));
  const offset = (page - 1) * pageSize;
  let where = `WHERE a.CompanyId = @companyId`;

  if (startDate) where += ` AND a.WorkDate >= @startDate`;
  if (endDate) where += ` AND a.WorkDate <= @endDate`;
  if (departmentId) where += ` AND e.DepartmentId = @deptId`;
  if (branchId) where += ` AND e.BranchId = @branchId`;
  if (employeeId) where += ` AND a.EmployeeId = @empId`;
  if (status) where += ` AND a.Status = @status`;
  if (visibleFor) where += ` AND a.EmployeeId IN (SELECT EmployeeId FROM dbo.fn_HrVisibleEmployees(@visUser, 0, @visCompanyAdmin))`;

  const req = pool.request().input('companyId', sql.Int, companyId);
  if (startDate) req.input('startDate', sql.Date, startDate);
  if (endDate) req.input('endDate', sql.Date, endDate);
  if (departmentId) req.input('deptId', sql.Int, Number(departmentId));
  if (branchId) req.input('branchId', sql.Int, Number(branchId));
  if (employeeId) req.input('empId', sql.Int, Number(employeeId));
  if (status) req.input('status', sql.NVarChar(30), status);
  if (visibleFor) {
    req.input('visUser', sql.NVarChar(450), visibleFor.userId);
    req.input('visCompanyAdmin', sql.Bit, visibleFor.isCompanyAdmin ? 1 : 0);
  }

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM dbo.HrAttendance a
    JOIN dbo.HrEmployees e ON e.Id = a.EmployeeId
    ${where};
  `;

  const dataQuery = `
    SELECT a.Id, a.CompanyId, a.EmployeeId, a.WorkDate, a.WorkDate AS AttendanceDate, a.ShiftId,
           a.CheckInTime, a.CheckOutTime, a.LateMinutes, a.EarlyLeaveMinutes,
           a.RegularMinutes, a.OvertimeMinutes,
           CAST(a.RegularMinutes / 60.0 AS DECIMAL(6,2)) AS RegularHours,
           CAST(a.OvertimeMinutes / 60.0 AS DECIMAL(6,2)) AS OvertimeHours,
           a.Status, a.Notes,
           CONCAT(e.FirstName, N' ', e.LastName) AS EmployeeName,
           e.FirstName, e.LastName,
           e.EmployeeCode,
           p.Title AS PositionTitle,
           d.Name AS DepartmentName,
           b.Name AS BranchName,
           s.Name AS ShiftName
    FROM dbo.HrAttendance a
    JOIN dbo.HrEmployees e ON e.Id = a.EmployeeId
    LEFT JOIN dbo.HrPositions p ON p.Id = e.PositionId
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
  if (!requestedCheckIn && !requestedCheckOut) {
    const err = new Error('Debe indicar al menos la hora de entrada o de salida correcta.');
    err.status = 400;
    throw err;
  }
  if (requestedCheckIn && requestedCheckOut && new Date(requestedCheckOut) <= new Date(requestedCheckIn)) {
    const err = new Error('La hora de salida debe ser posterior a la hora de entrada.');
    err.status = 400;
    throw err;
  }
  if (new Date(`${workDate}T00:00:00`) > new Date()) {
    const err = new Error('No se puede corregir la asistencia de una fecha futura.');
    err.status = 400;
    throw err;
  }

  const empRes = await pool.request()
    .input('id', sql.Int, employeeId)
    .query('SELECT CompanyId FROM dbo.HrEmployees WHERE Id = @id;');
  if (!empRes.recordset[0] || empRes.recordset[0].CompanyId !== Number(companyId)) {
    const err = new Error('Empleado no encontrado en la empresa.');
    err.status = 404;
    throw err;
  }

  const dup = await pool.request()
    .input('empId', sql.Int, employeeId)
    .input('date', sql.Date, workDate)
    .query(`SELECT TOP 1 Id FROM dbo.HrAttendanceCorrections WHERE EmployeeId = @empId AND WorkDate = @date AND Status = N'Pendiente';`);
  if (dup.recordset[0]) {
    const err = new Error('Ya existe una solicitud de corrección pendiente para esa fecha.');
    err.status = 409;
    throw err;
  }

  const existing = await getAttendanceForDate(pool, employeeId, workDate);

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
 * Applies approved attendance correction (overwrites punches and recomputes metrics)
 */
export async function applyAttendanceCorrection(pool, correctionId) {
  const corrRes = await pool.request()
    .input('id', sql.Int, correctionId)
    .query('SELECT * FROM dbo.HrAttendanceCorrections WHERE Id = @id;');
  const corr = corrRes.recordset[0];
  if (!corr || corr.Status === 'Aprobada') return;

  const empRes = await pool.request()
    .input('id', sql.Int, corr.EmployeeId)
    .query('SELECT CompanyId FROM dbo.HrEmployees WHERE Id = @id;');
  const companyId = empRes.recordset[0]?.CompanyId;

  const workDate = new Date(corr.WorkDate).toISOString().slice(0, 10);

  await setAttendanceTimes(pool, {
    companyId,
    employeeId: corr.EmployeeId,
    workDate,
    checkIn: corr.RequestedCheckIn,
    checkOut: corr.RequestedCheckOut,
    notes: `Corrección aprobada: ${corr.Reason}`
  });

  await pool.request()
    .input('id', sql.Int, correctionId)
    .query("UPDATE dbo.HrAttendanceCorrections SET Status = N'Aprobada' WHERE Id = @id;");
}
