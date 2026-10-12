import 'dotenv/config';
import sql from 'mssql/msnodesqlv8.js';
import assert from 'node:assert';
import { validateDominicanCedula, validateDocument } from '../server/modules/hr/validators.js';
import { generateNextEmployeeCode } from '../server/modules/hr/repositories/catalogs.repo.js';
import { checkDepartmentCycle } from '../server/modules/hr/repositories/departments.repo.js';
import { sanitizeEmployee } from '../server/modules/hr/repositories/employees.repo.js';

async function runTests() {
  console.log('=== INICIANDO PRUEBAS AUTOMATIZADAS: RRHH FASE 1 ===\n');

  // TEST 1: Cédula dominicana (Luhn / Módulo 10)
  console.log('1. Probando algoritmo de validación de Cédula Dominicana...');
  const validCedula = '402-0000001-2';
  const invalidCedula = '402-0000001-9';

  assert.strictEqual(validateDominicanCedula(validCedula), true, 'Debe ser válida');
  assert.strictEqual(validateDominicanCedula(invalidCedula), false, 'Debe ser inválida por dígito verificador');
  assert.strictEqual(validateDominicanCedula('123'), false, 'Debe ser inválida por longitud');
  assert.strictEqual(validateDocument('Pasaporte', 'RD1234567').valid, true, 'Pasaporte debe ser válido');
  console.log('   ✓ Validación de Cédula (Luhn) y Pasaportes pasó exitosamente.');

  // Connect to DB for remaining tests
  const server = process.env.DB_SERVER || '(localdb)\\MSSQLLocalDB';
  const database = process.env.DB_DATABASE || 'KinetixCore';
  const pool = await sql.connect({
    server, database, driver: 'msnodesqlv8',
    connectionString: `Driver={ODBC Driver 18 for SQL Server};Server=${server};Database=${database};Trusted_Connection=Yes;Encrypt=No;TrustServerCertificate=Yes;`,
    options: { trustedConnection: true, trustServerCertificate: true }
  });

  try {
    // TEST 2: Inmutabilidad de AuditLogs (Trigger TR_AuditLogs_Immutable)
    console.log('\n2. Probando inmutabilidad física en dbo.AuditLogs (Trigger)...');
    const compRes = await pool.request().query('SELECT TOP 1 Id FROM dbo.Companies');
    const companyId = compRes.recordset[0]?.Id;
    assert(companyId, 'Debe existir al menos una empresa');

    // Insert test audit record
    const insRes = await pool.request()
      .input('companyId', sql.Int, companyId)
      .input('action', sql.NVarChar, 'CREATE')
      .input('module', sql.NVarChar, 'RRHH Configuración')
      .input('entity', sql.NVarChar, 'TestEntity')
      .input('entityId', sql.NVarChar, 'TEST-123')
      .query(`
        INSERT INTO dbo.AuditLogs (CompanyId, ActionName, ModuleName, EntityName, EntityId, CreatedAt)
        OUTPUT INSERTED.Id
        VALUES (@companyId, @action, @module, @entity, @entityId, GETUTCDATE())
      `);
    const testAuditId = insRes.recordset[0].Id;

    // Try to UPDATE audit record - should fail
    let updateFailed = false;
    try {
      await pool.request()
        .input('id', sql.Int, testAuditId)
        .query("UPDATE dbo.AuditLogs SET ActionName = 'UPDATE' WHERE Id = @id");
    } catch (err) {
      updateFailed = true;
      assert(err.message.includes('inmutables') || err.message.includes('TRIGGER'), 'Error esperado de inmutabilidad');
    }
    assert.strictEqual(updateFailed, true, 'UPDATE en dbo.AuditLogs debe ser bloqueado por el trigger');

    // Try to DELETE audit record - should fail
    let deleteFailed = false;
    try {
      await pool.request()
        .input('id', sql.Int, testAuditId)
        .query('DELETE FROM dbo.AuditLogs WHERE Id = @id');
    } catch (err) {
      deleteFailed = true;
      assert(err.message.includes('inmutables') || err.message.includes('TRIGGER'), 'Error esperado de inmutabilidad');
    }
    assert.strictEqual(deleteFailed, true, 'DELETE en dbo.AuditLogs debe ser bloqueado por el trigger');
    console.log('   ✓ Inmutabilidad de auditoría confirmada (UPDATE y DELETE estrictamente bloqueados por el trigger).');

    // TEST 3: Generación correlativa y atómica de Códigos de Empleado
    console.log('\n3. Probando generación correlativa de código de empleado...');
    const code1 = await generateNextEmployeeCode(pool, companyId);
    console.log(`   Código generado: ${code1}`);
    assert(/^EMP-\d{5}$/.test(code1), 'El formato debe ser EMP-XXXXX');
    console.log('   ✓ Código de empleado generado con formato estándar.');

    // TEST 4: Detección y prevención de ciclos jerárquicos en Departamentos
    console.log('\n4. Probando prevención de ciclos en departamentos...');
    // Create dept A
    const deptARes = await pool.request()
      .input('companyId', sql.Int, companyId)
      .input('code', sql.NVarChar, 'TEST-D1')
      .input('name', sql.NVarChar, 'Dpto Raiz Test')
      .query(`
        INSERT INTO dbo.HrDepartments (CompanyId, Code, Name, IsActive, CreatedAt)
        OUTPUT INSERTED.Id
        VALUES (@companyId, @code, @name, 1, GETUTCDATE())
      `);
    const deptAId = deptARes.recordset[0].Id;

    // Create dept B child of A
    const deptBRes = await pool.request()
      .input('companyId', sql.Int, companyId)
      .input('code', sql.NVarChar, 'TEST-D2')
      .input('name', sql.NVarChar, 'Dpto Hijo Test')
      .input('parent', sql.Int, deptAId)
      .query(`
        INSERT INTO dbo.HrDepartments (CompanyId, Code, Name, ParentDepartmentId, IsActive, CreatedAt)
        OUTPUT INSERTED.Id
        VALUES (@companyId, @code, @name, @parent, 1, GETUTCDATE())
      `);
    const deptBId = deptBRes.recordset[0].Id;

    // Check cycle: setting dept A's parent to dept B (A -> B -> A)
    const hasCycle = await checkDepartmentCycle(pool, deptAId, deptBId);
    assert.strictEqual(hasCycle, true, 'Debe detectar el ciclo jerárquico');

    // Check self-parent (A -> A)
    const selfCycle = await checkDepartmentCycle(pool, deptAId, deptAId);
    assert.strictEqual(selfCycle, true, 'Debe detectar el ciclo consigo mismo');
    console.log('   ✓ Prevención de ciclos jerárquicos (árbol acíclico) verificada correctamente.');

    // Cleanup test departments
    await pool.request().query(`DELETE FROM dbo.HrDepartments WHERE Id IN (${deptAId}, ${deptBId})`);

    // TEST 5: Sanitización de datos sensibles y salarios según permisos
    console.log('\n5. Probando ofuscación y protección de datos sensibles y salarios...');
    const rawEmployee = {
      Id: 9999,
      FirstName: 'Juan',
      LastName: 'Pérez',
      DocumentNumber: '402-0000001-2',
      Phone: '809-555-1234',
      Address: 'Av. Winston Churchill 100, Santo Domingo',
      BirthDate: '1990-05-15',
      BaseSalary: 75000.00,
      SalaryCurrency: 'DOP',
      PayFrequency: 'Mensual'
    };

    // User without salary or sensitive permissions
    const sanitizedGuest = sanitizeEmployee(rawEmployee, {
      canViewSensitive: false,
      canViewSalary: false
    });
    assert.strictEqual(sanitizedGuest.BaseSalary, undefined, 'Salario debe ser eliminado');
    assert.strictEqual(sanitizedGuest.SalaryCurrency, undefined, 'Moneda salarial debe ser eliminada');
    assert(sanitizedGuest.Phone.includes('***'), 'Teléfono debe estar enmascarado');
    assert.strictEqual(sanitizedGuest.Address, undefined, 'Dirección debe ser eliminada');
    assert.strictEqual(sanitizedGuest.BirthDate, undefined, 'Fecha de nacimiento debe ser eliminada');
    assert(sanitizedGuest.DocumentNumber.includes('***'), 'Documento debe estar enmascarado');

    // User with salary but no sensitive data
    const sanitizedPayroll = sanitizeEmployee(rawEmployee, {
      canViewSensitive: false,
      canViewSalary: true
    });
    assert.strictEqual(sanitizedPayroll.BaseSalary, 75000.00, 'Salario debe estar presente');
    assert(sanitizedPayroll.DocumentNumber.includes('***'), 'Documento debe seguir enmascarado');

    // User with all permissions (HR Director / Admin)
    const fullAccess = sanitizeEmployee(rawEmployee, {
      canViewSensitive: true,
      canViewSalary: true
    });
    assert.strictEqual(fullAccess.BaseSalary, 75000.00, 'Salario completo');
    assert.strictEqual(fullAccess.DocumentNumber, '402-0000001-2', 'Documento completo');
    assert.strictEqual(fullAccess.Phone, '809-555-1234', 'Teléfono completo');
    console.log('   ✓ Reglas de privacidad y enmascaramiento salarial y documental verificadas.');

    console.log('\n======================================================');
    console.log('TODAS LAS PRUEBAS DE LA FASE 1 COMPLETADAS CON ÉXITO.');
    console.log('======================================================\n');
  } finally {
    await pool.close();
  }
}

runTests().catch(err => {
  console.error('\n❌ ERROR EN PRUEBAS:', err);
  process.exit(1);
});
