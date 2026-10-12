import sql from 'mssql/msnodesqlv8.js';
import { createApprovalRequest } from './approvals.repo.js';

/**
 * Gets or initializes the vacation balance for an employee for the current year
 */
export async function getEmployeeVacationBalance(pool, employeeId) {
  const currentYear = new Date().getFullYear();

  // Fetch employee hire date and company ID
  const empRes = await pool.request()
    .input('id', sql.Int, Number(employeeId))
    .query('SELECT Id, CompanyId, HireDate FROM dbo.HrEmployees WHERE Id = @id;');
  const emp = empRes.recordset[0];
  if (!emp) throw new Error('Empleado no encontrado.');

  // Check if balance record exists for this year
  const balRes = await pool.request()
    .input('empId', sql.Int, emp.Id)
    .input('year', sql.Int, currentYear)
    .query('SELECT * FROM dbo.HrVacationBalances WHERE EmployeeId = @empId AND PeriodYear = @year;');

  let balance = balRes.recordset[0];

  if (!balance) {
    // Calculate days earned based on seniority (RD Labor Code Art. 177)
    let daysGranted = 14.0;
    if (emp.HireDate) {
      const hire = new Date(emp.HireDate);
      const diffYears = (new Date() - hire) / (1000 * 60 * 60 * 24 * 365.25);

      if (diffYears < 1.0) {
        // Less than 1 year: proportional (1.16 days per month) or 0 according to policy
        daysGranted = Math.max(0, Math.floor(diffYears * 12 * 1.16));
      } else if (diffYears >= 5.0) {
        daysGranted = 18.0;
      } else {
        daysGranted = 14.0;
      }
    }

    const insRes = await pool.request()
      .input('empId', sql.Int, emp.Id)
      .input('year', sql.Int, currentYear)
      .input('earned', sql.Decimal(5, 1), daysGranted)
      .query(`
        INSERT INTO dbo.HrVacationBalances (EmployeeId, PeriodYear, DaysEarned, DaysUsed, DaysPending)
        OUTPUT INSERTED.*
        VALUES (@empId, @year, @earned, 0.0, 0.0);
      `);
    balance = insRes.recordset[0];
  }

  const available = Math.max(0, balance.DaysEarned - balance.DaysUsed - balance.DaysPending);
  return {
    ...balance,
    daysAvailable: available
  };
}

/**
 * Creates a vacation request and connects to approval workflow
 */
export async function createVacationRequest(pool, {
  companyId,
  employeeId,
  startDate,
  endDate,
  returnDate = null,
  daysRequested,
  reason = null
}) {
  const balance = await getEmployeeVacationBalance(pool, employeeId);
  if (daysRequested > balance.daysAvailable) {
    throw new Error(`Días solicitados (${daysRequested}) exceden el saldo disponible (${balance.daysAvailable} días).`);
  }

  const start = new Date(startDate);
  const end = new Date(endDate);
  if (start > end) {
    throw new Error('La fecha de inicio no puede ser posterior a la fecha de fin.');
  }

  // Create vacation request record
  const insRes = await pool.request()
    .input('companyId', sql.Int, companyId)
    .input('empId', sql.Int, employeeId)
    .input('start', sql.Date, startDate)
    .input('end', sql.Date, endDate)
    .input('ret', sql.Date, returnDate || null)
    .input('days', sql.Int, daysRequested)
    .input('reason', sql.NVarChar(500), reason || null)
    .query(`
      INSERT INTO dbo.HrVacationRequests (CompanyId, EmployeeId, StartDate, EndDate, ReturnDate, DaysRequested, Reason, Status)
      OUTPUT INSERTED.Id, INSERTED.StartDate, INSERTED.EndDate, INSERTED.DaysRequested, INSERTED.Status
      VALUES (@companyId, @empId, @start, @end, @ret, @days, @reason, N'Pendiente');
    `);

  const vacationRequest = insRes.recordset[0];

  // Increase pending days in balance
  await pool.request()
    .input('id', sql.Int, balance.Id)
    .input('days', sql.Decimal(5, 1), daysRequested)
    .query(`
      UPDATE dbo.HrVacationBalances
      SET DaysPending = DaysPending + @days, UpdatedAt = SYSUTCDATETIME()
      WHERE Id = @id;
    `);

  // Initiate approval request
  const approval = await createApprovalRequest(pool, {
    companyId,
    requestType: 'Vacaciones',
    entityName: 'HrVacationRequests',
    entityId: vacationRequest.Id,
    requesterEmployeeId: employeeId
  });

  await pool.request()
    .input('id', sql.Int, vacationRequest.Id)
    .input('appId', sql.Int, approval.Id)
    .query('UPDATE dbo.HrVacationRequests SET ApprovalRequestId = @appId WHERE Id = @id;');

  return { vacationRequest, approval };
}

/**
 * Applies vacation approval
 */
