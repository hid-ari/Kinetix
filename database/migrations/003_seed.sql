/*
  Kinetix — Datos base y siembra integral (migración 003)
  Roles, permisos, catálogos globales, organización principal (Kinetix),
  sucursales, usuarios, estructura de RRHH, inventario y finanzas.
*/

/* ── 1. Roles del Sistema ─────────────────────────────────────────────── */
INSERT INTO Roles (Name, Description, RoleType) VALUES
    ('Super Admin', 'Acceso global al sistema y administración total', 'Sistema'),
    ('Company Admin', 'Administra la organización, sucursales y usuarios', 'Sistema'),
    ('Manager', 'Gestiona la operación de su sucursal e inventario', 'Sistema'),
    ('Employee', 'Acceso a módulos operativos y autoservicio', 'Sistema'),
    ('Director de RRHH', 'Dirige la gestión de personal con acceso completo al módulo de RRHH', 'Sistema'),
    ('Analista de RRHH', 'Gestiona expedientes y movimientos sin acceso salarial', 'Sistema'),
    ('Encargado de Nómina', 'Consulta empleados e información salarial', 'Sistema'),
    ('Supervisor', 'Consulta y aprueba solicitudes de su equipo', 'Sistema');

/* ── 2. Catálogo de Permisos ──────────────────────────────────────────── */
INSERT INTO Permissions (ModuleName, PermissionName, Description) VALUES
    ('Dashboard', 'Ver Dashboard', 'Consultar el dashboard según el alcance del usuario'),
    ('Empresas', 'Ver empresas', 'Consultar información institucional de la empresa'),
    ('Empresas', 'Crear empresas', 'Crear empresas'),
    ('Empresas', 'Editar empresas', 'Editar información de la empresa'),
    ('Empresas', 'Desactivar empresas', 'Activar o desactivar empresas'),
    ('Usuarios', 'Ver usuarios', 'Consultar usuarios autorizados'),
    ('Usuarios', 'Crear usuarios', 'Crear usuarios'),
    ('Usuarios', 'Editar usuarios', 'Editar usuarios'),
    ('Usuarios', 'Desactivar usuarios', 'Activar o desactivar usuarios'),
    ('Sucursales', 'Ver sucursales', 'Consultar sucursales autorizadas'),
    ('Sucursales', 'Crear sucursales', 'Crear sucursales'),
    ('Sucursales', 'Editar sucursales', 'Editar y desactivar sucursales'),
    ('Auditoría', 'Ver auditoría', 'Consultar registros de auditoría'),
    ('Roles', 'Ver roles', 'Consultar roles y permisos'),
    ('Roles', 'Administrar roles', 'Crear roles y asignar permisos'),
    ('Inventario', 'Ver inventario', 'Consultar el módulo de inventario'),
    ('Productos', 'Ver productos', 'Consultar el catálogo de productos'),
    ('Productos', 'Crear productos', 'Crear productos'),
    ('Productos', 'Editar productos', 'Editar productos'),
    ('Existencias', 'Ver existencias', 'Consultar existencias por sucursal'),
    ('Movimientos', 'Ver movimientos', 'Consultar movimientos de inventario'),
    ('Movimientos', 'Registrar movimientos', 'Registrar entradas y salidas'),
    ('Alertas', 'Ver alertas', 'Consultar alertas de inventario'),
    ('Finanzas', 'Ver finanzas', 'Consultar el resumen financiero'),
    ('Finanzas', 'Registrar transacciones', 'Registrar ingresos y gastos'),
    ('RRHH Empleados', 'Ver empleados', 'Consultar empleados dentro del alcance asignado'),
    ('RRHH Empleados', 'Crear empleados', 'Registrar nuevos empleados'),
    ('RRHH Empleados', 'Editar empleados', 'Actualizar datos de empleados y vincular usuarios'),
    ('RRHH Empleados', 'Gestionar movimientos', 'Transferencias, ascensos y cambios de cargo'),
    ('RRHH Empleados', 'Cambiar estado laboral', 'Suspender, reactivar y desvincular empleados'),
    ('RRHH Empleados', 'Ver información salarial', 'Consultar y ajustar salarios'),
    ('RRHH Empleados', 'Ver datos sensibles', 'Consultar documento de identidad, dirección y datos personales'),
    ('RRHH Empleados', 'Exportar empleados', 'Exportar listados y fichas de empleados'),
    ('RRHH Expedientes', 'Ver documentos', 'Consultar el expediente digital'),
    ('RRHH Expedientes', 'Cargar documentos', 'Adjuntar documentos y nuevas versiones'),
    ('RRHH Expedientes', 'Ver documentos confidenciales', 'Consultar documentos marcados como confidenciales'),
    ('RRHH Expedientes', 'Eliminar documentos', 'Eliminar documentos del expediente (eliminación lógica)'),
    ('RRHH Estructura', 'Ver estructura', 'Consultar departamentos, cargos y organigrama'),
    ('RRHH Estructura', 'Administrar departamentos y cargos', 'Crear, editar y desactivar departamentos y cargos'),
    ('RRHH Configuración', 'Configurar políticas de RRHH', 'Catálogos, codificación y alcances de acceso'),
    ('RRHH Aprobaciones', 'Ver aprobaciones', 'Permite consultar bandejas de solicitudes pendientes y tramitadas'),
    ('RRHH Aprobaciones', 'Aprobar solicitudes', 'Permite tomar decisiones de aprobación o rechazo en flujos de personal'),
    ('RRHH Aprobaciones', 'Configurar flujos', 'Permite crear y editar flujos y etapas de aprobación'),
    ('RRHH Asistencia', 'Ver asistencia', 'Permite consultar registros y calendarios de asistencia laboral'),
    ('RRHH Asistencia', 'Registrar asistencia', 'Permite realizar marcas de entrada y salida o registro manual'),
    ('RRHH Asistencia', 'Administrar turnos', 'Permite definir horarios y asignar turnos a colaboradores'),
    ('RRHH Asistencia', 'Aprobar correcciones', 'Permite aprobar solicitudes de corrección de marca horaria'),
    ('RRHH Asistencia', 'Exportar asistencia', 'Permite descargar reportes consolidados de asistencia'),
    ('RRHH Vacaciones', 'Ver vacaciones', 'Permite consultar saldos y solicitudes de vacaciones'),
    ('RRHH Vacaciones', 'Solicitar vacaciones', 'Permite emitir solicitudes formales de vacaciones'),
    ('RRHH Vacaciones', 'Aprobar vacaciones', 'Permite autorizar o rechazar solicitudes de vacaciones'),
    ('RRHH Vacaciones', 'Configurar políticas', 'Permite configurar escalas y días de vacaciones'),
    ('RRHH Permisos', 'Ver permisos', 'Permite consultar solicitudes e historiales de licencias y permisos'),
    ('RRHH Permisos', 'Solicitar permisos', 'Permite solicitar licencias médicas, personales y permisos laborales'),
    ('RRHH Permisos', 'Aprobar permisos', 'Permite dictaminar sobre solicitudes de licencias y permisos');

