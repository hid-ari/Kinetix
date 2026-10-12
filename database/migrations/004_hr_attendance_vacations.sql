/*
  Migración 004 — Control de Asistencia, Turnos, Vacaciones y Licencias (Kinetix Core RRHH)
  - Gestión de turnos y horarios laborales con tolerancias y días laborables.
  - Registro de asistencia (Check-in, Check-out, tardanzas, salidas anticipadas, horas extras).
  - Solicitudes de corrección de marcas horarias.
  - Políticas y saldos de vacaciones con base en el Código de Trabajo de la Rep. Dominicana.
  - Tipos de licencias y permisos (maternidad, paternidad, médica, duelo, matrimonio).
  Idempotente: puede ejecutarse múltiples veces sin errores.
*/

-- 1. Turnos y Horarios Laborales
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'HrWorkShifts')
BEGIN
    CREATE TABLE dbo.HrWorkShifts (
        Id                  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HrWorkShifts PRIMARY KEY,
        CompanyId           INT NOT NULL CONSTRAINT FK_HrWorkShifts_Companies FOREIGN KEY REFERENCES dbo.Companies(Id),
        Code                NVARCHAR(30) NOT NULL,
        Name                NVARCHAR(100) NOT NULL,
        ShiftType           NVARCHAR(30) NOT NULL CONSTRAINT DF_HrWorkShifts_Type DEFAULT N'Regular'
                            CONSTRAINT CK_HrWorkShifts_Type CHECK (ShiftType IN (N'Regular', N'Rotativo', N'Nocturno', N'Especial')),
        StartTime           TIME(0) NOT NULL,
        EndTime             TIME(0) NOT NULL,
        GraceMinutes        INT NOT NULL CONSTRAINT DF_HrWorkShifts_Grace DEFAULT 15,
        BreakMinutes        INT NOT NULL CONSTRAINT DF_HrWorkShifts_Break DEFAULT 60,
        WorkDaysMask        VARCHAR(7) NOT NULL CONSTRAINT DF_HrWorkShifts_Days DEFAULT '1111100', -- Lun a Dom (1=Laborable, 0=Descanso)
        IsActive            BIT NOT NULL CONSTRAINT DF_HrWorkShifts_IsActive DEFAULT 1,
        CreatedAt           DATETIME2(0) NOT NULL CONSTRAINT DF_HrWorkShifts_CreatedAt DEFAULT SYSUTCDATETIME()
    );

    CREATE INDEX IX_HrWorkShifts_Company ON dbo.HrWorkShifts (CompanyId, IsActive);
END
GO

-- 2. Asignación de Turnos a Empleados
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'HrEmployeeShifts')
BEGIN
    CREATE TABLE dbo.HrEmployeeShifts (
        Id                  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HrEmployeeShifts PRIMARY KEY,
        EmployeeId          INT NOT NULL CONSTRAINT FK_HrEmployeeShifts_Employee FOREIGN KEY REFERENCES dbo.HrEmployees(Id),
        ShiftId             INT NOT NULL CONSTRAINT FK_HrEmployeeShifts_Shift FOREIGN KEY REFERENCES dbo.HrWorkShifts(Id),
        EffectiveDate       DATE NOT NULL,
        IsActive            BIT NOT NULL CONSTRAINT DF_HrEmployeeShifts_IsActive DEFAULT 1,
        CreatedAt           DATETIME2(0) NOT NULL CONSTRAINT DF_HrEmployeeShifts_CreatedAt DEFAULT SYSUTCDATETIME()
    );

    CREATE INDEX IX_HrEmployeeShifts_Employee ON dbo.HrEmployeeShifts (EmployeeId, IsActive, EffectiveDate DESC);
END
GO

