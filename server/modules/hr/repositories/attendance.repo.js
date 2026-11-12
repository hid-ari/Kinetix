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
    .input('companyId', companyId)
    .query(`
      SELECT Id, CompanyId, Code, Name, ShiftType,
             StartTime::text AS StartTime,
             EndTime::text AS EndTime,
             GraceMinutes, BreakMinutes, WorkDaysMask, IsActive, CreatedAt
      FROM HrWorkShifts
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
    .input('companyId', companyId)
    .input('code', data.code.trim())
    .input('name', data.name.trim())
    .input('type', data.shiftType || 'Regular')
    .input('start', data.startTime)
    .input('end', data.endTime)
    .input('grace', Number(data.graceMinutes ?? 15))
    .input('break', Number(data.breakMinutes ?? 60))
    .input('days', data.workDaysMask || '1111100');

  if (shiftId) {
    req.input('id', Number(shiftId));
    const result = await req.query(`
      UPDATE HrWorkShifts
      SET Code = @code, Name = @name, ShiftType = @type,
          StartTime = CAST(@start AS TIME), EndTime = CAST(@end AS TIME),
          GraceMinutes = @grace, BreakMinutes = @break, WorkDaysMask = @days
      WHERE Id = @id AND CompanyId = @companyId
      RETURNING Id, Code, Name;
    `);
    return result.recordset[0];
  } else {
    const result = await req.query(`
      INSERT INTO HrWorkShifts (CompanyId, Code, Name, ShiftType, StartTime, EndTime, GraceMinutes, BreakMinutes, WorkDaysMask)
      VALUES (@companyId, @code, @name, @type, CAST(@start AS TIME), CAST(@end AS TIME), @grace, @break, @days)
      RETURNING Id, Code, Name;
    `);
    return result.recordset[0];
  }
}

/**
 * Gets effective shift for an employee on a given date
 */
export async function getEmployeeShift(pool, employeeId, companyId) {
  const shiftRes = await pool.request()
    .input('empId', employeeId)
    .input('compId', companyId)
    .query(`
      SELECT s.Id, s.Code, s.Name, s.StartTime, s.EndTime, s.GraceMinutes, s.BreakMinutes, s.WorkDaysMask
      FROM HrEmployeeShifts es
      JOIN HrWorkShifts s ON s.Id = es.ShiftId
      WHERE es.EmployeeId = @empId AND es.IsActive = TRUE AND s.IsActive = TRUE
      ORDER BY es.EffectiveDate DESC LIMIT 1;
    `);

  if (shiftRes.recordset[0]) return shiftRes.recordset[0];

  // Default company shift
  const defaultRes = await pool.request()
    .input('compId', companyId)
    .query(`
      SELECT Id, Code, Name, StartTime, EndTime, GraceMinutes, BreakMinutes, WorkDaysMask
      FROM HrWorkShifts
      WHERE CompanyId = @compId AND IsActive = TRUE
      ORDER BY Id ASC LIMIT 1;
    `);

  return defaultRes.recordset[0] || null;
}

/**
 * Today's attendance row (if any) for an employee
 */
export async function getAttendanceForDate(pool, employeeId, workDate) {
  const res = await pool.request()
    .input('empId', employeeId)
    .input('workDate', workDate)
    .query(`
      SELECT Id, EmployeeId, WorkDate, ShiftId, CheckInTime, CheckOutTime, LateMinutes, EarlyLeaveMinutes,
             RegularMinutes, OvertimeMinutes, Status, Notes
      FROM HrAttendance
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
    .input('companyId', companyId)
    .input('empId', employeeId)
    .input('workDate', workDate)
    .input('shiftId', shiftId)
    .input('checkIn', now)
    .input('late', lateMinutes)
    .input('status', status)
    .input('notes', notes || null)
    .query(`
      INSERT INTO HrAttendance (CompanyId, EmployeeId, WorkDate, ShiftId, CheckInTime, LateMinutes, Status, Notes)
      VALUES (@companyId, @empId, @workDate, @shiftId, @checkIn, @late, @status, @notes)
      ON CONFLICT (EmployeeId, WorkDate) DO UPDATE SET
        CheckInTime = COALESCE(HrAttendance.CheckInTime, EXCLUDED.CheckInTime),
        ShiftId = COALESCE(HrAttendance.ShiftId, EXCLUDED.ShiftId),
        LateMinutes = CASE WHEN HrAttendance.CheckInTime IS NULL THEN EXCLUDED.LateMinutes ELSE HrAttendance.LateMinutes END,
        Status = CASE WHEN HrAttendance.CheckInTime IS NULL THEN EXCLUDED.Status ELSE HrAttendance.Status END,
        UpdatedAt = now()
      RETURNING Id, WorkDate, CheckInTime, Status, LateMinutes;`);

  return result.recordset[0];
}

