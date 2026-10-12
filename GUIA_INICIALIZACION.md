# Guía de Inicialización y Puesta en Marcha — Kinetix Core

Esta documentación contiene la guía paso a paso para instalar, configurar, inicializar la base de datos y ejecutar el entorno de desarrollo y producción de **Kinetix Core**.

---

## 📋 1. Requisitos Previos del Sistema

Antes de iniciar la instalación, asegúrate de contar con los siguientes elementos instalados en tu sistema:

1. **Node.js**: Versión 18.0.0 o superior (con soporte para ES Modules).
   - Verificación: `node -v`
2. **Motor de Base de Datos SQL Server**:
   - SQL Server LocalDB (`(localdb)\MSSQLLocalDB`), SQL Server Express o SQL Server Standard/Enterprise.
3. **ODBC Driver for SQL Server**:
   - **ODBC Driver 18 for SQL Server** (Obligatorio para conexiones en Windows mediante el driver `msnodesqlv8`).
4. **Herramienta SQL** (Opcional pero recomendada):
   - SQL Server Management Studio (SSMS), Azure Data Studio, o la utilidad `sqlcmd`.

---

## 📁 2. Estructura Principal del Proyecto

```text
Kinetix/
├── app.js                         # Frontend SPA en JavaScript Vanilla
├── index.html                     # Punto de entrada HTML principal
├── styles.css                     # Sistema de diseño y estilos CSS
├── server.js                      # Servidor backend Express y API REST
├── package.json                   # Dependencias y scripts ejecutables
├── .env                           # Variables de entorno locales (Privado)
├── .env.example                   # Plantilla de configuración de variables
├── database/
│   └── kinetix_core.sql           # Script de creación de base de datos, tablas y roles
└── scripts/
    ├── create-user.mjs            # Script para crear/actualizar usuario admin base
    └── create-super-admin.mjs      # Script para crear/actualizar usuario Super Admin
```

---

## ⚡ 3. Paso a Paso para la Inicialización

### Paso 1: Instalación de Dependencias

Abre una terminal en el directorio raíz del proyecto (`c:\Users\hidek\Desktop\Git\Kinetix`) y ejecuta:

```bash
npm install
```

---

### Paso 2: Configuración del Archivo `.env`

Copia el archivo `.env.example` para crear tu archivo `.env` local:

```powershell
Copy-Item .env.example .env
```

Abre `.env` y ajusta los parámetros de conexión según tu entorno SQL Server:

#### Opción A: Conexión con LocalDB (Autenticación de Windows) — *Recomendado para Dev*
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

Ejecuta el script SQL `database/kinetix_core.sql` para crear la base de datos `KinetixCore`, sus tablas principales (`Companies`, `Branches`, `UserOrganizations`, `Roles`, `UserRoles`, `Licenses`), roles por defecto e índices.

Puedes ejecutar el script mediante:

#### Usando PowerShell / `sqlcmd` (LocalDB):
```powershell
sqlcmd -S "(localdb)\MSSQLLocalDB" -i "database\kinetix_core.sql"
```

#### Usando SSMS o Azure Data Studio:
1. Abre **SQL Server Management Studio** o **Azure Data Studio**.
2. Conéctate a tu servidor SQL Server o `(localdb)\MSSQLLocalDB`.
3. Abre el archivo `database/kinetix_core.sql`.
4. Ejecuta el script (**F5**).

#### Paso 3.1: Aplicación de Migraciones (Auditoría y Recursos Humanos)

El sistema cuenta con un motor de migraciones idempotentes que se ejecuta automáticamente al iniciar el servidor, o manualmente mediante:

```powershell
node scripts/run-migrations.mjs
```

Esto aplicará:
- `database/migrations/001_core_audit_hardening.sql`: Trigger `TR_AuditLogs_Immutable`, índices y acciones extendidas.
- `database/migrations/002_hr_core.sql`: Tablas, catálogos, roles de referencia y funciones de visibilidad de RRHH.

---

### Paso 4: Creación de Usuarios Iniciales

Kinetix Core incluye scripts auxiliares en Node.js para aprovisionar los primeros usuarios administradores en la base de datos.

#### Crear Usuario Administrador Normal:
Establece la variable de entorno `NEW_USER_PASSWORD` con la contraseña deseada y ejecuta el script:

```powershell
$env:NEW_USER_PASSWORD="AdminPassword123!"
node scripts/create-user.mjs
```

#### Crear Usuario Super Admin:
Establece la variable de entorno `NEW_SUPER_ADMIN_PASSWORD` (mínimo 10 caracteres) y ejecuta el script:

```powershell
$env:NEW_SUPER_ADMIN_PASSWORD="SuperAdminPassword123!"
node scripts/create-super-admin.mjs
```

---

### Paso 5: Verificación del Código y Pruebas Automatizadas

Antes de lanzar el servidor, puedes ejecutar la verificación de sintaxis y la suite de pruebas unitarias/integración de Recursos Humanos:

```bash
# Verificación de sintaxis general
npm run check
node --check app.js

# Suite de pruebas automatizadas del Módulo de RRHH (Fase 1)
node scripts/test-hr-phase1.mjs

# Suite de pruebas automatizadas del Módulo de RRHH (Fase 2: Asistencia, Vacaciones, Aprobaciones, Notificaciones)
node scripts/test-hr-phase2.mjs
```

Esta suite valida:
- **Fase 1**: Cédula Dominicana (Luhn / Módulo 10), inmutabilidad de auditoría (`UPDATE`/`DELETE` bloqueados), correlativo atómico `EMP-00001`, ciclos jerárquicos y enmascaramiento salarial.
- **Fase 2**: Registro de entradas/salidas con tolerancia y detección de tardanzas, horas regulares y extras, escala legal dominicana de vacaciones (Art. 177: 14 y 18 días), motor de aprobación multietapa con fallback, deducción automática de balance y sistema de notificaciones in-app.

---

### Paso 6: Arrancar la Aplicación

#### Modo Desarrollo:
```bash
npm run dev
```

#### Modo Producción:
```bash
npm start
```

---

## 🌐 4. Acceso y Verificación

Una vez iniciado el servidor:

* **Aplicación Web**: Abre en tu navegador [http://localhost:3000](http://localhost:3000)
* **API Health Check**: Verifica la salud de la aplicación y la conexión a la base de datos navegando a [http://localhost:3000/api/health](http://localhost:3000/api/health)

---

## 🚨 5. Solución de Problemas Frecuentes (Troubleshooting)

| Problema | Causa Posible | Solución |
|---|---|---|
| `Driver={ODBC Driver 18 for SQL Server} not found` | No se encuentra el driver ODBC de SQL Server en Windows. | Descarga e instala **Microsoft ODBC Driver 18 for SQL Server**. |
| `Faltan DB_USER o DB_PASSWORD en el archivo .env` | `DB_AUTH=sql` pero no se definieron las credenciales en `.env`. | Revisa tu `.env` y asegúrate de configurar `DB_USER` y `DB_PASSWORD` o cambiar `DB_AUTH=windows`. |
| `Error: EADDRINUSE :::3000` | El puerto 3000 está ocupado por otro proceso. | Cambia la variable `PORT=3001` en `.env` o finaliza el proceso en el puerto 3000. |
| `No existe una empresa activa para asociar el Super Admin` | No se ha ejecutado el script SQL inicial. | Ejecuta primero `database/kinetix_core.sql` o ejecuta `scripts/create-user.mjs` que crea la empresa base. |
