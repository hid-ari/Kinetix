/* =====================================================================
   005 - Integridad de módulos y dependencias
   1. Permisos de Fase 2 (Asistencia, Vacaciones, Permisos, Aprobaciones)
      para los roles de RRHH y de gestión, que quedaron sin asignar en 003.
      Sin esto, el paso 2 del flujo de vacaciones (rol Director de RRHH)
      no podía ser aprobado y los colaboradores con esos roles no podían
      registrar asistencia ni solicitar vacaciones.
   2. Tabla HrVacationPolicies versionada (existía fuera de migraciones)
      y alineada al Art. 177 del Código de Trabajo: 14 días desde 1 año,
      18 días desde 5 años.
   3. Índices sobre columnas FK sin índice (joins y borrados en cascada).
   ===================================================================== */

/* ── 1. Permisos de Fase 2 por rol ───────────────────────────────────── */
INSERT INTO dbo.RolePermissions (RoleId, PermissionId)
SELECT r.Id, p.Id
FROM (VALUES
    -- Director de RRHH: control completo de los módulos de Fase 2
    (N'Director de RRHH', N'RRHH Asistencia', N'*'),
    (N'Director de RRHH', N'RRHH Vacaciones', N'*'),
    (N'Director de RRHH', N'RRHH Permisos', N'*'),
    (N'Director de RRHH', N'RRHH Aprobaciones', N'*'),
    -- Analista de RRHH: consulta y gestión operativa, sin aprobar ni configurar
    (N'Analista de RRHH', N'RRHH Asistencia', N'Ver asistencia'),
    (N'Analista de RRHH', N'RRHH Asistencia', N'Registrar asistencia'),
    (N'Analista de RRHH', N'RRHH Asistencia', N'Exportar asistencia'),
    (N'Analista de RRHH', N'RRHH Vacaciones', N'Ver vacaciones'),
    (N'Analista de RRHH', N'RRHH Vacaciones', N'Solicitar vacaciones'),
    (N'Analista de RRHH', N'RRHH Permisos', N'Ver permisos'),
    (N'Analista de RRHH', N'RRHH Permisos', N'Solicitar permisos'),
    (N'Analista de RRHH', N'RRHH Aprobaciones', N'Ver aprobaciones'),
    -- Encargado de Nómina: insumos de nómina (asistencia, ausencias)
    (N'Encargado de Nómina', N'RRHH Asistencia', N'Ver asistencia'),
    (N'Encargado de Nómina', N'RRHH Asistencia', N'Registrar asistencia'),
    (N'Encargado de Nómina', N'RRHH Asistencia', N'Exportar asistencia'),
    (N'Encargado de Nómina', N'RRHH Vacaciones', N'Ver vacaciones'),
    (N'Encargado de Nómina', N'RRHH Vacaciones', N'Solicitar vacaciones'),
    (N'Encargado de Nómina', N'RRHH Permisos', N'Ver permisos'),
    (N'Encargado de Nómina', N'RRHH Permisos', N'Solicitar permisos'),
    -- Supervisor: autoservicio + aprobación de su equipo (paso 1 de los flujos)
    (N'Supervisor', N'RRHH Asistencia', N'Ver asistencia'),
    (N'Supervisor', N'RRHH Asistencia', N'Registrar asistencia'),
    (N'Supervisor', N'RRHH Asistencia', N'Aprobar correcciones'),
    (N'Supervisor', N'RRHH Vacaciones', N'Ver vacaciones'),
    (N'Supervisor', N'RRHH Vacaciones', N'Solicitar vacaciones'),
    (N'Supervisor', N'RRHH Vacaciones', N'Aprobar vacaciones'),
    (N'Supervisor', N'RRHH Permisos', N'Ver permisos'),
    (N'Supervisor', N'RRHH Permisos', N'Solicitar permisos'),
    (N'Supervisor', N'RRHH Permisos', N'Aprobar permisos'),
    (N'Supervisor', N'RRHH Aprobaciones', N'Ver aprobaciones'),
    (N'Supervisor', N'RRHH Aprobaciones', N'Aprobar solicitudes'),
    -- Manager (operaciones): autoservicio + aprobación de su equipo
    (N'Manager', N'RRHH Asistencia', N'Ver asistencia'),
    (N'Manager', N'RRHH Asistencia', N'Registrar asistencia'),
    (N'Manager', N'RRHH Vacaciones', N'Ver vacaciones'),
    (N'Manager', N'RRHH Vacaciones', N'Solicitar vacaciones'),
    (N'Manager', N'RRHH Permisos', N'Ver permisos'),
    (N'Manager', N'RRHH Permisos', N'Solicitar permisos'),
    (N'Manager', N'RRHH Aprobaciones', N'Ver aprobaciones'),
    (N'Manager', N'RRHH Aprobaciones', N'Aprobar solicitudes')
) AS v(RoleName, ModuleName, PermissionName)
INNER JOIN dbo.Roles AS r ON r.Name = v.RoleName
INNER JOIN dbo.Permissions AS p
    ON p.ModuleName = v.ModuleName
   AND (v.PermissionName = N'*' OR p.PermissionName = v.PermissionName)
