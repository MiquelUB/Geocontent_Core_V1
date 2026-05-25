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
  const isTargetingAdmin = pathname.includes('/admin');
  const isLoginPage = pathname.includes('/admin/login');

  if (isTargetingAdmin && !isLoginPage) {
    if (!isLoggedIn) {
      const locale = pathname.split('/')[1] || routing.defaultLocale;
      return NextResponse.redirect(new URL(`/${locale}/admin/login`, req.url));
    }
    
    if (role === 'TOURIST') {
      const locale = pathname.split('/')[1] || routing.defaultLocale;
      return NextResponse.redirect(new URL(`/${locale}`, req.url));
    }
  }

  return intlMiddleware(req);
})

export const config = {
  // Matcher que exclou fitxers estàtics i rutes d'API
  matcher: ['/((?!api|reports|_next/static|_next/image|favicon.ico|manifest.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|pdf)$).*)'],
}