/* ── 3. Asignación de Permisos por Rol ────────────────────────────────── */
INSERT INTO RolePermissions (RoleId, PermissionId)
SELECT DISTINCT r.Id, p.Id
FROM (VALUES
    ('Super Admin', '%', '*'),
    ('Company Admin', '%', '*'),
    ('Director de RRHH', 'Dashboard', 'Ver Dashboard'),
    ('Director de RRHH', 'RRHH %', '*'),

    ('Analista de RRHH', 'Dashboard', 'Ver Dashboard'),
    ('Analista de RRHH', 'RRHH Empleados', 'Ver empleados'),
    ('Analista de RRHH', 'RRHH Empleados', 'Crear empleados'),
    ('Analista de RRHH', 'RRHH Empleados', 'Editar empleados'),
    ('Analista de RRHH', 'RRHH Empleados', 'Gestionar movimientos'),
    ('Analista de RRHH', 'RRHH Empleados', 'Ver datos sensibles'),
    ('Analista de RRHH', 'RRHH Empleados', 'Exportar empleados'),
    ('Analista de RRHH', 'RRHH Expedientes', 'Ver documentos'),
    ('Analista de RRHH', 'RRHH Expedientes', 'Cargar documentos'),
    ('Analista de RRHH', 'RRHH Estructura', 'Ver estructura'),
    ('Analista de RRHH', 'RRHH Asistencia', 'Ver asistencia'),
    ('Analista de RRHH', 'RRHH Asistencia', 'Registrar asistencia'),
    ('Analista de RRHH', 'RRHH Asistencia', 'Exportar asistencia'),
    ('Analista de RRHH', 'RRHH Vacaciones', 'Ver vacaciones'),
    ('Analista de RRHH', 'RRHH Vacaciones', 'Solicitar vacaciones'),
    ('Analista de RRHH', 'RRHH Permisos', 'Ver permisos'),
    ('Analista de RRHH', 'RRHH Permisos', 'Solicitar permisos'),
    ('Analista de RRHH', 'RRHH Aprobaciones', 'Ver aprobaciones'),

    ('Encargado de Nómina', 'Dashboard', 'Ver Dashboard'),
    ('Encargado de Nómina', 'Finanzas', 'Ver finanzas'),
    ('Encargado de Nómina', 'RRHH Empleados', 'Ver empleados'),
    ('Encargado de Nómina', 'RRHH Empleados', 'Ver información salarial'),
    ('Encargado de Nómina', 'RRHH Empleados', 'Ver datos sensibles'),
    ('Encargado de Nómina', 'RRHH Empleados', 'Exportar empleados'),
    ('Encargado de Nómina', 'RRHH Estructura', 'Ver estructura'),
    ('Encargado de Nómina', 'RRHH Asistencia', 'Ver asistencia'),
    ('Encargado de Nómina', 'RRHH Asistencia', 'Registrar asistencia'),
    ('Encargado de Nómina', 'RRHH Asistencia', 'Exportar asistencia'),
    ('Encargado de Nómina', 'RRHH Vacaciones', 'Ver vacaciones'),
    ('Encargado de Nómina', 'RRHH Vacaciones', 'Solicitar vacaciones'),
    ('Encargado de Nómina', 'RRHH Permisos', 'Ver permisos'),
    ('Encargado de Nómina', 'RRHH Permisos', 'Solicitar permisos'),

    ('Supervisor', 'Dashboard', 'Ver Dashboard'),
    ('Supervisor', 'RRHH Empleados', 'Ver empleados'),
    ('Supervisor', 'RRHH Expedientes', 'Ver documentos'),
    ('Supervisor', 'RRHH Estructura', 'Ver estructura'),
    ('Supervisor', 'RRHH Asistencia', 'Ver asistencia'),
    ('Supervisor', 'RRHH Asistencia', 'Registrar asistencia'),
    ('Supervisor', 'RRHH Asistencia', 'Aprobar correcciones'),
    ('Supervisor', 'RRHH Vacaciones', 'Ver vacaciones'),
    ('Supervisor', 'RRHH Vacaciones', 'Solicitar vacaciones'),
    ('Supervisor', 'RRHH Vacaciones', 'Aprobar vacaciones'),
    ('Supervisor', 'RRHH Permisos', 'Ver permisos'),
    ('Supervisor', 'RRHH Permisos', 'Solicitar permisos'),
    ('Supervisor', 'RRHH Permisos', 'Aprobar permisos'),
    ('Supervisor', 'RRHH Aprobaciones', 'Ver aprobaciones'),
    ('Supervisor', 'RRHH Aprobaciones', 'Aprobar solicitudes'),

    ('Manager', 'Dashboard', 'Ver Dashboard'),
    ('Manager', 'Sucursales', 'Ver sucursales'),
    ('Manager', 'Inventario', 'Ver inventario'),
    ('Manager', 'Productos', 'Ver productos'),
    ('Manager', 'Productos', 'Crear productos'),
    ('Manager', 'Productos', 'Editar productos'),
    ('Manager', 'Existencias', 'Ver existencias'),
    ('Manager', 'Movimientos', 'Ver movimientos'),
    ('Manager', 'Movimientos', 'Registrar movimientos'),
    ('Manager', 'Alertas', 'Ver alertas'),
    ('Manager', 'RRHH Asistencia', 'Ver asistencia'),
    ('Manager', 'RRHH Asistencia', 'Registrar asistencia'),
    ('Manager', 'RRHH Vacaciones', 'Ver vacaciones'),
    ('Manager', 'RRHH Vacaciones', 'Solicitar vacaciones'),
    ('Manager', 'RRHH Permisos', 'Ver permisos'),
    ('Manager', 'RRHH Permisos', 'Solicitar permisos'),
    ('Manager', 'RRHH Aprobaciones', 'Ver aprobaciones'),
    ('Manager', 'RRHH Aprobaciones', 'Aprobar solicitudes'),

    ('Employee', 'Dashboard', 'Ver Dashboard'),
    ('Employee', 'RRHH Asistencia', 'Ver asistencia'),
    ('Employee', 'RRHH Asistencia', 'Registrar asistencia'),
    ('Employee', 'RRHH Vacaciones', 'Ver vacaciones'),
    ('Employee', 'RRHH Vacaciones', 'Solicitar vacaciones'),
    ('Employee', 'RRHH Permisos', 'Ver permisos'),
    ('Employee', 'RRHH Permisos', 'Solicitar permisos')
) AS g(RoleName, ModuleName, PermissionName)
INNER JOIN Roles AS r ON r.Name = g.RoleName
INNER JOIN Permissions AS p
    ON p.ModuleName LIKE g.ModuleName
   AND (g.PermissionName = '*' OR p.PermissionName = g.PermissionName);

