import express from 'express';
import fs from 'node:fs';
import {
  listEmployees,
  getEmployeeById,
  createEmployee,
  updateEmployee,
  setEmployeePhoto,
  linkUserAccount
} from '../repositories/employees.repo.js';
import {
  listEmployeeMovements,
  executeLaborMovement
} from '../repositories/movements.repo.js';
import {
  resolveCompanyScope,
  assertCompanyAccess,
  assertEmployeeAccess,
  resolveEmployeeVisibilityFlags
} from '../access.js';
import { validateEmployeeInput } from '../validators.js';
import { uploadPhoto, withUpload, saveFile, getFilePath } from '../storage.js';
import { generateEmployeePdf } from '../services/pdf.service.js';

function csvCell(value) {
  let str = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(str)) str = `'${str}`;
  return `"${str.replace(/"/g, '""')}"`;
}

export function createEmployeesRouter(ctx) {
  const router = express.Router();
  const { pool, requirePermission, writeAudit } = ctx;

  // List employees with pagination and filters
  router.get('/employees', requirePermission('RRHH Empleados', 'Ver empleados'), async (req, res) => {
    try {
      const companyId = await resolveCompanyScope(pool, req);
      const { canViewSalary, canViewSensitive, canViewAll } = await resolveEmployeeVisibilityFlags(pool, req);

      const result = await listEmployees(pool, {
        companyId,
        userId: req.user.userId,
        isGlobal: req.user?.role === 'Super Admin',
        isCompanyAdmin: req.user?.role === 'Company Admin',
        canViewAll,
        canViewSalary,
        canViewSensitive,
        page: req.query.page ? Number(req.query.page) : 1,
        pageSize: req.query.pageSize ? Number(req.query.pageSize) : 20,
        search: req.query.search || '',
        status: req.query.status || '',
        departmentId: req.query.departmentId,
        branchId: req.query.branchId,
        positionId: req.query.positionId,
        contractTypeId: req.query.contractTypeId
      });

      res.json(result);
    } catch (err) {
      console.error('Error listing employees:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al listar empleados.' });
    }
  });

  // Export CSV
  router.get('/employees/export', requirePermission('RRHH Empleados', 'Exportar empleados'), async (req, res) => {
    try {
      const companyId = await resolveCompanyScope(pool, req);
      const { canViewSalary, canViewSensitive, canViewAll } = await resolveEmployeeVisibilityFlags(pool, req);

      const result = await listEmployees(pool, {
        companyId,
        userId: req.user.userId,
        isGlobal: req.user?.role === 'Super Admin',
        isCompanyAdmin: req.user?.role === 'Company Admin',
        canViewAll,
        canViewSalary,
        canViewSensitive,
        page: 1,
        pageSize: 5000,
        search: req.query.search || '',
        status: req.query.status || '',
        departmentId: req.query.departmentId,
        branchId: req.query.branchId
      });

      await writeAudit(req, 'EXPORT', 'RRHH Empleados', 'HrEmployee', null, companyId, {
        context: `Exportación de ${result.data.length} empleados a CSV`
      });

      const headers = ['Codigo', 'Nombres', 'Apellidos', 'Documento', 'Email', 'Telefono', 'Departamento', 'Cargo', 'Sucursal', 'Estado', 'FechaIngreso'];
      if (canViewSalary) headers.push('SalarioBase', 'Moneda');

      const csvLines = [headers.join(',')];
      for (const e of result.data) {
        const row = [
          csvCell(e.EmployeeCode),
          csvCell(e.FirstName),
          csvCell(e.LastName),
          csvCell(e.DocumentNumber || ''),
          csvCell(e.Email || ''),
          csvCell(e.Phone || ''),
          csvCell(e.DepartmentName || ''),
          csvCell(e.PositionTitle || ''),
          csvCell(e.BranchName || ''),
          csvCell(e.Status),
          csvCell(e.HireDate ? new Date(e.HireDate).toISOString().slice(0, 10) : '')
        ];
        if (canViewSalary) {
          row.push(csvCell(e.BaseSalary || 0), csvCell(e.SalaryCurrency || 'DOP'));
        }
        csvLines.push(row.join(','));
      }

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="empleados_${new Date().toISOString().slice(0, 10)}.csv"`);
      res.send('\uFEFF' + csvLines.join('\n'));
    } catch (err) {
      console.error('Error exporting employees:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al exportar empleados.' });
    }
  });

  // Get employee details
  router.get('/employees/:id', requirePermission('RRHH Empleados', 'Ver empleados'), async (req, res) => {
    try {
      await assertEmployeeAccess(pool, req, req.params.id);
      const { canViewSalary, canViewSensitive } = await resolveEmployeeVisibilityFlags(pool, req);

      const employee = await getEmployeeById(pool, req.params.id, { canViewSalary, canViewSensitive });
      if (!employee) return res.status(404).json({ message: 'Empleado no encontrado.' });

      res.json(employee);
    } catch (err) {
      console.error('Error getting employee details:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al obtener empleado.' });
    }
  });

  // Get employee movements history
  router.get('/employees/:id/history', requirePermission('RRHH Empleados', 'Ver empleados'), async (req, res) => {
    try {
      await assertEmployeeAccess(pool, req, req.params.id);
      const history = await listEmployeeMovements(pool, req.params.id);
      res.json(history);
    } catch (err) {
      console.error('Error getting employee history:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al obtener historial.' });
    }
  });

  // Generate employee PDF dossier
  router.get('/employees/:id/pdf', requirePermission('RRHH Empleados', 'Exportar empleados'), async (req, res) => {
    try {
      await assertEmployeeAccess(pool, req, req.params.id);
      const { canViewSalary } = await resolveEmployeeVisibilityFlags(pool, req);

      const employee = await getEmployeeById(pool, req.params.id, { canViewSalary, canViewSensitive: true });
      if (!employee) return res.status(404).json({ message: 'Empleado no encontrado.' });

      const [companyRes, photoRes] = await Promise.all([
        pool.request()
          .input('id', employee.CompanyId)
          .query('SELECT Name FROM Companies WHERE Id = @id;'),
        employee.PhotoFileId
          ? pool.request()
              .input('fileId', employee.PhotoFileId)
              .query('SELECT StorageKey FROM HrFiles WHERE Id = @fileId;')
          : Promise.resolve({ recordset: [] })
      ]);

      const companyName = companyRes.recordset[0]?.Name || 'Kinetix Core';
      const photoStorageKey = photoRes.recordset[0]?.StorageKey || null;

      await writeAudit(req, 'EXPORT', 'RRHH Empleados', 'HrEmployeePdf', String(employee.Id), employee.CompanyId);

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="ficha_${employee.EmployeeCode}.pdf"`);

      generateEmployeePdf(employee, res, { companyName, photoStorageKey });
    } catch (err) {
      console.error('Error generating employee PDF:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al generar ficha PDF.' });
    }
  });

  // Create new employee
  router.post('/employees', requirePermission('RRHH Empleados', 'Crear empleados'), async (req, res) => {
    try {
      const companyId = await resolveCompanyScope(pool, req);

      const validation = validateEmployeeInput(req.body);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.errors.join(' ') });
      }

      const created = await createEmployee(pool, {
        ...req.body,
        companyId
      }, req.user.userId);

      await writeAudit(req, 'CREATE', 'RRHH Empleados', 'HrEmployee', String(created.Id), companyId, {
        newValues: {
          employeeCode: created.EmployeeCode,
          firstName: created.FirstName,
          lastName: created.LastName,
          departmentId: req.body.departmentId,
          positionId: req.body.positionId
        }
      });

      res.status(201).json(created);
    } catch (err) {
      console.error('Error creating employee:', err);
      let msg = err.message || 'Error al crear empleado.';
      const isDuplicate = err.code === '23505';
      if (isDuplicate) {
        const msgLower = (err.message || '').toLowerCase();
        if (msgLower.includes('code')) msg = 'Ya existe un empleado con ese código en la empresa.';
        else if (msgLower.includes('document')) msg = 'Ya existe un empleado con ese tipo y número de documento en la empresa.';
        else if (msgLower.includes('userid')) msg = 'Ese usuario ya está vinculado a otro empleado.';
        else msg = 'Ya existe un registro con esos datos únicos en la empresa.';
      }
      res.status(isDuplicate ? 409 : (err.status || 500)).json({ message: msg });
    }
  });

  // Update employee basic/personal data
  router.put('/employees/:id', requirePermission('RRHH Empleados', 'Editar empleados'), async (req, res) => {
    try {
      await assertEmployeeAccess(pool, req, req.params.id);

      const current = await getEmployeeById(pool, req.params.id, { canViewSalary: true, canViewSensitive: true });
      if (!current) return res.status(404).json({ message: 'Empleado no encontrado.' });

      if (current.Status === 'Desvinculado') {
        return res.status(400).json({ message: 'No se puede editar directamente un empleado desvinculado. Debe reactivarse primero.' });
      }

      const validation = validateEmployeeInput(req.body, true);
      if (!validation.valid) {
        return res.status(400).json({ message: validation.errors.join(' ') });
      }

      const updated = await updateEmployee(pool, current.Id, req.body, req.user.userId);

      await writeAudit(req, 'UPDATE', 'RRHH Empleados', 'HrEmployee', String(current.Id), current.CompanyId, {
        oldValues: current,
        newValues: req.body
      });

      res.json(updated);
    } catch (err) {
      console.error('Error updating employee:', err);
      const isDuplicate = err.code === '23505';
      res.status(isDuplicate ? 409 : (err.status || 500)).json({
        message: isDuplicate ? 'Ya existe un registro con esos datos únicos en la empresa.' : (err.message || 'Error al actualizar empleado.')
      });
    }
  });

  // Upload/change photo
  router.put('/employees/:id/photo', requirePermission('RRHH Empleados', 'Editar empleados'), withUpload(uploadPhoto.single('photo')), async (req, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: 'Se requiere una imagen para la foto.' });

      const emp = await getEmployeeById(pool, req.params.id);
      if (!emp) return res.status(404).json({ message: 'Empleado no encontrado.' });
      await assertCompanyAccess(pool, req, emp.CompanyId);

      const savedFile = await saveFile({
        pool,
        buffer: req.file.buffer,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        companyId: emp.CompanyId,
        userId: req.user.userId,
        folder: 'photos'
      });

      await setEmployeePhoto(pool, emp.Id, savedFile.Id);

      await writeAudit(req, 'UPDATE', 'RRHH Empleados', 'HrEmployeePhoto', String(emp.Id), emp.CompanyId);

      res.json({ message: 'Foto de empleado actualizada.', photoFileId: savedFile.Id });
    } catch (err) {
      console.error('Error updating employee photo:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al subir fotografía.' });
    }
  });

  // Get photo
  router.get('/employees/:id/photo', async (req, res) => {
    try {
      const emp = await getEmployeeById(pool, req.params.id);
      if (!emp || !emp.PhotoFileId) return res.status(404).json({ message: 'No hay foto disponible.' });
      await assertCompanyAccess(pool, req, emp.CompanyId);

      const photoRes = await pool.request()
        .input('id', emp.PhotoFileId)
        .query('SELECT StorageKey, MimeType FROM HrFiles WHERE Id = @id;');
      const photo = photoRes.recordset[0];
      if (!photo) return res.status(404).json({ message: 'Archivo de foto no encontrado.' });

      const filePath = getFilePath(photo.StorageKey);
      if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Archivo físico no disponible.' });

      res.setHeader('Content-Type', photo.MimeType);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      fs.createReadStream(filePath).pipe(res);
    } catch (err) {
      console.error('Error serving employee photo:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al servir fotografía.' });
    }
  });

  // Link / Unlink user account
  router.post('/employees/:id/link-user', requirePermission('RRHH Empleados', 'Editar empleados'), async (req, res) => {
    try {
      const emp = await getEmployeeById(pool, req.params.id);
      if (!emp) return res.status(404).json({ message: 'Empleado no encontrado.' });
      await assertCompanyAccess(pool, req, emp.CompanyId);

      const targetUserId = req.body?.userId || null;
      await linkUserAccount(pool, emp.Id, targetUserId, req.user.userId);

      await writeAudit(req, targetUserId ? 'LINK_USER' : 'UNLINK_USER', 'RRHH Empleados', 'HrEmployee', String(emp.Id), emp.CompanyId, {
        context: targetUserId ? `Vinculado a cuenta ${targetUserId}` : 'Cuenta de usuario desvinculada'
      });

      res.json({ message: targetUserId ? 'Usuario vinculado al empleado.' : 'Usuario desvinculado.' });
    } catch (err) {
      console.error('Error linking user:', err);
      const isDuplicate = err.code === '23505';
      res.status(isDuplicate ? 409 : (err.status || 500)).json({
        message: isDuplicate ? 'Ese usuario ya está vinculado a otro empleado.' : 'Error al vincular usuario.'
      });
    }
  });

  // ── Labor Movements ─────────────────────────────────────────────────────────

  router.post('/employees/:id/transfer', requirePermission('RRHH Empleados', 'Gestionar movimientos'), async (req, res) => {
    try {
      await assertEmployeeAccess(pool, req, req.params.id);
      const { toBranchId, toDepartmentId, reason, effectiveDate } = req.body;
      if (!toDepartmentId && !toBranchId) {
        return res.status(400).json({ message: 'Debe especificar la nueva sucursal o departamento de destino.' });
      }

      const result = await executeLaborMovement(pool, {
        employeeId: req.params.id,
        movementType: 'Transferencia',
        effectiveDate,
        toBranchId,
        toDepartmentId,
        reason: reason || 'Transferencia departamental o de sucursal',
        userId: req.user.userId
      });

      await writeAudit(req, 'TRANSFER', 'RRHH Empleados', 'HrEmployee', req.params.id, null, {
        oldValues: result.oldValues,
        newValues: result.newValues
      });

      res.json({ message: 'Transferencia registrada exitosamente.', movement: result.movement });
    } catch (err) {
      console.error('Error executing transfer:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al ejecutar transferencia.' });
    }
  });

  router.post('/employees/:id/promote', requirePermission('RRHH Empleados', 'Gestionar movimientos'), async (req, res) => {
    try {
      await assertEmployeeAccess(pool, req, req.params.id);
      const { toPositionId, toDepartmentId, toSalary, reason, effectiveDate } = req.body;
      if (!toPositionId) {
        return res.status(400).json({ message: 'Debe especificar el nuevo cargo para el ascenso.' });
      }

      const result = await executeLaborMovement(pool, {
        employeeId: req.params.id,
        movementType: 'Ascenso',
        effectiveDate,
        toPositionId,
        toDepartmentId,
        toSalary,
        reason: reason || 'Ascenso de puesto',
        userId: req.user.userId
      });

      await writeAudit(req, 'PROMOTE', 'RRHH Empleados', 'HrEmployee', req.params.id, null, {
        oldValues: result.oldValues,
        newValues: result.newValues
      });

      res.json({ message: 'Ascenso registrado exitosamente.', movement: result.movement });
    } catch (err) {
      console.error('Error executing promotion:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al registrar ascenso.' });
    }
  });

  router.post('/employees/:id/position', requirePermission('RRHH Empleados', 'Gestionar movimientos'), async (req, res) => {
    try {
      await assertEmployeeAccess(pool, req, req.params.id);
      const { toPositionId, toDepartmentId, reason, effectiveDate } = req.body;
      if (!toPositionId) {
        return res.status(400).json({ message: 'Debe especificar el nuevo cargo.' });
      }

      const result = await executeLaborMovement(pool, {
        employeeId: req.params.id,
        movementType: 'CambioCargo',
        effectiveDate,
        toPositionId,
        toDepartmentId,
        reason: reason || 'Cambio de cargo laboral',
        userId: req.user.userId
      });

      await writeAudit(req, 'POSITION_CHANGE', 'RRHH Empleados', 'HrEmployee', req.params.id, null, {
        oldValues: result.oldValues,
        newValues: result.newValues
      });

      res.json({ message: 'Cambio de cargo registrado exitosamente.', movement: result.movement });
    } catch (err) {
      console.error('Error executing position change:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al cambiar cargo.' });
    }
  });

  router.post('/employees/:id/salary', requirePermission('RRHH Empleados', 'Ver información salarial'), async (req, res) => {
    try {
      await assertEmployeeAccess(pool, req, req.params.id);
      const { toSalary, reason, effectiveDate } = req.body;
      const salary = Number(toSalary);
      if (isNaN(salary) || salary < 0) {
        return res.status(400).json({ message: 'El nuevo salario debe ser un número válido positivo.' });
      }

      const result = await executeLaborMovement(pool, {
        employeeId: req.params.id,
        movementType: 'AjusteSalarial',
        effectiveDate,
        toSalary: salary,
        reason: reason || 'Ajuste salarial',
        userId: req.user.userId
      });

      await writeAudit(req, 'SALARY_CHANGE', 'RRHH Empleados', 'HrEmployee', req.params.id, null, {
        oldValues: result.oldValues,
        newValues: result.newValues
      });

      res.json({ message: 'Ajuste salarial registrado exitosamente.', movement: result.movement });
    } catch (err) {
      console.error('Error executing salary adjustment:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al ajustar salario.' });
    }
  });

  router.post('/employees/:id/suspend', requirePermission('RRHH Empleados', 'Cambiar estado laboral'), async (req, res) => {
    try {
      await assertEmployeeAccess(pool, req, req.params.id);
      const { reason, effectiveDate } = req.body;

      const result = await executeLaborMovement(pool, {
        employeeId: req.params.id,
        movementType: 'Suspension',
        effectiveDate,
        toStatus: 'Suspendido',
        reason: reason || 'Suspensión temporal de labores',
        userId: req.user.userId
      });

      await writeAudit(req, 'SUSPEND', 'RRHH Empleados', 'HrEmployee', req.params.id, null, {
        oldValues: result.oldValues,
        newValues: result.newValues
      });

      res.json({ message: 'Empleado suspendido.', movement: result.movement });
    } catch (err) {
      console.error('Error suspending employee:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al suspender empleado.' });
    }
  });

  router.post('/employees/:id/leave', requirePermission('RRHH Empleados', 'Cambiar estado laboral'), async (req, res) => {
    try {
      await assertEmployeeAccess(pool, req, req.params.id);
      const { reason, effectiveDate } = req.body;

      const result = await executeLaborMovement(pool, {
        employeeId: req.params.id,
        movementType: 'Licencia',
        effectiveDate,
        toStatus: 'Licencia',
        reason: reason || 'Licencia médica / personal',
        userId: req.user.userId
      });

      await writeAudit(req, 'LEAVE', 'RRHH Empleados', 'HrEmployee', req.params.id, null, {
        oldValues: result.oldValues,
        newValues: result.newValues
      });

      res.json({ message: 'Empleado en estado de licencia.', movement: result.movement });
    } catch (err) {
      console.error('Error placing employee on leave:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al asignar licencia.' });
    }
  });

  router.post('/employees/:id/reactivate', requirePermission('RRHH Empleados', 'Cambiar estado laboral'), async (req, res) => {
    try {
      await assertEmployeeAccess(pool, req, req.params.id);
      const { reason, effectiveDate } = req.body;

      const result = await executeLaborMovement(pool, {
        employeeId: req.params.id,
        movementType: 'Reactivacion',
        effectiveDate,
        toStatus: 'Activo',
        reason: reason || 'Reactivación laboral',
        userId: req.user.userId
      });

      await writeAudit(req, 'REACTIVATE', 'RRHH Empleados', 'HrEmployee', req.params.id, null, {
        oldValues: result.oldValues,
        newValues: result.newValues
      });

      res.json({ message: 'Empleado reactivado.', movement: result.movement });
    } catch (err) {
      console.error('Error reactivating employee:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al reactivar empleado.' });
    }
  });

  router.post('/employees/:id/terminate', requirePermission('RRHH Empleados', 'Cambiar estado laboral'), async (req, res) => {
    try {
      await assertEmployeeAccess(pool, req, req.params.id);
      const { terminationReasonId, terminationNotes, effectiveDate, reason } = req.body;
      if (!terminationReasonId) {
        return res.status(400).json({ message: 'Debe especificar el motivo legal o administrativo de desvinculación.' });
      }

      const result = await executeLaborMovement(pool, {
        employeeId: req.params.id,
        movementType: 'Desvinculacion',
        effectiveDate: effectiveDate || new Date(),
        toStatus: 'Desvinculado',
        terminationReasonId,
        terminationNotes,
        reason: reason || terminationNotes || 'Desvinculación laboral',
        userId: req.user.userId
      });

      await writeAudit(req, 'TERMINATE', 'RRHH Empleados', 'HrEmployee', req.params.id, null, {
        oldValues: result.oldValues,
        newValues: result.newValues
      });

      res.json({ message: 'Desvinculación registrada exitosamente.', movement: result.movement });
    } catch (err) {
      console.error('Error terminating employee:', err);
      res.status(err.status || 500).json({ message: err.message || 'Error al registrar desvinculación.' });
    }
  });

  return router;
}
