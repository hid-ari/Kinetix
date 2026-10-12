import express from 'express';
import {
  getPendingApprovalsForUser,
  getMySubmittedRequests,
  getApprovalRequestDetail,
  processApprovalAction
} from '../repositories/approvals.repo.js';
import { applyVacationApproval, rejectVacationRequest } from '../repositories/vacations.repo.js';
import { applyLeaveApproval, rejectLeaveRequest } from '../repositories/leaves.repo.js';
import { applyAttendanceCorrection } from '../repositories/attendance.repo.js';
import { resolveTargetCompanyId, isGlobalAdmin, isCompanyAdmin } from '../access.js';

export function createApprovalsRouter(ctx) {
  const router = express.Router();
  const { pool, requirePermission, writeAudit } = ctx;

  // Pending approvals for logged-in user
  router.get('/approvals/pending', async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      if (!companyId) return res.status(400).json({ message: 'Se requiere especificar empresa.' });

      const pending = await getPendingApprovalsForUser(pool, {
        companyId,
        userId: req.user.userId,
        isGlobalAdmin: isGlobalAdmin(req),
        isCompanyAdmin: isCompanyAdmin(req)
      });

      res.json(pending);
    } catch (err) {
      console.error('Error fetching pending approvals:', err);
      res.status(500).json({ message: 'Error al consultar aprobaciones pendientes.' });
    }
  });

  // Requests submitted by current user's employee profile
  router.get('/approvals/my-requests', async (req, res) => {
    try {
      const companyId = resolveTargetCompanyId(req);
      if (!companyId) return res.status(400).json({ message: 'Se requiere especificar empresa.' });

      const empRes = await pool.request()
        .input('userId', req.user.userId)
        .query('SELECT Id FROM dbo.HrEmployees WHERE UserId = @userId;');
      const empId = empRes.recordset[0]?.Id;

      if (!empId) return res.json([]);

      const requests = await getMySubmittedRequests(pool, { companyId, employeeId: empId });
      res.json(requests);
    } catch (err) {
      console.error('Error fetching my requests:', err);
      res.status(500).json({ message: 'Error al consultar solicitudes enviadas.' });
    }
  });

  // Request detail with history
  router.get('/approvals/:id', async (req, res) => {
    try {
      const detail = await getApprovalRequestDetail(pool, req.params.id);
      if (!detail) return res.status(404).json({ message: 'Solicitud no encontrada.' });
      res.json(detail);
    } catch (err) {
      console.error('Error getting approval detail:', err);
      res.status(500).json({ message: 'Error al consultar detalle de solicitud.' });
    }
  });

  // Execute approval or rejection action
  router.post('/approvals/:id/action', requirePermission('RRHH Aprobaciones', 'Aprobar solicitudes'), async (req, res) => {
    try {
      const { action, comments } = req.body;
      if (!action || !['Aprobado', 'Rechazado'].includes(action)) {
        return res.status(400).json({ message: "La acción debe ser 'Aprobado' o 'Rechazado'." });
      }

      const outcome = await processApprovalAction(pool, {
        requestId: req.params.id,
        approverUserId: req.user.userId,
        action,
        comments,
        isGlobalAdmin: isGlobalAdmin(req),
        isCompanyAdmin: isCompanyAdmin(req)
      });

      // If workflow completed, execute entity-specific side effects
      if (outcome.isCompleted) {
        const reqItem = outcome.request;
        if (outcome.status === 'Aprobada') {
          if (reqItem.EntityName === 'HrVacationRequests') {
            await applyVacationApproval(pool, reqItem.EntityId);
          } else if (reqItem.EntityName === 'HrLeaveRequests') {
            await applyLeaveApproval(pool, reqItem.EntityId);
          } else if (reqItem.EntityName === 'HrAttendanceCorrections') {
            await applyAttendanceCorrection(pool, reqItem.EntityId);
          }
        } else if (outcome.status === 'Rechazada') {
          if (reqItem.EntityName === 'HrVacationRequests') {
            await rejectVacationRequest(pool, reqItem.EntityId, comments);
          } else if (reqItem.EntityName === 'HrLeaveRequests') {
            await rejectLeaveRequest(pool, reqItem.EntityId, comments);
          } else if (reqItem.EntityName === 'HrAttendanceCorrections') {
            await pool.request()
              .input('id', reqItem.EntityId)
              .query("UPDATE dbo.HrAttendanceCorrections SET Status = N'Rechazada' WHERE Id = @id;");
          }
        }
      }

      await writeAudit(req, action === 'Aprobado' ? 'APPROVE' : 'REJECT', 'RRHH Aprobaciones', 'HrApprovalRequest', req.params.id, null, {
        context: `${action} solicitud #${req.params.id}. Comentarios: ${comments || 'Ninguno'}`
      });

      res.json({
        message: `Solicitud ${action.toLowerCase()} exitosamente.`,
        status: outcome.status,
        isCompleted: outcome.isCompleted
      });
    } catch (err) {
      console.error('Error processing approval action:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al procesar acción de aprobación.' });
    }
  });

  return router;
}