/* ── 4. Catálogos Globales de RRHH (República Dominicana) ─────────────── */
INSERT INTO HrCatalogItems (CompanyId, CatalogType, Code, Name, SortOrder) VALUES
    (NULL, 'ContractType', 'INDEFINIDO', 'Por tiempo indefinido', 1),
    (NULL, 'ContractType', 'DEFINIDO', 'Por cierto tiempo', 2),
    (NULL, 'ContractType', 'OBRA', 'Para obra o servicio determinado', 3),
    (NULL, 'ContractType', 'PASANTIA', 'Pasantía', 4),
    (NULL, 'WorkModality', 'PRESENCIAL', 'Presencial', 1),
    (NULL, 'WorkModality', 'REMOTO', 'Remoto', 2),
    (NULL, 'WorkModality', 'HIBRIDO', 'Híbrido', 3),
    (NULL, 'DocumentType', 'CONTRATO', 'Contrato laboral', 1),
    (NULL, 'DocumentType', 'IDENTIFICACION', 'Documento de identidad', 2),
    (NULL, 'DocumentType', 'CERTIFICACION', 'Certificación', 3),
    (NULL, 'DocumentType', 'TITULO', 'Título académico', 4),
    (NULL, 'DocumentType', 'CV', 'Currículum', 5),
    (NULL, 'DocumentType', 'MEDICO', 'Certificado médico', 6),
    (NULL, 'DocumentType', 'OTRO', 'Otro documento', 99),
    (NULL, 'TerminationReason', 'RENUNCIA', 'Renuncia (desahucio del trabajador)', 1),
    (NULL, 'TerminationReason', 'DESAHUCIO', 'Desahucio por el empleador', 2),
    (NULL, 'TerminationReason', 'DESPIDO', 'Despido justificado', 3),
    (NULL, 'TerminationReason', 'DIMISION', 'Dimisión', 4),
    (NULL, 'TerminationReason', 'MUTUO_ACUERDO', 'Mutuo acuerdo', 5),
    (NULL, 'TerminationReason', 'FIN_CONTRATO', 'Terminación de contrato', 6),
    (NULL, 'TerminationReason', 'PENSION', 'Pensión o jubilación', 7),
    (NULL, 'TerminationReason', 'FALLECIMIENTO', 'Fallecimiento', 8),
    (NULL, 'TerminationReason', 'OTRO', 'Otro motivo', 99);

