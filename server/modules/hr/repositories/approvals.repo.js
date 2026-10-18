import sql from 'mssql/msnodesqlv8.js';
import { createNotification } from './notifications.repo.js';

/**
 * Gets the active approval flow for a given company and request type
 */
export async function getApprovalFlow(pool, companyId, requestType, departmentId = null) {
  const result = await pool.request()
    .input('companyId', sql.Int, companyId)
    .input('type', sql.NVarChar(50), requestType)
    .input('deptId', sql.Int, departmentId)
    .query(`
      -- Try to find department-specific flow first, then global company flow
      SELECT TOP 1 f.Id, f.CompanyId, f.RequestType, f.Name, f.Description, f.DepartmentId, f.IsActive
      FROM dbo.HrApprovalFlows f
      WHERE f.CompanyId = @companyId
        AND f.RequestType = @type
        AND f.IsActive = 1
        AND (f.DepartmentId = @deptId OR f.DepartmentId IS NULL)
      ORDER BY CASE WHEN f.DepartmentId IS NOT NULL THEN 1 ELSE 2 END;
    `);

  const flow = result.recordset[0];
  if (!flow) return null;

  const stepsRes = await pool.request()
    .input('flowId', sql.Int, flow.Id)
    .query(`
      SELECT Id, FlowId, StepNumber, Name, ApproverType, ApproverRoleId, ApproverUserId, AutoApproveDays
      FROM dbo.HrApprovalSteps
      WHERE FlowId = @flowId
      ORDER BY StepNumber ASC;
    `);

  flow.steps = stepsRes.recordset;
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
    throw new Error(`No hay un flujo de aprobación configurado para solicitudes de tipo '${requestType}'.`);
  }

  const reqResult = await pool.request()
    .input('companyId', sql.Int, companyId)
    .input('flowId', sql.Int, flow.Id)
    .input('type', sql.NVarChar(50), requestType)
    .input('entityName', sql.NVarChar(50), entityName)
    .input('entityId', sql.Int, entityId)
    .input('empId', sql.Int, requesterEmployeeId)
    .query(`
      INSERT INTO dbo.HrApprovalRequests (
        CompanyId, FlowId, RequestType, EntityName, EntityId,
        RequesterEmployeeId, CurrentStepNumber, Status
      )
      OUTPUT INSERTED.Id, INSERTED.FlowId, INSERTED.RequestType, INSERTED.CurrentStepNumber, INSERTED.Status
      VALUES (
        @companyId, @flowId, @type, @entityName, @entityId,
        @empId, 1, N'Pendiente'
      );
    `);

  const request = reqResult.recordset[0];

  // Notify approvers of Step 1
  await notifyStepApprovers(pool, companyId, request.Id, flow.steps[0], requesterEmployeeId, requestType);

  return request;
}

/**
 * Helper to notify the approvers of a given step
 */
