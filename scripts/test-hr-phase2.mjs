import 'dotenv/config';
import assert from 'node:assert';
import { db } from '../server/core/db.js';
import { recordCheckIn, recordCheckOut, listAttendance, listWorkShifts } from '../server/modules/hr/repositories/attendance.repo.js';
import { getEmployeeVacationBalance, createVacationRequest, applyVacationApproval } from '../server/modules/hr/repositories/vacations.repo.js';
import { listLeaveTypes, createLeaveRequest, applyLeaveApproval } from '../server/modules/hr/repositories/leaves.repo.js';
import { getPendingApprovalsForUser, processApprovalAction } from '../server/modules/hr/repositories/approvals.repo.js';
import { getUnreadNotificationsCount, listUserNotifications, markNotificationRead } from '../server/modules/hr/repositories/notifications.repo.js';

async function runPhase2Tests() {
  console.log('=== INICIANDO PRUEBAS AUTOMATIZADAS: RRHH FASE 2 ===\n');

  const pool = db;
  let employeeId;
  let tempEmpCreated = false;

  try {
    const compRes = await pool.request().query('SELECT Id FROM Companies WHERE IsActive = TRUE LIMIT 1;');
    const companyId = compRes.recordset[0]?.Id;
    assert(companyId, 'Debe existir una empresa activa');

    const empRes = await pool.request().query("SELECT Id, UserId FROM HrEmployees WHERE Status = 'Activo' AND HireDate <= now() - INTERVAL '1 year' ORDER BY HireDate ASC LIMIT 1;");
    if (empRes.recordset[0]) {
      employeeId = empRes.recordset[0].Id;
    } else {
      const insRes = await pool.request().query(`
        INSERT INTO HrEmployees (CompanyId, EmployeeCode, FirstName, LastName, DocumentType, DocumentNumber, Email, HireDate, Status, BaseSalary, PayFrequency)
        VALUES (1, 'EMP-TEMP-P2', 'Test', 'Phase2', 'Cedula', '402-0000000-0', 'test.p2@empresa.com', '2023-01-01', 'Activo', 50000, 'Mensual')
        RETURNING Id;
      `);
      employeeId = insRes.recordset[0].Id;
      tempEmpCreated = true;
    }

    // 1. Shifts and attendance
    console.log('1. Probando turnos de trabajo y registro de asistencia...');
    const shifts = await listWorkShifts(pool, companyId);
    assert(shifts.length > 0, 'Debe haber turnos sembrados');
    console.log(`   ✓ Turnos encontrados: ${shifts.length} (ej. ${shifts[0].Name})`);

    // Clock-in late test: Simulate clock in at 8:35 AM
    const today = new Date().toISOString().slice(0, 10);
    const lateTime = new Date(`${today}T08:35:00`);
    const checkIn = await recordCheckIn(pool, {
      companyId,
      employeeId,
      checkInTime: lateTime,
      notes: 'Llegada con retraso por tráfico'
    });
    assert.strictEqual(checkIn.Status, 'Tardanza', 'El estado debe ser Tardanza por llegar después de tolerancia');
    assert(checkIn.LateMinutes >= 35, 'Minutos de tardanza calculados correctamente');
    console.log(`   ✓ Marca de entrada registrada: ${checkIn.Status} (${checkIn.LateMinutes} min de tardanza)`);

    // Clock-out test: Simulate clock out at 18:30 PM (overtime)
    const outTime = new Date(`${today}T18:30:00`);
    const checkOut = await recordCheckOut(pool, {
      companyId,
      employeeId,
      checkOutTime: outTime,
      notes: 'Salida con horas extras'
    });
    assert(checkOut.RegularMinutes > 0, 'Minutos regulares calculados');
    console.log(`   ✓ Marca de salida registrada: ${checkOut.RegularMinutes / 60} hrs regulares, ${checkOut.OvertimeMinutes / 60} hrs extras.`);

    // 2. Vacation Balance & Dominican scale
    console.log('\n2. Probando saldo de vacaciones y escala dominicana (Art. 177)...');
    await pool.request()
      .input('empId', employeeId)
      .query('UPDATE HrVacationBalances SET DaysPending = 0, DaysUsed = 0 WHERE EmployeeId = @empId;');

    const balance = await getEmployeeVacationBalance(pool, employeeId);
    assert(balance.DaysEarned >= 14, 'Empleado debe tener al menos 14 días ganados según escala legal');
    console.log(`   ✓ Saldo de vacaciones: ${balance.DaysEarned} generados, ${balance.daysAvailable} disponibles.`);

    // 3. Vacation Request & Multi-step approval flow
    console.log('\n3. Probando solicitud de vacaciones y flujo de aprobación multietapa...');
    // Clean up test dates to prevent duplicate/overlap conflicts on re-run
    await pool.request().input('empId', employeeId).query("DELETE FROM HrVacationRequests WHERE EmployeeId = @empId;");
    await pool.request().input('empId', employeeId).query("DELETE FROM HrLeaveRequests WHERE EmployeeId = @empId;");
    await pool.request().input('empId', employeeId).query("DELETE FROM HrApprovalHistory WHERE RequestId IN (SELECT Id FROM HrApprovalRequests WHERE RequesterEmployeeId = @empId AND RequestType IN ('Vacaciones', 'Permiso'));");
    await pool.request().input('empId', employeeId).query("DELETE FROM HrApprovalRequests WHERE RequesterEmployeeId = @empId AND RequestType IN ('Vacaciones', 'Permiso');");

    const daysToRequest = 5;
    const { vacationRequest, approval } = await createVacationRequest(pool, {
      companyId,
      employeeId,
      startDate: '2026-11-09',
      endDate: '2026-11-13',
      returnDate: '2026-11-16',
      daysRequested: daysToRequest,
      reason: 'Vacaciones de fin de año'
    });

    assert.strictEqual(vacationRequest.Status, 'Pendiente');
    assert.strictEqual(approval.Status, 'Pendiente');
    assert.strictEqual(approval.CurrentStepNumber, 1);
    console.log(`   ✓ Solicitud de vacaciones creada (#${vacationRequest.Id}) enlazada a Flujo de Aprobación (#${approval.Id}).`);

    // Check pending approvals
    const adminUserRes = await pool.request().query("SELECT UserId FROM UserOrganizations WHERE Email = 'superadmin@kinetix.local' LIMIT 1;");
    const adminUserId = adminUserRes.recordset[0]?.UserId;

    const pending = await getPendingApprovalsForUser(pool, {
      companyId,
      userId: adminUserId,
      isGlobalAdmin: true,
      isCompanyAdmin: true
    });
    const found = pending.find(p => p.Id === approval.Id);
    assert(found, 'La solicitud debe aparecer en la bandeja de pendientes');
    console.log(`   ✓ Solicitud detectada en bandeja de aprobación del supervisor/admin.`);

    // Approve step 1
    const step1Outcome = await processApprovalAction(pool, {
      requestId: approval.Id,
      approverUserId: adminUserId,
      action: 'Aprobado',
      comments: 'Visto bueno del supervisor inmediato',
      isGlobalAdmin: true,
      isCompanyAdmin: true
    });
    console.log(`   ✓ Paso 1 aprobado. Estado: ${step1Outcome.status}, Completado: ${step1Outcome.isCompleted}`);

    // If there is step 2, approve step 2
    if (!step1Outcome.isCompleted) {
      const step2Outcome = await processApprovalAction(pool, {
        requestId: approval.Id,
        approverUserId: adminUserId,
        action: 'Aprobado',
        comments: 'Aprobación final de Dirección de Recursos Humanos',
        isGlobalAdmin: true,
        isCompanyAdmin: true
      });
      assert.strictEqual(step2Outcome.status, 'Aprobada');
      assert.strictEqual(step2Outcome.isCompleted, true);
      await applyVacationApproval(pool, vacationRequest.Id);
      console.log(`   ✓ Paso 2 aprobado. Flujo completado y vacaciones activadas.`);
    } else {
      await applyVacationApproval(pool, vacationRequest.Id);
    }

    // Verify vacation balance updated and attendance marked
    const updatedBalance = await getEmployeeVacationBalance(pool, employeeId);
    assert(updatedBalance.DaysUsed >= 5, 'Días disfrutados debe haberse incrementado');
    console.log(`   ✓ Saldo actualizado: ${updatedBalance.DaysUsed} días utilizados, ${updatedBalance.daysAvailable} restantes.`);

    // 4. Leave Types & Permission Requests
    console.log('\n4. Probando licencias y permisos laborales...');
    const leaveTypes = await listLeaveTypes(pool, companyId);
    assert(leaveTypes.length > 0, 'Debe haber tipos de licencias sembrados');
    const medLeave = leaveTypes.find(t => t.Code === 'LIC-MED') || leaveTypes[0];

    // 4a. Verify requirement of attachment
    let attachmentBlocked = false;
    try {
      await createLeaveRequest(pool, {
        companyId,
        employeeId,
        leaveTypeId: medLeave.Id,
        startDate: '2026-12-01',
        endDate: '2026-12-02',
        duration: 2,
        reason: 'Sin documento médico'
      });
    } catch (err) {
      attachmentBlocked = true;
    }
    assert.strictEqual(attachmentBlocked, true, 'Licencia médica debe exigir adjunto');
    console.log('   ✓ Rechazo correcto cuando falta adjunto obligatorio en licencia médica.');

    // 4b. Insert a test document and proceed
    const fileRes = await pool.request()
      .input('compId', companyId)
      .input('uid', adminUserId)
      .query(`
        INSERT INTO HrFiles (CompanyId, UploadedBy, OriginalName, StorageKey, MimeType, SizeBytes, Sha256)
        VALUES (@compId, @uid, 'constancia_medica.pdf', 'test/constancia.pdf', 'application/pdf', 2048, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
        RETURNING Id;
      `);
    const testFileId = fileRes.recordset[0].Id;

    const { leaveRequest, approval: leaveApp } = await createLeaveRequest(pool, {
      companyId,
      employeeId,
      leaveTypeId: medLeave.Id,
      startDate: '2026-12-01',
      endDate: '2026-12-02',
      duration: 2,
      unit: 'Dias',
      reason: 'Cita médica especialista con reposo prescrito',
      attachedFileId: testFileId
    });

    assert.strictEqual(leaveRequest.Status, 'Pendiente');
    console.log(`   ✓ Solicitud de licencia médica (#${leaveRequest.Id}) creada con adjunto válido.`);

    // Approve leave request
    const leaveOutcome = await processApprovalAction(pool, {
      requestId: leaveApp.Id,
      approverUserId: adminUserId,
      action: 'Aprobado',
      comments: 'Justificante médico verificado',
      isGlobalAdmin: true,
      isCompanyAdmin: true
    });
    if (leaveOutcome.isCompleted) {
      await applyLeaveApproval(pool, leaveRequest.Id);
    }
    console.log(`   ✓ Licencia aprobada y registrada en calendario de ausencias.`);

    // 5. In-App Notifications
    console.log('\n5. Probando sistema de notificaciones internas in-app...');
    const unreadCount = await getUnreadNotificationsCount(pool, adminUserId);
    console.log(`   Notificaciones no leídas para admin: ${unreadCount}`);
    const notifs = await listUserNotifications(pool, adminUserId, { page: 1, pageSize: 5 });
    assert(notifs.data.length > 0, 'Debe haber notificaciones generadas por los flujos');
    const firstNotif = notifs.data[0];
    await markNotificationRead(pool, firstNotif.Id, adminUserId);
    console.log(`   ✓ Notificación #${firstNotif.Id} (${firstNotif.Title}) marcada como leída.`);

    // Clean up test file
    await pool.request().input('fid', testFileId).query('UPDATE HrLeaveRequests SET AttachedFileId = NULL WHERE AttachedFileId = @fid;');
    await pool.request().input('fid', testFileId).query('DELETE FROM HrFiles WHERE Id = @fid;');

    console.log('\n======================================================');
    console.log('TODAS LAS PRUEBAS DE LA FASE 2 COMPLETADAS CON ÉXITO.');
    console.log('======================================================\n');
  } finally {
    if (tempEmpCreated && employeeId) {
      try {
        const cleanupQueries = [
          'DELETE FROM HrEmployeeShifts WHERE EmployeeId = @id;',
          'DELETE FROM HrAttendance WHERE EmployeeId = @id;',
          'DELETE FROM HrAttendanceCorrections WHERE EmployeeId = @id;',
          'DELETE FROM HrVacationBalances WHERE EmployeeId = @id;',
          'DELETE FROM HrVacationRequests WHERE EmployeeId = @id;',
          'DELETE FROM HrEmergencyContacts WHERE EmployeeId = @id;',
          'DELETE FROM HrEmployeeDocuments WHERE EmployeeId = @id;',
          'DELETE FROM HrLeaveRequests WHERE EmployeeId = @id;',
          'DELETE FROM HrApprovalHistory WHERE RequestId IN (SELECT Id FROM HrApprovalRequests WHERE RequesterEmployeeId = @id);',
          'DELETE FROM HrApprovalRequests WHERE RequesterEmployeeId = @id;',
          'DELETE FROM HrEmployeeMovements WHERE EmployeeId = @id;',
          'DELETE FROM HrEmployees WHERE Id = @id;'
        ];
        for (const sql of cleanupQueries) {
          await pool.request().input('id', employeeId).query(sql);
        }
      } catch (cleanErr) {
        console.error('Error cleaning up temp employee:', cleanErr.message);
      }
    }
    await pool.close();
  }
}

runPhase2Tests().catch(err => {
  console.error('\n[ERROR] EN PRUEBAS FASE 2:', err);
  process.exit(1);
});