/* ── 5. Organización Principal (Kinetix) y Sucursales ─────────────────── */
-- El trigger TR_Companies_SeedDefaults siembra automáticamente HrSettings,
-- HrWorkShifts, HrVacationPolicies, HrLeaveTypes y HrApprovalFlows.
INSERT INTO Companies (Id, Name, Rnc, ContactEmail, Phone, Address, IsActive)
VALUES (1, 'Kinetix', '131-00001-1', 'contacto@kinetix.com', '809-555-0100', 'Av. Winston Churchill #100, Piantini, Santo Domingo', TRUE)
ON CONFLICT (Id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('companies', 'id'), COALESCE((SELECT MAX(Id) FROM Companies), 1), true);

INSERT INTO Branches (Id, CompanyId, Name, Code, Address, Phone, Email, IsActive) VALUES
    (1, 1, 'Sede Central Santo Domingo', 'SDQ-01', 'Av. Winston Churchill #100, Santo Domingo', '809-555-0101', 'sede.central@kinetix.com', TRUE),
    (2, 1, 'Sucursal Norte Santiago', 'STI-01', 'Av. Juan Pablo Duarte #45, Santiago de los Caballeros', '809-555-0102', 'santiago@kinetix.com', TRUE)
ON CONFLICT (Id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('branches', 'id'), COALESCE((SELECT MAX(Id) FROM Branches), 2), true);