async function notifyStepApprovers(pool, companyId, requestId, step, requesterEmployeeId, requestType) {
  try {
    const empRes = await pool.request()
      .input('id', sql.Int, requesterEmployeeId)
      .query(`
        SELECT e.Id, CONCAT(e.FirstName, N' ', e.LastName) AS FullName, e.DepartmentId,
               s.UserId AS SupervisorUserId, d.ManagerEmployeeId, dm.UserId AS ManagerUserId
        FROM dbo.HrEmployees e
        LEFT JOIN dbo.HrEmployees s ON s.Id = e.SupervisorEmployeeId
        LEFT JOIN dbo.HrDepartments d ON d.Id = e.DepartmentId
        LEFT JOIN dbo.HrEmployees dm ON dm.Id = d.ManagerEmployeeId
        WHERE e.Id = @id;
      `);
    const emp = empRes.recordset[0];
    if (!emp) return;

    let targetUserIds = [];

    if (step.ApproverType === 'Supervisor') {
      if (emp.SupervisorUserId) {
        targetUserIds.push(emp.SupervisorUserId);
      } else {
        // Fallback: notify company admins or super admins if employee reports directly to direction
        const adminsRes = await pool.request()
          .input('companyId', sql.Int, companyId)
          .query(`
            SELECT DISTINCT uo.UserId
            FROM dbo.UserOrganizations uo
            JOIN dbo.UserRoles ur ON ur.UserId = uo.UserId
            JOIN dbo.Roles r ON r.Id = ur.RoleId
            WHERE (uo.CompanyId = @companyId OR r.Name = N'Super Admin')
              AND r.Name IN (N'Company Admin', N'Super Admin', N'Director de RRHH')
              AND uo.IsActive = 1;
          `);
        targetUserIds.push(...adminsRes.recordset.map(u => u.UserId));
      }
    } else if (step.ApproverType === 'DepartmentManager') {
      if (emp.ManagerUserId) {
        targetUserIds.push(emp.ManagerUserId);
      } else {
        const adminsRes = await pool.request()
          .input('companyId', sql.Int, companyId)
          .query(`
            SELECT DISTINCT uo.UserId
            FROM dbo.UserOrganizations uo
            JOIN dbo.UserRoles ur ON ur.UserId = uo.UserId
            JOIN dbo.Roles r ON r.Id = ur.RoleId
            WHERE (uo.CompanyId = @companyId OR r.Name = N'Super Admin')
              AND r.Name IN (N'Company Admin', N'Super Admin', N'Director de RRHH')
              AND uo.IsActive = 1;
          `);
        targetUserIds.push(...adminsRes.recordset.map(u => u.UserId));
      }
    } else if (step.ApproverType === 'SpecificUser' && step.ApproverUserId) {
      targetUserIds.push(step.ApproverUserId);
    } else if (step.ApproverType === 'Role' && step.ApproverRoleId) {
      const usersRes = await pool.request()
        .input('roleId', sql.Int, step.ApproverRoleId)
        .input('companyId', sql.Int, companyId)
        .query(`
          SELECT DISTINCT ur.UserId
          FROM dbo.UserRoles ur
          JOIN dbo.UserOrganizations uo ON uo.UserId = ur.UserId
          JOIN dbo.Roles r ON r.Id = ur.RoleId
          WHERE (ur.RoleId = @roleId OR r.Name = N'Super Admin')
            AND (uo.CompanyId = @companyId OR r.Name = N'Super Admin')
            AND uo.IsActive = 1;
        `);
      targetUserIds = usersRes.recordset.map(u => u.UserId);
    }

    // Unique user IDs
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
    .input('userId', sql.NVarChar(450), userId)
    .query('SELECT Id, DepartmentId FROM dbo.HrEmployees WHERE UserId = @userId;');
  const employee = empRes.recordset[0];
  const employeeId = employee?.Id || null;

  const result = await pool.request()
    .input('companyId', sql.Int, companyId)
    .input('userId', sql.NVarChar(450), userId)
    .input('empId', sql.Int, employeeId)
    .input('isGlobal', sql.Bit, isGlobalAdmin ? 1 : 0)
    .input('isCompAdmin', sql.Bit, isCompanyAdmin ? 1 : 0)
    .query(`
      SELECT r.Id, r.CompanyId, r.RequestType, r.EntityName, r.EntityId,
             r.RequesterEmployeeId, r.CurrentStepNumber, r.Status, r.CreatedAt,
             CONCAT(req.FirstName, N' ', req.LastName) AS RequesterName,
             req.EmployeeCode AS RequesterCode,
             d.Name AS DepartmentName,
             d.Name AS RequesterDept,
             p.Title AS PositionTitle,
             p.Title AS RequesterPosition,
             s.Name AS CurrentStepName,
             s.ApproverType,
             f.Name AS FlowName,
             r.RequestType AS FlowCode
      FROM dbo.HrApprovalRequests r
      JOIN dbo.HrEmployees req ON req.Id = r.RequesterEmployeeId
      JOIN dbo.HrApprovalFlows f ON f.Id = r.FlowId
      LEFT JOIN dbo.HrDepartments d ON d.Id = req.DepartmentId
      LEFT JOIN dbo.HrPositions p ON p.Id = req.PositionId
      JOIN dbo.HrApprovalSteps s ON s.FlowId = r.FlowId AND s.StepNumber = r.CurrentStepNumber
      WHERE r.CompanyId = @companyId
        AND r.Status = N'Pendiente'
        AND (
          @isGlobal = 1
          OR @isCompAdmin = 1
          OR (s.ApproverType = N'Supervisor' AND req.SupervisorEmployeeId = @empId)
          OR (s.ApproverType = N'DepartmentManager' AND d.ManagerEmployeeId = @empId)
          OR (s.ApproverType = N'SpecificUser' AND s.ApproverUserId = @userId)
          OR (s.ApproverType = N'Role' AND EXISTS (
                SELECT 1 FROM dbo.UserRoles ur WHERE ur.UserId = @userId AND ur.RoleId = s.ApproverRoleId
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
    .input('companyId', sql.Int, companyId)
    .input('empId', sql.Int, employeeId)
    .query(`
      SELECT r.Id, r.CompanyId, r.RequestType, r.EntityName, r.EntityId,
             r.CurrentStepNumber, r.Status, r.CreatedAt, r.ResolvedAt,
             s.Name AS CurrentStepName,
             f.Name AS FlowName,
             r.RequestType AS FlowCode
      FROM dbo.HrApprovalRequests r
      JOIN dbo.HrApprovalFlows f ON f.Id = r.FlowId
      LEFT JOIN dbo.HrApprovalSteps s ON s.FlowId = r.FlowId AND s.StepNumber = r.CurrentStepNumber
      WHERE r.CompanyId = @companyId
        AND r.RequesterEmployeeId = @empId
      ORDER BY r.CreatedAt DESC;
    `);

  return result.recordset;
}

/**
 * Gets details and history of an approval request
 */
export async function getApprovalRequestDetail(pool, requestId) {
  const reqRes = await pool.request()
    .input('id', sql.Int, Number(requestId))
    .query(`
      SELECT r.Id, r.CompanyId, r.FlowId, r.RequestType, r.EntityName, r.EntityId,
             r.RequesterEmployeeId, r.CurrentStepNumber, r.Status, r.CreatedAt, r.ResolvedAt,
             CONCAT(req.FirstName, N' ', req.LastName) AS RequesterName,
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
      FROM dbo.HrApprovalRequests r
      JOIN dbo.HrEmployees req ON req.Id = r.RequesterEmployeeId
      LEFT JOIN dbo.HrApprovalFlows f ON f.Id = r.FlowId
      LEFT JOIN dbo.HrDepartments d ON d.Id = req.DepartmentId
      LEFT JOIN dbo.HrPositions p ON p.Id = req.PositionId
      WHERE r.Id = @id;
    `);

  const request = reqRes.recordset[0];
  if (!request) return null;

  const [stepsRes, histRes] = await Promise.all([
    pool.request()
      .input('flowId', sql.Int, request.FlowId)
      .query(`
        SELECT Id, StepNumber, Name, ApproverType, ApproverRoleId, ApproverUserId
        FROM dbo.HrApprovalSteps
        WHERE FlowId = @flowId
        ORDER BY StepNumber ASC;
      `),
    pool.request()
      .input('requestId', sql.Int, request.Id)
      .query(`
        SELECT h.Id, h.StepNumber, h.ApproverUserId, h.Action, h.Comments, h.ActedAt,
               h.ActedAt AS CreatedAt,
               st.Name AS StepName,
               CONCAT(u.FirstName, N' ', u.LastName) AS ApproverName,
               u.Email AS ApproverEmail
        FROM dbo.HrApprovalHistory h
        JOIN dbo.HrApprovalRequests rq ON rq.Id = h.RequestId
        LEFT JOIN dbo.HrApprovalSteps st ON st.FlowId = rq.FlowId AND st.StepNumber = h.StepNumber
        LEFT JOIN dbo.UserOrganizations u ON u.UserId = h.ApproverUserId
        WHERE h.RequestId = @requestId
        ORDER BY h.ActedAt ASC, h.Id ASC;
      `)
  ]);

  request.steps = stepsRes.recordset;
  request.history = histRes.recordset;
  return request;
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

/**
 * Whether `userId` may act on the given step of `request`.
 * Global admins always can; company admins only inside their company; everybody else must match the step approver.
 */
export async function canUserActOnStep(pool, request, step, { userId, companyId, isGlobalAdmin = false, isCompanyAdmin = false }) {
  if (isGlobalAdmin) return true;
  if (companyId && Number(companyId) !== request.CompanyId) return false;
  if (isCompanyAdmin) return true;

  const empRes = await pool.request()
    .input('userId', sql.NVarChar(450), userId)
    .query('SELECT TOP 1 Id FROM dbo.HrEmployees WHERE UserId = @userId;');
  const empId = empRes.recordset[0]?.Id ?? null;

  switch (step.ApproverType) {
    case 'Supervisor': return empId !== null && request.RequesterSupervisorId === empId;
    case 'DepartmentManager': return empId !== null && request.DepartmentManagerId === empId;
    case 'SpecificUser': return step.ApproverUserId === userId;
    case 'Role': {
      const r = await pool.request()
        .input('userId', sql.NVarChar(450), userId)
        .input('roleId', sql.Int, step.ApproverRoleId)
        .query('SELECT 1 AS ok FROM dbo.UserRoles WHERE UserId = @userId AND RoleId = @roleId;');
      return r.recordset.length > 0;
    }
    default: return false;
  }
}

/**
 * Processes an action (Aprobar o Rechazar) on an approval request
 */
export async function processApprovalAction(pool, {
  requestId,
  approverUserId,
  action, // 'Aprobado' o 'Rechazado'
  comments = null,
  companyId = null,
  isGlobalAdmin = false,
  isCompanyAdmin = false
}) {
  const numericId = Number(requestId);
  if (!Number.isInteger(numericId) || numericId <= 0) throw httpError(400, 'Identificador de solicitud inválido.');

  const request = await getApprovalRequestDetail(pool, numericId);
  if (!request || (!isGlobalAdmin && companyId && request.CompanyId !== Number(companyId))) {
    throw httpError(404, 'Solicitud de aprobación no encontrada.');
  }
  if (request.Status !== 'Pendiente') throw httpError(409, 'Esta solicitud ya ha sido resuelta.');

  const currentStep = request.steps.find(s => s.StepNumber === request.CurrentStepNumber);
  if (!currentStep) throw httpError(409, 'Paso actual no válido en el flujo.');

  if (!isGlobalAdmin && request.RequesterUserId && request.RequesterUserId === approverUserId) {
    throw httpError(403, 'No puede aprobar ni rechazar su propia solicitud.');
  }
  const allowed = await canUserActOnStep(pool, request, currentStep, {
    userId: approverUserId, companyId, isGlobalAdmin, isCompanyAdmin
  });
  if (!allowed) throw httpError(403, 'No está autorizado para resolver este paso de aprobación.');

  if (action === 'Rechazado' && !String(comments || '').trim()) {
    throw httpError(400, 'Debe indicar el motivo del rechazo.');
  }

  // Claim the step atomically so two approvers cannot resolve the same step twice
  const claim = await pool.request()
    .input('id', sql.Int, request.Id)
    .input('step', sql.Int, request.CurrentStepNumber)
    .query(`
      UPDATE dbo.HrApprovalRequests SET Status = Status
      WHERE Id = @id AND Status = N'Pendiente' AND CurrentStepNumber = @step;
      SELECT @@ROWCOUNT AS affected;
    `);
  if (!claim.recordset[0]?.affected) throw httpError(409, 'Esta solicitud ya fue resuelta por otro usuario.');

  // Insert approval action
  await pool.request()
    .input('requestId', sql.Int, request.Id)
    .input('step', sql.Int, request.CurrentStepNumber)
    .input('userId', sql.NVarChar(450), approverUserId)
    .input('action', sql.NVarChar(30), action)
    .input('comments', sql.NVarChar(1000), comments || null)
    .query(`
      INSERT INTO dbo.HrApprovalHistory (RequestId, StepNumber, ApproverUserId, Action, Comments)
      VALUES (@requestId, @step, @userId, @action, @comments);
    `);

  // Get requester user ID to notify them
  const reqUserRes = await pool.request()
    .input('empId', sql.Int, request.RequesterEmployeeId)
    .query('SELECT UserId FROM dbo.HrEmployees WHERE Id = @empId;');
  const requesterUserId = reqUserRes.recordset[0]?.UserId;

  if (action === 'Rechazado') {
    // Rejection ends the request immediately
    await pool.request()
      .input('id', sql.Int, request.Id)
      .query(`
        UPDATE dbo.HrApprovalRequests
        SET Status = N'Rechazada', ResolvedAt = SYSUTCDATETIME()
        WHERE Id = @id;
      `);

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

  // If Approved: Check if there's a next step
  const nextStep = request.steps.find(s => s.StepNumber === request.CurrentStepNumber + 1);

  if (nextStep) {
    // Advance to next step
    await pool.request()
      .input('id', sql.Int, request.Id)
      .input('nextStep', sql.Int, nextStep.StepNumber)
      .query(`
        UPDATE dbo.HrApprovalRequests
        SET CurrentStepNumber = @nextStep
        WHERE Id = @id;
      `);

    // Notify next approver(s)
    await notifyStepApprovers(pool, request.CompanyId, request.Id, nextStep, request.RequesterEmployeeId, request.RequestType);

    return {
      status: 'Pendiente',
      currentStep: nextStep.StepNumber,
      isCompleted: false,
      request
    };
  } else {
    // All steps approved!
    await pool.request()
      .input('id', sql.Int, request.Id)
      .query(`
        UPDATE dbo.HrApprovalRequests
        SET Status = N'Aprobada', ResolvedAt = SYSUTCDATETIME()
        WHERE Id = @id;
      `);

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
