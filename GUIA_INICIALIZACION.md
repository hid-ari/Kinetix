# Guía de Inicialización — Kinetix Core

Kinetix Core utiliza **PostgreSQL** como motor de persistencia a través de una **capa de abstracción única** (`server/core/db.js`).

> **💡 Arquitectura de Base de Datos Agnóstica**:
> Todo el backend interactúa exclusivamente con la interfaz universal de `server/core/db.js` (`query`, `request().input()`, `transaction()`). Cambiar a otro motor (MySQL, SQLite, etc.) solo requiere ajustar ese único archivo sin tocar repositorios ni lógica de negocio.

---

## 📋 1. Requisitos Previos

1. **Node.js**: v18.0.0 o superior (`node -v`).
2. **PostgreSQL**: v14 o superior (servicio en ejecución en puerto 5432).

---

## ⚡ 2. Inicialización Rápida (3 Pasos)

### Paso 1: Instalar dependencias
```bash
npm install
```

### Paso 2: Configurar `.env`
El archivo `.env` en la raíz ya viene preconfigurado para PostgreSQL local:
```env
PORT=3000
NODE_ENV=development

PGHOST=localhost
PGPORT=5432
PGDATABASE=kinetix
PGUSER=postgres
PGPASSWORD=
```
*(Opcionalmente puedes usar una URL de conexión: `DATABASE_URL=postgres://usuario:clave@host:5432/kinetix`)*

### Paso 3: Aplicar migraciones y datos semilla
El script crea la base de datos si no existe y aplica las migraciones de forma automática e idempotente:
```bash
npm run migrate
```

---

## 🚀 3. Ejecución del Servidor

```bash
npm start
```
El servidor quedará disponible en: **`http://localhost:3000`**

---

## 🧪 4. Pruebas Automatizadas

Puedes ejecutar toda la suite de pruebas con un solo comando:
```bash
npm test
```

O probar módulos individuales:
- `npm run test:smoke` — Comprueba conectividad HTTP y códigos 2xx/4xx de todos los endpoints con los 6 roles del sistema.
- `npm run test:roles` — Valida protección de roles del sistema, permisos dinámicos y auditoría.
- `npm run test:phase1` — Valida cédula dominicana (Luhn), inmutabilidad de auditoría, códigos correlativos y árbol jerárquico acíclico.
- `npm run test:phase2` — Valida turnos, tardanzas, horas extras, cálculo Art. 177 de vacaciones, flujos multietapa y licencias.
- `npm run test:usage` — Flujo end-to-end de RRHH simulando un ciclo de vida completo de un empleado.

---

## 👥 5. Credenciales Semilla para Pruebas

Todas las cuentas usan la contraseña por defecto: **`Admin12345!`**

| Rol | Correo | Alcance |
|---|---|---|
| **Super Admin** | `superadmin@kinetix.local` | Acceso global a todas las empresas |
| **Admin de Empresa** | `ana.martinez@kinetix.com` | Administrador de empresa |
| **Director de RRHH** | `director.rrhh@kinetix.local` | Módulo de Recursos Humanos completo |
| **Empleado** | `carlos.mendoza@kinetix.local` | Terminal de ponche, vacaciones y solicitudes |
