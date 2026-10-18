import express from 'express';
import {
  listLeaveTypes,
  createLeaveRequest,
  listLeaveRequests
} from '../repositories/leaves.repo.js';
import { resolveTargetCompanyId, isGlobalAdmin, isCompanyAdmin, isHrManager } from '../access.js';
import { resolveActingEmployeeId, NO_EMPLOYEE_MESSAGE } from '../employee-context.js';
import { uploadDocument, saveFile } from '../storage.js';

function sendError(res, err, fallback) {
  if (err.status) return res.status(err.status).json({ message: err.message });
  console.error(fallback, err);
  return res.status(500).json({ message: fallback });
}

export function createLeavesRouter(ctx) {
  const router = express.Router();
  const { pool, requirePermission, writeAudit } = ctx;

  const visibilityFilter = req => isHrManager(req)
    ? null
    : { userId: req.user.userId };

  // List leave types
  router.get('/leaves/types', requirePermission('RRHH Permisos', 'Ver permisos'), async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      const types = await listLeaveTypes(pool, companyId);
      res.json(types);
    } catch (err) {
      sendError(res, err, 'Error al consultar tipos de licencias y permisos.');
    }
  });

  // List leave requests
  router.get('/leaves/requests', requirePermission('RRHH Permisos', 'Ver permisos'), async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      const result = await listLeaveRequests(pool, {
        companyId,
        employeeId: req.query.employeeId,
        status: req.query.status,
        page: req.query.page ? Number(req.query.page) : 1,
        pageSize: req.query.pageSize ? Number(req.query.pageSize) : 20,
        visibleFor: visibilityFilter(req)
      });
      res.json(result);
    } catch (err) {
      sendError(res, err, 'Error al listar solicitudes de permisos.');
    }
  });

  // Submit leave request (with optional document file)
  const handleSubmitLeave = async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      const employeeId = await resolveActingEmployeeId(pool, req, companyId, req.body.employeeId);
      if (!employeeId) return res.status(400).json({ message: NO_EMPLOYEE_MESSAGE });

      const { leaveTypeId, startDate, endDate, startTime, endTime } = req.body;
      const reason = typeof req.body.reason === 'string' ? req.body.reason : '';
      const duration = Number(req.body.duration ?? req.body.requestedDays ?? 1);
      if (!leaveTypeId || !startDate || !endDate || !reason.trim()) {
        return res.status(400).json({ message: 'Tipo de permiso, fechas y motivo son obligatorios.' });
      }
      if (!Number.isFinite(duration) || duration <= 0) {
        return res.status(400).json({ message: 'La duración debe ser mayor a cero.' });
      }

      let attachedFileId = null;
      if (req.file) {
        const savedFile = await saveFile({
          pool,
          buffer: req.file.buffer,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          companyId,
          userId: req.user.userId,
          folder: 'docs'
        });
        attachedFileId = savedFile.Id;
      }

      const result = await createLeaveRequest(pool, {
        companyId,
        employeeId,
        leaveTypeId: Number(leaveTypeId),
        startDate,
        endDate,
        startTime,
        endTime,
        duration,
        reason: reason.trim(),
        attachedFileId
      });

      await writeAudit(req, 'CREATE', 'RRHH Permisos', 'HrLeaveRequest', String(result.leaveRequest.Id), companyId, {
        context: `Solicitud de permiso/licencia del ${startDate} al ${endDate} (${duration})`
      });

      res.status(201).json({
        message: 'Solicitud de permiso enviada a aprobación exitosamente.',
        request: result.leaveRequest
      });
    } catch (err) {
      sendError(res, err, 'Error al solicitar permiso o licencia.');
    }
  };
  router.post('/leaves/request', requirePermission('RRHH Permisos', 'Solicitar permisos'), uploadDocument.single('document'), handleSubmitLeave);
  router.post('/leaves/requests', requirePermission('RRHH Permisos', 'Solicitar permisos'), uploadDocument.single('document'), handleSubmitLeave);

  return router;
}