-- 3. Registro Diario de Asistencia
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'HrAttendance')
BEGIN
    CREATE TABLE dbo.HrAttendance (
        Id                  BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HrAttendance PRIMARY KEY,
        CompanyId           INT NOT NULL CONSTRAINT FK_HrAttendance_Companies FOREIGN KEY REFERENCES dbo.Companies(Id),
        EmployeeId          INT NOT NULL CONSTRAINT FK_HrAttendance_Employee FOREIGN KEY REFERENCES dbo.HrEmployees(Id),
        WorkDate            DATE NOT NULL,
        ShiftId             INT NULL CONSTRAINT FK_HrAttendance_Shift FOREIGN KEY REFERENCES dbo.HrWorkShifts(Id),
        CheckInTime         DATETIME2(0) NULL,
        CheckOutTime        DATETIME2(0) NULL,
        LateMinutes         INT NOT NULL CONSTRAINT DF_HrAttendance_Late DEFAULT 0,
        EarlyLeaveMinutes   INT NOT NULL CONSTRAINT DF_HrAttendance_Early DEFAULT 0,
        RegularMinutes      INT NOT NULL CONSTRAINT DF_HrAttendance_Regular DEFAULT 0,
        OvertimeMinutes     INT NOT NULL CONSTRAINT DF_HrAttendance_Overtime DEFAULT 0,
        Status              NVARCHAR(30) NOT NULL CONSTRAINT DF_HrAttendance_Status DEFAULT N'Presente'
                            CONSTRAINT CK_HrAttendance_Status CHECK (Status IN (N'Presente', N'Tardanza', N'Ausencia', N'SalidaAnticipada', N'Permiso', N'Vacaciones', N'Feriado', N'Descanso')),
        Notes               NVARCHAR(500) NULL,
        CreatedAt           DATETIME2(0) NOT NULL CONSTRAINT DF_HrAttendance_CreatedAt DEFAULT SYSUTCDATETIME(),
        UpdatedAt           DATETIME2(0) NULL,
        CONSTRAINT UQ_HrAttendance_Employee_Date UNIQUE (EmployeeId, WorkDate)
    );

    CREATE INDEX IX_HrAttendance_Search ON dbo.HrAttendance (CompanyId, WorkDate, Status);
    CREATE INDEX IX_HrAttendance_Employee ON dbo.HrAttendance (EmployeeId, WorkDate DESC);
END
GO

-- 4. Solicitudes de Corrección de Asistencia
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'HrAttendanceCorrections')
BEGIN
    CREATE TABLE dbo.HrAttendanceCorrections (
        Id                  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HrAttendanceCorrections PRIMARY KEY,
        AttendanceId        BIGINT NULL CONSTRAINT FK_HrAttendanceCorrections_Attendance FOREIGN KEY REFERENCES dbo.HrAttendance(Id),
        EmployeeId          INT NOT NULL CONSTRAINT FK_HrAttendanceCorrections_Employee FOREIGN KEY REFERENCES dbo.HrEmployees(Id),
        WorkDate            DATE NOT NULL,
        OriginalCheckIn     DATETIME2(0) NULL,
        OriginalCheckOut    DATETIME2(0) NULL,
        RequestedCheckIn    DATETIME2(0) NULL,
        RequestedCheckOut   DATETIME2(0) NULL,
        Reason              NVARCHAR(500) NOT NULL,
        ApprovalRequestId   INT NULL CONSTRAINT FK_HrAttendanceCorrections_Approval FOREIGN KEY REFERENCES dbo.HrApprovalRequests(Id),
        Status              NVARCHAR(30) NOT NULL CONSTRAINT DF_HrAttendanceCorrections_Status DEFAULT N'Pendiente'
                            CONSTRAINT CK_HrAttendanceCorrections_Status CHECK (Status IN (N'Pendiente', N'Aprobada', N'Rechazada', N'Cancelada')),
        CreatedAt           DATETIME2(0) NOT NULL CONSTRAINT DF_HrAttendanceCorrections_CreatedAt DEFAULT SYSUTCDATETIME()
    );

    CREATE INDEX IX_HrAttendanceCorrections_Emp ON dbo.HrAttendanceCorrections (EmployeeId, Status);
END
GO

