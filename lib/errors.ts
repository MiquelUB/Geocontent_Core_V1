/**
 * Centralització de la gestió d'errors del sistema Geocontent_Core.
 * Aquest mòdul defineix les classes d'error i les utilitats per a 
 * l'emmascarament i registre (logging) d'excepcions.
 */

export const GENERIC_ERROR_MESSAGE = "Hi ha hagut un error intern al sistema. Per favor, torna-ho a provar més tard.";

export class AppError extends Error {
  public readonly isOperational: boolean;
  public readonly code: string;

  constructor(message: string, code: string = 'INTERNAL_ERROR', isOperational: boolean = true) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR');
  }
}

export class AuthError extends AppError {
  constructor(message: string = "No autoritzat") {
    super(message, 'AUTH_ERROR');
  }
}

/**
 * Utilitat per emmascarar errors tècnics cap al client.
 * En el futur, això podria integrar-se amb un servei de telemetria (Sentry, Axiom).
 */
export function handleError(err: any, context: string) {
  const timestamp = new Date().toISOString();
  const errorId = Math.random().toString(36).substring(7).toUpperCase();
  
  // Log intern detallat (Servidor)
  console.error(`[${timestamp}] [ID:${errorId}] [CONTEXT:${context}]`, err);

  // Retorn segur per al client
  if (err instanceof AppError && err.isOperational) {
    return { success: false, error: err.message, errorId };
  }

  return { success: false, error: GENERIC_ERROR_MESSAGE, errorId };
}
