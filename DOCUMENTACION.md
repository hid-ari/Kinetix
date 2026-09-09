# Kinetix Core

Documentación operativa y técnica del proyecto.

## 1. Acceso rápido

- Aplicación local: http://localhost:3000
- Health check: http://localhost:3000/api/health
- Carpeta del proyecto: `c:\Users\hidek\Desktop\Kinetix`
- Base de datos: `KinetixCore`
- Motor: SQL Server / LocalDB
- Puerto por defecto: `3000`

## 2. Estructura del proyecto

```text
Kinetix/
├── app.js                         Frontend SPA en JavaScript vanilla
├── index.html                     Documento HTML principal
├── styles.css                     Estilos de la aplicación
├── server.js                     API Express y servidor web
├── package.json                   Scripts y dependencias Node.js
├── package-lock.json              Versiones bloqueadas de dependencias
├── .env                           Configuración local, no publicar
├── .env.example                   Plantilla de configuración
├── database/
│   └── kinetix_core.sql           Esquema y datos base de SQL Server
└── scripts/
    └── create-user.mjs            Crea o actualiza el usuario administrador
```

## 3. Documentos importantes

| Documento | Ubicación | Uso |
|---|---|---|
| Frontend | [app.js](app.js) | Estado, vistas, formularios y llamadas API |
| HTML principal | [index.html](index.html) | Punto de entrada del navegador |
| Estilos | [styles.css](styles.css) | Diseño responsive y componentes visuales |
| Backend | [server.js](server.js) | API, autenticación, sesiones y SQL |
| Esquema SQL | [database/kinetix_core.sql](database/kinetix_core.sql) | Tablas, relaciones, índices, roles y permisos |
| Creación de usuario | [scripts/create-user.mjs](scripts/create-user.mjs) | Alta o actualización del usuario administrador |
| Dependencias | [package.json](package.json) | Scripts npm y paquetes |
| Configuración de ejemplo | [.env.example](.env.example) | Variables necesarias para ejecutar el proyecto |
| Configuración local | `.env` | Valores reales de la máquina local; no compartir ni subir al repositorio |

## 4. Instalación y ejecución

Requisitos:

- Node.js con soporte para módulos ES.
- SQL Server o SQL Server LocalDB.
- ODBC Driver 18 for SQL Server cuando se usa autenticación Windows.

Instalar dependencias:

```powershell
cd C:\Users\hidek\Desktop\Kinetix
npm install
```

Comprobar sintaxis:

```powershell
npm run check
node --check app.js
```

Iniciar la aplicación:

```powershell
npm start
```

Abrir en el navegador:

```text
http://localhost:3000
```

## 5. Configuración `.env`

Configuración recomendada para LocalDB:

```env
DB_SERVER=(localdb)\MSSQLLocalDB
DB_DATABASE=KinetixCore
DB_AUTH=windows
DB_TRUST_SERVER_CERTIFICATE=true
PORT=3000
```

Configuración para SQL Server con usuario y contraseña:

```env
DB_SERVER=localhost
DB_PORT=1433
DB_DATABASE=KinetixCore
DB_AUTH=sql
DB_USER=sa
DB_PASSWORD=REEMPLAZAR
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true
PORT=3000
```

Notas:

- `.env` contiene configuración local y debe permanecer fuera del control de versiones.
- No copiar contraseñas, tokens ni cadenas de conexión reales en documentación pública.
- `DB_AUTH=windows` usa `msnodesqlv8` y conexión confiable.
- El servidor limpia el pool si la primera conexión SQL falla y permite reintentar.

## 6. Base de datos

Script principal:

[database/kinetix_core.sql](database/kinetix_core.sql)

Tablas principales:

