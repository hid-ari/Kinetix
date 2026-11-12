/*
  Kinetix — Lógica en base de datos (migración 002)
  Inmutabilidad de auditoría e historial, vista institucional, funciones de alcance
  de RRHH y siembra automática de políticas por defecto de la organización.
*/

/* ── Registros inmutables ─────────────────────────────────────────────── */
CREATE FUNCTION fn_RejectChange() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION '%', TG_ARGV[0] USING ERRCODE = 'P0001';
END;
$$;

CREATE TRIGGER TR_AuditLogs_Immutable
    BEFORE UPDATE OR DELETE ON AuditLogs
    FOR EACH ROW EXECUTE FUNCTION fn_RejectChange('Los registros de auditoría son inmutables.');

CREATE TRIGGER TR_HrEmployeeMovements_Immutable
    BEFORE UPDATE OR DELETE ON HrEmployeeMovements
    FOR EACH ROW EXECUTE FUNCTION fn_RejectChange('El historial laboral es inmutable.');

/* ── Resumen institucional de la organización ────────────────────────── */
CREATE VIEW vw_CompaniesList AS
SELECT
    c.Id,
    c.Name,
    c.Rnc,
    c.ContactEmail,
    c.Phone,
    c.Address,
    c.LogoUrl,
    c.IsActive,
    c.CreatedAt,
    COUNT(DISTINCT u.UserId) AS UserCount,
    COUNT(DISTINCT b.Id) AS BranchCount,
    COUNT(DISTINCT CASE WHEN u.IsActive THEN u.UserId END) AS ActiveUserCount,
    COUNT(DISTINCT CASE WHEN NOT u.IsActive THEN u.UserId END) AS InactiveUserCount
FROM Companies AS c
LEFT JOIN UserOrganizations AS u ON u.CompanyId = c.Id
LEFT JOIN Branches AS b ON b.CompanyId = c.Id
GROUP BY c.Id, c.Name, c.Rnc, c.ContactEmail, c.Phone, c.Address, c.LogoUrl, c.IsActive, c.CreatedAt;

/*
  Empleados visibles para un usuario. Centraliza las reglas de alcance: global,
  administrador de empresa, alcances explícitos (empresa, sucursal, departamento con
  sus subdepartamentos), equipo a cargo (directo e indirecto) y ficha propia.
*/
CREATE FUNCTION fn_HrVisibleEmployees(p_UserId VARCHAR, p_IsGlobal BOOLEAN, p_IsCompanyAdmin BOOLEAN)
RETURNS TABLE (EmployeeId INT)
LANGUAGE sql STABLE AS $$
WITH RECURSIVE SelfEmployee AS (
    SELECT e.Id FROM HrEmployees AS e WHERE e.UserId = p_UserId
),
Team AS (
    SELECT e.Id FROM HrEmployees AS e INNER JOIN SelfEmployee AS s ON e.SupervisorEmployeeId = s.Id
    UNION
    SELECT e.Id FROM HrEmployees AS e INNER JOIN Team AS t ON e.SupervisorEmployeeId = t.Id
),
ScopeDepartments AS (
    SELECT d.Id FROM HrDepartments AS d
    INNER JOIN HrAccessScopes AS s ON s.ScopeType = 'Departamento' AND s.DepartmentId = d.Id
    WHERE s.UserId = p_UserId
    UNION
    SELECT d.Id FROM HrDepartments AS d INNER JOIN ScopeDepartments AS p ON d.ParentDepartmentId = p.Id
)
SELECT e.Id AS EmployeeId
FROM HrEmployees AS e
WHERE p_IsGlobal
   OR (p_IsCompanyAdmin AND e.CompanyId = (SELECT u.CompanyId FROM UserOrganizations AS u WHERE u.UserId = p_UserId))
   OR EXISTS (SELECT 1 FROM HrAccessScopes AS s WHERE s.UserId = p_UserId AND s.ScopeType = 'Empresa' AND s.CompanyId = e.CompanyId)
   OR EXISTS (SELECT 1 FROM HrAccessScopes AS s WHERE s.UserId = p_UserId AND s.ScopeType = 'Sucursal' AND s.BranchId = e.BranchId)
   OR e.DepartmentId IN (SELECT Id FROM ScopeDepartments)
   OR e.Id IN (SELECT Id FROM Team)
   OR e.Id IN (SELECT Id FROM SelfEmployee);
$$;

/* Empresas sobre las que un usuario puede operar en RRHH. */
CREATE FUNCTION fn_HrAccessibleCompanies(p_UserId VARCHAR, p_IsGlobal BOOLEAN)
RETURNS TABLE (CompanyId INT)
LANGUAGE sql STABLE AS $$
SELECT c.Id AS CompanyId
FROM Companies AS c
WHERE p_IsGlobal
   OR c.Id = (SELECT u.CompanyId FROM UserOrganizations AS u WHERE u.UserId = p_UserId)
   OR EXISTS (SELECT 1 FROM HrAccessScopes AS s WHERE s.UserId = p_UserId AND s.CompanyId = c.Id);
$$;

