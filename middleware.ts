import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

const intlMiddleware = createMiddleware(routing);

export async function middleware(request: NextRequest) {
  // 1. Intercepció primerenca: Resolució de cookies SENSE tocar Prisma/Postgres
  // Auth.js pot utilitzar diferents noms de cookies segons l'entorn i la versió
  const token = 
    request.cookies.get('next-auth.session-token')?.value || 
    request.cookies.get('__Secure-next-auth.session-token')?.value ||
    request.cookies.get('authjs.session-token')?.value ||
    request.cookies.get('__Secure-authjs.session-token')?.value;

  const { pathname } = request.nextUrl;
  
  // 2. Protecció de rutes d'administració
  const isProtectedPath = (pathname.includes('/admin') || pathname.includes('/api/admin')) && !pathname.includes('/login');

  if (isProtectedPath && !token) {
    if (pathname.includes('/api/')) {
      return NextResponse.json({ success: false, error: 'No autoritzat. Sessió requerida.' }, { status: 401 });
    }

    const segments = pathname.split('/');
    const locale = routing.locales.includes(segments[1] as any) ? segments[1] : routing.defaultLocale;
    const loginUrl = new URL(`/${locale}/login`, request.nextUrl);
    
    return NextResponse.redirect(loginUrl);
  }

  // 3. Inicialització de la resposta i execució de next-intl
  return intlMiddleware(request);
}

export const config = {
  matcher: ['/((?!api/upload/notify|_next/static|_next/image|favicon.ico|manifest.json|.*\\..*).*)']
};
