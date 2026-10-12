import express from 'express';
import {
  listWorkShifts,
  saveWorkShift,
  recordCheckIn,
  recordCheckOut,
  listAttendance,
  requestAttendanceCorrection
} from '../repositories/attendance.repo.js';
import { resolveTargetCompanyId, assertCompanyAccess } from '../access.js';

export function createAttendanceRouter(ctx) {
  const router = express.Router();
  const { pool, requirePermission, writeAudit } = ctx;

  // List attendance records
  router.get('/attendance', requirePermission('RRHH Asistencia', 'Ver asistencia'), async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      if (!companyId) return res.status(400).json({ message: 'Se requiere especificar empresa.' });

      const result = await listAttendance(pool, {
        companyId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        departmentId: req.query.departmentId,
        branchId: req.query.branchId,
        employeeId: req.query.employeeId,
        status: req.query.status,
        page: req.query.page ? Number(req.query.page) : 1,
        pageSize: req.query.pageSize ? Number(req.query.pageSize) : 25
      });

      res.json(result);
    } catch (err) {
      console.error('Error listing attendance:', err);
      res.status(500).json({ message: 'Error al listar registros de asistencia.' });
    }
  });

  // Clock-in (Marca de Entrada)
  router.post('/attendance/clock-in', requirePermission('RRHH Asistencia', 'Registrar asistencia'), async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      let employeeId = req.body.employeeId;

      // If employeeId is not specified, try to find employee linked to current user
      if (!employeeId) {
        const empRes = await pool.request()
          .input('uid', req.user.userId)
          .query('SELECT Id FROM dbo.HrEmployees WHERE UserId = @uid;');
        employeeId = empRes.recordset[0]?.Id;
      }

      if (!employeeId) {
        return res.status(400).json({ message: 'Debe especificar el empleado para la marca de entrada.' });
      }

      const record = await recordCheckIn(pool, {
        companyId,
        employeeId: Number(employeeId),
        checkInTime: req.body.checkInTime || null,
        notes: req.body.notes || null
      });

      await writeAudit(req, 'CREATE', 'RRHH Asistencia', 'HrAttendance', String(record.Id), companyId, {
        context: `Marca de entrada registrada para empleado #${employeeId} - Estado: ${record.Status}`
      });

      res.status(201).json({ message: 'Entrada registrada exitosamente.', record });
    } catch (err) {
      console.error('Error recording check-in:', err);
      res.status(500).json({ message: err.message || 'Error al registrar entrada.' });
    }
  });

  // Clock-out (Marca de Salida)
  router.post('/attendance/clock-out', requirePermission('RRHH Asistencia', 'Registrar asistencia'), async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      let employeeId = req.body.employeeId;

      if (!employeeId) {
        const empRes = await pool.request()
          .input('uid', req.user.userId)
          .query('SELECT Id FROM dbo.HrEmployees WHERE UserId = @uid;');
        employeeId = empRes.recordset[0]?.Id;
      }

      if (!employeeId) {
        return res.status(400).json({ message: 'Debe especificar el empleado para la marca de salida.' });
      }

      const record = await recordCheckOut(pool, {
        companyId,
        employeeId: Number(employeeId),
        checkOutTime: req.body.checkOutTime || null,
        notes: req.body.notes || null
      });

      await writeAudit(req, 'UPDATE', 'RRHH Asistencia', 'HrAttendance', String(record.Id), companyId, {
        context: `Marca de salida registrada para empleado #${employeeId}`
      });

      res.json({ message: 'Salida registrada exitosamente.', record });
    } catch (err) {
      console.error('Error recording check-out:', err);
      res.status(500).json({ message: err.message || 'Error al registrar salida.' });
    }
  });

  // Request attendance correction
  router.post('/attendance/correction-request', requirePermission('RRHH Asistencia', 'Registrar asistencia'), async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      const { employeeId, workDate, requestedCheckIn, requestedCheckOut, reason } = req.body;

      if (!employeeId || !workDate || !reason?.trim()) {
        return res.status(400).json({ message: 'Empleado, fecha de trabajo y motivo son obligatorios.' });
      }

      const result = await requestAttendanceCorrection(pool, {
        companyId,
        employeeId: Number(employeeId),
        workDate,
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
      console.error('Error requesting attendance correction:', err);
      res.status(500).json({ message: err.message || 'Error al solicitar corrección de asistencia.' });
    }
  });

  // Shifts list & save
  router.get('/attendance/shifts', requirePermission('RRHH Asistencia', 'Administrar turnos'), async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      const shifts = await listWorkShifts(pool, companyId);
      res.json(shifts);
    } catch (err) {
      console.error('Error listing shifts:', err);
      res.status(500).json({ message: 'Error al listar turnos laborales.' });
    }
  });

  router.post('/attendance/shifts', requirePermission('RRHH Asistencia', 'Administrar turnos'), async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      const shift = await saveWorkShift(pool, companyId, req.body, req.body.id || null);

      await writeAudit(req, req.body.id ? 'UPDATE' : 'CREATE', 'RRHH Asistencia', 'HrWorkShift', String(shift.Id), companyId);
      res.status(201).json({ message: 'Turno guardado exitosamente.', shift });
    } catch (err) {
      console.error('Error saving shift:', err);
      res.status(500).json({ message: err.message || 'Error al guardar turno laboral.' });
    }
  });

  // Export attendance CSV
  router.get('/attendance/export', requirePermission('RRHH Asistencia', 'Exportar asistencia'), async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      const result = await listAttendance(pool, {
        companyId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        departmentId: req.query.departmentId,
        branchId: req.query.branchId,
        page: 1,
        pageSize: 10000
      });

      await writeAudit(req, 'EXPORT', 'RRHH Asistencia', 'HrAttendance', null, companyId, {
        context: `Exportación de ${result.data.length} marcas de asistencia a CSV`
      });

      const headers = ['Fecha', 'CodigoEmpleado', 'Empleado', 'Departamento', 'Sucursal', 'Entrada', 'Salida', 'TardanzaMin', 'SalidaAnticipadaMin', 'HorasRegulares', 'HorasExtras', 'Estado'];
      const lines = [headers.join(',')];

      for (const a of result.data) {
        lines.push([
          `"${a.WorkDate ? new Date(a.WorkDate).toISOString().slice(0, 10) : ''}"`,
          `"${a.EmployeeCode || ''}"`,
          `"${a.EmployeeName || ''}"`,
          `"${a.DepartmentName || ''}"`,
          `"${a.BranchName || ''}"`,
          `"${a.CheckInTime ? new Date(a.CheckInTime).toLocaleTimeString('es-DO') : ''}"`,
          `"${a.CheckOutTime ? new Date(a.CheckOutTime).toLocaleTimeString('es-DO') : ''}"`,
          a.LateMinutes,
          a.EarlyLeaveMinutes,
          (a.RegularMinutes / 60).toFixed(2),
          (a.OvertimeMinutes / 60).toFixed(2),
          `"${a.Status}"`
        ].join(','));
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="asistencia_${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send(lines.join('\r\n'));
    } catch (err) {
      console.error('Error exporting attendance:', err);
      res.status(500).json({ message: 'Error al exportar asistencia.' });
    }
  });

  return router;
}
