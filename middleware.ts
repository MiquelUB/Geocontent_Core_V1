// middleware.ts
import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextResponse, type NextRequest } from 'next/server';

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  // 1. Inicialitzem la internacionalització
  const response = intlMiddleware(request);

  if (response.status === 307 || response.status === 308) {
    return response;
  }

  const pathname = request.nextUrl.pathname;
  const isAdminRoute = pathname.includes('/admin') && !pathname.includes('/login');

  // 2. Protecció Edge-Safe (SENSE connexions a BD)
  if (isAdminRoute) {
    // Validem exclusivament la presència de la cookie d'Auth.js o del sistema custom
    const hasSession = 
      request.cookies.has('authjs.session-token') || 
      request.cookies.has('__Secure-authjs.session-token') ||
      request.cookies.has('admin_session');

    if (!hasSession) {
      if (pathname.startsWith('/api/')) {
        return NextResponse.json({ error: 'Accés denegat. Sessió requerida.' }, { status: 401 });
      }
      
      const locale = pathname.split('/')[1] || routing.defaultLocale;
      const loginUrl = new URL(`/${locale}/login`, request.url);
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|manifest.json|.*\\..*).*)']
};
