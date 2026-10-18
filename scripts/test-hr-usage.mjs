import 'dotenv/config';
import crypto from 'node:crypto';
import assert from 'node:assert';
import sql from 'mssql/msnodesqlv8.js';

const BASE_URL = 'http://localhost:3000';

async function createTestSession(pool, userId) {
  const token = 'test-token-' + crypto.randomUUID();
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 3600000);

  await pool.request()
    .input('hash', sql.NVarChar(64), tokenHash)
    .input('userId', sql.NVarChar(450), userId)
    .input('expires', sql.DateTime2, expiresAt)
    .query(`
      INSERT INTO dbo.UserSessions (TokenHash, UserId, ExpiresAt)
      VALUES (@hash, @userId, @expires);
    `);

  return { token, tokenHash };
}

async function api(path, { method = 'GET', body, token, headers = {} } = {}) {
  const reqHeaders = {
    ...headers,
    Cookie: `kinetix_session=${token}`
  };
  if (body && typeof body === 'object' && !(body instanceof FormData)) {
    reqHeaders['Content-Type'] = 'application/json';
    body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: reqHeaders,
    body
  });

  const contentType = res.headers.get('content-type') || '';
  let data = null;
  if (contentType.includes('application/json')) {
    data = await res.json();
  } else if (contentType.includes('text/')) {
    data = await res.text();
  } else {
    data = await res.arrayBuffer();
  }

  return { status: res.status, ok: res.ok, data, headers: res.headers };
}

async function runStatements(pool, queries) {
  for (const q of queries) {
    if (q && q.trim()) {
      await pool.request().query(q);
    }
  }
}

