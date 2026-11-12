import { badRequest } from '../../core/http.js';

/**
 * Validación y normalización de payloads del módulo de Administración.
 * Cada parser devuelve un objeto limpio o lanza HttpError(400).
 */

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const MIN_PASSWORD_LENGTH = 8;
export const SUPER_ADMIN_ROLE = 'Super Admin';

/** Alias de UI -> nombre canónico del rol en BD. */
const ROLE_ALIASES = {
  'empleado': 'Employee',
  'administrador': 'Company Admin',
  'administrador de empresa': 'Company Admin',
  'super administrador': SUPER_ADMIN_ROLE
};

const text = (value, max) => {
  const trimmed = String(value ?? '').trim();
  return max ? trimmed.slice(0, max) : trimmed;
};
const optionalText = (value, max) => text(value, max) || null;

function requireEmail(value) {
  const email = text(value, 150);
  if (!email) throw badRequest('El email es obligatorio.');
  if (!EMAIL_PATTERN.test(email)) throw badRequest('El email no es válido.');
  return email;
}

export function assertPassword(password, { required = true } = {}) {
  const value = String(password ?? '');
  if (!value) {
    if (required) throw badRequest('La contraseña es obligatoria.');
    return null;
  }
  if (value.length < MIN_PASSWORD_LENGTH) {
    throw badRequest(`La contraseña debe tener al menos ${MIN_PASSWORD_LENGTH} caracteres.`);
  }
  return value;
}

export function normalizeRoleName(role) {
  const name = text(role, 100);
  if (!name) return null;
  return ROLE_ALIASES[name.toLowerCase()] || name;
}

function optionalEmployeeId(value) {
  if (value === undefined) return undefined;          // no tocar vínculo
  if (value === null || value === '') return null;    // desvincular
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw badRequest('Expediente de empleado inválido.');
  return id;
}

/** Usuario: alta (`isCreate`) o edición. */
export function parseUserBody(body = {}, { isCreate }) {
  const firstName = text(body.firstName, 100);
  const lastName = text(body.lastName, 100);
  if (!firstName || !lastName) throw badRequest('Nombre y apellido son obligatorios.');
  return {
    firstName,
    lastName,
    email: requireEmail(body.email),
    phone: optionalText(body.phone, 30),
    branchName: optionalText(body.branch, 150),
    roleName: normalizeRoleName(body.role) || (isCreate ? 'Employee' : null),
    password: assertPassword(body.password, { required: isCreate }),
    employeeId: optionalEmployeeId(body.employeeId)
  };
}

export function parseProfileBody(body = {}) {
  const firstName = text(body.firstName, 100);
  const lastName = text(body.lastName, 100);
  if (!firstName || !lastName) throw badRequest('Nombre y apellido son obligatorios.');
  return { firstName, lastName, email: requireEmail(body.email), phone: optionalText(body.phone, 30) };
}

export function parseBranchBody(body = {}) {
  const name = text(body.name);
  const code = text(body.code).toUpperCase();
  if (!name || !code) throw badRequest('Nombre y código son obligatorios.');
  if (name.length > 150) throw badRequest('El nombre no puede superar 150 caracteres.');
  if (code.length > 30) throw badRequest('El código no puede superar 30 caracteres.');
  const email = text(body.email);
  if (email && !EMAIL_PATTERN.test(email)) throw badRequest('El email de la sucursal no es válido.');
  return {
    Name: name,
    Code: code,
    Address: optionalText(body.address, 300),
    Phone: optionalText(body.phone, 30),
    Email: email || null,
    ManagerUserId: optionalText(body.managerUserId)
  };
}

/** RNC dominicano: 9 u 11 dígitos (DGII / Ley 253-12). */
export function validateRnc(rnc) {
  if (!rnc) return false;
  const digits = String(rnc).replace(/\D/g, '');
  return digits.length === 9 || digits.length === 11;
}

export function parseCompanyBody(body = {}) {
  const name = text(body.name, 200);
  const rnc = text(body.rnc, 20);
  if (!name || !rnc) throw badRequest('Nombre, RNC y email son obligatorios.');
  if (!validateRnc(rnc)) throw badRequest('El RNC debe tener 9 u 11 dígitos numéricos (formato DGII).');
  return {
    Name: name,
    Rnc: rnc,
    ContactEmail: requireEmail(body.email),
    Phone: optionalText(body.phone, 30),
    Address: optionalText(body.address, 300)
  };
}

/** Normaliza un arreglo de IDs de permisos (únicos y enteros) o devuelve null. */
export function parsePermissionIds(value) {
  if (!Array.isArray(value)) return null;
  return [...new Set(value.map(Number).filter(n => Number.isInteger(n) && n > 0))];
}

export function parseBoolean(value, label = 'isActive') {
  if (typeof value !== 'boolean') throw badRequest(`${label} debe ser booleano.`);
  return value;
}

export function parseAuditFilters(query = {}) {
  return {
    search: text(query.search, 100),
    module: optionalText(query.module, 100),
    action: optionalText(query.action, 50)
  };
}