/**
 * Records employee check-out (Marca de Salida). Requires a prior check-in for the day.
 */
export async function recordCheckOut(pool, { companyId, employeeId, checkOutTime = null, notes = null }) {
  const now = checkOutTime ? new Date(checkOutTime) : new Date();
  const workDate = localDateStr(now);

  const existingRes = await pool.request()
    .input('empId', employeeId)
    .input('workDate', workDate)
    .query(`
      SELECT a.Id, a.CheckInTime, a.ShiftId, a.LateMinutes, a.Status,
             s.StartTime, s.EndTime, s.BreakMinutes
      FROM HrAttendance a
      LEFT JOIN HrWorkShifts s ON s.Id = a.ShiftId
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
    .input('id', existing.Id)
    .input('checkOut', now)
    .input('early', early)
    .input('regular', regular)
    .input('overtime', overtime)
    .input('notes', notes || null)
    .query(`
      UPDATE HrAttendance
      SET CheckOutTime = @checkOut,
          EarlyLeaveMinutes = @early,
          RegularMinutes = @regular,
          OvertimeMinutes = @overtime,
          Notes = COALESCE(@notes::text, Notes),
          UpdatedAt = now()
      WHERE Id = @id
      RETURNING Id, WorkDate, CheckInTime, CheckOutTime, RegularMinutes, OvertimeMinutes;
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
    .input('companyId', companyId)
    .input('empId', employeeId)
    .input('workDate', workDate)
    .input('shiftId', shift?.Id || null)
    .input('checkIn', ci)
    .input('checkOut', co)
    .input('late', m.late)
    .input('early', m.early)
    .input('regular', m.regular)
    .input('overtime', m.overtime)
    .input('status', m.status)
    .input('notes', notes || null)
    .query(`
      INSERT INTO HrAttendance (CompanyId, EmployeeId, WorkDate, ShiftId, CheckInTime, CheckOutTime, LateMinutes, EarlyLeaveMinutes,
              RegularMinutes, OvertimeMinutes, Status, Notes)
      VALUES (@companyId, @empId, @workDate, @shiftId, @checkIn, @checkOut, @late, @early, @regular, @overtime, @status, @notes)
      ON CONFLICT (EmployeeId, WorkDate) DO UPDATE SET
        CheckInTime = EXCLUDED.CheckInTime,
        CheckOutTime = EXCLUDED.CheckOutTime,
        ShiftId = COALESCE(EXCLUDED.ShiftId, HrAttendance.ShiftId),
        LateMinutes = EXCLUDED.LateMinutes,
        EarlyLeaveMinutes = EXCLUDED.EarlyLeaveMinutes,
        RegularMinutes = EXCLUDED.RegularMinutes,
        OvertimeMinutes = EXCLUDED.OvertimeMinutes,
        Status = EXCLUDED.Status,
        Notes = COALESCE(EXCLUDED.Notes, HrAttendance.Notes),
        UpdatedAt = now()
      RETURNING Id;`);
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
  if (visibleFor) where += ` AND a.EmployeeId IN (SELECT EmployeeId FROM fn_HrVisibleEmployees(@visUser, FALSE, @visCompanyAdmin::boolean))`;

  const req = pool.request().input('companyId', companyId);
  if (startDate) req.input('startDate', startDate);
  if (endDate) req.input('endDate', endDate);
  if (departmentId) req.input('deptId', Number(departmentId));
  if (branchId) req.input('branchId', Number(branchId));
  if (employeeId) req.input('empId', Number(employeeId));
  if (status) req.input('status', status);
  if (visibleFor) {
    req.input('visUser', visibleFor.userId);
    req.input('visCompanyAdmin', Boolean(visibleFor.isCompanyAdmin));
  }

  const countQuery = `
    SELECT COUNT(*) AS total
    FROM HrAttendance a
    JOIN HrEmployees e ON e.Id = a.EmployeeId
    ${where};
  `;

  const dataQuery = `
    SELECT a.Id, a.CompanyId, a.EmployeeId, a.WorkDate, a.WorkDate AS AttendanceDate, a.ShiftId,
           a.CheckInTime, a.CheckOutTime, a.LateMinutes, a.EarlyLeaveMinutes,
           a.RegularMinutes, a.OvertimeMinutes,
           CAST(a.RegularMinutes / 60.0 AS DECIMAL(6,2)) AS RegularHours,
           CAST(a.OvertimeMinutes / 60.0 AS DECIMAL(6,2)) AS OvertimeHours,
           a.Status, a.Notes,
           CONCAT(e.FirstName, ' ', e.LastName) AS EmployeeName,
           e.FirstName, e.LastName,
           e.EmployeeCode,
           p.Title AS PositionTitle,
           d.Name AS DepartmentName,
           b.Name AS BranchName,
           s.Name AS ShiftName
    FROM HrAttendance a
    JOIN HrEmployees e ON e.Id = a.EmployeeId
    LEFT JOIN HrPositions p ON p.Id = e.PositionId
    LEFT JOIN HrDepartments d ON d.Id = e.DepartmentId
    LEFT JOIN Branches b ON b.Id = e.BranchId
    LEFT JOIN HrWorkShifts s ON s.Id = a.ShiftId
    ${where}
    ORDER BY a.WorkDate DESC, e.LastName ASC, e.FirstName ASC
    LIMIT @pageSize OFFSET @offset;
  `;

  req.input('offset', offset);
  req.input('pageSize', pageSize);

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

  const emp = await pool.findById('HrEmployees', employeeId, { select: 'CompanyId' });
  if (!emp || emp.CompanyId !== Number(companyId)) {
    const err = new Error('Empleado no encontrado en la empresa.');
    err.status = 404;
    throw err;
  }

  const dup = await pool.findOne('HrAttendanceCorrections', {
    EmployeeId: employeeId,
    WorkDate: workDate,
    Status: 'Pendiente'
  });
  if (dup) {
    const err = new Error('Ya existe una solicitud de corrección pendiente para esa fecha.');
    err.status = 409;
    throw err;
  }

  const existing = await getAttendanceForDate(pool, employeeId, workDate);

  const correction = await pool.insert('HrAttendanceCorrections', {
    AttendanceId: existing?.Id || null,
    EmployeeId: employeeId,
    WorkDate: workDate,
    OriginalCheckIn: existing?.CheckInTime || null,
    OriginalCheckOut: existing?.CheckOutTime || null,
    RequestedCheckIn: requestedCheckIn ? new Date(requestedCheckIn) : null,
    RequestedCheckOut: requestedCheckOut ? new Date(requestedCheckOut) : null,
    Reason: reason.trim()
  }, { returning: 'Id, EmployeeId, WorkDate, Status' });

  // Initiate approval flow
  const approval = await createApprovalRequest(pool, {
    companyId,
    requestType: 'CorreccionAsistencia',
    entityName: 'HrAttendanceCorrections',
    entityId: correction.Id,
    requesterEmployeeId: employeeId
  });

  await pool.update('HrAttendanceCorrections', correction.Id, {
    ApprovalRequestId: approval.Id
  }, { returning: false });

  return { correction, approval };
}

/**
 * Applies approved attendance correction (overwrites punches and recomputes metrics)
 */
export async function applyAttendanceCorrection(pool, correctionId) {
  const corrRes = await pool.request()
    .input('id', correctionId)
    .query('SELECT * FROM HrAttendanceCorrections WHERE Id = @id;');
  const corr = corrRes.recordset[0];
  if (!corr || corr.Status === 'Aprobada') return;

  const empRes = await pool.request()
    .input('id', corr.EmployeeId)
    .query('SELECT CompanyId FROM HrEmployees WHERE Id = @id;');
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
    .input('id', correctionId)
    .query("UPDATE HrAttendanceCorrections SET Status = 'Aprobada' WHERE Id = @id;");
}
