import 'dotenv/config';

const BASE_URL = 'http://localhost:3000';

async function runRolesTests() {
  console.log('=== INICIANDO PRUEBAS DE GESTIÓN DE ROLES Y PERMISOS ===\n');

  // 1. Iniciar sesión con el usuario superadmin
  console.log('1. Autenticando con superadmin@kinetix.local...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'superadmin@kinetix.local',
      password: 'Admin12345!'
    })
  });

  if (!loginRes.ok) {
    throw new Error(`Fallo en login de admin: ${loginRes.status} ${await loginRes.text()}`);
  }

  const setCookie = loginRes.headers.get('set-cookie');
  if (!setCookie) throw new Error('No se recibió cookie de sesión.');
  const sessionCookie = setCookie.split(';')[0];
  console.log('✓ Sesión de Administrador iniciada correctamente.');

  const authHeaders = {
    'Cookie': sessionCookie,
    'Content-Type': 'application/json'
  };

  // 2. Obtener lista de roles y verificar roles del sistema
  console.log('\n2. Consultando lista de roles...');
  const rolesRes = await fetch(`${BASE_URL}/api/roles`, { headers: authHeaders });
  if (!rolesRes.ok) throw new Error(`Fallo al consultar roles: ${rolesRes.status}`);
  const roles = await rolesRes.json();
  console.log(`✓ Roles recibidos (${roles.length}):`, roles.map(r => `${r.name} (${r.type}, isSystem=${r.isSystem})`).join(', '));

  const systemRoleNames = [
    'Super Admin', 'Company Admin', 'Director de RRHH', 'Analista de RRHH',
    'Encargado de Nómina', 'Supervisor', 'Manager', 'Employee'
  ];

  for (const sName of systemRoleNames) {
    const found = roles.find(r => r.name === sName);
    if (!found) throw new Error(`Rol del sistema faltante: ${sName}`);
    if (found.type !== 'Sistema' || !found.isSystem) {
      throw new Error(`El rol ${sName} no está marcado como Sistema: ${JSON.stringify(found)}`);
    }
  }
  console.log('✓ Todos los roles esenciales del sistema están configurados y protegidos.');

  // 3. Probar intento de eliminación de un rol del sistema (debe ser rechazado con 403)
  console.log('\n3. Verificando protección contra eliminación de roles del sistema...');
  const directorRrhh = roles.find(r => r.name === 'Director de RRHH');
  const deleteSystemRes = await fetch(`${BASE_URL}/api/roles/${directorRrhh.id}`, {
    method: 'DELETE',
    headers: authHeaders
  });

  if (deleteSystemRes.status !== 403) {
    throw new Error(`Se esperaba 403 Forbidden al intentar borrar un rol del sistema, pero se recibió: ${deleteSystemRes.status}`);
  }
  const deleteSystemErr = await deleteSystemRes.json();
  console.log(`✓ Bloqueo exitoso de eliminación: "${deleteSystemErr.message}"`);

  // 4. Probar intento de renombrar un rol del sistema (debe ser rechazado con 400)
  console.log('\n4. Verificando protección contra renombrado de roles del sistema...');
  const renameSystemRes = await fetch(`${BASE_URL}/api/roles/${directorRrhh.id}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Director de Personal Renombrado'
    })
  });

  if (renameSystemRes.status !== 400) {
    throw new Error(`Se esperaba 400 Bad Request al intentar renombrar rol del sistema, pero se recibió: ${renameSystemRes.status}`);
  }
  const renameSystemErr = await renameSystemRes.json();
  console.log(`✓ Bloqueo exitoso de renombrado: "${renameSystemErr.message}"`);

  // 5. Consultar catálogo de permisos disponibles para selección
  console.log('\n5. Consultando funciones/permisos del sistema disponibles...');
  const permsRes = await fetch(`${BASE_URL}/api/permissions`, { headers: authHeaders });
  if (!permsRes.ok) throw new Error('Fallo al consultar permisos.');
  const perms = await permsRes.json();
  console.log(`✓ Catálogo de funciones cargado (${perms.length} permisos del sistema disponibles).`);

  // Seleccionar 4 permisos de prueba (ej. módulos Inventario y Existencias)
  const testPermissions = perms.slice(0, 5).map(p => p.id);

  // 6. Crear nuevo rol personalizado con funciones seleccionadas
  console.log('\n6. Creando rol personalizado dinámico con funciones seleccionadas...');
  const createRes = await fetch(`${BASE_URL}/api/roles`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Coordinador de Logística y Despacho',
      description: 'Responsable de control de inventario y recepción física',
      permissionIds: testPermissions
    })
  });

  if (createRes.status !== 201) {
    throw new Error(`Fallo al crear rol: ${createRes.status} ${await createRes.text()}`);
  }
  const createdRole = await createRes.json();
  console.log(`✓ Rol creado exitosamente con ID ${createdRole.id}:`, createdRole);

  if (createdRole.type !== 'Personalizado' || createdRole.isSystem) {
    throw new Error('El rol creado dinámicamente debe ser tipo Personalizado.');
  }

  // 7. Verificar que las funciones seleccionadas se asignaron correctamente
  console.log('\n7. Verificando funciones asignadas al nuevo rol...');
  const getRolePermsRes = await fetch(`${BASE_URL}/api/roles/${createdRole.id}/permissions`, {
    headers: authHeaders
  });
  const assignedPerms = await getRolePermsRes.json();
  console.log(`✓ Permisos asignados (${assignedPerms.length}):`, assignedPerms);
  if (JSON.stringify(assignedPerms.sort()) !== JSON.stringify(testPermissions.sort())) {
    throw new Error('Los permisos asignados no coinciden con los seleccionados.');
  }

  // 8. Editar el rol personalizado (modificar nombre, descripción y agregar otra función)
  console.log('\n8. Editando rol personalizado (nombre, descripción y funciones)...');
  const updatedPerms = [...testPermissions, perms[10].id];
  const updateRes = await fetch(`${BASE_URL}/api/roles/${createdRole.id}`, {
    method: 'PUT',
    headers: authHeaders,
    body: JSON.stringify({
      name: 'Coordinador General de Logística',
      description: 'Alcance ampliado con permisos adicionales de supervisión',
      permissionIds: updatedPerms
    })
  });

  if (!updateRes.ok) throw new Error(`Fallo al actualizar rol: ${updateRes.status} ${await updateRes.text()}`);
  const updatedRole = await updateRes.json();
  console.log('✓ Rol actualizado correctamente:', updatedRole);

  const getUpdatedPermsRes = await fetch(`${BASE_URL}/api/roles/${createdRole.id}/permissions`, {
    headers: authHeaders
  });
  const reAssignedPerms = await getUpdatedPermsRes.json();
  if (reAssignedPerms.length !== updatedPerms.length) {
    throw new Error('No se actualizaron correctamente los permisos del rol.');
  }
  console.log(`✓ Funciones actualizadas confirmadas (${reAssignedPerms.length} asignadas).`);

  // 9. Eliminar el rol personalizado
  console.log('\n9. Eliminando el rol personalizado...');
  const deleteRes = await fetch(`${BASE_URL}/api/roles/${createdRole.id}`, {
    method: 'DELETE',
    headers: authHeaders
  });

  if (!deleteRes.ok) throw new Error(`Fallo al eliminar rol: ${deleteRes.status} ${await deleteRes.text()}`);
  const deleteResult = await deleteRes.json();
  console.log('✓ Eliminación confirmada:', deleteResult.message);

  // 10. Confirmar que ya no existe en la lista de roles
  const finalRolesRes = await fetch(`${BASE_URL}/api/roles`, { headers: authHeaders });
  const finalRoles = await finalRolesRes.json();
  if (finalRoles.some(r => r.id === createdRole.id)) {
    throw new Error('El rol aún figura en la base de datos tras ser eliminado.');
  }
  console.log('✓ El rol ya no existe en la base de datos.');

  console.log('\n=== TODAS LAS PRUEBAS DE ROLES Y PERMISOS PASARON AL 100% ===');
}

runRolesTests().catch(err => {
  console.error('ERROR EN PRUEBAS:', err);
  process.exit(1);
});