export async function applyVacationApproval(pool, vacationRequestId) {
  const reqRes = await pool.request()
    .input('id', sql.Int, vacationRequestId)
    .query('SELECT * FROM dbo.HrVacationRequests WHERE Id = @id;');
  const req = reqRes.recordset[0];
  if (!req || req.Status === 'Aprobada') return;

  const currentYear = new Date(req.StartDate).getFullYear();

  // Deduct from pending and add to used
  await pool.request()
    .input('empId', sql.Int, req.EmployeeId)
    .input('year', sql.Int, currentYear)
    .input('days', sql.Decimal(5, 1), req.DaysRequested)
    .query(`
      UPDATE dbo.HrVacationBalances
      SET DaysPending = CASE WHEN DaysPending >= @days THEN DaysPending - @days ELSE 0 END,
          DaysUsed = DaysUsed + @days,
          UpdatedAt = SYSUTCDATETIME()
      WHERE EmployeeId = @empId AND PeriodYear = @year;
    `);

  // Update status in vacation request
  await pool.request()
    .input('id', sql.Int, vacationRequestId)
    .query("UPDATE dbo.HrVacationRequests SET Status = N'Aprobada' WHERE Id = @id;");

  // Create attendance entries for vacation dates
  const cur = new Date(req.StartDate);
  const end = new Date(req.EndDate);
  while (cur <= end) {
    const dateStr = cur.toISOString().slice(0, 10);
    // Only mark non-weekends (simple check)
    const day = cur.getDay();
    if (day !== 0 && day !== 6) {
      await pool.request()
        .input('companyId', sql.Int, req.CompanyId)
        .input('empId', sql.Int, req.EmployeeId)
        .input('date', sql.Date, dateStr)
        .input('notes', sql.NVarChar(500), `Vacaciones aprobadas (Solicitud #${req.Id})`)
        .query(`
          IF NOT EXISTS (SELECT 1 FROM dbo.HrAttendance WHERE EmployeeId = @empId AND WorkDate = @date)
            INSERT INTO dbo.HrAttendance (CompanyId, EmployeeId, WorkDate, Status, Notes)
            VALUES (@companyId, @empId, @date, N'Vacaciones', @notes);
          ELSE
            UPDATE dbo.HrAttendance SET Status = N'Vacaciones', Notes = @notes WHERE EmployeeId = @empId AND WorkDate = @date;
        `);
    }
    cur.setDate(cur.getDate() + 1);
  }
}

/**
 * Rejects vacation request
 */
export async function rejectVacationRequest(pool, vacationRequestId, rejectionReason = null) {
  const reqRes = await pool.request()
    .input('id', sql.Int, vacationRequestId)
    .query('SELECT * FROM dbo.HrVacationRequests WHERE Id = @id;');
  const req = reqRes.recordset[0];
  if (!req || req.Status === 'Rechazada') return;

  const currentYear = new Date(req.StartDate).getFullYear();

  // Restore pending days
  await pool.request()
    .input('empId', sql.Int, req.EmployeeId)
    .input('year', sql.Int, currentYear)
    .input('days', sql.Decimal(5, 1), req.DaysRequested)
    .query(`
      UPDATE dbo.HrVacationBalances
      SET DaysPending = CASE WHEN DaysPending >= @days THEN DaysPending - @days ELSE 0 END,
          UpdatedAt = SYSUTCDATETIME()
      WHERE EmployeeId = @empId AND PeriodYear = @year;
    `);

  await pool.request()
    .input('id', sql.Int, vacationRequestId)
    .input('reason', sql.NVarChar(500), rejectionReason || null)
    .query("UPDATE dbo.HrVacationRequests SET Status = N'Rechazada', RejectionReason = @reason WHERE Id = @id;");
}

/**
 * Lists vacation requests with filters
 */
export async function listVacationRequests(pool, {
  companyId,
  employeeId = null,
  status = null,
  page = 1,
  pageSize = 20
}) {
  const offset = (Math.max(1, page) - 1) * pageSize;
  let where = `WHERE v.CompanyId = @companyId`;

  if (employeeId) where += ` AND v.EmployeeId = @empId`;
  if (status) where += ` AND v.Status = @status`;

  const req = pool.request().input('companyId', sql.Int, companyId);
  if (employeeId) req.input('empId', sql.Int, Number(employeeId));
  if (status) req.input('status', sql.NVarChar(30), status);

  const countQuery = `SELECT COUNT(*) AS total FROM dbo.HrVacationRequests v ${where};`;

  const dataQuery = `
    SELECT v.Id, v.CompanyId, v.EmployeeId, v.StartDate, v.EndDate, v.ReturnDate,
           v.DaysRequested, v.Reason, v.ApprovalRequestId, v.Status, v.RejectionReason, v.CreatedAt,
           CONCAT(e.FirstName, N' ', e.LastName) AS EmployeeName,
           e.EmployeeCode,
           d.Name AS DepartmentName,
           p.Title AS PositionTitle
    FROM dbo.HrVacationRequests v
    JOIN dbo.HrEmployees e ON e.Id = v.EmployeeId
    LEFT JOIN dbo.HrDepartments d ON d.Id = e.DepartmentId
    LEFT JOIN dbo.HrPositions p ON p.Id = e.PositionId
    ${where}
    ORDER BY v.CreatedAt DESC
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
 * Gets vacations calendar entries
 */
export async function getVacationCalendar(pool, { companyId, year, month = null }) {
  let where = `WHERE v.CompanyId = @companyId AND v.Status = N'Aprobada'`;

  const req = pool.request()
    .input('companyId', sql.Int, companyId)
    .input('year', sql.Int, Number(year));

  where += ` AND (YEAR(v.StartDate) = @year OR YEAR(v.EndDate) = @year)`;

  if (month) {
    req.input('month', sql.Int, Number(month));
    where += ` AND (MONTH(v.StartDate) = @month OR MONTH(v.EndDate) = @month)`;
  }

  const result = await req.query(`
    SELECT v.Id, v.EmployeeId, v.StartDate, v.EndDate, v.DaysRequested,
           CONCAT(e.FirstName, N' ', e.LastName) AS EmployeeName,
           d.Name AS DepartmentName
    FROM dbo.HrVacationRequests v
    JOIN dbo.HrEmployees e ON e.Id = v.EmployeeId
    LEFT JOIN dbo.HrDepartments d ON d.Id = e.DepartmentId
    ${where}
    ORDER BY v.StartDate ASC;
  `);

  return result.recordset;
}
