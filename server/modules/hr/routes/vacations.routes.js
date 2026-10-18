import express from 'express';
import {
  getEmployeeVacationBalance,
  createVacationRequest,
  listVacationRequests,
  getVacationCalendar
} from '../repositories/vacations.repo.js';
import { resolveTargetCompanyId, assertEmployeeAccess, isGlobalAdmin, isCompanyAdmin, isHrManager } from '../access.js';
import { resolveActingEmployeeId, NO_EMPLOYEE_MESSAGE } from '../employee-context.js';

function sendError(res, err, fallback) {
  if (err.status) return res.status(err.status).json({ message: err.message });
  console.error(fallback, err);
  return res.status(500).json({ message: fallback });
}

export function createVacationsRouter(ctx) {
  const router = express.Router();
  const { pool, requirePermission, writeAudit } = ctx;

  const visibilityFilter = req => isHrManager(req)
    ? null
    : { userId: req.user.userId };

  const emptyBalance = {
    HireDate: null, SeniorityYears: 0, DaysEntitled: 0, DaysPending: 0, DaysUsed: 0, DaysAvailable: 0,
    daysAvailable: 0, linked: false, message: NO_EMPLOYEE_MESSAGE
  };

  // Get employee vacation balance (query param or current user)
  router.get('/vacations/balance', requirePermission('RRHH Vacaciones', 'Ver vacaciones'), async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      const employeeId = await resolveActingEmployeeId(pool, req, companyId, req.query.employeeId);
      if (!employeeId) return res.json(emptyBalance);

      await assertEmployeeAccess(pool, req, employeeId);
      const year = req.query.year ? Number(req.query.year) : undefined;
      const balance = await getEmployeeVacationBalance(pool, employeeId, year);
      res.json({ ...balance, linked: true });
    } catch (err) {
      sendError(res, err, 'Error al consultar saldo de vacaciones.');
    }
  });

  // Get employee vacation balance by route param
  router.get('/vacations/balance/:employeeId', requirePermission('RRHH Vacaciones', 'Ver vacaciones'), async (req, res) => {
    try {
      const id = Number(req.params.employeeId);
      if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: 'Identificador de empleado inválido.' });
      await assertEmployeeAccess(pool, req, id);
      const year = req.query.year ? Number(req.query.year) : undefined;
      const balance = await getEmployeeVacationBalance(pool, id, year);
      res.json({ ...balance, linked: true });
    } catch (err) {
      sendError(res, err, 'Error al consultar saldo de vacaciones.');
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
        pageSize: req.query.pageSize ? Number(req.query.pageSize) : 20,
        visibleFor: visibilityFilter(req)
      });
      res.json(result);
    } catch (err) {
      sendError(res, err, 'Error al listar solicitudes de vacaciones.');
    }
  });

  // Submit vacation request
  const handleSubmitVacation = async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      const employeeId = await resolveActingEmployeeId(pool, req, companyId, req.body.employeeId);
      if (!employeeId) return res.status(400).json({ message: NO_EMPLOYEE_MESSAGE });

      const { startDate, endDate, returnDate } = req.body;
      const daysRequested = Number(req.body.daysRequested ?? req.body.requestedDays);
      const reason = req.body.reason ?? req.body.comments ?? null;
      if (!startDate || !endDate || !daysRequested) {
        return res.status(400).json({ message: 'Fechas de inicio, fin y cantidad de días son obligatorios.' });
      }

      const result = await createVacationRequest(pool, {
        companyId,
        employeeId,
        startDate,
        endDate,
        returnDate,
        daysRequested,
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
      sendError(res, err, 'Error al solicitar vacaciones.');
    }
  };
  router.post('/vacations/request', requirePermission('RRHH Vacaciones', 'Solicitar vacaciones'), handleSubmitVacation);
  router.post('/vacations/requests', requirePermission('RRHH Vacaciones', 'Solicitar vacaciones'), handleSubmitVacation);

  // Calendar
  router.get('/vacations/calendar', requirePermission('RRHH Vacaciones', 'Ver vacaciones'), async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      const year = Number(req.query.year) || new Date().getFullYear();
      const month = req.query.month ? Number(req.query.month) : null;
      if (month !== null && (month < 1 || month > 12)) return res.status(400).json({ message: 'Mes inválido.' });

      const calendar = await getVacationCalendar(pool, {
        companyId,
        year,
        month,
        departmentId: req.query.departmentId ? Number(req.query.departmentId) : null,
        visibleFor: visibilityFilter(req)
      });
      res.json(calendar);
    } catch (err) {
      sendError(res, err, 'Error al consultar calendario de vacaciones.');
    }
  });

  return router;
}
