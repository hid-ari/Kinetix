import { createApprovalRequest, getApprovalFlow } from './approvals.repo.js';

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const isoDate = d => new Date(d).toISOString().slice(0, 10);

function* eachDate(startDate, endDate) {
  const cur = new Date(`${isoDate(startDate)}T00:00:00Z`);
  const end = new Date(`${isoDate(endDate)}T00:00:00Z`);
  while (cur <= end) {
    yield { dateStr: cur.toISOString().slice(0, 10), dow: cur.getUTCDay() };
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
}

/**
 * Lists leave types for a company
 */
export async function listLeaveTypes(pool, companyId) {
  const result = await pool.request()
    .input('companyId', companyId)
    .query(`
      SELECT Id, CompanyId, Code, Name, IsPaid, RequiresAttachment, MaxDaysPerYear, Unit, IsActive
      FROM HrLeaveTypes
      WHERE CompanyId = @companyId AND IsActive = TRUE
      ORDER BY Name ASC;
    `);
  return result.recordset;
}

/**
 * Creates a leave or permission request connected to approval workflow
 */
export async function createLeaveRequest(pool, {
  companyId,
  employeeId,
  leaveTypeId,
  startDate,
  endDate,
  startTime = null,
  endTime = null,
  unit = null,
  duration,
  reason,
  attachedFileId = null
}) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(startDate)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(endDate))) {
    throw httpError('Fechas inválidas.');
  }
  if (startDate > endDate) throw httpError('La fecha de inicio no puede ser posterior a la fecha de fin.');

  const dur = Number(duration);
  if (!Number.isFinite(dur) || dur <= 0) throw httpError('La duración debe ser mayor que cero.');

  const emp = await pool.findById('HrEmployees', employeeId, { select: 'CompanyId, Status' });
  if (!emp || emp.CompanyId !== Number(companyId)) throw httpError('Empleado no encontrado en la empresa.', 404);

  // The leave type defines the unit and limits (never trust the client)
  const type = await pool.findOne('HrLeaveTypes', {
    Id: Number(leaveTypeId),
    CompanyId: companyId,
    IsActive: true
  }, { select: 'Id, Name, Unit, MaxDaysPerYear, RequiresAttachment' });
  if (!type) throw httpError('Tipo de permiso o licencia no válido.', 404);

  const effUnit = type.Unit;
  if (effUnit === 'Dias' && !Number.isInteger(dur)) throw httpError('La duración de este tipo de permiso debe expresarse en días enteros.');
  if (effUnit === 'Horas') {
    if (!startTime || !endTime) throw httpError('Los permisos por horas requieren hora de inicio y de fin.');
    if (startDate !== endDate) throw httpError('Los permisos por horas deben realizarse en un solo día.');
  }
  if (type.RequiresAttachment && !attachedFileId) {
    throw httpError(`"${type.Name}" requiere adjuntar un documento de soporte.`);
  }

  // Yearly cap per type
  if (type.MaxDaysPerYear) {
    const usedRes = await pool.request()
      .input('empId', employeeId)
      .input('typeId', type.Id)
      .input('year', Number(startDate.slice(0, 4)))
      .query(`
        SELECT COALESCE(SUM(Duration), 0) AS used FROM HrLeaveRequests
        WHERE EmployeeId = @empId AND LeaveTypeId = @typeId AND Status IN ('Pendiente', 'Aprobada') AND EXTRACT(YEAR FROM StartDate)::int = @year;
      `);
    const used = Number(usedRes.recordset[0].used);
    if (used + dur > type.MaxDaysPerYear) {
      throw httpError(`Excede el máximo anual de "${type.Name}" (${type.MaxDaysPerYear} ${effUnit.toLowerCase()}). Acumulado: ${used}.`, 409);
    }
  }

  const overlap = await pool.request()
    .input('empId', employeeId)
    .input('start', startDate)
    .input('end', endDate)
    .query(`
      SELECT Id FROM HrLeaveRequests
      WHERE EmployeeId = @empId AND Status IN ('Pendiente', 'Aprobada') AND StartDate <= @end AND EndDate >= @start
        AND Unit = 'Dias' LIMIT 1;
    `);
  if (effUnit === 'Dias' && overlap.recordset[0]) {
    throw httpError('Ya existe una solicitud de permiso pendiente o aprobada que se solapa con esas fechas.', 409);
  }

  const flow = await getApprovalFlow(pool, companyId, 'Permiso');
  if (!flow || !flow.steps.length) throw httpError("No hay un flujo de aprobación configurado para solicitudes de tipo 'Permiso'.", 409);

  const req = pool.request()
    .input('companyId', companyId)
    .input('empId', employeeId)
    .input('typeId', type.Id)
    .input('start', startDate)
    .input('end', endDate)
    .input('unit', effUnit)
    .input('duration', dur)
    .input('reason', String(reason).trim().slice(0, 500))
    .input('startTime', startTime || null)
    .input('endTime', endTime || null)
    .input('fileId', attachedFileId || null);

  const insRes = await req.query(`
    INSERT INTO HrLeaveRequests (
      CompanyId, EmployeeId, LeaveTypeId, StartDate, EndDate,
      StartTime, EndTime, Unit, Duration, Reason, AttachedFileId, Status
    )
    VALUES (
      @companyId, @empId, @typeId, @start, @end,
      CAST(@startTime AS TIME), CAST(@endTime AS TIME), @unit, @duration, @reason, @fileId, 'Pendiente'
    )
      RETURNING Id, StartDate, EndDate, Duration, Unit, Status;
  `);

  const leaveRequest = insRes.recordset[0];

  let approval;
  try {
    approval = await createApprovalRequest(pool, {
      companyId,
      requestType: 'Permiso',
      entityName: 'HrLeaveRequests',
      entityId: leaveRequest.Id,
      requesterEmployeeId: employeeId
    });
  } catch (err) {
    await pool.delete('HrLeaveRequests', leaveRequest.Id);
    throw err;
  }

  await pool.update('HrLeaveRequests', leaveRequest.Id, { ApprovalRequestId: approval.Id });

  return { leaveRequest, approval };
}

