import { isUniqueViolation } from './db.js';

/**
 * Error de dominio con código HTTP asociado.
 * Las capas de servicio/repositorio lanzan HttpError y el manejador central
 * lo traduce a una respuesta JSON coherente.
 */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

export const badRequest = message => new HttpError(400, message);
export const forbidden = message => new HttpError(403, message);
export const notFound = message => new HttpError(404, message);
export const conflict = message => new HttpError(409, message);

/**
 * Envuelve un handler async y centraliza el manejo de errores:
 *  - HttpError            -> su status y mensaje
 *  - Violación UNIQUE (pg) -> 409 con `duplicateMessage`
 *  - Cualquier otro error  -> 500 con `fallbackMessage` (sin filtrar detalles internos)
 */
export function asyncHandler(handler, { fallbackMessage = 'Error interno del servidor.', duplicateMessage = 'El registro ya existe.' } = {}) {
  return async (request, response, next) => {
    try {
      await handler(request, response, next);
    } catch (error) {
      if (response.headersSent) return next(error);
      if (error instanceof HttpError || (error?.status && error.status < 500)) {
        return response.status(error.status).json({ message: error.message });
      }
      if (isUniqueViolation(error)) {
        return response.status(409).json({ message: duplicateMessage });
      }
      console.error(`[${request.method} ${request.originalUrl}]`, error.message);
      response.status(500).json({ message: fallbackMessage });
    }
  };
}

/** Convierte un parámetro en entero positivo o lanza 400. */
export function parsePositiveInt(value, label = 'Identificador') {
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) throw badRequest(`${label} inválido.`);
  return number;
}