-- 5. Políticas de Vacaciones (Escala Dominicana)
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'HrVacationPolicies')
BEGIN
    CREATE TABLE dbo.HrVacationPolicies (
        Id                  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HrVacationPolicies PRIMARY KEY,
        CompanyId           INT NOT NULL CONSTRAINT FK_HrVacationPolicies_Companies FOREIGN KEY REFERENCES dbo.Companies(Id),
        MinYearsService     INT NOT NULL,
        MaxYearsService     INT NULL,
        DaysGranted         INT NOT NULL,
        CreatedAt           DATETIME2(0) NOT NULL CONSTRAINT DF_HrVacationPolicies_CreatedAt DEFAULT SYSUTCDATETIME()
    );

    CREATE INDEX IX_HrVacationPolicies_Company ON dbo.HrVacationPolicies (CompanyId);
END
GO

-- 6. Saldos Anuales de Vacaciones por Colaborador
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'HrVacationBalances')
BEGIN
    CREATE TABLE dbo.HrVacationBalances (
        Id                  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HrVacationBalances PRIMARY KEY,
        EmployeeId          INT NOT NULL CONSTRAINT FK_HrVacationBalances_Employee FOREIGN KEY REFERENCES dbo.HrEmployees(Id),
        PeriodYear          INT NOT NULL,
        DaysEarned          DECIMAL(5,1) NOT NULL CONSTRAINT DF_HrVacationBalances_Earned DEFAULT 14.0,
        DaysUsed            DECIMAL(5,1) NOT NULL CONSTRAINT DF_HrVacationBalances_Used DEFAULT 0.0,
        DaysPending         DECIMAL(5,1) NOT NULL CONSTRAINT DF_HrVacationBalances_Pending DEFAULT 0.0,
        UpdatedAt           DATETIME2(0) NOT NULL CONSTRAINT DF_HrVacationBalances_UpdatedAt DEFAULT SYSUTCDATETIME(),
        CONSTRAINT UQ_HrVacationBalances_Employee_Year UNIQUE (EmployeeId, PeriodYear)
    );

    CREATE INDEX IX_HrVacationBalances_Employee ON dbo.HrVacationBalances (EmployeeId);
END
GO

-- 7. Solicitudes de Vacaciones
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'HrVacationRequests')
BEGIN
    CREATE TABLE dbo.HrVacationRequests (
        Id                  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HrVacationRequests PRIMARY KEY,
        CompanyId           INT NOT NULL CONSTRAINT FK_HrVacationRequests_Companies FOREIGN KEY REFERENCES dbo.Companies(Id),
        EmployeeId          INT NOT NULL CONSTRAINT FK_HrVacationRequests_Employee FOREIGN KEY REFERENCES dbo.HrEmployees(Id),
        StartDate           DATE NOT NULL,
        EndDate             DATE NOT NULL,
        ReturnDate          DATE NULL,
        DaysRequested       INT NOT NULL,
        Reason              NVARCHAR(500) NULL,
        ApprovalRequestId   INT NULL CONSTRAINT FK_HrVacationRequests_Approval FOREIGN KEY REFERENCES dbo.HrApprovalRequests(Id),
        Status              NVARCHAR(30) NOT NULL CONSTRAINT DF_HrVacationRequests_Status DEFAULT N'Pendiente'
                            CONSTRAINT CK_HrVacationRequests_Status CHECK (Status IN (N'Pendiente', N'Aprobada', N'Rechazada', N'Cancelada')),
        RejectionReason     NVARCHAR(500) NULL,
        CreatedAt           DATETIME2(0) NOT NULL CONSTRAINT DF_HrVacationRequests_CreatedAt DEFAULT SYSUTCDATETIME()
    );

    CREATE INDEX IX_HrVacationRequests_Search ON dbo.HrVacationRequests (CompanyId, EmployeeId, Status);
    CREATE INDEX IX_HrVacationRequests_Dates ON dbo.HrVacationRequests (StartDate, EndDate);
