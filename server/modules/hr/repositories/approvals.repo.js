import { createNotification } from './notifications.repo.js';
import { badRequest, forbidden, notFound, conflict } from '../../../core/http.js';

/**
 * Gets the active approval flow for a given company and request type
 */
export async function getApprovalFlow(pool, companyId, requestType, departmentId = null) {
  const result = await pool.request()
    .input('companyId', companyId)
    .input('type', requestType)
    .input('deptId', departmentId)
    .query(`
      SELECT f.Id, f.CompanyId, f.RequestType, f.Name, f.Description, f.DepartmentId, f.IsActive
      FROM HrApprovalFlows f
      WHERE f.CompanyId = @companyId
        AND f.RequestType = @type
        AND f.IsActive = TRUE
        AND (f.DepartmentId = @deptId OR f.DepartmentId IS NULL)
      ORDER BY CASE WHEN f.DepartmentId IS NOT NULL THEN 1 ELSE 2 END LIMIT 1;
    `);

  const flow = result.recordset[0];
  if (!flow) return null;

  flow.steps = await pool.find('HrApprovalSteps', { FlowId: flow.Id }, {
    select: 'Id, FlowId, StepNumber, Name, ApproverType, ApproverRoleId, ApproverUserId, AutoApproveDays',
    orderBy: 'StepNumber ASC'
  });
  return flow;
}

/**
 * Initiates an approval request
 */
export async function createApprovalRequest(pool, {
  companyId,
  requestType,
  entityName,
  entityId,
  requesterEmployeeId,
  departmentId = null
}) {
  const flow = await getApprovalFlow(pool, companyId, requestType, departmentId);
  if (!flow || !flow.steps.length) {
    throw conflict(`No hay un flujo de aprobación configurado para solicitudes de tipo '${requestType}'.`);
  }

  const request = await pool.insert('HrApprovalRequests', {
    CompanyId: companyId,
    FlowId: flow.Id,
    RequestType: requestType,
    EntityName: entityName,
    EntityId: entityId,
    RequesterEmployeeId: requesterEmployeeId,
    CurrentStepNumber: 1,
    Status: 'Pendiente'
  }, { returning: 'Id, FlowId, RequestType, CurrentStepNumber, Status' });

  await notifyStepApprovers(pool, companyId, request.Id, flow.steps[0], requesterEmployeeId, requestType);

  return request;
}

/**
 * Helper to notify the approvers of a given step
 */
