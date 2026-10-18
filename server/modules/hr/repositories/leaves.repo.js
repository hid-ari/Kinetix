import sql from 'mssql/msnodesqlv8.js';
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
    .input('companyId', sql.Int, companyId)
    .query(`
      SELECT Id, CompanyId, Code, Name, IsPaid, RequiresAttachment, MaxDaysPerYear, Unit, IsActive
      FROM dbo.HrLeaveTypes
      WHERE CompanyId = @companyId AND IsActive = 1
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

  const empRes = await pool.request()
    .input('id', sql.Int, employeeId)
    .query('SELECT CompanyId, Status FROM dbo.HrEmployees WHERE Id = @id;');
  const emp = empRes.recordset[0];
  if (!emp || emp.CompanyId !== Number(companyId)) throw httpError('Empleado no encontrado en la empresa.', 404);

  // The leave type defines the unit and limits (never trust the client)
  const typeRes = await pool.request()
    .input('typeId', sql.Int, Number(leaveTypeId))
    .input('companyId', sql.Int, companyId)
    .query('SELECT Id, Name, Unit, MaxDaysPerYear, RequiresAttachment FROM dbo.HrLeaveTypes WHERE Id = @typeId AND CompanyId = @companyId AND IsActive = 1;');
  const type = typeRes.recordset[0];
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
      .input('empId', sql.Int, employeeId)
      .input('typeId', sql.Int, type.Id)
      .input('year', sql.Int, Number(startDate.slice(0, 4)))
      .query(`
        SELECT ISNULL(SUM(Duration), 0) AS used FROM dbo.HrLeaveRequests
        WHERE EmployeeId = @empId AND LeaveTypeId = @typeId AND Status IN (N'Pendiente', N'Aprobada') AND YEAR(StartDate) = @year;
      `);
    const used = Number(usedRes.recordset[0].used);
    if (used + dur > type.MaxDaysPerYear) {
      throw httpError(`Excede el máximo anual de "${type.Name}" (${type.MaxDaysPerYear} ${effUnit.toLowerCase()}). Acumulado: ${used}.`, 409);
    }
  }

  const overlap = await pool.request()
    .input('empId', sql.Int, employeeId)
    .input('start', sql.Date, startDate)
    .input('end', sql.Date, endDate)
    .query(`
      SELECT TOP 1 Id FROM dbo.HrLeaveRequests
      WHERE EmployeeId = @empId AND Status IN (N'Pendiente', N'Aprobada') AND StartDate <= @end AND EndDate >= @start
        AND Unit = N'Dias';
    `);
  if (effUnit === 'Dias' && overlap.recordset[0]) {
    throw httpError('Ya existe una solicitud de permiso pendiente o aprobada que se solapa con esas fechas.', 409);
  }

  const flow = await getApprovalFlow(pool, companyId, 'Permiso');
  if (!flow || !flow.steps.length) throw httpError("No hay un flujo de aprobación configurado para solicitudes de tipo 'Permiso'.", 409);

  const req = pool.request()
    .input('companyId', sql.Int, companyId)
    .input('empId', sql.Int, employeeId)
    .input('typeId', sql.Int, type.Id)
    .input('start', sql.Date, startDate)
    .input('end', sql.Date, endDate)
    .input('unit', sql.NVarChar(10), effUnit)
    .input('duration', sql.Decimal(5, 2), dur)
    .input('reason', sql.NVarChar(500), String(reason).trim().slice(0, 500))
    .input('startTime', sql.VarChar(8), startTime || null)
    .input('endTime', sql.VarChar(8), endTime || null)
    .input('fileId', sql.UniqueIdentifier, attachedFileId || null);

  const insRes = await req.query(`
    INSERT INTO dbo.HrLeaveRequests (
      CompanyId, EmployeeId, LeaveTypeId, StartDate, EndDate,
      StartTime, EndTime, Unit, Duration, Reason, AttachedFileId, Status
    )
    OUTPUT INSERTED.Id, INSERTED.StartDate, INSERTED.EndDate, INSERTED.Duration, INSERTED.Unit, INSERTED.Status
    VALUES (
      @companyId, @empId, @typeId, @start, @end,
      CAST(@startTime AS TIME), CAST(@endTime AS TIME), @unit, @duration, @reason, @fileId, N'Pendiente'
    );
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
    await pool.request().input('id', sql.Int, leaveRequest.Id).query('DELETE FROM dbo.HrLeaveRequests WHERE Id = @id;');
    throw err;
  }

  await pool.request()
    .input('id', sql.Int, leaveRequest.Id)
    .input('appId', sql.Int, approval.Id)
    .query('UPDATE dbo.HrLeaveRequests SET ApprovalRequestId = @appId WHERE Id = @id;');

  return { leaveRequest, approval };
}