END
GO

-- 8. Tipos de Licencias y Permisos
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'HrLeaveTypes')
BEGIN
    CREATE TABLE dbo.HrLeaveTypes (
        Id                  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HrLeaveTypes PRIMARY KEY,
        CompanyId           INT NOT NULL CONSTRAINT FK_HrLeaveTypes_Companies FOREIGN KEY REFERENCES dbo.Companies(Id),
        Code                NVARCHAR(30) NOT NULL,
        Name                NVARCHAR(100) NOT NULL,
        IsPaid              BIT NOT NULL CONSTRAINT DF_HrLeaveTypes_IsPaid DEFAULT 1,
        RequiresAttachment  BIT NOT NULL CONSTRAINT DF_HrLeaveTypes_ReqAttach DEFAULT 0,
        MaxDaysPerYear      INT NULL,
        Unit                NVARCHAR(10) NOT NULL CONSTRAINT DF_HrLeaveTypes_Unit DEFAULT N'Dias'
                            CONSTRAINT CK_HrLeaveTypes_Unit CHECK (Unit IN (N'Dias', N'Horas')),
        IsActive            BIT NOT NULL CONSTRAINT DF_HrLeaveTypes_IsActive DEFAULT 1,
        CreatedAt           DATETIME2(0) NOT NULL CONSTRAINT DF_HrLeaveTypes_CreatedAt DEFAULT SYSUTCDATETIME()
    );

    CREATE INDEX IX_HrLeaveTypes_Company ON dbo.HrLeaveTypes (CompanyId, IsActive);
END
GO

-- 9. Solicitudes de Permisos y Licencias
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = N'HrLeaveRequests')
BEGIN
    CREATE TABLE dbo.HrLeaveRequests (
        Id                  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_HrLeaveRequests PRIMARY KEY,
        CompanyId           INT NOT NULL CONSTRAINT FK_HrLeaveRequests_Companies FOREIGN KEY REFERENCES dbo.Companies(Id),
        EmployeeId          INT NOT NULL CONSTRAINT FK_HrLeaveRequests_Employee FOREIGN KEY REFERENCES dbo.HrEmployees(Id),
        LeaveTypeId         INT NOT NULL CONSTRAINT FK_HrLeaveRequests_Type FOREIGN KEY REFERENCES dbo.HrLeaveTypes(Id),
        StartDate           DATE NOT NULL,
        EndDate             DATE NOT NULL,
        StartTime           TIME(0) NULL,
        EndTime             TIME(0) NULL,
        Unit                NVARCHAR(10) NOT NULL CONSTRAINT DF_HrLeaveRequests_Unit DEFAULT N'Dias'
                            CONSTRAINT CK_HrLeaveRequests_Unit CHECK (Unit IN (N'Dias', N'Horas')),
        Duration            DECIMAL(5,2) NOT NULL,
        Reason              NVARCHAR(500) NOT NULL,
        AttachedFileId      UNIQUEIDENTIFIER NULL CONSTRAINT FK_HrLeaveRequests_File FOREIGN KEY REFERENCES dbo.HrFiles(Id),
        ApprovalRequestId   INT NULL CONSTRAINT FK_HrLeaveRequests_Approval FOREIGN KEY REFERENCES dbo.HrApprovalRequests(Id),
        Status              NVARCHAR(30) NOT NULL CONSTRAINT DF_HrLeaveRequests_Status DEFAULT N'Pendiente'
                            CONSTRAINT CK_HrLeaveRequests_Status CHECK (Status IN (N'Pendiente', N'Aprobada', N'Rechazada', N'Cancelada')),
        RejectionReason     NVARCHAR(500) NULL,
        CreatedAt           DATETIME2(0) NOT NULL CONSTRAINT DF_HrLeaveRequests_CreatedAt DEFAULT SYSUTCDATETIME()
    );

    CREATE INDEX IX_HrLeaveRequests_Search ON dbo.HrLeaveRequests (CompanyId, EmployeeId, Status);
    CREATE INDEX IX_HrLeaveRequests_Dates ON dbo.HrLeaveRequests (StartDate, EndDate);