- `Companies`: empresas y datos de contacto.
- `Branches`: sucursales por empresa.
- `UserOrganizations`: usuarios, organización, contraseña y estado.
- `Roles`: roles del sistema y personalizados.
- `UserRoles`: relación usuarios-roles.
- `Permissions`: catálogo de permisos.
- `RolePermissions`: relación roles-permisos.
- `AuditLogs`: actividad y cambios administrativos.

Vista principal:

- `dbo.vw_CompaniesList`: conteos de usuarios y sucursales por empresa.

Relaciones relevantes:

```text
Companies 1 ─── N Branches
Companies 1 ─── N UserOrganizations
UserOrganizations N ─── N Roles
Roles N ─── N Permissions
UserOrganizations 1 ─── N AuditLogs
```

Importante: el script SQL base crea tablas e inserta datos iniciales. No debe ejecutarse repetidamente sobre una base ya inicializada sin convertirlo antes en migraciones idempotentes.

## 7. Usuario administrador

Script:

```powershell
$env:NEW_USER_PASSWORD = "CambiarEstaPassword"
node scripts/create-user.mjs
```

El script crea o actualiza:

- Usuario: `hideki-ariyama`
- Empresa: `Kinetrix`
- Rol: `Company Admin`
- Email definido dentro del script

Cambiar la contraseña temporal antes de usar el sistema en un entorno real.

## 8. API

### Rutas públicas

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/health` | Comprueba conexión con SQL Server |
| `POST` | `/api/auth/login` | Inicia sesión y crea cookie HttpOnly |

### Autenticación

| Método | Ruta | Descripción |
|---|---|---|
| `POST` | `/api/auth/logout` | Invalida la sesión actual |
| `POST` | `/api/auth/change-password` | Cambia la contraseña verificando la actual |

### Empresas

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/companies?page=1&pageSize=20` | Listado paginado y búsqueda disponible en API |
| `POST` | `/api/companies` | Crea una empresa; requiere administrador |
| `PUT` | `/api/companies/:id` | Edita una empresa; requiere administrador |
| `PATCH` | `/api/companies/:id/status` | Activa o desactiva una empresa |

### Usuarios

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/users` | Lista usuarios y su rol principal |
| `POST` | `/api/users` | Crea usuario, hash y asignación de rol |
| `PUT` | `/api/users/:id` | Edita datos básicos |
| `PATCH` | `/api/users/:id/status` | Activa o desactiva usuario |

### Perfil

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/profile` | Carga el perfil de la sesión actual |
| `PUT` | `/api/profile` | Actualiza nombre, email y teléfono |

### Sucursales

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/branches` | Lista sucursales |
| `POST` | `/api/branches` | Crea una sucursal; requiere administrador |

### Roles y permisos

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/roles` | Lista roles activos |
| `POST` | `/api/roles` | Crea un rol; requiere administrador |
| `GET` | `/api/permissions` | Lista permisos disponibles |
| `GET` | `/api/roles/:id/permissions` | Consulta permisos asignados |
| `PUT` | `/api/roles/:id/permissions` | Reemplaza asignaciones; requiere administrador |