/* ── 6. Usuarios del Sistema (Clave por defecto: Admin12345!) ─────────── */
INSERT INTO UserOrganizations (UserId, CompanyId, BranchId, FirstName, LastName, Email, PasswordHash, Phone, IsActive) VALUES
    ('kinetix-super-admin', 1, 1, 'Kinetix', 'Super Admin', 'superadmin@kinetix.local', 'pbkdf2$sha512$310000$9p+Ly56aVP+M9SMRSfQkPA==$TMRg8m7r+KAAZKtX4NT/ZrgbTm2iOmRqCPhB9L4uKI0=', '809-555-0100', TRUE),
    ('admin-principal', 1, 1, 'Admin', 'Sistema', 'admin@kinetix.local', 'pbkdf2$sha512$310000$9p+Ly56aVP+M9SMRSfQkPA==$TMRg8m7r+KAAZKtX4NT/ZrgbTm2iOmRqCPhB9L4uKI0=', '809-555-0110', TRUE),
    ('ana-martinez', 1, 1, 'Ana', 'Martínez', 'ana.martinez@kinetix.com', 'pbkdf2$sha512$310000$9p+Ly56aVP+M9SMRSfQkPA==$TMRg8m7r+KAAZKtX4NT/ZrgbTm2iOmRqCPhB9L4uKI0=', '809-555-0120', TRUE),
    ('director-rrhh', 1, 1, 'Sofía', 'Valdez', 'director.rrhh@kinetix.local', 'pbkdf2$sha512$310000$9p+Ly56aVP+M9SMRSfQkPA==$TMRg8m7r+KAAZKtX4NT/ZrgbTm2iOmRqCPhB9L4uKI0=', '809-555-0130', TRUE),
    ('carlos-gomez', 1, 1, 'Carlos', 'Gómez', 'carlos.gomez@kinetix.com', 'pbkdf2$sha512$310000$9p+Ly56aVP+M9SMRSfQkPA==$TMRg8m7r+KAAZKtX4NT/ZrgbTm2iOmRqCPhB9L4uKI0=', '809-555-0140', TRUE),
    ('carlos-mendoza', 1, 2, 'Carlos', 'Mendoza', 'carlos.mendoza@kinetix.local', 'pbkdf2$sha512$310000$9p+Ly56aVP+M9SMRSfQkPA==$TMRg8m7r+KAAZKtX4NT/ZrgbTm2iOmRqCPhB9L4uKI0=', '809-555-0150', TRUE)
ON CONFLICT (UserId) DO NOTHING;

INSERT INTO UserRoles (UserId, RoleId)
SELECT u.UserId, r.Id
FROM (VALUES
    ('kinetix-super-admin', 'Super Admin'),
    ('admin-principal', 'Super Admin'),
    ('ana-martinez', 'Company Admin'),
    ('director-rrhh', 'Director de RRHH'),
    ('carlos-gomez', 'Employee'),
    ('carlos-mendoza', 'Employee')
) AS u(UserId, RoleName)
INNER JOIN Roles AS r ON r.Name = u.RoleName
ON CONFLICT (UserId, RoleId) DO NOTHING;

UPDATE Branches SET ManagerUserId = 'ana-martinez' WHERE Id = 1 AND ManagerUserId IS NULL;
UPDATE Branches SET ManagerUserId = 'carlos-mendoza' WHERE Id = 2 AND ManagerUserId IS NULL;

/* ── 7. Estructura Organizacional y Colaboradores de RRHH ─────────────── */
INSERT INTO HrDepartments (Id, CompanyId, BranchId, ParentDepartmentId, Code, Name, Description, IsActive) VALUES
    (1, 1, 1, NULL, 'DIR-GEN', 'Dirección General', 'Dirección ejecutiva y estratégica de Kinetix', TRUE),
    (2, 1, 1, 1, 'RRHH', 'Gestión Humana', 'Administración de talento, nómina y bienestar organizacional', TRUE),
    (3, 1, 1, 1, 'TI', 'Tecnología e Innovación', 'Desarrollo de software, infraestructura y soporte técnico', TRUE),
    (4, 1, 1, 1, 'OPS', 'Operaciones y Logística', 'Gestión de almacenes, inventario y distribución', TRUE),
    (5, 1, 1, 1, 'FIN', 'Finanzas y Contabilidad', 'Contabilidad general, tesorería y facturación fiscal', TRUE)
