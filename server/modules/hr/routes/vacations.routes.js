import express from 'express';
import {
  getEmployeeVacationBalance,
  createVacationRequest,
  listVacationRequests,
  getVacationCalendar
} from '../repositories/vacations.repo.js';
import { resolveTargetCompanyId, assertEmployeeAccess } from '../access.js';

export function createVacationsRouter(ctx) {
  const router = express.Router();
  const { pool, requirePermission, writeAudit } = ctx;

  // Get employee vacation balance (query param or current user)
  router.get('/vacations/balance', requirePermission('RRHH Vacaciones', 'Ver vacaciones'), async (req, res) => {
    try {
      let employeeId = req.query.employeeId;
      if (!employeeId) {
        const empRes = await pool.request()
          .input('uid', req.user.userId)
          .query('SELECT Id FROM dbo.HrEmployees WHERE UserId = @uid;');
        employeeId = empRes.recordset[0]?.Id;
      }

      if (!employeeId) {
        return res.json({
          HireDate: null,
          SeniorityYears: 0,
          DaysEntitled: 14,
          DaysPending: 0,
          DaysUsed: 0,
          DaysAvailable: 14
        });
      }

      await assertEmployeeAccess(pool, req, employeeId);
      const balance = await getEmployeeVacationBalance(pool, employeeId);
      res.json(balance);
    } catch (err) {
      console.error('Error fetching vacation balance:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al consultar saldo de vacaciones.' });
    }
  });

  // Get employee vacation balance by route param
  router.get('/vacations/balance/:employeeId', requirePermission('RRHH Vacaciones', 'Ver vacaciones'), async (req, res) => {
    try {
      await assertEmployeeAccess(pool, req, req.params.employeeId);
      const balance = await getEmployeeVacationBalance(pool, req.params.employeeId);
      res.json(balance);
    } catch (err) {
      console.error('Error fetching vacation balance:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al consultar saldo de vacaciones.' });
    }
  });

  // List vacation requests
  router.get('/vacations/requests', requirePermission('RRHH Vacaciones', 'Ver vacaciones'), async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      const result = await listVacationRequests(pool, {
        companyId,
        employeeId: req.query.employeeId,
        status: req.query.status,
        page: req.query.page ? Number(req.query.page) : 1,
        pageSize: req.query.pageSize ? Number(req.query.pageSize) : 20
      });
      res.json(result);
    } catch (err) {
      console.error('Error listing vacation requests:', err);
      res.status(500).json({ message: 'Error al listar solicitudes de vacaciones.' });
    }
  });

  // Submit vacation request
  router.post('/vacations/requests', requirePermission('RRHH Vacaciones', 'Solicitar vacaciones'), async (req, res) => {
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
        return res.status(400).json({ message: 'Debe especificar el empleado para la solicitud de vacaciones.' });
      }

      const { startDate, endDate, returnDate, daysRequested, reason } = req.body;
      if (!startDate || !endDate || !daysRequested) {
        return res.status(400).json({ message: 'Fechas de inicio, fin y cantidad de días son obligatorios.' });
      }

      const result = await createVacationRequest(pool, {
        companyId,
        employeeId: Number(employeeId),
        startDate,
        endDate,
        returnDate,
        daysRequested: Number(daysRequested),
        reason
      });

      await writeAudit(req, 'CREATE', 'RRHH Vacaciones', 'HrVacationRequest', String(result.vacationRequest.Id), companyId, {
        context: `Solicitud de ${daysRequested} días de vacaciones del ${startDate} al ${endDate}`
      });

      res.status(201).json({
        message: 'Solicitud de vacaciones registrada y enviada a aprobación.',
        request: result.vacationRequest
      });
    } catch (err) {
      console.error('Error submitting vacation request:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al solicitar vacaciones.' });
    }
  });

  // Calendar
  router.get('/vacations/calendar', requirePermission('RRHH Vacaciones', 'Ver vacaciones'), async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      const year = req.query.year || new Date().getFullYear();
      const month = req.query.month || null;

      const calendar = await getVacationCalendar(pool, { companyId, year, month });
      res.json(calendar);
    } catch (err) {
      console.error('Error fetching vacation calendar:', err);
      res.status(500).json({ message: 'Error al consultar calendario de vacaciones.' });
    }
  });

  return router;
}