async function main() {
  console.log('===============================================================');
  console.log('🚀 INICIANDO PRUEBAS DE USO END-TO-END (HTTP) - MÓDULO DE RRHH');
  console.log('===============================================================\n');

  const server = process.env.DB_SERVER || '(localdb)\\MSSQLLocalDB';
  const database = process.env.DB_DATABASE || 'KinetixCore';
  const pool = await sql.connect({
    server, database, driver: 'msnodesqlv8',
    connectionString: `Driver={ODBC Driver 18 for SQL Server};Server=${server};Database=${database};Trusted_Connection=Yes;Encrypt=No;TrustServerCertificate=Yes;`,
    options: { trustedConnection: true, trustServerCertificate: true }
  });

  const sessionsToClean = [];
  let deptId;
  let subDeptId;
  let posId;
  let createdEmpId;

  try {
    // Limpieza preventiva previa
    await runStatements(pool, [
      "DELETE FROM dbo.HrEmployeeShifts WHERE EmployeeId IN (SELECT Id FROM dbo.HrEmployees WHERE UserId = 'temp-test-employee' OR EmployeeCode LIKE 'EMP-%');",
      "DELETE FROM dbo.HrAttendance WHERE EmployeeId IN (SELECT Id FROM dbo.HrEmployees WHERE UserId = 'temp-test-employee' OR EmployeeCode LIKE 'EMP-%');",
      "DELETE FROM dbo.HrAttendanceCorrections WHERE EmployeeId IN (SELECT Id FROM dbo.HrEmployees WHERE UserId = 'temp-test-employee' OR EmployeeCode LIKE 'EMP-%');",
      "DELETE FROM dbo.HrVacationBalances WHERE EmployeeId IN (SELECT Id FROM dbo.HrEmployees WHERE UserId = 'temp-test-employee' OR EmployeeCode LIKE 'EMP-%');",
      "DELETE FROM dbo.HrVacationRequests WHERE EmployeeId IN (SELECT Id FROM dbo.HrEmployees WHERE UserId = 'temp-test-employee' OR EmployeeCode LIKE 'EMP-%');",
      "DELETE FROM dbo.HrEmergencyContacts WHERE EmployeeId IN (SELECT Id FROM dbo.HrEmployees WHERE UserId = 'temp-test-employee' OR EmployeeCode LIKE 'EMP-%');",
      "DELETE FROM dbo.HrEmployeeDocuments WHERE EmployeeId IN (SELECT Id FROM dbo.HrEmployees WHERE UserId = 'temp-test-employee' OR EmployeeCode LIKE 'EMP-%');",
      "DELETE FROM dbo.HrLeaveRequests WHERE EmployeeId IN (SELECT Id FROM dbo.HrEmployees WHERE UserId = 'temp-test-employee' OR EmployeeCode LIKE 'EMP-%');",
      "DELETE FROM dbo.HrApprovalHistory WHERE RequestId IN (SELECT Id FROM dbo.HrApprovalRequests WHERE RequesterEmployeeId IN (SELECT Id FROM dbo.HrEmployees WHERE UserId = 'temp-test-employee' OR EmployeeCode LIKE 'EMP-%'));",
      "DELETE FROM dbo.HrApprovalRequests WHERE RequesterEmployeeId IN (SELECT Id FROM dbo.HrEmployees WHERE UserId = 'temp-test-employee' OR EmployeeCode LIKE 'EMP-%');",
      "DISABLE TRIGGER TR_HrEmployeeMovements_Immutable ON dbo.HrEmployeeMovements;",
      "DELETE FROM dbo.HrEmployeeMovements WHERE EmployeeId IN (SELECT Id FROM dbo.HrEmployees WHERE UserId = 'temp-test-employee' OR EmployeeCode LIKE 'EMP-%');",
      "ENABLE TRIGGER TR_HrEmployeeMovements_Immutable ON dbo.HrEmployeeMovements;",
      "DELETE FROM dbo.HrEmployees WHERE UserId = 'temp-test-employee' OR EmployeeCode LIKE 'EMP-%';",
      "DISABLE TRIGGER TR_AuditLogs_Immutable ON dbo.AuditLogs;",
      "DELETE FROM dbo.AuditLogs WHERE UserId = 'temp-test-employee';",
      "ENABLE TRIGGER TR_AuditLogs_Immutable ON dbo.AuditLogs;",
      "DELETE FROM dbo.HrNotifications WHERE UserId = 'temp-test-employee';",
      "DELETE FROM dbo.UserRoles WHERE UserId = 'temp-test-employee';",
      "DELETE FROM dbo.UserOrganizations WHERE UserId = 'temp-test-employee';"
    ]);

    // 1. Iniciar sesiones HTTP de prueba (Super Admin y Colaborador temporal)
    console.log('1. Autenticación y sesiones de prueba...');
    const superAdminSession = await createTestSession(pool, 'kinetix-super-admin');
    sessionsToClean.push(superAdminSession.tokenHash);

    // Asegurar usuario temporal para el colaborador
    const empRoleIdRes = await pool.request().query("SELECT Id FROM dbo.Roles WHERE Name = 'Employee';");
    const empRoleId = empRoleIdRes.recordset[0]?.Id;
    await pool.request().query(`
      IF NOT EXISTS (SELECT 1 FROM dbo.UserOrganizations WHERE UserId = 'temp-test-employee')
      BEGIN
        INSERT INTO dbo.UserOrganizations (UserId, CompanyId, FirstName, LastName, Email, PasswordHash, IsActive)
        VALUES ('temp-test-employee', 1, 'Test', 'Colaborador', 'test.colab@kinetix.local', 'hash', 1);
      END
      IF NOT EXISTS (SELECT 1 FROM dbo.UserRoles WHERE UserId = 'temp-test-employee')
      BEGIN
        INSERT INTO dbo.UserRoles (UserId, RoleId) VALUES ('temp-test-employee', ${empRoleId || 8});
      END
    `);

    const empSession = await createTestSession(pool, 'temp-test-employee');
    sessionsToClean.push(empSession.tokenHash);

    const token = superAdminSession.token;
    const adminToken = superAdminSession.token;
    const empToken = empSession.token;
    console.log('   ✓ Sesiones HTTP creadas y autorizadas.');

    // 2. Dashboard, Catálogos y Organigrama
    console.log('\n2. Pruebas de Métricas, Catálogos y Organigrama...');
    const dashRes = await api('/api/hr/dashboard', { token });
    assert.strictEqual(dashRes.status, 200, 'Dashboard debe responder 200');
    assert(dashRes.data.activeEmployees !== undefined, 'Dashboard debe tener métricas de empleados activos');
    console.log(`   ✓ Dashboard OK (Empleados activos: ${dashRes.data.activeEmployees})`);

    const catRes = await api('/api/hr/catalogs', { token });
    assert.strictEqual(catRes.status, 200);
    assert(catRes.data.ContractType && catRes.data.DocumentType, 'Catálogos deben incluir ContractType y DocumentType');
    console.log('   ✓ Catálogos globales cargados.');

    const orgRes = await api('/api/hr/org-chart', { token });
    assert.strictEqual(orgRes.status, 200);
    console.log('   ✓ Estructura de organigrama consultada exitosamente.');

    // 3. Departamentos y validación de ciclos jerárquicos
    console.log('\n3. Gestión de Departamentos y Prevención de Ciclos...');
    const deptCode = 'DEP-TEST-' + Math.floor(Math.random() * 9000 + 1000);
    const createDeptRes = await api('/api/hr/departments', {
      method: 'POST',
      token,
      body: { code: deptCode, name: 'Departamento Pruebas Automatizadas' }
    });
    assert.strictEqual(createDeptRes.status, 201, 'Debe crear departamento');
    deptId = createDeptRes.data.Id;

    // Subdepartamento
    const subDeptCode = 'SUB-' + deptCode;
    const createSubRes = await api('/api/hr/departments', {
      method: 'POST',
      token,
      body: { code: subDeptCode, name: 'Subdepartamento Pruebas', parentDepartmentId: deptId }
    });
    assert.strictEqual(createSubRes.status, 201);
    subDeptId = createSubRes.data.Id;

    // Intentar ciclo (asignar al padre como hijo de su subdepartamento)
    const cycleRes = await api(`/api/hr/departments/${deptId}`, {
      method: 'PUT',
      token,
      body: { code: deptCode, name: 'Departamento Pruebas Automatizadas', parentDepartmentId: subDeptId }
    });
    assert.strictEqual(cycleRes.status, 400, 'Debe rechazar ciclo jerárquico');
    assert(cycleRes.data.message.includes('ciclo'), 'Mensaje de ciclo detectado');
    console.log('   ✓ Detección de ciclos jerárquicos bloqueada exitosamente por la API.');

    // Validar eliminación de departamentos:
    // 1. Intentar eliminar departamento con subdepartamentos dependientes
    const delParentRes = await api(`/api/hr/departments/${deptId}`, { method: 'DELETE', token });
    assert.strictEqual(delParentRes.status, 400, 'Debe rechazar eliminación de departamento con subdepartamentos');
    assert(delParentRes.data.message.includes('subdepartamento'), 'Mensaje debe advertir sobre subdepartamentos');
    console.log('   ✓ Bloqueo de eliminación con dependencias jerárquicas verificado (400 Bad Request).');

    // 2. Crear departamento temporal sin dependencias y eliminarlo exitosamente
    const tempDeptCode = 'TMP-' + Math.floor(Math.random() * 9000 + 1000);
    const tempDeptRes = await api('/api/hr/departments', {
      method: 'POST',
      token,
      body: { code: tempDeptCode, name: 'Departamento Temporal Para Borrar' }
    });
    assert.strictEqual(tempDeptRes.status, 201);
    const tempDeptId = tempDeptRes.data.Id;

    const delTempRes = await api(`/api/hr/departments/${tempDeptId}`, { method: 'DELETE', token });
    assert.strictEqual(delTempRes.status, 200, 'Debe eliminar departamento sin dependencias');
    console.log('   ✓ Eliminación exitosa de departamento sin dependencias verificada (200 OK).');

    // 4. Cargos y validación de rangos salariales
    console.log('\n4. Gestión de Cargos y Validación de Salarios...');
    const invalidPosRes = await api('/api/hr/positions', {
      method: 'POST',
      token,
      body: {
        code: 'POS-INV-' + Math.floor(Math.random() * 9000 + 1000),
        title: 'Cargo Salario Inválido',
        departmentId: deptId,
        salaryMin: 90000,
        salaryMax: 40000 // Min > Max
      }
    });
    assert.strictEqual(invalidPosRes.status, 400, 'Debe rechazar salario mínimo mayor que máximo');
    console.log('   ✓ Validación de escala salarial (mínimo <= máximo) cumplida.');

    const posCode = 'POS-' + Math.floor(Math.random() * 9000 + 1000);
    const validPosRes = await api('/api/hr/positions', {
      method: 'POST',
      token,
      body: {
        code: posCode,
        title: 'Especialista en Pruebas QA',
        departmentId: deptId,
        salaryMin: 45000,
        salaryMax: 65000
      }
    });
    assert.strictEqual(validPosRes.status, 201);
    posId = validPosRes.data.Id;
    console.log(`   ✓ Cargo creado exitosamente (#${posId}: ${validPosRes.data.Title}).`);

    // Validar eliminación de cargos:
    // 1. Crear cargo temporal sin empleados y eliminarlo exitosamente
    const tempPosCode = 'POS-TMP-' + Math.floor(Math.random() * 9000 + 1000);
    const tempPosRes = await api('/api/hr/positions', {
      method: 'POST',
      token,
      body: {
        code: tempPosCode,
        title: 'Cargo Temporal Para Borrar',
        departmentId: deptId,
        salaryMin: 30000,
        salaryMax: 40000
      }
    });
    assert.strictEqual(tempPosRes.status, 201);
    const tempPosId = tempPosRes.data.Id;

    const delTempPosRes = await api(`/api/hr/positions/${tempPosId}`, { method: 'DELETE', token });
    assert.strictEqual(delTempPosRes.status, 200, 'Debe eliminar cargo sin dependencias');
    console.log('   ✓ Eliminación exitosa de cargo sin colaboradores verificada (200 OK).');

function generateRandomCedula() {
  const prefix = '402';
  const middle = String(Math.floor(Math.random() * 9000000 + 1000000));
  const base = prefix + middle;
  const weights = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    const digit = parseInt(base[i], 10);
    let product = digit * weights[i];
    if (product >= 10) {
      product = Math.floor(product / 10) + (product % 10);
    }
    sum += product;
  }
  const verifier = (10 - (sum % 10)) % 10;
  return `${prefix}-${middle}-${verifier}`;
}

    // 5. Empleados: Creación, Consulta, Ficha PDF y Movimiento Laboral
    console.log('\n5. Expedientes de Empleados, Ficha PDF y Movimientos...');
    const empCedula = generateRandomCedula();
    const empCode = 'EMP-' + Math.floor(Math.random() * 90000 + 10000);
    const newEmpRes = await api('/api/hr/employees', {
      method: 'POST',
      token,
      body: {
        employeeCode: empCode,
        firstName: 'Laura',
        lastName: 'Contreras',
        documentType: 'Cedula',
        documentNumber: empCedula,
        email: `laura.${empCode.toLowerCase()}@empresa.com`,
        phone: '809-555-8899',
        departmentId: deptId,
        positionId: posId,
        hireDate: '2025-01-15',
        baseSalary: 55000,
        salaryCurrency: 'DOP',
        payFrequency: 'Mensual'
      }
    });
    assert.strictEqual(newEmpRes.status, 201, 'Debe crear empleado');
    createdEmpId = newEmpRes.data.Id;
    console.log(`   ✓ Empleado creado exitosamente: ${newEmpRes.data.FirstName} ${newEmpRes.data.LastName} (${empCode}).`);

    // 2. Intentar eliminar cargo con colaborador asignado (debe bloquearse)
    const delPosWithEmp = await api(`/api/hr/positions/${posId}`, { method: 'DELETE', token });
    assert.strictEqual(delPosWithEmp.status, 400, 'Debe rechazar eliminación de cargo con colaboradores');
    assert(delPosWithEmp.data.message.includes('colaborador'), 'Mensaje debe advertir sobre colaboradores asignados');
    console.log('   ✓ Bloqueo de eliminación de cargo con dependencias verificado (400 Bad Request).');

    // Vincular empleado al usuario colaborador y asignar turno y saldo de vacaciones
    await pool.request()
      .input('uid', 'temp-test-employee')
      .input('eid', createdEmpId)
      .query('UPDATE dbo.HrEmployees SET UserId = @uid WHERE Id = @eid;');

    const shiftRes = await pool.request().query('SELECT TOP 1 Id FROM dbo.HrWorkShifts WHERE IsActive = 1;');
    const shiftId = shiftRes.recordset[0]?.Id;
    if (shiftId) {
      await pool.request().query(`
        INSERT INTO dbo.HrEmployeeShifts (EmployeeId, ShiftId, EffectiveDate)
        VALUES (${createdEmpId}, ${shiftId}, '2026-01-01');
      `);
    }

    await pool.request().query(`
      INSERT INTO dbo.HrVacationBalances (EmployeeId, PeriodYear, DaysEarned, DaysUsed, DaysPending)
      VALUES (${createdEmpId}, 2026, 14, 0, 0);
    `);

    // Descarga de Ficha PDF
    const pdfRes = await api(`/api/hr/employees/${createdEmpId}/pdf`, { token });
    assert.strictEqual(pdfRes.status, 200);
    assert(pdfRes.headers.get('content-type').includes('application/pdf'), 'Debe retornar content-type PDF');
    console.log('   ✓ Ficha PDF generada y transmitida correctamente.');

    // Movimiento laboral: Ajuste salarial
    const salRes = await api(`/api/hr/employees/${createdEmpId}/salary`, {
      method: 'POST',
      token,
      body: { toSalary: 62000, reason: 'Ajuste salarial por desempeño sobresaliente' }
    });
    assert.strictEqual(salRes.status, 200);
    console.log(`   ✓ Ajuste salarial registrado: nuevo salario DOP 62,000.`);

    // Historial de movimientos
    const histRes = await api(`/api/hr/employees/${createdEmpId}/history`, { token });
    assert.strictEqual(histRes.status, 200);
    assert(histRes.data.length >= 1, 'Debe tener al menos un movimiento registrado');
    console.log(`   ✓ Historial de movimientos auditado (${histRes.data.length} movimiento(s)).`);

    // 6. Terminal Digital de Asistencia (Ponche de Entrada y Salida)
    console.log('\n6. Terminal de Asistencia y Solicitud de Corrección...');
    const todayAttRes = await api('/api/hr/attendance/today', { token: empToken });
    assert.strictEqual(todayAttRes.status, 200);
    assert(todayAttRes.data.linked === true, 'El usuario colaborador está vinculado a un empleado');
    console.log(`   ✓ Estado de hoy consultado (Vinculado: ${todayAttRes.data.linked}, Turno: ${todayAttRes.data.shift?.Name}).`);

    // Ponche de entrada
    const punchInRes = await api('/api/hr/attendance/check-in', {
      method: 'POST',
      token: empToken,
      body: { notes: 'Entrada desde terminal web' }
    });
    assert(punchInRes.status === 201 || punchInRes.status === 200 || punchInRes.status === 409, 'Check-in debe ser 201, 200 o 409 si ya marcó hoy');
    console.log(`   ✓ Ponche de entrada: ${punchInRes.status === 201 || punchInRes.status === 200 ? 'Registrado con éxito' : 'Ya existía ponche de entrada hoy (409 manejado correctamente)'}.`);

    // Intentar segundo check-in
    const dupCheckIn = await api('/api/hr/attendance/check-in', { method: 'POST', token: empToken });
    assert.strictEqual(dupCheckIn.status, 409, 'Segundo check-in debe dar 409 Conflict');
    console.log('   ✓ Bloqueo de doble entrada duplicada verificado (409 Conflict).');

    // Ponche de salida
    const punchOutRes = await api('/api/hr/attendance/check-out', {
      method: 'POST',
      token: empToken,
      body: { notes: 'Salida de jornada' }
    });
    assert(punchOutRes.status === 200 || punchOutRes.status === 409, 'Check-out debe ser 200 o 409');
    console.log(`   ✓ Ponche de salida: ${punchOutRes.status === 200 ? 'Registrado con éxito' : 'Ya existía ponche de salida hoy (409 manejado correctamente)'}.`);

    // Solicitud de corrección de ponche
    await pool.request().query(`DELETE FROM dbo.HrAttendanceCorrections WHERE EmployeeId = ${createdEmpId} AND WorkDate = '2026-10-05';`);
    await pool.request().query(`DELETE FROM dbo.HrApprovalHistory WHERE RequestId IN (SELECT Id FROM dbo.HrApprovalRequests WHERE EntityName = N'HrAttendanceCorrections' AND RequesterEmployeeId = ${createdEmpId});`);
    await pool.request().query(`DELETE FROM dbo.HrApprovalRequests WHERE EntityName = N'HrAttendanceCorrections' AND RequesterEmployeeId = ${createdEmpId};`);

    const corrRes = await api('/api/hr/attendance/corrections', {
      method: 'POST',
      token: empToken,
      body: {
        attendanceDate: '2026-10-05',
        requestedCheckIn: '2026-10-05T08:00:00',
        requestedCheckOut: '2026-10-05T17:00:00',
        reason: 'Olvido de marcación en lector biométrico'
      }
    });
    assert.strictEqual(corrRes.status, 201, 'Debe registrar solicitud de corrección');
    const corrRequestId = corrRes.data.correction?.Id;
    console.log(`   ✓ Solicitud de corrección enviada a flujo de aprobación (#${corrRequestId}).`);

    // 7. Vacaciones: Saldo, Solicitud y Validación de Solapamiento
    console.log('\n7. Vacaciones (Art. 177) y Validación de Solapamiento...');
    await pool.request().query(`UPDATE dbo.HrVacationBalances SET DaysPending = 0, DaysUsed = 0 WHERE EmployeeId = ${createdEmpId};`);

    const vacBalRes = await api('/api/hr/vacations/balance', { token: empToken });
    assert.strictEqual(vacBalRes.status, 200);
    assert(vacBalRes.data.DaysAvailable !== undefined, 'Debe retornar DaysAvailable');
    console.log(`   ✓ Saldo de vacaciones consultado (${vacBalRes.data.DaysAvailable} días disponibles).`);

    // Solicitud de vacaciones
    // Clean old vacation requests for this employee if any
    await pool.request().query(`DELETE FROM dbo.HrApprovalHistory WHERE RequestId IN (SELECT Id FROM dbo.HrApprovalRequests WHERE EntityName = N'HrVacationRequests' AND RequesterEmployeeId = ${createdEmpId});`);
    await pool.request().query(`DELETE FROM dbo.HrVacationRequests WHERE EmployeeId = ${createdEmpId};`);
    await pool.request().query(`DELETE FROM dbo.HrApprovalRequests WHERE EntityName = N'HrVacationRequests' AND RequesterEmployeeId = ${createdEmpId};`);

    const vacReqRes = await api('/api/hr/vacations/request', {
      method: 'POST',
      token: empToken,
      body: {
        startDate: '2026-10-19',
        endDate: '2026-10-23',
        daysRequested: 5,
        reason: 'Descanso programado anual'
      }
    });
    assert.strictEqual(vacReqRes.status, 201, 'Debe registrar solicitud de vacaciones');
    const vacationId = vacReqRes.data.request.Id;
    console.log(`   ✓ Solicitud de vacaciones registrada (#${vacationId}) del 2026-10-19 al 2026-10-23 (5 días).`);

    // Intentar solicitar vacaciones solapadas
    const overlapRes = await api('/api/hr/vacations/request', {
      method: 'POST',
      token: empToken,
      body: {
        startDate: '2026-10-21',
        endDate: '2026-10-22',
        daysRequested: 2,
        reason: 'Intento solapado'
      }
    });
    assert.strictEqual(overlapRes.status, 409, 'Debe rechazar solicitud con fechas solapadas');
    console.log('   ✓ Rechazo estricto de solicitudes solapadas verificado (409 Conflict).');

    // Calendario de ausencias
    const calRes = await api('/api/hr/vacations/calendar?year=2026&month=10', { token: empToken });
    assert.strictEqual(calRes.status, 200);
    assert(Array.isArray(calRes.data), 'El calendario debe ser un arreglo unificado de eventos');
    console.log(`   ✓ Calendario consultado (${calRes.data.length} eventos en octubre 2026).`);

    // 8. Licencias y Permisos
    console.log('\n8. Licencias Especiales y Catálogo de Permisos...');
    const leaveTypesRes = await api('/api/hr/leaves/types', { token: empToken });
    assert.strictEqual(leaveTypesRes.status, 200);
    assert(leaveTypesRes.data.length > 0, 'Debe haber tipos de licencias');
    const marriageLeave = leaveTypesRes.data.find(t => t.Code === 'LIC-MATR') || leaveTypesRes.data[0];

    // Clean old leave requests for this employee if any
    await pool.request().query(`DELETE FROM dbo.HrApprovalHistory WHERE RequestId IN (SELECT Id FROM dbo.HrApprovalRequests WHERE EntityName = N'HrLeaveRequests' AND RequesterEmployeeId = ${createdEmpId});`);
    await pool.request().query(`DELETE FROM dbo.HrLeaveRequests WHERE EmployeeId = ${createdEmpId};`);
    await pool.request().query(`DELETE FROM dbo.HrApprovalRequests WHERE EntityName = N'HrLeaveRequests' AND RequesterEmployeeId = ${createdEmpId};`);

    const leaveReqRes = await api('/api/hr/leaves/request', {
      method: 'POST',
      token: empToken,
      body: {
        leaveTypeId: marriageLeave.Id,
        startDate: '2026-10-26',
        endDate: '2026-10-28',
        duration: 3,
        reason: 'Licencia por Matrimonio (Art. 54 Código de Trabajo)'
      }
    });
    assert.strictEqual(leaveReqRes.status, 201);
    const leaveReqId = leaveReqRes.data.request.Id;
    console.log(`   ✓ Solicitud de licencia registrada (#${leaveReqId}: ${marriageLeave.Name}).`);

    // 9. Bandeja de Aprobaciones: Prevención de Auto-Aprobación y Aprobación
    console.log('\n9. Flujos de Aprobación Multietapa y Reglas de Seguridad...');
    const pendingRes = await api('/api/hr/approvals/pending', { token });
    assert.strictEqual(pendingRes.status, 200);
    assert(Array.isArray(pendingRes.data), 'Pendientes debe retornar un arreglo');
    console.log(`   ✓ Solicitudes pendientes consultadas: ${pendingRes.data.length}`);

    // Buscar una solicitud creada por el usuario (e.g. la de vacaciones)
    const myApprovalReq = pendingRes.data.find(p => p.EntityName === 'HrVacationRequests' && p.EntityId === vacationId);
    if (myApprovalReq) {
      // Intentar auto-aprobar (debe estar bloqueado para no-super-admin)
      const selfApproveRes = await api(`/api/hr/approvals/${myApprovalReq.Id}/action`, {
        method: 'POST',
        token: empToken,
        body: { action: 'Aprobado', comments: 'Auto-aprobación' }
      });
      assert.strictEqual(selfApproveRes.status, 403, 'No puede auto-aprobar su propia solicitud');
      console.log('   ✓ Bloqueo de auto-aprobación verificado (403 Forbidden).');

      // Aprobar como Super Admin
      const adminApprove1 = await api(`/api/hr/approvals/${myApprovalReq.Id}/action`, {
        method: 'POST',
        token: adminToken,
        body: { action: 'Aprobado', comments: 'Visto Bueno de Supervisor' }
      });
      assert.strictEqual(adminApprove1.status, 200);
      console.log(`   ✓ Paso 1 aprobado por Super Admin.`);

      if (!adminApprove1.data.isCompleted) {
        const adminApprove2 = await api(`/api/hr/approvals/${myApprovalReq.Id}/action`, {
          method: 'POST',
          token: adminToken,
          body: { action: 'Aprobado', comments: 'Aprobación Final de RRHH' }
        });
        assert.strictEqual(adminApprove2.status, 200);
        assert.strictEqual(adminApprove2.data.isCompleted, true);
        console.log(`   ✓ Paso 2 aprobado y solicitud completada.`);
      }
    }

    // 10. Notificaciones Internas In-App
    console.log('\n10. Sistema de Notificaciones Internas...');
    const unreadRes = await api('/api/hr/notifications/unread-count', { token: adminToken });
    assert.strictEqual(unreadRes.status, 200);
    console.log(`   ✓ Contador de no leídas para admin: ${unreadRes.data.unreadCount}`);

    const notifsRes = await api('/api/hr/notifications', { token: adminToken });
    assert.strictEqual(notifsRes.status, 200);
    assert(notifsRes.data.data.length > 0, 'Debe haber notificaciones generadas');
    const firstNotif = notifsRes.data.data[0];

    // Marcar como leída
    const markReadRes = await api(`/api/hr/notifications/${firstNotif.Id}/read`, {
      method: 'PATCH',
      token: adminToken
    });
    assert.strictEqual(markReadRes.status, 200);
    console.log(`   ✓ Notificación #${firstNotif.Id} marcada como leída.`);

    // Marcar notificación inexistente debe dar 404
    const notFoundNotif = await api('/api/hr/notifications/99999999/read', {
      method: 'PATCH',
      token: adminToken
    });
    assert.strictEqual(notFoundNotif.status, 404, 'Notificación inexistente debe retornar 404');
    console.log('   ✓ Manejo de 404 para notificación inexistente verificado.');

    // 11. Limpieza de datos temporales
    console.log('\n11. Limpieza y archivo de datos de prueba...');
    if (createdEmpId) {
      await runStatements(pool, [
        `UPDATE dbo.HrEmployees SET UserId = NULL WHERE Id = ${createdEmpId};`,
        `DELETE FROM dbo.HrEmployeeShifts WHERE EmployeeId = ${createdEmpId};`,
        `DELETE FROM dbo.HrAttendance WHERE EmployeeId = ${createdEmpId};`,
        `DELETE FROM dbo.HrAttendanceCorrections WHERE EmployeeId = ${createdEmpId};`,
        `DELETE FROM dbo.HrVacationBalances WHERE EmployeeId = ${createdEmpId};`,
        `DELETE FROM dbo.HrVacationRequests WHERE EmployeeId = ${createdEmpId};`,
        `DELETE FROM dbo.HrEmergencyContacts WHERE EmployeeId = ${createdEmpId};`,
        `DELETE FROM dbo.HrEmployeeDocuments WHERE EmployeeId = ${createdEmpId};`,
        `DELETE FROM dbo.HrLeaveRequests WHERE EmployeeId = ${createdEmpId};`,
        `DELETE FROM dbo.HrApprovalHistory WHERE RequestId IN (SELECT Id FROM dbo.HrApprovalRequests WHERE RequesterEmployeeId = ${createdEmpId});`,
        `DELETE FROM dbo.HrApprovalRequests WHERE RequesterEmployeeId = ${createdEmpId};`,
        'DISABLE TRIGGER TR_HrEmployeeMovements_Immutable ON dbo.HrEmployeeMovements;',
        `DELETE FROM dbo.HrEmployeeMovements WHERE EmployeeId = ${createdEmpId};`,
        'ENABLE TRIGGER TR_HrEmployeeMovements_Immutable ON dbo.HrEmployeeMovements;',
        `DELETE FROM dbo.HrEmployees WHERE Id = ${createdEmpId};`
      ]);
    }
    if (posId) {
      await pool.request().query(`DELETE FROM dbo.HrPositions WHERE Id = ${posId};`);
    }
    if (subDeptId || deptId) {
      await pool.request().query(`DELETE FROM dbo.HrDepartments WHERE Id IN (${subDeptId || 0}, ${deptId || 0});`);
    }
    await pool.request().query("DELETE FROM dbo.HrAttendanceCorrections WHERE Reason = N'Olvido de marcación en lector biométrico';");
    console.log('   ✓ Registros temporales eliminados.');

    console.log('\n===============================================================');
    console.log('✨ TODAS LAS PRUEBAS DE USO DE RRHH PASARON EXITOSAMENTE (100%)');
    console.log('===============================================================\n');
  } finally {
    // Clean up test sessions
    for (const hash of sessionsToClean) {
      try {
        await pool.request().input('h', hash).query('DELETE FROM dbo.UserSessions WHERE TokenHash = @h;');
      } catch {}
    }
    // Clean up temporary test user
    try {
      await runStatements(pool, [
        'DISABLE TRIGGER TR_AuditLogs_Immutable ON dbo.AuditLogs;',
        "DELETE FROM dbo.AuditLogs WHERE UserId = 'temp-test-employee';",
        'ENABLE TRIGGER TR_AuditLogs_Immutable ON dbo.AuditLogs;',
        "DELETE FROM dbo.HrNotifications WHERE UserId = 'temp-test-employee';",
        "DELETE FROM dbo.UserRoles WHERE UserId = 'temp-test-employee';",
        "DELETE FROM dbo.UserOrganizations WHERE UserId = 'temp-test-employee';"
      ]);
    } catch {}
    await pool.close();
  }
}

main().catch(err => {
  console.error('\n❌ ERROR EN PRUEBAS DE USO:', err);
  process.exit(1);
});