ON CONFLICT (Id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('hrdepartments', 'id'), COALESCE((SELECT MAX(Id) FROM HrDepartments), 5), true);

INSERT INTO HrPositions (Id, CompanyId, DepartmentId, Code, Title, Description, HierarchyLevel, SalaryMin, SalaryMax, IsActive) VALUES
    (1, 1, 1, 'CAR-001', 'Director Ejecutivo (CEO)', 'Dirección general de la empresa', 1, 150000, 280000, TRUE),
    (2, 1, 2, 'CAR-002', 'Directora de Gestión Humana', 'Lidera la estrategia y operaciones de RRHH', 2, 95000, 160000, TRUE),
    (3, 1, 3, 'CAR-003', 'Ingeniero de Software Senior', 'Diseño y arquitectura de plataformas empresariales', 4, 80000, 140000, TRUE),
    (4, 1, 4, 'CAR-004', 'Coordinador de Operaciones', 'Control de existencias y logística de sucursales', 4, 55000, 90000, TRUE),
    (5, 1, 5, 'CAR-005', 'Analista Financiero', 'Control de facturación, pagos y conciliación bancaria', 5, 50000, 85000, TRUE)
ON CONFLICT (Id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('hrpositions', 'id'), COALESCE((SELECT MAX(Id) FROM HrPositions), 5), true);

INSERT INTO HrEmployees (
    Id, CompanyId, BranchId, EmployeeCode, FirstName, LastName,
    DocumentType, DocumentNumber, BirthDate, Sex, Nationality, MaritalStatus,
    Phone, Email, Address, DepartmentId, PositionId, SupervisorEmployeeId,
    HireDate, ContractTypeId, WorkModalityId, BaseSalary, SalaryCurrency, PayFrequency, Status, UserId
) VALUES
    (1, 1, 1, 'EMP-00001', 'Ana', 'Martínez', 'Cedula', '402-0000001-2', '1988-05-14', 'F', 'Dominicana', 'Casado',
     '809-555-0120', 'ana.martinez@kinetix.com', 'Calle Polibio Díaz #12, Evaristo Morales', 1, 1, NULL,
     '2021-03-01', 1, 1, 185000.00, 'DOP', 'Mensual', 'Activo', 'ana-martinez'),
    (2, 1, 1, 'EMP-00002', 'Sofía', 'Valdez', 'Cedula', '402-0000002-0', '1990-08-22', 'F', 'Dominicana', 'Soltero',
     '809-555-0130', 'director.rrhh@kinetix.local', 'Av. Sarasota #88, Bella Vista', 2, 2, 1,
     '2022-01-15', 1, 1, 125000.00, 'DOP', 'Mensual', 'Activo', 'director-rrhh'),
    (3, 1, 1, 'EMP-00003', 'Carlos', 'Gómez', 'Cedula', '402-0000003-8', '1994-11-10', 'M', 'Dominicana', 'Soltero',
     '809-555-0140', 'carlos.gomez@kinetix.com', 'Calle Paseo de los Locutores #34, Piantini', 3, 3, 1,
     '2023-02-01', 1, 3, 98000.00, 'DOP', 'Mensual', 'Activo', 'carlos-gomez'),
    (4, 1, 2, 'EMP-00004', 'Carlos', 'Mendoza', 'Cedula', '402-0000004-6', '1992-04-03', 'M', 'Dominicana', 'Casado',
     '809-555-0150', 'carlos.mendoza@kinetix.local', 'Urb. Los Jardines Metropolitanos, Santiago', 4, 4, 1,
     '2023-06-15', 1, 1, 68000.00, 'DOP', 'Mensual', 'Activo', 'carlos-mendoza')
ON CONFLICT (Id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('hremployees', 'id'), COALESCE((SELECT MAX(Id) FROM HrEmployees), 4), true);
UPDATE HrSettings SET NextEmployeeNumber = 5 WHERE CompanyId = 1 AND NextEmployeeNumber < 5;