async function notifyStepApprovers(pool, companyId, requestId, step, requesterEmployeeId, requestType) {
  try {
    const empRes = await pool.request()
      .input('id', requesterEmployeeId)
      .query(`
        SELECT e.Id, CONCAT(e.FirstName, ' ', e.LastName) AS FullName, e.DepartmentId,
               s.UserId AS SupervisorUserId, d.ManagerEmployeeId, dm.UserId AS ManagerUserId
        FROM HrEmployees e
        LEFT JOIN HrEmployees s ON s.Id = e.SupervisorEmployeeId
        LEFT JOIN HrDepartments d ON d.Id = e.DepartmentId
        LEFT JOIN HrEmployees dm ON dm.Id = d.ManagerEmployeeId
        WHERE e.Id = @id;
      `);
    const emp = empRes.recordset[0];
    if (!emp) return;

    let targetUserIds = [];

    if (step.ApproverType === 'Supervisor') {
      if (emp.SupervisorUserId) {
        targetUserIds.push(emp.SupervisorUserId);
      } else {
        const adminsRes = await pool.request()
          .input('companyId', companyId)
          .query(`
            SELECT DISTINCT uo.UserId
            FROM UserOrganizations uo
            JOIN UserRoles ur ON ur.UserId = uo.UserId
            JOIN Roles r ON r.Id = ur.RoleId
            WHERE (uo.CompanyId = @companyId OR r.Name = 'Super Admin')
              AND r.Name IN ('Company Admin', 'Super Admin', 'Director de RRHH')
              AND uo.IsActive = TRUE;
          `);
        targetUserIds.push(...adminsRes.recordset.map(u => u.UserId));
      }
    } else if (step.ApproverType === 'DepartmentManager') {
      if (emp.ManagerUserId) {
        targetUserIds.push(emp.ManagerUserId);
      } else {
        const adminsRes = await pool.request()
          .input('companyId', companyId)
          .query(`
            SELECT DISTINCT uo.UserId
            FROM UserOrganizations uo
            JOIN UserRoles ur ON ur.UserId = uo.UserId
            JOIN Roles r ON r.Id = ur.RoleId
            WHERE (uo.CompanyId = @companyId OR r.Name = 'Super Admin')
              AND r.Name IN ('Company Admin', 'Super Admin', 'Director de RRHH')
              AND uo.IsActive = TRUE;
          `);
        targetUserIds.push(...adminsRes.recordset.map(u => u.UserId));
      }
    } else if (step.ApproverType === 'SpecificUser' && step.ApproverUserId) {
      targetUserIds.push(step.ApproverUserId);
    } else if (step.ApproverType === 'Role' && step.ApproverRoleId) {
      const usersRes = await pool.request()
        .input('roleId', step.ApproverRoleId)
        .input('companyId', companyId)
        .query(`
          SELECT DISTINCT ur.UserId
          FROM UserRoles ur
          JOIN UserOrganizations uo ON uo.UserId = ur.UserId
          JOIN Roles r ON r.Id = ur.RoleId
          WHERE (ur.RoleId = @roleId OR r.Name = 'Super Admin')
            AND (uo.CompanyId = @companyId OR r.Name = 'Super Admin')
            AND uo.IsActive = TRUE;
        `);
      targetUserIds = usersRes.recordset.map(u => u.UserId);
    }

    const uniqueIds = Array.from(new Set(targetUserIds));
    for (const uid of uniqueIds) {
      await createNotification(pool, {
        companyId,
        userId: uid,
        title: `Nueva Solicitud: ${requestType}`,
        message: `${emp.FullName} ha solicitado ${requestType}. Requiere tu revisión en el paso: ${step.Name}.`,
        category: 'Aprobacion',
        referenceType: 'ApprovalRequest',
        referenceId: requestId
      });
    }
  } catch (err) {
    console.error('Error notifying approvers:', err);
  }
}

/**
 * Lists pending approval requests for a user
 */
export async function getPendingApprovalsForUser(pool, {
  companyId,
  userId,
  isGlobalAdmin = false,
  isCompanyAdmin = false
}) {
  const empRes = await pool.request()
    .input('userId', userId)
    .query('SELECT Id, DepartmentId FROM HrEmployees WHERE UserId = @userId;');
  const employee = empRes.recordset[0];
  const employeeId = employee?.Id || null;

  const result = await pool.request()
    .input('companyId', companyId)
    .input('userId', userId)
    .input('empId', employeeId)
    .input('isGlobal', Boolean(isGlobalAdmin))
    .input('isCompAdmin', Boolean(isCompanyAdmin))
    .query(`
      SELECT r.Id, r.CompanyId, r.RequestType, r.EntityName, r.EntityId,
             r.RequesterEmployeeId, r.CurrentStepNumber, r.Status, r.CreatedAt,
             CONCAT(req.FirstName, ' ', req.LastName) AS RequesterName,
             req.EmployeeCode AS RequesterCode,
             d.Name AS DepartmentName,
             d.Name AS RequesterDept,
             p.Title AS PositionTitle,
             p.Title AS RequesterPosition,
             s.Name AS CurrentStepName,
             s.ApproverType,
             f.Name AS FlowName,
             r.RequestType AS FlowCode
      FROM HrApprovalRequests r
      JOIN HrEmployees req ON req.Id = r.RequesterEmployeeId
      JOIN HrApprovalFlows f ON f.Id = r.FlowId
      LEFT JOIN HrDepartments d ON d.Id = req.DepartmentId
      LEFT JOIN HrPositions p ON p.Id = req.PositionId
      JOIN HrApprovalSteps s ON s.FlowId = r.FlowId AND s.StepNumber = r.CurrentStepNumber
      WHERE r.CompanyId = @companyId
        AND r.Status = 'Pendiente'
        AND (
          @isGlobal = TRUE
          OR @isCompAdmin = TRUE
          OR (s.ApproverType = 'Supervisor' AND req.SupervisorEmployeeId = @empId)
          OR (s.ApproverType = 'DepartmentManager' AND d.ManagerEmployeeId = @empId)
          OR (s.ApproverType = 'SpecificUser' AND s.ApproverUserId = @userId)
          OR (s.ApproverType = 'Role' AND EXISTS (
                SELECT 1 FROM UserRoles ur WHERE ur.UserId = @userId AND ur.RoleId = s.ApproverRoleId
             ))
        )
      ORDER BY r.CreatedAt ASC;
    `);

  return result.recordset;
}