### Auditoría

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/audit` | Lista auditoría y permite filtrar por `search`, `module` y `action` |

Ejemplo:

```text
/api/audit?search=Hideki&module=Acceso&action=LOGIN
```

## 9. Sesiones y seguridad

- La sesión usa cookie `kinetix_session`.
- La cookie es `HttpOnly`, `SameSite=Lax`, `Path=/` y `Secure` en producción.
- Duración actual: 8 horas.
- Las sesiones se guardan en `dbo.UserSessions`; el navegador conserva únicamente un token HttpOnly y la base almacena su hash.
- Las sesiones sobreviven reinicios y permiten múltiples instancias del servidor usando la misma base de datos.
- Las rutas API requieren autenticación salvo health y login.
- Las operaciones administrativas requieren rol `Super Admin` o `Company Admin`.
- El backend usa consultas parametrizadas para entradas SQL.
- Las contraseñas se almacenan con PBKDF2-SHA512, salt aleatorio y 310000 iteraciones.
- Se registran headers básicos: `X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy`.

## 10. Flujo de carga del frontend

1. El navegador abre `/`.
2. El usuario envía email y contraseña a `/api/auth/login`.
3. El backend crea la cookie de sesión.
4. `app.js` carga empresas, usuarios, sucursales, roles, permisos, auditoría y perfil.
5. Si un recurso obligatorio falla, la interfaz identifica el módulo en el mensaje.
6. Los permisos son opcionales para no bloquear todo el workspace si la tabla no está disponible.

## 11. Funcionalidades implementadas

- Login con sesión de servidor.
- Logout.
- Cambio de contraseña.
- Perfil editable.
- Listado paginado de empresas.
- Creación y edición de empresas.
- Activación y desactivación de empresas.
- Listado y creación de usuarios.
- Edición y cambio de estado de usuarios.
- Listado y creación de sucursales.
- Detalle de sucursales.
- Listado y creación de roles.
- Asignación persistente de permisos.
- Auditoría de login, creación, actualización, activación y cambios de contraseña.
- Filtros de auditoría por texto, módulo y acción.
- Escape de valores dinámicos en varias vistas del frontend.

## 12. Pendientes importantes

- Aplicar aislamiento por `CompanyId` a todas las consultas y mutaciones.
- Añadir el campo de contraseña al formulario de creación de usuarios.
- Reemplazar datos escapados en estado por datos crudos y escapar solo al renderizar.
- Completar filtros de empresas, usuarios y sucursales con parámetros de API.
- Cargar empresas, sucursales y roles dinámicamente en el formulario de usuarios.
- Cargar las asignaciones actuales antes de editar permisos.
- Hacer transaccional el cambio de datos y su auditoría.
- Mover sesiones a Redis o almacenamiento persistente en producción.
- Registrar intentos fallidos de login.
- Añadir recuperación de contraseña.
- Añadir edición completa de sucursales y eliminación lógica.
- Crear migraciones SQL idempotentes.
- Añadir pruebas unitarias, de integración API y de navegador.
- Añadir rate limiting, CSP y logging estructurado.
- Añadir exportación de auditoría.

## 13. Comprobaciones rápidas

```powershell
npm run check
node --check app.js
```

Comprobar API:

```powershell
Invoke-WebRequest http://localhost:3000/api/health -UseBasicParsing
```

Resultado esperado:

```json
{
  "connected": true,
  "databaseName": "KinetixCore"
}
```

Una ruta protegida sin sesión debe devolver `401`:

```powershell
Invoke-WebRequest http://localhost:3000/api/companies -UseBasicParsing
```

El esquema SQL no debe estar expuesto:

```powershell
Invoke-WebRequest http://localhost:3000/database/kinetix_core.sql -UseBasicParsing
```

Resultado esperado: `404`.

## 14. Errores HTTP principales

| Código | Significado |
|---|---|
| `200` | Consulta o actualización correcta |
| `201` | Registro creado |
| `204` | Operación correcta sin contenido |
| `400` | Datos inválidos o incompletos |
| `401` | Falta sesión o credenciales inválidas |
| `403` | Usuario sin permisos o inactivo |
| `404` | Registro o ruta no encontrada |
| `409` | Duplicado, por ejemplo RNC, email o código |
| `500` | Error interno de aplicación o base de datos |
| `503` | Base de datos o validación de sesión no disponible |

## 15. Recomendación de despliegue

Antes de producción:

1. Usar HTTPS y `NODE_ENV=production`.
2. Sacar sesiones de memoria a Redis o base de datos.
3. Aplicar aislamiento de empresa en backend.
4. Ejecutar migraciones versionadas.
5. No exponer `.env`, SQL ni scripts administrativos.
6. Configurar backups de `KinetixCore`.
7. Añadir monitoreo de `/api/health`.
8. Ejecutar pruebas automatizadas en cada cambio.