/**
 * Applies leave approval
 */
export async function applyLeaveApproval(pool, leaveRequestId) {
  const reqRes = await pool.request()
    .input('id', leaveRequestId)
    .query('SELECT * FROM HrLeaveRequests WHERE Id = @id;');
  const req = reqRes.recordset[0];
  if (!req || req.Status === 'Aprobada') return;

  await pool.update('HrLeaveRequests', leaveRequestId, { Status: 'Aprobada' });

  // Hourly permits do not turn the whole day into an absence
  if (req.Unit === 'Horas') return;

  for (const { dateStr, dow } of eachDate(req.StartDate, req.EndDate)) {
    if (dow === 0 || dow === 6) continue;
    await pool.request()
      .input('companyId', req.CompanyId)
      .input('empId', req.EmployeeId)
      .input('date', dateStr)
      .input('notes', `Permiso aprobado: ${req.Reason} (Solicitud #${req.Id})`.slice(0, 500))
      .query(`
        INSERT INTO HrAttendance (CompanyId, EmployeeId, WorkDate, Status, Notes)
        VALUES (@companyId, @empId, @date, 'Permiso', @notes)
        ON CONFLICT (EmployeeId, WorkDate) DO UPDATE SET
          Status = 'Permiso',
          Notes = EXCLUDED.Notes
        WHERE HrAttendance.CheckInTime IS NULL;
      `);
  }
}

/**
 * Rejects leave request
 */
export async function rejectLeaveRequest(pool, leaveRequestId, rejectionReason = null) {
  await pool.request()
    .input('id', leaveRequestId)
    .input('reason', rejectionReason || null)
    .query("UPDATE HrLeaveRequests SET Status = 'Rechazada', RejectionReason = @reason WHERE Id = @id;");
}

/**
 * Lists leave requests with filters and pagination. `visibleFor` restricts by the user's employee scope.
 */
export async function listLeaveRequests(pool, {
  companyId,
  employeeId = null,
  status = null,
  page = 1,
  pageSize = 20,
  visibleFor = null
}) {
  page = Math.max(1, Number(page) || 1);
  pageSize = Math.min(500, Math.max(1, Number(pageSize) || 20));
  const offset = (page - 1) * pageSize;
  let where = `WHERE lr.CompanyId = @companyId`;

  if (employeeId) where += ` AND lr.EmployeeId = @empId`;
  if (status) where += ` AND lr.Status = @status`;
  if (visibleFor) where += ` AND lr.EmployeeId IN (SELECT EmployeeId FROM fn_HrVisibleEmployees(@visUser, FALSE, FALSE))`;

  const req = pool.request().input('companyId', companyId);
  if (employeeId) req.input('empId', Number(employeeId));
  if (status) req.input('status', status);
  if (visibleFor) req.input('visUser', visibleFor.userId);

  const countQuery = `SELECT COUNT(*) AS total FROM HrLeaveRequests lr ${where};`;

  const dataQuery = `
    SELECT lr.Id, lr.CompanyId, lr.EmployeeId, lr.LeaveTypeId,
           lr.StartDate, lr.EndDate,
           LEFT(lr.StartTime::text, 5) AS StartTime,
           LEFT(lr.EndTime::text, 5) AS EndTime,
           lr.Unit, lr.Duration, lr.Reason, lr.AttachedFileId,
           lr.ApprovalRequestId, lr.Status, lr.RejectionReason, lr.CreatedAt,
           lt.Name AS LeaveTypeName, lt.IsPaid,
           CONCAT(e.FirstName, ' ', e.LastName) AS EmployeeName,
           e.EmployeeCode,
           d.Name AS DepartmentName,
           p.Title AS PositionTitle
    FROM HrLeaveRequests lr
    JOIN HrLeaveTypes lt ON lt.Id = lr.LeaveTypeId
    JOIN HrEmployees e ON e.Id = lr.EmployeeId
    LEFT JOIN HrDepartments d ON d.Id = e.DepartmentId
    LEFT JOIN HrPositions p ON p.Id = e.PositionId
    ${where}
    ORDER BY lr.CreatedAt DESC
    LIMIT @pageSize OFFSET @offset;
  `;

  req.input('offset', offset);
  req.input('pageSize', pageSize);

  const [countRes, dataRes] = await Promise.all([
    req.query(countQuery),
    req.query(dataQuery)
  ]);

  return { total: countRes.recordset[0].total, data: dataRes.recordset, page, pageSize };
}