/**
 * Lists requests submitted by an employee or user
 */
export async function getMySubmittedRequests(pool, { companyId, employeeId }) {
  const result = await pool.request()
    .input('companyId', companyId)
    .input('empId', employeeId)
    .query(`
      SELECT r.Id, r.CompanyId, r.RequestType, r.EntityName, r.EntityId,
             r.CurrentStepNumber, r.Status, r.CreatedAt, r.ResolvedAt,
             s.Name AS CurrentStepName,
             f.Name AS FlowName,
             r.RequestType AS FlowCode
      FROM HrApprovalRequests r
      JOIN HrApprovalFlows f ON f.Id = r.FlowId
      LEFT JOIN HrApprovalSteps s ON s.FlowId = r.FlowId AND s.StepNumber = r.CurrentStepNumber
      WHERE r.CompanyId = @companyId
        AND r.RequesterEmployeeId = @empId
      ORDER BY r.CreatedAt DESC;
    `);

  return result.recordset;
}

/**
 * Loads the entity-specific details (Vacation, Leave, or Attendance Correction) for an approval request.
 */
async function loadApprovalEntitySummary(pool, entityName, entityId) {
  if (!entityName || !entityId) return null;
  const id = Number(entityId);
  if (!Number.isInteger(id) || id <= 0) return null;

  if (entityName === 'HrVacationRequests') {
    const res = await pool.request()
      .input('id', id)
      .query(`
        SELECT Id, StartDate, EndDate, ReturnDate, DaysRequested, Reason, Status
        FROM HrVacationRequests
        WHERE Id = @id;
      `);
    return res.recordset[0] || null;
  }

  if (entityName === 'HrLeaveRequests') {
    const res = await pool.request()
      .input('id', id)
      .query(`
        SELECT lr.Id, lr.StartDate, lr.EndDate,
               LEFT(lr.StartTime::text, 5) AS StartTime,
               LEFT(lr.EndTime::text, 5) AS EndTime,
               lr.Unit, lr.Duration, lr.Reason, lr.AttachedFileId, lr.Status,
               lt.Name AS LeaveTypeName, lt.IsPaid
        FROM HrLeaveRequests lr
        LEFT JOIN HrLeaveTypes lt ON lt.Id = lr.LeaveTypeId
        WHERE lr.Id = @id;
      `);
    return res.recordset[0] || null;
  }

  if (entityName === 'HrAttendanceCorrections') {
    const res = await pool.request()
      .input('id', id)
      .query(`
        SELECT Id, WorkDate, OriginalCheckIn, OriginalCheckOut,
               RequestedCheckIn, RequestedCheckOut, Reason, Status
        FROM HrAttendanceCorrections
        WHERE Id = @id;
      `);
    return res.recordset[0] || null;
  }

  return null;
}

/**
 * Gets details, entity payload summary, and history of an approval request
 */