/*
  Valores por defecto de RRHH para la organización: configuración de códigos,
  turnos, escala de vacaciones (Código de Trabajo RD, Art. 177), tipos de licencia
  y flujos de aprobación.
*/
CREATE FUNCTION fn_SeedCompanyDefaults() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    v_FlowId INT;
    v_RoleId INT;
BEGIN
    INSERT INTO HrSettings (CompanyId, EmployeeCodePrefix, EmployeeCodeDigits, NextEmployeeNumber, AllowManualEmployeeCode, BirthdaysEnabled)
    VALUES (NEW.Id, 'EMP-', 5, 1, FALSE, TRUE)
    ON CONFLICT (CompanyId) DO NOTHING;

    INSERT INTO HrWorkShifts (CompanyId, Code, Name, ShiftType, StartTime, EndTime, GraceMinutes, BreakMinutes, WorkDaysMask) VALUES
        (NEW.Id, 'HOR-ESTANDAR', 'Jornada Completa Estándar (8:00 AM - 5:00 PM)', 'Regular', '08:00:00', '17:00:00', 15, 60, '1111100'),
        (NEW.Id, 'HOR-MEDIO', 'Media Jornada Matutina (8:00 AM - 1:00 PM)', 'Regular', '08:00:00', '13:00:00', 15, 0, '1111100')
    ON CONFLICT (CompanyId, Code) DO NOTHING;

    INSERT INTO HrVacationPolicies (CompanyId, MinYearsService, MaxYearsService, DaysGranted) VALUES
        (NEW.Id, 1, 4, 14),
        (NEW.Id, 5, NULL, 18);

    INSERT INTO HrLeaveTypes (CompanyId, Code, Name, IsPaid, RequiresAttachment, MaxDaysPerYear, Unit) VALUES
        (NEW.Id, 'LIC-MED', 'Licencia Médica / Incapacidad Común', TRUE, TRUE, 90, 'Dias'),
        (NEW.Id, 'LIC-MAT', 'Licencia de Maternidad (Pre y Post natal)', TRUE, TRUE, 98, 'Dias'),
        (NEW.Id, 'LIC-PAT', 'Licencia de Paternidad', TRUE, TRUE, 2, 'Dias'),
        (NEW.Id, 'LIC-MATR', 'Permiso por Matrimonio', TRUE, FALSE, 3, 'Dias'),
        (NEW.Id, 'LIC-DUELO', 'Permiso por Duelo / Fallecimiento Familiar', TRUE, FALSE, 3, 'Dias'),
        (NEW.Id, 'PER-HORAS', 'Permiso Personal por Horas', TRUE, FALSE, 16, 'Horas'),
        (NEW.Id, 'PER-NOGOCE', 'Permiso sin Goce de Sueldo', FALSE, FALSE, 30, 'Dias')
    ON CONFLICT (CompanyId, Code) DO NOTHING;

    -- Vacaciones: Supervisor -> Director de RRHH (o Company Admin)
    INSERT INTO HrApprovalFlows (CompanyId, RequestType, Name, Description)
    VALUES (NEW.Id, 'Vacaciones', 'Flujo Estándar de Vacaciones', 'Aprobación de 2 etapas: Supervisor inmediato y Dirección de RRHH')
    RETURNING Id INTO v_FlowId;
    SELECT r.Id INTO v_RoleId FROM Roles r WHERE r.Name IN ('Director de RRHH', 'Company Admin')
        ORDER BY CASE WHEN r.Name = 'Director de RRHH' THEN 1 ELSE 2 END LIMIT 1;
    INSERT INTO HrApprovalSteps (FlowId, StepNumber, Name, ApproverType, ApproverRoleId) VALUES
        (v_FlowId, 1, 'Aprobación de Supervisor Inmediato', 'Supervisor', NULL),
        (v_FlowId, 2, 'Validación de Recursos Humanos', 'Role', v_RoleId);

    INSERT INTO HrApprovalFlows (CompanyId, RequestType, Name, Description)
    VALUES (NEW.Id, 'Permiso', 'Flujo Estándar de Permisos y Licencias', 'Aprobación del Supervisor inmediato')
    RETURNING Id INTO v_FlowId;
    INSERT INTO HrApprovalSteps (FlowId, StepNumber, Name, ApproverType)
    VALUES (v_FlowId, 1, 'Aprobación de Supervisor', 'Supervisor');

    INSERT INTO HrApprovalFlows (CompanyId, RequestType, Name, Description)
    VALUES (NEW.Id, 'CorreccionAsistencia', 'Flujo de Corrección de Asistencia', 'Revisión y autorización del Encargado / Supervisor')
    RETURNING Id INTO v_FlowId;
    INSERT INTO HrApprovalSteps (FlowId, StepNumber, Name, ApproverType)
    VALUES (v_FlowId, 1, 'Revisión de Marca Horaria', 'Supervisor');

    RETURN NEW;
END;
$$;

CREATE TRIGGER TR_Companies_SeedDefaults
    AFTER INSERT ON Companies
    FOR EACH ROW EXECUTE FUNCTION fn_SeedCompanyDefaults();
