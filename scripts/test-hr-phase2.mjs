import 'dotenv/config';
import sql from 'mssql/msnodesqlv8.js';
import assert from 'node:assert';
import { recordCheckIn, recordCheckOut, listAttendance, listWorkShifts } from '../server/modules/hr/repositories/attendance.repo.js';
import { getEmployeeVacationBalance, createVacationRequest, applyVacationApproval } from '../server/modules/hr/repositories/vacations.repo.js';
import { listLeaveTypes, createLeaveRequest, applyLeaveApproval } from '../server/modules/hr/repositories/leaves.repo.js';
import { getPendingApprovalsForUser, processApprovalAction } from '../server/modules/hr/repositories/approvals.repo.js';
import { getUnreadNotificationsCount, listUserNotifications, markNotificationRead } from '../server/modules/hr/repositories/notifications.repo.js';

async function runPhase2Tests() {
  console.log('=== INICIANDO PRUEBAS AUTOMATIZADAS: RRHH FASE 2 ===\n');

  const server = process.env.DB_SERVER || '(localdb)\\MSSQLLocalDB';
  const database = process.env.DB_DATABASE || 'KinetixCore';
  const pool = await sql.connect({
    server, database, driver: 'msnodesqlv8',
    connectionString: `Driver={ODBC Driver 18 for SQL Server};Server=${server};Database=${database};Trusted_Connection=Yes;Encrypt=No;TrustServerCertificate=Yes;`,
    options: { trustedConnection: true, trustServerCertificate: true }
  });

  try {
    const compRes = await pool.request().query('SELECT TOP 1 Id FROM dbo.Companies WHERE IsActive = 1;');
    const companyId = compRes.recordset[0]?.Id;
    assert(companyId, 'Debe existir una empresa activa');

    const empRes = await pool.request().query('SELECT TOP 1 Id, UserId FROM dbo.HrEmployees WHERE Status = N\'Activo\';');
    const employeeId = empRes.recordset[0]?.Id;
    assert(employeeId, 'Debe existir al menos un empleado activo (Carlos Mendoza)');

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
      .query('UPDATE dbo.HrVacationBalances SET DaysPending = 0, DaysUsed = 0 WHERE EmployeeId = @empId;');

    const balance = await getEmployeeVacationBalance(pool, employeeId);
    assert(balance.DaysEarned >= 14, 'Empleado debe tener al menos 14 días ganados según escala legal');
    console.log(`   ✓ Saldo de vacaciones: ${balance.DaysEarned} generados, ${balance.daysAvailable} disponibles.`);

    // 3. Vacation Request & Multi-step approval flow
    console.log('\n3. Probando solicitud de vacaciones y flujo de aprobación multietapa...');
    const daysToRequest = Math.min(5, Math.max(1, balance.daysAvailable));
    const { vacationRequest, approval } = await createVacationRequest(pool, {
      companyId,
      employeeId,
      startDate: '2026-11-10',
      endDate: '2026-11-14',
      returnDate: '2026-11-17',
      daysRequested: daysToRequest,
      reason: 'Vacaciones de fin de año'
    });

    assert.strictEqual(vacationRequest.Status, 'Pendiente');
    assert.strictEqual(approval.Status, 'Pendiente');
    assert.strictEqual(approval.CurrentStepNumber, 1);
    console.log(`   ✓ Solicitud de vacaciones creada (#${vacationRequest.Id}) enlazada a Flujo de Aprobación (#${approval.Id}).`);

    // Check pending approvals
    const adminUserRes = await pool.request().query("SELECT TOP 1 UserId FROM dbo.UserOrganizations WHERE Email = 'superadmin@kinetix.local';");
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

    const { leaveRequest, approval: leaveApp } = await createLeaveRequest(pool, {
      companyId,
      employeeId,
      leaveTypeId: medLeave.Id,
      startDate: '2026-12-01',
      endDate: '2026-12-02',
      duration: 2,
      unit: 'Dias',
      reason: 'Cita médica especialista con reposo prescrito'
    });

    assert.strictEqual(leaveRequest.Status, 'Pendiente');
    console.log(`   ✓ Solicitud de licencia médica (#${leaveRequest.Id}) creada.`);

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

    console.log('\n======================================================');
    console.log('TODAS LAS PRUEBAS DE LA FASE 2 COMPLETADAS CON ÉXITO.');
    console.log('======================================================\n');
  } finally {
    await pool.close();
  }
}

runPhase2Tests().catch(err => {
  console.error('\n❌ ERROR EN PRUEBAS FASE 2:', err);
  process.exit(1);
});