export async function getApprovalRequestDetail(pool, requestId) {
  const reqRes = await pool.request()
    .input('id', Number(requestId))
    .query(`
      SELECT r.Id, r.CompanyId, r.FlowId, r.RequestType, r.EntityName, r.EntityId,
             r.RequesterEmployeeId, r.CurrentStepNumber, r.Status, r.CreatedAt, r.ResolvedAt,
             CONCAT(req.FirstName, ' ', req.LastName) AS RequesterName,
             req.EmployeeCode AS RequesterCode,
             req.UserId AS RequesterUserId,
             req.SupervisorEmployeeId AS RequesterSupervisorId,
             d.Name AS DepartmentName,
             d.Name AS RequesterDept,
             d.ManagerEmployeeId AS DepartmentManagerId,
             p.Title AS PositionTitle,
             p.Title AS RequesterPosition,
             f.Name AS FlowName,
             r.RequestType AS FlowCode
      FROM HrApprovalRequests r
      JOIN HrEmployees req ON req.Id = r.RequesterEmployeeId
      LEFT JOIN HrApprovalFlows f ON f.Id = r.FlowId
      LEFT JOIN HrDepartments d ON d.Id = req.DepartmentId
      LEFT JOIN HrPositions p ON p.Id = req.PositionId
      WHERE r.Id = @id;
    `);

  const request = reqRes.recordset[0];
  if (!request) return null;

  const [stepsRes, histRes, entitySummary] = await Promise.all([
    pool.request()
      .input('flowId', request.FlowId)
      .query(`
        SELECT Id, StepNumber, Name, ApproverType, ApproverRoleId, ApproverUserId
        FROM HrApprovalSteps
        WHERE FlowId = @flowId
        ORDER BY StepNumber ASC;
      `),
    pool.request()
      .input('requestId', request.Id)
      .query(`
        SELECT h.Id, h.StepNumber, h.ApproverUserId, h.Action, h.Comments, h.ActedAt,
               h.ActedAt AS CreatedAt,
               st.Name AS StepName,
               CONCAT(u.FirstName, ' ', u.LastName) AS ApproverName,
               u.Email AS ApproverEmail
        FROM HrApprovalHistory h
        JOIN HrApprovalRequests rq ON rq.Id = h.RequestId
        LEFT JOIN HrApprovalSteps st ON st.FlowId = rq.FlowId AND st.StepNumber = h.StepNumber
        LEFT JOIN UserOrganizations u ON u.UserId = h.ApproverUserId
        WHERE h.RequestId = @requestId
        ORDER BY h.ActedAt ASC, h.Id ASC;
      `),
    loadApprovalEntitySummary(pool, request.EntityName, request.EntityId)
  ]);

  request.steps = stepsRes.recordset;
  request.history = histRes.recordset;
  request.entitySummary = entitySummary;
  return request;
}

/**
 * Whether `userId` may act on the given step of `request`.
 */
export async function canUserActOnStep(pool, request, step, { userId, companyId, isGlobalAdmin = false, isCompanyAdmin = false }) {
  if (isGlobalAdmin) return true;
  if (companyId && Number(companyId) !== request.CompanyId) return false;
  if (isCompanyAdmin) return true;

  const empRes = await pool.request()
    .input('userId', userId)
    .query('SELECT Id FROM HrEmployees WHERE UserId = @userId LIMIT 1;');
  const empId = empRes.recordset[0]?.Id ?? null;

  switch (step.ApproverType) {
    case 'Supervisor': return empId !== null && request.RequesterSupervisorId === empId;
    case 'DepartmentManager': return empId !== null && request.DepartmentManagerId === empId;
    case 'SpecificUser': return step.ApproverUserId === userId;
    case 'Role': {
      const r = await pool.request()
        .input('userId', userId)
        .input('roleId', step.ApproverRoleId)
        .query('SELECT 1 AS ok FROM UserRoles WHERE UserId = @userId AND RoleId = @roleId;');
      return r.recordset.length > 0;
    }
    default: return false;
  }
}

/**
 * Processes an action (Aprobado o Rechazado) on an approval request
 */
