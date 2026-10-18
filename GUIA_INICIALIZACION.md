# Guía de Inicialización y Puesta en Marcha — Kinetix Core

Esta documentación contiene la guía detallada paso a paso para instalar, configurar, inicializar la base de datos, ejecutar migraciones y poner en marcha el entorno de desarrollo y producción de **Kinetix Core**.

---

## 📋 1. Requisitos Previos del Sistema

Antes de iniciar la instalación, asegúrate de contar con los siguientes elementos instalados en tu sistema:

1. **Node.js**: Versión 18.0.0 o superior (con soporte nativo para ES Modules).
   - Verificación en terminal: `node -v`
2. **Motor de Base de Datos SQL Server**:
   - SQL Server LocalDB (`(localdb)\MSSQLLocalDB`), SQL Server Express o SQL Server Standard/Enterprise.
3. **ODBC Driver for SQL Server**:
   - **ODBC Driver 18 for SQL Server** (Obligatorio para conexiones en Windows mediante el driver nativo `msnodesqlv8`).
4. **Herramienta de Gestión SQL** (Opcional pero recomendada):
   - SQL Server Management Studio (SSMS), Azure Data Studio, o la utilidad de línea de comandos `sqlcmd`.

---

## 📁 2. Estructura Principal del Proyecto

```text
Kinetix/
├── server.js                      # Servidor backend Express y API REST Core
├── package.json                   # Dependencias, scripts ejecutables y suites de prueba
├── .env                           # Variables de entorno locales (Privado / No compartir)
├── .env.example                   # Plantilla oficial de variables de entorno
├── database/                      # Esquemas SQL y migraciones versionadas
│   ├── kinetix_core.sql           # Script de creación de base de datos base
│   └── migrations/                # Migraciones SQL idempotentes versionadas (001 a 004)
├── server/                        # Backend modularizado por dominios
│   └── modules/
│       └── hr/                    # Módulo desacoplado de Recursos Humanos (Fases 1 y 2)
├── public/                        # Directorio raíz estático servido por Express
│   ├── index.html                 # Shell HTML de la SPA con viewport y fuentes
│   ├── styles.css                 # Sistema de diseño "Kinetic Precision"
│   └── js/                        # Arquitectura frontend modular (ES Modules)
│       ├── app.js                 # Punto de entrada de la aplicación SPA
│       ├── core/                  # Enrutador, API client, gestión de estado y sesión
│       ├── components/            # UI, modales, formularios, tablas, badges
│       └── views/                 # Vistas agrupadas por dominio (admin, hr, dashboard, etc.)
└── scripts/                       # Herramientas de soporte, migraciones y pruebas automatizadas
```

---

## ⚡ 3. Paso a Paso para la Inicialización

### Paso 1: Instalación de Dependencias

Abre una terminal de PowerShell en el directorio raíz del proyecto:

```powershell
cd c:\Users\hidek\Desktop\Git\Kinetix
npm install
```

---

### Paso 2: Configuración del Archivo `.env`

Copia el archivo `.env.example` para generar tu archivo `.env` local:

```powershell
Copy-Item .env.example .env
```

Abre `.env` y ajusta los parámetros de conexión según tu configuración de SQL Server:

#### Opción A: Conexión con LocalDB (Autenticación Windows) — *Recomendada para Desarrollo Local*
```env
DB_SERVER=(localdb)\MSSQLLocalDB
DB_DATABASE=KinetixCore
DB_AUTH=windows
DB_TRUST_SERVER_CERTIFICATE=true
PORT=3000
```

#### Opción B: Conexión con SQL Server (Autenticación SQL con Usuario/Contraseña)
```env
DB_SERVER=localhost
DB_PORT=1433
DB_DATABASE=KinetixCore
DB_AUTH=sql
DB_USER=sa
DB_PASSWORD=TuContraseñaSegura123!
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true
PORT=3000
```

---

### Paso 3: Inicialización de la Base de Datos SQL

Ejecuta el script SQL `database/kinetix_core.sql` para crear la base de datos `KinetixCore` y sus tablas estructurales (`Companies`, `Branches`, `UserOrganizations`, `Roles`, `Permissions`, `AuditLogs`).