WHERE NOT EXISTS (SELECT 1 FROM dbo.RolePermissions AS rp WHERE rp.RoleId = r.Id AND rp.PermissionId = p.Id);
GO

/* ── 2. Políticas de vacaciones ──────────────────────────────────────── */
IF OBJECT_ID(N'dbo.HrVacationPolicies', N'U') IS NULL
CREATE TABLE dbo.HrVacationPolicies
(
    Id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HrVacationPolicies PRIMARY KEY,
    CompanyId       INT NOT NULL,
    MinYearsService INT NOT NULL,
    MaxYearsService INT NULL,
    DaysGranted     INT NOT NULL,
    CreatedAt       DATETIME2(0) NOT NULL CONSTRAINT DF_HrVacationPolicies_CreatedAt DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT FK_HrVacationPolicies_Companies FOREIGN KEY (CompanyId) REFERENCES dbo.Companies(Id)
);
GO

-- Corrige el tramo existente (antes 1-5 / 6+) al criterio legal 1-4 / 5+
UPDATE dbo.HrVacationPolicies SET MaxYearsService = 4 WHERE MinYearsService = 1 AND MaxYearsService = 5 AND DaysGranted = 14;
UPDATE dbo.HrVacationPolicies SET MinYearsService = 5 WHERE MinYearsService = 6 AND MaxYearsService IS NULL AND DaysGranted = 18;
GO

-- Siembra la escala por defecto para empresas que no tengan ninguna
INSERT INTO dbo.HrVacationPolicies (CompanyId, MinYearsService, MaxYearsService, DaysGranted)
SELECT c.Id, v.MinYears, v.MaxYears, v.Days
FROM dbo.Companies AS c
CROSS JOIN (VALUES (1, 4, 14), (5, NULL, 18)) AS v(MinYears, MaxYears, Days)
WHERE NOT EXISTS (SELECT 1 FROM dbo.HrVacationPolicies AS p WHERE p.CompanyId = c.Id);
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_HrVacationPolicies_Company' AND object_id = OBJECT_ID(N'dbo.HrVacationPolicies'))
    CREATE INDEX IX_HrVacationPolicies_Company ON dbo.HrVacationPolicies (CompanyId, MinYearsService);
GO

/* ── 3. Índices sobre columnas FK sin índice ─────────────────────────── */
DECLARE @stmt NVARCHAR(MAX) = N'';
SELECT @stmt += N'CREATE INDEX ' + QUOTENAME(N'IX_FK_' + t.name + N'_' + c.name)
             + N' ON dbo.' + QUOTENAME(t.name) + N' (' + QUOTENAME(c.name) + N');' + CHAR(10)
FROM sys.foreign_key_columns AS fkc
INNER JOIN sys.tables AS t ON t.object_id = fkc.parent_object_id
INNER JOIN sys.columns AS c ON c.object_id = fkc.parent_object_id AND c.column_id = fkc.parent_column_id
WHERE t.schema_id = SCHEMA_ID(N'dbo')
  AND NOT EXISTS (
      SELECT 1 FROM sys.index_columns AS ic
      WHERE ic.object_id = fkc.parent_object_id AND ic.column_id = fkc.parent_column_id AND ic.key_ordinal = 1)
  AND NOT EXISTS (
      SELECT 1 FROM sys.indexes AS i
      WHERE i.object_id = t.object_id AND i.name = N'IX_FK_' + t.name + N'_' + c.name)
GROUP BY t.name, c.name;
IF LEN(@stmt) > 0 EXEC sys.sp_executesql @stmt;
GO