UPDATE HrDepartments SET ManagerEmployeeId = 1 WHERE Id = 1 AND ManagerEmployeeId IS NULL;
UPDATE HrDepartments SET ManagerEmployeeId = 2 WHERE Id = 2 AND ManagerEmployeeId IS NULL;
UPDATE HrDepartments SET ManagerEmployeeId = 3 WHERE Id = 3 AND ManagerEmployeeId IS NULL;
UPDATE HrDepartments SET ManagerEmployeeId = 4 WHERE Id = 4 AND ManagerEmployeeId IS NULL;

INSERT INTO HrEmployeeMovements (EmployeeId, CompanyId, MovementType, EffectiveDate, ToBranchId, ToDepartmentId, ToPositionId, ToSupervisorId, ToSalary, ToStatus, Reason, CreatedBy)
SELECT e.Id, e.CompanyId, 'Ingreso', e.HireDate, e.BranchId, e.DepartmentId, e.PositionId, e.SupervisorEmployeeId, e.BaseSalary, 'Activo', 'Ingreso inicial a la organización', 'kinetix-super-admin'
FROM HrEmployees e
WHERE NOT EXISTS (SELECT 1 FROM HrEmployeeMovements m WHERE m.EmployeeId = e.Id);

INSERT INTO HrEmployeeShifts (EmployeeId, ShiftId, EffectiveDate, IsActive)
SELECT e.Id, s.Id, e.HireDate, TRUE
FROM HrEmployees e
CROSS JOIN LATERAL (SELECT Id FROM HrWorkShifts WHERE CompanyId = 1 AND Code = 'HOR-ESTANDAR' LIMIT 1) s
WHERE NOT EXISTS (SELECT 1 FROM HrEmployeeShifts es WHERE es.EmployeeId = e.Id);

INSERT INTO HrVacationBalances (EmployeeId, PeriodYear, DaysEarned, DaysUsed, DaysPending) VALUES
    (1, EXTRACT(YEAR FROM now())::int, 18.0, 2.0, 0.0),
    (2, EXTRACT(YEAR FROM now())::int, 14.0, 0.0, 0.0),
    (3, EXTRACT(YEAR FROM now())::int, 14.0, 0.0, 0.0),
    (4, EXTRACT(YEAR FROM now())::int, 14.0, 0.0, 0.0)
ON CONFLICT (EmployeeId, PeriodYear) DO NOTHING;

/* ── 8. Catálogo Inicial de Inventario y Existencias ──────────────────── */
INSERT INTO Products (Id, CompanyId, Sku, Name, Category, UnitName, MinimumStock, UnitCost, IsActive) VALUES
    (1, 1, 'KIN-LAP-001', 'Laptop Corporativa Latitude 14"', 'Equipos de Cómputo', 'und.', 5, 58500.00, TRUE),
    (2, 1, 'KIN-MON-002', 'Monitor IPS 27" QHD Ergonomic', 'Periféricos', 'und.', 8, 16200.00, TRUE),
    (3, 1, 'KIN-NET-003', 'Access Point Wi-Fi 6 Empresarial', 'Redes y Comunicaciones', 'und.', 4, 9800.00, TRUE),
    (4, 1, 'KIN-UPS-004', 'UPS Online 1500VA Rack/Tower', 'Protección Eléctrica', 'und.', 3, 22400.00, TRUE)
ON CONFLICT (Id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('products', 'id'), COALESCE((SELECT MAX(Id) FROM Products), 4), true);

INSERT INTO InventoryStock (CompanyId, ProductId, BranchId, Quantity) VALUES
    (1, 1, 1, 14),
    (1, 2, 1, 22),
    (1, 3, 1, 9),
    (1, 4, 1, 2),
    (1, 1, 2, 6),
    (1, 2, 2, 10)
ON CONFLICT (ProductId, BranchId) DO NOTHING;

INSERT INTO InventoryMovements (CompanyId, ProductId, BranchId, MovementType, Quantity, UnitCost, Notes, CreatedBy)
SELECT 1, 1, 1, 'Entrada', 14, 58500.00, 'Inventario inicial Sede Central', 'ana-martinez'
WHERE NOT EXISTS (SELECT 1 FROM InventoryMovements WHERE CompanyId = 1);

