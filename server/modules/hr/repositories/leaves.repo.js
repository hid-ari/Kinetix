import sql from 'mssql/msnodesqlv8.js';
import { createApprovalRequest } from './approvals.repo.js';

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
  unit = 'Dias',
  duration,
  reason,
  attachedFileId = null
}) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (start > end) {
    throw new Error('La fecha de inicio no puede ser posterior a la fecha de fin.');
  }

  const req = pool.request()
    .input('companyId', sql.Int, companyId)
    .input('empId', sql.Int, employeeId)
    .input('typeId', sql.Int, Number(leaveTypeId))
    .input('start', sql.Date, startDate)
    .input('end', sql.Date, endDate)
    .input('unit', sql.NVarChar(10), unit)
    .input('duration', sql.Decimal(5, 2), Number(duration))
    .input('reason', sql.NVarChar(500), reason.trim());

  if (startTime) req.input('startTime', sql.VarChar(8), startTime);
  else req.input('startTime', sql.VarChar(8), null);

  if (endTime) req.input('endTime', sql.VarChar(8), endTime);
  else req.input('endTime', sql.VarChar(8), null);

  if (attachedFileId) req.input('fileId', sql.UniqueIdentifier, attachedFileId);
  else req.input('fileId', sql.UniqueIdentifier, null);

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

  // Initiate approval flow
  const approval = await createApprovalRequest(pool, {
    companyId,
    requestType: 'Permiso',
    entityName: 'HrLeaveRequests',
    entityId: leaveRequest.Id,
    requesterEmployeeId: employeeId
  });

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

  // Mark attendance for leave dates
  const cur = new Date(req.StartDate);
  const end = new Date(req.EndDate);
  while (cur <= end) {
    const dateStr = cur.toISOString().slice(0, 10);
    const day = cur.getDay();
    if (day !== 0 && day !== 6) {
      await pool.request()
        .input('companyId', sql.Int, req.CompanyId)
        .input('empId', sql.Int, req.EmployeeId)
        .input('date', sql.Date, dateStr)
        .input('notes', sql.NVarChar(500), `Permiso aprobado: ${req.Reason} (Solicitud #${req.Id})`)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM dbo.HrAttendance WHERE EmployeeId = @empId AND WorkDate = @date)
            INSERT INTO dbo.HrAttendance (CompanyId, EmployeeId, WorkDate, Status, Notes)
            VALUES (@companyId, @empId, @date, N'Permiso', @notes);
          ELSE
            UPDATE dbo.HrAttendance SET Status = N'Permiso', Notes = @notes WHERE EmployeeId = @empId AND WorkDate = @date;
        `);
    }
    cur.setDate(cur.getDate() + 1);
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
 * Lists leave requests with filters and pagination
 */
export async function listLeaveRequests(pool, {
  companyId,
  employeeId = null,
  status = null,
  page = 1,
  pageSize = 20
}) {
  const offset = (Math.max(1, page) - 1) * pageSize;
  let where = `WHERE lr.CompanyId = @companyId`;

  if (employeeId) where += ` AND lr.EmployeeId = @empId`;
  if (status) where += ` AND lr.Status = @status`;

  const req = pool.request().input('companyId', sql.Int, companyId);
  if (employeeId) req.input('empId', sql.Int, Number(employeeId));
  if (status) req.input('status', sql.NVarChar(30), status);

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
           d.Name AS DepartmentName
    FROM dbo.HrLeaveRequests lr
    JOIN dbo.HrLeaveTypes lt ON lt.Id = lr.LeaveTypeId
    JOIN dbo.HrEmployees e ON e.Id = lr.EmployeeId
    LEFT JOIN dbo.HrDepartments d ON d.Id = e.DepartmentId
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

  return {
    total: countRes.recordset[0].total,
    data: dataRes.recordset,
    page,
    pageSize
  };
}
