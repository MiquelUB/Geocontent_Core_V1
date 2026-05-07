import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { NextResponse, type NextRequest } from 'next/server';

const intlMiddleware = createMiddleware(routing);

export default async function middleware(request: NextRequest) {
  // 1. Inicialitzem la resposta i resolem la internacionalització (SENSE mutar estats de sessió encara)
  let response = intlMiddleware(request);

  if (response.status === 307 || response.status === 308) {
    return response;
  }

  const pathname = request.nextUrl.pathname;
  const isAdminRoute = (pathname.includes('/admin') || pathname.includes('/api/admin')) && !pathname.includes('/login');

  // 2. Protecció de rutes d'administració (Edge-safe, llegint cookies directament)
  if (isAdminRoute) {
    const token = 
      request.cookies.get('next-auth.session-token')?.value || 
      request.cookies.get('__Secure-next-auth.session-token')?.value ||
      request.cookies.get('authjs.session-token')?.value ||
      request.cookies.get('__Secure-authjs.session-token')?.value;

    if (!token) {
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
  matcher: ['/((?!api/upload/notify|_next/static|_next/image|favicon.ico|manifest.json|.*\\..*).*)']
};
