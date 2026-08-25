import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_APP_URL || '';

/**
 * Aplica headers CORS restrictius a una resposta d'API.
 * Només permet peticions des del domini de l'aplicació (NEXT_PUBLIC_APP_URL).
 * Peticions sense Origin (ex: curl, same-origin) passen sense restriccions.
 */
export function withCors(request: NextRequest, response: NextResponse): NextResponse {
  const origin = request.headers.get('origin') || '';
  // Permet: mateix origen, peticions directes (sense Origin), localhost en dev
  const isAllowed =
    !origin ||
    origin === ALLOWED_ORIGIN ||
    (process.env.NODE_ENV !== 'production' && origin.includes('localhost'));

  response.headers.set(
    'Access-Control-Allow-Origin',
    isAllowed ? (origin || ALLOWED_ORIGIN) : ''
  );
  response.headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type');
  response.headers.set('Access-Control-Max-Age', '86400');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  return response;
}

/**
 * Gestiona preflight OPTIONS requests per a rutes públiques.
 */
export function handleOptions(request: NextRequest): NextResponse {
  return withCors(request, new NextResponse(null, { status: 204 }));
}
