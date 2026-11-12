import { createApprovalRequest, getApprovalFlow } from './approvals.repo.js';

function httpError(message, status = 400) {
  const err = new Error(message);
  err.status = status;
  return err;
}

const isoDate = d => new Date(d).toISOString().slice(0, 10);

/** Iterates every calendar date (UTC-safe) between two DATE values, yielding { dateStr, dow } with dow 0=Sun..6=Sat. */
function* eachDate(startDate, endDate) {
  const cur = new Date(`${isoDate(startDate)}T00:00:00Z`);
  const end = new Date(`${isoDate(endDate)}T00:00:00Z`);
  while (cur <= end) {
    yield { dateStr: cur.toISOString().slice(0, 10), dow: cur.getUTCDay() };
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
}

/** Working days (Mon-Fri) between two dates, inclusive. */
export function countBusinessDays(startDate, endDate) {
  let n = 0;
  for (const { dow } of eachDate(startDate, endDate)) if (dow !== 0 && dow !== 6) n++;
  return n;
}

/**
 * Gets or initializes the vacation balance for an employee for a given year (default: current)
 */
export async function getEmployeeVacationBalance(pool, employeeId, year = new Date().getFullYear()) {
  const empRes = await pool.request()
    .input('id', Number(employeeId))
    .query('SELECT Id, CompanyId, HireDate FROM HrEmployees WHERE Id = @id;');
  const emp = empRes.recordset[0];
  if (!emp) throw httpError('Empleado no encontrado.', 404);

  // Seniority at the end of the requested period year
  let seniorityYears = 0;
  if (emp.HireDate) {
    const ref = new Date(Date.UTC(year, 11, 31));
    seniorityYears = Math.max(0, Math.floor((ref - new Date(emp.HireDate)) / (1000 * 60 * 60 * 24 * 365.25)));
  }

  const balRes = await pool.request()
    .input('empId', emp.Id)
    .input('year', year)
    .query('SELECT * FROM HrVacationBalances WHERE EmployeeId = @empId AND PeriodYear = @year;');

  let balance = balRes.recordset[0];

  if (!balance) {
    // Days earned by seniority (RD Labor Code Art. 177), configured per company in HrVacationPolicies.
    // Fallback when no policy exists: 14 days from 1 year, 18 days from 5 years. Under 1 year is prorated.
    let daysGranted = 14.0;
    if (emp.HireDate) {
      const diffYears = (new Date() - new Date(emp.HireDate)) / (1000 * 60 * 60 * 24 * 365.25);
      if (diffYears < 1.0) {
        daysGranted = Math.max(0, Math.floor(diffYears * 12 * 1.16));
      } else {
        const fullYears = Math.floor(diffYears);
        const policyRes = await pool.request()
          .input('companyId', emp.CompanyId)
          .input('years', fullYears)
          .query(`
            SELECT DaysGranted FROM HrVacationPolicies
            WHERE CompanyId = @companyId AND MinYearsService <= @years
              AND (MaxYearsService IS NULL OR MaxYearsService >= @years)
            ORDER BY MinYearsService DESC LIMIT 1;
          `);
        const policyDays = policyRes.recordset[0]?.DaysGranted;
        daysGranted = policyDays != null ? Number(policyDays) : (diffYears >= 5.0 ? 18.0 : 14.0);
      }
    }

    balance = await pool.insert('HrVacationBalances', {
      EmployeeId: emp.Id,
      PeriodYear: year,
      DaysEarned: daysGranted,
      DaysUsed: 0.0,
      DaysPending: 0.0
    });
  }

  const available = Math.max(0, Number(balance.DaysEarned) - Number(balance.DaysUsed) - Number(balance.DaysPending));
  return {
    ...balance,
    HireDate: emp.HireDate,
    SeniorityYears: seniorityYears,
    DaysEntitled: Number(balance.DaysEarned),
    DaysAvailable: available,
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
  const days = Number(daysRequested);
  if (!Number.isInteger(days) || days <= 0) throw httpError('La cantidad de días debe ser un número entero mayor que cero.');

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(startDate)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(endDate))) {
    throw httpError('Fechas inválidas.');
  }
  if (startDate > endDate) throw httpError('La fecha de inicio no puede ser posterior a la fecha de fin.');
  if (startDate.slice(0, 4) !== endDate.slice(0, 4)) {
    throw httpError('Una solicitud no puede abarcar dos años; divídala por período anual.');
  }
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (new Date(`${startDate}T00:00:00`) < today) throw httpError('La fecha de inicio no puede estar en el pasado.');

  const businessDays = countBusinessDays(startDate, endDate);
  if (days > businessDays) {
    throw httpError(`El rango seleccionado solo contiene ${businessDays} día(s) laborable(s); no puede solicitar ${days}.`);
  }

  const empRes = await pool.request()
    .input('id', employeeId)
    .query('SELECT CompanyId, Status FROM HrEmployees WHERE Id = @id;');
  const emp = empRes.recordset[0];
  if (!emp || emp.CompanyId !== Number(companyId)) throw httpError('Empleado no encontrado en la empresa.', 404);
  if (emp.Status !== 'Activo') throw httpError(`Un empleado en estado "${emp.Status}" no puede solicitar vacaciones.`, 409);

  const year = Number(startDate.slice(0, 4));
  const balance = await getEmployeeVacationBalance(pool, employeeId, year);
  if (days > balance.DaysAvailable) {
    throw httpError(`Días solicitados (${days}) exceden el saldo disponible (${balance.DaysAvailable} días).`, 409);
  }

  const overlap = await pool.request()
    .input('empId', employeeId)
    .input('start', startDate)
    .input('end', endDate)
    .query(`
      SELECT Id FROM HrVacationRequests
      WHERE EmployeeId = @empId AND Status IN ('Pendiente', 'Aprobada') AND StartDate <= @end AND EndDate >= @start LIMIT 1;
    `);
  if (overlap.recordset[0]) throw httpError('Ya existe una solicitud de vacaciones pendiente o aprobada que se solapa con esas fechas.', 409);

  const flow = await getApprovalFlow(pool, companyId, 'Vacaciones');
  if (!flow || !flow.steps.length) throw httpError("No hay un flujo de aprobación configurado para solicitudes de tipo 'Vacaciones'.", 409);

  const vacationRequest = await pool.insert('HrVacationRequests', {
    CompanyId: companyId,
    EmployeeId: employeeId,
    StartDate: startDate,
    EndDate: endDate,
    ReturnDate: returnDate || null,
    DaysRequested: days,
    Reason: reason ? String(reason).slice(0, 500) : null,
    Status: 'Pendiente'
  }, { returning: 'Id, StartDate, EndDate, DaysRequested, Status' });

  await pool.request()
    .input('id', balance.Id)
    .input('days', days)
    .query(`UPDATE HrVacationBalances SET DaysPending = DaysPending + @days, UpdatedAt = now() WHERE Id = @id;`);

  let approval;
  try {
    approval = await createApprovalRequest(pool, {
      companyId,
      requestType: 'Vacaciones',
      entityName: 'HrVacationRequests',
      entityId: vacationRequest.Id,
      requesterEmployeeId: employeeId
    });
  } catch (err) {
    // Compensate: do not leave a dangling request holding days
    await pool.delete('HrVacationRequests', vacationRequest.Id);
    await pool.request().input('id', balance.Id).input('days', days)
      .query(`UPDATE HrVacationBalances SET DaysPending = CASE WHEN DaysPending >= @days THEN DaysPending - @days ELSE 0 END WHERE Id = @id;`);
    throw err;
  }

  await pool.update('HrVacationRequests', vacationRequest.Id, {
    ApprovalRequestId: approval.Id
  }, { returning: false });

  return { vacationRequest, approval };
}