/**
 * Applies leave approval
 */
export async function applyLeaveApproval(pool, leaveRequestId) {
  const reqRes = await pool.request()
    .input('id', sql.Int, leaveRequestId)
    .query('SELECT * FROM dbo.HrLeaveRequests WHERE Id = @id;');
  const req = reqRes.recordset[0];
  if (!req || req.Status === 'Aprobada') return;

  await pool.request()
    .input('id', sql.Int, leaveRequestId)
    .query("UPDATE dbo.HrLeaveRequests SET Status = N'Aprobada' WHERE Id = @id;");

  // Hourly permits do not turn the whole day into an absence
  if (req.Unit === 'Horas') return;

  for (const { dateStr, dow } of eachDate(req.StartDate, req.EndDate)) {
    if (dow === 0 || dow === 6) continue;
    await pool.request()
      .input('companyId', sql.Int, req.CompanyId)
      .input('empId', sql.Int, req.EmployeeId)
      .input('date', sql.Date, dateStr)
      .input('notes', sql.NVarChar(500), `Permiso aprobado: ${req.Reason} (Solicitud #${req.Id})`.slice(0, 500))
      .query(`
        IF NOT EXISTS (SELECT 1 FROM dbo.HrAttendance WHERE EmployeeId = @empId AND WorkDate = @date)
          INSERT INTO dbo.HrAttendance (CompanyId, EmployeeId, WorkDate, Status, Notes)
          VALUES (@companyId, @empId, @date, N'Permiso', @notes);
        ELSE
          UPDATE dbo.HrAttendance SET Status = N'Permiso', Notes = @notes
          WHERE EmployeeId = @empId AND WorkDate = @date AND CheckInTime IS NULL;
      `);
  }
}

/**
 * Rejects leave request
 */
export async function rejectLeaveRequest(pool, leaveRequestId, rejectionReason = null) {
  await pool.request()
    .input('id', sql.Int, leaveRequestId)
    .input('reason', sql.NVarChar(500), rejectionReason || null)
    .query("UPDATE dbo.HrLeaveRequests SET Status = N'Rechazada', RejectionReason = @reason WHERE Id = @id;");
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
  if (visibleFor) where += ` AND lr.EmployeeId IN (SELECT EmployeeId FROM dbo.fn_HrVisibleEmployees(@visUser, 0, 0))`;

  const req = pool.request().input('companyId', sql.Int, companyId);
  if (employeeId) req.input('empId', sql.Int, Number(employeeId));
  if (status) req.input('status', sql.NVarChar(30), status);
  if (visibleFor) req.input('visUser', sql.NVarChar(450), visibleFor.userId);

  const countQuery = `SELECT COUNT(*) AS total FROM dbo.HrLeaveRequests lr ${where};`;

  const dataQuery = `
    SELECT lr.Id, lr.CompanyId, lr.EmployeeId, lr.LeaveTypeId,
           lr.StartDate, lr.EndDate,
           CONVERT(VARCHAR(5), lr.StartTime, 108) AS StartTime,
           CONVERT(VARCHAR(5), lr.EndTime, 108) AS EndTime,
           lr.Unit, lr.Duration, lr.Reason, lr.AttachedFileId,
           lr.ApprovalRequestId, lr.Status, lr.RejectionReason, lr.CreatedAt,
           lt.Name AS LeaveTypeName, lt.IsPaid,
           CONCAT(e.FirstName, N' ', e.LastName) AS EmployeeName,
           e.EmployeeCode,
           d.Name AS DepartmentName,
           p.Title AS PositionTitle
    FROM dbo.HrLeaveRequests lr
    JOIN dbo.HrLeaveTypes lt ON lt.Id = lr.LeaveTypeId
    JOIN dbo.HrEmployees e ON e.Id = lr.EmployeeId
    LEFT JOIN dbo.HrDepartments d ON d.Id = e.DepartmentId
    LEFT JOIN dbo.HrPositions p ON p.Id = e.PositionId
    ${where}
    ORDER BY lr.CreatedAt DESC
    OFFSET @offset ROWS FETCH NEXT @pageSize ROWS ONLY;
  `;

  req.input('offset', sql.Int, offset);
  req.input('pageSize', sql.Int, pageSize);

  const [countRes, dataRes] = await Promise.all([
    req.query(countQuery),
    req.query(dataQuery)
  ]);

  return { total: countRes.recordset[0].total, data: dataRes.recordset, page, pageSize };
}