export async function processApprovalAction(pool, {
  requestId,
  approverUserId,
  action,
  comments = null,
  companyId = null,
  isGlobalAdmin = false,
  isCompanyAdmin = false
}) {
  const numericId = Number(requestId);
  if (!Number.isInteger(numericId) || numericId <= 0) throw badRequest('Identificador de solicitud inválido.');

  const request = await getApprovalRequestDetail(pool, numericId);
  if (!request || (!isGlobalAdmin && companyId && request.CompanyId !== Number(companyId))) {
    throw notFound('Solicitud de aprobación no encontrada.');
  }
  if (request.Status !== 'Pendiente') throw conflict('Esta solicitud ya ha sido resuelta.');

  const currentStep = request.steps.find(s => s.StepNumber === request.CurrentStepNumber);
  if (!currentStep) throw conflict('Paso actual no válido en el flujo.');

  if (!isGlobalAdmin && request.RequesterUserId && request.RequesterUserId === approverUserId) {
    throw forbidden('No puede aprobar ni rechazar su propia solicitud.');
  }
  const allowed = await canUserActOnStep(pool, request, currentStep, {
    userId: approverUserId, companyId, isGlobalAdmin, isCompanyAdmin
  });
  if (!allowed) throw forbidden('No está autorizado para resolver este paso de aprobación.');

  if (action === 'Rechazado' && !String(comments || '').trim()) {
    throw badRequest('Debe indicar el motivo del rechazo.');
  }

  // Claim the step atomically so two approvers cannot resolve the same step twice
  const claim = await pool.request()
    .input('id', request.Id)
    .input('step', request.CurrentStepNumber)
    .query(`
      UPDATE HrApprovalRequests SET Status = Status
      WHERE Id = @id AND Status = 'Pendiente' AND CurrentStepNumber = @step
      RETURNING Id;
    `);
  if (!claim.rowCount) throw conflict('Esta solicitud ya fue resuelta por otro usuario.');

  await pool.insert('HrApprovalHistory', {
    RequestId: request.Id,
    StepNumber: request.CurrentStepNumber,
    ApproverUserId: approverUserId,
    Action: action,
    Comments: comments || null
  });

  const emp = await pool.findById('HrEmployees', request.RequesterEmployeeId, { select: 'UserId' });
  const requesterUserId = emp?.UserId;

  if (action === 'Rechazado') {
    await pool.update('HrApprovalRequests', request.Id, {
      Status: 'Rechazada',
      ResolvedAt: new Date()
    });

    if (requesterUserId) {
      await createNotification(pool, {
        companyId: request.CompanyId,
        userId: requesterUserId,
        title: `Solicitud de ${request.RequestType} Rechazada`,
        message: `Tu solicitud de ${request.RequestType} fue rechazada en el paso '${currentStep.Name}'. Motivo: ${comments || 'Sin comentarios adicionales.'}`,
        category: 'Aprobacion',
        referenceType: 'ApprovalRequest',
        referenceId: request.Id
      });
    }

    return {
      status: 'Rechazada',
      isCompleted: true,
      request
    };
  }

  const nextStep = request.steps.find(s => s.StepNumber === request.CurrentStepNumber + 1);

  if (nextStep) {
    await pool.update('HrApprovalRequests', request.Id, {
      CurrentStepNumber: nextStep.StepNumber
    });

    await notifyStepApprovers(pool, request.CompanyId, request.Id, nextStep, request.RequesterEmployeeId, request.RequestType);

    return {
      status: 'Pendiente',
      currentStep: nextStep.StepNumber,
      isCompleted: false,
      request
    };
  } else {
    await pool.update('HrApprovalRequests', request.Id, {
      Status: 'Aprobada',
      ResolvedAt: new Date()
    });

    if (requesterUserId) {
      await createNotification(pool, {
        companyId: request.CompanyId,
        userId: requesterUserId,
        title: `Solicitud de ${request.RequestType} Aprobada`,
        message: `¡Tu solicitud de ${request.RequestType} ha sido aprobada exitosamente!`,
        category: 'Aprobacion',
        referenceType: 'ApprovalRequest',
        referenceId: request.Id
      });
    }

    return {
      status: 'Aprobada',
      isCompleted: true,
      request
    };
  }
}