END
GO

-- 10. Sembrar Turnos por Defecto para cada Empresa
INSERT INTO dbo.HrWorkShifts (CompanyId, Code, Name, ShiftType, StartTime, EndTime, GraceMinutes, BreakMinutes, WorkDaysMask, IsActive)
SELECT c.Id, N'HOR-ESTANDAR', N'Jornada Completa Estándar (8:00 AM - 5:00 PM)', N'Regular', '08:00:00', '17:00:00', 15, 60, '1111100', 1
FROM dbo.Companies c
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.HrWorkShifts s WHERE s.CompanyId = c.Id AND s.Code = N'HOR-ESTANDAR'
);
GO

INSERT INTO dbo.HrWorkShifts (CompanyId, Code, Name, ShiftType, StartTime, EndTime, GraceMinutes, BreakMinutes, WorkDaysMask, IsActive)
SELECT c.Id, N'HOR-MEDIO', N'Media Jornada Matutina (8:00 AM - 1:00 PM)', N'Regular', '08:00:00', '13:00:00', 15, 0, '1111100', 1
FROM dbo.Companies c
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.HrWorkShifts s WHERE s.CompanyId = c.Id AND s.Code = N'HOR-MEDIO'
);
GO

-- 11. Sembrar Políticas de Vacaciones por Defecto (Código de Trabajo RD Art. 177)
INSERT INTO dbo.HrVacationPolicies (CompanyId, MinYearsService, MaxYearsService, DaysGranted)
SELECT c.Id, 1, 5, 14
FROM dbo.Companies c
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.HrVacationPolicies p WHERE p.CompanyId = c.Id AND p.MinYearsService = 1
);
GO

INSERT INTO dbo.HrVacationPolicies (CompanyId, MinYearsService, MaxYearsService, DaysGranted)
SELECT c.Id, 6, NULL, 18
FROM dbo.Companies c
WHERE NOT EXISTS (
    SELECT 1 FROM dbo.HrVacationPolicies p WHERE p.CompanyId = c.Id AND p.MinYearsService = 6
);
GO

-- 12. Sembrar Tipos de Permisos y Licencias por Defecto (Código de Trabajo RD)
MERGE dbo.HrLeaveTypes AS target
USING (
    SELECT c.Id AS CompanyId, v.Code, v.Name, v.IsPaid, v.RequiresAttachment, v.MaxDaysPerYear, v.Unit
    FROM dbo.Companies c
    CROSS JOIN (VALUES
        (N'LIC-MED', N'Licencia Médica / Incapacidad Común', 1, 1, 90, N'Dias'),
        (N'LIC-MAT', N'Licencia de Maternidad (Pre y Post natal)', 1, 1, 98, N'Dias'),
        (N'LIC-PAT', N'Licencia de Paternidad', 1, 1, 2, N'Dias'),
        (N'LIC-MATR', N'Permiso por Matrimonio', 1, 0, 3, N'Dias'),
        (N'LIC-DUELO', N'Permiso por Duelo / Fallecimiento Familiar', 1, 0, 3, N'Dias'),
        (N'PER-HORAS', N'Permiso Personal por Horas', 1, 0, 16, N'Horas'),
        (N'PER-NOGOCE', N'Permiso sin Goce de Sueldo', 0, 0, 30, N'Dias')
    ) AS v(Code, Name, IsPaid, RequiresAttachment, MaxDaysPerYear, Unit)
) AS source
ON target.CompanyId = source.CompanyId AND target.Code = source.Code
WHEN NOT MATCHED THEN
    INSERT (CompanyId, Code, Name, IsPaid, RequiresAttachment, MaxDaysPerYear, Unit, IsActive)
    VALUES (source.CompanyId, source.Code, source.Name, source.IsPaid, source.RequiresAttachment, source.MaxDaysPerYear, source.Unit, 1);
GO
