import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';
import { auth } from '@/auth';

/**
 * Geocontent Core V2: Middleware de Sobirania Tecnològica
 * 
 * Gestiona:
 * 1. Internacionalització (next-intl)
 * 2. Autenticació Edge-side (Auth.js v5)
 */

const intlMiddleware = createMiddleware(routing);

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const { pathname } = req.nextUrl;

  // 1. Execució de la internacionalització
  const response = intlMiddleware(req);

  // Si next-intl fa una redirecció (ex: /admin -> /ca/admin), la respectem
  if (response.status === 307 || response.status === 308) {
    return response;
  }

  // 2. Protecció de rutes d'administració
  // Detectem rutes /admin o /api/admin, excloent la pàgina de login per evitar bucles.
  const isProtectedPath = (pathname.includes('/admin') || pathname.includes('/api/admin')) && !pathname.includes('/login');

  if (isProtectedPath && !isLoggedIn) {
    // Si és una crida d'API, retornem 401
    if (pathname.includes('/api/')) {
      return Response.json({ success: false, error: 'No autoritzat. Sessió requerida.' }, { status: 401 });
    }

    // Si és una ruta de pàgina, redireccionem al login (mantenint el locale si és possible)
    const segments = pathname.split('/');
    const locale = routing.locales.includes(segments[1] as any) ? segments[1] : routing.defaultLocale;
    const loginUrl = new URL(`/${locale}/login`, req.nextUrl);
    
    return Response.redirect(loginUrl);
  }

  return response;
});

export const config = {
  // Matcher per a rutes de l'aplicació, excloent fitxers estàtics i assets
  matcher: ['/((?!api/upload/notify|_next/static|_next/image|favicon.ico|manifest.json|.*\\..*).*)']
};
