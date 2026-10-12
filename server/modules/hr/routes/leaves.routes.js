import express from 'express';
import {
  listLeaveTypes,
  createLeaveRequest,
  listLeaveRequests
} from '../repositories/leaves.repo.js';
import { resolveTargetCompanyId } from '../access.js';
import { uploadDocument, saveFile } from '../storage.js';

export function createLeavesRouter(ctx) {
  const router = express.Router();
  const { pool, requirePermission, writeAudit } = ctx;

  // List leave types
  router.get('/leaves/types', requirePermission('RRHH Permisos', 'Ver permisos'), async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      const types = await listLeaveTypes(pool, companyId);
      res.json(types);
    } catch (err) {
      console.error('Error listing leave types:', err);
      res.status(500).json({ message: 'Error al consultar tipos de licencias y permisos.' });
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
        pageSize: req.query.pageSize ? Number(req.query.pageSize) : 20
      });
      res.json(result);
    } catch (err) {
      console.error('Error listing leave requests:', err);
      res.status(500).json({ message: 'Error al listar solicitudes de permisos.' });
    }
  });

  // Submit leave request (with optional document file)
  router.post('/leaves/requests', requirePermission('RRHH Permisos', 'Solicitar permisos'), uploadDocument.single('document'), async (req, res) => {
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
        return res.status(400).json({ message: 'Debe especificar el empleado para la solicitud.' });
      }

      const { leaveTypeId, startDate, endDate, startTime, endTime, unit, duration, reason } = req.body;
      if (!leaveTypeId || !startDate || !endDate || !reason?.trim()) {
        return res.status(400).json({ message: 'Tipo de permiso, fechas y motivo son obligatorios.' });
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
        employeeId: Number(employeeId),
        leaveTypeId: Number(leaveTypeId),
        startDate,
        endDate,
        startTime,
        endTime,
        unit: unit || 'Dias',
        duration: Number(duration || 1),
        reason,
        attachedFileId
      });

      await writeAudit(req, 'CREATE', 'RRHH Permisos', 'HrLeaveRequest', String(result.leaveRequest.Id), companyId, {
        context: `Solicitud de permiso/licencia del ${startDate} al ${endDate} (${duration} ${unit || 'Dias'})`
      });

      res.status(201).json({
        message: 'Solicitud de permiso enviada a aprobación exitosamente.',
        request: result.leaveRequest
      });
    } catch (err) {
      console.error('Error submitting leave request:', err);
      res.status(500).json({ message: err.message || 'Error al solicitar permiso o licencia.' });
    }
  });

  return router;
}