/**
 * Applies vacation approval
 */
export async function applyVacationApproval(pool, vacationRequestId) {
  const req = await pool.findById('HrVacationRequests', vacationRequestId);
  if (!req || req.Status === 'Aprobada') return;

  const year = new Date(req.StartDate).getUTCFullYear();

  await pool.request()
    .input('empId', req.EmployeeId)
    .input('year', year)
    .input('days', req.DaysRequested)
    .query(`
      UPDATE HrVacationBalances
      SET DaysPending = CASE WHEN DaysPending >= @days THEN DaysPending - @days ELSE 0 END,
          DaysUsed = DaysUsed + @days,
          UpdatedAt = now()
      WHERE EmployeeId = @empId AND PeriodYear = @year;
    `);

  await pool.request()
    .input('id', vacationRequestId)
    .query("UPDATE HrVacationRequests SET Status = 'Aprobada' WHERE Id = @id;");

  // Mark attendance for the working days of the vacation (never overwrite real punches)
  for (const { dateStr, dow } of eachDate(req.StartDate, req.EndDate)) {
    if (dow === 0 || dow === 6) continue;
    await pool.request()
      .input('companyId', req.CompanyId)
      .input('empId', req.EmployeeId)
      .input('date', dateStr)
      .input('notes', `Vacaciones aprobadas (Solicitud #${req.Id})`)
      .query(`
        INSERT INTO HrAttendance (CompanyId, EmployeeId, WorkDate, Status, Notes)
        VALUES (@companyId, @empId, @date, 'Vacaciones', @notes)
        ON CONFLICT (EmployeeId, WorkDate) DO UPDATE SET
          Status = 'Vacaciones',
          Notes = EXCLUDED.Notes
        WHERE HrAttendance.CheckInTime IS NULL;
      `);
  }
}

/**
 * Rejects vacation request
 */
