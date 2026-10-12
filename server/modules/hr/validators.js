/**
 * Validators for HR entities, documents, and business rules.
 */

/**
 * Validates a Dominican Republic Cédula (11 digits, Luhn algorithm).
 * Accepts formatted (001-1234567-8) or clean (00112345678).
 */
export function validateDominicanCedula(rawCedula) {
  if (!rawCedula) return false;
  const clean = String(rawCedula).replace(/\D/g, '');
  if (clean.length !== 11) return false;

  // Cannot be all zeros
  if (/^0{11}$/.test(clean)) return false;

  const weights = [1, 2, 1, 2, 1, 2, 1, 2, 1, 2];
  let sum = 0;

  for (let i = 0; i < 10; i++) {
    const digit = parseInt(clean[i], 10);
    let product = digit * weights[i];
    if (product >= 10) {
      product = Math.floor(product / 10) + (product % 10);
    }
    sum += product;
  }

  const verifier = (10 - (sum % 10)) % 10;
  return verifier === parseInt(clean[10], 10);
}

/**
 * Formats a clean 11-digit cedula to standard format: 000-0000000-0
 */
export function formatCedula(rawCedula) {
  const clean = String(rawCedula || '').replace(/\D/g, '');
  if (clean.length !== 11) return rawCedula;
  return `${clean.slice(0, 3)}-${clean.slice(3, 10)}-${clean.slice(10)}`;
}

/**
 * Validates document based on type
 */
export function validateDocument(type, number) {
  if (!number || !String(number).trim()) return { valid: false, message: 'El número de documento es obligatorio.' };
  const clean = String(number).trim();

  if (type === 'Cedula') {
    if (!validateDominicanCedula(clean)) {
      return { valid: false, message: 'La cédula dominicana no es válida (debe tener 11 dígitos y dígito verificador correcto).' };
    }
  } else if (type === 'Pasaporte') {
    if (clean.length < 5 || clean.length > 20) {
      return { valid: false, message: 'El pasaporte debe tener entre 5 y 20 caracteres.' };
    }
  } else {
    if (clean.length < 3 || clean.length > 30) {
      return { valid: false, message: 'El número de documento debe tener entre 3 y 30 caracteres.' };
    }
  }
  return { valid: true };
}

/**
 * Validates salary range
 */
export function validateSalaryRange(min, max) {
  const numMin = min != null ? Number(min) : null;
  const numMax = max != null ? Number(max) : null;

  if (numMin != null && (isNaN(numMin) || numMin < 0)) {
    return { valid: false, message: 'El salario mínimo debe ser un número positivo.' };
  }
  if (numMax != null && (isNaN(numMax) || numMax < 0)) {
    return { valid: false, message: 'El salario máximo debe ser un número positivo.' };
  }
  if (numMin != null && numMax != null && numMin > numMax) {
    return { valid: false, message: 'El salario mínimo no puede ser mayor que el salario máximo.' };
  }
  return { valid: true };
}

/**
 * Validates employee payload on create or update
 */
export function validateEmployeeInput(data, isUpdate = false) {
  const errors = [];

  if (!isUpdate || data.firstName !== undefined) {
    if (!data.firstName || !data.firstName.trim()) errors.push('El nombre es obligatorio.');
  }
  if (!isUpdate || data.lastName !== undefined) {
    if (!data.lastName || !data.lastName.trim()) errors.push('Los apellidos son obligatorios.');
  }

  if (!isUpdate || data.documentType !== undefined || data.documentNumber !== undefined) {
    const docType = data.documentType || 'Cedula';
    const docNum = data.documentNumber;
    const docCheck = validateDocument(docType, docNum);
    if (!docCheck.valid) errors.push(docCheck.message);
  }

  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email.trim())) {
    errors.push('El formato de correo electrónico no es válido.');
  }

  if (!isUpdate || data.hireDate !== undefined) {
    if (!data.hireDate || isNaN(Date.parse(data.hireDate))) {
      errors.push('La fecha de ingreso es obligatoria y debe ser válida.');
    }
  }

  if (data.birthDate && isNaN(Date.parse(data.birthDate))) {
    errors.push('La fecha de nacimiento no es válida.');
  }

  if (data.baseSalary !== undefined && data.baseSalary !== null) {
    const salary = Number(data.baseSalary);
    if (isNaN(salary) || salary < 0) {
      errors.push('El salario base no puede ser negativo.');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}