/* ── 9. Datos Operativos de Finanzas ──────────────────────────────────── */
INSERT INTO FinanceContacts (Id, CompanyId, ContactType, Name, TaxId, Email, Phone, IsActive) VALUES
    (1, 1, 'Cliente', 'Grupo Corporativo Caribe SRL', '101-88421-9', 'cuentasporpagar@grupocaribe.do', '809-555-3100', TRUE),
    (2, 1, 'Cliente', 'Banco Atlántico Dominicano', '101-11223-4', 'facturacion@bancoatlantico.do', '809-555-4200', TRUE),
    (3, 1, 'Proveedor', 'TechDistribución Dominicana SAS', '130-44556-7', 'ventas@techdistribucion.do', '809-555-6800', TRUE),
    (4, 1, 'Proveedor', 'Telecomunicaciones del Ozama', '101-99887-1', 'corporativo@teleozama.do', '809-555-9000', TRUE)
ON CONFLICT (Id) DO NOTHING;

SELECT setval(pg_get_serial_sequence('financecontacts', 'id'), COALESCE((SELECT MAX(Id) FROM FinanceContacts), 4), true);

INSERT INTO FinanceTransactions (CompanyId, TransactionType, Category, Description, Amount, TransactionDate, Status, TaxRate, TaxAmount, DueDate, ApprovedBy, ApprovedAt, CreatedBy)
SELECT 1, 'Ingreso', 'Servicios Empresariales', 'Implementación y licenciamiento anual suite corporativa', 425000.00, CURRENT_DATE - 3, 'Aprobada', 18, 76500.00, CURRENT_DATE + 15, 'ana-martinez', now(), 'ana-martinez'
WHERE NOT EXISTS (SELECT 1 FROM FinanceTransactions WHERE CompanyId = 1);

INSERT INTO FinanceTransactions (CompanyId, TransactionType, Category, Description, Amount, TransactionDate, Status, TaxRate, TaxAmount, DueDate, CreatedBy)
SELECT 1, 'Gasto', 'Infraestructura Cloud y Enlaces', 'Renovación servidores dedicados y enlace fibra óptica', 68500.00, CURRENT_DATE - 1, 'Pendiente', 18, 12330.00, CURRENT_DATE + 10, 'ana-martinez'
WHERE (SELECT COUNT(*) FROM FinanceTransactions WHERE CompanyId = 1) < 2;

INSERT INTO FinanceInvoices (CompanyId, ContactId, InvoiceNumber, InvoiceType, IssueDate, DueDate, Subtotal, TaxRate, TaxAmount, Total, Status, Ncf, CreatedBy) VALUES
    (1, 1, 'FAC-2026-0001', 'Venta', CURRENT_DATE - 5, CURRENT_DATE + 25, 350000.00, 18, 63000.00, 413000.00, 'Pagada', 'B0100000001', 'ana-martinez'),
    (1, 2, 'FAC-2026-0002', 'Venta', CURRENT_DATE - 2, CURRENT_DATE + 28, 180000.00, 18, 32400.00, 212400.00, 'Pendiente', 'B0100000002', 'ana-martinez'),
    (1, 3, 'COM-2026-0014', 'Compra', CURRENT_DATE - 4, CURRENT_DATE + 15, 95000.00, 18, 17100.00, 112100.00, 'Pendiente', 'B0100000452', 'ana-martinez')
ON CONFLICT (CompanyId, InvoiceNumber) DO NOTHING;

INSERT INTO FinanceBankTransactions (CompanyId, TransactionDate, Description, Amount, Reference, Status, ReconciledAt, ReconciledBy)
SELECT 1, CURRENT_DATE - 4, 'Transferencia LBTR - Grupo Corporativo Caribe SRL (FAC-2026-0001)', 413000.00, 'LBTR-9981204', 'Conciliada', now(), 'ana-martinez'
WHERE NOT EXISTS (SELECT 1 FROM FinanceBankTransactions WHERE CompanyId = 1);

INSERT INTO FinanceBankTransactions (CompanyId, TransactionDate, Description, Amount, Reference, Status)
SELECT 1, CURRENT_DATE - 1, 'Pago ACH Proveedor - Telecomunicaciones del Ozama', -68500.00, 'ACH-4410982', 'Pendiente'
WHERE (SELECT COUNT(*) FROM FinanceBankTransactions WHERE CompanyId = 1) < 2;
