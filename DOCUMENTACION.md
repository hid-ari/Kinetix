# Kinetix Core — Documentación Operativa y Arquitectura Técnica

Documentación técnica, arquitectura modular, flujos de datos y manual operativo de **Kinetix Core**.

---

## 1. Acceso Rápido y Entorno

- **Aplicación Web**: [http://localhost:3000](http://localhost:3000)
- **Health Check API**: [http://localhost:3000/api/health](http://localhost:3000/api/health)
- **Ruta de Trabajo**: `c:\Users\hidek\Desktop\Git\Kinetix`
- **Base de Datos**: `KinetixCore`
- **Motor SQL**: Microsoft SQL Server / LocalDB (`(localdb)\MSSQLLocalDB`)
- **Driver de Conexión**: `msnodesqlv8` (Windows Auth) o `mssql` nativo (SQL Auth)
- **Puerto por defecto**: `3000`

---

## 2. Estructura Arquitectónica del Proyecto

Kinetix Core implementa una arquitectura desacoplada de dos capas (Backend modular en Node.js + Frontend SPA en Vanilla JS con arquitectura de componentes y estado reactivo liviano):

```text
Kinetix/
├── server.js                      # Servidor Express, middleware de seguridad, sesiones y Core API
├── package.json                   # Dependencias, scripts de testing y migración
├── .env                           # Variables de entorno locales (Excluido de Git)
├── .env.example                   # Plantilla de configuración de variables de entorno
├── database/                      # Esquemas SQL y migraciones versionadas
│   ├── kinetix_core.sql           # Esquema base (Empresas, Usuarios, Sucursales, Roles)
│   └── migrations/                # Migraciones idempotentes versionadas
│       ├── 001_core_audit_hardening.sql       # Trigger de inmutabilidad en AuditLogs
│       ├── 002_hr_core.sql                    # Fase 1 RRHH: Empleados, Departamentos, Cargos
│       ├── 003_hr_approvals_notifications.sql # Fase 2: Flujos multietapa y notificaciones
│       └── 004_hr_attendance_vacations.sql    # Fase 2: Asistencia, turnos, ponches y vacaciones
├── server/                        # Módulos desacoplados del backend
│   └── modules/
│       └── hr/                    # Módulo integral de Recursos Humanos
│           ├── index.js           # Registro y montaje del router en /api/hr
│           ├── access.js          # Control de acceso y verificación de permisos
│           ├── employee-context.js# Vinculación usuario-empleado en sesión
│           ├── migrate.js         # Ejecutor de migraciones de RRHH
│           ├── storage.js         # Almacenamiento seguro y versionado de documentos
│           ├── validators.js      # Validación de cédula (Luhn), salarios, etc.
│           ├── repositories/      # Capa de acceso a datos SQL (Data Access Layer)
│           │   ├── approvals.repo.js
│           │   ├── attendance.repo.js
│           │   ├── departments.repo.js
│           │   ├── documents.repo.js
│           │   ├── employees.repo.js
│           │   ├── notifications.repo.js
│           │   ├── orgchart.repo.js
│           │   ├── positions.repo.js
│           │   └── vacations.repo.js
│           ├── routes/            # Controladores y definición de endpoints REST
│           │   ├── approvals.routes.js
│           │   ├── attendance.routes.js
│           │   ├── catalogs.routes.js
│           │   ├── dashboard.routes.js
│           │   ├── departments.routes.js
│           │   ├── documents.routes.js
│           │   ├── employees.routes.js
│           │   ├── notifications.routes.js
│           │   ├── orgchart.routes.js
│           │   ├── positions.routes.js
│           │   └── vacations.routes.js
│           └── services/          # Lógica de negocio (Business Logic Layer)
│               ├── approval-engine.service.js
│               ├── attendance.service.js
│               ├── notification.service.js
│               ├── pdf.service.js
│               └── vacation-balance.service.js
├── public/                        # Raíz estática del Frontend SPA
│   ├── index.html                 # Shell HTML con viewport responsive y tipografía Inter
│   ├── styles.css                 # Sistema de diseño "Kinetic Precision" (Tokens HSL, Dark Mode)
│   └── js/                        # Código frontend modular en ES Modules
│       ├── app.js                 # Inicializador del SPA, enrutador y render principal
│       ├── core/                  # Núcleo del frontend
│       │   ├── api.js             # Cliente HTTP, carga optimizada de datos y caché
│       │   ├── auth.js            # Control de sesión, permisos y estado de usuario
│       │   ├── events.js          # Bus global de eventos y suscripciones
│       │   ├── router.js          # Manejo de rutas SPA hash-based (#/ruta)
│       │   └── state.js           # Almacén reactivo de estado en memoria
│       ├── components/            # Componentes visuales reutilizables
│       │   ├── alerts.js          # Notificaciones toast y mensajes del sistema
│       │   ├── forms.js           # Controles de formulario, inputs y validadores
│       │   ├── modal.js           # Ventanas modales accesibles con foco
│       │   ├── tables.js          # Tablas con paginación, filtros y ordenamiento
│       │   └── ui.js              # Navbar, Sidebar, Badges, Botones y Shell
│       └── views/                 # Vistas agrupadas por dominio funcional
│           ├── admin/             # Empresas, Usuarios, Sucursales, Roles, Permisos, Auditoría
│           ├── auth/              # Login, Recuperación de Contraseña, Perfil
│           ├── dashboard/         # Dashboard Ejecutivo general
│           ├── finance/           # Módulo de Finanzas (Cuentas, Gastos, Presupuesto)
│           ├── hr/                # Módulo RRHH (Empleados, Asistencia, Vacaciones, Aprobaciones)
│           └── inventory/         # Módulo de Inventario (Productos, Almacenes, Movimientos)
├── scripts/                       # Herramientas de automatización y testing
│   ├── clean-database.mjs         # Reset y limpieza controlada de base de datos
│   ├── create-super-admin.mjs     # Aprovisionamiento seguro del Super Admin
│   ├── create-user.mjs            # Aprovisionamiento seguro de administradores
│   ├── run-migrations.mjs         # Ejecutor manual de todas las migraciones SQL
│   ├── sql-query.mjs              # Utilidad CLI para consultas SQL rápidas
│   ├── test-hr-phase1.mjs         # Pruebas automatizadas RRHH Fase 1
│   ├── test-hr-phase2.mjs         # Pruebas automatizadas RRHH Fase 2
│   ├── test-hr-usage.mjs          # Pruebas de integración HTTP End-to-End
│   └── test-roles.mjs             # Pruebas completas de Roles y Permisos dinámicos
└── storage/                       # Almacenamiento seguro en disco (Documentos y expedientes)
```

---

## 3. Guía de Instalación y Puesta en Marcha

### Requisitos Previos:
- **Node.js**: v18.0.0 o superior con soporte ES Modules (`"type": "module"`).
- **SQL Server**: LocalDB, Express, Standard o Enterprise.
- **ODBC Driver 18 for SQL Server**: Obligatorio en entornos Windows con autenticación integrada.

### Pasos de Ejecución:

```powershell
# 1. Posicionarse en el directorio del proyecto
cd c:\Users\hidek\Desktop\Git\Kinetix

# 2. Instalar dependencias
npm install

# 3. Comprobar sintaxis
npm run check

# 4. Ejecutar migraciones de base de datos
npm run migrate

# 5. Ejecutar la suite completa de pruebas
npm run test
node scripts/test-roles.mjs

# 6. Iniciar el servidor en modo desarrollo
npm run dev
```

---

## 4. Configuración de Entorno (`.env`)

### LocalDB con Autenticación de Windows (Recomendado para Desarrollo):
```env
DB_SERVER=(localdb)\MSSQLLocalDB
DB_DATABASE=KinetixCore
DB_AUTH=windows
DB_TRUST_SERVER_CERTIFICATE=true
PORT=3000
```

### SQL Server con Autenticación SQL:
```env
DB_SERVER=localhost
DB_PORT=1433
DB_DATABASE=KinetixCore
DB_AUTH=sql
DB_USER=sa
DB_PASSWORD=TuPasswordSeguro123!
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true
PORT=3000
```

---

## 5. Módulo de Recursos Humanos (Fases 1 y 2)

El módulo de Recursos Humanos proporciona una solución de nivel empresarial adaptada a la legislación dominicana (Código de Trabajo de la Rep. Dom. y Ley 87-01).

### 5.1. Estructura y Vistas de RRHH

| Vista | Ruta SPA | Descripción |
|---|---|---|
| **Dashboard de Recursos Humanos** | `#/hr-dashboard` | Métricas ejecutivas, nómina consolidada, distribución por departamento y cumpleaños. |
| **Directorio de Colaboradores** | `#/hr-employees` | Listado paginado con búsqueda, filtros, badges cromáticos y exportación a CSV. |
| **Expediente Digital** | `#/hr-employee-detail` | Ficha personal, reposición de contratos/certificados, historial laboral y dossier PDF. |
| **Formulario de Empleado** | `#/hr-employee-form` | Alta/edición con validación Luhn de cédula y código correlativo `EMP-00001`. |
| **Terminal de Asistencia** | `#/hr-attendance` | Ponche de entrada/salida geolocalizado, cálculo de tardanzas y horas extras. |
| **Gestión de Vacaciones** | `#/hr-vacations` | Escala legal (Art. 177: 14 y 18 días), solicitud de permisos y calendario laboral. |
| **Bandeja de Aprobaciones** | `#/hr-approvals` | Flujos multietapa, resolución individual o masiva con notas de auditoría. |
| **Portal del Colaborador** | `#/hr-portal` | Autoservicio: marcaje rápido, consulta de balances, solicitudes y notificaciones. |
| **Departamentos y Árbol** | `#/hr-departments` | Jerarquía organizacional con prevención estricta de ciclos recursivos. |
| **Cargos y Compensación** | `#/hr-positions` | Niveles jerárquicos y bandas salariales en DOP (mínimo vs máximo). |
| **Organigrama Interactivo** | `#/hr-orgchart` | Diagrama en árbol con directores de área y personal asignado. |

### 5.2. Servicios y Reglas de Negocio de RRHH

1. **Inmutabilidad de Auditoría (`TR_AuditLogs_Immutable`)**:
   - Bloqueo total de sentencias `UPDATE` y `DELETE` sobre `dbo.AuditLogs`.
2. **Validación Algorítmica de Cédula Dominicana**:
   - Algoritmo de Luhn (módulo 10) para cédulas dominicanas (11 dígitos).
3. **Escala Legal de Vacaciones (Art. 177 CT-RD)**:
   - Antigüedad < 1 año: proporcional según meses de servicio.
   - Antigüedad de 1 a 5 años: 14 días laborables remunerados.
   - Antigüedad > 5 años: 18 días laborables remunerados.
4. **Motor de Aprobaciones Multinivel**:
   - Etapa 1: Supervisor inmediato del colaborador.
   - Etapa 2: Gerente de Departamento o Director de RRHH.
   - Fallback automático si el supervisor no está asignado o es el solicitante.
   - Prohibición estricta de auto-aprobación (`403 Forbidden`).
5. **Ofuscación y Protección Salarial**:
   - Usuarios sin el permiso explícito reciben cédulas ofuscadas (`40*********1-2`), teléfonos protegidos (`809***1234`) y salarios enmascarados.

---

## 6. Endpoints REST de la API

### Rutas Base y Autenticación
| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/health` | Estado del servidor y conectividad con la base de datos |
| `POST` | `/api/auth/login` | Autenticación con cookie `HttpOnly` |
| `POST` | `/api/auth/logout` | Cierre de sesión y revocación de token |
| `GET` | `/api/profile` | Datos del usuario y roles de la sesión actual |
| `PUT` | `/api/profile` | Actualización de perfil personal |
| `POST` | `/api/auth/change-password` | Cambio seguro de contraseña |
| `POST` | `/api/auth/forgot-password` | Solicitud de restablecimiento de contraseña |
| `POST` | `/api/auth/reset-password` | Aplicación de token de restablecimiento |

### Administración y Seguridad
| Método | Endpoint | Descripción |
|---|---|---|
| `GET` / `POST` | `/api/companies` | Gestión de empresas |
| `PUT` / `PATCH` | `/api/companies/:id` | Modificación y activación/desactivación de empresas |
| `GET` / `POST` | `/api/users` | Gestión de usuarios de la organización |
| `PUT` / `PATCH` | `/api/users/:id` | Actualización y estado de usuarios |
| `GET` / `POST` | `/api/roles` | Catálogo de roles (protección de roles esenciales del sistema) |
| `PUT` / `DELETE` | `/api/roles/:id` | Modificación y eliminación de roles personalizados |
| `GET` | `/api/permissions` | Catálogo completo de 55 permisos del sistema |
| `GET` / `PUT` | `/api/roles/:id/permissions` | Consulta y asignación granular de permisos a roles |
| `GET` | `/api/audit` | Trazabilidad con filtros por texto, módulo y acción |

### Recursos Humanos (`/api/hr/*`)
| Método | Endpoint | Descripción |
|---|---|---|
| `GET` | `/api/hr/dashboard` | Indicadores clave (KPIs), métricas y nómina |
| `GET` | `/api/hr/catalogs` | Catálogos unificados de RRHH |
| `GET` / `POST` | `/api/hr/employees` | Listado paginado y alta transaccional de colaboradores |
| `GET` / `PUT` | `/api/hr/employees/:id` | Detalle y edición de colaborador |
| `GET` | `/api/hr/employees/:id/pdf` | Streaming de expediente oficial en PDF |
| `GET` | `/api/hr/employees/:id/history` | Historial inmutable de movimientos laborales |
| `POST` | `/api/hr/employees/:id/salary` | Modificación auditada de compensación salarial |
| `POST` | `/api/hr/employees/:id/promote` | Registro de ascenso de cargo |
| `POST` | `/api/hr/employees/:id/transfer`| Reubicación de departamento o sucursal |
| `POST` | `/api/hr/employees/:id/terminate`| Desvinculación laboral con motivo registrado |
| `GET` / `POST` | `/api/hr/employees/:id/documents`| Carga y gestión documental de expedientes |
| `GET` | `/api/hr/documents/:id/download`| Descarga con control de confidencialidad |
| `GET` / `POST` | `/api/hr/attendance/today` | Consulta de turno y ponche de entrada/salida |
| `POST` | `/api/hr/attendance/requests`| Solicitud de justificación o corrección de marca |
| `GET` | `/api/hr/vacations/balance` | Saldo legal y disponible de vacaciones |
| `POST` | `/api/hr/vacations/requests`| Solicitud de período vacacional |
| `GET` / `POST` | `/api/hr/leaves/requests` | Registro y solicitud de permisos/licencias |
| `GET` | `/api/hr/approvals/pending` | Bandeja de solicitudes pendientes de aprobación |
| `POST` | `/api/hr/approvals/:id/step`| Aprobación o rechazo de etapa de flujo |
| `GET` | `/api/hr/notifications` | Notificaciones in-app del colaborador |
| `PATCH`| `/api/hr/notifications/:id/read`| Marcado de notificación como leída |

---

## 7. Sistema de Diseño Visual "Kinetic Precision"

El sistema de diseño visual corporativo se encuentra unificado en `public/styles.css`. Para consultar la especificación exhaustiva de tokens, paleta cromática, tipografía, componentes y reglas de interfaz, consulte [LINEA_GRAFICA.md](LINEA_GRAFICA.md).

Características principales:
- **Paleta Cromática Semántica**: Tokens CSS institucionales y semánticos (`--royal`, `--emerald`, `--amber`, `--red`, `--purple`, etc.).
- **Jerarquía Tipográfica**: Combinación de `Inter` (cuerpo e interfaz) y `Plus Jakarta Sans` (display y marcas).
- **Micro-interacciones y Animaciones**: Transiciones de 150ms-250ms con curvas cúbicas suaves, efectos hover y elevaciones consistentes.
- **Contraste y Legibilidad**: Navegación lateral en Deep Obsidian y espacio de trabajo de alta luminosidad.
- **Totalmente Responsive**: Soporte completo para dispositivos móviles, tablets y monitores de alta resolución.

---

## 8. Verificación y Testing Automatizado

Kinetix cuenta con una suite completa de pruebas automáticas:

```powershell
# 1. Chequeo de sintaxis
npm run check

# 2. Pruebas de RRHH Fase 1 (Cédula, Inmutabilidad, Correlativos, Privacidad)
npm run test:phase1

# 3. Pruebas de RRHH Fase 2 (Asistencia, Vacaciones, Aprobaciones, Notificaciones)
npm run test:phase2

# 4. Pruebas de integración HTTP End-to-End
npm run test:usage

# 5. Pruebas de Roles y Permisos Dinámicos
node scripts/test-roles.mjs

# 6. Ejecución unificada de pruebas
npm test
```
