import express from 'express';
import {
  listWorkShifts,
  saveWorkShift,
  recordCheckIn,
  recordCheckOut,
  listAttendance,
  requestAttendanceCorrection,
  getEmployeeShift,
  getAttendanceForDate,
  localDateStr
} from '../repositories/attendance.repo.js';
import { resolveTargetCompanyId, assertCompanyAccess, isGlobalAdmin, isCompanyAdmin, isHrManager } from '../access.js';
import { resolveActingEmployeeId, NO_EMPLOYEE_MESSAGE } from '../employee-context.js';

function sendError(res, err, fallback) {
  if (err.status) return res.status(err.status).json({ message: err.message });
  console.error(fallback, err);
  return res.status(500).json({ message: fallback });
}

export function createAttendanceRouter(ctx) {
  const router = express.Router();
  const { pool, requirePermission, writeAudit } = ctx;

  const visibilityFilter = req => isHrManager(req)
    ? null
    : { userId: req.user.userId, isCompanyAdmin: false };

  // Today's attendance status for the logged-in user's employee record
  router.get('/attendance/today', requirePermission('RRHH Asistencia', 'Ver asistencia'), async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      if (!companyId) return res.status(400).json({ message: 'Se requiere especificar empresa.' });
      await assertCompanyAccess(pool, req, companyId);

      const employeeId = await resolveActingEmployeeId(pool, req, companyId, req.query.employeeId);

      let attendance = null;
      let shift = null;
      let employee = null;

      if (employeeId) {
        const empRes = await pool.request()
          .input('id', employeeId)
          .query('SELECT Id, CompanyId, FirstName, LastName, EmployeeCode FROM dbo.HrEmployees WHERE Id = @id;');
        employee = empRes.recordset[0] || null;
        shift = await getEmployeeShift(pool, employeeId, companyId);
        attendance = await getAttendanceForDate(pool, employeeId, localDateStr());
      } else {
        shift = await getEmployeeShift(pool, 0, companyId);
      }

      res.json({
        linked: Boolean(employeeId),
        message: employeeId ? null : NO_EMPLOYEE_MESSAGE,
        attendance: attendance ? {
          ...attendance,
          RegularHours: Number((attendance.RegularMinutes || 0) / 60).toFixed(2),
          OvertimeHours: Number((attendance.OvertimeMinutes || 0) / 60).toFixed(2)
        } : null,
        shift: shift ? {
          Id: shift.Id,
          Name: shift.Name,
          StartTime: typeof shift.StartTime === 'string' ? shift.StartTime : new Date(shift.StartTime).toISOString().slice(11, 19),
          EndTime: typeof shift.EndTime === 'string' ? shift.EndTime : new Date(shift.EndTime).toISOString().slice(11, 19),
          GraceMinutes: shift.GraceMinutes,
          BreakMinutes: shift.BreakMinutes
        } : null,
        employee
      });
    } catch (err) {
      sendError(res, err, 'Error al consultar asistencia de hoy.');
    }
  });

  // List attendance records
  router.get('/attendance', requirePermission('RRHH Asistencia', 'Ver asistencia'), async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      if (!companyId) return res.status(400).json({ message: 'Se requiere especificar empresa.' });
      await assertCompanyAccess(pool, req, companyId);

      const result = await listAttendance(pool, {
        companyId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        departmentId: req.query.departmentId,
        branchId: req.query.branchId,
        employeeId: req.query.employeeId,
        status: req.query.status,
        page: req.query.page ? Number(req.query.page) : 1,
        pageSize: req.query.pageSize ? Number(req.query.pageSize) : 25,
        visibleFor: visibilityFilter(req)
      });

      res.json(result);
    } catch (err) {
      sendError(res, err, 'Error al listar registros de asistencia.');
    }
  });

  // Check-in (Marca de Entrada)
  const handleCheckIn = async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      if (!companyId) return res.status(400).json({ message: 'Se requiere especificar empresa.' });
      const employeeId = await resolveActingEmployeeId(pool, req, companyId, req.body?.employeeId);
      if (!employeeId) return res.status(400).json({ message: NO_EMPLOYEE_MESSAGE });

      const today = await getAttendanceForDate(pool, employeeId, localDateStr());
      if (today?.CheckInTime) {
        return res.status(409).json({ message: 'Ya registró su entrada el día de hoy.' });
      }
      if (today && ['Vacaciones', 'Permiso'].includes(today.Status)) {
        return res.status(409).json({ message: `Hoy figura como "${today.Status}"; no corresponde registrar entrada.` });
      }

      // Only administrators may back-date a punch
      const allowCustomTime = isGlobalAdmin(req) || isCompanyAdmin(req);
      const record = await recordCheckIn(pool, {
        companyId,
        employeeId,
        checkInTime: allowCustomTime ? (req.body?.checkInTime || null) : null,
        notes: req.body?.notes || null
      });

      await writeAudit(req, 'CREATE', 'RRHH Asistencia', 'HrAttendance', String(record.Id), companyId, {
        context: `Marca de entrada registrada para empleado #${employeeId} - Estado: ${record.Status}`
      });

      res.status(201).json({ message: 'Entrada registrada exitosamente.', record });
    } catch (err) {
      sendError(res, err, 'Error al registrar entrada.');
    }
  };
  router.post('/attendance/check-in', requirePermission('RRHH Asistencia', 'Registrar asistencia'), handleCheckIn);
  router.post('/attendance/clock-in', requirePermission('RRHH Asistencia', 'Registrar asistencia'), handleCheckIn);

  // Check-out (Marca de Salida)
  const handleCheckOut = async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      if (!companyId) return res.status(400).json({ message: 'Se requiere especificar empresa.' });
      const employeeId = await resolveActingEmployeeId(pool, req, companyId, req.body?.employeeId);
      if (!employeeId) return res.status(400).json({ message: NO_EMPLOYEE_MESSAGE });

      const today = await getAttendanceForDate(pool, employeeId, localDateStr());
      if (today?.CheckOutTime) {
        return res.status(409).json({ message: 'Ya registró su salida el día de hoy.' });
      }

      const allowCustomTime = isGlobalAdmin(req) || isCompanyAdmin(req);
      const record = await recordCheckOut(pool, {
        companyId,
        employeeId,
        checkOutTime: allowCustomTime ? (req.body?.checkOutTime || null) : null,
        notes: req.body?.notes || null
      });

      await writeAudit(req, 'UPDATE', 'RRHH Asistencia', 'HrAttendance', String(record.Id), companyId, {
        context: `Marca de salida registrada para empleado #${employeeId}`
      });

      res.json({ message: 'Salida registrada exitosamente.', record });
    } catch (err) {
      sendError(res, err, 'Error al registrar salida.');
    }
  };
  router.post('/attendance/check-out', requirePermission('RRHH Asistencia', 'Registrar asistencia'), handleCheckOut);
  router.post('/attendance/clock-out', requirePermission('RRHH Asistencia', 'Registrar asistencia'), handleCheckOut);

  // Request attendance correction
  const handleCorrection = async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      if (!companyId) return res.status(400).json({ message: 'Se requiere especificar empresa.' });
      const employeeId = await resolveActingEmployeeId(pool, req, companyId, req.body?.employeeId);
      if (!employeeId) return res.status(400).json({ message: NO_EMPLOYEE_MESSAGE });

      const body = req.body || {};
      const workDate = body.workDate || body.attendanceDate;
      const { requestedCheckIn, requestedCheckOut, reason } = body;

      if (!workDate || !/^\d{4}-\d{2}-\d{2}/.test(workDate) || !reason?.trim()) {
        return res.status(400).json({ message: 'Fecha de trabajo y motivo son obligatorios.' });
      }

      const result = await requestAttendanceCorrection(pool, {
        companyId,
        employeeId,
        workDate: workDate.slice(0, 10),
        requestedCheckIn,
        requestedCheckOut,
        reason
      });

      await writeAudit(req, 'CREATE', 'RRHH Asistencia', 'HrAttendanceCorrection', String(result.correction.Id), companyId, {
        context: `Solicitud de corrección de marca para fecha ${workDate}`
      });

      res.status(201).json({
        message: 'Solicitud de corrección enviada a aprobación.',
        correction: result.correction
      });
    } catch (err) {
      sendError(res, err, 'Error al solicitar corrección de asistencia.');
    }
  };
  router.post('/attendance/corrections', requirePermission('RRHH Asistencia', 'Registrar asistencia'), handleCorrection);
  router.post('/attendance/correction-request', requirePermission('RRHH Asistencia', 'Registrar asistencia'), handleCorrection);

  // Shifts: any user who can see attendance may read them; managing requires 'Administrar turnos'
  router.get('/attendance/shifts', requirePermission('RRHH Asistencia', 'Ver asistencia'), async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      if (!companyId) return res.status(400).json({ message: 'Se requiere especificar empresa.' });
      await assertCompanyAccess(pool, req, companyId);
      const shifts = await listWorkShifts(pool, companyId);
      res.json(shifts);
    } catch (err) {
      sendError(res, err, 'Error al listar turnos laborales.');
    }
  });

  router.post('/attendance/shifts', requirePermission('RRHH Asistencia', 'Administrar turnos'), async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      if (!companyId) return res.status(400).json({ message: 'Se requiere especificar empresa.' });
      await assertCompanyAccess(pool, req, companyId);

      const { code, name, startTime, endTime, shiftType } = req.body || {};
      if (!code?.trim() || !name?.trim() || !startTime || !endTime) {
        return res.status(400).json({ message: 'Código, nombre, hora de inicio y hora de fin son obligatorios.' });
      }
      const timeRe = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
      if (!timeRe.test(startTime) || !timeRe.test(endTime)) {
        return res.status(400).json({ message: 'Las horas deben tener formato HH:mm.' });
      }
      if (shiftType !== 'Nocturno' && endTime <= startTime) {
        return res.status(400).json({ message: 'La hora de fin debe ser posterior a la hora de inicio.' });
      }

      const shift = await saveWorkShift(pool, companyId, req.body, req.body.id || null);
      if (!shift) return res.status(404).json({ message: 'Turno no encontrado.' });

      await writeAudit(req, req.body.id ? 'UPDATE' : 'CREATE', 'RRHH Asistencia', 'HrWorkShift', String(shift.Id), companyId);
      res.status(201).json({ message: 'Turno guardado exitosamente.', shift });
    } catch (err) {
      if (err.number === 2627 || err.number === 2601) {
        return res.status(409).json({ message: 'Ya existe un turno con ese código.' });
      }
      sendError(res, err, 'Error al guardar turno laboral.');
    }
  });

  // Export attendance CSV
  router.get('/attendance/export', requirePermission('RRHH Asistencia', 'Exportar asistencia'), async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      if (!companyId) return res.status(400).json({ message: 'Se requiere especificar empresa.' });
      await assertCompanyAccess(pool, req, companyId);

      const result = await listAttendance(pool, {
        companyId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        departmentId: req.query.departmentId,
        branchId: req.query.branchId,
        page: 1,
        pageSize: 10000,
        visibleFor: visibilityFilter(req)
      });

      await writeAudit(req, 'EXPORT', 'RRHH Asistencia', 'HrAttendance', null, companyId, {
        context: `Exportación de ${result.data.length} marcas de asistencia a CSV`
      });

      // Prevent CSV/Excel formula injection and break quotes safely
      const cell = v => {
        let s = String(v ?? '');
        if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
        return `"${s.replace(/"/g, '""')}"`;
      };

      const headers = ['Fecha', 'CodigoEmpleado', 'Empleado', 'Departamento', 'Sucursal', 'Entrada', 'Salida', 'TardanzaMin', 'SalidaAnticipadaMin', 'HorasRegulares', 'HorasExtras', 'Estado'];
      const lines = [headers.join(',')];

      for (const a of result.data) {
        lines.push([
          cell(a.WorkDate ? new Date(a.WorkDate).toISOString().slice(0, 10) : ''),
          cell(a.EmployeeCode),
          cell(a.EmployeeName),
          cell(a.DepartmentName),
          cell(a.BranchName),
          cell(a.CheckInTime ? new Date(a.CheckInTime).toLocaleTimeString('es-DO') : ''),
          cell(a.CheckOutTime ? new Date(a.CheckOutTime).toLocaleTimeString('es-DO') : ''),
          a.LateMinutes,
          a.EarlyLeaveMinutes,
          (a.RegularMinutes / 60).toFixed(2),
          (a.OvertimeMinutes / 60).toFixed(2),
          cell(a.Status)
        ].join(','));
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="asistencia_${localDateStr()}.csv"`);
      res.send('\uFEFF' + lines.join('\r\n'));
    } catch (err) {
      sendError(res, err, 'Error al exportar asistencia.');
    }
  });

  return router;
}
