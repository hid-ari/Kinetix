import { rateLimit } from 'express-rate-limit';

// M-05: Rate limiting para login — Permisivo en desarrollo para pruebas fluidas de usuarios
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 20 : 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Demasiados intentos de acceso. Inténtalo de nuevo en 15 minutos.' }
});

/**
 * Middleware para configurar cabeceras HTTP de seguridad (CSP, HSTS, X-Frame-Options, etc.).
 */
export function securityHeadersMiddleware(_request, response, next) {
  // M-06: Content-Security-Policy
  response.setHeader('Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
    "font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self';");
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'same-origin');
  
  // S-04: HSTS solo en producción
  if (process.env.NODE_ENV === 'production') {
    response.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  }
  next();
}