export async function rejectVacationRequest(pool, vacationRequestId, rejectionReason = null) {
  const reqRes = await pool.request()
    .input('id', vacationRequestId)
    .query('SELECT * FROM HrVacationRequests WHERE Id = @id;');
  const req = reqRes.recordset[0];
  if (!req || req.Status === 'Rechazada') return;

  const year = new Date(req.StartDate).getUTCFullYear();

  await pool.request()
    .input('empId', req.EmployeeId)
    .input('year', year)
    .input('days', req.DaysRequested)
    .query(`
      UPDATE HrVacationBalances
      SET DaysPending = CASE WHEN DaysPending >= @days THEN DaysPending - @days ELSE 0 END,
          UpdatedAt = now()
      WHERE EmployeeId = @empId AND PeriodYear = @year;
    `);

  await pool.request()
    .input('id', vacationRequestId)
    .input('reason', rejectionReason || null)
    .query("UPDATE HrVacationRequests SET Status = 'Rechazada', RejectionReason = @reason WHERE Id = @id;");
}

/**
 * Lists vacation requests with filters. `visibleFor` restricts rows by the user's employee scope.
 */
export async function listVacationRequests(pool, {
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
  let where = `WHERE v.CompanyId = @companyId`;

  if (employeeId) where += ` AND v.EmployeeId = @empId`;
  if (status) where += ` AND v.Status = @status`;
  if (visibleFor) where += ` AND v.EmployeeId IN (SELECT EmployeeId FROM fn_HrVisibleEmployees(@visUser, FALSE, FALSE))`;

  const req = pool.request().input('companyId', companyId);
  if (employeeId) req.input('empId', Number(employeeId));
  if (status) req.input('status', status);
  if (visibleFor) req.input('visUser', visibleFor.userId);

  const countQuery = `SELECT COUNT(*) AS total FROM HrVacationRequests v ${where};`;

  const dataQuery = `
    SELECT v.Id, v.CompanyId, v.EmployeeId, v.StartDate, v.EndDate, v.ReturnDate,
           v.DaysRequested, v.Reason, v.ApprovalRequestId, v.Status, v.RejectionReason, v.CreatedAt,
           CONCAT(e.FirstName, ' ', e.LastName) AS EmployeeName,
           e.EmployeeCode,
           d.Name AS DepartmentName,
           p.Title AS PositionTitle
    FROM HrVacationRequests v
    JOIN HrEmployees e ON e.Id = v.EmployeeId
    LEFT JOIN HrDepartments d ON d.Id = e.DepartmentId
    LEFT JOIN HrPositions p ON p.Id = e.PositionId
    ${where}
    ORDER BY v.CreatedAt DESC
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

/**
 * Calendar of approved absences (vacations + leaves) overlapping a month/year.
 * Returns normalized events: { id, type, employeeId, employeeName, departmentName, startDate, endDate, days }.
 */
export async function getVacationCalendar(pool, { companyId, year, month = null, departmentId = null, visibleFor = null }) {
  const y = Number(year);
  const from = month ? new Date(Date.UTC(y, Number(month) - 1, 1)) : new Date(Date.UTC(y, 0, 1));
  const to = month ? new Date(Date.UTC(y, Number(month), 0)) : new Date(Date.UTC(y, 11, 31));

  const req = pool.request()
    .input('companyId', companyId)
    .input('from', from.toISOString().slice(0, 10))
    .input('to', to.toISOString().slice(0, 10));

  let extra = '';
  if (departmentId) {
    extra += ' AND e.DepartmentId = @deptId';
    req.input('deptId', Number(departmentId));
  }
  if (visibleFor) {
    extra += ' AND e.Id IN (SELECT EmployeeId FROM fn_HrVisibleEmployees(@visUser, FALSE, FALSE))';
    req.input('visUser', visibleFor.userId);
  }

  const result = await req.query(`
    SELECT * FROM (
      SELECT v.Id, 'Vacaciones' AS type, v.EmployeeId,
             CONCAT(e.FirstName, ' ', e.LastName) AS employeeName, d.Name AS departmentName,
             v.StartDate AS startDate, v.EndDate AS endDate, CAST(v.DaysRequested AS DECIMAL(6,2)) AS days
      FROM HrVacationRequests v
      JOIN HrEmployees e ON e.Id = v.EmployeeId
      LEFT JOIN HrDepartments d ON d.Id = e.DepartmentId
      WHERE v.CompanyId = @companyId AND v.Status = 'Aprobada' AND v.StartDate <= @to AND v.EndDate >= @from ${extra}
      UNION ALL
      SELECT l.Id, lt.Name AS type, l.EmployeeId,
             CONCAT(e.FirstName, ' ', e.LastName), d.Name,
             l.StartDate, l.EndDate, l.Duration
      FROM HrLeaveRequests l
      JOIN HrLeaveTypes lt ON lt.Id = l.LeaveTypeId
      JOIN HrEmployees e ON e.Id = l.EmployeeId
      LEFT JOIN HrDepartments d ON d.Id = e.DepartmentId
      WHERE l.CompanyId = @companyId AND l.Status = 'Aprobada' AND l.StartDate <= @to AND l.EndDate >= @from ${extra}
    ) AS ev
    ORDER BY ev.startDate ASC;
  `);

  return result.recordset;
}