#### Mediante `sqlcmd` (PowerShell):
```powershell
sqlcmd -S "(localdb)\MSSQLLocalDB" -i "database\kinetix_core.sql"
```

#### Mediante SSMS o Azure Data Studio:
1. Conéctate a tu instancia SQL Server o `(localdb)\MSSQLLocalDB`.
2. Abre el archivo `database/kinetix_core.sql`.
3. Ejecuta el script (**F5**).

---

### Paso 4: Aplicación de Migraciones Idempotentes

Kinetix cuenta con un motor de migraciones versionadas que prepara la base de datos para todas las funciones avanzadas:

```powershell
npm run migrate
```

Este comando aplica automáticamente en orden secuencial:
- **`001_core_audit_hardening.sql`**: Trigger inmutable `TR_AuditLogs_Immutable` e índices de auditoría.
- **`002_hr_core.sql`**: Fase 1 de RRHH (Empleados, Departamentos, Cargos, Historial y Documentos).
- **`003_hr_approvals_notifications.sql`**: Fase 2 de RRHH (Motor de aprobación multietapa y notificaciones internas).
- **`004_hr_attendance_vacations.sql`**: Fase 2 de RRHH (Turnos laborales, marcas de asistencia, saldo legal y calendario de vacaciones).

---

### Paso 5: Creación de Usuarios Iniciales

El sistema incluye scripts seguros para aprovisionar los usuarios administradores:

#### Crear Usuario Super Admin:
Establece la variable `NEW_SUPER_ADMIN_PASSWORD` (mínimo 10 caracteres) y ejecuta:

```powershell
$env:NEW_SUPER_ADMIN_PASSWORD="SuperAdminPassword123!"
node scripts/create-super-admin.mjs
```

#### Crear Usuario Administrador de Empresa:
Establece la variable `NEW_USER_PASSWORD` y ejecuta:

```powershell
$env:NEW_USER_PASSWORD="AdminPassword123!"
node scripts/create-user.mjs
```

---

### Paso 6: Verificación y Pruebas Automatizadas

Antes de iniciar el servicio, verifica la integridad del código ejecutando la suite de pruebas:

```powershell
# 1. Comprobación de sintaxis
npm run check

# 2. Pruebas de RRHH Fase 1
npm run test:phase1

# 3. Pruebas de RRHH Fase 2
npm run test:phase2

# 4. Pruebas de Integración HTTP End-to-End
npm run test:usage

# 5. Pruebas de Gestión de Roles y Permisos Dinámicos
node scripts/test-roles.mjs

# O todas las pruebas en un solo comando:
npm test
```

---

### Paso 7: Arrancar la Aplicación

#### Modo Desarrollo:
```powershell
npm run dev
```

#### Modo Producción:
```powershell
npm start
```

---

## 🌐 4. Acceso y Verificación

Una vez que el servidor esté en ejecución:

* **Aplicación Web**: [http://localhost:3000](http://localhost:3000)
* **Health Check API**: [http://localhost:3000/api/health](http://localhost:3000/api/health) — Debe responder `{"connected": true, "databaseName": "KinetixCore"}`.

---

## 🚨 5. Solución de Problemas Frecuentes (Troubleshooting)

| Problema | Causa Posible | Solución |
|---|---|---|
| `Driver={ODBC Driver 18 for SQL Server} not found` | Falta el driver ODBC oficial en Windows. | Instala **Microsoft ODBC Driver 18 for SQL Server** desde el sitio oficial de Microsoft. |
| `Faltan DB_USER o DB_PASSWORD en .env` | `DB_AUTH=sql` pero no se configuraron credenciales. | Revisa tu archivo `.env` o cambia a `DB_AUTH=windows` si usas LocalDB. |
| `Error: EADDRINUSE :::3000` | El puerto 3000 ya está en uso. | Modifica `PORT=3001` en tu `.env` o detén el proceso anterior. |
| `Error 401 en login o recuperación` | Sesión no inicializada o ruta protegida. | Verifica que las rutas de `/api/auth/*` estén autorizadas en la configuración del servidor. |
| `No existe una empresa activa para asociar usuario` | La base de datos no tiene datos base. | Ejecuta `database/kinetix_core.sql` o `scripts/create-user.mjs`. |
