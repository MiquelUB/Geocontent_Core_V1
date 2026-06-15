import NextAuth from "next-auth"
import { authConfig } from "./auth.config"
import { NextResponse } from "next/server"
import { routing } from './i18n/routing';
import createMiddleware from 'next-intl/middleware';

const { auth } = NextAuth(authConfig)
const intlMiddleware = createMiddleware(routing);

export default auth((req) => {
  const pathname = req.nextUrl.pathname;
  
  const isLoggedIn = !!req.auth;
  const role = req.auth?.user?.role;
  
  const segments = pathname.split('/');
  const locale = routing.locales.includes(segments[1] as any) ? segments[1] : routing.defaultLocale;

  // Comprovar si conté /admin (sense comptar el segment de locale si hi és)
  const isAdminPath = segments.includes('admin');
  const isLoginPage = segments.includes('login') && isAdminPath;

  if (isAdminPath && !isLoginPage) {
    if (!isLoggedIn) {
      return NextResponse.redirect(new URL(`/${locale}/admin/login`, req.url));
    }
    
    if (role === 'TOURIST') {
      return NextResponse.redirect(new URL(`/${locale}`, req.url));
    }
  }

  return intlMiddleware(req);
})

export const config = {
  // Matcher que exclou fitxers estàtics i rutes d'API
  matcher: ['/((?!api|reports|_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf)$).*)'],
}
